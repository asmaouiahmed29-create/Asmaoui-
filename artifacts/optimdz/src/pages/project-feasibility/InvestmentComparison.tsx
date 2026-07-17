import { useState, useRef } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import {
  computeComparison, fmtDA, fmtN, fmtPct, fmtYears,
  CHART_COLORS, CHART_COLORS_LIGHT,
} from "@/lib/investmentComparisonAlgorithm";
import type { ComparisonResult, AlternativeInput } from "@/lib/investmentComparisonAlgorithm";
import { InvestmentComparisonReport } from "./InvestmentComparisonReport";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  GitCompare, Plus, Trash2, Calculator, ShoppingBag, Factory,
  Leaf, Monitor, PencilRuler, AlertTriangle, RefreshCw,
  ChevronDown, Info, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SectorKey = "trade" | "industry" | "agriculture" | "services" | "custom";

// ── Sector templates ───────────────────────────────────────────────────────────
interface TemplateAlt {
  name: string; nameAr: string;
  initialInvestment: number; duration: number;
  cashFlows: number[]; salvageValue?: number;
}
interface SectorTemplate {
  id: SectorKey;
  icon: React.ElementType;
  nameFr: string; nameAr: string;
  descFr: string; descAr: string;
  discountRate: number;
  alts: TemplateAlt[];
}

const TEMPLATES: SectorTemplate[] = [
  {
    id: "trade", icon: ShoppingBag,
    nameFr: "Commerce",    nameAr: "التجارة",
    descFr: "Épicerie de quartier vs Supermarché franchise — lequel rapporte le plus à long terme ?",
    descAr: "بقالة حي مقابل سوبرماركت امتياز — أيهما يُجدي أكثر على المدى البعيد؟",
    discountRate: 12,
    alts: [
      {
        name: "Épicerie quartier — Oran", nameAr: "بقالة حي — وهران",
        initialInvestment: 2_500_000, duration: 5,
        cashFlows: [480_000, 600_000, 720_000, 780_000, 800_000],
        salvageValue: 200_000,
      },
      {
        name: "Supermarché franchise — Constantine", nameAr: "سوبرماركت امتياز — قسنطينة",
        initialInvestment: 6_000_000, duration: 8,
        cashFlows: [800_000, 1_100_000, 1_400_000, 1_600_000, 1_700_000, 1_700_000, 1_600_000, 1_500_000],
        salvageValue: 800_000,
      },
    ],
  },
  {
    id: "industry", icon: Factory,
    nameFr: "Industrie",   nameAr: "الصناعة",
    descFr: "Machine CNC d'occasion vs neuve vs sous-traitance — quelle stratégie maximise la VAN ?",
    descAr: "آلة CNC مستعملة مقابل جديدة مقابل مناولة خارجية — أي استراتيجية تُعظّم NPV؟",
    discountRate: 14,
    alts: [
      {
        name: "CNC d'occasion rénovée — Batna", nameAr: "آلة CNC مجددة — باتنة",
        initialInvestment: 5_000_000, duration: 5,
        cashFlows: [1_200_000, 1_400_000, 1_500_000, 1_400_000, 1_200_000],
        salvageValue: 500_000,
      },
      {
        name: "CNC neuve haut de gamme — Batna", nameAr: "آلة CNC جديدة — باتنة",
        initialInvestment: 12_000_000, duration: 8,
        cashFlows: [1_800_000, 2_200_000, 2_600_000, 2_800_000, 2_800_000, 2_600_000, 2_400_000, 2_000_000],
        salvageValue: 2_000_000,
      },
      {
        name: "Sous-traitance (location machine)", nameAr: "مناولة خارجية (تأجير آلة)",
        initialInvestment: 1_000_000, duration: 3,
        cashFlows: [500_000, 600_000, 600_000],
      },
    ],
  },
  {
    id: "agriculture", icon: Leaf,
    nameFr: "Agriculture",  nameAr: "الفلاحة",
    descFr: "Serre froide vs serre chauffée — comparer malgré des durées différentes (EAA)",
    descAr: "دفيئة بلاستيكية مقابل دفيئة مدفأة — المقارنة رغم اختلاف المدد (EAA)",
    discountRate: 10,
    alts: [
      {
        name: "Serre froide plastique — Biskra", nameAr: "دفيئة بلاستيك باردة — بسكرة",
        initialInvestment: 2_000_000, duration: 4,
        cashFlows: [550_000, 650_000, 700_000, 650_000],
      },
      {
        name: "Serre tunnel chauffée — Biskra", nameAr: "نفق دفيئة مدفأة — بسكرة",
        initialInvestment: 4_500_000, duration: 7,
        cashFlows: [700_000, 900_000, 1_100_000, 1_200_000, 1_200_000, 1_100_000, 1_000_000],
        salvageValue: 500_000,
      },
    ],
  },
  {
    id: "services", icon: Monitor,
    nameFr: "Services",    nameAr: "الخدمات",
    descFr: "Cabinet dentaire vs pharmacie — lequel crée le plus de valeur à Tlemcen ?",
    descAr: "عيادة أسنان مقابل صيدلية — أيهما يُنشئ أكثر قيمة في تلمسان؟",
    discountRate: 15,
    alts: [
      {
        name: "Cabinet dentaire privé — Tlemcen", nameAr: "عيادة أسنان خاصة — تلمسان",
        initialInvestment: 5_000_000, duration: 6,
        cashFlows: [900_000, 1_150_000, 1_400_000, 1_550_000, 1_600_000, 1_550_000],
        salvageValue: 700_000,
      },
      {
        name: "Pharmacie + parapharmacie — Tlemcen", nameAr: "صيدلية + شبه صيدلية — تلمسان",
        initialInvestment: 4_000_000, duration: 5,
        cashFlows: [850_000, 1_000_000, 1_200_000, 1_300_000, 1_300_000],
        salvageValue: 400_000,
      },
    ],
  },
  {
    id: "custom", icon: PencilRuler,
    nameFr: "Personnalisé", nameAr: "مخصص",
    descFr: "Saisie libre — comparez vos propres alternatives d'investissement",
    descAr: "إدخال حر — قارن بين بدائل استثمارك الخاصة",
    discountRate: 12,
    alts: [],
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
function medalOf(rank: number) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
}

const DEFAULT_BLANK_ALTS = (): AlternativeFormState[] => [
  { name: "", initialInvestment: "", duration: "", cashFlows: [], salvageValue: "" },
  { name: "", initialInvestment: "", duration: "", cashFlows: [], salvageValue: "" },
];

interface AlternativeFormState {
  name: string;
  initialInvestment: string;
  duration: string;
  cashFlows: string[];
  salvageValue: string;
}

function emptyAlt(): AlternativeFormState {
  return { name: "", initialInvestment: "", duration: "", cashFlows: [], salvageValue: "" };
}

// ── NPV Bar Chart (SVG) ────────────────────────────────────────────────────────
function NPVBarChart({ result }: { result: ComparisonResult }) {
  const { alternatives, primaryCriterion, unequalDurations } = result;
  const useEAA = unequalDurations && primaryCriterion === "eaa";

  const values = alternatives.map(a => useEAA ? (a.eaa ?? a.appraisal.npv) : a.appraisal.npv);
  const labels = alternatives.map(a => a.input.name);
  const n = alternatives.length;

  const W = 600, H = 280, PL = 8, PR = 8, PT = 30, PB = 60;
  const chartH = H - PT - PB;
  const groupW = (W - PL - PR) / n;
  const barW = Math.min(80, groupW * 0.6);

  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 0);
  const span = (maxV - minV) || 1;
  const toY = (v: number) => PT + chartH - ((v - minV) / span) * chartH;
  const zeroY = toY(0);

  // Y axis ticks
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => minV + (span * i) / tickCount);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-label="NPV comparison bar chart">
      {/* Y grid */}
      {ticks.map((v, i) => {
        const ty = toY(v);
        const label = Math.abs(v) >= 1_000_000
          ? `${(v / 1_000_000).toFixed(1)}M`
          : Math.abs(v) >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : v.toFixed(0);
        return (
          <g key={i}>
            <line x1={PL} y1={ty.toFixed(1)} x2={W - PR} y2={ty.toFixed(1)}
              stroke={v === 0 ? "#004d40" : "#e5e7eb"} strokeWidth={v === 0 ? "1.5" : "1"}
              strokeDasharray={v === 0 ? "none" : "4,3"} />
            <text x={PL + 2} y={(ty - 3).toFixed(1)} fontSize="9" fill="#9ca3af">{label}</text>
          </g>
        );
      })}

      {/* Bars */}
      {alternatives.map((alt, i) => {
        const v = values[i];
        const cx = PL + i * groupW + groupW / 2;
        const barX = cx - barW / 2;
        const barTop = Math.min(toY(v), zeroY);
        const barBottom = Math.max(toY(v), zeroY);
        const bh = Math.max(2, barBottom - barTop);
        const isWinner = alt.overallRank === 1;

        const labelLines = labels[i].split(" — ");

        return (
          <g key={i}>
            {/* Bar shadow for winner */}
            {isWinner && (
              <rect x={(barX - 2).toFixed(1)} y={(barTop - 2).toFixed(1)}
                width={(barW + 4).toFixed(1)} height={(bh + 4).toFixed(1)}
                rx="6" fill={CHART_COLORS[i]} opacity="0.15" />
            )}
            <rect x={barX.toFixed(1)} y={barTop.toFixed(1)} width={barW.toFixed(1)} height={bh.toFixed(1)}
              rx="4" fill={CHART_COLORS[i]} opacity={isWinner ? "1" : "0.72"} />

            {/* Value label on bar */}
            <text x={cx.toFixed(1)} y={(barTop - 5).toFixed(1)} fontSize="9.5" fill={CHART_COLORS[i]}
              textAnchor="middle" fontWeight="700">
              {Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : `${Math.round(v / 1_000)}k`}
            </text>

            {/* Winner medal */}
            {isWinner && (
              <text x={cx.toFixed(1)} y={(barTop - 17).toFixed(1)} fontSize="12" textAnchor="middle">🥇</text>
            )}

            {/* Alternative name below */}
            {labelLines.map((line, li) => (
              <text key={li} x={cx.toFixed(1)} y={(H - PB + 16 + li * 14).toFixed(1)}
                fontSize="9.5" fill="#374151" textAnchor="middle" fontWeight={isWinner ? "700" : "400"}>
                {line.length > 22 ? line.slice(0, 20) + "…" : line}
              </text>
            ))}

            {/* Rank badge */}
            <text x={cx.toFixed(1)} y={(H - PB + 14 + labelLines.length * 14).toFixed(1)}
              fontSize="9" fill="#9ca3af" textAnchor="middle">
              {medalOf(alt.overallRank)}
            </text>
          </g>
        );
      })}

      {/* Chart title */}
      <text x={W / 2} y="16" fontSize="11" fill="#004d40" textAnchor="middle" fontWeight="700">
        {useEAA ? "EAA — Rente Équivalente Annuelle (DA/an)" : "VAN — Valeur Actuelle Nette (DA)"}
      </text>
    </svg>
  );
}

// ── Cumulative DCF Line Chart (SVG) ───────────────────────────────────────────
function CumulativeDCFChart({ result }: { result: ComparisonResult }) {
  const { alternatives, maxDuration } = result;

  const W = 600, H = 280, PL = 48, PR = 16, PT = 30, PB = 50;
  const CW = W - PL - PR;
  const CH = H - PT - PB;

  // Build series: year 0 = −I0, then cumDCF per year
  type Series = { x: number; y: number }[];
  const seriesList: Series[] = alternatives.map(alt => {
    const rows = alt.appraisal.yearRows;
    const pts: Series = [{ x: 0, y: -alt.appraisal.input.initialInvestment }];
    rows.forEach(r => pts.push({ x: r.year, y: r.cumulativeDCF }));
    return pts;
  });

  const allY = seriesList.flatMap(s => s.map(p => p.y));
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY, 0);
  const spanY = (maxY - minY) || 1;

  const toX = (year: number) => PL + (year / maxDuration) * CW;
  const toY = (v: number) => PT + CH - ((v - minY) / spanY) * CH;
  const zeroY = toY(0);

  // X ticks
  const xTicks = Array.from({ length: maxDuration + 1 }, (_, i) => i);
  // Y ticks
  const yTicks = 5;
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => minY + (spanY * i) / yTicks);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-label="Cumulative discounted cash flow chart">
      {/* Y grid + labels */}
      {yTickVals.map((v, i) => {
        const ty = toY(v);
        const label = Math.abs(v) >= 1_000_000
          ? `${(v / 1_000_000).toFixed(1)}M`
          : Math.abs(v) >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : v.toFixed(0);
        return (
          <g key={i}>
            <line x1={PL} y1={ty.toFixed(1)} x2={W - PR} y2={ty.toFixed(1)}
              stroke={v === 0 ? "#004d40" : "#e5e7eb"} strokeWidth={v === 0 ? "1.5" : "1"}
              strokeDasharray={v === 0 ? "none" : "4,3"} />
            <text x={(PL - 4).toFixed(1)} y={(ty + 3).toFixed(1)} fontSize="8.5" fill="#9ca3af" textAnchor="end">{label}</text>
          </g>
        );
      })}

      {/* X ticks */}
      {xTicks.map(t => {
        const tx = toX(t);
        return (
          <g key={t}>
            <line x1={tx.toFixed(1)} y1={PT} x2={tx.toFixed(1)} y2={(H - PB).toFixed(1)}
              stroke="#f3f4f6" strokeWidth="1" />
            <text x={tx.toFixed(1)} y={(H - PB + 12).toFixed(1)} fontSize="8.5" fill="#9ca3af" textAnchor="middle">
              {t}
            </text>
          </g>
        );
      })}

      {/* Zero line */}
      <line x1={PL} y1={zeroY.toFixed(1)} x2={(W - PR).toFixed(1)} y2={zeroY.toFixed(1)}
        stroke="#004d40" strokeWidth="1.5" strokeDasharray="5,3" />

      {/* Series lines */}
      {seriesList.map((series, i) => {
        const color = CHART_COLORS[i];
        const isWinner = alternatives[i].overallRank === 1;
        const pts = series.map(p => `${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`).join(" ");
        return (
          <g key={i}>
            <polyline points={pts} fill="none" stroke={color}
              strokeWidth={isWinner ? "2.5" : "1.8"} strokeLinejoin="round" strokeLinecap="round"
              opacity={isWinner ? "1" : "0.7"} />
            {/* Dots at each year */}
            {series.map((p, pi) => (
              <circle key={pi} cx={toX(p.x).toFixed(1)} cy={toY(p.y).toFixed(1)}
                r={isWinner ? "3.5" : "2.5"} fill={color} opacity={isWinner ? "1" : "0.8"} />
            ))}
          </g>
        );
      })}

      {/* Legend */}
      {alternatives.map((alt, i) => (
        <g key={i} transform={`translate(${PL + i * Math.floor(CW / alternatives.length)}, ${H - 16})`}>
          <line x1="0" y1="0" x2="16" y2="0" stroke={CHART_COLORS[i]} strokeWidth="2.5" />
          <circle cx="8" cy="0" r="3" fill={CHART_COLORS[i]} />
          <text x="20" y="4" fontSize="8.5" fill="#374151" fontWeight={alternatives[i].overallRank === 1 ? "700" : "400"}>
            {alt.input.name.length > 20 ? alt.input.name.slice(0, 18) + "…" : alt.input.name}
          </text>
        </g>
      ))}

      {/* Chart title */}
      <text x={W / 2} y="16" fontSize="11" fill="#004d40" textAnchor="middle" fontWeight="700">
        Flux de Trésorerie Actualisés Cumulés (DA)
      </text>
      <text x={(PL + CW / 2).toFixed(0)} y={(H - PB + 26).toFixed(1)} fontSize="9" fill="#9ca3af" textAnchor="middle">
        Années
      </text>
    </svg>
  );
}

// ── Comparison Table ───────────────────────────────────────────────────────────
function ComparisonTable({ result }: { result: ComparisonResult }) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { alternatives, unequalDurations, primaryCriterion, discountRate } = result;

  type RowDef = {
    label: string; labelAr: string; isPrimary?: boolean;
    getValue: (a: typeof alternatives[0]) => string;
    getColor: (a: typeof alternatives[0]) => string;
    getRank: (a: typeof alternatives[0]) => number;
  };

  const rows: RowDef[] = [
    {
      label: `${!unequalDurations ? "★ " : ""}VAN (NPV)`,
      labelAr: `${!unequalDurations ? "★ " : ""}NPV (القيمة الحالية الصافية)`,
      isPrimary: !unequalDurations,
      getValue: a => fmtDA(a.appraisal.npv),
      getColor: a => a.appraisal.npv > 0 ? "text-green-700" : "text-destructive",
      getRank: a => a.rankNPV,
    },
    ...(unequalDurations ? [{
      label: "★ EAA — Rente Équivalente Annuelle",
      labelAr: "★ EAA — الرنتا السنوية المكافئة",
      isPrimary: true,
      getValue: (a: typeof alternatives[0]) => a.eaa !== null ? `${fmtDA(a.eaa)}/an` : "—",
      getColor: (a: typeof alternatives[0]) => a.eaa !== null && a.eaa > 0 ? "text-green-700" : "text-destructive",
      getRank: (a: typeof alternatives[0]) => a.rankEAA,
    }] : []),
    {
      label: "TRI (IRR)", labelAr: "معدل العائد الداخلي (IRR)",
      getValue: a => a.appraisal.irr !== null ? fmtPct(a.appraisal.irr, 2) : "—",
      getColor: a => a.appraisal.irr !== null && a.appraisal.irr >= discountRate ? "text-green-700" : "text-amber-600",
      getRank: a => a.rankIRR,
    },
    {
      label: "Indice de Rentabilité (IP)", labelAr: "مؤشر الربحية (IP)",
      getValue: a => fmtN(a.appraisal.profitabilityIndex, 3),
      getColor: a => a.appraisal.profitabilityIndex >= 1 ? "text-green-700" : "text-destructive",
      getRank: a => a.rankPI,
    },
    {
      label: "Récupération actualisée", labelAr: "فترة الاسترداد المخصومة",
      getValue: a => a.appraisal.discountedPayback !== null
        ? fmtYears(a.appraisal.discountedPayback, isAr ? "ar" : "fr")
        : t("> durée", "> المدة"),
      getColor: a => a.appraisal.discountedPayback !== null && a.appraisal.discountedPayback < a.input.duration
        ? "text-green-700" : "text-amber-600",
      getRank: a => a.rankPayback,
    },
    {
      label: "Récupération simple", labelAr: "فترة الاسترداد البسيطة",
      getValue: a => a.appraisal.simplePayback !== null
        ? fmtYears(a.appraisal.simplePayback, isAr ? "ar" : "fr")
        : t("—", "—"),
      getColor: () => "text-foreground",
      getRank: () => 0,
    },
    {
      label: "Investissement (I₀)", labelAr: "الاستثمار الأولي (I₀)",
      getValue: a => fmtDA(a.appraisal.input.initialInvestment),
      getColor: () => "text-foreground",
      getRank: () => 0,
    },
    {
      label: "Durée du projet", labelAr: "مدة المشروع",
      getValue: a => `${a.input.duration} ${t("ans","سنوات")}`,
      getColor: () => "text-foreground",
      getRank: () => 0,
    },
    {
      label: "Classement final", labelAr: "الترتيب النهائي",
      getValue: a => medalOf(a.overallRank),
      getColor: a => a.overallRank === 1 ? "text-amber-600 font-extrabold" : "text-foreground",
      getRank: () => 0,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm min-w-[480px]">
        <thead>
          <tr className="bg-primary text-primary-foreground">
            <th className="px-3 py-2 text-start text-xs font-semibold sticky left-0 bg-primary">
              {t("Indicateur", "المؤشر")}
            </th>
            {alternatives.map((alt, i) => (
              <th key={i}
                className={cn("px-3 py-2 text-center text-xs font-semibold min-w-[140px]",
                  alt.overallRank === 1 && "bg-amber-600"
                )}>
                <div className="text-base">{medalOf(alt.overallRank)}</div>
                <div className="font-bold leading-tight">{alt.input.name}</div>
                <div className="text-[10px] opacity-70 mt-0.5">
                  {fmtDA(alt.input.initialInvestment)} · {alt.input.duration} {t("ans","سنوات")}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}
              className={cn(
                "border-b border-border",
                row.isPrimary ? "bg-primary/5" : ri % 2 === 0 ? "bg-background" : "bg-muted/20"
              )}>
              <td className={cn(
                "px-3 py-2 sticky left-0 text-xs",
                row.isPrimary ? "bg-primary/5 font-bold text-primary" : ri % 2 === 0 ? "bg-background" : "bg-muted/20"
              )}>
                {isAr ? row.labelAr : row.label}
              </td>
              {alternatives.map((alt, ci) => {
                const rank = row.getRank(alt);
                return (
                  <td key={ci}
                    className={cn(
                      "px-3 py-2 text-center font-mono font-semibold text-sm",
                      row.getColor(alt),
                      alt.overallRank === 1 && row.isPrimary && "font-extrabold bg-amber-50"
                    )}>
                    {row.getValue(alt)}
                    {rank > 0 && (
                      <span className="ms-1 text-[10px] text-muted-foreground">
                        {medalOf(rank)}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {unequalDurations && (
        <p className="text-xs text-muted-foreground mt-2 italic">
          {t(
            "★ EAA = Rente Équivalente Annuelle. Critère principal quand les durées diffèrent. EAA = NPV × r / (1 − (1+r)^−n).",
            "★ EAA = المعادل السنوي للقيمة الحالية. المعيار الرئيسي عند اختلاف المدد. EAA = NPV × r / (1 − (1+r)^−n)."
          )}
        </p>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function InvestmentComparison() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const resultsRef = useRef<HTMLDivElement>(null);

  const [selectedSector, setSelectedSector] = useState<SectorKey | null>(null);
  const [projectTitle,   setProjectTitle]   = useState("");
  const [discountRate,   setDiscountRate]   = useState("");
  const [alts,           setAlts]           = useState<AlternativeFormState[]>(DEFAULT_BLANK_ALTS());
  const [result,         setResult]         = useState<ComparisonResult | null>(null);
  const [error,          setError]          = useState<string | null>(null);

  // ── Template application ────────────────────────────────────────────────────
  function applyTemplate(tpl: SectorTemplate) {
    setSelectedSector(tpl.id);
    setError(null);
    setResult(null);
    setDiscountRate(String(tpl.discountRate));
    if (tpl.alts.length === 0) {
      setProjectTitle("");
      setAlts(DEFAULT_BLANK_ALTS());
    } else {
      setProjectTitle(isAr
        ? `${tpl.nameAr} — مقارنة البدائل`
        : `${tpl.nameFr} — Comparaison des alternatives`
      );
      setAlts(tpl.alts.map(a => ({
        name:              isAr ? a.nameAr : a.name,
        initialInvestment: String(a.initialInvestment),
        duration:          String(a.duration),
        cashFlows:         a.cashFlows.map(String),
        salvageValue:      a.salvageValue !== undefined ? String(a.salvageValue) : "",
      })));
    }
  }

  // ── Alternative management ──────────────────────────────────────────────────
  function updateAlt(idx: number, field: keyof AlternativeFormState, value: string | string[]) {
    setAlts(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function updateDuration(idx: number, val: string) {
    const n = parseInt(val, 10);
    setAlts(prev => {
      const next = [...prev];
      const old  = next[idx];
      let cfs    = [...old.cashFlows];
      if (isFinite(n) && n >= 1 && n <= 30) {
        if (cfs.length < n) cfs = [...cfs, ...Array(n - cfs.length).fill("")];
        else cfs = cfs.slice(0, n);
      }
      next[idx] = { ...old, duration: val, cashFlows: cfs };
      return next;
    });
  }

  function addAlternative() {
    if (alts.length >= 5) return;
    setAlts(prev => [...prev, emptyAlt()]);
  }

  function removeAlternative(idx: number) {
    if (alts.length <= 2) return;
    setAlts(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Calculate ───────────────────────────────────────────────────────────────
  function handleCalculate() {
    setError(null);
    const rate = parsePosNum(discountRate);
    if (rate === undefined) {
      setError(t("Taux d'actualisation requis (≥ 0).", "معدل الخصم مطلوب (≥ 0).")); return;
    }

    const parsed: AlternativeInput[] = [];
    for (let i = 0; i < alts.length; i++) {
      const a = alts[i];
      if (!a.name.trim()) {
        setError(t(`Nommez l'alternative ${i + 1}.`, `اسم البديل ${i + 1} مطلوب.`)); return;
      }
      const I0 = parseNum(a.initialInvestment);
      if (I0 === undefined || I0 <= 0) {
        setError(t(`Alternative ${i + 1} : investissement initial invalide (> 0).`, `البديل ${i + 1}: الاستثمار الأولي غير صالح (> 0).`)); return;
      }
      const n = parseInt(a.duration, 10);
      if (!isFinite(n) || n < 1 || n > 30) {
        setError(t(`Alternative ${i + 1} : durée entre 1 et 30 ans.`, `البديل ${i + 1}: المدة بين 1 و30 سنة.`)); return;
      }
      if (a.cashFlows.length < n) {
        setError(t(`Alternative ${i + 1} : flux de trésorerie incomplets.`, `البديل ${i + 1}: التدفقات النقدية غير مكتملة.`)); return;
      }
      const cashFlows: number[] = [];
      for (let y = 0; y < n; y++) {
        const cf = parseNum(a.cashFlows[y]);
        if (cf === undefined) {
          setError(t(`Alternative ${i + 1}, Année ${y + 1} : flux invalide.`, `البديل ${i + 1}، السنة ${y + 1}: تدفق غير صالح.`)); return;
        }
        cashFlows.push(cf);
      }
      parsed.push({
        name: a.name,
        initialInvestment: I0, duration: n,
        cashFlows,
        salvageValue: parsePosNum(a.salvageValue),
      });
    }

    try {
      const r = computeComparison({ alternatives: parsed, discountRate: rate });
      setResult(r);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (e) {
      setError(String(e));
    }
  }

  function handleReset() {
    setSelectedSector(null); setResult(null); setError(null);
    setProjectTitle(""); setDiscountRate(""); setAlts(DEFAULT_BLANK_ALTS());
  }

  return (
    <div className={cn("container mx-auto px-4 py-8 max-w-5xl space-y-8", isAr ? "rtl" : "ltr")}
      dir={isAr ? "rtl" : "ltr"}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <GitCompare className="w-6 h-6 text-primary" />
            {t("Comparaison des Alternatives d'Investissement", "مقارنة البدائل الاستثمارية")}
          </h1>
          <Badge className="bg-primary/10 text-primary border-primary/30 font-semibold text-xs">
            {t("VAN · EAA · TRI · IP", "NPV · EAA · IRR · IP")}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm max-w-2xl">
          {t(
            "Comparez 2 à 5 alternatives d'investissement côte à côte sur tous les indicateurs clés. Si les durées diffèrent, la Rente Équivalente Annuelle (EAA) est calculée pour une comparaison équitable.",
            "قارن من 2 إلى 5 بدائل استثمارية جنباً إلى جنب على جميع المؤشرات الرئيسية. إذا اختلفت المدد، يُحسب المعادل السنوي (EAA) لمقارنة عادلة."
          )}
        </p>
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground/70 italic">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{t(
            "Les calculs VAN/TRI/IP réutilisent le même moteur que l'Évaluation de Rentabilité. L'EAA est calculée uniquement quand les durées diffèrent.",
            "حسابات NPV/IRR/IP تستعيد نفس المحرك من أداة تقييم الجدوى. يُحسب EAA فقط عند اختلاف المدد."
          )}</span>
        </div>
      </div>

      {/* ── Sector Selection ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("Secteur d'activité", "قطاع النشاط")}</CardTitle>
          <CardDescription>
            {t(
              "Sélectionnez un exemple pour préremplir les données, ou choisissez Personnalisé.",
              "اختر نموذجاً لملء البيانات مسبقاً، أو اختر مخصص لإدخال بياناتك الخاصة."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {TEMPLATES.map(tpl => {
              const Icon = tpl.icon;
              const sel = selectedSector === tpl.id;
              return (
                <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                  className={cn(
                    "group relative rounded-xl border-2 p-4 text-left transition-all duration-200 hover:shadow-md",
                    sel ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50",
                    tpl.id === "custom" && !sel && "border-dashed"
                  )}>
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 transition-colors",
                    sel ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <p className={cn("font-semibold text-sm", sel ? "text-primary" : "text-foreground")}>
                    {isAr ? tpl.nameAr : tpl.nameFr}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-3">
                    {isAr ? tpl.descAr : tpl.descFr}
                  </p>
                  {sel && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Shared Parameters ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            {t("Paramètres communs", "المعايير المشتركة")}
          </CardTitle>
          <CardDescription>
            {t(
              "Un seul taux d'actualisation est appliqué à toutes les alternatives pour garantir une comparaison équitable.",
              "يُطبَّق معدل خصم واحد على جميع البدائل لضمان مقارنة عادلة."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div className="space-y-1.5">
              <Label>{t("Titre de la comparaison", "عنوان المقارنة")}</Label>
              <Input value={projectTitle} onChange={e => setProjectTitle(e.target.value)}
                placeholder={t("Ex: Choix machine CNC — Batna", "مثال: اختيار آلة CNC — باتنة")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Taux d'actualisation commun (%) *", "معدل الخصم المشترك (%) *")}</Label>
              <Input type="number" min="0" max="200" step="0.1"
                value={discountRate} onChange={e => setDiscountRate(e.target.value)}
                placeholder={t("ex: 12", "مثال: 12")} />
              <p className="text-xs text-muted-foreground">
                {t("Coût du capital ou rendement minimum exigé", "تكلفة رأس المال أو الحد الأدنى للعائد المطلوب")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Alternatives Input ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-primary" />
                {t(`Alternatives à comparer (${alts.length})`, `البدائل المُقارَنة (${alts.length})`)}
              </CardTitle>
              <CardDescription className="mt-0.5">
                {t(
                  "Minimum 2, maximum 5. Saisissez un nom, l'investissement, la durée et les flux annuels pour chaque alternative.",
                  "الحد الأدنى 2، الأقصى 5. أدخل اسماً والاستثمار والمدة والتدفقات السنوية لكل بديل."
                )}
              </CardDescription>
            </div>
            {alts.length < 5 && (
              <Button onClick={addAlternative} variant="outline" size="sm">
                <Plus className="w-4 h-4 me-1.5" />
                {t("Ajouter une alternative", "إضافة بديل")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {alts.map((alt, idx) => {
            const color = CHART_COLORS[idx % CHART_COLORS.length];
            const colorLight = CHART_COLORS_LIGHT[idx % CHART_COLORS_LIGHT.length];
            const n = parseInt(alt.duration, 10);

            return (
              <div key={idx} className="rounded-xl border-2 p-5 space-y-4"
                style={{ borderColor: color + "60", background: colorLight + "80" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ background: color }} />
                    <span className="font-bold text-sm" style={{ color }}>
                      {t(`Alternative ${idx + 1}`, `البديل ${idx + 1}`)}
                    </span>
                  </div>
                  {alts.length > 2 && (
                    <Button variant="ghost" size="sm" onClick={() => removeAlternative(idx)}
                      className="text-destructive hover:text-destructive h-7 px-2">
                      <Trash2 className="w-3.5 h-3.5 me-1" />
                      {t("Supprimer", "حذف")}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1 sm:col-span-2 md:col-span-1">
                    <Label className="text-xs">{t("Nom / Label *", "الاسم *")}</Label>
                    <Input value={alt.name} onChange={e => updateAlt(idx, "name", e.target.value)}
                      placeholder={t(`Alternative ${idx + 1}`, `البديل ${idx + 1}`)}
                      className="bg-white" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("Investissement I₀ (DA) *", "الاستثمار I₀ (DA) *")}</Label>
                    <Input type="number" min="0" step="any"
                      value={alt.initialInvestment}
                      onChange={e => updateAlt(idx, "initialInvestment", e.target.value)}
                      placeholder="ex: 5000000" className="bg-white" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("Durée (années) *", "المدة (سنوات) *")}</Label>
                    <Input type="number" min="1" max="30" step="1"
                      value={alt.duration} onChange={e => updateDuration(idx, e.target.value)}
                      placeholder="ex: 7" className="bg-white" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("Valeur résiduelle (optionnel)", "القيمة المتبقية (اختياري)")}</Label>
                    <Input type="number" min="0" step="any"
                      value={alt.salvageValue}
                      onChange={e => updateAlt(idx, "salvageValue", e.target.value)}
                      placeholder="ex: 500000" className="bg-white" />
                  </div>
                </div>

                {isFinite(n) && n >= 1 && alt.cashFlows.length === n && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t(`Flux de trésorerie annuels (DA) — ${n} année${n > 1 ? "s" : ""} *`,
                         `التدفقات النقدية السنوية (DA) — ${n} ${n === 1 ? "سنة" : "سنوات"} *`)}
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                      {alt.cashFlows.map((cf, yi) => (
                        <div key={yi} className="space-y-0.5">
                          <Label className="text-[10px] text-muted-foreground">
                            {t(`An ${yi + 1}`, `S${yi + 1}`)}
                          </Label>
                          <Input type="number" step="any" value={cf}
                            onChange={e => {
                              const next = [...alt.cashFlows];
                              next[yi] = e.target.value;
                              updateAlt(idx, "cashFlows", next);
                            }}
                            placeholder="0" className="text-xs h-8 bg-white px-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isFinite(n) && n >= 1 && alt.cashFlows.length < n && (
                  <p className="text-xs text-muted-foreground italic">
                    {t("Entrez la durée pour afficher les champs de flux.", "أدخل المدة لعرض حقول التدفقات.")}
                  </p>
                )}
              </div>
            );
          })}

          {/* EAA notice if durations differ */}
          {alts.length >= 2 && (() => {
            const durations = alts.map(a => parseInt(a.duration, 10)).filter(isFinite);
            const hasUnequal = durations.length >= 2 && new Set(durations).size > 1;
            return hasUnequal ? (
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                <span>
                  {t(
                    "⚠️ Les durées diffèrent entre les alternatives. La Rente Équivalente Annuelle (EAA) sera calculée et utilisée comme critère de décision principal pour garantir une comparaison équitable.",
                    "⚠️ تختلف مدد البدائل. سيُحسب المعادل السنوي (EAA) ويُستخدم كمعيار رئيسي للقرار لضمان مقارنة عادلة."
                  )}
                </span>
              </div>
            ) : null;
          })()}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 flex-wrap pt-1">
            <Button onClick={handleCalculate} className="min-w-[240px]">
              <GitCompare className="w-4 h-4 me-2" />
              {t("Comparer les alternatives", "مقارنة البدائل")}
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
            {t("Résultats de la comparaison ci-dessous", "نتائج المقارنة أدناه")}
          </div>

          {/* Winner summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: t("Recommandation", "التوصية"),
                value: result.winner.input.name,
                sub: t("🏆 Alternative retenue", "🏆 البديل المُختار"),
                color: "bg-amber-500 text-white",
              },
              {
                label: result.primaryCriterion === "eaa"
                  ? t("EAA (critère principal)", "EAA (المعيار الرئيسي)")
                  : t("VAN (critère principal)", "NPV (المعيار الرئيسي)"),
                value: result.primaryCriterion === "eaa" && result.winner.eaa !== null
                  ? `${fmtDA(result.winner.eaa)}/an`
                  : fmtDA(result.winner.appraisal.npv),
                sub: result.winner.appraisal.npv > 0 ? t("✅ Rentable", "✅ مربح") : t("⚠️ Vérifier", "⚠️ مراجعة"),
                color: result.winner.appraisal.npv > 0 ? "bg-green-600 text-white" : "bg-amber-500 text-white",
              },
              {
                label: t("TRI du gagnant", "IRR للبديل الفائز"),
                value: result.winner.appraisal.irr !== null ? fmtPct(result.winner.appraisal.irr, 1) : "—",
                sub: result.winner.appraisal.irr !== null && result.winner.appraisal.irr >= result.discountRate
                  ? t("✅ > taux requis", "✅ > المعدل المطلوب") : t("⚠️ < taux requis", "⚠️ < المعدل المطلوب"),
                color: "bg-primary text-primary-foreground",
              },
              {
                label: t("Conflits de classement", "تعارض في الترتيب"),
                value: result.hasRankingConflicts
                  ? t(`${result.conflictDetails.length} conflit(s)`, `${result.conflictDetails.length} تعارض`)
                  : t("Aucun ✅", "لا يوجد ✅"),
                sub: result.hasRankingConflicts
                  ? t("Voir l'analyse", "انظر التحليل")
                  : t("Convergence totale", "تقاطع كامل"),
                color: result.hasRankingConflicts ? "bg-amber-500 text-white" : "bg-secondary text-secondary-foreground",
              },
            ].map(kpi => (
              <div key={kpi.label} className={cn("rounded-xl p-4 space-y-1", kpi.color)}>
                <p className="text-xs opacity-80 leading-tight">{kpi.label}</p>
                <p className="text-sm font-extrabold leading-tight truncate">{kpi.value}</p>
                <p className="text-xs opacity-75 leading-tight">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Comparison Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t("Tableau comparatif des indicateurs", "جدول مقارنة المؤشرات")}
              </CardTitle>
              {result.unequalDurations && (
                <CardDescription>
                  {t(
                    "★ Durées inégales → l'EAA est le critère principal. Elle convertit la VAN en équivalent annuel pour permettre une comparaison équitable.",
                    "★ مدد مختلفة → EAA هو المعيار الرئيسي. يُحوّل NPV إلى معادل سنوي لضمان مقارنة عادلة."
                  )}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <ComparisonTable result={result} />
            </CardContent>
          </Card>

          {/* Ranking conflict banner */}
          {result.hasRankingConflicts && (
            <div className="flex items-start gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 px-5 py-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="font-bold text-sm text-amber-900">
                  {t("Conflits de classement entre indicateurs", "تعارض في الترتيب بين المؤشرات")}
                </p>
                <div className="space-y-1">
                  {result.conflictDetails.map((d, i) => (
                    <p key={i} className="text-sm text-amber-800">
                      {t(
                        `• "${d.altName}" est 1er selon ${result.primaryCriterion.toUpperCase()} mais ${d.rank}${d.rank === 2 ? "ème" : "ème"} selon ${d.criterion} — 1er sur ce critère : "${d.vs}".`,
                        `• "${d.altName}" الأول وفق ${result.primaryCriterion.toUpperCase()} لكن المرتبة ${d.rank} وفق ${d.criterion} — الأول: "${d.vs}".`
                      )}
                    </p>
                  ))}
                </div>
                <p className="text-xs text-amber-700 italic">
                  {t(
                    `La VAN${result.unequalDurations ? "/EAA" : ""} reste le critère de référence : elle mesure la richesse créée en valeur absolue. L'IRR est un taux, non une mesure de valeur.`,
                    `NPV${result.unequalDurations ? "/EAA" : ""} يبقى المعيار المرجعي: يقيس الثروة المُنشأة بقيمة مطلقة. IRR هو معدل وليس قياساً للقيمة.`
                  )}
                </p>
              </div>
            </div>
          )}

          {/* NPV Bar Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                {result.primaryCriterion === "eaa"
                  ? t("Classement par EAA — Rente Équivalente Annuelle", "الترتيب حسب EAA — المعادل السنوي")
                  : t("Classement par VAN — Valeur Actuelle Nette", "الترتيب حسب NPV — القيمة الحالية الصافية")}
              </CardTitle>
              <CardDescription>
                {t("La barre la plus haute = la meilleure alternative selon le critère principal.", "أطول شريط = أفضل بديل وفق المعيار الرئيسي.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-lg border border-border bg-white p-3">
                <NPVBarChart result={result} />
              </div>
            </CardContent>
          </Card>

          {/* Cumulative DCF Line Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                {t("Évolution des Flux Actualisés Cumulés", "تطور التدفقات المخصومة التراكمية")}
              </CardTitle>
              <CardDescription>
                {t(
                  "Chaque ligne montre la progression vers la rentabilité. Le croisement de la ligne zéro marque le délai de récupération actualisé.",
                  "كل خط يُظهر التقدم نحو الربحية. عبور خط الصفر يُمثّل فترة الاسترداد المخصومة."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-lg border border-border bg-white p-3">
                <CumulativeDCFChart result={result} />
              </div>
            </CardContent>
          </Card>

          {/* Report + Analysis */}
          <InvestmentComparisonReport
            result={result}
            projectTitle={projectTitle}
            sector={selectedSector}
          />
        </div>
      )}
    </div>
  );
}
