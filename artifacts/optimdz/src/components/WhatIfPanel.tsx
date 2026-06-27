import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { ProblemInput, SolveResult } from "@workspace/api-client-react";
import { useSolveProblem } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RotateCcw, Loader2, TrendingUp, TrendingDown, Minus, FlaskConical } from "lucide-react";

interface Props {
  input: ProblemInput;
  result: SolveResult;
}

interface SliderState {
  id: string;
  type: "coeff" | "rhs";
  index: number;
  nameFr: string;
  nameAr: string;
  original: number;
  pct: number; // 50..250 representing 50%..250% of original
}

function fmt(n: number, lang: string, decimals = 2) {
  return n.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    maximumFractionDigits: decimals,
  });
}

function buildSliders(input: ProblemInput): SliderState[] {
  const sliders: SliderState[] = [];
  input.variables.forEach((v, i) => {
    if (Math.abs(v.coefficient) < 1e-10) return;
    sliders.push({
      id: `coeff-${i}`,
      type: "coeff",
      index: i,
      nameFr: `Coeff. de "${v.name}"${v.unit ? ` (${v.unit})` : ""}`,
      nameAr: `معامل "${v.name}"${v.unit ? ` (${v.unit})` : ""}`,
      original: v.coefficient,
      pct: 100,
    });
  });
  input.constraints.forEach((c, i) => {
    if (Math.abs(c.rhs) < 1e-10) return;
    sliders.push({
      id: `rhs-${i}`,
      type: "rhs",
      index: i,
      nameFr: `Capacité : "${c.name}"${c.unit ? ` (${c.unit})` : ""}`,
      nameAr: `طاقة "${c.name}"${c.unit ? ` (${c.unit})` : ""}`,
      original: c.rhs,
      pct: 100,
    });
  });
  return sliders;
}

function applySliders(input: ProblemInput, sliders: SliderState[]): ProblemInput {
  const newVars = input.variables.map((v, i) => {
    const s = sliders.find((sl) => sl.type === "coeff" && sl.index === i);
    return s ? { ...v, coefficient: v.coefficient * (s.pct / 100) } : v;
  });
  const newConstraints = input.constraints.map((c, i) => {
    const s = sliders.find((sl) => sl.type === "rhs" && sl.index === i);
    return s ? { ...c, rhs: c.rhs * (s.pct / 100) } : c;
  });
  return { ...input, variables: newVars, constraints: newConstraints };
}

function DeltaBadge({ delta, lang }: { delta: number; lang: string }) {
  if (Math.abs(delta) < 0.01) {
    return (
      <span className="flex items-center gap-1 text-muted-foreground text-sm font-medium">
        <Minus className="w-3.5 h-3.5" />
        {fmt(0, lang)}
      </span>
    );
  }
  const positive = delta > 0;
  return (
    <span className={cn(
      "flex items-center gap-1 text-sm font-bold",
      positive ? "text-green-700" : "text-red-600"
    )}>
      {positive
        ? <TrendingUp className="w-3.5 h-3.5" />
        : <TrendingDown className="w-3.5 h-3.5" />}
      {positive ? "+" : ""}{fmt(delta, lang)}
    </span>
  );
}

export function WhatIfPanel({ input, result }: Props) {
  const { t, language } = useLanguage();
  const [sliders, setSliders] = useState<SliderState[]>(() => buildSliders(input));
  const [modifiedResult, setModifiedResult] = useState<SolveResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = sliders.some((s) => s.pct !== 100);

  const solveMutation = useSolveProblem({
    mutation: {
      onSuccess: (data) => setModifiedResult(data),
      onError: () => setModifiedResult(null),
    },
  });

  const triggerSolve = useCallback(
    (currentSliders: SliderState[]) => {
      if (!currentSliders.some((s) => s.pct !== 100)) {
        setModifiedResult(null);
        return;
      }
      const modified = applySliders(input, currentSliders);
      solveMutation.mutate({ data: modified });
    },
    [input]
  );

  // Debounce re-solve whenever sliders change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => triggerSolve(sliders), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [sliders, triggerSolve]);

  const handleSliderChange = (id: string, pct: number) => {
    setSliders((prev) => prev.map((s) => (s.id === id ? { ...s, pct } : s)));
  };

  const handleReset = () => {
    setSliders(buildSliders(input));
    setModifiedResult(null);
  };

  // Build a human-readable change summary
  const changeSummary = useMemo(() => {
    const changed = sliders.filter((s) => s.pct !== 100);
    if (changed.length === 0 || !modifiedResult) return null;

    const origVal = result.optimalValue ?? 0;
    const newVal = modifiedResult.optimalValue ?? 0;
    const delta = newVal - origVal;
    const isMax = input.objectiveType === "maximize";

    if (modifiedResult.status !== "optimal") return null;

    // Describe the biggest change
    const top = [...changed].sort((a, b) => Math.abs(b.pct - 100) - Math.abs(a.pct - 100))[0];
    const changePct = top.pct - 100;
    const changeWord = changePct > 0
      ? (language === "ar" ? "زيادة" : "augmentation")
      : (language === "ar" ? "تخفيض" : "réduction");
    const labelTop = language === "ar" ? top.nameAr : top.nameFr;
    const absPct = Math.abs(changePct);

    if (language === "ar") {
      return `${changeWord} "${labelTop}" بنسبة ${fmt(absPct, language, 0)}% ${delta >= 0 ? "يرفع" : "يخفض"} ${isMax ? "ربحك" : "تكلفتك"} من ${fmt(origVal, language)} دج إلى ${fmt(newVal, language)} دج — أي ${delta >= 0 ? "بزيادة" : "بنقصان"} ${fmt(Math.abs(delta), language)} دج.`;
    } else {
      return `Une ${changeWord} de ${fmt(absPct, language, 0)}% sur "${labelTop}" ${delta >= 0 ? "augmente" : "réduit"} votre ${isMax ? "profit" : "coût"} de ${fmt(origVal, language)} DZD à ${fmt(newVal, language)} DZD — soit ${delta >= 0 ? "+" : ""}${fmt(delta, language)} DZD.`;
    }
  }, [sliders, modifiedResult, result, input, language]);

  const origOpt = result.optimalValue ?? 0;
  const modOpt = modifiedResult?.optimalValue ?? null;
  const optDelta = modOpt !== null ? modOpt - origOpt : null;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <FlaskConical className="w-5 h-5" />
            </span>
            <span>
              <span className="block text-foreground">
                {t("Analyse What-If ?", "تحليل ماذا لو؟")}
              </span>
              <span className="block text-sm font-normal text-muted-foreground mt-0.5">
                {t("ماذا لو؟", "What-If ?")} — {t("testez l'impact de vos ajustements", "اختبر تأثير تعديلاتك")}
              </span>
            </span>
          </CardTitle>

          {isDirty && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="shrink-0 mt-1"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              {t("Réinitialiser", "إعادة التعيين")}
            </Button>
          )}
        </div>
        <CardDescription className={cn("mt-2", language === "ar" && "text-right")}>
          {t(
            "Ajustez les paramètres ci-dessous pour voir l'impact immédiat sur la solution optimale.",
            "اضبط المعلمات أدناه لترى التأثير الفوري على الحل الأمثل."
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-8">

        {/* Sliders */}
        <div className="space-y-5">
          {sliders.map((s) => {
            const modified = s.original * (s.pct / 100);
            const pctChange = s.pct - 100;
            const changed = s.pct !== 100;
            return (
              <div key={s.id} className={cn(
                "rounded-xl border p-4 space-y-3 transition-colors",
                changed ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"
              )}>
                <div className={cn("flex items-start justify-between gap-4", language === "ar" && "flex-row-reverse")}>
                  <div className={cn(language === "ar" && "text-right")}>
                    <p className="font-semibold text-sm text-foreground">
                      {language === "ar" ? s.nameAr : s.nameFr}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "ar" ? s.nameFr : s.nameAr}
                    </p>
                  </div>
                  <div className={cn("flex items-center gap-3 shrink-0", language === "ar" && "flex-row-reverse")}>
                    {/* Original */}
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t("Original", "الأصلي")}</p>
                      <p className="font-mono font-medium text-sm text-foreground">{fmt(s.original, language)}</p>
                    </div>
                    {/* Arrow */}
                    <span className="text-muted-foreground text-lg">→</span>
                    {/* Modified */}
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t("Modifié", "المعدّل")}</p>
                      <p className={cn(
                        "font-mono font-bold text-sm",
                        changed ? (pctChange > 0 ? "text-green-700" : "text-red-600") : "text-foreground"
                      )}>
                        {fmt(modified, language)}
                      </p>
                    </div>
                    {/* % badge */}
                    <span className={cn(
                      "rounded-md px-2 py-1 text-xs font-bold min-w-[52px] text-center",
                      !changed && "bg-muted text-muted-foreground",
                      changed && pctChange > 0 && "bg-green-100 text-green-800",
                      changed && pctChange < 0 && "bg-red-100 text-red-700",
                    )}>
                      {pctChange >= 0 ? "+" : ""}{fmt(pctChange, language, 0)}%
                    </span>
                  </div>
                </div>

                {/* Range slider */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min={50}
                    max={250}
                    step={5}
                    value={s.pct}
                    onChange={(e) => handleSliderChange(s.id, parseInt(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary bg-gradient-to-r from-red-200 via-primary/30 to-green-200"
                    dir="ltr"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground select-none">
                    <span>−50%</span>
                    <span className="text-primary font-medium">{t("Valeur actuelle", "القيمة الحالية")}</span>
                    <span>+150%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Results comparison */}
        {isDirty && (
          <div className="space-y-4">
            <h3 className={cn(
              "font-semibold text-base text-foreground flex items-center gap-2",
              language === "ar" && "flex-row-reverse"
            )}>
              <span className="w-1.5 h-5 rounded-full bg-primary inline-block" />
              {t("Comparaison des Solutions", "مقارنة الحلول")}
              {solveMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </h3>

            {/* Objective value comparison */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border bg-muted/30 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">{t("الحل الأصلي", "Solution Originale")}</p>
                <p className="text-xs text-muted-foreground">{t("Solution Originale", "الحل الأصلي")}</p>
                <p className="text-2xl font-bold text-foreground mt-2">{fmt(origOpt, language)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("DZD", "دج")}</p>
              </div>

              <div className={cn(
                "rounded-xl border p-4 text-center transition-all",
                solveMutation.isPending && "opacity-50",
                modifiedResult?.status === "optimal" && optDelta !== null && optDelta > 0 && "border-green-400 bg-green-50",
                modifiedResult?.status === "optimal" && optDelta !== null && optDelta < 0 && "border-red-400 bg-red-50",
                modifiedResult?.status === "optimal" && optDelta === 0 && "border-primary/30 bg-primary/5",
                modifiedResult?.status === "infeasible" && "border-red-400 bg-red-50",
                modifiedResult?.status === "unbounded" && "border-orange-400 bg-orange-50",
                !modifiedResult && "border-border bg-muted/20",
              )}>
                <p className="text-xs text-muted-foreground mb-1">{t("الحل المعدّل", "Solution Modifiée")}</p>
                <p className="text-xs text-muted-foreground">{t("Solution Modifiée", "الحل المعدّل")}</p>
                {modifiedResult?.status === "optimal" && modOpt !== null ? (
                  <>
                    <p className={cn(
                      "text-2xl font-bold mt-2",
                      optDelta !== null && optDelta > 0 ? "text-green-700" : optDelta !== null && optDelta < 0 ? "text-red-600" : "text-foreground"
                    )}>
                      {fmt(modOpt, language)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("DZD", "دج")}</p>
                  </>
                ) : modifiedResult?.status === "infeasible" ? (
                  <p className="text-sm font-semibold text-red-600 mt-4">{t("Infaisable", "غير ممكن")}</p>
                ) : modifiedResult?.status === "unbounded" ? (
                  <p className="text-sm font-semibold text-orange-600 mt-4">{t("Non borné", "غير محدود")}</p>
                ) : solveMutation.isPending ? (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto mt-4" />
                ) : (
                  <p className="text-muted-foreground text-sm mt-4">—</p>
                )}
              </div>

              <div className={cn(
                "rounded-xl border p-4 text-center",
                optDelta !== null && optDelta > 0 && "border-green-300 bg-green-50/60",
                optDelta !== null && optDelta < 0 && "border-red-300 bg-red-50/60",
                (!optDelta || optDelta === 0) && "border-border bg-muted/20",
              )}>
                <p className="text-xs text-muted-foreground mb-1">{t("الفرق", "Différence")}</p>
                <p className="text-xs text-muted-foreground">{t("Différence", "الفرق")}</p>
                {optDelta !== null ? (
                  <>
                    <div className="flex items-center justify-center mt-2">
                      <DeltaBadge delta={optDelta} lang={language} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {optDelta !== 0
                        ? `${optDelta > 0 ? "+" : ""}${fmt((optDelta / origOpt) * 100, language, 1)}%`
                        : "—"}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm mt-4">—</p>
                )}
              </div>
            </div>

            {/* Variable-level comparison */}
            {modifiedResult?.status === "optimal" && modifiedResult.variables && (
              <div className="rounded-xl border overflow-hidden">
                <div className={cn(
                  "grid bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide",
                  "grid-cols-[2fr_1fr_1fr_1fr]"
                )}>
                  <div className={cn(language === "ar" && "text-right")}>{t("Variable", "المتغير")}</div>
                  <div className="text-center">{t("Orig.", "الأصل")}</div>
                  <div className="text-center">{t("Modif.", "معدّل")}</div>
                  <div className="text-center">{t("Δ", "الفرق")}</div>
                </div>
                {result.variables?.map((origVar, i) => {
                  const modVar = modifiedResult.variables?.[i];
                  const delta = modVar ? modVar.value - origVar.value : null;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "grid grid-cols-[2fr_1fr_1fr_1fr] px-4 py-3 border-t items-center",
                        delta !== null && Math.abs(delta) > 1e-4 && "bg-primary/3"
                      )}
                    >
                      <div className={cn(language === "ar" && "text-right")}>
                        <p className="font-medium text-sm">{origVar.name}</p>
                        {origVar.unit && <p className="text-xs text-muted-foreground">{origVar.unit}</p>}
                      </div>
                      <div className="text-center font-mono text-sm">{fmt(origVar.value, language)}</div>
                      <div className={cn(
                        "text-center font-mono text-sm font-bold",
                        delta !== null && delta > 1e-4 ? "text-green-700" : delta !== null && delta < -1e-4 ? "text-red-600" : ""
                      )}>
                        {modVar ? fmt(modVar.value, language) : "—"}
                      </div>
                      <div className="text-center">
                        {delta !== null ? <DeltaBadge delta={delta} lang={language} /> : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Impact summary sentence */}
            {changeSummary && (
              <div className={cn(
                "rounded-xl px-5 py-4 border-2 flex items-start gap-3",
                optDelta !== null && optDelta > 0
                  ? "bg-green-50 border-green-300 text-green-900"
                  : optDelta !== null && optDelta < 0
                    ? "bg-red-50 border-red-300 text-red-900"
                    : "bg-muted/40 border-border text-foreground",
                language === "ar" && "flex-row-reverse text-right"
              )}>
                <span className="shrink-0 mt-0.5">
                  {optDelta !== null && optDelta > 0
                    ? <TrendingUp className="w-5 h-5 text-green-700" />
                    : <TrendingDown className="w-5 h-5 text-red-600" />}
                </span>
                <p className="text-sm font-medium leading-relaxed">{changeSummary}</p>
              </div>
            )}
          </div>
        )}

        {/* Idle state hint */}
        {!isDirty && (
          <div className={cn(
            "rounded-xl border-2 border-dashed border-muted-foreground/20 px-6 py-8 text-center",
            language === "ar" && "text-right"
          )}>
            <FlaskConical className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              {t(
                "Déplacez un curseur pour tester un scénario alternatif.",
                "حرّك أحد شرائط التمرير لاختبار سيناريو بديل."
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t(
                "La solution se recalcule instantanément.",
                "تُعاد حسابات الحل فورياً."
              )}
            </p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
