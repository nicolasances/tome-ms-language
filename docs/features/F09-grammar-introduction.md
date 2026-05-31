# F09 — Grammar Introduction (Module Step 1)

## 1. Purpose & Scope

Step 1 of a module run is purely instructional: for each grammar concept in the module, the app shows a short explanation with 1–2 Danish examples. The user does not interact. This feature serves the pre-generated explanation content for a module's grammar concepts in the order they should be presented. No mastery change, no AI at runtime — explanations were generated and stored at seeding time (F02/F16).

**Out of scope**:
- Generating explanations (→ [F16](./F16-ai-grammar-explanation-generation.md))
- Storing the GrammarConcept (→ [F02](./F02-grammar-concept-catalog.md))
- Any interactive exercise (→ [F10](./F10-practice-session.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Grammar introduction | The instructional Step 1 of a module: explanation + examples, no interaction |

### 2.2. Requirements

### Requirement: Get module grammar introduction endpoint
- Given a module id, return its grammar concepts (resolved from `grammarConceptIds`) each with `name`, `explanation`, and `examples`, in the intended presentation order.
- Read-only; reuses F02 and F03 stores; no new data model.

### Requirement: Mark Step 1 reached (optional)
- Optionally, opening a module transitions UserModuleProgress to `in_progress` (or that transition can be deferred to when practice starts in F10 — pick one and be consistent).

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | See a short explanation and examples for each grammar concept before practicing | I learn the rule in context (idea US-03) |

---

## 4. Constraints and Assumptions

- **Constraint** — No mastery scores are updated in Step 1.
- **Constraint** — Explanations are never generated live; they are read from storage.
- **Assumption** — Presentation order of concepts can follow the order of `grammarConceptIds` on the module.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Does Step 1 trigger `in_progress`, or only Step 2? | Avoid double-handling; pick the boundary explicitly |
