import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import type { InvestmentAppraisalResult } from "@/lib/investmentAppraisalAlgorithm";
import { fmtDA, fmtN, fmtPct, fmtYears } from "@/lib/investmentAppraisalAlgorithm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  FileText, Save, CheckCircle2, Loader2, AlertTriangle,
  BarChart2, Lightbulb, ClipboardList, Download,
  TrendingUp, TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { generateInvestmentAppraisalPDFReport } from "@/lib/generateInvestmentAppraisalPDFReport";

type SectorKey = "trade" | "industry" | "agriculture" | "services" | "custom";

interface Props {
  result: InvestmentAppraisalResult;
  projectName: string;
  sector: SectorKey | null;
}

export function InvestmentAppraisalReport({ result, projectName, sector }: Props) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const [pdfOpen,         setPdfOpen]         = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [savedOk,         setSavedOk]         = useState(false);
  const [saveError,       setSaveError]       = useState<string | null>(null);
  const [pdfLoading,      setPdfLoading]      = useState(false);
  const [managerName,     setManagerName]     = useState("");
  const [institutionName, setInstitutionName] = useState("");

  const { npv, irr, simplePayback, discountedPayback, profitabilityIndex,
          input: inp, yearRows } = result;
  const r = inp.discountRate;
  const n = inp.duration;
  const dFr = isAr ? "ar" : "fr";

  // ── Decision verdict ──────────────────────────────────────────────────────
  const goCount = [
    npv > 0,
    irr !== null && irr >= r,
    profitabilityIndex >= 1,
    discountedPayback !== null && discountedPayback < n,
  ].filter(Boolean).length;

  const verdict: "go" | "conditional" | "nogo" =
    goCount >= 3 ? "go" : goCount >= 2 ? "conditional" : "nogo";

  const verdictInfo = {
    go: {
      color: "bg-green-50 border-green-400",
      badge: "bg-green-100 text-green-800 border-green-300",
      icon: "✅",
      fr: "GO — Investissement recommandé",
      ar: "GO — الاستثمار موصى به",
      descFr: "Les indicateurs financiers clés sont favorables. L'investissement crée de la valeur et le capital est récupéré dans la durée du projet.",
      descAr: "المؤشرات المالية الرئيسية إيجابية. الاستثمار يُنشئ قيمة مضافة ويُسترَد رأس المال ضمن مدة المشروع.",
    },
    conditional: {
      color: "bg-amber-50 border-amber-400",
      badge: "bg-amber-100 text-amber-800 border-amber-300",
      icon: "⚠️",
      fr: "CONDITIONNEL — Approfondir l'analyse",
      ar: "مشروط — استكمال التحليل",
      descFr: "Certains indicateurs sont favorables mais d'autres méritent attention. Vérifiez les hypothèses de flux et la sensibilité aux variations du taux.",
      descAr: "بعض المؤشرات إيجابية وأخرى تستوجب انتباهاً. راجع فرضيات التدفقات وحساسية النتائج لتغير معدل الخصم.",
    },
    nogo: {
      color: "bg-red-50 border-red-400",
      badge: "bg-red-100 text-red-800 border-red-300",
      icon: "🔴",
      fr: "NO-GO — Investissement à revoir",
      ar: "NO-GO — مراجعة الاستثمار",
      descFr: "La majorité des indicateurs sont défavorables. L'investissement détruit de la valeur aux conditions actuelles. Revoir le montant investi, les flux attendus ou le taux de rendement requis.",
      descAr: "غالبية المؤشرات سلبية. الاستثمار يُدمّر قيمة في الظروف الحالية. راجع المبلغ المستثمر أو التدفقات المتوقعة أو معدل العائد المطلوب.",
    },
  }[verdict];

  // ── Situational analysis lines ─────────────────────────────────────────────
  const pv = result.totalPV;
  const analysisLines: { icon: string; text: string; color: string }[] = [
    {
      icon: "💰",
      color: "bg-primary/10 border-primary/30",
      text: t(
        `L'investissement initial de ${fmtDA(inp.initialInvestment)} sur ${n} an${n > 1 ? "s" : ""} génère une valeur actuelle nette (VAN) de ${fmtDA(npv)} avec un taux d'actualisation de ${fmtPct(r, 1)}. ` +
        `La somme des flux actualisés est ${fmtDA(pv)}, soit ${fmtN((pv / inp.initialInvestment - 1) * 100, 1)} % de l'investissement initial.`,
        `الاستثمار الأولي ${fmtDA(inp.initialInvestment)} على مدى ${n} ${n === 1 ? "سنة" : "سنوات"} يُولّد صافي قيمة حالية (NPV) بقيمة ${fmtDA(npv)} بمعدل خصم ${fmtPct(r, 1)}. ` +
        `مجموع التدفقات المخصومة ${fmtDA(pv)}، أي ${fmtN((pv / inp.initialInvestment - 1) * 100, 1)}% من الاستثمار الأولي.`
      ),
    },
    {
      icon: npv >= 0 ? "✅" : "🔴",
      color: npv >= 0 ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300",
      text: t(
        npv >= 0
          ? `VAN positive (${fmtDA(npv)}) — l'investissement crée de la valeur au-delà du coût du capital (${fmtPct(r, 1)}). Chaque dinar investi génère ${fmtN(profitabilityIndex, 3)} DA de valeur actualisée (IP > 1 ✅).`
          : `VAN négative (${fmtDA(npv)}) — l'investissement détruit de la valeur au taux de ${fmtPct(r, 1)}. La somme actualisée des flux ne couvre pas l'investissement initial (IP = ${fmtN(profitabilityIndex, 3)} < 1).`,
        npv >= 0
          ? `NPV موجبة (${fmtDA(npv)}) — الاستثمار يُنشئ قيمة تفوق تكلفة رأس المال (${fmtPct(r, 1)}). كل دينار مستثمر يُولّد ${fmtN(profitabilityIndex, 3)} دينار من القيمة الحالية (PI > 1 ✅).`
          : `NPV سالبة (${fmtDA(npv)}) — الاستثمار يُدمّر قيمة بمعدل ${fmtPct(r, 1)}. مجموع التدفقات المخصومة لا يُغطي الاستثمار الأولي (PI = ${fmtN(profitabilityIndex, 3)} < 1).`
      ),
    },
    {
      icon: irr !== null ? (irr >= r ? "📊" : "⚠️") : "❓",
      color: irr !== null ? (irr >= r ? "bg-secondary/10 border-secondary/30" : "bg-amber-50 border-amber-300") : "bg-muted border-border",
      text: t(
        irr !== null
          ? `TRI = ${fmtPct(irr, 2)} — taux de rendement propre de l'investissement. ` +
            (irr >= r
              ? `Supérieur au taux requis (${fmtPct(r, 1)}) → l'investissement dépasse le seuil de rentabilité minimal. Rentabilité supplémentaire : ${fmtN(irr - r, 2)} points de pourcentage.`
              : `Inférieur au taux requis (${fmtPct(r, 1)}) → l'investissement ne satisfait pas le rendement minimum. Écart : −${fmtN(r - irr, 2)} points de pourcentage.`)
          : "Le TRI n'a pas pu être calculé dans la plage [−99 %, 500 %]. Cela peut indiquer des flux de trésorerie atypiques (multiples changements de signe).",
        irr !== null
          ? `IRR = ${fmtPct(irr, 2)} — معدل العائد الذاتي للاستثمار. ` +
            (irr >= r
              ? `أعلى من المعدل المطلوب (${fmtPct(r, 1)}) → الاستثمار يتجاوز الحد الأدنى للمردودية. الفارق الإيجابي: ${fmtN(irr - r, 2)} نقطة مئوية.`
              : `أدنى من المعدل المطلوب (${fmtPct(r, 1)}) → الاستثمار لا يُحقق المردودية الدنيا المطلوبة. العجز: ${fmtN(r - irr, 2)} نقطة مئوية.`)
          : "لم يُمكن حساب IRR في النطاق [−99 %، 500 %]. قد يشير إلى تدفقات نقدية غير تقليدية (تغييرات إشارة متعددة)."
      ),
    },
    {
      icon: simplePayback !== null && simplePayback < n ? "⏱️" : "⚠️",
      color: simplePayback !== null && simplePayback < n ? "bg-secondary/10 border-secondary/30" : "bg-amber-50 border-amber-300",
      text: t(
        simplePayback !== null
          ? `Délai de récupération simple : ${fmtYears(simplePayback, "fr")} sur ${n} ans. ` +
            (discountedPayback !== null
              ? `Délai actualisé : ${fmtYears(discountedPayback, "fr")} (intègre la valeur temps de l'argent). `
              : "Récupération actualisée non atteinte dans la durée du projet. ") +
            `La différence entre les deux délais (${discountedPayback !== null ? fmtN(discountedPayback - simplePayback, 2) : "—"} an${(discountedPayback !== null && discountedPayback - simplePayback > 1) ? "s" : ""}) reflète l'impact du coût du capital.`
          : `Le capital investi (${fmtDA(inp.initialInvestment)}) n'est pas récupéré sur la durée du projet (${n} ans). Risque élevé d'immobilisation du capital.`,
        simplePayback !== null
          ? `فترة الاسترداد البسيطة: ${fmtYears(simplePayback, "ar")} من أصل ${n} سنوات. ` +
            (discountedPayback !== null
              ? `فترة الاسترداد المخصومة: ${fmtYears(discountedPayback, "ar")} (تأخذ بعين الاعتبار القيمة الزمنية للنقود). `
              : "لم يُسترَد رأس المال المخصوم ضمن مدة المشروع. ") +
            `الفرق بين الفترتين يعكس تأثير تكلفة رأس المال.`
          : `رأس المال المستثمر (${fmtDA(inp.initialInvestment)}) لن يُسترَد ضمن مدة المشروع (${n} سنوات). خطر مرتفع لتجميد رأس المال.`
      ),
    },
  ];

  // ── Suggestions ────────────────────────────────────────────────────────────
  interface Suggestion { icon: string; title: string; desc: string; color: string; borderColor: string; }
  const suggestions: Suggestion[] = [
    // Always: sensitivity check
    {
      icon: "🔍",
      color: "bg-primary/5", borderColor: "border-l-primary",
      title: t("Tester la sensibilité aux hypothèses", "اختبار الحساسية للفرضيات"),
      desc: t(
        `La VAN de ${fmtDA(npv)} repose entièrement sur les flux prévisionnels. Une variation de 10 % des flux annuels ou du taux d'actualisation peut changer la conclusion. Identifiez les scénarios pessimiste, central et optimiste avant de décider.`,
        `NPV البالغة ${fmtDA(npv)} تعتمد كلياً على التدفقات التقديرية. تغيير 10% في التدفقات السنوية أو معدل الخصم قد يُغيّر التوصية. حدّد سيناريوهات متشائمة ووسطى ومتفائلة قبل اتخاذ القرار.`
      ),
    },
    // NPV-specific
    ...(npv < 0 ? [{
      icon: "🔴",
      color: "bg-red-50", borderColor: "border-l-red-500",
      title: t("VAN négative — reconsidérer les paramètres", "NPV سالبة — مراجعة المتغيرات"),
      desc: t(
        `Avec une VAN de ${fmtDA(npv)}, l'investissement détruit de la valeur au taux de ${fmtPct(r, 1)}. Explorez : (1) réduire l'investissement initial, (2) améliorer les flux (optimiser les coûts d'exploitation), (3) accepter un taux de rendement requis plus bas si le risque le justifie.`,
        `مع NPV سالبة ${fmtDA(npv)}، الاستثمار يُدمّر قيمة بمعدل ${fmtPct(r, 1)}. استكشف: (1) تخفيض الاستثمار الأولي، (2) تحسين التدفقات (تخفيض تكاليف التشغيل)، (3) قبول معدل عائد مطلوب أدنى إذا كان الخطر يُبرر ذلك.`
      ),
    }] as Suggestion[] : []),
    // IRR-specific
    ...(irr !== null && irr < r ? [{
      icon: "📊",
      color: "bg-amber-50", borderColor: "border-l-amber-500",
      title: t(`TRI (${fmtPct(irr, 1)}) inférieur au taux requis (${fmtPct(r, 1)})`,
               `IRR (${fmtPct(irr, 1)}) دون المعدل المطلوب (${fmtPct(r, 1)})`),
      desc: t(
        `L'écart de ${fmtN(r - irr, 2)} points de pourcentage signifie que l'investissement ne génère pas le rendement minimum attendu. Réévaluez si le taux requis est calibré au bon niveau de risque, ou si des synergies non-capturées dans les flux méritent d'être modélisées.`,
        `الفجوة ${fmtN(r - irr, 2)} نقطة مئوية تعني أن الاستثمار لا يُحقق الحد الأدنى للعائد المنتظر. أعد تقييم مستوى معدل العائد المطلوب مع الخطر الفعلي، أو ابحث عن تأثيرات تآزرية غير مُدرَجة في التدفقات.`
      ),
    }] as Suggestion[] : []),
    // Payback risk
    ...(discountedPayback === null || discountedPayback >= n ? [{
      icon: "⏰",
      color: "bg-amber-50", borderColor: "border-l-amber-500",
      title: t("Capital non récupéré dans la durée du projet", "رأس المال غير مُسترَد ضمن مدة المشروع"),
      desc: t(
        `Le délai de récupération actualisé dépasse la durée de l'investissement (${n} ans). Cela accroît l'exposition au risque : une dégradation des flux en fin de projet peut rendre définitive la perte. Évaluez si la valeur résiduelle peut améliorer la situation ou si la durée de vie économique est sous-estimée.`,
        `فترة الاسترداد المخصومة تتجاوز مدة الاستثمار (${n} سنوات). هذا يزيد التعرض للمخاطر: أي تدهور في التدفقات نهاية المشروع قد يجعل الخسارة نهائية. قيّم إذا كانت القيمة المتبقية تُحسّن الوضع أو إذا كان العمر الاقتصادي الفعلي أطول مما افتُرض.`
      ),
    }] as Suggestion[] : []),
    // Always: financing structure
    {
      icon: "🏦",
      color: "bg-green-50", borderColor: "border-l-green-600",
      title: t("Optimiser le plan de financement", "تحسين هيكل التمويل"),
      desc: t(
        `Un financement mixte (fonds propres + crédit bancaire) peut abaisser le coût moyen pondéré du capital (CMPC) et améliorer la VAN. En Algérie, les dispositifs ANSEJ / ANADE / ANGEM ou les crédits d'équipement bancaires peuvent réduire l'effort propre initial.`,
        `التمويل المختلط (رأس مال ذاتي + قرض بنكي) قد يُخفّض متوسط تكلفة رأس المال المرجّح (WACC) ويُحسّن NPV. في الجزائر، أجهزة ANSEJ / ANADE / ANGEM أو القروض البنكية للتجهيز قد تُقلّل من الجهد الذاتي الأولي.`
      ),
    },
    // High-NPV: reinvestment warning
    ...(npv > 0 && profitabilityIndex > 1.2 ? [{
      icon: "📈",
      color: "bg-primary/5", borderColor: "border-l-primary",
      title: t("Vérifier l'hypothèse de réinvestissement des flux", "التحقق من فرضية إعادة استثمار التدفقات"),
      desc: t(
        `Le TRI suppose implicitement que les flux intermédiaires sont réinvestis au même TRI (${irr !== null ? fmtPct(irr, 1) : "—"}). Si ce taux est irréaliste pour les opportunités disponibles, le TRI surévalue la rentabilité réelle. Calculez le TRI modifié (TRIM) avec un taux de réinvestissement réaliste pour une vision plus précise.`,
        `IRR يفترض ضمنياً أن التدفقات المؤقتة تُعاد استثمارها بنفس معدل IRR (${irr !== null ? fmtPct(irr, 1) : "—"}). إذا كان هذا غير واقعي، فإن IRR يُبالغ في تقدير الربحية الفعلية. احسب MIRR بمعدل إعادة استثمار واقعي للحصول على صورة أدق.`
      ),
    }] as Suggestion[] : []),
    // Always: go/no-go summary
    {
      icon: verdictInfo.icon,
      color: verdict === "go" ? "bg-green-50" : verdict === "conditional" ? "bg-amber-50" : "bg-red-50",
      borderColor: verdict === "go" ? "border-l-green-600" : verdict === "conditional" ? "border-l-amber-500" : "border-l-red-500",
      title: isAr ? verdictInfo.ar : verdictInfo.fr,
      desc: isAr ? verdictInfo.descAr : verdictInfo.descFr,
    },
  ];

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setIsSaving(true); setSaveError(null);
    try {
      const body = {
        name: projectName || t("Investissement — VAN/TRI", "استثمار — NPV/IRR"),
        sector: sector ?? "custom",
        objectiveType: "maximize",
        status: "optimal",
        optimalValue: parseFloat(result.npv.toFixed(2)),
        problemData: {
          type: "investment-appraisal",
          input: {
            projectName:       inp.projectName,
            initialInvestment: inp.initialInvestment,
            discountRate:      inp.discountRate,
            duration:          inp.duration,
            cashFlows:         inp.cashFlows,
            salvageValue:      inp.salvageValue,
          },
        },
        result: {
          npv:                 result.npv,
          irr:                 result.irr,
          simplePayback:       result.simplePayback,
          discountedPayback:   result.discountedPayback,
          profitabilityIndex:  result.profitabilityIndex,
          totalCashFlow:       result.totalCashFlow,
          totalPV:             result.totalPV,
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
      await generateInvestmentAppraisalPDFReport({ result, projectName, sector: sector ?? undefined, managerName, institutionName });
      setPdfOpen(false);
    } catch (err) {
      console.error("PDF error:", err);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Go/No-Go verdict banner ─────────────────────────────────────────── */}
      <div className={cn("rounded-xl border-2 p-5 flex items-start gap-4", verdictInfo.color)}>
        <span className="text-3xl shrink-0">{verdictInfo.icon}</span>
        <div className="space-y-1">
          <p className="font-bold text-base">
            {isAr ? verdictInfo.ar : verdictInfo.fr}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isAr ? verdictInfo.descAr : verdictInfo.descFr}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {[
              { ok: npv > 0,                                  fr: "VAN > 0",         ar: "NPV موجبة" },
              { ok: irr !== null && irr >= r,                 fr: `TRI ≥ ${fmtN(r,1)} %`, ar: `IRR ≥ ${fmtN(r,1)} %` },
              { ok: profitabilityIndex >= 1,                  fr: "IP ≥ 1",          ar: "PI ≥ 1" },
              { ok: discountedPayback !== null && discountedPayback < n,
                                                              fr: "Récup. act. OK",  ar: "الاسترداد المخصوم ✓" },
            ].map((c) => (
              <Badge key={c.fr}
                className={cn(
                  "text-xs font-semibold",
                  c.ok ? "bg-green-100 text-green-800 border-green-300"
                       : "bg-red-100 text-red-800 border-red-300"
                )}>
                {c.ok ? "✅" : "❌"} {isAr ? c.ar : c.fr}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* ── Situational Analysis ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          {t("Analyse de Viabilité", "تحليل الجدوى")}
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

      {/* ── Suggestions ────────────────────────────────────────────────────── */}
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

      {/* ── Managerial Report Card ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          {t("Rapport d'Évaluation", "تقرير التقييم")}
        </h2>
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg font-bold">
                  {projectName || t("Évaluation d'Investissement", "تقييم الاستثمار")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t("VAN / TRI / Délai de Récupération / IP", "NPV / IRR / فترة الاسترداد / PI")}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge className={cn("font-semibold", verdictInfo.badge)}>
                  {verdictInfo.icon} {isAr ? verdictInfo.ar.split("—")[0].trim() : verdictInfo.fr.split("—")[0].trim()}
                </Badge>
                <Badge variant="outline">IP {fmtN(profitabilityIndex, 3)}</Badge>
                {irr !== null && (
                  <Badge className={cn("font-semibold",
                    irr >= r ? "bg-green-100 text-green-800 border-green-300" : "bg-amber-100 text-amber-800 border-amber-300"
                  )}>
                    IRR {fmtPct(irr, 1)}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: t("Investissement initial",         "الاستثمار الأولي"),       value: fmtDA(inp.initialInvestment) },
                { label: t("Durée du projet",                "مدة المشروع"),            value: `${n} ${n > 1 ? t("ans","سنوات") : t("an","سنة")}` },
                { label: t("Taux d'actualisation",           "معدل الخصم"),             value: fmtPct(r, 1) },
                { label: t("VAN (Valeur Actuelle Nette)",    "صافي القيمة الحالية"),    value: fmtDA(npv) },
                { label: t("TRI (Taux de Rendement Interne)","معدل العائد الداخلي"),    value: irr !== null ? fmtPct(irr, 2) : "—" },
                { label: t("Indice de Rentabilité (IP)",     "مؤشر الربحية (PI)"),     value: fmtN(profitabilityIndex, 3) },
                { label: t("Délai récupération simple",      "فترة الاسترداد البسيطة"), value: simplePayback !== null ? fmtYears(simplePayback, dFr) : "—" },
                { label: t("Délai récupération actualisé",   "فترة الاسترداد المخصومة"), value: discountedPayback !== null ? fmtYears(discountedPayback, dFr) : "—" },
                { label: t("Total flux non actualisés",      "مجموع التدفقات غير مخصومة"), value: fmtDA(result.totalCashFlow) },
                { label: t("Total valeurs actuelles",        "مجموع القيم الحالية"),    value: fmtDA(result.totalPV) },
                ...(inp.salvageValue ? [{ label: t("Valeur résiduelle","القيمة المتبقية"), value: fmtDA(inp.salvageValue) }] : []),
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-base font-bold mt-0.5">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Formula reminder */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("Formules appliquées", "الصيغ المُطبَّقة")}
              </p>
              <div className="font-mono text-xs text-foreground leading-relaxed space-y-0.5">
                <div>VAN = −I₀ + Σ [CFₜ / (1+r)ᵗ]   (t=1..{n}){inp.salvageValue ? ` + VR/(1+r)^${n}` : ""}</div>
                <div>IP = VP des flux / I₀ = {fmtDA(result.totalPV)} / {fmtDA(inp.initialInvestment)} = {fmtN(profitabilityIndex, 3)}</div>
                <div>TRI : r* tel que VAN(r*) = 0</div>
                <div>r = {fmtPct(r, 1)} · I₀ = {fmtDA(inp.initialInvestment)} · n = {n} ans</div>
              </div>
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

      {/* ── PDF Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t("Exporter le rapport d'évaluation", "تصدير تقرير التقييم")}
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
            <div className="flex gap-3 pt-1">
              <Button onClick={handlePdfExport} disabled={pdfLoading} className="flex-1">
                {pdfLoading
                  ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t("Génération…","جارٍ التوليد…")}</>
                  : <><Download className="w-4 h-4 me-2" />{t("Télécharger PDF","تحميل PDF")}</>}
              </Button>
              <Button variant="outline" onClick={() => setPdfOpen(false)}>
                {t("Annuler","إلغاء")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
