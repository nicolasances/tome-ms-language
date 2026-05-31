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

#### 2.2.2. Endpoints

- `POST /exercises/:exerciseId/verifyAnswer` — request AI verification of a translation that was marked wrong.
  - Body: `{ userAnswer: string, sessionId: string, cefrLevel: string }`.
  - Returns: `{ valid: boolean, explanation?: string }`.

#### 2.2.4. Business Logic

- The AI checks validity scoped by the exercise prompt and any `context` note on the linked vocabulary item, and pitched at the user's CEFR level.
- **Valid** outcome: the exercise is marked correct for this attempt (update session state to remove it from the retry queue in practice, or adjust score calculation if in a test); append the user's answer to `userContributedAnswers` via F04's mutation endpoint.
- **Invalid** outcome: return an AI explanation of why the translation is not valid; session state is unchanged.
- One-per-attempt guard: only one verification is allowed per (sessionId, exerciseId) combination. Subsequent calls for the same pair are rejected.
- Goes through the shared AI API client (mockable for testing).

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Submit a user's disputed translation for AI verification | the app can flip the exercise to correct and persist the validated phrasing if the AI confirms it |
| CS-02 | Receive an AI explanation when a translation is invalid | the app can show the user why their phrasing does not work |

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
