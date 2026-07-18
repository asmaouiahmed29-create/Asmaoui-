import { Link } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import {
  ArrowRight, CheckCircle2, Activity, Database, BarChart3,
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
    id: "tracking",
    icon: Activity,
    nameFr: "Suivi Manuel des KPI",
    nameAr: "تتبع مؤشرات الأداء يدوياً",
    descFr:
      "Saisissez vos métriques périodiques (mensuelles ou trimestrielles) : chiffre d'affaires, charges, bénéfice, unités vendues. Visualisez les tendances, comparez aux objectifs et obtenez une analyse de situation automatique.",
    descAr:
      "أدخل مؤشراتك الدورية (شهرية أو ربع سنوية): رقم الأعمال، التكاليف، الربح، الوحدات المباعة. تصور الاتجاهات، قارن بالأهداف، واحصل على تحليل تلقائي للوضع.",
    href: "/kpi-dashboard/tracking",
    active: true,
    badge: { fr: "Disponible", ar: "متاح" },
  },
  {
    id: "connectors",
    icon: Database,
    nameFr: "Connecteurs de Données",
    nameAr: "موصلات البيانات",
    descFr:
      "Importez automatiquement vos données depuis des fichiers Excel/CSV ou des sources externes pour un tableau de bord en temps réel sans saisie manuelle.",
    descAr:
      "استورد بياناتك تلقائياً من ملفات Excel/CSV أو مصادر خارجية للحصول على لوحة تحكم في الوقت الفعلي دون إدخال يدوي.",
    active: false,
    badge: { fr: "Bientôt", ar: "قريباً" },
  },
];

// ── Module stats ──────────────────────────────────────────────────────────────
const MODULE_STATS = [
  { valueFr: "2",  valueAr: "٢",  labelFr: "Outils planifiés", labelAr: "أدوات مخططة" },
  { valueFr: "1",  valueAr: "١",  labelFr: "Outil disponible", labelAr: "أداة متاحة" },
  { valueFr: "∞",  valueAr: "∞",  labelFr: "Périodes analysables", labelAr: "فترات قابلة للتحليل" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function KpiDashboardHome() {
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
                "Module — Tableau de Bord & Suivi de Performance",
                "وحدة — لوحة التحكم ومتابعة الأداء"
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              {t(
                "Pilotez votre entreprise avec les bons indicateurs",
                "قُد مؤسستك بالمؤشرات الصحيحة"
              )}
            </h1>

            <p className="text-primary-foreground/80 text-lg mb-8 max-w-2xl leading-relaxed">
              {t(
                "Suivez l'évolution de vos KPI période par période, détectez les tendances préoccupantes avant qu'elles ne deviennent des crises, et prenez des décisions basées sur des données réelles.",
                "تابع تطور مؤشرات أدائك فترة بفترة، اكشف الاتجاهات المثيرة للقلق قبل أن تتحول إلى أزمات، واتخذ قرارات مبنية على بيانات حقيقية."
              )}
            </p>

            {/* CTA → first active tool */}
            <Link href="/kpi-dashboard/tracking">
              <button className="inline-flex items-center gap-2 bg-white text-primary font-semibold px-6 py-3 rounded-lg shadow hover:bg-white/90 transition-colors">
                {t("Commencer le suivi des KPI", "ابدأ تتبع مؤشرات الأداء")}
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
            <BarChart3 className="w-96 h-96" />
          </div>
        </section>

        {/* ── Tools grid ───────────────────────────────────────────────────── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {t("Outils d'Analyse KPI", "أدوات تحليل المؤشرات")}
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

        {/* ── What you get section ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">
            {t("Ce que l'outil vous apporte", "ما تحصل عليه من الأداة")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              {
                icon: "📈",
                titleFr: "Tendances visuelles",
                titleAr: "اتجاهات بصرية",
                descFr: "Graphiques de chiffre d'affaires, charges et bénéfice sur toutes les périodes saisies.",
                descAr: "مخططات رقم الأعمال والأعباء والربح على جميع الفترات المُدخلة.",
              },
              {
                icon: "🎯",
                titleFr: "Suivi des objectifs",
                titleAr: "متابعة الأهداف",
                descFr: "Définissez des objectifs de CA et bénéfice, visualisez l'écart réel vs cible.",
                descAr: "حدد أهدافاً لرقم الأعمال والربح، وتصور الفارق بين الفعلي والمستهدف.",
              },
              {
                icon: "⚠️",
                titleFr: "Alertes automatiques",
                titleAr: "تنبيهات تلقائية",
                descFr: "Détection des marges en déclin, coûts croissants et sous-performance vs objectifs.",
                descAr: "كشف الهوامش المتراجعة والتكاليف المتصاعدة والأداء دون المستهدف.",
              },
              {
                icon: "📊",
                titleFr: "Taux de croissance",
                titleAr: "معدلات النمو",
                descFr: "Tableau des variations période-sur-période pour CA, bénéfice et unités vendues.",
                descAr: "جدول التغيرات من فترة لأخرى لرقم الأعمال والربح والوحدات المباعة.",
              },
              {
                icon: "🧠",
                titleFr: "Analyse automatique",
                titleAr: "تحليل تلقائي",
                descFr: "Résumé textuel de la situation : amélioration, déclin, stabilité et causes probables.",
                descAr: "ملخص نصي للوضع: تحسن أو تراجع أو استقرار والأسباب المحتملة.",
              },
              {
                icon: "📄",
                titleFr: "Rapport PDF exportable",
                titleAr: "تقرير PDF قابل للتصدير",
                descFr: "Générez un rapport de direction complet avec graphiques et recommandations en un clic.",
                descAr: "أنشئ تقريراً إدارياً كاملاً مع مخططات وتوصيات بنقرة واحدة.",
              },
            ].map((item) => (
              <div key={item.titleFr} className="rounded-xl border bg-card p-5 space-y-2">
                <div className="text-2xl">{item.icon}</div>
                <h3 className="font-semibold text-sm text-foreground">
                  {isAr ? item.titleAr : item.titleFr}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAr ? item.descAr : item.descFr}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="border-t pt-8 pb-4 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1 rounded">
              <BarChart3 className="w-4 h-4" />
            </div>
            <span className="font-bold text-foreground">OptimDZ</span>
            <span>·</span>
            <span>{t("Tableau de Bord KPI", "لوحة مؤشرات الأداء")}</span>
          </div>
          <Link href="/" className="hover:text-primary transition-colors">
            {t("← Retour au Portail", "→ العودة إلى البوابة")}
          </Link>
        </footer>

      </main>
    </div>
  );
}
