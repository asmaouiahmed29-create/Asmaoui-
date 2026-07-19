import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Scale, TrendingUp, TrendingDown, Minus,
  RefreshCw, ShoppingCart, Package, Users, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type AnalysisType = "revenue" | "materials" | "labor";

interface VarianceResult {
  priceVariance: number;
  quantityVariance: number;
  totalVariance: number;
}

// ── Pure calculation ──────────────────────────────────────────────────────────
function computeVariances(sp: number, sq: number, ap: number, aq: number): VarianceResult {
  return {
    priceVariance:    (ap - sp) * aq,
    quantityVariance: (aq - sq) * sp,
    totalVariance:    (ap - sp) * aq + (aq - sq) * sp,
  };
}

// ── Per-type configuration ────────────────────────────────────────────────────
interface TypeConfig {
  icon: React.ElementType;
  nameFr: string;
  nameAr: string;
  descFr: string;
  descAr: string;
  priceLabelFr: string;
  priceLabelAr: string;
  priceUnitFr: string;
  priceUnitAr: string;
  qtyLabelFr: string;
  qtyLabelAr: string;
  qtyUnitFr: string;
  qtyUnitAr: string;
  priceVarNameFr: string;
  priceVarNameAr: string;
  qtyVarNameFr: string;
  qtyVarNameAr: string;
  /** positive → more = good (revenue); negative → less = good (cost) */
  favorableWhen: "positive" | "negative";
  priceVarExplainFr: (v: number) => string;
  priceVarExplainAr: (v: number) => string;
  qtyVarExplainFr: (v: number) => string;
  qtyVarExplainAr: (v: number) => string;
}

const CONFIGS: Record<AnalysisType, TypeConfig> = {
  revenue: {
    icon: ShoppingCart,
    nameFr: "Revenu / Ventes",
    nameAr: "الإيرادات / المبيعات",
    descFr: "Prix de vente et volume vendu",
    descAr: "سعر البيع والحجم المُباع",
    priceLabelFr: "Prix de vente standard",
    priceLabelAr: "سعر البيع المعياري",
    priceUnitFr: "DA / unité",
    priceUnitAr: "د.ج / وحدة",
    qtyLabelFr: "Volume standard vendu",
    qtyLabelAr: "الحجم المعياري المُباع",
    qtyUnitFr: "unités",
    qtyUnitAr: "وحدات",
    priceVarNameFr: "Écart sur Prix",
    priceVarNameAr: "انحراف السعر",
    qtyVarNameFr: "Écart sur Volume",
    qtyVarNameAr: "انحراف الحجم",
    favorableWhen: "positive",
    priceVarExplainFr: (v) =>
      v > 0
        ? "Le prix de vente réel est supérieur au standard — revenu additionnel par unité."
        : v < 0
        ? "Le prix réel est inférieur au standard — manque à gagner sur chaque unité."
        : "Aucun écart de prix — la tarification est conforme.",
    priceVarExplainAr: (v) =>
      v > 0
        ? "سعر البيع الفعلي أعلى من المعياري — إيراد إضافي لكل وحدة."
        : v < 0
        ? "سعر البيع الفعلي أقل من المعياري — خسارة في الإيراد لكل وحدة."
        : "لا انحراف في السعر — التسعير مطابق للمعيار.",
    qtyVarExplainFr: (v) =>
      v > 0
        ? "Le volume vendu dépasse le prévisionnel — bonne performance commerciale."
        : v < 0
        ? "Le volume vendu est inférieur au prévisionnel — objectif de vente non atteint."
        : "Volume vendu conforme au prévisionnel.",
    qtyVarExplainAr: (v) =>
      v > 0
        ? "حجم المبيعات يتجاوز التوقعات — أداء تجاري إيجابي."
        : v < 0
        ? "حجم المبيعات أقل من التوقعات — هدف المبيعات لم يُحقَّق."
        : "حجم المبيعات مطابق للتوقعات.",
  },

  materials: {
    icon: Package,
    nameFr: "Matières premières",
    nameAr: "المواد الأولية",
    descFr: "Coût d'achat et quantité consommée",
    descAr: "تكلفة الشراء والكمية المستهلكة",
    priceLabelFr: "Coût unitaire standard",
    priceLabelAr: "التكلفة الوحدوية المعيارية",
    priceUnitFr: "DA / unité",
    priceUnitAr: "د.ج / وحدة",
    qtyLabelFr: "Quantité standard consommée",
    qtyLabelAr: "الكمية المعيارية المستهلكة",
    qtyUnitFr: "unités",
    qtyUnitAr: "وحدات",
    priceVarNameFr: "Écart sur Prix d'Achat",
    priceVarNameAr: "انحراف سعر الشراء",
    qtyVarNameFr: "Écart sur Consommation",
    qtyVarNameAr: "انحراف الاستهلاك",
    favorableWhen: "negative",
    priceVarExplainFr: (v) =>
      v < 0
        ? "Le coût d'achat réel est inférieur au standard — économie sur les approvisionnements."
        : v > 0
        ? "Le coût réel dépasse le standard — surcoût d'approvisionnement à analyser."
        : "Coût d'achat conforme au standard.",
    priceVarExplainAr: (v) =>
      v < 0
        ? "تكلفة الشراء الفعلية أقل من المعيارية — وفر في التموين."
        : v > 0
        ? "تكلفة الشراء الفعلية تتجاوز المعيارية — تكلفة إضافية تستوجب التحليل."
        : "تكلفة الشراء مطابقة للمعيار.",
    qtyVarExplainFr: (v) =>
      v < 0
        ? "La consommation réelle est inférieure au standard — efficience matière positive."
        : v > 0
        ? "La consommation réelle dépasse le standard — gaspillage ou dépassement à corriger."
        : "Consommation conforme au standard.",
    qtyVarExplainAr: (v) =>
      v < 0
        ? "الاستهلاك الفعلي أقل من المعياري — كفاءة جيدة في استخدام المواد."
        : v > 0
        ? "الاستهلاك الفعلي يتجاوز المعياري — هدر أو تجاوز يستوجب التصحيح."
        : "الاستهلاك مطابق للمعيار.",
  },

  labor: {
    icon: Users,
    nameFr: "Main-d'œuvre",
    nameAr: "اليد العاملة",
    descFr: "Taux horaire et heures travaillées",
    descAr: "الأجر الساعي وساعات العمل",
    priceLabelFr: "Taux horaire standard",
    priceLabelAr: "الأجر المعياري الساعي",
    priceUnitFr: "DA / heure",
    priceUnitAr: "د.ج / ساعة",
    qtyLabelFr: "Heures standard allouées",
    qtyLabelAr: "ساعات العمل المعيارية المخصصة",
    qtyUnitFr: "heures",
    qtyUnitAr: "ساعات",
    priceVarNameFr: "Écart sur Taux",
    priceVarNameAr: "انحراف الأجر",
    qtyVarNameFr: "Écart sur Rendement",
    qtyVarNameAr: "انحراف المردودية",
    favorableWhen: "negative",
    priceVarExplainFr: (v) =>
      v < 0
        ? "Le taux réel est inférieur au taux standard — économie salariale réalisée."
        : v > 0
        ? "Le taux réel dépasse le standard — surcoût salarial (heures sup., prime, etc.)."
        : "Taux horaire conforme au standard.",
    priceVarExplainAr: (v) =>
      v < 0
        ? "الأجر الفعلي أقل من المعياري — وفر في تكاليف العمالة."
        : v > 0
        ? "الأجر الفعلي أعلى من المعياري — تكلفة إضافية (ساعات إضافية، علاوات...)."
        : "الأجر الساعي مطابق للمعيار.",
    qtyVarExplainFr: (v) =>
      v < 0
        ? "Le temps réel est inférieur au standard — productivité supérieure aux attentes."
        : v > 0
        ? "Le temps réel dépasse le standard — productivité insuffisante ou retards."
        : "Temps de travail conforme au standard.",
    qtyVarExplainAr: (v) =>
      v < 0
        ? "وقت العمل الفعلي أقل من المعياري — إنتاجية تفوق التوقعات."
        : v > 0
        ? "وقت العمل الفعلي أكثر من المعياري — إنتاجية منخفضة أو تأخيرات."
        : "وقت العمل مطابق للمعيار.",
  },
};

// ── Formatting helper ─────────────────────────────────────────────────────────
function fmtDA(n: number, lang: string): string {
  const locale = lang === "ar" ? "ar-DZ" : "fr-DZ";
  const abs = Math.abs(n);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const formatted = abs.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}\u202F${formatted} DA`;
}

// ── VarianceCard sub-component ────────────────────────────────────────────────
interface VCardProps {
  title: string;
  subtitleFr: string;
  subtitleAr: string;
  value: number;
  favorable: boolean | null;
  explanation: string;
  language: string;
  isAr: boolean;
  isTotal?: boolean;
}

function VarianceCard({ title, subtitleFr, subtitleAr, value, favorable, explanation, language, isAr, isTotal }: VCardProps) {
  const colorBorder =
    favorable === null ? "border-border" : favorable ? "border-green-300 dark:border-green-700" : "border-red-300 dark:border-red-700";
  const colorBg =
    favorable === null ? "bg-card" : favorable ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20";
  const colorValue =
    favorable === null ? "text-foreground" : favorable ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400";
  const badgeBg =
    favorable === null ? "bg-muted text-muted-foreground" : favorable ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  const badgeLabel =
    favorable === null ? { fr: "Neutre", ar: "محايد" } : favorable ? { fr: "Favorable ✓", ar: "مُلائم ✓" } : { fr: "Défavorable ✗", ar: "غير مُلائم ✗" };
  const Icon = favorable === null ? Minus : favorable ? TrendingUp : TrendingDown;
  const iconColor = favorable === null ? "text-muted-foreground" : favorable ? "text-green-600" : "text-red-600";

  return (
    <Card className={cn("border-2 transition-all flex flex-col", colorBorder, colorBg, isTotal && "ring-1 ring-primary/20")}>
      <CardContent className="pt-5 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className={cn("flex items-start justify-between gap-2", isAr && "flex-row-reverse")}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">
              {title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAr ? subtitleAr : subtitleFr}
            </p>
          </div>
          <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", iconColor)} />
        </div>

        {/* Value */}
        <div className={cn("text-2xl font-bold tabular-nums leading-none", colorValue, isAr ? "text-right" : "text-left")}>
          {fmtDA(value, language)}
        </div>

        {/* Badge */}
        <span className={cn("self-start inline-flex text-xs font-bold px-2.5 py-1 rounded-full", badgeBg)}>
          {isAr ? badgeLabel.ar : badgeLabel.fr}
        </span>

        {/* Explanation */}
        <p className={cn("text-xs text-muted-foreground leading-relaxed border-t pt-3 mt-auto", isAr && "text-right")}>
          {explanation}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VarianceAnalysis() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const [analysisType, setAnalysisType] = useState<AnalysisType>("revenue");
  const [standardPrice, setStandardPrice] = useState("");
  const [standardQty,   setStandardQty]   = useState("");
  const [actualPrice,   setActualPrice]   = useState("");
  const [actualQty,     setActualQty]     = useState("");
  const [result,  setResult]  = useState<VarianceResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const cfg = CONFIGS[analysisType];

  function handleCalculate() {
    const sp = parseFloat(standardPrice.replace(",", "."));
    const sq = parseFloat(standardQty.replace(",", "."));
    const ap = parseFloat(actualPrice.replace(",", "."));
    const aq = parseFloat(actualQty.replace(",", "."));

    if ([sp, sq, ap, aq].some(isNaN)) {
      setError(t(
        "Veuillez remplir tous les champs avec des valeurs numériques valides.",
        "يرجى ملء جميع الحقول بقيم رقمية صحيحة."
      ));
      setResult(null);
      return;
    }
    if ([sp, sq, ap, aq].some((v) => v < 0)) {
      setError(t("Les valeurs ne peuvent pas être négatives.", "لا يمكن أن تكون القيم سالبة."));
      setResult(null);
      return;
    }
    setError(null);
    setResult(computeVariances(sp, sq, ap, aq));
  }

  function handleReset() {
    setStandardPrice("");
    setStandardQty("");
    setActualPrice("");
    setActualQty("");
    setResult(null);
    setError(null);
  }

  function handleTypeChange(type: AnalysisType) {
    setAnalysisType(type);
    setResult(null);
    setError(null);
  }

  /** Returns null for zero, true for favorable, false for unfavorable */
  function isFavorable(value: number): boolean | null {
    if (value === 0) return null;
    return cfg.favorableWhen === "positive" ? value > 0 : value < 0;
  }

  const canCalculate = [standardPrice, standardQty, actualPrice, actualQty].every((v) => v.trim() !== "");

  return (
    <div
      className={cn("container mx-auto px-4 py-8 space-y-8 max-w-5xl", isAr ? "rtl" : "ltr")}
      dir={isAr ? "rtl" : "ltr"}
    >

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="bg-primary text-primary-foreground rounded-xl p-8 md:p-12 shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-primary-foreground/15 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Scale className="w-4 h-4" />
            {t("Module — Analyse des Écarts", "وحدة — تحليل الانحرافات")}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            {t("Analyse des Écarts", "تحليل الانحرافات")}
          </h1>
          <p className="text-primary-foreground/80 text-lg mb-6 max-w-2xl leading-relaxed">
            {t(
              "Calculez et interprétez les écarts entre données prévisionnelles (standards) et données réelles — pour les revenus, les matières premières ou la main-d'œuvre.",
              "احسب وافسّر الانحرافات بين البيانات المعيارية والفعلية — للإيرادات أو المواد الأولية أو اليد العاملة."
            )}
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-primary-foreground/70">
            {[
              { fr: "Écart sur Prix", ar: "انحراف السعر" },
              { fr: "Écart sur Quantité", ar: "انحراف الكمية" },
              { fr: "Écart Total", ar: "الانحراف الإجمالي" },
            ].map((item) => (
              <span key={item.fr} className="inline-flex items-center gap-1.5 bg-primary-foreground/10 rounded-full px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-300" />
                {isAr ? item.ar : item.fr}
              </span>
            ))}
          </div>
        </div>
        {/* background decoration */}
        <div className="absolute -right-20 -bottom-20 opacity-10 pointer-events-none" aria-hidden>
          <Scale className="w-80 h-80" />
        </div>
      </section>

      {/* ── Analysis Type Selector ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {t("Type d'analyse", "نوع التحليل")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {t(
              "Choisissez le contexte pour adapter les libellés et l'interprétation favorable / défavorable.",
              "اختر السياق لتكييف التسميات وتفسير الملاءمة / عدم الملاءمة."
            )}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["revenue", "materials", "labor"] as AnalysisType[]).map((type) => {
            const c = CONFIGS[type];
            const Icon = c.icon;
            const selected = analysisType === type;
            return (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  selected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className={isAr ? "text-right" : "text-left"}>
                  <div className={cn("font-semibold text-sm", selected ? "text-primary" : "text-foreground")}>
                    {isAr ? c.nameAr : c.nameFr}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {isAr ? c.descAr : c.descFr}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Input Form ───────────────────────────────────────────────────────── */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className={cn("flex items-center gap-2 text-lg", isAr && "flex-row-reverse")}>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            {t("Données d'entrée", "بيانات الإدخال")}
          </CardTitle>
          <CardDescription>
            {t(
              "Saisissez les valeurs standards (prévisionnelles) et réelles (observées).",
              "أدخل القيم المعيارية (التوقعية) والفعلية (المُلاحَظة)."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Two-column: Standard | Actual */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Standard column */}
            <div className="space-y-4">
              <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
                <div className="h-0.5 flex-1 bg-border rounded" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap px-1">
                  {t("Standard — Prévisionnel", "المعياري — التوقعي")}
                </span>
                <div className="h-0.5 flex-1 bg-border rounded" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sp" className="text-sm font-medium">
                  {isAr ? cfg.priceLabelAr : cfg.priceLabelFr}
                </Label>
                <div className="relative">
                  <Input
                    id="sp"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={standardPrice}
                    onChange={(e) => setStandardPrice(e.target.value)}
                    className={isAr ? "text-right pl-20" : "pr-20"}
                  />
                  <span className={cn("absolute top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none", isAr ? "left-3" : "right-3")}>
                    {isAr ? cfg.priceUnitAr : cfg.priceUnitFr}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sq" className="text-sm font-medium">
                  {isAr ? cfg.qtyLabelAr : cfg.qtyLabelFr}
                </Label>
                <div className="relative">
                  <Input
                    id="sq"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={standardQty}
                    onChange={(e) => setStandardQty(e.target.value)}
                    className={isAr ? "text-right pl-20" : "pr-20"}
                  />
                  <span className={cn("absolute top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none", isAr ? "left-3" : "right-3")}>
                    {isAr ? cfg.qtyUnitAr : cfg.qtyUnitFr}
                  </span>
                </div>
              </div>
            </div>

            {/* Actual column */}
            <div className="space-y-4">
              <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
                <div className="h-0.5 flex-1 bg-primary/30 rounded" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary whitespace-nowrap px-1">
                  {t("Réel — Observé", "الفعلي — المُلاحَظ")}
                </span>
                <div className="h-0.5 flex-1 bg-primary/30 rounded" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ap" className="text-sm font-medium">
                  {isAr ? cfg.priceLabelAr : cfg.priceLabelFr}
                </Label>
                <div className="relative">
                  <Input
                    id="ap"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={actualPrice}
                    onChange={(e) => setActualPrice(e.target.value)}
                    className={isAr ? "text-right pl-20" : "pr-20"}
                  />
                  <span className={cn("absolute top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none", isAr ? "left-3" : "right-3")}>
                    {isAr ? cfg.priceUnitAr : cfg.priceUnitFr}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aq" className="text-sm font-medium">
                  {isAr ? cfg.qtyLabelAr : cfg.qtyLabelFr}
                </Label>
                <div className="relative">
                  <Input
                    id="aq"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={actualQty}
                    onChange={(e) => setActualQty(e.target.value)}
                    className={isAr ? "text-right pl-20" : "pr-20"}
                  />
                  <span className={cn("absolute top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none", isAr ? "left-3" : "right-3")}>
                    {isAr ? cfg.qtyUnitAr : cfg.qtyUnitFr}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className={cn("flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm", isAr && "flex-row-reverse text-right")}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className={cn("flex gap-3 pt-1", isAr && "flex-row-reverse")}>
            <Button
              onClick={handleCalculate}
              disabled={!canCalculate}
              className="flex-1 sm:flex-none sm:px-8 gap-2"
            >
              <Scale className="w-4 h-4" />
              {t("Calculer les écarts", "احسب الانحرافات")}
            </Button>
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              {t("Réinitialiser", "إعادة تعيين")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      {result && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {t("Résultats", "النتائج")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {cfg.favorableWhen === "positive"
                ? t("Convention : positif = favorable (plus de revenu).", "الاتفاقية: موجب = ملائم (إيراد أكثر).")
                : t("Convention : négatif = favorable (moins de coût).", "الاتفاقية: سالب = ملائم (تكلفة أقل).")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Price/Rate variance */}
            <VarianceCard
              title={isAr ? cfg.priceVarNameAr : cfg.priceVarNameFr}
              subtitleFr={`(Prix réel − Standard) × Qté réelle`}
              subtitleAr={`(السعر الفعلي − المعياري) × الكمية الفعلية`}
              value={result.priceVariance}
              favorable={isFavorable(result.priceVariance)}
              explanation={
                isAr
                  ? cfg.priceVarExplainAr(result.priceVariance)
                  : cfg.priceVarExplainFr(result.priceVariance)
              }
              language={language}
              isAr={isAr}
            />

            {/* Quantity/Volume variance */}
            <VarianceCard
              title={isAr ? cfg.qtyVarNameAr : cfg.qtyVarNameFr}
              subtitleFr={`(Qté réelle − Standard) × Prix standard`}
              subtitleAr={`(الكمية الفعلية − المعيارية) × السعر المعياري`}
              value={result.quantityVariance}
              favorable={isFavorable(result.quantityVariance)}
              explanation={
                isAr
                  ? cfg.qtyVarExplainAr(result.quantityVariance)
                  : cfg.qtyVarExplainFr(result.quantityVariance)
              }
              language={language}
              isAr={isAr}
            />

            {/* Total variance */}
            <VarianceCard
              title={t("Écart Total", "الانحراف الإجمالي")}
              subtitleFr="Écart Prix + Écart Quantité"
              subtitleAr="انحراف السعر + انحراف الكمية"
              value={result.totalVariance}
              favorable={isFavorable(result.totalVariance)}
              explanation={
                result.totalVariance === 0
                  ? t("Aucun écart global — performance parfaitement conforme au standard.", "لا انحراف إجمالي — الأداء مطابق تمامًا للمعيار.")
                  : isFavorable(result.totalVariance)
                  ? t(
                      "L'écart total est favorable — la performance réelle dépasse les standards.",
                      "الانحراف الإجمالي مُلائم — الأداء الفعلي يتجاوز المعايير."
                    )
                  : t(
                      "L'écart total est défavorable — des actions correctives sont recommandées.",
                      "الانحراف الإجمالي غير مُلائم — يُنصح باتخاذ إجراءات تصحيحية."
                    )
              }
              language={language}
              isAr={isAr}
              isTotal
            />
          </div>

          {/* Formula reference card */}
          <Card className="bg-muted/30 border-dashed border-muted-foreground/20">
            <CardContent className="pt-5 pb-4">
              <p className={cn("text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3", isAr && "text-right")}>
                {t("Formules appliquées", "الصيغ المُطبَّقة")}
              </p>
              <div className={cn("space-y-2 text-sm font-mono text-muted-foreground", isAr && "text-right")}>
                <div>
                  <span className="font-semibold text-foreground">
                    {isAr ? cfg.priceVarNameAr : cfg.priceVarNameFr}
                  </span>
                  {" = "}
                  {t(
                    `(${actualPrice} − ${standardPrice}) × ${actualQty} = `,
                    `(${actualPrice} − ${standardPrice}) × ${actualQty} = `
                  )}
                  <span className={cn("font-bold", isFavorable(result.priceVariance) === true ? "text-green-600" : isFavorable(result.priceVariance) === false ? "text-red-600" : "")}>
                    {fmtDA(result.priceVariance, language)}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-foreground">
                    {isAr ? cfg.qtyVarNameAr : cfg.qtyVarNameFr}
                  </span>
                  {" = "}
                  {t(
                    `(${actualQty} − ${standardQty}) × ${standardPrice} = `,
                    `(${actualQty} − ${standardQty}) × ${standardPrice} = `
                  )}
                  <span className={cn("font-bold", isFavorable(result.quantityVariance) === true ? "text-green-600" : isFavorable(result.quantityVariance) === false ? "text-red-600" : "")}>
                    {fmtDA(result.quantityVariance, language)}
                  </span>
                </div>
                <div className="border-t border-dashed border-muted-foreground/20 pt-2">
                  <span className="font-semibold text-foreground">
                    {t("Écart Total", "الانحراف الإجمالي")}
                  </span>
                  {" = "}
                  <span className={cn("font-bold text-base", isFavorable(result.totalVariance) === true ? "text-green-600" : isFavorable(result.totalVariance) === false ? "text-red-600" : "text-foreground")}>
                    {fmtDA(result.totalVariance, language)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Spacer at bottom */}
      <div className="h-4" />
    </div>
  );
}
