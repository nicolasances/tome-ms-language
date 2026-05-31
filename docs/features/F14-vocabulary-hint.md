# F14 — Vocabulary Hint

## 1. Purpose & Scope

On request during a translation exercise, the user can ask for a hint that nudges them toward the answer without revealing it fully (e.g. first letter, word type, a clue about the sense). This is an explicit, on-demand AI touchpoint. Using a hint marks the attempt as "prompted", which reduces the SRS weight applied to a subsequent correct answer on that item in the test (F06).

**Out of scope**:
- Revealing the full answer (that's the wrong-answer feedback path in F10)
- Hints for non-translation types (v2.0 scopes hints to translation exercises)

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Hint | A partial clue for a translation exercise that does not give away the full answer |
| Hint penalty | Using a hint marks the attempt as "prompted" (`wasPrompted = true`), reducing SRS weight on a later correct answer (F06) |

### 2.2. Requirements

### Requirement: Hint endpoint

- `POST /exercises/:exerciseId/hint` — request a hint for a translation exercise.
  - Body: `{ sessionId: string, cefrLevel: string }`.
  - Output: a short hint that helps without revealing the full answer, pitched at the user's CEFR level. Generated via the AI client (mockable).

### Requirement: Mark attempt as prompted
- When a hint is used for an exercise in the current session, set `wasPrompted = true` for that exercise's entry in the PracticeSession (F10) or test state (F11). This flag is forwarded to F06's apply-results so a subsequent correct answer on the same item carries reduced weight.

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
| OQ-02 | How exactly does a hint reduce SRS weight in the test? | The `wasPrompted` flag on ExerciseResult feeds F06's SRS formula; define the weight reduction |
