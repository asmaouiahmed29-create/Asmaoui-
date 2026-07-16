import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { computeCrashing, fmt } from "@/lib/pertCpmAlgorithm";
import type { PertCpmResult, CrashResult, Activity } from "@/lib/pertCpmAlgorithm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, Star, TrendingDown, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityInput {
  id: string;
  name: string;
  duration: number;
  optimistic: number;
  mostLikely: number;
  pessimistic: number;
  predecessors: string[];
  normalCost?: number;
  crashDuration?: number;
  crashCost?: number;
}

interface Props {
  pertResult: PertCpmResult;
  activities: ActivityInput[];
  mode: "CPM" | "PERT";
  crashResult: CrashResult | null;
  setCrashResult: (r: CrashResult | null) => void;
}

function fDZD(n: number | undefined) {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  return Math.round(n).toLocaleString("fr-DZ") + " DA";
}

// ── Mini SVG cost-duration chart ──────────────────────────────────────────────
function CostDurationChart({ crash, hasOverhead }: { crash: CrashResult; hasOverhead: boolean }) {
  const W = 520, H = 220, PAD = { t: 16, r: 24, b: 40, l: 72 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const pts = [
    {
      dur: crash.originalDuration,
      direct: crash.originalDirectCost,
      total: crash.originalTotalCost,
    },
    ...crash.steps.map((s) => ({
      dur: s.newDuration,
      direct: s.totalDirectCost,
      total: s.totalCost,
    })),
  ];

  const durs    = pts.map((p) => p.dur);
  const minDur  = Math.min(...durs);
  const maxDur  = Math.max(...durs);
  const directs = pts.map((p) => p.direct);
  const totals  = hasOverhead ? pts.map((p) => p.total ?? 0) : [];
  const allY    = [...directs, ...totals];
  const minY    = Math.min(...allY);
  const maxY    = Math.max(...allY);
  const yPad    = (maxY - minY) * 0.1 || maxY * 0.1 || 1;

  const sx = (d: number) => PAD.l + ((maxDur - d) / (maxDur - minDur || 1)) * iW;
  const sy = (v: number) => PAD.t + (1 - (v - (minY - yPad)) / (maxY - minY + 2 * yPad)) * iH;

  const directPts  = pts.map((p) => `${sx(p.dur)},${sy(p.direct)}`).join(" ");
  const totalPts   = hasOverhead ? pts.map((p) => `${sx(p.dur)},${sy(p.total ?? 0)}`).join(" ") : "";

  const minIdx     = crash.minCostPoint?.stepIdx ?? -1;

  return (
    <svg width={W} height={H} className="max-w-full">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = PAD.t + frac * iH;
        const v = maxY + yPad - frac * (maxY - minY + 2 * yPad);
        return (
          <g key={frac}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#64748b">
              {v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : v.toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="#94a3b8" strokeWidth={1.5} />
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="#94a3b8" strokeWidth={1.5} />

      {/* X axis labels */}
      {pts.map((p, i) => (
        <text key={i} x={sx(p.dur)} y={H - PAD.b + 14} textAnchor="middle" fontSize={9} fill="#64748b">
          {fmt(p.dur)}
        </text>
      ))}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#64748b">
        Durée projet (sem.)
      </text>
      <text x={12} y={H / 2} textAnchor="middle" fontSize={10} fill="#64748b"
        transform={`rotate(-90, 12, ${H / 2})`}>
        Coût (DA)
      </text>

      {/* Direct cost line */}
      <polyline points={directPts} fill="none" stroke="#004d40" strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={`d${i}`} cx={sx(p.dur)} cy={sy(p.direct)} r={4}
          fill="#004d40" stroke="#fff" strokeWidth={1.5} />
      ))}

      {/* Total cost line (with overhead) */}
      {hasOverhead && (
        <>
          <polyline points={totalPts} fill="none" stroke="#f4a261" strokeWidth={2}
            strokeDasharray="5 3" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <circle key={`t${i}`} cx={sx(p.dur)} cy={sy(p.total ?? 0)} r={4}
              fill={i === minIdx ? "#1565c0" : "#f4a261"}
              stroke="#fff" strokeWidth={1.5} />
          ))}
          {/* Min cost star */}
          {minIdx >= 0 && minIdx < pts.length && (
            <text x={sx(pts[minIdx].dur)} y={sy(pts[minIdx].total ?? 0) - 10}
              textAnchor="middle" fontSize={13}>★</text>
          )}
        </>
      )}

      {/* Legend */}
      <rect x={PAD.l + 8} y={PAD.t + 6} width={12} height={2} fill="#004d40" />
      <text x={PAD.l + 24} y={PAD.t + 11} fontSize={9} fill="#004d40">Coût direct cumulé</text>
      {hasOverhead && (
        <>
          <rect x={PAD.l + 130} y={PAD.t + 6} width={12} height={2} fill="#f4a261" />
          <text x={PAD.l + 146} y={PAD.t + 11} fontSize={9} fill="#f4a261">Coût total (direct + frais gén.)</text>
          <text x={PAD.l + 296} y={PAD.t + 11} fontSize={10}>★</text>
          <text x={PAD.l + 308} y={PAD.t + 11} fontSize={9} fill="#1565c0">Point optimal</text>
        </>
      )}
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function CrashingSection({ pertResult, activities, mode, crashResult, setCrashResult }: Props) {
  const { t } = useLanguage();
  const [targetDur, setTargetDur]       = useState("");
  const [dailyOverhead, setDailyOverhead] = useState("");
  const [error, setError]               = useState<string | null>(null);
  const [isRunning, setIsRunning]       = useState(false);

  // Activity has full valid crash data when all three fields are present
  const hasValidCrash = (a: ActivityInput) =>
    a.normalCost !== undefined &&
    a.crashDuration !== undefined &&
    a.crashCost !== undefined;

  // Show section when at least one critical-path activity has valid crash data
  const criticalIds = new Set(pertResult.criticalPath);
  const critActivitiesWithData = activities.filter(
    (a) => criticalIds.has(a.id) && hasValidCrash(a)
  );
  // Critical activities missing crash data — show a warning
  const critActivitiesMissingData = activities.filter(
    (a) => criticalIds.has(a.id) && !hasValidCrash(a)
  );

  function handleCrash() {
    setError(null);
    const td = parseFloat(targetDur);
    if (!isFinite(td) || td <= 0) {
      setError(t("Entrez une durée cible valide.", "أدخل مدة هدف صحيحة."));
      return;
    }
    const algActs: Activity[] = activities.map((a) => ({
      id: a.id, name: a.name,
      duration: mode === "PERT"
        ? (a.optimistic + 4 * a.mostLikely + a.pessimistic) / 6
        : a.duration,
      optimistic: a.optimistic, mostLikely: a.mostLikely, pessimistic: a.pessimistic,
      predecessors: a.predecessors,
      normalCost: a.normalCost,
      crashDuration: a.crashDuration,
      crashCost: a.crashCost,
    }));
    setIsRunning(true);
    try {
      const overhead = parseFloat(dailyOverhead);
      const res = computeCrashing(algActs, td, isFinite(overhead) && overhead > 0 ? overhead : undefined);
      setCrashResult(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsRunning(false);
    }
  }

  // Don't render the section unless at least one critical-path activity has crash data
  if (critActivitiesWithData.length === 0) return null;

  const hasOverhead = !!(crashResult?.steps[0]?.totalCost !== undefined);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <Zap className="w-5 h-5 text-primary" />
        {t("Analyse d'Accélération — Crashing", "تحليل التسريع — Crashing")}
      </h2>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t("Paramètres de crashing", "معطيات التسريع")}
          </CardTitle>
          <CardDescription>
            {t(
              "L'algorithme itératif crash l'activité critique la moins chère jusqu'à atteindre la durée cible.",
              "الخوارزمية تسرّع النشاط الحرج الأرخص تكلفةً تدريجياً حتى الوصول للمدة المستهدفة."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Info: activities that CAN be crashed */}
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              {t(
                `${critActivitiesWithData.length} activité(s) critique(s) avec données de crashing : ${critActivitiesWithData.map((a) => a.id).join(", ")}.`,
                `${critActivitiesWithData.length} نشاط/أنشطة حرجة بيانات التسريع متوفرة: ${critActivitiesWithData.map((a) => a.id).join("، ")}.`
              )}
            </span>
          </div>

          {/* Warning: critical activities WITHOUT crash data */}
          {critActivitiesMissingData.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                {t(
                  `Activités critiques sans données de crashing : ${critActivitiesMissingData.map((a) => `${a.id} (${a.name || a.id})`).join(", ")} — elles ne pourront pas être accélérées. Si elles bloquent la compression, la durée cible sera inaccessible.`,
                  `أنشطة حرجة بدون بيانات تسريع: ${critActivitiesMissingData.map((a) => `${a.id} (${a.name || a.id})`).join("، ")} — لن يمكن تسريعها. إن كانت عائقاً أمام الضغط، سيكون الهدف غير قابل للتحقيق.`
                )}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>{t("Durée cible (semaines)", "المدة المستهدفة (أسابيع)")}</Label>
              <Input
                type="number" min="0" step="any"
                value={targetDur}
                onChange={(e) => setTargetDur(e.target.value)}
                placeholder={fmt(pertResult.projectDuration - 2)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                {t("Frais généraux / semaine (DA) — optionnel", "التكاليف العامة / أسبوع (DA) — اختياري")}
              </Label>
              <Input
                type="number" min="0" step="any"
                value={dailyOverhead}
                onChange={(e) => setDailyOverhead(e.target.value)}
                placeholder="ex: 200000"
                className="w-44"
              />
            </div>
            <Button onClick={handleCrash} disabled={isRunning}>
              <TrendingDown className="w-4 h-4 me-2" />
              {t("Calculer le crashing", "احسب التسريع")}
            </Button>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {crashResult && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: t("Durée initiale", "المدة الأصلية"),
                value: fmt(crashResult.originalDuration) + " " + t("sem.", "أسبوع"),
                cls: "bg-muted/60",
              },
              {
                label: t("Durée atteinte", "المدة المحققة"),
                value: fmt(crashResult.achievedDuration) + " " + t("sem.", "أسبوع"),
                cls: crashResult.isTargetAchieved
                  ? "bg-primary/10 text-primary"
                  : "bg-amber-50 text-amber-800",
              },
              {
                label: t("Gain de durée", "الوقت الموفّر"),
                value: fmt(crashResult.originalDuration - crashResult.achievedDuration) + " " + t("sem.", "أسبوع"),
                cls: "bg-secondary/10 text-secondary",
              },
              {
                label: t("Coût d'accélération", "تكلفة التسريع"),
                value: fDZD(crashResult.steps.reduce((s, st) => s + st.addedDirectCost, 0)),
                cls: "bg-orange-50 text-orange-800",
              },
            ].map((k) => (
              <Card key={k.label} className={cn("border-0", k.cls)}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs uppercase tracking-wide opacity-70 mb-1">{k.label}</p>
                  <p className="text-xl font-bold">{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Status banner */}
          <div className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium",
            crashResult.isTargetAchieved
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          )}>
            {crashResult.isTargetAchieved
              ? <span>✅ {t(`Durée cible de ${fmt(crashResult.targetDuration)} semaines atteinte.`, `تم تحقيق المدة المستهدفة ${fmt(crashResult.targetDuration)} أسابيع.`)}</span>
              : <span>⚠️ {t(
                  `Impossible d'atteindre ${fmt(crashResult.targetDuration)} sem. — Meilleur résultat: ${fmt(crashResult.achievedDuration)} sem. (limité par le crash limit des activités).`,
                  `لا يمكن تحقيق ${fmt(crashResult.targetDuration)} أسبوع — أفضل نتيجة ممكنة: ${fmt(crashResult.achievedDuration)} أسبوع (وصلت الحد الأقصى للتسريع).`
                )}</span>
            }
          </div>

          {/* Optimal crash point */}
          {crashResult.minCostPoint && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
              <Star className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-blue-800">
                <strong>{t("Point optimal ★", "النقطة الأمثل ★")}</strong>{" — "}
                {t(
                  `Durée ${fmt(crashResult.minCostPoint.duration)} semaines : coût total minimal = ${fDZD(crashResult.minCostPoint.totalCost)}`,
                  `المدة ${fmt(crashResult.minCostPoint.duration)} أسبوع: أدنى تكلفة إجمالية = ${fDZD(crashResult.minCostPoint.totalCost)}`
                )}
              </span>
            </div>
          )}

          {/* Iteration table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t("Tableau des itérations", "جدول التكرارات")}
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground">
                    <th className="px-3 py-2 text-center font-medium">#</th>
                    <th className="px-3 py-2 text-start font-medium">{t("Activité accélérée", "النشاط المسرَّع")}</th>
                    <th className="px-3 py-2 text-center font-medium">Δdur.</th>
                    <th className="px-3 py-2 text-center font-medium">
                      {t("Pente (DA/sem)", "التكلفة الحدية (DA/أسبوع)")}
                    </th>
                    <th className="px-3 py-2 text-center font-medium">
                      {t("Coût ajouté", "التكلفة المضافة")}
                    </th>
                    <th className="px-3 py-2 text-center font-medium">
                      {t("Coût direct cumulé", "التكلفة المباشرة التراكمية")}
                    </th>
                    <th className="px-3 py-2 text-center font-medium">
                      {t("Durée projet", "مدة المشروع")}
                    </th>
                    {hasOverhead && (
                      <>
                        <th className="px-3 py-2 text-center font-medium">
                          {t("Frais gén.", "التكاليف العامة")}
                        </th>
                        <th className="px-3 py-2 text-center font-medium">
                          {t("Coût total", "التكلفة الإجمالية")}
                        </th>
                      </>
                    )}
                    <th className="px-3 py-2 text-start font-medium">
                      {t("Chemin critique", "المسار الحرج")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {/* Initial row */}
                  <tr className="bg-muted/20 text-muted-foreground text-xs">
                    <td className="px-3 py-2 text-center font-mono">0</td>
                    <td className="px-3 py-2 italic">{t("Situation initiale", "الوضع الأولي")}</td>
                    <td className="px-3 py-2 text-center">—</td>
                    <td className="px-3 py-2 text-center">—</td>
                    <td className="px-3 py-2 text-center">—</td>
                    <td className="px-3 py-2 text-center font-mono">{fDZD(crashResult.originalDirectCost)}</td>
                    <td className="px-3 py-2 text-center font-mono font-semibold">{fmt(crashResult.originalDuration)}</td>
                    {hasOverhead && (
                      <>
                        <td className="px-3 py-2 text-center font-mono">{fDZD(crashResult.originalOverheadCost)}</td>
                        <td className="px-3 py-2 text-center font-mono">{fDZD(crashResult.originalTotalCost)}</td>
                      </>
                    )}
                    <td className="px-3 py-2">{pertResult.criticalPath.join(" → ")}</td>
                  </tr>
                  {crashResult.steps.map((s, i) => {
                    const isMin = hasOverhead && crashResult.minCostPoint?.stepIdx === i + 1;
                    return (
                      <tr key={i} className={cn(
                        "hover:bg-muted/20",
                        isMin && "bg-blue-50 font-medium"
                      )}>
                        <td className="px-3 py-2 text-center font-mono text-muted-foreground">{s.iteration}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5">
                            <Badge variant="outline" className="font-mono text-xs">{s.activityId}</Badge>
                            <span className="text-xs text-muted-foreground">{s.activityName}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-primary font-semibold">−1</td>
                        <td className="px-3 py-2 text-center font-mono">{fDZD(s.costSlope)}</td>
                        <td className="px-3 py-2 text-center font-mono text-orange-700">{fDZD(s.addedDirectCost)}</td>
                        <td className="px-3 py-2 text-center font-mono">{fDZD(s.totalDirectCost)}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold text-primary">{fmt(s.newDuration)}</td>
                        {hasOverhead && (
                          <>
                            <td className="px-3 py-2 text-center font-mono text-muted-foreground">{fDZD(s.overheadCost)}</td>
                            <td className={cn("px-3 py-2 text-center font-mono", isMin && "text-blue-700 font-bold")}>
                              {fDZD(s.totalCost)}{isMin && " ★"}
                            </td>
                          </>
                        )}
                        <td className="px-3 py-2 text-xs font-mono">{s.criticalPath.join(" → ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Cost-duration chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t("Courbe Coût–Durée", "منحنى التكلفة–المدة")}
              </CardTitle>
              <CardDescription>
                {hasOverhead
                  ? t(
                      "La courbe en pointillé (coût total) permet d'identifier le point optimal de crashing ★.",
                      "المنحنى المنقط (التكلفة الإجمالية) يحدد النقطة الأمثل للتسريع ★."
                    )
                  : t(
                      "Évolution du coût direct en fonction de la compression de durée.",
                      "تطور التكلفة المباشرة بدالة ضغط المدة."
                    )}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <CostDurationChart crash={crashResult} hasOverhead={hasOverhead} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
