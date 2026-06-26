export interface Variable {
  name: string;
  coefficient: number;
  unit?: string;
}

export interface Constraint {
  name: string;
  coefficients: number[];
  operator: "<=" | ">=" | "=";
  rhs: number;
  unit?: string | null;
}

export interface ProblemInput {
  name?: string;
  sector?: string;
  objectiveType: "maximize" | "minimize";
  variables: Variable[];
  constraints: Constraint[];
  language?: "ar" | "fr";
}

export interface TableauRow {
  iteration: number;
  basisVariable: string;
  row: number[];
  pivotColumn?: number | null;
  pivotRow?: number | null;
}

export interface SimplexStep {
  iteration: number;
  tableau: TableauRow[];
  pivotElement?: string | null;
  explanation: string;
  explanationAr: string;
}

export interface SensitivityRange {
  name: string;
  currentValue: number;
  allowableIncrease?: number | null;
  allowableDecrease?: number | null;
  shadowPrice?: number | null;
  reducedCost?: number | null;
  isCritical: boolean;
}

export interface Alert {
  type: "warning" | "info" | "error";
  message: string;
  messageAr: string;
}

export interface SolveResult {
  status: "optimal" | "infeasible" | "unbounded";
  optimalValue?: number | null;
  variables?: { name: string; value: number; unit?: string | null }[];
  steps: SimplexStep[];
  sensitivityAnalysis?: {
    objectiveCoefficients: SensitivityRange[];
    constraints: SensitivityRange[];
  };
  alerts: Alert[];
  managerialSummary?: string;
  managerialSummaryAr?: string;
  iterationCount: number;
}

const EPSILON = 1e-10;
const MAX_ITER = 200;

function round(val: number, decimals = 6): number {
  return Math.round(val * 10 ** decimals) / 10 ** decimals;
}

export function solveSimplex(input: ProblemInput): SolveResult {
  const { variables, constraints, objectiveType } = input;
  const n = variables.length;
  const m = constraints.length;
  const alerts: Alert[] = [];
  const steps: SimplexStep[] = [];

  // Validate input
  if (n === 0 || m === 0) {
    return {
      status: "infeasible",
      steps: [],
      alerts: [
        {
          type: "error",
          message: "Problem must have at least one variable and one constraint.",
          messageAr: "يجب أن تحتوي المشكلة على متغير واحد على الأقل وقيد واحد.",
        },
      ],
      iterationCount: 0,
    };
  }

  for (const c of constraints) {
    if (c.coefficients.length !== n) {
      return {
        status: "infeasible",
        steps: [],
        alerts: [
          {
            type: "error",
            message: `Constraint "${c.name}" has ${c.coefficients.length} coefficients but ${n} variables are defined.`,
            messageAr: `القيد "${c.name}" يحتوي على ${c.coefficients.length} معاملات لكن تم تعريف ${n} متغيرات.`,
          },
        ],
        iterationCount: 0,
      };
    }
  }

  // Convert minimization to maximization
  let objCoeffs = variables.map((v) => v.coefficient);
  if (objectiveType === "minimize") {
    objCoeffs = objCoeffs.map((c) => -c);
  }

  // Count slacks/surplus/artificials
  let numSlack = 0;
  let numArtificial = 0;

  const slackTypes: ("slack" | "surplus" | "artificial")[][] = constraints.map((c) => {
    if (c.operator === "<=") {
      numSlack++;
      return ["slack"];
    } else if (c.operator === ">=") {
      numSlack++;
      numArtificial++;
      return ["surplus", "artificial"];
    } else {
      numArtificial++;
      return ["artificial"];
    }
  });

  const totalVars = n + numSlack + numArtificial;

  // Variable names
  const varNames: string[] = [
    ...variables.map((v) => v.name),
  ];

  let slackIdx = n;
  let artificialIdx = n + numSlack;

  const slackIndices: number[] = [];
  const artificialIndices: number[] = [];

  constraints.forEach((c, i) => {
    if (c.operator === "<=") {
      varNames.push(`s${i + 1}`);
      slackIndices.push(slackIdx++);
    } else if (c.operator === ">=") {
      varNames.push(`s${i + 1}`);
      slackIndices.push(slackIdx++);
      varNames.push(`a${i + 1}`);
      artificialIndices.push(artificialIdx++);
    } else {
      varNames.push(`a${i + 1}`);
      artificialIndices.push(artificialIdx++);
    }
  });

  const useBigM = artificialIndices.length > 0;
  const BIG_M = 1e6;

  // Build full objective row (negated for maximization form)
  // c_j for all variables
  const fullObj: number[] = new Array(totalVars).fill(0);
  for (let j = 0; j < n; j++) fullObj[j] = -objCoeffs[j];
  if (useBigM) {
    for (const ai of artificialIndices) fullObj[ai] = BIG_M;
  }

  // Build tableau: m rows of (totalVars + 1) columns [coefficients | rhs]
  const tableau: number[][] = [];
  const basis: number[] = [];

  let slackCount = 0;
  let artCount = 0;

  for (let i = 0; i < m; i++) {
    const row: number[] = new Array(totalVars + 1).fill(0);
    for (let j = 0; j < n; j++) row[j] = constraints[i].coefficients[j];

    const types = slackTypes[i];
    if (types.includes("slack")) {
      const sIdx = n + slackCount;
      row[sIdx] = 1;
      slackCount++;
      basis.push(sIdx);
    }
    if (types.includes("surplus")) {
      const sIdx = n + slackCount;
      row[sIdx] = -1;
      slackCount++;
    }
    if (types.includes("artificial")) {
      const aIdx = n + numSlack + artCount;
      row[aIdx] = 1;
      artCount++;
      if (!types.includes("slack")) basis.push(aIdx);
    }
    if (types[0] === "artificial" && !types.includes("surplus")) {
      // pure equality
    }

    // Handle negative RHS: multiply row by -1
    let rhs = constraints[i].rhs;
    if (rhs < 0) {
      for (let j = 0; j <= totalVars; j++) row[j] = -row[j];
      rhs = -rhs;
    }
    row[totalVars] = rhs;
    tableau.push(row);
  }

  // Fix basis for >= constraints
  // Rebuild basis properly
  const basisFixed: number[] = [];
  slackCount = 0;
  artCount = 0;
  for (let i = 0; i < m; i++) {
    const types = slackTypes[i];
    if (types[0] === "<=") {
      basisFixed.push(n + slackCount);
      slackCount++;
    } else if (types[0] === ">=") {
      basisFixed.push(n + numSlack + artCount);
      slackCount++;
      artCount++;
    } else {
      basisFixed.push(n + numSlack + artCount);
      artCount++;
    }
  }

  // Objective row
  const objRow: number[] = [...fullObj, 0];

  // Big-M: subtract M * artificial rows from objective
  for (let i = 0; i < m; i++) {
    if (artificialIndices.includes(basisFixed[i])) {
      const ai = basisFixed[i];
      for (let j = 0; j <= totalVars; j++) {
        objRow[j] += BIG_M * tableau[i][j];
      }
    }
  }

  // Collect initial step
  const recordStep = (iter: number, pivCol: number | null, pivRow: number | null, explanation: string, explanationAr: string) => {
    const tableauRows: TableauRow[] = tableau.map((row, ri) => ({
      iteration: iter,
      basisVariable: varNames[basisFixed[ri]] ?? `x${basisFixed[ri]}`,
      row: [...row, objRow[totalVars]].slice(0, totalVars + 1).map((v) => round(v)),
      pivotColumn: pivCol,
      pivotRow: pivRow,
    }));
    steps.push({ iteration: iter, tableau: tableauRows, pivotElement: pivCol !== null && pivRow !== null ? `${varNames[pivCol]}` : null, explanation, explanationAr });
  };

  recordStep(0, null, null, "Initial tableau setup with slack/surplus/artificial variables.", "إعداد الجدول الأولي مع متغيرات الراحة والفائض والاصطناعية.");

  let iteration = 0;

  while (iteration < MAX_ITER) {
    iteration++;

    // Find pivot column: most negative coefficient in objective row (excluding RHS)
    let pivCol = -1;
    let minVal = -EPSILON;
    for (let j = 0; j < totalVars; j++) {
      if (objRow[j] < minVal) {
        minVal = objRow[j];
        pivCol = j;
      }
    }

    if (pivCol === -1) {
      // Optimal
      break;
    }

    // Find pivot row: minimum ratio test
    let pivRow = -1;
    let minRatio = Infinity;
    for (let i = 0; i < m; i++) {
      if (tableau[i][pivCol] > EPSILON) {
        const ratio = tableau[i][totalVars] / tableau[i][pivCol];
        if (ratio < minRatio - EPSILON) {
          minRatio = ratio;
          pivRow = i;
        }
      }
    }

    if (pivRow === -1) {
      // Unbounded
      return {
        status: "unbounded",
        steps,
        alerts: [
          {
            type: "error",
            message: "The problem is unbounded — the objective function can increase without limit. Check your constraints.",
            messageAr: "المشكلة غير محدودة — يمكن أن تزداد دالة الهدف بلا حدود. تحقق من القيود.",
          },
        ],
        iterationCount: iteration,
      };
    }

    const pivElem = tableau[pivRow][pivCol];

    // Pivot
    for (let j = 0; j <= totalVars; j++) {
      tableau[pivRow][j] /= pivElem;
    }

    for (let i = 0; i < m; i++) {
      if (i !== pivRow) {
        const factor = tableau[i][pivCol];
        for (let j = 0; j <= totalVars; j++) {
          tableau[i][j] -= factor * tableau[pivRow][j];
        }
      }
    }

    const objFactor = objRow[pivCol];
    for (let j = 0; j <= totalVars; j++) {
      objRow[j] -= objFactor * tableau[pivRow][j];
    }

    basisFixed[pivRow] = pivCol;

    const enteringName = varNames[pivCol] ?? `x${pivCol}`;
    const leavingName = varNames[basisFixed[pivRow]] ?? `x${basisFixed[pivRow]}`;

    recordStep(
      iteration,
      pivCol,
      pivRow,
      `Iteration ${iteration}: Variable "${enteringName}" enters the basis, "${leavingName}" leaves. Pivot element = ${round(pivElem)}.`,
      `التكرار ${iteration}: المتغير "${enteringName}" يدخل الأساس، "${leavingName}" يغادر. عنصر المحور = ${round(pivElem)}.`
    );
  }

  // Check if artificials are still in basis with non-zero value
  for (let i = 0; i < m; i++) {
    if (artificialIndices.includes(basisFixed[i]) && Math.abs(tableau[i][totalVars]) > 1e-6) {
      return {
        status: "infeasible",
        steps,
        alerts: [
          {
            type: "error",
            message: "The problem is infeasible — no solution satisfies all constraints simultaneously. Review your resource limits.",
            messageAr: "المشكلة غير قابلة للحل — لا يوجد حل يرضي جميع القيود في نفس الوقت. راجع حدود مواردك.",
          },
        ],
        iterationCount: iteration,
      };
    }
  }

  // Extract solution
  const solution: number[] = new Array(n).fill(0);
  for (let i = 0; i < m; i++) {
    if (basisFixed[i] < n) {
      solution[basisFixed[i]] = round(tableau[i][totalVars]);
    }
  }

  const rawObjValue = round(objRow[totalVars]);
  const optimalValue = objectiveType === "minimize" ? -rawObjValue : rawObjValue;

  // Sensitivity analysis
  const objSensitivity: SensitivityRange[] = variables.map((v, j) => {
    const reduced = round(objRow[j]);
    const basisIdx = basisFixed.indexOf(j);
    let allowIncrease: number | null = Infinity;
    let allowDecrease: number | null = Infinity;

    if (basisIdx >= 0) {
      // Variable is in basis — compute ranging via ratio tests
      for (let k = 0; k < totalVars; k++) {
        if (!basisFixed.includes(k) && Math.abs(tableau[basisIdx][k]) > EPSILON) {
          const delta = objRow[k] / tableau[basisIdx][k];
          if (delta > 0) allowIncrease = Math.min(allowIncrease ?? Infinity, delta);
          else allowDecrease = Math.min(allowDecrease ?? Infinity, -delta);
        }
      }
    } else {
      allowIncrease = reduced >= 0 ? Infinity : reduced;
      allowDecrease = null;
    }

    return {
      name: v.name,
      currentValue: v.coefficient,
      allowableIncrease: allowIncrease === Infinity ? null : round(allowIncrease ?? 0),
      allowableDecrease: allowDecrease === Infinity ? null : round(allowDecrease ?? 0),
      reducedCost: round(reduced),
      isCritical: Math.abs(reduced) < 1e-4,
    };
  });

  const constraintSensitivity: SensitivityRange[] = constraints.map((c, i) => {
    // Shadow price = dual variable = negative of objective coefficient of slack
    let shadowPrice: number | null = null;
    const slackName = `s${i + 1}`;
    const sIdx = varNames.indexOf(slackName);
    if (sIdx >= 0) {
      shadowPrice = round(c.operator === "<=" ? -objRow[sIdx] : objRow[sIdx]);
    }

    return {
      name: c.name,
      currentValue: c.rhs,
      shadowPrice,
      isCritical: shadowPrice !== null && Math.abs(shadowPrice) > 1e-4,
    };
  });

  // Build managerial summary
  const topVars = variables
    .map((v, i) => ({ name: v.name, value: solution[i], unit: v.unit }))
    .filter((v) => v.value > 1e-6);

  const criticalConstraints = constraintSensitivity.filter((c) => c.isCritical).map((c) => c.name);

  const summary =
    objectiveType === "maximize"
      ? `Optimal plan: Produce ${topVars.map((v) => `${round(v.value)} ${v.unit ?? "units"} of ${v.name}`).join(", ")}. Maximum ${variables[0]?.unit ? "profit" : "objective"} = ${round(optimalValue, 2)}.${criticalConstraints.length ? ` Critical constraints: ${criticalConstraints.join(", ")}.` : ""}`
      : `Optimal plan: Use ${topVars.map((v) => `${round(v.value)} ${v.unit ?? "units"} of ${v.name}`).join(", ")}. Minimum cost = ${round(optimalValue, 2)}.${criticalConstraints.length ? ` Critical constraints: ${criticalConstraints.join(", ")}.` : ""}`;

  const summaryAr =
    objectiveType === "maximize"
      ? `الخطة المثلى: إنتاج ${topVars.map((v) => `${round(v.value)} ${v.unit ?? "وحدة"} من ${v.name}`).join(", ")}. الحد الأقصى ${variables[0]?.unit ? "للربح" : "للهدف"} = ${round(optimalValue, 2)}.${criticalConstraints.length ? ` القيود الحرجة: ${criticalConstraints.join(", ")}.` : ""}`
      : `الخطة المثلى: استخدام ${topVars.map((v) => `${round(v.value)} ${v.unit ?? "وحدة"} من ${v.name}`).join(", ")}. الحد الأدنى للتكلفة = ${round(optimalValue, 2)}.${criticalConstraints.length ? ` القيود الحرجة: ${criticalConstraints.join(", ")}.` : ""}`;

  if (criticalConstraints.length > 0) {
    alerts.push({
      type: "warning",
      message: `Critical constraints detected: ${criticalConstraints.join(", ")}. Relaxing these would improve your result.`,
      messageAr: `تم اكتشاف قيود حرجة: ${criticalConstraints.join(", ")}. تخفيف هذه القيود سيحسن نتيجتك.`,
    });
  }

  if (iteration >= MAX_ITER) {
    alerts.push({
      type: "warning",
      message: "Maximum iterations reached. Solution may not be fully optimal.",
      messageAr: "تم الوصول إلى الحد الأقصى من التكرارات. قد لا يكون الحل مثالياً تماماً.",
    });
  }

  return {
    status: "optimal",
    optimalValue,
    variables: variables.map((v, i) => ({ name: v.name, value: round(solution[i]), unit: v.unit ?? null })),
    steps,
    sensitivityAnalysis: {
      objectiveCoefficients: objSensitivity,
      constraints: constraintSensitivity,
    },
    alerts,
    managerialSummary: summary,
    managerialSummaryAr: summaryAr,
    iterationCount: iteration,
  };
}
