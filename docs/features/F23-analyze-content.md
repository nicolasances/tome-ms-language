# F23 — Content Analysis Report

## 1. Purpose & Scope

A user pastes any Danish text (article, transcript, email, contract clause) and an **external tool** analyzes it using AI — producing an estimated CEFR level, vocabulary coverage (what they already know vs. new items), grammar coverage (patterns detected and whether covered/ahead/not-in-curriculum), curriculum routing (which default modules close the gaps, ranked by impact), and a readiness estimate. That external tool then submits the result to this microservice via `POST /contentReports`. This feature stores and serves those ContentReport objects.

Actions the app can surface from a report — add unknown vocabulary to the pool (F22) and navigate to suggested modules — are separate calls to existing endpoints; this feature only persists the report.

**Out of scope**:
- The AI analysis pipeline (runs in an external tool, not this microservice)
- URL ingestion / audio transcript fetching (manual paste only in v2.0)
- Actually adding vocab (delegates to [F22](./F22-user-added-vocabulary.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Content Report | The diagnostic output: CEFR estimate, vocab/grammar coverage, curriculum routing, readiness |
| Vocabulary coverage | % of the text's vocab already in the user's known set + list of new items |
| GrammarPatternResult | A detected grammar pattern + status: covered / ahead_in_curriculum / not_in_curriculum |
| Curriculum routing | Existing default modules that address the gaps, ranked by impact |

### 2.2. Requirements

### Requirement: GrammarPatternResult sub-model

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| conceptName | string | Grammar concept name | Must match F02 taxonomy |
| status | string | Coverage classification | Must be one of: covered, ahead_in_curriculum, not_in_curriculum |
| coveredByModule | string | Module id that covers this concept | Nullable |

### Requirement: ContentReport data model

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | ObjectId | Unique report id | Auto-generated |
| userId | string | User id | Required |
| inputText | string | The pasted Danish text | Required |
| estimatedCefrLevel | string | AI-estimated CEFR level of the text | Must be one of: A1, A2, B1, B2, C1, C2 |
| vocabularyCoverage | number | % of text's vocabulary already known by user | 0.0–1.0 |
| newVocabularyItems | object[] | Vocabulary items identified as new to the user | Transient candidates; each has `{ danish, english, type }` |
| grammarPatterns | GrammarPatternResult[] | Detected grammar patterns with coverage status | |
| suggestedModules | string[] | Module ids addressing the identified gaps, ranked by impact | |
| readinessNote | string | Short note on what the user would need to tackle the text | Nullable |
| createdAt | Date | When the report was created | Auto-set |

### Requirement: Write endpoint

- `POST /contentReports` — store a content analysis report submitted by the external analysis tool. Returns the stored report with its id.

### Requirement: Read endpoints

- `GET /contentReports/:id` — get a content report by id.
- `GET /users/:userId/contentReports` — list a user's content reports, ordered by recency.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | See a curriculum gap report after pasting a Danish text | I know what to master to understand/produce content like it (idea US-09) |
| US-02 | See which existing modules cover the gaps | the app routes me through its curriculum (idea US-11) |
| US-03 | Add unknown words from the report to my pool | I act on gaps immediately (idea US-10) |

---

## 4. Constraints and Assumptions

- **Constraint** — This microservice stores and serves ContentReports; it does not run the AI analysis.
- **Assumption** — The external tool is responsible for mapping identified grammar patterns to the F02 taxonomy and for ranking suggested modules by impact.
- **Assumption** — `newVocabularyItems` in the report are transient candidates; the user explicitly adds them via F22 if they choose to.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Should the microservice validate that `suggestedModules` ids exist in F03? | Referential integrity check on POST |
| OQ-02 | Should reports expire / be auto-deleted after a period? | Avoid unbounded storage growth |
