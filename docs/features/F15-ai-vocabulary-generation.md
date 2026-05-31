# F15 — AI Vocabulary Set Generation

## 1. Purpose & Scope

Given a module shell (theme, communication goal, CEFR level, grammar/vocabulary focus), the AI produces the module's vocabulary set: a list of vocabulary items with Danish, English, type, optional context, tags, and CEFR level. This runs once at module creation/seeding — never at session time. It is a building block of default-module seeding (F18) and custom-module generation (F24).

**Out of scope**:
- Storing the items (→ [F01](./F01-vocabulary-catalog.md))
- Generating exercises (→ [F17](./F17-ai-exercise-bank-generation.md))
- Orchestrating the full seeding pipeline (→ [F18](./F18-default-module-seeding.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Module shell | The human-authored inputs: theme, communication goal, grammar focus, vocabulary focus, CEFR level |
| Vocabulary set | The AI-produced list of VocabularyItem candidates for a module |

### 2.2. Requirements

### Requirement: Generate-vocabulary operation
- Input: module shell (theme, goal, CEFR level, grammar focus, vocab focus).
- Output: a set of vocabulary item candidates `{ danish, english, type, context?, tags[], cefrLevel }` consistent with the taxonomy (F01) and pitched at the module's CEFR level.
- AI is given the CEFR level so item difficulty matches.

### Requirement: AI client usage & determinism
- Goes through the shared AI API client (mockable for tests).
- Output must be validated/parsed into the VocabularyItem shape; invalid items are rejected or repaired before being handed to the caller.

### Requirement: No human review step
- Per idea §3.1.3, the shell provides sufficient constraint; no manual review gate. The caller (F18/F24) decides on dedup against the existing catalog (F01).

---

## 3. Key User Stories

| # | As a user (curriculum author), I want to… | So that… |
|---|------------------------------------------|----------|
| US-01 | Get a coherent vocabulary set generated from a module shell | I don't hand-author every word |

---

## 4. Constraints and Assumptions

- **Constraint** — Runs once at creation/seeding, never live during a session.
- **Constraint** — CEFR-aware generation.
- **Assumption** — Output is deterministic enough to validate against the type taxonomy; the AI returns structured data.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Target count of vocab items per module? | Driven by the shell's scope; bound it to keep banks ~50 exercises |
| OQ-02 | How to dedup generated items against the existing catalog? | Reuse F01's canonical key; reuse existing items rather than duplicating |
