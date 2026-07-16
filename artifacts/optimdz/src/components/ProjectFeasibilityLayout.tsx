import React from "react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { Button } from "@/components/ui/button";
import { Briefcase, ChevronLeft } from "lucide-react";

export function ProjectFeasibilityNavbar() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="border-b bg-background sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">
        <div className="flex items-center gap-4">
          <Link
            href="/project-feasibility"
            className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary"
          >
            <div className="bg-primary text-primary-foreground p-1.5 rounded">
              <Briefcase className="w-5 h-5" />
            </div>
            OptimDZ
          </Link>
          <Link
            href="/"
            className="hidden md:flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
            {t("Portail", "البوابة")}
          </Link>
          <span className="hidden md:inline text-xs font-medium text-muted-foreground border border-border rounded-md px-2 py-0.5">
            {t("Faisabilité de Projet", "جدوى المشروع")}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLanguage(language === "fr" ? "ar" : "fr")}
          className="font-bold font-mono"
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
