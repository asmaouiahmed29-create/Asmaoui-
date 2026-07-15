// ── PERT/CPM Algorithm ──────────────────────────────────────────────────────
// Pure computation: no React, no UI. Used by PertCpm.tsx.

export type PertMode = "CPM" | "PERT";

export interface Activity {
  id: string;
  name: string;
  // CPM
  duration?: number;
  // PERT
  optimistic?: number;
  mostLikely?: number;
  pessimistic?: number;
  predecessors: string[];
  // Crashing (stored for future use, not computed yet)
  normalCost?: number;
  crashDuration?: number;
  crashCost?: number;
}

export interface ActivityResult {
  id: string;
  name: string;
  duration: number;          // effective duration used in computation
  expectedDuration?: number; // PERT: tₑ = (O + 4M + P) / 6
  variance?: number;         // PERT: σ² = ((P − O) / 6)²
  ES: number;
  EF: number;
  LS: number;
  LF: number;
  slack: number;
  isCritical: boolean;
}

export interface PertCpmResult {
  activities: ActivityResult[];   // in topological order
  criticalPath: string[];         // IDs of critical activities in order
  projectDuration: number;
  // PERT only
  projectVariance?: number;
  projectStdDev?: number;
}

// ── Cycle detection (DFS on predecessor graph) ───────────────────────────────
// Returns the IDs forming the cycle, or [] if no cycle.
export function detectCycles(activities: Activity[]): string[] {
  const ids = new Set(activities.map((a) => a.id));
  const adj = new Map<string, string[]>(); // id → predecessor ids (filtered to known)
  for (const a of activities) {
    adj.set(a.id, a.predecessors.filter((p) => ids.has(p)));
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const a of activities) color.set(a.id, WHITE);
  const path: string[] = [];

  function dfs(id: string): string[] | null {
    color.set(id, GRAY);
    path.push(id);
    for (const pred of adj.get(id) ?? []) {
      if (color.get(pred) === GRAY) {
        const start = path.indexOf(pred);
        return [...path.slice(start), pred];
      }
      if (color.get(pred) === WHITE) {
        const res = dfs(pred);
        if (res) return res;
      }
    }
    path.pop();
    color.set(id, BLACK);
    return null;
  }

  for (const a of activities) {
    if (color.get(a.id) === WHITE) {
      const cycle = dfs(a.id);
      if (cycle) return cycle;
    }
  }
  return [];
}

// ── Main computation ─────────────────────────────────────────────────────────
export function computePertCpm(
  activities: Activity[],
  mode: PertMode
): PertCpmResult {
  if (activities.length === 0)
    return { activities: [], criticalPath: [], projectDuration: 0 };

  const ids = new Set(activities.map((a) => a.id));

  // ── Effective durations ────────────────────────────────────────────────────
  const durMap    = new Map<string, number>();
  const teMap     = new Map<string, number>();
  const varMap    = new Map<string, number>();

  for (const a of activities) {
    if (mode === "PERT") {
      const O = a.optimistic  ?? 0;
      const M = a.mostLikely  ?? 0;
      const P = a.pessimistic ?? 0;
      const te = (O + 4 * M + P) / 6;
      const v  = Math.pow((P - O) / 6, 2);
      teMap.set(a.id, te);
      varMap.set(a.id, v);
      durMap.set(a.id, te);
    } else {
      durMap.set(a.id, a.duration ?? 0);
    }
  }

  // ── Build adjacency (pred → [succs]) ─────────────────────────────────────
  const succsOf  = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const a of activities) {
    succsOf.set(a.id, []);
    inDegree.set(a.id, 0);
  }
  for (const a of activities) {
    for (const p of a.predecessors.filter((p) => ids.has(p))) {
      succsOf.get(p)!.push(a.id);
      inDegree.set(a.id, (inDegree.get(a.id) ?? 0) + 1);
    }
  }

  // ── Topological sort (Kahn's) ─────────────────────────────────────────────
  const queue = activities
    .filter((a) => (inDegree.get(a.id) ?? 0) === 0)
    .map((a) => a.id);
  const topo: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    topo.push(id);
    for (const succ of succsOf.get(id) ?? []) {
      const d = (inDegree.get(succ) ?? 0) - 1;
      inDegree.set(succ, d);
      if (d === 0) queue.push(succ);
    }
  }

  // ── Forward pass ──────────────────────────────────────────────────────────
  const ES = new Map<string, number>();
  const EF = new Map<string, number>();
  for (const id of topo) {
    const a = activities.find((x) => x.id === id)!;
    const preds = a.predecessors.filter((p) => ids.has(p));
    const es = preds.length > 0 ? Math.max(...preds.map((p) => EF.get(p) ?? 0)) : 0;
    ES.set(id, es);
    EF.set(id, es + (durMap.get(id) ?? 0));
  }

  const projectDuration = Math.max(...[...EF.values()], 0);

  // ── Backward pass ─────────────────────────────────────────────────────────
  const LF = new Map<string, number>();
  const LS = new Map<string, number>();
  for (const id of [...topo].reverse()) {
    const succs = succsOf.get(id) ?? [];
    const lf =
      succs.length > 0
        ? Math.min(...succs.map((s) => LS.get(s) ?? projectDuration))
        : projectDuration;
    LF.set(id, lf);
    LS.set(id, lf - (durMap.get(id) ?? 0));
  }

  // ── Assemble results ──────────────────────────────────────────────────────
  const results: ActivityResult[] = topo.map((id) => {
    const a = activities.find((x) => x.id === id)!;
    const slack = (LS.get(id) ?? 0) - (ES.get(id) ?? 0);
    return {
      id,
      name: a.name,
      duration: durMap.get(id) ?? 0,
      expectedDuration: mode === "PERT" ? teMap.get(id) : undefined,
      variance:         mode === "PERT" ? varMap.get(id) : undefined,
      ES: ES.get(id) ?? 0,
      EF: EF.get(id) ?? 0,
      LS: LS.get(id) ?? 0,
      LF: LF.get(id) ?? 0,
      slack,
      isCritical: Math.abs(slack) < 0.0001,
    };
  });

  const criticalPath = topo.filter(
    (id) => results.find((r) => r.id === id)?.isCritical
  );

  // ── PERT project statistics ───────────────────────────────────────────────
  let projectVariance: number | undefined;
  let projectStdDev:   number | undefined;
  if (mode === "PERT") {
    projectVariance = criticalPath.reduce(
      (sum, id) => sum + (varMap.get(id) ?? 0),
      0
    );
    projectStdDev = Math.sqrt(projectVariance);
  }

  return { activities: results, criticalPath, projectDuration, projectVariance, projectStdDev };
}

// ── Standard normal CDF (Abramowitz & Stegun, error < 7.5×10⁻⁸) ─────────────
export function normalCDF(z: number): number {
  if (z >  8) return 1;
  if (z < -8) return 0;
  const p  = 0.2316419;
  const b1 =  0.319381530;
  const b2 = -0.356563782;
  const b3 =  1.781477937;
  const b4 = -1.821255978;
  const b5 =  1.330274429;
  const absZ = Math.abs(z);
  const t    = 1.0 / (1.0 + p * absZ);
  const poly = ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t;
  const pdf  = Math.exp(-0.5 * absZ * absZ) / Math.sqrt(2 * Math.PI);
  const cdf  = 1.0 - pdf * poly;
  return z >= 0 ? cdf : 1.0 - cdf;
}

// ── Number formatter ──────────────────────────────────────────────────────────
export function fmt(n: number): string {
  if (!isFinite(n)) return "—";
  if (Number.isInteger(n)) return n.toString();
  return parseFloat(n.toFixed(2)).toString();
}

// ── Crashing (Project Compression) ───────────────────────────────────────────

export interface CrashStep {
  iteration: number;
  activityId: string;         // may be "A+B" for multi-activity parallel crash
  activityName: string;
  crashedBy: number;          // always 1 unit per step
  costSlope: number;          // cost per unit for chosen activity (or sum for multi)
  addedDirectCost: number;    // costSlope × crashedBy
  totalDirectCost: number;    // cumulative direct cost after this step
  newDuration: number;        // project duration after this step
  criticalPath: string[];
  overheadCost?: number;      // dailyOverhead × newDuration
  totalCost?: number;         // totalDirectCost + overheadCost
}

export interface CrashResult {
  originalDuration: number;
  originalDirectCost: number;
  originalOverheadCost?: number;
  originalTotalCost?: number;
  targetDuration: number;
  achievedDuration: number;
  isTargetAchieved: boolean;
  cannotCrashFurther: boolean;
  steps: CrashStep[];
  minCostPoint?: { duration: number; totalCost: number; stepIdx: number };
}

export function computeCrashing(
  activities: Activity[],
  targetDuration: number,
  dailyOverhead?: number,
): CrashResult {
  if (activities.length === 0 || !activities.every(
    (a) => a.normalCost !== undefined && a.crashDuration !== undefined && a.crashCost !== undefined
  )) {
    throw new Error("All activities must have normalCost, crashDuration, crashCost");
  }

  // Working state
  const curDur    = new Map<string, number>();
  const minDur    = new Map<string, number>();
  const costSlope = new Map<string, number>();
  let totalDirectCost = 0;

  for (const a of activities) {
    const nd  = a.duration ?? 0;
    const cd  = a.crashDuration!;
    const nc  = a.normalCost!;
    const cc  = a.crashCost!;
    curDur.set(a.id, nd);
    minDur.set(a.id, cd);
    const slope = nd > cd && cc > nc ? (cc - nc) / (nd - cd) : Infinity;
    costSlope.set(a.id, slope);
    totalDirectCost += nc;
  }

  const mkList = () => activities.map((a) => ({ ...a, duration: curDur.get(a.id)! }));

  const initResult    = computePertCpm(mkList(), "CPM");
  const originalDur   = initResult.projectDuration;

  const noOverhead    = dailyOverhead === undefined;
  const origOverhead  = noOverhead ? undefined : dailyOverhead * originalDur;
  const origTotal     = noOverhead ? undefined : totalDirectCost + origOverhead!;

  if (originalDur <= targetDuration) {
    return {
      originalDuration: originalDur, originalDirectCost: totalDirectCost,
      originalOverheadCost: origOverhead, originalTotalCost: origTotal,
      targetDuration, achievedDuration: originalDur,
      isTargetAchieved: true, cannotCrashFurther: false, steps: [],
    };
  }

  const steps: CrashStep[] = [];
  let accumulated = totalDirectCost;
  let cannotCrash = false;
  const MAX_ITER = 300;

  for (let i = 0; i < MAX_ITER; i++) {
    const cpm = computePertCpm(mkList(), "CPM");
    if (cpm.projectDuration <= targetDuration) break;

    const critIds = new Set(cpm.activities.filter((r) => r.isCritical).map((r) => r.id));

    // Build successor map within critical subgraph
    const critSucc = new Map<string, string[]>();
    for (const id of critIds) critSucc.set(id, []);
    for (const a of activities) {
      if (!critIds.has(a.id)) continue;
      for (const p of a.predecessors.filter((p) => critIds.has(p)))
        critSucc.get(p)!.push(a.id);
    }

    // Enumerate all critical paths via DFS
    const critSources = [...critIds].filter(
      (id) => !activities.find((a) => a.id === id)!.predecessors.some((p) => critIds.has(p))
    );
    const allPaths: string[][] = [];
    const dfs = (id: string, path: string[]) => {
      const next = [...path, id];
      const succs = critSucc.get(id) ?? [];
      if (succs.length === 0) allPaths.push(next);
      else succs.forEach((s) => dfs(s, next));
    };
    for (const src of critSources) dfs(src, []);
    if (allPaths.length === 0) { cannotCrash = true; break; }

    // Activities that appear in EVERY critical path (shared ⟹ single crash reduces all paths)
    const sharedIds = allPaths[0].filter((id) => allPaths.every((p) => p.includes(id)));

    const isCrashable = (id: string) =>
      (curDur.get(id) ?? 0) > (minDur.get(id) ?? 0) &&
      (costSlope.get(id) ?? Infinity) < Infinity;

    const cheapest = (ids: string[]) =>
      [...ids].filter(isCrashable).sort(
        (a, b) => (costSlope.get(a) ?? Infinity) - (costSlope.get(b) ?? Infinity)
      );

    const sharedCrashable = cheapest(sharedIds);

    let chosenIds: string[];

    if (sharedCrashable.length > 0) {
      // Pick cheapest shared critical activity → reduces ALL paths by 1
      chosenIds = [sharedCrashable[0]];
    } else {
      // Multiple parallel paths with no shared crashable activity.
      // Pick cheapest coverage: one crashable activity per parallel path.
      const covered = new Set<number>();
      chosenIds = [];
      const allCrashable = cheapest([...critIds]);
      if (allCrashable.length === 0) { cannotCrash = true; break; }

      for (const id of allCrashable) {
        const covers = allPaths.reduce<number[]>(
          (acc, path, pi) => { if (path.includes(id)) acc.push(pi); return acc; }, []
        );
        if (covers.some((pi) => !covered.has(pi))) {
          chosenIds.push(id);
          covers.forEach((pi) => covered.add(pi));
        }
        if (covered.size === allPaths.length) break;
      }
      if (chosenIds.length === 0) { cannotCrash = true; break; }
    }

    // Crash each chosen activity by 1 unit
    let stepCost = 0;
    for (const id of chosenIds) {
      curDur.set(id, curDur.get(id)! - 1);
      stepCost += costSlope.get(id)!;
    }
    accumulated += stepCost;

    const newCpm      = computePertCpm(mkList(), "CPM");
    const newDur      = newCpm.projectDuration;
    const overhead    = noOverhead ? undefined : dailyOverhead * newDur;
    const total       = noOverhead ? undefined : accumulated + overhead!;

    steps.push({
      iteration: steps.length + 1,
      activityId:       chosenIds.join("+"),
      activityName:     chosenIds.map((id) => activities.find((a) => a.id === id)?.name ?? id).join(" + "),
      crashedBy:        1,
      costSlope:        stepCost,
      addedDirectCost:  stepCost,
      totalDirectCost:  accumulated,
      newDuration:      newDur,
      criticalPath:     newCpm.criticalPath,
      overheadCost:     overhead,
      totalCost:        total,
    });
  }

  const achieved = steps.length > 0 ? steps[steps.length - 1].newDuration : originalDur;

  // Find minimum total cost point (only meaningful when overhead provided)
  let minCostPoint: CrashResult["minCostPoint"];
  if (!noOverhead) {
    const pts = [
      { duration: originalDur, totalCost: origTotal!, stepIdx: 0 },
      ...steps.map((s, si) => ({ duration: s.newDuration, totalCost: s.totalCost!, stepIdx: si + 1 })),
    ];
    minCostPoint = pts.reduce((min, p) => p.totalCost < min.totalCost ? p : min);
  }

  return {
    originalDuration: originalDur,
    originalDirectCost: totalDirectCost,
    originalOverheadCost: origOverhead,
    originalTotalCost: origTotal,
    targetDuration,
    achievedDuration: achieved,
    isTargetAchieved: achieved <= targetDuration,
    cannotCrashFurther: cannotCrash || (achieved > targetDuration),
    steps,
    minCostPoint,
  };
}
