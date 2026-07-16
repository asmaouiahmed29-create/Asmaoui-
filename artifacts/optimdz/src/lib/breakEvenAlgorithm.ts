// ── Break-Even / CVP Analysis Algorithm ──────────────────────────────────────
// Pure TypeScript: no side-effects, fully testable.

export interface BreakEvenInput {
  productName: string;
  sellingPrice: number;         // prix de vente unitaire (DA)
  variableCost: number;         // coût variable unitaire (DA)
  fixedCosts: number;           // charges fixes totales (DA/période)
  targetProfit?: number;        // bénéfice cible (DA) — optionnel
  expectedSalesVolume?: number; // volume de ventes prévu (unités) — optionnel
}

export interface ChartPoint {
  units: number;
  revenue: number;
  totalCost: number;
  fixedCost: number;
}

export interface BreakEvenResult {
  input: BreakEvenInput;

  // Core CVP
  contributionMarginPerUnit: number;  // marge sur coût variable / unité
  contributionMarginRatio: number;    // taux de marge (0–100 %)
  breakEvenUnits: number;             // seuil de rentabilité en unités
  breakEvenRevenue: number;           // seuil de rentabilité en CA (DA)

  // Target profit (only when input.targetProfit is set)
  targetProfitUnits?: number;
  targetProfitRevenue?: number;

  // Margin of safety (only when input.expectedSalesVolume is set)
  marginOfSafetyUnits?: number;
  marginOfSafetyRevenue?: number;
  marginOfSafetyPct?: number;
  netProfit?: number;             // bénéfice net au volume prévu
  operatingLeverage?: number;     // levier opérationnel (DOL)

  // Chart data
  chartPoints: ChartPoint[];
  chartMaxUnits: number;
}

export function computeBreakEven(input: BreakEvenInput): BreakEvenResult {
  const { sellingPrice: sp, variableCost: vc, fixedCosts: fc } = input;

  if (sp <= 0) throw new Error("Le prix de vente doit être positif.");
  if (vc < 0)  throw new Error("Le coût variable ne peut pas être négatif.");
  if (fc < 0)  throw new Error("Les charges fixes ne peuvent pas être négatives.");

  const cm = sp - vc;
  if (cm <= 0) {
    throw new Error(
      "La marge sur coût variable est nulle ou négative. " +
      "Le prix de vente doit être supérieur au coût variable unitaire."
    );
  }

  const cmRatio    = (cm / sp) * 100;          // %
  const bepUnits   = fc / cm;
  const bepRevenue = bepUnits * sp;             // = fc / (cm/sp)

  // Target profit
  let targetProfitUnits:   number | undefined;
  let targetProfitRevenue: number | undefined;
  if (input.targetProfit !== undefined && input.targetProfit >= 0) {
    targetProfitUnits   = (fc + input.targetProfit) / cm;
    targetProfitRevenue = targetProfitUnits * sp;
  }

  // Margin of safety
  let marginOfSafetyUnits:   number | undefined;
  let marginOfSafetyRevenue: number | undefined;
  let marginOfSafetyPct:     number | undefined;
  let netProfit:             number | undefined;
  let operatingLeverage:     number | undefined;
  if (input.expectedSalesVolume !== undefined && input.expectedSalesVolume > 0) {
    const esv          = input.expectedSalesVolume;
    marginOfSafetyUnits   = esv - bepUnits;
    marginOfSafetyRevenue = marginOfSafetyUnits * sp;
    marginOfSafetyPct     = (marginOfSafetyUnits / esv) * 100;
    netProfit             = esv * cm - fc;
    const totalCM         = esv * cm;
    if (netProfit > 0) operatingLeverage = totalCM / netProfit;
  }

  // Chart: span to 2.2× BEP, or 1.35× expected volume, whichever is greater
  const candidates = [
    bepUnits * 2.2,
    input.expectedSalesVolume ? input.expectedSalesVolume * 1.35 : 0,
    targetProfitUnits         ? targetProfitUnits         * 1.20 : 0,
    20,
  ];
  const chartMaxUnits = Math.ceil(Math.max(...candidates));

  const N = 80;
  const chartPoints: ChartPoint[] = [];
  for (let i = 0; i <= N; i++) {
    const units = (chartMaxUnits * i) / N;
    chartPoints.push({
      units,
      revenue:   units * sp,
      totalCost: fc + units * vc,
      fixedCost: fc,
    });
  }

  return {
    input,
    contributionMarginPerUnit: cm,
    contributionMarginRatio:   cmRatio,
    breakEvenUnits:            bepUnits,
    breakEvenRevenue:          bepRevenue,
    targetProfitUnits,
    targetProfitRevenue,
    marginOfSafetyUnits,
    marginOfSafetyRevenue,
    marginOfSafetyPct,
    netProfit,
    operatingLeverage,
    chartPoints,
    chartMaxUnits,
  };
}

/** Format a number with DA currency suffix */
export function fmtDA(n: number | undefined | null): string {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  return Math.round(n).toLocaleString("fr-DZ") + " DA";
}

/** Format a plain number to N decimals */
export function fmtN(n: number | undefined | null, dec = 2): string {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  return parseFloat(n.toFixed(dec)).toLocaleString("fr-DZ", { maximumFractionDigits: dec });
}
