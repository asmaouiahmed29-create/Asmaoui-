# OptimDZ

Bilingual (Arabic/French) full-stack web app for Algerian business managers covering Operations Research modules: Transportation Problem (Stages 1-3) and Simplex (full).

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
- Frontend: React + Vite + Tailwind + wouter

## Where things live

- `artifacts/optimdz/src/lib/transportAlgorithms.ts` — NWC, LCM (Coût Min), VAM algorithms + `BalancedMatrix` type
- `artifacts/optimdz/src/lib/modiAlgorithm.ts` — Full MODI optimization: degeneracy fix, BFS loop finding, u/v potentials, θ transfer
- `artifacts/optimdz/src/lib/TransportHistoryContext.tsx` — localStorage transport history (key: `optimdz_transport_problems`)
- `artifacts/optimdz/src/lib/generateTransportPDF.ts` — jsPDF + html2canvas PDF generator (4 pages, matches Simplex branding)
- `artifacts/optimdz/src/pages/transportation/` — Home, Solve (Stage 1), Solution (Stage 2), Optimize (Stage 3)
- DB schema source-of-truth: `lib/db/src/schema.ts`
- API contracts: `lib/api-spec/openapi.yaml`

## Architecture decisions

- **Transport saves use localStorage, not PostgreSQL** — key `optimdz_transport_problems`; Simplex problems use the DB via API hooks. Transport sessions are ephemeral/local only.
- **BASE_PATH routing** — wouter reads `import.meta.env.BASE_PATH`; all internal links must be root-relative (wouter prepends base automatically).
- **TransportHistoryProvider wraps all `/transport` routes** — in App.tsx, the provider lives outside TransportProvider so history context is always available.
- **MODI degeneracy** — handled by union-find ε-perturbation; ε cells shown as italic "ε" in the tableau with a warning badge.
- **Pre-existing TS errors** in `KPIDashboard.tsx`, `SensitivityReport.tsx`, `ScenarioCompare.tsx`, `Solve.tsx` — do NOT fix; they predate the transport module.

## Product

- **Transportation Problem module (3 stages):** Stage 1 = problem setup, Stage 2 = NWC/LCM/VAM step-by-step tableau, Stage 3 = MODI optimization with Stepping Stone view, degeneracy handling, sensitivity analysis, history save, PDF export.
- **Simplex module:** Full phase-I / phase-II solver with sensitivity analysis, scenario comparison, KPI dashboard.
- **4 built-in sectors** (Trade/Industry/Services/Energy) with real Algerian company templates at each stage.

## User preferences

- Bilingual FR/AR with RTL support; `t(fr, ar)` helper from `useLanguage()`.
- Match Simplex branding: `primary=#004d40`, `accent=#f4a261`, `bg=#fbf8f1`.
- Stage bar always visible at top of transport pages.
- Math notation: Δ for opportunity costs, θ for transfer quantity, ε for degeneracy perturbation.

## Gotchas

- Do NOT run `pnpm dev` at workspace root — use workflow restart instead.
- After changing `lib/*` packages, run `pnpm run typecheck:libs` before leaf artifact checks.
- `BalancedMatrix` must be imported from `transportAlgorithms` (not inlined) — the `demand` field on destinations is needed by Optimize.tsx.
- Transport templates from `Solve.tsx` are imported by `Optimize.tsx` as URL fallback when no TransportContext data is set.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
