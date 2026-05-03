# Tome Language API

This microservice provides all the logic to manage Tome Language Learning capabilities. 

Resources: 
* [Tome](https://github.com/nicolasances/tome) - The app this microservice is attached to and made for. You can find the description of the concept behind Language Learning in Tome.

---

## Index

### Specs
| Document | Description |
|----------|-------------|
| [Vocabulary Management](docs/specs/vocabulary-management.md) | CRUD API for managing word-translation pairs per target language (e.g. Danish). |
| [Practice Sessions](docs/specs/practice-sessions.md) | Generic session lifecycle API (start, resume, submit answers, complete) with probabilistic word selection based on per-user failure ratios. |
| [Session Stats](docs/specs/session-stats.md) | Stats endpoints returning per-day completed session counts: ISO week view and rolling N-day window. |