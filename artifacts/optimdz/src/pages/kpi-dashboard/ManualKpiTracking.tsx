import { useState, useRef } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import {
  computeKpiTracking, fmtDA, fmtPct, fmtPctAbs,
  COLOR_REVENUE, COLOR_COSTS, COLOR_PROFIT, COLOR_MARGIN, COLOR_TARGET,
} from "@/lib/kpiTrackingAlgorithm";
import type { KpiTrackingResult, PeriodInput } from "@/lib/kpiTrackingAlgorithm";
import { KpiTrackingReport } from "./KpiTrackingReport";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Plus, Trash2, Calculator, ShoppingBag, Factory, Leaf, Monitor,
  PencilRuler, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Info,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
type SectorKey = "trade" | "industry" | "agriculture" | "services" | "custom";

interface PeriodFormState {
  label: string;
  revenue: string;
  totalCosts: string;
  profitOverride: string;
  unitsSold: string;
  numCustomers: string;
  marketingSpend: string;
  newCustomers: string;
  targetRevenue: string;
  targetProfit: string;
  showOptional: boolean;
}

// ── Sector templates ───────────────────────────────────────────────────────────
interface SectorTemplate {
  id: SectorKey;
  icon: React.ElementType;
  nameFr: string; nameAr: string;
  descFr: string; descAr: string;
  periodType: "monthly" | "quarterly";
  businessNameFr: string; businessNameAr: string;
  periods: Omit<PeriodFormState, "showOptional">[];
}

const TEMPLATES: SectorTemplate[] = [
  {
    id: "trade", icon: ShoppingBag,
    nameFr: "Commerce", nameAr: "التجارة",
    descFr: "Épicerie de proximité — Oran : 6 mois avec pic estival et cible de CA",
    descAr: "بقالة قريبة — وهران: 6 أشهر مع ذروة صيفية وهدف CA",
    periodType: "monthly",
    businessNameFr: "Épicerie Boualem — Oran",
    businessNameAr: "بقالة بوعلام — وهران",
    periods: [
      { label: "Jan 2024", revenue: "850000", totalCosts: "680000", profitOverride: "", unitsSold: "12000", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "950000", targetProfit: "200000" },
      { label: "Fév 2024", revenue: "920000", totalCosts: "720000", profitOverride: "", unitsSold: "13500", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "950000", targetProfit: "200000" },
      { label: "Mar 2024", revenue: "880000", totalCosts: "750000", profitOverride: "", unitsSold: "12800", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "950000", targetProfit: "200000" },
      { label: "Avr 2024", revenue: "1050000", totalCosts: "790000", profitOverride: "", unitsSold: "15500", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "1000000", targetProfit: "220000" },
      { label: "Mai 2024", revenue: "1100000", totalCosts: "850000", profitOverride: "", unitsSold: "16200", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "1000000", targetProfit: "220000" },
      { label: "Juin 2024", revenue: "980000", totalCosts: "810000", profitOverride: "", unitsSold: "14500", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "1000000", targetProfit: "220000" },
    ],
  },
  {
    id: "industry", icon: Factory,
    nameFr: "Industrie", nameAr: "الصناعة",
    descFr: "Atelier de soudure — Annaba : 4 trimestres, hausse des charges en T3–T4",
    descAr: "ورشة لحام — عنابة: 4 أرباع، ارتفاع الأعباء في الربعين الثالث والرابع",
    periodType: "quarterly",
    businessNameFr: "Atelier Soudure Samir — Annaba",
    businessNameAr: "ورشة لحام سمير — عنابة",
    periods: [
      { label: "T1 2024", revenue: "3200000", totalCosts: "2400000", profitOverride: "", unitsSold: "160", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "3000000", targetProfit: "700000" },
      { label: "T2 2024", revenue: "3800000", totalCosts: "2750000", profitOverride: "", unitsSold: "190", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "3500000", targetProfit: "800000" },
      { label: "T3 2024", revenue: "3500000", totalCosts: "2900000", profitOverride: "", unitsSold: "175", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "3500000", targetProfit: "700000" },
      { label: "T4 2024", revenue: "4100000", totalCosts: "3100000", profitOverride: "", unitsSold: "205", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "4000000", targetProfit: "900000" },
    ],
  },
  {
    id: "agriculture", icon: Leaf,
    nameFr: "Agriculture", nameAr: "الفلاحة",
    descFr: "Maraîcher — Mostaganem : 6 mois de saison avec montée puis descente saisonnière",
    descAr: "مزارع خضروات — مستغانم: 6 أشهر موسمية بارتفاع ثم انخفاض",
    periodType: "monthly",
    businessNameFr: "Exploitation Maraîchère Benali — Mostaganem",
    businessNameAr: "استغلال فلاحي بن علي — مستغانم",
    periods: [
      { label: "Jan 2024", revenue: "480000", totalCosts: "280000", profitOverride: "", unitsSold: "9600", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "", targetProfit: "" },
      { label: "Fév 2024", revenue: "620000", totalCosts: "330000", profitOverride: "", unitsSold: "12400", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "", targetProfit: "" },
      { label: "Mar 2024", revenue: "890000", totalCosts: "400000", profitOverride: "", unitsSold: "17800", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "", targetProfit: "" },
      { label: "Avr 2024", revenue: "1150000", totalCosts: "430000", profitOverride: "", unitsSold: "23000", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "", targetProfit: "" },
      { label: "Mai 2024", revenue: "950000", totalCosts: "390000", profitOverride: "", unitsSold: "19000", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "", targetProfit: "" },
      { label: "Juin 2024", revenue: "720000", totalCosts: "310000", profitOverride: "", unitsSold: "14400", numCustomers: "", marketingSpend: "", newCustomers: "", targetRevenue: "", targetProfit: "" },
    ],
  },
  {
    id: "services", icon: Monitor,
    nameFr: "Services", nameAr: "الخدمات",
    descFr: "Cabinet de conseil RH — Alger : 5 trimestres avec suivi clientèle, marketing et objectifs",
    descAr: "مكتب استشاري HR — الجزائر: 5 أرباع مع متابعة العملاء والتسويق والأهداف",
    periodType: "quarterly",
    businessNameFr: "Cabinet Conseil RH Tafat — Alger",
    businessNameAr: "مكتب استشاري HR تافات — الجزائر",
    periods: [
      { label: "T1 2024", revenue: "1500000", totalCosts: "900000", profitOverride: "", unitsSold: "", numCustomers: "28", marketingSpend: "80000", newCustomers: "6", targetRevenue: "1800000", targetProfit: "700000" },
      { label: "T2 2024", revenue: "1850000", totalCosts: "1050000", profitOverride: "", unitsSold: "", numCustomers: "34", marketingSpend: "95000", newCustomers: "8", targetRevenue: "1800000", targetProfit: "750000" },
      { label: "T3 2024", revenue: "1700000", totalCosts: "1100000", profitOverride: "", unitsSold: "", numCustomers: "31", marketingSpend: "85000", newCustomers: "5", targetRevenue: "1800000", targetProfit: "750000" },
      { label: "T4 2024", revenue: "2200000", totalCosts: "1250000", profitOverride: "", unitsSold: "", numCustomers: "40", marketingSpend: "110000", newCustomers: "10", targetRevenue: "2000000", targetProfit: "850000" },
      { label: "T1 2025", revenue: "2350000", totalCosts: "1350000", profitOverride: "", unitsSold: "", numCustomers: "44", marketingSpend: "120000", newCustomers: "9", targetRevenue: "2200000", targetProfit: "950000" },
    ],
  },
  {
    id: "custom", icon: PencilRuler,
    nameFr: "Personnalisé", nameAr: "مخصص",
    descFr: "Saisie libre — entrez vos propres périodes et métriques",
    descAr: "إدخال حر — أدخل فتراتك ومؤشراتك الخاصة",
    periodType: "monthly",
    businessNameFr: "", businessNameAr: "",
    periods: [],
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
function emptyPeriod(label = ""): PeriodFormState {
  return {
    label, revenue: "", totalCosts: "", profitOverride: "",
    unitsSold: "", numCustomers: "", marketingSpend: "", newCustomers: "",
    targetRevenue: "", targetProfit: "", showOptional: false,
  };
}

// ── SVG Chart: Revenue + Costs + Profit Line Chart ───────────────────────────
function RevenueCostsProfitChart({ result }: { result: KpiTrackingResult }) {
  const { periods } = result;
  const n = periods.length;
  const W = 580, H = 260, PL = 64, PR = 16, PT = 28, PB = 56;
  const CW = W - PL - PR, CH = H - PT - PB;

  const allVals = periods.flatMap(p => [p.revenue, p.totalCosts, p.netProfit]);
  const minV = Math.min(...allVals, 0);
  const maxV = Math.max(...allVals, 0);
  const span = (maxV - minV) || 1;

  const toX = (i: number) => PL + (n === 1 ? CW / 2 : (i / (n - 1)) * CW);
  const toY = (v: number) => PT + CH - ((v - minV) / span) * CH;
  const zeroY = toY(0);

  const ticks = 5;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minV + (span * i) / ticks);

  const series = [
    { vals: periods.map(p => p.revenue), color: COLOR_REVENUE, label: "CA" },
    { vals: periods.map(p => p.totalCosts), color: COLOR_COSTS, label: "Charges" },
    { vals: periods.map(p => p.netProfit), color: COLOR_PROFIT, label: "Bénéfice" },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-label="Revenue costs profit chart">
      {/* Y grid */}
      {yTicks.map((v, i) => {
        const ty = toY(v);
        const label = Math.abs(v) >= 1_000_000
          ? `${(v / 1_000_000).toFixed(1)}M`
          : Math.abs(v) >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : v.toFixed(0);
        return (
          <g key={i}>
            <line x1={PL} y1={ty.toFixed(1)} x2={W - PR} y2={ty.toFixed(1)}
              stroke={v === 0 ? "#004d40" : "#e5e7eb"}
              strokeWidth={v === 0 ? "1.5" : "1"}
              strokeDasharray={v === 0 ? "none" : "4,3"} />
            <text x={(PL - 4).toFixed(1)} y={(ty + 3).toFixed(1)}
              fontSize="8.5" fill="#9ca3af" textAnchor="end">{label}</text>
          </g>
        );
      })}

      {/* Zero line (if > 0 line) */}
      {minV < 0 && (
        <line x1={PL} y1={zeroY.toFixed(1)} x2={(W - PR).toFixed(1)} y2={zeroY.toFixed(1)}
          stroke="#004d40" strokeWidth="1.5" strokeDasharray="5,3" />
      )}

      {/* Series */}
      {series.map((s) => {
        const pts = s.vals.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
        return (
          <g key={s.label}>
            <polyline points={pts} fill="none" stroke={s.color}
              strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
            {s.vals.map((v, i) => (
              <circle key={i} cx={toX(i).toFixed(1)} cy={toY(v).toFixed(1)}
                r="3.5" fill={s.color} stroke="white" strokeWidth="1.5" />
            ))}
          </g>
        );
      })}

      {/* X axis labels */}
      {periods.map((p, i) => (
        <text key={i} x={toX(i).toFixed(1)} y={(H - PB + 14).toFixed(1)}
          fontSize="8.5" fill="#6b7280" textAnchor="middle"
          transform={n > 5 ? `rotate(-30, ${toX(i).toFixed(1)}, ${(H - PB + 14).toFixed(1)})` : undefined}>
          {p.label.length > 10 ? p.label.slice(0, 9) + "…" : p.label}
        </text>
      ))}

      {/* Legend */}
      {series.map((s, i) => (
        <g key={i} transform={`translate(${PL + i * Math.floor(CW / 3)}, ${H - 12})`}>
          <line x1="0" y1="0" x2="16" y2="0" stroke={s.color} strokeWidth="2.5" />
          <circle cx="8" cy="0" r="3" fill={s.color} />
          <text x="20" y="4" fontSize="9" fill="#374151" fontWeight="600">{s.label}</text>
        </g>
      ))}

      {/* Title */}
      <text x={W / 2} y="16" fontSize="11" fill="#004d40" textAnchor="middle" fontWeight="700">
        Chiffre d'Affaires · Charges · Bénéfice (DA)
      </text>
    </svg>
  );
}

// ── SVG Chart: Profit Margin % ────────────────────────────────────────────────
function ProfitMarginChart({ result }: { result: KpiTrackingResult }) {
  const { periods } = result;
  const n = periods.length;
  const W = 580, H = 200, PL = 48, PR = 16, PT = 28, PB = 46;
  const CW = W - PL - PR, CH = H - PT - PB;

  const vals = periods.map(p => p.profitMarginPct);
  const minV = Math.min(...vals, -5);
  const maxV = Math.max(...vals, 0, 5);
  const span = (maxV - minV) || 1;

  const toX = (i: number) => PL + (n === 1 ? CW / 2 : (i / (n - 1)) * CW);
  const toY = (v: number) => PT + CH - ((v - minV) / span) * CH;
  const zeroY = toY(0);

  const pts = vals.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const areaPath = `M ${toX(0).toFixed(1)},${zeroY.toFixed(1)} ` +
    vals.map((v, i) => `L ${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ") +
    ` L ${toX(n - 1).toFixed(1)},${zeroY.toFixed(1)} Z`;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minV + (span * i) / ticks);

  // Target lines if any periods have profit target
  const targetMargins = periods.map(p =>
    p.targetProfit !== undefined && p.revenue > 0
      ? (p.targetProfit / p.revenue) * 100
      : undefined
  );
  const hasTargetMargins = targetMargins.some(v => v !== undefined);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-label="Profit margin chart">
      {/* Y grid */}
      {yTicks.map((v, i) => {
        const ty = toY(v);
        return (
          <g key={i}>
            <line x1={PL} y1={ty.toFixed(1)} x2={W - PR} y2={ty.toFixed(1)}
              stroke={v === 0 ? "#004d40" : "#e5e7eb"}
              strokeWidth={v === 0 ? "1.5" : "1"}
              strokeDasharray={v === 0 ? "none" : "4,3"} />
            <text x={(PL - 4).toFixed(1)} y={(ty + 3).toFixed(1)}
              fontSize="8.5" fill="#9ca3af" textAnchor="end">{v.toFixed(1)}%</text>
          </g>
        );
      })}

      {/* Area under curve (green above zero, red below) */}
      <clipPath id="clip-above">
        <rect x={PL} y={PT} width={CW} height={(zeroY - PT).toFixed(1)} />
      </clipPath>
      <clipPath id="clip-below">
        <rect x={PL} y={zeroY.toFixed(1)} width={CW} height={(H - PB - zeroY + PT).toFixed(1)} />
      </clipPath>
      <path d={areaPath} fill={COLOR_MARGIN} opacity="0.15" clipPath="url(#clip-above)" />
      <path d={areaPath} fill={COLOR_COSTS}  opacity="0.15" clipPath="url(#clip-below)" />

      {/* Zero line */}
      <line x1={PL} y1={zeroY.toFixed(1)} x2={(W - PR).toFixed(1)} y2={zeroY.toFixed(1)}
        stroke="#004d40" strokeWidth="1.5" />

      {/* Target margin line (implied from target profit) */}
      {hasTargetMargins && (
        <polyline
          points={targetMargins
            .map((v, i) => v !== undefined ? `${toX(i).toFixed(1)},${toY(v).toFixed(1)}` : null)
            .filter(Boolean).join(" ")}
          fill="none" stroke={COLOR_TARGET} strokeWidth="1.5" strokeDasharray="6,3" opacity="0.7" />
      )}

      {/* Line */}
      <polyline points={pts} fill="none" stroke={COLOR_MARGIN}
        strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots with value labels */}
      {vals.map((v, i) => (
        <g key={i}>
          <circle cx={toX(i).toFixed(1)} cy={toY(v).toFixed(1)}
            r="4" fill={v >= 0 ? COLOR_MARGIN : COLOR_COSTS} stroke="white" strokeWidth="1.5" />
          <text x={toX(i).toFixed(1)} y={(toY(v) - 8).toFixed(1)}
            fontSize="8.5" fill={v >= 0 ? COLOR_MARGIN : COLOR_COSTS}
            textAnchor="middle" fontWeight="700">
            {v.toFixed(1)}%
          </text>
        </g>
      ))}

      {/* X axis labels */}
      {periods.map((p, i) => (
        <text key={i} x={toX(i).toFixed(1)} y={(H - PB + 14).toFixed(1)}
          fontSize="8.5" fill="#6b7280" textAnchor="middle"
          transform={n > 5 ? `rotate(-30, ${toX(i).toFixed(1)}, ${(H - PB + 14).toFixed(1)})` : undefined}>
          {p.label.length > 10 ? p.label.slice(0, 9) + "…" : p.label}
        </text>
      ))}

      {/* Legend */}
      <g transform={`translate(${PL}, ${H - 10})`}>
        <line x1="0" y1="0" x2="16" y2="0" stroke={COLOR_MARGIN} strokeWidth="2.5" />
        <circle cx="8" cy="0" r="3" fill={COLOR_MARGIN} />
        <text x="20" y="4" fontSize="9" fill="#374151" fontWeight="600">Marge bénéficiaire</text>
      </g>
      {hasTargetMargins && (
        <g transform={`translate(${PL + 160}, ${H - 10})`}>
          <line x1="0" y1="0" x2="16" y2="0" stroke={COLOR_TARGET}
            strokeWidth="1.5" strokeDasharray="6,3" />
          <text x="20" y="4" fontSize="9" fill="#374151" fontWeight="600">Marge cible (implicite)</text>
        </g>
      )}

      {/* Title */}
      <text x={W / 2} y="16" fontSize="11" fill="#004d40" textAnchor="middle" fontWeight="700">
        Marge Bénéficiaire (%)
      </text>
    </svg>
  );
}

// ── SVG Chart: Actual vs Target ───────────────────────────────────────────────
function ActualVsTargetChart({ result }: { result: KpiTrackingResult }) {
  const { periods } = result;
  const hasPeriods = periods.filter(p => p.targetRevenue !== undefined);
  if (hasPeriods.length === 0) return null;

  const n = hasPeriods.length;
  const W = 580, H = 240, PL = 64, PR = 16, PT = 28, PB = 56;
  const CW = W - PL - PR, CH = H - PT - PB;

  const allVals = hasPeriods.flatMap(p => [p.revenue, p.targetRevenue ?? 0]);
  const maxV = Math.max(...allVals, 0);
  const toY = (v: number) => PT + CH - (v / maxV) * CH;

  const groupW = CW / n;
  const barW   = Math.min(35, groupW * 0.38);

  const ticks = 5;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => (maxV * i) / ticks);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-label="Actual vs target chart">
      {/* Y grid */}
      {yTicks.map((v, i) => {
        const ty = toY(v);
        const label = v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
          : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : v.toFixed(0);
        return (
          <g key={i}>
            <line x1={PL} y1={ty.toFixed(1)} x2={W - PR} y2={ty.toFixed(1)}
              stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,3" />
            <text x={(PL - 4).toFixed(1)} y={(ty + 3).toFixed(1)}
              fontSize="8.5" fill="#9ca3af" textAnchor="end">{label}</text>
          </g>
        );
      })}

      {/* Bars */}
      {hasPeriods.map((p, i) => {
        const cx = PL + i * groupW + groupW / 2;
        const actualH = Math.max(2, CH - (toY(p.revenue) - PT));
        const targetH = p.targetRevenue ? Math.max(2, CH - (toY(p.targetRevenue) - PT)) : 0;
        const aboveTarget = p.revenueVsTargetPct !== undefined && p.revenueVsTargetPct >= 0;

        return (
          <g key={i}>
            {/* Target bar (behind) */}
            {p.targetRevenue !== undefined && (
              <rect x={(cx - barW - 2).toFixed(1)} y={toY(p.targetRevenue).toFixed(1)}
                width={barW.toFixed(1)} height={targetH.toFixed(1)}
                rx="3" fill={COLOR_TARGET} opacity="0.35" />
            )}
            {/* Actual bar */}
            <rect x={(cx + 2).toFixed(1)} y={toY(p.revenue).toFixed(1)}
              width={barW.toFixed(1)} height={actualH.toFixed(1)}
              rx="3" fill={aboveTarget ? COLOR_MARGIN : COLOR_COSTS} opacity="0.85" />

            {/* Variance label */}
            {p.revenueVsTargetPct !== undefined && (
              <text x={cx.toFixed(1)} y={(toY(p.revenue) - 5).toFixed(1)}
                fontSize="8" fill={aboveTarget ? COLOR_MARGIN : COLOR_COSTS}
                textAnchor="middle" fontWeight="700">
                {p.revenueVsTargetPct > 0 ? "+" : ""}{p.revenueVsTargetPct.toFixed(1)}%
              </text>
            )}

            {/* Period label */}
            <text x={cx.toFixed(1)} y={(H - PB + 14).toFixed(1)}
              fontSize="8.5" fill="#6b7280" textAnchor="middle"
              transform={n > 4 ? `rotate(-30, ${cx.toFixed(1)}, ${(H - PB + 14).toFixed(1)})` : undefined}>
              {p.label.length > 8 ? p.label.slice(0, 7) + "…" : p.label}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${PL}, ${H - 10})`}>
        <rect x="0" y="-6" width="14" height="9" rx="2" fill={COLOR_MARGIN} opacity="0.85" />
        <text x="18" y="4" fontSize="9" fill="#374151" fontWeight="600">CA réel</text>
      </g>
      <g transform={`translate(${PL + 80}, ${H - 10})`}>
        <rect x="0" y="-6" width="14" height="9" rx="2" fill={COLOR_TARGET} opacity="0.5" />
        <text x="18" y="4" fontSize="9" fill="#374151" fontWeight="600">Objectif CA</text>
      </g>

      {/* Title */}
      <text x={W / 2} y="16" fontSize="11" fill="#004d40" textAnchor="middle" fontWeight="700">
        Réalisé vs Objectif — Chiffre d'Affaires (DA)
      </text>
    </svg>
  );
}

// ── Growth Rate Table ─────────────────────────────────────────────────────────
function GrowthRateTable({ result }: { result: KpiTrackingResult }) {
  const { t } = useLanguage();
  const { periods } = result;
  const withGrowth = periods.slice(1);
  if (withGrowth.length === 0) return null;

  function cell(v: number | undefined) {
    if (v === undefined) return "—";
    const sign = v > 0 ? "+" : "";
    return `${sign}${v.toFixed(1)} %`;
  }
  function cellColor(v: number | undefined) {
    if (v === undefined) return "text-muted-foreground";
    if (v > 2) return "text-green-700 font-bold";
    if (v < -2) return "text-destructive font-bold";
    return "text-foreground";
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm min-w-[420px]">
        <thead>
          <tr className="bg-primary text-primary-foreground">
            <th className="px-3 py-2 text-start text-xs font-semibold">{t("Période", "الفترة")}</th>
            <th className="px-3 py-2 text-center text-xs font-semibold">Δ CA</th>
            <th className="px-3 py-2 text-center text-xs font-semibold">Δ Bénéfice</th>
            <th className="px-3 py-2 text-center text-xs font-semibold">Δ Unités</th>
            <th className="px-3 py-2 text-center text-xs font-semibold">Δ Charges</th>
          </tr>
        </thead>
        <tbody>
          {withGrowth.map((p, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
              <td className="px-3 py-2 text-xs font-medium">{p.label}</td>
              <td className={cn("px-3 py-2 text-center font-mono text-xs", cellColor(p.revenueGrowthPct))}>
                {cell(p.revenueGrowthPct)}
              </td>
              <td className={cn("px-3 py-2 text-center font-mono text-xs", cellColor(p.profitGrowthPct))}>
                {cell(p.profitGrowthPct)}
              </td>
              <td className={cn("px-3 py-2 text-center font-mono text-xs", cellColor(p.unitsGrowthPct))}>
                {cell(p.unitsGrowthPct)}
              </td>
              <td className={cn("px-3 py-2 text-center font-mono text-xs",
                // costs growing is bad — invert the color
                p.costsGrowthPct !== undefined && p.costsGrowthPct > 2
                  ? "text-destructive font-bold"
                  : p.costsGrowthPct !== undefined && p.costsGrowthPct < -2
                  ? "text-green-700 font-bold"
                  : "text-foreground"
              )}>
                {cell(p.costsGrowthPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground mt-1.5 italic">
        {t("Δ = variation par rapport à la période précédente. Vert = amélioration, Rouge = dégradation.",
           "Δ = التغير مقارنة بالفترة السابقة. أخضر = تحسن، أحمر = تراجع.")}
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ManualKpiTracking() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const resultsRef = useRef<HTMLDivElement>(null);

  const [selectedSector, setSelectedSector]   = useState<SectorKey | null>(null);
  const [businessName,   setBusinessName]     = useState("");
  const [periodType,     setPeriodType]       = useState<"monthly" | "quarterly">("monthly");
  const [periods,        setPeriods]          = useState<PeriodFormState[]>([emptyPeriod("Période 1"), emptyPeriod("Période 2")]);
  const [result,         setResult]           = useState<KpiTrackingResult | null>(null);
  const [error,          setError]            = useState<string | null>(null);
  const [showTargets,    setShowTargets]      = useState(false);

  // ── Template application ────────────────────────────────────────────────────
  function applyTemplate(tpl: SectorTemplate) {
    setSelectedSector(tpl.id);
    setResult(null);
    setError(null);
    setPeriodType(tpl.periodType);
    if (tpl.id === "custom") {
      setBusinessName("");
      setPeriods([emptyPeriod("Période 1"), emptyPeriod("Période 2")]);
      setShowTargets(false);
    } else {
      setBusinessName(isAr ? tpl.businessNameAr : tpl.businessNameFr);
      const hasTargets = tpl.periods.some(p => p.targetRevenue || p.targetProfit);
      setShowTargets(hasTargets);
      setPeriods(tpl.periods.map(p => ({ ...p, showOptional: !!(p.numCustomers || p.marketingSpend || p.unitsSold) })));
    }
  }

  // ── Period management ───────────────────────────────────────────────────────
  function addPeriod() {
    setPeriods(prev => {
      const idx = prev.length + 1;
      const label = periodType === "monthly"
        ? `Période ${idx}`
        : `T${((idx - 1) % 4) + 1} ${2024 + Math.floor((idx - 1) / 4)}`;
      return [...prev, emptyPeriod(label)];
    });
  }

  function removePeriod(idx: number) {
    if (periods.length <= 2) return;
    setPeriods(prev => prev.filter((_, i) => i !== idx));
  }

  function updatePeriod(idx: number, field: keyof PeriodFormState, value: string | boolean) {
    setPeriods(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  // ── Calculate ───────────────────────────────────────────────────────────────
  function handleCalculate() {
    setError(null);
    if (!businessName.trim()) {
      setError(t("Nom de l'entreprise requis.", "اسم المؤسسة مطلوب.")); return;
    }

    const parsed: PeriodInput[] = [];
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      if (!p.label.trim()) {
        setError(t(`Période ${i + 1} : libellé requis.`, `الفترة ${i + 1}: التسمية مطلوبة.`)); return;
      }
      const revenue = parseNum(p.revenue);
      if (revenue === undefined || revenue < 0) {
        setError(t(`Période "${p.label}" : CA invalide (≥ 0).`, `الفترة "${p.label}": رقم الأعمال غير صالح (≥ 0).`)); return;
      }
      const totalCosts = parseNum(p.totalCosts);
      if (totalCosts === undefined || totalCosts < 0) {
        setError(t(`Période "${p.label}" : Charges invalides (≥ 0).`, `الفترة "${p.label}": الأعباء غير صالحة (≥ 0).`)); return;
      }

      const profitOverride = parsePosNum(p.profitOverride) !== undefined || p.profitOverride.trim() === ""
        ? (p.profitOverride.trim() ? parseNum(p.profitOverride) : undefined)
        : undefined;

      parsed.push({
        label: p.label.trim(),
        revenue,
        totalCosts,
        profitOverride,
        unitsSold: parsePosNum(p.unitsSold),
        numCustomers: parsePosNum(p.numCustomers),
        marketingSpend: parsePosNum(p.marketingSpend),
        newCustomers: parsePosNum(p.newCustomers),
        targetRevenue: showTargets ? parsePosNum(p.targetRevenue) : undefined,
        targetProfit:  showTargets ? parseNum(p.targetProfit) : undefined,
      });
    }

    try {
      const r = computeKpiTracking({ businessName: businessName.trim(), periodType, periods: parsed });
      setResult(r);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (e) {
      setError(String(e));
    }
  }

  function handleReset() {
    setSelectedSector(null); setResult(null); setError(null);
    setBusinessName(""); setPeriodType("monthly");
    setPeriods([emptyPeriod("Période 1"), emptyPeriod("Période 2")]);
    setShowTargets(false);
  }

  return (
    <div className={cn("container mx-auto px-4 py-8 max-w-5xl space-y-8", isAr ? "rtl" : "ltr")}
      dir={isAr ? "rtl" : "ltr"}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            {t("Suivi Manuel des KPI", "تتبع مؤشرات الأداء يدوياً")}
          </h1>
          <Badge className="bg-primary/10 text-primary border-primary/30 font-semibold text-xs">
            {t("CA · Bénéfice · Marge · Croissance", "CA · ربح · هامش · نمو")}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm max-w-2xl">
          {t(
            "Saisissez vos indicateurs de performance période par période et obtenez une analyse automatique des tendances, des alertes précoces et des recommandations actionnables.",
            "أدخل مؤشرات أدائك فترة بفترة واحصل على تحليل تلقائي للاتجاهات وتنبيهات مبكرة وتوصيات قابلة للتطبيق."
          )}
        </p>
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground/70 italic">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{t(
            "Le bénéfice net est calculé automatiquement (CA − Charges). Vous pouvez le remplacer par une valeur réelle dans les options avancées.",
            "يُحسب صافي الربح تلقائياً (CA − الأعباء). يمكنك استبداله بقيمة فعلية في الخيارات المتقدمة."
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
              "اختر نموذجاً لملء البيانات مسبقاً، أو اختر مخصص."
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

      {/* ── Parameters ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            {t("Paramètres généraux", "المعاملات العامة")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>{t("Nom de l'entreprise / projet *", "اسم المؤسسة / المشروع *")}</Label>
              <Input value={businessName} onChange={e => setBusinessName(e.target.value)}
                placeholder={t("Ex: Épicerie Boualem — Oran", "مثال: بقالة بوعلام — وهران")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Type de période *", "نوع الفترة *")}</Label>
              <div className="flex gap-2">
                {(["monthly", "quarterly"] as const).map(pt => (
                  <button key={pt} onClick={() => setPeriodType(pt)}
                    className={cn(
                      "flex-1 text-xs font-semibold rounded-lg border-2 py-2 px-3 transition-all",
                      periodType === pt
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    )}>
                    {pt === "monthly" ? t("Mensuel", "شهري") : t("Trimestriel", "ربع سنوي")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Targets toggle */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => setShowTargets(v => !v)}
              className={cn(
                "flex items-center gap-2 text-sm font-medium rounded-lg border-2 px-4 py-2 transition-all",
                showTargets
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:border-primary/40 text-muted-foreground"
              )}>
              <Target className="w-4 h-4" />
              {showTargets
                ? t("Objectifs activés ✓", "الأهداف مُفعَّلة ✓")
                : t("Activer le suivi des objectifs", "تفعيل متابعة الأهداف")}
            </button>
            <p className="text-xs text-muted-foreground">
              {t("Définissez un CA et/ou bénéfice cible par période pour mesurer l'écart réalisé vs visé.",
                 "حدد هدف CA و/أو ربح لكل فترة لقياس الفارق بين الفعلي والمستهدف.")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Periods Input ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                {t(`Périodes (${periods.length})`, `الفترات (${periods.length})`)}
              </CardTitle>
              <CardDescription className="mt-0.5">
                {t(
                  "Ajoutez les périodes chronologiquement. Minimum 2 périodes pour calculer les évolutions.",
                  "أضف الفترات بالترتيب الزمني. الحد الأدنى فترتان لحساب التطورات."
                )}
              </CardDescription>
            </div>
            <Button onClick={addPeriod} variant="outline" size="sm">
              <Plus className="w-4 h-4 me-1.5" />
              {t("Ajouter une période", "إضافة فترة")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {periods.map((p, idx) => {
            const hasOptional = !!(p.numCustomers || p.marketingSpend || p.unitsSold);
            return (
              <div key={idx} className={cn(
                "rounded-xl border-2 p-4 space-y-3 transition-colors",
                idx === periods.length - 1 && result
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card"
              )}>
                {/* Period header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <Input
                      value={p.label}
                      onChange={e => updatePeriod(idx, "label", e.target.value)}
                      className="h-7 text-sm font-semibold border-none bg-transparent px-0 focus-visible:ring-0 w-36"
                      placeholder={t(`Période ${idx + 1}`, `الفترة ${idx + 1}`)}
                    />
                  </div>
                  {periods.length > 2 && (
                    <Button variant="ghost" size="sm" onClick={() => removePeriod(idx)}
                      className="text-destructive hover:text-destructive h-7 px-2">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                {/* Core KPIs row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("Chiffre d'Affaires (DA) *", "رقم الأعمال (DA) *")}</Label>
                    <Input type="number" min="0" step="any"
                      value={p.revenue} onChange={e => updatePeriod(idx, "revenue", e.target.value)}
                      placeholder="ex: 1200000" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("Total Charges (DA) *", "إجمالي الأعباء (DA) *")}</Label>
                    <Input type="number" min="0" step="any"
                      value={p.totalCosts} onChange={e => updatePeriod(idx, "totalCosts", e.target.value)}
                      placeholder="ex: 900000" className="text-sm" />
                  </div>
                  {showTargets && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <Target className="w-3 h-3 text-purple-600" />
                          {t("Objectif CA (DA)", "هدف CA (DA)")}
                        </Label>
                        <Input type="number" min="0" step="any"
                          value={p.targetRevenue} onChange={e => updatePeriod(idx, "targetRevenue", e.target.value)}
                          placeholder="optionnel" className="text-sm border-purple-200" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <Target className="w-3 h-3 text-purple-600" />
                          {t("Objectif Bénéfice (DA)", "هدف الربح (DA)")}
                        </Label>
                        <Input type="number" step="any"
                          value={p.targetProfit} onChange={e => updatePeriod(idx, "targetProfit", e.target.value)}
                          placeholder="optionnel" className="text-sm border-purple-200" />
                      </div>
                    </>
                  )}
                </div>

                {/* Auto-calculated profit preview */}
                {p.revenue && p.totalCosts && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="text-muted-foreground/70">
                      {t("Bénéfice auto :", "الربح التلقائي:")}
                    </span>
                    <span className={cn(
                      "font-semibold",
                      (parseNum(p.revenue) ?? 0) - (parseNum(p.totalCosts) ?? 0) >= 0
                        ? "text-green-700" : "text-destructive"
                    )}>
                      {fmtDA((parseNum(p.revenue) ?? 0) - (parseNum(p.totalCosts) ?? 0))}
                    </span>
                    <span className="text-muted-foreground/50">
                      ({fmtPctAbs(
                        (parseNum(p.revenue) ?? 0) > 0
                          ? (((parseNum(p.revenue) ?? 0) - (parseNum(p.totalCosts) ?? 0)) / (parseNum(p.revenue) ?? 1)) * 100
                          : 0
                      )} {t("marge", "هامش")})
                    </span>
                  </div>
                )}

                {/* Optional fields toggle */}
                <button
                  onClick={() => updatePeriod(idx, "showOptional", !p.showOptional)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                  {p.showOptional ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {p.showOptional
                    ? t("Masquer les champs optionnels", "إخفاء الحقول الاختيارية")
                    : t("Champs optionnels (unités, clients, marketing…)", "حقول اختيارية (وحدات، عملاء، تسويق…)")}
                </button>

                {p.showOptional && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-border">
                    <div className="space-y-1">
                      <Label className="text-xs">{t("Unités vendues", "الوحدات المباعة")}</Label>
                      <Input type="number" min="0" step="1"
                        value={p.unitsSold} onChange={e => updatePeriod(idx, "unitsSold", e.target.value)}
                        placeholder="ex: 15000" className="text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("Nb. clients total", "عدد العملاء الإجمالي")}</Label>
                      <Input type="number" min="0" step="1"
                        value={p.numCustomers} onChange={e => updatePeriod(idx, "numCustomers", e.target.value)}
                        placeholder="ex: 120" className="text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("Dépenses marketing (DA)", "مصاريف التسويق (DA)")}</Label>
                      <Input type="number" min="0" step="any"
                        value={p.marketingSpend} onChange={e => updatePeriod(idx, "marketingSpend", e.target.value)}
                        placeholder="ex: 50000" className="text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("Nouveaux clients", "العملاء الجدد")}</Label>
                      <Input type="number" min="0" step="1"
                        value={p.newCustomers} onChange={e => updatePeriod(idx, "newCustomers", e.target.value)}
                        placeholder="ex: 8" className="text-sm" />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">
                        {t("Bénéfice réel (remplace CA − Charges si renseigné)", "الربح الفعلي (يُعوّض CA − أعباء إذا أُدخل)")}
                      </Label>
                      <Input type="number" step="any"
                        value={p.profitOverride} onChange={e => updatePeriod(idx, "profitOverride", e.target.value)}
                        placeholder={t("Laisser vide = automatique", "اتركه فارغاً = تلقائي")} className="text-sm" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 flex-wrap pt-1">
            <Button onClick={handleCalculate} className="min-w-[220px]">
              <Calculator className="w-4 h-4 me-2" />
              {t("Analyser les tendances", "تحليل الاتجاهات")}
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
            {t("Analyse ci-dessous", "التحليل أدناه")}
          </div>

          {/* Charts section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t("Évolution Revenue · Charges · Bénéfice", "تطور رقم الأعمال · الأعباء · الربح")}
              </CardTitle>
              <CardDescription>
                {t("Tendances sur les " + result.periods.length + " périodes saisies.",
                   "الاتجاهات على " + result.periods.length + " فترات مُدخلة.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-lg border border-border bg-white p-3">
                <RevenueCostsProfitChart result={result} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t("Évolution de la Marge Bénéficiaire (%)", "تطور هامش الربح (%)")}
              </CardTitle>
              <CardDescription>
                {t("Une marge positive et croissante indique une amélioration de l'efficacité opérationnelle.",
                   "هامش إيجابي ومتنامٍ يدل على تحسن الكفاءة التشغيلية.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-lg border border-border bg-white p-3">
                <ProfitMarginChart result={result} />
              </div>
            </CardContent>
          </Card>

          {result.summary.hasTargets && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  {t("Réalisé vs Objectif — Chiffre d'Affaires", "الفعلي مقابل الهدف — رقم الأعمال")}
                </CardTitle>
                <CardDescription>
                  {t(
                    "Barre verte = objectif atteint ou dépassé. Barre rouge = sous l'objectif. Pourcentage = écart réalisé/objectif.",
                    "شريط أخضر = الهدف محقق أو متجاوز. شريط أحمر = دون الهدف. النسبة = الفارق الفعلي/الهدف."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg border border-border bg-white p-3">
                  <ActualVsTargetChart result={result} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Growth Rate Table */}
          {result.periods.length >= 2 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t("Taux de Croissance Période sur Période", "معدل النمو من فترة لأخرى")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <GrowthRateTable result={result} />
              </CardContent>
            </Card>
          )}

          {/* Report + Analysis */}
          <KpiTrackingReport
            result={result}
            sector={selectedSector}
          />
        </div>
      )}
    </div>
  );
}
