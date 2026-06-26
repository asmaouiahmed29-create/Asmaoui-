import React from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { Button } from "@/components/ui/button";
import { Calculator, LayoutDashboard, History, Settings } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();
  const { language, setLanguage, t } = useLanguage();

  const navItems = [
    { href: "/", label: t("Tableau de bord", "لوحة القيادة"), icon: LayoutDashboard },
    { href: "/solve", label: t("Nouveau Problème", "مسألة جديدة"), icon: Calculator },
    { href: "/history", label: t("Historique", "السجل"), icon: History },
  ];

  return (
    <header className="border-b bg-background sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
          <div className="bg-primary text-primary-foreground p-1.5 rounded">
            <Calculator className="w-5 h-5" />
          </div>
          OptimDZ
        </Link>
        
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  isActive ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                } h-16`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
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
      </div>
    </header>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-muted/20">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
