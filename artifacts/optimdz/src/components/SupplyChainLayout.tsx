import React from "react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { Button } from "@/components/ui/button";
import { Package, ChevronLeft } from "lucide-react";

export function SupplyChainNavbar() {
  const { language, setLanguage, t } = useLanguage();
  const isAr = language === "ar";

  return (
    <header
      className="border-b bg-background sticky top-0 z-50 shadow-sm"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-5xl">
        {/* Brand + portal breadcrumb */}
        <div className="flex items-center gap-4">
          <Link
            href="/supply-chain"
            className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary"
          >
            <div className="bg-primary text-primary-foreground p-1.5 rounded">
              <Package className="w-5 h-5" />
            </div>
            OptimDZ
          </Link>
          <Link
            href="/"
            className="hidden md:flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className={`w-3 h-3 ${isAr ? "rotate-180" : ""}`} />
            {t("Portail", "البوابة")}
          </Link>
          <span className="hidden md:inline text-xs font-medium text-muted-foreground border border-border rounded-md px-2 py-0.5">
            {t("Gestion de la Chaîne d'Approvisionnement", "إدارة سلاسل الإمداد")}
          </span>
        </div>

        {/* Language toggle */}
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

export function SupplyChainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-muted/20">
      <SupplyChainNavbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
