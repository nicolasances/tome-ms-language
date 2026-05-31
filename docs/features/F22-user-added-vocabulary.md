# F22 — User-Added Vocabulary

## 1. Purpose & Scope

A user can manually add a Danish word they encountered (e.g. while reading), providing the Danish word and its English translation. The item is stored as a VocabularyItem with `source = user_added` and `addedByUserId` set — no AI involvement, no generated alternatives or context. **In v2.0 these words are stored but not used**: they are not referenced by any module and never appear in exercises. The capability exists only to capture the words; bringing them into the curriculum is deferred (idea §9).

**Out of scope**:
- Practicing user-added words / generating exercises for them (deferred to a future version)
- AI generation of any kind for these items
- A standalone review surface (none in v2.0)

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| User-added word | A VocabularyItem with `source = user_added`, captured manually by a user |
| Collected pool | The (future) per-user accumulation of added words; in v2.0 just a stored set |

### 2.2. Requirements

### Requirement: Add-word endpoint
- Input: Danish word + English translation (and optionally a user-chosen type/tags; otherwise minimal).
- Store as a VocabularyItem (F01) with `source = user_added`, `addedByUserId = current user`, no AI-generated context/alternatives.
- Dedup against the user's existing added words to avoid duplicates.

### Requirement: List user's added words endpoint
- Return the words a user has added (so the app can show "collected words"), even though they aren't practiced.

### Requirement: No exercise linkage
- These items must not be selected by any session/test (F08/F10/F11/F21) and are not referenced by modules in v2.0.

---

## 3. Key User Stories

| # | As a user, I want to… | So that… |
|---|----------------------|----------|
| US-01 | Add a Danish word I encountered with its translation | it's captured for future learning (idea §3.2.3) |
| US-02 | Add unknown vocabulary from a pasted text to my pool | I can act on gaps immediately (idea US-10) |

---

## 4. Constraints and Assumptions

- **Constraint** — Stored but not practiced in v2.0.
- **Constraint** — No AI involvement for user-added items.
- **Assumption** — The Analyze Content "add unknown vocabulary" action (F23) writes through this feature.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Should the word's own `cefrLevel` be captured/estimated, even though it doesn't gate anything? | Idea §9: descriptive metadata only |
| OQ-02 | Are added words global VocabularyItems or per-user only? | They live in the catalog with source=user_added + addedByUserId; ensure they don't pollute curriculum queries |
