import React from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { Button } from "@/components/ui/button";
import { Briefcase, ChevronLeft, ChevronRight, TrendingUp, BarChart2, LineChart, GitCompare } from "lucide-react";

// ── Tool breadcrumb map ───────────────────────────────────────────────────────
const TOOL_LABELS: Record<string, { fr: string; ar: string; icon: React.ElementType }> = {
  "/project-feasibility/breakeven": {
    fr: "Seuil de Rentabilité",
    ar: "نقطة التعادل",
    icon: TrendingUp,
  },
  "/project-feasibility/investment-appraisal": {
    fr: "Évaluation (VAN / TRI)",
    ar: "الجدوى الاستثمارية",
    icon: BarChart2,
  },
  "/project-feasibility/sensitivity-analysis": {
    fr: "Analyse de Sensibilité",
    ar: "تحليل الحساسية",
    icon: LineChart,
  },
  "/project-feasibility/comparison": {
    fr: "Comparaison des Alternatives",
    ar: "مقارنة البدائل",
    icon: GitCompare,
  },
};

export function ProjectFeasibilityNavbar() {
  const { language, setLanguage, t } = useLanguage();
  const [location] = useLocation();
  const isAr = language === "ar";

  const tool = TOOL_LABELS[location];
  const ChevronIcon = isAr ? ChevronRight : ChevronLeft;

  return (
    <header className="border-b bg-background sticky top-0 z-50 shadow-sm" dir={isAr ? "rtl" : "ltr"}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">

        {/* Left cluster: logo → portal → module → tool */}
        <div className="flex items-center gap-1 min-w-0">

          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary shrink-0"
          >
            <div className="bg-primary text-primary-foreground p-1.5 rounded">
              <Briefcase className="w-5 h-5" />
            </div>
            OptimDZ
          </Link>

          {/* Portal back-link */}
          <Link
            href="/"
            className="hidden md:flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors ms-2"
          >
            <ChevronIcon className="w-3 h-3" />
            {t("Portail", "البوابة")}
          </Link>

          {/* Module level: always a link back to /project-feasibility */}
          <span className="hidden md:flex items-center gap-0.5 text-xs text-muted-foreground ms-1">
            <ChevronIcon className="w-3 h-3" />
          </span>
          <Link
            href="/project-feasibility"
            className={[
              "hidden md:inline text-xs font-medium border border-border rounded-md px-2 py-0.5 transition-colors ms-0.5",
              tool
                ? "text-muted-foreground hover:text-primary hover:border-primary"
                : "text-foreground bg-muted/50",
            ].join(" ")}
          >
            {t("Faisabilité de Projet", "جدوى المشروع")}
          </Link>

          {/* Tool level breadcrumb (only on sub-routes) */}
          {tool && (
            <>
              <span className="hidden md:flex items-center gap-0.5 text-xs text-muted-foreground ms-1">
                <ChevronIcon className="w-3 h-3" />
              </span>
              <span className="hidden md:inline text-xs font-semibold text-foreground border border-primary/30 bg-primary/5 text-primary rounded-md px-2 py-0.5 ms-0.5">
                {isAr ? tool.ar : tool.fr}
              </span>
            </>
          )}
        </div>

        {/* Language toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLanguage(language === "fr" ? "ar" : "fr")}
          className="font-bold font-mono shrink-0"
          title={t("Changer la langue", "تغيير اللغة")}
        >
          {language === "fr" ? "AR" : "FR"}
        </Button>
      </div>
    </header>
  );
}

export function ProjectFeasibilityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-muted/20">
      <ProjectFeasibilityNavbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
