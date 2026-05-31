# F18 — Default Module Seeding

## 1. Purpose & Scope

This feature is the orchestration pipeline that turns a human-authored module shell into a fully realized, stored default module: it generates the vocabulary set (F15), grammar explanations (F16), and exercise bank (F17), then persists the Module (F03), VocabularyItems (F01), GrammarConcepts (F02), and ExerciseBank (F04). Default modules are seeded once during development and are identical for all users. If a shell is updated, its vocab set and exercise bank are regenerated.

**Out of scope**:
- The individual AI generation steps (→ [F15](./F15-ai-vocabulary-generation.md), [F16](./F16-ai-grammar-explanation-generation.md), [F17](./F17-ai-exercise-bank-generation.md))
- Level test banks (→ [F20](./F20-level-test-bank-seeding.md))
- User-generated/custom modules (→ [F24](./F24-custom-module-generation.md))
- Background bank top-up (→ [F19](./F19-exercise-bank-refresh.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Module shell | Human-authored theme, communication goal, grammar concepts, vocabulary focus, CEFR level (from default-modules.md) |
| Seeding | One-time, development-time pipeline that realizes shells into stored modules |
| Regeneration | Re-running seeding for a shell whose definition changed |

### 2.2. Requirements

### Requirement: Seeding pipeline
For one module shell, in order:
1. Generate the vocabulary set (F15); dedup/reuse against the catalog (F01) and store new items.
2. Ensure the module's grammar concepts exist in the catalog (F02); for any missing explanation, generate it (F16) and store.
3. Generate the exercise bank (F17) over the resolved vocab items + grammar concepts; verify coverage.
4. Persist the Module (F03) referencing the vocab item ids and grammar concept ids, and persist the ExerciseBank (F04).
- The realized module is identical for all users.

### Requirement: Batch seeding entrypoint
- A development-time entrypoint (script/command/admin endpoint) that runs the pipeline over the curriculum shells (the ~123 modules in default-modules.md), with the ability to seed a single module or a level at a time.

### Requirement: Idempotent regeneration
- Re-seeding a shell replaces its vocab set and exercise bank deterministically (handle orphaned old exercises/items per F01 OQ-02), without duplicating shared catalog entries.

### Requirement: AI-mockable
- The pipeline must run end-to-end in tests with the AI client mocked (so seeding logic is testable without real AI).

---

## 3. Key User Stories

| # | As a user (curriculum author), I want to… | So that… |
|---|------------------------------------------|----------|
| US-01 | Seed a default module from its shell with one command | the curriculum is reproducible |
| US-02 | Regenerate a module after editing its shell | content stays in sync with the curriculum spec |

---

## 4. Constraints and Assumptions

- **Constraint** — Runs once during development, not on demand per user.
- **Constraint** — Default modules + their banks are shared across all users.
- **Assumption** — Shells are authored in [default-modules.md](../../../tome/docs/specs/language-learning/default-modules.md); this feature consumes a structured form of them.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | How are the ~123 shells represented as structured input? | Parse default-modules.md, or maintain a structured seed file |
| OQ-02 | Is seeding a script, an admin-only endpoint, or both? | Script is simplest for dev-time; endpoint enables ops triggering |
| OQ-03 | Cost/time control when seeding the whole curriculum | Batch + resumable; the AI calls are many |
