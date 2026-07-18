---
name: KPI Dashboard module
description: Architecture and key files for the KPI Dashboard module at /kpi-dashboard in OptimDZ.
---

## Routes
- `/kpi-dashboard` → `KpiDashboardHome` (landing page, same mini-dashboard pattern as Project Feasibility)
- `/kpi-dashboard/tracking` → `ManualKpiTracking` (sector templates, period form, SVG charts, report)
- `/kpi-dashboard/connectors` — coming soon (no route yet, card shown on home)

## Key files (all under `artifacts/optimdz/src/`)
- `lib/kpiTrackingAlgorithm.ts` — pure computation: `computeKpiTracking()`, types, formatters, chart colors
- `lib/generateKpiPDF.ts` — 4-page jsPDF+html2canvas PDF export
- `components/KpiDashboardLayout.tsx` — navbar/layout wrapper (same pattern as ProjectFeasibilityLayout)
- `pages/kpi-dashboard/KpiDashboardHome.tsx` — landing page (2 planned / 1 available stats)
- `pages/kpi-dashboard/ManualKpiTracking.tsx` — main tool: 5 sector templates, dynamic period form, 4 SVG charts
- `pages/kpi-dashboard/KpiTrackingReport.tsx` — summary cards, alerts, analysis, suggestions, PDF/save

## Wiring
- `App.tsx`: `location.startsWith("/kpi-dashboard")` branch wraps routes in `<KpiDashboardLayout>`
- `PlatformHome.tsx`: `id: "kpi"` entry is `active: true`, `href: "/kpi-dashboard"`, badge "Disponible"
- Platform stat "Modules disponibles" = 5 (updated from 4)

## Known fix
`KpiTrackingReport.tsx` line 136/140 had stray backticks in template-literal concatenation ("`".`\`" instead of `"."` + comma). Fixed — watch for this pattern if copy-pasting similar bilingual string blocks.

**Why:** Arabic strings containing backticks or concatenation across lines can cause unterminated template literal parse errors if the quote/backtick mix-up occurs.
