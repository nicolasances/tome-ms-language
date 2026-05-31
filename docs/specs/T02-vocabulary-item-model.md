# T02 — VocabularyItem Model

Create the `VocabularyItem` domain model class that represents a single learnable vocabulary unit in the new catalog.

**Feature**: [F01 — Vocabulary Catalog](../features/F01-vocabulary-catalog.md)

**Why**: A strongly-typed model class is the foundation for the store (T03) and all endpoint delegates (T04–T08). It enforces field constraints and owns the BSON serialization/deserialization logic.

**What**:

- [ ] Create `src/model/VocabularyItem.ts` with:
  - All fields: `id`, `danish`, `english`, `type`, `context`, `tags`, `cefrLevel`, `source`, `addedByUserId`
  - Exported `VOCABULARY_ITEM_TYPES` constant array: `["noun","verb","adjective","adverb","phrase","pattern","connector","pronoun","number"]`
  - Exported `CEFR_LEVELS` constant array: `["A1","A2","B1","B2","C1","C2"]`
  - Exported `VOCABULARY_ITEM_SOURCES` constant array: `["curriculum","user_added"]`
  - `static fromBSON(data: WithId<any>): VocabularyItem` — reads MongoDB `id` field (caller-provided), not `_id`
  - `toBSON(): any` — writes all fields; does NOT include MongoDB `_id` (the caller-provided `id` is stored as a plain field)

## Implementation details

### Architectural decisions
- The caller-provided `id` is stored as a regular MongoDB document field named `id`, not as `_id`. MongoDB's `_id` is left as the default auto-generated ObjectId and is never exposed externally.
- `context` and `addedByUserId` are nullable (`string | null`).
- `tags` defaults to `[]` when absent.

### Technical Decisions and Design
- Class constructor accepts a single typed input object (follows the codebase convention of `{ field, field, ... }: Interface`).
- `fromBSON` reads `data.id` for the caller-provided id and `data._id` is ignored (not mapped).
- `toBSON` emits all fields, including `context: null` and `addedByUserId: null` when null, so MongoDB stores them explicitly.

## Acceptance Criteria
- [ ] `src/model/VocabularyItem.ts` exists and compiles
- [ ] All nine fields are present with correct types
- [ ] `VOCABULARY_ITEM_TYPES`, `CEFR_LEVELS`, and `VOCABULARY_ITEM_SOURCES` are exported
- [ ] `toBSON()` and `fromBSON()` are implemented and round-trip correctly
- [ ] `npm run build` succeeds

## Out of Scope
- Database interactions (that is T03)
- Endpoint logic (that is T04–T08)
