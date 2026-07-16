---
name: PERT/CPM Module — Stage 3
description: Architecture decisions and non-obvious constraints for the OptimDZ PERT/CPM module.
---

## Stage 3 implemented (July 2026)

All three stages of PERT/CPM are complete on a single scrolling page at `/pert-cpm`.

### Key file locations
- Algorithm: `artifacts/optimdz/src/lib/pertCpmAlgorithm.ts`
- Main page: `artifacts/optimdz/src/pages/pert-cpm/PertCpm.tsx` (~1000 lines)
- Network diagram: `artifacts/optimdz/src/pages/pert-cpm/NetworkDiagram.tsx`
- Crashing section component: `artifacts/optimdz/src/pages/pert-cpm/CrashingSection.tsx`
- Analysis/report component: `artifacts/optimdz/src/pages/pert-cpm/PertAnalysisReport.tsx`
- PDF generator: `artifacts/optimdz/src/lib/generatePertPDFReport.ts`
- PDF dialog: `artifacts/optimdz/src/components/PertPDFExportDialog.tsx`

### Crashing algorithm
- `computeCrashing(activities, targetDuration, dailyOverhead?)` in pertCpmAlgorithm.ts
- Crashes 1 unit per iteration; picks cheapest shared critical activity; handles parallel critical paths via coverage set
- Activities must have `normalCost`, `crashDuration`, `crashCost` fields
- The Industrie sector template is the only one with crashing data pre-populated (realistic DZD amounts, 15M DA total, 32-week project)
- `CrashResult` has `steps[]`, `minCostPoint?` (optimal when overhead provided), `cannotCrashFurther`

### Crashing UI pattern
- `showCrashing` toggle in `PertCpm.tsx` shows/hides 3 extra columns in activity table
- Toggle banner appears only when `activities.some(a => a.normalCost !== undefined)`
- `CrashingSection.tsx` receives the already-computed CPM result + activities, runs crashing client-side
- SVG chart built manually (no recharts dependency needed)

### Save API
- Direct `fetch("/api-server/api/problems", { method: "POST" })` with `objectiveType: "minimize"`, `status: "optimal"`, `optimalValue: projectDuration`
- **Why:** `useSaveProblem` from `@workspace/api-client-react` is typed for Simplex data; direct fetch avoids type fights
- The vite.config.ts has NO proxy — API server accessible at `/api-server/` via Replit path routing

### PDF pattern
- `generatePertPDFReport.ts` follows exact same `pageShell`/`html2canvas`/`jsPDF` pattern as `generatePDFReport.ts`
- Pages: Cover → Activity analysis → PERT probabilistic (if PERT mode) → Crashing (if crash ran) → Analysis & Stamp
- Brand tokens: `primary: #004d40`, `accent: #f4a261`, `bg: #fbf8f1`

### Pre-existing TS errors (DO NOT touch these files)
- `Results.tsx`, `ScenarioCompare.tsx`, `Solve.tsx`, `KPIDashboard.tsx`, `ManagerialRecommendations.tsx`, `WhatIfPanel.tsx`, `SensitivityReport.tsx`, `OptimAssistant.tsx`, `PDFExportDialog.tsx`

### ActivityInput interface (PertCpm.tsx)
Optional crashing fields: `normalCost?: number`, `crashDuration?: number`, `crashCost?: number`
The `updateField` generic accepts `undefined` values since the fields are `?: number` (typed as `number | undefined`).
