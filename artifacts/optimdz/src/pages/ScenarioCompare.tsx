import { useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { useScenarios, type Scenario } from "@/lib/ScenarioContext";
import { useProblemState } from "@/lib/ProblemContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Trash2,
  Play,
  Trophy,
  GitCompare,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Package2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Cell,
  XAxis,
  Tooltip as RechartTooltip,
} from "recharts";

function fmt(n: number, lang: string, decimals = 2) {
  return n.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    maximumFractionDigits: decimals,
  });
}

function fmtDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── mini bar chart inside scenario card ──────────────────────────────────────
function MiniBar({ scenario, lang }: { scenario: Scenario; lang: string }) {
  const vars = scenario.result.variables ?? [];
  if (vars.length === 0) return null;
  const data = vars.map((v) => ({ name: v.name, value: v.value }));
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const COLORS = ["#16a34a", "#2563eb", "#0d9488", "#4f46e5", "#ea580c"];
  return (
    <ResponsiveContainer width="100%" height={56}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={0} />
        <RechartTooltip
          formatter={(v: number) => [fmt(v, lang, 1), ""]}
          contentStyle={{ fontSize: 11, borderRadius: 8 }}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]} animationDuration={600}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.value === maxVal ? "#16a34a" : COLORS[i % COLORS.length]}
              fillOpacity={entry.value > 1e-6 ? 1 : 0.25}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── rank badge ────────────────────────────────────────────────────────────────
const RANK_STYLE: Record<number, string> = {
  0: "bg-green-100 text-green-800 border-green-300",   // best
  1: "bg-yellow-100 text-yellow-800 border-yellow-300", // second
  2: "bg-orange-100 text-orange-800 border-orange-300", // third
};
const DEFAULT_RANK = "bg-red-100 text-red-700 border-red-200";

// ── cell component ────────────────────────────────────────────────────────────
function CompareCell({
  value,
  rank,
  total,
  isBest,
  lang,
}: {
  value: number | null;
  rank: number;
  total: number;
  isBest: boolean;
  lang: string;
}) {
  if (value === null)
    return <td className="px-3 py-3 text-center text-muted-foreground text-sm">—</td>;
  return (
    <td className={cn(
      "px-3 py-3 text-center font-mono text-sm font-semibold whitespace-nowrap",
      isBest && "bg-green-50",
      rank === total - 1 && total > 1 && !isBest && "text-red-600",
    )}>
      <span className="flex items-center justify-center gap-1">
        {isBest && <Trophy className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
        {fmt(value, lang)}
      </span>
    </td>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function ScenarioCompare() {
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const { scenarios, deleteScenario, clearAll } = useScenarios();
  const { setInputAndResult } = useProblemState();
  const [confirmClear, setConfirmClear] = useState(false);

  // ── load scenario into solver ───────────────────────────────────────────────
  const handleLoad = (s: Scenario) => {
    setInputAndResult(s.input, s.result);
    setLocation("/simplex/results");
  };

  // ── empty state ─────────────────────────────────────────────────────────────
  if (scenarios.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-3xl text-center">
        <div className="rounded-2xl border-2 border-dashed border-muted-foreground/20 px-8 py-16 space-y-4">
          <GitCompare className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">
            {t("لم تحفظ أي سيناريو بعد", "Aucun scénario enregistré")}
          </h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            {t(
              "احل مسألة واحفظها للمقارنة — Résolvez un problème et sauvegardez-le pour comparer",
              "Résolvez un problème et sauvegardez-le pour commencer la comparaison."
            )}
          </p>
          <Button onClick={() => setLocation("/simplex/solve")} className="mt-2">
            <Play className="w-4 h-4 mr-2" />
            {t("حل مسألة جديدة", "Résoudre un nouveau problème")}
          </Button>
        </div>
      </div>
    );
  }

  // ── compute comparison metrics ──────────────────────────────────────────────
  const optValues = scenarios.map((s) => s.result.optimalValue ?? null);
  const maxOpt = Math.max(...(optValues.filter(Boolean) as number[]));
  const minOpt = Math.min(...(optValues.filter(Boolean) as number[]));
  const rankedOpt = [...optValues].sort((a, b) => (b ?? 0) - (a ?? 0));

  // All unique variable names (union)
  const allVarNames = Array.from(
    new Set(scenarios.flatMap((s) => (s.result.variables ?? []).map((v) => v.name)))
  );
  // All unique constraint names (union)
  const allConstraintNames = Array.from(
    new Set(scenarios.flatMap((s) => s.input.constraints.map((c) => c.name)))
  );

  // For a scenario + variable, return the optimal value
  const getVarValue = (s: Scenario, name: string) =>
    (s.result.variables ?? []).find((v) => v.name === name)?.value ?? null;

  // For each constraint, compute usage %
  const getConstraintUsage = (s: Scenario, cName: string) => {
    const cIdx = s.input.constraints.findIndex((c) => c.name === cName);
    if (cIdx < 0) return null;
    const c = s.input.constraints[cIdx];
    const vars = s.result.variables ?? [];
    const used = vars.reduce((sum, v, j) => sum + (c.coefficients[j] ?? 0) * v.value, 0);
    return c.rhs > 0 ? Math.round((used / c.rhs) * 100) : null;
  };

  // Binding constraint count per scenario
  const getBindingCount = (s: Scenario) =>
    s.result.sensitivityAnalysis?.constraints.filter((c) => c.isCritical).length ?? 0;

  const bindingCounts = scenarios.map(getBindingCount);
  const rankedBinding = [...bindingCounts].sort((a, b) => a - b); // fewer is better

  // financial impact
  const bestScenario = scenarios.reduce((best, s) =>
    (s.result.optimalValue ?? 0) > (best.result.optimalValue ?? 0) ? s : best
  );
  const worstScenario = scenarios.reduce((worst, s) =>
    (s.result.optimalValue ?? 0) < (worst.result.optimalValue ?? 0) ? s : worst
  );
  const gap = (bestScenario.result.optimalValue ?? 0) - (worstScenario.result.optimalValue ?? 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <span className="rounded-xl bg-primary/10 p-2 text-primary">
              <GitCompare className="w-7 h-7" />
            </span>
            {t("مقارنة السيناريوهات", "Comparaison des Scénarios")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("Comparaison des Scénarios", "مقارنة السيناريوهات")} —{" "}
            {scenarios.length} {t("سيناريو محفوظ", scenarios.length > 1 ? "scénarios enregistrés" : "scénario enregistré")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocation("/simplex/solve")}>
            <Play className="w-4 h-4 mr-1.5" />
            {t("مسألة جديدة", "Nouveau problème")}
          </Button>
          {confirmClear ? (
            <>
              <Button variant="destructive" size="sm" onClick={() => { clearAll(); setConfirmClear(false); }}>
                {t("تأكيد المسح", "Confirmer la suppression")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                {t("إلغاء", "Annuler")}
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmClear(true)}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              {t("مسح الكل", "Tout supprimer")}
            </Button>
          )}
        </div>
      </div>

      {/* Financial impact tracker */}
      {scenarios.length >= 2 && gap > 0.01 && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border-2 border-green-300 bg-green-50/60 px-5 py-4">
            <div className="flex items-center gap-2 text-green-700 font-semibold mb-1">
              <Trophy className="w-4 h-4" />
              {t("أفضل سيناريو", "Meilleur scénario")}
            </div>
            <p className="text-xl font-bold text-foreground truncate">{bestScenario.name}</p>
            <p className="text-2xl font-extrabold text-green-700 mt-1">
              {fmt(bestScenario.result.optimalValue ?? 0, language, 0)}
              <span className="text-sm font-normal text-muted-foreground ml-1">DZD</span>
            </p>
          </div>
          <div className="rounded-xl border-2 border-red-200 bg-red-50/40 px-5 py-4">
            <div className="flex items-center gap-2 text-red-600 font-semibold mb-1">
              <TrendingDown className="w-4 h-4" />
              {t("أدنى سيناريو", "Scénario le moins rentable")}
            </div>
            <p className="text-xl font-bold text-foreground truncate">{worstScenario.name}</p>
            <p className="text-2xl font-extrabold text-red-600 mt-1">
              {fmt(worstScenario.result.optimalValue ?? 0, language, 0)}
              <span className="text-sm font-normal text-muted-foreground ml-1">DZD</span>
            </p>
          </div>
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 px-5 py-4">
            <div className="flex items-center gap-2 text-primary font-semibold mb-1">
              <TrendingUp className="w-4 h-4" />
              {t("المكسب الإضافي", "Gain supplémentaire")}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("إذا اخترت السيناريو الأفضل", "En choisissant le meilleur scénario")}
            </p>
            <p className="text-2xl font-extrabold text-primary mt-1">
              +{fmt(gap, language, 0)}
              <span className="text-sm font-normal text-muted-foreground ml-1">DZD</span>
            </p>
          </div>
        </div>
      )}

      {/* Comparison table */}
      {scenarios.length >= 2 && (
        <Card className="border overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("جدول المقارنة", "Tableau de comparaison")}</CardTitle>
            <CardDescription>
              {t(
                "🏆 = الأفضل في كل صف — اللون الأخضر أفضل، الأحمر أدنى",
                "🏆 = meilleur de chaque ligne — vert = meilleur, rouge = moins bon"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {/* Sticky first column */}
                    <th className="sticky left-0 z-10 bg-muted/30 px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wide text-xs min-w-[160px] border-r">
                      {t("المؤشر", "Indicateur")}
                    </th>
                    {scenarios.map((s, i) => (
                      <th key={s.id} className="px-4 py-3 text-center font-semibold text-foreground text-xs min-w-[140px] border-l first:border-l-0">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-bold truncate max-w-[120px]">{s.name}</span>
                          <span className="text-xs text-muted-foreground font-normal">{fmtDate(s.savedAt, language)}</span>
                          <Badge variant="outline" className={cn("text-xs", RANK_STYLE[i] ?? DEFAULT_RANK)}>
                            #{i + 1}
                          </Badge>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Optimal value row */}
                  <tr className="border-b bg-primary/3">
                    <td className="sticky left-0 z-10 bg-primary/5 border-r px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      {t("القيمة المثلى (DZD)", "Valeur optimale (DZD)")}
                    </td>
                    {scenarios.map((s, i) => {
                      const v = s.result.optimalValue ?? null;
                      const rankIdx = v !== null ? rankedOpt.indexOf(v) : scenarios.length;
                      return (
                        <CompareCell
                          key={s.id}
                          value={v}
                          rank={rankIdx}
                          total={scenarios.length}
                          isBest={v === maxOpt}
                          lang={language}
                        />
                      );
                    })}
                  </tr>

                  {/* Binding constraints row */}
                  <tr className="border-b">
                    <td className="sticky left-0 z-10 bg-background border-r px-4 py-3 font-medium text-foreground flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      {t("القيود المُقيِّدة", "Contraintes actives")}
                    </td>
                    {scenarios.map((s, i) => {
                      const v = getBindingCount(s);
                      const isBest = v === rankedBinding[0] && rankedBinding[0] !== rankedBinding[rankedBinding.length - 1];
                      return (
                        <td key={s.id} className={cn("px-3 py-3 text-center font-mono font-semibold border-l first:border-l-0", isBest && "text-green-700 bg-green-50")}>
                          <span className="flex items-center justify-center gap-1">
                            {isBest && <Trophy className="w-3.5 h-3.5 text-yellow-500" />}
                            {v}
                          </span>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Variable rows */}
                  {allVarNames.map((vName) => {
                    const values = scenarios.map((s) => getVarValue(s, vName));
                    const maxV = Math.max(...(values.filter((v) => v !== null) as number[]));
                    const rankedV = [...values].sort((a, b) => (b ?? 0) - (a ?? 0));
                    return (
                      <tr key={vName} className="border-b hover:bg-muted/20">
                        <td className="sticky left-0 z-10 bg-background border-r px-4 py-3 font-medium text-foreground flex items-center gap-2">
                          <Package2 className="w-4 h-4 text-blue-500" />
                          {vName}
                        </td>
                        {scenarios.map((s) => {
                          const v = getVarValue(s, vName);
                          const rankIdx = v !== null ? rankedV.indexOf(v) : scenarios.length;
                          return (
                            <CompareCell key={s.id} value={v} rank={rankIdx} total={scenarios.length} isBest={v === maxV && maxV > 1e-6} lang={language} />
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* Constraint usage rows */}
                  {allConstraintNames.map((cName) => {
                    const values = scenarios.map((s) => getConstraintUsage(s, cName));
                    const maxUsage = Math.max(...(values.filter((v) => v !== null) as number[]));
                    const minUsage = Math.min(...(values.filter((v) => v !== null) as number[]));
                    return (
                      <tr key={cName} className="border-b hover:bg-muted/20">
                        <td className="sticky left-0 z-10 bg-background border-r px-4 py-3 font-medium text-foreground text-xs leading-tight">
                          <span className="block font-semibold">{cName}</span>
                          <span className="text-muted-foreground">{t("استخدام %", "Utilisation %")}</span>
                        </td>
                        {scenarios.map((s) => {
                          const v = getConstraintUsage(s, cName);
                          const isBest = v !== null && v === minUsage && minUsage !== maxUsage; // less usage = more flexibility
                          const isWorst = v !== null && v === maxUsage && minUsage !== maxUsage;
                          return (
                            <td key={s.id} className={cn(
                              "px-3 py-3 text-center border-l first:border-l-0",
                              v !== null && v >= 100 && "bg-red-50",
                              isBest && "bg-green-50"
                            )}>
                              {v !== null ? (
                                <span className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
                                  v >= 100 ? "bg-red-100 text-red-800" : v >= 80 ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
                                )}>
                                  {isBest && <Trophy className="w-3 h-3 text-yellow-500" />}
                                  {v}%
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scenario cards */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">
          {t("السيناريوهات المحفوظة", "Scénarios enregistrés")}
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((s, rank) => {
            const optVal = s.result.optimalValue ?? 0;
            const isBest = optVal === maxOpt && scenarios.length > 1;
            const isWorst = optVal === minOpt && scenarios.length > 1 && minOpt !== maxOpt;
            const bindingC = getBindingCount(s);
            const activeVars = (s.result.variables ?? []).filter((v) => v.value > 1e-6).length;
            return (
              <Card key={s.id} className={cn(
                "border-2 transition-all hover:shadow-md",
                isBest && "border-green-400",
                isWorst && !isBest && "border-red-300",
                !isBest && !isWorst && "border-border"
              )}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        {isBest && <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />}
                        <span className="truncate">{s.name}</span>
                      </CardTitle>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {fmtDate(s.savedAt, language)}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {isBest && (
                        <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
                          {t("الأفضل", "Meilleur")}
                        </Badge>
                      )}
                      {isWorst && (
                        <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">
                          {t("الأدنى", "Moins bon")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Optimal value */}
                  <div className={cn(
                    "rounded-lg px-4 py-3 text-center",
                    isBest ? "bg-green-50 border border-green-200" : "bg-muted/40 border"
                  )}>
                    <p className="text-xs text-muted-foreground">{t("القيمة المثلى", "Valeur optimale")}</p>
                    <p className={cn("text-2xl font-extrabold", isBest ? "text-green-700" : "text-foreground")}>
                      {fmt(optVal, language, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">DZD / دج</p>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                      <Package2 className="w-3 h-3" />
                      {activeVars} {t("منتج نشط", "produits actifs")}
                    </span>
                    {bindingC > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        {bindingC} {t("قيد مُقيِّد", "contrainte active")}
                      </span>
                    )}
                    {bindingC === 0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        {t("لا قيود مُقيِّدة", "Pas de contrainte active")}
                      </span>
                    )}
                  </div>

                  {/* Mini bar chart */}
                  <div className="rounded-lg border bg-muted/20 px-2 pt-2 pb-0">
                    <p className="text-xs text-muted-foreground px-1 mb-1">{t("الكميات", "Quantités")}</p>
                    <MiniBar scenario={s} lang={language} />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleLoad(s)}
                    >
                      <Play className="w-4 h-4 mr-1.5" />
                      {t("تحميل", "Charger")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive border-destructive/30"
                      onClick={() => deleteScenario(s.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

    </div>
  );
}
