# F13 — Translation Answer Verification

![Status](https://img.shields.io/badge/status-implemented-brightgreen?style=flat-square)

## 1. Purpose & Scope

For `translation_active` exercises only, after an answer is marked wrong by the normalized matching, the user can explicitly ask the AI to verify whether their translation is actually valid (paraphrases, synonyms the pre-generated list missed). If valid, the exercise is marked correct and the user's translation is appended to `userContributedAnswers` for that exercise. If invalid, the AI explains why. One verification per exercise attempt; unlimited across different exercises.

This applies identically in **practice sessions (F10)**, **module tests (F11)**, and **level tests (F21)**, since both tests behave like a graded practice session (per-answer checking with immediate feedback). In a test, a valid verification flips the exercise's stored result to correct **at answer time, before the test is scored on submit** — so it requires no post-submit score mutation.

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
  - Body: `{ userAnswer: string, sessionId: string, cefrLevel: string }`. `sessionId` is the id of the practice session (F10), the module test attempt (F11), **or** the level test attempt (F21) the answer belongs to.
  - Returns: `{ valid: boolean, explanation?: string }`. `explanation` is always present when `valid` is `false` (why the translation is wrong) and optional when `valid` is `true` (a short note on how the answer differs from the expected answer / target vocabulary item).

#### 2.2.4. Business Logic

- The AI judges the answer **on its own**, against real-world Danish: it is given only the English prompt, the learner's answer and the CEFR level. It is **not** given the accepted answers or the linked vocabulary item. The answer is valid unless it is grammatically or syntactically wrong, changes the meaning, sounds really odd, or is inappropriate; a correct but different phrasing is valid.
- **Valid** outcome: the exercise is marked correct for this attempt. In a **practice session** (F10), remove it from the `retryQueue`; in a **module test** (F11) or **level test** (F21), flip the exercise's stored `isCorrect` to correct on the `ModuleTestAttempt`/`LevelTestAttempt` so the score computed on submit reflects it. In all cases, append the user's answer to `userContributedAnswers` via F04's mutation endpoint.
- **Valid** outcome note: after the verdict is decided, a second AI step — the only one that sees the accepted answers and the target vocabulary item — may return a short note (e.g. "Correct! 'vel' is another common way to say this: Du er vel enig med mig?"). It is returned as `explanation`; if that step fails or has nothing to add, the answer is still valid and `explanation` is omitted.
- **Invalid** outcome: return an AI explanation of why the translation is not valid; session state is unchanged.
- One-per-attempt guard: only one verification is allowed per (sessionId, exerciseId) combination — tracked via `verifiedExerciseIds` on the `PracticeSession` (F10), the `ModuleTestAttempt` (F11), or the `LevelTestAttempt` (F21). Subsequent calls for the same pair are rejected.
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

| # | Question | Resolution |
|---|----------|------------|
| OQ-01 | In a Module/Level Test, can verification be invoked during the test, and does it retroactively change the score? | **Resolved.** The Module Test (F11) and Level Test (F21) both behave like a graded practice session with per-answer checking and immediate feedback, so verification is invoked **during** the test exactly as in practice. A valid verification flips the exercise's stored result to correct *before* the test is scored on submit, so there is **no retroactive score mutation**. Tracked in [GitHub issue #64](https://github.com/nicolasances/tome-ms-language/issues/64) (Module Test) and [GitHub issue #87](https://github.com/nicolasances/tome-ms-language/issues/87) (Level Test), both resolved. |
| OQ-02 | Are contributed answers shared across users (on the shared exercise) or per-user? | **Shared.** A validated answer is appended to the exercise's `userContributedAnswers` via `ExerciseStore.appendUserContributedAnswer` — one user's accepted paraphrase benefits all users of the same exercise. |

---

## 6. Technical Decisions

- **Practice sessions, module tests, and level tests** — Verification applies in F10 practice sessions, F11 module tests, and F21 level tests. Because the Module Test and Level Test both behave like a graded practice session (per-answer checking with immediate feedback), a valid verification flips the answer to correct at answer time, before scoring on submit — no post-submit score mutation. Issue #64 is resolved by this unified model (see OQ-01); issue #87 extended the same model to the Level Test.
- **One-per-attempt guard via `verifiedExerciseIds`** — A `verifiedExerciseIds: string[]` field lives on `PracticeSession` (F10), `ModuleTestAttempt` (F11), and `LevelTestAttempt` (F21). On verification, the exerciseId is pushed into this array; subsequent calls for the same `(sessionId, exerciseId)` pair are rejected with 409.
- **Valid outcome in practice removes from retry queue** — `PracticeSessionStore.removeFromRetryQueue` uses MongoDB `$pull` to remove the exerciseId from `retryQueue`, preventing a re-show without updating the stored answer record. (Module tests and level tests have no retry queue; the valid outcome flips the stored `isCorrect` on the attempt instead.)
- **`translation_active` constraint enforced at the delegate** — The delegate rejects any non-`translation_active` exercise with a 400 rather than silently ignoring or branching on grammar-concept logic (those exercises have no vocabulary context to scope the AI judgment).
- **Vertex AI, same pattern as F12** — Uses the injectable `VertexAIClient` interface via Vertex AI. Unlike F12 (`gemini-2.5-flash-lite`), the answer check runs on `gemini-2.5-flash` (overridable with the `VERTEX_AI_VERIFICATION_MODEL` env var), because judging real-world Danish needs more than the smallest tier. The call is on-demand and one-shot per exercise, so the cost impact is small. Unit tests inject a mock client; no live GCP call is required in the test suite.
- **Verdict does not see the accepted answers or the vocabulary item** — The first prompt contains only the English prompt, the learner's answer and the CEFR level, so a learner is judged against real Danish and not against the exercise's expected answer (and is not implied to be required to use the target word). The response lists `reasoning` before `valid`, so the verdict follows from the analysis. A separate second prompt, sent only for valid answers, receives the accepted answers and target vocabulary item to write the optional note. Resolved in [GitHub issue #106](https://github.com/nicolasances/tome-ms-language/issues/106).
- **AI prompt ignores case and punctuation, unconditionally** — Alongside the existing "ignore case" instruction, the prompt explicitly tells the model to ignore punctuation differences (periods, commas, quotation marks, dashes, etc.). This prevents an otherwise-correct translation from being marked invalid purely on punctuation, and holds even in edge cases where punctuation could theoretically affect meaning (e.g. a missing question mark). Resolved in [GitHub issue #97](https://github.com/nicolasances/tome-ms-language/issues/97).
