import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Save, FileText, CheckCircle2, Loader2, AlertTriangle, BarChart2,
  Lightbulb, ClipboardList, TrendingUp, TrendingDown, Minus, RefreshCw,
  Database, PencilLine, ChevronDown, ChevronUp, Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { generateOverallVariancePDF } from "@/lib/generateOverallVariancePDF";

// ── Types ─────────────────────────────────────────────────────────────────────
type ComponentType = "revenue" | "materials" | "labor" | "overhead";

interface SavedProblem {
  id: number;
  name: string;
  sector: string;
  createdAt: string;
  optimalValue: number | null;
  problemData: Record<string, unknown>;
  result: Record<string, unknown> | null;
}

interface ComponentEntry {
  type: ComponentType;
  mode: "saved" | "manual";
  selectedIds: number[];
  manualValue: string;
}

interface ComputedComponent {
  type: ComponentType;
  rawValue: number;
  absPct: number; // |rawValue| / Σ|rawValues| × 100
  problemName: string;
}

interface ComputedResult {
  components: ComputedComponent[];
  grandTotal: number;
  dominantType: ComponentType | "equal";
  referenceBase: number;
}

// ── Component metadata ────────────────────────────────────────────────────────
const COMP_META: Record<ComponentType, {
  nameFr: string; nameAr: string;
  colorText: string; colorBg: string;
  favWhen: "positive" | "negative";
  emoji: string;
}> = {
  revenue:  { nameFr: "Revenus / Ventes",         nameAr: "الإيرادات",                 colorText: "text-blue-700",   colorBg: "bg-blue-50 border-blue-200",     favWhen: "positive", emoji: "💰" },
  materials:{ nameFr: "Matières premières",        nameAr: "المواد الأولية",            colorText: "text-orange-700", colorBg: "bg-orange-50 border-orange-200",  favWhen: "negative", emoji: "📦" },
  labor:    { nameFr: "Main-d'œuvre",              nameAr: "اليد العاملة",              colorText: "text-purple-700", colorBg: "bg-purple-50 border-purple-200",  favWhen: "negative", emoji: "👷" },
  overhead: { nameFr: "Charges indirectes",        nameAr: "التكاليف غير المباشرة",     colorText: "text-teal-700",   colorBg: "bg-teal-50 border-teal-200",      favWhen: "negative", emoji: "🏭" },
};

const COMP_ORDER: ComponentType[] = ["revenue", "materials", "labor", "overhead"];

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

function useVarianceStyle(value: number, favorableWhen: "positive" | "negative") {
  if (value === 0) return { color: "text-muted-foreground", bgBorder: "border-border bg-card", Icon: Minus, label: { fr: "Neutre", ar: "محايد" } };
  const isFav = favorableWhen === "positive" ? value > 0 : value < 0;
  return isFav
    ? { color: "text-green-700", bgBorder: "border-green-200 bg-green-50", Icon: TrendingUp,   label: { fr: "Favorable ✓", ar: "مُلائم ✓" } }
    : { color: "text-red-700",   bgBorder: "border-red-200 bg-red-50",     Icon: TrendingDown, label: { fr: "Défavorable ✗", ar: "غير مُلائم ✗" } };
}

// ── Waterfall Chart ───────────────────────────────────────────────────────────
function WaterfallChart({ components, grandTotal, language }: {
  components: ComputedComponent[];
  grandTotal: number;
  language: string;
}) {
  const isAr = language === "ar";

  // Build running totals: [0, after_rev, after_mat, after_labor, after_oh]
  const running: number[] = [0];
  for (const c of components) running.push(running[running.length - 1] + c.rawValue);

  const allBreaks = [0, ...running, grandTotal];
  const chartMin  = Math.min(...allBreaks);
  const chartMax  = Math.max(...allBreaks);
  const range     = Math.max(Math.abs(chartMax - chartMin), 1);

  const toPct = (v: number) => ((v - chartMin) / range) * 100;
  const zeroLinePct = toPct(0);

  const rows = components.map((c, i) => {
    const from = running[i];
    const to   = running[i + 1];
    const meta = COMP_META[c.type];
    const isFav = meta.favWhen === "positive" ? c.rawValue > 0 : c.rawValue < 0;
    const leftPct  = toPct(Math.min(from, to));
    const widthPct = Math.max((Math.abs(c.rawValue) / range) * 100, 0.3);
    return { ...c, from, to, isFav, leftPct, widthPct };
  });

  // Total bar from 0 to grandTotal
  const totalFav = grandTotal > 0;
  const totalLeft  = toPct(Math.min(0, grandTotal));
  const totalWidth = Math.max((Math.abs(grandTotal) / range) * 100, 0.3);

  return (
    <div className="space-y-2" dir="ltr">
      {/* Scale labels */}
      <div className="flex ms-[144px] me-[120px] justify-between text-[10px] text-muted-foreground mb-1">
        <span>{fDA(chartMin, language)}</span>
        {Math.abs(zeroLinePct - 50) < 40 && <span>0</span>}
        <span>{fDA(chartMax, language)}</span>
      </div>

      {rows.map((row, i) => {
        const meta = COMP_META[row.type];
        return (
          <div key={row.type} className="flex items-center gap-2 group">
            <div className={cn("w-36 shrink-0 text-xs font-semibold text-end pe-2", isAr ? "text-right" : "text-left")}>
              <span className="me-1">{meta.emoji}</span>
              {isAr ? meta.nameAr : meta.nameFr}
            </div>
            <div className="flex-1 relative h-7 bg-muted/20 rounded border border-border/40">
              {/* Zero line */}
              <div className="absolute inset-y-0 w-px bg-border/60 z-10" style={{ left: `${zeroLinePct}%` }} />
              {/* Connector from previous */}
              {i > 0 && (
                <div
                  className="absolute top-1/2 w-px bg-muted-foreground/30 z-10"
                  style={{ left: `${toPct(row.from)}%`, height: "200%" }}
                />
              )}
              {/* Bar */}
              <div
                className={cn(
                  "absolute inset-y-1 rounded transition-all",
                  row.isFav ? "bg-green-500" : "bg-red-500",
                  "opacity-80 group-hover:opacity-100"
                )}
                style={{ left: `${row.leftPct}%`, width: `${row.widthPct}%` }}
              />
            </div>
            <div className={cn("w-28 shrink-0 text-xs font-bold font-mono", row.isFav ? "text-green-700" : "text-red-700")}>
              {fDA(row.rawValue, language)}
            </div>
          </div>
        );
      })}

      {/* Total row */}
      <div className="flex items-center gap-2 border-t pt-2 mt-2">
        <div className={cn("w-36 shrink-0 text-xs font-bold pe-2 text-primary", isAr ? "text-right" : "text-left")}>
          ⚖️ {isAr ? "الانحراف الإجمالي" : "Écart Total Résultat"}
        </div>
        <div className="flex-1 relative h-8 bg-muted/20 rounded border border-border/40">
          <div className="absolute inset-y-0 w-px bg-border/60 z-10" style={{ left: `${zeroLinePct}%` }} />
          <div
            className={cn("absolute inset-y-1 rounded", totalFav ? "bg-green-600" : "bg-red-600", "opacity-90")}
            style={{ left: `${totalLeft}%`, width: `${totalWidth}%` }}
          />
        </div>
        <div className={cn("w-28 shrink-0 text-sm font-bold font-mono", totalFav ? "text-green-700" : "text-red-700")}>
          {fDA(grandTotal, language)}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OverallVariance() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const resultsRef = useRef<HTMLDivElement>(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [savedProblems, setSavedProblems] = useState<SavedProblem[]>([]);
  const [fetchError,    setFetchError]    = useState<string | null>(null);
  const [loadingFetch,  setLoadingFetch]  = useState(true);

  const [problemName,    setProblemName]    = useState("");
  const [referenceInput, setReferenceInput] = useState(""); // optional base for ratios
  const [entries, setEntries] = useState<ComponentEntry[]>(
    COMP_ORDER.map(type => ({ type, mode: "saved", selectedIds: [], manualValue: "" }))
  );

  const [computed,  setComputed]  = useState<ComputedResult | null>(null);
  const [isSaving,  setIsSaving]  = useState(false);
  const [savedOk,   setSavedOk]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [expanded, setExpanded] = useState<ComponentType | null>(null);

  // ── Fetch saved problems ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/problems?limit=100")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => setSavedProblems(data))
      .catch(e => setFetchError(String(e)))
      .finally(() => setLoadingFetch(false));
  }, []);

  function problemsForType(type: ComponentType): SavedProblem[] {
    return savedProblems.filter(
      p => (p.problemData as { objective?: string })?.objective === type
    );
  }

  // ── Resolve a single entry's value from saved problems ────────────────────
  function resolveValue(entry: ComponentEntry): number {
    if (entry.mode === "saved") {
      return entry.selectedIds.reduce((sum, id) => {
        const p = savedProblems.find(p => p.id === id);
        const tv = ((p?.result as { totals?: { totalVariance?: number } })?.totals?.totalVariance) ?? 0;
        return sum + tv;
      }, 0);
    }
    return parseFloat(entry.manualValue) || 0;
  }

  function resolvedLabel(entry: ComponentEntry): string {
    if (entry.mode === "saved" && entry.selectedIds.length > 0) {
      const names = entry.selectedIds
        .map(id => savedProblems.find(p => p.id === id)?.name ?? `#${id}`)
        .join(", ");
      return names;
    }
    return t("Saisie manuelle", "إدخال يدوي");
  }

  // ── Reference base computation ─────────────────────────────────────────────
  function computeReferenceBase(): number {
    const manual = parseFloat(referenceInput);
    if (!isNaN(manual) && manual > 0) return manual;
    // Try to extract standard base from saved revenue problems
    for (const entry of entries) {
      if (entry.type === "revenue" && entry.mode === "saved" && entry.selectedIds.length > 0) {
        for (const id of entry.selectedIds) {
          const p = savedProblems.find(q => q.id === id);
          const rows = ((p?.result as { rows?: { standardPrice: number; standardQty: number }[] })?.rows) ?? [];
          if (rows.length > 0) {
            const base = rows.reduce((s, r) => s + r.standardPrice * r.standardQty, 0);
            if (base > 0) return base;
          }
        }
      }
    }
    // Fallback: sum of absolute raw values
    return entries.reduce((s, e) => s + Math.abs(resolveValue(e)), 0);
  }

  // ── Compute ────────────────────────────────────────────────────────────────
  function handleCompute() {
    const rawValues = entries.map(e => ({ type: e.type, value: resolveValue(e), label: resolvedLabel(e) }));
    const sumAbs    = rawValues.reduce((s, c) => s + Math.abs(c.value), 0);

    const components: ComputedComponent[] = rawValues.map(c => ({
      type:        c.type,
      rawValue:    c.value,
      absPct:      sumAbs > 0 ? (Math.abs(c.value) / sumAbs) * 100 : 0,
      problemName: c.label,
    }));

    const grandTotal = components.reduce((s, c) => s + c.rawValue, 0);

    // Dominant type = largest |rawValue|
    const maxAbs = Math.max(...components.map(c => Math.abs(c.rawValue)));
    let dominant: ComponentType | "equal" = "equal";
    if (maxAbs > 0) {
      const topItem = components.find(c => Math.abs(c.rawValue) === maxAbs)!;
      const rest    = components.filter(c => c.type !== topItem.type);
      if (rest.every(c => Math.abs(c.rawValue) < maxAbs / 1.1)) dominant = topItem.type;
    }

    const refBase = computeReferenceBase();

    setComputed({ components, grandTotal, dominantType: dominant, referenceBase: refBase });
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!computed) return;
    setIsSaving(true); setSaveError(null);
    try {
      const body = {
        name: problemName || t("Synthèse des Écarts", "تركيب الانحرافات"),
        sector: "overall",
        objectiveType: "minimize",
        status: "optimal",
        optimalValue: parseFloat(computed.grandTotal.toFixed(2)),
        problemData: { objective: "overall", components: computed.components },
        result: { components: computed.components, grandTotal: computed.grandTotal, dominantType: computed.dominantType },
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

  // ── PDF export ─────────────────────────────────────────────────────────────
  async function handlePDF() {
    if (!computed) return;
    setPdfLoading(true);
    try {
      await generateOverallVariancePDF({
        problemName: problemName || t("Synthèse des Écarts sur Résultat", "تركيب انحرافات النتيجة"),
        components: computed.components.map(c => ({
          type: c.type,
          nameFr: COMP_META[c.type].nameFr,
          nameAr: COMP_META[c.type].nameAr,
          emoji: COMP_META[c.type].emoji,
          rawValue: c.rawValue,
          absPct: c.absPct,
          problemName: c.problemName,
        })),
        grandTotal: computed.grandTotal,
        dominantType: computed.dominantType,
        referenceBase: computed.referenceBase,
        analysisLines: buildAnalysisLines(computed),
        suggestions: buildSuggestions(computed),
        onProgress: () => {},
      });
    } finally {
      setPdfLoading(false);
    }
  }

  // ── Analysis lines ─────────────────────────────────────────────────────────
  function buildAnalysisLines(res: ComputedResult): { icon: string; text: string; color: string }[] {
    const { components, grandTotal, dominantType } = res;
    const totalFav = grandTotal > 0;

    const lines: { icon: string; text: string; color: string }[] = [
      {
        icon: "📊",
        color: "bg-primary/10 border-primary/30",
        text: t(
          `La synthèse couvre 4 composantes. L'écart net sur résultat est de ${fDA(grandTotal, "fr")} — situation ${grandTotal === 0 ? "neutre" : totalFav ? "globalement favorable" : "globalement défavorable à corriger"}.`,
          `تشمل التركيبة 4 مكوّنات. الانحراف الصافي على النتيجة هو ${fDA(grandTotal, "ar")} — وضع ${grandTotal === 0 ? "محايد" : totalFav ? "مُلائم بشكل عام" : "غير مُلائم يستوجب التصحيح"}.`
        ),
      },
    ];

    if (dominantType !== "equal") {
      const meta = COMP_META[dominantType];
      const dom  = components.find(c => c.type === dominantType)!;
      const isFav = meta.favWhen === "positive" ? dom.rawValue > 0 : dom.rawValue < 0;
      lines.push({
        icon: dominantType === "revenue" ? "🏷️" : dominantType === "materials" ? "📦" : dominantType === "labor" ? "👷" : "🏭",
        color: "bg-secondary/10 border-secondary/30",
        text: t(
          `La composante dominante est "${meta.nameFr}" avec ${dom.absPct.toFixed(1)} % de contribution absolue (${fDA(dom.rawValue, "fr")} — ${isFav ? "favorable" : "défavorable"}). C'est le levier prioritaire à traiter.`,
          `المكوّن المسيطر هو "${meta.nameAr}" بنسبة مساهمة ${dom.absPct.toFixed(1)}% (${fDA(dom.rawValue, "ar")} — ${isFav ? "مُلائم" : "غير مُلائم"}). هو الرافعة الأولى التي تستوجب المعالجة.`
        ),
      });
    } else {
      lines.push({
        icon: "⚖️",
        color: "bg-secondary/10 border-secondary/30",
        text: t(
          `Les contributions des composantes sont équilibrées — aucune composante ne domine clairement. Une revue simultanée des 4 axes est recommandée.`,
          `مساهمات المكوّنات متوازنة — لا يسيطر مكوّن واحد بوضوح. يُنصح بمراجعة المحاور الأربعة في آنٍ واحد.`
        ),
      });
    }

    // Highlight unfavorable components
    const unfavorable = components.filter(c => {
      const meta = COMP_META[c.type];
      return meta.favWhen === "positive" ? c.rawValue < 0 : c.rawValue > 0;
    });
    if (unfavorable.length > 0 && unfavorable.length < 4) {
      lines.push({
        icon: "⚠️",
        color: "bg-amber-50 border-amber-300",
        text: t(
          `${unfavorable.length} composante(s) présentent un écart défavorable : ${unfavorable.map(c => COMP_META[c.type].nameFr).join(", ")}. Action corrective prioritaire.`,
          `${unfavorable.length} مكوّن(ات) لديها انحراف غير مُلائم: ${unfavorable.map(c => COMP_META[c.type].nameAr).join("، ")}. إجراء تصحيحي ذو أولوية.`
        ),
      });
    }

    return lines;
  }

  // ── Suggestions ────────────────────────────────────────────────────────────
  function buildSuggestions(res: ComputedResult): { icon: string; title: string; desc: string; color: string; borderColor: string }[] {
    const { components, grandTotal, dominantType } = res;
    const totalFav = grandTotal > 0;
    const sug: { icon: string; title: string; desc: string; color: string; borderColor: string }[] = [];

    if (dominantType === "revenue" || dominantType === "equal") {
      const rev = components.find(c => c.type === "revenue")!;
      const isFav = rev.rawValue > 0;
      sug.push({
        icon: isFav ? "🟢" : "🔴",
        color: isFav ? "bg-green-50" : "bg-red-50",
        borderColor: isFav ? "border-l-green-500" : "border-l-red-500",
        title: t("Écart sur revenus : politique commerciale", "انحراف الإيرادات: السياسة التجارية"),
        desc: t(
          isFav
            ? "Les revenus dépassent les prévisions — capitalisez sur les produits et marchés performants ; révisez les budgets prévisionnels à la hausse pour les prochaines périodes."
            : "Les revenus sont inférieurs aux prévisions — analysez l'écart prix vs volume : est-ce un problème de compétitivité tarifaire ou de parts de marché perdues ? Ajustez la politique commerciale.",
          isFav
            ? "الإيرادات تتجاوز التوقعات — استثمر في المنتجات والأسواق الرابحة؛ راجع الميزانيات التنبؤية تصاعدياً للفترات القادمة."
            : "الإيرادات دون التوقعات — حلّل انحراف السعر مقابل الحجم: هل المشكلة في التنافسية السعرية أم في الحصص السوقية المفقودة؟ عدّل السياسة التجارية."
        ),
      });
    }

    if (dominantType === "materials" || dominantType === "equal") {
      const mat = components.find(c => c.type === "materials")!;
      const isFav = mat.rawValue < 0;
      sug.push({
        icon: isFav ? "🟢" : "🔴",
        color: isFav ? "bg-green-50" : "bg-red-50",
        borderColor: isFav ? "border-l-green-500" : "border-l-red-500",
        title: t("Écart sur matières : gestion des approvisionnements", "انحراف المواد: إدارة التموين"),
        desc: t(
          isFav
            ? "Les coûts matières sont inférieurs aux standards — vérifiez si cette économie est durable (renégociation contrats) ou conjoncturelle (opportunité de marché) ; mettez à jour les standards si nécessaire."
            : "Les coûts matières dépassent les standards — passez en revue les contrats fournisseurs, les quantités commandées et les niveaux de rebut ; envisagez des appels d'offres alternatifs.",
          isFav
            ? "تكاليف المواد أقل من المعايير — تحقق إن كانت هذه الوفرة مستدامة (إعادة تفاوض العقود) أم ظرفية (فرصة السوق)؛ حدّث المعايير إن لزم الأمر."
            : "تكاليف المواد تتجاوز المعايير — راجع عقود الموردين والكميات المطلوبة ونسب الهدر؛ فكر في طرح مناقصات بديلة."
        ),
      });
    }

    if (dominantType === "labor" || dominantType === "equal") {
      const lab = components.find(c => c.type === "labor")!;
      const isFav = lab.rawValue < 0;
      sug.push({
        icon: isFav ? "🟢" : "🔴",
        color: isFav ? "bg-green-50" : "bg-red-50",
        borderColor: isFav ? "border-l-green-500" : "border-l-red-500",
        title: t("Écart sur main-d'œuvre : efficience du personnel", "انحراف اليد العاملة: كفاءة الكوادر"),
        desc: t(
          isFav
            ? "Les coûts de main-d'œuvre sont sous les standards — productivité supérieure ou taux négociés favorablement. Documentez les pratiques performantes et vérifiez que la qualité n'est pas sacrifiée."
            : "Les coûts de main-d'œuvre dépassent les standards — distinguez l'écart taux (grilles salariales) de l'écart rendement (heures consommées) ; mettez en place un plan de formation et de suivi de performance.",
          isFav
            ? "تكاليف اليد العاملة دون المعايير — إنتاجية متفوقة أو معدلات مفاوَضة بشكل ملائم. وثّق الممارسات الجيدة وتحقق من جودة المنتج."
            : "تكاليف اليد العاملة تتجاوز المعايير — ميّز بين انحراف المعدل (جداول الأجور) وانحراف المردودية (الساعات المستهلكة)؛ ضع خطة تكوين ومتابعة الأداء."
        ),
      });
    }

    if (dominantType === "overhead" || dominantType === "equal") {
      const oh = components.find(c => c.type === "overhead")!;
      const isFav = oh.rawValue < 0;
      sug.push({
        icon: isFav ? "🟢" : "🔴",
        color: isFav ? "bg-green-50" : "bg-red-50",
        borderColor: isFav ? "border-l-green-500" : "border-l-red-500",
        title: t("Écart sur charges indirectes : contrôle budgétaire", "انحراف التكاليف غير المباشرة: الرقابة الميزانياتية"),
        desc: t(
          isFav
            ? "Les charges indirectes sont sous le budget — bonne maîtrise de la capacité. Vérifiez que les économies ne traduisent pas un sous-investissement en maintenance ou formation."
            : "Les charges indirectes dépassent le budget — analysez les 4 composantes (budget, sous-activité, activité, rendement) pour localiser la cause principale ; renforcez le reporting mensuel des centres d'analyse.",
          isFav
            ? "التكاليف غير المباشرة دون الميزانية — تحكم جيد في الطاقة. تحقق من أن الوفورات لا تعكس نقصاً في الاستثمار بالصيانة أو التكوين."
            : "التكاليف غير المباشرة تتجاوز الميزانية — حلّل المكوّنات الأربعة (الميزانية، قصور النشاط، النشاط، المردودية) لتحديد السبب الرئيسي؛ عزّز التقارير الشهرية لمراكز التحليل."
        ),
      });
    }

    // Overall action plan
    sug.push({
      icon: totalFav ? "🏆" : "📋",
      color: totalFav ? "bg-teal-50" : "bg-slate-50",
      borderColor: totalFav ? "border-l-teal-500" : "border-l-slate-400",
      title: t("Plan d'action global recommandé", "خطة العمل الشاملة الموصى بها"),
      desc: t(
        totalFav
          ? "La situation globale est favorable. Capitalisez sur les points forts, documentez les bonnes pratiques et actualisez les standards budgétaires pour la prochaine période. Partagez les résultats avec les équipes opérationnelles."
          : "Établissez un tableau de bord SMART trimestriel : assignez un responsable par composante défavorable, définissez des KPIs de suivi et un calendrier de revue mensuel. Impliquez les directeurs fonctionnels dans les plans d'action.",
        totalFav
          ? "الوضع الإجمالي مُلائم. استثمر نقاط القوة، وثّق الممارسات الجيدة، وحدّث المعايير الميزانياتية للفترة القادمة. شارك النتائج مع الفرق التشغيلية."
          : "أنشئ لوحة متابعة SMART ربع سنوية: عيّن مسؤولاً لكل مكوّن غير ملائم، وحدّد مؤشرات المتابعة وجدول مراجعة شهري. أشرك المديرين الوظيفيين في خطط العمل."
      ),
    });

    return sug;
  }

  // ── Entry update helpers ───────────────────────────────────────────────────
  function toggleSavedId(type: ComponentType, id: number) {
    setEntries(prev => prev.map(e => {
      if (e.type !== type) return e;
      const has = e.selectedIds.includes(id);
      return { ...e, selectedIds: has ? e.selectedIds.filter(x => x !== id) : [...e.selectedIds, id] };
    }));
    setComputed(null);
  }

  function setMode(type: ComponentType, mode: "saved" | "manual") {
    setEntries(prev => prev.map(e => e.type === type ? { ...e, mode, selectedIds: [], manualValue: "" } : e));
    setComputed(null);
    setExpanded(mode === "saved" ? type : null);
  }

  function setManualValue(type: ComponentType, val: string) {
    setEntries(prev => prev.map(e => e.type === type ? { ...e, manualValue: val } : e));
    setComputed(null);
  }

  const canCompute = entries.every(e =>
    (e.mode === "saved" && e.selectedIds.length > 0) ||
    (e.mode === "manual" && parseFloat(e.manualValue) !== 0 && e.manualValue !== "")
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn("container mx-auto px-4 py-8 max-w-4xl space-y-8", isAr ? "rtl" : "ltr")}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary">
            <BarChart2 className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {t("Synthèse des Écarts sur Résultat", "تركيب انحرافات النتيجة")}
          </h1>
          <Badge variant="secondary">
            {t("Analyse globale", "الانحراف الإجمالي")}
          </Badge>
        </div>
        <p className="text-muted-foreground ps-14">
          {t(
            "Consolidez les 4 composantes (revenus, matières, main-d'œuvre, charges indirectes) pour obtenir l'écart global sur résultat.",
            "جمّع المكوّنات الأربعة (الإيرادات، المواد، اليد العاملة، التكاليف غير المباشرة) للحصول على الانحراف الإجمالي على النتيجة."
          )}
        </p>
      </div>

      {/* ── Form ────────────────────────────────────────────────────────────── */}
      <div className="space-y-6">

        {/* Problem name */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{t("Identification", "التعريف")}</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("Nom de l'analyse", "اسم التحليل")}</Label>
              <Input
                value={problemName}
                onChange={e => setProblemName(e.target.value)}
                placeholder={t("Ex: Synthèse annuelle 2025", "مثال: تركيب سنة 2025")}
              />
            </div>
            <div className="space-y-2">
              <Label>
                {t("Base de référence (optionnel)", "القاعدة المرجعية (اختياري)")}
                <span className="ms-2 text-xs text-muted-foreground">
                  {t("ex: CA budgété total", "مثال: رقم الأعمال المدرج")}
                </span>
              </Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={referenceInput}
                onChange={e => setReferenceInput(e.target.value)}
                placeholder={t("Laissez vide pour calcul automatique", "اتركه فارغاً للحساب التلقائي")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Component rows */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{t("Composantes de l'Écart", "مكوّنات الانحراف")}</CardTitle>
            <CardDescription>
              {t(
                "Pour chaque composante : choisissez un ou plusieurs problèmes enregistrés, ou saisissez la valeur manuellement.",
                "لكل مكوّن: اختر مسألة أو عدة مسائل محفوظة، أو أدخل القيمة يدوياً."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingFetch ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("Chargement du registre…", "تحميل السجل…")}
              </div>
            ) : fetchError ? (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4" />
                {t("Impossible de charger le registre.", "تعذّر تحميل السجل.")}
              </div>
            ) : null}

            {entries.map(entry => {
              const meta    = COMP_META[entry.type];
              const probs   = problemsForType(entry.type);
              const noSaved = probs.length === 0;
              const val     = resolveValue(entry);
              const style   = useVarianceStyle(val, meta.favWhen);
              const isOpen  = expanded === entry.type;

              return (
                <div key={entry.type} className={cn("rounded-xl border-2 transition-colors", entry.mode === "saved" && entry.selectedIds.length > 0 ? style.bgBorder : "border-border bg-card")}>
                  {/* Row header */}
                  <div className="flex items-center gap-3 p-4">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0", meta.colorBg)}>
                      {meta.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-semibold text-sm", meta.colorText)}>
                        {isAr ? meta.nameAr : meta.nameFr}
                      </p>
                      {val !== 0 && (
                        <p className={cn("text-xs font-mono font-bold", style.color)}>
                          {fDA(val, language)}
                        </p>
                      )}
                    </div>

                    {/* Mode toggle */}
                    <div className="flex rounded-lg border overflow-hidden h-8 shrink-0">
                      <button
                        type="button"
                        onClick={() => { if (noSaved) return; setMode(entry.type, "saved"); }}
                        disabled={noSaved}
                        className={cn(
                          "px-3 text-xs font-semibold flex items-center gap-1 transition-colors",
                          entry.mode === "saved" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                          noSaved && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        <Database className="w-3 h-3" />
                        {t("السجل", "السجل")}
                        {noSaved && <span className="text-[10px]">(0)</span>}
                        {!noSaved && <span className="text-[10px]">({probs.length})</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode(entry.type, "manual")}
                        className={cn(
                          "px-3 text-xs font-semibold flex items-center gap-1 transition-colors",
                          entry.mode === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <PencilLine className="w-3 h-3" />
                        {t("يدوي", "يدوي")}
                      </button>
                    </div>

                    {/* Expand toggle for saved list */}
                    {entry.mode === "saved" && !noSaved && (
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : entry.type)}
                        className="p-1 rounded hover:bg-muted transition-colors"
                      >
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

                  {/* Saved problems list */}
                  {entry.mode === "saved" && isOpen && probs.length > 0 && (
                    <div className="border-t px-4 pb-4 pt-3 space-y-2">
                      <p className="text-xs text-muted-foreground mb-2">
                        {t("Sélectionnez un ou plusieurs problèmes :", "حدّد مسألة أو أكثر:")}
                      </p>
                      {probs.map(p => {
                        const tv = ((p.result as { totals?: { totalVariance?: number } })?.totals?.totalVariance) ?? (p.optimalValue ?? 0);
                        const checked = entry.selectedIds.includes(p.id);
                        const ps = useVarianceStyle(tv, meta.favWhen);
                        return (
                          <label
                            key={p.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                              checked ? ps.bgBorder : "border-border hover:bg-muted/50"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSavedId(entry.type, p.id)}
                              className="accent-primary w-4 h-4 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(p.createdAt).toLocaleDateString(isAr ? "ar-DZ" : "fr-DZ")}
                                {p.sector && ` · ${p.sector}`}
                              </p>
                            </div>
                            <span className={cn("text-sm font-bold font-mono shrink-0", ps.color)}>
                              {fDA(tv, language)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Manual input */}
                  {entry.mode === "manual" && (
                    <div className="border-t px-4 pb-4 pt-3">
                      <div className="flex items-center gap-3">
                        <Label className="shrink-0 text-sm">
                          {t("Valeur de l'écart total (DA)", "قيمة الانحراف الإجمالي (د.ج)")}
                        </Label>
                        <Input
                          type="number"
                          step="any"
                          value={entry.manualValue}
                          onChange={e => setManualValue(entry.type, e.target.value)}
                          placeholder={t("Ex: −250 000 pour favorable", "مثال: −250000 للمُلائم")}
                          className="max-w-xs"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isAr ? meta.nameAr : meta.nameFr}:&nbsp;
                        {t("favorable si ", "مُلائم إذا ")}
                        {meta.favWhen === "positive" ? t("positif", "موجب") : t("négatif", "سالب")}
                      </p>
                    </div>
                  )}

                  {/* No saved fallback */}
                  {entry.mode === "saved" && noSaved && !loadingFetch && (
                    <div className="border-t px-4 pb-4 pt-3 text-xs text-muted-foreground italic">
                      {t(
                        `Aucun problème de type "${meta.nameFr}" enregistré. Passez en saisie manuelle.`,
                        `لا توجد مسائل من نوع "${meta.nameAr}" محفوظة. انتقل إلى الإدخال اليدوي.`
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Compute button */}
            <Button
              size="lg"
              className="w-full mt-2"
              onClick={handleCompute}
              disabled={!canCompute}
            >
              <Calculator className="w-5 h-5 me-2" />
              {t("Calculer l'Écart Total sur Résultat", "احسب الانحراف الإجمالي على النتيجة")}
            </Button>
            {!canCompute && (
              <p className="text-xs text-muted-foreground text-center">
                {t("Sélectionnez ou saisissez une valeur pour chaque composante.", "حدّد أو أدخل قيمة لكل مكوّن.")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {computed && (
        <div className="space-y-6" ref={resultsRef}>

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {computed.components.map(c => {
              const meta  = COMP_META[c.type];
              const style = useVarianceStyle(c.rawValue, meta.favWhen);
              const { Icon } = style;
              return (
                <Card key={c.type} className={cn("border-2", style.bgBorder)}>
                  <CardContent className="pt-3 pb-3 flex flex-col gap-1.5">
                    <div className={cn("flex items-center justify-between", isAr && "flex-row-reverse")}>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {meta.emoji} {isAr ? meta.nameAr : meta.nameFr}
                      </p>
                      <Icon className={cn("w-3.5 h-3.5", style.color)} />
                    </div>
                    <p className={cn("text-xl font-bold tabular-nums", style.color)}>
                      {fDA(c.rawValue, language)}
                    </p>
                    <span className={cn(
                      "self-start text-[10px] font-bold px-2 py-0.5 rounded-full",
                      c.rawValue === 0 ? "bg-muted text-muted-foreground"
                        : (meta.favWhen === "positive" ? c.rawValue > 0 : c.rawValue < 0)
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    )}>
                      {c.rawValue === 0
                        ? (isAr ? "محايد" : "Neutre")
                        : (meta.favWhen === "positive" ? c.rawValue > 0 : c.rawValue < 0)
                        ? (isAr ? "مُلائم ✓" : "Favorable ✓")
                        : (isAr ? "غير مُلائم ✗" : "Défavorable ✗")}
                    </span>
                  </CardContent>
                </Card>
              );
            })}
            {/* Grand total card */}
            {(() => {
              const s = useVarianceStyle(computed.grandTotal, "positive");
              const { Icon } = s;
              return (
                <Card className={cn("border-2 col-span-2 sm:col-span-1", s.bgBorder)}>
                  <CardContent className="pt-3 pb-3 flex flex-col gap-1.5">
                    <div className={cn("flex items-center justify-between", isAr && "flex-row-reverse")}>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        ⚖️ {isAr ? "الإجمالي" : "Écart Total"}
                      </p>
                      <Icon className={cn("w-3.5 h-3.5", s.color)} />
                    </div>
                    <p className={cn("text-xl font-bold tabular-nums", s.color)}>
                      {fDA(computed.grandTotal, language)}
                    </p>
                    <span className={cn(
                      "self-start text-[10px] font-bold px-2 py-0.5 rounded-full",
                      computed.grandTotal === 0 ? "bg-muted text-muted-foreground"
                        : computed.grandTotal > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    )}>
                      {computed.grandTotal === 0 ? (isAr ? "محايد" : "Neutre") : computed.grandTotal > 0 ? (isAr ? "مُلائم ✓" : "Favorable ✓") : (isAr ? "غير مُلائم ✗" : "Défavorable ✗")}
                    </span>
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          {/* Waterfall chart */}
          <div className="space-y-3">
            <h2 className={cn("text-xl font-bold text-foreground flex items-center gap-2", isAr && "flex-row-reverse")}>
              <BarChart2 className="w-5 h-5 text-primary" />
              {t("Cascade des Écarts (Waterfall)", "تتالي الانحرافات")}
            </h2>
            <Card>
              <CardContent className="pt-4 pb-4">
                <WaterfallChart
                  components={computed.components}
                  grandTotal={computed.grandTotal}
                  language={language}
                />
              </CardContent>
            </Card>
          </div>

          {/* Detailed table */}
          <div className="space-y-3">
            <h2 className={cn("text-xl font-bold text-foreground flex items-center gap-2", isAr && "flex-row-reverse")}>
              <ClipboardList className="w-5 h-5 text-primary" />
              {t("Tableau Détaillé", "الجدول التفصيلي")}
            </h2>
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">{t("Composante", "المكوّن")}</TableHead>
                      <TableHead className="text-center font-semibold">{t("Source", "المصدر")}</TableHead>
                      <TableHead className="text-center font-semibold">{t("Écart total", "الانحراف الإجمالي")}</TableHead>
                      <TableHead className="text-center font-semibold">{t("% Contribution", "% المساهمة")}</TableHead>
                      <TableHead className="text-center font-semibold">{t("Statut", "الحالة")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {computed.components.map(c => {
                      const meta  = COMP_META[c.type];
                      const style = useVarianceStyle(c.rawValue, meta.favWhen);
                      const isFav = meta.favWhen === "positive" ? c.rawValue > 0 : c.rawValue < 0;
                      return (
                        <TableRow key={c.type}>
                          <TableCell className="font-semibold">
                            <span className="me-2">{meta.emoji}</span>
                            {isAr ? meta.nameAr : meta.nameFr}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground max-w-[180px] truncate">
                            {c.problemName}
                          </TableCell>
                          <TableCell className={cn("text-center font-mono font-bold", style.color)}>
                            {fDA(c.rawValue, language)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn("h-2 rounded-full", isFav ? "bg-green-500" : "bg-red-500")}
                                  style={{ width: `${Math.min(c.absPct, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm font-bold tabular-nums w-12">
                                {c.absPct.toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={cn(
                              "text-xs font-bold px-2 py-0.5 rounded-full",
                              c.rawValue === 0 ? "bg-muted text-muted-foreground"
                                : isFav ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            )}>
                              {c.rawValue === 0 ? (isAr ? "محايد" : "Neutre") : isFav ? (isAr ? "مُلائم ✓" : "Favorable ✓") : (isAr ? "غير مُلائم ✗" : "Défavorable ✗")}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-primary/5 border-t-2 border-primary/20 font-bold">
                      <TableCell className="font-bold text-primary" colSpan={2}>
                        ⚖️ {t("TOTAL", "الإجمالي")}
                      </TableCell>
                      <TableCell className={cn("text-center font-mono font-bold text-base", computed.grandTotal > 0 ? "text-green-700" : computed.grandTotal < 0 ? "text-red-700" : "text-muted-foreground")}>
                        {fDA(computed.grandTotal, language)}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">100 %</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          {/* مؤشرات ونسب التسيير */}
          {(() => {
            const base = computed.referenceBase;
            if (base === 0) return null;
            const pct   = (v: number) => (v / base) * 100;
            const badge = (absPct: number) => {
              if (absPct < 5)  return { cls: "bg-green-100 text-green-800 border-green-200",   fr: "Acceptable",      ar: "مقبول" };
              if (absPct < 15) return { cls: "bg-orange-100 text-orange-800 border-orange-200", fr: "Vigilance",       ar: "يستدعي انتباه" };
              return               { cls: "bg-red-100 text-red-800 border-red-200",             fr: "Critique",        ar: "حرج" };
            };
            const items = [
              ...computed.components.map(c => ({
                labelFr: COMP_META[c.type].nameFr,
                labelAr: COMP_META[c.type].nameAr,
                emoji: COMP_META[c.type].emoji,
                v: c.rawValue,
                favWhen: COMP_META[c.type].favWhen,
              })),
              { labelFr: "Écart Total Résultat", labelAr: "الانحراف الإجمالي على النتيجة", emoji: "⚖️", v: computed.grandTotal, favWhen: "positive" as const },
            ];
            return (
              <div className="space-y-3">
                <h2 className={cn("text-xl font-bold text-foreground flex items-center gap-2", isAr && "flex-row-reverse")}>
                  <BarChart2 className="w-5 h-5 text-primary" />
                  {t("Indicateurs & Ratios de Gestion", "مؤشرات ونسب التسيير")}
                </h2>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground mb-4">
                      {t(
                        `Base de référence : ${fDA(base, language)} — Seuils : vert < 5 % · orange 5–15 % · rouge > 15 %`,
                        `القاعدة المرجعية: ${fDA(base, language)} — الحدود: أخضر < 5% · برتقالي 5–15% · أحمر > 15%`
                      )}
                    </p>
                    <div className="space-y-2">
                      {items.map(item => {
                        const p    = pct(item.v);
                        const absp = Math.abs(p);
                        const b    = badge(absp);
                        const vs   = useVarianceStyle(item.v, item.favWhen);
                        return (
                          <div key={item.labelFr} className={cn("flex items-center gap-3 rounded-lg border px-4 py-2.5 bg-card", isAr && "flex-row-reverse")}>
                            <div className="w-44 shrink-0 text-xs font-semibold">
                              <span className="me-1">{item.emoji}</span>
                              {isAr ? item.labelAr : item.labelFr}
                            </div>
                            <div className={cn("flex-1 flex items-center gap-2", isAr && "flex-row-reverse")}>
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-[160px]">
                                <div
                                  className={cn("h-2 rounded-full", absp < 5 ? "bg-green-500" : absp < 15 ? "bg-orange-400" : "bg-red-500")}
                                  style={{ width: `${Math.min(absp * 4, 100)}%` }}
                                />
                              </div>
                              <span className={cn("text-sm font-bold tabular-nums w-16 shrink-0", vs.color)}>
                                {p >= 0 ? "+" : "−"}{Math.abs(p).toFixed(1)}%
                              </span>
                            </div>
                            <span className={cn("text-xs font-bold tabular-nums shrink-0 w-28 text-end", vs.color)}>
                              {fDA(item.v, language)}
                            </span>
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border shrink-0", b.cls)}>
                              {isAr ? b.ar : b.fr}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* تحليل الوضع */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              {t("Analyse de la Situation", "تحليل الوضع")}
            </h2>
            <div className="space-y-2">
              {buildAnalysisLines(computed).map((line, i) => (
                <div key={i} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", line.color)}>
                  <span className="text-base leading-snug shrink-0">{line.icon}</span>
                  <span className="leading-relaxed">{line.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* التوصيات الإدارية */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              {t("Recommandations Managériales", "التوصيات الإدارية")}
            </h2>
            <div className="space-y-3">
              {buildSuggestions(computed).map((s, i) => (
                <div key={i} className={cn("flex items-start gap-3 rounded-lg border-l-4 px-4 py-3", s.color, s.borderColor)}>
                  <span className="text-lg shrink-0 mt-0.5">{s.icon}</span>
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{s.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save + PDF */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-lg font-bold">
                    {problemName || t("Synthèse des Écarts sur Résultat", "تركيب انحرافات النتيجة")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t("Analyse globale · 4 composantes", "التحليل الإجمالي · 4 مكوّنات")}
                  </p>
                </div>
                <Badge className={cn(
                  "border",
                  computed.grandTotal === 0 ? "bg-muted/50 text-muted-foreground border-border"
                    : computed.grandTotal > 0 ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-red-100 text-red-800 border-red-200"
                )}>
                  {fDA(computed.grandTotal, language)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* KPI mini-grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {computed.components.map(c => {
                  const meta = COMP_META[c.type];
                  return (
                    <div key={c.type} className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">{meta.emoji} {isAr ? meta.nameAr : meta.nameFr}</p>
                      <p className="text-sm font-bold mt-0.5 truncate">{fDA(c.rawValue, language)}</p>
                    </div>
                  );
                })}
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">⚖️ {t("Écart Total", "الانحراف الإجمالي")}</p>
                  <p className="text-sm font-bold mt-0.5">{fDA(computed.grandTotal, language)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{t("Facteur dominant", "العامل المسيطر")}</p>
                  <p className="text-sm font-bold mt-0.5 truncate">
                    {computed.dominantType === "equal"
                      ? t("Équilibré", "متوازن")
                      : `${COMP_META[computed.dominantType].emoji} ${isAr ? COMP_META[computed.dominantType].nameAr : COMP_META[computed.dominantType].nameFr}`
                    }
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 flex-wrap pt-1">
                <Button onClick={handleSave} disabled={isSaving || savedOk} variant="outline">
                  {isSaving
                    ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t("Sauvegarde…", "جارٍ الحفظ…")}</>
                    : savedOk
                    ? <><CheckCircle2 className="w-4 h-4 me-2 text-green-600" />{t("Sauvegardé !", "تم الحفظ!")}</>
                    : <><Save className="w-4 h-4 me-2" />{t("حفظ في السجل", "حفظ في السجل")}</>}
                </Button>
                <Button onClick={handlePDF} disabled={pdfLoading}>
                  {pdfLoading
                    ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t("Génération…", "جارٍ التوليد…")}</>
                    : <><FileText className="w-4 h-4 me-2" />{t("تصدير PDF", "تصدير PDF")}</>}
                </Button>
                <Button variant="ghost" onClick={() => setComputed(null)} title={t("Réinitialiser", "إعادة الضبط")}>
                  <RefreshCw className="w-4 h-4 me-2" />
                  {t("Réinitialiser", "إعادة الضبط")}
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
      )}
    </div>
  );
}
