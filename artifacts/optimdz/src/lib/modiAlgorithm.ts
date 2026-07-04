// ── Transport Problem — Stage 3: MODI Optimization ──────────────────────────
// Implements MODI (u-v method) with Stepping Stone loop visualization.
// Handles: degeneracy, alternative optima detection, prohibited routes,
// sensitivity analysis.

import type { BalancedMatrix } from "./transportAlgorithms";

// ── Input / Output types ─────────────────────────────────────────────────────

export interface MODIInput {
  balanced:        BalancedMatrix;
  allocation:      number[][];
  objective:       "minimize" | "maximize";
  prohibitedCells?: { i: number; j: number }[];
  initialMethod:   string;
}

export interface LoopCell {
  i:    number;
  j:    number;
  sign: "+" | "-";
}

export interface MODIIteration {
  iterationNumber:   number;
  allocation:        number[][];
  isBasic:           boolean[][];
  u:                 number[];
  v:                 number[];
  opportunityCosts:  (number | null)[][];
  isOptimal:         boolean;
  enteringCell:      { i: number; j: number } | null;
  leavingCell:       { i: number; j: number } | null;
  loop:              LoopCell[] | null;
  theta:             number | null;
  totalCost:         number;
  epsilonCells:      { i: number; j: number }[];
  degenerateInfo:    string | null;
}

export interface SensitivityRange {
  i:              number;
  j:              number;
  sourceName:     string;
  destName:       string;
  allocation:     number;
  unitCost:       number;
  allowedDecrease: number;
  allowedIncrease: number;
  lowerBound:     number;
  upperBound:     number;
}

export interface MODIResult {
  balanced:                BalancedMatrix;
  initialMethod:           string;
  iterations:              MODIIteration[];
  finalAllocation:         number[][];
  finalCost:               number;
  isOptimal:               boolean;
  hasAlternativeOptima:    boolean;
  alternativeOptimaCells:  { i: number; j: number }[];
  degeneracyHandled:       boolean;
  epsilonCells:            { i: number; j: number }[];
  sensitivityRanges:       SensitivityRange[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EPSILON   = 1e-6;
const INF_COST  = 1e9;
const TOLERANCE = 1e-4;

// ── Helpers ───────────────────────────────────────────────────────────────────

function deepCopy2D(m: number[][]): number[][] {
  return m.map(row => [...row]);
}

function countBasicCells(alloc: number[][], epsilonSet: Set<string>, m: number, n: number): number {
  let count = 0;
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      if (alloc[i][j] > 0 || epsilonSet.has(`${i},${j}`)) count++;
  return count;
}

function makeEpsilonSet(cells: { i: number; j: number }[]): Set<string> {
  return new Set(cells.map(c => `${c.i},${c.j}`));
}

function computeIsBasic(
  alloc: number[][], epsilonSet: Set<string>, m: number, n: number
): boolean[][] {
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      alloc[i][j] > 0 || epsilonSet.has(`${i},${j}`)
    )
  );
}

function computeTotalCost(
  alloc: number[][], costs: number[][], epsilonSet: Set<string>, m: number, n: number
): number {
  let total = 0;
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      if (alloc[i][j] > 0 && !epsilonSet.has(`${i},${j}`))
        total += alloc[i][j] * costs[i][j];
  return Math.round(total * 1e6) / 1e6;
}

// ── Degeneracy Fix ────────────────────────────────────────────────────────────
// Uses union-find on bipartite graph: row nodes 0..m-1, col nodes m..m+n-1.
// Adds ε to zero-valued cells that don't create a cycle in the basic tree.

function fixDegeneracy(
  alloc: number[][], epsilonCells: { i: number; j: number }[], m: number, n: number
): { wasDegenerate: boolean; degenerateInfo: string | null } {
  const required = m + n - 1;

  // Count actual basics (positive alloc)
  const basicCount = alloc.flat().filter(v => v > 0).length;
  if (basicCount >= required) return { wasDegenerate: false, degenerateInfo: null };

  const needed = required - basicCount;

  // Union-find
  const parent = Array.from({ length: m + n }, (_, i) => i);
  const rank   = new Array<number>(m + n).fill(0);

  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }
  function union(a: number, b: number): boolean {
    const ra = find(a), rb = find(b);
    if (ra === rb) return false;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else { parent[rb] = ra; rank[ra]++; }
    return true;
  }

  // Union existing positive-allocation cells
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      if (alloc[i][j] > 0) union(i, m + j);

  // Add epsilon cells to complete the spanning tree
  let added = 0;
  for (let i = 0; i < m && added < needed; i++) {
    for (let j = 0; j < n && added < needed; j++) {
      if (alloc[i][j] === 0) {
        if (union(i, m + j)) {
          epsilonCells.push({ i, j });
          added++;
        }
      }
    }
  }

  const info =
    `Solution dégénérée (${needed} variable${needed > 1 ? "s" : ""} de base manquante${needed > 1 ? "s" : ""}). ` +
    `Une perturbation ε (infiniment petit) a été ajoutée aux cellules ${epsilonCells.map(c => `(${c.i + 1},${c.j + 1})`).join(", ")} ` +
    `pour compléter la base à ${required} variables et permettre la résolution MODI.`;

  return { wasDegenerate: true, degenerateInfo: info };
}

// ── Compute u / v multipliers ─────────────────────────────────────────────────
// BFS on basic cells: u[0]=0, then u[i]+v[j]=c[i][j] for each basic (i,j).

function computeUV(
  isBasic: boolean[][], costs: number[][], m: number, n: number
): { u: number[]; v: number[] } {
  const u: (number | undefined)[] = new Array(m).fill(undefined);
  const v: (number | undefined)[] = new Array(n).fill(undefined);
  u[0] = 0;

  let changed = true;
  let guard = 0;
  while (changed && guard++ < m * n * 2) {
    changed = false;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (!isBasic[i][j]) continue;
        if (u[i] !== undefined && v[j] === undefined) {
          v[j] = costs[i][j] - u[i]!;
          changed = true;
        } else if (v[j] !== undefined && u[i] === undefined) {
          u[i] = costs[i][j] - v[j]!;
          changed = true;
        }
      }
    }
  }
  // Fill any still-undefined (disconnected component — shouldn't happen post-degeneracy fix)
  for (let i = 0; i < m; i++) if (u[i] === undefined) u[i] = 0;
  for (let j = 0; j < n; j++) if (v[j] === undefined) v[j] = 0;

  return { u: u as number[], v: v as number[] };
}

// ── Opportunity costs ─────────────────────────────────────────────────────────
// d[i][j] = c[i][j] - u[i] - v[j] for non-basic cells; null for basic.

function computeOpportunityCosts(
  isBasic: boolean[][], costs: number[],
  u: number[], v: number[],
  m: number, n: number
): (number | null)[][] {
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      isBasic[i][j] ? null : Math.round((costs[i * n + j] - u[i] - v[j]) * 1e6) / 1e6
    )
  );
}

// ── Find entering cell ────────────────────────────────────────────────────────
// Minimization: most negative d[i][j]. Maximization: most positive d[i][j].

function findEntering(
  oppCosts: (number | null)[][], m: number, n: number, isMax: boolean
): { i: number; j: number } | null {
  let best: { i: number; j: number } | null = null;
  let bestVal = isMax ? -Infinity : Infinity;

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      const d = oppCosts[i][j];
      if (d === null) continue;
      if (isMax ? d > TOLERANCE : d < -TOLERANCE) {
        if (isMax ? d > bestVal : d < bestVal) {
          bestVal = d;
          best = { i, j };
        }
      }
    }
  }
  return best;
}

// ── Find stepping stone loop ───────────────────────────────────────────────────
// Uses bipartite spanning tree BFS: row nodes 0..m-1, col nodes m..m+n-1.
// Adding the entering edge (r0,c0) creates exactly one cycle in the tree.

function findLoop(
  r0: number, c0: number, isBasic: boolean[][], m: number, n: number
): LoopCell[] | null {
  const totalNodes = m + n;
  const adj: Array<Array<{ neighbor: number; i: number; j: number }>> =
    Array.from({ length: totalNodes }, () => []);

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (isBasic[i][j]) {
        adj[i].push({ neighbor: m + j, i, j });
        adj[m + j].push({ neighbor: i, i, j });
      }
    }
  }

  // BFS from row node r0 to col node (m + c0)
  const parent = new Map<number, { from: number; cell: { i: number; j: number } }>();
  const queue: number[] = [r0];
  const visited = new Set<number>([r0]);

  bfs: while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === m + c0) break bfs;
    for (const { neighbor, i, j } of adj[curr]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, { from: curr, cell: { i, j } });
        queue.push(neighbor);
      }
    }
  }

  if (!parent.has(m + c0)) return null;

  // Reconstruct path: (m+c0) → ... → r0
  const pathCells: { i: number; j: number }[] = [];
  let curr = m + c0;
  while (parent.has(curr)) {
    const p = parent.get(curr)!;
    pathCells.push(p.cell);
    curr = p.from;
  }
  pathCells.reverse();

  // Loop = [entering cell, ...path cells], signs alternate +, -, +, -, ...
  const loop: LoopCell[] = [{ i: r0, j: c0, sign: "+" }, ...pathCells.map((c, idx) => ({
    ...c,
    sign: (idx % 2 === 0 ? "-" : "+") as "+" | "-",
  }))];

  return loop;
}

// ── Sensitivity analysis ──────────────────────────────────────────────────────
// For each basic route (i,j), compute how much c[i][j] can change before
// the current basis becomes sub-optimal.

function computeSensitivity(
  alloc: number[][],
  isBasic: boolean[][],
  oppCosts: (number | null)[][],
  origCosts: number[][],
  balanced: BalancedMatrix,
  epsilonSet: Set<string>,
  m: number,
  n: number
): SensitivityRange[] {
  const ranges: SensitivityRange[] = [];

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (!isBasic[i][j] || epsilonSet.has(`${i},${j}`)) continue;
      if (alloc[i][j] <= 0) continue;

      // Allowable increase: if u[i] increases by Δ, non-basic cells in row i decrease
      // → Δ_increase = min(d[i][k] for non-basic k in row i)
      let minInRow = Infinity;
      for (let k = 0; k < n; k++) {
        const d = oppCosts[i][k];
        if (d !== null) minInRow = Math.min(minInRow, d);
      }

      // Allowable decrease: if v[j] decreases by δ, non-basic cells in col j decrease
      // → δ_decrease = min(d[k][j] for non-basic k in col j)
      let minInCol = Infinity;
      for (let k = 0; k < m; k++) {
        const d = oppCosts[k][j];
        if (d !== null) minInCol = Math.min(minInCol, d);
      }

      const allowedIncrease = isFinite(minInRow) ? Math.max(0, minInRow) : Infinity;
      const allowedDecrease = isFinite(minInCol) ? Math.max(0, minInCol) : Infinity;
      const c = origCosts[i][j];

      ranges.push({
        i, j,
        sourceName:     balanced.sources[i].name,
        destName:       balanced.destinations[j].name,
        allocation:     alloc[i][j],
        unitCost:       c,
        allowedDecrease,
        allowedIncrease,
        lowerBound:     c - allowedDecrease,
        upperBound:     allowedIncrease === Infinity ? Infinity : c + allowedIncrease,
      });
    }
  }

  return ranges;
}

// ── Main MODI solver ──────────────────────────────────────────────────────────

export function runMODI(input: MODIInput): MODIResult {
  const { balanced, objective, prohibitedCells = [], initialMethod } = input;
  const isMax = objective === "maximize";
  const m = balanced.sources.length;
  const n = balanced.destinations.length;

  // Deep copy costs so we can apply prohibited-route penalties
  const costs = balanced.costs.map(row => [...row]);
  for (const { i, j } of prohibitedCells) {
    if (i < m && j < n) costs[i][j] = isMax ? -INF_COST : INF_COST;
  }

  // Flat cost array for opportunity cost helper
  const flatCosts = () => {
    const flat: number[] = [];
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) flat.push(costs[i][j]);
    return flat;
  };

  // Work with a deep copy of allocation
  const alloc = deepCopy2D(input.allocation);
  const epsilonCells: { i: number; j: number }[] = [];

  // Fix degeneracy (modifies alloc in place — adds EPSILON to chosen cells)
  const { wasDegenerate, degenerateInfo } = fixDegeneracy(alloc, epsilonCells, m, n);
  // Note: fixDegeneracy uses union-find to choose cells, but doesn't actually
  // set alloc[i][j] = EPSILON — we track them separately in epsilonCells.
  // We must NOT set alloc values to epsilon; isBasic uses epsilonSet to override.

  const MAX_ITER = 200;
  const iterations: MODIIteration[] = [];
  let firstIter = true;

  for (let iter = 0; iter <= MAX_ITER; iter++) {
    const epsilonSet = makeEpsilonSet(epsilonCells);
    const isBasic = computeIsBasic(alloc, epsilonSet, m, n);
    const { u, v } = computeUV(isBasic, costs, m, n);
    const flat = flatCosts();
    const oppCosts = computeOpportunityCosts(isBasic, flat, u, v, m, n);
    const totalCost = computeTotalCost(alloc, costs, epsilonSet, m, n);
    const entering = findEntering(oppCosts, m, n, isMax);
    const isOptimal = entering === null;

    const iterObj: MODIIteration = {
      iterationNumber: iter,
      allocation: deepCopy2D(alloc),
      isBasic,
      u, v,
      opportunityCosts: oppCosts,
      isOptimal,
      enteringCell: entering,
      leavingCell: null,
      loop: null,
      theta: null,
      totalCost,
      epsilonCells: [...epsilonCells],
      degenerateInfo: firstIter ? degenerateInfo : null,
    };
    firstIter = false;

    if (isOptimal) {
      iterations.push(iterObj);
      break;
    }

    // Find stepping stone loop
    const loop = findLoop(entering.i, entering.j, isBasic, m, n);
    if (!loop) {
      // Should not happen with valid basis — bail out
      iterObj.isOptimal = true;
      iterations.push(iterObj);
      break;
    }

    // Compute theta
    const minusCells = loop.filter(c => c.sign === "-");
    const theta = Math.min(...minusCells.map(c => alloc[c.i][c.j]));
    // Leaving cell: first minus cell achieving theta (prefer non-epsilon)
    const leaving =
      minusCells.find(c => alloc[c.i][c.j] === theta && !epsilonCells.some(e => e.i === c.i && e.j === c.j))
      ?? minusCells.find(c => alloc[c.i][c.j] === theta)!;

    iterObj.loop = loop;
    iterObj.theta = theta;
    iterObj.leavingCell = { i: leaving.i, j: leaving.j };
    iterations.push(iterObj);

    // Update allocation along loop
    for (const cell of loop) {
      if (cell.sign === "+") alloc[cell.i][cell.j] += theta;
      else alloc[cell.i][cell.j] = Math.max(0, alloc[cell.i][cell.j] - theta);
    }

    // Update epsilon tracking: leaving cell exits basis
    const lIdx = epsilonCells.findIndex(e => e.i === leaving.i && e.j === leaving.j);
    if (lIdx >= 0) epsilonCells.splice(lIdx, 1);
    // If theta=0 (degenerate pivot): entering cell has 0 allocation, so we treat it as epsilon
    if (Math.abs(theta) < TOLERANCE) {
      epsilonCells.push({ i: entering.i, j: entering.j });
    }
  }

  // Final state
  const finalIter = iterations[iterations.length - 1];
  const finalAlloc = finalIter.allocation;
  const finalOppCosts = finalIter.opportunityCosts;
  const finalEpsilonSet = makeEpsilonSet(finalIter.epsilonCells);

  // Alternative optima: non-basic cells with d[i][j] ≈ 0
  const altOptimaCells: { i: number; j: number }[] = [];
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      const d = finalOppCosts[i][j];
      if (d !== null && Math.abs(d) < TOLERANCE) {
        altOptimaCells.push({ i, j });
      }
    }
  }

  // Sensitivity (use original costs, not modified ones)
  const sensitivity = computeSensitivity(
    finalAlloc, finalIter.isBasic, finalOppCosts,
    balanced.costs, balanced, finalEpsilonSet, m, n
  );

  return {
    balanced,
    initialMethod,
    iterations,
    finalAllocation: finalAlloc,
    finalCost: finalIter.totalCost,
    isOptimal: finalIter.isOptimal,
    hasAlternativeOptima: altOptimaCells.length > 0,
    alternativeOptimaCells: altOptimaCells,
    degeneracyHandled: wasDegenerate,
    epsilonCells: finalIter.epsilonCells,
    sensitivityRanges: sensitivity,
  };
}
