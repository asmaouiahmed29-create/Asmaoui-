import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import type { KpiTrackingResult } from "@/lib/kpiTrackingAlgorithm";
import { fmtDA, fmtPct, fmtPctAbs, fmtN } from "@/lib/kpiTrackingAlgorithm";
import { generateKpiPDFReport } from "@/lib/generateKpiPDF";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText, Save, CheckCircle2, Loader2, AlertTriangle,
  BarChart2, Lightbulb, ClipboardList,
  TrendingUp, TrendingDown, Minus, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  result: KpiTrackingResult;
  sector: string | null;
}

// ── Trend Arrow ───────────────────────────────────────────────────────────────
function TrendBadge({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up")
    return <TrendingUp className="w-4 h-4 text-green-600" />;
  if (trend === "down")
    return <TrendingDown className="w-4 h-4 text-destructive" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

export function KpiTrackingReport({ result, sector }: Props) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const [pdfOpen,         setPdfOpen]         = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [savedOk,         setSavedOk]         = useState(false);
  const [saveError,       setSaveError]       = useState<string | null>(null);
  const [pdfLoading,      setPdfLoading]      = useState(false);
  const [managerName,     setManagerName]     = useState("");
  const [institutionName, setInstitutionName] = useState("");

  const { summary, periods, businessName, periodType } = result;
  const latest = periods[periods.length - 1];
  const prev   = periods.length >= 2 ? periods[periods.length - 2] : null;

  // ── Situational Analysis ──────────────────────────────────────────────────
  // analysisLines kept for PDF export; paragraphs drive the on-screen rendering
  interface AnalysisLine { icon: string; text: string; color: string }
  const analysisLines: AnalysisLine[] = [];

  const periodLabel = periodType === "monthly"
    ? t("mois", "أشهر")
    : t("trimestre(s)", "أرباع سنة");

  // ── Para 1: overall performance scope & trend ────────────────────────────
  const para1 = summary.overallProfitTrend === "up"
    ? t(
        `Sur les ${periods.length} ${periodLabel} analysés (${periods[0].label} → ${latest.label}), "${businessName}" affiche une dynamique positive : le bénéfice net progresse en moyenne de ${fmtPct(summary.avgProfitGrowthPct)} par période, tandis que le chiffre d'affaires croît de ${fmtPct(summary.avgRevenueGrowthPct)}. La trajectoire d'ensemble est encourageante et témoigne d'une gestion saine de la croissance.`,
        `على مدى ${periods.length} ${periodLabel} المحللة (${periods[0].label} → ${latest.label})، تُظهر "${businessName}" ديناميكية إيجابية: يتقدم صافي الربح بمعدل ${fmtPct(summary.avgProfitGrowthPct)} في المتوسط لكل فترة، ويرتفع رقم الأعمال بـ ${fmtPct(summary.avgRevenueGrowthPct)}. المسار الإجمالي مشجّع ويعكس إدارة سليمة للنمو.`
      )
    : summary.overallProfitTrend === "down"
    ? t(
        `Sur les ${periods.length} ${periodLabel} analysés (${periods[0].label} → ${latest.label}), "${businessName}" enregistre un recul du bénéfice net de ${fmtPct(Math.abs(summary.avgProfitGrowthPct))} en moyenne par période. Même si le chiffre d'affaires évolue de ${fmtPct(summary.avgRevenueGrowthPct)}, la trajectoire bénéficiaire appelle une attention soutenue et une révision des leviers de performance.`,
        `على مدى ${periods.length} ${periodLabel} المحللة (${periods[0].label} → ${latest.label})، تُسجّل "${businessName}" تراجعاً في صافي الربح بمعدل ${fmtPct(Math.abs(summary.avgProfitGrowthPct))} لكل فترة. وبينما يتطور رقم الأعمال بـ ${fmtPct(summary.avgRevenueGrowthPct)}، تستوجب مسيرة الربحية اهتماماً مستمراً ومراجعة لرافعات الأداء.`
      )
    : t(
        `Sur les ${periods.length} ${periodLabel} analysés (${periods[0].label} → ${latest.label}), "${businessName}" présente une performance globalement stable : le bénéfice net varie de ${fmtPct(summary.avgProfitGrowthPct)} en moyenne par période, sans tendance haussière ou baissière marquée. Cette stabilité peut être un point d'appui — ou le signe que des leviers de croissance restent inexploités.`,
        `على مدى ${periods.length} ${periodLabel} المحللة (${periods[0].label} → ${latest.label})، تُبدي "${businessName}" أداءً مستقراً في مجمله: يتفاوت صافي الربح بمعدل ${fmtPct(summary.avgProfitGrowthPct)} لكل فترة دون اتجاه صاعد أو هابط واضح. هذا الاستقرار قد يكون نقطة ارتكاز — أو إشارة إلى وجود رافعات نمو لم تُستثمر بعد.`
      );
  analysisLines.push({ icon: "📊", color: "bg-primary/10 border-primary/30", text: para1 });

  // ── Para 2: latest period detail vs previous ─────────────────────────────
  let para2 = "";
  if (prev) {
    const revDiff  = latest.revenue   - prev.revenue;
    const profDiff = latest.netProfit - prev.netProfit;
    const revDir   = revDiff  >= 0 ? t("en hausse", "بارتفاع") : t("en baisse", "بانخفاض");
    const profDir  = profDiff >= 0 ? t("en amélioration", "بتحسن")  : t("en repli",     "بتراجع");
    para2 = t(
      `La dernière période (${latest.label}) affiche un CA de ${fmtDA(latest.revenue)}, ${revDir} de ${fmtDA(Math.abs(revDiff))} par rapport à ${prev.label}. Le bénéfice net s'établit à ${fmtDA(latest.netProfit)} — ${profDir} de ${fmtDA(Math.abs(profDiff))} — pour une marge de ${fmtPctAbs(latest.profitMarginPct)}. ${summary.profitTrend === "up" ? "Ce résultat confirme la dynamique positive." : summary.profitTrend === "down" ? "Ce glissement mérite d'être surveillé de près." : "Le résultat reste comparable à la période précédente."}`,
      `الفترة الأخيرة (${latest.label}) تُسجّل رقم أعمال بـ ${fmtDA(latest.revenue)}، ${revDir} بمقدار ${fmtDA(Math.abs(revDiff))} مقارنةً بـ ${prev.label}. يبلغ صافي الربح ${fmtDA(latest.netProfit)} — ${profDir} بمقدار ${fmtDA(Math.abs(profDiff))} — لهامش ربح ${fmtPctAbs(latest.profitMarginPct)}. ${summary.profitTrend === "up" ? "هذه النتيجة تؤكد الديناميكية الإيجابية." : summary.profitTrend === "down" ? "هذا الانخفاض يستحق متابعة دقيقة." : "النتيجة تبقى مقارِبة للفترة السابقة."}`
    );
    analysisLines.push({
      icon: summary.profitTrend === "up" ? "✅" : summary.profitTrend === "down" ? "⚠️" : "➡️",
      color: summary.profitTrend === "up" ? "bg-green-50 border-green-300"
           : summary.profitTrend === "down" ? "bg-amber-50 border-amber-300"
           : "bg-muted/30 border-border",
      text: para2,
    });
  }

  // ── Para 3: structural risk signals (merged) ─────────────────────────────
  const riskFrParts: string[] = [];
  const riskArParts: string[] = [];

  if (summary.consecutiveProfitDeclines >= 2) {
    riskFrParts.push(`Le bénéfice recule depuis ${summary.consecutiveProfitDeclines} périodes consécutives — signal persistant qui indique généralement un problème structurel (hausse des charges, érosion des prix ou perte de volume).`);
    riskArParts.push(`تراجع صافي الربح منذ ${summary.consecutiveProfitDeclines} فترات متتالية — إشارة مستمرة تدل في الغالب على مشكلة هيكلية (ارتفاع الأعباء أو تآكل الأسعار أو انخفاض الحجم).`);
    analysisLines.push({ icon: "🚨", color: "bg-red-50 border-red-300",
      text: t(riskFrParts[riskFrParts.length - 1], riskArParts[riskArParts.length - 1]) });
  }
  if (summary.costGrowthFasterThanRevenue) {
    riskFrParts.push(`Les charges progressent plus vite que le chiffre d'affaires sur l'ensemble de la période : si cette tendance se maintient, la marge continuera à se comprimer même quand le CA croît.`);
    riskArParts.push(`تتصاعد الأعباء أسرع من رقم الأعمال على مدى كامل الفترة: إذا استمر هذا المسار، سيستمر تضيّق الهامش حتى عند نمو الإيرادات.`);
    analysisLines.push({ icon: "📉", color: "bg-amber-50 border-amber-300",
      text: t(riskFrParts[riskFrParts.length - 1], riskArParts[riskArParts.length - 1]) });
  }
  if (summary.marginDeclineStreak >= 2) {
    riskFrParts.push(`La marge bénéficiaire s'érode depuis ${summary.marginDeclineStreak} périodes — elle atteint aujourd'hui ${fmtPctAbs(summary.latestMarginPct)}, ce qui signale soit une pression sur les prix de vente, soit une inflation des coûts non encore répercutée.`);
    riskArParts.push(`يتآكل هامش الربح منذ ${summary.marginDeclineStreak} فترات ليبلغ اليوم ${fmtPctAbs(summary.latestMarginPct)}، وهو ما يُشير إلى ضغط على أسعار البيع أو ارتفاع تكاليف لم تُعاد تمريرها بعد.`);
    analysisLines.push({ icon: "📉", color: "bg-amber-50 border-amber-400",
      text: t(riskFrParts[riskFrParts.length - 1], riskArParts[riskArParts.length - 1]) });
  }

  const para3fr = riskFrParts.length > 0
    ? riskFrParts.join(" ")
    : "";
  const para3ar = riskArParts.length > 0
    ? riskArParts.join(" ")
    : "";
  const para3 = riskFrParts.length > 0 ? t(para3fr, para3ar) : "";

  // ── Para 4: target tracking ──────────────────────────────────────────────
  let para4 = "";
  if (summary.hasTargets) {
    const totalWithRevTarget  = periods.filter(p => p.targetRevenue !== undefined).length;
    const totalWithProfTarget = periods.filter(p => p.targetProfit  !== undefined).length;
    const hitRate = summary.periodsAboveRevenueTarget / totalWithRevTarget;
    const hitQual = hitRate >= 0.75
      ? t("dans la grande majorité des cas", "في الغالبية العظمى من الحالات")
      : hitRate >= 0.5
      ? t("dans environ la moitié des cas", "في حوالي نصف الحالات")
      : t("dans moins de la moitié des cas", "في أقل من نصف الحالات");
    para4 = t(
      `Sur les objectifs fixés, le CA atteint ou dépasse la cible ${hitQual} (${summary.periodsAboveRevenueTarget}/${totalWithRevTarget} ${periodLabel}, écart moyen : ${fmtPct(summary.avgRevenueVsTargetPct ?? 0)})${totalWithProfTarget > 0 ? ` ; le bénéfice net dépasse l'objectif dans ${summary.periodsAboveProfitTarget}/${totalWithProfTarget} ${periodLabel} (écart moyen : ${fmtPct(summary.avgProfitVsTargetPct ?? 0)})` : ""}. ${hitRate >= 0.5 ? "L'atteinte des objectifs est globalement satisfaisante." : "L'écart régulier entre résultats et objectifs invite à en réviser la calibration ou l'exécution commerciale."}`,
      `فيما يخص الأهداف المحددة، يُحقق رقم الأعمال مستوى المستهدف أو يتجاوزه ${hitQual} (${summary.periodsAboveRevenueTarget}/${totalWithRevTarget} ${periodLabel}، فارق متوسط: ${fmtPct(summary.avgRevenueVsTargetPct ?? 0)})${totalWithProfTarget > 0 ? `؛ يتخطى صافي الربح هدفه في ${summary.periodsAboveProfitTarget}/${totalWithProfTarget} ${periodLabel} (فارق متوسط: ${fmtPct(summary.avgProfitVsTargetPct ?? 0)})` : ""}. ${hitRate >= 0.5 ? "تحقيق الأهداف مُرضٍ بشكل عام." : "الفارق المنتظم بين النتائج والأهداف يدعو إلى مراجعة معاييرها أو التنفيذ التجاري."}`
    );
    analysisLines.push({ icon: "🎯", color: "bg-blue-50 border-blue-300", text: para4 });
  }

  // ── Para 5: best/worst + learning ───────────────────────────────────────
  const para5 = t(
    `La période la plus performante est "${summary.bestPeriodLabel}" et la moins bonne "${summary.worstPeriodLabel}". Comparer les conditions de ces deux périodes — niveau d'activité, structure des coûts, prix de vente, mix produit — est souvent la façon la plus directe d'identifier les leviers réellement actionnables.`,
    `أفضل فترة أداءً هي "${summary.bestPeriodLabel}" وأضعفها "${summary.worstPeriodLabel}". مقارنة ظروف هاتين الفترتين — مستوى النشاط، هيكل التكاليف، أسعار البيع، تشكيلة المنتجات — هي في الغالب أسرع طريق لتحديد الرافعات الفعلية القابلة للتفعيل.`
  );
  analysisLines.push({ icon: "💡", color: "bg-secondary/10 border-secondary/30", text: para5 });

  // ── Suggestions ────────────────────────────────────────────────────────────
  interface Suggestion { icon: string; title: string; desc: string; color: string; border: string }
  const suggestions: Suggestion[] = [];

  // Cost growth / consecutive declines
  if (summary.costGrowthFasterThanRevenue || summary.consecutiveProfitDeclines >= 2) {
    suggestions.push({
      icon: "🔍",
      color: "bg-red-50", border: "border-l-red-500",
      title: t("Audit de la structure des coûts", "مراجعة هيكل التكاليف"),
      desc: t(
        `Décomposez vos charges en catégories (fixes vs variables, personnel, loyer, matières premières, sous-traitance) et calculez leur ratio par rapport au CA pour chaque période. Identifiez les postes dont la part augmente, et comparez à la moyenne du secteur pour prioriser les actions de rationalisation.`,
        `قسّم أعباءك إلى فئات (ثابتة مقابل متغيرة، عمالة، إيجار، مواد أولية، مناولة) واحسب نسبتها من رقم الأعمال لكل فترة. حدّد البنود التي تتوسع حصتها، وقارنها بمعدلات القطاع لتحديد أولويات الترشيد.`
      ),
    });
  }

  // Margin decline / low margin
  if (summary.marginDeclineStreak >= 2 || summary.latestMarginPct < 10) {
    suggestions.push({
      icon: "💰",
      color: "bg-amber-50", border: "border-l-amber-500",
      title: t("Révision de la politique tarifaire", "مراجعة سياسة التسعير"),
      desc: t(
        `Vérifiez si vos prix de vente couvrent la hausse des charges sur les dernières périodes. Identifiez les produits ou clients à faible sensibilité-prix — une revalorisation ciblée de +3 à 5 % sur ces segments peut restaurer la marge sans affecter les volumes. Testez aussi un recentrage sur les offres à plus forte contribution unitaire.`,
        `تحقق مما إذا كانت أسعار البيع تُغطي ارتفاع الأعباء خلال الفترات الأخيرة. حدّد المنتجات أو العملاء الأقل حساسيةً للسعر — زيادة مُوجَّهة بين 3 و5% في هذه الشرائح يمكنها استعادة الهامش دون التأثير على الحجم. فكّر أيضاً في التركيز على العروض الأعلى مساهمةً وحدوياً.`
      ),
    });
  }

  // Revenue growing faster than profit
  if (summary.avgRevenueGrowthPct > 5 && summary.avgProfitGrowthPct < summary.avgRevenueGrowthPct - 3) {
    suggestions.push({
      icon: "⚖️",
      color: "bg-blue-50", border: "border-l-blue-500",
      title: t("Convertir la croissance du CA en croissance du bénéfice", "تحويل نمو رقم الأعمال إلى نمو في الربح"),
      desc: t(
        `L'écart entre la croissance du CA et celle du bénéfice indique que certains coûts augmentent proportionnellement plus que les revenus. Identifiez les charges dont le ratio CA augmente avec le volume (commissions, logistique, emballage) et vérifiez si les économies d'échelle attendues se concrétisent réellement — sinon, renégociez les contrats fournisseurs ou revoyez les conditions tarifaires.`,
        `الفجوة بين نمو رقم الأعمال ونمو الربح تكشف أن بعض التكاليف ترتفع بنسبة أكبر من الإيرادات. حدّد الأعباء التي تتوسع نسبتها مع الحجم (عمولات، لوجستيك، تغليف) وتحقق مما إذا كانت وفورات الحجم المتوقعة تتحقق فعلاً — وإلا أعد التفاوض على عقود الموردين أو راجع شروط التسعير.`
      ),
    });
  }

  // Targets missed frequently
  if (summary.hasTargets) {
    const revenueTargetCount = periods.filter(p => p.targetRevenue !== undefined).length;
    if (summary.periodsAboveRevenueTarget < revenueTargetCount / 2) {
      suggestions.push({
        icon: "🎯",
        color: "bg-purple-50", border: "border-l-purple-500",
        title: t("Recalibrer les objectifs ou renforcer l'exécution", "إعادة معايرة الأهداف أو تعزيز التنفيذ"),
        desc: t(
          `Analysez les périodes sous-performantes : le manque à gagner vient-il de la demande (saisonnalité, concurrence, pouvoir d'achat) ou de contraintes internes (capacité, stock, force de vente) ? Si la cause est externe, révisez les objectifs à la baisse et intégrez cette saisonnalité dans les prévisions. Si elle est interne, agissez sur l'outil commercial et le plan d'action.`,
          `حلّل الفترات ذات الأداء المنخفض: هل العجز ناجم عن الطلب (موسمية، منافسة، قدرة شرائية) أم عن قيود داخلية (طاقة إنتاجية، مخزون، فريق مبيعات)؟ إن كان السبب خارجياً، اخفض الأهداف وادمج هذه الموسمية في التوقعات. وإن كان داخلياً، تحرّك على الأداة التجارية وخطة العمل.`
        ),
      });
    }
  }

  // Systematic review cadence
  suggestions.push({
    icon: "📅",
    color: "bg-primary/5", border: "border-l-primary",
    title: t("Instaurer un cycle de revue régulier", "إرساء دورة مراجعة منتظمة"),
    desc: t(
      `Programmez une revue de performance systématique à chaque fin de période : comparez résultats aux objectifs, identifiez les deux ou trois écarts prioritaires, et décidez d'une action corrective concrète avant la période suivante. La réactivité précoce coûte bien moins cher qu'une correction après plusieurs trimestres de dérive.`,
      `جدوِّل مراجعة أداء منهجية في نهاية كل فترة: قارن النتائج بالأهداف، حدّد الانحرافين أو الثلاثة ذات الأولوية، وقرّر إجراءً تصحيحياً ملموساً قبل الفترة التالية. الاستجابة المبكرة أقل تكلفةً بكثير من التصحيح بعد أرباع عدة من الانجراف.`
    ),
  });

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setIsSaving(true); setSaveError(null);
    try {
      const body = {
        name: businessName || t("Suivi des KPI", "تتبع مؤشرات الأداء"),
        sector: sector ?? "custom",
        objectiveType: "maximize",
        status: "optimal",
        optimalValue: parseFloat(summary.latestProfit.toFixed(2)),
        problemData: {
          type: "kpi-tracking",
          periodType,
          businessName,
          periods: periods.map(p => ({
            label: p.label, revenue: p.revenue, totalCosts: p.totalCosts,
            netProfit: p.netProfit, profitMarginPct: p.profitMarginPct,
            targetRevenue: p.targetRevenue, targetProfit: p.targetProfit,
          })),
        },
        result: {
          latestRevenue:  summary.latestRevenue,
          latestProfit:   summary.latestProfit,
          latestMarginPct: summary.latestMarginPct,
          avgRevenueGrowthPct: summary.avgRevenueGrowthPct,
          avgProfitGrowthPct:  summary.avgProfitGrowthPct,
          overallRevenueTrend: summary.overallRevenueTrend,
          overallProfitTrend:  summary.overallProfitTrend,
          bestPeriodLabel:  summary.bestPeriodLabel,
          worstPeriodLabel: summary.worstPeriodLabel,
        },
      };
      const res = await fetch("/api/problems", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 4000);
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setIsSaving(false);
    }
  }

  // ── PDF ─────────────────────────────────────────────────────────────────────
  async function handlePdfExport() {
    setPdfLoading(true);
    try {
      await generateKpiPDFReport({
        result,
        analysisLines,
        suggestions,
        managerName,
        institutionName,
      });
      setPdfOpen(false);
    } catch (err) {
      console.error("PDF error:", err);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Summary KPI Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: t("Dernier CA", "آخر رقم أعمال"),
            value: fmtDA(summary.latestRevenue),
            sub: t(`Période : ${latest.label}`, `الفترة: ${latest.label}`),
            trend: summary.revenueTrend,
            color: "bg-primary text-primary-foreground",
          },
          {
            label: t("Dernier bénéfice net", "آخر ربح صافٍ"),
            value: fmtDA(summary.latestProfit),
            sub: fmtPctAbs(summary.latestMarginPct) + t(" marge", " هامش"),
            trend: summary.profitTrend,
            color: summary.latestProfit >= 0
              ? "bg-green-600 text-white"
              : "bg-destructive text-destructive-foreground",
          },
          {
            label: t("Marge bénéficiaire", "هامش الربح"),
            value: fmtPctAbs(summary.latestMarginPct),
            sub: summary.marginDeclineStreak >= 2
              ? t(`⚠️ Recul ${summary.marginDeclineStreak} périodes`, `⚠️ تراجع ${summary.marginDeclineStreak} فترات`)
              : t("Dernière période", "الفترة الأخيرة"),
            trend: summary.marginTrend,
            color: summary.latestMarginPct >= 15 ? "bg-green-700 text-white"
                 : summary.latestMarginPct >= 5 ? "bg-amber-600 text-white"
                 : "bg-destructive text-destructive-foreground",
          },
          {
            label: t("Croissance CA moy.", "متوسط نمو CA"),
            value: fmtPct(summary.avgRevenueGrowthPct),
            sub: t(`Sur ${periods.length - 1} interval(s)`, `على ${periods.length - 1} فترة`),
            trend: summary.avgRevenueGrowthPct > 1.5 ? "up" as const
                 : summary.avgRevenueGrowthPct < -1.5 ? "down" as const : "stable" as const,
            color: "bg-secondary text-secondary-foreground",
          },
        ].map(kpi => (
          <div key={kpi.label} className={cn("rounded-xl p-4 space-y-1 relative", kpi.color)}>
            <p className="text-xs opacity-80 leading-tight">{kpi.label}</p>
            <p className="text-lg font-extrabold leading-tight">{kpi.value}</p>
            <p className="text-xs opacity-75 leading-tight">{kpi.sub}</p>
            <div className="absolute top-3 right-3 opacity-60">
              <TrendBadge trend={kpi.trend} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Alerts strip ────────────────────────────────────────────────────── */}
      {(summary.consecutiveProfitDeclines >= 2 || summary.costGrowthFasterThanRevenue) && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-destructive/50 bg-red-50 px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm text-destructive">
              {t("Alertes de performance détectées", "تنبيهات أداء مكتشفة")}
            </p>
            <div className="space-y-0.5 text-sm text-red-800">
              {summary.consecutiveProfitDeclines >= 2 && (
                <p>• {t(
                  `Bénéfice net en baisse depuis ${summary.consecutiveProfitDeclines} périodes consécutives`,
                  `صافي الربح في انخفاض منذ ${summary.consecutiveProfitDeclines} فترات متتالية`
                )}</p>
              )}
              {summary.costGrowthFasterThanRevenue && (
                <p>• {t(
                  "Les charges progressent plus vite que le chiffre d'affaires",
                  "الأعباء تتصاعد أسرع من رقم الأعمال"
                )}</p>
              )}
              {summary.marginDeclineStreak >= 3 && (
                <p>• {t(
                  `Marge bénéficiaire en déclin depuis ${summary.marginDeclineStreak} périodes`,
                  `هامش الربح في تراجع منذ ${summary.marginDeclineStreak} فترات`
                )}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Situational Analysis ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          {t("Analyse de la Situation", "تحليل الوضع")}
        </h2>
        <div className={cn(
          "rounded-lg border border-primary/20 bg-primary/5 px-5 py-4 space-y-3 text-sm leading-relaxed text-foreground",
          isAr && "text-right"
        )}>
          <p>{para1}</p>
          {para2 && <p className="text-muted-foreground">{para2}</p>}
          {para3 && (
            <p className={cn(
              "font-medium",
              summary.consecutiveProfitDeclines >= 3 || (summary.costGrowthFasterThanRevenue && summary.marginDeclineStreak >= 2)
                ? "text-destructive/90"
                : "text-amber-700"
            )}>{para3}</p>
          )}
          {para4 && <p>{para4}</p>}
          <p className="text-muted-foreground">{para5}</p>
        </div>
      </div>

      {/* ── Suggestions ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          {t("Recommandations", "التوصيات")}
        </h2>
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <div key={i}
              className={cn("flex items-start gap-3 rounded-lg border-l-4 px-4 py-3", s.color, s.border)}>
              <span className="text-lg shrink-0 mt-0.5">{s.icon}</span>
              <div className="space-y-1">
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Managerial Report ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          {t("Rapport de Performance", "تقرير الأداء")}
        </h2>
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg font-bold">
                  {businessName || t("Suivi des KPI", "تتبع مؤشرات الأداء")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t(
                    `${periods.length} ${periodType === "monthly" ? "période(s) mensuelle(s)" : "trimestre(s)"} · ${periods[0].label} → ${latest.label}`,
                    `${periods.length} ${periodType === "monthly" ? "فترة شهرية" : "ربع سنوي"} · ${periods[0].label} → ${latest.label}`
                  )}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge className={cn("font-bold shrink-0",
                  summary.overallProfitTrend === "up" ? "bg-green-100 text-green-800 border-green-300"
                  : summary.overallProfitTrend === "down" ? "bg-red-100 text-red-800 border-red-300"
                  : "bg-secondary text-secondary-foreground"
                )}>
                  {summary.overallProfitTrend === "up" ? "📈" : summary.overallProfitTrend === "down" ? "📉" : "➡️"}
                  {" "}{t(
                    summary.overallProfitTrend === "up" ? "En progression" : summary.overallProfitTrend === "down" ? "En recul" : "Stable",
                    summary.overallProfitTrend === "up" ? "في تحسن" : summary.overallProfitTrend === "down" ? "في تراجع" : "مستقر"
                  )}
                </Badge>
                {summary.hasTargets && (
                  <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-semibold">
                    <Target className="w-3 h-3 me-1" />
                    {t("Objectifs suivis", "الأهداف متابَعة")}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mini metric grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t("Meilleure période", "أفضل فترة"), value: summary.bestPeriodLabel, sub: "🏆", color: "border-amber-200 bg-amber-50" },
                { label: t("Période difficile", "أصعب فترة"), value: summary.worstPeriodLabel, sub: "⚠️", color: "border-border" },
                { label: t("Marge moyenne", "متوسط الهامش"), value: fmtPctAbs(periods.reduce((a,b) => a + b.profitMarginPct, 0) / periods.length), sub: t("sur la période", "على الفترة"), color: "border-border" },
                { label: t("Croiss. bénéfice moy.", "متوسط نمو الربح"), value: fmtPct(summary.avgProfitGrowthPct), sub: t("par période", "لكل فترة"), color: "border-border" },
              ].map(m => (
                <div key={m.label} className={cn("rounded-lg border p-3", m.color)}>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">{m.sub} {m.label}</p>
                  <p className="text-base font-bold mt-0.5 text-foreground">{m.value}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3 flex-wrap pt-1">
              <Button onClick={handleSave} disabled={isSaving || savedOk} variant="outline">
                {isSaving ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t("Sauvegarde…", "جارٍ الحفظ…")}</>
                : savedOk  ? <><CheckCircle2 className="w-4 h-4 me-2 text-green-600" />{t("Sauvegardé !", "تم الحفظ!")}</>
                : <><Save className="w-4 h-4 me-2" />{t("Sauvegarder", "حفظ")}</>}
              </Button>
              <Button onClick={() => setPdfOpen(true)}>
                <FileText className="w-4 h-4 me-2" />
                {t("Exporter rapport PDF", "تصدير تقرير PDF")}
              </Button>
            </div>
            {saveError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />{saveError}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── PDF Dialog ────────────────────────────────────────────────────────── */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t("Exporter le rapport KPI", "تصدير تقرير مؤشرات الأداء")}
            </DialogTitle>
            <DialogDescription>
              {t("Informations optionnelles pour personnaliser le rapport.", "معلومات اختيارية لتخصيص التقرير.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("Nom du responsable (optionnel)", "اسم المسؤول (اختياري)")}</Label>
              <Input placeholder={t("Ex: M. Karim Hadj", "مثال: السيد كريم حاج")}
                value={managerName} onChange={e => setManagerName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Organisation / Entreprise (optionnel)", "المؤسسة / الشركة (اختياري)")}</Label>
              <Input placeholder={t("Ex: SARL Commerce Oran", "مثال: شركة تجارة وهران")}
                value={institutionName} onChange={e => setInstitutionName(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setPdfOpen(false)}>{t("Annuler", "إلغاء")}</Button>
            <Button onClick={handlePdfExport} disabled={pdfLoading}>
              {pdfLoading
                ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t("Génération…", "جارٍ التوليد…")}</>
                : <><FileText className="w-4 h-4 me-2" />{t("Générer PDF", "توليد PDF")}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
