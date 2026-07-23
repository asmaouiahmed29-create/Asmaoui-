import { useState, useRef } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarRange, Plus, Trash2, Calculator, Save, FileText,
  CheckCircle2, Loader2, AlertTriangle, ArrowLeft, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeSchedule, validateTasks, generateSchedulingAnalysis, generateSchedulingRecommendations,
  type SchedulingRule, type TaskInput, type SchedulingResults,
} from "@/lib/workshopSchedulingAlgorithm";
import { generateWorkshopSchedulingPDF } from "@/lib/generateWorkshopSchedulingPDF";

// ── ID helper ─────────────────────────────────────────────────────────────────
let _uid = 0;
function uid() { return `t${++_uid}`; }

// ── Task draft (string fields for controlled inputs) ──────────────────────────
interface TaskDraft {
  id: string;
  name: string;
  duration: string;
  dueDate: string;
  arrivalDate: string;
}

function makeTask(): TaskDraft {
  return { id: uid(), name: "", duration: "", dueDate: "", arrivalDate: "0" };
}

// ── Industry templates per rule ────────────────────────────────────────────────
function buildTemplate(rule: SchedulingRule): TaskDraft[] {
  if (rule === "SPT") {
    return [
      { id: uid(), name: "Découpe tôle / قطع الصفائح",     duration: "3",  dueDate: "10", arrivalDate: "0" },
      { id: uid(), name: "Soudure / لحام",                  duration: "7",  dueDate: "20", arrivalDate: "0" },
      { id: uid(), name: "Peinture / طلاء",                 duration: "2",  dueDate: "8",  arrivalDate: "0" },
      { id: uid(), name: "Assemblage / تجميع",              duration: "5",  dueDate: "18", arrivalDate: "0" },
      { id: uid(), name: "Contrôle qualité / مراقبة الجودة",duration: "1",  dueDate: "25", arrivalDate: "0" },
    ];
  }
  if (rule === "EDD") {
    return [
      { id: uid(), name: "Commande A / طلب أ", duration: "4", dueDate: "6",  arrivalDate: "0" },
      { id: uid(), name: "Commande B / طلب ب", duration: "6", dueDate: "14", arrivalDate: "0" },
      { id: uid(), name: "Commande C / طلب ج", duration: "2", dueDate: "9",  arrivalDate: "0" },
      { id: uid(), name: "Commande D / طلب د", duration: "8", dueDate: "20", arrivalDate: "0" },
    ];
  }
  // FIFO
  return [
    { id: uid(), name: "Job 1 / مهمة ١", duration: "5", dueDate: "12", arrivalDate: "0"  },
    { id: uid(), name: "Job 2 / مهمة ٢", duration: "3", dueDate: "18", arrivalDate: "2"  },
    { id: uid(), name: "Job 3 / مهمة ٣", duration: "6", dueDate: "22", arrivalDate: "4"  },
    { id: uid(), name: "Job 4 / مهمة ٤", duration: "2", dueDate: "10", arrivalDate: "7"  },
  ];
}

// ── Parse draft → algorithm input ─────────────────────────────────────────────
function parseTasks(drafts: TaskDraft[]): TaskInput[] {
  return drafts.map(d => ({
    id: d.id,
    name: d.name.trim() || "?",
    duration: Math.max(0, parseFloat(d.duration) || 0),
    dueDate: Math.max(0, parseFloat(d.dueDate) || 0),
    arrivalDate: Math.max(0, parseFloat(d.arrivalDate) || 0),
  }));
}

// ── Number formatter ──────────────────────────────────────────────────────────
function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

// ── Rule labels ───────────────────────────────────────────────────────────────
const RULES: Array<{ value: SchedulingRule; fr: string; ar: string; descFr: string; descAr: string }> = [
  {
    value: "SPT",
    fr: "SPT — Plus Court Traitement",
    ar: "SPT — أقصر وقت معالجة",
    descFr: "Traite en premier la tâche avec la durée la plus courte. Minimise le temps de fin moyen.",
    descAr: "تُعالَج أولاً المهمة ذات أقصر مدة معالجة. تُقلّل متوسط وقت الإنهاء.",
  },
  {
    value: "EDD",
    fr: "EDD — Date d'Échéance la Plus Proche",
    ar: "EDD — أقرب تاريخ استحقاق",
    descFr: "Traite en premier la tâche dont l'échéance est la plus proche. Minimise le retard maximal.",
    descAr: "تُعالَج أولاً المهمة ذات أقرب أجل. تُقلّل التأخير الأقصى.",
  },
  {
    value: "FIFO",
    fr: "FIFO — Premier Arrivé Premier Servi",
    ar: "FIFO — الأول وصولاً الأول خدمةً",
    descFr: "Traite les tâches dans l'ordre de leur arrivée. Requiert une date d'arrivée par tâche.",
    descAr: "تُعالَج المهام بترتيب وصولها. يتطلب تاريخ وصول لكل مهمة.",
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function WorkshopScheduling() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  // ── Form state ───────────────────────────────────────────────────────────────
  const [phase, setPhase]             = useState<"form" | "results">("form");
  const [problemName, setProblemName] = useState("");
  const [rule, setRule]               = useState<SchedulingRule>("SPT");
  const [tasks, setTasks]             = useState<TaskDraft[]>([makeTask(), makeTask(), makeTask()]);

  // ── Result state ─────────────────────────────────────────────────────────────
  const [results, setResults]         = useState<SchedulingResults | null>(null);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  const resultRef = useRef<HTMLDivElement>(null);

  // ── Task mutations ────────────────────────────────────────────────────────────
  function addTask() {
    setTasks(prev => [...prev, makeTask()]);
  }
  function removeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
  }
  function updateTask(id: string, field: keyof Omit<TaskDraft, "id">, val: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: val } : t));
  }

  // ── Rule change: keep tasks, just switch rule ─────────────────────────────────
  function handleRuleChange(r: SchedulingRule) {
    setRule(r);
    setPhase("form");
    setResults(null);
  }

  // ── Template load ─────────────────────────────────────────────────────────────
  function loadTemplate() {
    setTasks(buildTemplate(rule));
  }

  // ── Compute ───────────────────────────────────────────────────────────────────
  function handleCompute() {
    const parsed = parseTasks(tasks);
    const errs = validateTasks(parsed, rule);
    if (errs.length > 0) return; // guard — UI shows warnings
    const r = computeSchedule(parsed, rule);
    setResults(r);
    setPhase("results");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!results) return;
    setSaving(true);
    try {
      await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "industrial-workshop-scheduling",
          name: problemName || t("Ordonnancement sans titre", "جدولة بدون عنوان"),
          content: { rule, tasks: parseTasks(tasks), results },
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
      await generateWorkshopSchedulingPDF({
        problemName: problemName || t("Ordonnancement sans titre", "جدولة بدون عنوان"),
        rule,
        results,
        language: language as "fr" | "ar",
        analysisLines: generateSchedulingAnalysis(results),
        recommendations: generateSchedulingRecommendations(results),
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
  const parsed = parseTasks(tasks);
  const validationErrors = validateTasks(parsed, rule);
  const canCompute = validationErrors.length === 0 && tasks.length > 0;
  const analysisLines     = results ? generateSchedulingAnalysis(results) : [];
  const recommendations   = results ? generateSchedulingRecommendations(results) : [];
  const delayedCount      = results ? results.sequence.filter(t => t.delay > 0).length : 0;

  const selectedRuleMeta = RULES.find(r => r.value === rule)!;

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
          <span className="font-semibold text-foreground">{t("Ordonnancement des Ateliers", "جدولة الورشات")}</span>
        </nav>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="bg-primary text-primary-foreground rounded-xl p-6 md:p-8 shadow-md relative overflow-hidden">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-primary-foreground/15 rounded-full px-3 py-1 text-xs font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
              {t("Module — Ordonnancement des Ateliers", "وحدة — جدولة الورشات")}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">
              {t("Ordonnancement des Ateliers", "جدولة الورشات")}
            </h1>
            <p className="text-primary-foreground/80 max-w-2xl text-sm leading-relaxed">
              {t(
                "Séquencez vos tâches sur une machine selon les règles SPT, EDD ou FIFO. Calculez les temps de fin, retards et obtenez des recommandations managériales basées sur vos données réelles.",
                "رتّب مهامك على آلة واحدة وفق قواعد SPT أو EDD أو FIFO. احسب أوقات الإنهاء والتأخيرات واحصل على توصيات إدارية مبنية على بياناتك الفعلية.",
              )}
            </p>
          </div>
          <div className="absolute -right-16 -bottom-16 opacity-10 pointer-events-none">
            <CalendarRange className="w-64 h-64" />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            FORM PHASE
        ════════════════════════════════════════════════════════════════════ */}
        {phase === "form" && (
          <div className="space-y-6">

            {/* ── General info ─────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarRange className="w-5 h-5 text-primary" />
                  {t("Paramètres généraux", "المعلمات العامة")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Problem name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("Nom du problème", "اسم المسألة")}</Label>
                  <Input
                    value={problemName}
                    onChange={e => setProblemName(e.target.value)}
                    placeholder={t("ex. Atelier mécanique — Juillet 2026", "مثال: الورشة الميكانيكية — يوليو 2026")}
                    className="max-w-lg"
                  />
                </div>

                {/* Rule selection */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">{t("Règle de priorité", "قاعدة الأولوية")}</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {RULES.map(r => (
                      <button
                        key={r.value}
                        onClick={() => handleRuleChange(r.value)}
                        className={cn(
                          "relative flex flex-col items-start gap-1 p-4 rounded-xl border text-left transition-all duration-200",
                          rule === r.value
                            ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                            : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                        )}
                      >
                        {/* Radio dot */}
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center mb-0.5 transition-colors",
                          rule === r.value ? "border-primary" : "border-muted-foreground/40"
                        )}>
                          {rule === r.value && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className={cn(
                          "text-sm font-bold leading-tight",
                          rule === r.value ? "text-primary" : "text-foreground"
                        )}>
                          {isAr ? r.ar : r.fr}
                        </span>
                        <span className="text-xs text-muted-foreground leading-relaxed">
                          {isAr ? r.descAr : r.descFr}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Tasks table ──────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarRange className="w-5 h-5 text-primary" />
                      {t("Tâches à ordonnancer", "المهام المراد جدولتها")}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {rule === "FIFO"
                        ? t("Saisissez le nom, la durée, l'échéance et la date d'arrivée de chaque tâche.", "أدخل اسم كل مهمة ومدتها وأجلها وتاريخ وصولها.")
                        : t("Saisissez le nom, la durée de traitement et la date d'échéance de chaque tâche.", "أدخل اسم كل مهمة ومدة معالجتها وتاريخ استحقاقها.")}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={loadTemplate} className="gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" />
                      {t("Exemple", "مثال")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={addTask} className="gap-1.5">
                      <Plus className="w-4 h-4" />
                      {t("Ajouter une tâche", "إضافة مهمة")}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="text-start px-3 py-2 text-xs font-semibold text-muted-foreground border border-border rounded-tl-md w-8">#</th>
                        <th className="text-start px-3 py-2 text-xs font-semibold text-muted-foreground border border-border">
                          {t("Nom de la tâche", "اسم المهمة")}
                        </th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground border border-border">
                          {t("Durée de traitement", "مدة المعالجة")}
                        </th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground border border-border">
                          {t("Date d'échéance", "تاريخ الاستحقاق")}
                        </th>
                        {rule === "FIFO" && (
                          <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground border border-border">
                            {t("Date d'arrivée", "تاريخ الوصول")}
                          </th>
                        )}
                        <th className="border border-border rounded-tr-md w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task, i) => {
                        const parsed = {
                          ...task,
                          durationN: parseFloat(task.duration) || 0,
                        };
                        const hasZeroDuration = task.duration !== "" && parsed.durationN <= 0;
                        return (
                          <tr key={task.id} className="group hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-2 border border-border text-center">
                              <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold mx-auto">
                                {i + 1}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 border border-border">
                              <Input
                                value={task.name}
                                onChange={e => updateTask(task.id, "name", e.target.value)}
                                placeholder={t(`Tâche ${i + 1}`, `مهمة ${i + 1}`)}
                                className="h-8 text-sm border-0 shadow-none focus-visible:ring-1 focus-visible:ring-primary/40"
                              />
                            </td>
                            <td className="px-2 py-1.5 border border-border">
                              <Input
                                type="number"
                                min={0.1}
                                step={0.5}
                                value={task.duration}
                                onChange={e => updateTask(task.id, "duration", e.target.value)}
                                placeholder="—"
                                className={cn(
                                  "h-8 text-sm text-center border-0 shadow-none focus-visible:ring-1 focus-visible:ring-primary/40",
                                  hasZeroDuration && "bg-red-50 text-red-600 focus-visible:ring-red-400"
                                )}
                              />
                            </td>
                            <td className="px-2 py-1.5 border border-border">
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={task.dueDate}
                                onChange={e => updateTask(task.id, "dueDate", e.target.value)}
                                placeholder="—"
                                className="h-8 text-sm text-center border-0 shadow-none focus-visible:ring-1 focus-visible:ring-primary/40"
                              />
                            </td>
                            {rule === "FIFO" && (
                              <td className="px-2 py-1.5 border border-border">
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={task.arrivalDate}
                                  onChange={e => updateTask(task.id, "arrivalDate", e.target.value)}
                                  placeholder="0"
                                  className="h-8 text-sm text-center border-0 shadow-none focus-visible:ring-1 focus-visible:ring-primary/40"
                                />
                              </td>
                            )}
                            <td className="px-2 py-1.5 border border-border text-center">
                              {tasks.length > 1 && (
                                <button
                                  onClick={() => removeTask(task.id)}
                                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-1 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Validation warnings */}
                {validationErrors.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {validationErrors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                        <span>{isAr ? err.msgAr : err.msgFr}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Compute button ───────────────────────────────────────────── */}
            <div className="flex justify-end">
              <Button
                onClick={handleCompute}
                disabled={!canCompute}
                size="lg"
                className="gap-2 px-8"
              >
                <Calculator className="w-5 h-5" />
                {t("Calculer l'ordonnancement", "احسب الجدولة")}
              </Button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            RESULTS PHASE
        ════════════════════════════════════════════════════════════════════ */}
        {phase === "results" && results && (
          <div ref={resultRef} className="space-y-6">

            {/* Back to form */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPhase("form")}
                className="gap-1.5"
              >
                <ArrowLeft className={`w-4 h-4 ${isAr ? "rotate-180" : ""}`} />
                {t("Modifier les données", "تعديل البيانات")}
              </Button>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || saved}
                  className="gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saved ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saved
                    ? t("Enregistré !", "تم الحفظ!")
                    : t("Enregistrer dans le registre", "حفظ في السجل")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleExport}
                  disabled={exporting}
                  className="gap-1.5"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">{exportProgress}</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      {t("Exporter PDF", "تصدير PDF")}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* ── Summary KPI cards ─────────────────────────────────────────── */}
            <section>
              <h2 className="text-lg font-bold mb-3">
                {t("Résultats — ", "النتائج — ")}
                <span className="text-primary">
                  {isAr ? selectedRuleMeta.ar : selectedRuleMeta.fr}
                </span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: t("Tâches planifiées", "مهام مجدولة"),
                    value: String(results.sequence.length),
                    color: "text-primary",
                    bg: "bg-primary/5 border-primary/20",
                  },
                  {
                    label: t("Tâches en retard", "مهام متأخرة"),
                    value: String(delayedCount),
                    color: delayedCount > 0 ? "text-red-700" : "text-green-700",
                    bg: delayedCount > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200",
                  },
                  {
                    label: t("Temps de fin moyen", "متوسط وقت الإنهاء"),
                    value: fmt(results.avgCompletionTime),
                    color: "text-primary",
                    bg: "bg-primary/5 border-primary/20",
                  },
                  {
                    label: t("Retard maximal", "التأخير الأقصى"),
                    value: fmt(results.maxDelay),
                    color: results.maxDelay > 0 ? "text-amber-700" : "text-green-700",
                    bg: results.maxDelay > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200",
                  },
                ].map(s => (
                  <div key={s.label} className={cn("rounded-xl border p-4 text-center", s.bg)}>
                    <div className={cn("text-2xl font-black", s.color)}>{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-1 leading-snug">{s.label}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Results table ─────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarRange className="w-5 h-5 text-primary" />
                  {t("Séquence d'ordonnancement détaillée", "تسلسل الجدولة التفصيلي")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-primary text-primary-foreground">
                        <th className="px-3 py-2.5 text-center font-semibold text-xs rounded-tl-lg">{t("Ordre", "الترتيب")}</th>
                        <th className="px-3 py-2.5 text-start font-semibold text-xs">{t("Tâche", "المهمة")}</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-xs">{t("Durée", "المدة")}</th>
                        {results.rule === "FIFO" && (
                          <th className="px-3 py-2.5 text-center font-semibold text-xs">{t("Arrivée", "الوصول")}</th>
                        )}
                        <th className="px-3 py-2.5 text-center font-semibold text-xs">{t("Échéance", "الأجل")}</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-xs">{t("Début", "البداية")}</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-xs">{t("Temps de fin", "وقت الإنهاء")}</th>
                        <th className={`px-3 py-2.5 text-center font-semibold text-xs rounded-tr-lg`}>{t("Retard", "التأخير")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.sequence.map((task, i) => (
                        <tr
                          key={task.taskId}
                          className={cn(
                            "border-b border-border transition-colors",
                            task.delay > 0
                              ? "bg-red-50 hover:bg-red-100"
                              : i % 2 === 0
                              ? "bg-background hover:bg-muted/30"
                              : "bg-muted/20 hover:bg-muted/40"
                          )}
                        >
                          <td className="px-3 py-2.5 text-center">
                            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-black mx-auto">
                              {task.rank}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-foreground">{task.name}</td>
                          <td className="px-3 py-2.5 text-center text-muted-foreground">{task.duration}</td>
                          {results.rule === "FIFO" && (
                            <td className="px-3 py-2.5 text-center text-muted-foreground">{task.arrivalDate}</td>
                          )}
                          <td className="px-3 py-2.5 text-center text-muted-foreground">{task.dueDate}</td>
                          <td className="px-3 py-2.5 text-center text-muted-foreground">{fmt(task.startTime)}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-primary">{fmt(task.completionTime)}</td>
                          <td className="px-3 py-2.5 text-center">
                            {task.delay > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                                +{fmt(task.delay)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                {t("Dans les délais", "في الوقت")}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Summary footer */}
                    <tfoot>
                      <tr className="bg-muted/40 border-t-2 border-border font-bold text-sm">
                        <td colSpan={results.rule === "FIFO" ? 6 : 5} className="px-3 py-2.5 text-muted-foreground text-xs">
                          {t("Indicateurs de performance", "مؤشرات الأداء")}
                        </td>
                        <td className="px-3 py-2.5 text-center text-primary font-black">
                          {fmt(results.avgCompletionTime)}
                          <div className="text-[10px] font-normal text-muted-foreground">{t("moy.", "متوسط")}</div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className={cn("font-black", results.avgDelay > 0 ? "text-amber-600" : "text-green-600")}>
                            {fmt(results.avgDelay)}
                          </div>
                          <div className="text-[10px] font-normal text-muted-foreground">{t("moy.", "متوسط")}</div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Metric summary row */}
                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      label: t("Temps de fin moyen", "متوسط وقت الإنهاء"),
                      value: fmt(results.avgCompletionTime),
                      color: "text-primary bg-primary/5 border-primary/20",
                    },
                    {
                      label: t("Retard moyen", "متوسط التأخير"),
                      value: fmt(results.avgDelay),
                      color: results.avgDelay > 0 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-green-700 bg-green-50 border-green-200",
                    },
                    {
                      label: t("Retard maximal", "التأخير الأقصى"),
                      value: fmt(results.maxDelay),
                      color: results.maxDelay > 0 ? "text-red-700 bg-red-50 border-red-200" : "text-green-700 bg-green-50 border-green-200",
                    },
                  ].map(m => (
                    <div key={m.label} className={cn("rounded-lg border px-4 py-3 text-center", m.color)}>
                      <div className="text-xl font-black">{m.value}</div>
                      <div className="text-xs mt-0.5 opacity-75">{m.label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

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
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-primary/5 border border-primary/15 text-sm text-foreground leading-relaxed"
                  >
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
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl border p-4",
                      i % 4 === 0 && "border-l-4 border-l-green-500 bg-green-50/50",
                      i % 4 === 1 && "border-l-4 border-l-amber-500 bg-amber-50/50",
                      i % 4 === 2 && "border-l-4 border-l-primary bg-primary/5",
                      i % 4 === 3 && "border-l-4 border-l-blue-500 bg-blue-50/50",
                    )}
                  >
                    <div className="font-bold text-sm mb-1">
                      {reco.icon} {isAr ? reco.ar : reco.fr}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {isAr ? reco.descAr : reco.descFr}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* ── Bottom action bar ─────────────────────────────────────────── */}
            <div className="flex justify-end gap-3 pb-4 flex-wrap">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={saving || saved}
                className="gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Save className="w-4 h-4" />}
                {saved ? t("Enregistré !", "تم الحفظ!") : t("Enregistrer dans le registre", "حفظ في السجل")}
              </Button>
              <Button onClick={handleExport} disabled={exporting} className="gap-2">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {exporting
                  ? (exportProgress || t("Génération…", "جارٍ الإنشاء…"))
                  : t("Exporter PDF", "تصدير PDF")}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
