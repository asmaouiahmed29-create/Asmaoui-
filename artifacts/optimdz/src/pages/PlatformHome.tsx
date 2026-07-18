import { useLanguage } from "@/lib/LanguageContext";
import { Link } from "wouter";
import { Calculator, Truck, Users, Network, BarChart3, Briefcase, Brain, ArrowRight, CheckCircle2 } from "lucide-react";

// ── Module definitions ────────────────────────────────────────────────────────
interface Module {
  id: string;
  icon: React.ElementType;
  nameFr: string;
  nameAr: string;
  descFr: string;
  descAr: string;
  href?: string;
  active: boolean;
  badge?: { fr: string; ar: string };
}

const MODULES: Module[] = [
  {
    id: "simplex",
    icon: Calculator,
    nameFr: "Programmation Linéaire — Simplexe",
    nameAr: "البرمجة الخطية — طريقة السمبلكس",
    descFr: "Résolvez des problèmes de maximisation de profit ou minimisation de coûts. Modèles sectoriels pour l'industrie, le commerce, les services et l'agriculture.",
    descAr: "حل مسائل تعظيم الربح أو تقليل التكاليف. نماذج قطاعية للصناعة والتجارة والخدمات والفلاحة.",
    href: "/simplex",
    active: true,
    badge: { fr: "Disponible", ar: "متاح" },
  },
  {
    id: "transport",
    icon: Truck,
    nameFr: "Problème de Transport",
    nameAr: "مسألة النقل",
    descFr: "Optimisez la distribution de ressources entre sources et destinations. Saisie de matrice de coûts, équilibrage automatique.",
    descAr: "حسّن توزيع الموارد بين المصادر والوجهات. إدخال مصفوفة التكاليف والتوازن التلقائي.",
    href: "/transport",
    active: true,
    badge: { fr: "Disponible", ar: "متاح" },
  },
  {
    id: "assignment",
    icon: Users,
    nameFr: "Problème d'Affectation",
    nameAr: "مسألة التوزيع",
    descFr: "Affectez des ressources (employés, machines) à des tâches de manière optimale via la méthode Hongroise.",
    descAr: "توزيع الموارد (موظفون، آلات) على المهام بشكل مثالي باستخدام الطريقة الهنغارية.",
    href: "/assignment",
    active: true,
    badge: { fr: "Disponible", ar: "متاح" },
  },
  {
    id: "pert",
    icon: Network,
    nameFr: "PERT / CPM",
    nameAr: "بيرت / المسار الحرج",
    descFr: "Planifiez et optimisez vos projets complexes. Identifiez le chemin critique et les marges de chaque tâche.",
    descAr: "تخطيط وتحسين المشاريع المعقدة. تحديد المسار الحرج وهوامش كل مهمة.",
    href: "/pert-cpm",
    active: true,
    badge: { fr: "Disponible", ar: "متاح" },
  },
  {
    id: "project-feasibility",
    icon: Briefcase,
    nameFr: "Faisabilité & Évaluation de Projet",
    nameAr: "جدوى وتقييم المشاريع",
    descFr: "Évaluez la viabilité d'un nouveau projet avant de vous engager : seuil de rentabilité projet, marge de sécurité et recommandations Go / No-Go.",
    descAr: "قيّم جدوى مشروع جديد قبل الالتزام: نقطة تعادل المشروع، هامش الأمان، وتوصية Go/No-Go مبنية على البيانات.",
    href: "/project-feasibility",
    active: true,
    badge: { fr: "Disponible", ar: "متاح" },
  },
  {
    id: "kpi",
    icon: BarChart3,
    nameFr: "Tableau de Bord KPI",
    nameAr: "لوحة مؤشرات الأداء",
    descFr: "Suivez et visualisez les indicateurs clés de performance de votre entreprise en temps réel.",
    descAr: "تتبع وعرض مؤشرات الأداء الرئيسية لمؤسستك في الوقت الفعلي.",
    href: "/kpi-dashboard",
    active: true,
    badge: { fr: "Disponible", ar: "متاح" },
  },
  {
    id: "decision-assistant",
    icon: Brain,
    nameFr: "Assistant de Décision Intelligent",
    nameAr: "مساعد القرار الذكي",
    descFr: "Vous ne savez pas quel outil utiliser ? Le Routeur Intelligent vous pose quelques questions et vous oriente vers le bon module en moins d'une minute.",
    descAr: "لا تعرف أي أداة تستخدم؟ يطرح الموجّه الذكي أسئلة موجّهة ويدلّك على الوحدة الصحيحة في أقل من دقيقة.",
    href: "/decision-assistant",
    active: true,
    badge: { fr: "Nouveau", ar: "جديد" },
  },
];

// ── Platform stats (static for now) ─────────────────────────────────────────
const PLATFORM_STATS = [
  { valueFr: "7", valueAr: "٧", labelFr: "Modules planifiés", labelAr: "وحدات مخططة" },
  { valueFr: "4", valueAr: "٤", labelFr: "Secteurs d'activité", labelAr: "قطاعات نشاط" },
  { valueFr: "7", valueAr: "٧", labelFr: "Modules disponibles", labelAr: "سبع وحدات متاحة" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function PlatformHome() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  return (
    <div className={`min-h-[100dvh] bg-muted/20 ${isAr ? "rtl" : "ltr"}`} dir={isAr ? "rtl" : "ltr"}>

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <PlatformNav />

      <main className="container mx-auto px-4 py-8 space-y-12 max-w-6xl">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="bg-primary text-primary-foreground rounded-xl p-8 md:p-12 shadow-lg relative overflow-hidden">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-primary-foreground/15 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
              {t("Plateforme d'aide à la décision — Algérie", "منصة دعم القرار الإداري — الجزائر")}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
              {t(
                "La plateforme intelligente de décision pour l'entreprise algérienne",
                "المنصة الذكية لدعم القرار للمؤسسات الجزائرية"
              )}
            </h1>
            <p className="text-primary-foreground/80 text-lg md:text-xl mb-8 max-w-2xl leading-relaxed">
              {t(
                "OptimDZ regroupe tous les outils d'optimisation dont le manager algérien a besoin — Simplexe, Transport, PERT, et plus encore — dans une interface bilingue adaptée au contexte local.",
                "تجمع OptimDZ جميع أدوات التحسين التي يحتاجها المدير الجزائري — السمبلكس، النقل، بيرت، وأكثر — في واجهة ثنائية اللغة مُكيَّفة مع السياق المحلي."
              )}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/simplex">
                <button className="inline-flex items-center gap-2 bg-white text-primary font-semibold px-6 py-3 rounded-lg shadow hover:bg-white/90 transition-colors">
                  {t("Commencer avec le Simplexe", "ابدأ بالسمبلكس")}
                  <ArrowRight className={`w-4 h-4 ${isAr ? "rotate-180" : ""}`} />
                </button>
              </Link>
            </div>
          </div>

          {/* decorative stats row */}
          <div className="mt-10 flex flex-wrap gap-6">
            {PLATFORM_STATS.map((s) => (
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

        {/* ── Modules ──────────────────────────────────────────────────────── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {t("Modules Disponibles", "الوحدات المتاحة")}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {t(
                "Cliquez sur un module actif pour commencer. Les autres modules sont en cours de développement.",
                "انقر على وحدة نشطة للبدء. الوحدات الأخرى قيد التطوير."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              const cardContent = (
                <div
                  className={[
                    "relative rounded-xl border bg-card p-6 flex flex-col gap-4 transition-all duration-200",
                    mod.active
                      ? "border-primary/40 shadow-sm hover:border-primary hover:shadow-md hover:-translate-y-0.5 cursor-pointer group"
                      : "opacity-60 cursor-not-allowed border-border",
                  ].join(" ")}
                >
                  {/* badge */}
                  {mod.badge && (
                    <span
                      className={[
                        "absolute top-4 right-4 text-[10px] font-bold px-2.5 py-0.5 rounded-full",
                        mod.active
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {isAr ? mod.badge.ar : mod.badge.fr}
                    </span>
                  )}

                  {/* icon */}
                  <div
                    className={[
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                      mod.active
                        ? "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* text */}
                  <div className="space-y-1.5">
                    <h3 className={`font-bold text-base ${mod.active ? "text-foreground" : "text-muted-foreground"}`}>
                      {isAr ? mod.nameAr : mod.nameFr}
                    </h3>
                    <p className={`text-sm leading-relaxed ${mod.active ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                      {isAr ? mod.descAr : mod.descFr}
                    </p>
                  </div>

                  {/* active cta */}
                  {mod.active && (
                    <div className="mt-auto pt-2 flex items-center gap-1.5 text-primary text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      {t("Ouvrir le module", "فتح الوحدة")}
                      <ArrowRight className={`w-3.5 h-3.5 ${isAr ? "rotate-180" : ""}`} />
                    </div>
                  )}
                </div>
              );

              return mod.active && mod.href ? (
                <Link key={mod.id} href={mod.href}>
                  {cardContent}
                </Link>
              ) : (
                <div key={mod.id}>{cardContent}</div>
              );
            })}
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="border-t pt-8 pb-4 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1 rounded">
              <Calculator className="w-4 h-4" />
            </div>
            <span className="font-bold text-foreground">OptimDZ</span>
            <span>·</span>
            <span>{t("Plateforme de décision managériale", "منصة القرار الإداري")}</span>
          </div>
          <span>{t("Algérie © 2026", "الجزائر © 2026")}</span>
        </footer>

      </main>
    </div>
  );
}

// ── Platform Navbar ───────────────────────────────────────────────────────────
function PlatformNav() {
  const { t, language, setLanguage } = useLanguage();
  const isAr = language === "ar";

  return (
    <header
      className="border-b bg-background sticky top-0 z-50 shadow-sm"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
          <div className="bg-primary text-primary-foreground p-1.5 rounded">
            <Calculator className="w-5 h-5" />
          </div>
          OptimDZ
          <span className="hidden md:inline text-xs font-normal text-muted-foreground border border-border rounded-md px-2 py-0.5 ml-2">
            {t("Plateforme", "المنصة")}
          </span>
        </Link>

        {/* Right: simplex link + lang toggle */}
        <div className="flex items-center gap-3">
          <Link
            href="/simplex"
            className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <Calculator className="w-4 h-4" />
            {t("Module Simplexe", "وحدة السمبلكس")}
          </Link>
          <button
            onClick={() => setLanguage(isAr ? "fr" : "ar")}
            className="text-sm font-bold font-mono border border-border rounded px-2.5 py-1 hover:bg-muted transition-colors"
            title={t("Changer la langue", "تغيير اللغة")}
          >
            {isAr ? "FR" : "AR"}
          </button>
        </div>
      </div>
    </header>
  );
}
