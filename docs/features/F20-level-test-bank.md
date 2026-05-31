# F20 — Level Test Bank

## 1. Purpose & Scope

Each CEFR level has a dedicated exercise bank (~60 exercises) purpose-built for cross-module breadth — a single exercise may combine vocabulary from different modules or test a grammar concept across themes. This bank is submitted by an **external tool** at seeding time and stored as a LevelTestBank. It is the pool the Level Test (F21) draws from.

**Out of scope**:
- Taking the Level Test / scoring (→ [F21](./F21-level-test.md))
- Module exercise banks (→ [F04](./F04-exercise-bank.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| LevelTestBank | One bank per CEFR level, ~60 cross-module exercises |
| Cross-module breadth | Exercises spanning vocab/grammar from multiple modules at the level |

### 2.2. Requirements

### Requirement: LevelTestBank data model

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | ObjectId | Unique identifier | Auto-generated |
| cefrLevel | string | Level this bank covers | Must be one of: A1, A2, B1, B2, C1, C2; one bank per level |
| exerciseIds | string[] | Ids of exercises in this bank | All referenced exercises must have moduleId = null |
| generatedAt | Date | When the bank was last updated | Required |
| totalGenerated | number | Cumulative count of exercises ever added | Incremented on each append |

### Requirement: Store the bank
- Dedicated store, sole DB access; support find by cefrLevel, insert, append exercise ids + update counts.

### Requirement: Write endpoints

- `POST /levelTestBanks` — create a level test bank (body includes cefrLevel + array of exercise objects with `moduleId = null`).
- `POST /levelTestBanks/:cefrLevel/exercises` — append additional exercises to an existing bank.

### Requirement: Read endpoints

- `GET /levelTestBanks/:cefrLevel` — get the level test bank for a given level (returns bank metadata + exerciseIds).

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Be tested across everything at my level, not one module at a time | the Level Test really proves I'm ready to advance |

---

## 4. Constraints and Assumptions

- **Constraint** — Level test exercises are submitted by an external tool; this microservice stores and serves them.
- **Constraint** — Not assembled from module banks; purpose-built for cross-module breadth.
- **Assumption** — ~60 exercises per level bank.
- **Constraint** — Level test exercises carry `moduleId = null` (per data model).

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Higher levels (C1/C2) have few pre-built modules at launch — how is their level bank scoped? | Idea §8: user-generated modules fill gaps; level bank may be sparse initially |
| OQ-02 | Does the level bank need a top-up mechanism if depleted? | Free Level Test retries may cycle through ~60 exercises; add append endpoint (already included) |
