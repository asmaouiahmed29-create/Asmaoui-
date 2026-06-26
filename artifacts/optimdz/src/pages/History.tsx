import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { useListProblems, useDeleteProblem } from "@workspace/api-client-react";
import { useProblemState } from "@/lib/ProblemContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Play, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function History() {
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setInputAndResult } = useProblemState();
  const [sectorFilter, setSectorFilter] = useState<string>("all");

  const { data: problems, isLoading, refetch } = useListProblems(
    sectorFilter !== "all" ? { sector: sectorFilter } : undefined
  );

  const deleteMutation = useDeleteProblem({
    mutation: {
      onSuccess: () => {
        toast({
          title: t("Succès", "نجاح"),
          description: t("Problème supprimé.", "تم حذف المسألة."),
        });
        refetch();
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: t("Erreur", "خطأ"),
          description: t("Impossible de supprimer.", "لا يمكن الحذف."),
        });
      }
    }
  });

  const handleDelete = (id: number) => {
    if (confirm(t("Êtes-vous sûr de vouloir supprimer cet élément ?", "هل أنت متأكد أنك تريد حذف هذا العنصر؟"))) {
      deleteMutation.mutate({ id });
    }
  };

  const handleLoad = (problem: any) => {
    if (problem.problemData && problem.result) {
      setInputAndResult(problem.problemData, problem.result);
      setLocation("/results");
    } else {
      toast({
        variant: "destructive",
        title: t("Erreur", "خطأ"),
        description: t("Données incomplètes.", "بيانات غير مكتملة."),
      });
    }
  };

  const statusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    if (status === 'optimal') return <Badge className="bg-secondary hover:bg-secondary/90">{t("Optimal", "أمثل")}</Badge>;
    if (status === 'infeasible') return <Badge variant="destructive">{t("Inréalisable", "غير ممكن")}</Badge>;
    if (status === 'unbounded') return <Badge variant="outline" className="text-accent-foreground border-accent-foreground">{t("Non borné", "غير محدود")}</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {t("Historique des Problèmes", "سجل المسائل")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("Retrouvez et analysez vos calculs précédents.", "ابحث وحلل حساباتك السابقة.")}
          </p>
        </div>
        
        <div className="w-full md:w-64">
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger>
              <SelectValue placeholder={t("Filtrer par secteur", "تصفية حسب القطاع")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Tous les secteurs", "جميع القطاعات")}</SelectItem>
              <SelectItem value="industry">{t("Industrie", "صناعة")}</SelectItem>
              <SelectItem value="agriculture">{t("Agriculture", "زراعة")}</SelectItem>
              <SelectItem value="trade">{t("Commerce", "تجارة")}</SelectItem>
              <SelectItem value="custom">{t("Personnalisé", "مخصص")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Nom", "الاسم")}</TableHead>
                <TableHead>{t("Secteur", "القطاع")}</TableHead>
                <TableHead>{t("Date", "التاريخ")}</TableHead>
                <TableHead>{t("Statut", "الحالة")}</TableHead>
                <TableHead className="text-right">{t("Valeur Optimale", "القيمة المثلى")}</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="animate-pulse bg-muted h-4 w-1/3 mx-auto rounded"></div>
                  </TableCell>
                </TableRow>
              ) : !problems || problems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {t("Aucun problème trouvé.", "لم يتم العثور على أية مسائل.")}
                  </TableCell>
                </TableRow>
              ) : (
                problems.map((problem) => (
                  <TableRow key={problem.id}>
                    <TableCell className="font-medium">{problem.name}</TableCell>
                    <TableCell className="capitalize">{problem.sector}</TableCell>
                    <TableCell>
                      {new Date(problem.createdAt).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-FR', {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell>{statusBadge(problem.status)}</TableCell>
                    <TableCell className="text-right font-bold">
                      {problem.status === 'optimal' ? (
                        problem.optimalValue?.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-FR', { maximumFractionDigits: 2 })
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleLoad(problem)}
                          title={t("Recharger", "إعادة تحميل")}
                        >
                          <Play className="w-4 h-4 text-primary" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(problem.id)}
                          title={t("Supprimer", "حذف")}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
