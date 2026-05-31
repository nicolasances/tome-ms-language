# F14 — Vocabulary Hint

## 1. Purpose & Scope

On request during a translation exercise, the user can ask for a hint that nudges them toward the answer without revealing it fully (e.g. first letter, word type, a clue about the sense). This is an explicit, on-demand AI touchpoint. Using a hint may reduce the "quick/unprompted" weight that the SRS gives a subsequent correct answer (F06).

**Out of scope**:
- Revealing the full answer (that's the wrong-answer feedback path in F10)
- Hints for non-translation types (v2.0 scopes hints to translation exercises)

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Hint | A partial clue for a translation exercise that does not give away the full answer |
| Hint penalty | Using a hint marks the attempt as "prompted", reducing SRS weight on a later correct answer |

### 2.2. Requirements

### Requirement: Hint endpoint
- Input: the translation exercise id.
- Output: a short hint that helps without revealing the full answer, pitched at the user's CEFR level. Generated via the AI client (mockable).

### Requirement: Mark attempt as prompted
- When a hint is used for an exercise in the current session, flag that exercise's attempt as "prompted" so that, when results are later applied to mastery (in a test via F06), the correct answer carries less weight. (Practice does not update mastery, so the flag matters only if the same item is then tested — keep the flag on the session result that feeds the test, per the chosen design.)

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Get a hint when I'm stuck on a translation | I can make progress without just being shown the answer |

---

## 4. Constraints and Assumptions

- **Constraint** — On-demand only (exception to no-live-AI), CEFR-aware.
- **Constraint** — Must not reveal the full answer.
- **Assumption** — Hints are scoped to translation exercises in v2.0.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Should hints be pre-generated and stored to avoid live AI? | Idea lists it as a live AI touchpoint; could pre-generate a generic hint per exercise to cut cost |
| OQ-02 | How exactly does a hint reduce SRS weight, given practice doesn't update mastery? | Define the link between session "prompted" flag and later test weighting, or drop the penalty in v2.0 |
