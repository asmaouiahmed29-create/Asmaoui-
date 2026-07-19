import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { generateVariancePDFReport } from "@/lib/generateVariancePDF";
import type { VariancePDFOptions } from "@/lib/generateVariancePDF";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Download, Loader2 } from "lucide-react";

interface Props extends Omit<VariancePDFOptions, "managerName" | "institutionName" | "onProgress"> {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function VariancePDFExportDialog({ open, onOpenChange, ...pdfOpts }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [managerName,     setManagerName]     = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [progress, setProgress] = useState<{ step: string; pct: number } | null>(null);

  async function handleExport() {
    setProgress({ step: t("Initialisation…", "جارٍ التهيئة…"), pct: 0 });
    try {
      await generateVariancePDFReport({
        ...pdfOpts,
        managerName,
        institutionName,
        onProgress: (step, pct) => setProgress({ step, pct }),
      });
      setProgress(null);
      toast({ title: t("PDF exporté avec succès", "تم تصدير PDF بنجاح") });
      onOpenChange(false);
    } catch (err) {
      setProgress(null);
      toast({
        title: t("Erreur PDF", "خطأ في PDF"),
        description: String(err),
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {t("Exporter en PDF", "تصدير بصيغة PDF")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Le rapport PDF inclut le tableau détaillé des écarts, les graphiques, l'analyse situationnelle et les recommandations.",
              "يشمل تقرير PDF الجدول التفصيلي للانحرافات والمخططات والتحليل والتوصيات."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{t("Nom du responsable / manager (optionnel)", "اسم المدير (اختياري)")}</Label>
            <Input
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder={t("ex. M. Benali Ahmed", "مثال: السيد أحمد بن علي")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("Institution / entreprise (optionnel)", "المؤسسة (اختياري)")}</Label>
            <Input
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              placeholder={t("ex. SARL TechAlgérie — Alger", "مثال: SARL تك الجزائر — الجزائر")}
            />
          </div>

          {progress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.step}</span>
                <span>{progress.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!progress}>
            {t("Annuler", "إلغاء")}
          </Button>
          <Button onClick={handleExport} disabled={!!progress}>
            {progress ? (
              <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t("Génération…", "جارٍ الإنشاء…")}</>
            ) : (
              <><Download className="w-4 h-4 me-2" />{t("Télécharger PDF", "تحميل PDF")}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
