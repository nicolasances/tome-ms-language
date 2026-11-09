# F27 — Word Answer Verification (Words Practice "Check with AI")

![Status](https://img.shields.io/badge/status-implemented-brightgreen?style=flat-square)

## 1. Purpose & Scope

In a Words Practice session (F26), answers are matched only against the single canonical Danish form of a vocabulary item — vocabulary items carry no alternative answers. A valid synonym (e.g. a different correct Danish word for "large") is therefore marked wrong.

This feature lets the user, **after a wrong answer**, explicitly ask the AI whether their Danish is a valid translation of the English prompt. It is the Words Practice counterpart of F13 ("Check with AI" for `translation_active` exercises), with the same judging principle: the AI judges whether the answer is real, correct Danish for the prompt, **not** whether it matches the stored form.

- **Valid** → the answer counts as correct for this session; if it was the word's first attempt, the mastery write is made as *correct*.
- **Invalid** → the answer stays wrong; the AI explains why.

Accepted answers are **not persisted** on the vocabulary item (one-off) — the same synonym will be checked again next time it occurs.

Idea: [`tome/docs/idea/language-learning/2026-11-08-words-practice.md`](https://github.com/nicolasances/tome/blob/main/docs/idea/language-learning/2026-11-08-words-practice.md)

Companion frontend feature: [`tome#09-words-practice`](https://github.com/nicolasances/tome/blob/main/docs/features/09-words-practice.md)

**Out of scope**:
- The session, answer checking and the pending mastery rule (→ [F26](./F26-words-practice-session.md)).
- F13 itself — exercise verification is unchanged.
- Persisting accepted answers (`userContributedAnswers` on `VocabularyItem`) — deliberately not done in v1.
- "Explain my mistake" (F12) — not offered in Words Practice; the invalid verdict's explanation fills that role.
- Automatic verification — always on explicit user request.

---

## 2. Key Endpoints

**Summary of Endpoints:**

| Endpoint Type | Method | URL Path | Description |
|---------------|--------|----------|-------------|
| API | POST | `/users/:userId/wordsPracticeSessions/:sessionId/answers/verify` | AI check of the session's most recent (wrong) answer |

### Endpoint: POST `/users/:userId/wordsPracticeSessions/:sessionId/answers/verify`

**Description:**
Body: `{ wordKey: string, cefrLevel: string }`. Verifies the **most recent attempt** of `wordKey`, which must be the session's most recent answer (`lastAnsweredWordKey`) and must be wrong. Returns `{ valid: boolean, explanation?: string }`.
- `explanation` is always present when `valid = false` (why the answer is not valid Danish for the prompt) and optional when `valid = true` (a short note, e.g. pointing at the stored form).
- **409** if that attempt has already been checked (`aiChecked = true`) — one check per answer.
- **400** if `wordKey` is not the session's most recent answer, the most recent attempt is correct, or the session is `completed`.
- **404** if the session does not exist or belongs to another user.

The user answer is read from the stored attempt — it is not sent again — so the client cannot verify a different answer from the one that was judged.

**Expected Use Case:**
On the Words Practice screen (`tome#09-words-practice`), after a wrong answer, the user taps "Check with AI"; the app shows the AI verify tray (loading → accepted / not accepted). On `valid: true` the app counts the word as correct and does not re-queue it.

---

## 4. Business Logic

- **Eligibility**: only the session's most recent answer can be checked, only when it is wrong, only once (`aiChecked`). This keeps F26's pending first-attempt rule simple: at most one pending result, and it is always the one being checked.
- **AI judgment**: the prompt contains only the English prompt (`english`, plus `type` and `context` when present), the user's answer, and the user's CEFR level. It is **not** given the canonical `danish`. The answer is valid unless it is wrong Danish, changes the meaning, sounds really odd, or is inappropriate. Case and punctuation are ignored (as F13). A bare noun without en/et, or an infinitive with or without `at`, is not a reason to reject.
- **Optional note on valid**: as F13, a second AI step that *does* see the canonical `danish` may return a short note (e.g. "Correct — the form used in your module was *stor*"). If it fails or has nothing to add, the answer is still valid and `explanation` is omitted.
- **Valid outcome**:
  - Mark the attempt `isCorrect = true`, `aiChecked = true`; mark the word `correct = true`.
  - If the attempt is the word's **first attempt**: set `firstAttemptCorrect = true` and finalize the pending mastery write (F26) as **correct** for every item in the word's group.
  - If it is a retry: no mastery effect.
  - Nothing is written to the `VocabularyItem` or any exercise.
- **Invalid outcome**:
  - Mark the attempt `aiChecked = true`; the word stays not correct.
  - If the attempt is the word's first attempt: finalize the pending mastery write (F26) as **incorrect**.
- **AI failure** (timeout / error): return 5xx, leave the attempt unchecked (`aiChecked = false`) and the pending write untouched, so the user can retry the check or move on (moving on finalizes it as incorrect per F26).
- Goes through the shared AI client used by F12/F13 (mockable), with the same model selection as F13.

---

## 5. Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | A **new endpoint** under the Words Practice session rather than reusing `POST /exercises/:exerciseId/verifyAnswer` (F13). | F13 is keyed by exercise id and mutates exercises (`userContributedAnswers`, retry queue); a word has no exercise. Bending F13 would add a second, unrelated branch to it. |
| 2 | The user answer is read from the stored attempt, not from the request body. | Guarantees the AI checks exactly the answer that was judged wrong; avoids a client verifying a corrected answer. |
| 3 | Only the session's most recent answer is verifiable. | Matches the UX (the tray only appears right after a wrong answer) and bounds F26's pending state to a single result. |
| 4 | Reuse F13's prompt principles and model (real Danish, ignore case/punctuation, verdict without the expected answer, optional second-step note). | One consistent definition of "Check with AI" across the app (issue #106). |
| 5 | No persistence of accepted answers. | Product decision (idea OQ-01); revisit after real use. |

---

## 6. Success Criteria

| # | Criterion | Notes |
|---|-----------|-------|
| 1 | Valid verdict on a wrong first attempt: word becomes correct, `firstAttemptCorrect = true`, and exactly one `words_practice` result with `isCorrect = true` is appended to every item in the group. | AI mocked. |
| 2 | Invalid verdict on a wrong first attempt: word stays not correct, exactly one result with `isCorrect = false` is appended to every item in the group, and an explanation is returned. | |
| 3 | Verdict on a retry changes the word's correctness only; no mastery write. | |
| 4 | A second check of the same attempt returns 409; checking a word that is not the most recent answer returns 400. | |
| 5 | The AI prompt for the verdict never contains the canonical `danish`. | |
| 6 | An AI failure leaves `aiChecked = false` and the pending write unmade. | |
| 7 | No `VocabularyItem` or `Exercise` document is modified by any outcome. | |

---

## 7. Open Questions

All open questions resolved.
