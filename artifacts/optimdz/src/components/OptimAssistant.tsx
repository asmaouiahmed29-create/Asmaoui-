import { useState, useEffect, useMemo } from "react";
import type { ProblemInput, SolveResult } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Bot } from "lucide-react";

interface Props {
  input: ProblemInput;
  result: SolveResult;
}

interface Paragraph {
  labelFr: string;
  labelAr: string;
  textFr: string;
  textAr: string;
}

function fmt(n: number, lang: string) {
  return n.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    maximumFractionDigits: 2,
  });
}

function generateParagraphs(input: ProblemInput, result: SolveResult): Paragraph[] {
  const vars = result.variables ?? [];
  const constraints = result.sensitivityAnalysis?.constraints ?? [];
  const objectiveType = input.objectiveType;
  const optVal = result.optimalValue ?? 0;

  // Paragraph 1 — Why this is optimal
  const activeVars = vars.filter((v) => v.value > 1e-4);
  const zeroVars = vars.filter((v) => v.value <= 1e-4);
  const mixFr = activeVars.map((v) => `${fmt(v.value, "fr")} ${v.unit ?? "unités"} de "${v.name}"`).join(" et ");
  const mixAr = activeVars.map((v) => `${fmt(v.value, "ar")} ${v.unit ?? "وحدة"} من "${v.name}"`).join(" و");
  const zeroMentionFr = zeroVars.length > 0 ? ` La production de "${zeroVars.map((v) => v.name).join(", ")}" est nulle car elle n'ajoute pas de valeur supplémentaire étant donné les ressources disponibles.` : "";
  const zeroMentionAr = zeroVars.length > 0 ? ` إنتاج "${zeroVars.map((v) => v.name).join("، ")}" صفر لأنه لا يضيف قيمة إضافية في ظل الموارد المتاحة.` : "";

  const p1Fr = `Ce mélange — ${mixFr} — a été sélectionné car il exploite vos ressources disponibles de la manière la plus efficace possible tout en atteignant le ${objectiveType === "maximize" ? "profit maximum" : "coût minimum"} de ${fmt(optVal, "fr")} DZD. L'algorithme Simplex a testé toutes les combinaisons possibles et confirmé qu'aucune autre allocation ne peut faire mieux.${zeroMentionFr}`;
  const p1Ar = `تم اختيار هذا المزيج — ${mixAr} — لأنه يستغل مواردك المتاحة بأكمل صورة ممكنة مع تحقيق ${objectiveType === "maximize" ? "أعلى ربح" : "أدنى تكلفة"} وهو ${fmt(optVal, "ar")} دج. اختبرت خوارزمية السمبلكس جميع التوليفات الممكنة وأكدت أن أي توزيع آخر لن يكون أفضل من ذلك.${zeroMentionAr}`;

  // Paragraph 2 — Bottleneck resource
  const binding = constraints
    .filter((c) => c.isCritical && c.shadowPrice !== null && Math.abs(c.shadowPrice ?? 0) > 1e-4)
    .sort((a, b) => Math.abs(b.shadowPrice ?? 0) - Math.abs(a.shadowPrice ?? 0));

  let p2Fr: string;
  let p2Ar: string;

  if (binding.length > 0) {
    const top = binding[0];
    const impact10 = Math.abs(top.shadowPrice ?? 0) * 10;
    p2Fr = `Le facteur limitant principal de votre ${objectiveType === "maximize" ? "profit" : "performance"} est "${top.name}". Cette ressource est entièrement saturée — ajouter 10 unités supplémentaires augmenterait votre ${objectiveType === "maximize" ? "profit" : "efficacité"} de ${fmt(impact10, "fr")} DZD (${fmt(Math.abs(top.shadowPrice ?? 0), "fr")} DZD par unité). ${binding.length > 1 ? `"${binding[1].name}" est aussi saturé avec un impact de ${fmt(Math.abs(binding[1].shadowPrice ?? 0), "fr")} DZD par unité.` : ""}`;
    p2Ar = `المورد الأكثر تأثيراً على ${objectiveType === "maximize" ? "ربحك" : "أدائك"} هو "${top.name}". هذا المورد استُنفد بالكامل — لو زدته بـ 10 وحدات إضافية، ${objectiveType === "maximize" ? "ربحك سيرتفع" : "تكلفتك ستنخفض"} بـ ${fmt(impact10, "ar")} دج (${fmt(Math.abs(top.shadowPrice ?? 0), "ar")} دج لكل وحدة إضافية). ${binding.length > 1 ? `"${binding[1].name}" أيضاً مستنفد بتأثير ${fmt(Math.abs(binding[1].shadowPrice ?? 0), "ar")} دج لكل وحدة.` : ""}`;
  } else {
    p2Fr = `Aucune ressource n'est entièrement saturée dans votre solution actuelle. Cela signifie qu'il reste des marges de manœuvre sur l'ensemble de vos ressources, et que des ajustements mineurs de vos contraintes n'auraient pas d'impact significatif sur votre ${objectiveType === "maximize" ? "profit" : "coût"}.`;
    p2Ar = `لا يوجد مورد مستنفد بالكامل في حلك الحالي. هذا يعني أن لديك هامشاً في جميع مواردك، وأن التعديلات الطفيفة على قيودك لن يكون لها تأثير كبير على ${objectiveType === "maximize" ? "ربحك" : "تكلفتك"}.`;
  }

  // Paragraph 3 — Most profitable variable (value per coefficient unit)
  const inputVarMap: Record<string, number> = {};
  for (const iv of input.variables) inputVarMap[iv.name] = iv.coefficient;

  const ranked = vars
    .filter((v) => v.value > 1e-4)
    .map((v) => ({
      ...v,
      coefficient: inputVarMap[v.name] ?? 0,
      contribution: (inputVarMap[v.name] ?? 0) * v.value,
    }))
    .sort((a, b) => b.coefficient - a.coefficient);

  let p3Fr: string;
  let p3Ar: string;

  if (ranked.length >= 2) {
    const top = ranked[0];
    const second = ranked[1];
    const diff = top.coefficient - second.coefficient;
    p3Fr = `En comparant vos variables, "${top.name}" génère ${fmt(top.coefficient, "fr")} DZD par ${top.unit ?? "unité"} — soit ${fmt(diff, "fr")} DZD de plus que "${second.name}" (${fmt(second.coefficient, "fr")} DZD/${second.unit ?? "unité"}). Avec ${fmt(top.value, "fr")} ${top.unit ?? "unités"} produites, "${top.name}" contribue ${fmt(top.contribution, "fr")} DZD au total, ce qui en fait votre levier de valeur le plus puissant.`;
    p3Ar = `بمقارنة متغيراتك، "${top.name}" يُدرّ ${fmt(top.coefficient, "ar")} دج لكل ${top.unit ?? "وحدة"} — أي بفارق ${fmt(diff, "ar")} دج عن "${second.name}" (${fmt(second.coefficient, "ar")} دج/${second.unit ?? "وحدة"}). مع إنتاج ${fmt(top.value, "ar")} ${top.unit ?? "وحدة"}، يساهم "${top.name}" بـ ${fmt(top.contribution, "ar")} دج من الإجمالي، مما يجعله الرافعة الأكثر قيمة في خطتك.`;
  } else if (ranked.length === 1) {
    const top = ranked[0];
    p3Fr = `"${top.name}" est votre seule variable active. Elle génère ${fmt(top.coefficient, "fr")} DZD par ${top.unit ?? "unité"} et contribue à l'intégralité de votre ${objectiveType === "maximize" ? "profit" : "résultat"} optimal (${fmt(optVal, "fr")} DZD).`;
    p3Ar = `"${top.name}" هو المتغير الوحيد النشط. يُدرّ ${fmt(top.coefficient, "ar")} دج لكل ${top.unit ?? "وحدة"} ويساهم في كامل ${objectiveType === "maximize" ? "ربحك" : "نتيجتك"} المثلى (${fmt(optVal, "ar")} دج).`;
  } else {
    p3Fr = `Aucune variable n'est active dans la solution — vérifiez vos données d'entrée.`;
    p3Ar = `لا يوجد متغير نشط في الحل — تحقق من بياناتك المُدخلة.`;
  }

  // Paragraph 4 — Next action
  let p4Fr: string;
  let p4Ar: string;

  if (binding.length > 0) {
    const bottleneck = binding[0];
    p4Fr = `Action prioritaire : augmentez la capacité de "${bottleneck.name}" en premier. Chaque unité supplémentaire vous rapporte ${fmt(Math.abs(bottleneck.shadowPrice ?? 0), "fr")} DZD — c'est l'investissement à plus fort retour disponible dans votre modèle actuel.`;
    p4Ar = `الأولوية التنفيذية: ركّز على زيادة طاقة "${bottleneck.name}" أولاً. كل وحدة إضافية تُدرّ ${fmt(Math.abs(bottleneck.shadowPrice ?? 0), "ar")} دج — هذا هو الاستثمار الأعلى عائداً المتاح في نموذجك الحالي.`;
  } else if (ranked.length > 0) {
    const top = ranked[0];
    p4Fr = `Votre modèle est bien équilibré. Concentrez-vous sur le maintien de la production de "${top.name}" et explorez des opportunités d'expansion globale de vos ressources pour débloquer un potentiel de croissance supplémentaire.`;
    p4Ar = `نموذجك متوازن جيداً. ركّز على الحفاظ على ${objectiveType === "maximize" ? "إنتاج" : "استخدام"} "${top.name}" واستكشف فرص التوسع العام في مواردك لإطلاق إمكانات نمو إضافية.`;
  } else {
    p4Fr = `Révisez les paramètres de votre modèle pour identifier des pistes d'amélioration.`;
    p4Ar = `راجع معلمات نموذجك لتحديد فرص التحسين.`;
  }

  return [
    {
      labelFr: "Pourquoi cette solution est optimale",
      labelAr: "لماذا هذا الحل هو الأمثل",
      textFr: p1Fr,
      textAr: p1Ar,
    },
    {
      labelFr: "Le goulot d'étranglement",
      labelAr: "نقطة الاختناق",
      textFr: p2Fr,
      textAr: p2Ar,
    },
    {
      labelFr: "Le scénario le plus rentable",
      labelAr: "السيناريو الأكثر ربحية",
      textFr: p3Fr,
      textAr: p3Ar,
    },
    {
      labelFr: "Action recommandée",
      labelAr: "الإجراء الموصى به",
      textFr: p4Fr,
      textAr: p4Ar,
    },
  ];
}

const BUBBLE_DELAY_MS = [120, 900, 1800, 2700];

export function OptimAssistant({ input, result }: Props) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(true);
  const [visibleCount, setVisibleCount] = useState(0);

  const paragraphs = useMemo(
    () => generateParagraphs(input, result),
    [input, result]
  );

  // Stagger bubble appearance
  useEffect(() => {
    setVisibleCount(0);
    const timers = BUBBLE_DELAY_MS.map((delay, i) =>
      setTimeout(() => setVisibleCount((prev) => Math.max(prev, i + 1)), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [input, result]);

  const isRtl = language === "ar";

  return (
    <div className="rounded-2xl border-2 border-primary/25 bg-card shadow-sm overflow-hidden print:border print:shadow-none">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-primary/5 hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className={cn("flex items-center gap-3", isRtl && "flex-row-reverse")}>
          <span className="rounded-xl bg-primary p-2 text-primary-foreground shrink-0">
            <Bot className="w-5 h-5" />
          </span>
          <div className={cn("text-left", isRtl && "text-right")}>
            <p className="font-bold text-foreground text-base leading-tight">
              {t("Assistant OptimDZ", "مساعد OptimDZ")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("مساعد OptimDZ", "Assistant OptimDZ")} — {t("explication en langage simple", "شرح بلغة بسيطة")}
            </p>
          </div>
        </div>
        <span className="text-muted-foreground shrink-0">
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </span>
      </button>

      {/* Chat body */}
      {open && (
        <div className={cn("px-5 py-6 space-y-5", isRtl && "direction-rtl")}>
          {paragraphs.slice(0, visibleCount).map((p, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500",
                isRtl ? "flex-row-reverse" : "flex-row"
              )}
            >
              {/* Avatar — only on first bubble */}
              {i === 0 ? (
                <span className="shrink-0 rounded-full bg-primary w-9 h-9 flex items-center justify-center text-primary-foreground mt-0.5">
                  <Bot className="w-5 h-5" />
                </span>
              ) : (
                <span className="shrink-0 w-9" />
              )}

              {/* Bubble */}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 space-y-1.5 shadow-sm",
                  isRtl ? "rounded-tr-sm" : "rounded-tl-sm",
                  "bg-muted/60 border border-border"
                )}
              >
                <p className={cn(
                  "text-xs font-semibold uppercase tracking-wide text-primary",
                  isRtl && "text-right"
                )}>
                  {language === "ar" ? p.labelAr : p.labelFr}
                  <span className="text-muted-foreground font-normal normal-case tracking-normal ml-2">
                    {language === "ar" ? `· ${p.labelFr}` : `· ${p.labelAr}`}
                  </span>
                </p>
                <p className={cn(
                  "text-sm text-foreground leading-relaxed",
                  isRtl && "text-right"
                )}>
                  {language === "ar" ? p.textAr : p.textFr}
                </p>
                <p className={cn(
                  "text-xs text-muted-foreground leading-relaxed border-t pt-1.5 mt-1",
                  isRtl && "text-right"
                )}>
                  {language === "ar" ? p.textFr : p.textAr}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator while more bubbles are loading */}
          {visibleCount < paragraphs.length && (
            <div className={cn("flex gap-3", isRtl && "flex-row-reverse")}>
              <span className="shrink-0 w-9" />
              <div className="rounded-2xl bg-muted/60 border border-border px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce"
                      style={{ animationDelay: `${dot * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
