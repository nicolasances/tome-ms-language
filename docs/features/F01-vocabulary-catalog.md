# F01 — Vocabulary Catalog

## 1. Purpose & Scope

The Vocabulary Catalog is the canonical store of learnable vocabulary units (words, verbs, phrases, patterns, connectors, etc.). A vocabulary item is defined **once** and shared across all users and modules; per-user mastery is tracked separately (see [F06](./F06-mastery-and-progress-tracking.md)). This feature provides the storage and read access for these canonical items. It is the foundation that modules, exercises, and content analysis all reference.

**Out of scope**:
- Per-user mastery, history, lastReviewed (→ [F06](./F06-mastery-and-progress-tracking.md))
- User-added words (→ [F22](./F22-user-added-vocabulary.md)) — though they live in the same collection with `source = user_added`
- AI generation of vocabulary sets (→ [F15](./F15-ai-vocabulary-generation.md))
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
- Fields: `id`, `danish`, `english`, `type`, `context` (nullable), `tags` (string[]), `cefrLevel`, `source` (`curriculum` | `user_added`), `addedByUserId` (nullable).
- `type` must be one of the fixed taxonomy values.
- Canonical & shared: the same Danish word is stored once and referenced by many modules.

### Requirement: Store the catalog
- A dedicated store is the only place that reads/writes the vocabulary collection.
- Support: insert one, insert many (batch — used by seeding), find by id, find by ids (bulk lookup used by modules/exercises), find by `danish` text (used by content analysis & dedup), list by `cefrLevel`.
- Inserting an item that duplicates an existing `(danish, type, context)` triple should be avoided — dedup on canonical key so generation/seeding does not create duplicates.

### Requirement: Read endpoints
- Get a single vocabulary item by id.
- Get multiple vocabulary items by a list of ids (so the app can resolve a module's `vocabularyItemIds`).
- (Optional, low priority) list/browse vocabulary by CEFR level.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Have each Danish word stored once with its translation and metadata | the app can show consistent definitions everywhere |
| US-02 | Reuse the same word across multiple modules | my mastery of it is tracked globally, not per module |

---

## 4. Constraints and Assumptions

- **Constraint** — The type taxonomy is fixed for v2.0 but the field should accept new values without a schema migration (extensibility).
- **Assumption** — Items are mostly created by seeding/generation, not by a human CRUD UI; full admin CRUD is not required for v2.0 (only the user-added path in F22 writes at runtime).
- **Constraint** — Language fields are named generically enough (`danish`/`english`) but the data model should not block a future multi-language expansion.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Canonical dedup key — is `(danish, type, context)` sufficient? | Two senses of *stor* differ only by `context`; ensure that is enough |
| OQ-02 | Do we need soft-delete / versioning when a seeded module is regenerated? | Idea says regeneration replaces vocab; decide whether old items are orphaned or removed |
