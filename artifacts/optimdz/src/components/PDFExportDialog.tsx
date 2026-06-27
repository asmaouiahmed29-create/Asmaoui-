import { useState } from "react";
import type { ProblemInput, SolveResult } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/LanguageContext";
import { generatePDFReport } from "@/lib/generatePDFReport";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  input: ProblemInput;
  result: SolveResult;
}

export function PDFExportDialog({ open, onOpenChange, input, result }: Props) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [managerName, setManagerName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [progress, setProgress] = useState<{ step: string; pct: number } | null>(null);
  const [done, setDone] = useState(false);

  const isGenerating = progress !== null && !done;

  async function handleExport() {
    setDone(false);
    setProgress({ step: t("Initialisation…", "جارٍ التهيئة…"), pct: 0 });

    try {
      await generatePDFReport({
        input,
        result,
        managerName,
        institutionName,
        language,
        onProgress: (step, pct) => setProgress({ step, pct }),
      });
      setDone(true);
      setProgress({ step: t("PDF généré avec succès !", "تم إنشاء PDF بنجاح!"), pct: 100 });
      toast({
        title: t("PDF exporté", "تم تصدير PDF"),
        description: t(
          "Le rapport a été téléchargé sur votre appareil.",
          "تم تنزيل التقرير على جهازك."
        ),
      });
      setTimeout(() => {
        onOpenChange(false);
        setProgress(null);
        setDone(false);
      }, 1800);
    } catch (err) {
      setProgress(null);
      toast({
        variant: "destructive",
        title: t("Erreur lors de la génération", "خطأ في الإنشاء"),
        description: String(err),
      });
    }
  }

  function handleClose(v: boolean) {
    if (isGenerating) return;
    onOpenChange(v);
    if (!v) {
      setProgress(null);
      setDone(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-primary" />
            {t("تصدير تقرير PDF", "Exporter Rapport PDF")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Générez un rapport officiel de 6 pages prêt à imprimer ou partager.",
              "أنشئ تقريراً رسمياً من 6 صفحات جاهزاً للطباعة أو المشاركة."
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Report preview cards */}
        <div className="grid grid-cols-3 gap-2 py-1">
          {[
            { icon: "📄", label: t("صفحة الغلاف", "Couverture") },
            { icon: "📋", label: t("ملخص المسألة", "Problème") },
            { icon: "✅", label: t("الحل الأمثل", "Solution") },
            { icon: "💡", label: t("التوصيات", "Recommandations") },
            { icon: "📊", label: t("الحساسية", "Sensibilité") },
            { icon: "🔏", label: t("الختم الرقمي", "Cachet Num.") },
          ].map((p) => (
            <div
              key={p.label}
              className="flex flex-col items-center gap-1 rounded-lg border bg-muted/30 p-2 text-center"
            >
              <span className="text-lg">{p.icon}</span>
              <span className="text-xs text-muted-foreground leading-tight">{p.label}</span>
            </div>
          ))}
        </div>

        {/* Inputs */}
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-sm font-medium block">
              {t("اسم المدير / Nom du Responsable", "Nom du Responsable")}
              <span className="text-muted-foreground text-xs ms-1">
                ({t("اختياري", "optionnel")})
              </span>
            </label>
            <input
              className={inputClass}
              placeholder={t("المدير العام …", "Directeur Général …")}
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              disabled={isGenerating}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium block">
              {t("اسم المؤسسة / Nom de l'Institution", "Nom de l'Institution")}
              <span className="text-muted-foreground text-xs ms-1">
                ({t("اختياري", "optionnel")})
              </span>
            </label>
            <input
              className={inputClass}
              placeholder={t("مؤسسة …", "Entreprise …")}
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              disabled={isGenerating}
            />
          </div>
        </div>

        {/* Progress bar */}
        {progress && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{progress.step}</span>
              <span className="font-mono font-semibold">{progress.pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-1">
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={isGenerating}>
            {t("إلغاء", "Annuler")}
          </Button>
          <Button onClick={handleExport} disabled={isGenerating} className="min-w-36">
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("جارٍ الإنشاء…", "Génération…")}
              </>
            ) : done ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {t("تم!", "Terminé !")}
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                {t("تصدير PDF", "Exporter PDF")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
