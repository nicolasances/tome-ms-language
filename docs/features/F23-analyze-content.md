# F23 — Analyze Content

## 1. Purpose & Scope

The user pastes any Danish text (article, transcript, email, contract clause) and receives a diagnostic **Content Report**: an estimated CEFR level, vocabulary coverage (what they already know vs. new items), grammar coverage (patterns detected and whether covered/ahead/not-in-curriculum), curriculum routing (which default modules close the gaps, ranked by impact), and a readiness estimate. The report also offers actions: add unknown vocabulary to the pool (via F22) and generate a custom module (via F24). The analysis logic is designed as an isolated, callable component (so a future external agent could invoke it).

**Out of scope**:
- URL ingestion / audio transcript fetching (out of scope v2.0; manual paste only)
- Actually adding vocab (delegates to [F22](./F22-user-added-vocabulary.md)) and generating custom modules (delegates to [F24](./F24-custom-module-generation.md))
- Navigation/rendering (app concern)

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Content Report | The diagnostic output: CEFR estimate, vocab/grammar coverage, routing, readiness |
| Vocabulary coverage | % of the text's vocab already in the user's set + list of new items |
| Grammar pattern result | A detected grammar pattern + status: covered / ahead_in_curriculum / not_in_curriculum |
| Curriculum routing | Existing default modules that address the gaps, ranked by impact |
| Isolated analysis component | The analysis is a self-contained callable unit, reusable outside the app UI |

### 2.2. Requirements

### Requirement: ContentReport data model
- Fields: `id`, `userId`, `inputText`, `estimatedCefrLevel`, `vocabularyCoverage` (0–1), `newVocabularyItems` (VocabularyItem[]), `grammarPatterns` (GrammarPatternResult[]), `suggestedModules` (Module references), `customModulePrompt` (nullable), `createdAt`.
- GrammarPatternResult: `conceptName`, `status` (covered | ahead_in_curriculum | not_in_curriculum), `coveredByModule` (nullable).

### Requirement: Analyze-content endpoint
- Input: pasted Danish text.
- Pipeline (AI-assisted, but invoked on explicit user request — not a live *session* AI call):
  1. **Vocabulary analysis**: AI identifies vocabulary items in the text; map against the user's known set (F01 + F06 mastery) to produce coverage % and the new-items list.
  2. **Grammar analysis**: AI detects grammar patterns; map each against the grammar taxonomy (F02) and the user's completed modules (F07) to classify covered / ahead / not-in-curriculum.
  3. **CEFR level estimate**: AI estimates the text's level.
  4. **Curriculum routing**: rank default modules (F03) that address the identified gaps by impact.
  5. **Readiness estimate**: synthesize "after modules X, Y, Z you'll be equipped for content at this level".
- Persist and return the ContentReport.

### Requirement: Report actions
- **Add unknown vocabulary**: add selected `newVocabularyItems` to the user's pool via F22.
- **Suggested module navigation**: return module ids/refs so the app can route the user.
- **Generate custom module**: hand the pasted text (as context corpus) + the identified gap to F24.

### Requirement: Isolated, callable design
- The analysis is structured so it can be invoked independently of the app UI (positioning for a future external-agent API per idea §3.7.4 / OQ-06). No hard coupling to a UI flow.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Paste a Danish text and see a curriculum gap report | I know what to master to understand/produce content like it (idea US-09) |
| US-02 | See which existing modules cover the gaps | the app routes me through its curriculum (idea US-11) |
| US-03 | Add unknown words from the text to my pool | I act on gaps immediately (idea US-10) |
| US-04 | Generate a custom module when no default covers a gap | I get targeted practice from real content |

---

## 4. Constraints and Assumptions

- **Constraint** — Manual text paste only in v2.0; any length, any register.
- **Constraint** — AI calls are CEFR-aware (anchored to the user's current level).
- **Assumption** — Minimum ~50 words for a reliable CEFR estimate (idea OQ-07); shorter inputs still analyzed but flagged as less reliable.
- **Constraint** — Texts far above the user's level are still routed (show the gap as a destination map) (idea OQ-05).
- **Assumption** — This analysis AI call is acceptable as an explicit, user-initiated request (not a live session call).

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Minimum text length enforcement? | Idea OQ-07 suggests ≥50 words; warn vs. block |
| OQ-02 | Expose an external agent API now? | Idea OQ-06: design isolated in v2, expose in v3 |
| OQ-03 | How are new vocabulary items represented before being added — transient or pre-stored? | Likely transient candidates until the user chooses to add (F22) |
| OQ-04 | Impact ranking criteria for module routing | e.g. number of gap items each module covers |
