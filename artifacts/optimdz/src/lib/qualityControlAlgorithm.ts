// ── Quality Control (Gestion de la Qualité / إدارة الجودة) — pure computation ──
// Supports two SPC chart types:
//   • X-bar chart  — monitors sample means for variable data
//   • P chart      — monitors defect rates (proportion nonconforming)
// No i18n here; all user-facing strings live in the UI layer.

// ── Chart type ────────────────────────────────────────────────────────────────
export type ChartType = "xbar" | "p";

// ── Input shapes ──────────────────────────────────────────────────────────────

export interface XbarSampleInput {
  id: string;
  label: string;           // e.g. "Éch. 1"
  measurements: string[];  // raw string values (UI strings → parsed in compute)
}

export interface PSampleInput {
  id: string;
  label: string;
  n: string;  // units inspected
  d: string;  // defects found
}

export interface XbarInputs {
  chartType: "xbar";
  problemName: string;
  samples: XbarSampleInput[];
  targetMean?: string;     // optional reference mean μ₀
}

export interface PInputs {
  chartType: "p";
  problemName: string;
  samples: PSampleInput[];
}

export type QualityInputs = XbarInputs | PInputs;

// ── Output shapes ─────────────────────────────────────────────────────────────

export interface XbarSampleResult {
  id: string;
  label: string;
  measurements: number[];
  sampleMean: number;       // x̄ᵢ
  sampleSize: number;       // nᵢ
  ucl: number;              // control limit for this sample (constant limits here)
  lcl: number;
  isOutOfControl: boolean;
  outDirection: "above" | "below" | null;
}

export interface XbarResults {
  chartType: "xbar";
  samples: XbarSampleResult[];
  grandMean: number;        // X̿ (mean of sample means)
  processStdDev: number;    // σ (pooled across all measurements)
  avgSampleSize: number;    // n̄
  ucl: number;              // X̿ + 3σ/√n̄
  lcl: number;              // X̿ − 3σ/√n̄
  targetMean: number | null;
  outOfControlCount: number;
  processStatus: "in-control" | "out-of-control";
}

export interface PSampleResult {
  id: string;
  label: string;
  n: number;
  d: number;
  rate: number;   // pᵢ = d/n
  ucl: number;    // p̄ + 3√(p̄(1-p̄)/nᵢ)
  lcl: number;    // max(0, p̄ − 3√(p̄(1-p̄)/nᵢ))
  isOutOfControl: boolean;
  outDirection: "above" | "below" | null;
}

export interface PResults {
  chartType: "p";
  samples: PSampleResult[];
  pBar: number;          // overall defect rate
  totalInspected: number;
  totalDefects: number;
  avgN: number;          // average sample size (for constant limit reference)
  uclConstant: number;   // limits at avgN (for chart display)
  lclConstant: number;
  outOfControlCount: number;
  processStatus: "in-control" | "out-of-control";
}

export type QualityResults = XbarResults | PResults;

// ── Validation ────────────────────────────────────────────────────────────────
export interface QualityValidationError {
  type: "no_samples" | "too_few_samples" | "empty_measurements" | "invalid_n" | "d_exceeds_n" | "zero_n";
  sampleLabel?: string;
  msgFr: string;
  msgAr: string;
}

export function validateInputs(inputs: QualityInputs): QualityValidationError[] {
  const errors: QualityValidationError[] = [];

  if (inputs.chartType === "xbar") {
    if (inputs.samples.length === 0) {
      errors.push({
        type: "no_samples",
        msgFr: "Aucun échantillon saisi. Ajoutez au moins 2 échantillons pour lancer l'analyse.",
        msgAr: "لم يتم إدخال أي عينة. أضف عينتين على الأقل لبدء التحليل.",
      });
      return errors;
    }
    if (inputs.samples.length < 2) {
      errors.push({
        type: "too_few_samples",
        msgFr: "Au moins 2 échantillons sont nécessaires pour construire la carte de contrôle.",
        msgAr: "يلزم وجود عينتين على الأقل لبناء بطاقة المراقبة.",
      });
    }
    for (const s of inputs.samples) {
      const validMeasurements = s.measurements.filter(v => v.trim() !== "" && !isNaN(parseFloat(v)));
      if (validMeasurements.length === 0) {
        errors.push({
          type: "empty_measurements",
          sampleLabel: s.label,
          msgFr: `L'échantillon "${s.label}" ne contient aucune mesure valide. Saisissez au moins une valeur numérique.`,
          msgAr: `العينة "${s.label}" لا تحتوي على أي قياس صالح. أدخل قيمة رقمية واحدة على الأقل.`,
        });
      }
    }
  } else {
    if (inputs.samples.length === 0) {
      errors.push({
        type: "no_samples",
        msgFr: "Aucun échantillon saisi. Ajoutez au moins 2 échantillons pour lancer l'analyse.",
        msgAr: "لم يتم إدخال أي عينة. أضف عينتين على الأقل لبدء التحليل.",
      });
      return errors;
    }
    if (inputs.samples.length < 2) {
      errors.push({
        type: "too_few_samples",
        msgFr: "Au moins 2 échantillons sont nécessaires pour construire la carte P.",
        msgAr: "يلزم وجود عينتين على الأقل لبناء بطاقة P.",
      });
    }
    for (const s of inputs.samples) {
      const n = parseFloat(s.n);
      const d = parseFloat(s.d);
      if (!s.n.trim() || isNaN(n) || n <= 0) {
        errors.push({
          type: "zero_n",
          sampleLabel: s.label,
          msgFr: `L'échantillon "${s.label}" : la taille (n) doit être un entier positif.`,
          msgAr: `العينة "${s.label}": يجب أن يكون حجم الفحص (n) عدداً صحيحاً موجباً.`,
        });
      } else if (!s.d.trim() || isNaN(d) || d < 0) {
        errors.push({
          type: "invalid_n",
          sampleLabel: s.label,
          msgFr: `L'échantillon "${s.label}" : le nombre de défauts (d) doit être ≥ 0.`,
          msgAr: `العينة "${s.label}": يجب أن يكون عدد العيوب (d) ≥ 0.`,
        });
      } else if (d > n) {
        errors.push({
          type: "d_exceeds_n",
          sampleLabel: s.label,
          msgFr: `L'échantillon "${s.label}" : le nombre de défauts (${d}) ne peut pas dépasser la taille de l'échantillon (${n}).`,
          msgAr: `العينة "${s.label}": عدد العيوب (${d}) لا يمكن أن يتجاوز حجم الفحص (${n}).`,
        });
      }
    }
  }

  return errors;
}

// ── Math helpers ──────────────────────────────────────────────────────────────
function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[], mu: number): number {
  if (arr.length <= 1) return 0;
  const variance = arr.reduce((s, x) => s + (x - mu) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// ── X-bar computation ─────────────────────────────────────────────────────────
export function computeXbar(inputs: XbarInputs): XbarResults {
  // Parse all measurements
  const parsedSamples = inputs.samples.map(s => ({
    id: s.id,
    label: s.label,
    measurements: s.measurements
      .filter(v => v.trim() !== "" && !isNaN(parseFloat(v)))
      .map(v => parseFloat(v)),
  }));

  // Grand mean from sample means (not from individual measurements) — standard SPC practice
  const sampleMeans = parsedSamples.map(s => mean(s.measurements));
  const grandMean   = mean(sampleMeans);

  // Pooled process std dev from ALL individual measurements
  const allMeasurements = parsedSamples.flatMap(s => s.measurements);
  const totalMu = mean(allMeasurements);
  const sigma   = stdDev(allMeasurements, totalMu);

  // Average sample size
  const avgN = mean(parsedSamples.map(s => s.measurements.length));

  // Control limits  (X-bar limits use σ/√n̄)
  const sigmaOfMeans = avgN > 0 ? sigma / Math.sqrt(avgN) : sigma;
  const ucl = grandMean + 3 * sigmaOfMeans;
  const lcl = grandMean - 3 * sigmaOfMeans;

  const targetMean = inputs.targetMean && !isNaN(parseFloat(inputs.targetMean))
    ? parseFloat(inputs.targetMean)
    : null;

  const sampleResults: XbarSampleResult[] = parsedSamples.map((s, i) => {
    const sm = sampleMeans[i];
    const isAbove = sm > ucl;
    const isBelow = sm < lcl;
    return {
      id: s.id,
      label: s.label,
      measurements: s.measurements,
      sampleMean: sm,
      sampleSize: s.measurements.length,
      ucl,
      lcl,
      isOutOfControl: isAbove || isBelow,
      outDirection: isAbove ? "above" : isBelow ? "below" : null,
    };
  });

  const outOfControlCount = sampleResults.filter(s => s.isOutOfControl).length;

  return {
    chartType: "xbar",
    samples: sampleResults,
    grandMean,
    processStdDev: sigma,
    avgSampleSize: avgN,
    ucl,
    lcl,
    targetMean,
    outOfControlCount,
    processStatus: outOfControlCount === 0 ? "in-control" : "out-of-control",
  };
}

// ── P chart computation ───────────────────────────────────────────────────────
export function computeP(inputs: PInputs): PResults {
  const parsedSamples = inputs.samples.map(s => ({
    id: s.id,
    label: s.label,
    n: Math.round(Math.max(1, parseFloat(s.n) || 1)),
    d: Math.max(0, parseFloat(s.d) || 0),
  }));

  const totalInspected = parsedSamples.reduce((a, s) => a + s.n, 0);
  const totalDefects   = parsedSamples.reduce((a, s) => a + s.d, 0);
  const pBar = totalInspected > 0 ? totalDefects / totalInspected : 0;
  const avgN = mean(parsedSamples.map(s => s.n));

  // Constant limits at avgN (for reference line on chart)
  const sigma_pBar_avg = avgN > 0 ? Math.sqrt(pBar * (1 - pBar) / avgN) : 0;
  const uclConstant = Math.min(1, pBar + 3 * sigma_pBar_avg);
  const lclConstant = Math.max(0, pBar - 3 * sigma_pBar_avg);

  const sampleResults: PSampleResult[] = parsedSamples.map(s => {
    const rate = s.n > 0 ? s.d / s.n : 0;
    const sigma_i = s.n > 0 ? Math.sqrt(pBar * (1 - pBar) / s.n) : 0;
    const ucl = Math.min(1, pBar + 3 * sigma_i);
    const lcl = Math.max(0, pBar - 3 * sigma_i);
    const isAbove = rate > ucl;
    const isBelow = lcl > 0 && rate < lcl;
    return {
      id: s.id,
      label: s.label,
      n: s.n,
      d: s.d,
      rate,
      ucl,
      lcl,
      isOutOfControl: isAbove || isBelow,
      outDirection: isAbove ? "above" : isBelow ? "below" : null,
    };
  });

  const outOfControlCount = sampleResults.filter(s => s.isOutOfControl).length;

  return {
    chartType: "p",
    samples: sampleResults,
    pBar,
    totalInspected,
    totalDefects,
    avgN,
    uclConstant,
    lclConstant,
    outOfControlCount,
    processStatus: outOfControlCount === 0 ? "in-control" : "out-of-control",
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
export function computeQualityControl(inputs: QualityInputs): QualityResults {
  if (inputs.chartType === "xbar") return computeXbar(inputs);
  return computeP(inputs);
}

// ── Analysis generator ────────────────────────────────────────────────────────
export function generateQualityAnalysis(
  results: QualityResults,
): Array<{ fr: string; ar: string }> {
  const lines: Array<{ fr: string; ar: string }> = [];

  if (results.chartType === "xbar") {
    const r = results as XbarResults;

    // Overall status
    if (r.processStatus === "in-control") {
      lines.push({
        fr: `✅ Processus sous contrôle : tous les ${r.samples.length} échantillons sont dans les limites de contrôle (X̿ = ${r.grandMean.toFixed(3)}, σ = ${r.processStdDev.toFixed(3)}).`,
        ar: `✅ العملية تحت السيطرة: جميع العينات الـ ${r.samples.length} ضمن حدود المراقبة (X̿ = ${r.grandMean.toFixed(3)}، σ = ${r.processStdDev.toFixed(3)}).`,
      });
    } else {
      lines.push({
        fr: `🔴 Processus hors contrôle : ${r.outOfControlCount} échantillon(s) sur ${r.samples.length} sont hors des limites de contrôle (UCL = ${r.ucl.toFixed(3)}, LCL = ${r.lcl.toFixed(3)}).`,
        ar: `🔴 العملية خارج السيطرة: ${r.outOfControlCount} عينة(عينات) من أصل ${r.samples.length} خارج حدود المراقبة (UCL = ${r.ucl.toFixed(3)}، LCL = ${r.lcl.toFixed(3)}).`,
      });
    }

    // Per out-of-control sample
    for (const s of r.samples.filter(s => s.isOutOfControl)) {
      if (s.outDirection === "above") {
        lines.push({
          fr: `🔴 "${s.label}" hors contrôle — au-dessus de l'UCL : moyenne = ${s.sampleMean.toFixed(3)} > UCL = ${s.ucl.toFixed(3)}. Variation excessive vers le haut détectée.`,
          ar: `🔴 "${s.label}" خارج السيطرة — أعلى من UCL: المتوسط = ${s.sampleMean.toFixed(3)} > UCL = ${s.ucl.toFixed(3)}. انحراف مفرط نحو الأعلى مكتشف.`,
        });
      } else {
        lines.push({
          fr: `🔵 "${s.label}" hors contrôle — au-dessous de la LCL : moyenne = ${s.sampleMean.toFixed(3)} < LCL = ${s.lcl.toFixed(3)}. Variation anormalement basse détectée.`,
          ar: `🔵 "${s.label}" خارج السيطرة — أدنى من LCL: المتوسط = ${s.sampleMean.toFixed(3)} < LCL = ${s.lcl.toFixed(3)}. انحراف غير طبيعي نحو الأسفل مكتشف.`,
        });
      }
    }

    // Target mean comparison
    if (r.targetMean !== null) {
      const diff = Math.abs(r.grandMean - r.targetMean);
      const pct  = r.processStdDev > 0 ? (diff / r.processStdDev * 100).toFixed(1) : "—";
      if (diff < 0.001) {
        lines.push({
          fr: `🎯 La moyenne générale (${r.grandMean.toFixed(3)}) est parfaitement alignée avec la valeur cible (${r.targetMean}).`,
          ar: `🎯 المتوسط العام (${r.grandMean.toFixed(3)}) متوافق تماماً مع القيمة المرجعية (${r.targetMean}).`,
        });
      } else if (r.grandMean > r.targetMean) {
        lines.push({
          fr: `🎯 Dérive positive : la moyenne générale (${r.grandMean.toFixed(3)}) dépasse la cible (${r.targetMean}) de ${diff.toFixed(3)} — soit ${pct}% de σ. Le processus produit systématiquement au-dessus de la cible.`,
          ar: `🎯 انجراف موجب: المتوسط العام (${r.grandMean.toFixed(3)}) يتجاوز الهدف (${r.targetMean}) بمقدار ${diff.toFixed(3)} — أي ${pct}% من σ. العملية تنتج بشكل منتظم أعلى من الهدف.`,
        });
      } else {
        lines.push({
          fr: `🎯 Dérive négative : la moyenne générale (${r.grandMean.toFixed(3)}) est en dessous de la cible (${r.targetMean}) de ${diff.toFixed(3)} — soit ${pct}% de σ. Le processus produit systématiquement en dessous de la cible.`,
          ar: `🎯 انجراف سلبي: المتوسط العام (${r.grandMean.toFixed(3)}) أقل من الهدف (${r.targetMean}) بمقدار ${diff.toFixed(3)} — أي ${pct}% من σ. العملية تنتج بشكل منتظم أدنى من الهدف.`,
        });
      }
    }

    // σ interpretation
    lines.push({
      fr: `📊 Dispersion du processus : σ = ${r.processStdDev.toFixed(3)} (taille moyenne des échantillons : ${r.avgSampleSize.toFixed(1)} mesures). L'intervalle de contrôle ±3σ couvre ${((r.ucl - r.lcl)).toFixed(3)} unités.`,
      ar: `📊 تشتت العملية: σ = ${r.processStdDev.toFixed(3)} (متوسط حجم العينة: ${r.avgSampleSize.toFixed(1)} قياسات). نطاق السيطرة ±3σ يغطي ${(r.ucl - r.lcl).toFixed(3)} وحدة.`,
    });

  } else {
    const r = results as PResults;
    const pPct = (r.pBar * 100).toFixed(2);

    if (r.processStatus === "in-control") {
      lines.push({
        fr: `✅ Processus sous contrôle : tous les ${r.samples.length} échantillons respectent les limites de contrôle. Taux moyen de défauts p̄ = ${pPct}%.`,
        ar: `✅ العملية تحت السيطرة: جميع العينات الـ ${r.samples.length} ضمن حدود المراقبة. متوسط معدل العيوب p̄ = ${pPct}%.`,
      });
    } else {
      lines.push({
        fr: `🔴 Processus hors contrôle : ${r.outOfControlCount} échantillon(s) dépassent les limites. Taux moyen p̄ = ${pPct}% (total : ${r.totalDefects} défauts sur ${r.totalInspected} unités inspectées).`,
        ar: `🔴 العملية خارج السيطرة: ${r.outOfControlCount} عينة(عينات) تتجاوز حدود المراقبة. معدل p̄ = ${pPct}% (الإجمالي: ${r.totalDefects} عيب من أصل ${r.totalInspected} وحدة مفحوصة).`,
      });
    }

    for (const s of r.samples.filter(s => s.isOutOfControl)) {
      const sPct = (s.rate * 100).toFixed(2);
      const uclPct = (s.ucl * 100).toFixed(2);
      const lclPct = (s.lcl * 100).toFixed(2);
      if (s.outDirection === "above") {
        lines.push({
          fr: `🔴 "${s.label}" hors contrôle — taux de défauts élevé : p = ${sPct}% > UCL = ${uclPct}% (${s.d} défauts sur ${s.n} unités). Cause assignable probable.`,
          ar: `🔴 "${s.label}" خارج السيطرة — معدل عيوب مرتفع: p = ${sPct}% > UCL = ${uclPct}% (${s.d} عيب من أصل ${s.n} وحدة). يُرجَّح وجود سبب مُحدَّد.`,
        });
      } else {
        lines.push({
          fr: `🟢 "${s.label}" hors contrôle — taux anormalement bas : p = ${sPct}% < LCL = ${lclPct}%. Ce résultat exceptionnel mérite investigation (meilleure méthode ? données correctes ?).`,
          ar: `🟢 "${s.label}" خارج السيطرة — معدل منخفض بشكل غير عادي: p = ${sPct}% < LCL = ${lclPct}%. هذه النتيجة الاستثنائية تستحق التحقيق (طريقة أفضل؟ بيانات صحيحة؟).`,
        });
      }
    }

    lines.push({
      fr: `📊 Total inspecté : ${r.totalInspected} unités · Total défauts : ${r.totalDefects} · p̄ = ${pPct}% · Taille moyenne des échantillons : ${r.avgN.toFixed(1)} unités.`,
      ar: `📊 إجمالي الفحص: ${r.totalInspected} وحدة · إجمالي العيوب: ${r.totalDefects} · p̄ = ${pPct}% · متوسط حجم العينة: ${r.avgN.toFixed(1)} وحدة.`,
    });
  }

  return lines;
}

// ── Recommendations generator ─────────────────────────────────────────────────
export function generateQualityRecommendations(
  results: QualityResults,
): Array<{ icon: string; fr: string; ar: string; descFr: string; descAr: string }> {
  const recos: Array<{ icon: string; fr: string; ar: string; descFr: string; descAr: string }> = [];

  if (results.chartType === "xbar") {
    const r = results as XbarResults;
    const aboveUCL = r.samples.filter(s => s.outDirection === "above");
    const belowLCL = r.samples.filter(s => s.outDirection === "below");

    if (r.processStatus === "in-control") {
      recos.push({
        icon: "✅",
        fr: "Maintenir la surveillance continue du processus",
        ar: "الحفاظ على المراقبة المستمرة للعملية",
        descFr: `Le processus est stable dans ses limites (X̿ = ${r.grandMean.toFixed(3)}, σ = ${r.processStdDev.toFixed(3)}). Continuez à prélever des échantillons à intervalles réguliers pour détecter toute dérive précoce.`,
        descAr: `العملية مستقرة ضمن حدودها (X̿ = ${r.grandMean.toFixed(3)}، σ = ${r.processStdDev.toFixed(3)}). استمر في أخذ العينات بفترات منتظمة للكشف المبكر عن أي انجراف.`,
      });
      recos.push({
        icon: "📉",
        fr: "Réduire la variabilité pour améliorer la capabilité",
        ar: "تقليل التباين لتحسين قدرة العملية",
        descFr: "Même sous contrôle, cherchez à réduire σ en standardisant les procédures opératoires, en formant les opérateurs et en contrôlant les matières premières.",
        descAr: "حتى تحت السيطرة، اسعَ إلى تقليص σ من خلال توحيد إجراءات التشغيل وتدريب المشغلين ومراقبة المواد الأولية.",
      });
    }

    if (aboveUCL.length > 0) {
      const labels = aboveUCL.map(s => `"${s.label}"`).join(", ");
      const labelsAr = aboveUCL.map(s => `"${s.label}"`).join("، ");
      recos.push({
        icon: "🔴",
        fr: `Investiguer les dépassements de l'UCL (${aboveUCL.length} échantillon(s))`,
        ar: `التحقيق في تجاوزات UCL (${aboveUCL.length} عينة)`,
        descFr: `Les échantillons ${labels} dépassent la limite supérieure de contrôle. Causes typiques : matière première non conforme, usure des outillages, réglage machine incorrect. Déclenchez une analyse des causes racines (5M / Ishikawa) immédiatement.`,
        descAr: `العينات ${labelsAr} تتجاوز حد السيطرة العلوي. الأسباب الشائعة: مواد أولية غير مطابقة، تآكل الأدوات، ضبط خاطئ للآلة. أطلق تحليل الأسباب الجذرية (5M / إيشيكاوا) فوراً.`,
      });
    }

    if (belowLCL.length > 0) {
      const labels = belowLCL.map(s => `"${s.label}"`).join(", ");
      const labelsAr = belowLCL.map(s => `"${s.label}"`).join("، ");
      recos.push({
        icon: "🔵",
        fr: `Analyser les valeurs sous la LCL (${belowLCL.length} échantillon(s))`,
        ar: `تحليل القيم دون LCL (${belowLCL.length} عينة)`,
        descFr: `Les échantillons ${labels} sont anormalement bas. Vérifiez si la mesure est correcte (appareil étalonné ?). Si confirmé, identifiez la cause positive (meilleure matière, meilleure pratique) et capitalisez dessus.`,
        descAr: `العينات ${labelsAr} منخفضة بشكل غير طبيعي. تحقق من صحة القياس (الجهاز معايَر؟). إذا تأكد، حدد السبب الإيجابي (مادة أفضل، ممارسة أفضل) واستفد منه.`,
      });
    }

    if (r.targetMean !== null && Math.abs(r.grandMean - r.targetMean) > 0.001) {
      const direction = r.grandMean > r.targetMean ? "haute" : "basse";
      const directionAr = r.grandMean > r.targetMean ? "عالية" : "منخفضة";
      recos.push({
        icon: "🎯",
        fr: `Recentrer le processus sur la valeur cible (${r.targetMean})`,
        ar: `إعادة توسيط العملية حول القيمة المرجعية (${r.targetMean})`,
        descFr: `La moyenne générale (${r.grandMean.toFixed(3)}) est ${direction} par rapport à la cible (${r.targetMean}). Ajustez les paramètres de réglage de la machine ou de la recette pour corriger cette dérive systématique.`,
        descAr: `المتوسط العام (${r.grandMean.toFixed(3)}) ${directionAr} بالنسبة للهدف (${r.targetMean}). اضبط معاملات ضبط الآلة أو الوصفة لتصحيح هذا الانجراف المنتظم.`,
      });
    }

  } else {
    const r = results as PResults;
    const aboveUCL = r.samples.filter(s => s.outDirection === "above");
    const belowLCL = r.samples.filter(s => s.outDirection === "below");
    const pPct = (r.pBar * 100).toFixed(2);

    if (r.processStatus === "in-control") {
      recos.push({
        icon: "✅",
        fr: "Maintenir la cadence de contrôle qualité actuelle",
        ar: "الحفاظ على وتيرة مراقبة الجودة الحالية",
        descFr: `Le taux de défauts est stable à p̄ = ${pPct}%. Continuez à inspecter aux mêmes fréquences et documentez les résultats pour détecter toute tendance émergente.`,
        descAr: `معدل العيوب مستقر عند p̄ = ${pPct}%. استمر في الفحص بنفس التردد ووثّق النتائج للكشف عن أي اتجاه ناشئ.`,
      });
    }

    if (r.pBar > 0.1) {
      recos.push({
        icon: "⚠️",
        fr: `Réduire le taux de défauts global (p̄ = ${pPct}%)`,
        ar: `خفض معدل العيوب الإجمالي (p̄ = ${pPct}%)`,
        descFr: `Un taux de ${pPct}% indique qu'environ ${Math.round(r.pBar * 1000)} produits sur 1000 sont non conformes. Lancez un projet d'amélioration (DMAIC ou Kaizen) pour identifier et éliminer les causes racines de non-conformité.`,
        descAr: `معدل ${pPct}% يعني أن حوالي ${Math.round(r.pBar * 1000)} منتج من كل 1000 غير مطابق. أطلق مشروع تحسين (DMAIC أو Kaizen) لتحديد وإزالة الأسباب الجذرية لعدم المطابقة.`,
      });
    }

    if (aboveUCL.length > 0) {
      const labels = aboveUCL.map(s => `"${s.label}" (${(s.rate * 100).toFixed(1)}%)`).join(", ");
      const labelsAr = aboveUCL.map(s => `"${s.label}" (${(s.rate * 100).toFixed(1)}%)`).join("، ");
      recos.push({
        icon: "🔴",
        fr: `Analyser les pics de défauts (${aboveUCL.length} échantillon(s) hors UCL)`,
        ar: `تحليل ذروات العيوب (${aboveUCL.length} عينة فوق UCL)`,
        descFr: `Les échantillons ${labels} présentent un taux de défauts anormalement élevé. Isolez les lots correspondants, identifiez les conditions de production à ce moment-là (équipe, machine, matière) et déclenchez une analyse 5 Pourquoi.`,
        descAr: `العينات ${labelsAr} لديها معدل عيوب مرتفع بشكل غير طبيعي. اعزل الدفعات المقابلة وحدد ظروف الإنتاج في ذلك الوقت (فريق، آلة، مادة) وأطلق تحليل "5 لماذا".`,
      });
    }

    if (belowLCL.length > 0) {
      const labels = belowLCL.map(s => `"${s.label}"`).join(", ");
      const labelsAr = belowLCL.map(s => `"${s.label}"`).join("، ");
      recos.push({
        icon: "🟢",
        fr: `Capitaliser sur les résultats exceptionnellement bons (${belowLCL.length} échantillon(s) sous LCL)`,
        ar: `الاستفادة من النتائج الاستثنائية الجيدة (${belowLCL.length} عينة دون LCL)`,
        descFr: `Les échantillons ${labels} affichent des taux de défauts anormalement bas. Investiguez les conditions de production à ces moments précis — si elles sont identifiables, standardisez-les comme bonnes pratiques.`,
        descAr: `العينات ${labelsAr} تُظهر معدلات عيوب منخفضة بشكل غير عادي. تحقق من ظروف الإنتاج في تلك اللحظات — إن كانت قابلة للتحديد، قم بتوحيدها كممارسات جيدة.`,
      });
    }

    recos.push({
      icon: "📋",
      fr: "Renforcer la traçabilité et la fréquence d'échantillonnage",
      ar: "تعزيز إمكانية التتبع وتكرار أخذ العينات",
      descFr: "Pour un contrôle par carte P efficace, prélevez au minimum 25 échantillons avec n ≥ 50 unités chacun. Assurez l'enregistrement systématique des non-conformités avec la date, l'équipe et la machine.",
      descAr: "للتحكم الفعّال ببطاقة P، خذ 25 عينة على الأقل مع n ≥ 50 وحدة لكل منها. تأكد من التسجيل المنتظم لحالات عدم المطابقة مع التاريخ والفريق والآلة.",
    });
  }

  // Always: continuous improvement
  recos.push({
    icon: "🔄",
    fr: "Mettre à jour la carte à chaque nouveau cycle de production",
    ar: "تحديث البطاقة مع كل دورة إنتاج جديدة",
    descFr: "Les cartes de contrôle perdent leur utilité si elles ne sont pas actualisées régulièrement. Intégrez la mise à jour des données dans la routine de fin de poste ou de fin de journée.",
    descAr: "تفقد بطاقات المراقبة فائدتها إن لم تُحدَّث بانتظام. ادمج تحديث البيانات في روتين نهاية المناوبة أو نهاية اليوم.",
  });

  return recos;
}
