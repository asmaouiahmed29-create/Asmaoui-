// ── Types ─────────────────────────────────────────────────────────────────────
export interface InvestmentAppraisalInput {
  projectName?: string;
  initialInvestment: number;   // I₀ at year 0 (positive value, DA)
  discountRate: number;        // r as percent — e.g. 12 means 12%
  duration: number;            // n (integer, 1..30)
  cashFlows: number[];         // annual net cash inflows, length === duration
  salvageValue?: number;       // optional residual / scrap value at end of year n
}

export interface YearRow {
  year: number;
  cashFlow: number;            // CF (+ salvage if final year)
  discountFactor: number;      // 1 / (1 + r)^year
  presentValue: number;        // CF × discountFactor
  cumulativeCF: number;        // running undiscounted sum (starts from −I₀)
  cumulativeDCF: number;       // running discounted sum (starts from −I₀)
}

export interface InvestmentAppraisalResult {
  input: InvestmentAppraisalInput;
  npv: number;
  irr: number | null;              // %, null if no solution found in [−99 %, 5 000 %]
  simplePayback: number | null;    // years (fractional); null if never recovered
  discountedPayback: number | null;
  profitabilityIndex: number;      // total PV / I₀   (> 1 → accept)
  totalCashFlow: number;           // undiscounted sum of all CFs (incl. salvage)
  totalPV: number;                 // sum of all present values (incl. salvage PV)
  yearRows: YearRow[];
}

// ── Formatters ────────────────────────────────────────────────────────────────
export function fmtDA(n: number | null | undefined): string {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  const rounded = Math.round(n);
  return (rounded < 0 ? "−" : "") + Math.abs(rounded).toLocaleString("fr-DZ") + " DA";
}
export function fmtN(n: number | null | undefined, dec = 2): string {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  return parseFloat(n.toFixed(dec)).toLocaleString("fr-DZ", { maximumFractionDigits: dec });
}
export function fmtPct(n: number | null | undefined, dec = 2): string {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  return parseFloat(n.toFixed(dec)).toLocaleString("fr-DZ", { maximumFractionDigits: dec }) + " %";
}
export function fmtYears(y: number | null | undefined, lang: "fr" | "ar" = "fr"): string {
  if (y === undefined || y === null || !isFinite(y)) return "—";
  const full = Math.floor(y);
  const months = Math.min(11, Math.round((y - full) * 12));
  if (lang === "ar") {
    const yStr = full > 0 ? `${full} ${full === 1 ? "سنة" : "سنوات"}` : "";
    const mStr = months > 0 ? `${months} ${months === 1 ? "شهر" : "أشهر"}` : "";
    return [yStr, mStr].filter(Boolean).join(" و") || "أقل من شهر";
  }
  const yStr = full > 0 ? `${full} an${full > 1 ? "s" : ""}` : "";
  const mStr = months > 0 ? `${months} mois` : "";
  return [yStr, mStr].filter(Boolean).join(" ") || "< 1 mois";
}

// ── IRR via Newton-Raphson + bisection fallback ──────────────────────────────
function computeIRR(cashFlows: number[], I0: number, salvage: number): number | null {
  if (I0 <= 0) return null;

  const n = cashFlows.length;
  const npvFn = (r: number): number => {
    if (Math.abs(1 + r) < 1e-15) return Infinity;
    let pv = -I0;
    for (let t = 1; t <= n; t++) {
      const cf = cashFlows[t - 1] + (t === n ? salvage : 0);
      pv += cf / Math.pow(1 + r, t);
    }
    return pv;
  };
  const dnpvFn = (r: number): number => {
    let d = 0;
    for (let t = 1; t <= n; t++) {
      const cf = cashFlows[t - 1] + (t === n ? salvage : 0);
      d -= (t * cf) / Math.pow(1 + r, t + 1);
    }
    return d;
  };

  // Newton-Raphson (converges quadratically for well-behaved functions)
  let r = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npvFn(r);
    if (!isFinite(f)) break;
    if (Math.abs(f) < 0.01) return r * 100;
    const df = dnpvFn(r);
    if (!isFinite(df) || Math.abs(df) < 1e-15) break;
    const step = f / df;
    r = Math.max(-0.9999, Math.min(50.0, r - step));
    if (Math.abs(step) < 1e-12) return r * 100;
  }

  // Bisection fallback: search in [−99 %, 500 %]
  const lo = -0.99, hi = 5.0;
  const fLo = npvFn(lo), fHi = npvFn(hi);
  if (!isFinite(fLo) || !isFinite(fHi) || fLo * fHi > 0) return null;
  let a = lo, b = hi;
  for (let i = 0; i < 200; i++) {
    const mid = (a + b) / 2;
    const fm = npvFn(mid);
    if (Math.abs(fm) < 0.01 || (b - a) < 1e-12) return mid * 100;
    if (npvFn(a) * fm < 0) b = mid;
    else a = mid;
  }
  return ((a + b) / 2) * 100;
}

// ── Main computation ──────────────────────────────────────────────────────────
export function computeInvestmentAppraisal(input: InvestmentAppraisalInput): InvestmentAppraisalResult {
  const { initialInvestment: I0, discountRate, duration, salvageValue = 0 } = input;
  const cfs = input.cashFlows.slice(0, duration);
  const r = discountRate / 100;

  // ── Year rows ──────────────────────────────────────────────────────────────
  let cumCF = -I0;
  let cumDCF = -I0;
  const yearRows: YearRow[] = [];

  for (let t = 1; t <= cfs.length; t++) {
    const isFinal = t === cfs.length;
    const cf = cfs[t - 1] + (isFinal ? salvageValue : 0);
    const df = 1 / Math.pow(1 + r, t);
    const pv = cf * df;
    cumCF += cf;
    cumDCF += pv;
    yearRows.push({ year: t, cashFlow: cf, discountFactor: df, presentValue: pv, cumulativeCF: cumCF, cumulativeDCF: cumDCF });
  }

  const totalPV = yearRows.reduce((s, row) => s + row.presentValue, 0);
  const npv = totalPV - I0;

  // ── IRR ────────────────────────────────────────────────────────────────────
  const irr = computeIRR(cfs, I0, salvageValue);

  // ── Simple Payback ─────────────────────────────────────────────────────────
  let simplePayback: number | null = null;
  {
    let prevCum = -I0;
    for (let i = 0; i < yearRows.length; i++) {
      const row = yearRows[i];
      if (row.cumulativeCF >= 0) {
        simplePayback = i + Math.abs(prevCum) / row.cashFlow;
        break;
      }
      prevCum = row.cumulativeCF;
    }
  }

  // ── Discounted Payback ─────────────────────────────────────────────────────
  let discountedPayback: number | null = null;
  {
    let prevCum = -I0;
    for (let i = 0; i < yearRows.length; i++) {
      const row = yearRows[i];
      if (row.cumulativeDCF >= 0) {
        discountedPayback = i + Math.abs(prevCum) / row.presentValue;
        break;
      }
      prevCum = row.cumulativeDCF;
    }
  }

  // ── Profitability Index ────────────────────────────────────────────────────
  const profitabilityIndex = I0 > 0 ? totalPV / I0 : 0;
  const totalCashFlow = yearRows.reduce((s, row) => s + row.cashFlow, 0);

  return { input, npv, irr, simplePayback, discountedPayback, profitabilityIndex, totalCashFlow, totalPV, yearRows };
}
