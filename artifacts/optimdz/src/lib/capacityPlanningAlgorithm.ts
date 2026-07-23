// ── Capacity Planning (Planification des Capacités) — pure computation ─────────
// Computes utilization rate, capacity gap and bottleneck detection per centre and period.
// No i18n here; all user-facing strings live in the UI layer.

export type PeriodType = "semaines" | "mois";

// ── Input shapes ──────────────────────────────────────────────────────────────
export interface WorkCenterInput {
  id: string;
  name: string;
  capacities: number[];   // available capacity per period (hours, units, etc.)
  loads: number[];        // requested load per period
}

export interface CapacityInputs {
  problemName: string;
  periodType: PeriodType;
  periodCount: number;
  centers: WorkCenterInput[];
}

// ── Output shapes ─────────────────────────────────────────────────────────────
export interface PeriodResult {
  capacity: number;
  load: number;
  utilizationRate: number;   // (load / capacity) × 100 — capped display; Infinity if capacity=0 and load>0
  capacityGap: number;       // capacity − load (negative means overloaded)
  isBottleneck: boolean;     // utilizationRate > 100
  isUnderutilized: boolean;  // utilizationRate < 50 and capacity > 0
}

export type CenterStatus = "critical" | "warning" | "underused" | "good";

export interface CenterResult {
  id: string;
  name: string;
  periods: PeriodResult[];
  avgUtilizationRate: number;  // average across periods with non-zero capacity
  maxUtilizationRate: number;  // worst period
  bottleneckPeriods: number[]; // 0-based indices where taux > 100%
  isBottleneck: boolean;       // at least one bottleneck period
  status: CenterStatus;
}

export interface CapacityResults {
  periodLabels: string[];
  centers: CenterResult[];
  bottleneckCenterCount: number;
  overallUtilization: number;   // weighted average across all centres + periods
  overallStatus: "critical" | "warning" | "good";
}

// ── Validation ────────────────────────────────────────────────────────────────
export interface CapacityValidationError {
  type: "empty" | "zero_capacity" | "missing_name";
  centerName?: string;
  msgFr: string;
  msgAr: string;
}

export function validateInputs(inputs: CapacityInputs): CapacityValidationError[] {
  const errors: CapacityValidationError[] = [];

  if (inputs.centers.length === 0) {
    errors.push({
      type: "empty",
      msgFr: "Aucun centre de travail saisi. Ajoutez au moins un centre pour lancer l'analyse.",
      msgAr: "لم يتم إدخال أي مركز عمل. أضف مركزاً واحداً على الأقل لبدء التحليل.",
    });
    return errors;
  }

  for (const c of inputs.centers) {
    if (!c.name.trim()) {
      errors.push({
        type: "missing_name",
        msgFr: "Un centre de travail n'a pas de nom. Veuillez nommer tous les centres.",
        msgAr: "أحد مراكز العمل ليس له اسم. يرجى تسمية جميع المراكز.",
      });
    }
    const hasAnyCapacity = c.capacities.some(v => v > 0);
    if (!hasAnyCapacity) {
      errors.push({
        type: "zero_capacity",
        centerName: c.name || "?",
        msgFr: `Le centre "${c.name || "?"}" n'a aucune capacité disponible saisie. Saisissez au moins une valeur supérieure à 0.`,
        msgAr: `مركز "${c.name || "?"}" لا يحتوي على طاقة متاحة. أدخل قيمة أكبر من 0 على الأقل.`,
      });
    }
  }

  return errors;
}

// ── Period label builder ──────────────────────────────────────────────────────
export function buildPeriodLabels(periodType: PeriodType, count: number): string[] {
  const prefix = periodType === "semaines" ? "S" : "M";
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
}

// ── Core computation ──────────────────────────────────────────────────────────
export function computeCapacityPlan(inputs: CapacityInputs): CapacityResults {
  const { periodCount, centers } = inputs;
  const periodLabels = buildPeriodLabels(inputs.periodType, periodCount);

  const centerResults: CenterResult[] = [];
  let totalCapacity = 0;
  let totalLoad = 0;
  let bottleneckCenterCount = 0;

  for (const center of centers) {
    const periods: PeriodResult[] = [];
    const bottleneckPeriods: number[] = [];
    let sumUtilization = 0;
    let validPeriods = 0;
    let maxUtilization = 0;

    for (let p = 0; p < periodCount; p++) {
      const capacity = Math.max(0, center.capacities[p] ?? 0);
      const load     = Math.max(0, center.loads[p] ?? 0);

      let utilizationRate: number;
      if (capacity === 0 && load === 0) {
        utilizationRate = 0;
      } else if (capacity === 0) {
        utilizationRate = Infinity; // infinite overload — no capacity at all
      } else {
        utilizationRate = (load / capacity) * 100;
      }

      const capacityGap   = capacity - load;
      const isBottleneck   = utilizationRate > 100;
      const isUnderutilized = capacity > 0 && utilizationRate < 50 && utilizationRate >= 0;

      if (isBottleneck) bottleneckPeriods.push(p);
      if (capacity > 0) {
        sumUtilization += Math.min(utilizationRate, 999); // cap for average
        validPeriods++;
        if (utilizationRate > maxUtilization) maxUtilization = utilizationRate;
      }

      totalCapacity += capacity;
      totalLoad     += load;

      periods.push({ capacity, load, utilizationRate, capacityGap, isBottleneck, isUnderutilized });
    }

    const avgUtilizationRate = validPeriods > 0 ? sumUtilization / validPeriods : 0;
    const isBottleneck = bottleneckPeriods.length > 0;

    let status: CenterStatus;
    if (isBottleneck)             status = "critical";
    else if (avgUtilizationRate > 85) status = "warning";
    else if (avgUtilizationRate < 50 && avgUtilizationRate > 0) status = "underused";
    else                          status = "good";

    if (isBottleneck) bottleneckCenterCount++;

    centerResults.push({
      id: center.id,
      name: center.name,
      periods,
      avgUtilizationRate,
      maxUtilizationRate: maxUtilization,
      bottleneckPeriods,
      isBottleneck,
      status,
    });
  }

  const overallUtilization = totalCapacity > 0 ? (totalLoad / totalCapacity) * 100 : 0;
  const overallStatus: "critical" | "warning" | "good" =
    bottleneckCenterCount > 0
      ? "critical"
      : overallUtilization > 85
      ? "warning"
      : "good";

  return {
    periodLabels,
    centers: centerResults,
    bottleneckCenterCount,
    overallUtilization,
    overallStatus,
  };
}

// ── Bilingual analysis generator ──────────────────────────────────────────────
export function generateCapacityAnalysis(
  results: CapacityResults,
  periodLabels: string[],
): Array<{ fr: string; ar: string }> {
  const lines: Array<{ fr: string; ar: string }> = [];
  const { centers, bottleneckCenterCount, overallUtilization, overallStatus } = results;

  // Overall picture
  if (overallStatus === "critical") {
    lines.push({
      fr: `🔴 Situation critique : ${bottleneckCenterCount} centre(s) de travail sont en surcharge (taux de charge > 100%). Intervention immédiate requise.`,
      ar: `🔴 وضع حرج: ${bottleneckCenterCount} مركز(مراكز) عمل في وضع الحمل الزائد (معدل التحميل > 100%). التدخل الفوري مطلوب.`,
    });
  } else if (overallStatus === "warning") {
    lines.push({
      fr: `🟡 Situation tendue : certains centres approchent leur limite de capacité (utilisation globale : ${overallUtilization.toFixed(1)}%). Surveillance accrue recommandée.`,
      ar: `🟡 وضع متوتر: بعض المراكز تقترب من حد طاقتها (الاستخدام الإجمالي: ${overallUtilization.toFixed(1)}%). يُوصى بمراقبة مكثّفة.`,
    });
  } else {
    lines.push({
      fr: `✅ Situation saine : tous les centres opèrent dans les limites de leur capacité (utilisation globale : ${overallUtilization.toFixed(1)}%).`,
      ar: `✅ وضع صحي: جميع المراكز تعمل ضمن حدود طاقتها (الاستخدام الإجمالي: ${overallUtilization.toFixed(1)}%).`,
    });
  }

  // Per bottleneck centre
  for (const c of centers.filter(c => c.isBottleneck)) {
    const worstPeriodIdx = c.bottleneckPeriods.reduce(
      (best, p) => (c.periods[p].utilizationRate > c.periods[best].utilizationRate ? p : best),
      c.bottleneckPeriods[0],
    );
    const worstP = c.periods[worstPeriodIdx];
    const rateStr = isFinite(worstP.utilizationRate) ? `${worstP.utilizationRate.toFixed(1)}%` : "∞";
    lines.push({
      fr: `🔴 Goulot d'étranglement — "${c.name}" : surcharge sur ${c.bottleneckPeriods.length} période(s). Pire pic : ${periodLabels[worstPeriodIdx]} à ${rateStr} (écart : ${worstP.capacityGap.toFixed(1)} unités).`,
      ar: `🔴 اختناق — "${c.name}": حمل زائد خلال ${c.bottleneckPeriods.length} فترة(فترات). أسوأ ذروة: ${periodLabels[worstPeriodIdx]} بنسبة ${rateStr} (الفجوة: ${worstP.capacityGap.toFixed(1)} وحدة).`,
    });
  }

  // Warning centres (approaching limit)
  for (const c of centers.filter(c => c.status === "warning")) {
    lines.push({
      fr: `🟡 "${c.name}" approche la saturation : utilisation moyenne ${c.avgUtilizationRate.toFixed(1)}% — pic à ${c.maxUtilizationRate.toFixed(1)}%.`,
      ar: `🟡 "${c.name}" يقترب من التشبع: متوسط الاستخدام ${c.avgUtilizationRate.toFixed(1)}% — الذروة ${c.maxUtilizationRate.toFixed(1)}%.`,
    });
  }

  // Underused centres
  const underused = centers.filter(c => c.status === "underused");
  if (underused.length > 0) {
    const names = underused.map(c => `"${c.name}" (${c.avgUtilizationRate.toFixed(1)}%)`).join(", ");
    const namesAr = underused.map(c => `"${c.name}" (${c.avgUtilizationRate.toFixed(1)}%)`).join("، ");
    lines.push({
      fr: `📉 Capacité sous-utilisée détectée : ${names}. Ces ressources pourraient absorber la charge des centres surchargés.`,
      ar: `📉 طاقة غير مستغلة: ${namesAr}. هذه الموارد يمكنها استيعاب حمل المراكز المثقلة.`,
    });
  }

  // Good centres
  const goodCenters = centers.filter(c => c.status === "good");
  if (goodCenters.length > 0 && goodCenters.length < centers.length) {
    const names = goodCenters.map(c => `"${c.name}"`).join(", ");
    lines.push({
      fr: `✅ Centres équilibrés : ${names} opèrent dans des plages de charge optimales.`,
      ar: `✅ مراكز متوازنة: ${names} تعمل ضمن نطاقات تحميل مثالية.`,
    });
  }

  return lines;
}

// ── Bilingual dynamic recommendations generator ───────────────────────────────
export function generateCapacityRecommendations(
  results: CapacityResults,
  periodLabels: string[],
): Array<{ icon: string; fr: string; ar: string; descFr: string; descAr: string }> {
  const recos: Array<{ icon: string; fr: string; ar: string; descFr: string; descAr: string }> = [];
  const { centers, bottleneckCenterCount, overallStatus } = results;

  const bottlenecks = centers.filter(c => c.isBottleneck);
  const underused   = centers.filter(c => c.status === "underused");
  const warnings    = centers.filter(c => c.status === "warning");

  if (bottleneckCenterCount === 0 && overallStatus === "good") {
    recos.push({
      icon: "✅",
      fr: "Maintenir l'équilibre actuel de la charge",
      ar: "الحفاظ على توازن الحمل الحالي",
      descFr: "Tous les centres opèrent dans des plages saines. Continuez à surveiller la charge à chaque nouvelle période pour détecter toute dérive précoce.",
      descAr: "جميع المراكز تعمل ضمن نطاقات صحية. استمر في مراقبة الحمل مع كل فترة جديدة للكشف المبكر عن أي انحراف.",
    });
    recos.push({
      icon: "📋",
      fr: "Mettre à jour le plan à chaque révision de la demande",
      ar: "تحديث الخطة مع كل مراجعة للطلب",
      descFr: "La demande évolue à chaque période. Réactualisez les charges prévisionnelles dès qu'une commande importante est confirmée ou annulée.",
      descAr: "يتغيّر الطلب مع كل فترة. حدّث الأحمال التنبؤية فور تأكيد أو إلغاء طلب مهم.",
    });
    return recos;
  }

  // Bottleneck-specific recommendations
  for (const c of bottlenecks) {
    const maxPIdx = c.bottleneckPeriods.reduce(
      (best, p) => c.periods[p].utilizationRate > c.periods[best].utilizationRate ? p : best,
      c.bottleneckPeriods[0],
    );
    const excess = Math.abs(c.periods[maxPIdx].capacityGap).toFixed(1);
    const periodLabel = periodLabels[maxPIdx];

    recos.push({
      icon: "🚨",
      fr: `Éliminer le goulot sur "${c.name}"`,
      ar: `إزالة الاختناق في "${c.name}"`,
      descFr: `Ce centre est surchargé sur ${c.bottleneckPeriods.length} période(s). Déficit de capacité maximal : ${excess} unités en ${periodLabel}. Options immédiates : heures supplémentaires, sous-traitance, ou rééquilibrage de la charge vers un centre disponible.`,
      descAr: `هذا المركز مثقل على مدى ${c.bottleneckPeriods.length} فترة(فترات). أقصى عجز في الطاقة: ${excess} وحدة في ${periodLabel}. خيارات فورية: ساعات إضافية، مناولة خارجية، أو إعادة توزيع الحمل على مركز متاح.`,
    });
  }

  // Transfer load from bottlenecks to underused
  if (bottlenecks.length > 0 && underused.length > 0) {
    const fromNames   = bottlenecks.map(c => `"${c.name}"`).join(", ");
    const toNames     = underused.map(c => `"${c.name}" (${c.avgUtilizationRate.toFixed(1)}%)`).join(", ");
    const fromNamesAr = bottlenecks.map(c => `"${c.name}"`).join("، ");
    const toNamesAr   = underused.map(c => `"${c.name}" (${c.avgUtilizationRate.toFixed(1)}%)`).join("، ");
    recos.push({
      icon: "⚖️",
      fr: "Transférer la charge vers les centres sous-utilisés",
      ar: "نقل الحمل إلى المراكز ذات الطاقة الفائضة",
      descFr: `Les centres surchargés (${fromNames}) peuvent décharger une partie de leur charge vers les centres sous-utilisés (${toNames}), qui disposent de capacité disponible immédiate.`,
      descAr: `المراكز المثقلة (${fromNamesAr}) يمكنها تحويل جزء من حملها إلى المراكز ذات الطاقة الفائضة (${toNamesAr}) التي لديها طاقة متاحة فورية.`,
    });
  }

  // Warning centres
  if (warnings.length > 0) {
    const names   = warnings.map(c => `"${c.name}" (${c.maxUtilizationRate.toFixed(1)}%)`).join(", ");
    const namesAr = warnings.map(c => `"${c.name}" (${c.maxUtilizationRate.toFixed(1)}%)`).join("، ");
    recos.push({
      icon: "⚠️",
      fr: "Surveiller les centres en tension avant saturation",
      ar: "مراقبة المراكز المتوترة قبل الوصول إلى التشبع",
      descFr: `Les centres suivants approchent leur limite de capacité et risquent de devenir des goulots dans les prochaines périodes : ${names}. Planifiez des mesures préventives dès maintenant.`,
      descAr: `المراكز التالية تقترب من حد طاقتها وقد تصبح اختناقات في الفترات القادمة: ${namesAr}. خطّط لتدابير وقائية الآن.`,
    });
  }

  // Underused without bottleneck context
  if (underused.length > 0 && bottlenecks.length === 0) {
    const names   = underused.map(c => `"${c.name}"`).join(", ");
    const namesAr = underused.map(c => `"${c.name}"`).join("، ");
    recos.push({
      icon: "📉",
      fr: "Réaffecter ou réduire la capacité des centres sous-chargés",
      ar: "إعادة تخصيص طاقة المراكز المحملة بأقل من طاقتها",
      descFr: `Les centres ${names} sont nettement sous-utilisés. Envisagez de leur affecter des charges supplémentaires, de réduire temporairement leur capacité disponible, ou de redéployer leurs ressources vers d'autres activités.`,
      descAr: `المراكز ${namesAr} تعمل بأقل بكثير من طاقتها. فكر في تخصيص أحمال إضافية لها، أو تقليص طاقتها المتاحة مؤقتاً، أو إعادة توجيه مواردها نحو أنشطة أخرى.`,
    });
  }

  // Always: update plan recommendation
  recos.push({
    icon: "🔄",
    fr: "Réviser le plan de charge à chaque changement de demande",
    ar: "مراجعة خطة التحميل مع كل تغيير في الطلب",
    descFr: "La demande client évolue constamment. Recalculez les taux de charge à chaque nouvelle commande confirmée pour anticiper les goulots avant qu'ils n'impactent la production.",
    descAr: "طلب العملاء يتغيّر باستمرار. أعد حساب معدلات التحميل مع كل طلب جديد مؤكد لتوقع الاختناقات قبل أن تؤثر على الإنتاج.",
  });

  return recos;
}
