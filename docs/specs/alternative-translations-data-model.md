# Spec: Alternative Translations — Data Model & Payload Extensions

GitHub issue: https://github.com/nicolasances/tome-ms-language/issues/29

## Objective

Extend the `Word` and `Sentence` data models to carry a list of **community-shared alternative translations** — additional phrasings that are equally valid answers for a given word or sentence. Each alternative is an object with a UUID and a translation string, so it can be individually identified and later removed by ID.

Once the field exists on the model, it must be propagated through every response that returns word or sentence data:
- The paginated **with-stats** list endpoints (used by the vocabulary and sentences browsing pages)
- The **session start** payload (used by both vocabulary and sentence practice sessions, so the client can check alternatives at match-time without an extra round-trip)

This task is **purely additive** — no existing behaviour changes. Documents that pre-date this change simply resolve `alternativeTranslations` to `[]`.

---

## Core Logic

### Data Model Changes

#### `Word` model (`src/model/Word.ts`)

Add field:

| Field                   | Type                                   | Description                                                  |
|-------------------------|----------------------------------------|--------------------------------------------------------------|
| `alternativeTranslations` | `Array<{ id: string; translation: string }>` | Community-accepted alternative translations. Defaults to `[]` when absent. |

- `id` is a UUID (generated at creation time by the CRUD endpoint, not here).
- `translation` is stored lowercase.
- `fromBSON`: reads `data.alternativeTranslations ?? []`
- `toBSON`: only writes the field if the array is non-empty (keeps existing documents clean)

#### `Sentence` model (`src/model/Sentence.ts`)

Identical change — same field, same rules.

---

### Store Changes

#### `VocabularyStore.findByLanguageWithStats`

The MongoDB `$project` stage must include `alternativeTranslations`:

```js
{
  $project: {
    _id: 1,
    english: 1,
    translation: 1,
    createdAt: 1,
    knowledgeSource: 1,
    alternativeTranslations: { $ifNull: ["$alternativeTranslations", []] },
    stats: { ... }   // unchanged
  }
}
```

The `WordWithStats` interface gains `alternativeTranslations: Array<{ id: string; translation: string }>`.

#### `SentenceStore.findByLanguageWithStats`

Same change to the `$project` stage and the `SentenceWithStats` interface.

---

### Session Payload Changes (`StartSession`)

#### Vocabulary branch

Each item in `payload.words` gains `alternativeTranslations`:

```ts
words: selectedWords.map(w => ({
  wordId: w.id!,
  english: w.english,
  translation: w.translation,
  alternativeTranslations: w.alternativeTranslations,   // ← new
}))
```

`StartSessionResponse` vocabulary payload type updated accordingly.

#### Sentences branch

Each item in `payload.sentences` gains `alternativeTranslations`:

```ts
sentences: selectedSentences.map(s => ({
  sentenceId: s.id!,
  sentence: s.sentence,
  translation: s.translation,
  alternativeTranslations: s.alternativeTranslations,   // ← new
}))
```

`StartSessionResponse` sentences payload type updated accordingly.

---

### Backward Compatibility

- Existing documents in MongoDB that have no `alternativeTranslations` field resolve to `[]` via `$ifNull` in the aggregation pipeline and `?? []` in `fromBSON`.
- No migration script needed.

---

## Out of Scope

- CRUD endpoints for adding/removing alternative translations (covered in issue #30).
- Single-item GET endpoints for the detail pages (covered in issue #31).
- Any change to the `GetVocabulary` (non-paginated) endpoint — it is used only for internal/admin tooling and does not need to carry alternatives at this stage.
- Validation of the `alternativeTranslations` field on insert — that is enforced by the add-alternative endpoint (issue #30).
