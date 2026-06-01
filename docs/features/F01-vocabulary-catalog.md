# F01 — Vocabulary Catalog

![Status](https://img.shields.io/badge/status-implemented-brightgreen?style=flat-square)

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

#### 2.2.1. Data Models

**VocabularyItem**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | string | Caller-provided unique identifier (e.g. `"A1-01-v-jeg-5325"`) | Required; provided by the caller; must be unique across all vocabulary items; distinct from MongoDB's internal `_id` |
| danish | string | Danish word or phrase | Required |
| english | string | English translation | Required |
| type | string | Word type | Must be one of: noun, verb, adjective, adverb, phrase, pattern, connector, pronoun, number |
| context | string | Disambiguation note | Nullable |
| tags | string[] | Thematic tags | Optional, may be empty |
| cefrLevel | string | CEFR level of the item | Must be one of: A1, A2, B1, B2, C1, C2 |
| source | string | How the item entered the system | Must be: `curriculum` or `user_added` |
| addedByUserId | string | Id of the user who added it | Required when source = user_added; null otherwise |

#### 2.2.2. Endpoints

- `POST /vocabularyItems` — insert a single vocabulary item; rejects duplicates on `(danish, type, context)`.
- `POST /vocabularyItems/batch` — insert many vocabulary items in one call; skips duplicates and reports which were inserted vs. already present.
- `GET /vocabularyItems/:id` — get a single vocabulary item by id.
- `GET /vocabularyItems` — list vocabulary items; optional query param `?cefrLevel=A1`.
- `POST /vocabularyItems/lookup` — resolve a set of ids in bulk; body: `{ ids: string[] }`.

#### 2.2.4. Business Logic

- A dedicated store is the only place that reads/writes the vocabulary collection. Supports: insert one, insert many (batch), find by id, find by ids (bulk lookup used by modules/exercises), find by `danish` text (dedup check), list by `cefrLevel`.
- Inserting an item that duplicates an existing `id` is rejected (id uniqueness is the primary guard). Additionally, inserting an item that duplicates an existing `(danish, type, context)` triple is rejected — dedup on canonical key to prevent seeding duplicates.
- Batch insert skips duplicates silently and returns a summary of inserted vs. already-present items.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Submit a single vocabulary item via POST | the catalog grows incrementally as items are authored |
| CS-02 | Batch-submit a set of vocabulary items in one call | seeding a module's vocabulary is efficient and idempotent |
| CS-03 | Bulk-resolve a set of vocabulary item ids | modules and exercises can hydrate their referenced items in one round-trip |
| CS-04 | List vocabulary items filtered by CEFR level | the seeding tool can verify what is already present at a given level |

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

---

## 6. Technical Decisions

### Storage
- MongoDB collection: `vocabulary` (reused from the legacy Word-based store; schema is the new VocabularyItem schema).
- The caller-provided `id` is stored as a regular document field named `id`, not as `_id`. MongoDB's `_id` is the auto-generated ObjectId and is never exposed externally.
- `context` and `addedByUserId` are nullable; stored explicitly as `null` in MongoDB (not omitted) so queries on those fields behave predictably.
- `tags` defaults to `[]` when absent from the input.
- The store performs an explicit existence check before inserting (querying by `id`, then by `(danish, type, context)`) rather than relying on MongoDB unique-index conflicts, so it can return typed statuses (`created`, `duplicate_id`, `duplicate_canonical`) instead of raw errors.

### Endpoint design
- No `:language` path prefix — language is encoded in the field names (`danish`, `english`) of the VocabularyItem model itself.
- `POST /vocabularyItems/lookup` uses POST (not GET) to avoid query-string length limits when the id list is large. Missing ids are silently absent from the response; callers diff request vs response ids if needed.
- Express route ordering: `/vocabularyItems/batch` and `/vocabularyItems/lookup` must be registered **before** `/vocabularyItems/:id` so Express matches static segments before the wildcard.
- `GET /vocabularyItems` returns all items with no pagination; sorted alphabetically by `danish`.
- Batch insert (`POST /vocabularyItems/batch`): per-item validation errors do not abort the whole batch. Response shape: `{ inserted, alreadyPresent, validationErrors, items: [{ id, status, reason? }] }`. `alreadyPresent` is the sum of `duplicate_id` and `duplicate_canonical` statuses.
