# Vocabulary Management — Feature Spec

## Overview

This spec defines how `tome-ms-language` manages the **vocabulary** used in the Language Learning module. The vocabulary is a collection of word pairs: an English (source) word and its translation in a Target Language (TL). 

The Target Language is a first-class concept throughout this spec. The current supported TL is **Danish**. The design must make it straightforward to add more TLs in the future without structural changes.

The vocabulary is persisted in a MongoDB collection named **`vocabulary`**.

---

## Data Model

Each vocabulary entry represents a single word translation.

| Field             | Type     | Description                                                        |
|-------------------|----------|--------------------------------------------------------------------|
| `id`              | string   | MongoDB ObjectId, generated on insert                              |
| `language`        | string   | Target language code (e.g. `"danish"`)                             |
| `english`         | string   | The English source word                                            |
| `translation`     | string   | The TL translation of the English word                             |
| `createdAt`       | string   | ISO 8601 timestamp of when the entry was created                   |
| `knowledgeSource` | string   | The ID of the data source this vocabulary entry was imported or derived from. Used for tracking and auditing the origin of vocabulary data (e.g. a source dataset ID, an import job ID, or an external resource identifier). |

*Note*: there can be multiple translations of a given word. This is normal, considering that some languages can be more or less expressive. 

---

## API Endpoints

All paths are relative to the service base path `/tomelang`.

| Operation      | Method   | Path                                             | Delegate       |
|----------------|----------|--------------------------------------------------|----------------|
| GetVocabulary  | `GET`    | `/vocabulary/{language}`                         | `GetVocabulary`|
| PostWord       | `POST`   | `/vocabulary/{language}/words`                   | `PostWord`     |
| PostWords      | `POST`   | `/vocabulary/{language}/words/batch`             | `PostWords`    |
| PutWord        | `PUT`    | `/vocabulary/{language}/words/{id}`              | `PutWord`      |
| DeleteWord     | `DELETE` | `/vocabulary/{language}/words/{id}`              | `DeleteWord`   |

> **Note on PostWord vs PostWords:** A single-word insert and a batch insert are separated into two distinct endpoints and two distinct delegates. This keeps each delegate focused on a single responsibility and avoids type-checking on the request body.

---

## Endpoint Specifications

### GET `/vocabulary/{language}` — GetVocabulary

Returns all vocabulary entries for the specified target language.

#### Path Parameters

| Parameter  | Description                          |
|------------|--------------------------------------|
| `language` | Target language (e.g. `"danish"`)    |

#### Response — `200 OK`

```json
{
  "language": "danish",
  "words": [
    {
      "id": "664abc123def456789abcdef",
      "english": "dog",
      "translation": "hund",
      "createdAt": "2026-04-01T10:00:00.000Z",
      "knowledgeSource": "src-dataset-42"
    }
  ]
}
```

#### Error Cases

| Condition                  | Status | Description                         |
|----------------------------|--------|-------------------------------------|
| Unknown / unsupported `language` | `400` | Language is not in the supported list |

---

### POST `/vocabulary/{language}/words` — PostWord

Adds a single word translation to the vocabulary.

#### Path Parameters

| Parameter  | Description                          |
|------------|--------------------------------------|
| `language` | Target language (e.g. `"danish"`)    |

#### Request Body

```json
{
  "english": "dog",
  "translation": "hund",
  "knowledgeSource": "src-dataset-42"
}
```

| Field             | Required | Description                          |
|-------------------|----------|--------------------------------------|
| `english`         | Yes      | The English source word              |
| `translation`     | Yes      | The TL translation                   |
| `knowledgeSource` | Yes      | ID of the data source this entry originates from |

#### Response — `201 Created`

```json
{
  "id": "664abc123def456789abcdef"
}
```

#### Error Cases

| Condition                                           | Status | Description                            |
|-----------------------------------------------------|--------|----------------------------------------|
| Missing `english`, `translation`, or `knowledgeSource` | `400`  | Required fields not provided           |
| Unknown / unsupported `language`                    | `400`  | Language is not in the supported list  |

---

### POST `/vocabulary/{language}/words/batch` — PostWords

Inserts multiple word translations in one request.

#### Path Parameters

| Parameter  | Description                          |
|------------|--------------------------------------|
| `language` | Target language (e.g. `"danish"`)    |

#### Request Body

```json
{
  "words": [
    { "english": "dog", "translation": "hund", "knowledgeSource": "src-dataset-42" },
    { "english": "cat", "translation": "kat", "knowledgeSource": "src-dataset-42" }
  ]
}
```

| Field   | Required | Description                             |
|---------|----------|-----------------------------------------|
| `words` | Yes      | Array of word objects (min length: 1)   |

Each word object follows the same rules as `PostWord` (`english`, `translation`, and `knowledgeSource` all required).

#### Batch Behaviour

- The batch is processed with a **best-effort** strategy: valid words are inserted; invalid words are rejected individually.
- The operation does **not** abort entirely on a partial failure.

#### Response — `207 Multi-Status`

```json
{
  "results": [
    { "english": "dog", "status": "created", "id": "664abc123def456789abcdef" },
    { "english": "cat", "status": "error", "reason": "missing_field" }
  ]
}
```

| `status` value | Meaning                                        |
|----------------|------------------------------------------------|
| `"created"`    | Word was successfully inserted                 |
| `"error"`      | Word was rejected; `reason` field explains why |

Possible `reason` values: `"missing_field"`.

#### Error Cases

| Condition                        | Status | Description                            |
|----------------------------------|--------|----------------------------------------|
| `words` array is missing/empty   | `400`  | Request is malformed                   |
| Unknown / unsupported `language` | `400`  | Language is not in the supported list  |

---

### PUT `/vocabulary/{language}/words/{id}` — PutWord

Updates the translation (and optionally the english word) of an existing vocabulary entry, identified by its MongoDB `id`.

#### Path Parameters

| Parameter  | Description                                       |
|------------|---------------------------------------------------|
| `language` | Target language (e.g. `"danish"`)                 |
| `id`       | MongoDB ObjectId of the vocabulary entry to update |

#### Request Body

At least one field must be provided.

```json
{
  "translation": "hund (updated)",
  "knowledgeSource": "src-dataset-99"
}
```

| Field             | Required | Description                                  |
|-------------------|----------|----------------------------------------------|
| `english`         | No       | Updated English word                         |
| `translation`     | No       | Updated TL translation                       |
| `knowledgeSource` | No       | Updated data source ID for this entry        |

#### Response — `200 OK`

```json
{
  "id": "664abc123def456789abcdef",
  "updated": true
}
```

#### Error Cases

| Condition                              | Status | Description                                   |
|----------------------------------------|--------|-----------------------------------------------|
| No updatable fields in body            | `400`  | Request body provides nothing to update       |
| Entry with given `id` not found        | `404`  | No vocabulary entry matches the provided id   |

---

### DELETE `/vocabulary/{language}/words/{id}` — DeleteWord

Deletes a vocabulary entry by its MongoDB `id`.

#### Path Parameters

| Parameter  | Description                                       |
|------------|---------------------------------------------------|
| `language` | Target language (e.g. `"danish"`)                 |
| `id`       | MongoDB ObjectId of the vocabulary entry to delete |

#### Response — `200 OK`

```json
{
  "id": "664abc123def456789abcdef",
  "deleted": true
}
```

#### Error Cases

| Condition                       | Status | Description                                 |
|---------------------------------|--------|---------------------------------------------|
| Entry with given `id` not found | `404`  | No vocabulary entry matches the provided id |

---

## Business Rules

1. **Supported languages**: The set of supported target languages is defined in service configuration. Requests using an unsupported language are rejected with `400`. For now only `"danish"` is supported.
2. **Multiple translations per English word**: There is no uniqueness constraint on the `(language, english)` pair. The same English word may have multiple translations in the vocabulary for a given language.
3. **Field storage**: `language` is stored on each document so that the collection can be queried efficiently by language without relying on a separate collection per language.
4. **`createdAt`**: Set server-side at insert time. Not updatable via `PutWord`.

---

## Out of Scope

- Pagination of `GetVocabulary` results (all words are returned for the given language).
- Soft deletes (entries are hard-deleted).
- Word categories, difficulty levels, or tags.
- Usage/practice statistics on individual words (tracked separately if needed).
