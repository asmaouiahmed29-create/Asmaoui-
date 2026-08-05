import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import type { BreakEvenResult } from "@/lib/breakEvenAlgorithm";
import { fmtDA, fmtN } from "@/lib/breakEvenAlgorithm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText, Save, CheckCircle2, Loader2, AlertTriangle,
  BarChart2, Lightbulb, ClipboardList, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { generateProjectFeasibilityPDFReport } from "@/lib/generateProjectFeasibilityPDFReport";

type SectorKey = "trade" | "industry" | "agriculture" | "services" | "custom";

interface Props {
  result: BreakEvenResult;
  projectName: string;
  sector: SectorKey | null;
}

export function ProjectBreakEvenReport({ result, projectName, sector }: Props) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const [pdfOpen,         setPdfOpen]         = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [savedOk,         setSavedOk]         = useState(false);
  const [saveError,       setSaveError]       = useState<string | null>(null);
  const [pdfLoading,      setPdfLoading]      = useState(false);
  const [managerName,     setManagerName]     = useState("");
  const [institutionName, setInstitutionName] = useState("");

  const { input: inp, contributionMarginRatio: cmr,
          breakEvenUnits: bepU, breakEvenRevenue: bepR,
          contributionMarginPerUnit: cm } = result;

  // ── Situational analysis — project-framed ─────────────────────────────────
  // Para 1: break-even mechanics explained for this specific project (always)
  const cmQual = cmr >= 50
    ? t("un taux solide qui permet d'atteindre l'équilibre avec un volume de ventes raisonnable",
        "نسبة قوية تُتيح بلوغ التعادل بحجم مبيعات معتدل")
    : cmr >= 30
    ? t("un taux acceptable, mais qui exige de valider soigneusement la capacité du marché avant de s'engager dans les charges fixes",
        "نسبة مقبولة، غير أنها تستوجب التحقق الدقيق من قدرة السوق قبل الالتزام بالأعباء الثابتة")
    : t("un taux serré qui impose un volume de ventes élevé — le risque de pertes prolongées avant le seuil est réel",
        "نسبة ضيقة تفرض حجم مبيعات مرتفعاً — خطر الخسائر المطوّلة قبل التعادل حقيقي");

  const para1 = t(
    `Pour couvrir les ${fmtDA(inp.fixedCosts)} de charges fixes engagées par le projet "${inp.productName}", il faut vendre ${fmtN(bepU, 1)} unités à ${fmtDA(inp.sellingPrice)} l'une — soit un chiffre d'affaires de ${fmtDA(bepR)}. Chaque unité vendue dégage une marge sur coût variable de ${fmtDA(cm)} (${fmtN(cmr, 1)} %), ${cmQual}.`,
    `لتغطية الأعباء الثابتة البالغة ${fmtDA(inp.fixedCosts)} التي يلتزم بها مشروع "${inp.productName}"، يجب بيع ${fmtN(bepU, 1)} وحدة بسعر ${fmtDA(inp.sellingPrice)} للوحدة — أي تحقيق رقم أعمال قدره ${fmtDA(bepR)}. تُدرّ كل وحدة مباعة هامش مساهمة بـ ${fmtDA(cm)} (${fmtN(cmr, 1)}%)، وهو ${cmQual}.`
  );

  // Para 2: gap between expected sales and BEP (only when expectedSalesVolume provided)
  let para2 = "";
  if (result.marginOfSafetyPct !== undefined && inp.expectedSalesVolume !== undefined) {
    const mos   = result.marginOfSafetyPct;
    const mosU  = result.marginOfSafetyUnits   ?? 0;
    const mosR  = result.marginOfSafetyRevenue ?? 0;
    const above = mosU >= 0;
    if (above) {
      const comfort = mos >= 25
        ? t("Ce coussin est confortable : les ventes peuvent reculer de près d'un quart avant que le projet bascule en perte.",
            "هذه الوسادة مريحة: يمكن للمبيعات أن تتراجع بما يقارب الربع قبل أن يعود المشروع إلى منطقة الخسارة.")
        : mos >= 10
        ? t("Ce coussin est étroit : toute perturbation commerciale significative suffit à repasser sous le seuil.",
            "هذه الوسادة ضيقة: أي اضطراب تجاري ملحوظ كافٍ للعودة دون نقطة التعادل.")
        : t("Ce coussin est insuffisant : la moindre baisse de la demande expose le projet à des pertes immédiates.",
            "هذه الوسادة غير كافية: أدنى تراجع في الطلب يُعرّض المشروع لخسائر فورية.");
      para2 = t(
        `Avec un volume de ventes prévu de ${fmtN(inp.expectedSalesVolume, 1)} unités, le projet se situe ${fmtN(mosU, 1)} unités au-dessus du seuil, dégageant un bénéfice net de ${fmtDA(result.netProfit ?? 0)} et une marge de sécurité de ${fmtN(mos, 1)} % (soit ${fmtDA(mosR)} de CA tampon). ${comfort}`,
        `بحجم مبيعات متوقع يبلغ ${fmtN(inp.expectedSalesVolume, 1)} وحدة، يقع المشروع ${fmtN(mosU, 1)} وحدة فوق نقطة التعادل، محققاً ربحاً صافياً بـ ${fmtDA(result.netProfit ?? 0)} وهامش أمان ${fmtN(mos, 1)}% (أي ${fmtDA(mosR)} من رقم الأعمال كوسادة). ${comfort}`
      );
    } else {
      para2 = t(
        `Avec un volume de ventes prévu de ${fmtN(inp.expectedSalesVolume, 1)} unités, le projet ne couvre pas encore ses charges fixes : il lui manque ${fmtN(Math.abs(mosU), 1)} unités pour atteindre l'équilibre, ce qui signifie que le projet sera déficitaire au niveau de production envisagé. Une révision de la tarification, des charges ou du volume cible s'impose avant le lancement.`,
        `بحجم مبيعات متوقع يبلغ ${fmtN(inp.expectedSalesVolume, 1)} وحدة، لا يُغطي المشروع بعدُ أعباءه الثابتة: يحتاج ${fmtN(Math.abs(mosU), 1)} وحدة إضافية لبلوغ التعادل، مما يعني أن المشروع سيكون خاسراً عند مستوى الإنتاج المخطط. مراجعة التسعير أو الأعباء أو الحجم المستهدف ضرورة قبل الإطلاق.`
      );
    }
  }

  // Para 3: structural risk + operating leverage (always)
  const riskSentFr = cmr >= 50
    ? `La structure de coûts du projet est favorable : avec ${fmtN(cmr, 1)} % de taux de marge, chaque euro de CA supplémentaire contribue significativement à absorber les charges fixes.`
    : cmr >= 30
    ? `Le taux de marge de ${fmtN(cmr, 1)} % est acceptable mais pas confortable : le projet dépend d'une exécution commerciale rigoureuse pour maintenir le volume nécessaire.`
    : `Avec seulement ${fmtN(cmr, 1)} % de taux de marge, la structure économique du projet est sous tension : le volume requis pour couvrir les charges est élevé, et toute sous-performance commerciale engendre des pertes rapidement.`;
  const riskSentAr = cmr >= 50
    ? `هيكل تكاليف المشروع ملائم: بنسبة هامش ${fmtN(cmr, 1)}%، كل دينار إضافي في رقم الأعمال يُسهم بشكل ملموس في استيعاب الأعباء الثابتة.`
    : cmr >= 30
    ? `نسبة الهامش ${fmtN(cmr, 1)}% مقبولة لكن غير مريحة: يعتمد المشروع على تنفيذ تجاري صارم للحفاظ على الحجم اللازم.`
    : `بنسبة هامش ${fmtN(cmr, 1)}% فقط، الهيكل الاقتصادي للمشروع في حالة ضغط: الحجم المطلوب لتغطية الأعباء مرتفع، وأي تقصير تجاري يُفضي إلى خسائر سريعة.`;
  const dolSentFr = result.operatingLeverage !== undefined
    ? ` Le levier opérationnel de ${fmtN(result.operatingLeverage, 2)}× amplifie les deux sens : une hausse de 10 % des ventes améliore le résultat de ${fmtN(result.operatingLeverage * 10, 1)} %, mais une baisse équivalente le dégrade d'autant — ce qui rend la maîtrise du volume critique.`
    : "";
  const dolSentAr = result.operatingLeverage !== undefined
    ? ` الرافعة التشغيلية البالغة ${fmtN(result.operatingLeverage, 2)}× تُضخّم الاتجاهين: ارتفاع المبيعات 10% يُحسّن النتيجة بـ ${fmtN(result.operatingLeverage * 10, 1)}%، لكن انخفاضها بالقدر ذاته يُدهورها بنفس النسبة — مما يجعل ضبط الحجم أمراً محورياً.`
    : "";
  const para3 = t(riskSentFr + dolSentFr, riskSentAr + dolSentAr);

  // Para 4: target profit volume (only when set)
  const para4 = result.targetProfitUnits !== undefined ? t(
    `Pour atteindre l'objectif de bénéfice de ${fmtDA(inp.targetProfit)}, le projet doit vendre ${fmtN(result.targetProfitUnits, 1)} unités — soit ${fmtN((result.targetProfitUnits ?? 0) - bepU, 1)} unités au-delà du seuil de rentabilité. Cet écart définit le volume supplémentaire à assurer par le plan commercial pour que l'investissement soit pleinement rentable.`,
    `لبلوغ هدف الربح البالغ ${fmtDA(inp.targetProfit)}، يجب على المشروع بيع ${fmtN(result.targetProfitUnits, 1)} وحدة — أي ${fmtN((result.targetProfitUnits ?? 0) - bepU, 1)} وحدة فوق نقطة التعادل. هذا الفارق يُحدد الحجم الإضافي الذي يجب أن تضمنه الخطة التجارية لتكون الاستثمار مُجدياً تماماً.`
  ) : "";

  // ── Project-specific Go/No-Go suggestions ─────────────────────────────────
  interface Suggestion { icon: string; title: string; desc: string; color: string; borderColor: string; }
  const suggestions: Suggestion[] = [
    {
      icon: "🎯",
      color: "bg-primary/5",
      borderColor: "border-l-primary",
      title: t(
        "Valider la capacité d'absorption du marché",
        "التحقق من qدرة السوق على استيعاب الحجم"
      ),
      desc: t(
        `Avant de vous engager dans les charges fixes, conduisez une estimation du volume réellement accessible : enquête auprès de la clientèle cible, benchmarks de ventes sectoriels, analyse de la concurrence locale. Comparez ce volume accessible au seuil calculé pour juger si le projet est commercialement viable dans votre marché.`,
        `قبل الالتزام بالأعباء الثابتة، أجرِ تقييماً للحجم المتاح فعلياً: استبيان لدى الشريحة المستهدفة، مقارنة قطاعية لأحجام المبيعات، تحليل المنافسة المحلية. قارن هذا الحجم بنقطة التعادل المحسوبة للحكم على جدوى المشروع تجارياً في سوقك.`
      ),
    },
    {
      icon: "📅",
      color: "bg-secondary/5",
      borderColor: "border-l-secondary",
      title: t(
        "Établir un calendrier de montée en charge",
        "وضع جدول زمني للوصول إلى نقطة التعادل"
      ),
      desc: t(
        `Un nouveau projet n'atteint pas son régime de croisière dès le premier mois. Définissez des jalons de montée en charge réalistes (Mois 1, 3, 6…) et identifiez le mois auquel le volume atteint le seuil de rentabilité. Ce mois-clé définit la durée pendant laquelle le projet consomme du cash avant de s'autofinancer — et donc le montant de trésorerie à mobiliser dès le départ.`,
        `المشروع الجديد لا يبلغ طاقته الكاملة في الشهر الأول. ضع معالم نمو واقعية (الشهر 1، 3، 6...) وحدّد الشهر الذي يبلغ فيه الحجم نقطة التعادل. هذا الشهر المحوري يُحدد المدة التي يستهلك فيها المشروع السيولة قبل تمويل ذاته — وبالتالي مقدار النقد الواجب تعبئته منذ البداية.`
      ),
    },
    {
      icon: "💸",
      color: "bg-amber-50",
      borderColor: "border-l-amber-500",
      title: t(
        "Prévoir le financement de la phase pré-seuil",
        "تأمين تمويل مرحلة ما قبل التعادل"
      ),
      desc: t(
        `Estimez le déficit cumulé maximal pendant la montée en charge (pertes mensuelles × durée estimée avant le seuil) et assurez-vous que votre plan de financement — fonds propres, crédit bancaire, apports d'associés — couvre ce montant avec une marge de sécurité. Un projet bien calculé mais sous-financé peut échouer faute de trésorerie, même si le modèle économique est solide.`,
        `قدّر أقصى عجز تراكمي خلال مرحلة النمو (الخسائر الشهرية × المدة المقدّرة قبل التعادل) وتأكد أن خطة التمويل — رأس مال ذاتي، قرض بنكي، مساهمات الشركاء — تُغطي هذا المبلغ مع هامش أمان. مشروع محسوب جيداً لكن ممول بشكل ناقص قد يفشل بسبب شُح السيولة، حتى لو كان النموذج الاقتصادي سليماً.`
      ),
    },
    ...(cmr < 40 ? [{
      icon: "💰",
      color: "bg-red-50",
      borderColor: "border-l-red-500",
      title: t(
        "Améliorer la structure économique avant le lancement",
        "تحسين الهيكل الاقتصادي قبل إطلاق المشروع"
      ),
      desc: t(
        `Trois leviers à explorer en priorité avant de finaliser le modèle : (1) révision à la hausse du prix de vente — même +5 % peut déplacer significativement le seuil vers le bas ; (2) négociation des coûts d'approvisionnement avec des volumes d'engagement ou des fournisseurs alternatifs ; (3) réduction des charges fixes via sous-traitance, location courte durée ou mutualisation d'équipements.`,
        `ثلاث رافعات يجب استكشافها بالأولوية قبل إقرار النموذج: (1) رفع سعر البيع — حتى +5% يمكنه خفض نقطة التعادل بشكل ملحوظ؛ (2) التفاوض على تكاليف التوريد بحجم التزام أو موردين بديلين؛ (3) تخفيض الأعباء الثابتة عبر التعاقد الخارجي أو الإيجار قصير المدى أو مشاركة المعدات.`
      ),
    }] : []),
    ...(result.marginOfSafetyPct !== undefined && result.marginOfSafetyPct < 20 ? [{
      icon: "🔴",
      color: "bg-red-50",
      borderColor: "border-l-red-500",
      title: t(
        "Renforcer le coussin de sécurité avant l'engagement",
        "تعزيز وسادة الأمان قبل الالتزام"
      ),
      desc: t(
        `Deux approches complémentaires pour élargir la marge de sécurité : (1) augmenter le prix de vente de 10–15 % sur les segments les moins sensibles au prix — ce qui réduit le seuil et élargit le tampon ; (2) diversifier les canaux de distribution pour atteindre des segments clients supplémentaires et réduire la dépendance à un seul canal. N'engagez pas les charges fixes avant d'avoir sécurisé une marge de sécurité d'au moins 20 %.`,
        `نهجان تكميليان لتوسيع هامش الأمان: (1) رفع سعر البيع 10-15% على الشرائح الأقل حساسيةً للسعر — مما يُخفض نقطة التعادل ويوسّع الوسادة؛ (2) تنويع قنوات التوزيع لاستقطاب شرائح عملاء إضافية وتقليل الاعتماد على قناة واحدة. لا تلتزم بالأعباء الثابتة قبل تأمين هامش أمان لا يقل عن 20%.`
      ),
    }] : []),
    ...(inp.fixedCosts / (inp.sellingPrice * bepU) > 0.5 ? [{
      icon: "🏭",
      color: "bg-green-50",
      borderColor: "border-l-green-600",
      title: t(
        "Alléger les charges fixes dédiées au projet",
        "تخفيف الأعباء الثابتة الخاصة بالمشروع"
      ),
      desc: t(
        `Lorsque les charges fixes absorbent plus de la moitié du CA au seuil, le risque financier du démarrage est concentré. Pour alléger cet engagement initial : privilégiez les équipements d'occasion ou en leasing, étudiez des espaces partagés ou en co-working pour les locaux, et limitez les embauches permanentes au strict minimum en démarrant avec des contrats à durée déterminée ou de la sous-traitance.`,
        `عندما تستنزف الأعباء الثابتة أكثر من نصف رقم أعمال التعادل، يتركّز المخاطر المالية عند الانطلاق. لتخفيف هذا الالتزام المبدئي: فضّل المعدات المستعملة أو التأجير التمويلي، ادرس المساحات المشتركة للمكاتب، وقلّص التوظيف الدائم إلى الحد الأدنى بالبدء بعقود محددة المدة أو التعاقد الخارجي.`
      ),
    }] : []),
    ...(result.targetProfitUnits !== undefined ? [{
      icon: "🏆",
      color: "bg-primary/5",
      borderColor: "border-l-primary",
      title: t(
        "Intégrer le volume-cible dans le plan commercial",
        "إدراج الحجم المستهدف في الخطة التجارية"
      ),
      desc: t(
        `Traduisez cet objectif de volume en plan d'action commercial concret : canaux de vente à activer, cadence de prospection, offres promotionnelles de lancement, partenariats de distribution. Définissez un délai réaliste pour atteindre ce volume et utilisez-le comme KPI principal du suivi mensuel du projet.`,
        `حوّل هدف الحجم هذا إلى خطة عمل تجارية ملموسة: قنوات البيع المُفعَّلة، إيقاع التنقيب، عروض الإطلاق الترويجية، شراكات التوزيع. حدّد جدولاً زمنياً واقعياً لبلوغ هذا الحجم واستخدمه كمؤشر أداء رئيسي في متابعة المشروع الشهرية.`
      ),
    }] : []),
  ];

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const body = {
        name: projectName || t("Faisabilité Projet — Seuil", "جدوى المشروع — نقطة التعادل"),
        sector: sector ?? "custom",
        objectiveType: "minimize",
        status: "optimal",
        optimalValue: parseFloat(bepR.toFixed(2)),
        problemData: {
          type: "project-breakeven",
          input: {
            productName:          inp.productName,
            sellingPrice:         inp.sellingPrice,
            variableCost:         inp.variableCost,
            fixedCosts:           inp.fixedCosts,
            targetProfit:         inp.targetProfit,
            expectedSalesVolume:  inp.expectedSalesVolume,
          },
        },
        result: {
          contributionMarginPerUnit: result.contributionMarginPerUnit,
          contributionMarginRatio:   result.contributionMarginRatio,
          breakEvenUnits:            result.breakEvenUnits,
          breakEvenRevenue:          result.breakEvenRevenue,
          marginOfSafetyPct:         result.marginOfSafetyPct,
          netProfit:                 result.netProfit,
          operatingLeverage:         result.operatingLeverage,
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

  // ── PDF ────────────────────────────────────────────────────────────────────
  async function handlePdfExport() {
    setPdfLoading(true);
    try {
      await generateProjectFeasibilityPDFReport({
        result,
        projectName,
        sector: sector ?? undefined,
        managerName,
        institutionName,
      });
      setPdfOpen(false);
    } catch (err) {
      console.error("PDF error:", err);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Situational Analysis ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          {t("Analyse de Viabilité du Projet", "تحليل جدوى المشروع")}
        </h2>
        <div className={cn(
          "rounded-lg border border-primary/20 bg-primary/5 px-5 py-4 space-y-3 text-sm leading-relaxed text-foreground",
          isAr && "text-right"
        )}>
          <p>{para1}</p>
          {para2 && (
            <p className={cn(
              result.marginOfSafetyPct !== undefined && result.marginOfSafetyPct < 10
                ? "font-medium text-destructive/90"
                : result.marginOfSafetyPct !== undefined && result.marginOfSafetyPct < 25
                ? "text-amber-700"
                : "text-muted-foreground"
            )}>{para2}</p>
          )}
          <p className={cn(
            cmr < 30 ? "font-medium text-destructive/90"
            : cmr < 50 ? "text-amber-700"
            : "text-muted-foreground"
          )}>{para3}</p>
          {para4 && <p>{para4}</p>}
        </div>
      </div>

      {/* ── Go/No-Go Suggestions ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          {t("Recommandations avant lancement", "توصيات ما قبل إطلاق المشروع")}
        </h2>
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-lg border-l-4 px-4 py-3",
                s.color, s.borderColor
              )}
            >
              <span className="text-lg shrink-0 mt-0.5">{s.icon}</span>
              <div className="space-y-1">
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Managerial Report Card ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          {t("Rapport de Faisabilité", "تقرير الجدوى")}
        </h2>
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg font-bold">
                  {projectName || inp.productName || t("Faisabilité Projet", "جدوى المشروع")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t(
                    "Analyse de Seuil de Rentabilité — Faisabilité de Projet",
                    "تحليل نقطة التعادل — جدوى المشروع"
                  )}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge className="bg-primary/10 text-primary border-primary/30">
                  {fmtN(bepU, 1)} {t("u. seuil projet", "وحدة تعادل")}
                </Badge>
                <Badge variant="outline">
                  {fmtN(cmr, 1)} % CM
                </Badge>
                {result.marginOfSafetyPct !== undefined && (
                  <Badge
                    className={cn(
                      result.marginOfSafetyPct >= 20
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-amber-100 text-amber-800 border-amber-300"
                    )}
                  >
                    MoS {fmtN(result.marginOfSafetyPct, 1)} %
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: t("Seuil du projet (unités)", "نقطة تعادل المشروع (وحدات)"),  value: `${fmtN(bepU, 1)} unités` },
                { label: t("Seuil du projet (CA)",     "نقطة تعادل المشروع (CA)"),     value: fmtDA(bepR) },
                { label: t("CM / unité",               "هامش المساهمة / وحدة"),        value: fmtDA(cm) },
                { label: t("Taux CM",                  "نسبة هامش المساهمة"),          value: `${fmtN(cmr, 2)} %` },
                { label: t("Charges fixes projet",     "أعباء المشروع الثابتة"),       value: fmtDA(inp.fixedCosts) },
                { label: t("Coût variable / unité",    "التكلفة المتغيرة / وحدة"),     value: fmtDA(inp.variableCost) },
                ...(result.targetProfitUnits !== undefined ? [
                  { label: t("Unités (bénéfice cible)", "وحدات لتحقيق الهدف"),         value: `${fmtN(result.targetProfitUnits, 1)} unités` },
                ] : []),
                ...(result.marginOfSafetyPct !== undefined ? [
                  { label: t("Marge de sécurité",     "هامش الأمان"),                  value: `${fmtN(result.marginOfSafetyPct, 1)} %` },
                  { label: t("Bénéfice net prévu",    "الربح الصافي المتوقع"),          value: fmtDA(result.netProfit) },
                ] : []),
                ...(result.operatingLeverage !== undefined ? [
                  { label: t("Levier opérationnel",   "الرافعة التشغيلية"),            value: `× ${fmtN(result.operatingLeverage, 2)}` },
                ] : []),
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-base font-bold mt-0.5">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Fixed cost bar — project commitment context */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("Répartition des coûts au seuil du projet", "هيكل تكاليف المشروع عند نقطة التعادل")}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-32 shrink-0">
                  {t("Charges fixes", "أعباء ثابتة")}
                </span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, (inp.fixedCosts / bepR) * 100).toFixed(1)}%` }}
                  />
                </div>
                <span className="font-mono font-medium w-12 text-right">
                  {fmtN((inp.fixedCosts / bepR) * 100, 1)}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-32 shrink-0">
                  {t("Coûts variables", "تكاليف متغيرة")}
                </span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-secondary rounded-full"
                    style={{ width: `${Math.min(100, (inp.variableCost * bepU / bepR) * 100).toFixed(1)}%` }}
                  />
                </div>
                <span className="font-mono font-medium w-12 text-right">
                  {fmtN((inp.variableCost * bepU / bepR) * 100, 1)}%
                </span>
              </div>
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
                {t("Exporter rapport PDF", "تصدير تقرير PDF")}
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

      {/* ── PDF Export Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t("Exporter le rapport de faisabilité", "تصدير تقرير الجدوى")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Ajoutez des informations optionnelles au rapport avant de le générer.",
                "أضف معلومات اختيارية للتقرير قبل توليده."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("Nom du responsable du projet (optionnel)", "اسم مسؤول المشروع (اختياري)")}</Label>
              <Input
                placeholder={t("Ex: M. Amrane Khalil", "مثال: السيد أمران خليل")}
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Nom de l'organisation / promoteur (optionnel)", "اسم المؤسسة / صاحب المشروع (اختياري)")}</Label>
              <Input
                placeholder={t("Ex: SARL Invest Annaba", "مثال: ش.ذ.م.م استثمار عنابة")}
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button onClick={handlePdfExport} disabled={pdfLoading} className="flex-1">
                {pdfLoading
                  ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t("Génération…", "جارٍ التوليد…")}</>
                  : <><Download className="w-4 h-4 me-2" />{t("Télécharger le PDF", "تحميل PDF")}</>}
              </Button>
              <Button variant="outline" onClick={() => setPdfOpen(false)}>
                {t("Annuler", "إلغاء")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
