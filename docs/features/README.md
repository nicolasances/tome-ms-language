# Tome Language Learning — Feature Breakdown

This folder breaks down the [Language Learning idea](../../../tome/docs/specs/language-learning/idea.md) (v2.0) into **self-contained, independently deployable and testable features** for the `tome-ms-language` **backend microservice**.

> **Redesign note.** The idea is the master. This breakdown assumes a full redesign of the microservice. The current vocabulary / sentence / generic-session code (`PostWord`, `PostSentence`, `StartSession`, etc.) is **superseded** by these features and will largely be removed. Do not try to fit the idea into the existing model.

## Scope boundary

Only backend capabilities are described here. UI-only concerns from the idea — Home Dashboard, level visibility prominence, mobile-first exercise rendering, navigation — belong to the `tome` app and are **out of scope** for this microservice. Where the idea mentions them, the backend feature only exposes the data the app needs.

## Cross-cutting constraints (apply to every feature)

- **Danish only** for v2.0; keep models language-agnostic where cheap (e.g. don't hardcode "danish"/"english" semantics into shared logic more than necessary).
- **No live AI in sessions.** All AI generation runs at seeding/creation time or in async background jobs. The only exceptions are explicit, on-demand AI touchpoints: *explain my mistake*, *translation answer verification*, *vocabulary hint*.
- **AI is always CEFR-aware.** Every AI call must receive the user's (or module's) CEFR level so output is pitched correctly.
- **Mastery is global per item.** A vocabulary item or grammar concept has a single mastery score per user, independent of which module referenced it.
- AI is treated as an external capability accessed through an API client; every AI-dependent feature must be testable with the AI client mocked.

## Feature Groups

Features are grouped by layer. Lower groups depend on higher ones.

### Group A — Catalog foundations (seeded reference data)
| # | Feature | Primary model |
|---|---------|---------------|
| F01 | [Vocabulary Catalog](./F01-vocabulary-catalog.md) | VocabularyItem |
| F02 | [Grammar Concept Catalog](./F02-grammar-concept-catalog.md) | GrammarConcept |
| F03 | [Module Catalog](./F03-module-catalog.md) | Module |
| F04 | [Exercise Bank](./F04-exercise-bank.md) | Exercise, ExerciseBank |

### Group B — User state & mastery
| # | Feature | Primary model |
|---|---------|---------------|
| F05 | [User Profile & CEFR Level](./F05-user-profile-and-cefr-level.md) | User |
| F06 | [Mastery & Progress Tracking (SRS)](./F06-mastery-and-progress-tracking.md) | UserVocabularyProgress, UserGrammarConceptProgress |
| F07 | [User Module Progress](./F07-user-module-progress.md) | UserModuleProgress |

### Group C — Exercise selection engine
| # | Feature | Primary model |
|---|---------|---------------|
| F08 | [Mastery-Aware Exercise Selection](./F08-mastery-aware-exercise-selection.md) | — (algorithm) |

### Group D — Module execution flow
| # | Feature | Primary model |
|---|---------|---------------|
| F09 | [Grammar Introduction (Step 1)](./F09-grammar-introduction.md) | — |
| F10 | [Practice Session (Step 2)](./F10-practice-session.md) | PracticeSession |
| F11 | [Module Test (Step 3)](./F11-module-test.md) | ModuleTestAttempt |

### Group E — On-demand AI touchpoints
| # | Feature | Primary model |
|---|---------|---------------|
| F12 | [Explain My Mistake](./F12-explain-my-mistake.md) | — |
| F13 | [Translation Answer Verification](./F13-translation-answer-verification.md) | — |
| F14 | [Vocabulary Hint](./F14-vocabulary-hint.md) | — |

### Group F — AI generation & seeding
| # | Feature | Primary model |
|---|---------|---------------|
| F15 | [AI Vocabulary Set Generation](./F15-ai-vocabulary-generation.md) | — |
| F16 | [AI Grammar Explanation Generation](./F16-ai-grammar-explanation-generation.md) | — |
| F17 | [AI Exercise Bank Generation](./F17-ai-exercise-bank-generation.md) | — |
| F18 | [Default Module Seeding](./F18-default-module-seeding.md) | — (orchestration) |
| F19 | [Exercise Bank Refresh](./F19-exercise-bank-refresh.md) | — (background job) |
| F20 | [Level Test Bank Seeding](./F20-level-test-bank-seeding.md) | LevelTestBank |

### Group G — Level progression
| # | Feature | Primary model |
|---|---------|---------------|
| F21 | [Level Test](./F21-level-test.md) | LevelTestAttempt |

### Group H — User-added vocabulary
| # | Feature | Primary model |
|---|---------|---------------|
| F22 | [User-Added Vocabulary](./F22-user-added-vocabulary.md) | VocabularyItem (source=user_added) |

### Group I — Analyze content & custom modules
| # | Feature | Primary model |
|---|---------|---------------|
| F23 | [Analyze Content](./F23-analyze-content.md) | ContentReport, GrammarPatternResult |
| F24 | [Custom Module Generation](./F24-custom-module-generation.md) | Module (isUserGenerated=true) |

## MVP slice

The smallest end-to-end vertical that proves the concept: **F01 → F02 → F03 → F04 → F05 → F06 → F07 → F08 → F09 → F10 → F11**, seeded by a minimal manual run of **F15/F16/F17/F18** for a single A1 module. Everything else layers on top.
