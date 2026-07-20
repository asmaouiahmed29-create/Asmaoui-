// ── Types ─────────────────────────────────────────────────────────────────────
export type InventoryMode = "eoq" | "reorder" | "abc";

// EOQ ─────────────────────────────────────────────────────────────────────────
export interface EOQProduct {
  id: string;
  name: string;
  demand: number;      // D — annual demand (units/year)
  orderCost: number;   // Cc — cost per order (DA)
  holdingCost: number; // Cp — annual holding cost per unit (DA/unit/year)
}

export interface EOQResult {
  id: string;
  name: string;
  demand: number;
  orderCost: number;
  holdingCost: number;
  eoq: number;          // √(2 × D × Cc / Cp)
  ordersPerYear: number; // D / EOQ
  cycleTime: number;     // 365 / ordersPerYear (days between orders)
  orderingCost: number;  // (D/EOQ) × Cc
  carryingCost: number;  // (EOQ/2) × Cp
  totalCost: number;     // orderingCost + carryingCost
}

export function computeEOQ(products: EOQProduct[]): EOQResult[] {
  return products.map((p) => {
    const eoq = p.holdingCost > 0 ? Math.sqrt((2 * p.demand * p.orderCost) / p.holdingCost) : 0;
    const ordersPerYear = eoq > 0 ? p.demand / eoq : 0;
    const cycleTime = ordersPerYear > 0 ? 365 / ordersPerYear : 0;
    const orderingCost = ordersPerYear * p.orderCost;
    const carryingCost = (eoq / 2) * p.holdingCost;
    return {
      id: p.id,
      name: p.name,
      demand: p.demand,
      orderCost: p.orderCost,
      holdingCost: p.holdingCost,
      eoq,
      ordersPerYear,
      cycleTime,
      orderingCost,
      carryingCost,
      totalCost: orderingCost + carryingCost,
    };
  });
}

// Reorder Point ───────────────────────────────────────────────────────────────
export interface ReorderProduct {
  id: string;
  name: string;
  dailyDemand: number;  // units/day
  leadTime: number;     // days
  safetyStock: number;  // units
}

export interface ReorderResult {
  id: string;
  name: string;
  dailyDemand: number;
  leadTime: number;
  safetyStock: number;
  demandDuringLeadTime: number; // dailyDemand × leadTime
  reorderPoint: number;         // demandDuringLeadTime + safetyStock
}

export function computeReorderPoint(products: ReorderProduct[]): ReorderResult[] {
  return products.map((p) => {
    const demandDuringLeadTime = p.dailyDemand * p.leadTime;
    const reorderPoint = demandDuringLeadTime + p.safetyStock;
    return { ...p, demandDuringLeadTime, reorderPoint };
  });
}

// ABC Classification ──────────────────────────────────────────────────────────
export interface ABCProduct {
  id: string;
  name: string;
  annualValue: number; // DA consumed annually
}

export interface ABCResult {
  id: string;
  name: string;
  annualValue: number;
  percentage: number;
  cumulativePercentage: number;
  category: "A" | "B" | "C";
  rank: number;
}

export function computeABC(products: ABCProduct[]): ABCResult[] {
  const total = products.reduce((s, p) => s + p.annualValue, 0);
  if (total === 0) return products.map((p, i) => ({ ...p, percentage: 0, cumulativePercentage: 0, category: "C" as const, rank: i + 1 }));

  const sorted = [...products].sort((a, b) => b.annualValue - a.annualValue);
  let cumulative = 0;
  return sorted.map((p, i) => {
    const pct = (p.annualValue / total) * 100;
    cumulative += pct;
    const category: "A" | "B" | "C" = cumulative - pct < 80 && pct > 0 && cumulative <= 80
      ? "A"
      : cumulative <= 80
      ? "A"
      : cumulative - pct < 95
      ? "B"
      : "C";
    return { ...p, percentage: pct, cumulativePercentage: cumulative, category, rank: i + 1 };
  });
}

export function classifyABC(cumulative: number): "A" | "B" | "C" {
  if (cumulative <= 80) return "A";
  if (cumulative <= 95) return "B";
  return "C";
}
