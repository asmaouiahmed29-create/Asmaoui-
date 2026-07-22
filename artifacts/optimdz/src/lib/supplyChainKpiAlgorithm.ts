// ── Supply Chain KPI — pure computation logic ─────────────────────────────────

export type KpiPeriod = "mois" | "trimestre" | "annee";
export type KpiStatus = "good" | "medium" | "bad";

// ── Input shapes ──────────────────────────────────────────────────────────────
export interface StorageCostInputs {
  coutVentes: number;          // Coût des ventes (numérateur de la rotation)
  valeurMoyenneStock: number;  // Valeur moyenne du stock (dénominateur)
}

export interface ServiceRateInputs {
  commandesLivrees: number;   // Livrées à temps et complètes
  commandesTotales: number;   // Total des commandes
}

export interface SupplyCostInputs {
  coutTransport: number;
  coutStockage: number;
  coutCommande: number;
  coutRupture: number;
}

export interface StockoutInputs {
  nombreRuptures: number;
  nombreTotalCommandes: number;
}

export interface ScKpiInputs {
  problemName: string;
  period: KpiPeriod;
  storage?: StorageCostInputs;
  serviceRate?: ServiceRateInputs;
  supplyCost?: SupplyCostInputs;
  stockout?: StockoutInputs;
}

// ── Result shapes ─────────────────────────────────────────────────────────────
export interface KpiValue {
  value: number;
  status: KpiStatus;
  /** normalised 0–100 score for radar (100 = best) */
  score: number;
}

export interface CostValue {
  value: number;
  breakdown: SupplyCostInputs;
}

export interface ScKpiResults {
  tauxRotation?: KpiValue;
  tauxService?: KpiValue;
  coutTotal?: CostValue;
  tauxRupture?: KpiValue;
  activeCount: number;
  period: KpiPeriod;
  problemName: string;
}

// ── Benchmarks ────────────────────────────────────────────────────────────────
// Taux de rotation: <2 bad | 2–6 medium | ≥6 good  (general)
function statusRotation(v: number): KpiStatus {
  if (v >= 6) return "good";
  if (v >= 2) return "medium";
  return "bad";
}
function scoreRotation(v: number): number {
  return Math.round(Math.min(100, (v / 12) * 100));
}

// Taux de service: <90% bad | 90–95% medium | ≥95% good
function statusService(v: number): KpiStatus {
  if (v >= 95) return "good";
  if (v >= 90) return "medium";
  return "bad";
}
function scoreService(v: number): number {
  return Math.round(Math.min(100, v));
}

// Taux de rupture: >5% bad | 1–5% medium | ≤1% good
function statusRupture(v: number): KpiStatus {
  if (v <= 1) return "good";
  if (v <= 5) return "medium";
  return "bad";
}
// Inverted: 0% rupture → score 100; ≥5% rupture → score 0
function scoreRupture(v: number): number {
  return Math.round(Math.max(0, 100 - v * 20));
}

// ── Main computation ──────────────────────────────────────────────────────────
export function computeScKpis(inputs: ScKpiInputs): ScKpiResults {
  const res: ScKpiResults = {
    activeCount: 0,
    period: inputs.period,
    problemName: inputs.problemName,
  };

  if (inputs.storage && inputs.storage.valeurMoyenneStock > 0) {
    const v = inputs.storage.coutVentes / inputs.storage.valeurMoyenneStock;
    res.tauxRotation = { value: v, status: statusRotation(v), score: scoreRotation(v) };
    res.activeCount++;
  }

  if (inputs.serviceRate && inputs.serviceRate.commandesTotales > 0) {
    const raw = (inputs.serviceRate.commandesLivrees / inputs.serviceRate.commandesTotales) * 100;
    const v = Math.min(100, raw);
    res.tauxService = { value: v, status: statusService(v), score: scoreService(v) };
    res.activeCount++;
  }

  if (inputs.supplyCost) {
    const { coutTransport, coutStockage, coutCommande, coutRupture } = inputs.supplyCost;
    res.coutTotal = {
      value: coutTransport + coutStockage + coutCommande + coutRupture,
      breakdown: inputs.supplyCost,
    };
    res.activeCount++;
  }

  if (inputs.stockout && inputs.stockout.nombreTotalCommandes > 0) {
    const raw = (inputs.stockout.nombreRuptures / inputs.stockout.nombreTotalCommandes) * 100;
    const v = Math.min(100, raw);
    res.tauxRupture = { value: v, status: statusRupture(v), score: scoreRupture(v) };
    res.activeCount++;
  }

  return res;
}

// ── Formatting helpers (exported for component reuse) ─────────────────────────
export function fPct(v: number, decimals = 1): string {
  return v.toFixed(decimals) + " %";
}

export function fRot(v: number): string {
  return v.toFixed(2) + "×";
}

export function fDA(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (abs / 1_000_000).toFixed(2) + " M DA";
  if (abs >= 1_000)     return (abs / 1_000).toFixed(1) + " k DA";
  return Math.round(abs).toLocaleString("fr-DZ") + " DA";
}
