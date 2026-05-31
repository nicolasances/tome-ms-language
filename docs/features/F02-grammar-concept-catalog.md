# F02 — Grammar Concept Catalog

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

### Requirement: GrammarConcept data model

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | ObjectId | Unique identifier | Auto-generated |
| name | string | Canonical name of the concept | Required; used as matching key in content analysis |
| category | string | Concept grouping | Must be one of: tenses, sentence_structure, verbs, nouns, pronouns, adjectives, connectors, advanced |
| cefrLevelIntroduced | string | Earliest level the concept appears | Must be one of: A1, A2, B1, B2, C1, C2 |
| explanation | string | Instructional text for Step 1 | Required |
| examples | object[] | Illustrative examples | Array of `{ danish: string, english: string }`; min 1, max 2 |

### Requirement: Store the catalog
- Dedicated store is the only place that reads/writes the grammar concept collection.
- Support: insert one, insert many (batch), find by id, find by ids (bulk lookup for modules), list by category, list by `cefrLevelIntroduced`.

### Requirement: Write endpoints

- `POST /grammarConcepts` — insert a single grammar concept.
- `POST /grammarConcepts/batch` — insert many grammar concepts; skips duplicates by `name`.

### Requirement: Read endpoints

- `GET /grammarConcepts/:id` — get a single grammar concept by id (returns explanation + examples).
- `GET /grammarConcepts` — list concepts; optional query params `?cefrLevel=A1` (at-or-below filter) and `?category=tenses`.
- `POST /grammarConcepts/lookup` — resolve a set of ids in bulk; body: `{ ids: string[] }`.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | See a clear explanation and examples for each grammar concept in a module | I learn the rule, not just memorize answers |

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
