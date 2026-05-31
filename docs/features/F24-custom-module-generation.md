# F24 — Custom Module Generation

## 1. Purpose & Scope

A user can generate a module on demand from a natural-language prompt (idea US-02) or from a pasted-content gap identified by Analyze Content (F23). The system generates the module's title, communication goal, vocabulary set, grammar concepts, and exercise bank — at the **user's current CEFR level** — reusing the same generation machinery as default-module seeding. The result is a Module with `isUserGenerated = true` and a per-user exercise bank. Once created, the module runs through the exact same execution flow (F09–F11) as a default module.

**Out of scope**:
- The execution flow once created (→ [F09](./F09-grammar-introduction.md), [F10](./F10-practice-session.md), [F11](./F11-module-test.md))
- The individual AI generation steps (→ [F15](./F15-ai-vocabulary-generation.md), [F16](./F16-ai-grammar-explanation-generation.md), [F17](./F17-ai-exercise-bank-generation.md))
- Bringing user-*added* words into a module (deferred — idea §9; not this feature)

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Custom module | A user-generated Module (`isUserGenerated = true`) created from a prompt or content corpus |
| Context corpus | Pasted text from Analyze Content used to ground generation |
| Per-user bank | The exercise bank for a custom module, owned by the requesting user |

### 2.2. Requirements

### Requirement: Generate-custom-module endpoint
- Input: either a natural-language prompt or a context corpus (pasted text from F23) + the requesting user.
- Generation (runs once at creation, not at session time):
  1. AI produces the module shell pieces it doesn't get from input: title, communication goal, grammar concepts to include (constrained to the user's current CEFR level), vocabulary focus.
  2. Generate the vocabulary set (F15) and ensure grammar concept explanations (F16).
  3. Generate the per-user exercise bank (F17) with coverage guarantees.
  4. Persist the Module (F03) with `isUserGenerated = true` and the per-user ExerciseBank (F04).
- The generated module is pitched at the **user's current CEFR level** — never above (idea OQ-03: keep progression gated).

### Requirement: Reuse default machinery
- Reuse F15/F16/F17 exactly; the only differences from F18 are the trigger (live user request), the level source (the user's current level), the bank ownership (per-user), and the `isUserGenerated` flag.

### Requirement: Synchronous-enough creation
- Generation runs upfront at creation; the user may wait for creation to finish, but no AI runs during the subsequent practice/test sessions.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Create a module from a natural-language prompt | I learn vocabulary relevant to my real life (idea US-02) |
| US-02 | Generate a custom module from a text I pasted | I get targeted practice on a real gap (idea §3.7.3) |

---

## 4. Constraints and Assumptions

- **Constraint** — Generated at the user's current CEFR level; never above (gated progression).
- **Constraint** — Generation runs at creation, never during sessions.
- **Constraint** — Custom module banks are per-user (not shared).
- **Assumption** — Custom modules participate in the level's module set per F21 OQ-02's resolution (whether they count toward level completion is an open question).

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Do custom modules count toward Level Test eligibility / level scope? | Ties to F07 / F21 OQ-02 |
| OQ-02 | Is creation synchronous (user waits) or async with a "generating" status? | Generation of ~50 exercises may be slow; consider a status + notification |
| OQ-03 | Can a user generate a module above their level? | Idea OQ-03: probably not — keep gated |
