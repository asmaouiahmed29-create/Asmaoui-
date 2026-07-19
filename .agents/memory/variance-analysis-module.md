---
name: Variance Analysis module
description: Full PERT/CPM-pattern template at /variance-analysis — sector selection, multi-row table, compute, report, save, PDF
---

## Route & Layout
- Route: `/variance-analysis` → `VarianceAnalysis` (default export) wrapped in `VarianceLayout`
- Layout: `src/components/VarianceLayout.tsx` — navbar with Scale icon, portal breadcrumb, language toggle

## Files
- `src/pages/variance-analysis/VarianceAnalysis.tsx` — main page (sector select + form + solve)
- `src/pages/variance-analysis/VarianceAnalysisReport.tsx` — results component (table + analysis + recommendations + save + PDF)
- `src/lib/generateVariancePDF.ts` — 4-page PDF generator (cover → results table → analysis → stamp)
- `src/components/VariancePDFExportDialog.tsx` — PDF export dialog with manager/institution fields

## Sector templates (4 + custom)
| Sector | Objective | Elements |
|---|---|---|
| Commerce | revenue | 3 products (Électroménager, Textile, Accessoires) |
| Industrie | materials | 4 materials (Acier, Plastique, Carton, Peinture) |
| Agriculture | materials | 4 inputs (Fertilisants, Semences, Phytosanitaires, Eau) |
| Services | labor | 4 roles (Développeurs, Testeurs, Chef projet, Consultants) |

## 3 Objectives
- `revenue`: Price variance = (Actual − Std) × Actual Qty · favorable when **positive**
- `materials`: Price variance = (Actual − Std) × Actual Qty · favorable when **negative**
- `labor`: Rate variance = (Actual − Std) × Actual Hours · favorable when **negative**

**How to apply:** Objective drives column labels, formula footnote, favorable/unfavorable coloring, and recommendations.

## Save pattern
POST `/api/problems` with `{ name, sector, objectiveType:"minimize", status:"optimal", optimalValue: totals.totalVariance, problemData: { objective, rows }, result: { rows, totals, dominantFactor } }`

## PDF pattern (generateVariancePDF.ts)
Same html2canvas + jsPDF pattern as generateKpiPDF.ts. 4 pages: cover → results table + bar chart → analysis + recommendations → digital stamp.
