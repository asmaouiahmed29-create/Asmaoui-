import { useMemo, useState } from "react";
import type { ProblemInput, SolveResult } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Info,
} from "lucide-react";

interface Props {
  input: ProblemInput;
  result: SolveResult;
}

function fmt(n: number, lang: string, decimals = 2) {
  return n.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  });
}

// Classify a range ratio as wide / narrow / critical
function rangeClass(value: number | null | undefined, base: number): "wide" | "narrow" | "critical" {
  if (value === null || value === undefined) return "wide"; // ∞
  if (base === 0) return "narrow";
  const ratio = value / Math.abs(base);
  if (ratio >= 0.25) return "wide";
  if (ratio >= 0.08) return "narrow";
  return "critical";
}

const RANGE_COLORS: Record<string, string> = {
  wide: "text-green-700 bg-green-50 border-green-200",
  narrow: "text-orange-700 bg-orange-50 border-orange-200",
  critical: "text-red-700 bg-red-50 border-red-200",
};

const RANGE_DOT: Record<string, string> = {
  wide: "bg-green-500",
  narrow: "bg-orange-400",
  critical: "bg-red-500",
};

function RangeCell({
  value,
  base,
  lang,
  isInfinity,
}: {
  value: number | null | undefined;
  base: number;
  lang: string;
  isInfinity?: boolean;
}) {
  const cls = isInfinity || value === null || value === undefined
    ? "wide"
    : rangeClass(value, base);

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-sm font-mono font-semibold",
      RANGE_COLORS[cls]
    )}>
      <span className={cn("w-2 h-2 rounded-full shrink-0", RANGE_DOT[cls])} />
      {value === null || value === undefined ? "∞" : fmt(value, lang)}
    </span>
  );
}

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        className="text-muted-foreground hover:text-primary transition-colors"
        aria-label="info"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg leading-relaxed">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover" />
        </div>
      )}
    </span>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  badge,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <span className="flex items-center gap-3 font-semibold text-base text-foreground">
          {title}
          {badge}
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  );
}

export function SensitivityReport({ input, result }: Props) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const sa = result.sensitivityAnalysis;
  const isMax = input.objectiveType === "maximize";

  // Compute overall stability score
  const stability = useMemo(() => {
    if (!sa) return null;

    let wideCount = 0;
    let total = 0;

    sa.objectiveCoefficients.forEach((v) => {
      const inBasis = (v.allowableIncrease !== undefined || v.allowableDecrease !== undefined);
      if (!inBasis) return;
      total += 2;
      if (rangeClass(v.allowableIncrease, v.currentValue) === "wide") wideCount++;
      if (rangeClass(v.allowableDecrease, v.currentValue) === "wide") wideCount++;
    });

    sa.constraints.forEach((c) => {
      total += 2;
      if (rangeClass(c.allowableIncrease, c.currentValue) === "wide") wideCount++;
      if (rangeClass(c.allowableDecrease, c.currentValue) === "wide") wideCount++;
    });

    if (total === 0) return "stable" as const;
    const ratio = wideCount / total;
    if (ratio >= 0.65) return "stable" as const;
    if (ratio >= 0.35) return "moderate" as const;
    return "sensitive" as const;
  }, [sa]);

  if (!sa) return null;

  const stabilityConfig = {
    stable: {
      icon: <ShieldCheck className="w-5 h-5 text-green-600" />,
      label: t("الحل مستقر جداً", "Solution très stable"),
      labelSec: t("Solution très stable", "الحل مستقر جداً"),
      desc: t(
        "جميع المعاملات لديها هوامش واسعة — يمكنك التصرف بثقة.",
        "Tous les paramètres ont de larges marges — agissez avec confiance."
      ),
      cls: "border-green-300 bg-green-50/60",
      badgeCls: "bg-green-100 text-green-800 border-green-300",
    },
    moderate: {
      icon: <AlertTriangle className="w-5 h-5 text-orange-500" />,
      label: t("الحل حساس لبعض المتغيرات", "Solution modérément sensible"),
      labelSec: t("Solution modérément sensible", "الحل حساس لبعض المتغيرات"),
      desc: t(
        "بعض المعاملات لها هوامش ضيقة — راقب التغييرات باهتمام.",
        "Certains paramètres ont des marges étroites — surveillez les évolutions."
      ),
      cls: "border-orange-300 bg-orange-50/60",
      badgeCls: "bg-orange-100 text-orange-800 border-orange-300",
    },
    sensitive: {
      icon: <AlertOctagon className="w-5 h-5 text-red-600" />,
      label: t("الحل حساس — انتبه لتغيرات السوق", "Solution sensible — vigilance requise"),
      labelSec: t("Solution sensible — vigilance requise", "الحل حساس — انتبه لتغيرات السوق"),
      desc: t(
        "معظم المعاملات قريبة من حدودها الحرجة — أي تغيير في السوق قد يغير القرار الأمثل.",
        "La plupart des paramètres sont proches de leurs limites — tout changement de marché peut modifier la décision optimale."
      ),
      cls: "border-red-300 bg-red-50/60",
      badgeCls: "bg-red-100 text-red-800 border-red-300",
    },
  };

  const stab = stability ? stabilityConfig[stability] : null;

  const objTooltipIncrease = t(
    "La hausse maximale du coefficient de profit avant que l'ordre de production optimal change.",
    "أقصى زيادة في معامل الربح قبل أن يتغير ترتيب الإنتاج المثلى."
  );
  const objTooltipDecrease = t(
    "La baisse maximale du coefficient de profit avant que la solution change.",
    "أقصى انخفاض في معامل الربح قبل تغيير الحل."
  );
  const shadowTooltip = t(
    "Chaque unité supplémentaire de cette ressource augmente (ou diminue) la valeur optimale de ce montant.",
    "كل وحدة إضافية من هذا المورد تزيد (أو تقلل) القيمة المثلى بهذا المبلغ."
  );
  const rhsIncTooltip = t(
    "De combien peut augmenter la limite de cette ressource avant que la base optimale change.",
    "بكم يمكن أن تزيد طاقة هذا المورد قبل أن تتغير قاعدة الحل المثلى."
  );
  const rhsDecTooltip = t(
    "De combien peut diminuer la limite de cette ressource avant que la base optimale change.",
    "بكم يمكن أن تنخفض طاقة هذا المورد قبل أن تتغير قاعدة الحل المثلى."
  );

  return (
    <Card className="border-2 border-muted">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle
              className="flex items-center gap-3 text-xl cursor-pointer select-none"
              onClick={() => setOpen((o) => !o)}
            >
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <span>
                <span className="block">{t("Analyse de Sensibilité", "تحليل الحساسية")}</span>
                <span className="block text-sm font-normal text-muted-foreground mt-0.5">
                  {t("تحليل الحساسية", "Sensitivity Analysis")}
                </span>
              </span>
            </CardTitle>
            <CardDescription className={cn("mt-2 max-w-2xl", language === "ar" && "text-right")}>
              {t(
                "مدى تحمّل الحل الأمثل للتغيرات — المنطقة الآمنة لكل معامل قبل أن يتغير القرار.",
                "Jusqu'où le solution optimale peut-elle absorber des variations avant que la décision change."
              )}
            </CardDescription>
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 mt-1 rounded-lg p-2 hover:bg-muted/50 transition-colors text-muted-foreground"
          >
            {open ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="pt-6 space-y-6">

          {/* Stability summary card */}
          {stab && (
            <div className={cn(
              "rounded-xl border-2 px-5 py-4 flex items-start gap-4",
              stab.cls,
              language === "ar" && "flex-row-reverse"
            )}>
              <span className="shrink-0 mt-0.5">{stab.icon}</span>
              <div className={cn(language === "ar" && "text-right")}>
                <p className="font-bold text-base text-foreground">{stab.label}</p>
                <p className="text-sm text-muted-foreground">{stab.labelSec}</p>
                <p className="text-sm mt-1.5 text-foreground/80">{stab.desc}</p>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {[
                    { k: "wide", label: t("هامش واسع", "Marge large"), cls: "bg-green-100 text-green-800 border-green-300" },
                    { k: "narrow", label: t("هامش ضيق", "Marge étroite"), cls: "bg-orange-100 text-orange-800 border-orange-300" },
                    { k: "critical", label: t("حرج", "Critique"), cls: "bg-red-100 text-red-800 border-red-300" },
                  ].map(({ k, label, cls }) => (
                    <span key={k} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", cls)}>
                      <span className={cn("w-2 h-2 rounded-full", RANGE_DOT[k])} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Objective coefficients */}
          {sa.objectiveCoefficients.length > 0 && (
            <CollapsibleSection
              defaultOpen
              title={
                <span>
                  <span className="text-foreground">
                    {t("معاملات دالة الهدف", "Coefficients de l'objectif")}
                  </span>
                  <span className={cn("block text-xs font-normal text-muted-foreground mt-0.5", language === "ar" ? "text-right" : "")}>
                    {t("Coefficients de l'objectif", "معاملات دالة الهدف")} —{" "}
                    {isMax
                      ? t("ربح/وحدة", "Profit/unité")
                      : t("تكلفة/وحدة", "Coût/unité")}
                  </span>
                </span>
              }
              badge={
                <Badge variant="outline" className="text-xs font-medium">
                  {sa.objectiveCoefficients.length} {t("متغيرات", "variables")}
                </Badge>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className={cn("px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs", language === "ar" ? "text-right" : "text-left")}>
                        {t("المتغير", "Variable")}
                      </th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs text-center">
                        {t("الحالي", "Actuel")}
                      </th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs text-center">
                        <span className="flex items-center justify-center gap-1">
                          {t("زيادة مسموحة", "Hausse max")}
                          <Tooltip text={objTooltipIncrease} />
                        </span>
                      </th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs text-center">
                        <span className="flex items-center justify-center gap-1">
                          {t("نقصان مسموح", "Baisse max")}
                          <Tooltip text={objTooltipDecrease} />
                        </span>
                      </th>
                      <th className={cn("px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs", language === "ar" ? "text-right" : "text-left")}>
                        {t("تفسير", "Explication")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sa.objectiveCoefficients.map((v, i) => {
                      const varUnit = input.variables[i]?.unit;
                      const incClass = rangeClass(v.allowableIncrease, v.currentValue);
                      const decClass = rangeClass(v.allowableDecrease, v.currentValue);

                      let explanation = "";
                      if (language === "ar") {
                        const dec = v.allowableDecrease !== null && v.allowableDecrease !== undefined;
                        const inc = v.allowableIncrease !== null && v.allowableIncrease !== undefined;
                        if (dec) {
                          explanation = `يمكن أن ${isMax ? "ينخفض ربح" : "يرتفع تكلفة"} "${v.name}" بما يصل إلى ${fmt(v.allowableDecrease!, language)} دج دون تغيير قرارك الأمثل.`;
                        } else if (inc) {
                          explanation = `الزيادة فوق ${fmt(v.currentValue + (v.allowableIncrease ?? 0), language)} دج ستغير الخطة المثلى.`;
                        } else {
                          explanation = `المعامل مرن — الحل مستقر بغض النظر عن تغييرات سعر هذا المنتج.`;
                        }
                      } else {
                        const dec = v.allowableDecrease !== null && v.allowableDecrease !== undefined;
                        const inc = v.allowableIncrease !== null && v.allowableIncrease !== undefined;
                        if (dec) {
                          explanation = `Le ${isMax ? "profit" : "coût"} de "${v.name}" peut baisser jusqu'à ${fmt(v.allowableDecrease!, language)} DZD sans changer la décision optimale.`;
                        } else if (inc) {
                          explanation = `Au-delà de ${fmt(v.currentValue + (v.allowableIncrease ?? 0), language)} DZD, le plan optimal change.`;
                        } else {
                          explanation = `Coefficient flexible — la solution est stable peu importe l'évolution du prix de ce produit.`;
                        }
                      }

                      return (
                        <tr key={i} className={cn("border-b last:border-0 transition-colors hover:bg-muted/20", v.isCritical && "bg-orange-50/30")}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground">{v.name}</p>
                            {varUnit && <p className="text-xs text-muted-foreground">{varUnit}</p>}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-medium">
                            {fmt(v.currentValue, language)}
                            {varUnit && <span className="text-xs text-muted-foreground ml-1">DZD</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <RangeCell value={v.allowableIncrease} base={v.currentValue} lang={language} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <RangeCell value={v.allowableDecrease} base={v.currentValue} lang={language} />
                          </td>
                          <td className={cn("px-4 py-3 text-xs text-muted-foreground leading-relaxed max-w-xs", language === "ar" && "text-right")}>
                            {explanation}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          )}

          {/* Constraint RHS */}
          {sa.constraints.length > 0 && (
            <CollapsibleSection
              defaultOpen
              title={
                <span>
                  <span className="text-foreground">
                    {t("قيود الموارد (الطاقة)", "Capacité des ressources (contraintes)")}
                  </span>
                  <span className={cn("block text-xs font-normal text-muted-foreground mt-0.5")}>
                    {t("Capacité des ressources", "طاقة الموارد")} —{" "}
                    {t("الهامش الآمن لكل قيد", "Marge de sécurité de chaque contrainte")}
                  </span>
                </span>
              }
              badge={
                <Badge variant="outline" className="text-xs font-medium">
                  {sa.constraints.length} {t("قيود", "contraintes")}
                </Badge>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className={cn("px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs", language === "ar" ? "text-right" : "text-left")}>
                        {t("القيد", "Contrainte")}
                      </th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs text-center">
                        {t("الطاقة الحالية", "Capacité actuelle")}
                      </th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs text-center">
                        <span className="flex items-center justify-center gap-1">
                          {t("زيادة مسموحة", "Hausse max")}
                          <Tooltip text={rhsIncTooltip} />
                        </span>
                      </th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs text-center">
                        <span className="flex items-center justify-center gap-1">
                          {t("نقصان مسموح", "Baisse max")}
                          <Tooltip text={rhsDecTooltip} />
                        </span>
                      </th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs text-center">
                        <span className="flex items-center justify-center gap-1">
                          {t("سعر الظل", "Prix fictif")}
                          <Tooltip text={shadowTooltip} />
                        </span>
                      </th>
                      <th className={cn("px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide text-xs", language === "ar" ? "text-right" : "text-left")}>
                        {t("تفسير", "Explication")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sa.constraints.map((c, i) => {
                      const cUnit = input.constraints[i]?.unit;
                      const binding = c.isCritical;
                      const sp = c.shadowPrice;

                      let explanation = "";
                      if (language === "ar") {
                        if (sp !== null && sp !== undefined && Math.abs(sp) > 1e-6) {
                          explanation = `كل وحدة إضافية من "${c.name}" ${isMax ? "ترفع ربحك" : "تخفض تكلفتك"} بـ ${fmt(Math.abs(sp), language)} دج.`;
                          if (c.allowableIncrease !== null && c.allowableIncrease !== undefined) {
                            explanation += ` الطاقة يمكن رفعها بحد أقصى ${fmt(c.allowableIncrease, language)} وحدة دون تغيير البنية المثلى.`;
                          }
                        } else {
                          explanation = `هذا المورد غير مُقيِّد حالياً — يوجد فائض. لا توجد فائدة إضافية من زيادة طاقته.`;
                        }
                      } else {
                        if (sp !== null && sp !== undefined && Math.abs(sp) > 1e-6) {
                          explanation = `Chaque unité supplémentaire de "${c.name}" ${isMax ? "augmente votre profit" : "réduit votre coût"} de ${fmt(Math.abs(sp), language)} DZD.`;
                          if (c.allowableIncrease !== null && c.allowableIncrease !== undefined) {
                            explanation += ` La capacité peut augmenter de ${fmt(c.allowableIncrease, language)} unités maximum sans changer la base optimale.`;
                          }
                        } else {
                          explanation = `Ressource non contraignante — elle a du surplus. Augmenter sa capacité n'améliore pas le résultat.`;
                        }
                      }

                      return (
                        <tr key={i} className={cn("border-b last:border-0 hover:bg-muted/20", binding && "bg-orange-50/30")}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-foreground">{c.name}</p>
                              {binding ? (
                                <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300">
                                  {t("مُقيِّد", "Contraignant")}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                                  {t("فائض", "Surplus")}
                                </Badge>
                              )}
                            </div>
                            {cUnit && <p className="text-xs text-muted-foreground mt-0.5">{cUnit}</p>}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-medium">
                            {fmt(c.currentValue, language)}
                            {cUnit && <span className="text-xs text-muted-foreground ml-1">{cUnit}</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <RangeCell value={c.allowableIncrease} base={c.currentValue} lang={language} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <RangeCell value={c.allowableDecrease} base={c.currentValue} lang={language} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            {sp !== null && sp !== undefined ? (
                              <span className={cn(
                                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-mono font-bold",
                                Math.abs(sp) > 1e-6
                                  ? "bg-primary/10 text-primary border-primary/20"
                                  : "bg-muted text-muted-foreground border-border"
                              )}>
                                {Math.abs(sp) > 1e-6 ? (sp > 0 ? "+" : "") : ""}{fmt(sp, language)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className={cn("px-4 py-3 text-xs text-muted-foreground leading-relaxed max-w-xs", language === "ar" && "text-right")}>
                            {explanation}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          )}

          {/* Legend */}
          <div className={cn(
            "rounded-xl bg-muted/30 border px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground",
            language === "ar" && "flex-row-reverse"
          )}>
            <span className="font-semibold text-foreground">{t("دليل الألوان:", "Légende :")}</span>
            {[
              { k: "wide", label: t("هامش ≥ 25% → الحل مريح", "Marge ≥ 25% → confortable") },
              { k: "narrow", label: t("هامش 8–25% → مراقبة", "Marge 8–25% → à surveiller") },
              { k: "critical", label: t("هامش < 8% → تحذير", "Marge < 8% → attention") },
            ].map(({ k, label }) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={cn("w-2.5 h-2.5 rounded-full", RANGE_DOT[k])} />
                {label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-green-700">∞</span>
              {t("= غير محدود (أي قيمة مقبولة)", "= illimité")}
            </span>
          </div>

        </CardContent>
      )}
    </Card>
  );
}
