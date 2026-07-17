import { useState, useRef } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import {
  computeSensitivityAnalysis, fmtDA, fmtN, fmtPct, breakEvenRisk,
} from "@/lib/sensitivityAnalysisAlgorithm";
import type {
  SensitivityAnalysisResult, SensitivityAnalysisParams,
} from "@/lib/sensitivityAnalysisAlgorithm";
import type { InvestmentAppraisalInput } from "@/lib/investmentAppraisalAlgorithm";
import { SensitivityAnalysisReport } from "./SensitivityAnalysisReport";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Calculator, ShoppingBag, Factory, Leaf, Monitor, PencilRuler,
  AlertTriangle, RefreshCw, ChevronDown, Info, Settings2, TrendingUp, TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Sector Templates ───────────────────────────────────────────────────────────
type SectorKey = "trade" | "industry" | "agriculture" | "services" | "custom";

interface TemplateInput {
  initialInvestment: number;
  discountRate: number;
  duration: number;
  cashFlows: number[];
  salvageValue?: number;
}
interface SectorTemplate {
  id: SectorKey;
  icon: React.ElementType;
  nameFr: string; nameAr: string;
  descFr: string; descAr: string;        // uncertainty-framed description
  projectNameFr: string; projectNameAr: string;
  input: TemplateInput | null;
}

const TEMPLATES: SectorTemplate[] = [
  {
    id: "trade", icon: ShoppingBag,
    nameFr: "Commerce",    nameAr: "التجارة",
    descFr: "Supermarché — Oran : et si les ventes sont 15% inférieures aux prévisions ?",
    descAr: "سوبرماركت — وهران: ماذا لو كانت المبيعات أقل بـ 15% من التوقعات؟",
    projectNameFr: "Succursale Supermarché — Oran",
    projectNameAr: "فرع السوبرماركت — وهران",
    input: { initialInvestment: 2_500_000, discountRate: 12, duration: 5,
             cashFlows: [450_000, 580_000, 720_000, 850_000, 900_000], salvageValue: 300_000 },
  },
  {
    id: "industry", icon: Factory,
    nameFr: "Industrie",   nameAr: "الصناعة",
    descFr: "Machine CNC — Batna : quelle hausse de coûts rend le projet non-rentable ?",
    descAr: "آلة CNC — باتنة: أي ارتفاع في التكاليف يجعل المشروع غير مربح؟",
    projectNameFr: "Machine CNC — Atelier Batna",
    projectNameAr: "آلة CNC — ورشة باتنة",
    input: { initialInvestment: 8_000_000, discountRate: 14, duration: 7,
             cashFlows: [1_400_000, 1_700_000, 2_000_000, 2_200_000, 2_300_000, 2_100_000, 1_800_000],
             salvageValue: 1_000_000 },
  },
  {
    id: "agriculture", icon: Leaf,
    nameFr: "Agriculture",  nameAr: "الفلاحة",
    descFr: "Tracteur+Irrigation — Biskra : résistance à la sécheresse et baisse de rendement ?",
    descAr: "جرار + ري — بسكرة: ما مدى تأثير الجفاف وانخفاض الإنتاج على الجدوى؟",
    projectNameFr: "Tracteur & Irrigation — Biskra",
    projectNameAr: "الجرار ونظام الري — بسكرة",
    input: { initialInvestment: 3_500_000, discountRate: 10, duration: 6,
             cashFlows: [500_000, 650_000, 800_000, 900_000, 950_000, 900_000],
             salvageValue: 700_000 },
  },
  {
    id: "services", icon: Monitor,
    nameFr: "Services",    nameAr: "الخدمات",
    descFr: "Cabinet dentaire — Tlemcen : sensibilité au taux de remplissage et aux tarifs ?",
    descAr: "عيادة أسنان — تلمسان: مدى حساسية الجدوى لمعدل الاشغال وتعريفات الخدمة؟",
    projectNameFr: "Cabinet Dentaire Privé — Tlemcen",
    projectNameAr: "عيادة الأسنان الخاصة — تلمسان",
    input: { initialInvestment: 5_000_000, discountRate: 15, duration: 6,
             cashFlows: [900_000, 1_150_000, 1_400_000, 1_550_000, 1_600_000, 1_550_000],
             salvageValue: 700_000 },
  },
  {
    id: "custom", icon: PencilRuler,
    nameFr: "Personnalisé", nameAr: "مخصص",
    descFr: "Saisie libre — testez la sensibilité de votre propre investissement",
    descAr: "إدخال حر — اختبر حساسية استثمارك الخاص",
    projectNameFr: "Mon investissement", projectNameAr: "استثماري",
    input: null,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseNum(v: string): number | undefined {
  const n = parseFloat(v.replace(/\s/g, "").replace(",", "."));
  return isFinite(n) ? n : undefined;
}
function parsePosNum(v: string): number | undefined {
  const n = parseNum(v);
  return n !== undefined && n >= 0 ? n : undefined;
}

// ── Tornado Chart (SVG) ────────────────────────────────────────────────────────
function TornadoChart({ result }: { result: SensitivityAnalysisResult }) {
  const { variables, baseResult } = result;
  const baseNPV = baseResult.npv;

  if (variables.length === 0) return null;

  const allNpvs = variables.flatMap(v => [v.npvAtMinRange, v.npvAtMaxRange, baseNPV]);
  const globalMin = Math.min(...allNpvs);
  const globalMax = Math.max(...allNpvs);
  const span = (globalMax - globalMin) || 1;
  const padded = span * 0.08;
  const minX = globalMin - padded;
  const maxX = globalMax + padded;
  const xRange = maxX - minX;

  const W = 640, barH = 28, gap = 12;
  const PL = 8, PR = 8, PT = 36, labelW = 0;
  const CW = W - PL - PR;
  const chartH = PT + variables.length * (barH + gap) + 32;

  const toX = (npv: number) => PL + ((npv - minX) / xRange) * CW;
  const baseX = toX(baseNPV);

  // Y-axis tick labels
  const ticks = 5;
  const tickVals: number[] = [];
  for (let i = 0; i <= ticks; i++) tickVals.push(minX + (xRange * i) / ticks);

  return (
    <svg viewBox={`0 0 ${W} ${chartH}`} className="w-full h-auto" aria-label="Tornado chart">
      {/* Background */}
      <rect x={PL} y={PT} width={CW} height={variables.length * (barH + gap) - gap + 8} rx="4" fill="#f9fafb" />

      {/* Tick grid lines + labels */}
      {tickVals.map((v, i) => {
        const tx = toX(v);
        const label = Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
                    : Math.abs(v) >= 1_000 ? `${(v / 1_000).toFixed(0)}k`
                    : v.toFixed(0);
        return (
          <g key={i}>
            <line x1={tx.toFixed(1)} y1={PT} x2={tx.toFixed(1)} y2={PT + variables.length * (barH + gap)}
              stroke="#e5e7eb" strokeWidth="1" />
            <text x={tx.toFixed(1)} y={PT - 6} fontSize="9" fill="#9ca3af" textAnchor="middle">{label}</text>
          </g>
        );
      })}

      {/* Base NPV vertical line */}
      <line x1={baseX.toFixed(1)} y1={PT - 2} x2={baseX.toFixed(1)} y2={PT + variables.length * (barH + gap) + 4}
        stroke="#004d40" strokeWidth="2" strokeDasharray="4,3" />
      <text x={baseX.toFixed(1)} y={PT - 14} fontSize="9" fill="#004d40" textAnchor="middle" fontWeight="600">
        Base: {Math.abs(baseNPV) >= 1_000_000 ? `${(baseNPV / 1_000_000).toFixed(2)}M DA` : `${Math.round(baseNPV).toLocaleString("fr-DZ")} DA`}
      </text>

      {/* Bars */}
      {variables.map((v, i) => {
        const y = PT + i * (barH + gap);
        const lo = Math.min(v.npvAtMinRange, v.npvAtMaxRange);
        const hi = Math.max(v.npvAtMinRange, v.npvAtMaxRange);
        const xLo = toX(lo);
        const xHi = toX(hi);

        // Red portion (below base NPV)
        const redX1 = xLo;
        const redX2 = Math.min(baseX, xHi);
        const showRed = redX2 > redX1;

        // Green portion (above base NPV)
        const greenX1 = Math.max(baseX, xLo);
        const greenX2 = xHi;
        const showGreen = greenX2 > greenX1;

        return (
          <g key={v.variable}>
            {/* Track */}
            <rect x={xLo.toFixed(1)} y={y + barH * 0.2} width={Math.max(2, xHi - xLo).toFixed(1)}
              height={barH * 0.6} rx="3" fill="#e5e7eb" />
            {/* Red segment */}
            {showRed && (
              <rect x={redX1.toFixed(1)} y={y + barH * 0.2}
                width={(redX2 - redX1).toFixed(1)} height={barH * 0.6} rx="3" fill="#fca5a5" />
            )}
            {/* Green segment */}
            {showGreen && (
              <rect x={greenX1.toFixed(1)} y={y + barH * 0.2}
                width={(greenX2 - greenX1).toFixed(1)} height={barH * 0.6} rx="3" fill="#86efac" />
            )}
            {/* NPV labels at bar ends */}
            <text x={(xLo - 3).toFixed(1)} y={y + barH * 0.5 + 4} fontSize="8.5" fill="#6b7280" textAnchor="end">
              {Math.abs(lo) >= 1_000_000 ? `${(lo / 1_000_000).toFixed(1)}M` : `${(lo / 1_000).toFixed(0)}k`}
            </text>
            <text x={(xHi + 3).toFixed(1)} y={y + barH * 0.5 + 4} fontSize="8.5" fill="#6b7280" textAnchor="start">
              {Math.abs(hi) >= 1_000_000 ? `${(hi / 1_000_000).toFixed(1)}M` : `${(hi / 1_000).toFixed(0)}k`}
            </text>
            {/* Variable label below the bar */}
            <text x={W / 2} y={y + barH + 2} fontSize="9.5" fill="#374151" textAnchor="middle" fontWeight="600">
              {v.nameFr}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${PL + 8}, ${chartH - 22})`}>
        <rect width="8" height="8" rx="2" fill="#fca5a5" />
        <text x="12" y="8" fontSize="8.5" fill="#6b7280">NPV ↓ (perte vs base)</text>
        <rect x="140" width="8" height="8" rx="2" fill="#86efac" />
        <text x="152" y="8" fontSize="8.5" fill="#6b7280">NPV ↑ (gain vs base)</text>
        <line x1="290" y1="4" x2="310" y2="4" stroke="#004d40" strokeWidth="1.5" strokeDasharray="4,2" />
        <text x="314" y="8" fontSize="8.5" fill="#004d40">VAN de base</text>
      </g>
    </svg>
  );
}

// ── Sensitivity Table ──────────────────────────────────────────────────────────
function SensitivityTable({ result }: { result: SensitivityAnalysisResult }) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { variables, allPcts, baseResult } = result;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[500px]">
        <thead>
          <tr className="bg-primary text-primary-foreground text-xs">
            <th className="px-3 py-2 text-start font-semibold sticky left-0 bg-primary">
              {t("Variation %", "التغيير %")}
            </th>
            {variables.map(v => (
              <th key={v.variable} className="px-3 py-2 text-end font-semibold whitespace-nowrap">
                {isAr ? v.nameAr : v.nameFr}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allPcts.map((pct, idx) => {
            const isBase = pct === 0;
            return (
              <tr key={pct}
                className={cn(
                  "border-b border-border text-sm",
                  isBase ? "bg-primary/10 font-bold" : idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                )}>
                <td className={cn("px-3 py-2 font-mono sticky left-0",
                  isBase ? "bg-primary/10 text-primary font-extrabold" : idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                )}>
                  {pct > 0 ? "+" : ""}{pct}%{isBase ? ` (${t("base","أساس")})` : ""}
                </td>
                {variables.map(v => {
                  const pt = v.points.find(p => p.pct === pct);
                  const npv = pt?.npv ?? 0;
                  return (
                    <td key={v.variable}
                      className={cn(
                        "px-3 py-2 font-mono text-end",
                        npv > 0 ? "text-green-700" : npv < 0 ? "text-destructive" : "text-amber-600",
                        isBase && "font-extrabold"
                      )}>
                      {fmtDA(npv)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground mt-2 italic">
        {t(
          "Chaque colonne fait varier une seule variable — toutes les autres restent à leur valeur de base.",
          "كل عمود يُغيّر متغيراً واحداً فقط — جميع المتغيرات الأخرى تبقى عند قيمتها الأساسية."
        )}
      </p>
    </div>
  );
}

// ── Break-Even Summary ─────────────────────────────────────────────────────────
function BreakEvenSummary({ result }: { result: SensitivityAnalysisResult }) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { variables } = result;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[400px]">
        <thead>
          <tr className="bg-primary text-primary-foreground text-xs">
            {[
              t("Variable", "المتغير"),
              t("Variation seuil (NPV = 0)", "تغيير العتبة (NPV = 0)"),
              t("Interprétation", "التفسير"),
              t("Risque", "المخاطرة"),
            ].map(h => (
              <th key={h} className="px-3 py-2 text-start font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variables.map((v, idx) => {
            const risk = breakEvenRisk(v.breakEvenPct);
            const riskLabel = {
              low:       t("Faible 🟢", "منخفضة 🟢"),
              moderate:  t("Modéré 🟡", "معتدلة 🟡"),
              high:      t("Élevé 🔴", "مرتفعة 🔴"),
              undefined: t("N/A", "غير متاح"),
            }[risk];
            const riskClass = {
              low:       "bg-green-100 text-green-800",
              moderate:  "bg-amber-100 text-amber-800",
              high:      "bg-red-100 text-red-800",
              undefined: "bg-muted text-muted-foreground",
            }[risk];

            const beStr = v.breakEvenPct !== null
              ? `${v.breakEvenPct >= 0 ? "+" : ""}${fmtN(v.breakEvenPct, 1)} %`
              : "—";

            const interpretation = v.breakEvenPct !== null ? t(
              `NPV atteint 0 quand ${isAr ? v.nameAr : v.nameFr} varie de ${beStr}`,
              `تصبح NPV صفراً عندما يتغير ${isAr ? v.nameAr : v.nameFr} بمقدار ${beStr}`
            ) : t("Pas de seuil NPV=0 dans la plage analysée", "لا توجد عتبة NPV=0 في النطاق المُحلَّل");

            return (
              <tr key={v.variable}
                className={cn("border-b border-border", idx % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                <td className="px-3 py-2 font-semibold whitespace-nowrap">
                  {isAr ? v.nameAr : v.nameFr}
                </td>
                <td className="px-3 py-2 font-mono font-bold">
                  {beStr}
                </td>
                <td className="px-3 py-2 text-sm text-muted-foreground leading-snug">
                  {interpretation}
                </td>
                <td className="px-3 py-2">
                  <Badge className={cn("text-xs font-semibold", riskClass)}>{riskLabel}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Scenario Cards ─────────────────────────────────────────────────────────────
function ScenarioCards({ result }: { result: SensitivityAnalysisResult }) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { scenarios } = result;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {scenarios.map(sc => {
        const npv = sc.result.npv;
        const irr = sc.result.irr;
        const pi  = sc.result.profitabilityIndex;
        const pb  = sc.result.discountedPayback;
        const r   = sc.result.input.discountRate;
        const n   = sc.result.input.duration;

        const npvPositive = npv > 0;
        const isBase = sc.name === "base";
        const isOpt  = sc.name === "optimistic";
        const isPess = sc.name === "pessimistic";

        const borderColor = isOpt ? "border-green-400" : isPess ? "border-red-400" : "border-primary/40";
        const bgColor     = isOpt ? "bg-green-50" : isPess ? "bg-red-50" : "bg-primary/5";
        const badgeClass  = isOpt ? "bg-green-100 text-green-800" : isPess ? "bg-red-100 text-red-800" : "bg-primary/10 text-primary";

        return (
          <div key={sc.name} className={cn("rounded-xl border-2 p-5 space-y-3", borderColor, bgColor)}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{sc.emojiIcon}</span>
              <div>
                <p className="font-bold text-sm">{isAr ? sc.nameAr : sc.nameFr}</p>
                {sc.adjustmentPct > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {isPess
                      ? t(`−${sc.adjustmentPct}% flux · +${sc.adjustmentPct}% coûts & taux`, `−${sc.adjustmentPct}% تدفقات · +${sc.adjustmentPct}% تكاليف`)
                      : t(`+${sc.adjustmentPct}% flux · −${sc.adjustmentPct}% coûts & taux`, `+${sc.adjustmentPct}% تدفقات · −${sc.adjustmentPct}% تكاليف`)}
                  </p>
                )}
              </div>
              <Badge className={cn("ms-auto text-xs font-bold", badgeClass)}>
                {npvPositive ? "✅ GO" : "🔴 NO-GO"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: t("VAN", "NPV"),
                  value: fmtDA(npv),
                  color: npvPositive ? "text-green-700 font-extrabold" : "text-destructive font-extrabold",
                },
                {
                  label: t("TRI", "IRR"),
                  value: irr !== null ? fmtPct(irr, 1) : "—",
                  color: irr !== null && irr >= r ? "text-green-700 font-bold" : "text-amber-600 font-bold",
                },
                {
                  label: t("Indice Rentabilité", "مؤشر الربحية"),
                  value: fmtN(pi, 3),
                  color: pi >= 1 ? "text-green-700" : "text-destructive",
                },
                {
                  label: t("Récup. actualisée", "الاسترداد المخصوم"),
                  value: pb !== null ? `${fmtN(pb, 1)} ${t("ans","سنوات")}` : t("—", "—"),
                  color: pb !== null && pb < n ? "text-green-700" : "text-amber-600",
                },
              ].map(kpi => (
                <div key={kpi.label} className="rounded-lg bg-white/60 p-2.5">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className={cn("text-sm mt-0.5", kpi.color)}>{kpi.value}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SensitivityAnalysis() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const resultsRef = useRef<HTMLDivElement>(null);

  const [selectedSector, setSelectedSector] = useState<SectorKey | null>(null);

  // ── Base form state ────────────────────────────────────────────────────────
  const [projectName,       setProjectName]       = useState("");
  const [initialInvestment, setInitialInvestment] = useState("");
  const [discountRate,      setDiscountRate]       = useState("");
  const [duration,          setDuration]           = useState("");
  const [cashFlowInputs,    setCashFlowInputs]     = useState<string[]>([]);
  const [salvageValue,      setSalvageValue]       = useState("");

  // ── Sensitivity parameters ─────────────────────────────────────────────────
  const [rangeMax,       setRangeMax]       = useState("20");  // ±%
  const [stepSize,       setStepSize]       = useState("5");   // %
  const [pessimisticAdj, setPessimisticAdj] = useState("15");
  const [optimisticAdj,  setOptimisticAdj]  = useState("15");

  const [result, setResult] = useState<SensitivityAnalysisResult | null>(null);
  const [error,  setError]  = useState<string | null>(null);

  // ── Template application ────────────────────────────────────────────────────
  function applyTemplate(tpl: SectorTemplate) {
    setSelectedSector(tpl.id);
    setError(null);
    setResult(null);
    if (!tpl.input) {
      setProjectName(""); setInitialInvestment(""); setDiscountRate("");
      setDuration(""); setCashFlowInputs([]); setSalvageValue("");
      return;
    }
    const inp = tpl.input;
    setProjectName(isAr ? tpl.projectNameAr : tpl.projectNameFr);
    setInitialInvestment(String(inp.initialInvestment));
    setDiscountRate(String(inp.discountRate));
    setDuration(String(inp.duration));
    setCashFlowInputs(inp.cashFlows.map(String));
    setSalvageValue(inp.salvageValue !== undefined ? String(inp.salvageValue) : "");
  }

  function handleDurationChange(val: string) {
    setDuration(val);
    const n = parseInt(val, 10);
    if (isFinite(n) && n >= 1 && n <= 30) {
      setCashFlowInputs(prev => {
        if (prev.length === n) return prev;
        if (prev.length < n) return [...prev, ...Array(n - prev.length).fill("")];
        return prev.slice(0, n);
      });
    }
  }

  // ── Calculation ─────────────────────────────────────────────────────────────
  function handleCalculate() {
    setError(null);
    const I0   = parseNum(initialInvestment);
    const rate = parsePosNum(discountRate);
    const n    = parseInt(duration, 10);
    const rMax = parsePosNum(rangeMax);
    const step = parsePosNum(stepSize);
    const pess = parsePosNum(pessimisticAdj);
    const opt  = parsePosNum(optimisticAdj);

    if (I0 === undefined || I0 <= 0) {
      setError(t("L'investissement initial doit être un nombre positif.", "يجب أن يكون الاستثمار الأولي رقماً موجباً.")); return;
    }
    if (rate === undefined) {
      setError(t("Taux d'actualisation requis (≥ 0).", "معدل الخصم مطلوب (≥ 0).")); return;
    }
    if (!isFinite(n) || n < 1 || n > 30) {
      setError(t("Durée du projet : entre 1 et 30 ans.", "مدة المشروع: بين 1 و30 سنة.")); return;
    }
    if (cashFlowInputs.length < n) {
      setError(t("Renseignez tous les flux de trésorerie annuels.", "أدخل جميع التدفقات النقدية السنوية.")); return;
    }
    const cashFlows: number[] = [];
    for (let i = 0; i < n; i++) {
      const cf = parseNum(cashFlowInputs[i]);
      if (cf === undefined) {
        setError(t(`Flux de l'année ${i + 1} invalide.`, `التدفق النقدي للسنة ${i + 1} غير صالح.`)); return;
      }
      cashFlows.push(cf);
    }
    if (rMax === undefined || rMax <= 0 || rMax > 50) {
      setError(t("La plage d'analyse doit être entre 1% et 50%.", "نطاق التحليل يجب أن يكون بين 1% و50%.")); return;
    }
    if (step === undefined || step <= 0) {
      setError(t("Le pas doit être un nombre positif.", "الخطوة يجب أن تكون رقماً موجباً.")); return;
    }
    if (pess === undefined || pess <= 0) {
      setError(t("L'ajustement pessimiste doit être un nombre positif.", "التعديل المتشائم يجب أن يكون رقماً موجباً.")); return;
    }
    if (opt === undefined || opt <= 0) {
      setError(t("L'ajustement optimiste doit être un nombre positif.", "التعديل المتفائل يجب أن يكون رقماً موجباً.")); return;
    }

    const baseInput: InvestmentAppraisalInput = {
      projectName: projectName || undefined,
      initialInvestment: I0,
      discountRate: rate,
      duration: n,
      cashFlows,
      salvageValue: parsePosNum(salvageValue),
    };

    const params: SensitivityAnalysisParams = {
      baseInput,
      rangeMin: -rMax,
      rangeMax: rMax,
      stepSize: step,
      pessimisticAdj: pess,
      optimisticAdj:  opt,
    };

    try {
      const r = computeSensitivityAnalysis(params);
      setResult(r);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (e) {
      setError(String(e));
    }
  }

  function handleReset() {
    setSelectedSector(null); setResult(null); setError(null);
    setProjectName(""); setInitialInvestment(""); setDiscountRate("");
    setDuration(""); setCashFlowInputs([]); setSalvageValue("");
    setRangeMax("20"); setStepSize("5"); setPessimisticAdj("15"); setOptimisticAdj("15");
  }

  const n = parseInt(duration, 10);

  return (
    <div className={cn("container mx-auto px-4 py-8 max-w-5xl space-y-8", isAr ? "rtl" : "ltr")}
      dir={isAr ? "rtl" : "ltr"}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <LineChart className="w-6 h-6 text-primary" />
            {t("Analyse de Sensibilité de l'Investissement", "تحليل حساسية الاستثمار")}
          </h1>
          <Badge className="bg-primary/10 text-primary border-primary/30 font-semibold text-xs">
            {t("VAN / TRI par hypothèse", "NPV / IRR حسب الافتراض")}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm max-w-2xl">
          {t(
            "Mesurez l'impact des variations de coûts, de flux et de taux sur la rentabilité de votre investissement. Identifiez les paramètres critiques et simulez les scénarios pessimiste, de base et optimiste.",
            "قيّم تأثير تغيرات التكاليف والتدفقات والمعدلات على ربحية استثمارك. حدد المتغيرات الحرجة وقارن السيناريوهات المتشائمة والأساسية والمتفائلة."
          )}
        </p>
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground/70 italic">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{t(
            "Cet outil réutilise le modèle VAN/TRI de l'Évaluation de Rentabilité et teste chaque hypothèse indépendamment.",
            "تستعيد هذه الأداة نموذج NPV/IRR من أداة تقييم الجدوى وتختبر كل افتراض بشكل مستقل."
          )}</span>
        </div>
      </div>

      {/* ── Sector Selection ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("Type d'investissement", "نوع الاستثمار")}</CardTitle>
          <CardDescription>
            {t(
              "Choisissez un exemple pour pré-remplir les données, ou entrez vos propres chiffres.",
              "اختر نموذجاً لملء البيانات مسبقاً، أو أدخل أرقامك الخاصة."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {TEMPLATES.map(tpl => {
              const Icon = tpl.icon;
              const isSelected = selectedSector === tpl.id;
              const isCustom   = tpl.id === "custom";
              return (
                <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                  className={cn(
                    "group relative rounded-xl border-2 p-4 text-left transition-all duration-200 hover:shadow-md",
                    isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50",
                    isCustom && !isSelected && "border-dashed"
                  )}>
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 transition-colors",
                    isSelected ? "bg-primary text-primary-foreground"
                               : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <p className={cn("font-semibold text-sm", isSelected ? "text-primary" : "text-foreground")}>
                    {isAr ? tpl.nameAr : tpl.nameFr}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                    {isAr ? tpl.descAr : tpl.descFr}
                  </p>
                  {isSelected && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Base Input Form ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            {t("Paramètres de base de l'investissement", "المعايير الأساسية للاستثمار")}
          </CardTitle>
          <CardDescription>
            {t(
              "Ces valeurs sont le scénario de base. La sensibilité sera calculée en les faisant varier.",
              "هذه القيم هي السيناريو الأساسي. سيُحسب التأثير بتغيير كل منها."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          <div className="space-y-1.5">
            <Label>{t("Nom du projet / investissement", "اسم المشروع / الاستثمار")}</Label>
            <Input value={projectName} onChange={e => setProjectName(e.target.value)}
              placeholder={t("Ex: Machine CNC — Atelier Batna", "مثال: آلة CNC — ورشة باتنة")} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t("Investissement initial (DA) *", "الاستثمار الأولي (DA) *")}</Label>
              <Input type="number" min="0" step="any"
                value={initialInvestment} onChange={e => setInitialInvestment(e.target.value)}
                placeholder="ex: 8000000" />
              <p className="text-xs text-muted-foreground">{t("Coût total à l'année 0", "التكلفة الكاملة عند السنة 0")}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Taux d'actualisation requis (%) *", "معدل الخصم المطلوب (%) *")}</Label>
              <Input type="number" min="0" max="200" step="0.1"
                value={discountRate} onChange={e => setDiscountRate(e.target.value)}
                placeholder="ex: 14" />
              <p className="text-xs text-muted-foreground">{t("Coût du capital ou rendement minimum", "تكلفة رأس المال أو الحد الأدنى للعائد")}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Durée du projet (années) *", "مدة المشروع (سنوات) *")}</Label>
              <Input type="number" min="1" max="30" step="1"
                value={duration} onChange={e => handleDurationChange(e.target.value)}
                placeholder="ex: 7" />
              <p className="text-xs text-muted-foreground">{t("Entre 1 et 30 ans", "من 1 إلى 30 سنة")}</p>
            </div>
          </div>

          {isFinite(n) && n >= 1 && cashFlowInputs.length === n && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">
                  {t(`Flux de trésorerie annuels (DA) — ${n} année${n > 1 ? "s" : ""} *`,
                     `التدفقات النقدية السنوية (DA) — ${n} ${n === 1 ? "سنة" : "سنوات"} *`)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("Recettes nettes attendues chaque année (après charges, avant amortissements).",
                     "صافي الإيرادات المتوقعة كل سنة (بعد المصاريف، قبل الاستهلاكات).")}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {cashFlowInputs.map((val, i) => (
                  <div key={i} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {t(`Année ${i + 1}`, `السنة ${i + 1}`)}
                    </Label>
                    <Input type="number" step="any" value={val}
                      onChange={e => {
                        const next = [...cashFlowInputs];
                        next[i] = e.target.value;
                        setCashFlowInputs(next);
                      }}
                      placeholder="ex: 1 400 000" className="text-sm" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="max-w-xs space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("Champ optionnel", "حقل اختياري")}
            </p>
            <Label className="text-sm">{t("Valeur résiduelle (DA) — optionnel", "القيمة المتبقية (DA) — اختياري")}</Label>
            <Input type="number" min="0" step="any"
              value={salvageValue} onChange={e => setSalvageValue(e.target.value)}
              placeholder={t("Ex: 1 000 000 DA", "مثال: 1 000 000 DA")} />
          </div>
        </CardContent>
      </Card>

      {/* ── Sensitivity Parameters ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            {t("Paramètres de l'analyse de sensibilité", "معايير تحليل الحساسية")}
          </CardTitle>
          <CardDescription>
            {t(
              "Définissez la plage de variation à tester et les ajustements des scénarios pessimiste/optimiste.",
              "حدد نطاق التغيير المُختبَر وتعديلات السيناريوهات المتشائمة/المتفائلة."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("Plage de variation (±%) *", "نطاق التغيير (±%) *")}</Label>
              <Input type="number" min="1" max="50" step="1"
                value={rangeMax} onChange={e => setRangeMax(e.target.value)}
                placeholder="ex: 20" />
              <p className="text-xs text-muted-foreground">
                {t(
                  `Les variables seront testées de −${rangeMax}% à +${rangeMax}%. Plage recommandée : 10–30%.`,
                  `ستُختبر المتغيرات من −${rangeMax}% إلى +${rangeMax}%. النطاق الموصى به: 10–30%.`
                )}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Pas d'incrément (%) *", "خطوة الزيادة (%) *")}</Label>
              <Input type="number" min="1" max="20" step="1"
                value={stepSize} onChange={e => setStepSize(e.target.value)}
                placeholder="ex: 5" />
              <p className="text-xs text-muted-foreground">
                {t(
                  "Intervalle entre chaque point de la table. 5% → 9 points pour ±20%.",
                  "الفاصل بين كل نقطة في الجدول. 5% → 9 نقاط عند ±20%."
                )}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 border border-border p-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("Ajustements des scénarios", "تعديلات السيناريوهات")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                  {t("Ajustement pessimiste (%)", "التعديل المتشائم (%)")}
                </Label>
                <Input type="number" min="1" max="50" step="1"
                  value={pessimisticAdj} onChange={e => setPessimisticAdj(e.target.value)}
                  placeholder="ex: 15" />
                <p className="text-xs text-muted-foreground">
                  {t(
                    `Flux −${pessimisticAdj}%, I₀ et taux +${pessimisticAdj}%`,
                    `التدفقات −${pessimisticAdj}%، الاستثمار والمعدل +${pessimisticAdj}%`
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                  {t("Ajustement optimiste (%)", "التعديل المتفائل (%)")}
                </Label>
                <Input type="number" min="1" max="50" step="1"
                  value={optimisticAdj} onChange={e => setOptimisticAdj(e.target.value)}
                  placeholder="ex: 15" />
                <p className="text-xs text-muted-foreground">
                  {t(
                    `Flux +${optimisticAdj}%, I₀ et taux −${optimisticAdj}%`,
                    `التدفقات +${optimisticAdj}%، الاستثمار والمعدل −${optimisticAdj}%`
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 flex-wrap pt-1">
            <Button onClick={handleCalculate} className="min-w-[220px]">
              <LineChart className="w-4 h-4 me-2" />
              {t("Lancer l'analyse de sensibilité", "تشغيل تحليل الحساسية")}
            </Button>
            <Button variant="ghost" onClick={handleReset} className="text-muted-foreground">
              <RefreshCw className="w-4 h-4 me-2" />
              {t("Réinitialiser", "إعادة تعيين")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {result && (
        <div ref={resultsRef} className="space-y-6">

          <div className="flex items-center gap-2 text-primary text-sm font-medium animate-bounce w-fit">
            <ChevronDown className="w-4 h-4" />
            {t("Résultats de l'analyse ci-dessous", "نتائج التحليل أدناه")}
          </div>

          {/* ── Base KPI summary ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: t("VAN de base", "NPV الأساسية"),
                value: fmtDA(result.baseResult.npv),
                sub: result.baseResult.npv > 0 ? t("✅ Rentable", "✅ مربح") : t("🔴 Non-rentable", "🔴 غير مربح"),
                color: result.baseResult.npv > 0 ? "bg-green-600 text-white" : "bg-red-600 text-white",
                icon: result.baseResult.npv >= 0 ? "📈" : "📉",
              },
              {
                label: t("TRI de base", "IRR الأساسي"),
                value: result.baseResult.irr !== null ? `${fmtN(result.baseResult.irr, 2)} %` : "—",
                sub: result.baseResult.irr !== null && result.baseResult.irr >= result.baseResult.input.discountRate
                  ? t("✅ > taux requis", "✅ > المعدل المطلوب")
                  : t("⚠️ < taux requis", "⚠️ < المعدل المطلوب"),
                color: result.baseResult.irr !== null && result.baseResult.irr >= result.baseResult.input.discountRate
                  ? "bg-primary text-primary-foreground" : "bg-amber-500 text-white",
                icon: "📊",
              },
              {
                label: t("Var. la plus sensible", "أكثر المتغيرات حساسية"),
                value: result.variables[0] ? (isAr ? result.variables[0].nameAr : result.variables[0].nameFr) : "—",
                sub: result.variables[0] ? `${t("Impact","تأثير")} ${fmtDA(result.variables[0].impact)}` : "",
                color: "bg-amber-500 text-white",
                icon: "🎯",
              },
              {
                label: t("Scénario pessimiste VAN", "NPV المتشائم"),
                value: fmtDA(result.scenarios[0].result.npv),
                sub: result.scenarios[0].result.npv > 0
                  ? t("✅ Résiste", "✅ يصمد")
                  : t("🔴 Non-viable", "🔴 غير جدوى"),
                color: result.scenarios[0].result.npv > 0 ? "bg-secondary text-secondary-foreground" : "bg-red-600 text-white",
                icon: "📉",
              },
            ].map(kpi => (
              <div key={kpi.label} className={cn("rounded-xl p-4 space-y-1", kpi.color)}>
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{kpi.icon}</span>
                  <p className="text-xs opacity-80 font-medium leading-tight">{kpi.label}</p>
                </div>
                <p className="text-base font-extrabold leading-tight">{kpi.value}</p>
                <p className="text-xs opacity-75 leading-tight">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Sensitivity Table ──────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t("Tableau de sensibilité — VAN par variation", "جدول الحساسية — NPV عند كل تغيير")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <SensitivityTable result={result} />
            </CardContent>
          </Card>

          {/* ── Tornado Chart ──────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <LineChart className="w-4 h-4 text-primary" />
                {t("Diagramme Tornade — Classement des variables par impact", "مخطط الإعصار — ترتيب المتغيرات حسب الأثر")}
              </CardTitle>
              <CardDescription>
                {t(
                  "La barre la plus large correspond à la variable qui influe le plus sur la VAN. Les barres s'étendent de la VAN au pire cas (rouge) au meilleur cas (vert).",
                  "أطول شريط يمثل المتغير الأكثر تأثيراً على NPV. تمتد الأشرطة من NPV عند أسوأ حالة (أحمر) إلى أفضل حالة (أخضر)."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-lg overflow-hidden border border-border bg-white p-3">
                <TornadoChart result={result} />
              </div>
            </CardContent>
          </Card>

          {/* ── Break-Even Summary ─────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t("Points de bascule — Variation au seuil de rentabilité (VAN = 0)", "نقاط التعادل — التغيير عند حد الجدوى (NPV = 0)")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <BreakEvenSummary result={result} />
            </CardContent>
          </Card>

          {/* ── Scenario Analysis ─────────────────────────────────────────── */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {t("Analyse par Scénarios — Pessimiste / Base / Optimiste", "تحليل السيناريوهات — متشائم / أساسي / متفائل")}
            </h2>
            <ScenarioCards result={result} />
          </div>

          {/* ── Report section ─────────────────────────────────────────────── */}
          <SensitivityAnalysisReport
            result={result}
            projectName={projectName}
            sector={selectedSector}
          />
        </div>
      )}
    </div>
  );
}
