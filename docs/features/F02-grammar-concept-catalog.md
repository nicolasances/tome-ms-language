# F02 — Grammar Concept Catalog

![Status](https://img.shields.io/badge/status-implemented-brightgreen?style=flat-square)

## 1. Purpose & Scope

The Grammar Concept Catalog is the canonical store of named grammatical topics (e.g. "Inversion", "Modal Verbs", "Double definiteness"). Each concept carries the CEFR level at which it is introduced, a short explanation, and 1–2 Danish examples. Concepts are shared across modules and users and are referenced by modules and exercises.

Grammar concepts (including their explanation text and examples) are authored and submitted by an **external tool**. This feature provides the write and read access for these canonical concepts.

**Out of scope**:
- Per-user mastery of a concept (→ [F06](./F06-mastery-and-progress-tracking.md))
- Presenting the concept during a module run (→ [F09](./F09-grammar-introduction.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Grammar Concept | A named grammatical topic appearing inside modules |
| Category | Grouping of concepts: tenses, sentence_structure, verbs, nouns, pronouns, adjectives, connectors, advanced |
| CEFR level introduced | The earliest level at which the concept appears (per idea §3.3) |
| Explanation | Short instructional text shown in Step 1 of a module; authored externally, stored here, never regenerated live |
| Danish example | A `{ danish, english }` pair illustrating the concept |

### 2.2. Requirements

#### 2.2.1. Data Models

**GrammarConcept**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | string | Caller-provided unique identifier (e.g. `"A1-01-g-present-tense-nutid-6604"`) | Required; provided by the caller; must be unique across all grammar concepts; distinct from MongoDB's internal `_id` |
| name | string | Canonical name of the concept | Required; used as matching key in content analysis |
| category | string | Concept grouping | Must be one of: tenses, sentence_structure, verbs, nouns, pronouns, adjectives, connectors, advanced |
| cefrLevelIntroduced | string | Earliest level the concept appears | Must be one of: A1, A2, B1, B2, C1, C2 |
| explanation | string | Instructional text for Step 1 | Required |
| examples | object[] | Illustrative examples | Array of `{ danish: string, english: string }`; min 1, max 2 |

#### 2.2.2. Endpoints

- `POST /grammarConcepts` — insert a single grammar concept.
- `POST /grammarConcepts/batch` — insert many grammar concepts; skips duplicates by `id`.
- `GET /grammarConcepts/:id` — get a single grammar concept by id (returns explanation + examples).
- `GET /grammarConcepts` — list concepts; optional query params `?cefrLevel=A1` (exact-match filter) and `?category=tenses`.
- `POST /grammarConcepts/lookup` — resolve a set of ids in bulk; body: `{ ids: string[] }`.

#### 2.2.4. Business Logic

- A dedicated store is the only place that reads/writes the grammar concept collection. Supports: insert one, insert many (batch), find by id, find by ids (bulk lookup for modules), list by category, list by `cefrLevelIntroduced`.
- Inserting a concept that duplicates an existing `id` is rejected (single insert). Batch insert skips concepts whose `id` already exists; name uniqueness is not enforced at the batch level.
- The `?cefrLevel=A1` filter on `GET /grammarConcepts` is an exact match on `cefrLevelIntroduced`. It returns only concepts introduced at that specific level, not at lower levels.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Submit grammar concepts individually or in batch | the catalog can be seeded incrementally and idempotently |
| CS-02 | Bulk-resolve a set of grammar concept ids | modules and exercises can hydrate their referenced concepts in one round-trip |
| CS-03 | List concepts filtered by CEFR level and/or category | the seeding tool and exercise generator can scope content to a level |

---

## 4. Constraints and Assumptions

- **Constraint** — Grammar concepts are inserted by an external tool; this microservice stores and serves them.
- **Constraint** — A grammar concept's CEFR level gates which modules and levels can reference it; the taxonomy of "available from" levels in idea §3.3 must be honored.
- **Assumption** — Explanations are authored/generated externally before being submitted; never generated live by this microservice.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Are concept names stable identifiers usable for matching in content analysis? | Content analysis maps detected patterns to `conceptName`; need a canonical name list |

---

## 6. Technical Decisions

### Storage
- MongoDB collection: `grammar`.
- The caller-provided `id` is stored as a plain document field, not as `_id` (same pattern as VocabularyItem).
- Store performs explicit duplicate check on `id` before insert rather than relying on unique-index conflicts, to return typed statuses.

### Shared constants
- `CEFR_LEVELS` lives in `src/model/CefrLevels.ts` and is imported by both `VocabularyItem.ts` and `GrammarConcept.ts`. Do not duplicate it.

### Endpoint design
- `examples` min/max validation (1–2 items, each requiring `danish` and `english`) is enforced in the endpoint delegate's `parseRequest`, not in the model constructor.
- Batch dedup is by `id` only. Name uniqueness is not enforced at the batch level; the caller is responsible for submitting distinct names.
- `GET /grammarConcepts` returns results sorted alphabetically by `name`. Both `cefrLevel` and `category` filters are optional and can be combined.
- `POST /grammarConcepts/lookup`: missing ids are silently absent from the response (no 404 for unknown ids).
- Express route ordering: `/grammarConcepts/batch` and `/grammarConcepts/lookup` must be registered before `/grammarConcepts/:id`.
