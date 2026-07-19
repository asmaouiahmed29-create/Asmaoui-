---
name: Variance Analysis module
description: Full details on the Variance Analysis module at /variance-analysis in OptimDZ
---

## Location
`artifacts/optimdz/src/pages/variance-analysis/`
- `VarianceAnalysis.tsx` — main form + sector selection
- `VarianceAnalysisReport.tsx` — results, analysis, suggestions, save, PDF

## Objectives (4 modes)
- `"revenue"` — Écarts sur Revenus (favorable when positive)
- `"materials"` — Écarts sur Matières (favorable when negative)
- `"labor"` — Écarts sur Main-d'œuvre (favorable when negative)
- `"overhead"` — Écarts sur Charges Indirectes (favorable when negative) — **added**

## Sector templates (5)
- Commerce → revenue
- Industrie → materials
- Agriculture → materials
- Services → labor
- **Énergie → overhead** (Complexe Industriel Annaba, 4 cost centers)

## Overhead mode specifics
**Why:** 3-way additive variance decomposition (classic French contrôle de gestion):
- `VarianceRow.extra1` = Coût standard unitaire d'imputation (5th input column)
- `priceVariance` = Écart/Budget = CR − CB×(Nr/Nh)
- `var3` = Écart/Activité = CB×(Nr/Nh) − Nr×CS
- `qtyVariance` = Écart/Rendement = (Nr−Nh)×CS
- Total = priceVariance + var3 + qtyVariance = CR − Nh×CS ✓ (always additive)

**dominantFactor** for overhead: 4-way ("price" | "qty" | "var3" | "equal")  
(PDF export maps "var3" → "equal" since VariancePDFOptions only has "price"|"qty"|"equal")

## Type extensions (generateVariancePDF.ts)
- `VarianceObjective`: now includes "overhead"
- `VarianceRowResult`: optional `extra1?` and `var3?` fields
- `VarianceTotals`: optional `var3?` field
- `objLabels()`: overhead entry with `var3Fr/var3Ar` labels

## PDF
`artifacts/optimdz/src/lib/generateVariancePDF.ts` — buildResultsPage handles overhead with 10-column table (vs 8-column for others).

## Save pattern
POST /api/problems — same as other modes; `objective` in problemData distinguishes the 4 modes.
