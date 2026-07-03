import { useLanguage } from "@/lib/LanguageContext";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, ArrowRight, Info, CheckCircle2, BarChart3 } from "lucide-react";

export default function TransportHome() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const features = [
    {
      fr: "Matrice de coûts dynamique",
      ar: "مصفوفة تكاليف ديناميكية",
      descFr: "Ajoutez autant de sources et destinations que nécessaire.",
      descAr: "أضف أي عدد من المصادر والوجهات حسب الحاجة.",
    },
    {
      fr: "Équilibrage automatique",
      ar: "التوازن التلقائي",
      descFr: "Détection automatique des problèmes déséquilibrés avec ajout d'une ligne/colonne fictive.",
      descAr: "اكتشاف تلقائي للمسائل غير المتوازنة مع إضافة صف/عمود وهمي.",
    },
    {
      fr: "Méthodes de résolution (bientôt)",
      ar: "طرق الحل (قريباً)",
      descFr: "Vogel, Nord-Ouest, MODI — pour trouver la solution optimale.",
      descAr: "فوغل، الزاوية الشمالية الغربية، MODI — للعثور على الحل الأمثل.",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-5xl">

      {/* Hero */}
      <section className="bg-primary text-primary-foreground rounded-xl p-8 md:p-12 shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-primary-foreground/15 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Truck className="w-4 h-4" />
            {t("Module Transport", "وحدة النقل")}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            {t("Problème de Transport", "مسألة النقل")}
          </h1>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl leading-relaxed">
            {t(
              "Optimisez la distribution de vos ressources entre sources et destinations en minimisant les coûts ou en maximisant les profits.",
              "حسّن توزيع مواردك بين المصادر والوجهات بتقليل التكاليف أو تعظيم الأرباح."
            )}
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/transport/solve">
              {t("Nouveau Problème", "مسألة جديدة")}
              <ArrowRight className={`w-4 h-4 ${isAr ? "mr-2 rotate-180" : "ml-2"}`} />
            </Link>
          </Button>
        </div>
        <div className="absolute -right-24 -bottom-24 opacity-10 pointer-events-none">
          <BarChart3 className="w-96 h-96" />
        </div>
      </section>

      {/* Features */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">
          {t("Fonctionnalités du module", "ميزات الوحدة")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <Card key={i} className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  {isAr ? f.ar : f.fr}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isAr ? f.descAr : f.descFr}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-primary/20 bg-primary/5 text-sm text-muted-foreground">
        <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p>
          {t(
            "Stage 1 : Saisie des données. La résolution (Vogel, Nord-Ouest, MODI) sera disponible dans la prochaine version.",
            "المرحلة 1: إدخال البيانات. سيتوفر الحل (فوغل، الزاوية الشمالية الغربية، MODI) في الإصدار القادم."
          )}
        </p>
      </div>

    </div>
  );
}
