// ── Types ─────────────────────────────────────────────────────────────────────
export interface Criterion {
  id: string;
  name: string;   // user-defined label, e.g. "Prix", "Qualité", "Délai"
  weight: number; // 0–100 %; must sum to 100 across all criteria
}

export interface Supplier {
  id: string;
  name: string;
  scores: Record<string, number>; // criterionId → raw score (0–scale)
}

export interface SupplierResult {
  id: string;
  name: string;
  rank: number;
  totalScore: number;                      // weighted sum in [0, 100]
  scores: Record<string, number>;          // raw score per criterion
  weightedScores: Record<string, number>;  // weighted contribution per criterion
}

export interface SupplierWeakPoint {
  criterionName: string;
  rawScore: number;
  maxScore: number;
  weight: number;
}

export interface SupplierAnalysis {
  topSupplier: SupplierResult;
  runnerUp: SupplierResult | null;
  gapAbsolute: number;   // totalScore gap between #1 and #2
  gapPct: number;        // gap / #1 score * 100
  tooClose: boolean;     // gap < 5 points → diversify
  drivingCriterion: Criterion;             // highest-weight criterion
  weakPoints: SupplierWeakPoint[];         // criteria where top supplier scored < 50 % of max
}

// ── Critical-keyword detection ────────────────────────────────────────────────
const CRITICAL_KEYWORDS = [
  "délai", "livraison", "fiabilité", "fiable", "reliability", "delivery",
  "qualité", "quality", "موثوقية", "جودة", "مواعيد", "موعد",
];

function isCritical(name: string): boolean {
  const lower = name.toLowerCase();
  return CRITICAL_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Compute ───────────────────────────────────────────────────────────────────
export function computeSupplierSelection(
  suppliers: Supplier[],
  criteria: Criterion[],
  scale: 10 | 100,
): { results: SupplierResult[]; analysis: SupplierAnalysis | null } {
  if (suppliers.length === 0 || criteria.length === 0) {
    return { results: [], analysis: null };
  }

  const results: SupplierResult[] = suppliers.map(s => {
    const weightedScores: Record<string, number> = {};
    let total = 0;
    for (const c of criteria) {
      const raw = Math.max(0, Math.min(scale, s.scores[c.id] ?? 0));
      // Normalise to [0,1] then multiply by weight → contribution in [0, weight]
      const contribution = (raw / scale) * c.weight;
      weightedScores[c.id] = Math.round(contribution * 100) / 100;
      total += contribution;
    }
    return {
      id: s.id,
      name: s.name,
      rank: 0,
      totalScore: Math.round(total * 100) / 100,
      scores: { ...s.scores },
      weightedScores,
    };
  });

  // Rank highest → lowest
  results.sort((a, b) => b.totalScore - a.totalScore);
  results.forEach((r, i) => { r.rank = i + 1; });

  if (results.length === 0) return { results, analysis: null };

  const top      = results[0];
  const runnerUp = results[1] ?? null;

  const gapAbsolute = runnerUp ? Math.round((top.totalScore - runnerUp.totalScore) * 100) / 100 : 0;
  const gapPct      = runnerUp && top.totalScore > 0
    ? Math.round((gapAbsolute / top.totalScore) * 10000) / 100
    : 0;
  const tooClose    = gapAbsolute < 5 && runnerUp !== null;

  const drivingCriterion = [...criteria].sort((a, b) => b.weight - a.weight)[0];

  // Weak points: top supplier scored < 50 % on a criterion that is critical OR has high weight (≥20)
  const weakPoints: SupplierWeakPoint[] = criteria
    .filter(c => {
      const raw = top.scores[c.id] ?? 0;
      const pct = (raw / scale) * 100;
      return pct < 50 && (isCritical(c.name) || c.weight >= 20);
    })
    .map(c => ({
      criterionName: c.name,
      rawScore:      top.scores[c.id] ?? 0,
      maxScore:      scale,
      weight:        c.weight,
    }));

  return {
    results,
    analysis: { topSupplier: top, runnerUp, gapAbsolute, gapPct, tooClose, drivingCriterion, weakPoints },
  };
}

// ── Weight validation helper ──────────────────────────────────────────────────
export function weightsSum(criteria: Criterion[]): number {
  return Math.round(criteria.reduce((s, c) => s + (c.weight || 0), 0) * 100) / 100;
}
