import { Link } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { ArrowRight, CheckCircle2, Route, Lightbulb, Brain } from "lucide-react";
import type React from "react";

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
    id: "router",
    icon: Route,
    nameFr: "Routeur Intelligent",
    nameAr: "الموجّه الذكي",
    descFr:
      "Décrivez votre problème en quelques clics et obtenez une recommandation précise vers le meilleur outil de la plateforme. Un questionnaire guidé de 2 à 3 étapes pour orienter votre décision sans erreur.",
    descAr:
      "صِف مشكلتك بنقرات قليلة واحصل على توصية دقيقة نحو أفضل أداة في المنصة. استبيان موجّه من خطوتين إلى ثلاث لتوجيه قرارك دون أخطاء.",
    href: "/decision-assistant/router",
    active: true,
    badge: { fr: "Disponible", ar: "متاح" },
  },
  {
    id: "advisor",
    icon: Lightbulb,
    nameFr: "Conseiller d'Affaires Complet",
    nameAr: "المستشار الشامل للأعمال",
    descFr:
      "Synthèse globale et honnête sur la santé de votre activité et de vos projets : l'outil lit vos données sauvegardées (KPI, Faisabilité) et produit un jugement croisé avec des preuves explicites.",
    descAr:
      "توليف شامل وصادق لصحة نشاطك ومشاريعك: تقرأ الأداة بياناتك المحفوظة (المؤشرات، الجدوى) وتُصدر حكماً متقاطعاً بأدلة صريحة.",
    href: "/decision-assistant/advisor",
    active: true,
    badge: { fr: "Disponible", ar: "متاح" },
  },
];

// ── Module stats ──────────────────────────────────────────────────────────────
const MODULE_STATS = [
  { valueFr: "2",  valueAr: "٢",  labelFr: "Outils disponibles", labelAr: "أدوات متاحة" },
  { valueFr: "0",  valueAr: "٠",  labelFr: "En développement",   labelAr: "قيد التطوير" },
  { valueFr: "9",  valueAr: "٩",  labelFr: "Outils référencés",  labelAr: "أدوات مرجعية" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function DecisionAssistantHome() {
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
                "Module — Assistant de Décision Intelligent",
                "وحدة — مساعد القرار الذكي"
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              {t(
                "Trouvez le bon outil pour votre problème en quelques secondes",
                "اعثر على الأداة المناسبة لمشكلتك في ثوانٍ"
              )}
            </h1>

            <p className="text-primary-foreground/80 text-lg mb-8 max-w-2xl leading-relaxed">
              {t(
                "Vous ne savez pas quel module utiliser ? Le Routeur Intelligent pose quelques questions ciblées et vous oriente vers le meilleur outil — Simplexe, Transport, PERT, Faisabilité ou KPI — selon votre situation réelle.",
                "لا تعرف أي وحدة تستخدم؟ يطرح الموجّه الذكي بعض الأسئلة الموجّهة ويدلّك على أفضل أداة — السمبلكس، النقل، بيرت، الجدوى أو المؤشرات — بحسب وضعك الحقيقي."
              )}
            </p>

            {/* CTA */}
            <Link href="/decision-assistant/router">
              <button className="inline-flex items-center gap-2 bg-white text-primary font-semibold px-6 py-3 rounded-lg shadow hover:bg-white/90 transition-colors">
                {t("Lancer le Routeur Intelligent", "ابدأ مع الموجّه الذكي")}
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
            <Brain className="w-96 h-96" />
          </div>
        </section>

        {/* ── Tools grid ───────────────────────────────────────────────────── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {t("Outils d'Aide à la Décision", "أدوات دعم القرار")}
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

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">
            {t("Comment ça marche ?", "كيف يعمل؟")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                step: "01",
                icon: "💬",
                titleFr: "Décrivez votre situation",
                titleAr: "صِف وضعك",
                descFr: "Répondez à 2–3 questions simples sur votre problème de gestion ou de décision.",
                descAr: "أجب على سؤالين أو ثلاثة بسيطة حول مشكلتك في الإدارة أو القرار.",
              },
              {
                step: "02",
                icon: "🧠",
                titleFr: "Le routeur analyse",
                titleAr: "يحلّل الموجّه",
                descFr: "L'arbre de décision identifie la catégorie de problème et le meilleur outil adapté.",
                descAr: "يحدّد شجرة القرار فئة المشكلة والأداة الأنسب لها.",
              },
              {
                step: "03",
                icon: "🚀",
                titleFr: "Accédez directement à l'outil",
                titleAr: "انتقل مباشرة للأداة",
                descFr: "Un bouton direct vous emmène vers le bon outil avec une explication de pourquoi il vous convient.",
                descAr: "زر مباشر يأخذك إلى الأداة الصحيحة مع شرح لماذا تناسبك.",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border bg-card p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-7 h-7 flex items-center justify-center shrink-0">
                    {item.step}
                  </span>
                  <span className="text-xl">{item.icon}</span>
                </div>
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
              <Brain className="w-4 h-4" />
            </div>
            <span className="font-bold text-foreground">OptimDZ</span>
            <span>·</span>
            <span>{t("Assistant de Décision Intelligent", "مساعد القرار الذكي")}</span>
          </div>
          <Link href="/" className="hover:text-primary transition-colors">
            {t("← Retour au Portail", "→ العودة إلى البوابة")}
          </Link>
        </footer>

      </main>
    </div>
  );
}
