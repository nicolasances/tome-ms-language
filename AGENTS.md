# Project Conventions & Coding Standards

This document defines the coding standards and architectural conventions for all microservices in this repository. The reference implementation is [`nicolasances/tome-ms-topics`](https://github.com/nicolasances/tome-ms-topics).

## Coding Standards

- I prefer that class constructors take as argument an object rather than flat parameters. So `constructor({param1, param2}: {param1: string, param2: number, ...})` **rather than** `constructor(param1: string, param2: number)`. 

---

## Source Folder Structure

```
src/
├── index.ts          # Entry point – wires API endpoints and event handlers
├── Config.ts         # Service configuration (extends TotoControllerConfig)
├── dlg/              # Delegates – one class per API operation
├── model/            # Model classes – entity definitions
├── store/            # Store classes – ALL database access lives here
├── evt/
│   ├── Events.ts     # Event type constants
│   ├── handlers/     # Event handler classes
│   └── model/        # Event payload models
├── api/              # Clients for external microservice APIs
└── util/             # Shared utilities
docs/                 # General documentation for the project
└── capabilities/     # Documents that generally describe the core capabilities of the microservice
└── specs/            # Documents that describe detailed functionalities, typically subparts of the capabilities
```

---

## Delegates (`src/dlg/`)

Each API operation has its own file. Delegates extend `TotoDelegate<Req, Res>` from `totoms` and implement two methods:

- **`parseRequest(req)`** – validates and extracts the request body/params into a typed request object. Throw `ValidationError` for invalid input.
- **`do(req, userContext)`** – contains all business logic.

Request and response types are defined as **private interfaces at the bottom** of the same file. They are usually named `<name of the delegate>Request` and `<name of the delegate>Response`.

File naming preferences (not always possible, so only when possible): `{Verb}{Entity}.ts` – e.g. `PostTopic.ts`, `GetTopics.ts`, `DeleteTopic.ts`.

```typescript
// src/dlg/PostTopic.ts
export class PostTopic extends TotoDelegate<PostTopicRequest, PostTopicResponse> {

    async do(req: PostTopicRequest, userContext: UserContext): Promise<PostTopicResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new TopicsStore(db, config);
        const id = await store.saveTopic(new Topic(...));

        return { id };
    }

    parseRequest(req: Request): PostTopicRequest {
        if (!req.body.name) throw new ValidationError(400, "No name provided");
        return { name: req.body.name };
    }
}

interface PostTopicRequest { name: string }
interface PostTopicResponse { id: string }
```

---

## Store Classes (`src/store/`)

**All database access is strictly confined to Store classes. No other file may query or write to the database.**

- One store per logical entity/collection, named `{Entity}Store.ts` – e.g. `TopicsStore.ts`.
- Constructor takes a `Db` instance and the service config.
- Methods always return model objects (using `Model.fromBSON()`) rather than raw BSON documents.

```typescript
// src/store/TopicsStore.ts
export class TopicsStore {

    constructor(db: Db, config: ControllerConfig) { ... }

    async findTopicById(id: string): Promise<Topic | null> {
        const result = await this.db.collection(this.topicsCollection).findOne({ _id: new ObjectId(id) });
        if (!result) return null;
        return Topic.fromBSON(result);
    }

    async saveTopic(topic: Topic): Promise<string> {
        const result = await this.db.collection(this.topicsCollection).insertOne(topic.toBSON());
        return result.insertedId.toString();
    }
}
```

---

## Model Classes (`src/model/`)

One file per entity, named after the entity – e.g. `Topic.ts`.

Every model class must implement:

- **`static fromBSON(data: WithId<any>): Entity`** – converts a raw MongoDB document into a model instance.
- **`toBSON(): any`** – converts the model instance into a plain object suitable for MongoDB storage.

---

## Event Handlers (`src/evt/handlers/`)

Each event type has its own handler file, named `On{EventName}.ts` – e.g. `OnPracticeFinished.ts`.

- Handlers extend `TotoMessageHandler` from `totoms`.
- They declare the `handledMessageType` property to identify which events they process.
- The main method is `onMessage(msg: TotoMessage): Promise<ProcessingResponse>`.
- Business logic follows the same pattern as delegates: use a Store for any DB access.

```typescript
// src/evt/handlers/OnPracticeFinished.ts
export class OnPracticeFinished extends TotoMessageHandler {

    protected handledMessageType: string = 'practiceFinished';

    async onMessage(msg: TotoMessage): Promise<ProcessingResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        await new TopicsStore(db, config).updateTopicLastPractice(...);

        return { status: 'processed', responsePayload: '...' };
    }
}
```

Event type constants are defined in `src/evt/Events.ts` as a plain exported object:

```typescript
export const EVENTS = {
    topicCreated: "topicCreated",
    topicDeleted: "topicDeleted",
}
```

---

## External API Clients (`src/api/`)

When calling another microservice, wrap all HTTP calls in a dedicated client class named `{Service}API.ts` – e.g. `FlashcardsAPI.ts`. No raw HTTP calls outside of these classes.

--- 

## Documentation 
- The README mostly contains a general description of the service and a table of content that links to other relevant documentation in the `docs/` folder. 
- All other documentation is in the `docs/` folder, in the right subfolder, according to the type of document: a Capability description document or a Spec for a feature.