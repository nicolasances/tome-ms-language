# F12 — Explain My Mistake

## 1. Purpose & Scope

After any exercise answered **incorrectly** (in practice or in a test review), the user can request an AI-generated explanation of their mistake. This is an explicit, on-demand AI touchpoint — never triggered automatically. The explanation states the correct answer, why it is correct, the rule in plain English, and a second Danish example of the same rule.

**Out of scope**:
- Automatic explanations (must be on demand)
- Translation answer *re-validation* (→ [F13](./F13-translation-answer-verification.md)) — a different touchpoint
- Hints before answering (→ [F14](./F14-vocabulary-hint.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Mistake explanation | AI-generated breakdown of why an answer was wrong, with rule + extra example |
| On-demand | Generated only when the user explicitly requests it |

### 2.2. Requirements

#### 2.2.2. Endpoints

- `POST /exercises/:exerciseId/explainMistake` — request an AI explanation for a wrong answer.
  - Body: `{ userAnswer: string, cefrLevel: string }`.
  - Returns: correct answer, why it is correct (grammar rule or vocab note), the rule stated simply in English, and a second Danish example demonstrating the same rule.

#### 2.2.4. Business Logic

- The AI call includes the exercise content, the user's wrong answer, the linked vocabulary item or grammar concept, and the user's current CEFR level.
- Goes through the shared AI API client (mockable for testing).
- No new persistent data model required; the explanation is returned in the response and not stored.
- Requesting an explanation does not change mastery or the exercise's correctness for the current session.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Request an AI explanation for a wrong answer on demand | the app can show the user the rule behind the mistake without storing any session state |

---

## 4. Constraints and Assumptions

- **Constraint** — On-demand only; this is a deliberate, opt-in exception to the no-live-AI rule.
- **Constraint** — AI call must be CEFR-aware.
- **Assumption** — Available both during practice (after a wrong answer) and in the post-test review (per incorrect item).

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Cache explanations per (exerciseId, userAnswer)? | Could reduce repeated AI cost for common mistakes |
| OQ-02 | Rate limiting per user? | Bound AI cost |
