# Vocabulary & Sentences with User Stats — Feature Spec

## Overview

This spec defines two **paginated endpoints** that expose vocabulary and sentences enriched with per-user practice statistics. These endpoints enable the Tome App to display words and sentences optionally sorted by user-specific difficulty without leaking database join concerns to the frontend.

**Problem solved**: Words and sentences are stored in shared collections (`vocabulary`, `sentences`), while practice statistics are stored in per-user collections (`word_stats`, `sentence_stats`). Without server-side joins, the frontend would have to fetch both collections and join them client-side — inefficient and coupling the UI to backend data concerns.

**Solution**: Use MongoDB `$lookup` aggregation to perform LEFT OUTER JOINs server-side, returning items enriched with their user-specific stats in a single response.

---

## Data Model

This feature does not introduce new collections. It uses existing collections:

### Source Collections (Shared)
- `vocabulary` — Word pairs shared across all users
- `sentences` — Sentence pairs shared across all users

### Stats Collections (Per-User)
- `word_stats` — Per-user practice statistics keyed by `(userId, wordId)`
- `sentence_stats` — Per-user practice statistics keyed by `(userId, sentenceId)`

### Enriched Response Objects

#### WordWithStats

| Field             | Type                | Description                                         |
|-------------------|---------------------|-----------------------------------------------------|
| `id`              | string              | MongoDB ObjectId of the word                        |
| `english`         | string              | English source word                                 |
| `translation`     | string              | Target language translation                         |
| `createdAt`       | string              | ISO 8601 timestamp                                  |
| `knowledgeSource` | string              | Data source identifier                              |
| `stats`           | object \| null      | User-specific practice stats (null if never practiced) |

#### Stats Object

| Field           | Type    | Description                              |
|-----------------|---------|------------------------------------------|
| `failureRatio`  | number  | Ratio of failures to total attempts (0-1)|
| `totalAttempts` | number  | Total number of practice attempts        |
| `totalFailures` | number  | Total number of failed attempts          |
| `lastPracticed` | string  | ISO 8601 timestamp of last practice      |

#### SentenceWithStats

Same structure as `WordWithStats`, but with `sentence` instead of `english`.

---

## API Endpoints

All paths are relative to the service base path `/tomelang`.

| Operation                | Method | Path                                  | Delegate                 |
|--------------------------|--------|---------------------------------------|--------------------------|
| GetVocabularyWithStats   | `GET`  | `/vocabulary/{language}/with-stats`   | `GetVocabularyWithStats` |
| GetSentencesWithStats    | `GET`  | `/sentences/{language}/with-stats`    | `GetSentencesWithStats`  |

---

## Endpoint Specifications

### GET `/vocabulary/{language}/with-stats` — GetVocabularyWithStats

Returns vocabulary entries for the specified language, enriched with per-user practice statistics. Results are paginated and sorted by difficulty (hardest first).

#### Path Parameters

| Parameter  | Description                       |
|------------|-----------------------------------|
| `language` | Target language (e.g. `"danish"`) |

#### Query Parameters

| Parameter  | Required | Default | Description                                        |
|------------|----------|---------|----------------------------------------------------|
| `page`     | No       | 1       | Page number (1-indexed)                            |
| `pageSize` | No       | 100     | Number of items per page                           |
| `sortBy`   | No       | —       | Sort field. Only accepted value: `"difficulty"`    |
| `sortDir`  | No       | `"asc"` | Sort direction: `"asc"` or `"desc"`                |

#### Authentication

This endpoint **requires authentication**. The user's email from the authenticated context is used to filter stats.

#### Response — `200 OK`

```json
{
  "language": "danish",
  "page": 1,
  "pageSize": 100,
  "totalCount": 2150,
  "words": [
    {
      "id": "abc123",
      "english": "hello",
      "translation": "hej",
      "createdAt": "2024-01-15T10:00:00Z",
      "knowledgeSource": "tome-agent",
      "stats": {
        "failureRatio": 0.75,
        "totalAttempts": 8,
        "totalFailures": 6,
        "lastPracticed": "2024-03-10T14:30:00Z"
      }
    },
    {
      "id": "def456",
      "english": "goodbye",
      "translation": "farvel",
      "createdAt": "2024-01-15T10:00:00Z",
      "knowledgeSource": "tome-agent",
      "stats": null
    }
  ]
}
```

#### Sorting Logic

- **Default (no `sortBy`)**: Alphabetical by `translation` field ascending.
- **`sortBy=difficulty`**: Sort by `failureRatio`. Direction is controlled by `sortDir` (`"asc"` = lowest failure ratio first, `"desc"` = highest failure ratio first). Items without stats (`stats: null`) always appear **at the end**, regardless of `sortDir`.

#### Error Cases

| Condition                       | Status | Description                                        |
|---------------------------------|--------|----------------------------------------------------|
| Unknown / unsupported `language`| `400`  | Language is not in the supported list              |
| Invalid `page` parameter        | `400`  | Must be a positive integer                         |
| Invalid `pageSize` parameter    | `400`  | Must be a positive integer                         |
| Invalid `sortBy` value          | `400`  | Only `"difficulty"` is accepted                    |
| Invalid `sortDir` value         | `400`  | Only `"asc"` or `"desc"` are accepted              |
| Missing authentication          | `401`  | User context required                              |

---

### GET `/sentences/{language}/with-stats` — GetSentencesWithStats

Returns sentence entries for the specified language, enriched with per-user practice statistics. Results are paginated.

#### Path Parameters

| Parameter  | Description                       |
|------------|-----------------------------------|
| `language` | Target language (e.g. `"danish"`) |

#### Query Parameters

| Parameter  | Required | Default | Description                                        |
|------------|----------|---------|----------------------------------------------------|
| `page`     | No       | 1       | Page number (1-indexed)                            |
| `pageSize` | No       | 100     | Number of items per page                           |
| `sortBy`   | No       | —       | Sort field. Only accepted value: `"difficulty"`    |
| `sortDir`  | No       | `"asc"` | Sort direction: `"asc"` or `"desc"`                |

#### Authentication

This endpoint **requires authentication**. The user's email from the authenticated context is used to filter stats.

#### Response — `200 OK`

```json
{
  "language": "danish",
  "page": 1,
  "pageSize": 100,
  "totalCount": 500,
  "sentences": [
    {
      "id": "sent123",
      "sentence": "jeg elsker dig",
      "translation": "I love you",
      "createdAt": "2024-01-15T10:00:00Z",
      "knowledgeSource": "tome-agent",
      "stats": {
        "failureRatio": 0.50,
        "totalAttempts": 10,
        "totalFailures": 5,
        "lastPracticed": "2024-03-10T14:30:00Z"
      }
    },
    {
      "id": "sent456",
      "sentence": "god morgen",
      "translation": "good morning",
      "createdAt": "2024-01-15T10:00:00Z",
      "knowledgeSource": "tome-agent",
      "stats": null
    }
  ]
}
```

#### Sorting Logic

- **Default (no `sortBy`)**: Alphabetical by `sentence` field ascending.
- **`sortBy=difficulty`**: Sort by `failureRatio`. Direction controlled by `sortDir`. Items without stats always appear **at the end**.

#### Error Cases

Same as vocabulary endpoint.

---

## Core Logic

### MongoDB Aggregation Pipeline

Both endpoints use the same aggregation pattern:

1. **Match** — Filter by language
2. **AddFields** — Convert `_id` to string for joining (MongoDB stores IDs as ObjectId, stats store them as strings)
3. **Lookup** — LEFT OUTER JOIN with stats collection, filtering by userId
4. **AddFields** — Extract first (and only) stats document from array
5. **Sort** — Determined by `sortBy` / `sortDir` params:
   - **Default (no `sortBy`)**: Sort alphabetically by `translation` (words) or `sentence` (sentences)
   - **`sortBy=difficulty, sortDir=desc`**: Sort by `failureRatio` descending; items without stats get a sentinel value of `-1` so they sort last
   - **`sortBy=difficulty, sortDir=asc`**: Sort by `failureRatio` ascending; items without stats get a sentinel value of `Infinity` (`Number.MAX_VALUE` in BSON) so they sort last
6. **Skip/Limit** — Pagination
7. **Project** — Shape final response

### Sort Key Computation (difficulty mode)

To ensure items without stats always appear last regardless of sort direction:

- `sortDir=desc`: `sortKey = stats ? -failureRatio : 1` → sort ascending on key (negation inverts order; `1` > any valid `-failureRatio` in `[−1, 0]`)
- `sortDir=asc`: `sortKey = stats ? failureRatio : MAX_VALUE` → sort ascending on key (`MAX_VALUE` > any valid `failureRatio` in `[0, 1]`)

### Count Query

A separate `countDocuments` query runs in parallel to get total count for pagination metadata.

---

## Implementation

### Delegates

- `src/dlg/GetVocabularyWithStats.ts` — Handles vocabulary endpoint
- `src/dlg/GetSentencesWithStats.ts` — Handles sentences endpoint

Both delegates:
1. Parse and validate path/query parameters
2. Require user authentication (throw 401 if missing)
3. Call the corresponding store method
4. Return paginated response

### Store Methods

- `VocabularyStore.findByLanguageWithStats({ language, userId, page, pageSize, sortBy?, sortDir? })`
- `SentenceStore.findByLanguageWithStats({ language, userId, page, pageSize, sortBy?, sortDir? })`

Both methods:
1. Execute aggregation pipeline for LEFT OUTER JOIN
2. Execute count query for total
3. Return `{ words/sentences, totalCount }`

The `sortBy` and `sortDir` params are optional. When absent, the pipeline defaults to alphabetical order.

### Types

New exported interfaces in store files:
- `WordWithStats` — Response shape for vocabulary items
- `VocabularyWithStatsResult` — Store method return type
- `SentenceWithStats` — Response shape for sentence items  
- `SentencesWithStatsResult` — Store method return type

---

## Out of Scope

The following are explicitly **not** included in this implementation:

| Item                              | Reason                                              |
|-----------------------------------|-----------------------------------------------------|
| Sort fields other than difficulty | Start simple; add if users request                  |
| Cursor-based pagination           | Skip/limit sufficient for expected scale (2000 items) |
| Filtering by difficulty bucket    | YAGNI — start simple                                |
| Caching layer                     | Premature optimization                              |
| Materialized views                | Adds sync complexity; lookup is sufficient          |

---

## References

- Parent issue: [#24 - Sorting of Vocabulary and Sentences by Difficulty](https://github.com/nicolasances/tome-ms-language/issues/24)
- Task issue (words): [#25 - Add sort-by-difficulty to Words vocabulary with-stats endpoint](https://github.com/nicolasances/tome-ms-language/issues/25)
- Task issue (sentences): [#26 - Add sort-by-difficulty to Sentences with-stats endpoint](https://github.com/nicolasances/tome-ms-language/issues/26)
