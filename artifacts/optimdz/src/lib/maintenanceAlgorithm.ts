// ── Types ─────────────────────────────────────────────────────────────────────

export interface EquipmentInput {
  id: string;
  name: string;
  tbf: string;    // Temps de bon fonctionnement cumulé (h)
  pannes: string; // Nombre de pannes
  ttr: string;    // Temps total de réparation cumulé (h)
}

export type EquipmentStatus = "ok" | "warning" | "critical" | "error";
export type ErrorKey = "zero_pannes" | "negative_values" | "empty" | "zero_tbf_mttr";

export interface EquipmentResult {
  id: string;
  name: string;
  tbf: number;
  pannes: number;
  ttr: number;
  mtbf: number | null;
  mttr: number | null;
  disponibilite: number | null; // 0–100
  status: EquipmentStatus;
  errorKey?: ErrorKey;
}

export interface MaintenanceResults {
  equipments: EquipmentResult[];
  fleetDisponibilite: number | null;
  fleetMtbf: number | null;
  fleetMttr: number | null;
  weakCount: number;     // disponibilite < 90
  criticalCount: number; // disponibilite < 80
}

export interface AnalysisLine {
  fr: string;
  ar: string;
}

export interface RecommendationItem {
  icon: string;
  fr: string;
  ar: string;
  descFr: string;
  descAr: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt1(n: number): string { return n.toFixed(1); }
function fmt2(n: number): string { return n.toFixed(2); }

function getStatus(disp: number): EquipmentStatus {
  if (disp >= 90) return "ok";
  if (disp >= 80) return "warning";
  return "critical";
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ── Core computation ──────────────────────────────────────────────────────────

export function computeMaintenance(inputs: EquipmentInput[]): MaintenanceResults {
  const equipments: EquipmentResult[] = inputs.map(eq => {
    const name = eq.name.trim() || "—";

    // Empty check
    if (eq.tbf === "" || eq.pannes === "" || eq.ttr === "") {
      return { id: eq.id, name, tbf: NaN, pannes: NaN, ttr: NaN, mtbf: null, mttr: null, disponibilite: null, status: "error" as const, errorKey: "empty" as const };
    }

    const tbf    = parseFloat(eq.tbf);
    const pannes = parseFloat(eq.pannes);
    const ttr    = parseFloat(eq.ttr);

    // NaN
    if (isNaN(tbf) || isNaN(pannes) || isNaN(ttr)) {
      return { id: eq.id, name, tbf: NaN, pannes: NaN, ttr: NaN, mtbf: null, mttr: null, disponibilite: null, status: "error" as const, errorKey: "empty" as const };
    }

    // Negative values
    if (tbf < 0 || pannes < 0 || ttr < 0) {
      return { id: eq.id, name, tbf, pannes, ttr, mtbf: null, mttr: null, disponibilite: null, status: "error" as const, errorKey: "negative_values" as const };
    }

    // Zero pannes — division impossible
    if (pannes === 0) {
      return { id: eq.id, name, tbf, pannes, ttr, mtbf: null, mttr: null, disponibilite: null, status: "error" as const, errorKey: "zero_pannes" as const };
    }

    const mtbf = tbf / pannes;
    const mttr = ttr / pannes;
    const denom = mtbf + mttr;
    const disponibilite = denom === 0 ? 0 : (mtbf / denom) * 100;
    const status = getStatus(disponibilite);

    return { id: eq.id, name, tbf, pannes, ttr, mtbf, mttr, disponibilite, status };
  });

  const valid = equipments.filter(e => e.status !== "error" && e.disponibilite !== null);

  const fleetDisponibilite = valid.length > 0 ? avg(valid.map(e => e.disponibilite!)) : null;
  const fleetMtbf          = valid.length > 0 ? avg(valid.map(e => e.mtbf!))         : null;
  const fleetMttr          = valid.length > 0 ? avg(valid.map(e => e.mttr!))         : null;
  const weakCount          = valid.filter(e => e.disponibilite! < 90).length;
  const criticalCount      = valid.filter(e => e.disponibilite! < 80).length;

  return { equipments, fleetDisponibilite, fleetMtbf, fleetMttr, weakCount, criticalCount };
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface ValidationError { fr: string; ar: string; }

export function validateInputs(inputs: EquipmentInput[]): ValidationError[] {
  const errors: ValidationError[] = [];

  if (inputs.length === 0) {
    errors.push({ fr: "Ajoutez au moins un équipement.", ar: "أضف معدة واحدة على الأقل." });
    return errors;
  }

  const unnamedIdx = inputs.findIndex(e => !e.name.trim());
  if (unnamedIdx !== -1) {
    errors.push({ fr: `L'équipement n°${unnamedIdx + 1} n'a pas de nom.`, ar: `المعدة رقم ${unnamedIdx + 1} ليس لها اسم.` });
  }

  // At least one fully valid row
  const hasValid = inputs.some(eq => {
    const tbf    = parseFloat(eq.tbf);
    const pannes = parseFloat(eq.pannes);
    const ttr    = parseFloat(eq.ttr);
    return !isNaN(tbf) && !isNaN(pannes) && !isNaN(ttr) && pannes > 0 && tbf >= 0 && ttr >= 0;
  });

  if (!hasValid) {
    errors.push({
      fr: "Aucun équipement ne contient des données valides. Vérifiez que le nombre de pannes est > 0 et que toutes les valeurs sont renseignées.",
      ar: "لا تحتوي أي معدة على بيانات صالحة. تحقق من أن عدد الأعطال > 0 وأن جميع القيم مُدخلة.",
    });
  }

  return errors;
}

// ── Analysis ──────────────────────────────────────────────────────────────────

export function generateMaintenanceAnalysis(results: MaintenanceResults): AnalysisLine[] {
  const lines: AnalysisLine[] = [];
  const valid = results.equipments.filter(e => e.status !== "error" && e.disponibilite !== null);

  if (valid.length === 0) {
    return [{ fr: "Aucune donnée valide à analyser.", ar: "لا توجد بيانات صالحة للتحليل." }];
  }

  // Fleet overview
  if (results.fleetDisponibilite !== null) {
    const fd = results.fleetDisponibilite;
    const fdLabel = fd >= 90
      ? { fr: "satisfaisante", ar: "مُرضية" }
      : fd >= 80
        ? { fr: "acceptable mais à surveiller", ar: "مقبولة لكن تستوجب المتابعة" }
        : { fr: "insuffisante — intervention requise", ar: "غير كافية — يلزم التدخل" };
    lines.push({
      fr: `La disponibilité moyenne de la flotte est de ${fmt2(fd)}% — ${fdLabel.fr}. MTBF moyen : ${fmt1(results.fleetMtbf!)}h, MTTR moyen : ${fmt1(results.fleetMttr!)}h.`,
      ar: `متوسط توافرية الأسطول يبلغ ${fmt2(fd)}% — ${fdLabel.ar}. متوسط MTBF: ${fmt1(results.fleetMtbf!)}س، متوسط MTTR: ${fmt1(results.fleetMttr!)}س.`,
    });
  }

  // Critical equipment (D < 80%)
  const criticals = valid.filter(e => e.disponibilite! < 80);
  if (criticals.length > 0) {
    lines.push({
      fr: `${criticals.length} équipement(s) en situation critique (disponibilité < 80%) : ${criticals.map(e => `${e.name} (${fmt2(e.disponibilite!)}%)`).join(", ")}.`,
      ar: `${criticals.length} معدة/معدات في وضع حرج (توافرية < 80%): ${criticals.map(e => `${e.name} (${fmt2(e.disponibilite!)}%)`).join("، ")}.`,
    });
  }

  // Warning equipment (80% ≤ D < 90%)
  const warnings = valid.filter(e => e.disponibilite! >= 80 && e.disponibilite! < 90);
  if (warnings.length > 0) {
    lines.push({
      fr: `${warnings.length} équipement(s) en zone d'alerte (80% ≤ D < 90%) : ${warnings.map(e => `${e.name} (${fmt2(e.disponibilite!)}%)`).join(", ")}.`,
      ar: `${warnings.length} معدة/معدات في منطقة التحذير (80% ≤ D < 90%): ${warnings.map(e => `${e.name} (${fmt2(e.disponibilite!)}%)`).join("، ")}.`,
    });
  }

  // High MTTR relative to fleet
  if (results.fleetMttr !== null && results.fleetMttr > 0) {
    const highMttr = valid.filter(e => e.mttr! > results.fleetMttr! * 1.5 && e.mttr! > 4);
    if (highMttr.length > 0) {
      lines.push({
        fr: `MTTR élevé (> 1,5× la moyenne flotte de ${fmt1(results.fleetMttr!)}h) : ${highMttr.map(e => `${e.name} (${fmt1(e.mttr!)}h)`).join(", ")}.`,
        ar: `زمن إصلاح مرتفع (> 1.5× متوسط الأسطول ${fmt1(results.fleetMttr!)}س): ${highMttr.map(e => `${e.name} (${fmt1(e.mttr!)}س)`).join("، ")}.`,
      });
    }
  }

  // Excellent performers
  const excellent = valid.filter(e => e.disponibilite! >= 95);
  if (excellent.length > 0) {
    lines.push({
      fr: `Équipement(s) performant(s) (D ≥ 95%) : ${excellent.map(e => `${e.name} (${fmt2(e.disponibilite!)}%)`).join(", ")}.`,
      ar: `معدات بأداء ممتاز (D ≥ 95%): ${excellent.map(e => `${e.name} (${fmt2(e.disponibilite!)}%)`).join("، ")}.`,
    });
  }

  // Excluded rows
  const errored = results.equipments.filter(e => e.status === "error");
  if (errored.length > 0) {
    lines.push({
      fr: `${errored.length} équipement(s) exclu(s) de l'analyse (données manquantes ou nombre de pannes = 0) : ${errored.map(e => e.name).join(", ")}.`,
      ar: `${errored.length} معدة/معدات مستبعدة من التحليل (بيانات ناقصة أو عدد أعطال = 0): ${errored.map(e => e.name).join("، ")}.`,
    });
  }

  return lines;
}

// ── Recommendations ───────────────────────────────────────────────────────────

export function generateMaintenanceRecommendations(results: MaintenanceResults): RecommendationItem[] {
  const recs: RecommendationItem[] = [];
  const valid = results.equipments.filter(e => e.status !== "error" && e.disponibilite !== null);

  if (valid.length === 0) return [];

  const avgMttr = results.fleetMttr ?? 0;

  // Critical equipment — one targeted rec per equipment
  const criticals = valid.filter(e => e.disponibilite! < 80);
  for (const eq of criticals) {
    recs.push({
      icon: "🔴",
      fr: `Plan de maintenance d'urgence pour « ${eq.name} »`,
      ar: `خطة صيانة طارئة لـ « ${eq.name} »`,
      descFr: `La disponibilité de « ${eq.name} » est de ${fmt2(eq.disponibilite!)}% — niveau critique. Avec un MTBF de ${fmt1(eq.mtbf!)}h et un MTTR de ${fmt1(eq.mttr!)}h, engagez immédiatement un programme de maintenance préventive renforcé : inspection hebdomadaire, remplacement des pièces d'usure et audit technique complet.`,
      descAr: `توافرية « ${eq.name} » تبلغ ${fmt2(eq.disponibilite!)}% — مستوى حرج. مع MTBF بقيمة ${fmt1(eq.mtbf!)}س وMTTR بقيمة ${fmt1(eq.mttr!)}س، ابدأ فوراً ببرنامج صيانة وقائية مكثف: فحص أسبوعي، استبدال قطع التآكل، ومراجعة تقنية شاملة.`,
    });
  }

  // Warning equipment
  const warnings = valid.filter(e => e.disponibilite! >= 80 && e.disponibilite! < 90);
  for (const eq of warnings) {
    recs.push({
      icon: "🟡",
      fr: `Renforcer la maintenance préventive de « ${eq.name} »`,
      ar: `تعزيز الصيانة الوقائية لـ « ${eq.name} »`,
      descFr: `« ${eq.name} » affiche une disponibilité de ${fmt2(eq.disponibilite!)}% (zone d'alerte). MTBF = ${fmt1(eq.mtbf!)}h, MTTR = ${fmt1(eq.mttr!)}h. Planifiez des inspections périodiques renforcées et vérifiez l'état des composants critiques pour stabiliser les indicateurs avant d'atteindre le seuil critique.`,
      descAr: `« ${eq.name} » تسجل توافرية ${fmt2(eq.disponibilite!)}% (منطقة تحذير). MTBF = ${fmt1(eq.mtbf!)}س، MTTR = ${fmt1(eq.mttr!)}س. خطط لعمليات فحص دورية مكثفة وتحقق من حالة المكونات الحيوية لاستقرار المؤشرات قبل الوصول إلى العتبة الحرجة.`,
    });
  }

  // High MTTR but acceptable availability — recommend logistics improvement
  if (avgMttr > 0) {
    const highMttr = valid.filter(e =>
      e.mttr! > avgMttr * 1.5 && e.mttr! > 4 && e.disponibilite! >= 90
    ).slice(0, 2);
    for (const eq of highMttr) {
      recs.push({
        icon: "🔧",
        fr: `Réduire le temps de réparation de « ${eq.name} »`,
        ar: `تقليص زمن إصلاح « ${eq.name} »`,
        descFr: `« ${eq.name} » a un MTTR de ${fmt1(eq.mttr!)}h (${(eq.mttr! / avgMttr).toFixed(1)}× la moyenne de la flotte). Constituez un stock de pièces de rechange dédié et formez les techniciens aux procédures d'intervention rapide pour ramener ce délai sous ${fmt1(avgMttr * 1.2)}h.`,
        descAr: `« ${eq.name} » يسجل MTTR بقيمة ${fmt1(eq.mttr!)}س (${(eq.mttr! / avgMttr).toFixed(1)}× متوسط الأسطول). كوّن مخزوناً من قطع الغيار وأعد تأهيل الفنيين على إجراءات التدخل السريع لخفض هذا الزمن إلى ما دون ${fmt1(avgMttr * 1.2)}س.`,
      });
    }
  }

  // Excellent performers — reinforce and replicate
  const excellent = valid.filter(e => e.disponibilite! >= 95);
  if (excellent.length > 0 && recs.length < 6) {
    const namesFr = excellent.map(e => `« ${e.name} »`).join(", ");
    const namesAr = excellent.map(e => `« ${e.name} »`).join("، ");
    recs.push({
      icon: "✅",
      fr: `Maintenir les bonnes pratiques pour ${namesFr}`,
      ar: `الحفاظ على الممارسات الجيدة لـ ${namesAr}`,
      descFr: `${excellent.length > 1 ? "Ces équipements affichent" : "Cet équipement affiche"} une disponibilité ≥ 95% — résultat d'une maintenance rigoureuse. Continuez les révisions planifiées et documentez les pratiques actuelles pour les répliquer sur les équipements moins performants.`,
      descAr: `${excellent.length > 1 ? "هذه المعدات تسجل" : "هذه المعدة تسجل"} توافرية ≥ 95% — نتيجة لصيانة دقيقة ومنتظمة. حافظ على جدول المراجعات المقررة ووثّق الممارسات الحالية لتطبيقها على المعدات الأقل أداءً.`,
    });
  }

  // All healthy — no weak equipment
  if (recs.length === 0) {
    recs.push({
      icon: "✅",
      fr: "Flotte en bonne santé — maintenir la vigilance",
      ar: "الأسطول في حالة جيدة — الحفاظ على اليقظة",
      descFr: "Tous les équipements affichent une disponibilité ≥ 90%. Maintenez les plannings de maintenance préventive actuels et mettez en place un tableau de bord de suivi mensuel pour anticiper toute dérive des indicateurs.",
      descAr: "جميع المعدات تسجل توافرية ≥ 90%. حافظ على برامج الصيانة الوقائية الحالية وأنشئ لوحة متابعة شهرية لاستباق أي انجراف في المؤشرات.",
    });
  }

  return recs;
}

// ── Industry templates ────────────────────────────────────────────────────────

let _uid = 0;
export function uid(): string { return `m${++_uid}`; }

export type SectorKey = "industrie" | "services" | "agriculture" | "custom";

export function buildTemplate(sector: SectorKey): EquipmentInput[] {
  if (sector === "industrie") {
    return [
      { id: uid(), name: "Compresseur A200",          tbf: "2100", pannes: "7",  ttr: "63"  },
      { id: uid(), name: "Tour CNC-12",               tbf: "900",  pannes: "9",  ttr: "270" },
      { id: uid(), name: "Convoyeur principal",        tbf: "2800", pannes: "4",  ttr: "12"  },
      { id: uid(), name: "Presse hydraulique HY-300", tbf: "560",  pannes: "14", ttr: "420" },
      { id: uid(), name: "Pompe de circulation P05",  tbf: "1500", pannes: "5",  ttr: "25"  },
    ];
  }
  if (sector === "services") {
    return [
      { id: uid(), name: "Ascenseur principal",       tbf: "3500", pannes: "5", ttr: "10"  },
      { id: uid(), name: "Groupe électrogène",        tbf: "1200", pannes: "6", ttr: "120" },
      { id: uid(), name: "Climatisation centrale",    tbf: "640",  pannes: "8", ttr: "240" },
      { id: uid(), name: "Chaudière CB-100",          tbf: "2400", pannes: "4", ttr: "16"  },
    ];
  }
  if (sector === "agriculture") {
    return [
      { id: uid(), name: "Tracteur T-150",                  tbf: "720",  pannes: "12", ttr: "120" },
      { id: uid(), name: "Moissonneuse-batteuse MB-8",       tbf: "400",  pannes: "8",  ttr: "200" },
      { id: uid(), name: "Système d'irrigation SI-3",        tbf: "2500", pannes: "5",  ttr: "25"  },
      { id: uid(), name: "Pompe hydraulique PH-2",           tbf: "1080", pannes: "6",  ttr: "54"  },
    ];
  }
  // custom — blank rows
  return [
    { id: uid(), name: "", tbf: "", pannes: "", ttr: "" },
    { id: uid(), name: "", tbf: "", pannes: "", ttr: "" },
    { id: uid(), name: "", tbf: "", pannes: "", ttr: "" },
  ];
}
