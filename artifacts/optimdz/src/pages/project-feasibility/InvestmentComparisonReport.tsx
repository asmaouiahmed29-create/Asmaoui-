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
    hasRankingConflicts, conflictDetails, discountRate,
  } = result;

  const sorted = [...alternatives].sort((a, b) => a.overallRank - b.overallRank);
  const best   = sorted[0];
  const second = sorted[1];

  // ── Situational analysis ──────────────────────────────────────────────────
  const npvMargin = best.appraisal.npv - second.appraisal.npv;
  const eaaMargin =
    unequalDurations && best.eaa !== null && second.eaa !== null
      ? best.eaa - second.eaa
      : null;

  const analysisLines: { icon: string; text: string; color: string }[] = [
    {
      icon: "📊",
      color: "bg-primary/10 border-primary/30",
      text: t(
        `${alternatives.length} alternatives comparées avec un taux d'actualisation commun de ${fmtPct(discountRate, 1)}. ` +
        `Critère de décision principal : ${primaryCriterion === "eaa" ? "EAA — Rente Équivalente Annuelle (durées inégales)" : "VAN — Valeur Actuelle Nette (durées égales)"}.`,
        `تمت مقارنة ${alternatives.length} بدائل بمعدل خصم مشترك ${fmtPct(discountRate, 1)}. ` +
        `معيار القرار الرئيسي: ${primaryCriterion === "eaa" ? "EAA — المعادل السنوي (مدد مختلفة)" : "NPV — القيمة الحالية الصافية (مدد متساوية)"}.`
      ),
    },
    {
      icon: "🏆",
      color: "bg-amber-50 border-amber-300",
      text: t(
        `Alternative recommandée : "${best.input.name}" — ${primaryCriterion === "eaa" && best.eaa !== null
          ? `EAA de ${fmtDA(best.eaa)}/an (${eaaMargin !== null ? `+${fmtDA(eaaMargin)}/an` : ""} vs "${second.input.name}")`
          : `VAN de ${fmtDA(best.appraisal.npv)} (+${fmtDA(npvMargin)} vs "${second.input.name}")`}.` +
        ` TRI : ${best.appraisal.irr !== null ? fmtPct(best.appraisal.irr, 1) : "—"}, ` +
        `Indice de rentabilité : ${fmtN(best.appraisal.profitabilityIndex, 3)}.`,
        `البديل الموصى به: "${best.input.name}" — ${primaryCriterion === "eaa" && best.eaa !== null
          ? `EAA = ${fmtDA(best.eaa)}/سنة (${eaaMargin !== null ? `+${fmtDA(eaaMargin)}/سنة` : ""} مقارنة بـ "${second.input.name}")`
          : `NPV = ${fmtDA(best.appraisal.npv)} (+${fmtDA(npvMargin)} مقارنة بـ "${second.input.name}")`}. ` +
        `IRR: ${best.appraisal.irr !== null ? fmtPct(best.appraisal.irr, 1) : "—"}, ` +
        `مؤشر الربحية: ${fmtN(best.appraisal.profitabilityIndex, 3)}.`
      ),
    },
    {
      icon: unequalDurations ? "📐" : "✅",
      color: unequalDurations ? "bg-blue-50 border-blue-300" : "bg-green-50 border-green-300",
      text: unequalDurations
        ? t(
          `Les durées de projet diffèrent (${alternatives.map(a => `${a.input.name}: ${a.input.duration} ans`).join(", ")}). ` +
          `L'EAA a été calculée pour normaliser la comparaison. ` +
          `Une VAN plus élevée ne suffit pas pour comparer des projets de durées différentes — l'EAA est le critère équitable.`,
          `تختلف مدد المشاريع (${alternatives.map(a => `${a.input.name}: ${a.input.duration} سنوات`).join("، ")}). ` +
          `تم حساب EAA لتطبيع المقارنة. ` +
          `ارتفاع NPV وحده لا يكفي لمقارنة مشاريع بمدد مختلفة — EAA هو المعيار العادل.`
        )
        : t(
          `Les durées sont identiques (${best.input.duration} ans) — la VAN est le critère de décision approprié. ` +
          `Pas besoin de l'EAA dans ce cas.`,
          `المدد متساوية (${best.input.duration} سنوات) — NPV هو معيار القرار المناسب. ` +
          `لا حاجة لـ EAA في هذه الحالة.`
        ),
    },
    ...(hasRankingConflicts ? [{
      icon: "⚠️",
      color: "bg-amber-50 border-amber-400",
      text: t(
        `Conflits de classement détectés : ` +
        conflictDetails.map(d =>
          `"${d.altName}" est 1er selon ${primaryCriterion.toUpperCase()} mais ${d.rank}ème selon ${d.criterion} (1er : "${d.vs}")`
        ).join(" · ") +
        `. La VAN${unequalDurations ? "/EAA" : ""} reste la référence en finance de projet car elle mesure la richesse créée en valeur absolue.`,
        `تم رصد تعارض في الترتيب: ` +
        conflictDetails.map(d =>
          `"${d.altName}" الأول وفق ${primaryCriterion.toUpperCase()} لكن المرتبة ${d.rank} وفق ${d.criterion} (الأول: "${d.vs}")`
        ).join(" · ") +
        `. NPV${unequalDurations ? "/EAA" : ""} يبقى المرجع في تمويل المشاريع لأنه يقيس الثروة المُنشأة بقيمة مطلقة.`
      ),
    }] : [{
      icon: "✅",
      color: "bg-green-50 border-green-300",
      text: t(
        `Convergence totale des indicateurs : VAN, TRI, Indice de Rentabilité et Délai de récupération désignent tous "${winner.input.name}" comme meilleure alternative — signal de robustesse fort.`,
        `تقاطع كامل للمؤشرات: NPV وIRR ومؤشر الربحية وفترة الاسترداد كلها تُشير إلى "${winner.input.name}" كأفضل بديل — إشارة قوية على المتانة.`
      ),
    }]),
    {
      icon: "💡",
      color: "bg-secondary/10 border-secondary/30",
      text: t(
        `Tradeoffs clés : ` +
        alternatives.map(a => {
          const parts: string[] = [];
          if (a.appraisal.simplePayback !== null && best.appraisal.simplePayback !== null) {
            if (a.overallRank === 1 && best.appraisal.simplePayback > (sorted.find(x => x.overallRank === 2)?.appraisal.simplePayback ?? Infinity)) {
              parts.push(`récupération plus lente que les alternatives`);
            }
          }
          if (a.appraisal.input.initialInvestment > best.appraisal.input.initialInvestment && a.overallRank !== 1) {
            parts.push(`investissement initial plus élevé (${fmtDA(a.appraisal.input.initialInvestment)})`);
          }
          return parts.length ? `"${a.input.name}" : ${parts.join(", ")}` : null;
        }).filter(Boolean).join(" · ") || `Pas de tradeoff majeur identifié entre les alternatives.`,
        `المفاضلات الرئيسية: ` +
        (alternatives.some(a => a.appraisal.simplePayback !== null)
          ? alternatives.map(a => {
              if (a.overallRank !== 1 && a.appraisal.input.initialInvestment < best.appraisal.input.initialInvestment) {
                return `"${a.input.name}": استثمار أولي أقل (${fmtDA(a.appraisal.input.initialInvestment)}) لكن عائد إجمالي أقل`;
              }
              return null;
            }).filter(Boolean).join(" · ") || "لا توجد مفاضلات رئيسية مُحددة."
          : "لا توجد مفاضلات رئيسية مُحددة.")
      ),
    },
  ];

  // ── Suggestions ────────────────────────────────────────────────────────────
  interface Suggestion { icon: string; title: string; desc: string; color: string; border: string; }
  const suggestions: Suggestion[] = [];

  suggestions.push({
    icon: "🏆",
    color: "bg-amber-50", border: "border-l-amber-500",
    title: t(`Choisir "${best.input.name}" sur le plan financier`, `اختر "${best.input.name}" من المنظور المالي`),
    desc: t(
      `Sur la base des données fournies, "${best.input.name}" génère la plus grande valeur avec un${primaryCriterion === "eaa" ? "e EAA de " + fmtDA(best.eaa) + "/an" : "e VAN de " + fmtDA(best.appraisal.npv)} et un TRI de ${best.appraisal.irr !== null ? fmtPct(best.appraisal.irr, 1) : "—"}. ` +
      `C'est la recommandation principale selon les critères financiers standard.`,
      `استناداً إلى البيانات المُدخلة، يُولّد "${best.input.name}" أعلى قيمة بـ ${primaryCriterion === "eaa" ? "EAA = " + fmtDA(best.eaa) + "/سنة" : "NPV = " + fmtDA(best.appraisal.npv)} وIRR = ${best.appraisal.irr !== null ? fmtPct(best.appraisal.irr, 1) : "—"}. ` +
      `هذه هي التوصية الرئيسية وفق المعايير المالية القياسية.`
    ),
  });

  // Conflict caveat
  if (hasRankingConflicts) {
    const pbWinner = conflictDetails.find(d => d.criterion === "Délai de récupération");
    if (pbWinner) {
      suggestions.push({
        icon: "⚡",
        color: "bg-blue-50", border: "border-l-blue-500",
        title: t(
          `Si la liquidité à court terme est prioritaire — considérer "${pbWinner.vs}"`,
          `إذا كانت السيولة قصيرة الأجل أولوية — ضع في الاعتبار "${pbWinner.vs}"`
        ),
        desc: t(
          `"${pbWinner.vs}" récupère l'investissement plus rapidement. Si votre trésorerie est contrainte ou si vous anticipez des besoins de liquidités dans les prochaines années, cette alternative peut être préférable malgré une VAN${unequalDurations ? "/EAA" : ""} inférieure.`,
          `"${pbWinner.vs}" يُستردّ منه الاستثمار بشكل أسرع. إذا كانت السيولة محدودة أو توقعت احتياجات نقدية في السنوات القادمة، قد يكون هذا البديل مفضلاً رغم انخفاض NPV${unequalDurations ? "/EAA" : ""}.`
        ),
      });
    }
  }

  // Investment scale consideration
  const sortedByI0 = [...alternatives].sort((a, b) => a.appraisal.input.initialInvestment - b.appraisal.input.initialInvestment);
  if (sortedByI0[0].input.name !== best.input.name) {
    suggestions.push({
      icon: "💰",
      color: "bg-green-50", border: "border-l-green-600",
      title: t("Considérer la contrainte de capital disponible", "ضع في الاعتبار قيد رأس المال المتاح"),
      desc: t(
        `L'alternative recommandée nécessite un investissement initial de ${fmtDA(best.appraisal.input.initialInvestment)}. ` +
        `Si le capital disponible est limité, "${sortedByI0[0].input.name}" (${fmtDA(sortedByI0[0].appraisal.input.initialInvestment)}) pourrait être envisagée avec un plan de financement adapté.`,
        `البديل الموصى به يحتاج استثماراً أولياً بـ ${fmtDA(best.appraisal.input.initialInvestment)}. ` +
        `إذا كان رأس المال المتاح محدوداً، يمكن النظر في "${sortedByI0[0].input.name}" (${fmtDA(sortedByI0[0].appraisal.input.initialInvestment)}) مع خطة تمويل مناسبة.`
      ),
    });
  }

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
      const res = await fetch("/api-server/api/problems", {
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
