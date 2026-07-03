import { useLanguage } from "@/lib/LanguageContext";
import { useGetProblemStats, useListTemplates } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Factory, Wheat, Store, PencilRuler, ArrowRight, BarChart3, Clock, AlertTriangle } from "lucide-react";

const getSectorIcon = (sector: string) => {
  switch (sector.toLowerCase()) {
    case 'industry': return Factory;
    case 'agriculture': return Wheat;
    case 'trade': return Store;
    default: return PencilRuler;
  }
};

export default function Home() {
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = useGetProblemStats();
  const { data: templates, isLoading: templatesLoading } = useListTemplates();

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <section className="bg-primary text-primary-foreground rounded-xl p-8 md:p-12 shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t("Optimisation pour l'Entreprise Algérienne", "تحسين لعمل الشركات الجزائرية")}
          </h1>
          <p className="text-primary-foreground/80 text-lg md:text-xl mb-8 max-w-2xl">
            {t(
              "Prenez des décisions basées sur les données. Maximisez vos profits et minimisez vos coûts grâce à la programmation linéaire.",
              "اتخذ قرارات مبنية على البيانات. قم بزيادة أرباحك وتقليل تكاليفك من خلال البرمجة الخطية."
            )}
          </p>
          <div className="flex flex-wrap gap-4">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/simplex/solve">
                {t("Nouveau Problème", "مسألة جديدة")}
                <ArrowRight className={`w-4 h-4 ${language === 'ar' ? 'mr-2 rotate-180' : 'ml-2'}`} />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20 text-primary-foreground" asChild>
              <Link href="/simplex/history">
                {t("Voir l'historique", "عرض السجل")}
              </Link>
            </Button>
          </div>
        </div>
        <div className="absolute -right-24 -bottom-24 opacity-10 pointer-events-none">
          <BarChart3 className="w-96 h-96" />
        </div>
      </section>

      {/* Sectors / Templates */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">
            {t("Secteurs d'Activité", "قطاعات النشاط")}
          </h2>
        </div>
        
        {templatesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="animate-pulse h-32"></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {templates?.map((template) => {
              const Icon = getSectorIcon(template.sector);
              return (
                <Card 
                  key={template.sector} 
                  className="hover:border-primary/50 transition-colors cursor-pointer group"
                  onClick={() => setLocation(`/simplex/solve?template=${template.sector}`)}
                >
                  <CardHeader className="flex flex-row items-center gap-4 pb-2">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-lg">
                      {language === 'ar' ? template.nameAr : template.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm line-clamp-2">
                      {language === 'ar' ? template.descriptionAr : template.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
            <Card 
              className="hover:border-primary/50 transition-colors cursor-pointer group border-dashed border-2"
              onClick={() => setLocation(`/simplex/solve`)}
            >
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="p-2 bg-muted rounded-lg text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <PencilRuler className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg">
                  {t("Problème Personnalisé", "مسألة مخصصة")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {t("Définissez vos propres variables et contraintes de zéro.", "قم بتحديد المتغيرات والقيود الخاصة بك من الصفر.")}
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* Stats and Recent */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-2xl font-bold text-foreground">
            {t("Problèmes Récents", "المسائل الأخيرة")}
          </h2>
          {statsLoading ? (
            <Card className="h-64 animate-pulse"></Card>
          ) : (
            <Card>
              <div className="divide-y">
                {stats?.recentProblems && stats.recentProblems.length > 0 ? (
                  stats.recentProblems.map((prob) => (
                    <div key={prob.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <Link href={`/simplex/history`} className="font-medium hover:text-primary transition-colors">
                          {prob.name}
                        </Link>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="capitalize">{prob.sector}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(prob.createdAt).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-FR')}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        {prob.status === 'optimal' ? (
                          <div className="font-bold text-secondary">
                            {prob.optimalValue?.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-FR', { maximumFractionDigits: 2 })}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-destructive text-sm font-medium">
                            <AlertTriangle className="w-4 h-4" />
                            {t("Pas de solution", "لا يوجد حل")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    {t("Aucun problème récent.", "لا توجد مسائل حديثة.")}
                  </div>
                )}
              </div>
              {stats?.recentProblems && stats.recentProblems.length > 0 && (
                <div className="p-4 border-t bg-muted/20 text-center">
                  <Link href="/simplex/history" className="text-sm font-medium text-primary hover:underline">
                    {t("Voir tout l'historique", "عرض كل السجل")}
                  </Link>
                </div>
              )}
            </Card>
          )}
        </div>
        
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">
            {t("Aperçu", "نظرة عامة")}
          </h2>
          {statsLoading ? (
            <Card className="h-64 animate-pulse"></Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-4xl font-bold text-primary">
                  {stats?.total || 0}
                </CardTitle>
                <CardDescription>
                  {t("Problèmes résolus au total", "إجمالي المسائل المحلولة")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t("Par statut", "حسب الحالة")}</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-secondary">{t("Optimal", "أمثل")}</span>
                      <span className="font-medium">{stats?.byStatus['optimal'] || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-destructive">{t("Inréalisable", "غير ممكن")}</span>
                      <span className="font-medium">{stats?.byStatus['infeasible'] || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-accent-foreground">{t("Non borné", "غير محدود")}</span>
                      <span className="font-medium">{stats?.byStatus['unbounded'] || 0}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
