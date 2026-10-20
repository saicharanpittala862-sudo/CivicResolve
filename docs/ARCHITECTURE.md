# Architecture

One Node process serves the React single-page app and a typed tRPC API. Data lives in SQLite (WAL mode); evidence files live on local disk behind a storage interface.

```
Browser (React 19, wouter, TanStack Query, Tailwind v4, self-hosted fonts)
   │  tRPC over HTTP · HttpOnly session cookie for staff · tracking number + access code for citizens
Express ── helmet CSP · origin check · rate limits
   ├─ /api/trpc         routers.ts   public · portal · officer · admin · auth
   ├─ /api/attachments  storageProxy.ts (staff session OR tracking number + access code)
   ├─ /healthz
   └─ static            dist/public (SPA fallback)
        │
   db.ts (Drizzle + better-sqlite3, transactions)   workflow.ts (FSM)   triage.ts   sla.ts   dto.ts
```

## Who can do what

| Actor | Identity | Can |
|---|---|---|
| Citizen | none. Tracking number `GRV-YYYY-NNNNN` (public) + private access code (shown once) | File, view the public case, and with the access code: add evidence, rate, reopen |
| Officer | account, linked to one department | See and work cases in their department only |
| Admin | account | Everything, plus assignment, catalog, officers, analytics |
| System | SLA sweep every 15 minutes | Escalate overdue cases |

## Lifecycle (`server/workflow.ts`)

`submitted → acknowledged → assigned → in_progress → resolved → closed`, with `in_progress → escalated` (system only), `escalated → in_progress`, and `resolved → reopened → in_progress` (citizen reopens). Every transition names who may perform it; anything else is rejected. Resolving requires a note of at least 10 characters.

## Data model

`users`, `departments` (with `sla_hours`), `categories` (belong to a department), `officers` (user ↔ department), `cases`, `timeline_events` (append-only audit, with an `internal` flag), `attachments`. Case numbers are allocated inside a transaction with a unique `(year, seq)` index and retry.

## Key decisions

| Decision | Why | Trade-off |
|---|---|---|
| Modular monolith | One deployable, simple to run and test | Scaling out needs the data layer moved off SQLite |
| SQLite + WAL | No database server to run, transactional | Single node, single writer |
| Citizens have no accounts | Removes the biggest barrier to filing | Ownership is proven by a secret code instead of a login |
| Access code on top of a sequential tracking number | Tracking numbers are guessable, so anything that changes a case needs the secret half | Citizens must keep the code |
| Optimistic status update | Two staff cannot silently overwrite each other | The loser sees a conflict message |
| Audit row in the same transaction as the change | History cannot disagree with state | Slightly larger writes |
| Rule-based routing behind one function | Works offline, explainable, replaceable by a model | Less accurate than a trained model |
| Self-hosted fonts and custom SVG charts | Strict CSP with no third-party requests | Slightly larger bundle |

## Capacity (rough, single node)

Peak load of 10,000 filings per hour is under 3 per second, far inside what SQLite in WAL mode handles. The first real limits are attachment bandwidth and single-node availability, not the database.
