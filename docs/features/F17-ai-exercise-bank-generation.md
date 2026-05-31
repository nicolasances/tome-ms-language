# F17 — AI Exercise Bank Generation

## 1. Purpose & Scope

Given a module's vocabulary set and grammar concepts, the AI generates a bank of ~50 exercises covering them, with the correct per-type structure (prompts, distractors, word tiles, canonical answer, and — for translation_active / sentence_reorder / error_correction — accepted alternative answers). The bank must include ≥1 exercise per vocab item and ≥1 per grammar concept. Runs once at creation/seeding, never live. Used by F18, F19 (refresh), and F24.

**Out of scope**:
- Storing exercises (→ [F04](./F04-exercise-bank.md))
- Selecting exercises for a session (→ [F08](./F08-mastery-aware-exercise-selection.md))
- Level test bank generation (→ [F20](./F20-level-test-bank-seeding.md)) — separate cross-module bank

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Exercise generation | AI production of structured exercises for given vocab/grammar targets |
| Coverage guarantee | ≥1 exercise per vocab item and ≥1 per grammar concept in the module |
| Accepted alternatives | 3–5 valid alternative answers for translation_active (may be empty); valid orderings for sentence_reorder; valid corrections for error_correction |

### 2.2. Requirements

### Requirement: Generate-exercise-bank operation
- Input: the module's vocabulary items, grammar concepts, and CEFR level; a target count (~50) or a target set of items to cover.
- Output: a list of well-formed Exercise candidates honoring the per-type linkage and field rules from F04:
  - `vocabularyItemId` → multiple_choice, fill_blank, conjugation_drill, translation_active
  - `grammarConceptId` → sentence_reorder, error_correction
  - exactly one of vocab/grammar id set per exercise.
- For `translation_active`: produce 3–5 accepted alternative answers (paraphrases, synonym clusters; may be empty when there's only one valid answer). Use any `context` note to scope alternatives and optionally include it in the prompt to disambiguate.
- For `sentence_reorder`: produce shuffled `words` tiles and valid alternative orderings.
- For `error_correction`: produce the flawed sentence and valid corrections.
- Set `promptTranslation` where required by type.

### Requirement: Coverage enforcement
- Guarantee ≥1 exercise per vocab item and ≥1 per grammar concept. The operation reports coverage so the caller can verify before storing.

### Requirement: AI client usage & validation
- Goes through the shared AI client (mockable). Output is validated against F04's Exercise constraints; malformed exercises are rejected/repaired.

---

## 3. Key User Stories

| # | As a user (curriculum author), I want to… | So that… |
|---|------------------------------------------|----------|
| US-01 | Get a full exercise bank generated from a module's vocab + grammar | runtime sessions never wait on AI |
| US-02 | Be sure every word and concept has at least one exercise | nothing in the module is untestable |

---

## 4. Constraints and Assumptions

- **Constraint** — Runs upfront (seeding/creation) or in background (F19), never during a live session.
- **Constraint** — ~50 exercises is the initial target per module bank.
- **Constraint** — CEFR-aware; exercise difficulty matches the module level.
- **Assumption** — Alternative-answer generation quality is acceptable without a human review step.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Distribution of exercise types across the bank? | Ensure all 6 types represented so the Step 2 ordering is meaningful |
| OQ-02 | How to verify generated alternatives are actually valid Danish? | Trust AI + later F13 user contributions, or add a validation pass |
