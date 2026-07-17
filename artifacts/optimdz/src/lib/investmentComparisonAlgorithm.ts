import { computeInvestmentAppraisal } from "./investmentAppraisalAlgorithm";
import type { InvestmentAppraisalResult } from "./investmentAppraisalAlgorithm";

export { fmtDA, fmtN, fmtPct, fmtYears } from "./investmentAppraisalAlgorithm";
export type { InvestmentAppraisalResult, YearRow } from "./investmentAppraisalAlgorithm";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AlternativeInput {
  name: string;
  initialInvestment: number;
  duration: number;
  cashFlows: number[];
  salvageValue?: number;
}

export interface AlternativeResult {
  input: AlternativeInput;
  appraisal: InvestmentAppraisalResult;
  eaa: number | null; // Equivalent Annual Annuity
  rankNPV: number;    // 1 = best (highest NPV)
  rankEAA: number;    // 1 = best (highest EAA, only meaningful if durations differ)
  rankIRR: number;    // 1 = best (highest IRR)
  rankPI: number;     // 1 = best (highest PI)
  rankPayback: number;// 1 = best (shortest discounted payback)
  overallRank: number;// 1 = recommended (by primary criterion)
  color: string;      // chart color
}

export interface ComparisonResult {
  alternatives: AlternativeResult[];
  discountRate: number;
  unequalDurations: boolean;
  primaryCriterion: "npv" | "eaa";
  winner: AlternativeResult;
  hasRankingConflicts: boolean;
  conflictDetails: Array<{ altName: string; criterion: string; rank: number; vs: string }>;
  maxDuration: number; // for line chart x-axis
}

export interface ComparisonParams {
  alternatives: AlternativeInput[];
  discountRate: number; // as % (e.g. 12 means 12%)
}

// ── Chart color palette ───────────────────────────────────────────────────────
const COLORS = ["#004d40", "#f4a261", "#3a7d44", "#7b5ea7", "#c2522b"];
const COLORS_LIGHT = ["#e0f2f1", "#fff3e0", "#e8f5e9", "#ede7f6", "#fbe9e7"];

export const CHART_COLORS = COLORS;
export const CHART_COLORS_LIGHT = COLORS_LIGHT;

// ── EAA ──────────────────────────────────────────────────────────────────────
/**
 * Equivalent Annual Annuity: converts NPV to an equivalent yearly value,
 * enabling fair comparison of projects with different lifespans.
 * EAA = NPV × r / (1 − (1+r)^−n)
 * If r = 0 → EAA = NPV / n
 */
export function computeEAA(npv: number, discountRatePct: number, duration: number): number | null {
  if (duration <= 0) return null;
  const r = discountRatePct / 100;
  if (r === 0) return npv / duration;
  const annuityFactor = (1 - Math.pow(1 + r, -duration)) / r;
  if (annuityFactor === 0) return null;
  return npv / annuityFactor;
}

// ── Ranking helper ────────────────────────────────────────────────────────────
/** Ranks values: rank 1 = best. Higher = better unless ascending=true */
function rankValues(values: (number | null)[], ascending = false): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  const finite = indexed.filter((x) => x.v !== null && isFinite(x.v as number));
  const nullSet = indexed.filter((x) => x.v === null || !isFinite(x.v as number));

  finite.sort((a, b) =>
    ascending ? (a.v as number) - (b.v as number) : (b.v as number) - (a.v as number)
  );

  const ranks = new Array(values.length).fill(values.length + 1); // nulls get worst rank
  finite.forEach((x, pos) => {
    ranks[x.i] = pos + 1;
  });
  nullSet.forEach((x) => {
    ranks[x.i] = values.length + 1;
  });
  return ranks;
}

// ── Main computation ──────────────────────────────────────────────────────────
export function computeComparison(params: ComparisonParams): ComparisonResult {
  const { alternatives, discountRate } = params;

  if (alternatives.length < 2) throw new Error("At least 2 alternatives required");

  // Compute appraisal for each alternative
  const appraisals: InvestmentAppraisalResult[] = alternatives.map((alt) =>
    computeInvestmentAppraisal({
      projectName:       alt.name,
      initialInvestment: alt.initialInvestment,
      discountRate,
      duration:          alt.duration,
      cashFlows:         alt.cashFlows,
      salvageValue:      alt.salvageValue,
    })
  );

  // Detect unequal durations
  const durations = alternatives.map((a) => a.duration);
  const unequalDurations = new Set(durations).size > 1;

  // Compute EAAs
  const eaas: (number | null)[] = appraisals.map((ap) =>
    computeEAA(ap.npv, discountRate, ap.input.duration)
  );

  // Rankings
  const npvRanks     = rankValues(appraisals.map((a) => a.npv));
  const irrRanks     = rankValues(appraisals.map((a) => a.irr));
  const piRanks      = rankValues(appraisals.map((a) => a.profitabilityIndex));
  const paybackRanks = rankValues(
    appraisals.map((a) => a.discountedPayback ?? a.simplePayback),
    true // ascending: shorter payback = better
  );
  const eaaRanks     = rankValues(eaas);

  // Primary criterion: EAA if durations differ, NPV otherwise
  const primaryCriterion: "npv" | "eaa" = unequalDurations ? "eaa" : "npv";
  const overallRanks = primaryCriterion === "eaa" ? eaaRanks : npvRanks;

  // Build result objects
  const altResults: AlternativeResult[] = alternatives.map((alt, i) => ({
    input:       alt,
    appraisal:   appraisals[i],
    eaa:         eaas[i],
    rankNPV:     npvRanks[i],
    rankEAA:     eaaRanks[i],
    rankIRR:     irrRanks[i],
    rankPI:      piRanks[i],
    rankPayback: paybackRanks[i],
    overallRank: overallRanks[i],
    color:       COLORS[i % COLORS.length],
  }));

  // Winner = rank 1
  const winner = altResults.find((a) => a.overallRank === 1) ?? altResults[0];

  // Conflict detection: does any top-NPV/EAA alternative rank lower on IRR or payback?
  type ConflictDetail = { altName: string; criterion: string; rank: number; vs: string };
  const conflictDetails: ConflictDetail[] = [];
  const bestByPrimary = altResults.find((a) => a.overallRank === 1);

  if (bestByPrimary) {
    if (bestByPrimary.rankIRR > 1) {
      const irrWinner = altResults.find((a) => a.rankIRR === 1);
      if (irrWinner) {
        conflictDetails.push({
          altName:   bestByPrimary.input.name,
          criterion: "TRI / IRR",
          rank:      bestByPrimary.rankIRR,
          vs:        irrWinner.input.name,
        });
      }
    }
    if (bestByPrimary.rankPayback > 1) {
      const pbWinner = altResults.find((a) => a.rankPayback === 1);
      if (pbWinner) {
        conflictDetails.push({
          altName:   bestByPrimary.input.name,
          criterion: "Délai de récupération",
          rank:      bestByPrimary.rankPayback,
          vs:        pbWinner.input.name,
        });
      }
    }
    if (bestByPrimary.rankPI > 1) {
      const piWinner = altResults.find((a) => a.rankPI === 1);
      if (piWinner) {
        conflictDetails.push({
          altName:   bestByPrimary.input.name,
          criterion: "Indice de Rentabilité",
          rank:      bestByPrimary.rankPI,
          vs:        piWinner.input.name,
        });
      }
    }
  }

  const maxDuration = Math.max(...alternatives.map((a) => a.duration));

  return {
    alternatives:        altResults,
    discountRate,
    unequalDurations,
    primaryCriterion,
    winner,
    hasRankingConflicts: conflictDetails.length > 0,
    conflictDetails,
    maxDuration,
  };
}
