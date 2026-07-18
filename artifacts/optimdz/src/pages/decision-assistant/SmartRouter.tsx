import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import {
  Brain, ArrowRight, RotateCcw, CheckCircle2,
  Calculator, Truck, Users, Network, TrendingUp,
  BarChart2, LineChart, GitCompare, Activity,
  ChevronRight, ChevronLeft, Sparkles,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Decision tree data
// ─────────────────────────────────────────────────────────────────────────────

interface Option {
  id: string;
  labelFr: string;
  labelAr: string;
  descFr?: string;
  descAr?: string;
  emoji: string;
}

const Q1_OPTIONS: Option[] = [
  {
    id: "resource",
    emoji: "⚙️",
    labelFr: "Optimiser l'allocation de ressources / minimiser les coûts ou maximiser les profits",
    labelAr: "تحسين تخصيص الموارد / تقليل التكاليف أو تعظيم الأرباح",
    descFr: "Vous avez des ressources limitées (personnes, machines, marchandises) à répartir de façon optimale.",
    descAr: "لديك موارد محدودة (أشخاص، آلات، بضائع) تريد توزيعها بشكل مثالي.",
  },
  {
    id: "pert",
    emoji: "📅",
    labelFr: "Planifier un projet complexe / gérer des tâches et des délais",
    labelAr: "تخطيط مشروع معقد / إدارة المهام والمواعيد النهائية",
    descFr: "Votre projet comporte plusieurs activités interdépendantes avec des durées et des contraintes.",
    descAr: "يحتوي مشروعك على أنشطة متعددة مترابطة بمدد وقيود.",
  },
  {
    id: "investment",
    emoji: "💰",
    labelFr: "Évaluer un investissement ou lancer un nouveau projet",
    labelAr: "تقييم استثمار أو إطلاق مشروع جديد",
    descFr: "Vous envisagez de dépenser de l'argent et voulez savoir si cela vaut le coup.",
    descAr: "تفكر في إنفاق مال وتريد معرفة ما إذا كان الأمر يستحق.",
  },
  {
    id: "kpi",
    emoji: "📊",
    labelFr: "Suivre et comprendre les performances actuelles de mon entreprise",
    labelAr: "متابعة وفهم أداء مؤسستي الحالي",
    descFr: "Votre activité tourne déjà et vous voulez surveiller vos indicateurs clés dans le temps.",
    descAr: "نشاطك قيد التشغيل وتريد مراقبة مؤشراتك الرئيسية عبر الزمن.",
  },
];

const Q2_RESOURCE: Option[] = [
  {
    id: "assignment",
    emoji: "🧩",
    labelFr: "Affecter des personnes ou machines à des tâches, une à une",
    labelAr: "تعيين أشخاص أو آلات على مهام، واحداً بواحد",
    descFr: "Ex. : 3 agents pour 3 missions — chaque agent fait une mission, au coût total minimum.",
    descAr: "مثال: ٣ عمال لـ٣ مهام — كل عامل يؤدي مهمة واحدة، بأدنى تكلفة إجمالية.",
  },
  {
    id: "transport",
    emoji: "🚚",
    labelFr: "Distribuer des marchandises depuis plusieurs sources vers plusieurs destinations",
    labelAr: "توزيع البضائع من مصادر متعددة إلى وجهات متعددة",
    descFr: "Ex. : 2 entrepôts fournissent 4 magasins — minimiser le coût de transport total.",
    descAr: "مثال: مستودعان يُزوّدان ٤ متاجر — تقليل إجمالي تكاليف النقل.",
  },
  {
    id: "simplex",
    emoji: "📐",
    labelFr: "Optimiser une formule de profit ou de coût avec plusieurs contraintes",
    labelAr: "تحسين معادلة ربح أو تكلفة مع قيود متعددة",
    descFr: "Ex. : maximiser Z = 5x₁ + 4x₂ sous des contraintes de matières premières et main-d'œuvre.",
    descAr: "مثال: تعظيم Z = 5x₁ + 4x₂ مع قيود المواد الأولية والعمالة.",
  },
];

const Q2_INVESTMENT: Option[] = [
  {
    id: "breakeven",
    emoji: "📈",
    labelFr: "Vérifier si mon projet couvrira ses charges fixes (point mort / seuil de rentabilité)",
    labelAr: "التحقق من أن مشروعي سيغطي تكاليفه الثابتة (نقطة التعادل)",
    descFr: "Je veux savoir combien je dois vendre minimum pour ne pas perdre d'argent.",
    descAr: "أريد أن أعرف الحد الأدنى من المبيعات حتى لا أخسر.",
  },
  {
    id: "investment-appraisal",
    emoji: "💹",
    labelFr: "Calculer le rendement complet d'un investissement (VAN, TRI, délai de récupération)",
    labelAr: "حساب العائد الكامل لاستثمار (NPV، IRR، فترة الاسترداد)",
    descFr: "J'ai des flux de trésorerie prévisionnels et je veux évaluer la rentabilité globale.",
    descAr: "لديّ تدفقات نقدية متوقعة وأريد تقييم الربحية الإجمالية.",
  },
  {
    id: "sensitivity",
    emoji: "🌡️",
    labelFr: "Comprendre l'impact des variations de prix, coûts ou volumes sur ma rentabilité",
    labelAr: "فهم تأثير تغيرات الأسعار أو التكاليف أو الأحجام على ربحيتي",
    descFr: "Je veux savoir quels paramètres sont critiques si les hypothèses changent.",
    descAr: "أريد معرفة أي المتغيرات حرجة إذا تغيّرت الافتراضيات.",
  },
  {
    id: "comparison",
    emoji: "⚖️",
    labelFr: "Comparer plusieurs options ou scénarios d'investissement côte à côte",
    labelAr: "مقارنة عدة خيارات أو سيناريوهات استثمارية جنباً إلى جنب",
    descFr: "J'ai 2 ou 3 alternatives et je veux savoir laquelle est la meilleure.",
    descAr: "لدي بديلان أو ثلاثة وأريد معرفة أيها الأفضل.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Recommendation data
// ─────────────────────────────────────────────────────────────────────────────

interface Recommendation {
  id: string;
  icon: React.ElementType;
  nameFr: string;
  nameAr: string;
  whyFr: string;
  whyAr: string;
  href: string;
  altsFr?: string;
  altsAr?: string;
  altLinks?: { nameFr: string; nameAr: string; href: string }[];
}

const RECOMMENDATIONS: Record<string, Recommendation> = {
  simplex: {
    id: "simplex",
    icon: Calculator,
    nameFr: "Programmation Linéaire — Simplexe",
    nameAr: "البرمجة الخطية — السمبلكس",
    whyFr:
      "Votre situation implique une formule d'objectif (maximiser profit ou minimiser coût) et plusieurs contraintes de ressources. Le Simplexe est exactement fait pour ça.",
    whyAr:
      "يتضمن وضعك معادلة هدف (تعظيم ربح أو تقليل تكلفة) مع قيود موارد متعددة. السمبلكس مُصمَّم تحديداً لهذا.",
    href: "/simplex",
    altsFr: "Si vous distribuez physiquement des biens entre entrepôts et magasins, essayez Transport. Si vous affectez des agents à des missions, essayez Affectation.",
    altsAr: "إذا كنت توزع بضائع فعلياً بين مستودعات ومتاجر، جرّب النقل. إذا كنت تعيّن عمالاً على مهام، جرّب التوزيع.",
    altLinks: [
      { nameFr: "Transport", nameAr: "النقل", href: "/transport" },
      { nameFr: "Affectation", nameAr: "التوزيع", href: "/assignment" },
    ],
  },
  transport: {
    id: "transport",
    icon: Truck,
    nameFr: "Problème de Transport",
    nameAr: "مسألة النقل",
    whyFr:
      "Vous avez plusieurs sources d'approvisionnement et plusieurs points de livraison avec des coûts unitaires de transport. Le module Transport optimise ce type de réseau de distribution.",
    whyAr:
      "لديك عدة مصادر تموين ونقاط توصيل متعددة مع تكاليف نقل وحدوية. وحدة النقل تُحسّن هذا النوع من شبكات التوزيع.",
    href: "/transport",
    altsFr: "Si vous affectez des personnes à des tâches en 1-à-1, Affectation est plus adapté. Pour des contraintes générales, essayez le Simplexe.",
    altsAr: "إذا كنت تعيّن أشخاصاً على مهام بنسبة 1-إلى-1، فالتوزيع أنسب. للقيود العامة، جرّب السمبلكس.",
    altLinks: [
      { nameFr: "Affectation", nameAr: "التوزيع", href: "/assignment" },
      { nameFr: "Simplexe", nameAr: "السمبلكس", href: "/simplex" },
    ],
  },
  assignment: {
    id: "assignment",
    icon: Users,
    nameFr: "Problème d'Affectation",
    nameAr: "مسألة التوزيع",
    whyFr:
      "Vous devez affecter un nombre égal d'agents à des tâches (un agent par tâche) en minimisant le coût total. La méthode Hongroise résout ce problème de manière optimale.",
    whyAr:
      "تحتاج إلى تعيين عدد متساوٍ من العمال على المهام (عامل لكل مهمة) بتقليل التكلفة الإجمالية. الطريقة الهنغارية تحل هذه المسألة بصورة مثلى.",
    href: "/assignment",
    altsFr: "Si vos ressources ne sont pas en correspondance 1-à-1 (plusieurs sources → plusieurs destinations), le Transport est plus adapté.",
    altsAr: "إذا لم تكن مواردك في تطابق 1-إلى-1 (مصادر متعددة إلى وجهات متعددة)، فالنقل أنسب.",
    altLinks: [
      { nameFr: "Transport", nameAr: "النقل", href: "/transport" },
    ],
  },
  pert: {
    id: "pert",
    icon: Network,
    nameFr: "PERT / CPM",
    nameAr: "بيرت / المسار الحرج",
    whyFr:
      "Votre projet comporte des activités séquentielles ou parallèles avec des durées et des dépendances. PERT/CPM identifie le chemin critique, calcule les marges et peut optimiser le délai via l'accélération.",
    whyAr:
      "يحتوي مشروعك على أنشطة متسلسلة أو متوازية بمدد وتبعيات. بيرت/المسار الحرج يحدد المسار الحرج ويحسب الهوامش ويمكنه تحسين المدة عبر التسريع.",
    href: "/pert-cpm",
    altsFr: "Si vous souhaitez aussi évaluer le budget du projet (rentabilité, ROI), complétez avec le module Faisabilité.",
    altsAr: "إذا أردت أيضاً تقييم ميزانية المشروع (الربحية، العائد)، أكمل بوحدة الجدوى.",
    altLinks: [
      { nameFr: "Faisabilité", nameAr: "الجدوى", href: "/project-feasibility" },
    ],
  },
  breakeven: {
    id: "breakeven",
    icon: TrendingUp,
    nameFr: "Analyse du Seuil de Rentabilité",
    nameAr: "تحليل نقطة التعادل",
    whyFr:
      "Vous voulez connaître le volume minimal de ventes pour couvrir les charges fixes. L'outil calcule le seuil de rentabilité, la marge de sécurité et vous donne une recommandation Go/No-Go.",
    whyAr:
      "تريد معرفة الحد الأدنى من المبيعات لتغطية التكاليف الثابتة. الأداة تحسب نقطة التعادل وهامش الأمان وتعطيك توصية Go/No-Go.",
    href: "/project-feasibility/breakeven",
    altsFr: "Pour aller plus loin avec un calcul de VAN et TRI, utilisez l'Évaluation de Rentabilité.",
    altsAr: "للمضي قُدُماً بحساب NPV وIRR، استخدم تقييم الجدوى الاستثمارية.",
    altLinks: [
      { nameFr: "Évaluation de Rentabilité", nameAr: "تقييم الجدوى", href: "/project-feasibility/investment-appraisal" },
    ],
  },
  "investment-appraisal": {
    id: "investment-appraisal",
    icon: BarChart2,
    nameFr: "Évaluation de la Rentabilité (VAN / TRI)",
    nameAr: "تقييم الجدوى الاستثمارية (NPV / IRR)",
    whyFr:
      "Vous avez des flux de trésorerie prévisionnels sur plusieurs années. L'outil calcule la VAN, le TRI, le délai de récupération et l'Indice de Rentabilité pour une décision éclairée.",
    whyAr:
      "لديك تدفقات نقدية متوقعة على عدة سنوات. الأداة تحسب NPV وIRR وفترة الاسترداد ومؤشر الربحية لاتخاذ قرار مدروس.",
    href: "/project-feasibility/investment-appraisal",
    altsFr: "Pour tester comment les variations de vos hypothèses affectent les résultats, complétez avec l'Analyse de Sensibilité.",
    altsAr: "لاختبار كيف تؤثر تغيرات افتراضاتك على النتائج، أكمل بتحليل الحساسية.",
    altLinks: [
      { nameFr: "Analyse de Sensibilité", nameAr: "تحليل الحساسية", href: "/project-feasibility/sensitivity-analysis" },
    ],
  },
  sensitivity: {
    id: "sensitivity",
    icon: LineChart,
    nameFr: "Analyse de Sensibilité",
    nameAr: "تحليل الحساسية",
    whyFr:
      "Vous voulez mesurer l'impact des incertitudes sur votre rentabilité. L'outil fait varier les paramètres clés (prix, coût, volume) et vous montre quels seuils rendent le projet non rentable.",
    whyAr:
      "تريد قياس تأثير حالات عدم اليقين على ربحيتك. الأداة تُغيّر المتغيرات الرئيسية (السعر، التكلفة، الحجم) وتُظهر لك العتبات التي تجعل المشروع غير مربح.",
    href: "/project-feasibility/sensitivity-analysis",
    altsFr: "Pour une analyse de VAN/TRI de base, commencez par l'Évaluation de Rentabilité.",
    altsAr: "لتحليل NPV/IRR أساسي، ابدأ بتقييم الجدوى الاستثمارية.",
    altLinks: [
      { nameFr: "Évaluation de Rentabilité", nameAr: "تقييم الجدوى", href: "/project-feasibility/investment-appraisal" },
    ],
  },
  comparison: {
    id: "comparison",
    icon: GitCompare,
    nameFr: "Comparaison des Alternatives",
    nameAr: "مقارنة البدائل الاستثمارية",
    whyFr:
      "Vous avez plusieurs options d'investissement et vous voulez les comparer objectivement. L'outil affiche VAN, TRI et délai de récupération côte à côte pour chaque alternative.",
    whyAr:
      "لديك عدة خيارات استثمارية وتريد مقارنتها بموضوعية. الأداة تعرض NPV وIRR وفترة الاسترداد جنباً إلى جنب لكل بديل.",
    href: "/project-feasibility/comparison",
    altsFr: "Pour analyser une seule option en profondeur, utilisez l'Évaluation de Rentabilité.",
    altsAr: "لتحليل خيار واحد بعمق، استخدم تقييم الجدوى الاستثمارية.",
    altLinks: [
      { nameFr: "Évaluation de Rentabilité", nameAr: "تقييم الجدوى", href: "/project-feasibility/investment-appraisal" },
    ],
  },
  kpi: {
    id: "kpi",
    icon: Activity,
    nameFr: "Suivi Manuel des KPI",
    nameAr: "تتبع مؤشرات الأداء يدوياً",
    whyFr:
      "Votre activité est en cours et vous souhaitez suivre vos indicateurs clés (CA, charges, bénéfice, unités) période par période, détecter les tendances et comparer aux objectifs.",
    whyAr:
      "نشاطك قيد التشغيل وتريد تتبع مؤشراتك الرئيسية (رقم الأعمال، الأعباء، الربح، الوحدات) فترة بفترة، كشف الاتجاهات والمقارنة بالأهداف.",
    href: "/kpi-dashboard/tracking",
    altsFr: "Si vous envisagez un nouveau projet ou investissement plutôt que de suivre l'existant, le module Faisabilité est plus adapté.",
    altsAr: "إذا كنت تفكر في مشروع جديد أو استثمار بدلاً من متابعة الموجود، فوحدة الجدوى أنسب.",
    altLinks: [
      { nameFr: "Faisabilité & Évaluation", nameAr: "الجدوى والتقييم", href: "/project-feasibility" },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fade-in hook
// ─────────────────────────────────────────────────────────────────────────────
function useFadeIn(trigger: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (trigger && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [trigger]);
  return ref;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function OptionCard({
  option,
  selected,
  onClick,
  isAr,
}: {
  option: Option;
  selected: boolean;
  onClick: () => void;
  isAr: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full text-start rounded-xl border-2 p-4 transition-all duration-200 group",
        selected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/50 hover:bg-muted/50 hover:shadow-sm",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5">{option.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold leading-snug ${selected ? "text-primary" : "text-foreground"}`}>
            {isAr ? option.labelAr : option.labelFr}
          </p>
          {(option.descFr || option.descAr) && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {isAr ? option.descAr : option.descFr}
            </p>
          )}
        </div>
        {selected && (
          <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function SmartRouter() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const [q1, setQ1] = useState<string | null>(null);
  const [q2, setQ2] = useState<string | null>(null);

  const needsQ2 = q1 === "resource" || q1 === "investment";
  const q2Options = q1 === "resource" ? Q2_RESOURCE : Q2_INVESTMENT;

  // Determine recommendation key
  const recommendationKey = needsQ2 ? q2 : q1;
  const showResult = recommendationKey !== null;
  const recommendation = recommendationKey ? RECOMMENDATIONS[recommendationKey] : null;

  // Progress
  const totalSteps = needsQ2 ? 2 : 1;
  const currentStep = q1 === null ? 0 : !needsQ2 || q2 !== null ? totalSteps : 1;

  // Scroll refs
  const q2Ref = useFadeIn(q1 !== null && needsQ2);
  const resultRef = useFadeIn(showResult);

  const reset = () => {
    setQ1(null);
    setQ2(null);
  };

  const RecommendedIcon = recommendation?.icon;
  const ChevronDir = isAr ? ChevronLeft : ChevronRight;

  return (
    <div className={`min-h-[100dvh] bg-muted/20 ${isAr ? "rtl" : "ltr"}`} dir={isAr ? "rtl" : "ltr"}>
      <main className="container mx-auto px-4 py-8 space-y-8 max-w-3xl pb-20">

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            {t("Outil 1 — Routeur Intelligent", "الأداة ١ — الموجّه الذكي")}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {t("Quel outil correspond à votre situation ?", "أي أداة تناسب وضعك؟")}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
            {t(
              "Répondez à quelques questions rapides. En 2 à 3 étapes, nous vous orienterons vers le meilleur outil OptimDZ pour votre problème.",
              "أجب على بعض الأسئلة السريعة. في خطوتين أو ثلاث، سنوجّهك نحو أفضل أداة في OptimDZ لمشكلتك."
            )}
          </p>
        </div>

        {/* ── Progress bar ──────────────────────────────────────────────────── */}
        {q1 !== null && (
          <div className="space-y-1.5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t(
                  `Question ${Math.min(currentStep, totalSteps)} sur ${totalSteps}`,
                  `سؤال ${Math.min(currentStep, totalSteps)} من ${totalSteps}`
                )}
              </span>
              {showResult && (
                <span className="text-primary font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t("Terminé", "مكتمل")}
                </span>
              )}
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-2 bg-primary rounded-full transition-all duration-500"
                style={{ width: `${showResult ? 100 : (currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Q1 ────────────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              1
            </span>
            <h2 className="text-base font-bold text-foreground">
              {t(
                "Quel type de décision cherchez-vous à prendre ?",
                "ما نوع القرار الذي تسعى إلى اتخاذه؟"
              )}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {Q1_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.id}
                option={opt}
                selected={q1 === opt.id}
                isAr={isAr}
                onClick={() => {
                  if (q1 !== opt.id) {
                    setQ1(opt.id);
                    setQ2(null);
                  }
                }}
              />
            ))}
          </div>
        </section>

        {/* ── Q2 (conditional) ──────────────────────────────────────────────── */}
        {q1 !== null && needsQ2 && (
          <section ref={q2Ref} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                2
              </span>
              <h2 className="text-base font-bold text-foreground">
                {q1 === "resource"
                  ? t(
                      "Comment travaillez-vous avec vos ressources ?",
                      "كيف تتعامل مع مواردك؟"
                    )
                  : t(
                      "De quoi avez-vous spécifiquement besoin ?",
                      "ماذا تحتاج تحديداً؟"
                    )}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {q2Options.map((opt) => (
                <OptionCard
                  key={opt.id}
                  option={opt}
                  selected={q2 === opt.id}
                  isAr={isAr}
                  onClick={() => setQ2(opt.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Result ────────────────────────────────────────────────────────── */}
        {showResult && recommendation && (
          <section
            ref={resultRef}
            className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5"
          >
            {/* divider */}
            <div className="flex items-center gap-3 text-muted-foreground text-xs">
              <div className="flex-1 h-px bg-border" />
              <span className="flex items-center gap-1.5 font-semibold">
                <Brain className="w-3.5 h-3.5 text-primary" />
                {t("Notre recommandation", "توصيتنا")}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Primary card */}
            <div className="rounded-2xl border-2 border-primary bg-card shadow-lg overflow-hidden">
              {/* Header bar */}
              <div className="bg-primary px-6 py-4 flex items-center gap-3">
                {RecommendedIcon && (
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <RecommendedIcon className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-primary-foreground/70 font-medium">
                    {t("Outil recommandé", "الأداة الموصى بها")}
                  </p>
                  <h3 className="text-white font-bold text-lg leading-tight">
                    {isAr ? recommendation.nameAr : recommendation.nameFr}
                  </h3>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("Pourquoi cet outil ?", "لماذا هذه الأداة؟")}
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {isAr ? recommendation.whyAr : recommendation.whyFr}
                  </p>
                </div>

                {/* CTA button */}
                <Link href={recommendation.href}>
                  <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg shadow hover:bg-primary/90 transition-colors w-full justify-center md:w-auto">
                    {t("Ouvrir cet outil", "فتح هذه الأداة")}
                    <ChevronDir className="w-4 h-4" />
                  </button>
                </Link>
              </div>
            </div>

            {/* Alternatives */}
            {recommendation.altLinks && recommendation.altLinks.length > 0 && (
              <div className="rounded-xl border bg-muted/30 px-5 py-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("Alternatives à considérer", "بدائل للنظر فيها")}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAr ? recommendation.altsAr : recommendation.altsFr}
                </p>
                <div className="flex flex-wrap gap-2">
                  {recommendation.altLinks.map((alt) => (
                    <Link key={alt.href} href={alt.href}>
                      <button className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border bg-background hover:border-primary hover:text-primary rounded-lg px-3 py-1.5 transition-colors">
                        {isAr ? alt.nameAr : alt.nameFr}
                        <ChevronDir className="w-3 h-3" />
                      </button>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Reset */}
            <div className="flex justify-center pt-2">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {t("Recommencer le questionnaire", "إعادة الاستبيان من البداية")}
              </button>
            </div>
          </section>
        )}

        {/* ── Footer link ───────────────────────────────────────────────────── */}
        <footer className="border-t pt-6 flex items-center justify-between text-sm text-muted-foreground">
          <Link href="/decision-assistant" className="hover:text-primary transition-colors flex items-center gap-1">
            {isAr ? <ChevronLeft className="w-4 h-4 rotate-180" /> : <ChevronLeft className="w-4 h-4" />}
            {t("← Retour à l'Assistant de Décision", "→ العودة إلى مساعد القرار")}
          </Link>
          <Link href="/" className="hover:text-primary transition-colors">
            {t("Portail OptimDZ", "بوابة OptimDZ")}
          </Link>
        </footer>

      </main>
    </div>
  );
}
