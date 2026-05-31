# F02 — Grammar Concept Catalog

## 1. Purpose & Scope

The Grammar Concept Catalog is the canonical store of named grammatical topics (e.g. "Inversion", "Modal Verbs", "Double definiteness"). Each concept carries the CEFR level at which it is introduced, a short explanation, and 1–2 Danish examples. Concepts are shared across modules and users and are referenced by modules and exercises. This feature provides storage and read access for grammar concepts.

**Out of scope**:
- Per-user mastery of a concept (→ [F06](./F06-mastery-and-progress-tracking.md))
- AI generation of the explanation text (→ [F16](./F16-ai-grammar-explanation-generation.md)) — this feature only stores and serves it
- Presenting the concept during a module run (→ [F09](./F09-grammar-introduction.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Grammar Concept | A named grammatical topic appearing inside modules |
| Category | Grouping of concepts: tenses, sentence_structure, verbs, nouns, pronouns, adjectives, connectors, advanced |
| CEFR level introduced | The earliest level at which the concept appears (per idea §3.3) |
| Explanation | Short instructional text shown in Step 1 of a module; authored or AI-generated, stored, never regenerated live |
| Danish example | A `{ danish, english }` pair illustrating the concept |

### 2.2. Requirements

### Requirement: GrammarConcept data model
- Fields: `id`, `name`, `category`, `cefrLevelIntroduced`, `explanation` (text), `examples` (array of `{ danish, english }`).
- Canonical & shared: a concept is stored once and referenced by modules via `grammarConceptIds`.

### Requirement: Store the catalog
- Dedicated store is the only place that reads/writes the grammar concept collection.
- Support: insert one / insert many (seeding), find by id, find by ids (bulk lookup for modules), list by category, list by `cefrLevelIntroduced` (used by content analysis and level scoping).

### Requirement: Read endpoints
- Get a single grammar concept by id (returns explanation + examples).
- Get multiple by ids (resolve a module's `grammarConceptIds`).
- List concepts available up to / at a given CEFR level (supports content analysis "ahead in curriculum" classification).

### Requirement: Seed the v2.0 taxonomy
- The fixed concept taxonomy from idea §3.3 (with each concept's "available from" level) is the source of truth for which concepts exist and at which level they unlock.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | See a clear explanation and examples for each grammar concept in a module | I learn the rule, not just memorize answers |

---

## 4. Constraints and Assumptions

- **Constraint** — A grammar concept's CEFR level gates which modules and levels can reference it; the taxonomy of "available from" levels in idea §3.3 must be honored.
- **Assumption** — Explanations are generated/authored at seeding time and stored; never generated during a live session.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Are concept names stable identifiers usable for matching in content analysis? | Content analysis maps detected patterns to `conceptName`; need a canonical name list |
