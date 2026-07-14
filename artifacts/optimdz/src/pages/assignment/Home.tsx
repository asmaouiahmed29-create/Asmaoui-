import { useLanguage } from "@/lib/LanguageContext";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ArrowRight, Info, CheckCircle2, BarChart3, Zap } from "lucide-react";

export default function AssignmentHome() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const features = [
    {
      fr: "Matrice d'affectation dynamique",
      ar: "مصفوفة توزيع ديناميكية",
      descFr: "Ajoutez autant de ressources et de tâches que nécessaire. Matrice redimensionnable à la volée.",
      descAr: "أضف أي عدد من الموارد والمهام حسب الحاجة. مصفوفة قابلة لتغيير الحجم بسهولة.",
      icon: <BarChart3 className="w-5 h-5 text-primary shrink-0" />,
    },
    {
      fr: "Équilibrage automatique",
      ar: "التوازن التلقائي",
      descFr: "Détection automatique si le nombre de ressources ≠ tâches, avec ajout d'une ligne ou colonne fictive à coût zéro.",
      descAr: "اكتشاف تلقائي إذا كان عدد الموارد ≠ المهام، مع إضافة صف أو عمود وهمي بتكلفة صفر.",
      icon: <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />,
    },
    {
      fr: "Affectations interdites",
      ar: "التوزيعات المحظورة",
      descFr: "Marquez les cellules interdites (une ressource ne peut pas être assignée à une tâche donnée) d'un simple clic.",
      descAr: "ضع علامة على الخلايا المحظورة (مورد لا يمكن تخصيصه لمهمة معينة) بنقرة واحدة.",
      icon: <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />,
    },
    {
      fr: "Minimisation & Maximisation",
      ar: "التقليل والتعظيم",
      descFr: "Résolvez des problèmes de minimisation des coûts/durées ou de maximisation de performance/profit.",
      descAr: "حل مسائل تقليل التكاليف/الأوقات أو تعظيم الأداء/الربح.",
      icon: <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />,
    },
    {
      fr: "Méthode Hongroise",
      ar: "الطريقة الهنغارية",
      descFr: "Résolution optimale garantie — algorithme exact de complexité O(n³). Résultats pas-à-pas, avec analyse et export PDF.",
      descAr: "حل أمثل مضمون — خوارزمية دقيقة بتعقيد O(n³). نتائج خطوة بخطوة، مع تحليل وتصدير PDF.",
      icon: <Zap className="w-5 h-5 text-primary shrink-0" />,
    },
  ];

  const steps = [
    { n: 1, fr: "Choisir le secteur", ar: "اختيار القطاع", active: true },
    { n: 2, fr: "Saisir les données", ar: "إدخال البيانات",  active: true },
    { n: 3, fr: "Solution optimale",  ar: "الحل الأمثل",     active: true },
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-5xl">

      {/* Hero */}
      <section className="bg-primary text-primary-foreground rounded-xl p-8 md:p-12 shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-primary-foreground/15 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Users className="w-4 h-4" />
            {t("Module Affectation", "وحدة التوزيع")}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            {t("Problème d'Affectation", "مسألة التوزيع")}
          </h1>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl leading-relaxed">
            {t(
              "Affectez vos ressources — employés, machines, équipes — aux tâches de manière optimale en minimisant les coûts ou en maximisant les performances.",
              "خصِّص مواردك — موظفين، آلات، فرق — للمهام بشكل مثالي من خلال تقليل التكاليف أو تعظيم الأداء."
            )}
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/assignment/solve">
              {t("Nouveau Problème", "مسألة جديدة")}
              <ArrowRight className={`w-4 h-4 ${isAr ? "mr-2 rotate-180" : "ml-2"}`} />
            </Link>
          </Button>
        </div>
        <div className="absolute -right-24 -bottom-24 opacity-10 pointer-events-none">
          <Users className="w-96 h-96" />
        </div>
      </section>

      {/* Workflow steps */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">
          {t("Étapes de résolution", "مراحل الحل")}
        </h2>
        <div className="flex flex-col sm:flex-row gap-0">
          {steps.map((s, idx) => (
            <div key={s.n} className="flex items-center flex-1 min-w-0">
              <div className={`flex-1 flex items-center gap-3 rounded-lg p-4 border ${
                s.active ? "bg-primary/5 border-primary/20" : "bg-muted/40 border-dashed opacity-60"
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  s.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {s.n}
                </div>
                <span className={`text-sm font-medium ${s.active ? "text-foreground" : "text-muted-foreground"}`}>
                  {isAr ? s.ar : s.fr}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground mx-2 shrink-0 hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">
          {t("Fonctionnalités du module", "ميزات الوحدة")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <Card key={i} className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {f.icon}
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
            "Module complet disponible : saisie des données, puis résolution pas-à-pas par la méthode Hongroise avec analyse et export PDF.",
            "الوحدة متاحة بالكامل: إدخال البيانات، ثم الحل خطوة بخطوة بالطريقة الهنغارية مع تحليل وتصدير PDF."
          )}
        </p>
      </div>

    </div>
  );
}
