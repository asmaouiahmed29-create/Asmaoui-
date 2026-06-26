import { useMemo } from "react";
import type { ProblemInput, SolveResult } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Lightbulb, ArrowUpCircle } from "lucide-react";

interface Props {
  input: ProblemInput;
  result: SolveResult;
}

interface ConstraintStatus {
  name: string;
  slack: number;
  rhs: number;
  shadowPrice: number | null;
  isBinding: boolean;
  operator: string;
}

interface VariableContribution {
  name: string;
  value: number;
  coefficient: number;
  unit: string | null | undefined;
  contribution: number;
}

interface PrioritizedAction {
  rank: number;
  impact: number;
  textFr: string;
  textAr: string;
  type: "critical" | "opportunity" | "positive";
}

function fmt(n: number, lang: string) {
  return n.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", { maximumFractionDigits: 2 });
}

function computeSlack(
  input: ProblemInput,
  result: SolveResult,
  sensitivityConstraints: SolveResult["sensitivityAnalysis"]
): ConstraintStatus[] {
  const resultVarMap: Record<string, number> = {};
  for (const rv of result.variables ?? []) {
    resultVarMap[rv.name] = rv.value;
  }

  return input.constraints.map((c, i) => {
    const lhsValue = c.coefficients.reduce((sum, coef, j) => {
      const varValue = result.variables?.[j]?.value ?? 0;
      return sum + coef * varValue;
    }, 0);

    let slack: number;
    if (c.operator === "<=") {
      slack = c.rhs - lhsValue;
    } else if (c.operator === ">=") {
      slack = lhsValue - c.rhs;
    } else {
      slack = 0;
    }

    const sensRow = sensitivityConstraints?.constraints?.[i];
    const shadowPrice = sensRow?.shadowPrice ?? null;
    const isBinding = Math.abs(slack) < 1e-4;

    return {
      name: c.name,
      slack: Math.max(0, slack),
      rhs: c.rhs,
      shadowPrice,
      isBinding,
      operator: c.operator,
    };
  });
}

function buildPrioritizedActions(
  contributions: VariableContribution[],
  constraintStatuses: ConstraintStatus[],
  input: ProblemInput,
  lang: string
): PrioritizedAction[] {
  const actions: PrioritizedAction[] = [];

  // Binding constraints ranked by shadow price magnitude
  for (const cs of constraintStatuses) {
    if (cs.isBinding && cs.shadowPrice !== null && Math.abs(cs.shadowPrice) > 1e-4) {
      actions.push({
        rank: 0,
        impact: Math.abs(cs.shadowPrice),
        textFr: `Augmenter la capacité de "${cs.name}" — chaque unité supplémentaire rapporte ${fmt(Math.abs(cs.shadowPrice), lang)} DZD de profit additionnel.`,
        textAr: `زيادة طاقة "${cs.name}" — كل وحدة إضافية تُدرّ ${fmt(Math.abs(cs.shadowPrice), lang)} دج ربحاً إضافياً.`,
        type: "critical",
      });
    }
  }

  // Non-binding constraints: opportunity to reduce cost
  for (const cs of constraintStatuses) {
    if (!cs.isBinding && cs.slack > 1e-4) {
      const savingsEstimate = cs.slack * 0.05 * (cs.rhs > 0 ? 1 : 0);
      actions.push({
        rank: 0,
        impact: savingsEstimate,
        textFr: `Réduire l'allocation de "${cs.name}" de ${fmt(cs.slack, lang)} unités — ressource non entièrement utilisée, économisez sur les coûts fixes.`,
        textAr: `تقليل تخصيص "${cs.name}" بمقدار ${fmt(cs.slack, lang)} وحدة — المورد لم يُستخدم بالكامل، وفّر في التكاليف الثابتة.`,
        type: "opportunity",
      });
    }
  }

  // Top contributing variable — recommend focus
  const sorted = [...contributions].sort((a, b) => b.contribution - a.contribution);
  for (let i = 0; i < Math.min(2, sorted.length); i++) {
    const v = sorted[i];
    if (v.value > 1e-4) {
      actions.push({
        rank: 0,
        impact: v.contribution,
        textFr: `Maintenir la production de "${v.name}" à ${fmt(v.value, lang)} ${v.unit ?? "unités"} — c'est votre ${i === 0 ? "principale" : "deuxième"} source de ${input.objectiveType === "maximize" ? "profit" : "économies"}.`,
        textAr: `الحفاظ على ${input.objectiveType === "maximize" ? "إنتاج" : "استخدام"} "${v.name}" عند ${fmt(v.value, lang)} ${v.unit ?? "وحدة"} — هذا ${i === 0 ? "المصدر الرئيسي" : "المصدر الثاني"} لـ${input.objectiveType === "maximize" ? "الربح" : "التوفير"}.`,
        type: "positive",
      });
    }
  }

  // Sort by financial impact descending and assign ranks
  actions.sort((a, b) => b.impact - a.impact);
  actions.forEach((a, i) => { a.rank = i + 1; });

  return actions;
}

export function ManagerialRecommendations({ input, result }: Props) {
  const { t, language } = useLanguage();

  const constraintStatuses = useMemo(
    () => computeSlack(input, result, result.sensitivityAnalysis),
    [input, result]
  );

  const variableContributions = useMemo<VariableContribution[]>(() => {
    return (result.variables ?? []).map((rv) => {
      const inputVar = input.variables.find((iv) => iv.name === rv.name);
      const coef = inputVar?.coefficient ?? 0;
      return {
        name: rv.name,
        value: rv.value,
        coefficient: coef,
        unit: rv.unit,
        contribution: coef * rv.value,
      };
    });
  }, [input, result]);

  const prioritizedActions = useMemo(
    () => buildPrioritizedActions(variableContributions, constraintStatuses, input, language),
    [variableContributions, constraintStatuses, input, language]
  );

  const bindingCount = constraintStatuses.filter((c) => c.isBinding).length;
  const nonBindingCount = constraintStatuses.filter((c) => !c.isBinding).length;
  const objectiveLabel = input.objectiveType === "maximize"
    ? t("profit total", "الربح الإجمالي")
    : t("coût total", "التكلفة الإجمالية");

  return (
    <Card className="border-2 border-primary/20 print:border print:shadow-none">
      <CardHeader className="pb-2 border-b">
        <CardTitle className="flex items-center gap-3 text-xl">
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            <Lightbulb className="w-5 h-5" />
          </span>
          <span>
            <span className="block text-foreground">
              {t("Recommandations Managériales", "التوصيات الإدارية")}
            </span>
            <span className="block text-sm font-normal text-muted-foreground mt-0.5">
              {t("التوصيات الإدارية", "Recommandations Managériales")}
            </span>
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-6 space-y-8">

        {/* Objective headline */}
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-5 flex items-start gap-4">
          <span className="rounded-full bg-primary/15 p-2 text-primary shrink-0 mt-0.5">
            {input.objectiveType === "maximize"
              ? <TrendingUp className="w-5 h-5" />
              : <TrendingDown className="w-5 h-5" />}
          </span>
          <div className="space-y-1">
            <p className="font-bold text-foreground text-lg leading-snug">
              {language === "ar"
                ? `${input.objectiveType === "maximize" ? "الربح الأمثل" : "التكلفة الأدنى"} هو ${fmt(result.optimalValue ?? 0, language)} دج — وهو الحد الأقصى الممكن تحقيقه بمواردك الحالية.`
                : `Votre ${input.objectiveType === "maximize" ? "profit optimal" : "coût minimal"} est de ${fmt(result.optimalValue ?? 0, language)} DZD — c'est le maximum réalisable avec vos ressources actuelles.`}
            </p>
            <p className="text-sm text-muted-foreground">
              {language === "ar"
                ? `${fmt(result.optimalValue ?? 0, language)} دج — ${input.objectiveType === "maximize" ? "Profit optimal" : "Coût minimal"}`
                : `${fmt(result.optimalValue ?? 0, language)} DZD — ${input.objectiveType === "maximize" ? "الربح الأمثل" : "التكلفة الأدنى"}`}
            </p>
          </div>
        </div>

        {/* Variable recommendations */}
        {variableContributions.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-primary inline-block" />
              {t("Plan de Production / Allocation", "خطة الإنتاج / التوزيع")}
            </h3>
            <div className="space-y-2">
              {variableContributions.map((v, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-4",
                    v.value > 1e-4
                      ? "bg-green-50/60 border-green-200"
                      : "bg-muted/40 border-muted text-muted-foreground"
                  )}
                >
                  <CheckCircle2
                    className={cn(
                      "w-5 h-5 mt-0.5 shrink-0",
                      v.value > 1e-4 ? "text-green-600" : "text-muted-foreground"
                    )}
                  />
                  <div className="flex-1 space-y-0.5">
                    <p className={cn("font-semibold", language === "ar" && "text-right")}>
                      {language === "ar"
                        ? `${input.objectiveType === "maximize" ? "أنتج" : "استخدم"} ${fmt(v.value, language)} ${v.unit ?? "وحدة"} من "${v.name}"`
                        : `${input.objectiveType === "maximize" ? "Produire" : "Utiliser"} ${fmt(v.value, language)} ${v.unit ?? "unités"} de "${v.name}"`}
                    </p>
                    <p className={cn("text-sm text-muted-foreground", language === "ar" && "text-right")}>
                      {language === "ar"
                        ? `مساهمة في ${objectiveLabel}: ${fmt(v.contribution, language)} دج (المعامل: ${fmt(v.coefficient, language)} دج/${v.unit ?? "وحدة"})`
                        : `Contribution au ${objectiveLabel}: ${fmt(v.contribution, language)} DZD (coefficient: ${fmt(v.coefficient, language)} DZD/${v.unit ?? "unité"})`}
                    </p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-md px-2.5 py-1 text-sm font-bold",
                    v.value > 1e-4 ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"
                  )}>
                    {fmt(v.contribution, language)} {t("DZD", "دج")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Constraint status */}
        {constraintStatuses.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-amber-500 inline-block" />
              {t("État des Ressources", "حالة الموارد")}
              <span className="text-xs font-normal text-muted-foreground">
                ({bindingCount} {t("saturée(s)", "مستنفدة")} · {nonBindingCount} {t("disponible(s)", "متاحة")})
              </span>
            </h3>
            <div className="space-y-2">
              {constraintStatuses.map((cs, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-4",
                    cs.isBinding
                      ? "bg-orange-50/70 border-orange-300"
                      : "bg-green-50/60 border-green-200"
                  )}
                >
                  {cs.isBinding ? (
                    <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-0.5">
                    <p className={cn(
                      "font-semibold",
                      cs.isBinding ? "text-orange-800" : "text-green-800",
                      language === "ar" && "text-right"
                    )}>
                      {cs.name}
                    </p>
                    {cs.isBinding ? (
                      <p className={cn("text-sm text-orange-700", language === "ar" && "text-right")}>
                        {language === "ar"
                          ? `⚠️ هذا المورد استُنفد بالكامل — أي زيادة فيه ستزيد ${input.objectiveType === "maximize" ? "ربحك" : "كفاءتك"} مباشرة${cs.shadowPrice !== null ? ` بمعدل ${fmt(Math.abs(cs.shadowPrice ?? 0), language)} دج لكل وحدة` : ""}.`
                          : `⚠️ Cette ressource est entièrement saturée — toute augmentation de sa capacité améliorera directement votre ${input.objectiveType === "maximize" ? "profit" : "efficacité"}${cs.shadowPrice !== null ? ` de ${fmt(Math.abs(cs.shadowPrice ?? 0), language)} DZD par unité` : ""}.`}
                      </p>
                    ) : (
                      <p className={cn("text-sm text-green-700", language === "ar" && "text-right")}>
                        {language === "ar"
                          ? `✅ لديك فائض ${fmt(cs.slack, language)} وحدة من هذا المورد — يمكن تقليله لتوفير التكاليف الثابتة.`
                          : `✅ Vous avez un surplus de ${fmt(cs.slack, language)} unités sur cette ressource — envisagez de réduire son allocation pour économiser.`}
                      </p>
                    )}
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
                    cs.isBinding
                      ? "bg-orange-100 text-orange-800"
                      : "bg-green-100 text-green-800"
                  )}>
                    {cs.isBinding
                      ? t("Saturée", "مستنفدة")
                      : `+${fmt(cs.slack, language)} ${t("dispo.", "متاح")}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prioritized action list */}
        {prioritizedActions.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-blue-500 inline-block" />
              {t("Actions Prioritaires", "الأولويات التنفيذية")}
              <span className="text-xs font-normal text-muted-foreground">
                {t("classées par impact financier", "مرتبة حسب التأثير المالي")}
              </span>
            </h3>
            <ol className="space-y-2">
              {prioritizedActions.map((action) => (
                <li key={action.rank} className={cn(
                  "flex items-start gap-4 rounded-lg border p-4",
                  action.type === "critical" && "bg-orange-50/50 border-orange-200",
                  action.type === "opportunity" && "bg-blue-50/50 border-blue-200",
                  action.type === "positive" && "bg-green-50/50 border-green-200",
                )}>
                  <span className={cn(
                    "shrink-0 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm",
                    action.type === "critical" && "bg-orange-200 text-orange-800",
                    action.type === "opportunity" && "bg-blue-200 text-blue-800",
                    action.type === "positive" && "bg-green-200 text-green-800",
                  )}>
                    {action.rank}
                  </span>
                  <div className="flex-1 space-y-1">
                    <p className={cn("text-sm font-medium text-foreground leading-relaxed", language === "ar" && "text-right")}>
                      {language === "ar" ? action.textAr : action.textFr}
                    </p>
                    <p className={cn("text-xs text-muted-foreground", language === "ar" && "text-right")}>
                      {language === "ar" ? action.textFr : action.textAr}
                    </p>
                  </div>
                  {action.impact > 0 && (
                    <div className={cn(
                      "shrink-0 flex items-center gap-1 text-xs font-semibold rounded-md px-2 py-1",
                      action.type === "critical" && "bg-orange-100 text-orange-800",
                      action.type === "opportunity" && "bg-blue-100 text-blue-800",
                      action.type === "positive" && "bg-green-100 text-green-800",
                    )}>
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      {fmt(action.impact, language)} {t("DZD", "دج")}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
