# Spec: Alternative Translations — CRUD Endpoints

## Objective

Expose four HTTP endpoints to add and remove alternative translations for vocabulary words and sentences. These endpoints allow the frontend to persist user-accepted and AI-corrected alternatives to the shared pool stored in MongoDB.

Covers: `tome-ms-language#30`

## Core Logic

### Endpoints

| Method | Path | Delegate |
|--------|------|----------|
| `POST` | `/vocabulary/:language/words/:wordId/alternatives` | `AddWordAlternative` |
| `DELETE` | `/vocabulary/:language/words/:wordId/alternatives/:id` | `RemoveWordAlternative` |
| `POST` | `/sentences/:language/:sentenceId/alternatives` | `AddSentenceAlternative` |
| `DELETE` | `/sentences/:language/:sentenceId/alternatives/:id` | `RemoveSentenceAlternative` |

### Add Alternative (POST)

- Request body: `{ translation: string }`
- The translation is **lowercased** before storage
- Check if a matching `translation` already exists in the array:
  - If yes → return the existing `{ id, translation }` (idempotent, 200 OK)
  - If no → generate a UUID via `crypto.randomUUID()`, push `{ id, translation }` to the array using MongoDB `$push`
- Response: `{ id: string; translation: string }`
- Returns 404 if the word/sentence document is not found

### Remove Alternative (DELETE)

- URL param: `:id` — the UUID of the alternative to remove
- Uses MongoDB `$pull: { alternativeTranslations: { id: altId } }`
- Returns 200 with `{ id, removed: true }` on success
- Returns 404 if the word/sentence document is not found

### Store methods

Add to `VocabularyStore`:
- `addAlternative(wordId: string, translation: string): Promise<{ id: string; translation: string }>` — dedup by translation, push with UUID if new
- `removeAlternative(wordId: string, altId: string): Promise<boolean>` — returns false if document not found

Add to `SentenceStore`:
- Same two methods: `addAlternative(sentenceId, translation)`, `removeAlternative(sentenceId, altId)`

### Architectural Decisions

- **Dedup by translation string** (case-insensitive, normalised to lowercase). Two POST calls with the same translation yield exactly one stored entry and the same UUID in both responses.
- **UUID generated server-side** with `crypto.randomUUID()` — no external dependency.
- **MongoDB `$push`** (not `$addToSet`) because we perform the dedup check in application code first. This keeps the dedup behaviour and ID generation in a single readable place.
- **404 on missing document**: The delegate checks `matchedCount` from the MongoDB update result; if 0, throws `ValidationError(404, ...)`.

## Out of Scope

- Rate limiting or quota on the number of alternatives per word/sentence
- Single-item GET endpoints (covered in `tome-ms-language#31`)
- Any UI changes
