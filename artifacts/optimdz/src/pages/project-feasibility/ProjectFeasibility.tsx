import { useState, useRef } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import {
  computeBreakEven, fmtDA, fmtN,
} from "@/lib/breakEvenAlgorithm";
import type { BreakEvenInput, BreakEvenResult } from "@/lib/breakEvenAlgorithm";
import { ProjectBreakEvenReport } from "./ProjectBreakEvenReport";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase, Calculator, ShoppingBag, Factory, Leaf, Monitor, PencilRuler,
  AlertTriangle, RefreshCw, ChevronDown, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Sector template types ──────────────────────────────────────────────────────
type SectorKey = "trade" | "industry" | "agriculture" | "services" | "custom";

interface SectorTemplate {
  id: SectorKey;
  icon: React.ElementType;
  nameFr: string;
  nameAr: string;
  descFr: string;
  descAr: string;
  input: Partial<BreakEvenInput>;
  projectNameFr: string;
  projectNameAr: string;
}

// All examples are explicitly framed as NEW PROJECT launches
const TEMPLATES: SectorTemplate[] = [
  {
    id: "trade",
    icon: ShoppingBag,
    nameFr: "Commerce",
    nameAr: "التجارة",
    descFr: "Ouverture d'une nouvelle succursale vêtements, Sétif",
    descAr: "افتتاح فرع جديد لملابس جاهزة — سطيف",
    projectNameFr: "Nouvelle Succursale Mode — Sétif",
    projectNameAr: "فرع الملابس الجديد — سطيف",
    input: {
      productName:         "Article de prêt-à-porter (pièce)",
      sellingPrice:        3_500,
      variableCost:        1_800,
      fixedCosts:          240_000,   // loyer + aménagement + personnel dédié
      targetProfit:        150_000,
      expectedSalesVolume: 200,
    },
  },
  {
    id: "industry",
    icon: Factory,
    nameFr: "Industrie",
    nameAr: "الصناعة",
    descFr: "Lancement d'une ligne d'emballage plastique, Annaba",
    descAr: "إطلاق خط إنتاج تعبئة بلاستيكية — عنابة",
    projectNameFr: "Ligne Emballage Plastique — Annaba",
    projectNameAr: "خط التعبئة البلاستيكية — عنابة",
    input: {
      productName:         "Emballage plastique (kg)",
      sellingPrice:        185,
      variableCost:        90,
      fixedCosts:          1_400_000,  // machine + bail industriel + techniciens
      targetProfit:        400_000,
      expectedSalesVolume: 20_000,
    },
  },
  {
    id: "agriculture",
    icon: Leaf,
    nameFr: "Agriculture",
    nameAr: "الفلاحة",
    descFr: "Création d'une serre maraîchère sous goutte-à-goutte, El Oued",
    descAr: "إنشاء بيت محمي للخضروات تحت الري بالتنقيط — الوادي",
    projectNameFr: "Serre Maraîchère — El Oued",
    projectNameAr: "البيت المحمي للخضروات — الوادي",
    input: {
      productName:         "Tomates en serre (kg)",
      sellingPrice:        120,
      variableCost:        48,
      fixedCosts:          380_000,   // installation serre + pompage + intrants fixes
      targetProfit:        200_000,
      expectedSalesVolume: 8_000,
    },
  },
  {
    id: "services",
    icon: Monitor,
    nameFr: "Services",
    nameAr: "الخدمات",
    descFr: "Ouverture d'un espace de coworking, Alger Centre",
    descAr: "افتتاح فضاء عمل مشترك — الجزائر العاصمة وسط",
    projectNameFr: "Espace Coworking — Alger Centre",
    projectNameAr: "فضاء العمل المشترك — وسط الجزائر",
    input: {
      productName:         "Abonnement mensuel (poste de travail)",
      sellingPrice:        35_000,
      variableCost:        8_000,
      fixedCosts:          950_000,   // loyer + aménagement + charges structure
      targetProfit:        300_000,
      expectedSalesVolume: 40,
    },
  },
  {
    id: "custom",
    icon: PencilRuler,
    nameFr: "Personnalisé",
    nameAr: "مخصص",
    descFr: "Saisie libre — entrez les données de votre projet",
    descAr: "إدخال حر — أدخل بيانات مشروعك الخاص",
    projectNameFr: "Mon projet",
    projectNameAr: "مشروعي",
    input: {},
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseNum(v: string): number | undefined {
  const n = parseFloat(v.replace(/\s/g, "").replace(",", "."));
  return isFinite(n) && n >= 0 ? n : undefined;
}

// ── CVP Chart (SVG) ────────────────────────────────────────────────────────────
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

  const revPts   = pts.map((p) => `${xS(p.units).toFixed(1)},${yS(p.revenue).toFixed(1)}`).join(" ");
  const costPts  = pts.map((p) => `${xS(p.units).toFixed(1)},${yS(p.totalCost).toFixed(1)}`).join(" ");
  const fixedPts = `${xS(0).toFixed(1)},${yS(inp.fixedCosts).toFixed(1)} ${xS(maxX).toFixed(1)},${yS(inp.fixedCosts).toFixed(1)}`;

  const bepXpx = xS(bepU);
  const bepYpx = yS(bepR);

  const tickCount = 6;
  const yTicks: number[] = [];
  for (let i = 0; i <= tickCount; i++) yTicks.push((maxY * i) / tickCount);

  const xTickCount = 6;
  const xTicks: number[] = [];
  for (let i = 0; i <= xTickCount; i++) xTicks.push((maxX * i) / xTickCount);

  // Profit zone (above BEP)
  const profitAreaPts = [
    `${xS(bepU).toFixed(1)},${yS(bepR).toFixed(1)}`,
    ...pts.filter((p) => p.units >= bepU).map((p) => `${xS(p.units).toFixed(1)},${yS(p.revenue).toFixed(1)}`),
    ...pts.filter((p) => p.units >= bepU).reverse().map((p) => `${xS(p.units).toFixed(1)},${yS(p.totalCost).toFixed(1)}`),
  ].join(" ");

  // Loss zone (below BEP)
  const lossAreaPts = [
    `${xS(0).toFixed(1)},${yS(inp.fixedCosts).toFixed(1)}`,
    ...pts.filter((p) => p.units <= bepU).map((p) => `${xS(p.units).toFixed(1)},${yS(p.totalCost).toFixed(1)}`),
    ...pts.filter((p) => p.units <= bepU).reverse().map((p) => `${xS(p.units).toFixed(1)},${yS(p.revenue).toFixed(1)}`),
    `${xS(0).toFixed(1)},${yS(0).toFixed(1)}`,
  ].join(" ");

  const esvX    = inp.expectedSalesVolume ? xS(inp.expectedSalesVolume) : null;
  const esvRevY = inp.expectedSalesVolume ? yS(inp.expectedSalesVolume * inp.sellingPrice) : null;
  const tpX     = result.targetProfitUnits ? xS(result.targetProfitUnits) : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      aria-label="Graphique CVP Projet — Seuil de Rentabilité"
    >
      {/* Grid */}
      {yTicks.map((v, i) => (
        <line key={`yg${i}`} x1={PL} y1={yS(v).toFixed(1)} x2={W - PR} y2={yS(v).toFixed(1)} stroke="#e5e7eb" strokeWidth="1" />
      ))}
      {xTicks.map((v, i) => (
        <line key={`xg${i}`} x1={xS(v).toFixed(1)} y1={PT} x2={xS(v).toFixed(1)} y2={PT + CH} stroke="#e5e7eb" strokeWidth="1" />
      ))}

      {/* Shading */}
      <polygon points={lossAreaPts}   fill="#ef444415" />
      <polygon points={profitAreaPts} fill="#22c55e15" />

      {/* Fixed cost line */}
      <polyline points={fixedPts} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6,4" />
      <text x={PL + 4} y={yS(inp.fixedCosts) - 6} fontSize="10" fill="#64748b">
        CF = {fmtDA(inp.fixedCosts)}
      </text>

      {/* Total cost */}
      <polyline points={costPts} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Revenue */}
      <polyline points={revPts}  fill="none" stroke="#004d40" strokeWidth="2.5" strokeLinejoin="round" />

      {/* BEP crosshairs */}
      <line x1={bepXpx.toFixed(1)} y1={bepYpx.toFixed(1)} x2={bepXpx.toFixed(1)} y2={PT + CH} stroke="#dc2626" strokeWidth="1.5" strokeDasharray="5,3" />
      <line x1={PL} y1={bepYpx.toFixed(1)} x2={bepXpx.toFixed(1)} y2={bepYpx.toFixed(1)} stroke="#dc2626" strokeWidth="1.5" strokeDasharray="5,3" />

      {/* BEP dot */}
      <circle cx={bepXpx.toFixed(1)} cy={bepYpx.toFixed(1)} r="6" fill="#dc2626" stroke="#fff" strokeWidth="2" />

      {/* BEP label */}
      {bepXpx < W - PR - 140 ? (
        <g>
          <rect x={bepXpx + 10} y={bepYpx - 22} width="128" height="32" rx="4" fill="#dc2626" opacity="0.92" />
          <text x={bepXpx + 73} y={bepYpx - 10} fontSize="9.5" fill="#fff" textAnchor="middle" fontWeight="700">
            Seuil projet: {fmtN(bepU, 1)} u.
          </text>
          <text x={bepXpx + 73} y={bepYpx + 2} fontSize="9" fill="rgba(255,255,255,0.85)" textAnchor="middle">
            {fmtDA(bepR)}
          </text>
        </g>
      ) : (
        <g>
          <rect x={bepXpx - 140} y={bepYpx - 22} width="128" height="32" rx="4" fill="#dc2626" opacity="0.92" />
          <text x={bepXpx - 76} y={bepYpx - 10} fontSize="9.5" fill="#fff" textAnchor="middle" fontWeight="700">
            Seuil projet: {fmtN(bepU, 1)} u.
          </text>
          <text x={bepXpx - 76} y={bepYpx + 2} fontSize="9" fill="rgba(255,255,255,0.85)" textAnchor="middle">
            {fmtDA(bepR)}
          </text>
        </g>
      )}

      {/* Expected sales volume */}
      {esvX !== null && esvRevY !== null && inp.expectedSalesVolume !== undefined && (
        <>
          <line x1={esvX.toFixed(1)} y1={PT} x2={esvX.toFixed(1)} y2={PT + CH} stroke="#3a7d44" strokeWidth="1.5" strokeDasharray="8,4" />
          <circle cx={esvX.toFixed(1)} cy={esvRevY.toFixed(1)} r="5" fill="#3a7d44" stroke="#fff" strokeWidth="2" />
          <text x={Math.min(esvX + 5, W - PR - 100)} y={PT + 14} fontSize="9.5" fill="#3a7d44" fontWeight="700">
            Vol.prévu: {fmtN(inp.expectedSalesVolume, 0)} u.
          </text>
        </>
      )}

      {/* Target profit marker */}
      {tpX !== null && result.targetProfitUnits !== undefined && (
        <>
          <line x1={tpX.toFixed(1)} y1={PT} x2={tpX.toFixed(1)} y2={PT + CH} stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="6,3" />
          <text x={Math.min(tpX + 5, W - PR - 100)} y={PT + 26} fontSize="9.5" fill="#7c3aed" fontWeight="700">
            Objectif: {fmtN(result.targetProfitUnits, 1)} u.
          </text>
        </>
      )}

      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT + CH} stroke="#374151" strokeWidth="2" />
      <line x1={PL} y1={PT + CH} x2={W - PR} y2={PT + CH} stroke="#374151" strokeWidth="2" />

      {/* Y axis labels */}
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

      {/* X axis labels */}
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
        Quantité (unités du projet)
      </text>
      <text x={12} y={PT + CH / 2} fontSize="11" fill="#374151" textAnchor="middle" fontWeight="600"
        transform={`rotate(-90, 12, ${PT + CH / 2})`}>
        Montant (DA)
      </text>

      {/* Legend */}
      <g transform={`translate(${PL + 12}, ${PT + 8})`}>
        <rect width="100" height="60" rx="4" fill="white" fillOpacity="0.85" stroke="#e5e7eb" strokeWidth="1" />
        <line x1="8" y1="15" x2="24" y2="15" stroke="#004d40" strokeWidth="2.5" />
        <text x="28" y="19" fontSize="9.5" fill="#374151">CA projet</text>
        <line x1="8" y1="30" x2="24" y2="30" stroke="#f97316" strokeWidth="2.5" />
        <text x="28" y="34" fontSize="9.5" fill="#374151">Coût total</text>
        <line x1="8" y1="45" x2="24" y2="45" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,3" />
        <text x="28" y="49" fontSize="9.5" fill="#374151">CF projet</text>
      </g>

      {/* Zone labels */}
      {bepXpx > PL + 40 && (
        <text x={PL + (bepXpx - PL) / 2} y={PT + CH - 12} fontSize="9.5" fill="#ef4444" textAnchor="middle" fontWeight="600" opacity="0.7">
          ← Zone de perte
        </text>
      )}
      {bepXpx < W - PR - 40 && (
        <text x={bepXpx + (W - PR - bepXpx) / 2} y={PT + CH - 12} fontSize="9.5" fill="#22c55e" textAnchor="middle" fontWeight="600" opacity="0.7">
          Zone bénéficiaire →
        </text>
      )}
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ProjectFeasibility() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const resultsRef = useRef<HTMLDivElement>(null);

  const [selectedSector, setSelectedSector] = useState<SectorKey | null>(null);

  // Form state
  const [projectName,         setProjectName]         = useState("");
  const [productName,         setProductName]         = useState("");
  const [sellingPrice,        setSellingPrice]        = useState("");
  const [variableCost,        setVariableCost]        = useState("");
  const [fixedCosts,          setFixedCosts]          = useState("");
  const [targetProfit,        setTargetProfit]        = useState("");
  const [expectedSalesVolume, setExpectedSalesVolume] = useState("");

  const [result, setResult] = useState<BreakEvenResult | null>(null);
  const [error,  setError]  = useState<string | null>(null);

  // ── Apply template ──────────────────────────────────────────────────────────
  function applyTemplate(tpl: SectorTemplate) {
    setSelectedSector(tpl.id);
    setError(null);
    setResult(null);
    if (tpl.id === "custom") {
      setProjectName(""); setProductName(""); setSellingPrice("");
      setVariableCost(""); setFixedCosts(""); setTargetProfit(""); setExpectedSalesVolume("");
      return;
    }
    const inp = tpl.input;
    setProjectName(isAr ? tpl.projectNameAr : tpl.projectNameFr);
    setProductName(inp.productName ?? "");
    setSellingPrice(inp.sellingPrice          !== undefined ? String(inp.sellingPrice)         : "");
    setVariableCost(inp.variableCost          !== undefined ? String(inp.variableCost)         : "");
    setFixedCosts(  inp.fixedCosts            !== undefined ? String(inp.fixedCosts)           : "");
    setTargetProfit(inp.targetProfit          !== undefined ? String(inp.targetProfit)         : "");
    setExpectedSalesVolume(
      inp.expectedSalesVolume !== undefined ? String(inp.expectedSalesVolume) : ""
    );
  }

  // ── Calculate ───────────────────────────────────────────────────────────────
  function handleCalculate() {
    setError(null);
    const sp = parseNum(sellingPrice);
    const vc = parseNum(variableCost);
    const fc = parseNum(fixedCosts);
    if (sp === undefined || vc === undefined || fc === undefined) {
      setError(t(
        "Veuillez remplir les champs obligatoires : prix de vente, coût variable et charges fixes du projet.",
        "يرجى ملء الحقول الإلزامية: سعر البيع، التكلفة المتغيرة، وأعباء المشروع الثابتة."
      ));
      return;
    }
    const input: BreakEvenInput = {
      productName: productName || t("Produit/Service du projet", "منتج/خدمة المشروع"),
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
    setProjectName(""); setProductName(""); setSellingPrice("");
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
            <Briefcase className="w-6 h-6 text-primary" />
            {t("Faisabilité & Évaluation de Projet", "جدوى وتقييم المشاريع")}
          </h1>
          <Badge className="bg-primary/10 text-primary border-primary/30 font-semibold text-xs">
            {t("Seuil de Rentabilité Projet", "نقطة تعادل المشروع")}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm max-w-2xl">
          {t(
            "Évaluez si votre nouveau projet est viable avant de vous engager dans des charges fixes. Calculez la nqtet ta3adol du projet, la marge de sécurité et obtenez une recommandation Go / No-Go basée sur les données.",
            "قيّم جدوى مشروعك الجديد قبل الالتزام بالأعباء الثابتة. احسب نقطة تعادل المشروع، هامش الأمان، واحصل على توصية Go/No-Go مبنية على البيانات."
          )}
        </p>
        <p className="text-xs text-muted-foreground/70 italic">
          {t(
            "Cet outil concerne exclusivement l'analyse de faisabilité d'un projet ou investissement spécifique — pas la comptabilité générale d'une entreprise existante.",
            "هذه الأداة مخصصة حصراً لتحليل جدوى مشروع أو استثمار محدد — وليس للمحاسبة العامة لمؤسسة قائمة."
          )}
        </p>
      </div>

      {/* ── Sector Selection ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t("Type de projet", "نوع المشروع")}
          </CardTitle>
          <CardDescription>
            {t(
              "Choisissez un exemple de nouveau projet algérien pour pré-remplir des données réalistes, ou saisissez vos propres données.",
              "اختر نموذج مشروع جزائري جديد لملء بيانات واقعية، أو أدخل بياناتك الخاصة."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              const isSelected = selectedSector === tpl.id;
              const isCustom   = tpl.id === "custom";
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
                    isSelected
                      ? "bg-primary text-primary-foreground"
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
            {t("Données du projet", "بيانات المشروع")}
          </CardTitle>
          <CardDescription>
            {t(
              "Renseignez les données économiques de votre nouveau projet. Les champs marqués * sont obligatoires.",
              "أدخل البيانات الاقتصادية لمشروعك الجديد. الحقول المُعلَّمة بـ * إلزامية."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Project name + product name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("Nom du projet (nouveau)", "اسم المشروع (الجديد)")}</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={t("Ex: Nouvelle Succursale Sétif", "مثال: الفرع الجديد — سطيف")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Produit / Service du projet *", "منتج / خدمة المشروع *")}</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder={t("Ex: Article prêt-à-porter", "مثال: قطعة ملابس جاهزة")}
              />
            </div>
          </div>

          {/* Core CVP inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>
                {t("Prix de vente unitaire (DA) *", "سعر البيع للوحدة (DA) *")}
              </Label>
              <Input
                type="number" min="0" step="any"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="ex: 3500"
              />
              <p className="text-xs text-muted-foreground">
                {t("Prix prévu pour le produit/service du projet", "السعر المقرر لمنتج/خدمة المشروع")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Coût variable unitaire (DA) *", "التكلفة المتغيرة للوحدة (DA) *")}</Label>
              <Input
                type="number" min="0" step="any"
                value={variableCost}
                onChange={(e) => setVariableCost(e.target.value)}
                placeholder="ex: 1800"
              />
              <p className="text-xs text-muted-foreground">
                {t("Matières, commissions, emballage…", "مواد أولية، عمولات، تعبئة…")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Charges fixes du projet (DA) *", "الأعباء الثابتة للمشروع (DA) *")}</Label>
              <Input
                type="number" min="0" step="any"
                value={fixedCosts}
                onChange={(e) => setFixedCosts(e.target.value)}
                placeholder="ex: 240000"
              />
              <p className="text-xs text-muted-foreground">
                {t("Loyer dédié, équipements, personnel fixe du projet…", "إيجار مخصص، تجهيزات، موظفون ثابتون للمشروع…")}
              </p>
            </div>
          </div>

          {/* Optional fields */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("Champs optionnels (enrichissent l'analyse)", "حقول اختيارية (تُثري التحليل)")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {t("Bénéfice cible du projet (DA) — optionnel", "الربح المستهدف للمشروع (DA) — اختياري")}
                </Label>
                <Input
                  type="number" min="0" step="any"
                  value={targetProfit}
                  onChange={(e) => setTargetProfit(e.target.value)}
                  placeholder={t("Ex: 200000 DA de bénéfice", "مثال: 200000 DA ربح")}
                />
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Calcule les unités à vendre pour que le projet atteigne ce profit.",
                    "يحسب عدد الوحدات اللازمة لتحقيق هذا الربح للمشروع."
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {t("Volume de ventes prévu / capacité du marché — optionnel", "الحجم المتوقع / سعة السوق — اختياري")}
                </Label>
                <Input
                  type="number" min="0" step="any"
                  value={expectedSalesVolume}
                  onChange={(e) => setExpectedSalesVolume(e.target.value)}
                  placeholder={t("Ex: 200 unités/mois", "مثال: 200 وحدة/شهر")}
                />
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Estimation du marché accessible — permet le calcul de la marge de sécurité du projet.",
                    "تقدير السوق المتاح — يُمكّن حساب هامش أمان المشروع."
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
            <Button onClick={handleCalculate} className="min-w-[200px]">
              <TrendingUp className="w-4 h-4 me-2" />
              {t("Analyser la viabilité du projet", "تحليل جدوى المشروع")}
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
            {t("Résultats de viabilité ci-dessous", "نتائج الجدوى أدناه")}
          </div>

          {/* ── KPI Cards ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: t("Seuil de rentabilité projet", "نقطة تعادل المشروع"),
                value: `${fmtN(result.breakEvenUnits, 1)} unités`,
                sub:   fmtDA(result.breakEvenRevenue),
                color: "bg-primary text-primary-foreground",
                icon:  "📍",
              },
              {
                label: t("Marge / Coût Variable", "هامش المساهمة / وحدة"),
                value: fmtDA(result.contributionMarginPerUnit),
                sub:   `Taux: ${fmtN(result.contributionMarginRatio, 2)} %`,
                color: "bg-secondary text-secondary-foreground",
                icon:  "📊",
              },
              ...(result.targetProfitUnits !== undefined ? [{
                label: t("Unités pour bénéfice cible", "وحدات الربح المستهدف"),
                value: `${fmtN(result.targetProfitUnits, 1)} unités`,
                sub:   fmtDA(result.targetProfitRevenue),
                color: "bg-violet-600 text-white",
                icon:  "🎯",
              }] : []),
              ...(result.marginOfSafetyPct !== undefined ? [{
                label: t("Marge de sécurité projet", "هامش أمان المشروع"),
                value: `${fmtN(result.marginOfSafetyPct, 1)} %`,
                sub:   `${fmtN(result.marginOfSafetyUnits, 1)} unités / ${fmtDA(result.marginOfSafetyRevenue)}`,
                color: result.marginOfSafetyPct >= 20
                  ? "bg-green-600 text-white"
                  : "bg-amber-500 text-white",
                icon:  result.marginOfSafetyPct >= 20 ? "🛡️" : "⚠️",
              }] : [
                {
                  label: t("Charges fixes projet", "الأعباء الثابتة للمشروع"),
                  value: fmtDA(result.input.fixedCosts),
                  sub:   `${fmtN((result.input.fixedCosts / result.breakEvenRevenue) * 100, 1)} % du CA seuil`,
                  color: "bg-muted text-foreground border border-border",
                  icon:  "🏭",
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

          {/* ── Extended summary table when both optional fields set ─────── */}
          {result.marginOfSafetyPct !== undefined && result.targetProfitUnits !== undefined && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("Tableau de viabilité complet", "جدول الجدوى الشامل")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {[
                    { l: t("Seuil (unités)",       "نقطة التعادل (وحدات)"),       v: `${fmtN(result.breakEvenUnits, 1)} u.` },
                    { l: t("Seuil (CA)",            "نقطة التعادل (CA)"),           v: fmtDA(result.breakEvenRevenue) },
                    { l: t("CM / unité",            "هامش المساهمة/وحدة"),         v: fmtDA(result.contributionMarginPerUnit) },
                    { l: t("Taux CM",               "نسبة الهامش"),                v: `${fmtN(result.contributionMarginRatio, 2)} %` },
                    { l: t("Unités objectif",       "وحدات الهدف"),                v: `${fmtN(result.targetProfitUnits, 1)} u.` },
                    { l: t("CA objectif",           "رقم أعمال الهدف"),             v: fmtDA(result.targetProfitRevenue) },
                    { l: t("Marge sécurité",        "هامش الأمان"),                v: `${fmtN(result.marginOfSafetyPct, 1)} %` },
                    { l: t("Bénéfice net prévu",   "الربح الصافي المتوقع"),        v: fmtDA(result.netProfit) },
                    ...(result.operatingLeverage !== undefined
                      ? [{ l: t("Levier opér. (DOL)", "الرافعة التشغيلية"),        v: `× ${fmtN(result.operatingLeverage, 2)}` }]
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

          {/* ── CVP Chart ──────────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                {t("Graphique de Seuil de Rentabilité — Projet", "الرسم البياني لنقطة تعادل المشروع")}
              </CardTitle>
              <CardDescription>
                {t(
                  "La droite verte représente le chiffre d'affaires du projet, la droite orange le coût total. Le point rouge marque le seuil de rentabilité — le volume minimum à atteindre pour que le projet soit viable.",
                  "الخط الأخضر يمثل رقم أعمال المشروع، الخط البرتقالي التكلفة الكلية. النقطة الحمراء هي نقطة التعادل — الحجم الأدنى لجدوى المشروع."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-lg overflow-hidden border border-border bg-white p-2">
                <CVPChart result={result} />
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-8 h-0.5 bg-primary inline-block rounded" />
                  {t("CA projet = prix × quantité", "رقم أعمال المشروع = السعر × الكمية")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-8 h-0.5 bg-orange-500 inline-block rounded" />
                  {t("Coût total = CF + CV × quantité", "الكلفة الكلية = ثابتة + متغيرة × الكمية")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-slate-400 inline-block rounded" />
                  {t("Charges fixes projet", "الأعباء الثابتة للمشروع")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                  {t("Seuil de rentabilité projet", "نقطة تعادل المشروع")}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── Situational Analysis + Suggestions + Report ──────────────── */}
          <ProjectBreakEvenReport
            result={result}
            projectName={projectName}
            sector={selectedSector}
          />

        </div>
      )}
    </div>
  );
}
