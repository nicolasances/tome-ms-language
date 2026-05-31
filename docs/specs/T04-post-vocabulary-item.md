# T04 — POST /vocabularyItems Endpoint

Implement the delegate that handles inserting a single vocabulary item into the catalog.

**Feature**: [F01 — Vocabulary Catalog](../features/F01-vocabulary-catalog.md)

**Why**: Consumer Story CS-01 — seeding tools need to submit vocabulary items one at a time as they are authored.

**What**:

- [ ] Create `src/dlg/PostVocabularyItem.ts` (a `TotoDelegate` subclass)
- [ ] `parseRequest` validates:
  - `id` — required, non-empty string
  - `danish` — required, non-empty string
  - `english` — required, non-empty string
  - `type` — required, must be one of `VOCABULARY_ITEM_TYPES`
  - `cefrLevel` — required, must be one of `CEFR_LEVELS`
  - `source` — required, must be one of `VOCABULARY_ITEM_SOURCES`
  - `addedByUserId` — required when `source === "user_added"`, must be null/absent when `source === "curriculum"`
  - `context` — optional, defaults to `null`
  - `tags` — optional, defaults to `[]`
- [ ] `do` calls `VocabularyItemStore.insertOne()`
  - If result is `"created"` → return `201` with `{ id }`
  - If result is `"duplicate_id"` → throw `ValidationError(409, "id already exists")`
  - If result is `"duplicate_canonical"` → throw `ValidationError(409, "duplicate (danish, type, context)")`
- [ ] Write unit tests in `test/PostVocabularyItem.parseRequest.test.ts` covering:
  - Happy-path parses all fields correctly
  - Missing `id` → 400
  - Missing `danish` → 400
  - Missing `english` → 400
  - Invalid `type` → 400
  - Invalid `cefrLevel` → 400
  - Invalid `source` → 400
  - `source = "user_added"` with no `addedByUserId` → 400
  - `source = "curriculum"` with `addedByUserId` provided → 400 (or silently nulled — document the chosen behaviour)

## Implementation details

### Architectural decisions
- This endpoint has no `:language` path parameter — language is encoded in the `danish`/`english` field names of the `VocabularyItem` model.

### Technical Decisions and Design
- Follow codebase pattern: `parseRequest` only validates and maps; `do` only calls the store.
- Spacing and style must follow `node-coding-standards.md`.

## Acceptance Criteria
- [ ] `src/dlg/PostVocabularyItem.ts` exists and compiles
- [ ] All validation rules are enforced in `parseRequest`
- [ ] `do` correctly maps store results to HTTP responses
- [ ] Unit tests cover all listed scenarios and pass

## Out of Scope
- Registering the endpoint in `index.ts` (that is T09)
