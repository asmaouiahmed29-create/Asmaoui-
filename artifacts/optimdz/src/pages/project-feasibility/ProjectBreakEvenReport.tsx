import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import type { BreakEvenResult } from "@/lib/breakEvenAlgorithm";
import { fmtDA, fmtN } from "@/lib/breakEvenAlgorithm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText, Save, CheckCircle2, Loader2, AlertTriangle,
  BarChart2, Lightbulb, ClipboardList, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { generateProjectFeasibilityPDFReport } from "@/lib/generateProjectFeasibilityPDFReport";

type SectorKey = "trade" | "industry" | "agriculture" | "services" | "custom";

interface Props {
  result: BreakEvenResult;
  projectName: string;
  sector: SectorKey | null;
}

export function ProjectBreakEvenReport({ result, projectName, sector }: Props) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const [pdfOpen,         setPdfOpen]         = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [savedOk,         setSavedOk]         = useState(false);
  const [saveError,       setSaveError]       = useState<string | null>(null);
  const [pdfLoading,      setPdfLoading]      = useState(false);
  const [managerName,     setManagerName]     = useState("");
  const [institutionName, setInstitutionName] = useState("");

  const { input: inp, contributionMarginRatio: cmr,
          breakEvenUnits: bepU, breakEvenRevenue: bepR,
          contributionMarginPerUnit: cm } = result;

  // ── Situational analysis — project-framed ─────────────────────────────────
  const riskLabelFr = cmr < 30 ? "élevé 🔴"   : cmr < 50 ? "modéré ⚠️" : "faible ✅";
  const riskLabelAr = cmr < 30 ? "عالية 🔴"    : cmr < 50 ? "متوسطة ⚠️" : "منخفضة ✅";

  const analysisLines: { icon: string; text: string; color: string }[] = [
    {
      icon: "🏗️",
      color: "bg-primary/10 border-primary/30",
      text: t(
        `Le projet "${inp.productName}" prévoit un prix de vente de ${fmtDA(inp.sellingPrice)} / unité, ` +
        `un coût variable unitaire de ${fmtDA(inp.variableCost)} et des charges fixes dédiées au projet de ${fmtDA(inp.fixedCosts)}.`,
        `المشروع "${inp.productName}": سعر البيع ${fmtDA(inp.sellingPrice)}/وحدة، التكلفة المتغيرة ${fmtDA(inp.variableCost)}، الأعباء الثابتة المرتبطة بالمشروع ${fmtDA(inp.fixedCosts)}.`
      ),
    },
    {
      icon: "📊",
      color: "bg-secondary/10 border-secondary/30",
      text: t(
        `Seuil de rentabilité du projet : ${fmtN(bepU, 1)} unités (CA: ${fmtDA(bepR)}). ` +
        `En dessous de ce volume, le projet génère une perte. Marge sur coût variable : ${fmtDA(cm)} / unité (taux ${fmtN(cmr, 2)} %).`,
        `نقطة تعادل المشروع عند ${fmtN(bepU, 1)} وحدة (رقم أعمال: ${fmtDA(bepR)}). ` +
        `دون هذا الحجم، يُسجّل المشروع خسارة. هامش المساهمة ${fmtDA(cm)}/وحدة (نسبة ${fmtN(cmr, 2)}%).`
      ),
    },
    {
      icon: cmr >= 50 ? "✅" : cmr >= 30 ? "⚠️" : "🔴",
      color: cmr >= 50 ? "bg-green-50 border-green-300"
           : cmr >= 30 ? "bg-amber-50 border-amber-300"
           : "bg-red-50 border-red-300",
      text: t(
        `Risque lié à l'engagement dans les charges fixes du projet : ${riskLabelFr}. ` +
        (cmr >= 50
          ? "Bonne structure de coûts — le projet peut atteindre son seuil avec un volume de ventes raisonnable. Profil de risque favorable."
          : cmr >= 30
          ? "Marge acceptable, mais valider la capacité du marché à absorber le volume requis avant de s'engager dans les charges fixes."
          : "Marge faible — un volume élevé est indispensable pour couvrir les charges du projet. Risque de pertes prolongées avant d'atteindre le seuil."),
        `مستوى مخاطرة الالتزام بأعباء المشروع: ${riskLabelAr}. ` +
        (cmr >= 50
          ? "هيكل تكاليف جيد — نقطة التعادل قابلة للتحقق بحجم مبيعات معتدل. ملف المشروع مناسب."
          : cmr >= 30
          ? "هامش مقبول، لكن تحقق من قدرة السوق على استيعاب الحجم المطلوب قبل الالتزام بالأعباء الثابتة."
          : "هامش ضعيف — حجم مبيعات مرتفع ضروري لتغطية أعباء المشروع. خطر خسائر ممتدة قبل بلوغ نقطة التعادل.")
      ),
    },
    ...(result.marginOfSafetyPct !== undefined ? [{
      icon: result.marginOfSafetyPct >= 25 ? "🛡️" : result.marginOfSafetyPct >= 10 ? "⚠️" : "🔴",
      color: result.marginOfSafetyPct >= 25 ? "bg-green-50 border-green-300"
           : result.marginOfSafetyPct >= 10  ? "bg-amber-50 border-amber-300"
           : "bg-red-50 border-red-300",
      text: t(
        `Marge de sécurité du projet (au volume de ventes prévu) : ${fmtN(result.marginOfSafetyPct, 1)} % ` +
        `(${fmtN(result.marginOfSafetyUnits, 1)} unités / ${fmtDA(result.marginOfSafetyRevenue)}). ` +
        (result.marginOfSafetyPct >= 25
          ? "Zone confortable — le projet résiste à une baisse significative de la demande avant de retomber en perte."
          : result.marginOfSafetyPct >= 10
          ? "Marge étroite — une stratégie commerciale active est indispensable pour maintenir le volume au-dessus du seuil."
          : "Marge critique — le projet est très exposé à tout ralentissement de la demande. Reconsidérer la tarification ou les charges."),
        `هامش أمان المشروع (عند الحجم المتوقع): ${fmtN(result.marginOfSafetyPct, 1)}% ` +
        `(${fmtN(result.marginOfSafetyUnits, 1)} وحدة / ${fmtDA(result.marginOfSafetyRevenue)}). ` +
        (result.marginOfSafetyPct >= 25
          ? "منطقة آمنة — المشروع يتحمّل تراجعاً في الطلب قبل العودة للخسارة."
          : result.marginOfSafetyPct >= 10
          ? "هامش ضيق — استراتيجية تسويقية نشطة ضرورية للحفاظ على الحجم فوق نقطة التعادل."
          : "هامش حرج — المشروع مُعرَّض لأي تباطؤ في الطلب. مراجعة التسعير أو الأعباء ضرورية.")
      ),
    }] : []),
    ...(result.operatingLeverage !== undefined ? [{
      icon: "⚡",
      color: "bg-orange-50 border-orange-200",
      text: t(
        `Levier opérationnel du projet (DOL) = ${fmtN(result.operatingLeverage, 2)}×. ` +
        `Une augmentation de 10 % des ventes du projet génère ${fmtN(result.operatingLeverage * 10, 1)} % de hausse sur le résultat opérationnel.`,
        `الرافعة التشغيلية للمشروع = ${fmtN(result.operatingLeverage, 2)}×. ` +
        `زيادة مبيعات المشروع 10% تُولّد نمواً في الربح التشغيلي بنسبة ${fmtN(result.operatingLeverage * 10, 1)}%.`
      ),
    }] : []),
  ];

  // ── Project-specific Go/No-Go suggestions ─────────────────────────────────
  interface Suggestion { icon: string; title: string; desc: string; color: string; borderColor: string; }
  const suggestions: Suggestion[] = [
    {
      icon: "🎯",
      color: "bg-primary/5",
      borderColor: "border-l-primary",
      title: t(
        "Valider la capacité d'absorption du marché",
        "التحقق من قدرة السوق على استيعاب الحجم"
      ),
      desc: t(
        `Le projet requiert ${fmtN(bepU, 1)} unités vendues pour atteindre le seuil. ` +
        `Avant de s'engager dans les charges fixes, estimez le volume réellement accessible sur votre marché cible (étude de clientèle, benchmarks sectoriels, concurrence locale).`,
        `المشروع يتطلب بيع ${fmtN(bepU, 1)} وحدة للوصول لنقطة التعادل. ` +
        `قبل الالتزام بالأعباء الثابتة، قيّم حجم السوق المتاح فعلياً (دراسة عملاء، مقارنة قطاعية، المنافسة المحلية).`
      ),
    },
    {
      icon: "📅",
      color: "bg-secondary/5",
      borderColor: "border-l-secondary",
      title: t(
        "Établir un calendrier de montée en charge",
        "وضع جدول زمني للوصول إلى نقطة التعادل"
      ),
      desc: t(
        `Un nouveau projet n'atteint pas son régime de croisière dès le premier mois. ` +
        `Définissez des jalons réalistes : Mois 1 → X unités, Mois 3 → Y unités... et identifiez à quel mois vous atteignez les ${fmtN(bepU, 1)} unités. ` +
        `Ce délai définit la durée de financement des pertes initiales.`,
        `المشروع الجديد لا يبلغ حجمه الكامل في الشهر الأول. ` +
        `ضع معالم واقعية: الشهر 1 → X وحدة، الشهر 3 → Y وحدة... وحدّد متى تصل إلى ${fmtN(bepU, 1)} وحدة. ` +
        `هذه الفترة تُحدد مدة تمويل الخسائر الأولية.`
      ),
    },
    {
      icon: "💸",
      color: "bg-amber-50",
      borderColor: "border-l-amber-500",
      title: t(
        "Prévoir le financement de la phase pré-seuil",
        "تأمين تمويل مرحلة ما قبل التعادل"
      ),
      desc: t(
        `Chaque mois où les ventes sont inférieures à ${fmtN(bepU, 1)} unités, le projet accumule des pertes. ` +
        `Calculez le déficit maximal prévisible et assurez-vous que votre plan de financement (fonds propres, crédit bancaire, associés) couvre cette période sans mettre en péril la continuité du projet.`,
        `كل شهر تكون فيه المبيعات دون ${fmtN(bepU, 1)} وحدة، يتراكم عجز تشغيلي. ` +
        `احسب أقصى عجز محتمل وتأكد أن خطة تمويل المشروع (رأس مال ذاتي، قرض بنكي، شركاء) تُغطي هذه المرحلة دون المساس باستمرارية النشاط.`
      ),
    },
    ...(cmr < 40 ? [{
      icon: "💰",
      color: "bg-red-50",
      borderColor: "border-l-red-500",
      title: t(
        "Améliorer la structure économique avant le lancement",
        "تحسين الهيكل الاقتصادي قبل إطلاق المشروع"
      ),
      desc: t(
        `Le taux de marge de ${fmtN(cmr, 1)} % est inférieur à 40 %. ` +
        `Avant de lancer le projet, explorez : révision à la hausse du prix de vente, négociation des coûts d'approvisionnement, ou réduction des charges fixes via des solutions alternatives (sous-traitance, location courte durée).`,
        `نسبة الهامش ${fmtN(cmr, 1)}% أقل من 40%. ` +
        `قبل إطلاق المشروع، ادرس: رفع سعر البيع، التفاوض على التوريد، أو تخفيض الأعباء الثابتة عبر حلول بديلة (تعاقد خارجي، إيجار قصير المدى).`
      ),
    }] : []),
    ...(result.marginOfSafetyPct !== undefined && result.marginOfSafetyPct < 20 ? [{
      icon: "🔴",
      color: "bg-red-50",
      borderColor: "border-l-red-500",
      title: t(
        "Marge de sécurité insuffisante — revoir le modèle",
        "هامش أمان غير كافٍ — مراجعة الجدوى"
      ),
      desc: t(
        `Avec ${fmtN(result.marginOfSafetyPct, 1)} % de marge de sécurité, la moindre fluctuation de la demande expose le projet à des pertes. ` +
        `Envisagez de rehausser le prix de vente de 10–15 % ou de diversifier les canaux de distribution pour élargir la base client avant de vous engager.`,
        `هامش أمان ${fmtN(result.marginOfSafetyPct, 1)}% فقط — أي تقلب في الطلب يعيد المشروع للخسارة. ` +
        `ادرس رفع السعر 10-15% أو تنويع قنوات التوزيع لتوسيع قاعدة العملاء قبل الانطلاق.`
      ),
    }] : []),
    ...(inp.fixedCosts / (inp.sellingPrice * bepU) > 0.5 ? [{
      icon: "🏭",
      color: "bg-green-50",
      borderColor: "border-l-green-600",
      title: t(
        "Optimiser les charges fixes dédiées au projet",
        "تحسين الأعباء الثابتة الخاصة بالمشروع"
      ),
      desc: t(
        `Les charges fixes représentent ${fmtN((inp.fixedCosts / bepR) * 100, 1)} % du CA au seuil — ` +
        `un engagement important pour un nouveau projet. Étudiez des alternatives : équipements d'occasion, espace partagé, contrats à durée déterminée pour le personnel initial.`,
        `الأعباء الثابتة تمثل ${fmtN((inp.fixedCosts / bepR) * 100, 1)}% من رقم أعمال التعادل — ` +
        `التزام كبير لمشروع ناشئ. ادرس بدائل: معدات مستعملة، مساحة مشتركة، عقود محددة المدة للموظفين في المرحلة الأولى.`
      ),
    }] : []),
    ...(result.targetProfitUnits !== undefined ? [{
      icon: "🎯",
      color: "bg-primary/5",
      borderColor: "border-l-primary",
      title: t(
        "Atteindre le bénéfice cible du projet",
        "تحقيق الربح المستهدف للمشروع"
      ),
      desc: t(
        `Pour que le projet génère ${fmtDA(inp.targetProfit)}, il faut atteindre ${fmtN(result.targetProfitUnits, 1)} unités ` +
        `(${fmtN((result.targetProfitUnits ?? 0) - bepU, 1)} unités au-delà du seuil). ` +
        `Intégrez cet objectif dans votre business plan et définissez un délai réaliste pour l'atteindre.`,
        `لتحقيق ربح المشروع المستهدف ${fmtDA(inp.targetProfit)}، يلزم الوصول إلى ${fmtN(result.targetProfitUnits, 1)} وحدة ` +
        `(${fmtN((result.targetProfitUnits ?? 0) - bepU, 1)} وحدة فوق نقطة التعادل). ` +
        `أدمج هذا الهدف في خطة أعمال المشروع وحدد جدولاً زمنياً واقعياً للوصول إليه.`
      ),
    }] : []),
  ];

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const body = {
        name: projectName || t("Faisabilité Projet — Seuil", "جدوى المشروع — نقطة التعادل"),
        sector: sector ?? "custom",
        objectiveType: "minimize",
        status: "optimal",
        optimalValue: parseFloat(bepR.toFixed(2)),
        problemData: {
          type: "project-breakeven",
          input: {
            productName:          inp.productName,
            sellingPrice:         inp.sellingPrice,
            variableCost:         inp.variableCost,
            fixedCosts:           inp.fixedCosts,
            targetProfit:         inp.targetProfit,
            expectedSalesVolume:  inp.expectedSalesVolume,
          },
        },
        result: {
          contributionMarginPerUnit: result.contributionMarginPerUnit,
          contributionMarginRatio:   result.contributionMarginRatio,
          breakEvenUnits:            result.breakEvenUnits,
          breakEvenRevenue:          result.breakEvenRevenue,
          marginOfSafetyPct:         result.marginOfSafetyPct,
          netProfit:                 result.netProfit,
          operatingLeverage:         result.operatingLeverage,
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

  // ── PDF ────────────────────────────────────────────────────────────────────
  async function handlePdfExport() {
    setPdfLoading(true);
    try {
      await generateProjectFeasibilityPDFReport({
        result,
        projectName,
        sector: sector ?? undefined,
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

      {/* ── Situational Analysis ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          {t("Analyse de Viabilité du Projet", "تحليل جدوى المشروع")}
        </h2>
        <div className="space-y-2">
          {analysisLines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
                line.color
              )}
            >
              <span className="text-base leading-snug shrink-0">{line.icon}</span>
              <span className="leading-relaxed">{line.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Go/No-Go Suggestions ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          {t("Recommandations avant lancement", "توصيات ما قبل إطلاق المشروع")}
        </h2>
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-lg border-l-4 px-4 py-3",
                s.color, s.borderColor
              )}
            >
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
          {t("Rapport de Faisabilité", "تقرير الجدوى")}
        </h2>
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg font-bold">
                  {projectName || inp.productName || t("Faisabilité Projet", "جدوى المشروع")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t(
                    "Analyse de Seuil de Rentabilité — Faisabilité de Projet",
                    "تحليل نقطة التعادل — جدوى المشروع"
                  )}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge className="bg-primary/10 text-primary border-primary/30">
                  {fmtN(bepU, 1)} {t("u. seuil projet", "وحدة تعادل")}
                </Badge>
                <Badge variant="outline">
                  {fmtN(cmr, 1)} % CM
                </Badge>
                {result.marginOfSafetyPct !== undefined && (
                  <Badge
                    className={cn(
                      result.marginOfSafetyPct >= 20
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-amber-100 text-amber-800 border-amber-300"
                    )}
                  >
                    MoS {fmtN(result.marginOfSafetyPct, 1)} %
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: t("Seuil du projet (unités)", "نقطة تعادل المشروع (وحدات)"),  value: `${fmtN(bepU, 1)} unités` },
                { label: t("Seuil du projet (CA)",     "نقطة تعادل المشروع (CA)"),     value: fmtDA(bepR) },
                { label: t("CM / unité",               "هامش المساهمة / وحدة"),        value: fmtDA(cm) },
                { label: t("Taux CM",                  "نسبة هامش المساهمة"),          value: `${fmtN(cmr, 2)} %` },
                { label: t("Charges fixes projet",     "أعباء المشروع الثابتة"),       value: fmtDA(inp.fixedCosts) },
                { label: t("Coût variable / unité",    "التكلفة المتغيرة / وحدة"),     value: fmtDA(inp.variableCost) },
                ...(result.targetProfitUnits !== undefined ? [
                  { label: t("Unités (bénéfice cible)", "وحدات لتحقيق الهدف"),         value: `${fmtN(result.targetProfitUnits, 1)} unités` },
                ] : []),
                ...(result.marginOfSafetyPct !== undefined ? [
                  { label: t("Marge de sécurité",     "هامش الأمان"),                  value: `${fmtN(result.marginOfSafetyPct, 1)} %` },
                  { label: t("Bénéfice net prévu",    "الربح الصافي المتوقع"),          value: fmtDA(result.netProfit) },
                ] : []),
                ...(result.operatingLeverage !== undefined ? [
                  { label: t("Levier opérationnel",   "الرافعة التشغيلية"),            value: `× ${fmtN(result.operatingLeverage, 2)}` },
                ] : []),
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-base font-bold mt-0.5">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Fixed cost bar — project commitment context */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("Répartition des coûts au seuil du projet", "هيكل تكاليف المشروع عند نقطة التعادل")}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-32 shrink-0">
                  {t("Charges fixes", "أعباء ثابتة")}
                </span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, (inp.fixedCosts / bepR) * 100).toFixed(1)}%` }}
                  />
                </div>
                <span className="font-mono font-medium w-12 text-right">
                  {fmtN((inp.fixedCosts / bepR) * 100, 1)}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-32 shrink-0">
                  {t("Coûts variables", "تكاليف متغيرة")}
                </span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-secondary rounded-full"
                    style={{ width: `${Math.min(100, (inp.variableCost * bepU / bepR) * 100).toFixed(1)}%` }}
                  />
                </div>
                <span className="font-mono font-medium w-12 text-right">
                  {fmtN((inp.variableCost * bepU / bepR) * 100, 1)}%
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap pt-1">
              <Button onClick={handleSave} disabled={isSaving || savedOk} variant="outline">
                {isSaving
                  ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t("Sauvegarde…", "جارٍ الحفظ…")}</>
                  : savedOk
                  ? <><CheckCircle2 className="w-4 h-4 me-2 text-green-600" />{t("Sauvegardé !", "تم الحفظ!")}</>
                  : <><Save className="w-4 h-4 me-2" />{t("Sauvegarder le projet", "حفظ المشروع")}</>}
              </Button>
              <Button onClick={() => setPdfOpen(true)}>
                <FileText className="w-4 h-4 me-2" />
                {t("Exporter rapport PDF", "تصدير تقرير PDF")}
              </Button>
            </div>

            {saveError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {saveError}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── PDF Export Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t("Exporter le rapport de faisabilité", "تصدير تقرير الجدوى")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Ajoutez des informations optionnelles au rapport avant de le générer.",
                "أضف معلومات اختيارية للتقرير قبل توليده."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("Nom du responsable du projet (optionnel)", "اسم مسؤول المشروع (اختياري)")}</Label>
              <Input
                placeholder={t("Ex: M. Amrane Khalil", "مثال: السيد أمران خليل")}
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Nom de l'organisation / promoteur (optionnel)", "اسم المؤسسة / صاحب المشروع (اختياري)")}</Label>
              <Input
                placeholder={t("Ex: SARL Invest Annaba", "مثال: ش.ذ.م.م استثمار عنابة")}
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button onClick={handlePdfExport} disabled={pdfLoading} className="flex-1">
                {pdfLoading
                  ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t("Génération…", "جارٍ التوليد…")}</>
                  : <><Download className="w-4 h-4 me-2" />{t("Télécharger le PDF", "تحميل PDF")}</>}
              </Button>
              <Button variant="outline" onClick={() => setPdfOpen(false)}>
                {t("Annuler", "إلغاء")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
