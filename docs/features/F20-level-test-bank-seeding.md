# F20 — Level Test Bank Seeding

## 1. Purpose & Scope

Each CEFR level has a dedicated exercise bank (~60 exercises) purpose-built for cross-module breadth — a single exercise may combine vocabulary from different modules or test a grammar concept across themes. This bank is generated at seeding time (not drawn from individual module banks) and stored as a LevelTestBank. It is the pool the Level Test (F21) draws from.

**Out of scope**:
- Taking the Level Test / scoring (→ [F21](./F21-level-test.md))
- Module exercise banks (→ [F04](./F04-exercise-bank.md), [F18](./F18-default-module-seeding.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| LevelTestBank | One bank per CEFR level, ~60 cross-module exercises |
| Cross-module breadth | Exercises spanning vocab/grammar from multiple modules at the level |

### 2.2. Requirements

### Requirement: LevelTestBank data model
- Fields: `id`, `cefrLevel`, `exercises` (Exercise[] with `moduleId = null`), `generatedAt`, `totalGenerated`.
- One bank per CEFR level.

### Requirement: Store the bank
- Dedicated store, sole DB access; support find by cefrLevel, insert, append + update counts.

### Requirement: Generate-level-bank operation
- Input: all vocabulary items and grammar concepts in scope for the level (across the level's default modules) + the CEFR level.
- Output: ~60 exercises (reusing F17's generation capability, generalized for cross-module scope) with `moduleId = null`, spanning multiple modules' vocab/grammar.
- Validated against F04 Exercise constraints; CEFR-aware.

### Requirement: Seeding entrypoint
- A development-time entrypoint to generate/regenerate a level's test bank, runnable per level, AI-mockable for tests.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Be tested across everything at my level, not one module at a time | the Level Test really proves I'm ready to advance |

---

## 4. Constraints and Assumptions

- **Constraint** — Generated upfront at seeding, never live.
- **Constraint** — Not assembled from module banks; purpose-built for breadth.
- **Assumption** — ~60 exercises per level bank.
- **Constraint** — Level test exercises carry `moduleId = null` (per data model).

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Higher levels (C1/C2) have few pre-built modules at launch — how is their level bank scoped? | Idea §8: user-generated modules fill gaps; level bank may be sparse initially |
| OQ-02 | Does the level bank need refresh (like F19) if depleted? | Idea allows free Level Test retries; consider whether ~60 is enough |
