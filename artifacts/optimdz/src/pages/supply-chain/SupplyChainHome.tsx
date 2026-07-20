import { Link } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import {
  ArrowRight, CheckCircle2, Package, TrendingUp, Users2, Truck, BarChart3,
} from "lucide-react";

interface Tool {
  id: string;
  icon: React.ElementType;
  nameAr: string;
  nameFr: string;
  descAr: string;
  descFr: string;
  href?: string;
  active: boolean;
  badge: { fr: string; ar: string };
}

const TOOLS: Tool[] = [
  {
    id: "inventory",
    icon: Package,
    nameAr: "إدارة المخزون",
    nameFr: "Gestion des Stocks",
    descAr: "احسب الكمية الاقتصادية للطلب (EOQ)، نقطة إعادة الطلب، وصنّف مخزونك بطريقة ABC لتقليل التكاليف وتحسين الكفاءة.",
    descFr: "Calculez la quantité économique de commande (EOQ), le point de commande, et classifiez vos stocks en ABC pour réduire les coûts.",
    href: "/supply-chain/inventory",
    active: true,
    badge: { fr: "Disponible", ar: "متاح" },
  },
  {
    id: "forecast",
    icon: TrendingUp,
    nameAr: "التنبؤ بالطلب",
    nameFr: "Prévision de la Demande",
    descAr: "استخدم المتوسط المتحرك أو التمهيد الأسي البسيط للتنبؤ بالطلب المستقبلي وتحسين تخطيط المشتريات.",
    descFr: "Utilisez la Moyenne Mobile ou le Lissage Exponentiel Simple pour prévoir la demande future et optimiser la planification.",
    href: "/supply-chain/forecast",
    active: true,
    badge: { fr: "Disponible", ar: "متاح" },
  },
  {
    id: "suppliers",
    icon: Users2,
    nameAr: "اختيار الموردين",
    nameFr: "Sélection des Fournisseurs",
    descAr: "قيّم الموردين وصنّفهم وفق معايير متعددة: الجودة والسعر والمواعيد والموثوقية.",
    descFr: "Évaluez et classifiez vos fournisseurs selon des critères multicritères : qualité, prix, délais, fiabilité.",
    active: false,
    badge: { fr: "Bientôt", ar: "قريباً" },
  },
  {
    id: "transport",
    icon: Truck,
    nameAr: "النقل والتوزيع",
    nameFr: "Transport & Distribution",
    descAr: "حسّن مسارات النقل وتكاليف التوزيع بين المستودعات والعملاء.",
    descFr: "Optimisez les routes de transport et les coûts de distribution entre entrepôts et clients.",
    active: false,
    badge: { fr: "Bientôt", ar: "قريباً" },
  },
  {
    id: "kpi-sc",
    icon: BarChart3,
    nameAr: "مؤشرات الأداء",
    nameFr: "Indicateurs de Performance",
    descAr: "تتبّع مؤشرات الأداء الرئيسية لسلسلة الإمداد: معدل الدوران، مستوى الخدمة، تكلفة الاحتفاظ.",
    descFr: "Suivez les KPI de la chaîne d'approvisionnement : rotation des stocks, niveau de service, coût de détention.",
    active: false,
    badge: { fr: "Bientôt", ar: "قريباً" },
  },
];

const MODULE_STATS = [
  { valueAr: "٥", valueFr: "5", labelAr: "أدوات مخططة", labelFr: "Outils planifiés" },
  { valueAr: "٢", valueFr: "2", labelAr: "أداة متاحة", labelFr: "Outils disponibles" },
  { valueAr: "EOQ · ABC · MA", valueFr: "EOQ · ABC · MA", labelAr: "نماذج متاحة الآن", labelFr: "Modèles disponibles" },
];

export default function SupplyChainHome() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  return (
    <div className={`min-h-[100dvh] bg-muted/20 ${isAr ? "rtl" : "ltr"}`} dir={isAr ? "rtl" : "ltr"}>
      <main className="container mx-auto px-4 py-8 space-y-12 max-w-6xl">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="bg-primary text-primary-foreground rounded-xl p-8 md:p-12 shadow-lg relative overflow-hidden">
          <div className="relative z-10 max-w-3xl">

            <div className="inline-flex items-center gap-2 bg-primary-foreground/15 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
              {t("Module — Gestion de la Chaîne d'Approvisionnement", "وحدة — إدارة سلاسل الإمداد")}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              {t(
                "Optimisez votre chaîne d'approvisionnement de bout en bout",
                "حسّن سلسلة إمدادك من البداية إلى النهاية"
              )}
            </h1>

            <p className="text-primary-foreground/80 text-lg mb-8 max-w-2xl leading-relaxed">
              {t(
                "Des outils scientifiques pour gérer vos stocks, prévoir la demande, sélectionner vos fournisseurs et optimiser la distribution — adaptés au contexte algérien.",
                "أدوات علمية لإدارة مخزونك، التنبؤ بالطلب، اختيار مورديك وتحسين التوزيع — مُكيَّفة مع البيئة الجزائرية."
              )}
            </p>

            <Link href="/supply-chain/inventory">
              <button className="inline-flex items-center gap-2 bg-white text-primary font-semibold px-6 py-3 rounded-lg shadow hover:bg-white/90 transition-colors">
                {t("Commencer par la Gestion des Stocks", "ابدأ بإدارة المخزون")}
                <ArrowRight className={`w-4 h-4 ${isAr ? "rotate-180" : ""}`} />
              </button>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-6">
            {MODULE_STATS.map((s) => (
              <div key={s.labelFr} className="bg-primary-foreground/10 rounded-xl px-5 py-3 text-center">
                <div className="text-2xl font-bold">{isAr ? s.valueAr : s.valueFr}</div>
                <div className="text-xs text-primary-foreground/70 mt-0.5">{isAr ? s.labelAr : s.labelFr}</div>
              </div>
            ))}
          </div>

          <div className="absolute -right-24 -bottom-24 opacity-10 pointer-events-none">
            <Package className="w-96 h-96" />
          </div>
        </section>

        {/* ── Tools grid ───────────────────────────────────────────────────── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {t("Outils de la Chaîne d'Approvisionnement", "أدوات سلسلة الإمداد")}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {t(
                "Cliquez sur un outil actif pour commencer. Les autres outils sont en cours de développement.",
                "انقر على أداة نشطة للبدء. الأدوات الأخرى قيد التطوير."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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

                  <div className="space-y-1.5">
                    <h3 className={`font-bold text-base ${tool.active ? "text-foreground" : "text-muted-foreground"}`}>
                      {isAr ? tool.nameAr : tool.nameFr}
                    </h3>
                    <p className={`text-sm leading-relaxed ${tool.active ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                      {isAr ? tool.descAr : tool.descFr}
                    </p>
                  </div>

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
              <Package className="w-4 h-4" />
            </div>
            <span className="font-bold text-foreground">OptimDZ</span>
            <span>·</span>
            <span>{t("Gestion de la Chaîne d'Approvisionnement", "إدارة سلاسل الإمداد")}</span>
          </div>
          <Link href="/" className="hover:text-primary transition-colors">
            {t("← Retour au Portail", "→ العودة إلى البوابة")}
          </Link>
        </footer>

      </main>
    </div>
  );
}
