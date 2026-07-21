---
name: Supply Chain module
description: Architecture, i18n rules, and active tools for the /supply-chain module in OptimDZ
---

## Routes & files
- `/supply-chain` → `SupplyChainHome.tsx` — mini-dashboard with tool cards
- `/supply-chain/inventory` → `InventoryManagement.tsx` — EOQ, ROP, ABC classification
- `/supply-chain/forecast` → `DemandForecasting.tsx` — Moving Average + Exponential Smoothing
- `/supply-chain/suppliers` → `SupplierSelection.tsx` — weighted multicriteria supplier ranking

## Lib files
- `lib/inventoryAlgorithm.ts`, `lib/generateInventoryPDF.ts`
- `lib/forecastAlgorithm.ts`, `lib/generateForecastPDF.ts`
- `lib/supplierAlgorithm.ts`, `lib/generateSupplierPDF.ts`

## i18n — CRITICAL RULE
`t(fr, ar)` — **French is the FIRST argument, Arabic is SECOND**.
`const t = (fr, ar) => language === "ar" ? ar : fr`

Any call written as `t("Arabic text", "French text")` will show Arabic in FR mode — this is a bug.
This mistake was made throughout DemandForecasting.tsx initially and required a complete file rewrite.

**Always write:** `t("Texte français", "النص العربي")`

## SupplierSelection algorithm
- `weightsSum(criteria)` must equal 100 before solving; UI blocks compute if invalid
- `computeSupplierSelection(suppliers, criteria, scale: 10|100)` returns ranked results
- Total score = Σ (rawScore / scale) × weight — result in [0, 100]
- Weak points flagged when top supplier < 50% on critical criteria (délai, fiabilité, qualité, موثوقية…) or weight ≥ 20%
- "tooClose" = gap between #1 and #2 < 5 points → recommend double sourcing

## SupplyChainHome stats (current)
- 5 Outils planifiés, 3 Outils disponibles, models: EOQ · MA · WS
- Next tool to activate: transport (id="transport") or kpi-sc (id="kpi-sc")

## PDF pattern (all 3 tools follow same 3-page structure)
1. Cover (dark green bg, KPIs grid, metadata footer)
2. Results table (styled, alternating rows, mini chart)
3. Analysis + Recommendations (analysisLines + suggestions array)
Uses jsPDF + html2canvas; off-screen div rendered at 794×1123px then captured at scale:2
