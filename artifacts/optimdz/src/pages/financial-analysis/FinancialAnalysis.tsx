import { useState, useRef } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import {
  computeBreakEven, fmtDA, fmtN,
} from "@/lib/breakEvenAlgorithm";
import type { BreakEvenInput, BreakEvenResult } from "@/lib/breakEvenAlgorithm";
import { BreakEvenReport } from "./BreakEvenReport";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Calculator, ShoppingBag, Factory, Leaf, Monitor, PencilRuler,
  AlertTriangle, RefreshCw, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Sector template types ─────────────────────────────────────────────────────
type SectorKey = "trade" | "industry" | "agriculture" | "services" | "custom";

interface SectorTemplate {
  id: SectorKey;
  icon: React.ElementType;
  nameFr: string;
  nameAr: string;
  descFr: string;
  descAr: string;
  input: Partial<BreakEvenInput>;
  businessNameFr: string;
  businessNameAr: string;
}

const TEMPLATES: SectorTemplate[] = [
  {
    id: "trade",
    icon: ShoppingBag,
    nameFr: "Commerce",
    nameAr: "التجارة",
    descFr: "Boutique de vêtements prêt-à-porter, Oran",
    descAr: "بوتيك ملابس جاهزة — وهران",
    businessNameFr: "Boutique Mode — Oran",
    businessNameAr: "بوتيك الموضة — وهران",
    input: {
      productName:          "Article de prêt-à-porter",
      sellingPrice:         4500,
      variableCost:         2200,
      fixedCosts:           185_000,
      targetProfit:         100_000,
      expectedSalesVolume:  120,
    },
  },
  {
    id: "industry",
    icon: Factory,
    nameFr: "Industrie",
    nameAr: "الصناعة",
    descFr: "Atelier de fabrication de meubles, Tizi Ouzou",
    descAr: "ورشة صناعة أثاث — تيزي وزو",
    businessNameFr: "Meublerie Artisanale — Tizi Ouzou",
    businessNameAr: "ورشة الأثاث الحرفي — تيزي وزو",
    input: {
      productName:          "Meuble en bois artisanal",
      sellingPrice:         45_000,
      variableCost:         22_000,
      fixedCosts:           620_000,
      targetProfit:         200_000,
      expectedSalesVolume:  35,
    },
  },
  {
    id: "agriculture",
    icon: Leaf,
    nameFr: "Agriculture",
    nameAr: "الفلاحة",
    descFr: "Production d'huile d'olive, Béjaïa — campagne saisonnière",
    descAr: "إنتاج زيت الزيتون — بجاية (موسمي)",
    businessNameFr: "Huilerie Artisanale — Béjaïa",
    businessNameAr: "معصرة زيتون حرفية — بجاية",
    input: {
      productName:          "Huile d'olive extra vierge (litre)",
      sellingPrice:         950,
      variableCost:         420,
      fixedCosts:           480_000,
      targetProfit:         150_000,
      expectedSalesVolume:  1_200,
    },
  },
  {
    id: "services",
    icon: Monitor,
    nameFr: "Services",
    nameAr: "الخدمات",
    descFr: "Cabinet de conseil en gestion d'entreprise, Constantine",
    descAr: "مكتب استشارات إدارة أعمال — قسنطينة",
    businessNameFr: "Cabinet Conseil RH — Constantine",
    businessNameAr: "مكتب الاستشارات الإدارية — قسنطينة",
    input: {
      productName:          "Mission de conseil (forfait)",
      sellingPrice:         85_000,
      variableCost:         28_000,
      fixedCosts:           340_000,
      targetProfit:         120_000,
      expectedSalesVolume:  8,
    },
  },
  {
    id: "custom",
    icon: PencilRuler,
    nameFr: "Personnalisé",
    nameAr: "مخصص",
    descFr: "Saisie libre — entrez vos propres données",
    descAr: "إدخال حر — أدخل بياناتك الخاصة",
    businessNameFr: "Mon entreprise",
    businessNameAr: "مؤسستي",
    input: {},
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseNum(v: string): number | undefined {
  const n = parseFloat(v.replace(/\s/g, "").replace(",", "."));
  return isFinite(n) && n >= 0 ? n : undefined;
}

// ── CVP Chart (SVG) ───────────────────────────────────────────────────────────
function CVPChart({ result }: { result: BreakEvenResult }) {
  const { input: inp, breakEvenUnits: bepU, breakEvenRevenue: bepR,
          chartPoints: pts, chartMaxUnits: maxX } = result;

  const W = 700, H = 360;
  const PL = 84, PR = 20, PT = 24, PB = 56;
  const CW = W - PL - PR;
  const CH = H - PT - PB;

  const maxY = Math.max(
    inp.sellingPrice * maxX,
    inp.fixedCosts + inp.variableCost * maxX
  ) * 1.05;

  const xS = (u: number) => PL + (u / maxX) * CW;
  const yS = (v: number) => PT + CH - (v / maxY) * CH;

  // Polyline point strings
  const revPts   = pts.map((p) => `${xS(p.units).toFixed(1)},${yS(p.revenue).toFixed(1)}`).join(" ");
  const costPts  = pts.map((p) => `${xS(p.units).toFixed(1)},${yS(p.totalCost).toFixed(1)}`).join(" ");
  const fixedPts = `${xS(0).toFixed(1)},${yS(inp.fixedCosts).toFixed(1)} ${xS(maxX).toFixed(1)},${yS(inp.fixedCosts).toFixed(1)}`;

  // Break-even pixel coords
  const bepXpx = xS(bepU);
  const bepYpx = yS(bepR);

  // Y axis tick values
  const tickCount = 6;
  const yTicks: number[] = [];
  for (let i = 0; i <= tickCount; i++) yTicks.push((maxY * i) / tickCount);

  // X axis tick values
  const xTickCount = 6;
  const xTicks: number[] = [];
  for (let i = 0; i <= xTickCount; i++) xTicks.push((maxX * i) / xTickCount);

  // Shading: profit area above break-even
  const profitAreaPts = [
    `${xS(bepU).toFixed(1)},${yS(bepR).toFixed(1)}`,
    ...pts
      .filter((p) => p.units >= bepU)
      .map((p) => `${xS(p.units).toFixed(1)},${yS(p.revenue).toFixed(1)}`),
    ...pts
      .filter((p) => p.units >= bepU)
      .reverse()
      .map((p) => `${xS(p.units).toFixed(1)},${yS(p.totalCost).toFixed(1)}`),
  ].join(" ");

  // Loss area below break-even
  const lossAreaPts = [
    `${xS(0).toFixed(1)},${yS(inp.fixedCosts).toFixed(1)}`,
    ...pts
      .filter((p) => p.units <= bepU)
      .map((p) => `${xS(p.units).toFixed(1)},${yS(p.totalCost).toFixed(1)}`),
    ...pts
      .filter((p) => p.units <= bepU)
      .reverse()
      .map((p) => `${xS(p.units).toFixed(1)},${yS(p.revenue).toFixed(1)}`),
    `${xS(0).toFixed(1)},${yS(0).toFixed(1)}`,
  ].join(" ");

  // Expected sales volume line
  const esvX = inp.expectedSalesVolume ? xS(inp.expectedSalesVolume) : null;
  const esvRevY = inp.expectedSalesVolume ? yS(inp.expectedSalesVolume * inp.sellingPrice) : null;

  // Target profit line
  const tpX = result.targetProfitUnits ? xS(result.targetProfitUnits) : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      aria-label="Graphique CVP — Coût-Volume-Profit"
    >
      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <line
          key={`yg${i}`}
          x1={PL} y1={yS(v).toFixed(1)}
          x2={W - PR} y2={yS(v).toFixed(1)}
          stroke="#e5e7eb" strokeWidth="1"
        />
      ))}
      {xTicks.map((v, i) => (
        <line
          key={`xg${i}`}
          x1={xS(v).toFixed(1)} y1={PT}
          x2={xS(v).toFixed(1)} y2={PT + CH}
          stroke="#e5e7eb" strokeWidth="1"
        />
      ))}

      {/* Loss shading */}
      <polygon points={lossAreaPts} fill="#ef444415" />
      {/* Profit shading */}
      <polygon points={profitAreaPts} fill="#22c55e15" />

      {/* Fixed cost dashed line */}
      <polyline
        points={fixedPts}
        fill="none" stroke="#94a3b8" strokeWidth="1.5"
        strokeDasharray="6,4"
      />
      <text x={PL + 4} y={yS(inp.fixedCosts) - 6} fontSize="10" fill="#64748b">
        CF = {fmtDA(inp.fixedCosts)}
      </text>

      {/* Total cost line */}
      <polyline
        points={costPts}
        fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round"
      />

      {/* Revenue line */}
      <polyline
        points={revPts}
        fill="none" stroke="#004d40" strokeWidth="2.5" strokeLinejoin="round"
      />

      {/* Break-even vertical dashed */}
      <line
        x1={bepXpx.toFixed(1)} y1={bepYpx.toFixed(1)}
        x2={bepXpx.toFixed(1)} y2={PT + CH}
        stroke="#dc2626" strokeWidth="1.5" strokeDasharray="5,3"
      />
      {/* Break-even horizontal dashed */}
      <line
        x1={PL} y1={bepYpx.toFixed(1)}
        x2={bepXpx.toFixed(1)} y2={bepYpx.toFixed(1)}
        stroke="#dc2626" strokeWidth="1.5" strokeDasharray="5,3"
      />

      {/* Break-even dot */}
      <circle cx={bepXpx.toFixed(1)} cy={bepYpx.toFixed(1)} r="6" fill="#dc2626" stroke="#fff" strokeWidth="2" />
      {/* Break-even label */}
      {bepXpx < W - PR - 130 ? (
        <g>
          <rect
            x={bepXpx + 10} y={bepYpx - 22}
            width="118" height="32" rx="4"
            fill="#dc2626" opacity="0.92"
          />
          <text x={bepXpx + 68} y={bepYpx - 10} fontSize="9.5" fill="#fff" textAnchor="middle" fontWeight="700">
            Seuil: {fmtN(bepU, 1)} u.
          </text>
          <text x={bepXpx + 68} y={bepYpx + 2} fontSize="9" fill="rgba(255,255,255,0.85)" textAnchor="middle">
            {fmtDA(bepR)}
          </text>
        </g>
      ) : (
        <g>
          <rect
            x={bepXpx - 130} y={bepYpx - 22}
            width="118" height="32" rx="4"
            fill="#dc2626" opacity="0.92"
          />
          <text x={bepXpx - 72} y={bepYpx - 10} fontSize="9.5" fill="#fff" textAnchor="middle" fontWeight="700">
            Seuil: {fmtN(bepU, 1)} u.
          </text>
          <text x={bepXpx - 72} y={bepYpx + 2} fontSize="9" fill="rgba(255,255,255,0.85)" textAnchor="middle">
            {fmtDA(bepR)}
          </text>
        </g>
      )}

      {/* Expected sales volume marker */}
      {esvX !== null && esvRevY !== null && inp.expectedSalesVolume !== undefined && (
        <>
          <line
            x1={esvX.toFixed(1)} y1={PT}
            x2={esvX.toFixed(1)} y2={PT + CH}
            stroke="#3a7d44" strokeWidth="1.5" strokeDasharray="8,4"
          />
          <circle cx={esvX.toFixed(1)} cy={esvRevY.toFixed(1)} r="5" fill="#3a7d44" stroke="#fff" strokeWidth="2" />
          <text
            x={Math.min(esvX + 5, W - PR - 90)}
            y={PT + 14}
            fontSize="9.5" fill="#3a7d44" fontWeight="700"
          >
            Vol.prévu: {fmtN(inp.expectedSalesVolume, 0)} u.
          </text>
        </>
      )}

      {/* Target profit marker */}
      {tpX !== null && result.targetProfitUnits !== undefined && (
        <>
          <line
            x1={tpX.toFixed(1)} y1={PT}
            x2={tpX.toFixed(1)} y2={PT + CH}
            stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="6,3"
          />
          <text
            x={Math.min(tpX + 5, W - PR - 90)}
            y={PT + 26}
            fontSize="9.5" fill="#7c3aed" fontWeight="700"
          >
            Objectif: {fmtN(result.targetProfitUnits, 1)} u.
          </text>
        </>
      )}

      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT + CH} stroke="#374151" strokeWidth="2" />
      <line x1={PL} y1={PT + CH} x2={W - PR} y2={PT + CH} stroke="#374151" strokeWidth="2" />

      {/* Y axis ticks + labels */}
      {yTicks.map((v, i) => (
        <g key={`yt${i}`}>
          <line x1={PL - 4} y1={yS(v).toFixed(1)} x2={PL} y2={yS(v).toFixed(1)} stroke="#374151" strokeWidth="1.5" />
          <text x={PL - 7} y={parseFloat(yS(v).toFixed(1)) + 4} fontSize="9" fill="#6b7280" textAnchor="end">
            {v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}M`
              : v >= 1_000
              ? `${(v / 1_000).toFixed(0)}k`
              : v.toFixed(0)}
          </text>
        </g>
      ))}

      {/* X axis ticks + labels */}
      {xTicks.map((v, i) => (
        <g key={`xt${i}`}>
          <line x1={xS(v).toFixed(1)} y1={PT + CH} x2={xS(v).toFixed(1)} y2={PT + CH + 4} stroke="#374151" strokeWidth="1.5" />
          <text x={xS(v).toFixed(1)} y={PT + CH + 16} fontSize="9" fill="#6b7280" textAnchor="middle">
            {v.toFixed(0)}
          </text>
        </g>
      ))}

      {/* Axis labels */}
      <text x={W / 2} y={H - 4} fontSize="11" fill="#374151" textAnchor="middle" fontWeight="600">
        Quantité (unités)
      </text>
      <text
        x={12} y={PT + CH / 2}
        fontSize="11" fill="#374151" textAnchor="middle" fontWeight="600"
        transform={`rotate(-90, 12, ${PT + CH / 2})`}
      >
        Montant (DA)
      </text>

      {/* Legend */}
      <g transform={`translate(${PL + 12}, ${PT + 8})`}>
        <rect width="88" height="60" rx="4" fill="white" fillOpacity="0.85" stroke="#e5e7eb" strokeWidth="1" />
        <line x1="8" y1="15" x2="24" y2="15" stroke="#004d40" strokeWidth="2.5" />
        <text x="28" y="19" fontSize="9.5" fill="#374151">CA total</text>
        <line x1="8" y1="30" x2="24" y2="30" stroke="#f97316" strokeWidth="2.5" />
        <text x="28" y="34" fontSize="9.5" fill="#374151">Coût total</text>
        <line x1="8" y1="45" x2="24" y2="45" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,3" />
        <text x="28" y="49" fontSize="9.5" fill="#374151">CF fixe</text>
      </g>

      {/* "Perte" / "Bénéfice" labels */}
      {bepXpx > PL + 40 && (
        <text
          x={PL + (bepXpx - PL) / 2}
          y={PT + CH - 12}
          fontSize="9.5" fill="#ef4444" textAnchor="middle" fontWeight="600" opacity="0.7"
        >
          ← Zone de perte
        </text>
      )}
      {bepXpx < W - PR - 40 && (
        <text
          x={bepXpx + (W - PR - bepXpx) / 2}
          y={PT + CH - 12}
          fontSize="9.5" fill="#22c55e" textAnchor="middle" fontWeight="600" opacity="0.7"
        >
          Zone bénéficiaire →
        </text>
      )}
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FinancialAnalysis() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const resultsRef = useRef<HTMLDivElement>(null);

  // Sector / template state
  const [selectedSector, setSelectedSector] = useState<SectorKey | null>(null);

  // Form state (strings so inputs are controlled)
  const [businessName,        setBusinessName]        = useState("");
  const [productName,         setProductName]         = useState("");
  const [sellingPrice,        setSellingPrice]        = useState("");
  const [variableCost,        setVariableCost]        = useState("");
  const [fixedCosts,          setFixedCosts]          = useState("");
  const [targetProfit,        setTargetProfit]        = useState("");
  const [expectedSalesVolume, setExpectedSalesVolume] = useState("");

  // Result state
  const [result,    setResult]    = useState<BreakEvenResult | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  // ── Apply template ────────────────────────────────────────────────────────
  function applyTemplate(tpl: SectorTemplate) {
    setSelectedSector(tpl.id);
    setError(null);
    setResult(null);
    if (tpl.id === "custom") {
      setBusinessName(""); setProductName(""); setSellingPrice("");
      setVariableCost(""); setFixedCosts(""); setTargetProfit(""); setExpectedSalesVolume("");
      return;
    }
    const inp = tpl.input;
    setBusinessName(isAr ? tpl.businessNameAr : tpl.businessNameFr);
    setProductName(inp.productName ?? "");
    setSellingPrice(inp.sellingPrice !== undefined ? String(inp.sellingPrice) : "");
    setVariableCost(inp.variableCost !== undefined ? String(inp.variableCost) : "");
    setFixedCosts(  inp.fixedCosts   !== undefined ? String(inp.fixedCosts)   : "");
    setTargetProfit(inp.targetProfit !== undefined ? String(inp.targetProfit) : "");
    setExpectedSalesVolume(
      inp.expectedSalesVolume !== undefined ? String(inp.expectedSalesVolume) : ""
    );
  }

  // ── Calculate ─────────────────────────────────────────────────────────────
  function handleCalculate() {
    setError(null);
    const sp = parseNum(sellingPrice);
    const vc = parseNum(variableCost);
    const fc = parseNum(fixedCosts);
    if (sp === undefined || vc === undefined || fc === undefined) {
      setError(t(
        "Veuillez remplir les champs obligatoires : prix de vente, coût variable et charges fixes.",
        "يرجى ملء الحقول الإلزامية: سعر البيع، التكلفة المتغيرة، والأعباء الثابتة."
      ));
      return;
    }
    const input: BreakEvenInput = {
      productName: productName || t("Produit/Service", "منتج/خدمة"),
      sellingPrice: sp,
      variableCost: vc,
      fixedCosts:   fc,
      targetProfit:        parseNum(targetProfit),
      expectedSalesVolume: parseNum(expectedSalesVolume),
    };
    try {
      const r = computeBreakEven(input);
      setResult(r);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (e) {
      setError(String(e));
    }
  }

  function handleReset() {
    setSelectedSector(null);
    setResult(null);
    setError(null);
    setBusinessName(""); setProductName(""); setSellingPrice("");
    setVariableCost(""); setFixedCosts(""); setTargetProfit(""); setExpectedSalesVolume("");
  }

  return (
    <div
      className={cn("container mx-auto px-4 py-8 max-w-5xl space-y-8", isAr ? "rtl" : "ltr")}
      dir={isAr ? "rtl" : "ltr"}
    >

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            {t("Analyse Financière", "التحليل المالي")}
          </h1>
          <Badge className="bg-primary/10 text-primary border-primary/30 font-semibold text-xs">
            {t("Seuil de Rentabilité — CVP", "نقطة التعادل — CVP")}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm max-w-2xl">
          {t(
            "Calculez votre seuil de rentabilité, la marge sur coût variable, la marge de sécurité et le levier opérationnel. Analyse Coût-Volume-Profit adaptée aux entreprises algériennes.",
            "احسب نقطة تعادلك، هامش المساهمة، هامش الأمان والرافعة التشغيلية. تحليل CVP مُكيَّف مع المؤسسات الجزائرية."
          )}
        </p>
      </div>

      {/* ── Sector Selection ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t("Secteur d'activité", "قطاع النشاط")}
          </CardTitle>
          <CardDescription>
            {t(
              "Sélectionnez un secteur pour pré-remplir un exemple algérien réaliste, ou choisissez « Personnalisé ».",
              "اختر قطاعاً لملء نموذج جزائري واقعي، أو اختر «مخصص» لإدخال بياناتك الخاصة."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              const isSelected = selectedSector === tpl.id;
              const isCustom = tpl.id === "custom";
              return (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl)}
                  className={cn(
                    "group relative rounded-xl border-2 p-4 text-left transition-all duration-200 hover:shadow-md",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/50",
                    isCustom && !isSelected && "border-dashed"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 transition-colors",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <p className={cn("font-semibold text-sm", isSelected ? "text-primary" : "text-foreground")}>
                    {isAr ? tpl.nameAr : tpl.nameFr}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                    {isAr ? tpl.descAr : tpl.descFr}
                  </p>
                  {isSelected && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Input Form ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            {t("Données de l'analyse", "بيانات التحليل")}
          </CardTitle>
          <CardDescription>
            {t(
              "Renseignez les données de votre activité. Les champs marqués * sont obligatoires.",
              "أدخل بيانات نشاطك. الحقول المُعلَّمة بـ * إلزامية."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Business + product name row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("Nom de l'entreprise / du projet", "اسم المؤسسة / المشروع")}</Label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={t("Ex: Boutique Mode Oran", "مثال: بوتيك الموضة وهران")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Produit / Service *", "المنتج / الخدمة *")}</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder={t("Ex: Article de prêt-à-porter", "مثال: قطعة ملابس جاهزة")}
              />
            </div>
          </div>

          {/* Core CVP fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                {t("Prix de vente unitaire (DA) *", "سعر البيع للوحدة (DA) *")}
              </Label>
              <Input
                type="number" min="0" step="any"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="ex: 4500"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Coût variable unitaire (DA) *", "التكلفة المتغيرة للوحدة (DA) *")}</Label>
              <Input
                type="number" min="0" step="any"
                value={variableCost}
                onChange={(e) => setVariableCost(e.target.value)}
                placeholder="ex: 2200"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Charges fixes totales (DA) *", "الأعباء الثابتة الإجمالية (DA) *")}</Label>
              <Input
                type="number" min="0" step="any"
                value={fixedCosts}
                onChange={(e) => setFixedCosts(e.target.value)}
                placeholder="ex: 185000"
              />
            </div>
          </div>

          {/* Optional fields */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("Champs optionnels", "حقول اختيارية")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {t("Bénéfice cible (DA) — optionnel", "الربح المستهدف (DA) — اختياري")}
                </Label>
                <Input
                  type="number" min="0" step="any"
                  value={targetProfit}
                  onChange={(e) => setTargetProfit(e.target.value)}
                  placeholder={t("Ex: 100000 DA de bénéfice", "مثال: 100000 DA ربح")}
                />
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Calcule les unités à vendre pour atteindre ce profit.",
                    "يحسب عدد الوحدات اللازمة لتحقيق هذا الربح."
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {t("Volume prévu (unités) — optionnel", "الحجم المتوقع (وحدات) — اختياري")}
                </Label>
                <Input
                  type="number" min="0" step="any"
                  value={expectedSalesVolume}
                  onChange={(e) => setExpectedSalesVolume(e.target.value)}
                  placeholder={t("Ex: 120 unités/mois", "مثال: 120 وحدة/شهر")}
                />
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Permet le calcul de la marge de sécurité et du levier opérationnel.",
                    "يُمكّن حساب هامش الأمان والرافعة التشغيلية."
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

          {/* Actions */}
          <div className="flex gap-3 flex-wrap pt-1">
            <Button onClick={handleCalculate} className="min-w-[180px]">
              <Calculator className="w-4 h-4 me-2" />
              {t("Calculer le seuil", "احسب نقطة التعادل")}
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

          {/* Scroll hint */}
          <div className="flex items-center gap-2 text-primary text-sm font-medium animate-bounce w-fit">
            <ChevronDown className="w-4 h-4" />
            {t("Résultats disponibles ci-dessous", "النتائج متاحة أدناه")}
          </div>

          {/* ── KPI Cards ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: t("Seuil de rentabilité", "نقطة التعادل"),
                value: `${fmtN(result.breakEvenUnits, 1)} unités`,
                sub:   fmtDA(result.breakEvenRevenue),
                color: "bg-primary text-primary-foreground",
                icon: "📍",
              },
              {
                label: t("Marge / Coût Variable", "هامش المساهمة/وحدة"),
                value: fmtDA(result.contributionMarginPerUnit),
                sub:   `Taux: ${fmtN(result.contributionMarginRatio, 2)} %`,
                color: "bg-secondary text-secondary-foreground",
                icon: "📊",
              },
              ...(result.targetProfitUnits !== undefined ? [{
                label: t("Unités (objectif profit)", "وحدات الهدف الربحي"),
                value: `${fmtN(result.targetProfitUnits, 1)} unités`,
                sub:   fmtDA(result.targetProfitRevenue),
                color: "bg-violet-600 text-white",
                icon: "🎯",
              }] : []),
              ...(result.marginOfSafetyPct !== undefined ? [{
                label: t("Marge de sécurité", "هامش الأمان"),
                value: `${fmtN(result.marginOfSafetyPct, 1)} %`,
                sub:   `${fmtN(result.marginOfSafetyUnits, 1)} unités / ${fmtDA(result.marginOfSafetyRevenue)}`,
                color: result.marginOfSafetyPct >= 20
                  ? "bg-green-600 text-white"
                  : "bg-amber-500 text-white",
                icon: result.marginOfSafetyPct >= 20 ? "🛡️" : "⚠️",
              }] : [
                {
                  label: t("Charges fixes", "الأعباء الثابتة"),
                  value: fmtDA(result.input.fixedCosts),
                  sub:   `${fmtN((result.input.fixedCosts / result.breakEvenRevenue) * 100, 1)} % du CA seuil`,
                  color: "bg-muted text-foreground border border-border",
                  icon: "🏭",
                },
              ]),
            ].map((kpi) => (
              <div key={kpi.label} className={cn("rounded-xl p-4 space-y-1", kpi.color)}>
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{kpi.icon}</span>
                  <p className="text-xs opacity-80 font-medium">{kpi.label}</p>
                </div>
                <p className="text-xl font-extrabold leading-tight">{kpi.value}</p>
                <p className="text-xs opacity-70">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Extended KPI table if both optional fields filled ────────────── */}
          {result.marginOfSafetyPct !== undefined && result.targetProfitUnits !== undefined && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("Tableau récapitulatif complet", "الجدول الشامل")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {[
                    { l: t("Seuil (unités)",    "نقطة التعادل (وحدات)"),    v: `${fmtN(result.breakEvenUnits, 1)} u.` },
                    { l: t("Seuil (CA)",         "نقطة التعادل (CA)"),       v: fmtDA(result.breakEvenRevenue) },
                    { l: t("CM / unité",         "هامش المساهمة/وحدة"),      v: fmtDA(result.contributionMarginPerUnit) },
                    { l: t("Taux CM",            "نسبة الهامش"),             v: `${fmtN(result.contributionMarginRatio, 2)} %` },
                    { l: t("Unités objectif",    "وحدات الهدف"),             v: `${fmtN(result.targetProfitUnits, 1)} u.` },
                    { l: t("CA objectif",        "رقم أعمال الهدف"),          v: fmtDA(result.targetProfitRevenue) },
                    { l: t("Marge sécurité",     "هامش الأمان"),             v: `${fmtN(result.marginOfSafetyPct, 1)} %` },
                    { l: t("Bénéfice prévu",     "الربح الصافي المتوقع"),     v: fmtDA(result.netProfit) },
                    ...(result.operatingLeverage !== undefined
                      ? [{ l: t("Levier opér. (DOL)", "الرافعة التشغيلية"), v: `× ${fmtN(result.operatingLeverage, 2)}` }]
                      : []),
                  ].map((row) => (
                    <div key={row.l} className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">{row.l}</p>
                      <p className="font-bold text-sm mt-0.5">{row.v}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── CVP Chart ─────────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                {t("Graphique Coût-Volume-Profit (CVP)", "الرسم البياني — التعادل CVP")}
              </CardTitle>
              <CardDescription>
                {t(
                  "La droite verte représente le chiffre d'affaires, la droite orange le coût total. Le point rouge marque l'intersection — le seuil de rentabilité.",
                  "الخط الأخضر يمثل رقم الأعمال، الخط البرتقالي التكلفة الإجمالية. النقطة الحمراء هي نقطة التعادل."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-lg overflow-hidden border border-border bg-white p-2">
                <CVPChart result={result} />
              </div>
              {/* Chart legend summary */}
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-8 h-0.5 bg-primary inline-block rounded" />
                  {t("CA total = prix × quantité", "رقم الأعمال = السعر × الكمية")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-8 h-0.5 bg-orange-500 inline-block rounded" />
                  {t("Coût total = CF + CV × quantité", "الكلفة الكلية = ثابتة + متغيرة × الكمية")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-slate-400 inline-block rounded" style={{ borderTop: "2px dashed #94a3b8" }} />
                  {t("Charges fixes", "الأعباء الثابتة")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                  {t("Seuil de rentabilité", "نقطة التعادل")}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── Situational Analysis + Suggestions + Report ──────────────────── */}
          <BreakEvenReport
            result={result}
            businessName={businessName}
            sector={selectedSector}
          />

        </div>
      )}
    </div>
  );
}
