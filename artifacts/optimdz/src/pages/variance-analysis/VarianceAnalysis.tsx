import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Scale, Calculator, Plus, Trash2, ArrowRight, RefreshCw,
  ShoppingBag, Factory, Leaf, Monitor, PencilRuler,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VarianceAnalysisReport } from "./VarianceAnalysisReport";
import type { VarianceObjective, VarianceRowResult, VarianceTotals } from "@/lib/generateVariancePDF";

// ── Types ─────────────────────────────────────────────────────────────────────
type SectorKey = "commerce" | "industry" | "agriculture" | "services" | "custom";

interface VarianceRow {
  id: string;
  element: string;
  standardPrice: number;
  actualPrice: number;
  standardQty: number;
  actualQty: number;
}

// ── Objective config ──────────────────────────────────────────────────────────
interface ObjOption {
  value: VarianceObjective;
  nameFr: string;
  nameAr: string;
  descFr: string;
  descAr: string;
}

const OBJECTIVES: ObjOption[] = [
  {
    value: "revenue",
    nameFr: "Revenus / Ventes",
    nameAr: "انحراف الإيرادات",
    descFr: "Prix de vente et volume vendu",
    descAr: "سعر البيع والحجم المُباع",
  },
  {
    value: "materials",
    nameFr: "Matières premières",
    nameAr: "انحراف تكلفة المواد",
    descFr: "Coût d'achat et quantité consommée",
    descAr: "تكلفة الشراء والكمية المستهلكة",
  },
  {
    value: "labor",
    nameFr: "Main-d'œuvre",
    nameAr: "انحراف اليد العاملة",
    descFr: "Taux horaire et heures travaillées",
    descAr: "الأجر الساعي وساعات العمل",
  },
];

// ── Column labels per objective ───────────────────────────────────────────────
function getColLabels(obj: VarianceObjective, isAr: boolean) {
  if (obj === "labor") {
    return {
      priceFr: "Taux standard (DA/h)", priceAr: "الأجر المعياري (د.ج/س)",
      actPriceFr: "Taux réel (DA/h)",  actPriceAr: "الأجر الفعلي (د.ج/س)",
      qtyFr: "Heures standard",         qtyAr: "ساعات معيارية",
      actQtyFr: "Heures réelles",       actQtyAr: "ساعات فعلية",
      elemFr: "Élément (ex: عملية التجميع)", elemAr: "العنصر (مثال: عملية التجميع)",
    };
  }
  return {
    priceFr: "Prix standard (DA)",     priceAr: "السعر المعياري (د.ج)",
    actPriceFr: "Prix réel (DA)",      actPriceAr: "السعر الفعلي (د.ج)",
    qtyFr: "Quantité standard",         qtyAr: "الكمية المعيارية",
    actQtyFr: "Quantité réelle",        actQtyAr: "الكمية الفعلية",
    elemFr: "Élément",                  elemAr: "العنصر",
  };
}

// ── Sector templates ──────────────────────────────────────────────────────────
interface SectorTemplate {
  id: SectorKey;
  icon: React.ElementType;
  nameFr: string;
  nameAr: string;
  descFr: string;
  descAr: string;
  objective: VarianceObjective;
  projectNameFr: string;
  projectNameAr: string;
  rows: VarianceRow[];
}

const TEMPLATES: SectorTemplate[] = [
  {
    id: "commerce",
    icon: ShoppingBag,
    nameFr: "Commerce",
    nameAr: "التجارة",
    descFr: "Écarts sur revenus d'un commerce à Oran",
    descAr: "انحرافات إيرادات تجارة بوهران",
    objective: "revenue",
    projectNameFr: "Analyse des ventes — Commerce Oran",
    projectNameAr: "تحليل المبيعات — تجارة وهران",
    rows: [
      { id: "A", element: "Produit A — Électroménager",  standardPrice: 25000, actualPrice: 26500, standardQty: 500, actualQty: 480 },
      { id: "B", element: "Produit B — Textile",         standardPrice: 1800,  actualPrice: 1750,  standardQty: 300, actualQty: 320 },
      { id: "C", element: "Produit C — Accessoires",     standardPrice: 950,   actualPrice: 980,   standardQty: 1000, actualQty: 950 },
    ],
  },
  {
    id: "industry",
    icon: Factory,
    nameFr: "Industrie",
    nameAr: "الصناعة",
    descFr: "Écarts matières d'une unité à Sétif",
    descAr: "انحرافات مواد وحدة إنتاج بسطيف",
    objective: "materials",
    projectNameFr: "Consommations matières — Unité Sétif",
    projectNameAr: "استهلاك المواد — وحدة سطيف",
    rows: [
      { id: "A", element: "Acier plat / الصلب المسطح",        standardPrice: 180,  actualPrice: 195,  standardQty: 2000, actualQty: 2100 },
      { id: "B", element: "Plastique ABS / البلاستيك",         standardPrice: 85,   actualPrice: 82,   standardQty: 500,  actualQty: 520  },
      { id: "C", element: "Carton emballage / الكرتون",        standardPrice: 45,   actualPrice: 47,   standardQty: 1500, actualQty: 1480 },
      { id: "D", element: "Peinture / الطلاء",                 standardPrice: 220,  actualPrice: 225,  standardQty: 300,  actualQty: 310  },
    ],
  },
  {
    id: "agriculture",
    icon: Leaf,
    nameFr: "Agriculture",
    nameAr: "الفلاحة",
    descFr: "Écarts intrants agricoles en Mitidja",
    descAr: "انحرافات مستلزمات فلاحية في المتيجة",
    objective: "materials",
    projectNameFr: "Intrants agricoles — Mitidja",
    projectNameAr: "المستلزمات الفلاحية — المتيجة",
    rows: [
      { id: "A", element: "Fertilisants azotés / أسمدة",       standardPrice: 320, actualPrice: 340,  standardQty: 800, actualQty: 780 },
      { id: "B", element: "Semences sélectionnées / بذور",      standardPrice: 250, actualPrice: 248,  standardQty: 200, actualQty: 210 },
      { id: "C", element: "Produits phytosanitaires / مبيدات",  standardPrice: 580, actualPrice: 600,  standardQty: 120, actualQty: 115 },
      { id: "D", element: "Eau d'irrigation (m³) / ماء",        standardPrice: 12,  actualPrice: 12,   standardQty: 5000, actualQty: 5200 },
    ],
  },
  {
    id: "services",
    icon: Monitor,
    nameFr: "Services",
    nameAr: "الخدمات",
    descFr: "Écarts main-d'œuvre projet ERP — PME",
    descAr: "انحرافات عمالة مشروع ERP — م.ص.م",
    objective: "labor",
    projectNameFr: "Main-d'œuvre projet ERP — PME Algérienne",
    projectNameAr: "عمالة مشروع ERP — مؤسسة جزائرية",
    rows: [
      { id: "A", element: "Développeurs / المطورون",             standardPrice: 1500, actualPrice: 1600, standardQty: 160, actualQty: 175 },
      { id: "B", element: "Testeurs QA / فريق الجودة",           standardPrice: 1200, actualPrice: 1200, standardQty: 80,  actualQty: 88  },
      { id: "C", element: "Chef de projet / مدير المشروع",       standardPrice: 2000, actualPrice: 2100, standardQty: 40,  actualQty: 42  },
      { id: "D", element: "Consultants ERP / المستشارون",        standardPrice: 2500, actualPrice: 2450, standardQty: 60,  actualQty: 55  },
    ],
  },
];

// ── Letter ID helper ──────────────────────────────────────────────────────────
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function nextId(existing: string[]): string {
  for (const ch of LETTERS) if (!existing.includes(ch)) return ch;
  return `Z${existing.length}`;
}

function defaultRows(): VarianceRow[] {
  return [
    { id: "A", element: "", standardPrice: 0, actualPrice: 0, standardQty: 0, actualQty: 0 },
    { id: "B", element: "", standardPrice: 0, actualPrice: 0, standardQty: 0, actualQty: 0 },
  ];
}

// ── Computation ───────────────────────────────────────────────────────────────
function computeRows(rows: VarianceRow[]): VarianceRowResult[] {
  return rows.map(r => {
    const pv = (r.actualPrice - r.standardPrice) * r.actualQty;
    const qv = (r.actualQty - r.standardQty) * r.standardPrice;
    return {
      id: r.id,
      element: r.element || r.id,
      standardPrice: r.standardPrice,
      standardQty: r.standardQty,
      actualPrice: r.actualPrice,
      actualQty: r.actualQty,
      priceVariance: pv,
      qtyVariance: qv,
      totalVariance: pv + qv,
    };
  });
}

function computeTotals(results: VarianceRowResult[]): VarianceTotals {
  return {
    priceVariance: results.reduce((s, r) => s + r.priceVariance, 0),
    qtyVariance:   results.reduce((s, r) => s + r.qtyVariance,   0),
    totalVariance: results.reduce((s, r) => s + r.totalVariance,  0),
  };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function VarianceAnalysis() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  // ── Form state ──────────────────────────────────────────────────────────────
  const [selectedSector, setSelectedSector] = useState<SectorKey | null>(null);
  const [problemName,    setProblemName]    = useState("");
  const [objective,      setObjective]      = useState<VarianceObjective>("revenue");
  const [rows,           setRows]           = useState<VarianceRow[]>(defaultRows());

  // ── Result state ────────────────────────────────────────────────────────────
  const [results,      setResults]      = useState<VarianceRowResult[] | null>(null);
  const [totals,       setTotals]       = useState<VarianceTotals | null>(null);
  const [resultStale,  setResultStale]  = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // ── Mark stale when form changes after calculation ──────────────────────────
  useEffect(() => {
    if (results) setResultStale(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, objective]);

  // ── Sector selection ────────────────────────────────────────────────────────
  function handleSectorSelect(key: SectorKey) {
    setSelectedSector(key);
    setResults(null);
    setResultStale(false);
    if (key === "custom") {
      setProblemName("");
      setObjective("revenue");
      setRows(defaultRows());
    } else {
      const tpl = TEMPLATES.find(t => t.id === key)!;
      setProblemName(isAr ? tpl.projectNameAr : tpl.projectNameFr);
      setObjective(tpl.objective);
      setRows(tpl.rows.map(r => ({ ...r })));
    }
  }

  // ── Row mutations ───────────────────────────────────────────────────────────
  function addRow() {
    const id = nextId(rows.map(r => r.id));
    setRows([...rows, { id, element: "", standardPrice: 0, actualPrice: 0, standardQty: 0, actualQty: 0 }]);
  }

  function deleteRow(idx: number) {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== idx));
  }

  function updateRow<K extends keyof VarianceRow>(idx: number, key: K, val: VarianceRow[K]) {
    const next = [...rows];
    next[idx] = { ...next[idx], [key]: val };
    setRows(next);
  }

  // ── Solve ───────────────────────────────────────────────────────────────────
  function handleSolve() {
    const res = computeRows(rows);
    const tot = computeTotals(res);
    setResults(res);
    setTotals(tot);
    setResultStale(false);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  const canSolve = rows.length > 0 && rows.every(r => r.element.trim() !== "");
  const cols = getColLabels(objective, isAr);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn("container mx-auto px-4 py-8 max-w-6xl space-y-8", isAr ? "rtl" : "ltr")}
      dir={isAr ? "rtl" : "ltr"}
    >

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary">
            <Scale className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {t("Analyse des Écarts", "تحليل الانحرافات")}
          </h1>
          <Badge variant="secondary">
            {OBJECTIVES.find(o => o.value === objective)?.[isAr ? "nameAr" : "nameFr"] ?? ""}
          </Badge>
        </div>
        <p className="text-muted-foreground ps-14">
          {t(
            "Calculez les écarts standards vs réels pour les revenus, les matières premières ou la main-d'œuvre.",
            "احسب الانحرافات بين المعياري والفعلي للإيرادات أو المواد الأولية أو اليد العاملة."
          )}
        </p>
      </div>

      {/* ── 1. Sector selection ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t("Secteur d'activité", "قطاع النشاط")}</CardTitle>
          <CardDescription>
            {t(
              "Sélectionnez un secteur pour pré-remplir un exemple algérien réaliste.",
              "اختر قطاعاً لتعبئة مثال جزائري واقعي تلقائياً."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {TEMPLATES.map(tpl => {
              const Icon = tpl.icon;
              const active = selectedSector === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSectorSelect(tpl.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all cursor-pointer",
                    active ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={cn("text-sm font-semibold", active ? "text-primary" : "text-foreground")}>
                    {isAr ? tpl.nameAr : tpl.nameFr}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                    {isAr ? tpl.descAr : tpl.descFr}
                  </span>
                </button>
              );
            })}

            {/* Custom */}
            {(() => {
              const active = selectedSector === "custom";
              return (
                <button
                  type="button"
                  onClick={() => handleSectorSelect("custom")}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-all cursor-pointer",
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <PencilRuler className="w-5 h-5" />
                  </div>
                  <span className={cn("text-sm font-semibold", active ? "text-primary" : "text-foreground")}>
                    {t("Personnalisé", "مخصص")}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {t("Saisie libre", "إدخال حر")}
                  </span>
                </button>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Problem setup ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t("Configuration du Problème", "إعداد المسألة")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Name + Objective */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("Nom du problème", "اسم المسألة")}</Label>
              <Input
                value={problemName}
                onChange={e => setProblemName(e.target.value)}
                placeholder={t("Ex: Analyse des ventes T3 2025", "مثال: تحليل مبيعات الربع الثالث 2025")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Type d'analyse (Objectif)", "نوع التحليل (الهدف)")}</Label>
              <div className="flex rounded-lg border border-border overflow-hidden h-10">
                {OBJECTIVES.map(obj => (
                  <button
                    key={obj.value}
                    type="button"
                    onClick={() => { setObjective(obj.value); setResults(null); setResultStale(false); }}
                    className={cn(
                      "flex-1 text-xs font-semibold transition-colors px-1 truncate",
                      objective === obj.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    title={isAr ? obj.nameAr : obj.nameFr}
                  >
                    {isAr ? obj.nameAr : obj.nameFr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* القيم المعيارية والفعلية */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                {t("Valeurs standard et réelles", "القيم المعيارية والفعلية")}
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="w-4 h-4 me-1.5" />
                {t("Ajouter", "إضافة")}
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium text-start w-10">ID</th>
                    <th className="px-3 py-2 font-medium text-start min-w-[170px]">
                      {isAr ? cols.elemAr : cols.elemFr}
                    </th>
                    {/* Standard columns */}
                    <th className="px-2 py-2 font-medium text-center min-w-[130px] border-s border-primary/20 text-primary/80">
                      <div className="text-[10px] uppercase tracking-wide font-bold">{t("Standard", "معياري")}</div>
                      <div className="text-xs normal-case">{isAr ? cols.priceAr : cols.priceFr}</div>
                    </th>
                    <th className="px-2 py-2 font-medium text-center min-w-[120px] text-primary/80">
                      <div className="text-[10px] uppercase tracking-wide font-bold invisible">{t("Standard", "معياري")}</div>
                      <div className="text-xs normal-case">{isAr ? cols.qtyAr : cols.qtyFr}</div>
                    </th>
                    {/* Actual columns */}
                    <th className="px-2 py-2 font-medium text-center min-w-[130px] border-s border-amber-300/60 text-amber-700">
                      <div className="text-[10px] uppercase tracking-wide font-bold">{t("Réel", "فعلي")}</div>
                      <div className="text-xs normal-case">{isAr ? cols.actPriceAr : cols.actPriceFr}</div>
                    </th>
                    <th className="px-2 py-2 font-medium text-center min-w-[120px] text-amber-700">
                      <div className="text-[10px] uppercase tracking-wide font-bold invisible">{t("Réel", "فعلي")}</div>
                      <div className="text-xs normal-case">{isAr ? cols.actQtyAr : cols.actQtyFr}</div>
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      {/* ID */}
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary font-bold text-sm">
                          {row.id}
                        </span>
                      </td>

                      {/* Element name */}
                      <td className="px-3 py-2">
                        <Input
                          value={row.element}
                          onChange={e => updateRow(idx, "element", e.target.value)}
                          placeholder={isAr ? cols.elemAr : cols.elemFr}
                          className="h-8 text-sm"
                        />
                      </td>

                      {/* Standard price */}
                      <td className="px-2 py-2 border-s border-primary/10">
                        <Input
                          type="number" min="0" step="any"
                          value={row.standardPrice || ""}
                          onChange={e => updateRow(idx, "standardPrice", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm text-center w-28"
                          placeholder="0"
                        />
                      </td>

                      {/* Standard qty */}
                      <td className="px-2 py-2">
                        <Input
                          type="number" min="0" step="any"
                          value={row.standardQty || ""}
                          onChange={e => updateRow(idx, "standardQty", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm text-center w-28"
                          placeholder="0"
                        />
                      </td>

                      {/* Actual price */}
                      <td className="px-2 py-2 border-s border-amber-200">
                        <Input
                          type="number" min="0" step="any"
                          value={row.actualPrice || ""}
                          onChange={e => updateRow(idx, "actualPrice", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm text-center w-28 border-amber-300/50 focus-visible:ring-amber-400/50"
                          placeholder="0"
                        />
                      </td>

                      {/* Actual qty */}
                      <td className="px-2 py-2">
                        <Input
                          type="number" min="0" step="any"
                          value={row.actualQty || ""}
                          onChange={e => updateRow(idx, "actualQty", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm text-center w-28 border-amber-300/50 focus-visible:ring-amber-400/50"
                          placeholder="0"
                        />
                      </td>

                      {/* Delete */}
                      <td className="px-3 py-2">
                        <Button
                          type="button" variant="ghost" size="icon"
                          onClick={() => deleteRow(idx)}
                          disabled={rows.length <= 1}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              {objective === "labor"
                ? t(
                    "Écart/Taux = (Taux réel − Taux std.) × H. réelles · Écart/Rendement = (H. réelles − H. std.) × Taux std.",
                    "انحراف الأجر = (الأجر الفعلي − المعياري) × الساعات الفعلية · انحراف المردودية = (الساعات الفعلية − المعيارية) × الأجر المعياري"
                  )
                : t(
                    "Écart/Prix = (Prix réel − Prix std.) × Qté réelle · Écart/Volume = (Qté réelle − Qté std.) × Prix std.",
                    "انحراف السعر = (السعر الفعلي − المعياري) × الكمية الفعلية · انحراف الكمية = (الكمية الفعلية − المعيارية) × السعر المعياري"
                  )}
            </p>
          </div>

          {/* Solve button */}
          <div className="flex justify-end pt-2">
            <Button
              size="lg"
              onClick={handleSolve}
              disabled={!canSolve}
              className="px-10"
            >
              <Calculator className="w-5 h-5 me-2" />
              {t("Résoudre le Problème", "حل المسألة")}
              <ArrowRight className={cn("w-4 h-4 ms-2", isAr && "rotate-180")} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Results ────────────────────────────────────────────────────────── */}
      {results && totals && (
        <div ref={resultsRef} className="space-y-6 scroll-mt-20">

          {/* Stale warning */}
          {resultStale && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <RefreshCw className="w-4 h-4 shrink-0" />
              {t(
                "Les paramètres ont changé — cliquez Résoudre pour mettre à jour.",
                "تغيرت المعطيات — انقر حل المسألة للتحديث."
              )}
            </div>
          )}

          <VarianceAnalysisReport
            problemName={problemName}
            sector={selectedSector ?? "custom"}
            objective={objective}
            rows={results}
            totals={totals}
          />
        </div>
      )}
    </div>
  );
}
