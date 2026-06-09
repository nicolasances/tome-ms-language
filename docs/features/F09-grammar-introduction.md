# F09 — Grammar Introduction (Module Step 1) 

![Status](https://img.shields.io/badge/status-implemented-brightgreen?style=flat-square)

## 1. Purpose & Scope

Step 1 of a module run is purely instructional: for each grammar concept in the module, the app shows a short explanation with 1–2 Danish examples. The user does not interact. This feature serves the pre-authored explanation content for a module's grammar concepts in the order they should be presented. No mastery change, no AI at runtime — explanations were submitted and stored at seeding time (F02).

**Out of scope**:
- Storing the GrammarConcept (→ [F02](./F02-grammar-concept-catalog.md))
- Any interactive exercise (→ [F10](./F10-practice-session.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Grammar introduction | The instructional Step 1 of a module: explanation + examples, no interaction |

### 2.2. Requirements

#### 2.2.2. Endpoints

- `GET /modules/:moduleId/grammarIntroduction` — return the module's grammar concepts (resolved from `grammarConceptIds`) each with `name`, `explanation`, and `examples`, in the intended presentation order (order of `grammarConceptIds` on the module). Read-only; reuses F02 and F03 stores; no new data model.

#### 2.2.4. Business Logic

- Presentation order follows the order of `grammarConceptIds` on the module document; no additional sorting is applied.
- No mastery scores are updated as a result of this call.
- Optionally, opening a module (first call to this endpoint) transitions UserModuleProgress to `in_progress` — or that transition can be deferred to when practice starts in F10. Pick one and be consistent; this is an open question (OQ-01).

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Fetch a module's grammar concepts with their explanations and examples in order | the app can present Step 1 of the module without additional API calls |

---

## 4. Constraints and Assumptions

- **Constraint** — No mastery scores are updated in Step 1.
- **Constraint** — Explanations are never generated live; they are read from storage.
- **Assumption** — Presentation order of concepts follows the order of `grammarConceptIds` on the module.

---

## 5. Open Questions

All open questions resolved.

| # | Question | Resolution |
|---|----------|------------|
| OQ-01 | Does Step 1 trigger `in_progress`, or only Step 2? | **Deferred to F10.** This endpoint is pure read-only; no `UserModuleProgress` update is performed. |

## 6. Technical Decisions

- **Response shape**: `{ concepts: [{ name, explanation, examples }] }` — only the fields the app needs for display are returned; `id`, `category`, and `cefrLevelIntroduced` are intentionally omitted from the response.
- **Order preservation**: `GrammarConceptStore.findByIds` uses MongoDB `$in`, which does not preserve input order. The delegate re-sorts results client-side using a `Map` keyed by concept id before returning.
- **Empty module**: if `grammarConceptIds` is empty the delegate returns `{ concepts: [] }` immediately without querying the grammar collection.
