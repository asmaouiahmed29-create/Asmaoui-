import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { useTransportState } from "@/lib/TransportContext";
import { TEMPLATES } from "@/pages/transportation/Solve";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  Truck, ChevronLeft, ChevronRight, ArrowRight,
  Play, Pause, SkipForward, SkipBack,
  CheckCircle2, Lock, Zap, AlertTriangle,
  BarChart3, GitCompare, Info, TrendingDown, TrendingUp,
} from "lucide-react";

import {
  solveNWC, solveLCM, solveVAM,
  METHOD_META, type MethodKey, type SolveResult,
} from "@/lib/transportAlgorithms";
import type { TransportInput } from "@/lib/transportAlgorithms";

// ── Stage progress bar ────────────────────────────────────────────────────────
interface StageBarProps { current: 1 | 2 | 3 }
function StageBar({ current }: StageBarProps) {
  const { t } = useLanguage();
  const stages = [
    { n: 1, fr: "Données",          ar: "البيانات" },
    { n: 2, fr: "Solution initiale", ar: "الحل الأولي" },
    { n: 3, fr: "Optimisation",      ar: "التحسين" },
  ] as const;

  return (
    <div className="flex items-center gap-0 text-sm select-none">
      {stages.map((s, idx) => {
        const done    = s.n < current;
        const active  = s.n === current;
        const locked  = s.n > current;
        return (
          <div key={s.n} className="flex items-center">
            {idx > 0 && (
              <div className={cn(
                "h-px w-8 mx-1",
                done ? "bg-primary" : "bg-border"
              )} />
            )}
            <div className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors",
              done   && "bg-primary/10 text-primary",
              active && "bg-primary text-primary-foreground shadow",
              locked && "text-muted-foreground"
            )}>
              {done   && <CheckCircle2 className="w-3.5 h-3.5" />}
              {active && <span className="text-xs font-bold">{s.n}</span>}
              {locked && <Lock className="w-3 h-3" />}
              <span className="text-xs">{t(s.fr, s.ar)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Method selector card ──────────────────────────────────────────────────────
interface MethodCardProps {
  methodKey: MethodKey;
  result: SolveResult;
  objective: "minimize" | "maximize";
  isBest: boolean;
  isSelected: boolean;
  onClick: () => void;
}
function MethodCard({ methodKey, result, objective, isBest, isSelected, onClick }: MethodCardProps) {
  const { t } = useLanguage();
  const meta  = METHOD_META[methodKey];
  const isMin = objective === "minimize";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border-2 bg-card p-5 text-left transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isSelected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : meta.color
      )}
    >
      {isBest && (
        <div className="absolute -top-2.5 right-4">
          <Badge className="bg-green-600 text-white text-xs shadow">
            {t("Meilleur", "الأفضل")} ✓
          </Badge>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className={cn("rounded-lg px-2.5 py-1 text-xs font-bold", meta.iconBg)}>
          {meta.shortFr}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate">{t(meta.labelFr, meta.labelAr)}</div>
        </div>
        <ChevronRight className={cn(
          "w-4 h-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5",
          isSelected && "text-primary"
        )} />
      </div>

      <div className="bg-muted/60 rounded-lg p-3 text-center">
        <div className="text-xs text-muted-foreground mb-0.5">
          {isMin ? t("Coût total initial", "التكلفة الإجمالية الأولية") : t("Profit total initial", "الربح الإجمالي الأولي")}
        </div>
        <div className={cn(
          "text-xl font-bold tabular-nums",
          isBest && isMin  ? "text-green-600" : "",
          isBest && !isMin ? "text-green-600" : "",
          !isBest ? "text-foreground" : ""
        )}>
          {result.totalCost.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {result.steps.length} {t("allocations", "تخصيصات")}
          {result.isDegenerate && (
            <span className="ml-1 text-amber-600">⚠ {t("dégénéré", "متدهور")}</span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {t(meta.descFr, meta.descAr)}
      </p>
    </button>
  );
}

// ── Tableau grid ──────────────────────────────────────────────────────────────
interface TableauGridProps {
  result:       SolveResult;
  currentStep:  number;    // -1 = initial blank, 0..N-1 = steps
  objective:    "minimize" | "maximize";
}
function TableauGrid({ result, currentStep, objective }: TableauGridProps) {
  const { t } = useLanguage();
  const { balanced, steps } = result;
  const m = balanced.sources.length;
  const n = balanced.destinations.length;

  const isMin = objective === "minimize";

  // Compute display state for current step
  const display = useMemo(() => {
    const supply = balanced.sources.map(s => s.supply);
    const demand = balanced.destinations.map(d => d.demand);

    if (currentStep < 0) {
      return {
        supply, demand,
        allocMap: new Map<string, number>(),
        activeI: -1, activeJ: -1,
        exhaustedRows: new Set<number>(),
        exhaustedCols: new Set<number>(),
      };
    }

    const allocMap = new Map<string, number>();
    for (let k = 0; k <= currentStep; k++) {
      const s = steps[k];
      const key = `${s.i},${s.j}`;
      allocMap.set(key, (allocMap.get(key) || 0) + s.amount);
    }

    const exhaustedRows = new Set<number>();
    const exhaustedCols = new Set<number>();
    const curS = steps[currentStep];
    return {
      supply: curS.supplyAfter,
      demand: curS.demandAfter,
      allocMap,
      activeI: curS.i,
      activeJ: curS.j,
      exhaustedRows,
      exhaustedCols,
    };
  }, [currentStep, steps, balanced]);

  // Build exhausted sets from supply/demand
  const exhaustedRows = useMemo(() => {
    const s = new Set<number>();
    display.supply.forEach((v, i) => { if (v === 0) s.add(i); });
    return s;
  }, [display.supply]);
  const exhaustedCols = useMemo(() => {
    const s = new Set<number>();
    display.demand.forEach((v, j) => { if (v === 0) s.add(j); });
    return s;
  }, [display.demand]);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table
        className="border-collapse text-sm"
        style={{ minWidth: `${Math.max(480, 160 + n * 110 + 90)}px` }}
      >
        {/* ── Header: destination names ── */}
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-muted px-3 py-2.5 border-b border-r border-border text-left min-w-[150px]">
              <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Truck className="w-3 h-3" />
                <span>{t("Source \\ Dest.", "المصدر \\ الوجهة")}</span>
              </div>
            </th>
            {balanced.destinations.map((dest, j) => (
              <th key={j} className={cn(
                "px-2 py-2 border-b border-r border-border text-center min-w-[100px] transition-colors",
                exhaustedCols.has(j)              && "bg-muted/70 opacity-60",
                !exhaustedCols.has(j)             && "bg-muted",
                balanced.dummyDestIndex === j     && "bg-amber-50",
                display.activeJ === j && currentStep >= 0 && "bg-green-50",
              )}>
                <span className={cn(
                  "text-xs font-medium",
                  balanced.dummyDestIndex === j && "italic text-amber-700",
                  display.activeJ === j && currentStep >= 0 && "text-green-700 font-bold",
                )}>
                  {dest.name}
                </span>
              </th>
            ))}
            <th className="px-3 py-2.5 border-b border-l border-border bg-primary/8 text-center min-w-[80px]">
              <span className="text-xs font-bold text-primary uppercase tracking-wide">
                {t("Offre", "العرض")}
              </span>
            </th>
          </tr>
        </thead>

        {/* ── Body: source rows + cost/allocation cells ── */}
        <tbody>
          {balanced.sources.map((src, i) => {
            const rowExhausted = exhaustedRows.has(i);
            const isDummyRow   = balanced.dummySourceIndex === i;
            return (
              <tr
                key={i}
                className={cn(
                  "transition-colors",
                  rowExhausted                      && "opacity-60",
                  isDummyRow                        && "bg-amber-50/60",
                  !rowExhausted && !isDummyRow && i % 2 === 0 && "bg-background",
                  !rowExhausted && !isDummyRow && i % 2 === 1 && "bg-muted/20",
                  display.activeI === i && currentStep >= 0 && "bg-green-50/40",
                )}
              >
                {/* Source name (sticky) */}
                <td className={cn(
                  "sticky left-0 z-10 px-3 py-2 border-b border-r border-border font-medium text-sm",
                  isDummyRow && "italic text-amber-700 bg-amber-50/60",
                  !isDummyRow && rowExhausted && "bg-muted/60 text-muted-foreground",
                  !isDummyRow && !rowExhausted && "bg-inherit text-foreground",
                )}>
                  <div className="flex items-center gap-2">
                    {rowExhausted && (
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                    )}
                    <span className="truncate max-w-[130px]">{src.name}</span>
                  </div>
                </td>

                {/* Cost/allocation cells */}
                {balanced.destinations.map((_, j) => {
                  const key         = `${i},${j}`;
                  const alloc       = display.allocMap.get(key) || 0;
                  const isActive    = display.activeI === i && display.activeJ === j && currentStep >= 0;
                  const isPrev      = alloc > 0 && !isActive;
                  const colExhausted = exhaustedCols.has(j);
                  const isDummyCol   = balanced.dummyDestIndex === j;

                  return (
                    <td key={j} className={cn(
                      "relative px-1 py-1 border-b border-r border-border text-center transition-all",
                      isActive  && "bg-green-100 ring-2 ring-inset ring-green-500",
                      isPrev    && "bg-primary/8",
                      !isActive && !isPrev && colExhausted && "bg-muted/40",
                      isDummyCol && !isActive && !isPrev && "bg-amber-50/30",
                    )}>
                      {/* Cost in top-right corner */}
                      <span className={cn(
                        "absolute top-1 right-1.5 text-[9px] tabular-nums leading-none",
                        isMin ? "text-muted-foreground" : "text-purple-500",
                        isActive && (isMin ? "text-green-600" : "text-purple-600"),
                        isDummyCol && "text-amber-500",
                      )}>
                        {balanced.costs[i][j]}
                      </span>

                      {/* Allocation in center */}
                      <div className="pt-3 pb-0.5 px-1 min-h-[36px] flex items-center justify-center">
                        {alloc > 0 ? (
                          <span className={cn(
                            "font-bold tabular-nums text-sm leading-none",
                            isActive && "text-green-700 text-base",
                            isPrev   && "text-primary",
                          )}>
                            {alloc.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                      </div>

                      {/* Active indicator dot */}
                      {isActive && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-500" />
                      )}
                    </td>
                  );
                })}

                {/* Supply remaining */}
                <td className={cn(
                  "px-3 py-2 border-b border-l border-border text-center tabular-nums font-semibold",
                  rowExhausted ? "text-muted-foreground bg-muted/30 line-through" : "text-primary bg-primary/5",
                )}>
                  {display.supply[i].toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* ── Footer: demand remaining ── */}
        <tfoot>
          <tr className="bg-primary/5">
            <td className="sticky left-0 z-10 bg-primary/5 px-3 py-2 border-t border-r border-border">
              <span className="text-xs font-bold text-primary uppercase tracking-wide">
                {t("Demande", "الطلب")}
              </span>
            </td>
            {balanced.destinations.map((_, j) => {
              const colExhausted = exhaustedCols.has(j);
              return (
                <td key={j} className={cn(
                  "px-2 py-2 border-t border-r border-border text-center tabular-nums font-semibold transition-colors",
                  colExhausted ? "text-muted-foreground bg-muted/30 line-through" : "text-primary",
                )}>
                  {display.demand[j].toLocaleString()}
                </td>
              );
            })}
            <td className="px-3 py-2 border-t border-l border-border text-center">
              <span className="text-xs text-muted-foreground">
                {t("Restant", "المتبقي")}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Step explanation ──────────────────────────────────────────────────────────
interface StepExplanationProps {
  result:      SolveResult;
  stepIndex:   number;
  objective:   "minimize" | "maximize";
}
function StepExplanation({ result, stepIndex, objective }: StepExplanationProps) {
  const { t } = useLanguage();
  if (stepIndex < 0 || stepIndex >= result.steps.length) return null;

  const step     = result.steps[stepIndex];
  const { balanced } = result;
  const srcName  = balanced.sources[step.i]?.name      ?? `S${step.i + 1}`;
  const dstName  = balanced.destinations[step.j]?.name ?? `D${step.j + 1}`;
  const isMin    = objective === "minimize";
  const costWord = isMin ? t("coût", "تكلفة") : t("profit", "ربح");

  const methodNote = (() => {
    if (result.method === "nwc") {
      return t(
        `Coin nord-ouest disponible : ligne ${step.i + 1}, colonne ${step.j + 1}.`,
        `الزاوية الشمالية الغربية المتاحة: صف ${step.i + 1}، عمود ${step.j + 1}.`
      );
    }
    if (result.method === "lcm") {
      return t(
        `${isMin ? "Coût unitaire minimum" : "Profit unitaire maximum"} disponible : ${step.cost}.`,
        `${isMin ? "أدنى تكلفة وحدوية" : "أعلى ربح وحدوي"} متاحة: ${step.cost}.`
      );
    }
    if (result.method === "vam" && step.penalty !== undefined) {
      const src = step.penaltySource === "row"
        ? t(`Ligne ${(step.penaltyIndex ?? 0) + 1}`, `الصف ${(step.penaltyIndex ?? 0) + 1}`)
        : t(`Colonne ${(step.penaltyIndex ?? 0) + 1}`, `العمود ${(step.penaltyIndex ?? 0) + 1}`);
      return t(
        `Pénalité maximale = ${step.penalty} sur ${src}. ${isMin ? "Coût min" : "Profit max"} dans cette ligne/colonne : ${step.cost}.`,
        `أقصى عقوبة = ${step.penalty} على ${src}. ${isMin ? "أدنى تكلفة" : "أعلى ربح"} في هذا الصف/العمود: ${step.cost}.`
      );
    }
    return "";
  })();

  const exhaustNote = step.exhaustedRow && step.exhaustedCol
    ? t("Source et destination toutes deux épuisées (cas dégénéré).", "المصدر والوجهة كلاهما مستنفدان (حالة متدهورة).")
    : step.exhaustedRow
      ? t(`Source « ${srcName} » épuisée — passer à la ligne suivante.`, `المصدر « ${srcName} » مستنفد — الانتقال للصف التالي.`)
      : step.exhaustedCol
        ? t(`Destination « ${dstName} » satisfaite — passer à la colonne suivante.`, `الوجهة « ${dstName} » مُشبعة — الانتقال للعمود التالي.`)
        : "";

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
          {stepIndex + 1}
        </div>
        <div className="space-y-1.5 text-sm text-green-900">
          {methodNote && <p className="font-medium">{methodNote}</p>}
          <p>
            {t(
              `Allouer `,
              `تخصيص `
            )}
            <strong className="text-green-700">{step.amount.toLocaleString()} {t("unités", "وحدة")}</strong>
            {" "}{t("de", "من")}{" "}
            <strong>«{srcName}»</strong>
            {" "}{t("vers", "إلى")}{" "}
            <strong>«{dstName}»</strong>.
            {" "}({costWord} unitaire = <strong>{step.cost}</strong>,
            contribution = <strong className="text-green-700">{step.contribution.toLocaleString()}</strong>)
          </p>
          {exhaustNote && (
            <p className="text-green-700 text-xs">{exhaustNote}</p>
          )}
          <p className="text-xs text-green-700 font-medium border-t border-green-200 pt-1.5 mt-1.5">
            {isMin ? t("Coût cumulé", "التكلفة التراكمية") : t("Profit cumulé", "الربح التراكمي")}
            {" : "}<strong>{step.cumulativeCost.toLocaleString()}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Allocation summary ────────────────────────────────────────────────────────
interface AllocationSummaryProps {
  result:    SolveResult;
  objective: "minimize" | "maximize";
}
function AllocationSummary({ result, objective }: AllocationSummaryProps) {
  const { t } = useLanguage();
  const isMin = objective === "minimize";
  const { balanced, allocation, steps, totalCost } = result;
  const m = balanced.sources.length;
  const n = balanced.destinations.length;

  const nonZero = steps.filter(s => s.amount > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          {t("Récapitulatif de la solution initiale", "ملخص الحل الأولي")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Allocation table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted">
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                  {t("Source", "المصدر")}
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                  {t("Destination", "الوجهة")}
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                  {t("Quantité", "الكمية")}
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                  {isMin ? t("Coût unitaire", "التكلفة الوحدوية") : t("Profit unitaire", "الربح الوحدوي")}
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                  {t("Total", "المجموع")}
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: m }, (_, i) =>
                Array.from({ length: n }, (_, j) => {
                  const qty = allocation[i][j];
                  if (qty === 0) return null;
                  const cost = balanced.costs[i][j];
                  const isDummyRow = balanced.dummySourceIndex === i;
                  const isDummyCol = balanced.dummyDestIndex === j;
                  return (
                    <tr key={`${i}-${j}`} className={cn(
                      "border-b border-border/50 hover:bg-muted/40 transition-colors",
                      (isDummyRow || isDummyCol) && "bg-amber-50/50 text-amber-800",
                    )}>
                      <td className="px-3 py-1.5">
                        <span className={cn("text-sm", isDummyRow && "italic")}>{balanced.sources[i].name}</span>
                        {isDummyRow && <span className="ml-1 text-[10px] text-amber-600">({t("fictive", "وهمية")})</span>}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={cn("text-sm", isDummyCol && "italic")}>{balanced.destinations[j].name}</span>
                        {isDummyCol && <span className="ml-1 text-[10px] text-amber-600">({t("fictive", "وهمية")})</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">{qty.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{cost}</td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-primary">
                        {(qty * cost).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-primary/5 font-bold">
                <td colSpan={4} className="px-3 py-2.5 text-right text-sm border-t border-border">
                  {isMin ? t("Coût total initial", "التكلفة الإجمالية الأولية") : t("Profit total initial", "الربح الإجمالي الأولي")}
                </td>
                <td className="px-3 py-2.5 text-right text-primary text-base border-t border-border tabular-nums">
                  {totalCost.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-xl font-bold text-primary">{nonZero.length}</div>
            <div className="text-xs text-muted-foreground">{t("Allocations non nulles", "تخصيصات غير صفرية")}</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-xl font-bold text-foreground">{m + n - 1}</div>
            <div className="text-xs text-muted-foreground">{t("Variables de base requises", "متغيرات أساسية مطلوبة")}</div>
          </div>
          <div className={cn(
            "rounded-lg p-3 text-center col-span-2 sm:col-span-1",
            result.isDegenerate ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"
          )}>
            <div className={cn(
              "text-base font-bold",
              result.isDegenerate ? "text-amber-700" : "text-green-700"
            )}>
              {result.isDegenerate ? t("Dégénéré", "متدهور") : t("Non dégénéré ✓", "غير متدهور ✓")}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("Qualité de la base", "جودة الأساس")}
            </div>
          </div>
        </div>

        {result.isDegenerate && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle className="text-amber-800 text-sm">
              {t("Solution dégénérée détectée", "تم اكتشاف حل متدهور")}
            </AlertTitle>
            <AlertDescription className="text-amber-700 text-xs">
              {t(
                `${nonZero.length} allocations trouvées, ${m + n - 1} requises. L'étape MODI (Stage 3) gèrera la dégénérescence automatiquement.`,
                `تم العثور على ${nonZero.length} تخصيصاً، ${m + n - 1} مطلوباً. ستتعامل مرحلة MODI (المرحلة 3) مع التدهور تلقائياً.`
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ── Compare summary (shown when Compare All is selected) ─────────────────────
interface ComparePanelProps {
  results: Record<MethodKey, SolveResult>;
  objective: "minimize" | "maximize";
  onSelectMethod: (m: MethodKey) => void;
  selectedMethod: MethodKey;
}
function ComparePanel({ results, objective, onSelectMethod, selectedMethod }: ComparePanelProps) {
  const { t } = useLanguage();
  const isMin = objective === "minimize";

  const best = (Object.keys(results) as MethodKey[]).reduce((prev, cur) =>
    isMin
      ? results[cur].totalCost < results[prev].totalCost ? cur : prev
      : results[cur].totalCost > results[prev].totalCost ? cur : prev
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <GitCompare className="w-4 h-4" />
        <span>
          {t(
            "Comparez les trois méthodes. Cliquez pour voir le détail pas-à-pas.",
            "قارن الثلاث طرق. انقر لرؤية التفاصيل خطوة بخطوة."
          )}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(["nwc", "lcm", "vam"] as MethodKey[]).map(mk => (
          <MethodCard
            key={mk}
            methodKey={mk}
            result={results[mk]}
            objective={objective}
            isBest={mk === best}
            isSelected={mk === selectedMethod}
            onClick={() => onSelectMethod(mk)}
          />
        ))}
      </div>

      {/* Best method highlight */}
      <Alert className="border-green-200 bg-green-50 text-green-900 [&>svg]:text-green-600">
        <CheckCircle2 className="w-4 h-4" />
        <AlertTitle className="text-green-800 text-sm">
          {t("Meilleure solution initiale", "أفضل حل أولي")} : {t(METHOD_META[best].labelFr, METHOD_META[best].labelAr)}
        </AlertTitle>
        <AlertDescription className="text-green-700 text-xs">
          {isMin
            ? t(
                `${METHOD_META[best].shortFr} donne le coût initial le plus bas : ${results[best].totalCost.toLocaleString()} (économie de ${(Math.max(...(Object.values(results) as SolveResult[]).map(r => r.totalCost)) - results[best].totalCost).toLocaleString()} par rapport à la pire méthode).`,
                `${METHOD_META[best].shortFr} يعطي أدنى تكلفة أولية: ${results[best].totalCost.toLocaleString()} (توفير ${(Math.max(...(Object.values(results) as SolveResult[]).map(r => r.totalCost)) - results[best].totalCost).toLocaleString()} مقارنة بأسوأ طريقة).`
              )
            : t(
                `${METHOD_META[best].shortFr} donne le profit initial le plus élevé : ${results[best].totalCost.toLocaleString()}.`,
                `${METHOD_META[best].shortFr} يعطي أعلى ربح أولي: ${results[best].totalCost.toLocaleString()}.`
              )
          }
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ── Step navigator ────────────────────────────────────────────────────────────
interface StepNavProps {
  totalSteps:   number;
  currentStep:  number;
  isPlaying:    boolean;
  onChange:     (s: number) => void;
  onTogglePlay: () => void;
}
function StepNav({ totalSteps, currentStep, isPlaying, onChange, onTogglePlay }: StepNavProps) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-4 py-2">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => onChange(-1)}
          disabled={currentStep < 0}
          title={t("Début", "البداية")}
        >
          <SkipBack className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => onChange(currentStep - 1)}
          disabled={currentStep < 0}
          title={t("Précédent", "السابق")}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={isPlaying ? "destructive" : "default"}
          size="sm"
          className="h-8 px-3 gap-1.5"
          onClick={onTogglePlay}
        >
          {isPlaying
            ? <><Pause className="w-3.5 h-3.5" />{t("Pause", "إيقاف")}</>
            : <><Play  className="w-3.5 h-3.5" />{t("Jouer", "تشغيل")}</>
          }
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
          {currentStep < 0
            ? t("État initial", "الحالة الأولية")
            : t(`Étape ${currentStep + 1} / ${totalSteps}`, `الخطوة ${currentStep + 1} / ${totalSteps}`)
          }
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => onChange(currentStep + 1)}
          disabled={currentStep >= totalSteps - 1}
          title={t("Suivant", "التالي")}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => onChange(totalSteps - 1)}
          disabled={currentStep >= totalSteps - 1}
          title={t("Fin", "النهاية")}
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
type ViewMode = "select" | MethodKey | "compare";

// Empty fallback input for when problem is not yet in context
const EMPTY_INPUT: TransportInput = {
  sources: [], destinations: [], costs: [], objective: "minimize",
};

export default function TransportSolution() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { problem: contextProblem, setProblem } = useTransportState();

  // URL param fallback — allows direct links like ?sector=trade for demos/testing
  const urlSector = new URLSearchParams(search).get("sector");
  useEffect(() => {
    if (!contextProblem && urlSector) {
      const tpl = TEMPLATES[urlSector as keyof typeof TEMPLATES];
      if (tpl) {
        setProblem({
          name:          language === "ar" ? tpl.nameAr : tpl.nameFr,
          sector:        urlSector,
          objectiveType: tpl.objectiveType,
          sources:      tpl.sources.map(s => ({ name: language === "ar" ? s.nameAr : s.nameFr, supply: s.supply })),
          destinations: tpl.destinations.map(d => ({ name: language === "ar" ? d.nameAr : d.nameFr, demand: d.demand })),
          costs:        tpl.costs.map(row => [...row]),
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSector]);

  const problem = contextProblem;

  // Build the solver input — safe even when problem is null
  const input: TransportInput = useMemo(() => problem
    ? { sources: problem.sources, destinations: problem.destinations, costs: problem.costs, objective: problem.objectiveType }
    : EMPTY_INPUT,
  [problem]);

  // Run all 3 algorithms (fast, pure, synchronous)
  const results = useMemo<Record<MethodKey, SolveResult>>(() => ({
    nwc: solveNWC(input),
    lcm: solveLCM(input),
    vam: solveVAM(input),
  }), [input]);

  const isMin = problem?.objectiveType !== "maximize";

  const bestMethod = useMemo<MethodKey>(() =>
    (["nwc", "lcm", "vam"] as MethodKey[]).reduce((prev, cur) =>
      isMin
        ? results[cur].totalCost < results[prev].totalCost ? cur : prev
        : results[cur].totalCost > results[prev].totalCost ? cur : prev
    ),
  [results, isMin]);

  // UI state — all hooks called unconditionally (React rules)
  const [viewMode,     setViewMode]     = useState<ViewMode>("select");
  const [activeMethod, setActiveMethod] = useState<MethodKey>("nwc");
  const [currentStep,  setCurrentStep]  = useState(-1);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync activeMethod when bestMethod resolves (first render after problem loads)
  useEffect(() => {
    setActiveMethod(bestMethod);
  }, [bestMethod]);

  // Redirect if no problem in context (and no URL sector param fallback)
  useEffect(() => {
    if (!problem && !urlSector) setLocation("/transport/solve");
  }, [problem, urlSector, setLocation]);

  const activeResult = results[activeMethod];
  const totalSteps   = activeResult.steps.length;

  // Auto-play timer
  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= totalSteps - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1200);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [isPlaying, totalSteps]);

  // Reset step when changing method
  const handleSelectMethod = (mk: MethodKey) => {
    setIsPlaying(false);
    setCurrentStep(-1);
    setActiveMethod(mk);
    setViewMode(mk);
  };

  const handleStepChange = (n: number) => {
    setIsPlaying(false);
    setCurrentStep(Math.max(-1, Math.min(n, totalSteps - 1)));
  };

  const handleTogglePlay = () => {
    if (currentStep >= totalSteps - 1) setCurrentStep(-1);
    setIsPlaying(p => !p);
  };

  // Early return after all hooks — redirect handled by useEffect above
  if (!problem) return null;

  // Balanced problem info
  const bal = activeResult.balanced;
  const hasDummy = bal.dummySourceIndex !== null || bal.dummyDestIndex !== null;

  const isSelectMode  = viewMode === "select";
  const isCompareMode = viewMode === "compare";
  const isSolveMode   = !isSelectMode && !isCompareMode;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <StageBar current={2} />
          <div className="flex items-center gap-2">
            <Button
              type="button" variant="ghost" size="sm"
              onClick={() => setLocation("/transport/solve")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className={cn("w-4 h-4 mr-1", isAr && "rotate-180")} />
              {t("Modifier les données", "تعديل البيانات")}
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-foreground">
                {isSolveMode
                  ? t(`Solution initiale — ${t(METHOD_META[activeMethod].labelFr, METHOD_META[activeMethod].labelAr)}`,
                      `الحل الأولي — ${t(METHOD_META[activeMethod].labelFr, METHOD_META[activeMethod].labelAr)}`)
                  : isCompareMode
                    ? t("Comparaison des méthodes", "مقارنة الطرق")
                    : t("Choisir la méthode de résolution", "اختيار طريقة الحل")
                }
              </h1>
              <Badge variant="secondary" className="text-xs">
                {problem.name}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs gap-1",
                  isMin ? "border-blue-200 text-blue-700" : "border-purple-200 text-purple-700"
                )}
              >
                {isMin
                  ? <><TrendingDown className="w-3 h-3" />{t("Minimisation", "تقليل")}</>
                  : <><TrendingUp   className="w-3 h-3" />{t("Maximisation", "تعظيم")}</>
                }
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {problem.sources.length} {t("sources", "مصادر")} × {problem.destinations.length} {t("destinations", "وجهات")}
              {hasDummy && (
                <span className="ml-2 text-amber-600 text-xs">
                  · {t("Ligne/colonne fictive ajoutée (problème déséquilibré)", "تمت إضافة صف/عمود وهمي (مسألة غير متوازنة)")}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── Dummy row/col notice ─────────────────────────────────────────── */}
      {hasDummy && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle className="text-amber-800 text-sm">
            {t("Équilibrage automatique appliqué", "تم تطبيق الموازنة التلقائية")}
          </AlertTitle>
          <AlertDescription className="text-amber-700 text-xs">
            {bal.dummyDestIndex !== null
              ? t(
                  `Une destination fictive « ${bal.destinations[bal.dummyDestIndex].name} » (demande = ${bal.destinations[bal.dummyDestIndex].demand.toLocaleString()}, coûts = 0) a été ajoutée pour équilibrer le problème.`,
                  `تمت إضافة وجهة وهمية « ${bal.destinations[bal.dummyDestIndex].name} » (طلب = ${bal.destinations[bal.dummyDestIndex].demand.toLocaleString()}، التكاليف = 0) لتوازن المسألة.`
                )
              : t(
                  `Une source fictive « ${bal.sources[bal.dummySourceIndex!].name} » (offre = ${bal.sources[bal.dummySourceIndex!].supply.toLocaleString()}, coûts = 0) a été ajoutée pour équilibrer le problème.`,
                  `تمت إضافة مصدر وهمي « ${bal.sources[bal.dummySourceIndex!].name} » (عرض = ${bal.sources[bal.dummySourceIndex!].supply.toLocaleString()}، التكاليف = 0) لتوازن المسألة.`
                )
            }
          </AlertDescription>
        </Alert>
      )}

      {/* ── Method selection step ─────────────────────────────────────────── */}
      {isSelectMode && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              {t(
                "Sélectionnez une méthode pour construire la solution initiale pas-à-pas, ou comparez les trois d'un coup.",
                "اختر طريقة لبناء الحل الأولي خطوة بخطوة، أو قارن الثلاث دفعة واحدة."
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["nwc", "lcm", "vam"] as MethodKey[]).map(mk => (
              <MethodCard
                key={mk}
                methodKey={mk}
                result={results[mk]}
                objective={problem.objectiveType}
                isBest={mk === bestMethod}
                isSelected={false}
                onClick={() => handleSelectMethod(mk)}
              />
            ))}
          </div>

          {/* Compare All card */}
          <div className="border-t pt-5">
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setCurrentStep(-1);
                setActiveMethod(bestMethod);
                setViewMode("compare");
              }}
              className="group w-full flex items-center gap-4 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-5 transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-left"
            >
              <div className="rounded-xl bg-muted p-3 text-muted-foreground shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <GitCompare className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {t("Comparer toutes les méthodes", "مقارنة جميع الطرق")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "Voir CNO, CMC et VAM côte à côte avec leurs coûts initiaux respectifs.",
                    "مقارنة ز.ش.غ، أ.ت، و ف.أ.م جنباً إلى جنب مع تكاليفها الأولية."
                  )}
                </p>
              </div>
              <ArrowRight className={cn("w-5 h-5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5", isAr && "rotate-180")} />
            </button>
          </div>
        </div>
      )}

      {/* ── Compare mode ──────────────────────────────────────────────────── */}
      {isCompareMode && (
        <div className="space-y-6">
          <ComparePanel
            results={results}
            objective={problem.objectiveType}
            onSelectMethod={handleSelectMethod}
            selectedMethod={activeMethod}
          />

          {/* Show step-by-step for the selected method */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">
                {t(
                  `Détail — ${t(METHOD_META[activeMethod].labelFr, METHOD_META[activeMethod].labelAr)}`,
                  `التفاصيل — ${t(METHOD_META[activeMethod].labelFr, METHOD_META[activeMethod].labelAr)}`
                )}
              </h2>
              <div className="flex gap-2">
                {(["nwc", "lcm", "vam"] as MethodKey[]).map(mk => (
                  <Button
                    key={mk}
                    variant={mk === activeMethod ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentStep(-1);
                      setActiveMethod(mk);
                    }}
                  >
                    {METHOD_META[mk].shortFr}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <StepNav
                totalSteps={totalSteps}
                currentStep={currentStep}
                isPlaying={isPlaying}
                onChange={handleStepChange}
                onTogglePlay={handleTogglePlay}
              />
              <TableauGrid result={activeResult} currentStep={currentStep} objective={problem.objectiveType} />
              {currentStep >= 0 && (
                <StepExplanation result={activeResult} stepIndex={currentStep} objective={problem.objectiveType} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Single method solve view ──────────────────────────────────────── */}
      {isSolveMode && (
        <div className="space-y-5">
          {/* Method info bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={cn("rounded-lg px-3 py-1.5 text-sm font-bold", METHOD_META[activeMethod].iconBg)}>
                {METHOD_META[activeMethod].shortFr}
              </div>
              <p className="text-sm text-muted-foreground max-w-md">
                {t(METHOD_META[activeMethod].descFr, METHOD_META[activeMethod].descAr)}
              </p>
            </div>
            <div className="flex gap-2">
              {(["nwc", "lcm", "vam"] as MethodKey[]).map(mk => (
                <Button
                  key={mk}
                  variant={mk === activeMethod ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStep(-1);
                    setActiveMethod(mk);
                  }}
                  className="text-xs"
                >
                  {METHOD_META[mk].shortFr}
                  {mk === bestMethod && (
                    <span className="ml-1 text-green-400">★</span>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* Step navigator */}
          <StepNav
            totalSteps={totalSteps}
            currentStep={currentStep}
            isPlaying={isPlaying}
            onChange={handleStepChange}
            onTogglePlay={handleTogglePlay}
          />

          {/* Tableau */}
          <TableauGrid result={activeResult} currentStep={currentStep} objective={problem.objectiveType} />

          {/* Step explanation */}
          {currentStep >= 0 && (
            <StepExplanation
              result={activeResult}
              stepIndex={currentStep}
              objective={problem.objectiveType}
            />
          )}

          {/* Initial state hint */}
          {currentStep < 0 && (
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground text-center">
              {t(
                "Appuyez sur « Jouer » ou « Suivant » pour construire la solution étape par étape.",
                "اضغط على « تشغيل » أو « التالي » لبناء الحل خطوة بخطوة."
              )}
            </div>
          )}

          {/* Complexity note */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>{t(METHOD_META[activeMethod].complexityFr, METHOD_META[activeMethod].complexityAr)}</span>
          </div>

          {/* Summary — show only when all steps played */}
          {currentStep >= totalSteps - 1 && (
            <AllocationSummary result={activeResult} objective={problem.objectiveType} />
          )}

          {/* "View full summary" shortcut when not yet finished */}
          {currentStep >= 0 && currentStep < totalSteps - 1 && (
            <div className="text-center">
              <Button
                variant="ghost" size="sm"
                onClick={() => handleStepChange(totalSteps - 1)}
                className="text-xs text-muted-foreground"
              >
                {t("Passer à la solution finale →", "الانتقال إلى الحل النهائي ←")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom action bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
        <Button
          variant="ghost"
          onClick={() => setViewMode("select")}
          className="text-muted-foreground"
        >
          <ChevronLeft className={cn("w-4 h-4 mr-1.5", isAr && "rotate-180")} />
          {t("Changer de méthode", "تغيير الطريقة")}
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              {t("Stage 2 sur 3 — Optimisation MODI disponible prochainement.", "المرحلة 2 من 3 — تحسين MODI قريباً.")}
            </span>
          </div>
          <Button
            size="lg"
            disabled
            className="w-full sm:w-auto px-8 gap-2 cursor-not-allowed opacity-60"
            title={t("Disponible dans la prochaine version", "متاح في الإصدار القادم")}
          >
            <Zap className="w-5 h-5" />
            {t("Optimiser avec MODI", "التحسين بـ MODI")}
            <ArrowRight className={cn("w-4 h-4", isAr && "rotate-180")} />
          </Button>
        </div>
      </div>

    </div>
  );
}
