import { useState, useMemo, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { useAssignmentState } from "@/lib/AssignmentContext";
import { useAssignmentHistory, type AssignmentSectorKey } from "@/lib/AssignmentHistoryContext";
import { generateAssignmentPDF } from "@/lib/generateAssignmentPDF";
import { runHungarian, type HungarianResult, type HungarianCell } from "@/lib/hungarianAlgorithm";
import { TEMPLATES } from "@/pages/assignment/Solve";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Info, ArrowLeft, ArrowRight,
  GitMerge, BarChart3, BookmarkPlus, Download, Zap, Star, Check, Ban, Target,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
const TOL = 1e-6;

function fmt(n: number, lang: string, d = 0): string {
  if (!isFinite(n)) return "∞";
  return n.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
}

type PageTab = "solve" | "analysis";

// ── Display step model ────────────────────────────────────────────────────────
interface DisplayStep {
  kind: "initial" | "row-reduction" | "col-reduction" | "covering";
  matrix: number[][];
  label: { fr: string; ar: string };
  rowCovered?: boolean[];
  colCovered?: boolean[];
  matchingZeros?: HungarianCell[];
  minUncovered?: number | null;
  isOptimal?: boolean;
  reductionValues?: number[]; // rowMins or colMins, aligned to axis
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

// ── Stage bar ─────────────────────────────────────────────────────────────────
function StageBar() {
  const { t } = useLanguage();
  const stages = [
    { n: 1, fr: "Données",           ar: "البيانات" },
    { n: 2, fr: "Solution optimale", ar: "الحل الأمثل" },
  ] as const;

  return (
    <div className="flex items-center gap-0 text-sm select-none">
      {stages.map((s, idx) => {
        const done   = s.n < 2;
        const active = s.n === 2;
        return (
          <div key={s.n} className="flex items-center">
            {idx > 0 && <div className="h-px w-8 bg-muted-foreground/30 mx-1" />}
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
              done   && "bg-primary/10 text-primary",
              active && "bg-primary text-primary-foreground shadow-sm",
            )}>
              {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="font-bold">{s.n}</span>}
              {t(s.fr, s.ar)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Matrix table ──────────────────────────────────────────────────────────────
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
    const isZero = Math.abs(val) < TOL;
    const isMinUncovered = step.minUncovered != null && !rc && !cc && Math.abs(val - step.minUncovered) < TOL;

    const classes: string[] = ["border", "border-border", "text-center", "p-2", "relative", "transition-colors"];

    if (isMatch) classes.push("bg-green-100 ring-2 ring-green-500 ring-inset");
    else if (rc && cc) classes.push("bg-red-50");
    else if (rc || cc) classes.push("bg-slate-100");
    else if (isDummy) classes.push("bg-orange-50/60");
    else classes.push("bg-white");

    if (isForbidden) classes.push("!bg-red-100");
    if (isMinUncovered) classes.push("ring-2 ring-amber-400 ring-inset");

    void isZero;
    return classes.join(" ");
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs" style={{ minWidth: (N + 1) * 88 }}>
        <thead>
          <tr>
            <th className="p-2 text-left text-muted-foreground w-28" />
            {taskNames.map((tn, j) => (
              <th
                key={j}
                className={cn(
                  "p-2 text-center font-semibold text-foreground",
                  step.colCovered?.[j] && "bg-slate-200/60 rounded-t"
                )}
                style={{ width: 88 }}
              >
                <div className="truncate max-w-[80px] mx-auto">{tn}</div>
                {j >= n && <span className="text-[9px] text-orange-600">({language === "ar" ? "وهمية" : "fictive"})</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resourceNames.map((rn, i) => (
            <tr key={i}>
              <td className={cn(
                "p-2 pr-3 text-right font-semibold text-foreground whitespace-nowrap",
                step.rowCovered?.[i] && "bg-slate-200/60 rounded-l"
              )}>
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
                      <span className={cn(
                        "font-medium",
                        Math.abs(val) < TOL ? "text-blue-700 font-bold" : "text-foreground"
                      )}>
                        {fmt(val, language, 0)}
                      </span>
                    )}
                    {matchSet.has(`${i},${j}`) && (
                      <Check className="w-3 h-3 text-green-600 absolute top-0.5 right-0.5" />
                    )}
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

// ── Step explanation ──────────────────────────────────────────────────────────
function StepExplanation({ step, language, isMax }: { step: DisplayStep; language: string; isMax: boolean }) {
  const t = (fr: string, ar: string) => language === "ar" ? ar : fr;

  if (step.kind === "initial") {
    return (
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 text-sm">{t("Matrice de départ", "المصفوفة الأولية")}</AlertTitle>
        <AlertDescription className="text-blue-700 text-xs">
          {isMax
            ? t(
                "Comme l'objectif est la maximisation, la matrice a été convertie en coûts équivalents (valeur maximale − valeur de la cellule) afin d'appliquer la méthode Hongroise, qui minimise toujours.",
                "بما أن الهدف هو التعظيم، تم تحويل المصفوفة إلى تكاليف معادلة (القيمة القصوى − قيمة الخلية) لتطبيق الطريقة الهنغارية التي تُقلّل دائماً."
              )
            : t(
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
        <AlertTitle className="text-amber-800 text-sm">{t("① Réduction des lignes", "① اختزال الصفوف")}</AlertTitle>
        <AlertDescription className="text-amber-700 text-xs">
          {t(
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
        <AlertTitle className="text-amber-800 text-sm">{t("② Réduction des colonnes", "② اختزال الأعمدة")}</AlertTitle>
        <AlertDescription className="text-amber-700 text-xs">
          {t(
            "Pour chaque colonne, on soustrait le plus petit coût de la colonne à toutes ses cellules. Chaque colonne obtient ainsi au moins un zéro.",
            "لكل عمود، يُطرح أصغر تكلفة في العمود من جميع خلاياه. بهذا يحصل كل عمود على صفر واحد على الأقل."
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // covering
  if (step.isOptimal) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800 text-sm">
          {t("Solution optimale atteinte ✓", "تم الوصول إلى الحل الأمثل ✓")}
        </AlertTitle>
        <AlertDescription className="text-green-700 text-xs">
          {t(
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
        <AlertTitle className="text-slate-800 text-sm">
          {t("③ Couverture minimale des zéros", "③ التغطية الدنيا للأصفار")}
        </AlertTitle>
        <AlertDescription className="text-slate-700 text-xs">
          {t(
            "On cherche le nombre minimal de lignes (horizontales/verticales) couvrant tous les zéros. Ce nombre est encore inférieur à N : la matrice n'est pas encore optimale.",
            "يُبحث عن أقل عدد من الخطوط (أفقية/رأسية) تغطي جميع الأصفار. هذا العدد لا يزال أقل من N: المصفوفة ليست مثلى بعد."
          )}
        </AlertDescription>
      </Alert>
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertTitle className="text-red-800 text-sm">
          {t("④ Ajustement", "④ التعديل")}
        </AlertTitle>
        <AlertDescription className="text-red-700 text-xs">
          {t(
            `On soustrait la plus petite valeur non couverte (${fmt(step.minUncovered ?? 0, language)}) de toutes les cellules non couvertes, et on l'ajoute aux cellules couvertes deux fois (intersections des lignes). On répète ensuite la couverture.`,
            `تُطرح أصغر قيمة غير مغطاة (${fmt(step.minUncovered ?? 0, language)}) من جميع الخلايا غير المغطاة، وتُضاف إلى الخلايا المغطاة مرتين (تقاطعات الخطوط). ثم تُكرر عملية التغطية.`
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ── Analysis Tab ──────────────────────────────────────────────────────────────
function AnalysisTab({
  result, language, isMax, onSave, onPDF, isSaved, isExporting,
}: {
  result: HungarianResult;
  language: string;
  isMax: boolean;
  onSave: () => void;
  onPDF: () => void;
  isSaved: boolean;
  isExporting: boolean;
}) {
  const t = (fr: string, ar: string) => language === "ar" ? ar : fr;
  const {
    m, n, resourceNames, taskNames, originalCosts, finalAssignment,
    unassignedResources, unassignedTasks, hasAlternativeOptima, alternativeZeroCells,
    isInfeasible, iterations,
  } = result;

  const realPairs = finalAssignment.filter(({ i, j }) => i < m && j < n);
  const coveringSteps = iterations.length;

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: isMax ? t("Performance optimale", "الأداء الأمثل") : t("Coût optimal", "التكلفة المثلى"),
            value: fmt(result.totalCostReal, language),
            color: "text-green-700",
            bg: "bg-green-50 border-green-200",
            icon: <CheckCircle2 className="w-4 h-4 text-green-600" />,
          },
          {
            label: t("Affectations réelles", "التوزيعات الفعلية"),
            value: `${realPairs.length} / ${Math.max(m, n)}`,
            color: "text-foreground",
            bg: "bg-muted/40 border-border",
            icon: <Target className="w-4 h-4 text-muted-foreground" />,
          },
          {
            label: t("Étapes de couverture", "خطوات التغطية"),
            value: String(coveringSteps),
            color: "text-foreground",
            bg: "bg-muted/40 border-border",
            icon: <GitMerge className="w-4 h-4 text-muted-foreground" />,
          },
          {
            label: t("Objectif", "الهدف"),
            value: isMax ? t("Maximisation", "تعظيم") : t("Minimisation", "تقليل"),
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

      {/* Alerts */}
      {isInfeasible && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("Attention — affectation interdite détectée", "تنبيه — تم اكتشاف توزيع محظور")}</AlertTitle>
          <AlertDescription className="text-xs">
            {t(
              "L'algorithme a dû utiliser une cellule marquée comme interdite pour compléter l'affectation, car les contraintes rendaient le problème infaisable autrement. Vérifiez vos interdictions.",
              "اضطرت الخوارزمية لاستخدام خلية محظورة لإكمال التوزيع، لأن القيود جعلت المسألة غير قابلة للحل بطريقة أخرى. يرجى مراجعة الممنوعات."
            )}
          </AlertDescription>
        </Alert>
      )}
      {hasAlternativeOptima && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800 text-sm">
            {t("Solutions optimales alternatives détectées", "تم اكتشاف حلول مثلى بديلة")}
          </AlertTitle>
          <AlertDescription className="text-blue-700 text-xs">
            {t(
              `D'autres cellules à coût réduit nul (${alternativeZeroCells.map(c => `(${c.i+1},${c.j+1})`).join(", ")}) n'ont pas été utilisées dans cette affectation. Il existe donc au moins une autre affectation optimale avec exactement la même valeur totale — ce n'est pas une erreur, seulement une information.`,
              `توجد خلايا أخرى بتكلفة مختزلة صفرية (${alternativeZeroCells.map(c => `(${c.i+1},${c.j+1})`).join(", ")}) لم تُستخدم في هذا التوزيع. لذلك يوجد توزيع أمثل بديل واحد على الأقل بنفس القيمة الإجمالية تماماً — هذه ليست خطأً، بل مجرد معلومة.`
            )}
          </AlertDescription>
        </Alert>
      )}
      {(unassignedResources.length > 0 || unassignedTasks.length > 0) && (
        <Alert className="border-orange-200 bg-orange-50">
          <Info className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800 text-sm">
            {t("Ressources / tâches fictives — affectation incomplète", "موارد/مهام وهمية — توزيع غير كامل")}
          </AlertTitle>
          <AlertDescription className="text-orange-700 text-xs">
            {unassignedResources.length > 0 && (
              <div>
                {t(
                  `${unassignedResources.map(i => resourceNames[i]).join(", ")} ${unassignedResources.length > 1 ? "ne reçoivent" : "ne reçoit"} aucune tâche : le nombre de tâches était supérieur au nombre de ressources, une ressource fictive a comblé l'écart.`,
                  `${unassignedResources.map(i => resourceNames[i]).join(", ")} لا ${unassignedResources.length > 1 ? "يحصلون" : "يحصل"} على أي مهمة: كان عدد المهام أكبر من عدد الموارد، فسدّ مورد وهمي الفارق.`
                )}
              </div>
            )}
            {unassignedTasks.length > 0 && (
              <div>
                {t(
                  `${unassignedTasks.map(j => taskNames[j]).join(", ")} ${unassignedTasks.length > 1 ? "ne sont assignées" : "n'est assignée"} à aucune ressource : le nombre de ressources était supérieur au nombre de tâches, une tâche fictive a comblé l'écart.`,
                  `${unassignedTasks.map(j => taskNames[j]).join(", ")} لا ${unassignedTasks.length > 1 ? "تُخصَّص" : "تُخصَّص"} لأي مورد: كان عدد الموارد أكبر من عدد المهام، فسدّت مهمة وهمية الفارق.`
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Assignment table */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            {t("Affectation Optimale", "التوزيع الأمثل")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="px-3 py-2 text-left">{t("Ressource", "المورد")}</th>
                  <th className="px-3 py-2 text-left">{t("Tâche", "المهمة")}</th>
                  <th className="px-3 py-2 text-right">{isMax ? t("Score", "النقاط") : t("Coût", "التكلفة")}</th>
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
                    {t("TOTAL OPTIMAL", "المجموع الأمثل")}
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

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onSave} disabled={isSaved} variant={isSaved ? "outline" : "default"} className="flex-1 gap-2">
          {isSaved ? <Check className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
          {isSaved ? t("Enregistré ✓", "تم الحفظ ✓") : t("Enregistrer dans l'historique", "حفظ في السجل")}
        </Button>
        <Button onClick={onPDF} disabled={isExporting} variant="outline" className="flex-1 gap-2">
          {isExporting ? <span className="animate-spin text-base">⏳</span> : <Download className="w-4 h-4" />}
          {t("Exporter PDF", "تصدير PDF")}
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AssignmentSolution() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { problem, setProblem } = useAssignmentState();
  const { addProblem } = useAssignmentHistory();

  const initialParams = new URLSearchParams(search);
  const [pageTab, setPageTab] = useState<PageTab>(initialParams.get("tab") === "analysis" ? "analysis" : "solve");
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const result = useMemo(() => (problem ? runHungarian(problem) : null), [problem]);
  const displaySteps = useMemo(() => (result ? buildDisplaySteps(result) : []), [result]);

  useEffect(() => {
    if (problem) return;
    const params = new URLSearchParams(search);
    const sectorParam = params.get("sector") as AssignmentSectorKey | null;
    const tpl = sectorParam ? TEMPLATES[sectorParam as keyof typeof TEMPLATES] : null;
    if (tpl) {
      const resources = tpl.resources.map(r => ({ name: language === "ar" ? r.nameAr : r.nameFr }));
      const tasks = tpl.tasks.map(tk => ({ name: language === "ar" ? tk.nameAr : tk.nameFr }));
      const costs = tpl.costs.map(row => [...row]);
      const m = resources.length, n = tasks.length;
      const forbidden = Array.from({ length: m }, () => Array(n).fill(false));
      tpl.forbiddenCells?.forEach(([i, j]) => { if (i < m && j < n) forbidden[i][j] = true; });
      setProblem({
        name: language === "ar" ? tpl.nameAr : tpl.nameFr,
        sector: sectorParam!,
        objectiveType: tpl.objectiveType,
        resources, tasks, costs, forbidden,
      });
    } else {
      setLocation("/assignment/solve");
    }
  }, [problem, search, language, setLocation, setProblem]);

  useEffect(() => {
    if (!result) return;
    const params = new URLSearchParams(search);
    if (params.get("step") === "optimal") {
      setCurrentStep(buildDisplaySteps(result).length - 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (!problem || !result) return null;

  const isMax = problem.objectiveType === "maximize";
  const m = problem.resources.length;
  const n = problem.tasks.length;
  const step = displaySteps[Math.min(currentStep, displaySteps.length - 1)];
  const isLast = currentStep >= displaySteps.length - 1;

  function handleSave() {
    if (isSaved || !result) return;
    addProblem(problem!, result, (problem!.sector || "custom") as AssignmentSectorKey, language);
    setIsSaved(true);
  }

  async function handlePDF() {
    if (!result || isExporting) return;
    setIsExporting(true);
    setExportMsg(t("Génération du PDF…", "جارٍ إنشاء PDF…"));
    try {
      await generateAssignmentPDF({
        problem: problem!,
        result,
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

  return (
    <div className="container mx-auto px-4 py-4 max-w-5xl space-y-4">

      {/* Stage bar + header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <StageBar />
        <Button variant="ghost" size="sm" asChild>
          <Link href="/assignment/solve">
            <ChevronLeft className={cn("w-4 h-4 mr-1", isAr && "rotate-180")} />
            {t("Modifier les données", "تعديل البيانات")}
          </Link>
        </Button>
      </div>

      <div>
        <div className="flex items-center flex-wrap gap-2 mb-1">
          <h1 className="text-2xl font-bold text-foreground">
            {t("Solution Optimale — Méthode Hongroise", "الحل الأمثل — الطريقة الهنغارية")}
          </h1>
          <Badge variant="outline" className="text-xs">{problem.name}</Badge>
          <Badge className={cn("text-xs", isMax ? "bg-purple-600" : "bg-primary")}>
            {isMax ? t("↑ Maximisation", "↑ تعظيم") : t("↓ Minimisation", "↓ تقليل")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(
            `Matrice ${m}×${n}${result.N !== m || result.N !== n ? ` (résolue en ${result.N}×${result.N} après équilibrage)` : ""} — valeur optimale : ${fmt(result.totalCostReal, language)}`,
            `مصفوفة ${m}×${n}${result.N !== m || result.N !== n ? ` (حُلّت بحجم ${result.N}×${result.N} بعد التوازن)` : ""} — القيمة المثلى: ${fmt(result.totalCostReal, language)}`
          )}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: "solve" as PageTab, labelFr: "Résolution pas-à-pas", labelAr: "الحل خطوة بخطوة", icon: GitMerge },
          { id: "analysis" as PageTab, labelFr: "Analyse & Résultats", labelAr: "التحليل والنتائج", icon: BarChart3 },
        ] as const).map(tab => (
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
              <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0 ml-1">
                {t("Optimal", "مثالي")}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* ── Solve tab ── */}
      {pageTab === "solve" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">{isAr ? step.label.ar : step.label.fr}</CardTitle>
                  {step.isOptimal && (
                    <Badge className="bg-green-600 text-white text-xs">
                      <Star className="w-3 h-3 mr-1" />
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
                m={m}
                n={n}
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
              <StepExplanation step={step} language={language} isMax={isMax} />
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
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
                variant="ghost"
                size="sm"
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

      {/* ── Analysis tab ── */}
      {pageTab === "analysis" && (
        <AnalysisTab
          result={result}
          language={language}
          isMax={isMax}
          onSave={handleSave}
          onPDF={handlePDF}
          isSaved={isSaved}
          isExporting={isExporting}
        />
      )}

      {/* Export progress toast */}
      {exportMsg && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg text-sm z-50 flex items-center gap-2">
          {isExporting && <span className="animate-spin">⏳</span>}
          {exportMsg}
        </div>
      )}

      {/* Bottom nav */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="outline" size="sm" onClick={() => setLocation("/assignment/solve")} className="gap-1">
          <ArrowLeft className="w-4 h-4" />
          {t("Retour aux données", "العودة للبيانات")}
        </Button>
        {pageTab === "solve" && isLast && (
          <Button size="sm" onClick={handleSave} disabled={isSaved} className="gap-1">
            <BookmarkPlus className="w-4 h-4" />
            {isSaved ? t("Enregistré ✓", "تم الحفظ ✓") : t("Enregistrer", "حفظ")}
          </Button>
        )}
      </div>

    </div>
  );
}
