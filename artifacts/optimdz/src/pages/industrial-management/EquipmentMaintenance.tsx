import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wrench, Plus, Trash2, Calculator, Save, FileText,
  CheckCircle2, Loader2, AlertTriangle, ArrowLeft,
  Factory, ShoppingBag, Leaf, PencilRuler, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeMaintenance, validateInputs,
  generateMaintenanceAnalysis, generateMaintenanceRecommendations,
  buildTemplate, uid,
  type EquipmentInput, type MaintenanceResults,
} from "@/lib/maintenanceAlgorithm";
import { generateMaintenancePDF } from "@/lib/generateMaintenancePDF";

// ── Sector config ─────────────────────────────────────────────────────────────
type SectorKey = "industrie" | "services" | "agriculture" | "custom";
interface Sector { id: SectorKey; icon: React.ElementType; nameAr: string; nameFr: string; }

const SECTORS: Sector[] = [
  { id: "industrie",   icon: Factory,     nameAr: "الصناعة",  nameFr: "Industrie" },
  { id: "services",    icon: ShoppingBag, nameAr: "الخدمات",  nameFr: "Services" },
  { id: "agriculture", icon: Leaf,        nameAr: "الفلاحة",  nameFr: "Agriculture" },
  { id: "custom",      icon: PencilRuler, nameAr: "مخصص",     nameFr: "Personnalisé" },
];

// ── Status helpers ────────────────────────────────────────────────────────────
function statusCfg(status: string, lang: "fr" | "ar") {
  if (status === "ok")       return { badge: lang === "ar" ? "جيد"    : "Bon",      badgeCls: "bg-green-100 text-green-700",  rowCls: "",            dot: "bg-green-500"  };
  if (status === "warning")  return { badge: lang === "ar" ? "تحذير"  : "Alerte",   badgeCls: "bg-amber-100 text-amber-700",  rowCls: "bg-amber-50", dot: "bg-amber-500"  };
  if (status === "critical") return { badge: lang === "ar" ? "حرج"    : "Critique", badgeCls: "bg-red-100 text-red-700",      rowCls: "bg-red-50",   dot: "bg-red-500"    };
  return                            { badge: lang === "ar" ? "خطأ"   : "Erreur",   badgeCls: "bg-muted text-muted-foreground",rowCls: "bg-muted/40", dot: "bg-muted"     };
}

function dispColor(disp: number | null): string {
  if (disp === null) return "text-muted-foreground";
  if (disp >= 90) return "text-green-700";
  if (disp >= 80) return "text-amber-700";
  return "text-red-700";
}

function fmt1(n: number): string { return n.toFixed(1); }
function fmt2(n: number): string { return n.toFixed(2); }

// ── Error message per key ─────────────────────────────────────────────────────
function errorMsg(key: string | undefined, lang: "fr" | "ar"): string {
  if (key === "zero_pannes")    return lang === "ar" ? "عدد الأعطال = 0 — القسمة على صفر مستحيلة" : "Nombre de pannes = 0 — division impossible";
  if (key === "negative_values") return lang === "ar" ? "قيم سالبة — بيانات غير صالحة"             : "Valeurs négatives — données invalides";
  return                                lang === "ar" ? "بيانات ناقصة"                              : "Données manquantes";
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EquipmentMaintenance() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  // ── Form state ─────────────────────────────────────────────────────────────
  const [phase, setPhase]               = useState<"form" | "results">("form");
  const [problemName, setProblemName]   = useState("");
  const [sector, setSector]             = useState<SectorKey>("industrie");
  const [equipments, setEquipments]     = useState<EquipmentInput[]>(() => buildTemplate("industrie"));

  // ── Result state ───────────────────────────────────────────────────────────
  const [results, setResults]           = useState<MaintenanceResults | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [exporting, setExporting]       = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  const resultRef = useRef<HTMLDivElement>(null);

  // ── Template loader ────────────────────────────────────────────────────────
  function loadTemplate(s: SectorKey) {
    setSector(s);
    setEquipments(buildTemplate(s));
    setResults(null);
    setPhase("form");
  }

  // ── Equipment mutations ────────────────────────────────────────────────────
  const addEquipment = useCallback(() => {
    setEquipments(prev => [...prev, { id: uid(), name: "", tbf: "", pannes: "", ttr: "" }]);
  }, []);

  const removeEquipment = useCallback((id: string) => {
    setEquipments(prev => prev.filter(e => e.id !== id));
  }, []);

  const updateField = useCallback((id: string, field: keyof Omit<EquipmentInput, "id">, val: string) => {
    setEquipments(prev => prev.map(e => e.id === id ? { ...e, [field]: val } : e));
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validationErrors = validateInputs(equipments);
  const canCompute = validationErrors.length === 0;

  // ── Compute ────────────────────────────────────────────────────────────────
  function handleCompute() {
    if (!canCompute) return;
    const r = computeMaintenance(equipments);
    setResults(r);
    setPhase("results");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!results) return;
    setSaving(true);
    try {
      await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "industrial-maintenance",
          name: problemName || t("Maintenance sans titre", "صيانة بدون عنوان"),
          content: { inputs: equipments, results },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  // ── PDF export ─────────────────────────────────────────────────────────────
  async function handleExport() {
    if (!results) return;
    setExporting(true);
    try {
      await generateMaintenancePDF({
        problemName: problemName || t("Maintenance sans titre", "صيانة بدون عنوان"),
        results,
        language: language as "fr" | "ar",
        analysisLines: generateMaintenanceAnalysis(results),
        recommendations: generateMaintenanceRecommendations(results),
        onProgress: (step) => setExportProgress(step),
      });
    } catch (e) { console.error(e); }
    finally { setExporting(false); setExportProgress(""); }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const analysisLines   = results ? generateMaintenanceAnalysis(results) : [];
  const recommendations = results ? generateMaintenanceRecommendations(results) : [];

  // ── Render ─────────────────────────────────────────────────────────────────
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
          <span className="font-semibold text-foreground">{t("Maintenance des Équipements", "صيانة المعدات")}</span>
        </nav>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="bg-primary text-primary-foreground rounded-xl p-6 md:p-8 shadow-md relative overflow-hidden">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-primary-foreground/15 rounded-full px-3 py-1 text-xs font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
              {t("Module — Maintenance des Équipements", "وحدة — صيانة المعدات")}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">
              {t("Maintenance des Équipements", "صيانة المعدات")}
            </h1>
            <p className="text-primary-foreground/80 max-w-2xl text-sm leading-relaxed">
              {t(
                "Calculez le MTBF, le MTTR et la disponibilité de chaque équipement. Identifiez les équipements critiques et obtenez des recommandations managériales ciblées pour réduire les arrêts imprévus.",
                "احسب MTBF وMTTR ومعدل التوافرية لكل معدة. حدّد المعدات الحرجة واحصل على توصيات إدارية مستهدفة للحد من التوقفات غير المخططة."
              )}
            </p>
          </div>
          <div className="absolute -right-16 -bottom-16 opacity-10 pointer-events-none">
            <Wrench className="w-64 h-64" />
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
                  <Wrench className="w-5 h-5 text-primary" />
                  {t("Paramètres généraux", "المعلمات العامة")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-w-sm space-y-1.5">
                  <Label className="text-xs font-semibold">{t("Nom de la session", "اسم المسألة")}</Label>
                  <Input
                    value={problemName}
                    onChange={e => setProblemName(e.target.value)}
                    placeholder={t("ex. Maintenance — Usine Nord, Juillet 2026", "مثال: صيانة — مصنع الشمال، يوليو 2026")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── Sector templates ──────────────────────────────────────────── */}
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

            {/* ── Equipment table ───────────────────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">{t("Tableau des équipements", "جدول المعدات")}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(
                      "Saisissez les données cumulées de chaque équipement sur la période d'analyse.",
                      "أدخل البيانات التراكمية لكل معدة خلال فترة التحليل."
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addEquipment} className="gap-1.5 shrink-0">
                  <Plus className="w-4 h-4" />
                  {t("Ajouter", "إضافة")}
                </Button>
              </div>

              {/* Legend */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-600" />
                <span>
                  {t(
                    "TBF = Temps de bon fonctionnement cumulé (h) · Pannes = nombre total d'arrêts · TTR = Temps total de réparation cumulé (h). Le nombre de pannes doit être > 0 pour calculer les indicateurs.",
                    "TBF = زمن التشغيل التراكمي (س) · الأعطال = إجمالي عدد التوقفات · TTR = زمن الإصلاح التراكمي (س). يجب أن يكون عدد الأعطال > 0 لحساب المؤشرات."
                  )}
                </span>
              </div>

              <Card className="border-primary/20">
                <CardContent className="pt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-primary text-primary-foreground">
                          <th className="px-3 py-2.5 text-start text-xs font-semibold rounded-tl-lg w-7">#</th>
                          <th className="px-3 py-2.5 text-start text-xs font-semibold min-w-[160px]">
                            {t("Nom de l'équipement", "اسم المعدة")}
                          </th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold min-w-[120px]">
                            {t("TBF cumulé (h)", "TBF التراكمي (س)")}
                          </th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold min-w-[100px]">
                            {t("Nombre de pannes", "عدد الأعطال")}
                          </th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold min-w-[120px]">
                            {t("TTR cumulé (h)", "TTR التراكمي (س)")}
                          </th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold rounded-tr-lg w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {equipments.map((eq, i) => {
                          const pannesVal  = parseFloat(eq.pannes);
                          const isPannesZero = eq.pannes !== "" && !isNaN(pannesVal) && pannesVal === 0;
                          const isPannesNeg  = eq.pannes !== "" && !isNaN(pannesVal) && pannesVal < 0;
                          return (
                            <tr
                              key={eq.id}
                              className={cn(
                                "border-b border-border transition-colors",
                                i % 2 === 0 ? "bg-card" : "bg-muted/20",
                                isPannesZero && "bg-amber-50",
                                isPannesNeg  && "bg-red-50"
                              )}
                            >
                              <td className="px-3 py-1.5 text-xs text-muted-foreground font-bold">{i + 1}</td>

                              {/* Name */}
                              <td className="px-2 py-1.5">
                                <Input
                                  value={eq.name}
                                  onChange={e => updateField(eq.id, "name", e.target.value)}
                                  className="h-7 text-xs border-dashed"
                                  placeholder={t("Nom de l'équipement", "اسم المعدة")}
                                />
                              </td>

                              {/* TBF */}
                              <td className="px-2 py-1.5">
                                <Input
                                  type="number" min={0} step={0.1}
                                  value={eq.tbf}
                                  onChange={e => updateField(eq.id, "tbf", e.target.value)}
                                  placeholder={t("ex. 1500", "مثال: 1500")}
                                  className="h-7 text-xs text-center"
                                />
                              </td>

                              {/* Pannes */}
                              <td className="px-2 py-1.5">
                                <Input
                                  type="number" min={0} step={1}
                                  value={eq.pannes}
                                  onChange={e => updateField(eq.id, "pannes", e.target.value)}
                                  placeholder={t("ex. 5", "مثال: 5")}
                                  className={cn(
                                    "h-7 text-xs text-center",
                                    isPannesZero && "border-amber-400 focus-visible:ring-amber-400",
                                    isPannesNeg  && "border-red-400 focus-visible:ring-red-400"
                                  )}
                                />
                                {isPannesZero && (
                                  <p className="text-[10px] text-amber-700 mt-0.5 leading-tight">
                                    {t("⚠ doit être > 0", "⚠ يجب أن يكون > 0")}
                                  </p>
                                )}
                              </td>

                              {/* TTR */}
                              <td className="px-2 py-1.5">
                                <Input
                                  type="number" min={0} step={0.1}
                                  value={eq.ttr}
                                  onChange={e => updateField(eq.id, "ttr", e.target.value)}
                                  placeholder={t("ex. 40", "مثال: 40")}
                                  className="h-7 text-xs text-center"
                                />
                              </td>

                              {/* Remove */}
                              <td className="px-2 py-1.5 text-center">
                                {equipments.length > 1 && (
                                  <button
                                    onClick={() => removeEquipment(eq.id)}
                                    className="text-red-400 hover:text-red-600 transition-colors"
                                    title={t("Supprimer", "حذف")}
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
                </CardContent>
              </Card>

              <button
                onClick={addEquipment}
                className="w-full border-2 border-dashed border-primary/30 text-primary/60 hover:border-primary hover:text-primary rounded-xl py-3 text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t("Ajouter un équipement", "إضافة معدة")}
              </button>
            </div>

            {/* Validation errors */}
            {validationErrors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>{isAr ? err.ar : err.fr}</span>
              </div>
            ))}

            {/* Compute button */}
            <div className="flex justify-end">
              <Button onClick={handleCompute} disabled={!canCompute} size="lg" className="gap-2 px-8">
                <Calculator className="w-5 h-5" />
                {t("Calculer les indicateurs", "حساب المؤشرات")}
              </Button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            RESULTS PHASE
        ════════════════════════════════════════════════════════════════════ */}
        {phase === "results" && results && (
          <div className="space-y-8" ref={resultRef}>

            {/* ── Fleet summary cards ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: t("Équipements analysés", "معدات محللة"),
                  value: String(results.equipments.filter(e => e.status !== "error").length),
                  sub: t(`sur ${results.equipments.length} total`, `من ${results.equipments.length} إجمالاً`),
                  cls: "bg-primary/10 text-primary border-primary/20",
                },
                {
                  label: t("Disponibilité moyenne", "متوسط التوافرية"),
                  value: results.fleetDisponibilite !== null ? `${fmt2(results.fleetDisponibilite)}%` : "—",
                  sub: results.fleetDisponibilite !== null
                    ? (results.fleetDisponibilite >= 90 ? t("Satisfaisante", "مُرضية") : results.fleetDisponibilite >= 80 ? t("À surveiller", "تستوجب المتابعة") : t("Insuffisante", "غير كافية"))
                    : "",
                  cls: results.fleetDisponibilite === null ? "bg-muted text-muted-foreground border-border"
                     : results.fleetDisponibilite >= 90 ? "bg-green-50 text-green-700 border-green-200"
                     : results.fleetDisponibilite >= 80 ? "bg-amber-50 text-amber-700 border-amber-200"
                     : "bg-red-50 text-red-700 border-red-200",
                },
                {
                  label: t("MTBF moyen", "متوسط MTBF"),
                  value: results.fleetMtbf !== null ? `${fmt1(results.fleetMtbf)}h` : "—",
                  sub: t("Temps entre pannes", "الزمن بين الأعطال"),
                  cls: "bg-blue-50 text-blue-700 border-blue-200",
                },
                {
                  label: t("MTTR moyen", "متوسط MTTR"),
                  value: results.fleetMttr !== null ? `${fmt1(results.fleetMttr)}h` : "—",
                  sub: t("Temps de réparation", "زمن الإصلاح"),
                  cls: results.fleetMttr === null ? "bg-muted text-muted-foreground border-border"
                     : results.fleetMttr > 12 ? "bg-red-50 text-red-700 border-red-200"
                     : results.fleetMttr > 6  ? "bg-amber-50 text-amber-700 border-amber-200"
                     : "bg-green-50 text-green-700 border-green-200",
                },
              ].map((card, i) => (
                <div key={i} className={cn("rounded-xl border p-4 space-y-1", card.cls)}>
                  <div className="text-xs font-medium opacity-75">{card.label}</div>
                  <div className="text-2xl font-black">{card.value}</div>
                  {card.sub && <div className="text-[11px] opacity-70">{card.sub}</div>}
                </div>
              ))}
            </div>

            {/* ── Results table ─────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calculator className="w-5 h-5 text-primary" />
                  {t("Tableau des résultats", "جدول النتائج")}
                </CardTitle>
                <CardDescription>
                  {t("MTBF, MTTR et disponibilité calculés par équipement.", "MTBF وMTTR والتوافرية المحسوبة لكل معدة.")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[580px]">
                    <thead>
                      <tr className="bg-primary text-primary-foreground">
                        <th className="px-3 py-2.5 text-start text-xs font-semibold rounded-tl-lg">
                          {t("Équipement", "المعدة")}
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold">
                          {t("Pannes", "أعطال")}
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold">
                          MTBF (h)
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold">
                          MTTR (h)
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold">
                          {t("Disponibilité", "التوافرية")}
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold rounded-tr-lg">
                          {t("Statut", "الحالة")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.equipments.map((eq, i) => {
                        const sc = statusCfg(eq.status, language as "fr" | "ar");
                        return (
                          <tr key={eq.id} className={cn("border-b border-border", i % 2 === 0 ? "bg-card" : "bg-muted/10", sc.rowCls)}>
                            {/* Name */}
                            <td className="px-3 py-2.5 font-semibold">
                              <div className="flex items-center gap-2">
                                <span className={cn("w-2 h-2 rounded-full shrink-0", sc.dot)} />
                                {eq.name}
                              </div>
                            </td>
                            {/* Pannes */}
                            <td className="px-3 py-2.5 text-center text-muted-foreground font-mono text-xs">
                              {eq.status === "error" ? "—" : String(eq.pannes)}
                            </td>
                            {/* MTBF */}
                            <td className="px-3 py-2.5 text-center font-bold text-primary">
                              {eq.mtbf !== null
                                ? fmt1(eq.mtbf)
                                : (
                                  <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium">
                                    <AlertTriangle className="w-3 h-3" />
                                    {errorMsg(eq.errorKey, language as "fr" | "ar")}
                                  </span>
                                )
                              }
                            </td>
                            {/* MTTR */}
                            <td className="px-3 py-2.5 text-center font-bold text-blue-700">
                              {eq.mttr !== null ? fmt1(eq.mttr) : "—"}
                            </td>
                            {/* Disponibilité */}
                            <td className={cn("px-3 py-2.5 text-center font-black text-base", dispColor(eq.disponibilite))}>
                              {eq.disponibilite !== null ? `${fmt2(eq.disponibilite)}%` : "—"}
                            </td>
                            {/* Status badge */}
                            <td className="px-3 py-2.5 text-center">
                              <span className={cn("inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full", sc.badgeCls)}>
                                {sc.badge}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Formulae reminder */}
                <div className="mt-4 p-3 bg-muted/30 rounded-lg text-[11px] text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
                  <span>MTBF = TBF ÷ Pannes</span>
                  <span>MTTR = TTR ÷ Pannes</span>
                  <span>{t("Disponibilité = MTBF ÷ (MTBF + MTTR) × 100", "التوافرية = MTBF ÷ (MTBF + MTTR) × 100")}</span>
                </div>
              </CardContent>
            </Card>

            {/* ── تحليل الوضع ───────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="w-5 h-5 text-primary" />
                  {t("Analyse de la Situation", "تحليل الوضع")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysisLines.map((line, i) => (
                  <div
                    key={i}
                    className="bg-primary/5 border border-primary/15 rounded-lg px-4 py-3 text-sm leading-relaxed text-foreground"
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
                <CardDescription>
                  {t(
                    "Recommandations ciblées basées sur les équipements identifiés comme critiques ou à risque.",
                    "توصيات مستهدفة بناءً على المعدات المحددة كحرجة أو معرضة للخطر."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recommendations.map((rec, i) => {
                  const borderColors = ["border-red-400", "border-amber-400", "border-primary", "border-green-500", "border-blue-400"];
                  return (
                    <div
                      key={i}
                      className={cn(
                        "border rounded-xl p-4 space-y-1.5",
                        isAr ? "border-r-4" : "border-l-4",
                        borderColors[i % borderColors.length]
                      )}
                    >
                      <div className="font-bold text-sm flex items-start gap-2">
                        <span className="text-base leading-none shrink-0">{rec.icon}</span>
                        <span>{isAr ? rec.ar : rec.fr}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {isAr ? rec.descAr : rec.descFr}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* ── Action buttons ────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">

              {/* Modify form */}
              <Button
                variant="outline"
                onClick={() => setPhase("form")}
                className="gap-2 w-full sm:w-auto"
              >
                <ArrowLeft className={`w-4 h-4 ${isAr ? "rotate-180" : ""}`} />
                {t("Modifier les données", "تعديل البيانات")}
              </Button>

              <div className="flex-1" />

              {/* Save */}
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={saving || saved}
                className="gap-2 w-full sm:w-auto"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving
                  ? t("Enregistrement…", "جارٍ الحفظ…")
                  : saved
                    ? t("Enregistré !", "تم الحفظ!")
                    : t("Enregistrer", "حفظ في السجل")}
              </Button>

              {/* PDF */}
              <Button
                onClick={handleExport}
                disabled={exporting}
                className="gap-2 w-full sm:w-auto"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{exportProgress || t("Export en cours…", "جارٍ التصدير…")}</span>
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
        )}

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="border-t pt-8 pb-4 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1 rounded">
              <Wrench className="w-4 h-4" />
            </div>
            <span className="font-bold text-foreground">OptimDZ</span>
            <span>·</span>
            <span>{t("Maintenance des Équipements", "صيانة المعدات")}</span>
          </div>
          <Link href="/industrial-management" className="hover:text-primary transition-colors">
            {t("← Gestion Industrielle", "→ التسيير الصناعي")}
          </Link>
        </footer>

      </main>
    </div>
  );
}
