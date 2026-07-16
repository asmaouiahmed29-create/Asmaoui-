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
import { generateFinancialPDFReport } from "@/lib/generateFinancialPDFReport";

type SectorKey = "trade" | "industry" | "agriculture" | "services" | "custom";

interface Props {
  result: BreakEvenResult;
  businessName: string;
  sector: SectorKey | null;
}

export function BreakEvenReport({ result, businessName, sector }: Props) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const [pdfOpen,    setPdfOpen]    = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const [savedOk,    setSavedOk]    = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [managerName,     setManagerName]     = useState("");
  const [institutionName, setInstitutionName] = useState("");

  const { input: inp, contributionMarginRatio: cmr,
          breakEvenUnits: bepU, breakEvenRevenue: bepR,
          contributionMarginPerUnit: cm } = result;

  // ── Situational analysis lines ────────────────────────────────────────────
  const riskLabelFr = cmr < 30 ? "élevé 🔴"    : cmr < 50 ? "modéré ⚠️" : "faible ✅";
  const riskLabelAr = cmr < 30 ? "عالية 🔴"     : cmr < 50 ? "متوسطة ⚠️" : "منخفضة ✅";

  const analysisLines: { icon: string; text: string; color: string }[] = [
    {
      icon: "📊",
      color: "bg-primary/10 border-primary/30",
      text: t(
        `Le produit/service "${inp.productName}" affiche un prix de vente de ${fmtDA(inp.sellingPrice)}, ` +
        `un coût variable unitaire de ${fmtDA(inp.variableCost)} et des charges fixes de ${fmtDA(inp.fixedCosts)}.`,
        `المنتج/الخدمة "${inp.productName}": سعر البيع ${fmtDA(inp.sellingPrice)}, التكلفة المتغيرة ${fmtDA(inp.variableCost)}, الأعباء الثابتة ${fmtDA(inp.fixedCosts)}.`
      ),
    },
    {
      icon: "📈",
      color: "bg-secondary/10 border-secondary/30",
      text: t(
        `Le seuil de rentabilité est de ${fmtN(bepU, 1)} unités (CA: ${fmtDA(bepR)}). ` +
        `La marge sur coût variable est de ${fmtDA(cm)} / unité, soit un taux de ${fmtN(cmr, 2)} %.`,
        `نقطة التعادل عند ${fmtN(bepU, 1)} وحدة (رقم أعمال: ${fmtDA(bepR)}). ` +
        `هامش المساهمة ${fmtDA(cm)}/وحدة، نسبة الهامش ${fmtN(cmr, 2)}%.`
      ),
    },
    {
      icon: cmr >= 50 ? "✅" : cmr >= 30 ? "⚠️" : "🔴",
      color: cmr >= 50 ? "bg-green-50 border-green-300"
           : cmr >= 30 ? "bg-amber-50 border-amber-300"
           : "bg-red-50 border-red-300",
      text: t(
        `Niveau de risque opérationnel ${riskLabelFr}. ` +
        (cmr >= 50
          ? "La structure de coûts est saine — un volume de vente modéré suffit à couvrir les charges."
          : cmr >= 30
          ? "Taux de marge acceptable, mais il est recommandé de revoir la tarification ou de réduire les coûts variables."
          : "Taux de marge faible — un volume de vente élevé est indispensable pour atteindre la rentabilité. Risque de pertes en cas de baisse d'activité."),
        `مستوى المخاطرة التشغيلية: ${riskLabelAr}. ` +
        (cmr >= 50
          ? "الهيكل المالي صحي — حجم مبيعات معتدل يكفي لتغطية الأعباء."
          : cmr >= 30
          ? "نسبة الهامش مقبولة، لكن يُستحسن مراجعة التسعير أو خفض التكاليف المتغيرة."
          : "نسبة هامش ضعيفة — يُشترط حجم مبيعات مرتفع للوصول إلى الربحية. خطر الخسائر عند تراجع النشاط.")
      ),
    },
    ...(result.marginOfSafetyPct !== undefined ? [{
      icon: result.marginOfSafetyPct >= 25 ? "🛡️" : result.marginOfSafetyPct >= 10 ? "⚠️" : "🔴",
      color: result.marginOfSafetyPct >= 25 ? "bg-green-50 border-green-300"
           : result.marginOfSafetyPct >= 10  ? "bg-amber-50 border-amber-300"
           : "bg-red-50 border-red-300",
      text: t(
        `Marge de sécurité: ${fmtN(result.marginOfSafetyPct, 1)} % ` +
        `(${fmtN(result.marginOfSafetyUnits, 1)} unités / ${fmtDA(result.marginOfSafetyRevenue)}). ` +
        (result.marginOfSafetyPct >= 25
          ? "Zone sécurisée — les ventes peuvent chuter de cette proportion avant d'atteindre le seuil de pertes."
          : result.marginOfSafetyPct >= 10
          ? "Marge étroite — surveiller de près l'évolution des ventes."
          : "Marge critique — l'entreprise est très proche du seuil de perte, toute baisse d'activité est dangereuse."),
        `هامش الأمان: ${fmtN(result.marginOfSafetyPct, 1)}% ` +
        `(${fmtN(result.marginOfSafetyUnits, 1)} وحدة / ${fmtDA(result.marginOfSafetyRevenue)}). ` +
        (result.marginOfSafetyPct >= 25
          ? "منطقة آمنة — يمكن أن تتراجع المبيعات بهذه النسبة قبل الوصول إلى الخسارة."
          : result.marginOfSafetyPct >= 10
          ? "هامش ضيق — تتطلب متابعة دقيقة لحجم المبيعات."
          : "هامش حرج — المؤسسة قريبة جداً من نقطة الخسارة، أي تراجع في النشاط خطير.")
      ),
    }] : []),
    ...(result.operatingLeverage !== undefined ? [{
      icon: "⚡",
      color: "bg-orange-50 border-orange-200",
      text: t(
        `Levier opérationnel (DOL) = ${fmtN(result.operatingLeverage, 2)}×. ` +
        `Une augmentation de 10 % des ventes entraîne une hausse de ${fmtN(result.operatingLeverage * 10, 1)} % du résultat opérationnel.`,
        `الرافعة التشغيلية = ${fmtN(result.operatingLeverage, 2)}×. ` +
        `زيادة المبيعات 10% تُولّد نمواً في الربح التشغيلي بنسبة ${fmtN(result.operatingLeverage * 10, 1)}%.`
      ),
    }] : []),
  ];

  // ── Suggestions ───────────────────────────────────────────────────────────
  interface Suggestion { icon: string; title: string; desc: string; color: string; borderColor: string; }
  const suggestions: Suggestion[] = [
    {
      icon: "⚠️",
      color: "bg-primary/5",
      borderColor: "border-l-primary",
      title: t("Atteindre le seuil de rentabilité en priorité", "الأولوية: الوصول لنقطة التعادل"),
      desc: t(
        `Viser en priorité les ${fmtN(bepU, 1)} unités mensuelles minimum. Tout volume inférieur génère une perte. ` +
        `Envisagez de planifier les ventes sur une base hebdomadaire (${fmtN(bepU / 4, 1)} unités/sem.).`,
        `استهدف ${fmtN(bepU, 1)} وحدة كحد أدنى شهرياً. أي حجم أقل يعني خسارة صافية. ` +
        `تخطيط أسبوعي: ${fmtN(bepU / 4, 1)} وحدة/أسبوع.`
      ),
    },
    ...(cmr < 40 ? [{
      icon: "💰",
      color: "bg-amber-50",
      borderColor: "border-l-amber-500",
      title: t("Améliorer le taux de marge", "تحسين نسبة هامش المساهمة"),
      desc: t(
        `Le taux de ${fmtN(cmr, 1)} % est en-deçà des 40 % recommandés. ` +
        `Une hausse du prix de 5 % ou une réduction des coûts variables de 5 % amélioreraient significativement la rentabilité.`,
        `نسبة ${fmtN(cmr, 1)}% أقل من النسبة الموصى بها (40%). ` +
        `رفع السعر 5% أو خفض التكاليف المتغيرة 5% سيحسّن الهامش بشكل ملحوظ.`
      ),
    }] : []),
    ...(result.marginOfSafetyPct !== undefined && result.marginOfSafetyPct < 20 ? [{
      icon: "🔴",
      color: "bg-red-50",
      borderColor: "border-l-red-500",
      title: t("Marge de sécurité critique — actions urgentes", "هامش أمان حرج — إجراءات عاجلة"),
      desc: t(
        `Avec seulement ${fmtN(result.marginOfSafetyPct, 1)} % de marge de sécurité, l'entreprise est vulnérable à la moindre baisse de demande. ` +
        `Priorité : diversifier les canaux de vente, réduire les charges fixes, et constituer une réserve de trésorerie.`,
        `هامش أمان ${fmtN(result.marginOfSafetyPct, 1)}% فقط — المؤسسة هشّة أمام أي تراجع في الطلب. ` +
        `الأولويات: تنويع قنوات البيع، خفض الأعباء الثابتة، وبناء احتياطي سيولة.`
      ),
    }] : []),
    ...(inp.fixedCosts / (inp.sellingPrice * bepU) > 0.5 ? [{
      icon: "🏭",
      color: "bg-green-50",
      borderColor: "border-l-green-600",
      title: t("Optimiser la structure des charges fixes", "تحسين هيكل الأعباء الثابتة"),
      desc: t(
        `Les charges fixes représentent ${fmtN((inp.fixedCosts / bepR) * 100, 1)} % du CA au seuil. ` +
        `Analysez chaque poste de charge fixe et étudiez la possibilité de variabiliser certains coûts (ex: recours à la sous-traitance, loyer variable selon l'activité).`,
        `الأعباء الثابتة تمثل ${fmtN((inp.fixedCosts / bepR) * 100, 1)}% من رقم أعمال التعادل. ` +
        `راجع كل بند وادرس إمكانية تحويله لعبء متغير (تعاقد خارجي، إيجار مرن حسب النشاط...).`
      ),
    }] : []),
    ...(result.targetProfitUnits !== undefined ? [{
      icon: "🎯",
      color: "bg-primary/5",
      borderColor: "border-l-primary",
      title: t("Planification vers l'objectif de profit", "التخطيط لتحقيق الربح المستهدف"),
      desc: t(
        `Pour atteindre le bénéfice cible de ${fmtDA(inp.targetProfit)}, il faut vendre ${fmtN(result.targetProfitUnits, 1)} unités ` +
        `(${fmtN((result.targetProfitUnits ?? 0) - bepU, 1)} unités au-delà du seuil). ` +
        `Élaborez un plan commercial mensuel chiffré pour atteindre cet objectif.`,
        `لتحقيق الربح المستهدف ${fmtDA(inp.targetProfit)}، يلزم بيع ${fmtN(result.targetProfitUnits, 1)} وحدة ` +
        `(${fmtN((result.targetProfitUnits ?? 0) - bepU, 1)} وحدة إضافية فوق نقطة التعادل). ` +
        `ضع خطة مبيعات شهرية مُرقّمة لبلوغ هذا الهدف.`
      ),
    }] : []),
    {
      icon: "📊",
      color: "bg-secondary/5",
      borderColor: "border-l-secondary",
      title: t("Suivi et révision périodique", "المتابعة والمراجعة الدورية"),
      desc: t(
        `Révisez ces indicateurs chaque trimestre : prix de vente, coûts variables (inflation, fournisseurs), charges fixes. ` +
        `Un changement de 10 % dans les coûts variables déplace le seuil de rentabilité de ${fmtN(inp.fixedCosts / ((cm * 0.9)) - bepU, 1)} unités.`,
        `راجع هذه المؤشرات كل ثلاثة أشهر: سعر البيع، التكاليف المتغيرة (التضخم، الموردون)، الأعباء الثابتة. ` +
        `تغيّر 10% في التكاليف المتغيرة يُزيح نقطة التعادل بـ ${fmtN(inp.fixedCosts / (cm * 0.9) - bepU, 1)} وحدة.`
      ),
    },
  ];

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const body = {
        name: businessName || t("Analyse CVP", "تحليل CVP"),
        sector: sector ?? "custom",
        objectiveType: "minimize",
        status: "optimal",
        optimalValue: parseFloat(bepR.toFixed(2)),
        problemData: {
          type: "breakeven",
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
      const res = await fetch("/api-server/api/problems", {
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

  // ── PDF ──────────────────────────────────────────────────────────────────
  async function handlePdfExport() {
    setPdfLoading(true);
    try {
      await generateFinancialPDFReport({
        result,
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

      {/* ── Situational Analysis ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          {t("Analyse Situationnelle", "التحليل الموقفي")}
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

      {/* ── Suggestions ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          {t("Suggestions Managériales", "التوصيات الإدارية")}
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
          {t("Rapport Managérial", "التقرير الإداري")}
        </h2>
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg font-bold">
                  {inp.productName || t("Analyse CVP", "تحليل CVP")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t("Analyse Coût-Volume-Profit — Seuil de rentabilité", "تحليل التعادل CVP — نقطة التعادل")}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge className="bg-primary/10 text-primary border-primary/30">
                  {fmtN(bepU, 1)} {t("unités BEP", "وحدة تعادل")}
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
                { label: t("Seuil (unités)", "نقطة التعادل (وحدات)"),   value: `${fmtN(bepU, 1)} unités` },
                { label: t("Seuil (CA)",     "نقطة التعادل (CA)"),      value: fmtDA(bepR) },
                { label: t("CM / unité",     "هامش المساهمة / وحدة"),   value: fmtDA(cm) },
                { label: t("Taux CM",        "نسبة الهامش"),            value: `${fmtN(cmr, 2)} %` },
                { label: t("Charges fixes",  "الأعباء الثابتة"),         value: fmtDA(inp.fixedCosts) },
                { label: t("Coût variable",  "التكلفة المتغيرة/وحدة"),  value: fmtDA(inp.variableCost) },
                ...(result.targetProfitUnits !== undefined ? [
                  { label: t("Unités (objectif)", "وحدات الهدف"),       value: `${fmtN(result.targetProfitUnits, 1)} unités` },
                ] : []),
                ...(result.marginOfSafetyPct !== undefined ? [
                  { label: t("Marge de sécurité", "هامش الأمان"),       value: `${fmtN(result.marginOfSafetyPct, 1)} %` },
                  { label: t("Bénéfice net prévu", "الربح الصافي المتوقع"), value: fmtDA(result.netProfit) },
                ] : []),
                ...(result.operatingLeverage !== undefined ? [
                  { label: t("Levier opérationnel (DOL)", "الرافعة التشغيلية"), value: `× ${fmtN(result.operatingLeverage, 2)}` },
                ] : []),
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-base font-bold mt-0.5">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Fixed cost bar */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("Structure des coûts au seuil", "هيكل التكاليف عند نقطة التعادل")}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-28 shrink-0">
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
                <span className="text-muted-foreground w-28 shrink-0">
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
                  : <><Save className="w-4 h-4 me-2" />{t("Sauvegarder", "حفظ التحليل")}</>}
              </Button>
              <Button onClick={() => setPdfOpen(true)}>
                <FileText className="w-4 h-4 me-2" />
                {t("Exporter PDF", "تصدير PDF")}
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

      {/* ── PDF Export Dialog ────────────────────────────────────────────────── */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t("Exporter le rapport PDF", "تصدير تقرير PDF")}
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
              <Label>{t("Nom du responsable (optionnel)", "اسم المسؤول (اختياري)")}</Label>
              <Input
                placeholder={t("Ex: M. Amrane Khalil", "مثال: السيد أمران خليل")}
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Nom de l'institution (optionnel)", "اسم المؤسسة (اختياري)")}</Label>
              <Input
                placeholder={t("Ex: SARL Meuble Tizi", "مثال: ش.ذ.م.م تيزي للأثاث")}
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
