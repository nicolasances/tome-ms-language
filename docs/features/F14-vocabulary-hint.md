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

#### 2.2.2. Endpoints

- `POST /exercises/:exerciseId/hint` — request a hint for a translation exercise.
  - Body: `{ sessionId: string, cefrLevel: string }`.
  - Returns: a short hint that helps without revealing the full answer, pitched at the user's CEFR level.

#### 2.2.4. Business Logic

- The hint is generated via the AI client (mockable). It must not reveal the full canonical answer.
- When a hint is used, set `wasPrompted = true` for that exercise's entry in the active PracticeSession (F10) or test state (F11). This flag is forwarded to F06's apply-results so that a subsequent correct answer on the same item carries reduced SRS weight.
- Scoped to `translation_active` exercise types in v2.0; a request for any other type is rejected.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Request a hint for a translation exercise on behalf of the user | the app receives a partial clue to display without giving away the answer |

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
