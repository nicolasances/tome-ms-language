# F13 — Translation Answer Verification

## 1. Purpose & Scope

For `translation_active` exercises only, after an answer is marked wrong by the normalized matching, the user can explicitly ask the AI to verify whether their translation is actually valid (paraphrases, synonyms the pre-generated list missed). If valid, the exercise is marked correct and the user's translation is appended to `userContributedAnswers` for that exercise. If invalid, the AI explains why. One verification per exercise attempt; unlimited across different exercises.

**Out of scope**:
- All non-translation exercise types (not applicable)
- Automatic verification (must be explicit, on demand)

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Answer verification | On-demand AI check of whether a user's translation is valid, independent of the stored answer list |
| userContributedAnswers | Per-exercise list of user translations validated by AI at answer time |

### 2.2. Requirements

### Requirement: Verify-translation endpoint

- `POST /exercises/:exerciseId/verifyAnswer` — request AI verification of a translation that was marked wrong.
  - Body: `{ userAnswer: string, sessionId: string, cefrLevel: string }`.
  - The AI checks validity scoped by the exercise prompt and any `context` note on the linked vocab item, and the user's CEFR level.
  - **Valid** outcome: mark the exercise correct for this attempt; append the user's answer to that exercise's `userContributedAnswers` via F04's mutation endpoint.
  - **Invalid** outcome: return an AI explanation of why the translation is not valid.

### Requirement: One-per-attempt guard
- Allow only one verification per exercise attempt. Track using `sessionId` + `exerciseId`.

### Requirement: Effect on session state
- A "valid" result flips the in-session correctness of that exercise (removes it from the retry queue in practice; adjusts score calculation if invoked before scoring is finalized in a test).

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Ask the AI to check a translation it marked wrong | valid paraphrases I write are accepted |
| US-02 | Have my accepted phrasing remembered | it's accepted automatically next time (added to userContributedAnswers) |
| US-03 | Get told why my translation was wrong when it really is | I learn from it |

---

## 4. Constraints and Assumptions

- **Constraint** — Deliberate exception to the no-live-AI rule; on-demand and expected to be used sparingly.
- **Constraint** — Only `translation_active` exercises.
- **Constraint** — `userContributedAnswers` are stored separately from AI-generated `alternativeAnswers` for auditability.
- **Assumption** — A "valid" verification benefits all users of a shared default exercise (the contributed answer is stored on the shared exercise) — confirm this is desired vs. per-user.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | In a Module/Level Test, can verification be invoked during the post-submit review, and does it retroactively change the score? | Idea allows "Explain my mistake" in review; verification's scoring impact during tests needs a rule |
| OQ-02 | Are contributed answers shared across users (on the shared exercise) or per-user? | Affects whether one user's accepted phrasing helps everyone |
