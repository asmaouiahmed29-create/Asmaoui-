import { useState, useCallback, useRef, useMemo } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { useAssignmentHistory } from "@/lib/AssignmentHistoryContext";
import type { AssignmentSectorKey } from "@/lib/AssignmentHistoryContext";
import { generateAssignmentPDF } from "@/lib/generateAssignmentPDF";
import { runHungarian, type HungarianResult, type HungarianCell } from "@/lib/hungarianAlgorithm";
import type { AssignmentProblem } from "@/lib/AssignmentContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  Factory, ShoppingBag, Users, Leaf, PenLine, Zap,
  Plus, Trash2, ArrowRight,
  RotateCcw, AlertTriangle, CheckCircle2, Info,
  Ban, Target, GitMerge, BarChart3, BookmarkPlus, Download,
  Star, Check, ArrowLeft, ChevronLeft, ChevronRight, Lightbulb,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type SectorKey = "services" | "agriculture" | "industry" | "trade" | "energy" | "custom";

interface Resource { name: string; }
interface Task     { name: string; }

// ── Sector cards (compact VarianceAnalysis style) ─────────────────────────────
const SECTOR_CARDS: Array<{
  key: SectorKey;
  icon: React.ElementType;
  nameFr: string; nameAr: string;
  descFr: string; descAr: string;
}> = [
  {
    key: "services",
    icon: Users,
    nameFr: "Services",    nameAr: "الخدمات",
    descFr: "Techniciens aux interventions — maximisation",
    descAr: "تقنيون للتدخلات — تعظيم الأداء",
  },
  {
    key: "agriculture",
    icon: Leaf,
    nameFr: "Agriculture", nameAr: "الفلاحة",
    descFr: "Équipes de récolte aux parcelles — non carré",
    descAr: "فرق الحصاد على القطع — غير مربعة",
  },
  {
    key: "industry",
    icon: Factory,
    nameFr: "Industrie",   nameAr: "الصناعة",
    descFr: "Machines aux ordres de fabrication",
    descAr: "آلات على أوامر الإنتاج",
  },
  {
    key: "trade",
    icon: ShoppingBag,
    nameFr: "Commerce",    nameAr: "التجارة",
    descFr: "Commerciaux aux zones — cellules interdites",
    descAr: "مندوبون على المناطق — خلايا محظورة",
  },
  {
    key: "energy",
    icon: Zap,
    nameFr: "Énergie",     nameAr: "الطاقة",
    descFr: "Équipes maintenance aux sous-stations",
    descAr: "فرق الصيانة على المحطات الكهربائية",
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

  industry: {
    nameFr: "Affectation Machines — SNVI Rouiba",
    nameAr: "توزيع الآلات — سنفي الرويبة",
    objectiveType: "minimize",
    unitFr: "heures",
    unitAr: "ساعات",
    resources: [
      { nameFr: "Machine CNC",      nameAr: "آلة CNC"       },
      { nameFr: "Machine Presse",   nameAr: "آلة الضغط"     },
      { nameFr: "Machine Soudure",  nameAr: "آلة اللحام"    },
      { nameFr: "Machine Peinture", nameAr: "آلة الطلاء"    },
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

  trade: {
    nameFr: "Affectation Commerciale — Numidis SPA (Groupe Cevital)",
    nameAr: "التوزيع التجاري — نوميديس (مجموعة سيفيتال)",
    objectiveType: "minimize",
    unitFr: "kDA/jour",
    unitAr: "ألف دج/يوم",
    resources: [
      { nameFr: "Commercial Alger",      nameAr: "مندوب الجزائر"   },
      { nameFr: "Commercial Oran",        nameAr: "مندوب وهران"      },
      { nameFr: "Commercial Constantine", nameAr: "مندوب قسنطينة"   },
      { nameFr: "Commercial Annaba",      nameAr: "مندوب عنابة"     },
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

  energy: {
    nameFr: "Affectation Maintenance — Sonelgaz, Alger",
    nameAr: "توزيع الصيانة — سونلغاز، الجزائر",
    objectiveType: "minimize",
    unitFr: "heures",
    unitAr: "ساعات",
    resources: [
      { nameFr: "Équipe Haute Tension",  nameAr: "فريق الضغط العالي" },
      { nameFr: "Équipe Transformateurs", nameAr: "فريق المحولات"    },
      { nameFr: "Équipe Distribution",   nameAr: "فريق التوزيع"      },
      { nameFr: "Équipe Contrôle-Cmd",   nameAr: "فريق التحكم"       },
    ],
    tasks: [
      { nameFr: "S/S Ain Benian",   nameAr: "محطة عين البنيان"  },
      { nameFr: "S/S El Harrach",   nameAr: "محطة الحراش"        },
      { nameFr: "S/S Kouba",        nameAr: "محطة القبة"          },
      { nameFr: "S/S Hussein Dey",  nameAr: "محطة حسين داي"      },
    ],
    costs: [
      [ 6, 10, 14,  8],
      [ 9,  5, 11, 13],
      [12,  8,  6, 10],
      [15, 12,  9,  7],
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

const TOL = 1e-6;

function fmt(n: number, lang: string, d = 0): string {
  if (!isFinite(n)) return "∞";
  return n.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
}

// ── Matrix Cell ───────────────────────────────────────────────────────────────
function MatrixCell({
  value, forbidden, isMax, onChange, onToggleForbidden, hasError,
}: {
  value: number;
  forbidden: boolean;
  isMax: boolean;
  onChange: (v: number) => void;
  onToggleForbidden: () => void;
  hasError?: boolean;
}) {
  void isMax;
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
      <button
        type="button"
        onClick={onToggleForbidden}
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

// ── DisplayStep model (for step-by-step solver) ───────────────────────────────
interface DisplayStep {
  kind: "initial" | "row-reduction" | "col-reduction" | "covering";
  matrix: number[][];
  label: { fr: string; ar: string };
  rowCovered?: boolean[];
  colCovered?: boolean[];
  matchingZeros?: HungarianCell[];
  minUncovered?: number | null;
  isOptimal?: boolean;
  reductionValues?: number[];
}

function buildDisplaySteps(res: HungarianResult): DisplayStep[] {
  const steps: DisplayStep[] = [
    {
      kind: "initial",
      matrix: res.workingMatrixInitial,
      label: { fr: "Matrice initiale (coûts + interdictions)", ar: "المصفوفة الابتدائية (التكاليف + الممنوعات)" },
    },
    {
      kind: "row-reduction",
      matrix: res.rowReducedMatrix,
      label: { fr: "Réduction des lignes", ar: "اختزال الصفوف" },
      reductionValues: res.rowMins,
    },
    {
      kind: "col-reduction",
      matrix: res.colReducedMatrix,
      label: { fr: "Réduction des colonnes", ar: "اختزال الأعمدة" },
      reductionValues: res.colMins,
    },
  ];
  res.iterations.forEach((it, idx) => {
    steps.push({
      kind: "covering",
      matrix: it.matrix,
      label: it.isOptimal
        ? { fr: `Couverture ${idx + 1} — Optimal atteint`, ar: `التغطية ${idx + 1} — تم الوصول للحل الأمثل` }
        : { fr: `Couverture & ajustement ${idx + 1}`, ar: `التغطية والتعديل ${idx + 1}` },
      rowCovered: it.rowCovered,
      colCovered: it.colCovered,
      matchingZeros: it.matchingZeros,
      minUncovered: it.minUncovered,
      isOptimal: it.isOptimal,
    });
  });
  return steps;
}

// ── Hungarian Matrix Table ─────────────────────────────────────────────────────
function HungarianMatrixTable({
  step, m, n, resourceNames, taskNames, forbidden, language,
}: {
  step: DisplayStep;
  m: number; n: number;
  resourceNames: string[];
  taskNames: string[];
  forbidden: boolean[][];
  language: string;
}) {
  const N = step.matrix.length;
  const matchSet = new Set((step.matchingZeros ?? []).map(c => `${c.i},${c.j}`));

  function cellClasses(i: number, j: number): string {
    const isDummy = i >= m || j >= n;
    const isForbidden = i < m && j < n && forbidden[i][j];
    const rc = step.rowCovered?.[i] ?? false;
    const cc = step.colCovered?.[j] ?? false;
    const isMatch = matchSet.has(`${i},${j}`);
    const val = step.matrix[i][j];
    const isMinUncovered = step.minUncovered != null && !rc && !cc && Math.abs(val - step.minUncovered) < TOL;

    const classes: string[] = ["border", "border-border", "text-center", "p-2", "relative", "transition-colors"];
    if (isMatch) classes.push("bg-green-100 ring-2 ring-green-500 ring-inset");
    else if (rc && cc) classes.push("bg-red-50");
    else if (rc || cc) classes.push("bg-slate-100");
    else if (isDummy) classes.push("bg-orange-50/60");
    else classes.push("bg-white");
    if (isForbidden) classes.push("!bg-red-100");
    if (isMinUncovered) classes.push("ring-2 ring-amber-400 ring-inset");
    void isMatch;
    return classes.join(" ");
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs" style={{ minWidth: (N + 1) * 88 }}>
        <thead>
          <tr>
            <th className="p-2 text-left text-muted-foreground w-28" />
            {taskNames.map((tn, j) => (
              <th key={j} className={cn("p-2 text-center font-semibold text-foreground", step.colCovered?.[j] && "bg-slate-200/60 rounded-t")} style={{ width: 88 }}>
                <div className="truncate max-w-[80px] mx-auto">{tn}</div>
                {j >= n && <span className="text-[9px] text-orange-600">({language === "ar" ? "وهمية" : "fictive"})</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resourceNames.map((rn, i) => (
            <tr key={i}>
              <td className={cn("p-2 pr-3 text-right font-semibold text-foreground whitespace-nowrap", step.rowCovered?.[i] && "bg-slate-200/60 rounded-l")}>
                <div className="truncate max-w-[110px]">{rn}</div>
                {i >= m && <span className="text-[9px] text-orange-600 block">({language === "ar" ? "وهمية" : "fictive"})</span>}
              </td>
              {taskNames.map((_, j) => {
                const val = step.matrix[i][j];
                const isForbiddenCell = i < m && j < n && forbidden[i][j];
                return (
                  <td key={j} className={cellClasses(i, j)} style={{ height: 44 }}>
                    {isForbiddenCell ? (
                      <Ban className="w-3.5 h-3.5 text-red-500 mx-auto" />
                    ) : (
                      <span className={cn("font-medium", Math.abs(val) < TOL ? "text-blue-700 font-bold" : "text-foreground")}>
                        {fmt(val, language, 0)}
                      </span>
                    )}
                    {matchSet.has(`${i},${j}`) && <Check className="w-3 h-3 text-green-600 absolute top-0.5 right-0.5" />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Step Explanation ──────────────────────────────────────────────────────────
function StepExplanation({ step, language, isMax }: { step: DisplayStep; language: string; isMax: boolean }) {
  const tl = (fr: string, ar: string) => language === "ar" ? ar : fr;

  if (step.kind === "initial") {
    return (
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 text-sm">{tl("Matrice de départ", "المصفوفة الأولية")}</AlertTitle>
        <AlertDescription className="text-blue-700 text-xs">
          {isMax
            ? tl(
                "Comme l'objectif est la maximisation, la matrice a été convertie en coûts équivalents (valeur maximale − valeur de la cellule) afin d'appliquer la méthode Hongroise, qui minimise toujours.",
                "بما أن الهدف هو التعظيم، تم تحويل المصفوفة إلى تكاليف معادلة (القيمة القصوى − قيمة الخلية) لتطبيق الطريقة الهنغارية التي تُقلّل دائماً."
              )
            : tl(
                "La matrice des coûts est utilisée telle quelle. Les cellules interdites (🚫) reçoivent un coût très élevé pour empêcher leur sélection.",
                "تُستخدم مصفوفة التكاليف كما هي. الخلايا المحظورة (🚫) تُعطى تكلفة مرتفعة جداً لمنع اختيارها."
              )}
        </AlertDescription>
      </Alert>
    );
  }
  if (step.kind === "row-reduction") {
    return (
      <Alert className="border-amber-200 bg-amber-50">
        <Target className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 text-sm">{tl("① Réduction des lignes", "① اختزال الصفوف")}</AlertTitle>
        <AlertDescription className="text-amber-700 text-xs">
          {tl(
            "Pour chaque ligne, on soustrait le plus petit coût de la ligne à toutes ses cellules. Chaque ligne obtient ainsi au moins un zéro.",
            "لكل صف، يُطرح أصغر تكلفة في الصف من جميع خلاياه. بهذا يحصل كل صف على صفر واحد على الأقل."
          )}
        </AlertDescription>
      </Alert>
    );
  }
  if (step.kind === "col-reduction") {
    return (
      <Alert className="border-amber-200 bg-amber-50">
        <Target className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 text-sm">{tl("② Réduction des colonnes", "② اختزال الأعمدة")}</AlertTitle>
        <AlertDescription className="text-amber-700 text-xs">
          {tl(
            "Pour chaque colonne, on soustrait le plus petit coût de la colonne à toutes ses cellules. Chaque colonne obtient ainsi au moins un zéro.",
            "لكل عمود، يُطرح أصغر تكلفة في العمود من جميع خلاياه. بهذا يحصل كل عمود على صفر واحد على الأقل."
          )}
        </AlertDescription>
      </Alert>
    );
  }
  if (step.isOptimal) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800 text-sm">{tl("Solution optimale atteinte ✓", "تم الوصول إلى الحل الأمثل ✓")}</AlertTitle>
        <AlertDescription className="text-green-700 text-xs">
          {tl(
            "Le nombre minimal de lignes nécessaires pour couvrir tous les zéros est égal à la taille de la matrice (N). Une affectation complète à coût nul (sur la matrice réduite) est donc possible — indiquée par les cases cochées ✓.",
            "أصبح عدد الخطوط الأدنى اللازم لتغطية جميع الأصفار مساوياً لحجم المصفوفة (N). يمكن بذلك إيجاد توزيع كامل بتكلفة صفرية (على المصفوفة المختزلة) — موضح بالخلايا المؤشر عليها بـ ✓."
          )}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="space-y-2">
      <Alert className="border-slate-200 bg-slate-50">
        <GitMerge className="h-4 w-4 text-slate-600" />
        <AlertTitle className="text-slate-800 text-sm">{tl("③ Couverture minimale des zéros", "③ التغطية الدنيا للأصفار")}</AlertTitle>
        <AlertDescription className="text-slate-700 text-xs">
          {tl(
            "On cherche le nombre minimal de lignes (horizontales/verticales) couvrant tous les zéros. Ce nombre est encore inférieur à N : la matrice n'est pas encore optimale.",
            "يُبحث عن أقل عدد من الخطوط (أفقية/رأسية) تغطي جميع الأصفار. هذا العدد لا يزال أقل من N: المصفوفة ليست مثلى بعد."
          )}
        </AlertDescription>
      </Alert>
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertTitle className="text-red-800 text-sm">{tl("④ Ajustement", "④ التعديل")}</AlertTitle>
        <AlertDescription className="text-red-700 text-xs">
          {tl(
            `On soustrait la plus petite valeur non couverte (${fmt(step.minUncovered ?? 0, language)}) de toutes les cellules non couvertes, et on l'ajoute aux cellules couvertes deux fois (intersections des lignes). On répète ensuite la couverture.`,
            `تُطرح أصغر قيمة غير مغطاة (${fmt(step.minUncovered ?? 0, language)}) من جميع الخلايا غير المغطاة، وتُضاف إلى الخلايا المغطاة مرتين (تقاطعات الخطوط). ثم تُكرر عملية التغطية.`
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ── Analysis / Recommendations builders ──────────────────────────────────────
interface AnalysisLine { fr: string; ar: string; }
interface Recommendation {
  icon: string;
  priority: "high" | "medium" | "low";
  titleFr: string; titleAr: string;
  descFr: string;  descAr: string;
}

function buildAnalysisLines(
  result: HungarianResult,
  isMax: boolean,
  unit: string,
  lang: string,
): AnalysisLine[] {
  const {
    m, n, N, resourceNames, taskNames, originalCosts, finalAssignment,
    unassignedResources, unassignedTasks, hasAlternativeOptima,
    isInfeasible, totalCostReal, iterations, forbidden,
  } = result;

  const lines: AnalysisLine[] = [];
  const realPairs = finalAssignment.filter(({ i, j }) => i < m && j < n);
  const forbiddenCount = forbidden.flat().filter(Boolean).length;
  const isSquare = m === n;
  const kIter = iterations.length;
  const us = unit ? ` ${unit}` : "";

  // 1. Problem scope
  lines.push({
    fr: `La matrice d'affectation compte ${m} ressource${m > 1 ? "s" : ""} et ${n} tâche${n > 1 ? "s" : ""} — matrice ${isSquare ? "carrée" : "non carrée"} (${m}×${n}). L'objectif est la ${isMax ? "maximisation des performances" : "minimisation des coûts"}.`,
    ar: `تضم مصفوفة التوزيع ${m} ${m > 1 ? "موارد" : "مورد"} و${n} ${n > 1 ? "مهام" : "مهمة"} — مصفوفة ${isSquare ? "مربعة" : "غير مربعة"} (${m}×${n}). الهدف هو ${isMax ? "تعظيم الأداء" : "تقليل التكاليف"}.`,
  });

  // 2. Optimal value with meaning
  const valFmt = fmt(totalCostReal, lang);
  if (isMax) {
    lines.push({
      fr: `L'algorithme a produit un score de performance optimal de ${valFmt}${us}. Chaque ressource est affectée à la tâche où son avantage comparatif est maximal — aucune permutation alternative ne peut dépasser ce total.`,
      ar: `أنتجت الخوارزمية درجة أداء مثلى تبلغ ${valFmt}${us}. كل مورد مُخصَّص للمهمة التي يتميز فيها نسبياً أكثر — لا توجد أي مبادلة بديلة تتجاوز هذا المجموع.`,
    });
  } else {
    lines.push({
      fr: `La valeur optimale obtenue est ${valFmt}${us}. Parmi toutes les permutations d'affectation admissibles, cette combinaison minimise le coût total — aucune autre affectation ne peut faire mieux tout en respectant les contraintes.`,
      ar: `القيمة المثلى المُحققة هي ${valFmt}${us}. من بين جميع تباديل التوزيع المقبولة، هذه التركيبة تُقلّل إجمالي التكلفة إلى أدنى مستوى ممكن مع احترام القيود.`,
    });
  }

  // 3. Algorithm complexity
  if (kIter <= 1) {
    lines.push({
      fr: `La résolution n'a nécessité que ${kIter === 0 ? "aucune" : "une seule"} itération de couverture : la matrice était déjà quasi-optimale après les étapes de réduction initiale. Le problème présente une faible complexité combinatoire.`,
      ar: `لم تحتج الخوارزمية سوى ${kIter === 0 ? "أي" : "تكرار واحد"} من خطوات التغطية: كانت المصفوفة شبه مثلى بعد الاختزال مباشرةً — تعقيد تركيبي منخفض.`,
    });
  } else if (kIter <= 3) {
    lines.push({
      fr: `La résolution a nécessité ${kIter} itérations de couverture et d'ajustement — une complexité modérée, reflet d'une concurrence entre ressources pour les meilleures tâches.`,
      ar: `احتاجت الخوارزمية إلى ${kIter} تكرارات من التغطية والتعديل — تعقيد معتدل يعكس تنافساً بين الموارد على أفضل المهام.`,
    });
  } else {
    lines.push({
      fr: `La résolution a requis ${kIter} itérations de couverture : le problème présente une structure combinatoire dense avec de nombreuses ressources en compétition. Ce niveau de complexité est entièrement pris en charge par l'algorithme.`,
      ar: `احتاجت الخوارزمية إلى ${kIter} تكرارات من التغطية: المسألة ذات بنية تركيبية كثيفة مع تنافس شديد بين الموارد على أفضل المهام — هذا التعقيد مُعالَج بالكامل بواسطة الخوارزمية.`,
    });
  }

  // 4. Non-square balancing
  if (!isSquare) {
    const addedFr = m < n ? "ressource fictive" : "tâche fictive";
    const addedAr = m < n ? "مورد وهمي" : "مهمة وهمية";
    const unassigned = m < n ? unassignedResources : unassignedTasks;
    const unassignedNames = (m < n
      ? unassignedResources.map(i => resourceNames[i])
      : unassignedTasks.map(j => taskNames[j]));
    lines.push({
      fr: `La matrice étant non carrée (${m}×${n}), une ${addedFr} a été introduite pour équilibrer à ${N}×${N}. ${unassigned.length > 0 ? `En conséquence, ${unassignedNames.join(", ")} ${m < n ? "ne reçoit aucune tâche" : "n'est prise en charge par aucune ressource"} dans ce cycle.` : "Toutes les ressources et tâches ont néanmoins été honorées."}`,
      ar: `بما أن المصفوفة غير مربعة (${m}×${n})، أُضيف ${addedAr} لتوازن الحجم إلى ${N}×${N}. ${unassigned.length > 0 ? `نتيجةً لذلك، ${unassignedNames.join("، ")} ${m < n ? "لا تُخصَّص لأي مهمة" : "لا يتكفل بها أي مورد"} في هذه الدورة.` : "مع ذلك، جميع الموارد والمهام تمت تغطيتها."}`,
    });
  }

  // 5. Forbidden cells
  if (forbiddenCount > 0) {
    lines.push({
      fr: `${forbiddenCount} cellule${forbiddenCount > 1 ? "s interdites" : " interdite"} ont restreint l'espace des solutions admissibles. Ces contraintes métier ont été intégralement respectées dans l'affectation finale${isInfeasible ? " — sauf une, dont le non-respect était inévitable pour garantir une affectation complète" : ""}.`,
      ar: `${forbiddenCount} خلية${forbiddenCount > 1 ? " محظورة" : " محظورة"} قيّدت فضاء الحلول المقبولة. احتُرمت هذه القيود المهنية بالكامل في التوزيع النهائي${isInfeasible ? " — باستثناء قيد واحد كان تجاوزه حتمياً لضمان توزيع كامل" : ""}.`,
    });
  }

  // 6. Best and worst pairs
  if (realPairs.length >= 2) {
    const sorted = [...realPairs].sort((a, b) =>
      isMax
        ? originalCosts[b.i][b.j] - originalCosts[a.i][a.j]
        : originalCosts[a.i][a.j] - originalCosts[b.i][b.j]
    );
    const best  = sorted[0];
    const worst = sorted[sorted.length - 1];
    const bestVal  = fmt(originalCosts[best.i][best.j],  lang);
    const worstVal = fmt(originalCosts[worst.i][worst.j], lang);
    const gap = Math.abs(originalCosts[best.i][best.j] - originalCosts[worst.i][worst.j]);
    lines.push(isMax ? {
      fr: `La paire la plus performante est ${resourceNames[best.i]} → ${taskNames[best.j]} (${bestVal}${us}). La moins performante est ${resourceNames[worst.i]} → ${taskNames[worst.j]} (${worstVal}${us}) — un écart de ${fmt(gap, lang)}${us} qui illustre la dispersion des compétences au sein du groupe.`,
      ar: `أفضل زوج من حيث الأداء هو ${resourceNames[best.i]} → ${taskNames[best.j]} (${bestVal}${us}). أضعف زوج هو ${resourceNames[worst.i]} → ${taskNames[worst.j]} (${worstVal}${us}) — بفجوة ${fmt(gap, lang)}${us} تعكس تباين الكفاءات داخل المجموعة.`,
    } : {
      fr: `La paire la moins coûteuse est ${resourceNames[best.i]} → ${taskNames[best.j]} (${bestVal}${us}). La plus coûteuse du plan est ${resourceNames[worst.i]} → ${taskNames[worst.j]} (${worstVal}${us}) — un écart de ${fmt(gap, lang)}${us} inhérent aux contraintes opérationnelles.`,
      ar: `أقل زوج تكلفةً هو ${resourceNames[best.i]} → ${taskNames[best.j]} (${bestVal}${us}). أكثر زوج تكلفةً في الحل هو ${resourceNames[worst.i]} → ${taskNames[worst.j]} (${worstVal}${us}) — بفجوة ${fmt(gap, lang)}${us} ناتجة عن القيود التشغيلية.`,
    });
  }

  // 7. Alternative optima
  if (hasAlternativeOptima) {
    lines.push({
      fr: `Des affectations alternatives existent à la même valeur optimale. L'algorithme a retenu un plan parmi plusieurs équivalents — cette multiplicité laisse une marge de manœuvre pour des critères qualitatifs (équité, charge, préférences d'équipe).`,
      ar: `توجد توزيعات بديلة بنفس القيمة المثلى تماماً. اختارت الخوارزمية خطة واحدة من بين عدة خطط متكافئة — هذا التعدد يُتيح هامشاً للتناوب وفق معايير نوعية (الإنصاف، التوازن، التفضيلات).`,
    });
  }

  return lines;
}

function buildRecommendations(
  result: HungarianResult,
  isMax: boolean,
  unit: string,
  lang: string,
): Recommendation[] {
  const {
    m, n, resourceNames, taskNames, originalCosts, finalAssignment,
    unassignedResources, unassignedTasks, hasAlternativeOptima,
    isInfeasible, forbidden,
  } = result;

  const recs: Recommendation[] = [];
  const realPairs = finalAssignment.filter(({ i, j }) => i < m && j < n);
  const forbiddenCount = forbidden.flat().filter(Boolean).length;
  const isSquare = m === n;
  const us = unit ? ` ${unit}` : "";

  // 1. High — deploy plan
  recs.push({
    icon: "✅",
    priority: "high",
    titleFr: "Déployer immédiatement ce plan d'affectation",
    titleAr: "تطبيق خطة التوزيع هذه فوراً",
    descFr: `L'affectation est mathématiquement optimale — aucune autre combinaison ne fait mieux. Communiquez les ${realPairs.length} affectation${realPairs.length > 1 ? "s" : ""} retenue${realPairs.length > 1 ? "s" : ""} aux responsables concernés, formalisez-les dans un planning et archivez ce rapport comme référence du cycle en cours.`,
    descAr: `التوزيع مضمون رياضياً على أنه مثالي — لا توجد أي تركيبة أخرى تُحقق نتيجة أفضل. أبلغ المسؤولين المعنيين بالتوزيعات الـ ${realPairs.length} المختارة، أدرجها في جدول زمني رسمي، واحتفظ بهذا التقرير كمرجع للدورة الحالية.`,
  });

  // 2. High — infeasible: review forbidden cells
  if (isInfeasible) {
    recs.push({
      icon: "🚫",
      priority: "high",
      titleFr: "Revoir les contraintes d'interdiction — le problème est infaisable",
      titleAr: "مراجعة قيود الحظر — المسألة غير قابلة للحل بالقيود الحالية",
      descFr: `L'algorithme a dû enfreindre une interdiction pour produire une affectation complète. Revoyez vos cellules interdites : l'une d'elles est peut-être trop restrictive ou résulte d'une erreur de saisie. Assouplissez les contraintes ou adaptez les ressources disponibles pour rendre le problème faisable.`,
      descAr: `اضطرت الخوارزمية لتجاوز قيد محظور لإنتاج توزيع كامل. راجع الخلايا المحظورة: ربما إحداها مُقيِّدة أكثر من اللازم أو نتيجة خطأ في الإدخال. خفّف القيود أو اضبط الموارد المتاحة لجعل المسألة قابلة للحل.`,
    });
  }

  // 3. Medium — improve weakest pairing
  if (realPairs.length >= 2) {
    const sorted = [...realPairs].sort((a, b) =>
      isMax
        ? originalCosts[a.i][a.j] - originalCosts[b.i][b.j]
        : originalCosts[b.i][b.j] - originalCosts[a.i][a.j]
    );
    const weakest  = sorted[0];
    const weakVal  = fmt(originalCosts[weakest.i][weakest.j], lang);
    recs.push(isMax ? {
      icon: "📈",
      priority: "medium",
      titleFr: `Renforcer les compétences de ${resourceNames[weakest.i]} sur ${taskNames[weakest.j]}`,
      titleAr: `تعزيز كفاءة ${resourceNames[weakest.i]} على ${taskNames[weakest.j]}`,
      descFr: `La paire ${resourceNames[weakest.i]} → ${taskNames[weakest.j]} affiche le score le plus faible du plan (${weakVal}${us}). Un programme de formation ciblé ou un accompagnement par la ressource la plus performante permettrait d'élever le niveau global et d'améliorer la valeur optimale lors du prochain cycle d'affectation.`,
      descAr: `الزوج ${resourceNames[weakest.i]} → ${taskNames[weakest.j]} يُسجّل أدنى نتيجة في الخطة (${weakVal}${us}). برنامج تدريب مستهدف أو إرشاد من المورد الأعلى أداءً سيرفع المستوى العام ويُحسّن القيمة المثلى في دورة التوزيع القادمة.`,
    } : {
      icon: "💰",
      priority: "medium",
      titleFr: `Réduire le coût du poste ${resourceNames[weakest.i]} → ${taskNames[weakest.j]}`,
      titleAr: `تخفيض تكلفة البند ${resourceNames[weakest.i]} → ${taskNames[weakest.j]}`,
      descFr: `Cette affectation représente le coût unitaire le plus élevé du plan (${weakVal}${us}). Analysez les causes (distance, durée, complexité) et évaluez si une formation, une réorganisation du poste ou un meilleur outillage peut réduire ce coût lors du prochain cycle.`,
      descAr: `يمثل هذا التوزيع أعلى تكلفة وحدوية في الخطة (${weakVal}${us}). حلّل الأسباب (المسافة، المدة، التعقيد) وقيّم إمكانية تخفيض هذا البند عبر التدريب أو إعادة تنظيم الوظيفة أو تحسين الأدوات في الدورة القادمة.`,
    });
  }

  // 4. Medium — use alternative optima
  if (hasAlternativeOptima) {
    recs.push({
      icon: "↔️",
      priority: "medium",
      titleFr: "Exploiter les solutions équivalentes pour des critères secondaires",
      titleAr: "استغلال الحلول المتكافئة لمعايير ثانوية",
      descFr: `Plusieurs affectations donnent exactement la même valeur optimale. Profitez de cette équivalence pour retenir le plan qui satisfait le mieux des critères qualitatifs : équité de la charge de travail, ancienneté, proximité géographique, préférences des équipes ou équilibre social.`,
      descAr: `عدة توزيعات تُعطي نفس القيمة المثلى تماماً. استغل هذا التكافؤ لاختيار الخطة التي تُرضي أكثر المعايير النوعية: العدالة في توزيع العبء، الأقدمية، القُرب الجغرافي، تفضيلات الفِرَق، أو التوازن الاجتماعي.`,
    });
  }

  // 5a. Medium — unassigned resources (idle capacity)
  if (!isSquare && unassignedResources.length > 0) {
    const names = unassignedResources.map(i => resourceNames[i]).join(", ");
    recs.push({
      icon: "🏗️",
      priority: "medium",
      titleFr: `Valoriser la capacité disponible de : ${names}`,
      titleAr: `توظيف الطاقة المتاحة لـ : ${names}`,
      descFr: `${names} ne reçoit aucune tâche dans ce cycle (matrice non carrée). Envisagez de lui confier des tâches transversales, une action de formation, un soutien à une autre équipe, ou planifiez une rotation pour éviter tout sous-emploi prolongé.`,
      descAr: `${names} غير مخصَّصة لأي مهمة في هذه الدورة (مصفوفة غير مربعة). فكّر في تكليفها بمهام عرضية، تدريب، دعم فريق آخر، أو تخطيط تناوب لتفادي البطالة المطوّلة.`,
    });
  }

  // 5b. Medium — unassigned tasks (resource gap)
  if (!isSquare && unassignedTasks.length > 0) {
    const names = unassignedTasks.map(j => taskNames[j]).join(", ");
    recs.push({
      icon: "📋",
      priority: "medium",
      titleFr: `Pourvoir la tâche non couverte : ${names}`,
      titleAr: `توفير مورد لتغطية المهمة غير المسندة : ${names}`,
      descFr: `La tâche ${names} n'a été assignée à aucune ressource dans ce cycle. Évaluez un recrutement temporaire, un recours à la sous-traitance, ou réorganisez la priorité des tâches pour couvrir ce besoin lors de la prochaine période.`,
      descAr: `المهمة ${names} لم تُسند لأي مورد في هذه الدورة. قيّم التوظيف المؤقت، الاستعانة بمقاول خارجي، أو أعد ترتيب أولويات المهام لتغطية هذه الحاجة في الفترة القادمة.`,
    });
  }

  // 6. Low — document forbidden cells
  if (forbiddenCount > 0 && !isInfeasible) {
    recs.push({
      icon: "📝",
      priority: "low",
      titleFr: "Documenter et réviser périodiquement les contraintes d'interdiction",
      titleAr: "توثيق قيود الحظر ومراجعتها دورياً",
      descFr: `${forbiddenCount} cellule${forbiddenCount > 1 ? "s" : ""} interdite${forbiddenCount > 1 ? "s" : ""} ont été appliquées. Chaque contrainte doit être documentée (raison, responsable, date de révision) et réévaluée à chaque cycle pour éviter qu'elle ne devienne obsolète ou trop restrictive.`,
      descAr: `${forbiddenCount} خلية محظورة طُبّقت في هذه المسألة. يجب توثيق كل قيد رسمياً (السبب، المسؤول، تاريخ المراجعة) وإعادة تقييمه في كل دورة توزيع لتفادي تقادمه أو تقييده المفرط.`,
    });
  }

  // 7. Low — periodic reassignment review
  recs.push({
    icon: "🔄",
    priority: "low",
    titleFr: "Planifier une révision périodique de l'affectation",
    titleAr: "جدولة مراجعة دورية لخطة التوزيع",
    descFr: `Toute affectation optimale l'est pour les données du moment. Planifiez une révision systématique à chaque changement significatif : nouvelles ressources, modification des coûts ou des performances, évolution des tâches disponibles. Archivez ce plan dans l'historique pour comparer les cycles futurs.`,
    descAr: `أي توزيع مثالي هو مثالي وفق بيانات اللحظة الراهنة. خطّط لمراجعة منتظمة عند كل تغيير جوهري: موارد جديدة، تعديل التكاليف أو الأداء، تطور المهام المتاحة. أرشف هذه الخطة في السجل للمقارنة مع الدورات القادمة.`,
  });

  return recs;
}

// ── Analysis Tab ──────────────────────────────────────────────────────────────
function AnalysisTab({
  result, language, isMax, unit, onSave, onPDF, isSaved, isExporting,
}: {
  result: HungarianResult;
  language: string;
  isMax: boolean;
  unit: string;
  onSave: () => void;
  onPDF: () => void;
  isSaved: boolean;
  isExporting: boolean;
}) {
  const tl = (fr: string, ar: string) => language === "ar" ? ar : fr;
  const isAr = language === "ar";
  const {
    m, n, resourceNames, taskNames, originalCosts, finalAssignment,
    unassignedResources, unassignedTasks, hasAlternativeOptima, alternativeZeroCells,
    isInfeasible, iterations,
  } = result;

  const analysisLines    = buildAnalysisLines(result, isMax, unit, language);
  const recommendations  = buildRecommendations(result, isMax, unit, language);

  const realPairs = finalAssignment.filter(({ i, j }) => i < m && j < n);
  const coveringSteps = iterations.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: isMax ? tl("Performance optimale", "الأداء الأمثل") : tl("Coût optimal", "التكلفة المثلى"),
            value: fmt(result.totalCostReal, language),
            color: "text-green-700",
            bg: "bg-green-50 border-green-200",
            icon: <CheckCircle2 className="w-4 h-4 text-green-600" />,
          },
          {
            label: tl("Affectations réelles", "التوزيعات الفعلية"),
            value: `${realPairs.length} / ${Math.max(m, n)}`,
            color: "text-foreground",
            bg: "bg-muted/40 border-border",
            icon: <Target className="w-4 h-4 text-muted-foreground" />,
          },
          {
            label: tl("Étapes de couverture", "خطوات التغطية"),
            value: String(coveringSteps),
            color: "text-foreground",
            bg: "bg-muted/40 border-border",
            icon: <GitMerge className="w-4 h-4 text-muted-foreground" />,
          },
          {
            label: tl("Objectif", "الهدف"),
            value: isMax ? tl("Maximisation", "تعظيم") : tl("Minimisation", "تقليل"),
            color: "text-foreground",
            bg: "bg-muted/40 border-border",
            icon: <Zap className="w-4 h-4 text-secondary" />,
          },
        ].map((k, idx) => (
          <Card key={idx} className={cn("border", k.bg)}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                {k.icon}
                <span className="text-xs text-muted-foreground">{k.label}</span>
              </div>
              <div className={cn("text-lg font-bold leading-tight", k.color)}>{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isInfeasible && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{tl("Attention — affectation interdite détectée", "تنبيه — تم اكتشاف توزيع محظور")}</AlertTitle>
          <AlertDescription className="text-xs">
            {tl(
              "L'algorithme a dû utiliser une cellule marquée comme interdite pour compléter l'affectation, car les contraintes rendaient le problème infaisable autrement. Vérifiez vos interdictions.",
              "اضطرت الخوارزمية لاستخدام خلية محظورة لإكمال التوزيع، لأن القيود جعلت المسألة غير قابلة للحل بطريقة أخرى. يرجى مراجعة الممنوعات."
            )}
          </AlertDescription>
        </Alert>
      )}
      {hasAlternativeOptima && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800 text-sm">{tl("Solutions optimales alternatives détectées", "تم اكتشاف حلول مثلى بديلة")}</AlertTitle>
          <AlertDescription className="text-blue-700 text-xs">
            {tl(
              `D'autres cellules à coût réduit nul (${alternativeZeroCells.map(c => `(${c.i+1},${c.j+1})`).join(", ")}) n'ont pas été utilisées dans cette affectation. Il existe donc au moins une autre affectation optimale avec exactement la même valeur totale.`,
              `توجد خلايا أخرى بتكلفة مختزلة صفرية (${alternativeZeroCells.map(c => `(${c.i+1},${c.j+1})`).join(", ")}) لم تُستخدم في هذا التوزيع. لذلك يوجد توزيع أمثل بديل بنفس القيمة الإجمالية تماماً.`
            )}
          </AlertDescription>
        </Alert>
      )}
      {(unassignedResources.length > 0 || unassignedTasks.length > 0) && (
        <Alert className="border-orange-200 bg-orange-50">
          <Info className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800 text-sm">{tl("Ressources / tâches fictives — affectation incomplète", "موارد/مهام وهمية — توزيع غير كامل")}</AlertTitle>
          <AlertDescription className="text-orange-700 text-xs">
            {unassignedResources.length > 0 && (
              <div>
                {tl(
                  `${unassignedResources.map(i => resourceNames[i]).join(", ")} ne reçoit aucune tâche : une ressource fictive a comblé l'écart.`,
                  `${unassignedResources.map(i => resourceNames[i]).join(", ")} لا يحصل على أي مهمة: سدّ مورد وهمي الفارق.`
                )}
              </div>
            )}
            {unassignedTasks.length > 0 && (
              <div>
                {tl(
                  `${unassignedTasks.map(j => taskNames[j]).join(", ")} n'est assignée à aucune ressource : une tâche fictive a comblé l'écart.`,
                  `${unassignedTasks.map(j => taskNames[j]).join(", ")} لا تُخصَّص لأي مورد: سدّت مهمة وهمية الفارق.`
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            {tl("Affectation Optimale", "التوزيع الأمثل")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="px-3 py-2 text-left">{tl("Ressource", "المورد")}</th>
                  <th className="px-3 py-2 text-left">{tl("Tâche", "المهمة")}</th>
                  <th className="px-3 py-2 text-right">{isMax ? tl("Score", "النقاط") : tl("Coût", "التكلفة")}</th>
                </tr>
              </thead>
              <tbody>
                {realPairs.map(({ i, j }, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                    <td className="px-3 py-1.5 font-medium border-b border-border">{resourceNames[i]}</td>
                    <td className="px-3 py-1.5 border-b border-border">{taskNames[j]}</td>
                    <td className="px-3 py-1.5 text-right border-b border-border font-semibold text-secondary">
                      {fmt(originalCosts[i][j], language)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-green-50 font-bold">
                  <td colSpan={2} className="px-3 py-2 text-green-800 border-t-2 border-green-300">
                    {tl("TOTAL OPTIMAL", "المجموع الأمثل")}
                  </td>
                  <td className="px-3 py-2 text-right text-green-700 text-sm border-t-2 border-green-300">
                    {fmt(result.totalCostReal, language)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Situation analysis ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            {tl("Analyse de la Situation", "تحليل الوضع")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {analysisLines.map((line, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg bg-primary/5 border border-primary/15 p-3">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">{isAr ? line.ar : line.fr}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Managerial recommendations ──────────────────────────────────────── */}
      {recommendations.length > 0 && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              {tl("Recommandations Managériales", "التوصيات الإدارية")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {recommendations.map((rec, i) => {
              const colorClass =
                rec.priority === "high"   ? "border-s-red-500 bg-red-50/60"     :
                rec.priority === "medium" ? "border-s-amber-500 bg-amber-50/60" :
                                            "border-s-blue-500 bg-blue-50/60";
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl border-s-4 p-4 space-y-1.5",
                    colorClass,
                    isAr ? "border-s-0 border-e-4" : ""
                  )}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base">{rec.icon}</span>
                    <p className="font-bold text-sm">{isAr ? rec.titleAr : rec.titleFr}</p>
                    <Badge
                      className={cn(
                        "text-[10px] ms-auto",
                        rec.priority === "high"   ? "bg-red-600"   :
                        rec.priority === "medium" ? "bg-amber-600" : "bg-blue-600"
                      )}
                    >
                      {rec.priority === "high"   ? tl("Priorité haute",    "أولوية عالية")    :
                       rec.priority === "medium" ? tl("Priorité moyenne",  "أولوية متوسطة") :
                                                   tl("Priorité basse",    "أولوية منخفضة")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isAr ? rec.descAr : rec.descFr}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onSave} disabled={isSaved} variant={isSaved ? "outline" : "default"} className="flex-1 gap-2">
          {isSaved ? <Check className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
          {isSaved ? tl("Enregistré ✓", "تم الحفظ ✓") : tl("Enregistrer dans l'historique", "حفظ في السجل")}
        </Button>
        <Button onClick={onPDF} disabled={isExporting} variant="outline" className="flex-1 gap-2">
          {isExporting ? <span className="animate-spin text-base">⏳</span> : <Download className="w-4 h-4" />}
          {tl("Exporter PDF", "تصدير PDF")}
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Assignment() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { addProblem } = useAssignmentHistory();
  const { toast } = useToast();

  // ── Sector ───────────────────────────────────────────────────────────────────
  const [selectedSector, setSelectedSector] = useState<SectorKey | null>(null);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [name,          setName]          = useState("");
  const [objectiveType, setObjectiveType] = useState<"minimize" | "maximize">("minimize");
  const [unit,          setUnit]          = useState("");
  const [resources,     setResources]     = useState<Resource[]>(blankResources());
  const [tasks,         setTasks]         = useState<Task[]>(blankTasks());
  const [costs,         setCosts]         = useState<number[][]>(blankCosts(3, 3));
  const [forbidden,     setForbidden]     = useState<boolean[][]>(blankForbidden(3, 3));
  const [errors,        setErrors]        = useState<Record<string, string>>({});

  // ── Solution state ───────────────────────────────────────────────────────────
  const [solvedProblem, setSolvedProblem] = useState<AssignmentProblem | null>(null);
  const [pageTab,       setPageTab]       = useState<"solve" | "analysis">("solve");
  const [currentStep,   setCurrentStep]   = useState(0);
  const [isSaved,       setIsSaved]       = useState(false);
  const [isExporting,   setIsExporting]   = useState(false);
  const [exportMsg,     setExportMsg]     = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  const result = useMemo(() => (solvedProblem ? runHungarian(solvedProblem) : null), [solvedProblem]);
  const displaySteps = useMemo(() => (result ? buildDisplaySteps(result) : []), [result]);

  // ── Load template ────────────────────────────────────────────────────────────
  function loadTemplate(key: SectorKey) {
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
      const lang = language;
      setResources(tpl.resources.map(r => ({ name: lang === "ar" ? r.nameAr : r.nameFr })));
      setTasks(tpl.tasks.map(tk => ({ name: lang === "ar" ? tk.nameAr : tk.nameFr })));
      setCosts(tpl.costs.map(row => [...row]));
      const m2 = tpl.resources.length, n2 = tpl.tasks.length;
      const f = blankForbidden(m2, n2);
      tpl.forbiddenCells?.forEach(([i, j]) => { if (i < m2 && j < n2) f[i][j] = true; });
      setForbidden(f);
      setName(lang === "ar" ? tpl.nameAr : tpl.nameFr);
      setUnit(lang === "ar" ? tpl.unitAr : tpl.unitFr);
      setObjectiveType(tpl.objectiveType);
    }
    setErrors({});
    setSolvedProblem(null);
    setIsSaved(false);
  }

  function handleSectorSelect(key: SectorKey) {
    setSelectedSector(key);
    loadTemplate(key);
  }

  function handleResetTemplate() {
    if (selectedSector) {
      loadTemplate(selectedSector);
      toast({ title: t("Valeurs réinitialisées", "تم إعادة التعيين") });
    }
  }

  // ── Resources CRUD ───────────────────────────────────────────────────────────
  const addResource = useCallback(() => {
    const n2 = tasks.length;
    setResources(prev => [...prev, { name: "" }]);
    setCosts(prev => [...prev, Array(n2).fill(0)]);
    setForbidden(prev => [...prev, Array(n2).fill(false)]);
  }, [tasks.length]);

  const removeResource = useCallback((i: number) => {
    if (resources.length <= 2) return;
    setResources(prev => prev.filter((_, idx) => idx !== i));
    setCosts(prev => prev.filter((_, idx) => idx !== i));
    setForbidden(prev => prev.filter((_, idx) => idx !== i));
  }, [resources.length]);

  const updateResource = useCallback((i: number, name2: string) => {
    setResources(prev => prev.map((r, idx) => idx === i ? { name: name2 } : r));
  }, []);

  // ── Tasks CRUD ───────────────────────────────────────────────────────────────
  const addTask = useCallback(() => {
    setTasks(prev => [...prev, { name: "" }]);
    setCosts(prev => prev.map(row => [...row, 0]));
    setForbidden(prev => prev.map(row => [...row, false]));
  }, []);

  const removeTask = useCallback((j: number) => {
    if (tasks.length <= 2) return;
    setTasks(prev => prev.filter((_, idx) => idx !== j));
    setCosts(prev => prev.map(row => row.filter((_, idx) => idx !== j)));
    setForbidden(prev => prev.map(row => row.filter((_, idx) => idx !== j)));
  }, [tasks.length]);

  const updateTask = useCallback((j: number, name2: string) => {
    setTasks(prev => prev.map((tk, idx) => idx === j ? { name: name2 } : tk));
  }, []);

  // ── Cost / forbidden ─────────────────────────────────────────────────────────
  const updateCost = useCallback((i: number, j: number, v: number) => {
    setCosts(prev => prev.map((row, ri) => ri === i ? row.map((c, ci) => ci === j ? v : c) : row));
  }, []);

  const toggleForbidden = useCallback((i: number, j: number) => {
    setForbidden(prev => prev.map((row, ri) => ri === i ? row.map((v, ci) => ci === j ? !v : v) : row));
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const m = resources.length;
  const n = tasks.length;
  const isSquare = m === n;
  const needsDummyResource = !isSquare && m < n;
  const needsDummyTask     = !isSquare && m > n;
  const forbiddenRowCheck  = resources.map((_, i) => forbidden[i]?.every(Boolean) ?? false);
  const forbiddenColCheck  = tasks.map((_, j) => forbidden.every(row => row[j]));
  const forbiddenCount     = forbidden.flat().filter(Boolean).length;

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs["name"] = t("Nom du problème requis", "اسم المسألة مطلوب");
    resources.forEach((r, i) => { if (!r.name.trim()) errs[`res_${i}`] = t("Nom requis", "الاسم مطلوب"); });
    tasks.forEach((tk, j) => { if (!tk.name.trim()) errs[`task_${j}`] = t("Nom requis", "الاسم مطلوب"); });
    costs.forEach((row, i) => row.forEach((c, j) => {
      if (!forbidden[i][j] && (isNaN(c) || c < 0)) errs[`cost_${i}_${j}`] = t("Valeur invalide", "قيمة غير صحيحة");
    }));
    forbiddenRowCheck.forEach((all, i) => {
      if (all) errs[`row_${i}`] = t(`Ressource ${i+1} : toutes les affectations sont interdites`, `المورد ${i+1}: جميع التوزيعات محظورة`);
    });
    forbiddenColCheck.forEach((all, j) => {
      if (all) errs[`col_${j}`] = t(`Tâche ${j+1} : toutes les affectations sont interdites`, `المهمة ${j+1}: جميع التوزيعات محظورة`);
    });
    return errs;
  }

  // ── Solve ────────────────────────────────────────────────────────────────────
  function handleSolve() {
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
    const problem: AssignmentProblem = {
      name: name || t("Problème d'affectation", "مسألة توزيع"),
      sector: selectedSector ?? "custom",
      objectiveType,
      resources,
      tasks,
      costs,
      forbidden,
    };
    setSolvedProblem(problem);
    setPageTab("solve");
    setCurrentStep(0);
    setIsSaved(false);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  // ── Save / PDF ───────────────────────────────────────────────────────────────
  function handleSave() {
    if (isSaved || !result || !solvedProblem) return;
    addProblem(solvedProblem, result, (solvedProblem.sector || "custom") as AssignmentSectorKey, language);
    setIsSaved(true);
  }

  async function handlePDF() {
    if (!result || !solvedProblem || isExporting) return;
    setIsExporting(true);
    setExportMsg(t("Génération du PDF…", "جارٍ إنشاء PDF…"));
    try {
      await generateAssignmentPDF({
        problem: solvedProblem,
        result,
        unit,
        managerName: "",
        institutionName: "",
        language,
        onProgress: (msg) => setExportMsg(msg),
      });
    } catch {
      setExportMsg(t("Erreur lors de l'export.", "حدث خطأ أثناء التصدير."));
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportMsg(null), 3000);
    }
  }

  const errorCount = Object.keys(errors).length;
  const step = displaySteps[Math.min(currentStep, Math.max(0, displaySteps.length - 1))];
  const isLast = displaySteps.length > 0 && currentStep >= displaySteps.length - 1;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn("container mx-auto px-4 py-8 max-w-6xl space-y-8", isAr ? "rtl" : "ltr")}
      dir={isAr ? "rtl" : "ltr"}
    >

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary">
            <Users className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {t("Problème d'Affectation", "مسألة التوزيع")}
          </h1>
          <Badge variant="secondary">
            {t("Méthode Hongroise", "الطريقة الهنغارية")}
          </Badge>
        </div>
        <p className="text-muted-foreground ps-14">
          {t(
            "Affectez vos ressources aux tâches de façon optimale — minimisation des coûts ou maximisation des performances.",
            "خصِّص مواردك للمهام بشكل مثالي — تقليل التكاليف أو تعظيم الأداء."
          )}
        </p>
      </div>

      {/* ── 1. Sector cards ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t("Secteur d'activité", "قطاع النشاط")}</CardTitle>
          <CardDescription>
            {t(
              "Sélectionnez un secteur pour pré-remplir un exemple algérien réaliste.",
              "اختر قطاعاً لتعبئة مثال جزائري واقعي تلقائياً."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {SECTOR_CARDS.map(s => {
              const Icon = s.icon;
              const active = selectedSector === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => handleSectorSelect(s.key)}
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
                    {isAr ? s.nameAr : s.nameFr}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                    {isAr ? s.descAr : s.descFr}
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
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <PenLine className="w-5 h-5" />
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

      {/* ── 2. Form ─────────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedSector && selectedSector !== "custom" && (
                  <Badge variant="outline" className="text-xs">
                    {isAr
                      ? SECTOR_CARDS.find(s => s.key === selectedSector)?.nameAr
                      : SECTOR_CARDS.find(s => s.key === selectedSector)?.nameFr}
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className={cn("text-xs", objectiveType === "minimize" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700")}
                >
                  {objectiveType === "minimize" ? t("↓ Minimisation", "↓ تقليل") : t("↑ Maximisation", "↑ تعظيم")}
                </Badge>
                {forbiddenCount > 0 && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <Ban className="w-3 h-3" />
                    {forbiddenCount} {t("interdite(s)", "محظورة")}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xl">
                {t("Configuration du problème", "إعداد المسألة")}
              </CardTitle>
              <CardDescription>
                {t(
                  "Définissez les ressources, les tâches et la matrice des coûts/performances.",
                  "حدد الموارد والمهام ومصفوفة التكاليف/الأداء."
                )}
              </CardDescription>
            </div>
            {selectedSector && selectedSector !== "custom" && (
              <Button variant="ghost" size="sm" onClick={handleResetTemplate} className="shrink-0 gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                {t("Réinitialiser", "إعادة تعيين")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Name + unit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t("Nom du problème", "اسم المسألة")}</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t("Ex. Affectation trimestrielle Q3 2026", "مثال. التوزيع الربعي ق3 2026")}
                className={cn(errors["name"] && "border-red-400")}
              />
              {errors["name"] && <p className="text-xs text-red-500">{errors["name"]}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t("Unité (optionnel)", "الوحدة (اختياري)")}</label>
              <Input
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder={t("Ex. heures, kDA, score…", "مثال. ساعات، دج، نقاط…")}
              />
            </div>
          </div>

          {/* Objective */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t("Type d'objectif", "نوع الهدف")}</label>
            <div className="flex gap-3 flex-wrap">
              {(["minimize", "maximize"] as const).map(obj => (
                <button
                  key={obj}
                  type="button"
                  onClick={() => setObjectiveType(obj)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                    objectiveType === obj
                      ? obj === "minimize" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-green-500 bg-green-50 text-green-700"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  <span className="text-lg font-bold">{obj === "minimize" ? "↓" : "↑"}</span>
                  {obj === "minimize" ? t("Minimiser les coûts / durées", "تقليل التكاليف / الأوقات") : t("Maximiser les performances / profits", "تعظيم الأداء / الأرباح")}
                </button>
              ))}
            </div>
          </div>

          {/* Non-square alert */}
          {!isSquare && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <AlertTitle className="text-amber-800">{t("Matrice non carrée — Équilibrage automatique", "مصفوفة غير مربعة — موازنة تلقائية")}</AlertTitle>
              <AlertDescription className="text-amber-700 text-sm">
                {needsDummyResource
                  ? t(
                      `${m} ressource(s) × ${n} tâche(s) — une ressource fictive sera ajoutée (coûts = 0) pour équilibrer à ${n}×${n}.`,
                      `${m} مورد × ${n} مهام — سيُضاف مورد وهمي (تكاليف = 0) لتوازن إلى ${n}×${n}.`
                    )
                  : t(
                      `${m} ressource(s) × ${n} tâche(s) — une tâche fictive sera ajoutée (coûts = 0) pour équilibrer à ${m}×${m}.`,
                      `${m} مورد × ${n} مهام — ستُضاف مهمة وهمية (تكاليف = 0) لتوازن إلى ${m}×${m}.`
                    )}
              </AlertDescription>
            </Alert>
          )}

          {/* Forbidden hint */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Ban className="w-3.5 h-3.5 shrink-0" />
            <span>
              {t(
                "Survolez une cellule et cliquez sur 🚫 pour la marquer comme interdite.",
                "مرر المؤشر فوق خلية وانقر على 🚫 لتمييزها كمحظورة."
              )}
            </span>
          </div>

          {/* Matrix */}
          <div className="rounded-xl border overflow-hidden">
            <div className="px-4 py-2 bg-muted/40 border-b flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-semibold text-foreground">
                {t("Matrice d'affectation", "مصفوفة التوزيع")}
                <span className="ms-2 text-xs font-normal text-muted-foreground">
                  {m} × {n}{unit && ` (${unit})`}
                </span>
              </span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-100 border border-red-200" />{t("Interdit", "محظور")}</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-background border border-border" />{objectiveType === "minimize" ? t("Coût", "تكلفة") : t("Score", "نقاط")}</span>
                {forbiddenCount > 0 && (
                  <span className="text-red-600 flex items-center gap-1"><Ban className="w-3 h-3" />{forbiddenCount} {t("interdite(s)", "محظورة")}</span>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky start-0 z-20 bg-muted/80 p-2 border-b border-e min-w-[140px] max-w-[180px]">
                      <div className="text-xs font-semibold text-muted-foreground text-start px-1">
                        {t("Ressource / Tâche", "مورد / مهمة")}
                      </div>
                    </th>
                    {tasks.map((tk, j) => (
                      <th key={j} className="p-1.5 border-b border-e min-w-[100px] bg-muted/40">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <Input
                              value={tk.name}
                              onChange={e => updateTask(j, e.target.value)}
                              placeholder={t(`Tâche ${j+1}`, `مهمة ${j+1}`)}
                              className={cn("h-7 text-xs text-center px-1 bg-background", errors[`task_${j}`] && "border-red-400")}
                            />
                            <button
                              type="button"
                              onClick={() => removeTask(j)}
                              disabled={tasks.length <= 2}
                              className="text-muted-foreground hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed shrink-0 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {errors[`task_${j}`] && <p className="text-[10px] text-red-500 text-center">{errors[`task_${j}`]}</p>}
                          {forbiddenColCheck[j] && <p className="text-[10px] text-red-500 text-center">{t("Col. entièrement interdite", "العمود محظور كلياً")}</p>}
                        </div>
                      </th>
                    ))}
                    <th className="p-1.5 border-b bg-muted/20 w-10">
                      <button
                        type="button"
                        onClick={addTask}
                        disabled={tasks.length >= 8}
                        className="w-7 h-7 rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center text-primary hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mx-auto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((res, i) => (
                    <tr key={i} className="group/row">
                      <td className="sticky start-0 z-10 bg-muted/50 p-1.5 border-b border-e">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => removeResource(i)}
                              disabled={resources.length <= 2}
                              className="text-muted-foreground hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed shrink-0 transition-colors opacity-0 group-hover/row:opacity-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <Input
                              value={res.name}
                              onChange={e => updateResource(i, e.target.value)}
                              placeholder={t(`Ressource ${i+1}`, `مورد ${i+1}`)}
                              className={cn("h-7 text-xs px-1.5 bg-background flex-1", errors[`res_${i}`] && "border-red-400")}
                            />
                          </div>
                          {errors[`res_${i}`] && <p className="text-[10px] text-red-500 ps-5">{errors[`res_${i}`]}</p>}
                          {(errors[`row_${i}`] || forbiddenRowCheck[i]) && (
                            <p className="text-[10px] text-red-500 ps-5">{t("Ligne entièrement interdite", "الصف محظور كلياً")}</p>
                          )}
                        </div>
                      </td>
                      {tasks.map((_, j) => (
                        <td key={j} className="p-1 border-b border-e">
                          <MatrixCell
                            value={costs[i]?.[j] ?? 0}
                            forbidden={forbidden[i]?.[j] ?? false}
                            isMax={objectiveType === "maximize"}
                            onChange={v => updateCost(i, j, v)}
                            onToggleForbidden={() => toggleForbidden(i, j)}
                            hasError={!!errors[`cost_${i}_${j}`]}
                          />
                        </td>
                      ))}
                      <td className="border-b" />
                    </tr>
                  ))}
                  <tr>
                    <td className="sticky start-0 z-10 bg-background p-2 border-b border-e">
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
            {!isSquare && (
              <div className="px-4 py-1.5 bg-amber-50 border-t text-xs text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                {needsDummyTask
                  ? t("1 tâche fictive sera ajoutée", "ستُضاف مهمة وهمية واحدة")
                  : t("1 ressource fictive sera ajoutée", "سيُضاف مورد وهمي واحد")}
              </div>
            )}
          </div>

          {/* Validation errors */}
          {errorCount > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>{t("Erreurs détectées", "أخطاء مكتشفة")}</AlertTitle>
              <AlertDescription className="space-y-1">
                {Object.values(errors).slice(0, 5).map((e, i) => (
                  <div key={i} className="text-sm">• {e}</div>
                ))}
                {errorCount > 5 && <div className="text-sm">• …{t(`et ${errorCount - 5} autre(s)`, `و${errorCount - 5} آخر`)}</div>}
              </AlertDescription>
            </Alert>
          )}

          {/* Solve button */}
          <div className="flex items-center justify-between pt-2 border-t gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {isSquare ? (
                <span className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1 text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t("Matrice carrée", "مصفوفة مربعة")} {m}×{m}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-xs font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {m}×{n} — {needsDummyResource ? t("ressource fictive à ajouter", "مورد وهمي يُضاف") : t("tâche fictive à ajouter", "مهمة وهمية تُضاف")}
                </span>
              )}
            </div>
            <Button size="lg" onClick={handleSolve} className="gap-2 px-8">
              <Zap className="w-4 h-4" />
              {t("Résoudre", "حل المسألة")}
              <ArrowRight className={cn("w-4 h-4", isAr && "rotate-180")} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Results ──────────────────────────────────────────────────────────── */}
      {result && solvedProblem && step && (
        <div ref={resultsRef} className="space-y-4">

          {/* Results header */}
          <div>
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <h2 className="text-2xl font-bold text-foreground">
                {t("Solution Optimale — Méthode Hongroise", "الحل الأمثل — الطريقة الهنغارية")}
              </h2>
              <Badge variant="outline" className="text-xs">{solvedProblem.name}</Badge>
              <Badge className={cn("text-xs", solvedProblem.objectiveType === "maximize" ? "bg-purple-600" : "bg-primary")}>
                {solvedProblem.objectiveType === "maximize" ? t("↑ Maximisation", "↑ تعظيم") : t("↓ Minimisation", "↓ تقليل")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(
                `Matrice ${solvedProblem.resources.length}×${solvedProblem.tasks.length}${result.N !== solvedProblem.resources.length || result.N !== solvedProblem.tasks.length ? ` (résolue en ${result.N}×${result.N} après équilibrage)` : ""} — valeur optimale : ${fmt(result.totalCostReal, language)}`,
                `مصفوفة ${solvedProblem.resources.length}×${solvedProblem.tasks.length}${result.N !== solvedProblem.resources.length || result.N !== solvedProblem.tasks.length ? ` (حُلّت بحجم ${result.N}×${result.N} بعد التوازن)` : ""} — القيمة المثلى: ${fmt(result.totalCostReal, language)}`
              )}
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-border">
            {([
              { id: "solve" as const,    labelFr: "Résolution pas-à-pas", labelAr: "الحل خطوة بخطوة", icon: GitMerge },
              { id: "analysis" as const, labelFr: "Analyse & Résultats",  labelAr: "التحليل والنتائج", icon: BarChart3 },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setPageTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  pageTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {isAr ? tab.labelAr : tab.labelFr}
                {tab.id === "analysis" && (
                  <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0 ms-1">
                    {t("Optimal", "مثالي")}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Step-by-step tab */}
          {pageTab === "solve" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">{isAr ? step.label.ar : step.label.fr}</CardTitle>
                      {step.isOptimal && (
                        <Badge className="bg-green-600 text-white text-xs">
                          <Star className="w-3 h-3 me-1" />
                          {t("Optimal", "مثالي")}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t(`Étape ${currentStep + 1} / ${displaySteps.length}`, `الخطوة ${currentStep + 1} / ${displaySteps.length}`)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <HungarianMatrixTable
                    step={step}
                    m={solvedProblem.resources.length}
                    n={solvedProblem.tasks.length}
                    resourceNames={result.resourceNames}
                    taskNames={result.taskNames}
                    forbidden={result.forbidden}
                    language={language}
                  />
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-slate-100 border" />{t("Couverte", "مغطاة")}</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-50 border" />{t("Double couverture", "تغطية مضاعفة")}</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-100 border-2 border-green-500" />{t("Affectation choisie", "التوزيع المختار")}</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-50/60 border" />{t("Fictif", "وهمي")}</span>
                    <span className="flex items-center gap-1"><Ban className="w-3 h-3 text-red-500" />{t("Interdit", "محظور")}</span>
                  </div>
                  <StepExplanation step={step} language={language} isMax={solvedProblem.objectiveType === "maximize"} />
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0}
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t("Précédent", "السابق")}
                </Button>
                <div className="flex items-center gap-1">
                  {displaySteps.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentStep(idx)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        idx === currentStep ? "bg-primary w-4" : idx < displaySteps.length - 1 ? "bg-primary/30" : "bg-green-500"
                      )}
                    />
                  ))}
                </div>
                {!isLast ? (
                  <Button size="sm" onClick={() => setCurrentStep(Math.min(displaySteps.length - 1, currentStep + 1))} className="gap-1">
                    {t("Suivant", "التالي")}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setPageTab("analysis")} className="gap-1 bg-green-700 hover:bg-green-800">
                    {t("Voir l'analyse", "عرض التحليل")}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {!isLast && (
                <div className="flex justify-center">
                  <Button
                    variant="ghost" size="sm"
                    className="text-xs text-muted-foreground gap-1"
                    onClick={() => setCurrentStep(displaySteps.length - 1)}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {t("Aller directement à la solution optimale", "الانتقال مباشرة إلى الحل الأمثل")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Analysis tab */}
          {pageTab === "analysis" && (
            <AnalysisTab
              result={result}
              language={language}
              isMax={solvedProblem.objectiveType === "maximize"}
              unit={unit}
              onSave={handleSave}
              onPDF={handlePDF}
              isSaved={isSaved}
              isExporting={isExporting}
            />
          )}

          {/* Bottom nav */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="outline" size="sm"
              onClick={() => { setSolvedProblem(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="gap-1"
            >
              <ArrowLeft className={cn("w-4 h-4", isAr && "rotate-180")} />
              {t("Nouveau problème", "مسألة جديدة")}
            </Button>
            {pageTab === "solve" && isLast && (
              <Button size="sm" onClick={handleSave} disabled={isSaved} className="gap-1">
                <BookmarkPlus className="w-4 h-4" />
                {isSaved ? t("Enregistré ✓", "تم الحفظ ✓") : t("Enregistrer", "حفظ")}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* PDF progress toast */}
      {exportMsg && (
        <div className="fixed bottom-4 end-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg text-sm z-50 flex items-center gap-2">
          {isExporting && <span className="animate-spin">⏳</span>}
          {exportMsg}
        </div>
      )}

    </div>
  );
}
