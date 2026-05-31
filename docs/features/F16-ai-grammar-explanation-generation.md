# F16 — AI Grammar Explanation Generation

## 1. Purpose & Scope

For a grammar concept, the AI generates a short explanation plus 1–2 Danish examples (each with an English translation), pitched at the concept's CEFR level. This runs at seeding time and the result is stored on the GrammarConcept (F02); it is never regenerated during a live session (Step 1 reads the stored text via F09).

**Out of scope**:
- Storing the concept / explanation (→ [F02](./F02-grammar-concept-catalog.md))
- Presenting it to the user (→ [F09](./F09-grammar-introduction.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Grammar explanation | Short instructional text + 1–2 Danish examples for a concept |

### 2.2. Requirements

### Requirement: Generate-explanation operation
- Input: grammar concept name, category, and CEFR level introduced.
- Output: `explanation` (short text in English) + `examples` (1–2 `{ danish, english }` pairs).
- AI client (mockable); output validated into the GrammarConcept explanation/examples shape.
- CEFR-aware so phrasing and example complexity match the level.

### Requirement: Seeding-time only
- Invoked by F18 (and F24 for custom modules) at creation/seeding; the result is persisted on the concept and reused.

---

## 3. Key User Stories

| # | As a user (curriculum author), I want to… | So that… |
|---|------------------------------------------|----------|
| US-01 | Have grammar explanations generated once and stored | runtime stays AI-free and fast |

---

## 4. Constraints and Assumptions

- **Constraint** — Generated at seeding time, stored, never live.
- **Constraint** — CEFR-aware.
- **Assumption** — A concept's explanation is generated once; regeneration happens only if the concept/shell is updated.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Is one explanation per concept enough, or should it vary by the module/level using it? | Idea stores it on the canonical concept — one shared explanation |
