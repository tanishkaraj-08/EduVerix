# FDR Sentinel

FDR Sentinel streamlines institutional security-deposit and fixed-deposit receipt submissions, officer review, maturity monitoring, renewal and release workflows.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/fdr-sentinel` — React web application and role-aware workflows
- `artifacts/api-server/src/routes` — API handlers and server-side demo-role checks
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema` — PostgreSQL tables for institutions, FDRs, evidence metadata, audit events, demo users and settings
- `artifacts/api-server/src/lib/seed-demo-data.ts` — fictional demo records

## Architecture decisions

- Demo roles use signed cookies and server-side role checks so judges can explore each workflow without an external sign-in.
- Evidence submissions are simulated metadata only; the selected file's bytes are not stored or presented as proof of bank authenticity.
- Dashboard metrics and charts are derived from PostgreSQL records and refresh after workflow changes.

## Product

The prototype provides institution registration, FDR submission and search, officer review decisions, correction requests, renewal and release actions, maturity alerts, audit history, supervisor workload monitoring, and administrator demo-role/settings controls.

**Product identity:** Intelligent Security Deposit Assurance  
**Problem statement:** SIH 2026 — PS 26265  
**Disclaimer:** “Hackathon Prototype — Not an Official AICTE Service.”

## User preferences

- Use an original government-inspired interface with deep navy, white, restrained saffron and green; do not use official AICTE branding or government emblems.
- Keep all demo information clearly identified as fictional prototype data.

## Gotchas

- Demo role selection is intentionally open for judge exploration and is not production identity verification.
- Evidence metadata is persisted, but file bytes are not. Do not describe simulated evidence as a stored document or as bank-authenticated.
- Production uploads require real authentication, private object storage, and ownership-based access controls.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
