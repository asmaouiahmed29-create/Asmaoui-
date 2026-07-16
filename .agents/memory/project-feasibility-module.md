---
name: Project Feasibility Module
description: Go/No-Go project break-even at /project-feasibility — new-project framing distinct from the general Financial Analysis module.
---

## Key Distinction
This module is NOT general financial analysis — it is exclusively for evaluating a SPECIFIC upcoming project/investment.
Every piece of copy, every suggestion, every PDF page reinforces "before committing to fixed costs" framing.
The existing Financial Analysis module (/financial-analysis) is for ongoing business; this one is for new project launch decisions.

## Files Created
- `src/components/ProjectFeasibilityLayout.tsx` — navbar (Briefcase icon) + layout shell
- `src/lib/generateProjectFeasibilityPDFReport.ts` — 4-page PDF with "PF-" report ID, cover "تقرير جدوى المشروع", page 3 "هل المشروع مجدٍ؟" Go/No-Go framing
- `src/pages/project-feasibility/ProjectFeasibility.tsx` — single-scroll page with project-specific sector cards, form, KPIs, SVG chart, report
- `src/pages/project-feasibility/ProjectBreakEvenReport.tsx` — situational analysis, Go/No-Go suggestions, managerial report, save, PDF dialog

## Files Modified
- `src/App.tsx` — added `/project-feasibility` and `/project-feasibility/breakeven` routes with ProjectFeasibilityLayout
- `src/pages/PlatformHome.tsx` — added "Faisabilité & Évaluation de Projet" module card (active: true, Briefcase icon)

## Algorithm Reuse
breakEvenAlgorithm.ts (computeBreakEven, fmtDA, fmtN) is shared — math is identical, only framing differs.
problemData.type = "project-breakeven" (different from "breakeven" used by Financial Analysis).

## Sector Templates (new-project framing — all Algerian)
- **Commerce**: Opening new retail branch (Sétif) — SP 3500, VC 1800, CF 240000, vol 200
  - BEP ≈ 141.2 units, MoS at 200 = 29.4%, net profit 100,000 DA
- **Industrie**: New plastic packaging line (Annaba) — SP 185, VC 90, CF 1,400,000, vol 20000
  - BEP ≈ 14,737 units, MoS at 20000 = 26.3%, net profit 500,000 DA
- **Agriculture**: Drip-irrigated greenhouse (El Oued) — SP 120, VC 48, CF 380,000, vol 8000
  - BEP ≈ 5,278 units, MoS at 8000 = 34%, net profit 176,000 DA
- **Services**: Coworking space (Alger Centre) — SP 35000, VC 8000, CF 950,000, vol 40
  - BEP ≈ 35.2 subscriptions, MoS at 40 = 12%, net profit 130,000 DA

## Go/No-Go Suggestions Logic (different from Financial Analysis)
1. Validate market absorption capacity (can the market absorb BEP volume?)
2. Establish ramp-up timeline (when does project reach BEP month by month?)
3. Finance pre-BEP phase (losses before break-even must be planned/funded)
4. Low CM ratio → fix structure before launch (not after)
5. Low MoS → revise pricing or channels before committing
6. High FC % → explore lower-commitment alternatives (used equipment, short lease)
7. Target profit → integrate into business plan with realistic timeline

**Why project-specific framing matters:**
General financial analysis optimizes an ongoing business. Go/No-Go analysis determines whether to start at all — the suggestions must answer "should I commit to these fixed costs?" not "how do I run my business better."
