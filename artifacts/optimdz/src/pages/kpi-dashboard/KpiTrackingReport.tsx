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
  interface AnalysisLine { icon: string; text: string; color: string }
  const analysisLines: AnalysisLine[] = [];

  // 1. Overall trend
  const overallTrendText = summary.overallProfitTrend === "up"
    ? t(
        `Sur l'ensemble des ${periods.length} périodes, le bénéfice net de "${businessName}" est en progression globale (+${fmtPct(summary.avgProfitGrowthPct)} en moyenne par période). La dynamique d'ensemble est positive.`,
        `على مدى ${periods.length} فترات، يشهد صافي ربح "${businessName}" تحسناً إجمالياً (${fmtPct(summary.avgProfitGrowthPct)} في المتوسط لكل فترة). الديناميكية الإجمالية إيجابية.`
      )
    : summary.overallProfitTrend === "down"
    ? t(
        `Sur l'ensemble des ${periods.length} périodes, le bénéfice net est en recul global (${fmtPct(summary.avgProfitGrowthPct)} en moyenne par période). Une attention particulière est requise pour inverser la tendance.`,
        `على مدى ${periods.length} فترات، يشهد صافي الربح تراجعاً إجمالياً (${fmtPct(summary.avgProfitGrowthPct)} في المتوسط لكل فترة). يُستوجب اهتمام خاص لعكس الاتجاه.`
      )
    : t(
        `Sur l'ensemble des ${periods.length} périodes, la performance est globalement stable — ni amélioration ni dégradation significative du bénéfice net (${fmtPct(summary.avgProfitGrowthPct)} en moyenne).`,
        `على مدى ${periods.length} فترات، الأداء مستقر في مجمله — لا تحسن ولا تدهور ملحوظ في صافي الربح (${fmtPct(summary.avgProfitGrowthPct)} في المتوسط).`
      );
  analysisLines.push({ icon: "📊", color: "bg-primary/10 border-primary/30", text: overallTrendText });

  // 2. Latest period vs previous
  if (prev) {
    const revDiff = latest.revenue - prev.revenue;
    const profDiff = latest.netProfit - prev.netProfit;
    const latestText = t(
      `Dernière période "${latest.label}" : CA = ${fmtDA(latest.revenue)} (${revDiff >= 0 ? "+" : ""}${fmtDA(revDiff)} vs "${prev.label}"), Bénéfice = ${fmtDA(latest.netProfit)} (${profDiff >= 0 ? "+" : ""}${fmtDA(profDiff)}), Marge = ${fmtPctAbs(latest.profitMarginPct)}.`,
      `آخر فترة "${latest.label}": CA = ${fmtDA(latest.revenue)} (${revDiff >= 0 ? "+" : ""}${fmtDA(revDiff)} مقابل "${prev.label}")، ربح = ${fmtDA(latest.netProfit)} (${profDiff >= 0 ? "+" : ""}${fmtDA(profDiff)})، هامش = ${fmtPctAbs(latest.profitMarginPct)}.`
    );
    analysisLines.push({
      icon: summary.profitTrend === "up" ? "✅" : summary.profitTrend === "down" ? "⚠️" : "➡️",
      color: summary.profitTrend === "up" ? "bg-green-50 border-green-300"
           : summary.profitTrend === "down" ? "bg-amber-50 border-amber-300"
           : "bg-muted/30 border-border",
      text: latestText,
    });
  }

  // 3. Consecutive profit declines
  if (summary.consecutiveProfitDeclines >= 2) {
    analysisLines.push({
      icon: "🚨",
      color: "bg-red-50 border-red-300",
      text: t(
        `⚠️ Alerte : le bénéfice net décline depuis ${summary.consecutiveProfitDeclines} périodes consécutives. Ce signal persistant indique un problème structurel (hausse des charges, érosion des prix, perte de volume). Une action corrective urgente est nécessaire.`,
        `⚠️ تنبيه: يتراجع صافي الربح منذ ${summary.consecutiveProfitDeclines} فترات متتالية. هذه الإشارة المستمرة تدل على مشكلة هيكلية (ارتفاع الأعباء، تآكل الأسعار، انخفاض الحجم). يلزم اتخاذ إجراء تصحيحي عاجل.`
      ),
    });
  }

  // 4. Cost growing faster than revenue
  if (summary.costGrowthFasterThanRevenue) {
    analysisLines.push({
      icon: "📉",
      color: "bg-amber-50 border-amber-300",
      text: t(
        `Les charges croissent plus vite que le chiffre d'affaires sur l'ensemble de la période analysée. Si cette tendance se poursuit, la marge bénéficiaire continuera à se comprimer. Un audit de la structure des coûts s'impose.`,
        `تنمو الأعباء أسرع من رقم الأعمال على مدى الفترة المحللة بأكملها. إذا استمر هذا الاتجاه، سيستمر تضيق هامش الربح. يستوجب الأمر مراجعة هيكل التكاليف.`
      ),
    });
  }

  // 5. Margin decline streak
  if (summary.marginDeclineStreak >= 2) {
    analysisLines.push({
      icon: "📉",
      color: "bg-amber-50 border-amber-400",
      text: t(
        `La marge bénéficiaire est en recul depuis ${summary.marginDeclineStreak} périodes consécutives. Marge actuelle : ${fmtPctAbs(summary.latestMarginPct)}. Une marge qui s'érode progressivement signale soit une pression sur les prix, soit une inflation non répercutée des coûts.`,
        `هامش الربح في تراجع منذ ${summary.marginDeclineStreak} فترات متتالية. الهامش الحالي: ${fmtPctAbs(summary.latestMarginPct)}. تآكل الهامش التدريجي يشير إلى ضغط على الأسعار أو ارتفاع تكاليف لم يُعاد نقله.`
      ),
    });
  }

  // 6. Target performance
  if (summary.hasTargets) {
    const totalWithRevTarget = periods.filter(p => p.targetRevenue !== undefined).length;
    const totalWithProfTarget = periods.filter(p => p.targetProfit !== undefined).length;
    analysisLines.push({
      icon: "🎯",
      color: "bg-blue-50 border-blue-300",
      text: t(
        `Suivi des objectifs : CA atteint ou dépassé dans ${summary.periodsAboveRevenueTarget}/${totalWithRevTarget} période(s)` +
        (totalWithProfTarget > 0 ? `, Bénéfice atteint dans ${summary.periodsAboveProfitTarget}/${totalWithProfTarget} période(s)` : "") +
        `. Écart moyen CA vs objectif : ${fmtPct(summary.avgRevenueVsTargetPct ?? 0)}` +
        (totalWithProfTarget > 0 ? `, Bénéfice : ${fmtPct(summary.avgProfitVsTargetPct ?? 0)}` : "") + ".",
        `متابعة الأهداف: رقم الأعمال مُحقَّق أو متجاوَز في ${summary.periodsAboveRevenueTarget}/${totalWithRevTarget} فترة` +
        (totalWithProfTarget > 0 ? `، الربح مُحقَّق في ${summary.periodsAboveProfitTarget}/${totalWithProfTarget} فترة` : "") +
        `. متوسط الفارق CA/هدف: ${fmtPct(summary.avgRevenueVsTargetPct ?? 0)}` +
        (totalWithProfTarget > 0 ? `، الربح: ${fmtPct(summary.avgProfitVsTargetPct ?? 0)}` : "") + "."
      ),
    });
  }

  // 7. Best/worst periods
  analysisLines.push({
    icon: "💡",
    color: "bg-secondary/10 border-secondary/30",
    text: t(
      `Meilleure période en termes de bénéfice net : "${summary.bestPeriodLabel}". Période la moins performante : "${summary.worstPeriodLabel}". Analysez les facteurs qui différencient ces deux périodes pour identifier des leviers d'action.`,
      `أفضل فترة من حيث صافي الربح: "${summary.bestPeriodLabel}". أضعف فترة أداءً: "${summary.worstPeriodLabel}". حلّل العوامل المميّزة بين الفترتين للكشف عن رافعات العمل.`
    ),
  });

  // ── Suggestions ────────────────────────────────────────────────────────────
  interface Suggestion { icon: string; title: string; desc: string; color: string; border: string }
  const suggestions: Suggestion[] = [];

  // Cost growth
  if (summary.costGrowthFasterThanRevenue || summary.consecutiveProfitDeclines >= 2) {
    suggestions.push({
      icon: "🔍",
      color: "bg-red-50", border: "border-l-red-500",
      title: t("Audit de la structure des coûts", "مراجعة هيكل التكاليف"),
      desc: t(
        `Les charges progressent plus vite que le CA${summary.consecutiveProfitDeclines >= 2 ? ` et le bénéfice recule depuis ${summary.consecutiveProfitDeclines} périodes` : ""}. Décomposez vos charges (fixes vs variables, personnel, loyer, matières premières) et identifiez les postes à rationaliser. Comparez vos ratios au standard du secteur.`,
        `تتصاعد الأعباء أسرع من رقم الأعمال${summary.consecutiveProfitDeclines >= 2 ? ` والربح يتراجع منذ ${summary.consecutiveProfitDeclines} فترات` : ""}. قسّم تكاليفك (ثابتة مقابل متغيرة، عمالة، إيجار، مواد أولية) وحدد البنود التي يمكن ترشيدها. قارن نسبك بمعيار القطاع.`
      ),
    });
  }

  // Margin decline
  if (summary.marginDeclineStreak >= 2 || summary.latestMarginPct < 10) {
    suggestions.push({
      icon: "💰",
      color: "bg-amber-50", border: "border-l-amber-500",
      title: t("Révision de la politique tarifaire", "مراجعة سياسة التسعير"),
      desc: t(
        `La marge bénéficiaire de ${fmtPctAbs(summary.latestMarginPct)} est${summary.marginDeclineStreak >= 2 ? " en déclin depuis plusieurs périodes" : " en dessous des seuils recommandés"}. Examinez si vos prix de vente couvrent suffisamment la hausse des coûts. Une hausse tarifaire même modérée (+3-5%) peut significativement améliorer la marge si la demande est inélastique.`,
        `هامش الربح البالغ ${fmtPctAbs(summary.latestMarginPct)}${summary.marginDeclineStreak >= 2 ? " في تراجع منذ فترات عدة" : " دون العتبات الموصى بها"}. افحص ما إذا كانت أسعار البيع تغطي ارتفاع التكاليف بشكل كافٍ. زيادة طفيفة في الأسعار (+3-5%) يمكن أن تُحسّن الهامش بشكل ملحوظ إذا كان الطلب غير مرن.`
      ),
    });
  }

  // Revenue growth positive reinforcement
  if (summary.avgRevenueGrowthPct > 5 && summary.avgProfitGrowthPct < summary.avgRevenueGrowthPct - 3) {
    suggestions.push({
      icon: "⚖️",
      color: "bg-blue-50", border: "border-l-blue-500",
      title: t("Le CA croît mais le bénéfice suit moins vite", "رقم الأعمال ينمو لكن الربح يتأخر"),
      desc: t(
        `Le chiffre d'affaires progresse en moyenne de ${fmtPct(summary.avgRevenueGrowthPct)} par période, mais le bénéfice de seulement ${fmtPct(summary.avgProfitGrowthPct)}. L'écart indique que la croissance s'accompagne d'une hausse proportionnellement plus forte des charges. Assurez-vous que les économies d'échelle se concrétisent à mesure que le volume augmente.`,
        `يتقدم رقم الأعمال بمعدل ${fmtPct(summary.avgRevenueGrowthPct)} لكل فترة في المتوسط، لكن الربح بـ ${fmtPct(summary.avgProfitGrowthPct)} فقط. الفارق يدل على أن النمو مصحوب بارتفاع أكبر نسبياً في الأعباء. تأكد من أن وفورات الحجم تتحقق مع زيادة الإنتاج.`
      ),
    });
  }

  // Targets
  if (summary.hasTargets) {
    const revenueTargetCount = periods.filter(p => p.targetRevenue !== undefined).length;
    if (summary.periodsAboveRevenueTarget < revenueTargetCount / 2) {
      suggestions.push({
        icon: "🎯",
        color: "bg-purple-50", border: "border-l-purple-500",
        title: t("Réévaluer les objectifs ou le plan commercial", "إعادة تقييم الأهداف أو الخطة التجارية"),
        desc: t(
          `Le CA dépasse les objectifs dans moins de la moitié des périodes. Soit les objectifs sont trop ambitieux, soit l'exécution commerciale manque de rigueur. Analysez les périodes sous-performantes pour comprendre si le problème vient de la demande (saisonnalité, concurrence) ou de l'offre (capacité, stock, équipe).`,
          `رقم الأعمال يتجاوز الأهداف في أقل من نصف الفترات. إما أن الأهداف طموحة جداً، أو أن التنفيذ التجاري يفتقر إلى الصرامة. حلّل الفترات ذات الأداء المنخفض لفهم ما إذا كانت المشكلة في الطلب (موسمية، منافسة) أو العرض (طاقة، مخزون، فريق).`
        ),
      });
    }
  }

  // General improvement recommendation
  suggestions.push({
    icon: "📅",
    color: "bg-primary/5", border: "border-l-primary",
    title: t("Instaurer un cycle de revue mensuel/trimestriel", "إرساء دورة مراجعة شهرية/ربع سنوية"),
    desc: t(
      `La valeur de cet outil est maximisée par une utilisation régulière et systématique. Programmez une revue de performance à chaque fin de période : comparez aux objectifs, analysez les écarts, et ajustez le plan opérationnel en conséquence. La réactivité précoce est bien moins coûteuse qu'une correction tardive.`,
      `قيمة هذه الأداة تتعظّم بالاستخدام المنتظم والمنهجي. جدوِّل مراجعة الأداء في نهاية كل فترة: قارن بالأهداف، حلّل الانحرافات، وعدّل الخطة التشغيلية وفقاً لذلك. الاستجابة المبكرة أقل تكلفة بكثير من التصحيح المتأخر.`
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
        analysisLines: analysisLines.map(l => l.text),
        suggestions: suggestions.map(s => ({ icon: s.icon, title: s.title, desc: s.desc })),
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
        <div className="space-y-2">
          {analysisLines.map((line, i) => (
            <div key={i}
              className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", line.color)}>
              <span className="text-base leading-snug shrink-0">{line.icon}</span>
              <span className="leading-relaxed">{line.text}</span>
            </div>
          ))}
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
