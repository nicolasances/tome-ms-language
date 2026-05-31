# F01 — Vocabulary Catalog

## 1. Purpose & Scope

The Vocabulary Catalog is the canonical store of learnable vocabulary units (words, verbs, phrases, patterns, connectors, etc.). A vocabulary item is defined **once** and shared across all users and modules; per-user mastery is tracked separately (see [F06](./F06-mastery-and-progress-tracking.md)). This feature provides the write and read access for these canonical items. It is the foundation that modules, exercises, and content analysis all reference.

Vocabulary items are created by an **external tool** (a seeding script or a content-analysis tool) and submitted to this microservice via POST endpoints. This microservice stores them and makes them queryable.

**Out of scope**:
- Per-user mastery, history, lastReviewed (→ [F06](./F06-mastery-and-progress-tracking.md))
- User-added words (→ [F22](./F22-user-added-vocabulary.md)) — though they live in the same collection with `source = user_added`
- Any exercise logic

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Vocabulary Item | A single learnable unit: word, verb, phrase, pattern, connector, etc. |
| Type taxonomy | Fixed v2.0 set: noun, verb, adjective, adverb, phrase, pattern, connector, pronoun, number |
| Context note | Optional disambiguation string (e.g. "physical size" for *stor*) used to scope exercises and alternative answers |
| Source | How the item entered the system: `curriculum` or `user_added` |

### 2.2. Requirements

### Requirement: VocabularyItem data model

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | ObjectId | Unique identifier | Auto-generated |
| danish | string | Danish word or phrase | Required |
| english | string | English translation | Required |
| type | string | Word type | Must be one of: noun, verb, adjective, adverb, phrase, pattern, connector, pronoun, number |
| context | string | Disambiguation note | Nullable |
| tags | string[] | Thematic tags | Optional, may be empty |
| cefrLevel | string | CEFR level of the item | Must be one of: A1, A2, B1, B2, C1, C2 |
| source | string | How the item entered the system | Must be: `curriculum` or `user_added` |
| addedByUserId | string | Id of the user who added it | Required when source = user_added; null otherwise |

### Requirement: Store the catalog
- A dedicated store is the only place that reads/writes the vocabulary collection.
- Support: insert one, insert many (batch), find by id, find by ids (bulk lookup used by modules/exercises), find by `danish` text (dedup check), list by `cefrLevel`.
- Inserting an item that duplicates an existing `(danish, type, context)` triple is rejected — dedup on canonical key to prevent seeding duplicates.

### Requirement: Write endpoints

- `POST /vocabularyItems` — insert a single vocabulary item; rejects duplicates on `(danish, type, context)`.
- `POST /vocabularyItems/batch` — insert many vocabulary items in one call; skips duplicates and reports which were inserted vs. already present.

### Requirement: Read endpoints

- `GET /vocabularyItems/:id` — get a single vocabulary item by id.
- `GET /vocabularyItems` — list vocabulary items; optional query param `?cefrLevel=A1`.
- `POST /vocabularyItems/lookup` — resolve a set of ids in bulk; body: `{ ids: string[] }`.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Have each Danish word stored once with its translation and metadata | the app can show consistent definitions everywhere |
| US-02 | Reuse the same word across multiple modules | my mastery of it is tracked globally, not per module |

---

## 4. Constraints and Assumptions

- **Constraint** — Vocabulary items are inserted by an external seeding tool; this microservice stores and serves them but does not generate them.
- **Constraint** — The type taxonomy is fixed for v2.0 but the field should accept new values without a schema migration (extensibility).
- **Constraint** — Language fields are named generically enough (`danish`/`english`) but the data model should not block a future multi-language expansion.
- **Assumption** — Full admin CRUD (update/delete) is not required for v2.0; only insert and read are in scope.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Canonical dedup key — is `(danish, type, context)` sufficient? | Two senses of *stor* differ only by `context`; ensure that is enough |
| OQ-02 | Do we need soft-delete / versioning when seeded content changes? | Decide whether old items are orphaned or updated in place |
