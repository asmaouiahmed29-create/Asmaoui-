// ── Assignment Problem — Stage 2: Hungarian Method (Kuhn-Munkres) ────────────
// Implements the classic textbook "matrix reduction + minimum line covering"
// version of the Hungarian algorithm, producing a full step-by-step trace
// suitable for pedagogical visualization (mirrors modiAlgorithm.ts patterns).
//
// Handles: non-square matrices (dummy row/col padding), forbidden cells
// (treated as near-infinite cost), maximize→minimize conversion, and
// alternative-optima detection.

import type { AssignmentProblem } from "./AssignmentContext";

// ── Constants ─────────────────────────────────────────────────────────────────
const INF_COST = 1e7;      // "forbidden" cell cost — large but finite, avoids NaN
const TOLERANCE = 1e-6;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface HungarianCell { i: number; j: number; }

export interface HungarianIteration {
  iterationNumber: number;
  matrix:          number[][];   // reduced-cost matrix state at this point
  rowCovered:      boolean[];
  colCovered:      boolean[];
  lineCount:       number;
  isOptimal:       boolean;      // lineCount === N
  minUncovered:    number | null; // value that will be subtracted/added next (null if optimal)
  matchingZeros:   HungarianCell[]; // current max matching on the zero-cells
}

export interface HungarianResult {
  N:                      number;
  m:                      number;   // original # resources
  n:                      number;   // original # tasks
  isMax:                  boolean;
  maxVal:                 number;
  resourceNames:          string[]; // length N (padded with "— (fictive)" labels)
  taskNames:              string[]; // length N
  originalCosts:          number[][]; // N×N, real values for real cells, 0 for dummy cells
  forbidden:              boolean[][]; // N×N
  workingMatrixInitial:   number[][]; // after transform + forbidden substitution, before reduction
  rowMins:                number[];
  rowReducedMatrix:       number[][];
  colMins:                number[];
  colReducedMatrix:       number[][]; // == iterations[0].matrix
  iterations:             HungarianIteration[];
  finalAssignment:        HungarianCell[]; // N pairs, i -> j
  totalCostReal:          number;    // sum of ORIGINAL (untransformed) costs for real pairs
  unassignedResources:    number[];  // real resource indices (< m) matched to a dummy task
  unassignedTasks:        number[];  // real task indices (< n) matched to a dummy resource
  hasAlternativeOptima:   boolean;
  alternativeZeroCells:   HungarianCell[]; // unused zero cells in the final reduced matrix
  isInfeasible:           boolean;   // true if the optimal assignment had to use a forbidden cell
}

// ── Bipartite max matching + König min vertex cover on zero-cells ────────────
function findMinLineCover(
  isZero: boolean[][], N: number
): { rowCovered: boolean[]; colCovered: boolean[]; matching: HungarianCell[] } {
  const matchCol = new Array<number>(N).fill(-1); // matchCol[j] = matched row
  const matchRow = new Array<number>(N).fill(-1); // matchRow[i] = matched col

  function tryAugment(i: number, visited: boolean[]): boolean {
    for (let j = 0; j < N; j++) {
      if (isZero[i][j] && !visited[j]) {
        visited[j] = true;
        if (matchCol[j] === -1 || tryAugment(matchCol[j], visited)) {
          matchCol[j] = i;
          matchRow[i] = j;
          return true;
        }
      }
    }
    return false;
  }

  for (let i = 0; i < N; i++) {
    const visited = new Array<boolean>(N).fill(false);
    tryAugment(i, visited);
  }

  const matching: HungarianCell[] = [];
  for (let i = 0; i < N; i++) if (matchRow[i] !== -1) matching.push({ i, j: matchRow[i] });

  // König's algorithm: alternating-path marking from unmatched rows
  const rowMarked = new Array<boolean>(N).fill(false);
  const colMarked = new Array<boolean>(N).fill(false);
  const queue: number[] = [];

  for (let i = 0; i < N; i++) {
    if (matchRow[i] === -1) { rowMarked[i] = true; queue.push(i); }
  }

  let qi = 0;
  while (qi < queue.length) {
    const i = queue[qi++];
    for (let j = 0; j < N; j++) {
      if (isZero[i][j] && !colMarked[j]) {
        colMarked[j] = true;
        const matchedRow = matchCol[j];
        if (matchedRow !== -1 && !rowMarked[matchedRow]) {
          rowMarked[matchedRow] = true;
          queue.push(matchedRow);
        }
      }
    }
  }

  // Min vertex cover = unmarked rows ∪ marked columns
  const rowCovered = rowMarked.map(v => !v);
  const colCovered = colMarked.slice();

  return { rowCovered, colCovered, matching };
}

function deepCopy(m: number[][]): number[][] {
  return m.map(row => [...row]);
}

// ── Main solver ───────────────────────────────────────────────────────────────
export function runHungarian(problem: AssignmentProblem): HungarianResult {
  const m = problem.resources.length;
  const n = problem.tasks.length;
  const N = Math.max(m, n);
  const isMax = problem.objectiveType === "maximize";

  // ── Build padded N×N structures ──────────────────────────────────────────
  const resourceNames = Array.from({ length: N }, (_, i) =>
    i < m ? problem.resources[i].name : `— (fictive ${i - m + 1})`
  );
  const taskNames = Array.from({ length: N }, (_, j) =>
    j < n ? problem.tasks[j].name : `— (fictive ${j - n + 1})`
  );

  const originalCosts: number[][] = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => (i < m && j < n ? problem.costs[i][j] : 0))
  );
  const forbidden: boolean[][] = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => (i < m && j < n ? !!problem.forbidden[i]?.[j] : false))
  );

  // maxVal for maximize→minimize conversion (based on real, non-forbidden cells)
  let maxVal = 0;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (!forbidden[i][j]) maxVal = Math.max(maxVal, originalCosts[i][j]);
    }
  }

  const workingMatrixInitial: number[][] = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => {
      const isDummy = i >= m || j >= n;
      if (isDummy) return 0;
      if (forbidden[i][j]) return INF_COST;
      return isMax ? maxVal - originalCosts[i][j] : originalCosts[i][j];
    })
  );

  // ── Row reduction ──────────────────────────────────────────────────────────
  const rowMins = workingMatrixInitial.map(row => Math.min(...row));
  const rowReducedMatrix = workingMatrixInitial.map((row, i) => row.map(v => v - rowMins[i]));

  // ── Column reduction ─────────────────────────────────────────────────────
  const colMins = Array.from({ length: N }, (_, j) =>
    Math.min(...rowReducedMatrix.map(row => row[j]))
  );
  const colReducedMatrix = rowReducedMatrix.map(row => row.map((v, j) => v - colMins[j]));

  // ── Covering / adjustment loop ───────────────────────────────────────────
  const iterations: HungarianIteration[] = [];
  let current = deepCopy(colReducedMatrix);
  let iterNum = 0;
  let finalMatching: HungarianCell[] = [];

  const MAX_ITER = N * N + 20;
  for (let guard = 0; guard < MAX_ITER; guard++) {
    const isZero = current.map(row => row.map(v => Math.abs(v) < TOLERANCE));
    const { rowCovered, colCovered, matching } = findMinLineCover(isZero, N);
    const lineCount = rowCovered.filter(Boolean).length + colCovered.filter(Boolean).length;
    const isOptimal = lineCount >= N;

    if (isOptimal) {
      iterations.push({
        iterationNumber: iterNum,
        matrix: deepCopy(current),
        rowCovered, colCovered, lineCount,
        isOptimal: true,
        minUncovered: null,
        matchingZeros: matching,
      });
      finalMatching = matching;
      break;
    }

    // Find smallest uncovered value
    let minUncovered = Infinity;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (!rowCovered[i] && !colCovered[j]) {
          minUncovered = Math.min(minUncovered, current[i][j]);
        }
      }
    }

    iterations.push({
      iterationNumber: iterNum,
      matrix: deepCopy(current),
      rowCovered, colCovered, lineCount,
      isOptimal: false,
      minUncovered,
      matchingZeros: matching,
    });

    // Adjust: subtract from uncovered, add to doubly-covered
    const next = current.map((row, i) =>
      row.map((v, j) => {
        const rc = rowCovered[i], cc = colCovered[j];
        if (!rc && !cc) return v - minUncovered;
        if (rc && cc) return v + minUncovered;
        return v;
      })
    );
    current = next;
    iterNum++;
  }

  if (finalMatching.length < N) {
    // Extremely defensive fallback — should not happen given the algorithm's
    // correctness guarantees, but never leave the result half-built.
    const isZero = current.map(row => row.map(v => Math.abs(v) < TOLERANCE));
    const { matching } = findMinLineCover(isZero, N);
    finalMatching = matching;
  }

  // ── Extract assignment ───────────────────────────────────────────────────
  const finalAssignment = [...finalMatching].sort((a, b) => a.i - b.i);

  let totalCostReal = 0;
  let isInfeasible = false;
  const unassignedResources: number[] = [];
  const unassignedTasks: number[] = [];

  for (const { i, j } of finalAssignment) {
    const isRealResource = i < m;
    const isRealTask = j < n;
    if (isRealResource && isRealTask) {
      if (forbidden[i][j]) isInfeasible = true;
      totalCostReal += originalCosts[i][j];
    } else if (isRealResource && !isRealTask) {
      unassignedResources.push(i);
    } else if (!isRealResource && isRealTask) {
      unassignedTasks.push(j);
    }
  }
  unassignedResources.sort((a, b) => a - b);
  unassignedTasks.sort((a, b) => a - b);

  // ── Alternative optima: zero cells in the final matrix not used by the matching ──
  const finalIter = iterations[iterations.length - 1];
  const usedSet = new Set(finalAssignment.map(c => `${c.i},${c.j}`));
  // Only consider cells between REAL resources and REAL tasks: dummy rows/cols are
  // always zero-cost by construction, so any unused zero involving a dummy row/col
  // is trivial and would falsely flag alternative optima on every unbalanced problem.
  const alternativeZeroCells: HungarianCell[] = [];
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (Math.abs(finalIter.matrix[i][j]) < TOLERANCE && !usedSet.has(`${i},${j}`) && !forbidden[i][j]) {
        alternativeZeroCells.push({ i, j });
      }
    }
  }

  return {
    N, m, n, isMax, maxVal,
    resourceNames, taskNames,
    originalCosts, forbidden,
    workingMatrixInitial,
    rowMins, rowReducedMatrix,
    colMins, colReducedMatrix,
    iterations,
    finalAssignment,
    totalCostReal,
    unassignedResources,
    unassignedTasks,
    hasAlternativeOptima: alternativeZeroCells.length > 0,
    alternativeZeroCells,
    isInfeasible,
  };
}
