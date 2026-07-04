import { useState, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { useAssignmentState } from "@/lib/AssignmentContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  Factory, ShoppingBag, Users, Leaf, PenLine,
  Plus, Trash2, ArrowRight, ChevronLeft, ChevronRight,
  RotateCcw, AlertTriangle, CheckCircle2, Info,
  Ban, Lock, Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type SectorKey = "trade" | "industry" | "agriculture" | "services" | "custom";
type Step = "select" | "form";

interface Resource { name: string; }
interface Task     { name: string; }

// ── Sector cards ──────────────────────────────────────────────────────────────
const SECTOR_CARDS = [
  {
    key: "trade" as SectorKey,
    icon: <ShoppingBag className="w-7 h-7" />,
    nameFr: "Commerce",     nameAr: "تجارة",
    descFr: "Affectation de représentants commerciaux aux zones géographiques régionales.",
    descAr: "توزيع المندوبين التجاريين على المناطق الجغرافية الإقليمية.",
    routeFr: "4 commerciaux × 4 zones · Matrice carrée",
    routeAr: "4 مندوبين × 4 مناطق · مصفوفة مربعة",
    objectiveFr: "Minimiser le coût de déplacement",
    objectiveAr: "تقليل تكلفة التنقل",
    color: "border-amber-200 hover:border-amber-400 hover:bg-amber-50/60",
    iconBg: "bg-amber-100 text-amber-700",
  },
  {
    key: "industry" as SectorKey,
    icon: <Factory className="w-7 h-7" />,
    nameFr: "Industrie",   nameAr: "صناعة",
    descFr: "Affectation de machines aux ordres de production pour minimiser le temps total.",
    descAr: "توزيع الآلات على أوامر الإنتاج لتقليل وقت المعالجة الإجمالي.",
    routeFr: "4 machines × 4 commandes · Matrice carrée",
    routeAr: "4 آلات × 4 طلبات · مصفوفة مربعة",
    objectiveFr: "Minimiser le temps de traitement",
    objectiveAr: "تقليل وقت المعالجة",
    color: "border-blue-200 hover:border-blue-400 hover:bg-blue-50/60",
    iconBg: "bg-blue-100 text-blue-700",
  },
  {
    key: "agriculture" as SectorKey,
    icon: <Leaf className="w-7 h-7" />,
    nameFr: "Agriculture", nameAr: "فلاحة",
    descFr: "Affectation d'équipes de récolte à des parcelles agricoles — matrice non carrée.",
    descAr: "توزيع فرق الحصاد على قطع الأراضي الزراعية — مصفوفة غير مربعة.",
    routeFr: "3 équipes × 4 parcelles · Ressource fictive ajoutée ⚖️",
    routeAr: "3 فرق × 4 قطع · مورد وهمي مضاف ⚖️",
    objectiveFr: "Minimiser le coût de récolte",
    objectiveAr: "تقليل تكلفة الحصاد",
    color: "border-green-200 hover:border-green-400 hover:bg-green-50/60",
    iconBg: "bg-green-100 text-green-700",
  },
  {
    key: "services" as SectorKey,
    icon: <Users className="w-7 h-7" />,
    nameFr: "Services",    nameAr: "خدمات",
    descFr: "Affectation de techniciens aux types d'intervention selon leurs compétences.",
    descAr: "توزيع التقنيين على أنواع التدخلات وفق كفاءاتهم.",
    routeFr: "4 techniciens × 4 missions · Maximisation",
    routeAr: "4 تقنيين × 4 مهام · تعظيم",
    objectiveFr: "Maximiser le score de performance",
    objectiveAr: "تعظيم نقاط الأداء",
    color: "border-purple-200 hover:border-purple-400 hover:bg-purple-50/60",
    iconBg: "bg-purple-100 text-purple-700",
  },
];

// ── Templates ─────────────────────────────────────────────────────────────────
export interface AssignmentTemplate {
  nameFr: string; nameAr: string;
  objectiveType: "minimize" | "maximize";
  unitFr: string; unitAr: string;
  resources: Array<{ nameFr: string; nameAr: string }>;
  tasks:     Array<{ nameFr: string; nameAr: string }>;
  costs: number[][];
  forbiddenCells?: Array<[number, number]>;
}

export const TEMPLATES: Record<SectorKey, AssignmentTemplate | null> = {

  trade: {
    nameFr: "Affectation Commerciale — Numidis SPA (Groupe Cevital)",
    nameAr: "التوزيع التجاري — نوميديس (مجموعة سيفيتال)",
    objectiveType: "minimize",
    unitFr: "kDA/jour",
    unitAr: "ألف دج/يوم",
    resources: [
      { nameFr: "Commercial Alger",       nameAr: "مندوب الجزائر"   },
      { nameFr: "Commercial Oran",         nameAr: "مندوب وهران"      },
      { nameFr: "Commercial Constantine",  nameAr: "مندوب قسنطينة"   },
      { nameFr: "Commercial Annaba",       nameAr: "مندوب عنابة"     },
    ],
    tasks: [
      { nameFr: "Zone Centre",   nameAr: "المنطقة الوسطى"   },
      { nameFr: "Zone Ouest",    nameAr: "المنطقة الغربية"  },
      { nameFr: "Zone Est",      nameAr: "المنطقة الشرقية"  },
      { nameFr: "Zone Sud",      nameAr: "المنطقة الجنوبية" },
    ],
    costs: [
      [12, 18, 22, 45],
      [20, 10, 28, 38],
      [24, 30, 11, 35],
      [28, 35, 14, 42],
    ],
    forbiddenCells: [[0, 3], [3, 1]],
  },

  industry: {
    nameFr: "Affectation Machines — SNVI Rouiba",
    nameAr: "توزيع الآلات — سنفي الرويبة",
    objectiveType: "minimize",
    unitFr: "heures",
    unitAr: "ساعات",
    resources: [
      { nameFr: "Machine CNC",     nameAr: "آلة CNC"       },
      { nameFr: "Machine Presse",  nameAr: "آلة الضغط"     },
      { nameFr: "Machine Soudure", nameAr: "آلة اللحام"    },
      { nameFr: "Machine Peinture",nameAr: "آلة الطلاء"    },
    ],
    tasks: [
      { nameFr: "Châssis",   nameAr: "هياكل السيارات" },
      { nameFr: "Cabines",   nameAr: "كابينات"         },
      { nameFr: "Moteurs",   nameAr: "محركات"          },
      { nameFr: "Finitions", nameAr: "تشطيبات"         },
    ],
    costs: [
      [ 8,  6, 12,  9],
      [10,  5,  7, 11],
      [ 9, 13,  6, 10],
      [14, 11, 15,  7],
    ],
  },

  agriculture: {
    nameFr: "Affectation Équipes de Récolte — Coopérative Soummam, Béjaïa",
    nameAr: "توزيع فرق الحصاد — تعاونية سومام، بجاية",
    objectiveType: "minimize",
    unitFr: "kDA/ha",
    unitAr: "ألف دج/هكتار",
    resources: [
      { nameFr: "Équipe Béjaïa",     nameAr: "فريق بجاية"      },
      { nameFr: "Équipe Sétif",      nameAr: "فريق سطيف"       },
      { nameFr: "Équipe Tizi Ouzou", nameAr: "فريق تيزي وزو"   },
    ],
    tasks: [
      { nameFr: "Parcelle Nord",   nameAr: "قطعة الشمال"  },
      { nameFr: "Parcelle Est",    nameAr: "قطعة الشرق"   },
      { nameFr: "Parcelle Ouest",  nameAr: "قطعة الغرب"   },
      { nameFr: "Parcelle Centre", nameAr: "قطعة الوسط"   },
    ],
    costs: [
      [15, 22, 28, 18],
      [20, 12, 25, 22],
      [24, 28, 10, 20],
    ],
  },

  services: {
    nameFr: "Affectation Techniciens — Algérie Télécom, Direction Alger",
    nameAr: "توزيع التقنيين — اتصالات الجزائر، مديرية الجزائر",
    objectiveType: "maximize",
    unitFr: "score /100",
    unitAr: "نقاط /100",
    resources: [
      { nameFr: "Tech. Karim B.", nameAr: "تقني. كريم ب." },
      { nameFr: "Tech. Nadia M.", nameAr: "تقني. نادية م." },
      { nameFr: "Tech. Omar S.",  nameAr: "تقني. عمر س."  },
      { nameFr: "Tech. Amina L.", nameAr: "تقني. أمينة ل." },
    ],
    tasks: [
      { nameFr: "Installation Fibre", nameAr: "تركيب الألياف"    },
      { nameFr: "Maintenance Réseau", nameAr: "صيانة الشبكة"      },
      { nameFr: "Dépannage Client",   nameAr: "إصلاح العملاء"    },
      { nameFr: "Config. DSLAM",      nameAr: "إعداد DSLAM"       },
    ],
    costs: [
      [90, 70, 80, 65],
      [75, 85, 70, 90],
      [80, 65, 90, 75],
      [70, 90, 75, 85],
    ],
  },

  custom: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const blankResources = (): Resource[] => [{ name: "" }, { name: "" }, { name: "" }];
const blankTasks     = (): Task[]     => [{ name: "" }, { name: "" }, { name: "" }];
const blankCosts = (m: number, n: number): number[][] =>
  Array.from({ length: m }, () => Array(n).fill(0));
const blankForbidden = (m: number, n: number): boolean[][] =>
  Array.from({ length: m }, () => Array(n).fill(false));

function templateToState(tpl: AssignmentTemplate, lang: "fr" | "ar") {
  const resources: Resource[] = tpl.resources.map((r) => ({
    name: lang === "ar" ? r.nameAr : r.nameFr,
  }));
  const tasks: Task[] = tpl.tasks.map((t) => ({
    name: lang === "ar" ? t.nameAr : t.nameFr,
  }));
  const costs = tpl.costs.map((row) => [...row]);
  const m = resources.length;
  const n = tasks.length;
  const forbidden = blankForbidden(m, n);
  if (tpl.forbiddenCells) {
    for (const [i, j] of tpl.forbiddenCells) {
      if (i < m && j < n) forbidden[i][j] = true;
    }
  }
  return { resources, tasks, costs, forbidden };
}

// ── Stage bar ─────────────────────────────────────────────────────────────────
function StageBar({ current }: { current: 1 | 2 }) {
  const { t } = useLanguage();
  const stages = [
    { n: 1, fr: "Données",          ar: "البيانات"   },
    { n: 2, fr: "Solution optimale", ar: "الحل الأمثل" },
  ] as const;
  return (
    <div className="flex items-center gap-0 text-sm select-none">
      {stages.map((s, idx) => {
        const done   = s.n < current;
        const active = s.n === current;
        const locked = s.n > current;
        return (
          <div key={s.n} className="flex items-center">
            {idx > 0 && (
              <div className={cn("h-px w-8 mx-1", done ? "bg-primary" : "bg-muted-foreground/30")} />
            )}
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              done   && "bg-primary/10 text-primary",
              active && "bg-primary text-primary-foreground shadow-sm",
              locked && "bg-muted text-muted-foreground",
            )}>
              {done   && <CheckCircle2 className="w-3.5 h-3.5" />}
              {active && <span className="font-bold">{s.n}</span>}
              {locked && <Lock className="w-3 h-3" />}
              {t(s.fr, s.ar)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Sector Selector ───────────────────────────────────────────────────────────
function SectorSelector({ onSelect }: { onSelect: (key: SectorKey) => void }) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {t("Choisissez votre secteur", "اختر قطاعك")}
        </h1>
        <p className="text-muted-foreground mt-2 text-base">
          {t(
            "Sélectionnez un modèle pré-rempli avec des données algériennes réalistes, ou commencez de zéro.",
            "اختر نموذجاً مُعبَّأً مسبقاً ببيانات جزائرية واقعية، أو ابدأ من الصفر."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {SECTOR_CARDS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.key)}
            className={cn(
              "group relative flex flex-col gap-4 rounded-xl border-2 bg-card p-6 text-left transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              s.color,
              isAr && "text-right"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className={cn("rounded-xl p-3 shrink-0", s.iconBg)}>{s.icon}</div>
              <ChevronRight className={cn(
                "w-5 h-5 text-muted-foreground mt-1 shrink-0 transition-transform group-hover:translate-x-1",
                isAr && "rotate-180 group-hover:-translate-x-1 group-hover:translate-x-0"
              )} />
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl font-bold text-foreground">{isAr ? s.nameAr : s.nameFr}</span>
                <span className="text-sm font-medium text-muted-foreground">{isAr ? s.nameFr : s.nameAr}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isAr ? s.descAr : s.descFr}
              </p>
            </div>

            <div className="space-y-1 border-t pt-3 mt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("Matrice", "المصفوفة")}:
                </span>
                <span className="text-xs font-medium text-foreground">
                  {isAr ? s.routeAr : s.routeFr}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("Objectif", "الهدف")}:
                </span>
                <span className="text-xs text-muted-foreground">
                  {isAr ? s.objectiveAr : s.objectiveFr}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Custom */}
      <div className="border-t pt-6">
        <button
          type="button"
          onClick={() => onSelect("custom")}
          className={cn(
            "group w-full flex items-center gap-4 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-5 transition-all duration-200 hover:border-muted-foreground/60 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            isAr ? "flex-row-reverse text-right" : "text-left"
          )}
        >
          <div className="rounded-xl bg-muted p-3 text-muted-foreground shrink-0">
            <PenLine className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              {t("Commencer de zéro", "ابدأ من الصفر")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                "Pour les utilisateurs avancés — définissez vos propres ressources, tâches et coûts.",
                "للمستخدمين المتقدمين — حدد مواردك ومهامك وتكاليفك بنفسك."
              )}
            </p>
          </div>
          <ArrowRight className={cn(
            "w-5 h-5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-1",
            isAr && "rotate-180 group-hover:-translate-x-1 group-hover:translate-x-0"
          )} />
        </button>
      </div>
    </div>
  );
}

// ── Matrix Cell ───────────────────────────────────────────────────────────────
interface MatrixCellProps {
  value: number;
  forbidden: boolean;
  isMax: boolean;
  onChange: (v: number) => void;
  onToggleForbidden: () => void;
  hasError?: boolean;
}

function MatrixCell({ value, forbidden, isMax, onChange, onToggleForbidden, hasError }: MatrixCellProps) {
  return (
    <div className={cn(
      "relative group/cell min-w-[72px] w-full h-10 rounded border transition-colors",
      forbidden
        ? "bg-red-50 border-red-200 dark:bg-red-950/20"
        : hasError
          ? "border-red-400 bg-red-50"
          : "border-border bg-background hover:border-primary/50",
    )}>
      {forbidden ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-muted-foreground select-none line-through">∞</span>
        </div>
      ) : (
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-full text-center text-sm bg-transparent outline-none rounded px-1 tabular-nums"
          aria-label="cost"
        />
      )}

      {/* Forbidden toggle button */}
      <button
        type="button"
        onClick={onToggleForbidden}
        title={forbidden ? "Lever l'interdiction" : "Marquer comme interdit"}
        className={cn(
          "absolute top-0.5 right-0.5 w-4 h-4 rounded-sm flex items-center justify-center transition-all",
          forbidden
            ? "opacity-100 text-red-500 bg-red-100"
            : "opacity-0 group-hover/cell:opacity-50 text-muted-foreground hover:!opacity-100 hover:text-red-500"
        )}
      >
        <Ban className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

// ── Sector label map ──────────────────────────────────────────────────────────
const SECTOR_LABELS: Record<SectorKey, { fr: string; ar: string }> = {
  trade:       { fr: "Commerce",     ar: "تجارة"  },
  industry:    { fr: "Industrie",    ar: "صناعة"  },
  agriculture: { fr: "Agriculture",  ar: "فلاحة"  },
  services:    { fr: "Services",     ar: "خدمات"  },
  custom:      { fr: "Personnalisé", ar: "مخصص"   },
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AssignmentSolve() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const [, setLocation] = useLocation();
  const { setProblem } = useAssignmentState();
  const { toast } = useToast();

  const search    = useSearch();
  const urlSector = new URLSearchParams(search).get("sector") as SectorKey | null;
  const _initLang = language;

  const [step,   setStep]   = useState<Step>(urlSector ? "form" : "select");
  const [sector, setSector] = useState<SectorKey>(urlSector ?? "custom");

  // ── Form state — lazily initialized from URL sector param if present ─────────
  const _initTpl = urlSector ? TEMPLATES[urlSector] : null;

  const [name,          setName]          = useState<string>(() =>
    _initTpl ? (_initLang === "ar" ? _initTpl.nameAr : _initTpl.nameFr) : ""
  );
  const [objectiveType, setObjectiveType] = useState<"minimize" | "maximize">(() =>
    _initTpl?.objectiveType ?? "minimize"
  );
  const [unit, setUnit] = useState<string>(() =>
    _initTpl ? (_initLang === "ar" ? _initTpl.unitAr : _initTpl.unitFr) : ""
  );
  const [resources, setResources] = useState<Resource[]>(() => {
    if (!_initTpl) return blankResources();
    return _initTpl.resources.map((r) => ({ name: _initLang === "ar" ? r.nameAr : r.nameFr }));
  });
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (!_initTpl) return blankTasks();
    return _initTpl.tasks.map((t) => ({ name: _initLang === "ar" ? t.nameAr : t.nameFr }));
  });
  const [costs, setCosts] = useState<number[][]>(() => {
    if (!_initTpl) return blankCosts(3, 3);
    return _initTpl.costs.map((row) => [...row]);
  });
  const [forbidden, setForbidden] = useState<boolean[][]>(() => {
    if (!_initTpl) return blankForbidden(3, 3);
    const m = _initTpl.resources.length;
    const n = _initTpl.tasks.length;
    const f = blankForbidden(m, n);
    if (_initTpl.forbiddenCells) {
      for (const [i, j] of _initTpl.forbiddenCells) {
        if (i < m && j < n) f[i][j] = true;
      }
    }
    return f;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Load template ───────────────────────────────────────────────────────────
  function loadTemplate(key: SectorKey, lang: "fr" | "ar") {
    const tpl = TEMPLATES[key];
    if (!tpl) {
      setResources(blankResources());
      setTasks(blankTasks());
      setCosts(blankCosts(3, 3));
      setForbidden(blankForbidden(3, 3));
      setName("");
      setUnit("");
      setObjectiveType("minimize");
    } else {
      const st = templateToState(tpl, lang);
      setResources(st.resources);
      setTasks(st.tasks);
      setCosts(st.costs);
      setForbidden(st.forbidden);
      setName(lang === "ar" ? tpl.nameAr : tpl.nameFr);
      setUnit(lang === "ar" ? tpl.unitAr : tpl.unitFr);
      setObjectiveType(tpl.objectiveType);
    }
    setErrors({});
  }

  const handleSectorSelect = (key: SectorKey) => {
    setSector(key);
    loadTemplate(key, language);
    setStep("form");
  };

  const handleResetTemplate = () => {
    loadTemplate(sector, language);
    toast({ title: t("Valeurs réinitialisées", "تم إعادة التعيين") });
  };

  // ── Resources CRUD ──────────────────────────────────────────────────────────
  const addResource = useCallback(() => {
    const n = tasks.length;
    setResources((prev) => [...prev, { name: "" }]);
    setCosts((prev) => [...prev, Array(n).fill(0)]);
    setForbidden((prev) => [...prev, Array(n).fill(false)]);
  }, [tasks.length]);

  const removeResource = useCallback((i: number) => {
    if (resources.length <= 2) return;
    setResources((prev) => prev.filter((_, idx) => idx !== i));
    setCosts((prev) => prev.filter((_, idx) => idx !== i));
    setForbidden((prev) => prev.filter((_, idx) => idx !== i));
  }, [resources.length]);

  const updateResource = useCallback((i: number, name: string) => {
    setResources((prev) => prev.map((r, idx) => idx === i ? { name } : r));
  }, []);

  // ── Tasks CRUD ──────────────────────────────────────────────────────────────
  const addTask = useCallback(() => {
    setTasks((prev) => [...prev, { name: "" }]);
    setCosts((prev) => prev.map((row) => [...row, 0]));
    setForbidden((prev) => prev.map((row) => [...row, false]));
  }, []);

  const removeTask = useCallback((j: number) => {
    if (tasks.length <= 2) return;
    setTasks((prev) => prev.filter((_, idx) => idx !== j));
    setCosts((prev) => prev.map((row) => row.filter((_, idx) => idx !== j)));
    setForbidden((prev) => prev.map((row) => row.filter((_, idx) => idx !== j)));
  }, [tasks.length]);

  const updateTask = useCallback((j: number, name: string) => {
    setTasks((prev) => prev.map((tk, idx) => idx === j ? { name } : tk));
  }, []);

  // ── Cost / forbidden updates ─────────────────────────────────────────────────
  const updateCost = useCallback((i: number, j: number, v: number) => {
    setCosts((prev) =>
      prev.map((row, ri) => ri === i ? row.map((c, ci) => ci === j ? v : c) : row)
    );
  }, []);

  const toggleForbidden = useCallback((i: number, j: number) => {
    setForbidden((prev) =>
      prev.map((row, ri) => ri === i ? row.map((v, ci) => ci === j ? !v : v) : row)
    );
  }, []);

  // ── Non-square detection ─────────────────────────────────────────────────────
  const m = resources.length;
  const n = tasks.length;
  const isSquare = m === n;
  const needsDummyResource = !isSquare && m < n;
  const needsDummyTask     = !isSquare && m > n;

  // ── Forbidden row/col validation ─────────────────────────────────────────────
  const forbiddenRowCheck = resources.map((_, i) => forbidden[i]?.every(Boolean) ?? false);
  const forbiddenColCheck = tasks.map((_, j) => forbidden.every((row) => row[j]));

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};

    if (!name.trim()) errs["name"] = t("Nom du problème requis", "اسم المسألة مطلوب");

    resources.forEach((r, i) => {
      if (!r.name.trim()) errs[`res_${i}`] = t("Nom requis", "الاسم مطلوب");
    });

    tasks.forEach((tk, j) => {
      if (!tk.name.trim()) errs[`task_${j}`] = t("Nom requis", "الاسم مطلوب");
    });

    costs.forEach((row, i) =>
      row.forEach((c, j) => {
        if (!forbidden[i][j] && (isNaN(c) || c < 0))
          errs[`cost_${i}_${j}`] = t("Valeur invalide", "قيمة غير صحيحة");
      })
    );

    forbiddenRowCheck.forEach((allForbidden, i) => {
      if (allForbidden)
        errs[`row_${i}`] = t(
          `Ressource ${i + 1} : toutes les affectations sont interdites`,
          `المورد ${i + 1}: جميع التوزيعات محظورة`
        );
    });

    forbiddenColCheck.forEach((allForbidden, j) => {
      if (allForbidden)
        errs[`col_${j}`] = t(
          `Tâche ${j + 1} : toutes les affectations sont interdites`,
          `المهمة ${j + 1}: جميع التوزيعات محظورة`
        );
    });

    return errs;
  }

  // ── Continue ─────────────────────────────────────────────────────────────────
  const handleContinue = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast({
        variant: "destructive",
        title: t("Erreurs de saisie", "أخطاء في الإدخال"),
        description: t(
          "Veuillez corriger les champs en rouge avant de continuer.",
          "يرجى تصحيح الحقول المحددة باللون الأحمر قبل المتابعة."
        ),
      });
      return;
    }
    setErrors({});

    setProblem({
      name: name || t("Problème d'affectation", "مسألة توزيع"),
      sector,
      objectiveType,
      resources,
      tasks,
      costs,
      forbidden,
    });

    setLocation("/assignment/solution");
  };

  // ── Forbidden summary ────────────────────────────────────────────────────────
  const forbiddenCount = forbidden.flat().filter(Boolean).length;

  // ── Step 1: sector selector ──────────────────────────────────────────────────
  if (step === "select") return <SectorSelector onSelect={handleSectorSelect} />;

  // ── Step 2: form ─────────────────────────────────────────────────────────────
  const errorCount = Object.keys(errors).length;
  const sectorLabel = SECTOR_LABELS[sector];

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">

      {/* Stage bar + breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <StageBar current={1} />
        <Button variant="ghost" size="sm" onClick={() => setStep("select")} className="self-start sm:self-auto">
          <ChevronLeft className={cn("w-4 h-4 mr-1", isAr && "rotate-180")} />
          {t("Changer de secteur", "تغيير القطاع")}
        </Button>
      </div>

      {/* Header card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {isAr ? sectorLabel.ar : sectorLabel.fr}
                </Badge>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs",
                    objectiveType === "minimize"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-green-100 text-green-700"
                  )}
                >
                  {objectiveType === "minimize"
                    ? t("↓ Minimisation", "↓ تقليل")
                    : t("↑ Maximisation", "↑ تعظيم")}
                </Badge>
                {forbiddenCount > 0 && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <Ban className="w-3 h-3" />
                    {forbiddenCount} {t("interdite(s)", "محظورة")}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xl">
                {t("Saisie des données — Problème d'Affectation", "إدخال البيانات — مسألة التوزيع")}
              </CardTitle>
              <CardDescription>
                {t(
                  "Définissez les ressources, les tâches et la matrice des coûts/performances.",
                  "حدد الموارد والمهام ومصفوفة التكاليف/الأداء."
                )}
              </CardDescription>
            </div>
            {sector !== "custom" && (
              <Button variant="ghost" size="sm" onClick={handleResetTemplate} className="shrink-0 gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                {t("Réinitialiser", "إعادة تعيين")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Problem name + objective + unit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {t("Nom du problème", "اسم المسألة")}
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("Ex. Affectation trimestrielle Q3 2026", "مثال. التوزيع الربعي ق3 2026")}
                className={cn(errors["name"] && "border-red-400")}
              />
              {errors["name"] && (
                <p className="text-xs text-red-500">{errors["name"]}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {t("Unité (optionnel)", "الوحدة (اختياري)")}
              </label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={t("Ex. heures, kDA, score…", "مثال. ساعات، دج، نقاط…")}
              />
            </div>
          </div>

          {/* Objective selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("Type d'objectif", "نوع الهدف")}
            </label>
            <div className="flex gap-3 flex-wrap">
              {(["minimize", "maximize"] as const).map((obj) => (
                <button
                  key={obj}
                  type="button"
                  onClick={() => setObjectiveType(obj)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                    objectiveType === obj
                      ? obj === "minimize"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-green-500 bg-green-50 text-green-700"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  {obj === "minimize" ? (
                    <>
                      <span className="text-lg font-bold">↓</span>
                      {t("Minimiser les coûts / durées", "تقليل التكاليف / الأوقات")}
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-bold">↑</span>
                      {t("Maximiser les performances / profits", "تعظيم الأداء / الأرباح")}
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Non-square alert */}
      {!isSquare && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertTitle className="text-amber-800">
            {t("Matrice non carrée — Équilibrage automatique", "مصفوفة غير مربعة — موازنة تلقائية")}
          </AlertTitle>
          <AlertDescription className="text-amber-700 text-sm">
            {needsDummyResource
              ? t(
                  `Le problème comporte ${m} ressource(s) et ${n} tâche(s). Une ressource fictive sera automatiquement ajoutée (coûts = 0) pour équilibrer la matrice à ${n}×${n} lors de la résolution.`,
                  `المسألة تحتوي على ${m} مورد/موارد و${n} مهمة/مهام. سيتم إضافة مورد وهمي تلقائياً (تكاليف = 0) لتوازن المصفوفة إلى ${n}×${n} عند الحل.`
                )
              : t(
                  `Le problème comporte ${m} ressource(s) et ${n} tâche(s). Une tâche fictive sera automatiquement ajoutée (coûts = 0) pour équilibrer la matrice à ${m}×${m} lors de la résolution.`,
                  `المسألة تحتوي على ${m} مورد/موارد و${n} مهمة/مهام. ستتم إضافة مهمة وهمية تلقائياً (تكاليف = 0) لتوازن المصفوفة إلى ${m}×${m} عند الحل.`
                )
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Forbidden hint */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <Ban className="w-3.5 h-3.5 shrink-0" />
        <span>
          {t(
            "Survolez une cellule et cliquez sur l'icône 🚫 pour la marquer comme interdite. Les cellules interdites seront ignorées lors de la résolution.",
            "مرر الماوس فوق خلية وانقر على أيقونة 🚫 لتمييزها كمحظورة. ستُتجاهل الخلايا المحظورة عند الحل."
          )}
        </span>
      </div>

      {/* Matrix grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">
              {t("Matrice d'affectation", "مصفوفة التوزيع")}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {m} × {n}
                {unit && <span className="ml-1">({unit})</span>}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
                {t("Interdit", "محظور")}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded bg-background border border-border" />
                {objectiveType === "minimize" ? t("Coût", "تكلفة") : t("Score", "نقاط")}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {/* Top-left corner: resource label */}
                  <th className="sticky left-0 z-20 bg-muted/80 p-2 border-b border-r min-w-[140px] max-w-[180px]">
                    <div className="text-xs font-semibold text-muted-foreground text-left px-1">
                      {t("Ressource / Tâche", "مورد / مهمة")}
                    </div>
                  </th>

                  {/* Task name headers */}
                  {tasks.map((tk, j) => (
                    <th key={j} className="p-1.5 border-b border-r min-w-[100px] bg-muted/40">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <Input
                            value={tk.name}
                            onChange={(e) => updateTask(j, e.target.value)}
                            placeholder={t(`Tâche ${j + 1}`, `مهمة ${j + 1}`)}
                            className={cn(
                              "h-7 text-xs text-center px-1 bg-background",
                              errors[`task_${j}`] && "border-red-400"
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => removeTask(j)}
                            disabled={tasks.length <= 2}
                            className="text-muted-foreground hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed shrink-0 transition-colors"
                            title={t("Supprimer cette tâche", "حذف هذه المهمة")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {errors[`task_${j}`] && (
                          <p className="text-[10px] text-red-500 text-center">{errors[`task_${j}`]}</p>
                        )}
                        {forbiddenColCheck[j] && (
                          <p className="text-[10px] text-red-500 text-center">
                            {t("Col. entièrement interdite", "العمود محظور كلياً")}
                          </p>
                        )}
                      </div>
                    </th>
                  ))}

                  {/* Add task column button */}
                  <th className="p-1.5 border-b bg-muted/20 w-10">
                    <button
                      type="button"
                      onClick={addTask}
                      disabled={tasks.length >= 8}
                      className="w-7 h-7 rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center text-primary hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mx-auto"
                      title={t("Ajouter une tâche", "إضافة مهمة")}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody>
                {resources.map((res, i) => (
                  <tr key={i} className="group/row">
                    {/* Resource name (sticky left) */}
                    <td className="sticky left-0 z-10 bg-muted/50 p-1.5 border-b border-r">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => removeResource(i)}
                            disabled={resources.length <= 2}
                            className="text-muted-foreground hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed shrink-0 transition-colors opacity-0 group-hover/row:opacity-100"
                            title={t("Supprimer cette ressource", "حذف هذا المورد")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <Input
                            value={res.name}
                            onChange={(e) => updateResource(i, e.target.value)}
                            placeholder={t(`Ressource ${i + 1}`, `مورد ${i + 1}`)}
                            className={cn(
                              "h-7 text-xs px-1.5 bg-background flex-1",
                              errors[`res_${i}`] && "border-red-400"
                            )}
                          />
                        </div>
                        {errors[`res_${i}`] && (
                          <p className="text-[10px] text-red-500 pl-5">{errors[`res_${i}`]}</p>
                        )}
                        {(errors[`row_${i}`] || forbiddenRowCheck[i]) && (
                          <p className="text-[10px] text-red-500 pl-5">
                            {t("Ligne entièrement interdite", "الصف محظور كلياً")}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Cost cells */}
                    {tasks.map((_, j) => (
                      <td key={j} className="p-1 border-b border-r">
                        <MatrixCell
                          value={costs[i]?.[j] ?? 0}
                          forbidden={forbidden[i]?.[j] ?? false}
                          isMax={objectiveType === "maximize"}
                          onChange={(v) => updateCost(i, j, v)}
                          onToggleForbidden={() => toggleForbidden(i, j)}
                          hasError={!!errors[`cost_${i}_${j}`]}
                        />
                      </td>
                    ))}

                    {/* Extra col (aligns with add-task button) */}
                    <td className="border-b" />
                  </tr>
                ))}

                {/* Add resource row */}
                <tr>
                  <td className="sticky left-0 z-10 bg-background p-2 border-b border-r" colSpan={1}>
                    <button
                      type="button"
                      onClick={addResource}
                      disabled={resources.length >= 8}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t("Ajouter une ressource", "إضافة مورد")}
                    </button>
                  </td>
                  <td colSpan={tasks.length + 1} className="border-b bg-muted/10" />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Grid footer info */}
          <div className="px-4 py-2 border-t bg-muted/20 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span>
              {m} {t("ressource(s)", "مورد/موارد")} × {n} {t("tâche(s)", "مهمة/مهام")}
              {" = "}
              {m * n} {t("affectations possibles", "توزيع ممكن")}
            </span>
            {forbiddenCount > 0 && (
              <span className="text-red-600 flex items-center gap-1">
                <Ban className="w-3 h-3" />
                {forbiddenCount} {t("interdite(s)", "محظورة")}
              </span>
            )}
            {!isSquare && (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {needsDummyResource
                  ? t("1 ressource fictive sera ajoutée", "سيُضاف مورد وهمي واحد")
                  : t("1 tâche fictive sera ajoutée", "ستُضاف مهمة وهمية واحدة")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Global errors */}
      {errorCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>{t("Erreurs détectées", "أخطاء مكتشفة")}</AlertTitle>
          <AlertDescription className="space-y-1">
            {Object.values(errors).slice(0, 5).map((e, i) => (
              <div key={i} className="text-sm">• {e}</div>
            ))}
            {errorCount > 5 && (
              <div className="text-sm">• …{t(`et ${errorCount - 5} autre(s)`, `و${errorCount - 5} آخر`)}</div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Bottom action bar */}
      <div className="flex items-center justify-between pt-2 border-t gap-4 flex-wrap">
        <Button variant="outline" onClick={() => setStep("select")}>
          <ChevronLeft className={cn("w-4 h-4 mr-1.5", isAr && "rotate-180")} />
          {t("Changer de secteur", "تغيير القطاع")}
        </Button>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isSquare ? (
            <span className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t("Matrice carrée", "مصفوفة مربعة")} {m}×{m}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              {m}×{n} — {needsDummyResource
                ? t("ressource fictive à ajouter", "مورد وهمي يُضاف")
                : t("tâche fictive à ajouter", "مهمة وهمية تُضاف")}
            </span>
          )}
        </div>

        <Button size="lg" onClick={handleContinue} className="gap-2 px-8">
          <Zap className="w-4 h-4" />
          {t("Continuer vers la solution", "المتابعة نحو الحل")}
          <ArrowRight className={cn("w-4 h-4", isAr && "rotate-180")} />
        </Button>
      </div>

    </div>
  );
}
