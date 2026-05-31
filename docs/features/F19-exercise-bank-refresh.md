# F19 — Exercise Bank Refresh

## 1. Purpose & Scope

When a module's bank falls below one full session's worth of exercises the user has **not yet seen**, the system triggers an async background job to generate additional exercises (via F17) and append them to the bank (F04). The user is never blocked. This also handles users who want more practice than the initial ~50 exercises provide.

**Out of scope**:
- Live/synchronous generation (must be async, never blocking a session)
- Generating the initial bank (→ [F18](./F18-default-module-seeding.md), [F24](./F24-custom-module-generation.md))
- The selection logic (→ [F08](./F08-mastery-aware-exercise-selection.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Bank refresh | Background top-up of a module's exercise bank |
| Unseen threshold | Trigger when unseen-by-user exercises drop below one session size |
| Async job | Triggered via an event/queue; never blocks the user |

### 2.2. Requirements

### Requirement: Refresh trigger
- After a session/test completes (or when selection in F08/F11 detects too few unseen exercises), evaluate whether the count of exercises not yet shown to the user is below one `practiceSessionSize`.
- If so, enqueue a background refresh job for that module (avoid duplicate concurrent jobs per module).

### Requirement: Refresh background handler
- An event/message handler that runs F17 to generate additional exercises covering the module's vocab + grammar (prioritizing under-covered items), validates them (F04 constraints), and appends them to the bank, updating `generatedAt` and `totalGenerated`.
- Runs through the platform's event/queue mechanism (totoms message handler pattern).

### Requirement: Non-blocking guarantee
- The user's session proceeds with whatever is available; the refresh result becomes available for future sessions only.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Keep practicing a module beyond its initial exercises | I never run out of practice |
| US-02 | Never wait for exercises to be generated | sessions stay instant |

---

## 4. Constraints and Assumptions

- **Constraint** — Generation is async/background, never during a live session.
- **Constraint** — For default (shared) modules, refresh updates the shared bank; for user-generated modules, the per-user bank.
- **Assumption** — A queue/event mechanism exists (SQS/PubSub per package deps) to run the job.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | For shared default banks, "unseen by user" is per-user but the bank is shared — does refresh trigger off any user or aggregate? | Per-user unseen count, but generation benefits all; debounce per module |
| OQ-02 | Upper bound on bank growth? | Cap totalGenerated or prune low-value exercises |
