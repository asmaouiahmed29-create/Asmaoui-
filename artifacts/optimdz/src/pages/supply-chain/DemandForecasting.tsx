import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Plus, Trash2, Calculator, Save, FileText,
  CheckCircle2, Loader2, BarChart2, ShoppingBag, Factory,
  Leaf, Monitor, PencilRuler, Lightbulb, RefreshCw,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  computeForecast,
  type ForecastMode, type ForecastProduct, type ForecastResult,
} from "@/lib/forecastAlgorithm";
import { generateForecastPDF } from "@/lib/generateForecastPDF";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fNum(n: number, d = 1): string {
  return n.toLocaleString("fr-DZ", { maximumFractionDigits: d });
}
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function nextId(existing: string[]): string {
  for (const ch of LETTERS) if (!existing.includes(ch)) return ch;
  return `Z${existing.length}`;
}

// ── Sector config ─────────────────────────────────────────────────────────────
type SectorKey = "commerce" | "industry" | "agriculture" | "services" | "custom";
interface Sector {
  id: SectorKey;
  icon: React.ElementType;
  nameAr: string; nameFr: string;
  descAr: string; descFr: string;
}
const SECTORS: Sector[] = [
  { id: "commerce",    icon: ShoppingBag, nameAr: "التجارة",    nameFr: "Commerce",    descAr: "بضائع استهلاكية",       descFr: "Biens de consommation" },
  { id: "industry",   icon: Factory,     nameAr: "الصناعة",    nameFr: "Industrie",   descAr: "مواد أولية وقطع غيار", descFr: "Matières & pièces"     },
  { id: "agriculture",icon: Leaf,        nameAr: "الفلاحة",    nameFr: "Agriculture", descAr: "مستلزمات فلاحية",      descFr: "Intrants agricoles"    },
  { id: "services",   icon: Monitor,     nameAr: "الخدمات",    nameFr: "Services",    descAr: "مستلزمات مكتبية",      descFr: "Fournitures bureau"    },
  { id: "custom",     icon: PencilRuler, nameAr: "مخصص",      nameFr: "Personnalisé",descAr: "إدخال حر",              descFr: "Saisie libre"          },
];

const DEFAULT_ALPHA  = 0.3;
const DEFAULT_WINDOW = 3;
const PERIODS_12 = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];

function mkProduct(id: string, name: string, vals: number[], windowSize = DEFAULT_WINDOW, alpha = DEFAULT_ALPHA): ForecastProduct {
  return { id, name, history: vals.map((v, i) => ({ period: PERIODS_12[i], value: v })), windowSize, alpha };
}

const TEMPLATES: Record<SectorKey, ForecastProduct[]> = {
  commerce: [
    mkProduct("A", "هواتف / Smartphones",   [420,390,450,480,510,530,490,560,600,580,620,650]),
    mkProduct("B", "ملابس / Vêtements",      [800,780,900,1100,970,850,760,720,880,1050,1200,1400]),
  ],
  industry: [
    mkProduct("A", "صلب / Acier plat",       [1800,1750,1900,2000,1950,2100,2050,2200,2150,2300,2250,2400]),
    mkProduct("B", "بلاستيك / Plastique ABS",[950,920,1000,1050,980,1100,1080,1150,1120,1200,1180,1250]),
  ],
  agriculture: [
    mkProduct("A", "أسمدة / Engrais",        [200,210,350,480,420,300,180,160,200,280,320,260]),
    mkProduct("B", "بذور / Semences",         [50,60,200,380,280,100,40,30,50,120,180,90]),
  ],
  services: [
    mkProduct("A", "ورق / Papier A4",        [1200,1150,1300,1250,1400,1350,1100,1050,1300,1350,1450,1500]),
    mkProduct("B", "أحبار / Cartouches",      [180,170,200,190,220,210,160,155,195,210,230,240]),
  ],
  custom: [
    mkProduct("A", "", [0,0,0,0,0,0,0,0,0,0,0,0]),
    mkProduct("B", "", [0,0,0,0,0,0,0,0,0,0,0,0]),
  ],
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function DemandForecasting() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const [sector, setSector]           = useState<SectorKey | null>(null);
  const [mode, setMode]               = useState<ForecastMode>("moving-average");
  const [problemName, setProblemName] = useState("");
  const [products, setProducts]       = useState<ForecastProduct[]>(TEMPLATES.commerce.map(p => ({ ...p })));
  const [results, setResults]         = useState<ForecastResult[] | null>(null);
  const [resultStale, setResultStale] = useState(false);

  const [isSaving, setIsSaving]       = useState(false);
  const [savedOk, setSavedOk]         = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (results) setResultStale(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, mode]);

  // ── Sector select ────────────────────────────────────────────────────────────
  function handleSector(key: SectorKey) {
    setSector(key);
    setProducts(TEMPLATES[key].map(p => JSON.parse(JSON.stringify(p))));
    setResults(null); setResultStale(false);
    if (key !== "custom") {
      const names: Record<string, string> = {
        commerce:    isAr ? "تنبؤ بطلب — التجارة"    : "Prévision Demande — Commerce",
        industry:    isAr ? "تنبؤ بطلب — الصناعة"    : "Prévision Demande — Industrie",
        agriculture: isAr ? "تنبؤ بطلب — الفلاحة"    : "Prévision Demande — Agriculture",
        services:    isAr ? "تنبؤ بطلب — الخدمات"    : "Prévision Demande — Services",
      };
      setProblemName(names[key] ?? "");
    } else {
      setProblemName("");
    }
  }

  // ── Product helpers ──────────────────────────────────────────────────────────
  function updateProduct(idx: number, patch: Partial<ForecastProduct>) {
    setProducts(prev => { const a = [...prev]; a[idx] = { ...a[idx], ...patch }; return a; });
  }
  function updateHistoryValue(pidx: number, hidx: number, val: number) {
    setProducts(prev => {
      const a = [...prev];
      const hist = [...a[pidx].history];
      hist[hidx] = { ...hist[hidx], value: val };
      a[pidx] = { ...a[pidx], history: hist };
      return a;
    });
  }
  function updatePeriodLabel(pidx: number, hidx: number, label: string) {
    setProducts(prev => {
      const a = [...prev];
      const hist = [...a[pidx].history];
      hist[hidx] = { ...hist[hidx], period: label };
      a[pidx] = { ...a[pidx], history: hist };
      return a;
    });
  }
  function addPeriodToProduct(pidx: number) {
    setProducts(prev => {
      const a = [...prev];
      const hist = [...a[pidx].history];
      const lastLabel = hist[hist.length - 1]?.period ?? "T0";
      const match = lastLabel.match(/(\d+)$/);
      const nextLabel = match ? lastLabel.replace(/(\d+)$/, String(Number(match[1]) + 1)) : lastLabel + "+1";
      hist.push({ period: nextLabel, value: 0 });
      a[pidx] = { ...a[pidx], history: hist };
      return a;
    });
  }
  function removePeriodFromProduct(pidx: number, hidx: number) {
    setProducts(prev => {
      const a = [...prev];
      if (a[pidx].history.length <= 2) return a;
      const hist = a[pidx].history.filter((_, i) => i !== hidx);
      a[pidx] = { ...a[pidx], history: hist };
      return a;
    });
  }
  function addProduct() {
    const id = nextId(products.map(p => p.id));
    const sample = products[0]?.history.map(h => ({ period: h.period, value: 0 }))
      ?? PERIODS_12.slice(0, 6).map(p => ({ period: p, value: 0 }));
    setProducts([...products, { id, name: "", history: sample, windowSize: DEFAULT_WINDOW, alpha: DEFAULT_ALPHA }]);
  }
  function removeProduct(idx: number) {
    if (products.length <= 1) return;
    setProducts(products.filter((_, i) => i !== idx));
  }

  // ── Solve ────────────────────────────────────────────────────────────────────
  function handleSolve() {
    setResultStale(false);
    const res = computeForecast(products, mode);
    setResults(res);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  // ── Analysis ─────────────────────────────────────────────────────────────────
  function buildAnalysisLines(): string[] {
    if (!results) return [];
    const avgMAE  = results.reduce((s, r) => s + r.mae,  0) / results.length;
    const avgMAPE = results.reduce((s, r) => s + r.mape, 0) / results.length;
    const rising  = results.filter(r => r.trend === "increasing");
    const falling = results.filter(r => r.trend === "decreasing");
    const stable  = results.filter(r => r.trend === "stable");
    const highVol = results.filter(r => r.volatility === "high");

    const modeName = mode === "moving-average"
      ? t("Moyenne Mobile", "المتوسط المتحرك")
      : t("Lissage Exponentiel Simple", "التمهيد الأسي البسيط");

    const lines: string[] = [
      t(
        `L'analyse porte sur ${results.length} produit(s) avec le modèle ${modeName}. MAE moyen : ${fNum(avgMAE, 1)} unités — MAPE moyen : ${fNum(avgMAPE, 1)}%.`,
        `التحليل يشمل ${results.length} منتج(ات) باستخدام نموذج ${modeName}. متوسط الخطأ المطلق (MAE): ${fNum(avgMAE, 1)} وحدة — متوسط نسبة الخطأ (MAPE): ${fNum(avgMAPE, 1)}%.`
      ),
    ];
    if (rising.length > 0) lines.push(t(
      `Produits à demande croissante : ${rising.map(r => r.name).join(", ")} — il convient d'augmenter les niveaux de stock par anticipation.`,
      `المنتجات ذات الطلب المتصاعد: ${rising.map(r => r.name).join("، ")} — يُستحسن رفع مستويات التخزين استباقياً.`
    ));
    if (falling.length > 0) lines.push(t(
      `Produits à demande décroissante : ${falling.map(r => r.name).join(", ")} — révisez la politique d'approvisionnement pour éviter le sur-stockage.`,
      `المنتجات ذات الطلب المتراجع: ${falling.map(r => r.name).join("، ")} — راجع سياسة الطلب لتجنّب فائض المخزون.`
    ));
    if (stable.length > 0) lines.push(t(
      `Produits à demande stable : ${stable.map(r => r.name).join(", ")} — niveau régulier facilitant la planification des achats.`,
      `المنتجات ذات الطلب المستقر: ${stable.map(r => r.name).join("، ")} — مستوى ثابت يُسهّل تخطيط المشتريات.`
    ));
    if (highVol.length > 0) lines.push(t(
      `Produits à forte volatilité : ${highVol.map(r => r.name).join(", ")} — un stock de sécurité plus élevé est recommandé.`,
      `منتجات ذات تقلب مرتفع: ${highVol.map(r => r.name).join("، ")} — يُنصح بمخزون أمان أعلى لامتصاص هذا التقلب.`
    ));
    return lines;
  }

  function buildSuggestions(): { icon: string; title: string; desc: string; color: string; borderColor: string }[] {
    if (!results) return [];
    const highVol = results.filter(r => r.volatility === "high");
    const rising  = results.filter(r => r.trend === "increasing");
    const avgMAPE = results.reduce((s, r) => s + r.mape, 0) / results.length;

    const sugs: { icon: string; title: string; desc: string; color: string; borderColor: string }[] = [];

    if (avgMAPE < 10) {
      sugs.push({
        icon: "✅", color: "bg-green-50", borderColor: "border-l-green-500",
        title: t("Précision de prévision satisfaisante", "دقة التنبؤ جيدة"),
        desc: t(
          `Le MAPE moyen (${fNum(avgMAPE, 1)}%) est dans la plage acceptable (< 10 %). Ces prévisions peuvent être utilisées de façon fiable pour la planification des stocks et des achats.`,
          `متوسط نسبة الخطأ (MAPE = ${fNum(avgMAPE, 1)}%) ضمن النطاق المقبول (أقل من 10%). يمكن الاعتماد على هذه التنبؤات في تخطيط المخزون والمشتريات.`
        ),
      });
    } else if (avgMAPE < 25) {
      sugs.push({
        icon: "⚠️", color: "bg-amber-50", borderColor: "border-l-amber-500",
        title: t("Précision moyenne — enrichissez les données", "دقة تنبؤ متوسطة — أضف بيانات أكثر"),
        desc: t(
          `MAPE = ${fNum(avgMAPE, 1)}% — précision modérée. Augmenter le nombre de périodes historiques (≥18) améliorerait les prévisions. Vérifiez aussi les effets saisonniers.`,
          `MAPE = ${fNum(avgMAPE, 1)}% — دقة معتدلة. زيادة عدد الفترات التاريخية (≥18 فترة) ستحسّن التنبؤ. تحقّق أيضاً من وجود أنماط موسمية.`
        ),
      });
    } else {
      sugs.push({
        icon: "🔴", color: "bg-red-50", borderColor: "border-l-red-500",
        title: t("Erreur élevée — révisez les données", "خطأ تنبؤ مرتفع — راجع البيانات"),
        desc: t(
          `MAPE = ${fNum(avgMAPE, 1)}% — erreur élevée indiquant que le modèle actuel ne correspond pas bien aux données. Essayez l'autre modèle ou vérifiez les valeurs aberrantes.`,
          `MAPE = ${fNum(avgMAPE, 1)}% — خطأ مرتفع يشير إلى عدم ملاءمة النموذج. جرّب النموذج الآخر أو راجع البيانات التاريخية بحثاً عن قيم شاذة.`
        ),
      });
    }

    if (rising.length > 0) {
      sugs.push({
        icon: "📈", color: "bg-blue-50", borderColor: "border-l-blue-500",
        title: t(
          `Anticiper la hausse : ${rising.map(r => r.name).join(", ")}`,
          `استعداداً للطلب المتزايد: ${rising.map(r => r.name).join("، ")}`
        ),
        desc: t(
          `Ces produits montrent une tendance haussière. Révisez les niveaux EOQ et les points de commande, et anticipez des négociations fournisseurs pour sécuriser des volumes plus importants.`,
          `هذه المنتجات تُظهر اتجاهاً صاعداً. راجع مستويات EOQ وعتبات إعادة الطلب وأعدّ تفاوضاً مع الموردين لتأمين كميات أكبر.`
        ),
      });
    }

    if (highVol.length > 0) {
      sugs.push({
        icon: "🛡️", color: "bg-amber-50", borderColor: "border-l-amber-500",
        title: t(
          `Stock de sécurité renforcé : ${highVol.map(r => r.name).join(", ")}`,
          `مخزون أمان أعلى: ${highVol.map(r => r.name).join("، ")}`
        ),
        desc: t(
          `Ces produits affichent une forte variabilité de la demande. Augmentez le stock de sécurité de 30 à 50% et adoptez une politique de commande flexible révisée mensuellement.`,
          `هذه المنتجات تُعاني من تقلب مرتفع في الطلب. يُنصح برفع مخزون الأمان بنسبة 30-50% واعتماد سياسة طلب مرنة تراجع شهرياً.`
        ),
      });
    }

    if (sugs.length < 3) {
      sugs.push({
        icon: "🔄", color: "bg-green-50", borderColor: "border-l-green-500",
        title: t("Révision périodique du modèle", "مراجعة دورية للنموذج"),
        desc: t(
          "La prévision de la demande n'est pas une opération ponctuelle — mettez à jour les données historiques mensuellement et relancez le calcul. Comparez les deux modèles pour choisir le plus précis.",
          "التنبؤ بالطلب ليس لمرة واحدة — حدّث البيانات التاريخية شهرياً وأعد الحساب. قارن نموذجَي المتوسط المتحرك والتمهيد الأسي على بيانات جديدة لاختيار الأدق."
        ),
      });
    }

    return sugs.slice(0, 3);
  }

  const analysisLines = results ? buildAnalysisLines() : [];
  const suggestions   = results ? buildSuggestions()   : [];

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!results) return;
    setIsSaving(true); setSavedOk(false); setSaveError(null);
    try {
      const body = { type: "demand-forecast", mode, problemName, sector: sector ?? "custom", results };
      const res  = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemData: body, result: body }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : t("Erreur", "خطأ"));
    } finally {
      setIsSaving(false);
    }
  }

  // ── PDF ───────────────────────────────────────────────────────────────────────
  async function handlePDF() {
    if (!results) return;
    try {
      setPdfProgress(t("Génération en cours…", "جارٍ الإنشاء…"));
      await generateForecastPDF({
        mode,
        problemName: problemName || t("Prévision de la Demande", "تنبؤ بالطلب"),
        sector: sector ? (SECTORS.find(s => s.id === sector)?.[isAr ? "nameAr" : "nameFr"] ?? sector) : "—",
        results,
        analysisLines,
        suggestions,
        onProgress: (step) => setPdfProgress(step),
      });
    } finally {
      setPdfProgress(null);
    }
  }

  const hasResults = !!results;

  // ── Translated labels (computed once per render so t() is always in scope) ──
  const modeLabels: Record<ForecastMode, string> = {
    "moving-average": t("Moyenne Mobile", "المتوسط المتحرك"),
    "exponential":    t("Lissage Exponentiel Simple", "التمهيد الأسي البسيط"),
  };
  const trendLabels = {
    increasing: t("↑ Haussier", "↑ صاعد"),
    decreasing: t("↓ Baissier", "↓ هابط"),
    stable:     t("→ Stable",   "→ مستقر"),
  };
  const volLabels = {
    high:   t("Élevée",  "مرتفع"),
    medium: t("Moyenne", "متوسط"),
    low:    t("Faible",  "منخفض"),
  };
  const volColors = { high: "text-red-600", medium: "text-amber-600", low: "text-green-600" };
  const chartActualLabel   = t("Réel",      "الفعلي");
  const chartForecastLabel = t("Prévision", "التنبؤ");

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className={cn("container mx-auto px-4 py-8 max-w-6xl space-y-8", isAr ? "rtl" : "ltr")} dir={isAr ? "rtl" : "ltr"}>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2 bg-primary/10 rounded-xl text-primary">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {t("Prévision de la Demande", "التنبؤ بالطلب")}
          </h1>
          <Badge variant="secondary">{modeLabels[mode]}</Badge>
        </div>
        <p className="text-muted-foreground ps-14">
          {t(
            "Calculez les prévisions de demande par Moyenne Mobile ou Lissage Exponentiel Simple.",
            "احسب تنبؤات الطلب بطريقة المتوسط المتحرك أو التمهيد الأسي البسيط."
          )}
        </p>
      </div>

      {/* ── 1. Sector ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t("Secteur d'activité", "قطاع النشاط")}</CardTitle>
          <CardDescription>
            {t("Choisissez un secteur pour pré-remplir un exemple.", "اختر قطاعاً لتعبئة مثال تلقائياً.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {SECTORS.map(sec => {
              const Icon = sec.icon;
              const active = sector === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => handleSector(sec.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all cursor-pointer",
                    sec.id === "custom" ? "border-2 border-dashed" : "",
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center transition-colors", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={cn("text-sm font-semibold", active ? "text-primary" : "text-foreground")}>
                    {isAr ? sec.nameAr : sec.nameFr}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                    {isAr ? sec.descAr : sec.descFr}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Config ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t("Configuration de l'analyse", "إعداد التحليل")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("Nom du problème", "اسم المسألة")}</Label>
              <Input
                value={problemName}
                onChange={e => setProblemName(e.target.value)}
                placeholder={t("Ex : Prévision stock entrepôt Constantine", "مثال: تنبؤ طلب مستودع قسنطينة")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Méthode de prévision", "نوع طريقة التنبؤ")}</Label>
              <div className="flex rounded-lg border border-border overflow-hidden h-10">
                {(["moving-average", "exponential"] as ForecastMode[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setResults(null); setResultStale(false); }}
                    className={cn(
                      "flex-1 text-xs font-semibold transition-colors px-2 truncate",
                      mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {modeLabels[m]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Method description */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            {mode === "moving-average" && t(
              "Moyenne Mobile = moyenne des N dernières périodes. Lisse les fluctuations et révèle la tendance. N petit → réactivité élevée ; N grand → lissage plus fort.",
              "المتوسط المتحرك = متوسط آخر N فترات. يُخفّف التذبذبات ويُظهر الاتجاه العام. N أصغر → استجابة أسرع؛ N أكبر → تنعيم أقوى."
            )}
            {mode === "exponential" && t(
              "Lissage exponentiel : F(t+1) = α × D(t) + (1-α) × F(t). α proche de 1 → forte réactivité ; α proche de 0 → prévisions plus stables.",
              "التمهيد الأسي: F(t+1) = α × D(t) + (1-α) × F(t). α قريب من 1 → تتبع سريع للتغيرات؛ α قريب من 0 → تنبؤ أكثر استقراراً."
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Products ──────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("Données de Demande Historique", "بيانات الطلب التاريخي")}</h2>
          <Button type="button" variant="outline" size="sm" onClick={addProduct} className="gap-1.5">
            <Plus className="w-4 h-4" />{t("Ajouter un produit", "إضافة منتج")}
          </Button>
        </div>

        {products.map((p, pidx) => (
          <Card key={p.id} className="border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary font-bold text-sm shrink-0 mt-0.5">{p.id}</span>
                <div className="flex-1 grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("Nom du produit", "اسم المنتج")}</Label>
                    <Input
                      value={p.name}
                      onChange={e => updateProduct(pidx, { name: e.target.value })}
                      placeholder={t("Nom du produit ou service", "اسم المنتج أو الخدمة")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    {mode === "moving-average" ? (
                      <>
                        <Label className="text-xs">{t("Taille de fenêtre N (périodes)", "حجم النافذة N (عدد الفترات)")}</Label>
                        <Input
                          type="number" min={1} max={p.history.length}
                          value={p.windowSize}
                          onChange={e => updateProduct(pidx, { windowSize: Math.max(1, Number(e.target.value)) })}
                          className="h-8 text-sm"
                        />
                      </>
                    ) : (
                      <>
                        <Label className="text-xs">{t("Coefficient de lissage α (0 → 1)", "معامل التمهيد α (0 → 1)")}</Label>
                        <Input
                          type="number" min={0.01} max={0.99} step={0.05}
                          value={p.alpha}
                          onChange={e => updateProduct(pidx, { alpha: Math.max(0.01, Math.min(0.99, Number(e.target.value))) })}
                          className="h-8 text-sm"
                        />
                      </>
                    )}
                  </div>
                </div>
                {products.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeProduct(pidx)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors shrink-0 mt-1"
                    title={t("Supprimer le produit", "حذف المنتج")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start w-28">{t("Période", "الفترة")}</th>
                      <th className="px-3 py-2 text-center border-s border-primary/20 text-primary/80">
                        {t("Demande réelle (unités)", "الطلب الفعلي (وحدة)")}
                      </th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {p.history.map((h, hidx) => (
                      <tr key={hidx} className="hover:bg-muted/30">
                        <td className="px-2 py-1.5">
                          <Input
                            value={h.period}
                            onChange={e => updatePeriodLabel(pidx, hidx, e.target.value)}
                            className="h-7 text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5 border-s border-primary/10">
                          <Input
                            type="number" min={0}
                            value={h.value || ""}
                            onChange={e => updateHistoryValue(pidx, hidx, Number(e.target.value))}
                            className="h-7 text-sm text-center"
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <button
                            type="button"
                            onClick={() => removePeriodFromProduct(pidx, hidx)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                            title={t("Supprimer la période", "حذف الفترة")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                type="button" variant="ghost" size="sm"
                onClick={() => addPeriodToProduct(pidx)}
                className="mt-2 gap-1.5 text-xs h-7"
              >
                <Plus className="w-3.5 h-3.5" />{t("Ajouter une période", "إضافة فترة")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Solve ────────────────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button onClick={handleSolve} size="lg" className="gap-2 px-8">
          <Calculator className="w-5 h-5" />
          {t("Calculer la prévision", "حساب التنبؤ")}
          {resultStale && <RefreshCw className="w-4 h-4 opacity-60" />}
        </Button>
      </div>

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      {hasResults && results && (
        <div ref={resultsRef} className="space-y-6">

          {results.map(r => {
            const prod = products.find(p => p.id === r.id);
            return (
              <Card key={r.id} className="border-primary/30 shadow-md">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary font-bold">{r.id}</span>
                    <CardTitle className="text-lg flex-1">{r.name || `${t("Produit", "منتج")} ${r.id}`}</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {t("Tendance :", "الاتجاه:")} {trendLabels[r.trend]}
                      </Badge>
                      <Badge variant="outline" className={cn("text-xs", volColors[r.volatility])}>
                        {t("Volatilité :", "التقلب:")} {volLabels[r.volatility]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">MAE : {fNum(r.mae, 1)}</Badge>
                      <Badge variant="outline" className="text-xs">MAPE : {fNum(r.mape, 1)}%</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-5">

                  {/* Next-period forecast highlight */}
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("Prévision de la prochaine période", "تنبؤ الفترة القادمة")}</p>
                      <p className="text-3xl font-black text-primary">{fNum(r.nextForecast, 1)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("unités", "وحدة")}</p>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1 text-end">
                      <p>{t("Modèle :", "النموذج:")} {modeLabels[r.mode]}</p>
                      {r.mode === "moving-average"
                        ? <p>N = {prod?.windowSize ?? "—"} {t("périodes", "فترات")}</p>
                        : <p>α = {prod?.alpha ?? "—"}</p>
                      }
                    </div>
                  </div>

                  {/* Line chart */}
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-3">
                      {t("Graphique : Réel vs Prévision", "مخطط الطلب الفعلي مقابل التنبؤ")}
                    </p>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={r.dataPoints} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(1)+"k" : v} />
                        <Tooltip
                          formatter={(value: number | null, name: string) => [
                            value !== null ? fNum(value, 1) + " " + t("unités", "وحدة") : "—",
                            name === "actual" ? chartActualLabel : chartForecastLabel,
                          ]}
                        />
                        <Legend formatter={val => val === "actual" ? chartActualLabel : chartForecastLabel} />
                        <ReferenceLine
                          x={r.dataPoints[r.dataPoints.length - 2]?.period}
                          stroke="#f4a261"
                          strokeDasharray="4 4"
                          label={{ value: t("Prévision", "التنبؤ"), position: "insideTopRight", fontSize: 10, fill: "#f4a261" }}
                        />
                        <Line
                          type="monotone" dataKey="actual" name="actual"
                          stroke="#004d40" strokeWidth={2.5}
                          dot={{ r: 3, fill: "#004d40" }}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone" dataKey="forecast" name="forecast"
                          stroke="#f4a261" strokeWidth={2} strokeDasharray="5 5"
                          dot={{ r: 3, fill: "#f4a261" }}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Data table */}
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-center">{t("Période", "الفترة")}</th>
                          <th className="px-3 py-2 text-end text-primary/80">{t("Réel", "الفعلي")}</th>
                          <th className="px-3 py-2 text-end text-amber-600">{t("Prévision", "التنبؤ")}</th>
                          <th className="px-3 py-2 text-end text-muted-foreground">{t("Erreur abs.", "الخطأ المطلق")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {r.dataPoints.map((dp, i) => {
                          const isNext = i === r.dataPoints.length - 1;
                          const err = dp.actual !== null && dp.forecast !== null
                            ? Math.abs(dp.actual - dp.forecast)
                            : null;
                          return (
                            <tr key={i} className={cn("hover:bg-muted/30", isNext ? "bg-green-50/60 font-semibold" : "")}>
                              <td className="px-3 py-2 text-center font-mono text-xs">
                                {dp.period}{isNext && <span className="ms-1 text-green-600">★</span>}
                              </td>
                              <td className="px-3 py-2 text-end font-mono">
                                {dp.actual !== null ? fNum(dp.actual, 0) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className={cn("px-3 py-2 text-end font-mono", isNext ? "text-green-700 font-bold" : "text-amber-700")}>
                                {dp.forecast !== null ? fNum(dp.forecast, 1) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="px-3 py-2 text-end font-mono text-muted-foreground text-xs">
                                {err !== null ? fNum(err, 1) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                </CardContent>
              </Card>
            );
          })}

          {/* ── تحليل الوضع ─────────────────────────────────────────────────── */}
          <Card className="border-primary/20">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="flex items-center gap-3 text-xl">
                <span className="rounded-lg bg-primary/10 p-2 text-primary"><BarChart2 className="w-5 h-5" /></span>
                {t("Analyse de la Situation", "تحليل الوضع")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              {analysisLines.map((line, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border bg-primary/5 border-primary/20 p-4">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">{line}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── التوصيات الإدارية ────────────────────────────────────────────── */}
          {suggestions.length > 0 && (
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary"><Lightbulb className="w-5 h-5" /></span>
                  <span>
                    <span className="block">{t("Recommandations Managériales", "التوصيات الإدارية")}</span>
                    <span className="block text-sm font-normal text-muted-foreground mt-0.5">
                      {t("التوصيات الإدارية", "Recommandations Managériales")}
                    </span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                {suggestions.map((s, i) => (
                  <div key={i} className={cn("rounded-xl border-s-4 p-5 space-y-2", s.color, s.borderColor, isAr ? "border-s-0 border-e-4" : "")}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{s.icon}</span>
                      <p className="font-bold text-base">{s.title}</p>
                      <span className="ms-auto text-xs font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">#{i + 1}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── Actions ──────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3 justify-end">
            <Button variant="outline" onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : savedOk
                ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                : <Save className="w-4 h-4" />}
              {savedOk ? t("Enregistré ✓", "تم الحفظ ✓") : t("Sauvegarder", "حفظ في السجل")}
            </Button>
            {saveError && <span className="text-xs text-destructive self-center">{saveError}</span>}
            <Button onClick={handlePDF} disabled={!!pdfProgress} className="gap-2">
              {pdfProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {pdfProgress ?? t("Exporter PDF", "تصدير PDF")}
            </Button>
          </div>

        </div>
      )}

    </div>
  );
}
