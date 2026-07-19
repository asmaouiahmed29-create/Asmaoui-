import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Save, FileText, CheckCircle2, Loader2, AlertTriangle,
  BarChart2, Lightbulb, ClipboardList, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { VariancePDFExportDialog } from "@/components/VariancePDFExportDialog";
import type { VarianceObjective, VarianceRowResult, VarianceTotals } from "@/lib/generateVariancePDF";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  problemName: string;
  sector: string;
  objective: VarianceObjective;
  rows: VarianceRowResult[];
  totals: VarianceTotals;
}

// ── Formatting ────────────────────────────────────────────────────────────────
function fDA(n: number, lang: string): string {
  const abs = Math.abs(n);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const locale = lang === "ar" ? "ar-DZ" : "fr-DZ";
  const s = abs >= 1_000_000
    ? (abs / 1_000_000).toFixed(2) + " M DA"
    : abs >= 1_000
    ? (abs / 1_000).toFixed(1) + " k DA"
    : abs.toLocaleString(locale, { maximumFractionDigits: 0 }) + " DA";
  return (sign ? sign + "\u202F" : "") + s;
}

function fNum(n: number): string {
  return n.toLocaleString("fr-DZ", { maximumFractionDigits: 2 });
}

// ── Per-objective config ──────────────────────────────────────────────────────
interface ObjCfg {
  nameFr: string; nameAr: string;
  priceVarFr: string; priceVarAr: string;
  qtyVarFr: string;   qtyVarAr: string;
  stdPriceFr: string; stdPriceAr: string;
  actPriceFr: string; actPriceAr: string;
  stdQtyFr: string;   stdQtyAr: string;
  actQtyFr: string;   actQtyAr: string;
  favorableWhen: "positive" | "negative";
}

const OBJ_CFG: Record<VarianceObjective, ObjCfg> = {
  revenue: {
    nameFr: "Revenus / Ventes", nameAr: "الإيرادات / المبيعات",
    priceVarFr: "Écart/Prix",   priceVarAr: "انحراف السعر",
    qtyVarFr: "Écart/Volume",   qtyVarAr: "انحراف الحجم",
    stdPriceFr: "Prix std.",    stdPriceAr: "سعر معياري",
    actPriceFr: "Prix réel",    actPriceAr: "سعر فعلي",
    stdQtyFr: "Qté std.",       stdQtyAr: "كمية معيارية",
    actQtyFr: "Qté réelle",     actQtyAr: "كمية فعلية",
    favorableWhen: "positive",
  },
  materials: {
    nameFr: "Matières premières", nameAr: "المواد الأولية",
    priceVarFr: "Écart/Prix",    priceVarAr: "انحراف السعر",
    qtyVarFr: "Écart/Qté",       qtyVarAr: "انحراف الكمية",
    stdPriceFr: "Coût std.",      stdPriceAr: "تكلفة معيارية",
    actPriceFr: "Coût réel",      actPriceAr: "تكلفة فعلية",
    stdQtyFr: "Qté std.",         stdQtyAr: "كمية معيارية",
    actQtyFr: "Qté réelle",       actQtyAr: "كمية فعلية",
    favorableWhen: "negative",
  },
  labor: {
    nameFr: "Main-d'œuvre",        nameAr: "اليد العاملة",
    priceVarFr: "Écart/Taux",     priceVarAr: "انحراف الأجر",
    qtyVarFr: "Écart/Rend.",      qtyVarAr: "انحراف المردودية",
    stdPriceFr: "Taux std.",       stdPriceAr: "أجر معياري",
    actPriceFr: "Taux réel",       actPriceAr: "أجر فعلي",
    stdQtyFr: "H. std.",           stdQtyAr: "ساعات معيارية",
    actQtyFr: "H. réelles",        actQtyAr: "ساعات فعلية",
    favorableWhen: "negative",
  },
};

// ── Variance icon + color helper ──────────────────────────────────────────────
function useVarianceStyle(value: number, favorableWhen: "positive" | "negative") {
  if (value === 0) return { color: "text-muted-foreground", bgBorder: "border-border bg-card", badge: { fr: "Neutre", ar: "محايد" }, Icon: Minus };
  const isFav = favorableWhen === "positive" ? value > 0 : value < 0;
  return isFav
    ? { color: "text-green-700", bgBorder: "border-green-200 bg-green-50", badge: { fr: "Favorable ✓", ar: "مُلائم ✓" }, Icon: TrendingUp }
    : { color: "text-red-700",   bgBorder: "border-red-200 bg-red-50",     badge: { fr: "Défavorable ✗", ar: "غير مُلائم ✗" }, Icon: TrendingDown };
}

// ── Main component ────────────────────────────────────────────────────────────
export function VarianceAnalysisReport({ problemName, sector, objective, rows, totals }: Props) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const cfg  = OBJ_CFG[objective];
  const [pdfOpen,   setPdfOpen]   = useState(false);
  const [isSaving,  setIsSaving]  = useState(false);
  const [savedOk,   setSavedOk]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Dominant variance factor ─────────────────────────────────────────────
  const absPriceTotal = Math.abs(totals.priceVariance);
  const absQtyTotal   = Math.abs(totals.qtyVariance);
  const dominantFactor: "price" | "qty" | "equal" =
    absPriceTotal > absQtyTotal * 1.1 ? "price" :
    absQtyTotal > absPriceTotal * 1.1 ? "qty" : "equal";

  const favWhen = cfg.favorableWhen;

  // ── Situational analysis lines ───────────────────────────────────────────
  const totalFav = favWhen === "positive" ? totals.totalVariance > 0 : totals.totalVariance < 0;
  const totalNeutral = totals.totalVariance === 0;

  const analysisLines: { icon: string; text: string; color: string }[] = [
    {
      icon: "📊",
      color: "bg-primary/10 border-primary/30",
      text: t(
        `L'analyse porte sur ${rows.length} élément(s) en mode "${cfg.nameFr}". L'écart total consolidé est de ${fDA(totals.totalVariance, "fr")} — ${totalNeutral ? "aucun écart" : totalFav ? "situation favorable" : "situation défavorable à corriger"}.`,
        `يشمل التحليل ${rows.length} عنصر(ات) في نمط "${cfg.nameAr}". الانحراف الإجمالي الموحّد هو ${fDA(totals.totalVariance, "ar")} — ${totalNeutral ? "لا انحراف" : totalFav ? "وضع مُلائم" : "وضع غير مُلائم يستوجب التصحيح"}.`
      ),
    },
    {
      icon: dominantFactor === "price" ? "🏷️" : dominantFactor === "qty" ? "📦" : "⚖️",
      color: "bg-secondary/10 border-secondary/30",
      text: dominantFactor === "price"
        ? t(
            `L'écart est principalement piloté par le ${cfg.priceVarFr} (${fDA(totals.priceVariance, "fr")}) — c'est le levier prioritaire à actionner.`,
            `الانحراف مدفوع بشكل رئيسي بـ ${cfg.priceVarAr} (${fDA(totals.priceVariance, "ar")}) — وهو الرافعة الأولى للتحكم.`
          )
        : dominantFactor === "qty"
        ? t(
            `L'écart est principalement piloté par le ${cfg.qtyVarFr} (${fDA(totals.qtyVariance, "fr")}) — la maîtrise des volumes ou de l'efficience est prioritaire.`,
            `الانحراف مدفوع بشكل رئيسي بـ ${cfg.qtyVarAr} (${fDA(totals.qtyVariance, "ar")}) — التحكم في الكميات أو الكفاءة هو الأولوية.`
          )
        : t(
            `Les deux composantes contribuent équitablement à l'écart total (${cfg.priceVarFr}: ${fDA(totals.priceVariance, "fr")} / ${cfg.qtyVarFr}: ${fDA(totals.qtyVariance, "fr")}) — une action simultanée sur les deux axes est recommandée.`,
            `كلا المكوّنين يساهمان بالتساوي في الانحراف الإجمالي (${cfg.priceVarAr}: ${fDA(totals.priceVariance, "ar")} / ${cfg.qtyVarAr}: ${fDA(totals.qtyVariance, "ar")}) — يُنصح بالتحرك على المحورين معاً.`
          ),
    },
    ...(() => {
      const unfavorableRows = rows.filter(r => {
        const f = favWhen === "positive" ? r.totalVariance < 0 : r.totalVariance > 0;
        return f && r.totalVariance !== 0;
      });
      if (unfavorableRows.length === 0) return [];
      return [{
        icon: "⚠️",
        color: "bg-amber-50 border-amber-300",
        text: t(
          `${unfavorableRows.length} élément(s) présentent un écart défavorable : ${unfavorableRows.map(r => r.element).join(", ")}. Attention particulière requise.`,
          `${unfavorableRows.length} عنصر(ات) لديها انحراف غير مُلائم: ${unfavorableRows.map(r => r.element).join("، ")}. تستوجب اهتماماً خاصاً.`
        ),
      }];
    })(),
  ];

  // ── Suggestions ────────────────────────────────────────────────────────────
  interface Sug { icon: string; title: string; desc: string; color: string; borderColor: string; }
  const suggestions: Sug[] = [];

  if (dominantFactor === "price" || dominantFactor === "equal") {
    const priceUnfav = favWhen === "positive" ? totals.priceVariance < 0 : totals.priceVariance > 0;
    suggestions.push({
      icon: priceUnfav ? "🔴" : "🟢",
      color: priceUnfav ? "bg-red-50" : "bg-green-50",
      borderColor: priceUnfav ? "border-l-red-500" : "border-l-green-500",
      title: objective === "revenue"
        ? t("Politique de prix à réviser", "مراجعة سياسة الأسعار")
        : objective === "labor"
        ? t("Maîtrise des taux salariaux", "التحكم في الأجور")
        : t("Renégocier les prix fournisseurs", "إعادة التفاوض مع الموردين"),
      desc: objective === "revenue"
        ? t(
            priceUnfav
              ? "Le prix réel est inférieur au standard — envisagez de réviser la grille tarifaire, les remises accordées ou la segmentation client."
              : "Le prix réel surpasse le standard — valorisez cette performance dans votre stratégie commerciale.",
            priceUnfav
              ? "السعر الفعلي أقل من المعياري — راجع جدول الأسعار والخصومات الممنوحة وتصنيف العملاء."
              : "السعر الفعلي يتجاوز المعياري — استثمر هذا الأداء في استراتيجيتك التجارية."
          )
        : objective === "labor"
        ? t(
            priceUnfav
              ? "Le taux réel dépasse le standard — analysez les heures supplémentaires, primes et reclassifications qui gonflent la masse salariale."
              : "Le taux réel est inférieur au standard — économie salariale réalisée, consolidez-la par une politique RH adaptée.",
            priceUnfav
              ? "الأجر الفعلي أعلى من المعياري — حلّل الساعات الإضافية والعلاوات التي تُضخّم كتلة الرواتب."
              : "الأجر الفعلي أقل من المعياري — وفر في الرواتب، رسّخه بسياسة موارد بشرية ملائمة."
          )
        : t(
            priceUnfav
              ? "Le coût d'achat réel dépasse le standard — renégociez les contrats fournisseurs, cherchez des alternatives ou achetez en volume."
              : "Le coût d'achat réel est inférieur au standard — bonne gestion des achats, maintenez les partenariats favorables.",
            priceUnfav
              ? "تكلفة الشراء الفعلية تتجاوز المعيارية — أعد التفاوض مع الموردين أو ابحث عن بدائل أو اشتر بالجملة."
              : "تكلفة الشراء الفعلية أقل من المعيارية — إدارة مشتريات جيدة، حافظ على الشراكات الإيجابية."
          ),
    });
  }

  if (dominantFactor === "qty" || dominantFactor === "equal") {
    const qtyUnfav = favWhen === "positive" ? totals.qtyVariance < 0 : totals.qtyVariance > 0;
    suggestions.push({
      icon: qtyUnfav ? "🔴" : "🟢",
      color: qtyUnfav ? "bg-red-50" : "bg-green-50",
      borderColor: qtyUnfav ? "border-l-red-500" : "border-l-green-500",
      title: objective === "revenue"
        ? t("Effort commercial à renforcer", "تعزيز الجهد التجاري")
        : objective === "labor"
        ? t("Productivité de la main-d'œuvre", "إنتاجية اليد العاملة")
        : t("Gestion des consommations matières", "إدارة استهلاك المواد"),
      desc: objective === "revenue"
        ? t(
            qtyUnfav
              ? "Le volume vendu est inférieur aux prévisions — renforcez l'équipe commerciale, révisez les objectifs et analysez les retours clients."
              : "Le volume vendu dépasse les prévisions — excellente performance commerciale, analysez les facteurs de succès pour les répliquer.",
            qtyUnfav
              ? "حجم المبيعات أقل من التوقعات — عزّز فريق المبيعات وراجع الأهداف وحلّل ملاحظات العملاء."
              : "حجم المبيعات يتجاوز التوقعات — أداء تجاري ممتاز، حلّل عوامل النجاح لتكرارها."
          )
        : objective === "labor"
        ? t(
            qtyUnfav
              ? "Les heures réelles dépassent le standard — analysez les arrêts, pannes, absences et inefficiences pour réduire le temps de cycle."
              : "Les heures réelles sont inférieures au standard — productivité supérieure aux attentes, identifiez les meilleures pratiques.",
            qtyUnfav
              ? "ساعات العمل الفعلية تتجاوز المعيارية — حلّل التوقفات والأعطال والغيابات لتقليل زمن الدورة."
              : "ساعات العمل الفعلية أقل من المعيارية — إنتاجية تفوق التوقعات، حدّد الممارسات الجيدة."
          )
        : t(
            qtyUnfav
              ? "La consommation réelle dépasse le standard — contrôlez les rebuts, fuites, erreurs de dosage et inefficiences de production."
              : "La consommation réelle est inférieure au standard — efficience matière positive, capitalisez sur les procédés efficaces.",
            qtyUnfav
              ? "الاستهلاك الفعلي يتجاوز المعيار — تحكّم في الهدر والتسرب وأخطاء الجرعات وقصور الإنتاج."
              : "الاستهلاك الفعلي أقل من المعيار — كفاءة جيدة في المواد، استثمر في العمليات الفعّالة."
          ),
    });
  }

  // Always add action plan suggestion
  if (!totalNeutral) {
    suggestions.push({
      icon: totalFav ? "✅" : "🔄",
      color: totalFav ? "bg-green-50" : "bg-amber-50",
      borderColor: totalFav ? "border-l-green-500" : "border-l-amber-500",
      title: totalFav
        ? t("Consolider et élever les standards", "توطيد المكاسب ورفع المعايير")
        : t("Plan d'action correctif", "خطة عمل تصحيحية"),
      desc: totalFav
        ? t(
            "La performance dépasse globalement les standards. Révisez les budgets prévisionnels à la hausse et documentez les bonnes pratiques pour pérenniser les résultats.",
            "يتجاوز الأداء المعايير بشكل عام. راجع الميزانيات التوقعية تصاعدياً ووثّق الممارسات الجيدة لتحقيق الاستمرارية."
          )
        : t(
            "Établissez un plan d'action SMART : identifiez les responsables, fixez des échéances et des indicateurs de suivi pour chacun des écarts défavorables identifiés.",
            "ضع خطة عمل SMART: حدّد المسؤولين والمواعيد ومؤشرات المتابعة لكل انحراف غير مُلائم تم تحديده."
          ),
    });
  }

  // ── Save handler ───────────────────────────────────────────────────────────
  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const body = {
        name: problemName || t("Analyse des Écarts", "تحليل الانحرافات"),
        sector,
        objectiveType: "minimize",
        status: "optimal",
        optimalValue: parseFloat(totals.totalVariance.toFixed(2)),
        problemData: {
          objective,
          rows: rows.map(r => ({
            id: r.id, element: r.element,
            standardPrice: r.standardPrice, standardQty: r.standardQty,
            actualPrice: r.actualPrice,    actualQty: r.actualQty,
          })),
        },
        result: { rows, totals, dominantFactor },
      };
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 4000);
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setIsSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const totStyle   = useVarianceStyle(totals.totalVariance, favWhen);
  const priceStyle = useVarianceStyle(totals.priceVariance, favWhen);
  const qtyStyle   = useVarianceStyle(totals.qtyVariance,   favWhen);

  return (
    <div className="space-y-6">

      {/* ── KPI summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: isAr ? cfg.priceVarAr : cfg.priceVarFr, value: totals.priceVariance, style: priceStyle },
          { label: isAr ? cfg.qtyVarAr   : cfg.qtyVarFr,   value: totals.qtyVariance,   style: qtyStyle   },
          { label: t("Écart Total", "الانحراف الإجمالي"),   value: totals.totalVariance, style: totStyle   },
        ].map(({ label, value, style }) => {
          const { Icon } = style;
          return (
            <Card key={label} className={cn("border-2", style.bgBorder)}>
              <CardContent className="pt-4 pb-4 flex flex-col gap-2">
                <div className={cn("flex items-center justify-between", isAr && "flex-row-reverse")}>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <Icon className={cn("w-4 h-4", style.color)} />
                </div>
                <p className={cn("text-2xl font-bold tabular-nums", style.color)}>
                  {fDA(value, language)}
                </p>
                <span className={cn(
                  "self-start text-xs font-bold px-2.5 py-1 rounded-full",
                  value === 0 ? "bg-muted text-muted-foreground"
                    : (favWhen === "positive" ? value > 0 : value < 0)
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                )}>
                  {value === 0
                    ? (isAr ? "محايد" : "Neutre")
                    : (favWhen === "positive" ? value > 0 : value < 0)
                    ? (isAr ? "مُلائم ✓" : "Favorable ✓")
                    : (isAr ? "غير مُلائم ✗" : "Défavorable ✗")}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── قسم النتائج الرقمية ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          {t("Résultats Numériques", "النتائج الرقمية")}
        </h2>
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">
                    {t("Élément", "العنصر")}
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    {isAr ? cfg.stdPriceAr : cfg.stdPriceFr}
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    {isAr ? cfg.actPriceAr : cfg.actPriceFr}
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    {isAr ? cfg.stdQtyAr : cfg.stdQtyFr}
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    {isAr ? cfg.actQtyAr : cfg.actQtyFr}
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    {isAr ? cfg.priceVarAr : cfg.priceVarFr}
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    {isAr ? cfg.qtyVarAr : cfg.qtyVarFr}
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    {t("Écart Total", "الانحراف الإجمالي")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const rowFav  = useVarianceStyle(r.totalVariance, favWhen);
                  const pvFav   = useVarianceStyle(r.priceVariance, favWhen);
                  const qvFav   = useVarianceStyle(r.qtyVariance,   favWhen);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-semibold">{r.element}</TableCell>
                      <TableCell className="text-center text-muted-foreground font-mono text-sm">{fNum(r.standardPrice)}</TableCell>
                      <TableCell className="text-center text-muted-foreground font-mono text-sm">{fNum(r.actualPrice)}</TableCell>
                      <TableCell className="text-center text-muted-foreground font-mono text-sm">{fNum(r.standardQty)}</TableCell>
                      <TableCell className="text-center text-muted-foreground font-mono text-sm">{fNum(r.actualQty)}</TableCell>
                      <TableCell className={cn("text-center font-mono font-semibold text-sm", pvFav.color)}>
                        {fDA(r.priceVariance, language)}
                      </TableCell>
                      <TableCell className={cn("text-center font-mono font-semibold text-sm", qvFav.color)}>
                        {fDA(r.qtyVariance, language)}
                      </TableCell>
                      <TableCell className={cn("text-center font-mono font-bold", rowFav.color)}>
                        {fDA(r.totalVariance, language)}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Totals row */}
                <TableRow className="bg-primary/5 font-bold border-t-2 border-primary/20">
                  <TableCell className="font-bold text-primary">
                    {t("TOTAL", "الإجمالي")}
                  </TableCell>
                  <TableCell colSpan={4} />
                  <TableCell className={cn("text-center font-mono font-bold", priceStyle.color)}>
                    {fDA(totals.priceVariance, language)}
                  </TableCell>
                  <TableCell className={cn("text-center font-mono font-bold", qtyStyle.color)}>
                    {fDA(totals.qtyVariance, language)}
                  </TableCell>
                  <TableCell className={cn("text-center font-mono font-bold text-base", totStyle.color)}>
                    {fDA(totals.totalVariance, language)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* ── قسم تحليل الوضع ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          {t("Analyse de la Situation", "تحليل الوضع")}
        </h2>
        <div className="space-y-2">
          {analysisLines.map((line, i) => (
            <div key={i} className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
              line.color
            )}>
              <span className="text-base leading-snug shrink-0">{line.icon}</span>
              <span className="leading-relaxed">{line.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── قسم التوصيات ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          {t("Recommandations Managériales", "التوصيات الإدارية")}
        </h2>
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <div key={i} className={cn(
              "flex items-start gap-3 rounded-lg border-l-4 px-4 py-3",
              s.color, s.borderColor
            )}>
              <span className="text-lg shrink-0 mt-0.5">{s.icon}</span>
              <div className="space-y-1">
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Rapport managérial + Save + PDF ──────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          {t("Rapport Managérial", "التقرير الإداري")}
        </h2>
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg font-bold">
                  {problemName || t("Analyse des Écarts", "تحليل الانحرافات")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isAr ? cfg.nameAr : cfg.nameFr}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge className={cn(
                  "border",
                  totals.totalVariance === 0
                    ? "bg-muted/50 text-muted-foreground border-border"
                    : (favWhen === "positive" ? totals.totalVariance > 0 : totals.totalVariance < 0)
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-red-100 text-red-800 border-red-200"
                )}>
                  {fDA(totals.totalVariance, language)}
                </Badge>
                <Badge variant="outline">{rows.length} {t("éléments", "عناصر")}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: isAr ? cfg.priceVarAr : cfg.priceVarFr, value: fDA(totals.priceVariance, language) },
                { label: isAr ? cfg.qtyVarAr   : cfg.qtyVarFr,   value: fDA(totals.qtyVariance, language) },
                { label: t("Écart Total",    "الانحراف الإجمالي"),  value: fDA(totals.totalVariance, language) },
                { label: t("Facteur dominant", "العامل المسيطر"),    value: dominantFactor === "price" ? (isAr ? cfg.priceVarAr : cfg.priceVarFr) : dominantFactor === "qty" ? (isAr ? cfg.qtyVarAr : cfg.qtyVarFr) : t("Équilibré", "متوازن") },
              ].map(kpi => (
                <div key={kpi.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-sm font-bold mt-0.5 truncate">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap pt-1">
              <Button onClick={handleSave} disabled={isSaving || savedOk} variant="outline">
                {isSaving
                  ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t("Sauvegarde…", "جارٍ الحفظ…")}</>
                  : savedOk
                  ? <><CheckCircle2 className="w-4 h-4 me-2 text-green-600" />{t("Sauvegardé !", "تم الحفظ!")}</>
                  : <><Save className="w-4 h-4 me-2" />{t("Sauvegarder", "حفظ في السجل")}</>}
              </Button>
              <Button onClick={() => setPdfOpen(true)}>
                <FileText className="w-4 h-4 me-2" />
                {t("Exporter PDF", "تصدير PDF")}
              </Button>
            </div>

            {saveError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {saveError}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <VariancePDFExportDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        problemName={problemName}
        sector={sector}
        objective={objective}
        rows={rows}
        totals={totals}
        dominantFactor={dominantFactor}
        analysisLines={analysisLines.map(l => l.text)}
        suggestions={suggestions.map(s => ({ icon: s.icon, title: s.title, desc: s.desc }))}
      />
    </div>
  );
}
