// ── Re-exports from Investment Appraisal ────────────────────────────────────
export { computeInvestmentAppraisal, fmtDA, fmtN, fmtPct, fmtYears } from "./investmentAppraisalAlgorithm";
export type { InvestmentAppraisalInput, InvestmentAppraisalResult, YearRow } from "./investmentAppraisalAlgorithm";

import { computeInvestmentAppraisal } from "./investmentAppraisalAlgorithm";
import type { InvestmentAppraisalInput, InvestmentAppraisalResult } from "./investmentAppraisalAlgorithm";

// ── Types ────────────────────────────────────────────────────────────────────
export type SensitivityVariable = "initialInvestment" | "discountRate" | "cashFlows";

export interface SensitivityPoint {
  pct: number;            // variation % (e.g., -20, -10, 0, 10, 20)
  npv: number;
  irr: number | null;
  profitabilityIndex: number;
}

export interface VariableSensitivity {
  variable: SensitivityVariable;
  nameFr: string;
  nameAr: string;
  points: SensitivityPoint[];          // one per pct in range
  breakEvenPct: number | null;         // % change at which NPV = 0
  npvAtMinRange: number;               // NPV at most negative %
  npvAtMaxRange: number;               // NPV at most positive %
  impact: number;                      // abs(npvAtMaxRange - npvAtMinRange)
}

export interface ScenarioResult {
  name: "pessimistic" | "base" | "optimistic";
  nameFr: string;
  nameAr: string;
  emojiIcon: string;
  adjustmentPct: number;               // % applied to revenues; opposite to costs
  result: InvestmentAppraisalResult;
}

export interface SensitivityAnalysisResult {
  baseResult: InvestmentAppraisalResult;
  variables: VariableSensitivity[];    // sorted by impact DESC (tornado order)
  scenarios: ScenarioResult[];
  rangeMin: number;   // e.g., -20
  rangeMax: number;   // e.g.,  20
  stepSize: number;   // e.g.,   5
  allPcts: number[];  // the full ordered list of variation points
}

export interface SensitivityAnalysisParams {
  baseInput: InvestmentAppraisalInput;
  rangeMin: number;         // e.g., -20
  rangeMax: number;         // e.g.,  20
  stepSize: number;         // e.g.,   5
  pessimisticAdj: number;   // positive %, applied adversely, e.g. 15
  optimisticAdj: number;    // positive %, applied favourably, e.g. 15
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildPctList(rangeMin: number, rangeMax: number, step: number): number[] {
  const pts = new Set<number>();
  for (let p = rangeMin; p <= rangeMax + 1e-9; p = Math.round((p + step) * 1e6) / 1e6) {
    pts.add(Math.round(p));
  }
  pts.add(0);
  return [...pts].sort((a, b) => a - b);
}

function variableInput(variable: SensitivityVariable, base: InvestmentAppraisalInput, pct: number): InvestmentAppraisalInput {
  const f = 1 + pct / 100;
  switch (variable) {
    case "initialInvestment":
      return { ...base, cashFlows: [...base.cashFlows], initialInvestment: base.initialInvestment * f };
    case "discountRate":
      return { ...base, cashFlows: [...base.cashFlows], discountRate: Math.max(0.001, base.discountRate * f) };
    case "cashFlows":
      return {
        ...base,
        cashFlows: base.cashFlows.map(cf => cf * f),
        salvageValue: base.salvageValue != null ? base.salvageValue * f : undefined,
      };
  }
}

function computeVariableSensitivity(
  variable: SensitivityVariable,
  base: InvestmentAppraisalInput,
  pcts: number[],
  baseResult: InvestmentAppraisalResult,
): VariableSensitivity {
  const LABELS: Record<SensitivityVariable, { fr: string; ar: string }> = {
    initialInvestment: { fr: "Investissement initial (I₀)", ar: "الاستثمار الأولي (I₀)" },
    discountRate:      { fr: "Taux d'actualisation (r)",   ar: "معدل الخصم (r)" },
    cashFlows:         { fr: "Flux de trésorerie annuels", ar: "التدفقات النقدية السنوية" },
  };

  const points: SensitivityPoint[] = pcts.map(pct => {
    const inp = variableInput(variable, base, pct);
    const res = computeInvestmentAppraisal(inp);
    return { pct, npv: res.npv, irr: res.irr, profitabilityIndex: res.profitabilityIndex };
  });

  // ── Break-even computation ─────────────────────────────────────────────────
  let breakEvenPct: number | null = null;
  const totalPV    = baseResult.totalPV;
  const I0         = base.initialInvestment;
  const r          = base.discountRate;

  if (variable === "initialInvestment") {
    // NPV = totalPV − factor·I₀ = 0  →  factor = totalPV / I₀
    if (I0 > 0) breakEvenPct = (totalPV / I0 - 1) * 100;
  } else if (variable === "cashFlows") {
    // NPV = factor·totalPV − I₀ = 0  →  factor = I₀ / totalPV
    if (totalPV > 0) breakEvenPct = (I0 / totalPV - 1) * 100;
    // if totalPV ≤ 0, no crossover in positive factor territory
  } else if (variable === "discountRate") {
    // NPV = 0 when r = IRR, so % change relative to base r
    if (baseResult.irr !== null && r > 0) {
      breakEvenPct = (baseResult.irr - r) / r * 100;
    }
  }

  const first = points[0];
  const last  = points[points.length - 1];

  return {
    variable,
    nameFr:       LABELS[variable].fr,
    nameAr:       LABELS[variable].ar,
    points,
    breakEvenPct,
    npvAtMinRange: first?.npv ?? 0,
    npvAtMaxRange: last?.npv  ?? 0,
    impact: Math.abs((last?.npv ?? 0) - (first?.npv ?? 0)),
  };
}

// ── Main computation ──────────────────────────────────────────────────────────
export function computeSensitivityAnalysis(params: SensitivityAnalysisParams): SensitivityAnalysisResult {
  const { baseInput, rangeMin, rangeMax, stepSize, pessimisticAdj, optimisticAdj } = params;
  const baseResult = computeInvestmentAppraisal(baseInput);
  const allPcts    = buildPctList(rangeMin, rangeMax, stepSize);

  const variables: VariableSensitivity[] = (
    ["initialInvestment", "discountRate", "cashFlows"] as SensitivityVariable[]
  ).map(v => computeVariableSensitivity(v, baseInput, allPcts, baseResult));

  // Sort by impact descending (tornado order)
  variables.sort((a, b) => b.impact - a.impact);

  // ── Scenarios ─────────────────────────────────────────────────────────────
  const makeScenarioInput = (adj: number, direction: "pessimistic" | "optimistic"): InvestmentAppraisalInput => {
    if (direction === "pessimistic") {
      return {
        ...baseInput,
        initialInvestment: baseInput.initialInvestment * (1 + adj / 100),
        discountRate:       Math.max(0.001, baseInput.discountRate * (1 + adj / 100)),
        cashFlows:          baseInput.cashFlows.map(cf => cf * (1 - adj / 100)),
        salvageValue:       baseInput.salvageValue != null ? baseInput.salvageValue * (1 - adj / 100) : undefined,
      };
    } else {
      return {
        ...baseInput,
        initialInvestment: baseInput.initialInvestment * (1 - adj / 100),
        discountRate:       Math.max(0.001, baseInput.discountRate * (1 - adj / 100)),
        cashFlows:          baseInput.cashFlows.map(cf => cf * (1 + adj / 100)),
        salvageValue:       baseInput.salvageValue != null ? baseInput.salvageValue * (1 + adj / 100) : undefined,
      };
    }
  };

  const scenarios: ScenarioResult[] = [
    {
      name: "pessimistic", nameFr: "Pessimiste", nameAr: "متشائم", emojiIcon: "📉",
      adjustmentPct: pessimisticAdj,
      result: computeInvestmentAppraisal(makeScenarioInput(pessimisticAdj, "pessimistic")),
    },
    {
      name: "base", nameFr: "Scénario de base", nameAr: "السيناريو الأساسي", emojiIcon: "📊",
      adjustmentPct: 0,
      result: baseResult,
    },
    {
      name: "optimistic", nameFr: "Optimiste", nameAr: "متفائل", emojiIcon: "📈",
      adjustmentPct: optimisticAdj,
      result: computeInvestmentAppraisal(makeScenarioInput(optimisticAdj, "optimistic")),
    },
  ];

  return { baseResult, variables, scenarios, rangeMin, rangeMax, stepSize, allPcts };
}

// ── Risk level from break-even distance ──────────────────────────────────────
export function breakEvenRisk(pct: number | null): "low" | "moderate" | "high" | "undefined" {
  if (pct === null || !isFinite(pct)) return "undefined";
  const abs = Math.abs(pct);
  if (abs >= 25) return "low";
  if (abs >= 10) return "moderate";
  return "high";
}
