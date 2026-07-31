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

  // Build initial basis correctly:
  // "slack"    (<=)  → slack variable is the initial basis variable
  // "surplus"  (>=)  → artificial is the initial basis variable (surplus is non-basic)
  // "artificial" (=) → artificial is the initial basis variable
  const basisFixed: number[] = [];
  slackCount = 0;
  artCount = 0;
  for (let i = 0; i < m; i++) {
    const types = slackTypes[i];
    if (types[0] === "slack") {
      basisFixed.push(n + slackCount);
      slackCount++;
    } else if (types[0] === "surplus") {
      basisFixed.push(n + numSlack + artCount);
      slackCount++;
      artCount++;
    } else {
      // "artificial" — equality constraint
      basisFixed.push(n + numSlack + artCount);
      artCount++;
    }
  }

  // Objective row
  const objRow: number[] = [...fullObj, 0];

  // Big-M: eliminate artificial variables from the objective row.
  // For each row whose basis variable is an artificial, subtract M * that row
  // from objRow so the artificial's column becomes 0 (standard row-reduction).
  for (let i = 0; i < m; i++) {
    if (artificialIndices.includes(basisFixed[i])) {
      for (let j = 0; j <= totalVars; j++) {
        objRow[j] -= BIG_M * tableau[i][j];
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

    const leavingVarIdx = basisFixed[pivRow]; // capture BEFORE updating basis
    basisFixed[pivRow] = pivCol;

    const enteringName = varNames[pivCol] ?? `x${pivCol}`;
    const leavingName = varNames[leavingVarIdx] ?? `x${leavingVarIdx}`;

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

    let allowIncrease: number | null = null; // null = ∞
    let allowDecrease: number | null = null; // null = ∞

    if (sIdx >= 0) {
      shadowPrice = round(c.operator === "<=" ? -objRow[sIdx] : objRow[sIdx]);

      // RHS ranging — parametric analysis on the slack column
      const basicRow = basisFixed.indexOf(sIdx);
      if (basicRow >= 0) {
        // Slack is basic → non-binding constraint
        // Allowable decrease = current slack value (how much RHS can shrink before binding)
        allowDecrease = round(tableau[basicRow][totalVars]);
        allowIncrease = null; // ∞ — can always increase a non-binding RHS
      } else {
        // Slack is non-basic → binding constraint
        // Use the column of s_i in the final tableau
        let maxIncrease: number = Infinity;
        let maxDecrease: number = Infinity;
        const sign = c.operator === ">=" ? -1 : 1;
        for (let r = 0; r < m; r++) {
          const colVal = sign * tableau[r][sIdx];
          const rhsVal = tableau[r][totalVars];
          if (colVal < -EPSILON) {
            maxIncrease = Math.min(maxIncrease, -rhsVal / colVal);
          } else if (colVal > EPSILON) {
            maxDecrease = Math.min(maxDecrease, rhsVal / colVal);
          }
        }
        allowIncrease = maxIncrease === Infinity ? null : round(maxIncrease);
        allowDecrease = maxDecrease === Infinity ? null : round(maxDecrease);
      }
    }

    return {
      name: c.name,
      currentValue: c.rhs,
      allowableIncrease: allowIncrease,
      allowableDecrease: allowDecrease,
      shadowPrice,
      isCritical: shadowPrice !== null && Math.abs(shadowPrice) > 1e-4,
    };
  });

  // Build managerial summary — rich, analyst-quality prose
  const fmtNum = (n: number) =>
    n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const fmtNumAr = (n: number) =>
    n.toLocaleString("ar-DZ", { maximumFractionDigits: 2 });

  const activeVars = variables
    .map((v, i) => ({
      name: v.name,
      value: round(solution[i]),
      unit: v.unit,
      coef: v.coefficient,
      contribution: round(v.coefficient * solution[i]),
    }))
    .filter((v) => v.value > 1e-6);

  const totalContribCalc = activeVars.reduce((s, v) => s + Math.abs(v.contribution), 0);
  const isMax = objectiveType === "maximize";

  const bindingConstraints = constraintSensitivity.filter(
    (c) => c.isCritical && c.shadowPrice !== null && Math.abs(c.shadowPrice!) > 1e-4
  );

  // Helper to find constraint unit from input
  const cUnit = (name: string) => constraints.find((c) => c.name === name)?.unit ?? "";

  // --- French summary ---
  let summary = "";

  // Sentence 1: the result
  summary += isMax
    ? `Avec vos ressources actuelles, le profit maximal réalisable est de ${fmtNum(optimalValue)} DZD.`
    : `Avec vos ressources actuelles, le coût minimal réalisable est de ${fmtNum(optimalValue)} DZD.`;

  // Sentence 2: the production plan with per-variable contributions and percentages
  if (activeVars.length > 0) {
    const planParts = activeVars.map((v) => {
      const pct =
        totalContribCalc > 1e-6
          ? ` — ${Math.round((Math.abs(v.contribution) / totalContribCalc) * 100)} % ${isMax ? "du profit" : "du coût"}`
          : "";
      return `${fmtNum(v.value)} ${v.unit ?? "unités"} de ${v.name} à ${fmtNum(v.coef)} DZD/${v.unit ?? "unité"} = ${fmtNum(v.contribution)} DZD${pct}`;
    });
    const verb = isMax ? "de produire" : "d'allouer";
    summary += ` Le plan optimal recommande ${verb} : ${planParts.join(" ; ")}.`;
  }

  // Sentence 3: binding constraints and their shadow prices
  if (bindingConstraints.length > 0) {
    const parts = bindingConstraints.map((c) => {
      const u = cUnit(c.name);
      return `"${c.name}" (capacité actuelle : ${fmtNum(c.currentValue)}${u ? " " + u : ""}, chaque ${u ? u.replace(/s$/, "") : "unité"} supplémentaire rapporte ${fmtNum(Math.abs(c.shadowPrice!))} DZD)`;
    });
    const noun = bindingConstraints.length === 1 ? "La contrainte saturée" : "Les contraintes saturées";
    summary += ` ${noun} qui plafonne${bindingConstraints.length > 1 ? "nt" : ""} votre ${isMax ? "profit" : "efficacité"} : ${parts.join(", ")}. Augmenter ${bindingConstraints.length === 1 ? "cette capacité" : "ces capacités"} est l'action prioritaire à impact maximal.`;
  } else {
    summary += ` Aucune ressource n'est saturée — votre plan dispose de marges sur toutes les contraintes.`;
  }

  // --- Arabic summary ---
  let summaryAr = "";

  // Sentence 1
  summaryAr += isMax
    ? `الربح الأقصى القابل للتحقيق بمواردك الحالية هو ${fmtNumAr(optimalValue)} دج.`
    : `التكلفة الدنيا القابلة للتحقيق بمواردك الحالية هي ${fmtNumAr(optimalValue)} دج.`;

  // Sentence 2
  if (activeVars.length > 0) {
    const planParts = activeVars.map((v) => {
      const pct =
        totalContribCalc > 1e-6
          ? ` — ${Math.round((Math.abs(v.contribution) / totalContribCalc) * 100)}% ${isMax ? "من الربح" : "من التكلفة"}`
          : "";
      return `${fmtNumAr(v.value)} ${v.unit ?? "وحدة"} من ${v.name} بسعر ${fmtNumAr(v.coef)} دج/${v.unit ?? "وحدة"} = ${fmtNumAr(v.contribution)} دج${pct}`;
    });
    summaryAr += ` تُوصي الخطة المثلى بـ${isMax ? "إنتاج" : "تخصيص"}: ${planParts.join(" ؛ ")}.`;
  }

  // Sentence 3
  if (bindingConstraints.length > 0) {
    const parts = bindingConstraints.map((c) => {
      const u = cUnit(c.name);
      return `"${c.name}" (الطاقة الحالية: ${fmtNumAr(c.currentValue)}${u ? " " + u : ""}، كل ${u ? u : "وحدة"} إضافية تُدرّ ${fmtNumAr(Math.abs(c.shadowPrice!))} دج)`;
    });
    const noun = bindingConstraints.length === 1 ? "القيد المُقيِّد" : "القيود المُقيِّدة";
    summaryAr += ` ${noun} الذي يُحدّ من ${isMax ? "ربحك" : "كفاءتك"}: ${parts.join("، ")}. رفع ${bindingConstraints.length === 1 ? "هذه الطاقة" : "هذه الطاقات"} هو الإجراء ذو الأثر الأعلى.`;
  } else {
    summaryAr += ` لا يوجد أي مورد مستنفد بالكامل — تتمتع خطتك بهامش كافٍ على جميع القيود.`;
  }

  // keep legacy name for alert building below
  const criticalConstraints = bindingConstraints.map((c) => c.name);

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
