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
      const res = await fetch("/api/problems", {
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

  // ── Situational analysis — narrative paragraphs ───────────────────────────
  // Para 1: overall duration + critical path (with activity names, not raw IDs)
  const critPathLabels = criticalPath.map((id) => {
    const act = activities.find((a) => a.id === id);
    return act?.name ? `${act.name} (${id})` : id;
  });
  const para1 = t(
    `Le projet "${projectName || "—"}" regroupe ${activities.length} activité${activities.length > 1 ? "s" : ""} pour une durée totale de ${fmt(projectDuration)} semaines. Le chemin critique — ${critPathLabels.join(" → ")} — enchaîne ${critActs.length} activité${critActs.length > 1 ? "s" : ""} sans aucune marge de flottement : un retard sur l'une d'elles se répercute immédiatement et intégralement sur la date d'achèvement du projet.`,
    `يضم مشروع "${projectName || "—"}" ${activities.length} نشاطاً بمدة إجمالية ${fmt(projectDuration)} أسبوع. يمر المسار الحرج عبر — ${critPathLabels.join(" ← ")} — ويشمل ${critActs.length} نشاط${critActs.length > 1 ? "اً" : ""} بلا أي مهلة مرونة: تأخير أي منها يتحول فوراً وبالكامل إلى تأخير في تاريخ انتهاء المشروع.`
  );

  // Para 2: slack/float interpretation for non-critical activities
  const mostFlexible = nonCritActs.length > 0
    ? [...nonCritActs].sort((a, b) => b.slack - a.slack)[0]
    : null;
  const para2 = nonCritActs.length > 0 && mostFlexible ? t(
    `Les ${nonCritActs.length} activité${nonCritActs.length > 1 ? "s" : ""} non critiques disposent d'une marge de flottement : en moyenne ${fmt(avgSlack)} semaine${avgSlack >= 2 ? "s" : ""}, et jusqu'à ${fmt(maxSlack)} semaine${maxSlack >= 2 ? "s" : ""} pour ${mostFlexible.name} (${mostFlexible.id}). Cette flexibilité permet de lisser l'utilisation des ressources ou d'absorber des imprévus mineurs sans repousser la date de fin, à condition que les activités critiques restent protégées.`,
    `الأنشطة الـ${nonCritActs.length} غير الحرجة تتمتع بمهلة مرونة تبلغ في المتوسط ${fmt(avgSlack)} أسبوع، وتصل إلى ${fmt(maxSlack)} أسبوع لنشاط ${mostFlexible.name} (${mostFlexible.id}). يمكن توظيف هذه المهلة لتسوية استخدام الموارد أو استيعاب متغيرات طارئة دون تأخير تاريخ الانتهاء، شريطة الحفاظ على حماية الأنشطة الحرجة.`
  ) : "";

  // Para 3 (a): PERT uncertainty interpretation — no raw σ² notation
  const para3pert = mode === "PERT" && result.projectVariance !== undefined && result.projectStdDev !== undefined ? t(
    `L'analyse probabiliste (PERT) révèle une incertitude de ±${fmt(result.projectStdDev)} semaine${(result.projectStdDev ?? 0) >= 2 ? "s" : ""} (un écart-type) autour de la durée prévue de ${fmt(projectDuration)} semaines. Concrètement, la durée réelle se situera dans la plage ${fmt(projectDuration - (result.projectStdDev ?? 0))}–${fmt(projectDuration + (result.projectStdDev ?? 0))} semaines dans environ deux tiers des scénarios. Plus l'incertitude est élevée, plus un suivi proactif des activités à forte dispersion de durée est indispensable.`,
    `يكشف التحليل الاحتمالي (PERT) عن حالة عدم يقين بمقدار ±${fmt(result.projectStdDev)} أسبوع (انحراف معياري واحد) حول المدة المتوقعة البالغة ${fmt(projectDuration)} أسبوع. عملياً، ستتراوح المدة الفعلية بين ${fmt(projectDuration - (result.projectStdDev ?? 0))} و${fmt(projectDuration + (result.projectStdDev ?? 0))} أسبوع في نحو ثلثي السيناريوهات. كلما ارتفع هامش عدم اليقين، كان التتبع الاستباقي للأنشطة ذات التشتت العالي أكثر ضرورة.`
  ) : "";

  // Para 3 (b): crashing result — what was achieved and at what cost
  const crashCost = crashResult ? crashResult.steps.reduce((s, st) => s + st.addedDirectCost, 0) : 0;
  const para3crash = crashResult && crashResult.steps.length > 0 ? t(
    crashResult.isTargetAchieved
      ? `L'analyse de compression (crashing) a permis de réduire la durée de ${fmt(crashResult.originalDuration)} à ${fmt(crashResult.achievedDuration)} semaine${crashResult.achievedDuration >= 2 ? "s" : ""} — un gain de ${fmt(crashResult.originalDuration - crashResult.achievedDuration)} semaine${(crashResult.originalDuration - crashResult.achievedDuration) >= 2 ? "s" : ""} — en ${crashResult.steps.length} étape${crashResult.steps.length > 1 ? "s" : ""} d'accélération pour un surcoût de ${fDZD(crashCost)}. L'objectif de ${fmt(crashResult.targetDuration)} semaines est pleinement atteint.`
      : `L'analyse de compression (crashing) a réduit la durée à ${fmt(crashResult.achievedDuration)} semaine${crashResult.achievedDuration >= 2 ? "s" : ""} (gain de ${fmt(crashResult.originalDuration - crashResult.achievedDuration)} sem.) pour ${fDZD(crashCost)} de surcoût, mais la cible de ${fmt(crashResult.targetDuration)} semaines demeure hors d'atteinte — les possibilités d'accélération sont épuisées. Des leviers organisationnels (parallélisation, ressources externes) seraient nécessaires pour aller plus loin.`,
    crashResult.isTargetAchieved
      ? `أتاح تحليل الضغط (Crashing) تخفيض المدة من ${fmt(crashResult.originalDuration)} إلى ${fmt(crashResult.achievedDuration)} أسبوع — وفّر ${fmt(crashResult.originalDuration - crashResult.achievedDuration)} أسبوع — عبر ${crashResult.steps.length} خطوة تسريع بتكلفة إضافية ${fDZD(crashCost)}. تم بلوغ الهدف المحدد بـ${fmt(crashResult.targetDuration)} أسبوع بالكامل.`
      : `خفّض تحليل الضغط (Crashing) المدة إلى ${fmt(crashResult.achievedDuration)} أسبوع (وفّر ${fmt(crashResult.originalDuration - crashResult.achievedDuration)} أسبوع) بتكلفة إضافية ${fDZD(crashCost)}، غير أن الهدف البالغ ${fmt(crashResult.targetDuration)} أسبوع لا يزال بعيد المنال — استُنفدت إمكانيات التسريع بالكامل. تحقيق تقليص إضافي يستلزم رافعات تنظيمية كالتوازي بين الأنشطة أو الاستعانة بموارد خارجية.`
  ) : "";

  // ── Suggestions ───────────────────────────────────────────────────────────
  interface Suggestion { icon: string; title: string; desc: string; color: string; borderColor: string; }
  const suggestions: Suggestion[] = [
    {
      icon: "⚠️",
      color: "bg-primary/5",
      borderColor: "border-l-primary",
      title: t("Surveiller le chemin critique", "مراقبة المسار الحرج"),
      desc: t(
        `Ces ${critActs.length} activité${critActs.length > 1 ? "s" : ""} ne tolèrent aucun retard sans impact direct sur la date de fin. Affectez-y les ressources prioritaires, instaurez un reporting journalier et anticipez tout risque de blocage avant qu'il ne survienne.`,
        `هذه الأنشطة الـ${critActs.length} لا تتحمل أي تأخير دون أن يمس ذلك مباشرةً تاريخ الانتهاء. خصّص لها الموارد ذات الأولوية، وأنشئ تقارير متابعة يومية، وتوقّع أي عقبة قبل وقوعها.`
      ),
    },
    ...(riskActs.length > 0 ? [{
      icon: mode === "PERT" ? "📊" : "⏱️",
      color: "bg-amber-50",
      borderColor: "border-l-amber-500",
      title: mode === "PERT"
        ? t("Réduire l'incertitude sur les durées", "تضييق نطاق عدم اليقين في المدد")
        : t("Activités à marge faible — risque de bascule", "أنشطة ذات مهلة ضيقة — خطر الانزلاق إلى الحرجية"),
      desc: mode === "PERT"
        ? t(
            `${riskActs.map((a) => `${a.name} (${a.id})`).join(", ")} présentent la plus forte dispersion dans les estimations de durée. Révisez les scénarios optimiste, pessimiste et le plus probable avec les responsables d'activité pour resserrer la fourchette et réduire l'incertitude globale.`,
            `${riskActs.map((a) => `${a.name} (${a.id})`).join("، ")} تُظهر أعلى تشتت في تقدير المدد. راجع السيناريوهات المتفائلة والمتشائمة والأرجح مع المسؤولين عن كل نشاط لتضييق النطاق وتقليص حالة عدم اليقين الإجمالية.`
          )
        : t(
            `${riskActs.map((a) => `${a.name} (${a.id}) : ${fmt(a.slack)} sem. de marge`).join(" — ")}. Un glissement de quelques semaines sur l'une de ces activités suffit à la basculer sur le chemin critique et à retarder le projet. Prévoyez des points de contrôle intermédiaires.`,
            `${riskActs.map((a) => `${a.name} (${a.id}): ${fmt(a.slack)} أسبوع مهلة`).join(" — ")}. انزلاق بضعة أسابيع في أيٍّ من هذه الأنشطة كافٍ لإدراجها في المسار الحرج وتأخير المشروع. ضع نقاط مراجعة وسيطة.`
          ),
    }] : []),
    ...(highSlackActs.length > 0 ? [{
      icon: "🔄",
      color: "bg-green-50",
      borderColor: "border-l-green-600",
      title: t("Réaffecter les ressources sous-utilisées", "إعادة توزيع الموارد غير المستغلة"),
      desc: t(
        `${highSlackActs.map((a) => `${a.name} (${a.id}) — ${fmt(a.slack)} sem.`).join(", ")} disposent de la plus grande marge du projet. Une partie de leurs ressources peut être temporairement redirigée vers les activités critiques pour réduire les risques ou absorber des retards en cours.`,
        `${highSlackActs.map((a) => `${a.name} (${a.id}) — ${fmt(a.slack)} أسبوع`).join("، ")} تمتلك أوسع مهلة في المشروع. يمكن توجيه جزء من مواردها مؤقتاً نحو الأنشطة الحرجة لتقليص المخاطر أو استيعاب تأخيرات جارية.`
      ),
    }] : []),
    ...(crashResult ? [{
      icon: crashResult.isTargetAchieved ? "✅" : "🔶",
      color: crashResult.isTargetAchieved ? "bg-green-50" : "bg-orange-50",
      borderColor: crashResult.isTargetAchieved ? "border-l-green-500" : "border-l-orange-500",
      title: crashResult.isTargetAchieved
        ? t("Compression réalisable — plan prêt à valider", "الضغط قابل للتنفيذ — الخطة جاهزة للاعتماد")
        : t("Compression partielle — explorer d'autres leviers", "ضغط جزئي — استكشاف رافعات أخرى"),
      desc: crashResult.isTargetAchieved
        ? t(
            `La cible de ${fmt(crashResult.targetDuration)} semaines est atteignable en ${crashResult.steps.length} étape${crashResult.steps.length > 1 ? "s" : ""} pour un surcoût de ${fDZD(crashCost)}. Validez le plan de compression avec les parties prenantes et assurez-vous que le budget supplémentaire est approuvé avant de lancer les accélérations.`,
            `الهدف البالغ ${fmt(crashResult.targetDuration)} أسبوع قابل للتحقق في ${crashResult.steps.length} خطوة بتكلفة إضافية ${fDZD(crashCost)}. اعتمد خطة الضغط مع أصحاب المصلحة وتأكد من الموافقة على الميزانية الإضافية قبل إطلاق إجراءات التسريع.`
          )
        : t(
            `الإمكانيات المباشرة للتسريع مستنفدة عند ${fmt(crashResult.achievedDuration)} أسبوع — لم تُبلَّغ فجوة ${fmt(crashResult.targetDuration - crashResult.achievedDuration)} أسبوع المتبقية. للتقدم أكثر: أعد تحليل تبعيات الأنشطة بحثاً عن فرص التوازي، أو استعن بموارد خارجية، أو راجع نطاق المشروع مع صاحب القرار.`,
            `Les possibilités directes de compression sont épuisées à ${fmt(crashResult.achievedDuration)} semaines — les ${fmt(crashResult.targetDuration - crashResult.achievedDuration)} sem. restantes restent hors d'atteinte. Pour aller plus loin : réanalysez les dépendances pour trouver des opportunités de parallélisation, faites appel à des ressources externes, ou renegociez le périmètre avec le décideur.`
          ),
    }] : []),
  ];

  return (
    <div className="space-y-6">

      {/* ── Situational Analysis ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          {t("Analyse de la Situation", "تحليل الوضع")}
        </h2>
        <div className={cn("rounded-lg border border-primary/20 bg-primary/5 px-5 py-4 space-y-3 text-sm leading-relaxed text-foreground", isAr && "text-right")}>
          <p>{para1}</p>
          {para2 && <p className="text-muted-foreground">{para2}</p>}
          {para3pert && <p>{para3pert}</p>}
          {para3crash && <p>{para3crash}</p>}
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
