import React from "react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { Button } from "@/components/ui/button";
import { Users, ChevronLeft } from "lucide-react";

export function AssignmentNavbar() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="border-b bg-background sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">

        <div className="flex items-center gap-4">
          <Link href="/assignment" className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
            <div className="bg-primary text-primary-foreground p-1.5 rounded">
              <Users className="w-5 h-5" />
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
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/assignment"
            className="relative flex items-center gap-2 text-sm font-medium transition-colors h-16 text-primary border-b-2 border-primary"
          >
            <Users className="w-4 h-4" />
            {t("Problème d'Affectation", "مسألة التوزيع")}
          </Link>
        </nav>

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

export function AssignmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-muted/20">
      <AssignmentNavbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
