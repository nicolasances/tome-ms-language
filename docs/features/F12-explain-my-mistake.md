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
| On-demand | Generated only when the user explicitly asks |

### 2.2. Requirements

### Requirement: Explain-mistake endpoint
- Input: the exercise id (and the user's wrong answer / the context of the attempt).
- Output: correct answer, why it is correct (grammar rule or vocab note), the rule stated simply in English, and a second Danish example demonstrating the same rule.
- Calls the AI client; the prompt includes the exercise, the user's wrong answer, the linked vocab item or grammar concept, and the **user's current CEFR level** so complexity is pitched right.

### Requirement: AI client usage
- Goes through the shared AI API client (mockable). No new persistent data model required; the explanation is returned, not necessarily stored (may be cached).

### Requirement: Stateless w.r.t. mastery
- Requesting an explanation does not change mastery or the exercise's correctness.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Ask for an explanation when I get something wrong | I understand the rule, not just the right answer (idea US-04) |

---

## 4. Constraints and Assumptions

- **Constraint** — On-demand only; this is a deliberate, opt-in exception to the no-live-AI rule.
- **Constraint** — AI call must be CEFR-aware.
- **Assumption** — Available both during practice (after a wrong answer) and in the post-test review (per incorrect item).

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Cache explanations per (exercise, wrong-answer)? | Could reduce repeated AI cost for common mistakes |
| OQ-02 | Rate limiting per user? | Bound AI cost |
