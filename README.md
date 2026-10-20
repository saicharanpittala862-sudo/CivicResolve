# CivicResolve

Online grievance redressal. Citizens file and track concerns **without an account**; departments work them through an audited workflow with statutory deadlines; administrators see performance and manage the catalog.

**Stack:** React 19 · Vite · Tailwind v4 · wouter · TanStack Query · Express · tRPC · Drizzle ORM · SQLite · Vitest · Docker.

## What it does

- **Citizens:** 4-step filing wizard (service, concern, evidence, review) with smart routing suggestions and duplicate warnings. You get a tracking number (`GRV-2026-00001`) and a private access code. Track by number, add evidence, reopen a resolved case, and rate the outcome.
- **Public ledger:** a register of recent cases with no names, contacts or street addresses.
- **Officers:** Kanban or list queue for their department, case page with legal next steps, resolution notes, internal or public progress notes, evidence viewing.
- **Admins:** analytics (caseload, status mix, top issues, officer workload), full case triage with assignment and pagination, departments and SLA hours, categories, officers, users.
- **Automatic escalation:** open cases past their department's deadline are raised to critical and flagged, every 15 minutes.

## Run locally

    npm install
    DEMO_MODE=true npm run seed      # catalog, demo staff, 12 sample cases
    npm run dev                      # API on :3000
    npm run dev:client               # UI on :5173 (proxies /api)

Demo sign-ins appear as one-click chips on `/staff/login` when `DEMO_MODE=true`.
Production build: `npm run build && npm start`.

## Test

    npm test            # 30 tests: workflow, routing, storage, API, privacy, HTTP security, demo data
    npm run typecheck

## Docker and deployment

See `docs/DEPLOYMENT.md`. Design notes: `docs/ARCHITECTURE.md`. Security notes and known limits: `docs/SECURITY.md`.

## Routes

Public: `/`, `/track`, `/track/:trackingNumber`, `/board`, `/cases/new`, `/staff/login`.
Staff: `/manage`, `/officer/cases/:trackingNumber`. Admin: `/admin`, `/admin/cases`, `/admin/departments`, `/admin/categories`, `/admin/officers`, `/admin/users`.

## Not built yet

Email or SMS notifications, CSV export, bulk actions, a third "under review" Kanban column, password reset and MFA, virus scanning of uploads, PostgreSQL option, a trained routing model.
