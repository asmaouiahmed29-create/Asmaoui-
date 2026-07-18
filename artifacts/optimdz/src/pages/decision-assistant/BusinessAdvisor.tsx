import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { generateAdvisorPDFReport, type AdvisorSynthesis, type OverallRating } from "@/lib/generateAdvisorPDF";
import {
  Brain, FileText, Loader2, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Minus, Activity, Briefcase,
  BarChart2, LineChart, GitCompare, Database, ExternalLink,
  RefreshCw, ChevronRight, ChevronLeft, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ApiRecord {
  id: number;
  name: string;
  sector: string;
  createdAt: string;
  optimalValue: number | null;
  problemData: Record<string, unknown>;
  result: Record<string, unknown> | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

function fDA(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(Math.round(n));
  const str = abs >= 1_000_000
    ? (abs / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + " M DA"
    : abs >= 1_000
    ? (abs / 1_000).toFixed(1).replace(/\.0$/, "") + " k DA"
    : abs.toLocaleString("fr-DZ") + " DA";
  return (n < 0 ? "−" : "") + str;
}
function fPct(n: number | null | undefined, dec = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(dec) + " %";
}
function fPctAbs(n: number | null | undefined, dec = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return n.toFixed(dec) + " %";
}

// ─────────────────────────────────────────────────────────────────────────────
// Synthesis engine
// ─────────────────────────────────────────────────────────────────────────────

function byType(records: ApiRecord[], type: string): ApiRecord | null {
  return records
    .filter((r) => (r.problemData as Record<string, unknown>)?.type === type)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

function buildSynthesis(records: ApiRecord[]): AdvisorSynthesis | null {
  const kpiRec = byType(records, "kpi-tracking");
  const investRec = byType(records, "investment-appraisal");
  const breakEvenRec = byType(records, "project-breakeven");
  const sensitivityRec = byType(records, "sensitivity-analysis");
  const compRec = byType(records, "investment-comparison");

  const kpiPeriods = (kpiRec?.problemData as Record<string, unknown[]> | null)?.periods?.length ?? 0;
  const hasSufficientKpi = kpiPeriods >= 2;
  const hasFeasibility = !!(investRec || breakEvenRec || sensitivityRec || compRec);

  if (!hasSufficientKpi && !hasFeasibility) return null;

  // ── KPI health ─────────────────────────────────────────────────────────────
  type KpiHealth = AdvisorSynthesis["kpi"];
  let kpi: KpiHealth = null;
  if (hasSufficientKpi && kpiRec) {
    const r = (kpiRec.result ?? {}) as Record<string, number | string>;
    const opr = r.overallProfitTrend as string;
    let score = 0;
    if (opr === "up") score += 2;
    else if (opr === "down") score -= 2;
    if ((r.avgProfitGrowthPct as number) > 5) score += 1;
    else if ((r.avgProfitGrowthPct as number) < -5) score -= 1;
    if ((r.latestMarginPct as number) > 15) score += 1;
    else if ((r.latestMarginPct as number) < 5) score -= 1;
    if ((r.avgRevenueGrowthPct as number) > 5) score += 1;
    else if ((r.avgRevenueGrowthPct as number) < -5) score -= 1;

    kpi = {
      health: score >= 2 ? "strong" : score <= -2 ? "weak" : "mixed",
      businessName: (kpiRec.problemData as Record<string, string>)?.businessName ?? kpiRec.name,
      periodCount: kpiPeriods,
      latestProfit: (r.latestProfit as number) ?? 0,
      latestMarginPct: (r.latestMarginPct as number) ?? 0,
      avgProfitGrowthPct: (r.avgProfitGrowthPct as number) ?? 0,
      overallProfitTrend: opr ?? "stable",
    };
  }

  // ── Investment appraisal ──────────────────────────────────────────────────
  type InvAnalysis = AdvisorSynthesis["investment"];
  let investment: InvAnalysis = null;
  if (investRec) {
    const r = (investRec.result ?? {}) as Record<string, number | null>;
    const npv = (r.npv as number) ?? 0;
    const irr = r.irr as number | null;
    const pi = (r.profitabilityIndex as number) ?? 0;
    const dp = r.discountedPayback;
    const goCount = [npv > 0, irr !== null && irr > 0, pi >= 1, dp !== null && dp !== undefined].filter(Boolean).length;
    const pData = (investRec.problemData as Record<string, Record<string, string>>);
    investment = {
      verdict: goCount >= 3 ? "go" : goCount >= 2 ? "conditional" : "nogo",
      projectName: pData?.input?.projectName ?? investRec.name,
      npv, irr, profitabilityIndex: pi,
    };
  }

  // ── Break-even ────────────────────────────────────────────────────────────
  type BEAnalysis = AdvisorSynthesis["breakEven"];
  let breakEven: BEAnalysis = null;
  if (breakEvenRec) {
    const r = (breakEvenRec.result ?? {}) as Record<string, number>;
    const mos = (r.marginOfSafetyPct as number) ?? 0;
    const pData = (breakEvenRec.problemData as Record<string, Record<string, string>>);
    breakEven = {
      productName: pData?.input?.productName ?? breakEvenRec.name,
      marginOfSafetyPct: mos,
      breakEvenRevenue: (r.breakEvenRevenue as number) ?? 0,
      safetyLevel: mos >= 25 ? "safe" : mos >= 10 ? "moderate" : "risky",
    };
  }

  // ── Sensitivity ───────────────────────────────────────────────────────────
  type SensAnalysis = AdvisorSynthesis["sensitivity"];
  let sensitivity: SensAnalysis = null;
  if (sensitivityRec) {
    const r = (sensitivityRec.result ?? {}) as Record<string, unknown>;
    const pcts = Object.values((r.breakEvenPcts as Record<string, number | null>) ?? {})
      .filter((v): v is number => v !== null && isFinite(v));
    const minAbs = pcts.length > 0 ? Math.min(...pcts.map(Math.abs)) : null;
    sensitivity = {
      mostSensitiveVar: (r.mostSensitiveVar as string | null) ?? null,
      riskLevel: minAbs === null ? "moderate" : minAbs < 15 ? "very-high" : minAbs < 25 ? "high" : minAbs < 40 ? "moderate" : "low",
      minBreakEvenPct: minAbs,
    };
  }

  // ── Comparison ────────────────────────────────────────────────────────────
  type CompSummary = AdvisorSynthesis["comparison"];
  let comparison: CompSummary = null;
  if (compRec) {
    const r = (compRec.result ?? {}) as Record<string, unknown>;
    comparison = {
      winner: (r.winner as string) ?? "—",
      winnerNPV: (r.winnerNPV as number) ?? 0,
    };
  }

  // ── Overall rating ────────────────────────────────────────────────────────
  const hasKpi = !!kpi;
  const hasInvest = !!(investment || comparison);
  const sensitivityBump = sensitivity && (sensitivity.riskLevel === "very-high" || sensitivity.riskLevel === "high");

  let rating: OverallRating;
  let verdictFr: string;
  let verdictAr: string;
  let reasoningFr: string[] = [];
  let reasoningAr: string[] = [];

  if (hasKpi && hasInvest) {
    const kh = kpi!.health;
    const iv = investment?.verdict ?? "conditional";
    if (kh === "strong" && iv === "go") {
      rating = sensitivityBump ? "good" : "strong";
      verdictFr = "Forte opportunité de croissance bien supportée par vos données";
      verdictAr = "فرصة نمو قوية مدعومة جيداً ببياناتك";
      reasoningFr = [
        `L'activité « ${kpi!.businessName} » (${kpi!.periodCount} périodes) affiche une progression globale — bénéfice moyen : ${fPct(kpi!.avgProfitGrowthPct)}/période, marge actuelle : ${fPctAbs(kpi!.latestMarginPct)}.`,
        `L'investissement « ${investment!.projectName} » est viable : VAN = ${fDA(investment!.npv)} > 0, indice de rentabilité = ${investment!.profitabilityIndex.toFixed(2)}${investment!.irr !== null ? `, TRI = ${fPct(investment!.irr)}` : ""}.`,
        sensitivityBump
          ? `Nuance : l'analyse de sensibilité signale un risque ${sensitivity!.riskLevel} (tolérance minimale ${fPctAbs(Math.abs(sensitivity!.minBreakEvenPct!))} avant NPV < 0). Sécurisez vos hypothèses de flux.`
          : "La combinaison d'une activité en croissance et d'un investissement à VAN positive représente un contexte favorable pour progresser.",
      ];
      reasoningAr = [
        `نشاط « ${kpi!.businessName} » (${kpi!.periodCount} فترات) يُظهر تقدماً إجمالياً — متوسط نمو الربح: ${fPct(kpi!.avgProfitGrowthPct)}/فترة، الهامش الحالي: ${fPctAbs(kpi!.latestMarginPct)}.`,
        `الاستثمار « ${investment!.projectName} » قابل للتطبيق: NPV = ${fDA(investment!.npv)} > 0، مؤشر الربحية = ${investment!.profitabilityIndex.toFixed(2)}${investment!.irr !== null ? `، IRR = ${fPct(investment!.irr)}` : ""}.`,
        sensitivityBump
          ? `تحفظ: تحليل الحساسية يُنبّه إلى مخاطر ${sensitivity!.riskLevel} (تحمّل أدنى ${fPctAbs(Math.abs(sensitivity!.minBreakEvenPct!))} قبل أن تنعدم NPV). احرص على تثبيت فرضيات التدفقات.`
          : "يُمثّل الجمع بين نشاط في نمو واستثمار بـ NPV إيجابية سياقاً ملائماً للمضي قُدُماً.",
      ];
    } else if (kh === "strong" && iv === "conditional") {
      rating = "good";
      verdictFr = "Solide base d'activité — approfondissez l'analyse de l'investissement avant de vous engager";
      verdictAr = "أساس نشاط متين — عمّق تحليل الاستثمار قبل الالتزام";
      reasoningFr = [
        `L'activité « ${kpi!.businessName} » (${kpi!.periodCount} périodes) est performante — marge actuelle ${fPctAbs(kpi!.latestMarginPct)}, tendance globale du bénéfice : ${kpi!.overallProfitTrend === "up" ? "hausse" : kpi!.overallProfitTrend === "down" ? "baisse" : "stable"}.`,
        `L'investissement « ${investment!.projectName} » affiche des signaux partiellement positifs (VAN = ${fDA(investment!.npv)}) mais tous les indicateurs ne convergent pas vers un GO franc.`,
        "Votre assise commerciale solide vous donne le temps d'affiner les hypothèses et de revalider l'investissement avant tout engagement.",
      ];
      reasoningAr = [
        `نشاط « ${kpi!.businessName} » (${kpi!.periodCount} فترات) في أداء جيد — الهامش الحالي ${fPctAbs(kpi!.latestMarginPct)}، الاتجاه العام للربح: ${kpi!.overallProfitTrend === "up" ? "صعود" : kpi!.overallProfitTrend === "down" ? "هبوط" : "استقرار"}.`,
        `الاستثمار « ${investment!.projectName} » يُظهر إشارات إيجابية جزئية (NPV = ${fDA(investment!.npv)}) لكن لا تتقاطع جميع المؤشرات نحو GO صريح.`,
        "قاعدتك التجارية الراسخة تمنحك وقتاً لتدقيق الفرضيات وإعادة التحقق من الاستثمار قبل أي التزام.",
      ];
    } else if (kh === "strong" && iv === "nogo") {
      rating = "caution";
      verdictFr = "Performances opérationnelles solides, mais cet investissement présente des risques significatifs";
      verdictAr = "أداء تشغيلي متين، لكن هذا الاستثمار ينطوي على مخاطر كبيرة";
      reasoningFr = [
        `L'activité « ${kpi!.businessName} » est en bonne santé — marge ${fPctAbs(kpi!.latestMarginPct)}, tendance du bénéfice : ${kpi!.overallProfitTrend}.`,
        `Cependant, l'investissement « ${investment!.projectName} » n'atteint pas le seuil de rentabilité requis : VAN = ${fDA(investment!.npv)}${investment!.npv < 0 ? " (négative)" : ""}. Les indicateurs financiers sont défavorables.`,
        "Ne mettez pas en péril votre activité principale pour un investissement dont les fondamentaux financiers sont faibles. Reconsidérez ou restructurez le projet.",
      ];
      reasoningAr = [
        `نشاط « ${kpi!.businessName} » في صحة جيدة — الهامش ${fPctAbs(kpi!.latestMarginPct)}، اتجاه الربح: ${kpi!.overallProfitTrend}.`,
        `غير أن الاستثمار « ${investment!.projectName} » لا يبلغ عتبة الربحية المطلوبة: NPV = ${fDA(investment!.npv)}${investment!.npv < 0 ? " (سلبية)" : ""}. المؤشرات المالية غير مواتية.`,
        "لا تُعرّض نشاطك الأساسي للخطر من أجل استثمار أُسسه المالية ضعيفة. أعد النظر فيه أو أعد هيكلته.",
      ];
    } else if (kh === "mixed" && iv === "go") {
      rating = sensitivityBump ? "caution" : "good";
      verdictFr = "Investissement prometteur, mais l'activité appelle une attention parallèle";
      verdictAr = "استثمار واعد، لكن النشاط يستدعي اهتماماً موازياً";
      reasoningFr = [
        `L'investissement « ${investment!.projectName} » affiche des indicateurs positifs : VAN = ${fDA(investment!.npv)}, IP = ${investment!.profitabilityIndex.toFixed(2)}.`,
        `L'activité « ${kpi!.businessName} » (${kpi!.periodCount} périodes) montre des signaux mixtes — marge ${fPctAbs(kpi!.latestMarginPct)}, croissance du bénéfice ${fPct(kpi!.avgProfitGrowthPct)}/période.`,
        "Procédez à l'investissement, mais conduisez en parallèle un audit de la performance opérationnelle pour stabiliser la base d'activité.",
      ];
      reasoningAr = [
        `الاستثمار « ${investment!.projectName} » يُظهر مؤشرات إيجابية: NPV = ${fDA(investment!.npv)}، مؤشر الربحية = ${investment!.profitabilityIndex.toFixed(2)}.`,
        `نشاط « ${kpi!.businessName} » (${kpi!.periodCount} فترات) يُظهر إشارات مختلطة — الهامش ${fPctAbs(kpi!.latestMarginPct)}، نمو الربح ${fPct(kpi!.avgProfitGrowthPct)}/فترة.`,
        "امضِ قُدُماً في الاستثمار، لكن أجرِ في الوقت ذاته مراجعة للأداء التشغيلي لتثبيت قاعدة النشاط.",
      ];
    } else if (kh === "mixed" && iv === "conditional") {
      rating = "caution";
      verdictFr = "Situation mitigée — des clarifications sont nécessaires avant de progresser";
      verdictAr = "وضع مختلط — توضيحات ضرورية قبل المضي قدماً";
      reasoningFr = [
        `L'activité « ${kpi!.businessName} » présente des signaux ambivalents sur ${kpi!.periodCount} périodes — ni claire amélioration ni détérioration nette.`,
        `L'investissement « ${investment!.projectName} » n'est pas convaincant avec VAN = ${fDA(investment!.npv)} et un verdict conditionnel.`,
        "L'accumulation de signaux mitigés des deux côtés recommande la prudence. Identifiez d'abord les leviers de croissance de l'activité, puis réévaluez l'investissement.",
      ];
      reasoningAr = [
        `نشاط « ${kpi!.businessName} » يُظهر إشارات متقلبة على ${kpi!.periodCount} فترات — لا تحسن واضح ولا تدهور صريح.`,
        `الاستثمار « ${investment!.projectName} » غير مُقنع مع NPV = ${fDA(investment!.npv)} وحكم مشروط.`,
        "تراكم الإشارات المختلطة من الجانبين يوصي بالحذر. حدد أولاً رافعات نمو النشاط، ثم أعد تقييم الاستثمار.",
      ];
    } else if (kh === "mixed" && iv === "nogo") {
      rating = "caution";
      verdictFr = "Double signal de prudence — activité mitigée et investissement non recommandé";
      verdictAr = "إشارة حذر مزدوجة — نشاط متذبذب واستثمار غير مُوصى به";
      reasoningFr = [
        `L'activité « ${kpi!.businessName} » (${kpi!.periodCount} périodes) ne montre pas de tendance claire — marge actuelle ${fPctAbs(kpi!.latestMarginPct)}.`,
        `L'investissement « ${investment!.projectName} » est négatif (VAN = ${fDA(investment!.npv)}). Se lancer dans cet investissement en période de performance instable amplifie le risque.`,
        "Concentrez-vous sur la consolidation de l'activité actuelle avant d'envisager de nouveaux engagements financiers.",
      ];
      reasoningAr = [
        `نشاط « ${kpi!.businessName} » (${kpi!.periodCount} فترات) لا يُظهر اتجاهاً واضحاً — الهامش الحالي ${fPctAbs(kpi!.latestMarginPct)}.`,
        `الاستثمار « ${investment!.projectName} » سلبي (NPV = ${fDA(investment!.npv)}). الإقدام على هذا الاستثمار في فترة أداء غير مستقر يُضاعف المخاطر.`,
        "ركّز على تعزيز النشاط الحالي قبل التفكير في التزامات مالية جديدة.",
      ];
    } else if (kh === "weak") {
      rating = "alert";
      verdictFr = investment
        ? `Tensions opérationnelles prioritaires — corrigez les performances avant ${iv === "go" ? "cet investissement pourtant viable" : "tout nouvel engagement"}`
        : "Situation d'alerte — l'activité nécessite une action corrective urgente";
      verdictAr = investment
        ? `ضغوط تشغيلية أولاً — صحّح الأداء قبل ${iv === "go" ? "هذا الاستثمار الجيد في حد ذاته" : "أي التزام جديد"}`
        : "حالة تنبيه — النشاط يحتاج إجراءً تصحيحياً عاجلاً";
      reasoningFr = [
        `L'activité « ${kpi!.businessName} » (${kpi!.periodCount} périodes) affiche des signaux préoccupants — marge ${fPctAbs(kpi!.latestMarginPct)}, tendance globale du bénéfice : ${kpi!.overallProfitTrend === "down" ? "baisse" : "stable"}, croissance ${fPct(kpi!.avgProfitGrowthPct)}/période.`,
        investment
          ? iv === "go"
            ? `L'investissement « ${investment.projectName} » a des fondamentaux viables (VAN = ${fDA(investment.npv)}), mais s'engager avec une base opérationnelle fragilisée amplifie le risque d'échec.`
            : `L'investissement « ${investment.projectName} » n'est pas recommandé en l'état (VAN = ${fDA(investment.npv)}), ce qui renforce la nécessité de se concentrer sur l'activité existante.`
          : "Aucune évaluation d'investissement récente n'est disponible.",
        "Priorité absolue : diagnostic de la structure des coûts, révision de la politique tarifaire, et plan d'action correctif avant tout nouvel engagement financier.",
      ];
      reasoningAr = [
        `نشاط « ${kpi!.businessName} » (${kpi!.periodCount} فترات) يُظهر إشارات مقلقة — الهامش ${fPctAbs(kpi!.latestMarginPct)}، اتجاه الربح العام: ${kpi!.overallProfitTrend === "down" ? "هبوط" : "استقرار"}، نمو ${fPct(kpi!.avgProfitGrowthPct)}/فترة.`,
        investment
          ? iv === "go"
            ? `الاستثمار « ${investment.projectName} » له أسس قابلة للتطبيق (NPV = ${fDA(investment.npv)})، لكن الالتزام به مع قاعدة تشغيلية هشة يُضاعف مخاطر الإخفاق.`
            : `الاستثمار « ${investment.projectName} » غير مُوصى به في وضعه الراهن (NPV = ${fDA(investment.npv)})، مما يعزز ضرورة التركيز على النشاط القائم.`
          : "لا يوجد تقييم استثمار حديث متاح.",
        "الأولوية المطلقة: تشخيص هيكل التكاليف، مراجعة سياسة التسعير، وخطة عمل تصحيحية قبل أي التزام مالي جديد.",
      ];
    } else {
      rating = "caution";
      verdictFr = "Données insuffisantes pour une recommandation complète";
      verdictAr = "بيانات غير كافية لتوصية شاملة";
      reasoningFr = ["Ajoutez des données des deux modules (KPI et Faisabilité) pour obtenir une synthèse croisée."];
      reasoningAr = ["أضف بيانات من الوحدتين (مؤشرات الأداء والجدوى) للحصول على تركيب متكامل."];
    }
  } else if (hasKpi && !hasInvest) {
    const kh = kpi!.health;
    rating = kh === "strong" ? "good" : kh === "weak" ? "alert" : "caution";
    verdictFr = kh === "strong"
      ? "Activité en bonne santé — ajoutez une évaluation de projet pour une vue complète"
      : kh === "weak"
      ? "Performances préoccupantes — action corrective recommandée"
      : "Performance stable — quelques points de vigilance à surveiller";
    verdictAr = kh === "strong"
      ? "نشاط في صحة جيدة — أضف تقييم مشروع للحصول على رؤية شاملة"
      : kh === "weak"
      ? "أداء مقلق — يُوصى باتخاذ إجراء تصحيحي"
      : "أداء مستقر — بعض نقاط المراقبة تستوجب الانتباه";
    reasoningFr = [
      `Analyse basée sur ${kpi!.periodCount} périodes de suivi KPI pour « ${kpi!.businessName} ».`,
      `Dernier bénéfice : ${fDA(kpi!.latestProfit)}, marge : ${fPctAbs(kpi!.latestMarginPct)}, croissance moyenne du bénéfice : ${fPct(kpi!.avgProfitGrowthPct)}/période.`,
      "Ajoutez une évaluation d'investissement (VAN/TRI, Seuil de Rentabilité, ou Sensibilité) pour obtenir une recommandation croisée complète.",
    ];
    reasoningAr = [
      `التحليل مبني على ${kpi!.periodCount} فترات متابعة مؤشرات لـ « ${kpi!.businessName} ».`,
      `آخر ربح: ${fDA(kpi!.latestProfit)}، الهامش: ${fPctAbs(kpi!.latestMarginPct)}، متوسط نمو الربح: ${fPct(kpi!.avgProfitGrowthPct)}/فترة.`,
      "أضف تقييم استثمار (NPV/IRR، نقطة التعادل، أو الحساسية) للحصول على توصية متقاطعة كاملة.",
    ];
  } else {
    // Only feasibility, no KPI
    const iv = investment?.verdict ?? (comparison ? "go" : breakEven?.safetyLevel === "safe" ? "go" : "conditional");
    rating = iv === "go" ? "good" : iv === "conditional" ? "caution" : "alert";
    verdictFr = iv === "go"
      ? "Projet d'investissement avec de bons fondamentaux — ajoutez le suivi KPI pour compléter"
      : iv === "conditional"
      ? "Investissement à précautions — approfondissez l'analyse avant de vous engager"
      : "Investissement déconseillé en l'état — revoyez les hypothèses";
    verdictAr = iv === "go"
      ? "مشروع استثمار بأسس جيدة — أضف متابعة المؤشرات لإكمال الصورة"
      : iv === "conditional"
      ? "استثمار باحتياطات — عمّق التحليل قبل الالتزام"
      : "الاستثمار غير مُوصى به في وضعه الراهن — راجع الفرضيات";
    reasoningFr = [
      investment
        ? `Évaluation de l'investissement « ${investment.projectName} » : VAN = ${fDA(investment.npv)}, IP = ${investment.profitabilityIndex.toFixed(2)}${investment.irr !== null ? `, TRI = ${fPct(investment.irr)}` : ""}.`
        : comparison
        ? `Comparaison d'alternatives : meilleure option « ${comparison.winner} » avec VAN = ${fDA(comparison.winnerNPV)}.`
        : breakEven
        ? `Seuil de rentabilité de « ${breakEven.productName} » : ${fDA(breakEven.breakEvenRevenue)} avec marge de sécurité de ${fPctAbs(breakEven.marginOfSafetyPct)}.`
        : "Données de faisabilité disponibles.",
      "Ajoutez au moins 2-3 périodes de suivi KPI pour enrichir cette analyse avec la réalité opérationnelle de votre activité.",
    ];
    reasoningAr = [
      investment
        ? `تقييم الاستثمار « ${investment.projectName} »: NPV = ${fDA(investment.npv)}، مؤشر الربحية = ${investment.profitabilityIndex.toFixed(2)}${investment.irr !== null ? `، IRR = ${fPct(investment.irr)}` : ""}.`
        : comparison
        ? `مقارنة البدائل: أفضل خيار « ${comparison.winner} » بـ NPV = ${fDA(comparison.winnerNPV)}.`
        : breakEven
        ? `نقطة تعادل « ${breakEven.productName} »: ${fDA(breakEven.breakEvenRevenue)} بهامش أمان ${fPctAbs(breakEven.marginOfSafetyPct)}.`
        : "بيانات الجدوى متاحة.",
      "أضف ما لا يقل عن 2-3 فترات متابعة مؤشرات لإثراء هذا التحليل بالواقع التشغيلي لنشاطك.",
    ];
  }

  // ── Data points (explicit attribution) ────────────────────────────────────
  const dataPointsFr: string[] = [];
  const dataPointsAr: string[] = [];
  if (kpi) {
    dataPointsFr.push(`Suivi KPI — « ${kpi.businessName} » · ${kpi.periodCount} périodes analysées · Dernier bénéfice: ${fDA(kpi.latestProfit)} · Marge: ${fPctAbs(kpi.latestMarginPct)} · Croissance bénéfice moy.: ${fPct(kpi.avgProfitGrowthPct)}/pér. · Tendance globale: ${kpi.overallProfitTrend}`);
    dataPointsAr.push(`متابعة المؤشرات — « ${kpi.businessName} » · ${kpi.periodCount} فترات محللة · آخر ربح: ${fDA(kpi.latestProfit)} · الهامش: ${fPctAbs(kpi.latestMarginPct)} · متوسط نمو الربح: ${fPct(kpi.avgProfitGrowthPct)}/فترة · الاتجاه العام: ${kpi.overallProfitTrend}`);
  }
  if (investment) {
    dataPointsFr.push(`Évaluation investissement — « ${investment.projectName} » · VAN: ${fDA(investment.npv)} · TRI: ${investment.irr !== null ? fPct(investment.irr) : "—"} · IP: ${investment.profitabilityIndex.toFixed(2)} · Verdict: ${investment.verdict.toUpperCase()}`);
    dataPointsAr.push(`تقييم الاستثمار — « ${investment.projectName} » · NPV: ${fDA(investment.npv)} · IRR: ${investment.irr !== null ? fPct(investment.irr) : "—"} · مؤشر الربحية: ${investment.profitabilityIndex.toFixed(2)} · الحكم: ${investment.verdict.toUpperCase()}`);
  }
  if (breakEven) {
    dataPointsFr.push(`Seuil de rentabilité — « ${breakEven.productName} » · Seuil: ${fDA(breakEven.breakEvenRevenue)} · Marge de sécurité: ${fPctAbs(breakEven.marginOfSafetyPct)} · Niveau: ${breakEven.safetyLevel}`);
    dataPointsAr.push(`نقطة التعادل — « ${breakEven.productName} » · العتبة: ${fDA(breakEven.breakEvenRevenue)} · هامش الأمان: ${fPctAbs(breakEven.marginOfSafetyPct)} · المستوى: ${breakEven.safetyLevel}`);
  }
  if (sensitivity) {
    dataPointsFr.push(`Sensibilité — Variable la plus sensible: ${sensitivity.mostSensitiveVar ?? "—"} · Tolérance minimale: ${sensitivity.minBreakEvenPct !== null ? fPctAbs(Math.abs(sensitivity.minBreakEvenPct)) : "—"} · Niveau de risque: ${sensitivity.riskLevel}`);
    dataPointsAr.push(`الحساسية — أكثر متغير حساسية: ${sensitivity.mostSensitiveVar ?? "—"} · الحد الأدنى للتحمّل: ${sensitivity.minBreakEvenPct !== null ? fPctAbs(Math.abs(sensitivity.minBreakEvenPct)) : "—"} · مستوى الخطر: ${sensitivity.riskLevel}`);
  }
  if (comparison) {
    dataPointsFr.push(`Comparaison alternatives — Gagnant: « ${comparison.winner} » · VAN gagnante: ${fDA(comparison.winnerNPV)}`);
    dataPointsAr.push(`مقارنة البدائل — الفائز: « ${comparison.winner} » · NPV الفائز: ${fDA(comparison.winnerNPV)}`);
  }

  // ── Next steps ────────────────────────────────────────────────────────────
  const nextStepsFr: string[] = [];
  const nextStepsAr: string[] = [];

  if (kpi) {
    nextStepsFr.push(`Renseignez la prochaine période KPI pour « ${kpi.businessName} » dès la fin de la période afin de suivre l'évolution de la marge (actuellement ${fPctAbs(kpi.latestMarginPct)}).`);
    nextStepsAr.push(`أدخل فترة المؤشرات القادمة لـ « ${kpi.businessName} » فور انتهائها لمتابعة تطور الهامش (حالياً ${fPctAbs(kpi.latestMarginPct)}).`);
  } else {
    nextStepsFr.push("Démarrez le suivi KPI avec au moins 2-3 périodes pour enrichir cette analyse d'une dimension opérationnelle réelle.");
    nextStepsAr.push("ابدأ متابعة المؤشرات بما لا يقل عن 2-3 فترات لإثراء هذا التحليل ببُعد تشغيلي حقيقي.");
  }

  if (investment && investment.verdict !== "go") {
    nextStepsFr.push(`Révisez les hypothèses de flux de « ${investment.projectName} » — notamment le taux d'actualisation et les projections de trésorerie — pour améliorer le verdict.`);
    nextStepsAr.push(`راجع فرضيات تدفقات « ${investment.projectName} » — ولا سيما معدل الخصم وتوقعات التدفق النقدي — لتحسين الحكم.`);
  }
  if (sensitivity && (sensitivity.riskLevel === "very-high" || sensitivity.riskLevel === "high")) {
    nextStepsFr.push(`Relancez l'analyse de sensibilité avec une plage de variation plus large — la tolérance actuelle de ${sensitivity.minBreakEvenPct !== null ? fPctAbs(Math.abs(sensitivity.minBreakEvenPct)) : "—"} sur ${sensitivity.mostSensitiveVar ?? "la variable clé"} est serrée.`);
    nextStepsAr.push(`أعد إجراء تحليل الحساسية بنطاق تغير أوسع — التحمّل الحالي ${sensitivity.minBreakEvenPct !== null ? fPctAbs(Math.abs(sensitivity.minBreakEvenPct)) : "—"} على ${sensitivity.mostSensitiveVar ?? "المتغير الرئيسي"} ضيّق.`);
  }
  if (!hasFeasibility) {
    nextStepsFr.push("Évaluez la faisabilité d'un projet avec l'outil VAN/TRI ou le Seuil de Rentabilité pour obtenir une recommandation croisée complète.");
    nextStepsAr.push("قيّم جدوى مشروع بأداة NPV/IRR أو نقطة التعادل للحصول على توصية متقاطعة كاملة.");
  }
  if (rating === "alert" || (kpi && kpi.health === "weak")) {
    nextStepsFr.push("Lancez un audit de la structure des coûts : décomposez charges fixes et variables, comparez aux ratios sectoriels, et identifiez les postes à rationaliser en priorité.");
    nextStepsAr.push("أجرِ مراجعة هيكل التكاليف: قسّم الأعباء الثابتة والمتغيرة، قارن بمعايير القطاع، وحدد البنود ذات الأولوية في الترشيد.");
  }

  return {
    rating, verdictFr, verdictAr, reasoningFr, reasoningAr,
    kpi, investment, breakEven, sensitivity, comparison,
    dataPointsFr, dataPointsAr, nextStepsFr, nextStepsAr,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────

const RATING_META: Record<OverallRating, { icon: string; colorClass: string; borderClass: string; bgClass: string; labelFr: string; labelAr: string }> = {
  strong: { icon: "🟢", colorClass: "text-green-700", borderClass: "border-green-400", bgClass: "bg-green-50", labelFr: "SITUATION FORTE", labelAr: "وضع قوي" },
  good:   { icon: "🔵", colorClass: "text-blue-700",  borderClass: "border-blue-400",  bgClass: "bg-blue-50",  labelFr: "SITUATION FAVORABLE", labelAr: "وضع مناسب" },
  caution:{ icon: "🟡", colorClass: "text-amber-700", borderClass: "border-amber-400", bgClass: "bg-amber-50", labelFr: "VIGILANCE RECOMMANDÉE", labelAr: "يُنصح باليقظة" },
  alert:  { icon: "🔴", colorClass: "text-red-700",   borderClass: "border-red-400",   bgClass: "bg-red-50",   labelFr: "ALERTE — ACTION REQUISE", labelAr: "تنبيه — مطلوب اتخاذ إجراء" },
};

function TrendIcon({ t }: { t: string }) {
  if (t === "up") return <TrendingUp className="w-4 h-4 text-green-600 inline" />;
  if (t === "down") return <TrendingDown className="w-4 h-4 text-destructive inline" />;
  return <Minus className="w-4 h-4 text-muted-foreground inline" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state guidance
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ reason, isAr }: { reason: "none" | "insufficient"; isAr: boolean }) {
  const ChevDir = isAr ? ChevronLeft : ChevronRight;
  const tips = [
    { icon: <Activity className="w-5 h-5" />, href: "/kpi-dashboard/tracking",
      fr: "Suivi Manuel des KPI", ar: "تتبع مؤشرات الأداء يدوياً",
      descFr: "Saisissez 2-3 périodes (mensuel ou trimestriel) et sauvegardez le rapport.",
      descAr: "أدخل 2-3 فترات (شهرية أو ربع سنوية) واحفظ التقرير." },
    { icon: <TrendingUp className="w-5 h-5" />, href: "/project-feasibility/breakeven",
      fr: "Analyse du Seuil de Rentabilité", ar: "تحليل نقطة التعادل",
      descFr: "Évaluez la viabilité de base de votre produit/service et sauvegardez.",
      descAr: "قيّم الجدوى الأساسية لمنتجك/خدمتك واحفظ النتيجة." },
    { icon: <BarChart2 className="w-5 h-5" />, href: "/project-feasibility/investment-appraisal",
      fr: "Évaluation de Rentabilité (VAN/TRI)", ar: "تقييم الجدوى الاستثمارية (NPV/IRR)",
      descFr: "Calculez la VAN et le TRI d'un investissement et sauvegardez le rapport.",
      descAr: "احسب NPV وIRR لاستثمار ما واحفظ التقرير." },
  ];

  return (
    <div className="space-y-8 py-4">
      <div className="text-center space-y-3 max-w-lg mx-auto">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
          <Database className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {isAr ? "لا توجد بيانات كافية بعد" : "Pas encore assez de données"}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {reason === "none"
            ? isAr
              ? "يحتاج المستشار الشامل إلى بيانات محفوظة من أدوات المنصة الأخرى. أكمل واحداً أو أكثر من الأدوات أدناه واحفظ نتيجتها."
              : "Le Conseiller Complet a besoin de données sauvegardées depuis les autres outils de la plateforme. Complétez un ou plusieurs outils ci-dessous et sauvegardez leurs résultats."
            : isAr
              ? "تتبع مؤشرات الأداء يحتاج على الأقل فترتين لاستخراج اتجاه. أضف فترة ثانية ثم أعد تحديث هذه الصفحة."
              : "Le suivi KPI nécessite au moins 2 périodes pour détecter une tendance. Ajoutez une deuxième période puis actualisez cette page."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {tips.map((tip) => (
          <Link key={tip.href} href={tip.href}>
            <div className="flex items-start gap-4 rounded-xl border border-primary/30 bg-card p-4 hover:border-primary hover:shadow-sm transition-all cursor-pointer group">
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {tip.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{isAr ? tip.ar : tip.fr}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{isAr ? tip.descAr : tip.descFr}</p>
              </div>
              <ChevDir className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary" />
            </div>
          </Link>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {isAr
          ? "بعد الحفظ في أحد هذه الأدوات، ارجع إلى هنا وسيظهر لك التوصية الشاملة تلقائياً."
          : "Après avoir sauvegardé dans l'un de ces outils, revenez ici — la recommandation apparaîtra automatiquement."}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function BusinessAdvisor() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [synthesis, setSynthesis] = useState<AdvisorSynthesis | null>(null);
  const [insufficientReason, setInsufficientReason] = useState<"none" | "insufficient">("none");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [managerName, setManagerName] = useState("");
  const [institutionName, setInstitutionName] = useState("");

  const ChevDir = isAr ? ChevronLeft : ChevronRight;

  async function fetchData() {
    setLoading(true); setFetchError(null);
    try {
      const res = await fetch("/api-server/api/problems?limit=100");
      // Guard against proxy rewriting a 500 into an HTML page
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("application/json")) {
        // API unavailable or table missing — treat as no data
        setSynthesis(null);
        setInsufficientReason("none");
        setLoading(false);
        return;
      }
      const records: ApiRecord[] = await res.json();
      const s = buildSynthesis(records);
      if (!s) {
        // Check why: KPI with < 2 periods?
        const kpiRec = byType(records, "kpi-tracking");
        const kpiPeriods = (kpiRec?.problemData as Record<string, unknown[]> | null)?.periods?.length ?? 0;
        setInsufficientReason(kpiRec && kpiPeriods < 2 ? "insufficient" : "none");
        setSynthesis(null);
      } else {
        setSynthesis(s);
      }
    } catch (e) {
      setFetchError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  async function handlePdfExport() {
    if (!synthesis) return;
    setPdfLoading(true);
    try {
      await generateAdvisorPDFReport({ synthesis, managerName, institutionName });
      setPdfOpen(false);
    } catch (e) {
      console.error("PDF error:", e);
    } finally {
      setPdfLoading(false);
    }
  }

  const meta = synthesis ? RATING_META[synthesis.rating] : null;

  return (
    <div className={`min-h-[100dvh] bg-muted/20 ${isAr ? "rtl" : "ltr"}`} dir={isAr ? "rtl" : "ltr"}>
      <main className="container mx-auto px-4 py-8 space-y-8 max-w-3xl pb-20">

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            {t("Outil 2 — Conseiller d'Affaires Complet", "الأداة ٢ — المستشار الشامل للأعمال")}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {t("Recommandation synthétisée sur votre activité", "توصية مُركَّبة حول نشاطك")}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
            {t(
              "Cet outil lit vos données sauvegardées (KPI, Faisabilité) et produit un jugement global honnête — chaque affirmation est directement liée à une donnée réelle que vous pouvez voir.",
              "تقرأ هذه الأداة بياناتك المحفوظة (المؤشرات، الجدوى) وتُصدر حكماً شاملاً صادقاً — كل تأكيد مرتبط مباشرة ببيانات حقيقية يمكنك رؤيتها."
            )}
          </p>
        </div>

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">{t("Lecture des données sauvegardées…", "جارٍ قراءة البيانات المحفوظة…")}</p>
          </div>
        )}

        {/* ── Fetch error ───────────────────────────────────────────────────── */}
        {!loading && fetchError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-semibold text-sm text-destructive">
                {t("Impossible de charger les données", "تعذّر تحميل البيانات")}
              </p>
              <p className="text-xs text-muted-foreground">{fetchError}</p>
              <Button size="sm" variant="outline" onClick={fetchData} className="gap-2">
                <RefreshCw className="w-3.5 h-3.5" />
                {t("Réessayer", "إعادة المحاولة")}
              </Button>
            </div>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {!loading && !fetchError && !synthesis && (
          <EmptyState reason={insufficientReason} isAr={isAr} />
        )}

        {/* ── Full synthesis ────────────────────────────────────────────────── */}
        {!loading && !fetchError && synthesis && meta && (
          <div className="space-y-6">

            {/* Refresh button */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t("Basé sur vos données les plus récentes", "مبني على أحدث بياناتك المحفوظة")}
              </p>
              <Button size="sm" variant="ghost" onClick={fetchData} className="gap-1.5 text-xs">
                <RefreshCw className="w-3.5 h-3.5" />
                {t("Actualiser", "تحديث")}
              </Button>
            </div>

            {/* ── Overall verdict ──────────────────────────────────────────── */}
            <div className={cn("rounded-2xl border-2 p-6 space-y-4", meta.borderClass, meta.bgClass)}>
              <div className="flex items-start gap-4">
                <span className="text-3xl shrink-0">{meta.icon}</span>
                <div className="space-y-1">
                  <p className={cn("text-xs font-bold uppercase tracking-widest", meta.colorClass)}>
                    {isAr ? meta.labelAr : meta.labelFr}
                  </p>
                  <h2 className="text-lg font-bold text-foreground leading-snug">
                    {isAr ? synthesis.verdictAr : synthesis.verdictFr}
                  </h2>
                </div>
              </div>
              <div className="space-y-2.5">
                {(isAr ? synthesis.reasoningAr : synthesis.reasoningFr).map((line, i) => (
                  <div key={i} className={cn("flex items-start gap-2.5 text-sm text-foreground leading-relaxed rounded-lg border px-3 py-2.5 bg-white/60", meta.borderClass, "border-opacity-40")}>
                    <span className={cn("font-bold text-xs mt-0.5 shrink-0", meta.colorClass)}>{i + 1}.</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Business Performance Snapshot ───────────────────────────── */}
            {synthesis.kpi && (
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      {t("Snapshot de performance — ", "لقطة الأداء — ")}{synthesis.kpi.businessName}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {synthesis.kpi.periodCount} {t("périodes analysées", "فترات محللة")}
                    </p>
                  </div>
                  <span className={cn("ms-auto text-[10px] font-bold px-2.5 py-0.5 rounded-full",
                    synthesis.kpi.health === "strong" ? "bg-green-100 text-green-700"
                    : synthesis.kpi.health === "weak"  ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                  )}>
                    {isAr
                      ? synthesis.kpi.health === "strong" ? "قوي" : synthesis.kpi.health === "weak" ? "ضعيف" : "مختلط"
                      : synthesis.kpi.health === "strong" ? "Fort" : synthesis.kpi.health === "weak" ? "Faible" : "Mitigé"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { labelFr: "Dernier bénéfice", labelAr: "آخر ربح", value: fDA(synthesis.kpi.latestProfit), trend: null },
                    { labelFr: "Marge bénéficiaire", labelAr: "هامش الربح", value: fPctAbs(synthesis.kpi.latestMarginPct), trend: null },
                    { labelFr: "Croissance profit moy.", labelAr: "نمو الربح المتوسط", value: fPct(synthesis.kpi.avgProfitGrowthPct), trend: null },
                    { labelFr: "Tendance globale", labelAr: "الاتجاه العام", value: synthesis.kpi.overallProfitTrend, trend: synthesis.kpi.overallProfitTrend },
                  ].map((item) => (
                    <div key={item.labelFr} className="rounded-lg bg-muted/40 border border-border p-3 space-y-1">
                      <p className="text-[10px] text-muted-foreground font-medium">{isAr ? item.labelAr : item.labelFr}</p>
                      <p className="text-sm font-bold text-foreground flex items-center gap-1">
                        {item.trend ? <TrendIcon t={item.trend} /> : null}
                        {item.trend ? null : item.value}
                      </p>
                    </div>
                  ))}
                </div>
                <Link href="/kpi-dashboard/tracking">
                  <button className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline">
                    {t("Ouvrir le Suivi KPI", "فتح متابعة المؤشرات")} <ChevDir className="w-3 h-3" />
                  </button>
                </Link>
              </div>
            )}

            {/* ── Investment Readiness ─────────────────────────────────────── */}
            {(synthesis.investment || synthesis.breakEven || synthesis.sensitivity || synthesis.comparison) && (
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground">
                    {t("Évaluations de faisabilité & investissement", "تقييمات الجدوى والاستثمار")}
                  </h3>
                </div>

                <div className="space-y-3">
                  {synthesis.investment && (
                    <div className={cn("rounded-lg border-l-4 px-3 py-2.5",
                      synthesis.investment.verdict === "go" ? "border-l-green-500 bg-green-50" :
                      synthesis.investment.verdict === "conditional" ? "border-l-amber-500 bg-amber-50" : "border-l-red-500 bg-red-50"
                    )}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <BarChart2 className="w-3.5 h-3.5" />
                          {t("VAN/TRI", "NPV/IRR")} — {synthesis.investment.projectName}
                        </p>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                          synthesis.investment.verdict === "go" ? "bg-green-100 text-green-700" :
                          synthesis.investment.verdict === "conditional" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                        )}>
                          {synthesis.investment.verdict.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        VAN/NPV: <strong>{fDA(synthesis.investment.npv)}</strong> ·
                        {synthesis.investment.irr !== null && <> TRI/IRR: <strong>{fPct(synthesis.investment.irr)}</strong> ·</>}
                        IP: <strong>{synthesis.investment.profitabilityIndex.toFixed(2)}</strong>
                      </p>
                    </div>
                  )}

                  {synthesis.breakEven && (
                    <div className={cn("rounded-lg border-l-4 px-3 py-2.5",
                      synthesis.breakEven.safetyLevel === "safe" ? "border-l-green-500 bg-green-50" :
                      synthesis.breakEven.safetyLevel === "moderate" ? "border-l-amber-500 bg-amber-50" : "border-l-red-500 bg-red-50"
                    )}>
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {t("Seuil de rentabilité", "نقطة التعادل")} — {synthesis.breakEven.productName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("Seuil", "العتبة")}: <strong>{fDA(synthesis.breakEven.breakEvenRevenue)}</strong> ·
                        {t(" Marge de sécurité", " هامش الأمان")}: <strong>{fPctAbs(synthesis.breakEven.marginOfSafetyPct)}</strong>
                      </p>
                    </div>
                  )}

                  {synthesis.sensitivity && (
                    <div className={cn("rounded-lg border-l-4 px-3 py-2.5",
                      synthesis.sensitivity.riskLevel === "low" ? "border-l-green-500 bg-green-50" :
                      synthesis.sensitivity.riskLevel === "moderate" ? "border-l-blue-400 bg-blue-50" :
                      synthesis.sensitivity.riskLevel === "high" ? "border-l-amber-500 bg-amber-50" : "border-l-red-500 bg-red-50"
                    )}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <LineChart className="w-3.5 h-3.5" />
                          {t("Sensibilité", "الحساسية")}
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {t("Risque", "خطر")}: {synthesis.sensitivity.riskLevel}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("Variable critique", "المتغير الحرج")}: <strong>{synthesis.sensitivity.mostSensitiveVar ?? "—"}</strong> ·
                        {t(" Tolérance min.", " الحد الأدنى")}: <strong>{synthesis.sensitivity.minBreakEvenPct !== null ? fPctAbs(Math.abs(synthesis.sensitivity.minBreakEvenPct)) : "—"}</strong>
                      </p>
                    </div>
                  )}

                  {synthesis.comparison && (
                    <div className="rounded-lg border-l-4 border-l-primary bg-primary/5 px-3 py-2.5">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <GitCompare className="w-3.5 h-3.5" />
                        {t("Meilleure alternative", "أفضل بديل")}: <span className="text-primary">{synthesis.comparison.winner}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        VAN/NPV: <strong>{fDA(synthesis.comparison.winnerNPV)}</strong>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Data sources (transparency) ──────────────────────────────── */}
            <div className="rounded-xl border bg-muted/20 p-5 space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                {t("Données utilisées pour cette recommandation", "البيانات المستخدمة في هذه التوصية")}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t(
                  "Chaque affirmation ci-dessus est basée exclusivement sur les enregistrements suivants — rien n'est inventé ou générique.",
                  "كل تأكيد أعلاه مستند حصرياً على السجلات التالية — لا شيء مخترَع أو عام."
                )}
              </p>
              <div className="space-y-2">
                {(isAr ? synthesis.dataPointsAr : synthesis.dataPointsFr).map((dp, i) => (
                  <div key={i} className="rounded-lg bg-card border border-border px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground me-1">{i + 1}.</span>{dp}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Next steps ───────────────────────────────────────────────── */}
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-primary" />
                {t("Prochaines étapes recommandées", "الخطوات التالية الموصى بها")}
              </h3>
              <div className="space-y-2.5">
                {(isAr ? synthesis.nextStepsAr : synthesis.nextStepsFr).map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── PDF Export button ────────────────────────────────────────── */}
            <div className="flex justify-end">
              <Button onClick={() => setPdfOpen(true)} className="gap-2">
                <FileText className="w-4 h-4" />
                {t("Exporter en PDF", "تصدير كـ PDF")}
              </Button>
            </div>

            {/* ── PDF Dialog ───────────────────────────────────────────────── */}
            <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
              <DialogContent dir={isAr ? "rtl" : "ltr"} className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("Exporter le rapport PDF", "تصدير تقرير PDF")}</DialogTitle>
                  <DialogDescription>
                    {t("Informations optionnelles pour personnaliser l'en-tête du rapport.", "معلومات اختيارية لتخصيص رأس التقرير.")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label>{t("Nom du responsable (optionnel)", "اسم المسؤول (اختياري)")}</Label>
                    <Input value={managerName} onChange={(e) => setManagerName(e.target.value)}
                      placeholder={t("Ex. : M. Benali Karim", "مثال: محمد بن علي")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("Nom de l'entreprise (optionnel)", "اسم المؤسسة (اختياري)")}</Label>
                    <Input value={institutionName} onChange={(e) => setInstitutionName(e.target.value)}
                      placeholder={t("Ex. : Entreprise ABC", "مثال: مؤسسة ABC")} />
                  </div>
                  <Button onClick={handlePdfExport} disabled={pdfLoading} className="w-full gap-2">
                    {pdfLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" />{t("Génération…", "جارٍ الإنشاء…")}</>
                      : <><FileText className="w-4 h-4" />{t("Télécharger le PDF", "تنزيل PDF")}</>}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="border-t pt-6 flex items-center justify-between text-sm text-muted-foreground">
          <Link href="/decision-assistant" className="hover:text-primary transition-colors flex items-center gap-1">
            {isAr ? <ChevronLeft className="w-4 h-4 rotate-180" /> : <ChevronLeft className="w-4 h-4" />}
            {t("← Retour à l'Assistant de Décision", "→ العودة إلى مساعد القرار")}
          </Link>
          <Link href="/" className="hover:text-primary transition-colors">
            {t("Portail OptimDZ", "بوابة OptimDZ")}
          </Link>
        </footer>

      </main>
    </div>
  );
}
