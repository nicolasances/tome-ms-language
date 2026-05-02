# Session Stats — Feature Spec

## Overview

This spec defines the **session stats** endpoints in `tome-ms-language`. These endpoints allow clients to query the number of completed practice sessions per day, aggregated over a given time window.

Two variants are provided, designed to cover different UI use cases:

| Variant | Endpoint | Description |
|---------|----------|-------------|
| **ISO week** | `GET /sessions/stats/weekly` | Returns one count per day for a given ISO Mon–Sun week |
| **Rolling window** | `GET /sessions/stats/rolling` | Returns one count per day for the last N calendar days (inclusive today) |

Both endpoints:
- Are scoped to the authenticated user (via `UserContext`)
- Count **all completed sessions** regardless of `language` or `practiceType`
- Return zero-count entries for days with no completed sessions (so the client always receives the full requested range)

---

## Endpoints

### `GET /sessions/stats/weekly`

Returns the count of completed sessions for each day of a given ISO week (Mon–Sun).

#### Query Parameters

| Parameter | Type     | Required | Description |
|-----------|----------|----------|-------------|
| `from`    | `string` | Yes      | The **Monday** of the week to query, in `YYYYMMDD` format (e.g. `20260428`) |

#### Response

```json
{
  "days": [
    { "date": "20260428", "count": 2 },
    { "date": "20260429", "count": 0 },
    { "date": "20260430", "count": 1 },
    { "date": "20260501", "count": 0 },
    { "date": "20260502", "count": 3 },
    { "date": "20260503", "count": 0 },
    { "date": "20260504", "count": 0 }
  ]
}
```

- Always returns **exactly 7 entries**, one per day Mon through Sun.
- `date` is in `YYYYMMDD` format.
- `count` is `0` for days with no completed sessions.

#### Validation

- `from` is required. If missing or invalid, return `400 Bad Request`.
- `from` must represent a Monday. If it does not, return `400 Bad Request` with message `"'from' must be a Monday (YYYYMMDD)"`.

---

### `GET /sessions/stats/rolling`

Returns the count of completed sessions for each of the last N calendar days, inclusive of today.

#### Query Parameters

| Parameter | Type     | Required | Default | Description |
|-----------|----------|----------|---------|-------------|
| `days`    | `number` | No       | `7`     | Number of days to include (must be between 1 and 365) |

#### Response

Same shape as the weekly endpoint:

```json
{
  "days": [
    { "date": "20260426", "count": 1 },
    { "date": "20260427", "count": 0 },
    { "date": "20260428", "count": 2 },
    { "date": "20260429", "count": 0 },
    { "date": "20260430", "count": 1 },
    { "date": "20260501", "count": 0 },
    { "date": "20260502", "count": 3 }
  ]
}
```

- Returns **exactly `days` entries**, ordered chronologically oldest → newest.
- The last entry is always **today** (server-side date, UTC).
- `count` is `0` for days with no completed sessions.

#### Validation

- If `days` is provided, it must be a positive integer between 1 and 365. Otherwise return `400 Bad Request`.

---

## Data Source

Both endpoints query the `sessions` collection (see [Practice Sessions spec](practice-sessions.md) for the full schema).

Relevant fields:

| Field         | Used for |
|---------------|----------|
| `userId`      | Scoping to the authenticated user |
| `status`      | Filter to `"completed"` sessions only |
| `completedAt` | Grouping by date (ISO 8601 string, e.g. `"2026-04-28T14:30:00.000Z"`) |

The aggregation extracts the date portion of `completedAt` and groups by it to produce per-day counts. Sessions with `status != "completed"` or `completedAt == null` are excluded.

---

## Implementation

### Delegates

| File | Route |
|------|-------|
| `src/dlg/session/GetWeeklySessionStats.ts` | `GET /sessions/stats/weekly` |
| `src/dlg/session/GetRollingSessionStats.ts` | `GET /sessions/stats/rolling` |

Both delegates follow the standard `TotoDelegate<Req, Res>` pattern:
- `parseRequest(req)` validates query parameters and throws `ValidationError` for invalid input.
- `do(req, userContext)` calls `SessionsStore` and fills in zero-count entries for missing days before returning.

### Store

Add a new method to `SessionsStore`:

```typescript
async countCompletedByDateRange({ userId, from, to }: {
    userId: string;
    from: Date;
    to: Date;
}): Promise<Array<{ date: string; count: number }>>
```

- Filters: `userId`, `status: "completed"`, `completedAt >= from` and `completedAt <= to` (ISO string comparison or `$gte`/`$lte` after converting to Date).
- Groups by the `YYYYMMDD` portion of `completedAt`.
- Returns an array of `{ date: string; count: number }` objects — **only entries where count > 0**. Zero-filling for missing days is done in the delegate.

#### MongoDB Aggregation (reference)

```json
[
  {
    "$match": {
      "userId": "<userId>",
      "status": "completed",
      "completedAt": { "$gte": "<from ISO>", "$lte": "<to ISO>" }
    }
  },
  {
    "$addFields": {
      "dateStr": {
        "$dateToString": { "format": "%Y%m%d", "date": { "$dateFromString": { "dateString": "$completedAt" } } }
      }
    }
  },
  {
    "$group": {
      "_id": "$dateStr",
      "count": { "$sum": 1 }
    }
  }
]
```

Result documents: `{ _id: "20260428", count: 2 }`.

### Zero-filling (delegate responsibility)

After calling the store, each delegate generates the full set of expected dates and merges the store results:

```
expectedDates = [<date 1>, <date 2>, ..., <date N>]  // generated in the delegate
storeCounts   = Map<date, count>                       // built from store results
result        = expectedDates.map(d => ({ date: d, count: storeCounts.get(d) ?? 0 }))
```

### Route registration (`src/index.ts`)

```typescript
{ method: 'GET', path: '/sessions/stats/weekly',  delegate: GetWeeklySessionStats },
{ method: 'GET', path: '/sessions/stats/rolling', delegate: GetRollingSessionStats },
```

---

## Date Handling Notes

- `completedAt` is stored as an ISO 8601 string (e.g. `"2026-04-28T14:30:00.000Z"`), in UTC.
- All date arithmetic in the delegates uses UTC to avoid timezone-driven miscounts.
- The `from` parameter for the weekly endpoint is parsed as `YYYYMMDD` at UTC midnight (`T00:00:00.000Z`); the corresponding `to` is `from + 6 days` at `T23:59:59.999Z`.
- The rolling endpoint computes `to` as today at `T23:59:59.999Z` UTC and `from` as `today - (days - 1)` at `T00:00:00.000Z` UTC.
