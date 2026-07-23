---
name: Industrial Management module
description: التسيير الصناعي module at /industrial-management — structure, active tools, algorithm, and i18n approach.
---

# Industrial Management Module

**Why:** Built from scratch as requested — no reuse of other module engines.

## Routes
- `/industrial-management` → `IndustrialManagementHome.tsx`
- `/industrial-management/production-planning` → `ProductionPlanning.tsx`

## Layout
`IndustrialManagementLayout.tsx` — Factory icon, breadcrumb to Portail, same pattern as SupplyChainLayout.

## Home page (`IndustrialManagementHome.tsx`)
- Hero banner with module stats (5 planned, 1 available, MRP)
- Sector selection pills (Industrie, Commerce, Agriculture, Services, Personnalisé) — visual only, no routing effect
- Tool cards: 1 active (تخطيط الإنتاج → /production-planning), 4 disabled placeholders (جدولة الورشات, تخطيط الطاقة, إدارة الجودة, صيانة المعدات)

## Production Planning / MRP tool
**Algorithm:** `src/lib/mrpAlgorithm.ts`
- Pure computation, no i18n
- `computeMrp(inputs)` → `MrpResults`
- Two-level BOM: finished products → components (component gross reqs = parent order launches × qtyPerUnit)
- Lot-for-lot when lotSize = 0 (treated as 1 internally)
- `lateOrders` count: orders needing launch before period 1 — triggers urgent alerts
- Exports: `generateMrpAnalysis(results)` and `generateMrpRecommendations(results)` returning `{fr, ar}` pairs for UI rendering

**PDF:** `src/lib/generateMrpPDF.ts`
- 3-page PDF: cover, MRP tables, analysis+recommendations
- `makeLbl(lang)` helper — `pageShell` takes `lang` parameter to avoid scope issues (lesson from KPI PDF bug)
- Palette same as KPI PDF (C object with primary, muted, etc.)

**UI:** `src/pages/industrial-management/ProductionPlanning.tsx`
- Phase: form → results
- Sector templates (Industrie, Agriculture, Services, Custom) pre-fill product data
- Dynamic products + components (BOM), period count slider (2–12), semaines/mois toggle
- MRP results table: 5 rows (BB, SD, BN, OR, OL), color-coded cells (amber=BN>0, blue=receipt, primary=launch)
- تحليل الوضع + التوصيات الإدارية from algorithm generators via t(item.fr, item.ar)
- Save → POST /api/problems with type "industrial-mrp"
- PDF export via generateMrpPDF

## i18n
- All UI strings via `t(fr, ar)` — FRENCH FIRST, same rule as all other modules
- PDF strings via `lbl(fr, ar)` — same order
- Algorithm bilingual output: returns `{fr, ar}` objects, rendered in UI via `t()`
- Sector template names are bilingual inline strings (e.g. "Châssis assemblé / هيكل مُجمَّع") — user-entered, not translated

## How to apply
Follow the same layout/home/tool pattern when adding new tools (جدولة الورشات, etc.): add a route in App.tsx, enable the card in IndustrialManagementHome.tsx, create the algorithm + PDF + UI files under the same conventions.
