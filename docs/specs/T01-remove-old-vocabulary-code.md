# T01 — Remove Old Vocabulary Code

Remove all code related to the old `Word`-based vocabulary concept, clearing the way for the new `VocabularyItem` model defined in F01.

**Feature**: [F01 — Vocabulary Catalog](../features/F01-vocabulary-catalog.md)

**Why**: The old vocabulary layer (`Word` model, `VocabularyStore`, vocabulary practice sessions, word stats) represents a legacy concept that is incompatible with the new F01 data model. Keeping it alongside the new code would create confusion and dead code.

**What**:

- [ ] Delete `src/model/Word.ts`
- [ ] Delete `src/model/WordStats.ts`
- [ ] Delete `src/store/VocabularyStore.ts`
- [ ] Delete `src/store/WordStatsStore.ts`
- [ ] Delete `src/dlg/GetVocabulary.ts`
- [ ] Delete `src/dlg/GetVocabularyWithStats.ts`
- [ ] Delete `src/dlg/GetWord.ts`
- [ ] Delete `src/dlg/PostWord.ts`
- [ ] Delete `src/dlg/PostWords.ts`
- [ ] Delete `src/dlg/PutWord.ts`
- [ ] Delete `src/dlg/DeleteWord.ts`
- [ ] Delete `src/dlg/AddWordAlternative.ts`
- [ ] Delete `src/dlg/RemoveWordAlternative.ts`
- [ ] Delete `src/dlg/SampleWords.ts`
- [ ] In `src/dlg/session/StartSession.ts`: remove the `vocabulary` practice-type branch and all imports of `VocabularyStore`, `WordStatsStore`, and `Word`-related types
- [ ] In `src/dlg/session/CompleteSession.ts`: remove the `vocabulary` practice-type branch and all imports of `WordStatsStore`
- [ ] In `src/model/Session.ts`: remove `VocabularySessionPayload` and `SessionWord` interfaces (no longer needed)
- [ ] In `src/index.ts`: remove all old vocabulary-related endpoint registrations:
  - `GET /vocabulary/:language`
  - `GET /vocabulary/:language/with-stats`
  - `POST /vocabulary/:language/words`
  - `POST /vocabulary/:language/words/batch`
  - `GET /vocabulary/:language/words/sample`
  - `GET /vocabulary/:language/words/:wordId`
  - `PUT /vocabulary/:language/words/:id`
  - `DELETE /vocabulary/:language/words/:id`
  - `POST /vocabulary/:language/words/:wordId/alternatives`
  - `DELETE /vocabulary/:language/words/:wordId/alternatives/:id`
- [ ] In `test/AlternativeTranslations.endpoints.test.ts`: remove the `AddWordAlternative`, `RemoveWordAlternative`, and `GetWord` describe blocks (keep sentence alternative tests)
- [ ] In `test/GetVocabularyWithStats.parseRequest.test.ts`: delete the file entirely
- [ ] Ensure the project compiles cleanly with `npm run build`

## Implementation details

### Architectural decisions
- The `vocabulary` MongoDB collection is retained; only the application layer is removed. The new `VocabularyItemStore` (T03) will reuse this collection with a different schema.
- `SentenceSessionPayload` and session infrastructure for the `sentences` practice type are untouched.

### Technical Decisions and Design
- `StartSession` and `CompleteSession` become sentences-only after removing the vocabulary branch. The `practiceType` validation in `StartSession.parseRequest` should reject `"vocabulary"` with a 400 (or simply only accept `"sentences"`).
- `SubmitAnswer` references `VocabularySessionPayload` by name — after removing it from `Session.ts`, update `SubmitAnswer` to only handle the `sentences` branch.

## Acceptance Criteria
- [ ] All files listed above are deleted or modified
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] `npm test` passes (remaining tests: SortUtils, sentence alternatives, GetSentencesWithStats)

## Out of Scope
- Creating any new files (that is T02–T09)
- Modifying the `vocabulary` MongoDB collection schema
