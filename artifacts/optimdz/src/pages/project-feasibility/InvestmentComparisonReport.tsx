import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import type { ComparisonResult } from "@/lib/investmentComparisonAlgorithm";
import { fmtDA, fmtN, fmtPct, fmtYears } from "@/lib/investmentComparisonAlgorithm";
import { generateComparisonPDFReport } from "@/lib/generateComparisonPDF";
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
  BarChart2, Lightbulb, ClipboardList, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SectorKey = "trade" | "industry" | "agriculture" | "services" | "custom";

interface Props {
  result: ComparisonResult;
  projectTitle: string;
  sector: SectorKey | null;
}

function medalOf(rank: number) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
}

export function InvestmentComparisonReport({ result, projectTitle, sector }: Props) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const [pdfOpen,         setPdfOpen]         = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [savedOk,         setSavedOk]         = useState(false);
  const [saveError,       setSaveError]       = useState<string | null>(null);
  const [pdfLoading,      setPdfLoading]      = useState(false);
  const [managerName,     setManagerName]     = useState("");
  const [institutionName, setInstitutionName] = useState("");

  const {
    alternatives, winner, unequalDurations, primaryCriterion,
    discountRate,
  } = result;

  const sorted = [...alternatives].sort((a, b) => a.overallRank - b.overallRank);
  const best   = sorted[0];
  const second = sorted[1];

  // ── Connected managerial analysis ──────────────────────────────────────────
  // Keep the recommendation in one conclusion paragraph. The banner and
  // comparison table already expose the headline, so repeating it in a
  // recommendation card made the report feel circular.
  const primaryMargin =
    unequalDurations && best.eaa !== null && second.eaa !== null
      ? best.eaa - second.eaa
      : best.appraisal.npv - second.appraisal.npv;
  const primaryMetricFr = unequalDurations ? "rente annuelle équivalente" : "valeur créée";
  const primaryMetricAr = unequalDurations ? "المعادل السنوي للقيمة" : "القيمة المُنشأة";
  const paybackLeader = [...alternatives]
    .filter(a => a.appraisal.discountedPayback !== null || a.appraisal.simplePayback !== null)
    .sort((a, b) =>
      (a.appraisal.discountedPayback ?? a.appraisal.simplePayback ?? Infinity) -
      (b.appraisal.discountedPayback ?? b.appraisal.simplePayback ?? Infinity)
    )[0];
  const lowestInvestment = [...alternatives].sort(
    (a, b) => a.appraisal.input.initialInvestment - b.appraisal.input.initialInvestment
  )[0];

  const alternativeMetrics = alternatives.map(a => {
    const irr = a.appraisal.irr !== null ? fmtPct(a.appraisal.irr, 1) : t("non calculable", "غير قابل للحساب");
    const payback = a.appraisal.discountedPayback !== null
      ? fmtYears(a.appraisal.discountedPayback, isAr ? "ar" : "fr")
      : t("non récupéré pendant la durée du projet", "غير مسترد خلال مدة المشروع");
    const primaryValue = unequalDurations && a.eaa !== null
      ? t(
        `une rente annuelle équivalente de ${fmtDA(a.eaa)}`,
        `معادل سنوي للقيمة قدره ${fmtDA(a.eaa)}`
      )
      : t(
        `une valeur créée de ${fmtDA(a.appraisal.npv)}`,
        `قيمة مُنشأة قدرها ${fmtDA(a.appraisal.npv)}`
      );
    return t(
      `Pour "${a.input.name}", les flux prévisionnels représentent ${primaryValue}, avec une valeur actuelle nette de ${fmtDA(a.appraisal.npv)}, un taux de rendement interne de ${irr} et une récupération actualisée en ${payback}.`,
      `بالنسبة إلى "${a.input.name}"، تُظهر التدفقات المتوقعة ${primaryValue}، مع صافي قيمة حالية قدره ${fmtDA(a.appraisal.npv)}، ومعدل عائد داخلي يبلغ ${irr}، واسترداد مخصوم خلال ${payback}.`
    );
  });

  const tradeoffParts: string[] = [];
  if (paybackLeader && paybackLeader.input.name !== best.input.name) {
    const bestPayback = best.appraisal.discountedPayback ?? best.appraisal.simplePayback;
    const leaderPayback = paybackLeader.appraisal.discountedPayback ?? paybackLeader.appraisal.simplePayback;
    if (bestPayback !== null && leaderPayback !== null) {
      tradeoffParts.push(t(
        `"${best.input.name}" crée davantage de valeur, mais son capital est récupéré en ${fmtYears(bestPayback)} contre ${fmtYears(leaderPayback)} pour "${paybackLeader.input.name}"`,
        `"${best.input.name}" ينشئ قيمة أكبر، لكن استرداد رأس ماله يستغرق ${fmtYears(bestPayback, "ar")} مقابل ${fmtYears(leaderPayback, "ar")} لـ"${paybackLeader.input.name}"`
      ));
    }
  }
  if (lowestInvestment.input.name !== best.input.name) {
    tradeoffParts.push(t(
      `"${lowestInvestment.input.name}" demande moins de capital au départ (${fmtDA(lowestInvestment.appraisal.input.initialInvestment)} contre ${fmtDA(best.appraisal.input.initialInvestment)})`,
      `"${lowestInvestment.input.name}" يتطلب رأس مال أولياً أقل (${fmtDA(lowestInvestment.appraisal.input.initialInvestment)} مقابل ${fmtDA(best.appraisal.input.initialInvestment)})`
    ));
  }
  if (tradeoffParts.length === 0) {
    tradeoffParts.push(t(
      `Les indicateurs ne font pas apparaître de compromis dominant : l'alternative retenue arrive aussi en tête sur la récupération et le niveau d'investissement initial.`,
      `لا تُظهر المؤشرات مفاضلة مهيمنة؛ فالبديل المختار يتقدم أيضاً في سرعة الاسترداد وحجم الاستثمار الأولي.`
    ));
  }

  const analysisParagraphs = [
    t(
      unequalDurations
        ? `La comparaison porte sur ${alternatives.length} alternatives avec un taux d'actualisation commun de ${fmtPct(discountRate, 1)}. Comme les durées diffèrent (${alternatives.map(a => `${a.input.name}: ${a.input.duration} ans`).join(", ")}), la rente annuelle équivalente permet de comparer équitablement la valeur créée chaque année.`
        : `La comparaison porte sur ${alternatives.length} alternatives de ${best.input.duration} ans, avec un taux d'actualisation commun de ${fmtPct(discountRate, 1)}. Les durées étant identiques, la valeur actuelle nette permet de mesurer directement la richesse créée par chaque option.`,
      unequalDurations
        ? `تقارن الدراسة بين ${alternatives.length} بدائل باستخدام معدل خصم موحد قدره ${fmtPct(discountRate, 1)}. وبما أن المدد مختلفة (${alternatives.map(a => `${a.input.name}: ${a.input.duration} سنوات`).join("، ")}، استُخدم المعادل السنوي للقيمة لمقارنة القيمة التي ينشئها كل بديل سنوياً بعدل.`
        : `تقارن الدراسة بين ${alternatives.length} بدائل مدتها ${best.input.duration} سنوات باستخدام معدل خصم موحد قدره ${fmtPct(discountRate, 1)}. وبما أن المدد متساوية، فإن صافي القيمة الحالية يوضح مباشرة مقدار الثروة التي ينشئها كل خيار.`
    ),
    ...alternativeMetrics,
    t(
      `Sur le critère principal, "${best.input.name}" arrive en tête avec ${primaryMetricFr} de ${unequalDurations && best.eaa !== null ? fmtDA(best.eaa) + " par an" : fmtDA(best.appraisal.npv)}, soit ${primaryMargin >= 0 ? "un avantage de " : "un écart de "}${fmtDA(Math.abs(primaryMargin))} par rapport à "${second.input.name}". Cette avance doit être lue avec les autres indicateurs : ${tradeoffParts.join(" ; ")}.`,
      `وفق المعيار الرئيسي، يأتي "${best.input.name}" في المقدمة بقيمة ${unequalDurations && best.eaa !== null ? fmtDA(best.eaa) + " سنوياً كمعادل للقيمة" : fmtDA(best.appraisal.npv) + " كقيمة حالية صافية"}، أي بفارق ${fmtDA(Math.abs(primaryMargin))} عن "${second.input.name}". ويجب قراءة هذا التفوق مع المؤشرات الأخرى: ${tradeoffParts.join("؛ ")}.`
    ),
    t(
      `Nous recommandons donc de retenir "${best.input.name}" pour la décision financière, car il maximise ${primaryMetricFr} selon les hypothèses saisies. Avant de vous engager, confirmez toutefois les flux attendus, la capacité de financement et les risques opérationnels ; si la liquidité immédiate prime sur la valeur totale créée, l'alternative qui récupère le capital le plus vite mérite un examen séparé.`,
      `نوصي لذلك باعتماد "${best.input.name}" في القرار المالي لأنه يعظم ${primaryMetricAr} وفق الافتراضات المدخلة. وقبل الالتزام، تحقّق من التدفقات المتوقعة وقدرة التمويل والمخاطر التشغيلية؛ وإذا كانت السيولة الفورية أهم من القيمة الإجمالية، فادرس بشكل منفصل البديل الأسرع في استرداد رأس المال.`
    ),
  ];

  // ── Suggestions ────────────────────────────────────────────────────────────
  interface Suggestion { icon: string; title: string; desc: string; color: string; border: string; }
  const suggestions: Suggestion[] = [];

  // Non-financial factors
  suggestions.push({
    icon: "🎯",
    color: "bg-primary/5", border: "border-l-primary",
    title: t("Ne pas ignorer les facteurs non-financiers", "لا تتجاهل العوامل غير المالية"),
    desc: t(
      `L'analyse financière est nécessaire mais pas suffisante. Avant de décider, évaluez : ` +
      `(1) la maîtrise opérationnelle requise pour chaque alternative, ` +
      `(2) l'adéquation stratégique avec votre plan d'affaires à long terme, ` +
      `(3) les risques de marché propres à chaque option, ` +
      `(4) les exigences réglementaires ou administratives différentielles.`,
      `التحليل المالي ضروري لكنه غير كافٍ. قبل اتخاذ القرار، قيّم: ` +
      `(1) الكفاءة التشغيلية المطلوبة لكل بديل، ` +
      `(2) الانسجام الاستراتيجي مع خطتك التجارية طويلة المدى، ` +
      `(3) مخاطر السوق الخاصة بكل خيار، ` +
      `(4) الاشتراطات التنظيمية أو الإدارية التفاضلية.`
    ),
  });

  suggestions.push({
    icon: "🔄",
    color: "bg-secondary/5", border: "border-l-secondary",
    title: t("Réévaluer lors de changements d'hypothèses majeurs", "أعد التقييم عند تغيير الافتراضات الرئيسية"),
    desc: t(
      `Les projections dépendent directement des flux de trésorerie estimés. ` +
      `Complétez cette analyse avec l'outil Analyse de Sensibilité (onglet précédent) pour tester la robustesse de la recommandation face aux variations de coûts, de revenus et de taux.`,
      `التوقعات تعتمد مباشرة على التدفقات النقدية المُقدَّرة. ` +
      `أكمل هذا التحليل بأداة تحليل الحساسية (الأداة السابقة) لاختبار متانة التوصية في مواجهة تغيرات التكاليف والإيرادات والمعدلات.`
    ),
  });

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setIsSaving(true); setSaveError(null);
    try {
      const body = {
        name: projectTitle || t("Comparaison des Alternatives", "مقارنة البدائل الاستثمارية"),
        sector: sector ?? "custom",
        objectiveType: "maximize",
        status: "optimal",
        optimalValue: parseFloat(winner.appraisal.npv.toFixed(2)),
        problemData: {
          type: "investment-comparison",
          discountRate,
          unequalDurations,
          primaryCriterion,
          alternatives: alternatives.map(a => ({
            name:              a.input.name,
            initialInvestment: a.input.initialInvestment,
            duration:          a.input.duration,
            cashFlows:         a.input.cashFlows,
            salvageValue:      a.input.salvageValue,
          })),
        },
        result: {
          winner:      winner.input.name,
          winnerNPV:   winner.appraisal.npv,
          winnerEAA:   winner.eaa,
          winnerIRR:   winner.appraisal.irr,
          rankings:    alternatives.map(a => ({
            name: a.input.name, overallRank: a.overallRank,
            npv: a.appraisal.npv, eaa: a.eaa, irr: a.appraisal.irr,
          })),
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

  async function handlePdfExport() {
    setPdfLoading(true);
    try {
      await generateComparisonPDFReport({
        result, projectTitle, sector: sector ?? undefined, managerName, institutionName,
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

      {/* ── Winner Banner ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 flex items-start gap-4">
        <Trophy className="w-8 h-8 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="font-extrabold text-lg text-foreground flex items-center gap-2 flex-wrap">
            {t("Alternative recommandée :", "البديل الموصى به:")}
            <span className="text-amber-700">{winner.input.name}</span>
            <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold">🥇 #1</Badge>
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {primaryCriterion === "eaa" && winner.eaa !== null
              ? t(
                `EAA = ${fmtDA(winner.eaa)}/an — VAN = ${fmtDA(winner.appraisal.npv)} — TRI = ${winner.appraisal.irr !== null ? fmtPct(winner.appraisal.irr, 1) : "—"}`,
                `EAA = ${fmtDA(winner.eaa)}/سنة — NPV = ${fmtDA(winner.appraisal.npv)} — IRR = ${winner.appraisal.irr !== null ? fmtPct(winner.appraisal.irr, 1) : "—"}`
              )
              : t(
                `VAN = ${fmtDA(winner.appraisal.npv)} — TRI = ${winner.appraisal.irr !== null ? fmtPct(winner.appraisal.irr, 1) : "—"} — Indice de Rentabilité = ${fmtN(winner.appraisal.profitabilityIndex, 3)}`,
                `NPV = ${fmtDA(winner.appraisal.npv)} — IRR = ${winner.appraisal.irr !== null ? fmtPct(winner.appraisal.irr, 1) : "—"} — مؤشر الربحية = ${fmtN(winner.appraisal.profitabilityIndex, 3)}`
              )}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {sorted.map(a => (
              <Badge key={a.input.name}
                className={cn("text-xs font-semibold",
                  a.overallRank === 1 ? "bg-amber-100 text-amber-800 border-amber-300"
                  : a.overallRank === 2 ? "bg-slate-100 text-slate-700 border-slate-300"
                  : "bg-orange-50 text-orange-700 border-orange-200"
                )}>
                {medalOf(a.overallRank)} {a.input.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* ── Situational Analysis ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          {t("Analyse Comparative de la Situation", "التحليل المقارن للوضع")}
        </h2>
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4 space-y-3">
          {analysisParagraphs.map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed text-foreground">
              {paragraph}
            </p>
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
          {t("Rapport de Comparaison", "تقرير المقارنة")}
        </h2>
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg font-bold">
                  {projectTitle || t("Comparaison des Alternatives d'Investissement", "مقارنة البدائل الاستثمارية")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t(
                    `${alternatives.length} alternatives · Taux : ${fmtPct(discountRate, 1)} · Critère : ${primaryCriterion.toUpperCase()}`,
                    `${alternatives.length} بدائل · المعدل: ${fmtPct(discountRate, 1)} · المعيار: ${primaryCriterion.toUpperCase()}`
                  )}
                </p>
              </div>
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold shrink-0">
                🥇 {winner.input.name}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sorted.map(a => (
                <div key={a.input.name}
                  className={cn("rounded-lg border p-3",
                    a.overallRank === 1 ? "border-amber-300 bg-amber-50" : "border-border"
                  )}>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {medalOf(a.overallRank)} {a.input.name}
                  </p>
                  <p className={cn("text-base font-bold mt-0.5",
                    (primaryCriterion === "eaa" ? (a.eaa ?? a.appraisal.npv) : a.appraisal.npv) > 0
                      ? "text-green-700" : "text-destructive"
                  )}>
                    {primaryCriterion === "eaa" && a.eaa !== null
                      ? `${fmtDA(a.eaa)}/an`
                      : fmtDA(a.appraisal.npv)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    IRR: {a.appraisal.irr !== null ? fmtPct(a.appraisal.irr, 1) : "—"}
                  </p>
                </div>
              ))}
            </div>

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
              {t("Exporter le rapport de comparaison", "تصدير تقرير المقارنة")}
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
              <Label>{t("Organisation / Promoteur (optionnel)", "المؤسسة / صاحب المشروع (اختياري)")}</Label>
              <Input placeholder={t("Ex: SNC InvestAlg", "مثال: تضامن استثمار الجزائر")}
                value={institutionName} onChange={e => setInstitutionName(e.target.value)} />
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
