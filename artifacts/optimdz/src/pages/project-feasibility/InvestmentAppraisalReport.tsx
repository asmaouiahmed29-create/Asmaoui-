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
import { buildInvestmentAppraisalAnalysis } from "@/lib/investmentAppraisalAnalysis";

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

  // ── Situational analysis paragraphs ─────────────────────────────────────────
  const investmentAnalysis = buildInvestmentAppraisalAnalysis(result);
  const analysisLines: { icon: string; text: string; color: string }[] = [
    { icon: npv > 0 ? "✅" : "🔴", color: npv > 0 ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300", text: isAr ? investmentAnalysis.ar[0] : investmentAnalysis.fr[0] },
    { icon: irr !== null && irr >= r ? "📊" : "⚠️", color: irr !== null && irr >= r ? "bg-secondary/10 border-secondary/30" : "bg-amber-50 border-amber-300", text: isAr ? investmentAnalysis.ar[1] : investmentAnalysis.fr[1] },
    { icon: simplePayback !== null && simplePayback < n ? "⏱️" : "⚠️", color: simplePayback !== null && simplePayback < n ? "bg-secondary/10 border-secondary/30" : "bg-amber-50 border-amber-300", text: isAr ? investmentAnalysis.ar[2] : investmentAnalysis.fr[2] },
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
        `Construisez trois scénarios — pessimiste, central et optimiste — en faisant varier les flux annuels et le taux d'actualisation de manière cohérente. Documentez les hypothèses et retenez les variables qui doivent être suivies après le lancement.`,
        `أنشئ ثلاثة سيناريوهات — متشائم ومرجعي ومتفائل — عبر تغيير التدفقات السنوية ومعدل الخصم بصورة متسقة. وثّق الفرضيات وحدّد المتغيرات التي يجب متابعتها بعد الإطلاق.`
      ),
    },
    // NPV-specific
    ...(npv < 0 ? [{
      icon: "🔴",
      color: "bg-red-50", borderColor: "border-l-red-500",
      title: t("Revoir les paramètres avant engagement", "مراجعة المتغيرات قبل الالتزام"),
      desc: t(
        `Avant toute décision, testez trois leviers dans le modèle : réduire l'investissement initial, améliorer les flux par les coûts ou les revenus, et revoir le calendrier de décaissement. Ne retenez un taux requis plus bas qu'après avoir documenté le risque qui le justifie.`,
        `قبل اتخاذ القرار، اختبر ثلاثة روافع في النموذج: تخفيض الاستثمار الأولي، تحسين التدفقات عبر التكاليف أو الإيرادات، ومراجعة جدول الإنفاق. لا تعتمد معدل عائد مطلوباً أدنى إلا بعد توثيق الخطر الذي يبرره.`
      ),
    }] as Suggestion[] : []),
    // IRR-specific
    ...(irr !== null && irr < r ? [{
      icon: "📊",
      color: "bg-amber-50", borderColor: "border-l-amber-500",
      title: t("Rehausser le rendement attendu ou réduire le risque", "رفع العائد المتوقع أو تخفيض المخاطر"),
      desc: t(
        `Recalibrez le modèle en vérifiant les hypothèses de revenus, les coûts d'exploitation et le calendrier des encaissements. Si des synergies ou économies sont certaines, intégrez-les avec une justification documentée plutôt que de les laisser implicites.`,
        `أعد معايرة النموذج عبر التحقق من فرضيات الإيرادات وتكاليف التشغيل وتوقيت التحصيل. إذا كانت هناك تأثيرات تآزرية أو وفورات مؤكدة، فأدرجها مع تبرير موثق بدلاً من تركها ضمنية.`
      ),
    }] as Suggestion[] : []),
    // Payback risk
    ...(discountedPayback === null || discountedPayback >= n ? [{
      icon: "⏰",
      color: "bg-amber-50", borderColor: "border-l-amber-500",
      title: t("Sécuriser la trésorerie et la sortie du projet", "حماية السيولة وخطة الخروج"),
      desc: t(
        `Préparez un plan de sécurisation de la trésorerie pour les dernières années : vérifiez la valeur résiduelle, les options de sortie et la durée économique réelle de l'actif. Fixez aussi un seuil de réexamen si les encaissements cumulés prennent du retard.`,
        `ضع خطة لحماية السيولة في السنوات الأخيرة: تحقق من القيمة المتبقية وخيارات الخروج والعمر الاقتصادي الفعلي للأصل. وحدد أيضاً عتبة لإعادة التقييم إذا تأخرت التحصيلات التراكمية.`
      ),
    }] as Suggestion[] : []),
    // Always: financing structure
    {
      icon: "🏦",
      color: "bg-green-50", borderColor: "border-l-green-600",
      title: t("Optimiser le plan de financement", "تحسين هيكل التمويل"),
      desc: t(
        `Comparez plusieurs structures de financement en distinguant le coût, les garanties, le calendrier de remboursement et l'effet sur la trésorerie. Retenez la solution qui protège la liquidité du projet sans transférer un risque excessif aux fonds propres.`,
        `قارن بين هياكل تمويل متعددة مع التمييز بين التكلفة والضمانات وجدول السداد وأثرها على السيولة. اختر الحل الذي يحمي سيولة المشروع دون نقل خطر مفرط إلى رأس المال الذاتي.`
      ),
    },
    // High-NPV: reinvestment warning
    ...(npv > 0 && profitabilityIndex > 1.2 ? [{
      icon: "📈",
      color: "bg-primary/5", borderColor: "border-l-primary",
      title: t("Vérifier l'hypothèse de réinvestissement des flux", "التحقق من فرضية إعادة استثمار التدفقات"),
      desc: t(
        `Vérifiez que les flux intermédiaires peuvent réellement être réinvestis dans des opportunités comparables. Si ce n'est pas le cas, complétez l'analyse par un scénario de réinvestissement prudent et comparez ses résultats au plan de base.`,
        `تحقق من إمكانية إعادة استثمار التدفقات الوسيطة فعلياً في فرص مماثلة. وإذا لم يكن ذلك ممكناً، فأكمل التحليل بسيناريو إعادة استثمار حذر وقارن نتائجه بالخطة الأساسية.`
      ),
    }] as Suggestion[] : []),
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
      await generateInvestmentAppraisalPDFReport({
        result,
        projectName,
        sector: sector ?? undefined,
        managerName,
        institutionName,
        analysisLines,
        suggestions: suggestions.map(s => ({
          icon: s.icon,
          title: s.title,
          desc: s.desc,
          color: s.color,
          borderColor: s.borderColor,
        })),
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
          <div className={cn(
            "rounded-lg border border-primary/20 bg-primary/5 px-5 py-4 space-y-3 text-sm leading-relaxed text-foreground",
            isAr && "text-right"
          )}>
            {analysisLines.map((line, i) => <p key={i}>{line.text}</p>)}
          </div>
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
