import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import {
  detectCycles, computePertCpm, normalCDF, fmt,
} from "@/lib/pertCpmAlgorithm";
import type { Activity, PertCpmResult } from "@/lib/pertCpmAlgorithm";
import { NetworkDiagram } from "./NetworkDiagram";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Network, Calculator, Plus, Trash2, AlertTriangle,
  CheckCircle2, ShoppingBag, Factory, Leaf, Monitor, PencilRuler,
  ArrowRight, RefreshCw, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Local activity shape (frontend state) ────────────────────────────────────
interface ActivityInput {
  id: string;
  name: string;
  duration: number;    // CPM
  optimistic: number;  // PERT O
  mostLikely: number;  // PERT M
  pessimistic: number; // PERT P
  predecessors: string[];
}

// ── Sector template data ──────────────────────────────────────────────────────
type SectorKey = "trade" | "industry" | "agriculture" | "services" | "custom";

interface SectorTemplate {
  id: SectorKey;
  icon: React.ElementType;
  nameFr: string;
  nameAr: string;
  descFr: string;
  descAr: string;
  projectNameFr: string;
  projectNameAr: string;
  activities: ActivityInput[];
}

const TEMPLATES: SectorTemplate[] = [
  {
    id: "trade",
    icon: ShoppingBag,
    nameFr: "Commerce",
    nameAr: "التجارة",
    descFr: "Rénovation d'un centre commercial à Oran",
    descAr: "تجديد مركز تجاري بوهران",
    projectNameFr: "Rénovation Centre Commercial — Oran",
    projectNameAr: "تجديد المركز التجاري — وهران",
    activities: [
      { id:"A", name:"Étude & devis",         duration:3,  optimistic:2, mostLikely:3,  pessimistic:5,  predecessors:[] },
      { id:"B", name:"Permis de travaux",      duration:5,  optimistic:3, mostLikely:5,  pessimistic:8,  predecessors:["A"] },
      { id:"C", name:"Sélection entreprises",  duration:3,  optimistic:2, mostLikely:3,  pessimistic:4,  predecessors:["A"] },
      { id:"D", name:"Gros travaux",           duration:6,  optimistic:4, mostLikely:6,  pessimistic:10, predecessors:["B","C"] },
      { id:"E", name:"Élec. & plomberie",      duration:5,  optimistic:3, mostLikely:5,  pessimistic:7,  predecessors:["D"] },
      { id:"F", name:"Aménagement intérieur",  duration:6,  optimistic:4, mostLikely:6,  pessimistic:8,  predecessors:["D"] },
      { id:"G", name:"Équipements",            duration:3,  optimistic:2, mostLikely:3,  pessimistic:5,  predecessors:["E","F"] },
      { id:"H", name:"Tests & réception",      duration:2,  optimistic:1, mostLikely:2,  pessimistic:3,  predecessors:["G"] },
    ],
  },
  {
    id: "industry",
    icon: Factory,
    nameFr: "Industrie",
    nameAr: "الصناعة",
    descFr: "Lancement d'une unité de production à Sétif",
    descAr: "إطلاق وحدة إنتاج بسطيف",
    projectNameFr: "Unité de Production SONELGAZ — Sétif",
    projectNameAr: "وحدة إنتاج سونلغاز — سطيف",
    activities: [
      { id:"A", name:"Étude de faisabilité",    duration:3,  optimistic:2, mostLikely:3,  pessimistic:5,  predecessors:[] },
      { id:"B", name:"Construction bâtiment",   duration:12, optimistic:8, mostLikely:12, pessimistic:18, predecessors:["A"] },
      { id:"C", name:"Commande équipements",    duration:8,  optimistic:5, mostLikely:8,  pessimistic:12, predecessors:["A"] },
      { id:"D", name:"Installation machines",   duration:6,  optimistic:4, mostLikely:6,  pessimistic:9,  predecessors:["B","C"] },
      { id:"E", name:"Raccordement réseau",      duration:3,  optimistic:2, mostLikely:3,  pessimistic:5,  predecessors:["D"] },
      { id:"F", name:"Tests & mise au point",   duration:3,  optimistic:2, mostLikely:3,  pessimistic:4,  predecessors:["E"] },
      { id:"G", name:"Formation opérateurs",    duration:3,  optimistic:2, mostLikely:3,  pessimistic:4,  predecessors:["F"] },
      { id:"H", name:"Démarrage production",    duration:2,  optimistic:1, mostLikely:2,  pessimistic:3,  predecessors:["G"] },
    ],
  },
  {
    id: "agriculture",
    icon: Leaf,
    nameFr: "Agriculture",
    nameAr: "الفلاحة",
    descFr: "Aménagement d'un périmètre irrigué en Mitidja",
    descAr: "تهيئة محيط ري في المتيجة",
    projectNameFr: "Périmètre Irrigué — Mitidja",
    projectNameAr: "محيط الري — المتيجة",
    activities: [
      { id:"A", name:"Étude topographique",    duration:3,  optimistic:2, mostLikely:3,  pessimistic:4,  predecessors:[] },
      { id:"B", name:"Conception réseau",      duration:4,  optimistic:3, mostLikely:4,  pessimistic:6,  predecessors:["A"] },
      { id:"C", name:"Terrassement",           duration:6,  optimistic:4, mostLikely:6,  pessimistic:9,  predecessors:["A"] },
      { id:"D", name:"Approvisionnement",      duration:5,  optimistic:3, mostLikely:5,  pessimistic:7,  predecessors:["B"] },
      { id:"E", name:"Réseau d'irrigation",    duration:6,  optimistic:4, mostLikely:6,  pessimistic:8,  predecessors:["C","D"] },
      { id:"F", name:"Électrification pompes", duration:3,  optimistic:2, mostLikely:3,  pessimistic:5,  predecessors:["E"] },
      { id:"G", name:"Mise en eau & tests",    duration:3,  optimistic:2, mostLikely:3,  pessimistic:4,  predecessors:["F"] },
      { id:"H", name:"Formation agriculteurs", duration:2,  optimistic:1, mostLikely:2,  pessimistic:3,  predecessors:["G"] },
    ],
  },
  {
    id: "services",
    icon: Monitor,
    nameFr: "Services",
    nameAr: "الخدمات",
    descFr: "Déploiement d'un système ERP pour PME algérienne",
    descAr: "نشر نظام ERP لمؤسسة جزائرية صغيرة",
    projectNameFr: "Déploiement ERP — PME Algérienne",
    projectNameAr: "نشر نظام ERP — مؤسسة جزائرية",
    activities: [
      { id:"A", name:"Audit des processus",     duration:3,  optimistic:2, mostLikely:3,  pessimistic:5,  predecessors:[] },
      { id:"B", name:"Sélection progiciel",     duration:3,  optimistic:2, mostLikely:3,  pessimistic:5,  predecessors:["A"] },
      { id:"C", name:"Paramétrage & config",    duration:6,  optimistic:4, mostLikely:6,  pessimistic:9,  predecessors:["B"] },
      { id:"D", name:"Migration données",       duration:5,  optimistic:3, mostLikely:5,  pessimistic:8,  predecessors:["B"] },
      { id:"E", name:"Formation utilisateurs",  duration:3,  optimistic:2, mostLikely:3,  pessimistic:4,  predecessors:["C"] },
      { id:"F", name:"Tests & recettes",        duration:4,  optimistic:3, mostLikely:4,  pessimistic:6,  predecessors:["C","D"] },
      { id:"G", name:"Déploiement prod",        duration:2,  optimistic:1, mostLikely:2,  pessimistic:3,  predecessors:["E","F"] },
      { id:"H", name:"Post-lancement",          duration:3,  optimistic:2, mostLikely:3,  pessimistic:5,  predecessors:["G"] },
    ],
  },
];

const CUSTOM_DEFAULT: ActivityInput[] = [
  { id:"A", name:"Activité A", duration:2, optimistic:1, mostLikely:2, pessimistic:4, predecessors:[] },
  { id:"B", name:"Activité B", duration:3, optimistic:2, mostLikely:3, pessimistic:5, predecessors:["A"] },
  { id:"C", name:"Activité C", duration:4, optimistic:3, mostLikely:4, pessimistic:6, predecessors:["A"] },
  { id:"D", name:"Activité D", duration:2, optimistic:1, mostLikely:2, pessimistic:3, predecessors:["B","C"] },
];

// ── Letter ID helper ──────────────────────────────────────────────────────────
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function nextId(existing: string[]): string {
  for (const ch of LETTERS) if (!existing.includes(ch)) return ch;
  return `Z${existing.length}`;
}

// ── Main page component ───────────────────────────────────────────────────────
export default function PertCpm() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  // ── Form state ──────────────────────────────────────────────────────────────
  const [selectedSector, setSelectedSector] = useState<SectorKey | null>(null);
  const [projectName, setProjectName]       = useState("");
  const [mode, setMode]                     = useState<"CPM" | "PERT">("CPM");
  const [activities, setActivities]         = useState<ActivityInput[]>(CUSTOM_DEFAULT);

  // ── Result state ────────────────────────────────────────────────────────────
  const [result, setResult]         = useState<PertCpmResult | null>(null);
  const [resultStale, setResultStale] = useState(false);
  const [targetDur, setTargetDur]   = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);

  // ── Real-time cycle detection ───────────────────────────────────────────────
  const [cycleIds, setCycleIds] = useState<string[]>([]);
  useEffect(() => {
    const algActs: Activity[] = activities.map((a) => ({
      id: a.id, name: a.name,
      duration: a.duration,
      optimistic: a.optimistic, mostLikely: a.mostLikely, pessimistic: a.pessimistic,
      predecessors: a.predecessors,
    }));
    setCycleIds(detectCycles(algActs));
  }, [activities]);

  // Mark result stale when form changes after calculation
  useEffect(() => {
    if (result) setResultStale(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, mode]);

  // ── Sector selection ────────────────────────────────────────────────────────
  const handleSectorSelect = (key: SectorKey) => {
    setSelectedSector(key);
    setResult(null);
    setResultStale(false);
    if (key === "custom") {
      setProjectName("");
      setActivities(CUSTOM_DEFAULT);
    } else {
      const tpl = TEMPLATES.find((t) => t.id === key)!;
      setProjectName(isAr ? tpl.projectNameAr : tpl.projectNameFr);
      setActivities(tpl.activities.map((a) => ({ ...a })));
    }
  };

  // ── Activity table mutations ────────────────────────────────────────────────
  const addActivity = () => {
    const id = nextId(activities.map((a) => a.id));
    setActivities([...activities, {
      id, name: "", duration: 1,
      optimistic: 1, mostLikely: 2, pessimistic: 3,
      predecessors: [],
    }]);
  };

  const deleteActivity = (idx: number) => {
    const removed = activities[idx].id;
    setActivities(
      activities
        .filter((_, i) => i !== idx)
        .map((a) => ({ ...a, predecessors: a.predecessors.filter((p) => p !== removed) }))
    );
  };

  const updateField = <K extends keyof ActivityInput>(
    idx: number, key: K, val: ActivityInput[K]
  ) => {
    const next = [...activities];
    next[idx] = { ...next[idx], [key]: val };
    setActivities(next);
  };

  const togglePredecessor = (actIdx: number, predId: string) => {
    const act = activities[actIdx];
    const next = act.predecessors.includes(predId)
      ? act.predecessors.filter((p) => p !== predId)
      : [...act.predecessors, predId];
    updateField(actIdx, "predecessors", next);
  };

  // ── Calculate ────────────────────────────────────────────────────────────────
  const handleCalculate = () => {
    const algActs: Activity[] = activities.map((a) => ({
      id: a.id, name: a.name,
      duration: a.duration,
      optimistic: a.optimistic, mostLikely: a.mostLikely, pessimistic: a.pessimistic,
      predecessors: a.predecessors,
    }));
    const res = computePertCpm(algActs, mode);
    setResult(res);
    setResultStale(false);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  // ── PERT probability calculation ─────────────────────────────────────────────
  const tD = parseFloat(targetDur);
  const pertZ  = result?.projectStdDev && result.projectStdDev > 0 && isFinite(tD)
    ? (tD - result.projectDuration) / result.projectStdDev : null;
  const pertP  = pertZ !== null ? normalCDF(pertZ) : null;

  // ── Predecessor record for NetworkDiagram ────────────────────────────────────
  const predsRecord: Record<string, string[]> = {};
  for (const a of activities) predsRecord[a.id] = a.predecessors;

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className={cn("container mx-auto px-4 py-8 max-w-6xl space-y-8", isAr ? "rtl" : "ltr")}
      dir={isAr ? "rtl" : "ltr"}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary">
            <Network className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {t("PERT / CPM", "PERT / CPM")}
          </h1>
          {mode === "CPM"
            ? <Badge variant="secondary">CPM — {t("Déterministe", "محدد")}</Badge>
            : <Badge className="bg-accent/20 text-accent-foreground border-accent/30">PERT — {t("Probabiliste", "احتمالي")}</Badge>
          }
        </div>
        <p className="text-muted-foreground ps-14">
          {t(
            "Planifiez votre projet, identifiez le chemin critique et estimez les délais.",
            "خطط مشروعك، حدد المسار الحرج وقدّر المدد الزمنية."
          )}
        </p>
      </div>

      {/* ── 1. Sector selection ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t("Secteur d'activité", "قطاع النشاط")}</CardTitle>
          <CardDescription>
            {t("Sélectionnez un secteur pour pré-remplir un exemple algérien réaliste.",
               "اختر قطاعاً لتعبئة مثال جزائري واقعي تلقائياً.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              const active = selectedSector === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSectorSelect(tpl.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all cursor-pointer",
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={cn("text-sm font-semibold", active ? "text-primary" : "text-foreground")}>
                    {isAr ? tpl.nameAr : tpl.nameFr}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                    {isAr ? tpl.descAr : tpl.descFr}
                  </span>
                </button>
              );
            })}
            {/* Custom */}
            {(() => {
              const active = selectedSector === "custom";
              return (
                <button
                  type="button"
                  onClick={() => handleSectorSelect("custom")}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-all cursor-pointer",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <PencilRuler className="w-5 h-5" />
                  </div>
                  <span className={cn("text-sm font-semibold", active ? "text-primary" : "text-foreground")}>
                    {t("Personnalisé", "مخصص")}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {t("Saisie libre", "إدخال حر")}
                  </span>
                </button>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Project setup ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t("Configuration du projet", "إعداد المشروع")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Name + Mode */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("Nom du projet", "اسم المشروع")}</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={t("Ex: Construction usine Annaba", "مثال: بناء مصنع عنابة")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Mode de calcul", "نمط الحساب")}</Label>
              <div className="flex rounded-lg border border-border overflow-hidden h-10">
                {(["CPM", "PERT"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setResult(null); setResultStale(false); }}
                    className={cn(
                      "flex-1 text-sm font-semibold transition-colors",
                      mode === m
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {m === "CPM"
                      ? t("CPM — Déterministe", "CPM — محدد")
                      : t("PERT — Probabiliste", "PERT — احتمالي")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Activity table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                {t("Tableau des activités", "جدول الأنشطة")}
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addActivity}>
                <Plus className="w-4 h-4 me-1.5" />
                {t("Ajouter", "إضافة")}
              </Button>
            </div>

            {/* Cycle warning */}
            {cycleIds.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {t(
                    `Dépendance circulaire détectée : ${cycleIds.join(" → ")}. Corrigez avant de calculer.`,
                    `تم اكتشاف تبعية دائرية: ${cycleIds.join(" → ")}. يرجى التصحيح قبل الحساب.`
                  )}
                </span>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium text-start w-12">ID</th>
                    <th className="px-3 py-2 font-medium text-start min-w-[160px]">
                      {t("Nom", "الاسم")}
                    </th>
                    {mode === "CPM" ? (
                      <th className="px-3 py-2 font-medium text-center w-24">
                        {t("Durée (sem.)", "المدة (أسابيع)")}
                      </th>
                    ) : (
                      <>
                        <th className="px-3 py-2 font-medium text-center w-20">O</th>
                        <th className="px-3 py-2 font-medium text-center w-20">M</th>
                        <th className="px-3 py-2 font-medium text-center w-20">P</th>
                      </>
                    )}
                    <th className="px-3 py-2 font-medium text-start min-w-[180px]">
                      {t("Prédécesseurs", "المسبقات")}
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activities.map((act, idx) => (
                    <tr key={act.id} className={cn(
                      "hover:bg-muted/30",
                      cycleIds.includes(act.id) && "bg-destructive/5"
                    )}>
                      {/* ID badge */}
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary font-bold text-sm">
                          {act.id}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="px-3 py-2">
                        <Input
                          value={act.name}
                          onChange={(e) => updateField(idx, "name", e.target.value)}
                          placeholder={t("Nom de l'activité", "اسم النشاط")}
                          className="h-8 text-sm"
                        />
                      </td>

                      {/* Duration (CPM) or O/M/P (PERT) */}
                      {mode === "CPM" ? (
                        <td className="px-3 py-2">
                          <Input
                            type="number" min="0" step="any"
                            value={act.duration}
                            onChange={(e) => updateField(idx, "duration", parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm text-center"
                          />
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2">
                            <Input type="number" min="0" step="any" value={act.optimistic}
                              onChange={(e) => updateField(idx, "optimistic", parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm text-center" />
                          </td>
                          <td className="px-3 py-2">
                            <Input type="number" min="0" step="any" value={act.mostLikely}
                              onChange={(e) => updateField(idx, "mostLikely", parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm text-center" />
                          </td>
                          <td className="px-3 py-2">
                            <Input type="number" min="0" step="any" value={act.pessimistic}
                              onChange={(e) => updateField(idx, "pessimistic", parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm text-center" />
                          </td>
                        </>
                      )}

                      {/* Predecessors (toggle chips) */}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {activities.filter((other) => other.id !== act.id).length === 0 ? (
                            <span className="text-muted-foreground text-xs italic">—</span>
                          ) : (
                            activities
                              .filter((other) => other.id !== act.id)
                              .map((other) => (
                                <button
                                  key={other.id}
                                  type="button"
                                  onClick={() => togglePredecessor(idx, other.id)}
                                  className={cn(
                                    "px-2 py-0.5 rounded text-xs font-mono border transition-all",
                                    act.predecessors.includes(other.id)
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-transparent text-muted-foreground border-border hover:border-primary/60"
                                  )}
                                >
                                  {other.id}
                                </button>
                              ))
                          )}
                        </div>
                      </td>

                      {/* Delete */}
                      <td className="px-3 py-2">
                        <Button
                          type="button" variant="ghost" size="icon"
                          onClick={() => deleteActivity(idx)}
                          disabled={activities.length <= 1}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PERT column legend */}
            {mode === "PERT" && (
              <p className="text-xs text-muted-foreground">
                {t(
                  "O = Optimiste · M = Plus probable · P = Pessimiste · tₑ = (O + 4M + P) / 6",
                  "O = متفائل · M = الأرجح · P = متشائم · tₑ = (O + 4M + P) / 6"
                )}
              </p>
            )}
          </div>

          {/* Calculate button */}
          <div className="flex justify-end pt-2">
            <Button
              size="lg"
              onClick={handleCalculate}
              disabled={cycleIds.length > 0 || activities.length === 0}
              className="px-10"
            >
              <Calculator className="w-5 h-5 me-2" />
              {t("Calculer", "احسب")}
              <ArrowRight className={cn("w-4 h-4 ms-2", isAr && "rotate-180")} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Results ───────────────────────────────────────────────────────── */}
      {result && (
        <div ref={resultsRef} className="space-y-6 scroll-mt-20">

          {/* Stale warning */}
          {resultStale && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <RefreshCw className="w-4 h-4 shrink-0" />
              {t(
                "Les paramètres ont changé — cliquez Calculer pour mettre à jour.",
                "تغيرت المعطيات — انقر احسب للتحديث."
              )}
            </div>
          )}

          {/* Critical path summary */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-5 pb-4">
              <div className="flex flex-wrap items-start gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    {t("Durée totale du projet", "المدة الإجمالية للمشروع")}
                  </p>
                  <p className="text-4xl font-bold text-primary">
                    {fmt(result.projectDuration)}
                    <span className="text-lg font-normal ms-1.5 text-muted-foreground">
                      {t("semaines", "أسبوع")}
                    </span>
                  </p>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {t("Chemin critique", "المسار الحرج")}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    {result.criticalPath.map((id, i) => (
                      <span key={id} className="flex items-center gap-1">
                        <Badge className="bg-primary text-primary-foreground font-mono text-sm px-2.5">
                          {id}
                        </Badge>
                        {i < result.criticalPath.length - 1 && (
                          <ArrowRight className={cn("w-3.5 h-3.5 text-primary shrink-0", isAr && "rotate-180")} />
                        )}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {result.criticalPath
                      .map((id) => result.activities.find((a) => a.id === id)?.name ?? id)
                      .join(" → ")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Network diagram */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              {t("Réseau PERT/CPM", "مخطط الشبكة")}
            </h2>
            <NetworkDiagram
              results={result.activities}
              predecessors={predsRecord}
              criticalPath={result.criticalPath}
              t={t}
            />
          </div>

          {/* Forward / backward pass table */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              {t("Tableau Avant / Arrière", "جدول الحساب الأمامي والخلفي")}
            </h2>
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">ID</TableHead>
                      <TableHead className="font-semibold">{t("Activité", "النشاط")}</TableHead>
                      {mode === "PERT" && (
                        <TableHead className="text-center font-semibold">tₑ</TableHead>
                      )}
                      <TableHead className="text-center font-semibold">
                        {mode === "CPM" ? t("Durée", "المدة") : "σ²"}
                      </TableHead>
                      <TableHead className="text-center font-semibold">ES</TableHead>
                      <TableHead className="text-center font-semibold">EF</TableHead>
                      <TableHead className="text-center font-semibold">LS</TableHead>
                      <TableHead className="text-center font-semibold">LF</TableHead>
                      <TableHead className="text-center font-semibold">
                        {t("Marge", "المهلة")}
                      </TableHead>
                      <TableHead className="text-center font-semibold">
                        {t("Critique", "حرج")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.activities.map((r) => (
                      <TableRow
                        key={r.id}
                        className={cn(r.isCritical && "bg-primary/5 font-medium")}
                      >
                        <TableCell>
                          <span className={cn(
                            "inline-flex items-center justify-center w-7 h-7 rounded font-bold text-sm",
                            r.isCritical
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {r.id}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        {mode === "PERT" && (
                          <TableCell className="text-center">{fmt(r.expectedDuration ?? 0)}</TableCell>
                        )}
                        <TableCell className="text-center">
                          {mode === "CPM" ? fmt(r.duration) : fmt(r.variance ?? 0)}
                        </TableCell>
                        <TableCell className="text-center">{fmt(r.ES)}</TableCell>
                        <TableCell className="text-center">{fmt(r.EF)}</TableCell>
                        <TableCell className="text-center">{fmt(r.LS)}</TableCell>
                        <TableCell className="text-center">{fmt(r.LF)}</TableCell>
                        <TableCell className={cn(
                          "text-center font-mono",
                          r.isCritical ? "text-destructive font-bold" : "text-muted-foreground"
                        )}>
                          {fmt(r.slack)}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.isCritical
                            ? <CheckCircle2 className="w-4 h-4 text-primary mx-auto" />
                            : <span className="text-muted-foreground text-xs">—</span>
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          {/* ── PERT probabilistic analysis ─────────────────────────────────── */}
          {mode === "PERT" && result.projectVariance !== undefined && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                {t("Analyse Probabiliste PERT", "التحليل الاحتمالي PERT")}
              </h2>

              {/* Project stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    label: t("Espérance E[T]", "القيمة المتوقعة E[T]"),
                    value: fmt(result.projectDuration),
                    unit: t("semaines", "أسبوع"),
                  },
                  {
                    label: t("Variance σ²(T)", "التباين σ²(T)"),
                    value: fmt(result.projectVariance!),
                    unit: t("sem²", "أسبوع²"),
                  },
                  {
                    label: t("Écart-type σ(T)", "الانحراف المعياري σ(T)"),
                    value: fmt(result.projectStdDev!),
                    unit: t("semaines", "أسبوع"),
                  },
                ].map((s) => (
                  <Card key={s.label} className="border-border">
                    <CardContent className="pt-4 pb-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{s.label}</p>
                      <p className="text-2xl font-bold text-primary">
                        {s.value}
                        <span className="text-sm font-normal text-muted-foreground ms-1">{s.unit}</span>
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Critical path PERT table */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {t("Activités critiques — détail PERT", "الأنشطة الحرجة — تفاصيل PERT")}
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>{t("Activité", "النشاط")}</TableHead>
                        <TableHead className="text-center">O</TableHead>
                        <TableHead className="text-center">M</TableHead>
                        <TableHead className="text-center">P</TableHead>
                        <TableHead className="text-center">tₑ</TableHead>
                        <TableHead className="text-center">σ²</TableHead>
                        <TableHead className="text-center">σ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.activities
                        .filter((r) => r.isCritical)
                        .map((r) => {
                          const src = activities.find((a) => a.id === r.id);
                          return (
                            <TableRow key={r.id} className="bg-primary/5">
                              <TableCell className="font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="w-6 h-6 rounded bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{r.id}</span>
                                  {r.name}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">{fmt(src?.optimistic ?? 0)}</TableCell>
                              <TableCell className="text-center">{fmt(src?.mostLikely ?? 0)}</TableCell>
                              <TableCell className="text-center">{fmt(src?.pessimistic ?? 0)}</TableCell>
                              <TableCell className="text-center font-semibold">{fmt(r.expectedDuration ?? 0)}</TableCell>
                              <TableCell className="text-center">{fmt(r.variance ?? 0)}</TableCell>
                              <TableCell className="text-center">{fmt(Math.sqrt(r.variance ?? 0))}</TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* Target duration & probability */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {t("Probabilité de respecter un délai", "احتمال الانتهاء في موعد مستهدف")}
                  </CardTitle>
                  <CardDescription>
                    {t(
                      "Entrez un délai cible pour calculer la probabilité P(T_projet ≤ T_cible) via la loi normale.",
                      "أدخل موعداً مستهدفاً لحساب الاحتمال P(T_مشروع ≤ T_هدف) باستخدام التوزيع الطبيعي."
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="space-y-1.5">
                      <Label>{t("Délai cible T (semaines)", "الموعد المستهدف T (أسابيع)")}</Label>
                      <Input
                        type="number" min="0" step="any"
                        value={targetDur}
                        onChange={(e) => setTargetDur(e.target.value)}
                        placeholder={fmt(result.projectDuration + (result.projectStdDev ?? 0))}
                        className="w-44"
                      />
                    </div>
                    {pertZ !== null && pertP !== null && (
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">{t("Score Z", "درجة Z")}</p>
                          <p className="text-xl font-bold font-mono">{fmt(pertZ)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">{t("Probabilité", "الاحتمال")}</p>
                          <p className="text-xl font-bold text-primary">{(pertP * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {pertP !== null && (
                    <div className="space-y-2">
                      {/* Progress bar */}
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(pertP * 100, 100)}%`,
                            backgroundColor: pertP >= 0.8 ? "#004d40" : pertP >= 0.5 ? "#f4a261" : "#dc2626",
                          }}
                        />
                      </div>
                      <p className={cn(
                        "text-sm font-medium",
                        pertP >= 0.8 ? "text-primary" : pertP >= 0.5 ? "text-amber-700" : "text-destructive"
                      )}>
                        {pertP >= 0.9
                          ? t("Très haute probabilité de respecter le délai (>90%)", "احتمال مرتفع جداً لاحترام الموعد (>90%)")
                          : pertP >= 0.8
                          ? t("Bonne probabilité de respecter le délai (>80%)", "احتمال جيد لاحترام الموعد (>80%)")
                          : pertP >= 0.5
                          ? t("Probabilité modérée — risque à surveiller", "احتمال متوسط — مخاطرة قائمة")
                          : t("Probabilité faible — projet à risque élevé", "احتمال منخفض — مشروع عالي المخاطرة")
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          `Z = (${fmt(tD)} − ${fmt(result.projectDuration)}) / ${fmt(result.projectStdDev!)} = ${fmt(pertZ!)}  →  Φ(Z) = ${(pertP! * 100).toFixed(2)}%`,
                          `Z = (${fmt(tD)} − ${fmt(result.projectDuration)}) / ${fmt(result.projectStdDev!)} = ${fmt(pertZ!)}  →  Φ(Z) = ${(pertP! * 100).toFixed(2)}%`
                        )}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
