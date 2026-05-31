# F03 — Module Catalog

## 1. Purpose & Scope

A Module is a self-contained learning unit with a theme, a communication goal, a CEFR level, a referenced vocabulary set, and referenced grammar concepts. This feature defines the canonical Module entity and the read access used by the app to browse and open modules. Modules reference vocabulary and grammar concepts **by id** rather than embedding them, so words/concepts can be reused across modules.

**Out of scope**:
- Per-user module status / progress (`locked`/`available`/…) (→ [F07](./F07-user-module-progress.md))
- The exercise bank attached to a module (→ [F04](./F04-exercise-bank.md))
- Module seeding / generation (→ [F18](./F18-default-module-seeding.md), [F24](./F24-custom-module-generation.md))
- The execution flow (steps 1–3) (→ [F09](./F09-grammar-introduction.md), [F10](./F10-practice-session.md), [F11](./F11-module-test.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Module | A themed learning unit: theme, communication goal, CEFR level, vocab set, grammar concepts |
| Default module | A curriculum module seeded during development, shared by all users |
| User-generated module | A module created on demand for one user (`isUserGenerated = true`) |
| Configurable parameters | Per-module tuning values for the execution flow (session size, unlock delay, etc.) |

### 2.2. Requirements

### Requirement: Module data model
- Fields: `id`, `title`, `theme`, `communicationGoal`, `cefrLevel`, `vocabularyItemIds` (string[]), `grammarConceptIds` (string[]), `createdAt`, `isUserGenerated` (boolean).
- Also store the execution-flow configurable parameters (idea §3.1.2) with their defaults so they can be tuned per module: `practiceSessionSize` (15), `testUnlockDelayHours` (4), `testRetryDelayMinutes` (20), `testFreshExercisePercent` (50), `testPassThreshold` (80).

### Requirement: Store modules
- Dedicated store, sole DB access for the modules collection.
- Support: insert, find by id, list by `cefrLevel`, list default modules by level (for the dashboard ordering), find user-generated modules by `addedByUserId` (the creator).

### Requirement: Read endpoints
- Get a module by id (resolves vocab/grammar references for the app, or returns ids for the app to resolve via F01/F02).
- List default modules for a CEFR level (ordering used to show module progression at a level).

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | See the modules available at my current CEFR level | I know my learning path |
| US-02 | Open a module and see its theme and communication goal | I understand what I'll be able to do after it |

---

## 4. Constraints and Assumptions

- **Constraint** — A default module's vocab/grammar/exercise bank are identical for all users; only progress differs.
- **Assumption** — The curriculum of default module *shells* (theme, goal, grammar focus, vocab focus) is human-authored and lives in [default-modules.md](../../../tome/docs/specs/language-learning/default-modules.md) (~123 modules). This feature stores the realized modules, not the authored shells.
- **Constraint** — Configurable parameters default to idea §3.1.2 values but must be overridable per module.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Should config parameters live on the Module or a separate global config with per-module overrides? | Either; per-module override capability is the requirement |
| OQ-02 | Do we store a module ordering/sequence within a level explicitly, or derive from a code (e.g. A1-01)? | Idea uses codes like A1-01; an explicit order field may be cleaner |
