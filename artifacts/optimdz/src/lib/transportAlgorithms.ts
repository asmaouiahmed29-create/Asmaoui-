// ── Transport Problem — Initial Basic Feasible Solution algorithms ─────────────
// Stage 2: NWC (Northwest Corner), LCM (Least Cost), VAM (Vogel's Approximation)

export interface TransportInput {
  sources:      Array<{ name: string; supply: number }>;
  destinations: Array<{ name: string; demand: number }>;
  costs:        number[][];          // costs[i][j]
  objective:    "minimize" | "maximize";
}

export interface BalancedMatrix {
  sources:          Array<{ name: string; supply: number }>;
  destinations:     Array<{ name: string; demand: number }>;
  costs:            number[][];
  dummySourceIndex: number | null;   // row index of added dummy source (or null)
  dummyDestIndex:   number | null;   // col index of added dummy dest   (or null)
}

export interface AllocationStep {
  i:             number;
  j:             number;
  amount:        number;
  cost:          number;          // unit cost or profit
  contribution:  number;          // amount × cost
  supplyAfter:   number[];        // remaining supply after this step
  demandAfter:   number[];        // remaining demand after this step
  cumulativeCost: number;
  exhaustedRow:  boolean;
  exhaustedCol:  boolean;
  // VAM-only metadata
  penalty?:           number;
  penaltySource?:     "row" | "col";
  penaltyIndex?:      number;
  penaltyRowValues?:  number[];   // penalties for each row at this step
  penaltyColValues?:  number[];   // penalties for each column at this step
}

export interface SolveResult {
  method:     "nwc" | "lcm" | "vam";
  balanced:   BalancedMatrix;
  steps:      AllocationStep[];
  allocation: number[][];         // final m×n allocation matrix
  totalCost:  number;
  isDegenerate: boolean;          // true if # allocations < m+n-1
}

// ── Balance ─────────────────────────────────────────────────────────────────
export function balanceMatrix(input: TransportInput): BalancedMatrix {
  const totalSupply = input.sources.reduce((s, r) => s + r.supply, 0);
  const totalDemand = input.destinations.reduce((s, d) => s + d.demand, 0);

  const sources      = input.sources.map(s => ({ ...s }));
  const destinations = input.destinations.map(d => ({ ...d }));
  let   costs        = input.costs.map(row => [...row]);
  let   dummySourceIndex: number | null = null;
  let   dummyDestIndex:   number | null = null;

  if (totalSupply > totalDemand) {
    dummyDestIndex = destinations.length;
    destinations.push({ name: "Fictive", demand: totalSupply - totalDemand });
    costs = costs.map(row => [...row, 0]);
  } else if (totalDemand > totalSupply) {
    dummySourceIndex = sources.length;
    sources.push({ name: "Fictive", supply: totalDemand - totalSupply });
    costs.push(new Array(destinations.length).fill(0));
  }

  return { sources, destinations, costs, dummySourceIndex, dummyDestIndex };
}

// ── NWC (Northwest Corner Method) ───────────────────────────────────────────
export function solveNWC(input: TransportInput): SolveResult {
  const balanced = balanceMatrix(input);
  const m        = balanced.sources.length;
  const n        = balanced.destinations.length;
  const supply   = balanced.sources.map(s => s.supply);
  const demand   = balanced.destinations.map(d => d.demand);
  const costs    = balanced.costs;

  const allocation = Array.from({ length: m }, () => new Array<number>(n).fill(0));
  const steps: AllocationStep[] = [];
  let   cumulativeCost = 0;
  let   i = 0, j = 0;

  while (i < m && j < n) {
    const amount       = Math.min(supply[i], demand[j]);
    allocation[i][j] += amount;
    supply[i]         -= amount;
    demand[j]         -= amount;
    const contribution = amount * costs[i][j];
    cumulativeCost    += contribution;

    const exhaustedRow = supply[i] === 0;
    const exhaustedCol = demand[j] === 0;

    steps.push({
      i, j, amount, cost: costs[i][j], contribution,
      supplyAfter: [...supply], demandAfter: [...demand],
      cumulativeCost, exhaustedRow, exhaustedCol,
    });

    if (exhaustedRow && exhaustedCol) { i++; j++; }
    else if (exhaustedRow)             { i++; }
    else                               { j++; }
  }

  return {
    method: "nwc", balanced, steps, allocation,
    totalCost: cumulativeCost,
    isDegenerate: steps.length < m + n - 1,
  };
}

// ── LCM (Least Cost Method / Minimum Cost Method) ───────────────────────────
export function solveLCM(input: TransportInput): SolveResult {
  const balanced = balanceMatrix(input);
  const m        = balanced.sources.length;
  const n        = balanced.destinations.length;
  const supply   = balanced.sources.map(s => s.supply);
  const demand   = balanced.destinations.map(d => d.demand);
  const costs    = balanced.costs;
  const isMax    = input.objective === "maximize";

  const allocation = Array.from({ length: m }, () => new Array<number>(n).fill(0));
  const steps: AllocationStep[] = [];
  let   cumulativeCost = 0;
  const rowDone = new Array<boolean>(m).fill(false);
  const colDone = new Array<boolean>(n).fill(false);

  for (let iter = 0; iter < m * n; iter++) {
    // Find best available cell
    let bestI = -1, bestJ = -1;
    let bestCost = isMax ? -Infinity : Infinity;

    for (let ii = 0; ii < m; ii++) {
      if (rowDone[ii]) continue;
      for (let jj = 0; jj < n; jj++) {
        if (colDone[jj]) continue;
        const c = costs[ii][jj];
        if (isMax ? c > bestCost : c < bestCost) {
          bestCost = c; bestI = ii; bestJ = jj;
        }
      }
    }
    if (bestI === -1) break;

    const amount       = Math.min(supply[bestI], demand[bestJ]);
    allocation[bestI][bestJ] += amount;
    supply[bestI]  -= amount;
    demand[bestJ]  -= amount;
    const contribution = amount * costs[bestI][bestJ];
    cumulativeCost    += contribution;

    const exhaustedRow = supply[bestI] === 0;
    const exhaustedCol = demand[bestJ] === 0;

    steps.push({
      i: bestI, j: bestJ, amount, cost: costs[bestI][bestJ], contribution,
      supplyAfter: [...supply], demandAfter: [...demand],
      cumulativeCost, exhaustedRow, exhaustedCol,
    });

    // Mark done — if both exhausted, prefer to mark the row done and keep col
    if (exhaustedRow && exhaustedCol) {
      rowDone[bestI] = true;
      // Keep col alive only if there are other rows with remaining supply
      const otherRowsAlive = supply.some((s, idx) => idx !== bestI && !rowDone[idx] && s > 0);
      if (otherRowsAlive) {
        // col will be resolved in next iteration against another row (degenerate step)
        // For simplicity mark both done; Stage 3 will detect degeneracy
      }
      colDone[bestJ] = true;
    } else if (exhaustedRow) {
      rowDone[bestI] = true;
    } else if (exhaustedCol) {
      colDone[bestJ] = true;
    }
  }

  return {
    method: "lcm", balanced, steps, allocation,
    totalCost: cumulativeCost,
    isDegenerate: steps.length < m + n - 1,
  };
}

// ── VAM (Vogel's Approximation Method) ──────────────────────────────────────
export function solveVAM(input: TransportInput): SolveResult {
  const balanced = balanceMatrix(input);
  const m        = balanced.sources.length;
  const n        = balanced.destinations.length;
  const supply   = balanced.sources.map(s => s.supply);
  const demand   = balanced.destinations.map(d => d.demand);
  const costs    = balanced.costs;
  const isMax    = input.objective === "maximize";

  const allocation = Array.from({ length: m }, () => new Array<number>(n).fill(0));
  const steps: AllocationStep[] = [];
  let   cumulativeCost = 0;
  const rowDone = new Array<boolean>(m).fill(false);
  const colDone = new Array<boolean>(n).fill(false);

  // Compute penalty for a row — returns { penalty, bestJ }
  function rowPenalty(i: number): { penalty: number; bestJ: number } {
    const avail: Array<{ j: number; c: number }> = [];
    for (let j = 0; j < n; j++) {
      if (!colDone[j]) avail.push({ j, c: costs[i][j] });
    }
    if (avail.length === 0) return { penalty: -1, bestJ: -1 };

    avail.sort((a, b) => isMax ? b.c - a.c : a.c - b.c);
    const penalty = avail.length >= 2 ? Math.abs(avail[1].c - avail[0].c) : 0;
    return { penalty, bestJ: avail[0].j };
  }

  // Compute penalty for a column — returns { penalty, bestI }
  function colPenalty(j: number): { penalty: number; bestI: number } {
    const avail: Array<{ i: number; c: number }> = [];
    for (let i = 0; i < m; i++) {
      if (!rowDone[i]) avail.push({ i, c: costs[i][j] });
    }
    if (avail.length === 0) return { penalty: -1, bestI: -1 };

    avail.sort((a, b) => isMax ? b.c - a.c : a.c - b.c);
    const penalty = avail.length >= 2 ? Math.abs(avail[1].c - avail[0].c) : 0;
    return { penalty, bestI: avail[0].i };
  }

  for (let iter = 0; iter < m * n + 10; iter++) {
    let maxPenalty    = -Infinity;
    let allocI        = -1;
    let allocJ        = -1;
    let penaltySource: "row" | "col" = "row";
    let penaltyIndex  = -1;

    // Compute all row penalties
    const penaltyRowValues = new Array<number>(m).fill(-1);
    for (let i = 0; i < m; i++) {
      if (rowDone[i]) continue;
      const { penalty, bestJ } = rowPenalty(i);
      penaltyRowValues[i] = penalty;
      if (penalty > maxPenalty) {
        maxPenalty    = penalty;
        allocI        = i;
        allocJ        = bestJ;
        penaltySource = "row";
        penaltyIndex  = i;
      }
    }

    // Compute all column penalties
    const penaltyColValues = new Array<number>(n).fill(-1);
    for (let j = 0; j < n; j++) {
      if (colDone[j]) continue;
      const { penalty, bestI } = colPenalty(j);
      penaltyColValues[j] = penalty;
      if (penalty > maxPenalty) {
        maxPenalty    = penalty;
        allocI        = bestI;
        allocJ        = j;
        penaltySource = "col";
        penaltyIndex  = j;
      }
    }

    if (allocI < 0 || allocJ < 0) break;

    const amount       = Math.min(supply[allocI], demand[allocJ]);
    allocation[allocI][allocJ] += amount;
    supply[allocI]  -= amount;
    demand[allocJ]  -= amount;
    const contribution = amount * costs[allocI][allocJ];
    cumulativeCost    += contribution;

    const exhaustedRow = supply[allocI] === 0;
    const exhaustedCol = demand[allocJ] === 0;

    steps.push({
      i: allocI, j: allocJ, amount, cost: costs[allocI][allocJ], contribution,
      supplyAfter: [...supply], demandAfter: [...demand],
      cumulativeCost, exhaustedRow, exhaustedCol,
      penalty: maxPenalty, penaltySource, penaltyIndex,
      penaltyRowValues: [...penaltyRowValues],
      penaltyColValues: [...penaltyColValues],
    });

    if (exhaustedRow && exhaustedCol) {
      rowDone[allocI] = true;
      colDone[allocJ] = true;
    } else if (exhaustedRow) {
      rowDone[allocI] = true;
    } else if (exhaustedCol) {
      colDone[allocJ] = true;
    }
  }

  return {
    method: "vam", balanced, steps, allocation,
    totalCost: cumulativeCost,
    isDegenerate: steps.length < m + n - 1,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export const METHOD_META = {
  nwc: {
    labelFr: "Coin Nord-Ouest",
    labelAr: "طريقة الزاوية الشمالية الغربية",
    shortFr: "CNO",
    shortAr: "ز.ش.غ",
    descFr:  "Remplit la matrice depuis le coin supérieur gauche vers le bas-droit, sans tenir compte des coûts.",
    descAr:  "تملأ المصفوفة من الزاوية العلوية اليسرى نحو الأسفل اليمين، بغض النظر عن التكاليف.",
    complexityFr: "O(m+n) — Rapide, solution de départ sous-optimale",
    complexityAr: "O(m+n) — سريع، حل ابتدائي شبه مثالي",
    color:   "border-blue-200 hover:border-blue-400 hover:bg-blue-50/60",
    iconBg:  "bg-blue-100 text-blue-700",
  },
  lcm: {
    labelFr: "Coût Minimum",
    labelAr: "أقل تكلفة",
    shortFr: "CMC",
    shortAr: "أ.ت",
    descFr:  "Alloue toujours à la cellule de coût minimum disponible. Meilleure que CNO en général.",
    descAr:  "تخصص دائماً للخلية ذات الحد الأدنى من التكلفة المتاحة. أفضل من ز.ش.غ بشكل عام.",
    complexityFr: "O(mn·(m+n)) — Bonne qualité, simple à comprendre",
    complexityAr: "O(mn·(m+n)) — جودة جيدة، سهل الفهم",
    color:   "border-amber-200 hover:border-amber-400 hover:bg-amber-50/60",
    iconBg:  "bg-amber-100 text-amber-700",
  },
  vam: {
    labelFr: "Approximation de Vogel",
    labelAr: "تقريب فوغل",
    shortFr: "VAM",
    shortAr: "ف.أ.م",
    descFr:  "Utilise les pénalités de coût pour guider les allocations. Donne souvent la solution optimale directement.",
    descAr:  "يستخدم عقوبات التكلفة لتوجيه التخصيصات. يُعطي غالباً الحل الأمثل مباشرة.",
    complexityFr: "O(mn·(m+n)) — Meilleure qualité initiale, approche l'optimum",
    complexityAr: "O(mn·(m+n)) — أعلى جودة ابتدائية، يقترب من الحل الأمثل",
    color:   "border-green-200 hover:border-green-400 hover:bg-green-50/60",
    iconBg:  "bg-green-100 text-green-700",
  },
} as const;

export type MethodKey = keyof typeof METHOD_META;
