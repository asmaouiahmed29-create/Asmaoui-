---
name: Financial Analysis Module
description: Break-even/CVP analysis module at /financial-analysis — architecture, file locations, and key design decisions.
---

## Files Created
- `src/lib/breakEvenAlgorithm.ts` — pure CVP math: CM, BEP, MoS, DOL, chart points
- `src/lib/generateFinancialPDFReport.ts` — 4-page PDF (cover, CVP, analysis, stamp); same brand tokens as PERT PDF
- `src/components/FinancialLayout.tsx` — navbar + layout shell, same pattern as PertLayout
- `src/pages/financial-analysis/FinancialAnalysis.tsx` — single-scroll page (sector → form → results → chart → report)
- `src/pages/financial-analysis/BreakEvenReport.tsx` — situational analysis, suggestions, managerial report card, save, PDF dialog

## Files Modified
- `src/App.tsx` — added `/financial-analysis` and `/financial-analysis/breakeven` routes with FinancialLayout
- `src/pages/PlatformHome.tsx` — activated "finance" module (was `active: false`), added href, updated description

## Sector Templates (realistic Algerian examples)
- **Commerce**: Boutique vêtements Oran — SP 4500, VC 2200, CF 185000, vol 120, target 100000
- **Industrie**: Atelier meubles Tizi Ouzou — SP 45000, VC 22000, CF 620000, vol 35, target 200000
- **Agriculture**: Huilerie Béjaïa — SP 950, VC 420, CF 480000, vol 1200, target 150000
- **Services**: Cabinet conseil Constantine — SP 85000, VC 28000, CF 340000, vol 8, target 120000

## Key Decisions
- Route `/financial-analysis` = main page; `/financial-analysis/breakeven` alias → both render same component (organized for future sub-sections like Investment Appraisal)
- CVP chart is pure SVG inline in FinancialAnalysis.tsx (no external lib) — shaded profit/loss zones, BEP annotation, optional ESV and target-profit markers
- Save uses same `/api-server/api/problems` API as other modules, with `problemData.type = "breakeven"` discriminator
- PDF dialog inline in BreakEvenReport.tsx (no separate dialog component file needed)

**Why single-scroll pattern:** consistent with PERT/CPM and Simplex — everything visible on one page, no stage navigation.
