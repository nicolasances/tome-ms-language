# Spec: Alternative Translations — Single-Item GET Endpoints

## Objective

Add dedicated GET endpoints to fetch a single vocabulary word or sentence by ID, returning the full document including its `alternativeTranslations` array. Required so the frontend detail pages can load their data when navigated to directly by URL.

Covers: `tome-ms-language#31`

## Core Logic

### Endpoints

| Method | Path | Delegate |
|--------|------|----------|
| `GET` | `/vocabulary/:language/words/:wordId` | `GetWord` |
| `GET` | `/sentences/:language/:sentenceId` | `GetSentence` |

### Response shape

**GetWord** — `200 OK`:
```json
{
  "id": "string",
  "language": "string",
  "english": "string",
  "translation": "string",
  "createdAt": "string",
  "knowledgeSource": "string",
  "alternativeTranslations": [{ "id": "string", "translation": "string" }]
}
```

**GetSentence** — `200 OK`:
```json
{
  "id": "string",
  "language": "string",
  "sentence": "string",
  "translation": "string",
  "createdAt": "string",
  "knowledgeSource": "string",
  "alternativeTranslations": [{ "id": "string", "translation": "string" }]
}
```

Both return `404` when the document is not found or the `id` is malformed.

### Store methods

Add to `VocabularyStore`:
- `findById(id: string): Promise<Word | null>` — uses `new ObjectId(id)` for lookup; returns `null` if not found or if `id` is an invalid ObjectId

Add to `SentenceStore`:
- `findById(id: string): Promise<Sentence | null>` — same pattern

### Delegate logic

Both delegates follow the same pattern:
1. Parse `wordId` / `sentenceId` from URL params
2. Call `store.findById(id)`
3. If `null` → throw `ValidationError(404, ...)`
4. Map model fields to response shape (use `Word.fromBSON` / `Sentence.fromBSON` indirectly via `findById`)

### Architectural Decisions

- **No stats in response** — stats are not needed for the detail pages at this stage; they can be added later if required.
- **`findById` returns `Word | null`** — keeps error handling in the delegate, not the store.
- **ObjectId wrapping** — `new ObjectId(id)` can throw for malformed IDs; wrap in try/catch in the store method and return `null` to surface a clean 404 to the caller.

## Out of Scope

- Stats (failureRatio, totalAttempts, etc.) in the response
- Paginated or filtered GET endpoints (those already exist via `with-stats` endpoints)
