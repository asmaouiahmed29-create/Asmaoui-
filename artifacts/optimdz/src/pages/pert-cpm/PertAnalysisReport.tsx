import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import type { PertCpmResult, CrashResult } from "@/lib/pertCpmAlgorithm";
import { fmt } from "@/lib/pertCpmAlgorithm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Save, CheckCircle2, Loader2, AlertTriangle,
  BarChart2, Lightbulb, ClipboardList,
} from "lucide-react";
import { PertPDFExportDialog } from "@/components/PertPDFExportDialog";
import { cn } from "@/lib/utils";

type SectorKey = "trade" | "industry" | "agriculture" | "services" | "custom";

interface Props {
  result: PertCpmResult;
  crashResult: CrashResult | null;
  projectName: string;
  sector: SectorKey | null;
  mode: "CPM" | "PERT";
}

function fDZD(n: number | undefined) {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  return Math.round(n).toLocaleString("fr-DZ") + " DA";
}

export function PertAnalysisReport({ result, crashResult, projectName, sector, mode }: Props) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const [pdfOpen, setPdfOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { activities, criticalPath, projectDuration } = result;
  const critActs    = activities.filter((a) => a.isCritical);
  const nonCritActs = activities.filter((a) => !a.isCritical);
  const maxSlack    = nonCritActs.length > 0 ? Math.max(...nonCritActs.map((a) => a.slack)) : 0;
  const avgSlack    = nonCritActs.length > 0
    ? nonCritActs.reduce((s, a) => s + a.slack, 0) / nonCritActs.length : 0;

  // Risky activities: non-critical with smallest slack (or highest variance in PERT)
  const riskActs = mode === "PERT"
    ? [...activities].filter((a) => !a.isCritical && (a.variance ?? 0) > 0)
        .sort((a, b) => (b.variance ?? 0) - (a.variance ?? 0)).slice(0, 3)
    : [...activities].filter((a) => !a.isCritical && a.slack > 0)
        .sort((a, b) => a.slack - b.slack).slice(0, 3);

  // High-slack reallocation opportunities
  const highSlackActs = [...nonCritActs].sort((a, b) => b.slack - a.slack).slice(0, 3);

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const body = {
        name: projectName || t("Projet PERT/CPM", "مشروع PERT/CPM"),
        sector: sector ?? "custom",
        objectiveType: "minimize",
        status: "optimal",
        optimalValue: parseFloat(projectDuration.toFixed(2)),
        problemData: {
          mode,
          activities: activities.map((a) => ({
            id: a.id,
            name: a.name,
            duration: a.duration ?? 0,
            ES: a.ES, EF: a.EF, LS: a.LS, LF: a.LF, slack: a.slack,
            isCritical: a.isCritical,
          })),
        },
        result: {
          projectDuration,
          criticalPath,
          projectVariance: result.projectVariance,
          projectStdDev: result.projectStdDev,
          activities,
          crash: crashResult ?? null,
        },
      };
      const res = await fetch("/api-server/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 4000);
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setIsSaving(false);
    }
  }

  // ── Situational analysis text ─────────────────────────────────────────────
  const analysisLines: { icon: string; text: string; color: string }[] = [
    {
      icon: "📊",
      color: "bg-primary/10 border-primary/30",
      text: t(
        `Le projet "${projectName || "—"}" comprend ${activities.length} activités avec une durée totale de ${fmt(projectDuration)} semaines. Le chemin critique (${criticalPath.join("→")}) englobe ${critActs.length} activité(s) sans aucune marge.`,
        `يضم مشروع "${projectName || "—"}" ${activities.length} نشاطاً بمدة إجمالية ${fmt(projectDuration)} أسبوع. المسار الحرج (${criticalPath.join("→")}) يشمل ${critActs.length} نشاطاً بلا أي مهلة.`
      ),
    },
    ...(nonCritActs.length > 0 ? [{
      icon: "🔄",
      color: "bg-secondary/10 border-secondary/30",
      text: t(
        `${nonCritActs.length} activité(s) non critiques disposent d'une marge moyenne de ${fmt(avgSlack)} semaines (max: ${fmt(maxSlack)} sem.) — une flexibilité exploitable pour la planification des ressources.`,
        `${nonCritActs.length} نشاط غير حرج يتمتع بمهلة متوسطة ${fmt(avgSlack)} أسبوع (أقصاها ${fmt(maxSlack)} أسبوع) — مرونة يمكن استثمارها في توزيع الموارد.`
      ),
    }] : []),
    ...(mode === "PERT" && result.projectVariance !== undefined ? [{
      icon: "📈",
      color: "bg-amber-50 border-amber-300",
      text: t(
        `En mode PERT, le projet présente une variance σ²=${fmt(result.projectVariance)} (σ=${fmt(result.projectStdDev ?? 0)} sem.) — un indicateur clé d'incertitude dans le calendrier.`,
        `في نمط PERT، التباين σ²=${fmt(result.projectVariance)} (σ=${fmt(result.projectStdDev ?? 0)} أسبوع) — مؤشر عدم اليقين في الجدول الزمني.`
      ),
    }] : []),
    ...(crashResult && crashResult.steps.length > 0 ? [{
      icon: "⚡",
      color: "bg-orange-50 border-orange-300",
      text: t(
        `L'analyse de crashing a permis de réduire la durée de ${fmt(crashResult.originalDuration)} à ${fmt(crashResult.achievedDuration)} semaines (gain: ${fmt(crashResult.originalDuration - crashResult.achievedDuration)} sem.) pour un coût supplémentaire de ${fDZD(crashResult.steps.reduce((s, st) => s + st.addedDirectCost, 0))}. ${crashResult.isTargetAchieved ? "Objectif atteint." : "Objectif non atteint — crash limit atteint."}`,
        `تحليل التسريع خفّض المدة من ${fmt(crashResult.originalDuration)} إلى ${fmt(crashResult.achievedDuration)} أسبوع (وفر ${fmt(crashResult.originalDuration - crashResult.achievedDuration)} أسبوع) بتكلفة إضافية ${fDZD(crashResult.steps.reduce((s, st) => s + st.addedDirectCost, 0))}. ${crashResult.isTargetAchieved ? "تم تحقيق الهدف." : "لم يتحقق الهدف — استُنفدت إمكانيات التسريع."}`
      ),
    }] : []),
  ];

  // ── Suggestions ───────────────────────────────────────────────────────────
  interface Suggestion { icon: string; title: string; desc: string; color: string; borderColor: string; }
  const suggestions: Suggestion[] = [
    {
      icon: "⚠️",
      color: "bg-primary/5",
      borderColor: "border-l-primary",
      title: t("Surveiller le chemin critique", "مراقبة المسار الحرج"),
      desc: t(
        `Priorité maximale aux activités ${critActs.map((a) => a.id).join(", ")} — tout retard se répercute directement sur la fin du projet.`,
        `الأولوية القصوى لأنشطة ${critActs.map((a) => a.id).join("، ")} — أي تأخير فيها يُؤخر المشروع بالكامل.`
      ),
    },
    ...(riskActs.length > 0 ? [{
      icon: mode === "PERT" ? "📊" : "⏱️",
      color: "bg-amber-50",
      borderColor: "border-l-amber-500",
      title: mode === "PERT"
        ? t("Réduire l'incertitude PERT", "تقليص عدم اليقين PERT")
        : t("Activités à marge faible", "أنشطة ذات مهلة ضيقة"),
      desc: mode === "PERT"
        ? t(
            `Les activités ${riskActs.map((a) => a.id).join(", ")} ont une variance élevée — révisez les estimations O/M/P avec l'équipe.`,
            `أنشطة ${riskActs.map((a) => a.id).join("، ")} ذات تشتت عالٍ — أعد تقديرات O/M/P مع الفريق.`
          )
        : t(
            `Les activités ${riskActs.map((a) => `${a.id} (${fmt(a.slack)} sem.)`).join(", ")} ont une marge réduite — à surveiller de près.`,
            `أنشطة ${riskActs.map((a) => `${a.id} (${fmt(a.slack)} أسبوع)`).join("، ")} ذات مهلة ضيقة — تستوجب متابعة دقيقة.`
          ),
    }] : []),
    ...(highSlackActs.length > 0 ? [{
      icon: "🔄",
      color: "bg-green-50",
      borderColor: "border-l-green-600",
      title: t("Réaffecter les ressources sous-utilisées", "إعادة توزيع الموارد غير المستغلة"),
      desc: t(
        `Les activités ${highSlackActs.map((a) => `${a.id} (marge ${fmt(a.slack)} sem.)`).join(", ")} peuvent céder une partie de leurs ressources au chemin critique.`,
        `أنشطة ${highSlackActs.map((a) => `${a.id} (مهلة ${fmt(a.slack)} أسبوع)`).join("، ")} يمكنها التنازل عن بعض مواردها للمسار الحرج.`
      ),
    }] : []),
    ...(crashResult ? [{
      icon: crashResult.isTargetAchieved ? "✅" : "🔶",
      color: crashResult.isTargetAchieved ? "bg-green-50" : "bg-orange-50",
      borderColor: crashResult.isTargetAchieved ? "border-l-green-500" : "border-l-orange-500",
      title: crashResult.isTargetAchieved
        ? t("Crashing réalisable", "التسريع قابل للتنفيذ")
        : t("Crashing partiellement réalisable", "التسريع قابل للتنفيذ جزئياً"),
      desc: crashResult.isTargetAchieved
        ? t(
            `La durée cible de ${fmt(crashResult.targetDuration)} semaines est atteignable en ${crashResult.steps.length} étapes pour un surcoût de ${fDZD(crashResult.steps.reduce((s, st) => s + st.addedDirectCost, 0))}.`,
            `المدة المستهدفة ${fmt(crashResult.targetDuration)} أسابيع قابلة للتحقق في ${crashResult.steps.length} خطوة بتكلفة إضافية ${fDZD(crashResult.steps.reduce((s, st) => s + st.addedDirectCost, 0))}.`
          )
        : t(
            `La durée minimale réalisable est ${fmt(crashResult.achievedDuration)} semaines — la cible ${fmt(crashResult.targetDuration)} sem. dépasse les possibilités de crashing.`,
            `المدة الدنيا الممكنة ${fmt(crashResult.achievedDuration)} أسبوع — الهدف ${fmt(crashResult.targetDuration)} أسبوع يتجاوز إمكانيات التسريع.`
          ),
    }] : []),
  ];

  return (
    <div className="space-y-6">

      {/* ── Situational Analysis ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          {t("Analyse Situationnelle", "التحليل الموقفي")}
        </h2>
        <div className="space-y-2">
          {analysisLines.map((line, i) => (
            <div key={i} className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
              line.color
            )}>
              <span className="text-base leading-snug shrink-0">{line.icon}</span>
              <span className="leading-relaxed">{line.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Suggestions ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          {t("Suggestions Managériales", "التوصيات الإدارية")}
        </h2>
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <div key={i} className={cn(
              "flex items-start gap-3 rounded-lg border-l-4 px-4 py-3",
              s.color, s.borderColor
            )}>
              <span className="text-lg shrink-0 mt-0.5">{s.icon}</span>
              <div className="space-y-1">
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Managerial Report Card ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          {t("Rapport Managérial", "التقرير الإداري")}
        </h2>
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg font-bold">
                  {projectName || t("Projet PERT/CPM", "مشروع PERT/CPM")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {mode === "PERT"
                    ? t("Analyse PERT — Probabiliste", "تحليل PERT — احتمالي")
                    : t("Analyse CPM — Déterministe", "تحليل CPM — محدد")}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge className="bg-primary/10 text-primary border-primary/30">
                  {fmt(projectDuration)} {t("semaines", "أسبوع")}
                </Badge>
                <Badge variant="outline">
                  {critActs.length} {t("activités critiques", "أنشطة حرجة")}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: t("Durée totale", "المدة الإجمالية"),    value: `${fmt(projectDuration)} sem.` },
                { label: t("Activités totales", "مجموع الأنشطة"), value: String(activities.length) },
                { label: t("Activités critiques", "الأنشطة الحرجة"), value: `${critActs.length} / ${activities.length}` },
                ...(result.projectStdDev !== undefined ? [
                  { label: t("Écart-type σ(T)", "الانحراف σ(T)"), value: `${fmt(result.projectStdDev)} sem.` },
                ] : []),
                ...(crashResult && crashResult.steps.length > 0 ? [
                  { label: t("Durée après crashing", "المدة بعد التسريع"), value: `${fmt(crashResult.achievedDuration)} sem.` },
                  { label: t("Coût de crashing", "تكلفة التسريع"),
                    value: fDZD(crashResult.steps.reduce((s, st) => s + st.addedDirectCost, 0)) },
                ] : []),
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-base font-bold mt-0.5">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Critical path */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                {t("Chemin critique", "المسار الحرج")}
              </p>
              <div className="flex flex-wrap gap-1 items-center">
                {criticalPath.map((id, i) => (
                  <span key={id} className="flex items-center gap-1">
                    <Badge className="bg-primary text-primary-foreground font-mono">{id}</Badge>
                    {i < criticalPath.length - 1 && (
                      <span className="text-primary text-sm">→</span>
                    )}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {criticalPath.map((id) => activities.find((a) => a.id === id)?.name ?? id).join(" → ")}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap pt-1">
              <Button onClick={handleSave} disabled={isSaving || savedOk} variant="outline">
                {isSaving
                  ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t("Sauvegarde…", "جارٍ الحفظ…")}</>
                  : savedOk
                  ? <><CheckCircle2 className="w-4 h-4 me-2 text-green-600" />{t("Sauvegardé !", "تم الحفظ!")}</>
                  : <><Save className="w-4 h-4 me-2" />{t("Sauvegarder le projet", "حفظ المشروع")}</>}
              </Button>
              <Button onClick={() => setPdfOpen(true)}>
                <FileText className="w-4 h-4 me-2" />
                {t("Exporter PDF", "تصدير PDF")}
              </Button>
            </div>

            {saveError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {saveError}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PertPDFExportDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        projectName={projectName}
        sector={sector ?? undefined}
        mode={mode}
        result={result}
        crashResult={crashResult ?? undefined}
      />
    </div>
  );
}
