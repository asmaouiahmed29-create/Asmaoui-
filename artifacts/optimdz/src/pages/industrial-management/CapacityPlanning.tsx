import { useState, useRef } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Gauge, Plus, Trash2, Calculator, Save, FileText,
  CheckCircle2, Loader2, AlertTriangle, ArrowLeft, RefreshCw,
  Factory, ShoppingBag, Leaf, Monitor, PencilRuler,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeCapacityPlan, validateInputs, buildPeriodLabels,
  generateCapacityAnalysis, generateCapacityRecommendations,
  type PeriodType, type CapacityInputs, type CapacityResults,
} from "@/lib/capacityPlanningAlgorithm";
import { generateCapacityPlanningPDF } from "@/lib/generateCapacityPlanningPDF";

// ── ID helper ─────────────────────────────────────────────────────────────────
let _uid = 0;
function uid() { return `c${++_uid}`; }

// ── Center draft ──────────────────────────────────────────────────────────────
interface CenterDraft {
  id: string;
  name: string;
  capacities: string[];   // one per period
  loads: string[];        // one per period
}

function makeCenter(periodCount: number): CenterDraft {
  return {
    id: uid(),
    name: "",
    capacities: Array(periodCount).fill(""),
    loads: Array(periodCount).fill(""),
  };
}

// ── Sector definitions ────────────────────────────────────────────────────────
type SectorKey = "industrie" | "agriculture" | "services" | "custom";
interface Sector { id: SectorKey; icon: React.ElementType; nameAr: string; nameFr: string; }
const SECTORS: Sector[] = [
  { id: "industrie",   icon: Factory,     nameAr: "الصناعة",   nameFr: "Industrie" },
  { id: "agriculture", icon: Leaf,        nameAr: "الفلاحة",   nameFr: "Agriculture" },
  { id: "services",    icon: Monitor,     nameAr: "الخدمات",   nameFr: "Services" },
  { id: "custom",      icon: PencilRuler, nameAr: "مخصص",      nameFr: "Personnalisé" },
];

// ── Industry templates ────────────────────────────────────────────────────────
function buildTemplate(sector: SectorKey, periodCount: number): CenterDraft[] {
  const fill = (vals: number[]): string[] =>
    Array.from({ length: periodCount }, (_, i) => i < vals.length ? String(vals[i]) : "0");

  if (sector === "industrie") {
    return [
      { id: uid(), name: "Découpe / قطع",    capacities: fill([160,160,160,160,160,160]), loads: fill([140,155,170,145,160,150]) },
      { id: uid(), name: "Soudure / لحام",   capacities: fill([120,120,120,120,120,120]), loads: fill([100,115,130,110,125,105]) },
      { id: uid(), name: "Peinture / طلاء",  capacities: fill([80,80,80,80,80,80]),       loads: fill([60,75,85,70,80,65]) },
      { id: uid(), name: "Assemblage / تجميع",capacities: fill([200,200,200,200,200,200]),loads: fill([180,190,210,175,195,185]) },
    ];
  }
  if (sector === "agriculture") {
    return [
      { id: uid(), name: "Préparation sol / تحضير التربة", capacities: fill([100,100,80,80,60,60]), loads: fill([20,80,75,50,30,10]) },
      { id: uid(), name: "Récolte / حصاد",                 capacities: fill([60,60,120,120,80,60]), loads: fill([0,10,110,100,40,5]) },
    ];
  }
  if (sector === "services") {
    return [
      { id: uid(), name: "Accueil / الاستقبال",    capacities: fill([160,160,160,160,160,160]), loads: fill([130,145,160,150,165,140]) },
      { id: uid(), name: "Back-office / الدعم",    capacities: fill([120,120,120,120,120,120]), loads: fill([80,90,100,85,95,75]) },
    ];
  }
  return [makeCenter(periodCount), makeCenter(periodCount)];
}

// ── Parse draft → algorithm input ─────────────────────────────────────────────
function parseCenters(drafts: CenterDraft[], periodCount: number): CapacityInputs["centers"] {
  return drafts.map(d => ({
    id: d.id,
    name: d.name.trim() || "?",
    capacities: Array.from({ length: periodCount }, (_, i) => Math.max(0, parseFloat(d.capacities[i] || "0") || 0)),
    loads:      Array.from({ length: periodCount }, (_, i) => Math.max(0, parseFloat(d.loads[i]      || "0") || 0)),
  }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtRate(r: number): string {
  if (!isFinite(r)) return "∞%";
  return `${r.toFixed(1)}%`;
}
function fmtNum(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

// ── Status config ─────────────────────────────────────────────────────────────
const statusCfg = {
  critical:  { bg: "bg-red-50",    border: "border-red-200",   text: "text-red-700",   badge: "bg-red-100 text-red-700"   },
  warning:   { bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-700"},
  underused: { bg: "bg-blue-50",   border: "border-blue-200",  text: "text-blue-700",  badge: "bg-blue-100 text-blue-700" },
  good:      { bg: "bg-green-50",  border: "border-green-200", text: "text-green-700", badge: "bg-green-100 text-green-700"},
};

// ── Main component ────────────────────────────────────────────────────────────
export default function CapacityPlanning() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  // ── Form state ───────────────────────────────────────────────────────────────
  const [phase, setPhase]             = useState<"form" | "results">("form");
  const [problemName, setProblemName] = useState("");
  const [periodType, setPeriodType]   = useState<PeriodType>("mois");
  const [periodCount, setPeriodCount] = useState(4);
  const [centers, setCenters]         = useState<CenterDraft[]>(() => [makeCenter(4), makeCenter(4), makeCenter(4)]);
  const [sector, setSector]           = useState<SectorKey>("industrie");

  // ── Result state ─────────────────────────────────────────────────────────────
  const [results, setResults]         = useState<CapacityResults | null>(null);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  const resultRef = useRef<HTMLDivElement>(null);

  // ── Period count change ───────────────────────────────────────────────────────
  function handlePeriodCountChange(n: number) {
    setPeriodCount(n);
    setCenters(prev => prev.map(c => ({
      ...c,
      capacities: Array.from({ length: n }, (_, i) => c.capacities[i] ?? ""),
      loads:      Array.from({ length: n }, (_, i) => c.loads[i] ?? ""),
    })));
  }

  // ── Sector template ───────────────────────────────────────────────────────────
  function loadTemplate(s: SectorKey) {
    setSector(s);
    setCenters(buildTemplate(s, periodCount));
  }

  // ── Center mutations ──────────────────────────────────────────────────────────
  function addCenter() { setCenters(prev => [...prev, makeCenter(periodCount)]); }
  function removeCenter(id: string) { setCenters(prev => prev.filter(c => c.id !== id)); }
  function updateCenterName(id: string, val: string) {
    setCenters(prev => prev.map(c => c.id === id ? { ...c, name: val } : c));
  }
  function updateCapacity(id: string, pIdx: number, val: string) {
    setCenters(prev => prev.map(c => c.id === id
      ? { ...c, capacities: c.capacities.map((v, i) => i === pIdx ? val : v) }
      : c));
  }
  function updateLoad(id: string, pIdx: number, val: string) {
    setCenters(prev => prev.map(c => c.id === id
      ? { ...c, loads: c.loads.map((v, i) => i === pIdx ? val : v) }
      : c));
  }

  // ── Compute ───────────────────────────────────────────────────────────────────
  function handleCompute() {
    const inputs: CapacityInputs = {
      problemName: problemName || t("Planification sans titre", "تخطيط بدون عنوان"),
      periodType,
      periodCount,
      centers: parseCenters(centers, periodCount),
    };
    const errs = validateInputs(inputs);
    if (errs.length > 0) return;
    const r = computeCapacityPlan(inputs);
    setResults(r);
    setPhase("results");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!results) return;
    setSaving(true);
    try {
      const inputs: CapacityInputs = {
        problemName: problemName || t("Planification sans titre", "تخطيط بدون عنوان"),
        periodType, periodCount,
        centers: parseCenters(centers, periodCount),
      };
      await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "industrial-capacity-planning",
          name: inputs.problemName,
          content: { inputs, results },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  // ── PDF export ────────────────────────────────────────────────────────────────
  async function handleExport() {
    if (!results) return;
    setExporting(true);
    try {
      await generateCapacityPlanningPDF({
        problemName: problemName || t("Planification sans titre", "تخطيط بدون عنوان"),
        results,
        language: language as "fr" | "ar",
        analysisLines: generateCapacityAnalysis(results, results.periodLabels),
        recommendations: generateCapacityRecommendations(results, results.periodLabels),
        onProgress: (step) => setExportProgress(step),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const periodLabels   = buildPeriodLabels(periodType, periodCount);
  const parsed         = parseCenters(centers, periodCount);
  const validationErrors = validateInputs({ problemName, periodType, periodCount, centers: parsed });
  const canCompute     = validationErrors.length === 0;
  const analysisLines  = results ? generateCapacityAnalysis(results, results.periodLabels) : [];
  const recommendations = results ? generateCapacityRecommendations(results, results.periodLabels) : [];

  // ── Status label helper ───────────────────────────────────────────────────────
  const statusLabel = (s: string) => ({
    critical:  { fr: "GOULOT",        ar: "اختناق" },
    warning:   { fr: "ATTENTION",     ar: "تحذير" },
    underused: { fr: "SOUS-UTILISÉ",  ar: "طاقة فائضة" },
    good:      { fr: "SAIN",          ar: "سليم" },
  }[s] ?? { fr: s, ar: s });

  const overallStatusLabel = {
    critical: { fr: "Critique — Goulots détectés",     ar: "حرج — اختناقات مكتشفة" },
    warning:  { fr: "Attention — Capacités tendues",   ar: "تحذير — طاقات متوترة" },
    good:     { fr: "Sain — Capacités équilibrées",    ar: "صحي — طاقات متوازنة" },
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-[100dvh] bg-muted/20 ${isAr ? "rtl" : "ltr"}`} dir={isAr ? "rtl" : "ltr"}>
      <main className="container mx-auto px-4 py-8 space-y-8 max-w-5xl">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/industrial-management" className="hover:text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className={`w-3.5 h-3.5 ${isAr ? "rotate-180" : ""}`} />
            {t("Gestion Industrielle", "التسيير الصناعي")}
          </Link>
          <span>/</span>
          <span className="font-semibold text-foreground">{t("Planification des Capacités", "تخطيط الطاقة الإنتاجية")}</span>
        </nav>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="bg-primary text-primary-foreground rounded-xl p-6 md:p-8 shadow-md relative overflow-hidden">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-primary-foreground/15 rounded-full px-3 py-1 text-xs font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
              {t("Module — Planification des Capacités", "وحدة — تخطيط الطاقة الإنتاجية")}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">
              {t("Planification des Capacités", "تخطيط الطاقة الإنتاجية")}
            </h1>
            <p className="text-primary-foreground/80 max-w-2xl text-sm leading-relaxed">
              {t(
                "Évaluez la charge de chaque centre de travail face à sa capacité disponible — identifiez les goulots d'étranglement, les écarts de capacité et obtenez des recommandations managériales ciblées.",
                "قيّم حمل كل مركز عمل مقارنةً بطاقته المتاحة — حدّد الاختناقات وفجوات الطاقة واحصل على توصيات إدارية مستهدفة."
              )}
            </p>
          </div>
          <div className="absolute -right-16 -bottom-16 opacity-10 pointer-events-none">
            <Gauge className="w-64 h-64" />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            FORM PHASE
        ════════════════════════════════════════════════════════════════════ */}
        {phase === "form" && (
          <div className="space-y-6">

            {/* ── General parameters ───────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gauge className="w-5 h-5 text-primary" />
                  {t("Paramètres généraux", "المعلمات العامة")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Problem name */}
                  <div className="md:col-span-1 space-y-1.5">
                    <Label className="text-xs font-semibold">{t("Nom du problème", "اسم المسألة")}</Label>
                    <Input
                      value={problemName}
                      onChange={e => setProblemName(e.target.value)}
                      placeholder={t("ex. Capacité Atelier — T3 2026", "مثال: طاقة الورشة — الربع الثالث 2026")}
                    />
                  </div>
                  {/* Period type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t("Unité de période", "وحدة الفترة")}</Label>
                    <div className="flex rounded-md overflow-hidden border border-border h-9">
                      {(["semaines", "mois"] as PeriodType[]).map(pt => (
                        <button
                          key={pt}
                          onClick={() => setPeriodType(pt)}
                          className={cn(
                            "flex-1 text-sm font-semibold transition-colors px-3",
                            periodType === pt
                              ? "bg-primary text-primary-foreground"
                              : "bg-card text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {pt === "semaines" ? t("Semaines", "أسابيع") : t("Mois", "أشهر")}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Period count */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {t(`Nombre de périodes (${periodCount})`, `عدد الفترات (${periodCount})`)}
                    </Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min={2} max={12} step={1}
                        value={periodCount}
                        onChange={e => handlePeriodCountChange(parseInt(e.target.value))}
                        className="flex-1 accent-primary"
                      />
                      <span className="text-sm font-bold w-6 text-center">{periodCount}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{periodLabels.join(" · ")}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Sector template ──────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Factory className="w-5 h-5 text-primary" />
                  {t("Secteur d'activité (modèle de départ)", "قطاع النشاط (نموذج أولي)")}
                </CardTitle>
                <CardDescription>
                  {t("Chargez un exemple pré-rempli pour votre secteur.", "حمّل مثالاً مُعبَّأ مسبقاً لقطاعك.")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {SECTORS.map(s => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.id}
                        onClick={() => loadTemplate(s.id)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all",
                          sector === s.id
                            ? "bg-primary text-primary-foreground border-primary shadow"
                            : "bg-card border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {isAr ? s.nameAr : s.nameFr}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* ── Work centers ─────────────────────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">{t("Centres de travail", "مراكز العمل")}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(
                      "Saisissez la capacité disponible et la charge demandée par période pour chaque centre.",
                      "أدخل الطاقة المتاحة والحمل المطلوب لكل فترة لكل مركز."
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addCenter} className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  {t("Ajouter un centre", "إضافة مركز")}
                </Button>
              </div>

              {centers.map((center, ci) => {
                const hasNoCapacity = center.capacities.every(v => !v || parseFloat(v) <= 0);
                return (
                  <Card key={center.id} className="border-primary/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                            {ci + 1}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              {t("Centre de travail", "مركز العمل")}
                            </p>
                            <p className="text-sm font-bold text-foreground">
                              {center.name || t("Sans nom", "بدون اسم")}
                            </p>
                          </div>
                        </div>
                        {centers.length > 1 && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => removeCenter(center.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Center name */}
                      <div className="max-w-xs space-y-1">
                        <Label className="text-xs font-semibold">{t("Nom du centre", "اسم المركز")}</Label>
                        <Input
                          value={center.name}
                          onChange={e => updateCenterName(center.id, e.target.value)}
                          placeholder={t("ex. Atelier Usinage", "مثال: ورشة التشغيل الآلي")}
                        />
                      </div>

                      {/* Per-period grid */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">
                          {t("Capacité disponible et Charge demandée par période", "الطاقة المتاحة والحمل المطلوب حسب الفترة")}
                        </Label>
                        {hasNoCapacity && center.name && (
                          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                            <span>{isAr
                              ? `المركز "${center.name}" لا يحتوي على طاقة متاحة. أدخل قيمة أكبر من 0.`
                              : `Le centre "${center.name}" n'a aucune capacité saisie. Entrez au moins une valeur > 0.`
                            }</span>
                          </div>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr>
                                <th className="text-start px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/40 border border-border w-36">
                                  {t("Indicateur", "المؤشر")}
                                </th>
                                {periodLabels.map(pl => (
                                  <th key={pl} className="text-center font-semibold text-xs text-muted-foreground px-2 py-1.5 bg-muted/40 border border-border min-w-[70px]">
                                    {pl}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {/* Capacity row */}
                              <tr className="bg-blue-50/50">
                                <td className="px-2 py-1 border border-border text-xs font-semibold text-blue-700">
                                  {t("Capacité dispo.", "الطاقة المتاحة")}
                                </td>
                                {center.capacities.map((v, pi) => (
                                  <td key={pi} className="border border-border p-0">
                                    <input
                                      type="number" min={0} step={1}
                                      value={v}
                                      onChange={e => updateCapacity(center.id, pi, e.target.value)}
                                      placeholder="—"
                                      className="w-full h-8 text-center text-xs bg-transparent outline-none px-1 focus:bg-blue-50 focus:ring-1 focus:ring-primary/40 rounded"
                                    />
                                  </td>
                                ))}
                              </tr>
                              {/* Load row */}
                              <tr className="bg-amber-50/50">
                                <td className="px-2 py-1 border border-border text-xs font-semibold text-amber-700">
                                  {t("Charge demandée", "الحمل المطلوب")}
                                </td>
                                {center.loads.map((v, pi) => (
                                  <td key={pi} className="border border-border p-0">
                                    <input
                                      type="number" min={0} step={1}
                                      value={v}
                                      onChange={e => updateLoad(center.id, pi, e.target.value)}
                                      placeholder="—"
                                      className="w-full h-8 text-center text-xs bg-transparent outline-none px-1 focus:bg-amber-50 focus:ring-1 focus:ring-primary/40 rounded"
                                    />
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Global validation errors */}
              {validationErrors.filter(e => e.type === "empty" || e.type === "missing_name").map((err, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>{isAr ? err.msgAr : err.msgFr}</span>
                </div>
              ))}
            </div>

            {/* ── Compute button ───────────────────────────────────────────── */}
            <div className="flex justify-end">
              <Button
                onClick={handleCompute}
                disabled={!canCompute}
                size="lg"
                className="gap-2 px-8"
              >
                <Calculator className="w-5 h-5" />
                {t("Analyser les capacités", "تحليل الطاقات")}
              </Button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            RESULTS PHASE
        ════════════════════════════════════════════════════════════════════ */}
        {phase === "results" && results && (
          <div ref={resultRef} className="space-y-6">

            {/* Back + action bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <Button variant="outline" size="sm" onClick={() => setPhase("form")} className="gap-1.5">
                <ArrowLeft className={`w-4 h-4 ${isAr ? "rotate-180" : ""}`} />
                {t("Modifier les données", "تعديل البيانات")}
              </Button>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || saved} className="gap-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Save className="w-4 h-4" />}
                  {saved ? t("Enregistré !", "تم الحفظ!") : t("Enregistrer dans le registre", "حفظ في السجل")}
                </Button>
                <Button size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5">
                  {exporting ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">{exportProgress}</span></> : <><FileText className="w-4 h-4" />{t("Exporter PDF", "تصدير PDF")}</>}
                </Button>
              </div>
            </div>

            {/* ── Summary KPI cards ─────────────────────────────────────────── */}
            <section>
              <h2 className="text-lg font-bold mb-3">
                {t("Résultats — Planification des Capacités", "النتائج — تخطيط الطاقة الإنتاجية")}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: t("Centres analysés", "مراكز محللة"), value: String(results.centers.length), cfg: "text-primary bg-primary/5 border-primary/20" },
                  {
                    label: t("Goulots d'étranglement", "اختناقات"),
                    value: String(results.bottleneckCenterCount),
                    cfg: results.bottleneckCenterCount > 0 ? "text-red-700 bg-red-50 border-red-200" : "text-green-700 bg-green-50 border-green-200",
                  },
                  {
                    label: t("Utilisation globale", "الاستخدام الإجمالي"),
                    value: fmtRate(results.overallUtilization),
                    cfg: results.overallUtilization > 100 ? "text-red-700 bg-red-50 border-red-200" : results.overallUtilization > 85 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-green-700 bg-green-50 border-green-200",
                  },
                  {
                    label: isAr ? overallStatusLabel[results.overallStatus].ar : overallStatusLabel[results.overallStatus].fr,
                    value: results.overallStatus === "critical" ? "⚠" : results.overallStatus === "warning" ? "~" : "✓",
                    cfg: results.overallStatus === "critical" ? "text-red-700 bg-red-50 border-red-200" : results.overallStatus === "warning" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-green-700 bg-green-50 border-green-200",
                  },
                ].map(s => (
                  <div key={s.label} className={cn("rounded-xl border p-4 text-center", s.cfg)}>
                    <div className="text-2xl font-black">{s.value}</div>
                    <div className="text-xs mt-1 opacity-75 leading-snug">{s.label}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Results table per centre ──────────────────────────────────── */}
            <section className="space-y-5">
              <h2 className="text-lg font-bold">{t("Tableaux de Charge par Centre", "جداول التحميل لكل مركز")}</h2>
              {results.centers.map(center => {
                const cfg = statusCfg[center.status];
                const sl  = statusLabel(center.status);
                return (
                  <Card key={center.id} className={cn("border", cfg.border)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", cfg.bg)}>
                            <Gauge className={cn("w-5 h-5", cfg.text)} />
                          </div>
                          <div>
                            <h3 className="font-bold text-base">{center.name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t("Utilisation moy.", "متوسط الاستخدام")} : <span className={cn("font-bold", cfg.text)}>{fmtRate(center.avgUtilizationRate)}</span>
                              {" · "}
                              {t("Pic", "ذروة")} : <span className={cn("font-bold", cfg.text)}>{fmtRate(center.maxUtilizationRate)}</span>
                            </p>
                          </div>
                        </div>
                        <span className={cn("text-xs font-bold px-3 py-1 rounded-full", cfg.badge)}>
                          {isAr ? sl.ar : sl.fr}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-primary text-primary-foreground">
                              <th className="px-3 py-2 text-start text-xs font-semibold rounded-tl-lg min-w-[160px]">
                                {t("Indicateur", "المؤشر")}
                              </th>
                              {results.periodLabels.map((pl, i) => (
                                <th key={pl} className={cn("px-3 py-2 text-center text-xs font-semibold min-w-[70px]", i === results.periodLabels.length - 1 && "rounded-tr-lg")}>
                                  {pl}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {/* Capacity row */}
                            <tr className="bg-blue-50/40 border-b border-border">
                              <td className="px-3 py-2 text-xs font-semibold text-blue-700 border-r border-border">
                                {t("Capacité disponible", "الطاقة المتاحة")}
                              </td>
                              {center.periods.map((p, pi) => (
                                <td key={pi} className="px-3 py-2 text-center text-sm border-r border-border last:border-r-0">
                                  {p.capacity > 0 ? fmtNum(p.capacity) : <span className="text-muted-foreground/40">—</span>}
                                </td>
                              ))}
                            </tr>
                            {/* Load row */}
                            <tr className="bg-amber-50/40 border-b border-border">
                              <td className="px-3 py-2 text-xs font-semibold text-amber-700 border-r border-border">
                                {t("Charge demandée", "الحمل المطلوب")}
                              </td>
                              {center.periods.map((p, pi) => (
                                <td key={pi} className="px-3 py-2 text-center text-sm border-r border-border last:border-r-0">
                                  {p.load > 0 ? fmtNum(p.load) : <span className="text-muted-foreground/40">—</span>}
                                </td>
                              ))}
                            </tr>
                            {/* Utilization rate row */}
                            <tr className="border-b border-border">
                              <td className="px-3 py-2 text-xs font-semibold text-foreground border-r border-border">
                                {t("Taux de charge", "معدل التحميل")}
                              </td>
                              {center.periods.map((p, pi) => (
                                <td key={pi} className={cn(
                                  "px-3 py-2 text-center text-sm font-bold border-r border-border last:border-r-0",
                                  p.isBottleneck ? "bg-red-100 text-red-700" : p.utilizationRate > 85 ? "bg-amber-100 text-amber-700" : "text-primary"
                                )}>
                                  {p.capacity === 0 && p.load === 0
                                    ? <span className="text-muted-foreground/40">—</span>
                                    : fmtRate(p.utilizationRate)}
                                </td>
                              ))}
                            </tr>
                            {/* Gap row */}
                            <tr>
                              <td className="px-3 py-2 text-xs font-semibold text-foreground border-r border-border">
                                {t("Écart de capacité", "فجوة الطاقة")}
                              </td>
                              {center.periods.map((p, pi) => (
                                <td key={pi} className={cn(
                                  "px-3 py-2 text-center text-sm font-bold border-r border-border last:border-r-0",
                                  p.capacityGap < 0 ? "bg-red-50 text-red-700" : p.capacityGap === 0 ? "text-muted-foreground" : "text-green-700"
                                )}>
                                  {p.capacity === 0 && p.load === 0
                                    ? <span className="text-muted-foreground/40">—</span>
                                    : (p.capacityGap >= 0 ? "+" : "") + fmtNum(p.capacityGap)}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Bottleneck alert */}
                      {center.isBottleneck && (
                        <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                          <span>
                            {isAr
                              ? `اختناق مكتشف خلال ${center.bottleneckPeriods.length} فترة: ${center.bottleneckPeriods.map(i => results.periodLabels[i]).join("، ")}.`
                              : `Goulot détecté sur ${center.bottleneckPeriods.length} période(s) : ${center.bottleneckPeriods.map(i => results.periodLabels[i]).join(", ")}.`
                            }
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            {/* ── تحليل الوضع ────────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="w-5 h-5 text-primary" />
                  {t("Analyse de la Situation", "تحليل الوضع")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysisLines.map((line, i) => (
                  <div key={i} className="p-3 rounded-lg bg-primary/5 border border-primary/15 text-sm text-foreground leading-relaxed">
                    {isAr ? line.ar : line.fr}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* ── التوصيات الإدارية ─────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  {t("Recommandations Managériales", "التوصيات الإدارية")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recommendations.map((reco, i) => (
                  <div key={i} className={cn(
                    "rounded-xl border p-4",
                    i % 4 === 0 && "border-l-4 border-l-green-500 bg-green-50/50",
                    i % 4 === 1 && "border-l-4 border-l-amber-500 bg-amber-50/50",
                    i % 4 === 2 && "border-l-4 border-l-primary bg-primary/5",
                    i % 4 === 3 && "border-l-4 border-l-blue-500 bg-blue-50/50",
                  )}>
                    <div className="font-bold text-sm mb-1">{reco.icon} {isAr ? reco.ar : reco.fr}</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{isAr ? reco.descAr : reco.descFr}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* ── Bottom action bar ─────────────────────────────────────────── */}
            <div className="flex justify-end gap-3 pb-4 flex-wrap">
              <Button variant="outline" onClick={handleSave} disabled={saving || saved} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Save className="w-4 h-4" />}
                {saved ? t("Enregistré !", "تم الحفظ!") : t("Enregistrer dans le registre", "حفظ في السجل")}
              </Button>
              <Button onClick={handleExport} disabled={exporting} className="gap-2">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {exporting ? (exportProgress || t("Génération…", "جارٍ الإنشاء…")) : t("Exporter PDF", "تصدير PDF")}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
