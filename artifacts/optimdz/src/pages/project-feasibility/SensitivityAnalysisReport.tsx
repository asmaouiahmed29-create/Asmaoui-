import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import type { SensitivityAnalysisResult } from "@/lib/sensitivityAnalysisAlgorithm";
import { fmtDA, fmtN, fmtPct, fmtYears, breakEvenRisk } from "@/lib/sensitivityAnalysisAlgorithm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  FileText, Save, CheckCircle2, Loader2, AlertTriangle,
  BarChart2, Lightbulb, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { generateSensitivityAnalysisPDFReport } from "@/lib/generateSensitivityAnalysisPDF";

type SectorKey = "trade" | "industry" | "agriculture" | "services" | "custom";

interface Props {
  result: SensitivityAnalysisResult;
  projectName: string;
  sector: SectorKey | null;
}

export function SensitivityAnalysisReport({ result, projectName, sector }: Props) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const [pdfOpen,         setPdfOpen]         = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [savedOk,         setSavedOk]         = useState(false);
  const [saveError,       setSaveError]       = useState<string | null>(null);
  const [pdfLoading,      setPdfLoading]      = useState(false);
  const [managerName,     setManagerName]     = useState("");
  const [institutionName, setInstitutionName] = useState("");

  const { baseResult, variables, scenarios } = result;
  const { npv, irr, input: inp } = baseResult;
  const r = inp.discountRate;
  const n = inp.duration;

  const mostSensitive  = variables[0];
  const leastSensitive = variables[variables.length - 1];

  // ── Overall risk verdict ──────────────────────────────────────────────────
  const topRisk = breakEvenRisk(mostSensitive?.breakEvenPct ?? null);
  const overallRisk: "low" | "moderate" | "high" =
    topRisk === "low" ? "low" : topRisk === "moderate" ? "moderate" : "high";

  const riskInfo = {
    low: {
      icon: "🛡️",
      color: "bg-green-50 border-green-400",
      badge: "bg-green-100 text-green-800 border-green-300",
      fr: "Risque FAIBLE — Projet robuste",
      ar: "مخاطر منخفضة — المشروع متين",
      descFr: `Les hypothèses clés devraient subir des variations importantes avant de remettre en cause la viabilité du projet. Le paramètre le plus critique (${mostSensitive?.nameFr}) nécessite une variation de ${mostSensitive?.breakEvenPct !== null ? Math.abs(result.variables[0].breakEvenPct!).toFixed(1) + "%" : "hors plage"} pour annuler la VAN.`,
      descAr: `الافتراضات الرئيسية تحتاج إلى تغيرات كبيرة قبل التأثير على جدوى المشروع. المتغير الأكثر حساسية (${mostSensitive?.nameAr}) يحتاج تغيراً بمقدار ${mostSensitive?.breakEvenPct !== null ? Math.abs(result.variables[0].breakEvenPct!).toFixed(1) + "%" : "خارج النطاق"} لإلغاء NPV.`,
    },
    moderate: {
      icon: "⚠️",
      color: "bg-amber-50 border-amber-400",
      badge: "bg-amber-100 text-amber-800 border-amber-300",
      fr: "Risque MODÉRÉ — Surveiller les hypothèses",
      ar: "مخاطر معتدلة — مراقبة الافتراضات",
      descFr: `Certains paramètres critiques sont relativement proches du seuil de rentabilité. Un suivi régulier des écarts entre prévisions et réalisations est recommandé, en particulier pour : ${mostSensitive?.nameFr}.`,
      descAr: `بعض المتغيرات الحرجة قريبة نسبياً من عتبة الربحية. يُنصح بمتابعة دورية للفجوات بين التوقعات والنتائج الفعلية، خاصة لـ: ${mostSensitive?.nameAr}.`,
    },
    high: {
      icon: "🔴",
      color: "bg-red-50 border-red-400",
      badge: "bg-red-100 text-red-800 border-red-300",
      fr: "Risque ÉLEVÉ — Hypothèses fragiles",
      ar: "مخاطر مرتفعة — افتراضات هشة",
      descFr: `La viabilité du projet est très sensible aux hypothèses. Une variation modeste sur ${mostSensitive?.nameFr} suffit à rendre le projet non-rentable. Renforcez les garanties contractuelles et révisez les hypothèses de flux avant de vous engager.`,
      descAr: `جدوى المشروع حساسة جداً للافتراضات. تغير بسيط في ${mostSensitive?.nameAr} كافٍ لجعل المشروع غير مربح. عزز الضمانات التعاقدية وراجع فرضيات التدفقات قبل الالتزام.`,
    },
  }[overallRisk];

  // ── Situational analysis lines ─────────────────────────────────────────────
  const analysisLines: { icon: string; text: string; color: string }[] = [
    {
      icon: "📊",
      color: "bg-primary/10 border-primary/30",
      text: t(
        `La VAN de base est ${fmtDA(npv)} avec un taux d'actualisation de ${fmtPct(r, 1)} sur ${n} ans. ` +
        `L'analyse teste chaque hypothèse clé de ${result.rangeMin}% à +${result.rangeMax}% (pas de ${result.stepSize}%).`,
        `NPV الأساسية ${fmtDA(npv)} بمعدل خصم ${fmtPct(r, 1)} على ${n} سنوات. ` +
        `يختبر التحليل كل افتراض رئيسي من ${result.rangeMin}% إلى +${result.rangeMax}% (بخطوة ${result.stepSize}%).`
      ),
    },
    {
      icon: mostSensitive?.impact! > 0 ? "🎯" : "ℹ️",
      color: topRisk === "high" ? "bg-red-50 border-red-300" : topRisk === "moderate" ? "bg-amber-50 border-amber-300" : "bg-green-50 border-green-300",
      text: t(
        mostSensitive
          ? `Variable la plus sensible : "${mostSensitive.nameFr}" — une variation de ±${result.rangeMax}% fait osciller la VAN entre ${fmtDA(mostSensitive.npvAtMinRange)} et ${fmtDA(mostSensitive.npvAtMaxRange)}, soit un écart de ${fmtDA(mostSensitive.impact)}. ` +
            (mostSensitive.breakEvenPct !== null
              ? `Le seuil critique est à ${fmtN(mostSensitive.breakEvenPct, 1)}% de variation (VAN = 0).`
              : "Aucun seuil NPV=0 dans la plage analysée.")
          : "Aucune variable analysée.",
        mostSensitive
          ? `المتغير الأكثر حساسية: "${mostSensitive.nameAr}" — تغيير ±${result.rangeMax}% يُحرّك NPV بين ${fmtDA(mostSensitive.npvAtMinRange)} و${fmtDA(mostSensitive.npvAtMaxRange)}، فرق يبلغ ${fmtDA(mostSensitive.impact)}. ` +
            (mostSensitive.breakEvenPct !== null
              ? `العتبة الحرجة عند ${fmtN(mostSensitive.breakEvenPct, 1)}% تغيير (NPV = 0).`
              : "لا توجد عتبة NPV=0 في النطاق المُحلَّل.")
          : "لا توجد متغيرات مُحللة."
      ),
    },
    {
      icon: "🛡️",
      color: "bg-secondary/10 border-secondary/30",
      text: t(
        leastSensitive && leastSensitive !== mostSensitive
          ? `Variable la moins sensible : "${leastSensitive.nameFr}" — impact de ${fmtDA(leastSensitive.impact)} sur la plage complète. ` +
            (leastSensitive.breakEvenPct !== null
              ? `Seuil critique lointain : ${fmtN(leastSensitive.breakEvenPct, 1)}% → risque faible sur cette dimension.`
              : "Pas de seuil NPV=0 dans la plage → dimension peu risquée.")
          : "Toutes les variables ont un impact similaire sur la VAN.",
        leastSensitive && leastSensitive !== mostSensitive
          ? `المتغير الأقل حساسية: "${leastSensitive.nameAr}" — تأثير ${fmtDA(leastSensitive.impact)} على النطاق الكامل. ` +
            (leastSensitive.breakEvenPct !== null
              ? `العتبة الحرجة بعيدة: ${fmtN(leastSensitive.breakEvenPct, 1)}% → مخاطر منخفضة على هذا البُعد.`
              : "لا توجد عتبة NPV=0 في النطاق → بُعد منخفض المخاطر.")
          : "جميع المتغيرات لها تأثير مماثل على NPV."
      ),
    },
    {
      icon: scenarios[0].result.npv > 0 ? "✅" : "🔴",
      color: scenarios[0].result.npv > 0 ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300",
      text: t(
        `Scénario pessimiste (−${scenarios[0].adjustmentPct}% flux, +${scenarios[0].adjustmentPct}% coûts & taux) → VAN = ${fmtDA(scenarios[0].result.npv)} ${scenarios[0].result.npv >= 0 ? "(viable même sous pression ✅)" : "(projet non-rentable sous pression 🔴)"}. ` +
        `Scénario optimiste (+${scenarios[2].adjustmentPct}%) → VAN = ${fmtDA(scenarios[2].result.npv)}.`,
        `السيناريو المتشائم (−${scenarios[0].adjustmentPct}% تدفقات، +${scenarios[0].adjustmentPct}% تكاليف ومعدل) → NPV = ${fmtDA(scenarios[0].result.npv)} ${scenarios[0].result.npv >= 0 ? "(جدوى قائمة تحت الضغط ✅)" : "(المشروع غير مربح تحت الضغط 🔴)"}. ` +
        `السيناريو المتفائل (+${scenarios[2].adjustmentPct}%) → NPV = ${fmtDA(scenarios[2].result.npv)}.`
      ),
    },
  ];

  // ── Suggestions ────────────────────────────────────────────────────────────
  interface Suggestion { icon: string; title: string; desc: string; color: string; borderColor: string; }
  const suggestions: Suggestion[] = [];

  // Most sensitive variable advice
  if (mostSensitive) {
    if (mostSensitive.variable === "cashFlows") {
      suggestions.push({
        icon: "📋",
        color: "bg-primary/5", borderColor: "border-l-primary",
        title: t(
          `Sécuriser les flux — paramètre critique : ${mostSensitive.nameFr}`,
          `تأمين التدفقات — المتغير الحرج: ${mostSensitive.nameAr}`
        ),
        desc: t(
          `La VAN est très sensible aux flux de trésorerie annuels (impact ${fmtDA(mostSensitive.impact)} sur ±${result.rangeMax}%). Priorisez la signature de contrats ou lettres d'intention avec les clients avant de mobiliser le capital. ` +
          (mostSensitive.breakEvenPct !== null
            ? `Une baisse de ${fmtN(Math.abs(mostSensitive.breakEvenPct), 1)}% des flux suffit à rendre le projet non-rentable.`
            : ""),
          `NPV حساسة جداً للتدفقات السنوية (تأثير ${fmtDA(mostSensitive.impact)} عند ±${result.rangeMax}%). أولوية توقيع العقود أو خطابات النية مع العملاء قبل تعبئة رأس المال. ` +
          (mostSensitive.breakEvenPct !== null
            ? `انخفاض ${fmtN(Math.abs(mostSensitive.breakEvenPct), 1)}% في التدفقات يكفي لجعل المشروع غير مربح.`
            : "")
        ),
      });
    } else if (mostSensitive.variable === "initialInvestment") {
      suggestions.push({
        icon: "💰",
        color: "bg-amber-50", borderColor: "border-l-amber-500",
        title: t(
          `Maîtriser le coût d'investissement — paramètre critique : ${mostSensitive.nameFr}`,
          `ضبط تكلفة الاستثمار — المتغير الحرج: ${mostSensitive.nameAr}`
        ),
        desc: t(
          `L'investissement initial est le levier le plus influent. Obtenez des devis fermes et un calendrier précis des dépenses avant de valider le projet. ` +
          (mostSensitive.breakEvenPct !== null
            ? `Une augmentation de ${fmtN(Math.abs(mostSensitive.breakEvenPct), 1)}% du coût initial annule la VAN.`
            : ""),
          `الاستثمار الأولي هو أكثر المتغيرات تأثيراً. احصل على عروض أسعار نهائية وجدول زمني دقيق للإنفاق قبل المصادقة على المشروع. ` +
          (mostSensitive.breakEvenPct !== null
            ? `زيادة ${fmtN(Math.abs(mostSensitive.breakEvenPct), 1)}% في التكلفة الأولية تُلغي NPV.`
            : "")
        ),
      });
    } else if (mostSensitive.variable === "discountRate") {
      suggestions.push({
        icon: "📊",
        color: "bg-primary/5", borderColor: "border-l-primary",
        title: t(
          `Risque de taux — paramètre critique : ${mostSensitive.nameFr}`,
          `مخاطر معدل الخصم — المتغير الحرج: ${mostSensitive.nameAr}`
        ),
        desc: t(
          `La VAN est très sensible au taux d'actualisation. Vérifiez si le taux de ${fmtPct(r, 1)} est cohérent avec le risque réel du projet. ` +
          (mostSensitive.breakEvenPct !== null
            ? `Le taux pourrait monter jusqu'à ${fmtN(r * (1 + mostSensitive.breakEvenPct / 100), 2)}% (variation de +${fmtN(mostSensitive.breakEvenPct, 1)}%) avant que la VAN s'annule.`
            : ""),
          `NPV حساسة جداً لمعدل الخصم. تحقق من أن معدل ${fmtPct(r, 1)} متوافق مع المخاطر الفعلية للمشروع. ` +
          (mostSensitive.breakEvenPct !== null
            ? `يمكن أن يرتفع المعدل إلى ${fmtN(r * (1 + mostSensitive.breakEvenPct / 100), 2)}% (زيادة +${fmtN(mostSensitive.breakEvenPct, 1)}%) قبل أن تتحول NPV إلى الصفر.`
            : "")
        ),
      });
    }
  }

  // Pessimistic scenario signal
  if (scenarios[0].result.npv < 0) {
    suggestions.push({
      icon: "🔴",
      color: "bg-red-50", borderColor: "border-l-red-500",
      title: t("Scénario pessimiste non-viable — plan de mitigation requis", "السيناريو المتشائم غير جدوى — يُستوجب خطة تخفيف"),
      desc: t(
        `Dans le scénario pessimiste, la VAN devient ${fmtDA(scenarios[0].result.npv)}. Identifiez des leviers concrets pour réduire les coûts ou garantir les revenus dans ce cas adverse : contrats à long terme, couvertures de prix, plans de réduction des coûts fixes.`,
        `في السيناريو المتشائم، تصبح NPV ${fmtDA(scenarios[0].result.npv)}. حدد رافعات ملموسة لخفض التكاليف أو ضمان الإيرادات في هذه الحالة: عقود طويلة الأجل، تحوطات أسعار، خطط لتخفيض التكاليف الثابتة.`
      ),
    });
  } else {
    suggestions.push({
      icon: "✅",
      color: "bg-green-50", borderColor: "border-l-green-600",
      title: t("Résilience confirmée au scénario pessimiste", "مرونة مؤكدة في السيناريو المتشائم"),
      desc: t(
        `Même sous des conditions défavorables (−${scenarios[0].adjustmentPct}% flux, +${scenarios[0].adjustmentPct}% coûts), le projet reste viable avec une VAN de ${fmtDA(scenarios[0].result.npv)}. Cela renforce la confiance dans la décision d'investir.`,
        `حتى في ظروف معاكسة (−${scenarios[0].adjustmentPct}% تدفقات، +${scenarios[0].adjustmentPct}% تكاليف)، يبقى المشروع جدوى بـ NPV ${fmtDA(scenarios[0].result.npv)}. هذا يعزز الثقة في قرار الاستثمار.`
      ),
    });
  }

  // IRR cushion advice
  if (irr !== null) {
    const irrCushion = irr - r;
    suggestions.push({
      icon: irrCushion > 5 ? "📈" : irrCushion > 0 ? "⚠️" : "🔴",
      color: irrCushion > 5 ? "bg-primary/5" : "bg-amber-50",
      borderColor: irrCushion > 5 ? "border-l-primary" : "border-l-amber-500",
      title: t(
        `Marge TRI : ${fmtN(irrCushion, 2)} points au-dessus du taux requis`,
        `هامش IRR: ${fmtN(irrCushion, 2)} نقطة فوق المعدل المطلوب`
      ),
      desc: t(
        irrCushion > 5
          ? `Le TRI (${fmtPct(irr, 2)}) dépasse largement le taux requis (${fmtPct(r, 1)}). Le coût du capital pourrait augmenter de ${fmtN(irrCushion, 2)} points avant de remettre en cause la rentabilité — signal positif pour les prêteurs et investisseurs.`
          : irrCushion > 0
          ? `Le TRI (${fmtPct(irr, 2)}) est légèrement supérieur au taux requis (${fmtPct(r, 1)}). La marge de ${fmtN(irrCushion, 2)} points est étroite — surveillez de près les conditions de financement et l'évolution des taux.`
          : `Le TRI (${fmtPct(irr, 2)}) est en dessous du taux requis (${fmtPct(r, 1)}). Le projet ne génère pas le rendement minimum attendu — révisez les paramètres ou le taux requis.`,
        irrCushion > 5
          ? `IRR (${fmtPct(irr, 2)}) يتجاوز المعدل المطلوب (${fmtPct(r, 1)}) بفارق كبير. يمكن للتمويل أن يرتفع ${fmtN(irrCushion, 2)} نقطة قبل التأثير على الربحية — إشارة إيجابية للمقرضين والمستثمرين.`
          : irrCushion > 0
          ? `IRR (${fmtPct(irr, 2)}) أعلى قليلاً من المعدل المطلوب (${fmtPct(r, 1)}). الهامش ${fmtN(irrCushion, 2)} نقطة ضيق — راقب ظروف التمويل وتطور المعدلات عن كثب.`
          : `IRR (${fmtPct(irr, 2)}) دون المعدل المطلوب (${fmtPct(r, 1)}). المشروع لا يُحقق الحد الأدنى للعائد — راجع المتغيرات أو المعدل المطلوب.`
      ),
    });
  }

  suggestions.push({
    icon: "🔄",
    color: "bg-secondary/5", borderColor: "border-l-secondary",
    title: t("Réévaluer les hypothèses lors des jalons clés", "إعادة تقييم الافتراضات عند المراحل الرئيسية"),
    desc: t(
      `L'analyse de sensibilité est un outil dynamique. Revisitez ces calculs à chaque jalon important (fin de construction, première année d'exploitation, révision du plan de financement) pour ajuster les décisions en temps réel.`,
      `تحليل الحساسية أداة ديناميكية. أعد هذه الحسابات عند كل مرحلة رئيسية (نهاية الإنشاء، السنة الأولى للتشغيل، مراجعة خطة التمويل) لتعديل القرارات في الوقت الحقيقي.`
    ),
  });

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setIsSaving(true); setSaveError(null);
    try {
      const body = {
        name: projectName || t("Analyse de Sensibilité", "تحليل الحساسية"),
        sector: sector ?? "custom",
        objectiveType: "maximize",
        status: "optimal",
        optimalValue: parseFloat(npv.toFixed(2)),
        problemData: {
          type: "sensitivity-analysis",
          input: {
            projectName:       inp.projectName,
            initialInvestment: inp.initialInvestment,
            discountRate:      inp.discountRate,
            duration:          inp.duration,
            cashFlows:         inp.cashFlows,
            salvageValue:      inp.salvageValue,
            rangeMin:          result.rangeMin,
            rangeMax:          result.rangeMax,
            stepSize:          result.stepSize,
          },
        },
        result: {
          npv:                baseResult.npv,
          irr:                baseResult.irr,
          profitabilityIndex: baseResult.profitabilityIndex,
          simplePayback:      baseResult.simplePayback,
          discountedPayback:  baseResult.discountedPayback,
          mostSensitiveVar:   mostSensitive?.variable ?? null,
          breakEvenPcts:      variables.reduce<Record<string, number | null>>((acc, v) => {
            acc[v.variable] = v.breakEvenPct;
            return acc;
          }, {}),
        },
      };
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      await generateSensitivityAnalysisPDFReport({
        result, projectName, sector: sector ?? undefined, managerName, institutionName,
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

      {/* ── Risk verdict banner ──────────────────────────────────────────────── */}
      <div className={cn("rounded-xl border-2 p-5 flex items-start gap-4", riskInfo.color)}>
        <span className="text-3xl shrink-0">{riskInfo.icon}</span>
        <div className="space-y-1">
          <p className="font-bold text-base">
            {isAr ? riskInfo.ar : riskInfo.fr}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isAr ? riskInfo.descAr : riskInfo.descFr}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {variables.map(v => {
              const risk = breakEvenRisk(v.breakEvenPct);
              return (
                <Badge key={v.variable}
                  className={cn("text-xs font-semibold",
                    risk === "low"      ? "bg-green-100 text-green-800 border-green-300"
                    : risk === "moderate" ? "bg-amber-100 text-amber-800 border-amber-300"
                    : risk === "high"    ? "bg-red-100 text-red-800 border-red-300"
                    : "bg-muted text-muted-foreground"
                  )}>
                  {risk === "low" ? "🟢" : risk === "moderate" ? "🟡" : risk === "high" ? "🔴" : "—"}{" "}
                  {isAr ? v.nameAr : v.nameFr}
                </Badge>
              );
            })}
          </div>
        </div>
      </div>

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
          {t("Recommandations Stratégiques", "التوصيات الاستراتيجية")}
        </h2>
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <div key={i}
              className={cn("flex items-start gap-3 rounded-lg border-l-4 px-4 py-3", s.color, s.borderColor)}>
              <span className="text-lg shrink-0 mt-0.5">{s.icon}</span>
              <div className="space-y-1">
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Managerial Report Card ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          {t("Rapport de Sensibilité", "تقرير الحساسية")}
        </h2>
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg font-bold">
                  {projectName || t("Analyse de Sensibilité", "تحليل الحساسية")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t(
                    `Plage : ${result.rangeMin}% à +${result.rangeMax}% · Pas : ${result.stepSize}% · ${variables.length} variables`,
                    `النطاق: ${result.rangeMin}% إلى +${result.rangeMax}% · الخطوة: ${result.stepSize}% · ${variables.length} متغيرات`
                  )}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge className={cn("font-semibold", riskInfo.badge)}>
                  {riskInfo.icon} {isAr ? riskInfo.ar.split("—")[0].trim() : riskInfo.fr.split("—")[0].trim()}
                </Badge>
                {irr !== null && (
                  <Badge className={cn("font-semibold",
                    irr >= r ? "bg-green-100 text-green-800 border-green-300"
                             : "bg-amber-100 text-amber-800 border-amber-300"
                  )}>
                    IRR {fmtPct(irr, 1)}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* KPI + break-even grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: t("VAN de base",            "NPV الأساسية"),         value: fmtDA(npv) },
                { label: t("TRI de base",             "IRR الأساسي"),          value: irr !== null ? fmtPct(irr, 2) : "—" },
                { label: t("Taux d'actualisation",    "معدل الخصم"),           value: fmtPct(r, 1) },
                ...variables.map(v => ({
                  label: t(`Seuil — ${v.nameFr}`, `عتبة — ${v.nameAr}`),
                  value: v.breakEvenPct !== null ? `${v.breakEvenPct >= 0 ? "+" : ""}${fmtN(v.breakEvenPct, 1)} %` : "—",
                })),
                { label: t("Scénario pessimiste VAN", "NPV السيناريو المتشائم"), value: fmtDA(scenarios[0].result.npv) },
                { label: t("Scénario optimiste VAN",  "NPV السيناريو المتفائل"), value: fmtDA(scenarios[2].result.npv) },
                { label: t("Investissement initial",  "الاستثمار الأولي"),     value: fmtDA(inp.initialInvestment) },
                { label: t("Durée du projet",         "مدة المشروع"),          value: `${n} ${n > 1 ? t("ans","سنوات") : t("an","سنة")}` },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-base font-bold mt-0.5">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap pt-1">
              <Button onClick={handleSave} disabled={isSaving || savedOk} variant="outline">
                {isSaving ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t("Sauvegarde…","جارٍ الحفظ…")}</>
                : savedOk  ? <><CheckCircle2 className="w-4 h-4 me-2 text-green-600" />{t("Sauvegardé !","تم الحفظ!")}</>
                : <><Save className="w-4 h-4 me-2" />{t("Sauvegarder","حفظ")}</>}
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
              {t("Exporter le rapport de sensibilité", "تصدير تقرير الحساسية")}
            </DialogTitle>
            <DialogDescription>
              {t("Ajoutez des informations optionnelles avant la génération.", "أضف معلومات اختيارية قبل توليد التقرير.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("Nom du responsable (optionnel)", "اسم المسؤول (اختياري)")}</Label>
              <Input placeholder={t("Ex: M. Yacine Belkadi", "مثال: السيد ياسين بلقادي")}
                value={managerName} onChange={(e) => setManagerName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Organisation / Promoteur (optionnel)", "المؤسسة / صاحب المشروع (اختياري)")}</Label>
              <Input placeholder={t("Ex: SARL TechBat Batna", "مثال: ش.ذ.م.م تيك باتنة")}
                value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setPdfOpen(false)}>{t("Annuler","إلغاء")}</Button>
            <Button onClick={handlePdfExport} disabled={pdfLoading}>
              {pdfLoading
                ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t("Génération…","جارٍ التوليد…")}</>
                : <><FileText className="w-4 h-4 me-2" />{t("Générer PDF","توليد PDF")}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
