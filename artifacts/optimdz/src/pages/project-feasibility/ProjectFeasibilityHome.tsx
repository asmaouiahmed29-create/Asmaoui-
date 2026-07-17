import { Link } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import {
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  BarChart2,
  GitCompare,
  LineChart,
  Briefcase,
} from "lucide-react";

// ── Tool definitions ──────────────────────────────────────────────────────────
interface Tool {
  id: string;
  icon: React.ElementType;
  nameFr: string;
  nameAr: string;
  descFr: string;
  descAr: string;
  href?: string;
  active: boolean;
  badge: { fr: string; ar: string };
}

const TOOLS: Tool[] = [
  {
    id: "breakeven",
    icon: TrendingUp,
    nameFr: "Analyse du Seuil de Rentabilité",
    nameAr: "تحليل نقطة التعادل",
    descFr:
      "Calculez le seuil de rentabilité de votre projet, la marge de sécurité et le levier opérationnel. Obtenez une recommandation Go / No-Go avant de vous engager.",
    descAr:
      "احسب نقطة تعادل مشروعك وهامش الأمان والرافعة التشغيلية. احصل على توصية Go/No-Go قبل الالتزام بالتكاليف الثابتة.",
    href: "/project-feasibility/breakeven",
    active: true,
    badge: { fr: "Disponible", ar: "متاح" },
  },
  {
    id: "npv-irr",
    icon: BarChart2,
    nameFr: "Évaluation de la Rentabilité (VAN / TRI)",
    nameAr: "تقييم الجدوى الاستثمارية (NPV / IRR)",
    descFr:
      "Calculez la VAN, le TRI, les délais de récupération et l'Indice de Rentabilité pour évaluer un investissement avant de vous engager.",
    descAr:
      "احسب NPV وIRR وفترتَي الاسترداد ومؤشر الربحية لتقييم استثمار جديد قبل الالتزام به.",
    href: "/project-feasibility/investment-appraisal",
    active: true,
    badge: { fr: "Disponible", ar: "متاح" },
  },
  {
    id: "sensitivity",
    icon: LineChart,
    nameFr: "Analyse de Sensibilité",
    nameAr: "تحليل الحساسية",
    descFr:
      "Évaluez l'impact des variations de prix, de coûts et de volumes sur la rentabilité du projet. Identifiez les paramètres critiques.",
    descAr:
      "قيّم تأثير تغيرات السعر والتكاليف والأحجام على ربحية المشروع. حدد المتغيرات الحرجة.",
    active: false,
    badge: { fr: "Bientôt", ar: "قريباً" },
  },
  {
    id: "alternatives",
    icon: GitCompare,
    nameFr: "Comparaison des Alternatives",
    nameAr: "مقارنة البدائل الاستثمارية",
    descFr:
      "Comparez plusieurs scénarios ou alternatives d'investissement côte à côte pour choisir la meilleure option.",
    descAr:
      "قارن عدة سيناريوهات أو بدائل استثمارية جنباً إلى جنب لاختيار الخيار الأمثل.",
    active: false,
    badge: { fr: "Bientôt", ar: "قريباً" },
  },
];

// ── Module stats ──────────────────────────────────────────────────────────────
const MODULE_STATS = [
  { valueFr: "4", valueAr: "٤", labelFr: "Outils planifiés", labelAr: "أدوات مخططة" },
  { valueFr: "2", valueAr: "٢", labelFr: "Outils disponibles", labelAr: "أداتان متاحتان" },
  { valueFr: "Go/No-Go", valueAr: "Go/No-Go", labelFr: "Décision basée sur les données", labelAr: "قرار مبني على البيانات" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProjectFeasibilityHome() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  return (
    <div className={`min-h-[100dvh] bg-muted/20 ${isAr ? "rtl" : "ltr"}`} dir={isAr ? "rtl" : "ltr"}>
      <main className="container mx-auto px-4 py-8 space-y-12 max-w-6xl">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="bg-primary text-primary-foreground rounded-xl p-8 md:p-12 shadow-lg relative overflow-hidden">
          <div className="relative z-10 max-w-3xl">

            {/* eyebrow pill */}
            <div className="inline-flex items-center gap-2 bg-primary-foreground/15 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
              {t(
                "Module — Faisabilité & Évaluation de Projet",
                "وحدة — جدوى وتقييم المشاريع"
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              {t(
                "Évaluez la viabilité de votre projet avant de vous engager",
                "قيّم جدوى مشروعك قبل الالتزام بالتكاليف الثابتة"
              )}
            </h1>

            <p className="text-primary-foreground/80 text-lg mb-8 max-w-2xl leading-relaxed">
              {t(
                "Une suite d'outils dédiés aux nouvelles entreprises et investissements — du seuil de rentabilité à l'analyse VAN/TRI — pour prendre des décisions éclairées avant de démarrer.",
                "مجموعة أدوات مخصصة للمشاريع الجديدة والاستثمارات — من نقطة التعادل إلى تحليل NPV/IRR — لاتخاذ قرارات مدروسة قبل الانطلاق."
              )}
            </p>

            {/* CTA → first active tool */}
            <Link href="/project-feasibility/breakeven">
              <button className="inline-flex items-center gap-2 bg-white text-primary font-semibold px-6 py-3 rounded-lg shadow hover:bg-white/90 transition-colors">
                {t("Commencer par le Seuil de Rentabilité", "ابدأ بتحليل نقطة التعادل")}
                <ArrowRight className={`w-4 h-4 ${isAr ? "rotate-180" : ""}`} />
              </button>
            </Link>
          </div>

          {/* stats row */}
          <div className="mt-10 flex flex-wrap gap-6">
            {MODULE_STATS.map((s) => (
              <div key={s.labelFr} className="bg-primary-foreground/10 rounded-xl px-5 py-3 text-center">
                <div className="text-2xl font-bold">{isAr ? s.valueAr : s.valueFr}</div>
                <div className="text-xs text-primary-foreground/70 mt-0.5">{isAr ? s.labelAr : s.labelFr}</div>
              </div>
            ))}
          </div>

          {/* background decoration */}
          <div className="absolute -right-24 -bottom-24 opacity-10 pointer-events-none">
            <Briefcase className="w-96 h-96" />
          </div>
        </section>

        {/* ── Tools grid ───────────────────────────────────────────────────── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {t("Outils d'Analyse", "أدوات التحليل")}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {t(
                "Cliquez sur un outil actif pour commencer. Les autres outils sont en cours de développement.",
                "انقر على أداة نشطة للبدء. الأدوات الأخرى قيد التطوير."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const cardContent = (
                <div
                  className={[
                    "relative rounded-xl border bg-card p-6 flex flex-col gap-4 transition-all duration-200",
                    tool.active
                      ? "border-primary/40 shadow-sm hover:border-primary hover:shadow-md hover:-translate-y-0.5 cursor-pointer group"
                      : "opacity-60 cursor-not-allowed border-border",
                  ].join(" ")}
                >
                  {/* badge */}
                  {tool.badge && (
                    <span
                      className={[
                        "absolute top-4 text-[10px] font-bold px-2.5 py-0.5 rounded-full",
                        isAr ? "left-4" : "right-4",
                        tool.active
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {isAr ? tool.badge.ar : tool.badge.fr}
                    </span>
                  )}

                  {/* icon */}
                  <div
                    className={[
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                      tool.active
                        ? "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* text */}
                  <div className="space-y-1.5">
                    <h3 className={`font-bold text-base ${tool.active ? "text-foreground" : "text-muted-foreground"}`}>
                      {isAr ? tool.nameAr : tool.nameFr}
                    </h3>
                    <p className={`text-sm leading-relaxed ${tool.active ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                      {isAr ? tool.descAr : tool.descFr}
                    </p>
                  </div>

                  {/* CTA */}
                  {tool.active && (
                    <div className="mt-auto pt-2 flex items-center gap-1.5 text-primary text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      {t("Ouvrir l'outil", "فتح الأداة")}
                      <ArrowRight className={`w-3.5 h-3.5 ${isAr ? "rotate-180" : ""}`} />
                    </div>
                  )}
                </div>
              );

              return tool.active && tool.href ? (
                <Link key={tool.id} href={tool.href}>
                  {cardContent}
                </Link>
              ) : (
                <div key={tool.id}>{cardContent}</div>
              );
            })}
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="border-t pt-8 pb-4 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1 rounded">
              <Briefcase className="w-4 h-4" />
            </div>
            <span className="font-bold text-foreground">OptimDZ</span>
            <span>·</span>
            <span>{t("Faisabilité & Évaluation de Projet", "جدوى وتقييم المشاريع")}</span>
          </div>
          <Link href="/" className="hover:text-primary transition-colors">
            {t("← Retour au Portail", "→ العودة إلى البوابة")}
          </Link>
        </footer>

      </main>
    </div>
  );
}
