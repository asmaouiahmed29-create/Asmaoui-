import { useLocation } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { useProblemState } from "@/lib/ProblemContext";
import { useSaveProblem } from "@workspace/api-client-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, AlertTriangle, Info, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ManagerialRecommendations } from "@/components/ManagerialRecommendations";
import { OptimAssistant } from "@/components/OptimAssistant";

export default function Results() {
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { input, result } = useProblemState();

  const saveMutation = useSaveProblem({
    mutation: {
      onSuccess: () => {
        toast({
          title: t("Succès", "نجاح"),
          description: t("Problème sauvegardé dans l'historique.", "تم حفظ المسألة في السجل."),
        });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: t("Erreur", "خطأ"),
          description: t("Erreur lors de la sauvegarde.", "خطأ أثناء الحفظ."),
        });
      }
    }
  });

  if (!input || !result) {
    setLocation("/solve");
    return null;
  }

  const handleSave = () => {
    saveMutation.mutate({
      data: {
        name: input.name || "Untitled",
        sector: input.sector || "custom",
        problemData: input,
        result: result as any
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "optimal": return "text-secondary";
      case "infeasible": return "text-destructive";
      case "unbounded": return "text-accent-foreground";
      default: return "text-primary";
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "error": return <AlertTriangle className="h-4 w-4" />;
      case "warning": return <AlertTriangle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/solve")} className="-ml-3 mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("Retour à l'édition", "العودة إلى التعديل")}
          </Button>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            {t("Résultats de l'Optimisation", "نتائج التحسين")}
            <Badge variant="outline" className={`text-base px-3 py-1 ${getStatusColor(result.status)}`}>
              {result.status === "optimal" && t("Solution Optimale", "حل أمثل")}
              {result.status === "infeasible" && t("Inréalisable", "غير ممكن")}
              {result.status === "unbounded" && t("Non borné", "غير محدود")}
            </Badge>
          </h1>
        </div>
        
        <Button onClick={handleSave} disabled={saveMutation.isPending} variant="secondary">
          <Save className="w-4 h-4 mr-2" />
          {t("Sauvegarder le résultat", "حفظ النتيجة")}
        </Button>
      </div>

      {result.alerts && result.alerts.length > 0 && (
        <div className="space-y-3">
          {result.alerts.map((alert, idx) => (
            <Alert key={idx} variant={alert.type === "error" ? "destructive" : alert.type === "warning" ? "default" : "default"} className={alert.type === "warning" ? "border-orange-500 text-orange-700" : ""}>
              {getAlertIcon(alert.type)}
              <AlertTitle>
                {alert.type === "error" ? t("Erreur", "خطأ") : alert.type === "warning" ? t("Avertissement", "تحذير") : t("Information", "معلومة")}
              </AlertTitle>
              <AlertDescription>
                {language === 'ar' ? alert.messageAr : alert.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {result.status === "optimal" && (
        <>
          <section className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 bg-primary text-primary-foreground">
              <CardHeader>
                <CardTitle className="text-primary-foreground/80">{t("Valeur Optimale", "القيمة المثلى")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-5xl font-bold break-all">
                  {result.optimalValue?.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-FR', { maximumFractionDigits: 2 })}
                </div>
                <div className="mt-2 text-primary-foreground/80 flex items-center gap-2">
                  {input.objectiveType === 'maximize' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {input.objectiveType === 'maximize' ? t("Maximisation", "تعظيم") : t("Minimisation", "تقليل")}
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-secondary" />
                  {t("Résumé Décisionnel", "ملخص إداري")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-lg leading-relaxed">
                {language === 'ar' ? result.managerialSummaryAr : result.managerialSummary}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>{t("Plan d'Action (Variables)", "خطة العمل (المتغيرات)")}</CardTitle>
              <CardDescription>{t("Les valeurs optimales pour atteindre l'objectif.", "القيم المثلى لتحقيق الهدف.")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Variable", "المتغير")}</TableHead>
                    <TableHead className="text-right">{t("Valeur", "القيمة")}</TableHead>
                    <TableHead>{t("Unité", "الوحدة")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.variables?.map((v, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-lg">{v.name}</TableCell>
                      <TableCell className="text-right font-bold text-lg text-primary">
                        {v.value.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-FR', { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{v.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <ManagerialRecommendations input={input} result={result} />

          <OptimAssistant input={input} result={result} />

          {result.sensitivityAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle>{t("Analyse de Sensibilité", "تحليل الحساسية")}</CardTitle>
                <CardDescription>{t("Impact des variations sur la solution optimale.", "تأثير التغيرات على الحل الأمثل.")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {result.sensitivityAnalysis.constraints && result.sensitivityAnalysis.constraints.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3">{t("Ressources / Contraintes", "الموارد / القيود")}</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("Contrainte", "القيد")}</TableHead>
                          <TableHead className="text-right">{t("Prix Fictif (Shadow Price)", "سعر الظل")}</TableHead>
                          <TableHead className="text-right">{t("Valeur Actuelle", "القيمة الحالية")}</TableHead>
                          <TableHead className="text-right">{t("Hausse Max", "الزيادة المسموحة")}</TableHead>
                          <TableHead className="text-right">{t("Baisse Max", "النقصان المسموح")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.sensitivityAnalysis.constraints.map((c, idx) => (
                          <TableRow key={idx} className={c.isCritical ? "bg-accent/10" : ""}>
                            <TableCell className="font-medium flex items-center gap-2">
                              {c.name}
                              {c.isCritical && <Badge variant="outline" className="text-accent-foreground border-accent-foreground bg-accent/20 text-xs">{t("Critique", "حرج")}</Badge>}
                            </TableCell>
                            <TableCell className={`text-right font-bold ${c.shadowPrice && c.shadowPrice > 0 ? "text-secondary" : ""}`}>
                              {c.shadowPrice !== null && c.shadowPrice !== undefined ? c.shadowPrice.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-FR', { maximumFractionDigits: 2 }) : "-"}
                            </TableCell>
                            <TableCell className="text-right">{c.currentValue}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{c.allowableIncrease === null ? "∞" : c.allowableIncrease}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{c.allowableDecrease === null ? "∞" : c.allowableDecrease}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {result.steps && result.steps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("Détail des Itérations (Simplexe)", "تفاصيل التكرارات (السمبلكس)")}</CardTitle>
                <CardDescription>{t("Affichage pas-à-pas de l'algorithme.", "عرض خطوة بخطوة للخوارزمية.")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {result.steps.map((step) => (
                    <AccordionItem key={step.iteration} value={`step-${step.iteration}`}>
                      <AccordionTrigger className="text-lg font-medium hover:no-underline hover:text-primary">
                        {t(`Itération ${step.iteration}`, `تكرار ${step.iteration}`)}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <p className="text-muted-foreground bg-muted/50 p-3 rounded-md">
                            {language === 'ar' ? step.explanationAr : step.explanation}
                          </p>
                          <div className="overflow-x-auto rounded-md border">
                            <Table>
                              <TableBody>
                                {step.tableau.map((row, rIdx) => {
                                  const isZRow = rIdx === step.tableau.length - 1;
                                  return (
                                    <TableRow key={rIdx} className={isZRow ? "bg-primary/5 font-bold" : ""}>
                                      <TableCell className="font-medium bg-muted/30 border-r w-24">
                                        {row.basisVariable}
                                      </TableCell>
                                      {row.row.map((val, cIdx) => {
                                        const isPivot = row.pivotColumn === cIdx && row.pivotRow === rIdx;
                                        return (
                                          <TableCell 
                                            key={cIdx} 
                                            className={`text-right font-mono ${isPivot ? "bg-accent/20 text-accent-foreground font-bold border border-accent" : ""}`}
                                          >
                                            {val.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                          </TableCell>
                                        );
                                      })}
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
