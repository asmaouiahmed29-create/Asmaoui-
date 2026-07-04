import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { useTransportState } from "@/lib/TransportContext";
import { useTransportHistory } from "@/lib/TransportHistoryContext";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  CheckCircle2, AlertTriangle, Info, ArrowLeft, ArrowRight, ChevronLeft,
  ChevronRight, Download, BookmarkPlus, Zap, GitMerge, BarChart3,
  RotateCcw, Check, Star,
} from "lucide-react";

import {
  solveNWC, solveLCM, solveVAM, METHOD_META,
  type MethodKey, type SolveResult, type BalancedMatrix,
} from "@/lib/transportAlgorithms";
import { TEMPLATES } from "@/pages/transportation/Solve";
import { runMODI, type MODIResult, type MODIIteration } from "@/lib/modiAlgorithm";
import { generateTransportPDF } from "@/lib/generateTransportPDF";
import type { TransportSectorKey } from "@/lib/TransportHistoryContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = "modi" | "stepping-stone";
type PageTab  = "optimize" | "analysis";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, lang: string, d = 0): string {
  if (!isFinite(n)) return "∞";
  return n.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
}

// ── Stage bar ─────────────────────────────────────────────────────────────────
function StageBar({ active, onBack }: { active: 1 | 2 | 3; onBack: () => void }) {
  const { t } = useLanguage();
  const steps = [
    { id: 1, label: t("Données", "البيانات") },
    { id: 2, label: t("Solution initiale", "الحل الابتدائي") },
    { id: 3, label: t("Optimisation", "التحسين") },
  ];
  return (
    <div className="flex items-center gap-2 py-3 border-b border-border bg-background/80 sticky top-0 z-10 px-0">
      {steps.map((s, idx) => {
        const done = s.id < active;
        const curr = s.id === active;
        return (
          <div key={s.id} className="flex items-center gap-2">
            {idx > 0 && <div className={cn("h-px flex-1 min-w-8", done || curr ? "bg-primary" : "bg-border")} />}
            <button
              onClick={s.id < active ? onBack : undefined}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                curr ? "bg-primary text-primary-foreground" :
                done ? "bg-primary/15 text-primary cursor-pointer hover:bg-primary/25" :
                       "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
              )}
            >
              {done ? <CheckCircle2 className="w-3 h-3" /> : <span>{s.id}</span>}
              {s.label}
            </button>
          </div>
        );
      })}
      <div className="ml-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          {t("Modifier les données", "تعديل البيانات")}
        </button>
      </div>
    </div>
  );
}

// ── MODI Tableau ──────────────────────────────────────────────────────────────
interface TableauProps {
  iteration:   MODIIteration;
  balanced:    BalancedMatrix;
  viewMode:    ViewMode;
  isMax:       boolean;
  showFinal:   boolean;
}

function MODITableau({ iteration, balanced, viewMode, isMax, showFinal }: TableauProps) {
  const { language } = useLanguage();
  const { allocation, isBasic, u, v, opportunityCosts, enteringCell, leavingCell, loop, epsilonCells } = iteration;
  const m = balanced.sources.length;
  const n = balanced.destinations.length;
  const epsilonSet = new Set(epsilonCells.map(c => `${c.i},${c.j}`));

  const loopSet = new Map<string, { sign: "+" | "-"; pos: number }>();
  if (loop) {
    loop.forEach((c, idx) => loopSet.set(`${c.i},${c.j}`, { sign: c.sign, pos: idx }));
  }

  function cellClass(i: number, j: number): string {
    const key = `${i},${j}`;
    const isEntering = enteringCell?.i === i && enteringCell?.j === j;
    const isLeaving  = leavingCell?.i  === i && leavingCell?.j  === j;
    const inLoop     = loopSet.has(key);
    if (isEntering) return "bg-green-100 border-green-400 ring-2 ring-green-400";
    if (isLeaving)  return "bg-red-100 border-red-400 ring-2 ring-red-400";
    if (inLoop && viewMode === "stepping-stone") return "bg-amber-50 border-amber-300";
    if (epsilonSet.has(key)) return "bg-slate-50 border-slate-300 opacity-70";
    if (isBasic[i][j]) return "bg-primary/5 border-border";
    return "bg-white border-border";
  }

  function oppCostColor(val: number | null): string {
    if (val === null) return "text-foreground";
    if (Math.abs(val) < 1e-4) return "text-blue-600 font-bold";
    if (isMax ? val > 0 : val < 0) return "text-red-600 font-bold";
    return "text-muted-foreground";
  }

  const colWidth = Math.max(72, Math.min(100, Math.floor(620 / (n + 1))));

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse" style={{ minWidth: (n + 2) * colWidth + 100 }}>
        <thead>
          <tr>
            <th className="text-left p-1 text-muted-foreground w-24" />
            {balanced.destinations.map((d, j) => (
              <th key={j} className="p-1 text-center font-semibold text-foreground" style={{ width: colWidth }}>
                <div className="truncate">{d.name}</div>
                {viewMode === "modi" && (
                  <div className="text-primary font-bold text-[10px] mt-0.5">
                    v{j+1} = {v[j] !== undefined ? fmt(v[j], language, 1) : "?"}
                  </div>
                )}
              </th>
            ))}
            <th className="p-1 text-center font-semibold text-foreground" style={{ width: colWidth - 8 }}>
              {language === "ar" ? "عرض" : "Offre"}
            </th>
          </tr>
        </thead>
        <tbody>
          {balanced.sources.map((s, i) => (
            <tr key={i}>
              <td className="p-1 pr-2 text-right font-semibold text-foreground whitespace-nowrap">
                <div className="truncate max-w-[90px]">{s.name}</div>
                {viewMode === "modi" && (
                  <div className="text-primary font-bold text-[10px]">
                    u{i+1} = {u[i] !== undefined ? fmt(u[i], language, 1) : "?"}
                  </div>
                )}
              </td>
              {Array.from({ length: n }, (_, j) => {
                const alloc = allocation[i]?.[j] ?? 0;
                const opp   = opportunityCosts[i]?.[j];
                const basic = isBasic[i][j];
                const key   = `${i},${j}`;
                const loopInfo = loopSet.get(key);
                const eps   = epsilonSet.has(key);

                return (
                  <td
                    key={j}
                    className={cn("border p-1 text-center relative transition-colors", cellClass(i, j))}
                    style={{ width: colWidth, height: 52 }}
                  >
                    {/* Loop sign badge */}
                    {viewMode === "stepping-stone" && loopInfo && (
                      <span className={cn(
                        "absolute top-0.5 right-0.5 text-[10px] font-extrabold leading-none px-0.5",
                        loopInfo.sign === "+" ? "text-green-600" : "text-red-600"
                      )}>
                        {loopInfo.sign}
                      </span>
                    )}

                    {basic ? (
                      <div>
                        <div className={cn("font-bold text-sm", eps ? "text-slate-400 italic" : "text-foreground")}>
                          {eps ? "ε" : fmt(alloc, language)}
                        </div>
                        {viewMode === "modi" && (
                          <div className="text-[9px] text-muted-foreground mt-0.5">Δ = 0</div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className={cn("text-[11px]", oppCostColor(opp))}>
                          {opp !== null ? (Math.abs(opp) < 1e-4 ? "0" : fmt(opp, language, 1)) : "—"}
                        </div>
                        {viewMode === "modi" && (
                          <div className="text-[8px] text-muted-foreground">Δ</div>
                        )}
                      </div>
                    )}

                    {/* Entering / leaving indicator */}
                    {enteringCell?.i === i && enteringCell?.j === j && (
                      <div className="absolute bottom-0.5 left-0.5 text-[8px] text-green-600 font-bold leading-none">IN</div>
                    )}
                    {leavingCell?.i === i && leavingCell?.j === j && (
                      <div className="absolute bottom-0.5 left-0.5 text-[8px] text-red-600 font-bold leading-none">OUT</div>
                    )}
                  </td>
                );
              })}
              <td className="border border-border p-1 text-center text-xs font-semibold bg-muted/30">
                {fmt(iteration.allocation[i]?.reduce((s,v)=>s+v,0) ?? 0, language)}
              </td>
            </tr>
          ))}
          {/* Demand row */}
          <tr className="bg-muted/20">
            <td className="p-1 text-right text-xs font-semibold text-muted-foreground">
              {language === "ar" ? "طلب" : "Demande"}
            </td>
            {Array.from({ length: n }, (_, j) => (
              <td key={j} className="border border-border p-1 text-center text-xs font-semibold">
                {fmt(balanced.destinations[j]?.demand ?? 0, language)}
              </td>
            ))}
            <td className="border border-border p-1 text-center text-xs text-muted-foreground">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Step Explanation ──────────────────────────────────────────────────────────
function StepExplanation({ iteration, isMax, language }: { iteration: MODIIteration; isMax: boolean; language: string }) {
  const t = (fr: string, ar: string) => language === "ar" ? ar : fr;

  if (iteration.isOptimal) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">
          {t("Solution optimale atteinte ✓", "تم الوصول إلى الحل الأمثل ✓")}
        </AlertTitle>
        <AlertDescription className="text-green-700 text-sm">
          {t(
            `Tous les coûts d'opportunité sont ${isMax ? "≤ 0" : "≥ 0"}. Aucune amélioration possible. Coût total : ${fmt(iteration.totalCost, language)} DZD.`,
            `جميع تكاليف الفرصة ${isMax ? "≤ 0" : "≥ 0"}. لا يمكن التحسين أكثر. التكلفة الإجمالية: ${fmt(iteration.totalCost, language)} دج.`
          )}
        </AlertDescription>
      </Alert>
    );
  }

  const { enteringCell, leavingCell, theta, loop, opportunityCosts } = iteration;
  const entering = enteringCell;
  const leaving  = leavingCell;

  const bestOpp = entering ? (opportunityCosts[entering.i]?.[entering.j] ?? 0) : 0;

  return (
    <div className="space-y-2">
      {iteration.degenerateInfo && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 text-sm">
            {t("Dégénérescence détectée — ε-perturbation appliquée", "تم اكتشاف تدهور — تطبيق ε-اضطراب")}
          </AlertTitle>
          <AlertDescription className="text-amber-700 text-xs">{iteration.degenerateInfo}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
          <div className="font-semibold text-green-800 mb-1">
            {t("① Cellule entrante", "① الخلية الداخلة")}
          </div>
          {entering ? (
            <div className="text-green-700">
              ({entering.i + 1},{entering.j + 1}) — Δ = <strong>{fmt(bestOpp, language, 2)}</strong>
              <div className="text-[10px] mt-0.5 text-green-600">
                {t("Coût d'opportunité le plus", isMax ? "Δ إيجابي أكثر" : "Δ سالب أكثر")} {isMax ? "positif" : "négatif"}
              </div>
            </div>
          ) : <div className="text-muted-foreground">—</div>}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
          <div className="font-semibold text-amber-800 mb-1">
            {t("② Boucle (Stepping Stone)", "② الحلقة (Stepping Stone)")}
          </div>
          {loop ? (
            <div className="text-amber-700 text-[10px] leading-relaxed">
              {loop.map((c, idx) => (
                <span key={idx}>
                  <span className={cn("font-bold", c.sign === "+" ? "text-green-600" : "text-red-600")}>
                    {c.sign}
                  </span>
                  ({c.i+1},{c.j+1})
                  {idx < loop.length - 1 ? " → " : ""}
                </span>
              ))}
            </div>
          ) : <div className="text-muted-foreground">—</div>}
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-2">
          <div className="font-semibold text-red-800 mb-1">
            {t("③ Transfert θ & sortante", "③ النقل θ والخلية الخارجة")}
          </div>
          {leaving ? (
            <div className="text-red-700">
              <div>θ = <strong>{fmt(theta ?? 0, language)}</strong></div>
              <div className="text-[10px] mt-0.5">
                {t("Sortante", "خارجة")}: ({leaving.i+1},{leaving.j+1})
              </div>
            </div>
          ) : <div className="text-muted-foreground">—</div>}
        </div>
      </div>
    </div>
  );
}

// ── Analysis Tab ──────────────────────────────────────────────────────────────
function AnalysisTab({
  modiResult,
  initialCost,
  isMax,
  language,
  onSave,
  onPDF,
  isSaved,
  isExporting,
}: {
  modiResult:   MODIResult;
  initialCost:  number;
  isMax:        boolean;
  language:     string;
  onSave:       () => void;
  onPDF:        () => void;
  isSaved:      boolean;
  isExporting:  boolean;
}) {
  const t = (fr: string, ar: string) => language === "ar" ? ar : fr;
  const { balanced, finalAllocation, sensitivityRanges, alternativeOptimaCells, hasAlternativeOptima } = modiResult;
  const epsilonSet = new Set(modiResult.epsilonCells.map(c => `${c.i},${c.j}`));

  const improvement = initialCost > 0 ? ((initialCost - modiResult.finalCost) / initialCost) * 100 : 0;
  const totalIters  = modiResult.iterations.length - 1;

  const activeRoutes = sensitivityRanges.filter(r => r.allocation > 0 && !epsilonSet.has(`${r.i},${r.j}`));

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: t("Coût optimal", "التكلفة المثلى"),
            value: `${fmt(modiResult.finalCost, language)} DZD`,
            color: "text-green-700",
            bg: "bg-green-50 border-green-200",
            icon: <CheckCircle2 className="w-4 h-4 text-green-600" />,
          },
          {
            label: t("Coût initial", "التكلفة الابتدائية"),
            value: `${fmt(initialCost, language)} DZD`,
            color: "text-foreground",
            bg: "bg-muted/40 border-border",
            icon: <RotateCcw className="w-4 h-4 text-muted-foreground" />,
          },
          {
            label: t("Amélioration", "التحسين"),
            value: `${improvement.toFixed(1)}%`,
            color: improvement > 0 ? "text-secondary" : "text-muted-foreground",
            bg: "bg-muted/40 border-border",
            icon: <Zap className="w-4 h-4 text-secondary" />,
          },
          {
            label: t("Itérations MODI", "تكرارات MODI"),
            value: String(totalIters),
            color: "text-foreground",
            bg: "bg-muted/40 border-border",
            icon: <GitMerge className="w-4 h-4 text-muted-foreground" />,
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
      {modiResult.degeneracyHandled && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 text-sm">
            {t("Dégénérescence traitée", "تم معالجة التدهور")}
          </AlertTitle>
          <AlertDescription className="text-amber-700 text-xs">
            {t(
              "La solution initiale était dégénérée (variables de base insuffisantes). Une ε-perturbation a été appliquée automatiquement pour assurer la convergence MODI sans cycling.",
              "كان الحل الابتدائي متدهوراً (متغيرات أساسية غير كافية). تم تطبيق اضطراب-ε تلقائياً لضمان تقارب MODI دون تكرار."
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
              `Les cellules hors-base ${alternativeOptimaCells.map(c=>`(${c.i+1},${c.j+1})`).join(", ")} ont un coût d'opportunité = 0. Il existe d'autres plans de distribution avec le même coût optimal.`,
              `الخلايا غير الأساسية ${alternativeOptimaCells.map(c=>`(${c.i+1},${c.j+1})`).join(", ")} لها تكلفة فرصة = 0. توجد خطط توزيع أخرى بنفس التكلفة المثلى.`
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Distribution plan */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            {t("Plan de Distribution Optimal", "خطة التوزيع المثلى")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="px-3 py-2 text-left">{t("Source", "المصدر")}</th>
                  <th className="px-3 py-2 text-left">{t("Destination", "الوجهة")}</th>
                  <th className="px-3 py-2 text-center">{t("Quantité", "الكمية")}</th>
                  <th className="px-3 py-2 text-center">{t("Coût unit.", "تكلفة الوحدة")}</th>
                  <th className="px-3 py-2 text-right">{t("Contribution", "المساهمة")}</th>
                </tr>
              </thead>
              <tbody>
                {activeRoutes.map((r, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                    <td className="px-3 py-1.5 font-medium border-b border-border">{r.sourceName}</td>
                    <td className="px-3 py-1.5 border-b border-border">{r.destName}</td>
                    <td className="px-3 py-1.5 text-center border-b border-border font-bold text-primary">{fmt(r.allocation, language)}</td>
                    <td className="px-3 py-1.5 text-center border-b border-border">{fmt(r.unitCost, language)}</td>
                    <td className="px-3 py-1.5 text-right border-b border-border font-semibold text-secondary">
                      {fmt(r.allocation * r.unitCost, language)} DZD
                    </td>
                  </tr>
                ))}
                <tr className="bg-green-50 font-bold">
                  <td colSpan={4} className="px-3 py-2 text-green-800 border-t-2 border-green-300">
                    {t("TOTAL OPTIMAL", "المجموع الأمثل")}
                  </td>
                  <td className="px-3 py-2 text-right text-green-700 text-sm border-t-2 border-green-300">
                    {fmt(modiResult.finalCost, language)} DZD
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Dummy row/col explanation */}
          {(balanced.dummySourceIndex !== null || balanced.dummyDestIndex !== null) && (
            <Alert className="mt-3 border-orange-200 bg-orange-50">
              <Info className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-700 text-xs">
                {t(
                  balanced.dummySourceIndex !== null
                    ? `Source fictive (ligne ${balanced.dummySourceIndex + 1}) : les quantités allouées représentent les capacités inutilisées de la destination correspondante.`
                    : `Destination fictive (colonne ${balanced.dummyDestIndex! + 1}) : les quantités allouées représentent les surplus non distribués de la source correspondante.`,
                  balanced.dummySourceIndex !== null
                    ? `مصدر وهمي (صف ${balanced.dummySourceIndex + 1}): الكميات المخصصة تمثل طاقات الوجهة غير المستخدمة.`
                    : `وجهة وهمية (عمود ${balanced.dummyDestIndex! + 1}): الكميات المخصصة تمثل الفائض غير الموزع من المصدر المقابل.`
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Sensitivity analysis */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            {t("Analyse de Sensibilité", "تحليل الحساسية")}
            <Badge variant="outline" className="text-xs ml-auto">
              {t("Routes actives", "المسارات النشطة")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs text-muted-foreground mb-3">
            {t(
              "Plage de variation du coût unitaire pour laquelle la solution optimale actuelle reste valide.",
              "نطاق تغيير التكلفة الوحدوية الذي يبقى فيه الحل الأمثل الحالي صالحاً."
            )}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-secondary/80 text-white">
                  <th className="px-3 py-2 text-left">{t("Route", "المسار")}</th>
                  <th className="px-3 py-2 text-center">{t("Alloc.", "التخصيص")}</th>
                  <th className="px-3 py-2 text-center">{t("Coût actuel", "التكلفة الحالية")}</th>
                  <th className="px-3 py-2 text-center">{t("Plage [min, max]", "النطاق [أدنى، أقصى]")}</th>
                  <th className="px-3 py-2 text-center">{t("Marge ↓", "هامش ↓")}</th>
                  <th className="px-3 py-2 text-center">{t("Marge ↑", "هامش ↑")}</th>
                </tr>
              </thead>
              <tbody>
                {sensitivityRanges.map((r, idx) => {
                  const isEps = epsilonSet.has(`${r.i},${r.j}`);
                  if (isEps) return null;
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                      <td className="px-3 py-1.5 border-b border-border">
                        <span className="font-medium">{r.sourceName}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span>{r.destName}</span>
                      </td>
                      <td className="px-3 py-1.5 text-center border-b border-border font-bold text-primary">{fmt(r.allocation, language)}</td>
                      <td className="px-3 py-1.5 text-center border-b border-border font-semibold">{fmt(r.unitCost, language)}</td>
                      <td className="px-3 py-1.5 text-center border-b border-border text-[11px]">
                        [{fmt(r.lowerBound, language, 1)},&nbsp;{r.upperBound === Infinity ? "∞" : fmt(r.upperBound, language, 1)}]
                      </td>
                      <td className="px-3 py-1.5 text-center border-b border-border text-orange-600">
                        {r.allowedDecrease === Infinity ? "∞" : fmt(r.allowedDecrease, language, 1)}
                      </td>
                      <td className="px-3 py-1.5 text-center border-b border-border text-green-600">
                        {r.allowedIncrease === Infinity ? "∞" : fmt(r.allowedIncrease, language, 1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={onSave}
          disabled={isSaved}
          variant={isSaved ? "outline" : "default"}
          className="flex-1 gap-2"
        >
          {isSaved ? <Check className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
          {isSaved
            ? t("Enregistré ✓", "تم الحفظ ✓")
            : t("Enregistrer dans l'historique", "حفظ في السجل")
          }
        </Button>
        <Button
          onClick={onPDF}
          disabled={isExporting}
          variant="outline"
          className="flex-1 gap-2"
        >
          {isExporting ? (
            <span className="animate-spin text-base">⏳</span>
          ) : (
            <Download className="w-4 h-4" />
          )}
          {t("Exporter PDF", "تصدير PDF")}
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TransportOptimize() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { problem: contextProblem, setProblem } = useTransportState();
  const { addProblem } = useTransportHistory();

  // URL param fallback (same as Solution.tsx)
  const params    = new URLSearchParams(search);
  const urlSector = params.get("sector");
  const urlMethod = (params.get("method") ?? "vam") as MethodKey;

  useEffect(() => {
    if (!contextProblem && urlSector) {
      const tpl = TEMPLATES[urlSector as keyof typeof TEMPLATES];
      if (tpl) {
        setProblem({
          name:          language === "ar" ? tpl.nameAr : tpl.nameFr,
          sector:        urlSector,
          objectiveType: tpl.objectiveType,
          sources:       tpl.sources.map(s => ({ name: language === "ar" ? s.nameAr : s.nameFr, supply: s.supply })),
          destinations:  tpl.destinations.map(d => ({ name: language === "ar" ? d.nameAr : d.nameFr, demand: d.demand })),
          costs:         tpl.costs.map(row => [...row]),
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSector]);

  const problem = contextProblem;

  // State
  const [viewMode,     setViewMode]     = useState<ViewMode>("modi");
  const [pageTab,      setPageTab]      = useState<PageTab>("optimize");
  const [currentIter,  setCurrentIter]  = useState(0);
  const [isSaved,      setIsSaved]      = useState(false);
  const [isExporting,  setIsExporting]  = useState(false);
  const [exportMsg,    setExportMsg]    = useState<string | null>(null);

  // Run initial method, then MODI — memoized so only recomputed when problem changes
  const { initialResult, modiResult } = useMemo(() => {
    if (!problem) return { initialResult: null, modiResult: null };

    const input = {
      sources:      problem.sources,
      destinations: problem.destinations,
      costs:        problem.costs,
      objective:    problem.objectiveType,
    };

    let initialResult: SolveResult;
    if (urlMethod === "nwc") initialResult = solveNWC(input);
    else if (urlMethod === "lcm") initialResult = solveLCM(input);
    else initialResult = solveVAM(input);

    const modiResult = runMODI({
      balanced:      initialResult.balanced,
      allocation:    initialResult.allocation,
      objective:     problem.objectiveType,
      initialMethod: urlMethod.toUpperCase(),
    });

    return { initialResult, modiResult };
  }, [problem, urlMethod]);

  // Redirect if no problem
  useEffect(() => {
    if (!problem && !urlSector) setLocation("/transport/solution");
  }, [problem, urlSector, setLocation]);

  if (!problem || !modiResult || !initialResult) return null;

  const isMax  = problem.objectiveType === "maximize";
  const iters  = modiResult.iterations;
  const iter   = iters[Math.min(currentIter, iters.length - 1)];
  const isLast = currentIter >= iters.length - 1;
  const methodMeta = METHOD_META[urlMethod];

  function handleSave() {
    if (isSaved || !modiResult) return;
    addProblem(
      problem!,
      modiResult,
      initialResult!.totalCost,
      (problem!.sector || "custom") as TransportSectorKey,
      language
    );
    setIsSaved(true);
  }

  async function handlePDF() {
    if (!modiResult || isExporting) return;
    setIsExporting(true);
    setExportMsg(t("Génération du PDF…", "جارٍ إنشاء PDF…"));
    try {
      await generateTransportPDF({
        problem:         problem!,
        modiResult,
        initialCost:     initialResult!.totalCost,
        managerName:     "",
        institutionName: "",
        language,
        onProgress:      (step) => setExportMsg(step),
      });
    } catch (err) {
      setExportMsg(t("Erreur lors de l'export.", "حدث خطأ أثناء التصدير."));
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportMsg(null), 3000);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
      <StageBar active={3} onBack={() => setLocation("/transport/solution")} />

      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">
            {t("Optimisation MODI", "تحسين MODI")}
          </h1>
          <Badge variant="secondary" className="text-xs">{problem.name}</Badge>
          <Badge className={cn("text-xs", isMax ? "bg-purple-600" : "bg-primary")}>
            {isMax ? "↗ Maximisation" : "↘ Minimisation"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {t("Méthode initiale", "الطريقة الابتدائية")} : {methodMeta.shortFr}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(
            `${modiResult.iterations.length - 1} itération${modiResult.iterations.length > 2 ? "s" : ""} MODI — de ${fmt(initialResult.totalCost, language)} DZD à ${fmt(modiResult.finalCost, language)} DZD`,
            `${modiResult.iterations.length - 1} تكرار MODI — من ${fmt(initialResult.totalCost, language)} دج إلى ${fmt(modiResult.finalCost, language)} دج`
          )}
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: "optimize" as PageTab, labelFr: "Optimisation pas-à-pas", labelAr: "التحسين خطوة بخطوة", icon: GitMerge },
          { id: "analysis"  as PageTab, labelFr: "Analyse & Résultats",     labelAr: "التحليل والنتائج",   icon: BarChart3 },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setPageTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              pageTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {isAr ? tab.labelAr : tab.labelFr}
            {tab.id === "analysis" && modiResult.isOptimal && (
              <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0 ml-1">
                {t("Optimal", "مثالي")}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* ── Optimization tab ── */}
      {pageTab === "optimize" && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              {([
                { id: "modi" as ViewMode, label: "Vue MODI (u-v)" },
                { id: "stepping-stone" as ViewMode, label: "Vue Boucle" },
              ] as const).map(v => (
                <button
                  key={v.id}
                  onClick={() => setViewMode(v.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    viewMode === v.id
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded bg-green-100 border-2 border-green-400" />
              {t("Entrante", "داخلة")}
              <div className="w-3 h-3 rounded bg-red-100 border-2 border-red-400 ml-2" />
              {t("Sortante", "خارجة")}
              <div className="w-3 h-3 rounded bg-amber-50 border border-amber-300 ml-2" />
              {t("Boucle", "حلقة")}
            </div>
          </div>

          {/* Iteration header */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">
                    {iter.isOptimal && isLast
                      ? t("✓ Solution Optimale", "✓ الحل الأمثل")
                      : t(`Itération ${iter.iterationNumber}`, `التكرار ${iter.iterationNumber}`)
                    }
                  </CardTitle>
                  {iter.isOptimal && (
                    <Badge className="bg-green-600 text-white text-xs">
                      <Star className="w-3 h-3 mr-1" />
                      {t("Optimal", "مثالي")}
                    </Badge>
                  )}
                  {modiResult.hasAlternativeOptima && iter.isOptimal && (
                    <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                      <Info className="w-3 h-3 mr-1" />
                      {t("Solutions alternatives", "حلول بديلة")}
                    </Badge>
                  )}
                  {modiResult.degeneracyHandled && currentIter === 0 && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {t("ε-perturbation", "اضطراب-ε")}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("Coût", "التكلفة")} :{" "}
                  <span className="font-bold text-foreground">{fmt(iter.totalCost, language)} DZD</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Tableau */}
              <MODITableau
                iteration={iter}
                balanced={modiResult.balanced}
                viewMode={viewMode}
                isMax={isMax}
                showFinal={iter.isOptimal}
              />

              {/* Legend for view mode */}
              {viewMode === "modi" && (
                <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                  {t(
                    "Cellules de base : allocation. Cellules hors-base : coût d'opportunité Δ = c − u − v. Si Δ < 0 (min) ou Δ > 0 (max) → non optimal.",
                    "الخلايا الأساسية: التخصيص. الخلايا غير الأساسية: تكلفة الفرصة Δ = c − u − v. إذا Δ < 0 (تصغير) أو Δ > 0 (تكبير) → غير مثالي."
                  )}
                </div>
              )}

              {/* Step explanation */}
              <StepExplanation iteration={iter} isMax={isMax} language={language} />
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentIter(Math.max(0, currentIter - 1))}
              disabled={currentIter === 0}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              {t("Précédent", "السابق")}
            </Button>

            <div className="flex items-center gap-1">
              {iters.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIter(idx)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    idx === currentIter
                      ? "bg-primary w-4"
                      : idx < iters.length - 1 ? "bg-primary/30" : "bg-green-500"
                  )}
                />
              ))}
            </div>

            {!isLast ? (
              <Button
                size="sm"
                onClick={() => setCurrentIter(Math.min(iters.length - 1, currentIter + 1))}
                className="gap-1"
              >
                {t("Suivant", "التالي")}
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setPageTab("analysis")}
                className="gap-1 bg-green-700 hover:bg-green-800"
              >
                {t("Voir l'analyse", "عرض التحليل")}
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Jump to last button */}
          {!isLast && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground gap-1"
                onClick={() => setCurrentIter(iters.length - 1)}
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
          modiResult={modiResult}
          initialCost={initialResult.totalCost}
          isMax={isMax}
          language={language}
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
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/transport/solution")}
          className="gap-1 text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("Retour à la méthode initiale", "العودة إلى الطريقة الابتدائية")}
        </Button>
        {pageTab === "optimize" && isLast && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaved}
            className="gap-1"
          >
            <BookmarkPlus className="w-4 h-4" />
            {isSaved ? t("Enregistré ✓", "تم الحفظ ✓") : t("Enregistrer", "حفظ")}
          </Button>
        )}
      </div>
    </div>
  );
}
