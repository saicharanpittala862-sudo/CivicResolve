# CivicResolve

<div align="center">

# 🏛️ CivicResolve
### Modern Civic Grievance Redressal, SLA Governance & Telemetry Platform

*A production-hardened, full-stack grievance redressal platform engineered for radical administrative transparency, automated SLA governance, and a friction-free citizen & student experience.*

---

[![Live Demo](https://img.shields.io/badge/Live_Demo-civicresolve--h5bt.onrender.com-00C7B7?style=for-the-badge&logo=render&logoColor=white)](https://civicresolve-h5bt.onrender.com/)
[![React 19](https://img.shields.io/badge/React-19.2-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-5.9_Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.22_Patched-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![tRPC v11](https://img.shields.io/badge/tRPC-v11.8-2596BE?style=for-the-badge&logo=trpc&logoColor=white)](https://trpc.io/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![SQLite WAL](https://img.shields.io/badge/SQLite_3-libSQL_WAL-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Recharts](https://img.shields.io/badge/Recharts-v3.10-22c55e?style=for-the-badge)](https://recharts.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.1-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Tests Passing](https://img.shields.io/badge/Vitest-104%2F104_Passing-10B981?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Docker Ready](https://img.shields.io/badge/Docker-Containerized-2496ED?style=for-the-badge&logo=docker&logoColor=white)](Dockerfile)
[![License MIT](https://img.shields.io/badge/License-MIT-6366F1?style=for-the-badge)](LICENSE)

<br/>

### 🌐 Live Production Deployment
### [https://civicresolve-h5bt.onrender.com/](https://civicresolve-h5bt.onrender.com/)

[Live Demo](#-live-demo--interactive-walkthrough) •
[Executive Summary](#-executive-summary) •
[Visual System Walkthrough](#-visual-system-walkthrough-annotated-architecture-gallery) •
[Core Innovations](#-core-capabilities--problem-solving) •
[System Architecture](#-system-architecture--engineering-design) •
[Workflow & SLA Engine](#-grievance-lifecycle--sla-engine) •
[Security Architecture](#-security-architecture--hardening-specifications) •
[Demo & Viva Guide](#-submission-demo-path--viva-guide) •
[Quick Start](#-quick-start--installation) •
[Docker Deployment](#-docker--containerized-deployment)

</div>

---

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
