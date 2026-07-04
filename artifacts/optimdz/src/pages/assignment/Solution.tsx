import { Link } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { useAssignmentState } from "@/lib/AssignmentContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ChevronLeft, Lock, Zap, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Stage bar ─────────────────────────────────────────────────────────────────
function StageBar() {
  const { t } = useLanguage();
  const stages = [
    { n: 1, fr: "Données",         ar: "البيانات" },
    { n: 2, fr: "Solution optimale", ar: "الحل الأمثل" },
  ] as const;

  return (
    <div className="flex items-center gap-0 text-sm select-none">
      {stages.map((s, idx) => {
        const done   = s.n < 2;
        const active = s.n === 2;
        return (
          <div key={s.n} className="flex items-center">
            {idx > 0 && <div className="h-px w-8 bg-muted-foreground/30 mx-1" />}
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
              done   && "bg-primary/10 text-primary",
              active && "bg-primary text-primary-foreground shadow-sm",
            )}>
              {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="font-bold">{s.n}</span>}
              {t(s.fr, s.ar)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AssignmentSolution() {
  const { t, language } = useLanguage();
  const { problem } = useAssignmentState();
  const isAr = language === "ar";

  const m = problem?.resources.length ?? 0;
  const n = problem?.tasks.length ?? 0;

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">

      {/* Stage bar + header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <StageBar />
        <Button variant="ghost" size="sm" asChild>
          <Link href="/assignment/solve">
            <ChevronLeft className={cn("w-4 h-4 mr-1", isAr && "rotate-180")} />
            {t("Modifier les données", "تعديل البيانات")}
          </Link>
        </Button>
      </div>

      <div>
        <div className="flex items-center flex-wrap gap-2 mb-1">
          <h1 className="text-2xl font-bold text-foreground">
            {t("Solution Optimale — Méthode Hongroise", "الحل الأمثل — الطريقة الهنغارية")}
          </h1>
          {problem && (
            <Badge variant="outline" className="text-xs">
              {problem.name}
            </Badge>
          )}
        </div>
        {problem && (
          <p className="text-sm text-muted-foreground">
            {t("Matrice", "مصفوفة")} {m}×{n}
            {" · "}
            {problem.objectiveType === "minimize"
              ? t("Minimisation", "تقليل")
              : t("Maximisation", "تعظيم")}
          </p>
        )}
      </div>

      {/* Coming-soon card */}
      <Card className="border-dashed border-2 border-primary/30 bg-primary/3">
        <CardContent className="py-16 flex flex-col items-center gap-6 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-10 h-10 text-primary" />
          </div>

          <div className="space-y-2 max-w-md">
            <h2 className="text-xl font-bold text-foreground">
              {t("Méthode Hongroise — Bientôt disponible", "الطريقة الهنغارية — قريباً")}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t(
                "La résolution pas-à-pas par la méthode Hongroise (algorithme Kuhn-Munkres, complexité O(n³)) sera disponible dans la prochaine version du module.",
                "سيتوفر الحل خطوة بخطوة بالطريقة الهنغارية (خوارزمية كون-مونكريس، تعقيد O(n³)) في الإصدار القادم من الوحدة."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg mt-2">
            {[
              { fr: "Réduction des lignes & colonnes", ar: "اختزال الصفوف والأعمدة", icon: "①" },
              { fr: "Couverture des zéros",             ar: "تغطية الأصفار",           icon: "②" },
              { fr: "Affectation optimale",             ar: "التوزيع الأمثل",           icon: "③" },
            ].map((step) => (
              <div key={step.icon} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/50">
                <span className="text-xl font-bold text-primary">{step.icon}</span>
                <span className="text-xs text-muted-foreground text-center">
                  {isAr ? step.ar : step.fr}
                </span>
              </div>
            ))}
          </div>

          {problem && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-4 py-2 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              {t("Données enregistrées", "البيانات محفوظة")}
              {" · "}
              {m}×{n}
              {" · "}
              {problem.objectiveType === "minimize" ? t("Min", "تقليل") : t("Max", "تعظيم")}
              {" · "}
              {problem.forbidden.flat().filter(Boolean).length > 0 && (
                <span>{problem.forbidden.flat().filter(Boolean).length} {t("interdite(s)", "محظورة")}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="outline" asChild>
          <Link href="/assignment/solve">
            <ChevronLeft className={cn("w-4 h-4 mr-1.5", isAr && "rotate-180")} />
            {t("Retour aux données", "العودة للبيانات")}
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="w-4 h-4" />
          <span>{t("Résolution — Stage 2 à venir", "الحل — المرحلة 2 قريباً")}</span>
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-medium text-primary">{t("Méthode Hongroise", "الطريقة الهنغارية")}</span>
        </div>
        <div />
      </div>

    </div>
  );
}
