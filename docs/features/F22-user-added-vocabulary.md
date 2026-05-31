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
| Collected pool | The per-user accumulation of added words; in v2.0 stored but not practiced |

### 2.2. Requirements

#### 2.2.2. Endpoints

- `POST /vocabularyItems` — reuses the F01 endpoint with `source: "user_added"` and `addedByUserId` set. Input: Danish word + English translation (and optionally a type; otherwise defaults to "noun"). Dedup against `(danish, type, context)` to avoid duplicates.
- `GET /users/:userId/addedVocabulary` — return the vocabulary items added by the user (filtered by `source = user_added` and `addedByUserId = userId`).

#### 2.2.4. Business Logic

- Items with `source = user_added` must not be selected by any session or test (F08/F10/F11/F21) and must not be referenced by modules in v2.0. The selection engine (F08) must exclude them from the exercise pool.
- The Analyze Content "add unknown vocabulary" action (F23) writes through this feature's `POST /vocabularyItems` endpoint.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Submit a user-added vocabulary item with a Danish word and translation | the word is captured in the user's collected pool for future use |
| CS-02 | List the vocabulary items a user has added | the app can display the user's personal collected-words list |

---

## 4. Constraints and Assumptions

- **Constraint** — Stored but not practiced in v2.0.
- **Constraint** — No AI involvement for user-added items.
- **Assumption** — The Analyze Content "add unknown vocabulary" action (F23) writes through this feature's endpoint.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Should the word's own `cefrLevel` be captured/estimated, even though it doesn't gate anything? | Idea §9: descriptive metadata only; leave nullable |
| OQ-02 | Are added words global VocabularyItems or per-user only? | They live in the catalog with source=user_added + addedByUserId; ensure they don't pollute curriculum queries |
