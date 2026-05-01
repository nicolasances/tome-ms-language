# Practice Sessions — Feature Spec

## Overview

This spec defines the **practice session** capability in `tome-ms-language`. A practice session represents a single timed exercise in which a user is presented with a set of words and submits answers. This spec covers the full session lifecycle: starting a session, retrieving an active session, recording answers, and completing the session.

Sessions are **generic by design**: the `practiceType` field allows new practice types to be added in the future without structural changes. The only practice type defined in this spec is **`"vocabulary"`** (English → Target Language translation).

Sessions are **user-specific**: all data (sessions, word statistics) is scoped to the authenticated user. User identity is taken from the `UserContext` provided by the `totoms` framework.

---

## Concepts

### Practice Type: Vocabulary
A vocabulary session presents the user with `N` English words. For each word, the user must type the translation in the Target Language from memory. The session ends when all words have been answered correctly (words that were answered incorrectly are re-queued by the frontend until they are mastered).

### Frontend Queue Ownership
The frontend is responsible for managing the **word queue** during a session (the order in which words are presented, deferring incorrect answers to the end, tracking mastered vs. deferred state). The backend only stores the original list of words assigned to the session and records each submitted answer.

This means that on session resume, the backend returns the original word list. The frontend is responsible for restoring its local queue state (e.g. from localStorage). If local state is lost, the frontend falls back to presenting all words as pending.

### One Active Session per User
A user may have **at most one active session at a time** across all languages and practice types. Attempting to start a new session while one is already active results in a `409 Conflict`.

---

## Data Model

### `sessions` Collection

Stores practice sessions. One document per session.

| Field         | Type              | Description                                                               |
|---------------|-------------------|---------------------------------------------------------------------------|
| `_id`         | ObjectId          | MongoDB-generated identifier                                              |
| `userId`      | string            | User identifier from the authentication token                             |
| `language`    | string            | Target language code (e.g. `"danish"`)                                    |
| `practiceType`| string            | Practice type identifier (e.g. `"vocabulary"`)                            |
| `status`      | string            | `"active"` or `"completed"`                                               |
| `payload`     | object            | Type-specific session data. Shape depends on `practiceType` (see below)   |
| `createdAt`   | string (ISO 8601) | Session creation timestamp                                                |
| `completedAt` | string or null    | ISO 8601 timestamp when the session was completed; `null` if still active |

Generic session operations (finding an active session, validating ownership, marking completed) never need to read inside `payload`. All type-specific logic reads and writes `payload` fields exclusively.

**Index**: `{ userId: 1, status: 1 }` — supports fast lookup of the active session for a user.

#### Vocabulary Session Payload (`practiceType = "vocabulary"`)

The `payload` sub-document for a vocabulary session has the following shape:

| Field        | Type             | Description                                                        |
|--------------|------------------|--------------------------------------------------------------------|
| `words`      | array of objects | The words assigned to this session (see `words` entry below)       |
| `totalWords` | number           | Total number of words in the session                               |
| `answers`    | array of objects | All answers submitted during the session, in order (see below)     |

##### `payload.words` Entry

| Field         | Type   | Description                                   |
|---------------|--------|-----------------------------------------------|
| `wordId`      | string | MongoDB ObjectId of the vocabulary entry      |
| `english`     | string | The English source word                       |
| `translation` | string | The Target Language translation               |

##### `payload.answers` Entry

| Field         | Type    | Description                                              |
|---------------|---------|----------------------------------------------------------|
| `entityId`    | string  | The `wordId` of the vocabulary entry this answer relates to |
| `isCorrect`   | boolean | Whether the answer was marked correct                    |
| `submittedAt` | string  | ISO 8601 timestamp of when the answer was submitted      |

The field name `entityId` is used (rather than `wordId`) to keep the answer schema generic across practice types. In a vocabulary session, `entityId` always maps to a `wordId`.

---

### `word_stats` Collection

Tracks per-user, per-word practice statistics used to weight word selection.

| Field           | Type    | Description                                                          |
|-----------------|---------|----------------------------------------------------------------------|
| `_id`           | ObjectId | MongoDB-generated identifier                                        |
| `userId`        | string  | User identifier                                                      |
| `wordId`        | string  | MongoDB ObjectId of the vocabulary entry                             |
| `language`      | string  | Target language code                                                 |
| `totalAttempts` | number  | Total number of times this word has been submitted across all sessions|
| `totalFailures` | number  | Total number of incorrect answers across all sessions                |
| `failureRatio`  | number  | Pre-computed `totalFailures / totalAttempts` (0.0–1.0)              |
| `lastPracticed` | string  | ISO 8601 timestamp of the last session that included this word       |
| `updatedAt`     | string  | ISO 8601 timestamp of the last update to this document              |

**Index**: `{ userId: 1, wordId: 1 }` (unique) — supports fast upsert by user+word.  
**Index**: `{ userId: 1, language: 1 }` — supports loading all stats for a user's language in one query.

---

## API Endpoints

All paths are relative to the service base path `/tomelang`.

| Operation       | Method | Path                                    | Delegate          |
|-----------------|--------|-----------------------------------------|-------------------|
| StartSession    | `POST` | `/languages/:language/sessions`         | `StartSession`    |
| GetActiveSession| `GET`  | `/sessions/active`                      | `GetActiveSession`|
| SubmitAnswer    | `POST` | `/sessions/:sessionId/answers`          | `SubmitAnswer`    |
| CompleteSession | `POST` | `/sessions/:sessionId/completion`       | `CompleteSession` |

---

## Endpoint Specifications

### POST `/languages/:language/sessions` — StartSession

Starts a new practice session for the authenticated user.

#### Path Parameters

| Parameter  | Description                         |
|------------|-------------------------------------|
| `language` | Target language (e.g. `"danish"`)   |

#### Request Body

```json
{
  "practiceType": "vocabulary"
}
```

| Field          | Required | Description                                |
|----------------|----------|--------------------------------------------|
| `practiceType` | Yes      | The type of practice to start              |

#### Behaviour

1. Validate `language` (must be in the supported list) and `practiceType` (must be `"vocabulary"`).
2. Check whether the user already has an active session (`status = "active"`) — if yes, return `409 Conflict`.
3. Load all vocabulary words for the given language from the `vocabulary` collection.
4. Load all `word_stats` documents for the user + language from the `word_stats` collection.
5. Compute a **selection weight** for each vocabulary word:
   - If the word has existing stats: `weight = word_stats.failureRatio`
   - If the word has no stats (never practiced): `weight = defaultFailureRatio` (see Config)
6. Sample `sessionWordCount` words from the vocabulary using **weighted random sampling without replacement** (see [Word Selection Algorithm](#word-selection-algorithm)).
7. Create a session document with `status = "active"` and a `payload` containing the selected `words`, `totalWords = sessionWordCount`, and `answers = []`.
8. Return the session.

#### Response — `201 Created`

```json
{
  "sessionId": "664abc123def456789abcdef",
  "language": "danish",
  "practiceType": "vocabulary",
  "payload": {
    "words": [
      { "wordId": "664abc123def456789aaaaaa", "english": "dog", "translation": "hund" },
      { "wordId": "664abc123def456789bbbbbb", "english": "cat", "translation": "kat" }
    ],
    "totalWords": 10
  }
}
```

#### Error Cases

| Condition                                | Status | Description                                         |
|------------------------------------------|--------|-----------------------------------------------------|
| Unsupported `language`                   | `400`  | Language is not in the supported list               |
| Unknown or unsupported `practiceType`    | `400`  | Only `"vocabulary"` is currently supported          |
| User already has an active session       | `409`  | Caller should resume or complete the existing session |
| Fewer words in vocabulary than `sessionWordCount` | `400` | Not enough words to start a session — indicates the vocabulary needs to be populated first |

---

### GET `/sessions/active` — GetActiveSession

Returns the authenticated user's currently active session, if any.

#### Behaviour

Query the `sessions` collection for a document matching `{ userId, status: "active" }`. Return `404` if none found.

#### Response — `200 OK`

Same structure as the `StartSession` response.

```json
{
  "sessionId": "664abc123def456789abcdef",
  "language": "danish",
  "practiceType": "vocabulary",
  "payload": {
    "words": [
      { "wordId": "664abc123def456789aaaaaa", "english": "dog", "translation": "hund" }
    ],
    "totalWords": 10
  }
}
```

#### Error Cases

| Condition                  | Status | Description                        |
|----------------------------|--------|------------------------------------|
| No active session found    | `404`  | User has no active session         |

---

### POST `/sessions/:sessionId/answers` — SubmitAnswer

Records a single answer for a word within the session. Called by the frontend each time the user submits a translation attempt (correct or incorrect). Multiple answers for the same word are allowed (the word may be retried after an incorrect answer).

#### Path Parameters

| Parameter   | Description                          |
|-------------|--------------------------------------|
| `sessionId` | MongoDB ObjectId of the session      |

#### Request Body

```json
{
  "entityId": "664abc123def456789aaaaaa",
  "isCorrect": false
}
```

| Field       | Required | Description                                                                    |
|-------------|----------|--------------------------------------------------------------------------------|
| `entityId`  | Yes      | The ID of the item being answered. For vocabulary sessions, this is a `wordId` |
| `isCorrect` | Yes      | Whether the answer was correct                                                 |

#### Behaviour

1. Load the session by `sessionId`.
2. Validate: session must exist, belong to the authenticated user, and be `"active"`.
3. Validate: `entityId` must match the `wordId` of an entry in `session.payload.words`.
4. Append `{ entityId, isCorrect, submittedAt: now() }` to `session.payload.answers`.

#### Response — `200 OK`

```json
{ "recorded": true }
```

#### Error Cases

| Condition                              | Status | Description                                    |
|----------------------------------------|--------|------------------------------------------------|
| Session not found                      | `404`  | No session with this ID                        |
| Session does not belong to the user    | `403`  | Authenticated user is not the session owner    |
| Session already completed              | `400`  | Cannot submit answers to a completed session   |
| `entityId` not in session              | `400`  | The entity is not part of this session's item list |

---

### POST `/sessions/:sessionId/completion` — CompleteSession

Marks the session as completed and updates word statistics for all words in the session.

#### Path Parameters

| Parameter   | Description                          |
|-------------|--------------------------------------|
| `sessionId` | MongoDB ObjectId of the session      |

#### Request Body

*(empty)*

#### Behaviour

1. Load the session by `sessionId`.
2. Validate: session must exist, belong to the authenticated user, and be `"active"`.
3. For each word in `session.payload.words`, compute from `session.payload.answers`:
   - `sessionAttempts` = number of answer entries where `entityId === word.wordId`
   - `sessionFailures` = number of incorrect answers where `entityId === word.wordId`
   - `firstAttemptCorrect` = `true` if the first answer entry for this `wordId` is correct (i.e. `sessionFailures === 0`)
4. Upsert a `word_stats` document for each `(userId, wordId)` pair:
   - `totalAttempts += sessionAttempts`
   - `totalFailures += sessionFailures`
   - `failureRatio = newTotalFailures / newTotalAttempts`
   - `lastPracticed = now()`
   - `updatedAt = now()`
5. Mark the session: `status = "completed"`, `completedAt = now()`.
6. Return the session summary.

#### Response — `200 OK`

```json
{
  "totalWords": 10,
  "firstAttemptCorrect": 7,
  "accuracy": 70,
  "wordResults": [
    {
      "wordId": "664abc123def456789aaaaaa",
      "english": "dog",
      "translation": "hund",
      "failedAttempts": 0
    },
    {
      "wordId": "664abc123def456789bbbbbb",
      "english": "cat",
      "translation": "kat",
      "failedAttempts": 2
    }
  ]
}
```

| Field                  | Description                                                     |
|------------------------|-----------------------------------------------------------------|
| `totalWords`           | Total number of words in the session                            |
| `firstAttemptCorrect`  | Number of words answered correctly on the very first attempt    |
| `accuracy`             | `round(firstAttemptCorrect / totalWords * 100)` (integer %)    |
| `wordResults`          | Per-word result, including total failed attempts in this session |

#### Error Cases

| Condition                              | Status | Description                                    |
|----------------------------------------|--------|------------------------------------------------|
| Session not found                      | `404`  | No session with this ID                        |
| Session does not belong to the user    | `403`  | Authenticated user is not the session owner    |
| Session already completed              | `400`  | Session has already been completed             |

---

## Word Selection Algorithm

The goal is to select `sessionWordCount` words from the vocabulary such that words the user struggles with most (high failure ratio) are selected with higher probability.

### Steps

1. Build a weight list: for each vocabulary word, assign `weight = failureRatio` if stats exist, else `weight = defaultFailureRatio`.
2. Apply **weighted random sampling without replacement**: each word's probability of being selected at each draw is proportional to its weight relative to the remaining candidates.
3. A practical implementation is the **exponential-key method** (Efraimidis-Spirakis): assign each word a key `k = -log(U) / weight` where `U` is drawn from `Uniform(0, 1)`, then select the `sessionWordCount` words with the lowest `k` values. This is efficient and avoids iterative re-normalisation.

### Edge Cases

| Condition | Handling |
|-----------|----------|
| All words have `failureRatio = 0` | All weights equal `0`. Fall back to uniform random sampling (equal probability for all words). |
| A word has `totalAttempts > 0` and `failureRatio = 0` (always answered correctly) | Weight = `0`. Such words are effectively excluded from weighted selection; they may still appear via the fallback uniform round if needed to fill the session. |
| Fewer vocabulary words than `sessionWordCount` | Return `400` — session cannot be started. |

---

## Configuration

The following values are configurable via environment variables or service configuration (see `Config.ts`).

| Config Key             | Default | Description                                                            |
|------------------------|---------|------------------------------------------------------------------------|
| `sessionWordCount`     | `10`    | Number of words per session                                            |
| `defaultFailureRatio`  | `0.5`   | Weight assigned to words with no prior practice history                |

---

## Business Rules

1. **One active session per user**: A user may not start a new session while one is active. The frontend must call `CompleteSession` (or the user must abandon and the session eventually cleaned up) before starting a new one.
2. **Answer accumulation, not replacement**: Multiple answers for the same `wordId` within a session are all stored. The full history is needed to accurately compute `firstAttemptCorrect` and `failedAttempts`.
3. **Stats updated only at session completion**: `word_stats` is not updated incrementally during a session. Stats are updated atomically (as a batch) when `CompleteSession` is called. This simplifies rollback scenarios and avoids partial updates.
4. **`failureRatio` pre-computed**: `failureRatio` is stored as a pre-computed field on each `word_stats` document and updated at `CompleteSession` time. This avoids computing it at query time when loading words for a new session.
5. **Entity ownership check in SubmitAnswer**: The backend validates that the submitted `entityId` belongs to the session's item list (i.e. it is a `wordId` present in `session.payload.words`). This prevents stale frontend state from writing incorrect answer records.

---

## Extending to New Practice Types

When adding a new `practiceType`, define a dedicated `payload` shape and document it in a separate spec. The generic session header fields (`userId`, `language`, `practiceType`, `status`, `createdAt`, `completedAt`) remain unchanged across all practice types.

For example, a future `"grammar"` session might define its payload as:

```json
{
  "sentences": [ { "sentenceId": "...", "prompt": "...", "answer": "..." } ],
  "totalSentences": 5,
  "answers": [ { "entityId": "...", "isCorrect": true, "submittedAt": "..." } ]
}
```

The `StartSession`, `GetActiveSession`, `SubmitAnswer`, and `CompleteSession` endpoints are shared across all practice types. Where a new type requires different business logic (item selection, stats tracking, summary computation), that logic is encapsulated in type-specific handlers within each delegate — selected by a `switch` on `practiceType`.

---

## Out of Scope

- Session expiry / auto-cleanup of abandoned sessions (future work).
- Practitioner-defined session size (the size is fixed by server config).
- Leaderboards, global statistics, or cross-user comparisons.
- Practice types other than `"vocabulary"` (the architecture supports them, but they are not defined here).
- Re-opening a completed session.
