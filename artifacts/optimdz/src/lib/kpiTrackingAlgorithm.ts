// ── KPI Tracking Algorithm ──────────────────────────────────────────────────
// Pure computation — no React, no side-effects.

// ── Types ───────────────────────────────────────────────────────────────────

export interface PeriodInput {
  label: string;
  revenue: number;
  totalCosts: number;
  profitOverride?: number;   // if set, overrides revenue - totalCosts
  unitsSold?: number;
  numCustomers?: number;
  marketingSpend?: number;   // for CAC calculation
  newCustomers?: number;     // for CAC calculation
  targetRevenue?: number;
  targetProfit?: number;
}

export interface PeriodResult {
  label: string;
  revenue: number;
  totalCosts: number;
  netProfit: number;
  profitMarginPct: number;      // (netProfit / revenue) × 100
  unitsSold?: number;
  numCustomers?: number;
  cac?: number;                 // marketingSpend / newCustomers
  targetRevenue?: number;
  targetProfit?: number;
  revenueVsTargetPct?: number;  // ((revenue / targetRevenue) - 1) × 100
  profitVsTargetPct?: number;   // ((netProfit / targetProfit) - 1) × 100
  revenueGrowthPct?: number;    // vs previous period
  profitGrowthPct?: number;
  unitsGrowthPct?: number;
  costsGrowthPct?: number;
}

export type TrendDir = "up" | "down" | "stable";

export interface KpiSummary {
  latestRevenue: number;
  latestProfit: number;
  latestMarginPct: number;
  latestUnits?: number;

  revenueTrend: TrendDir;
  profitTrend: TrendDir;
  marginTrend: TrendDir;

  avgRevenueGrowthPct: number;    // average of all period-over-period growth rates
  avgProfitGrowthPct: number;

  hasTargets: boolean;
  avgRevenueVsTargetPct?: number;
  avgProfitVsTargetPct?: number;
  periodsAboveRevenueTarget: number;
  periodsAboveProfitTarget: number;

  consecutiveProfitDeclines: number;   // from most recent backward
  marginDeclineStreak: number;         // from most recent backward
  costGrowthFasterThanRevenue: boolean;

  bestPeriodLabel: string;   // highest net profit
  worstPeriodLabel: string;  // lowest net profit

  // overall direction over the full period set
  overallRevenueTrend: TrendDir;
  overallProfitTrend: TrendDir;
}

export interface KpiTrackingResult {
  periods: PeriodResult[];
  summary: KpiSummary;
  businessName: string;
  periodType: "monthly" | "quarterly";
}

export interface KpiTrackingParams {
  businessName: string;
  periodType: "monthly" | "quarterly";
  periods: PeriodInput[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function growthRate(current: number, previous: number): number | undefined {
  if (!isFinite(previous) || previous === 0) return undefined;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function avgOf(arr: (number | undefined)[]): number {
  const valid = arr.filter((v): v is number => v !== undefined && isFinite(v));
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function trendDir(current: number, previous: number, threshold = 1.5): TrendDir {
  const g = growthRate(current, previous);
  if (g === undefined) return "stable";
  if (g > threshold) return "up";
  if (g < -threshold) return "down";
  return "stable";
}

// ── Main computation ─────────────────────────────────────────────────────────

export function computeKpiTracking(params: KpiTrackingParams): KpiTrackingResult {
  const { businessName, periodType, periods: inputs } = params;
  if (inputs.length === 0) throw new Error("Au moins une période est requise.");

  // ── Per-period results ───────────────────────────────────────────────────
  // Use a for-loop (not .map) so we can safely reference previously computed
  // entries; a const assigned from .map() would be in the TDZ inside the callback.
  const periods: PeriodResult[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const inp = inputs[i];

    const netProfit = inp.profitOverride !== undefined
      ? inp.profitOverride
      : inp.revenue - inp.totalCosts;

    const profitMarginPct = inp.revenue > 0
      ? (netProfit / inp.revenue) * 100
      : 0;

    const cac = (inp.marketingSpend !== undefined && inp.newCustomers !== undefined && inp.newCustomers > 0)
      ? inp.marketingSpend / inp.newCustomers
      : undefined;

    const revenueVsTargetPct = (inp.targetRevenue !== undefined && inp.targetRevenue > 0)
      ? ((inp.revenue / inp.targetRevenue) - 1) * 100
      : undefined;

    const profitVsTargetPct = (inp.targetProfit !== undefined && inp.targetProfit !== 0)
      ? ((netProfit / inp.targetProfit) - 1) * 100
      : undefined;

    const prevPeriod = i > 0 ? periods[i - 1] : null;
    const revenueGrowthPct  = prevPeriod ? growthRate(inp.revenue, prevPeriod.revenue) : undefined;
    const profitGrowthPct   = prevPeriod ? growthRate(netProfit, prevPeriod.netProfit) : undefined;
    const unitsGrowthPct    = (prevPeriod && inp.unitsSold !== undefined && prevPeriod.unitsSold !== undefined)
      ? growthRate(inp.unitsSold, prevPeriod.unitsSold) : undefined;
    const costsGrowthPct    = prevPeriod ? growthRate(inp.totalCosts, prevPeriod.totalCosts) : undefined;

    periods.push({
      label: inp.label,
      revenue: inp.revenue,
      totalCosts: inp.totalCosts,
      netProfit,
      profitMarginPct,
      unitsSold: inp.unitsSold,
      numCustomers: inp.numCustomers,
      cac,
      targetRevenue: inp.targetRevenue,
      targetProfit: inp.targetProfit,
      revenueVsTargetPct,
      profitVsTargetPct,
      revenueGrowthPct,
      profitGrowthPct,
      unitsGrowthPct,
      costsGrowthPct,
    });
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const last = periods[periods.length - 1];
  const prev = periods.length >= 2 ? periods[periods.length - 2] : null;

  const revTrend = prev ? trendDir(last.revenue, prev.revenue) : "stable";
  const profTrend = prev ? trendDir(last.netProfit, prev.netProfit) : "stable";
  const margTrend = prev ? trendDir(last.profitMarginPct, prev.profitMarginPct, 0.5) : "stable";

  // Average growth across all periods (periods[1..] have growth rates)
  const avgRevenueGrowthPct = avgOf(periods.slice(1).map(p => p.revenueGrowthPct));
  const avgProfitGrowthPct  = avgOf(periods.slice(1).map(p => p.profitGrowthPct));

  const hasTargets = periods.some(p => p.targetRevenue !== undefined || p.targetProfit !== undefined);
  const avgRevenueVsTargetPct = hasTargets
    ? avgOf(periods.map(p => p.revenueVsTargetPct))
    : undefined;
  const avgProfitVsTargetPct = hasTargets
    ? avgOf(periods.map(p => p.profitVsTargetPct))
    : undefined;

  const periodsAboveRevenueTarget = periods.filter(p =>
    p.revenueVsTargetPct !== undefined && p.revenueVsTargetPct >= 0
  ).length;
  const periodsAboveProfitTarget = periods.filter(p =>
    p.profitVsTargetPct !== undefined && p.profitVsTargetPct >= 0
  ).length;

  // Consecutive profit declines (from most recent)
  let consecutiveProfitDeclines = 0;
  for (let i = periods.length - 1; i >= 1; i--) {
    if (periods[i].netProfit < periods[i - 1].netProfit) consecutiveProfitDeclines++;
    else break;
  }

  // Margin decline streak (from most recent)
  let marginDeclineStreak = 0;
  for (let i = periods.length - 1; i >= 1; i--) {
    if (periods[i].profitMarginPct < periods[i - 1].profitMarginPct) marginDeclineStreak++;
    else break;
  }

  // Cost growth faster than revenue (compare first vs last period)
  const revGrowthOverall = growthRate(periods[periods.length - 1].revenue, periods[0].revenue) ?? 0;
  const costGrowthOverall = growthRate(periods[periods.length - 1].totalCosts, periods[0].totalCosts) ?? 0;
  const costGrowthFasterThanRevenue = costGrowthOverall > revGrowthOverall;

  // Best/worst period by net profit
  const sorted = [...periods].sort((a, b) => b.netProfit - a.netProfit);
  const bestPeriodLabel  = sorted[0].label;
  const worstPeriodLabel = sorted[sorted.length - 1].label;

  // Overall trends (first vs last, ignoring middle fluctuations)
  const overallRevenueTrend = periods.length >= 2 ? trendDir(periods[periods.length - 1].revenue, periods[0].revenue, 5) : "stable";
  const overallProfitTrend  = periods.length >= 2 ? trendDir(periods[periods.length - 1].netProfit, periods[0].netProfit, 5) : "stable";

  return {
    periods,
    summary: {
      latestRevenue: last.revenue,
      latestProfit: last.netProfit,
      latestMarginPct: last.profitMarginPct,
      latestUnits: last.unitsSold,
      revenueTrend: revTrend,
      profitTrend: profTrend,
      marginTrend: margTrend,
      avgRevenueGrowthPct,
      avgProfitGrowthPct,
      hasTargets,
      avgRevenueVsTargetPct,
      avgProfitVsTargetPct,
      periodsAboveRevenueTarget,
      periodsAboveProfitTarget,
      consecutiveProfitDeclines,
      marginDeclineStreak,
      costGrowthFasterThanRevenue,
      bestPeriodLabel,
      worstPeriodLabel,
      overallRevenueTrend,
      overallProfitTrend,
    },
    businessName,
    periodType,
  };
}

// ── Formatters ───────────────────────────────────────────────────────────────

export function fmtDA(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(Math.round(n));
  const formatted = abs >= 1_000_000
    ? (abs / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + " M DA"
    : abs >= 1_000
    ? (abs / 1_000).toFixed(1).replace(/\.0$/, "") + " k DA"
    : abs.toLocaleString("fr-DZ") + " DA";
  return (n < 0 ? "−" : "") + formatted;
}

export function fmtDAFull(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(Math.round(n));
  return (n < 0 ? "−" : "") + abs.toLocaleString("fr-DZ") + " DA";
}

export function fmtPct(n: number | null | undefined, dec = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(dec) + " %";
}

export function fmtPctAbs(n: number | null | undefined, dec = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return n.toFixed(dec) + " %";
}

export function fmtN(n: number | null | undefined, dec = 0): string {
  if (n == null || !isFinite(n)) return "—";
  return n.toLocaleString("fr-DZ", { maximumFractionDigits: dec });
}

// ── Chart colors ─────────────────────────────────────────────────────────────
export const COLOR_REVENUE = "#004d40";   // primary — deep teal
export const COLOR_COSTS   = "#c62828";   // red
export const COLOR_PROFIT  = "#f4a261";   // accent — amber/orange
export const COLOR_MARGIN  = "#3a7d44";   // green
export const COLOR_TARGET  = "#7b5ea7";   // purple
