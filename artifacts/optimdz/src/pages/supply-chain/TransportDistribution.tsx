// ── Transport & Distribution — Supply-Chain Sub-Module ──────────────────────
// Self-contained 4-step flow reusing transport algorithms without duplication.
// مستودعات/مصانع = sources  |  عملاء/نقاط بيع = destinations

import { useState, useMemo, useRef } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTransportHistory } from "@/lib/TransportHistoryContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  Truck, Factory, ShoppingBag, Leaf, Users, PenLine,
  Plus, Trash2, ChevronLeft, ChevronRight, ArrowRight, RotateCcw,
  AlertTriangle, CheckCircle2, Info, Zap, Download, BookmarkPlus,
  BarChart3, Lightbulb, Check, Loader2, Package, MapPin,
  TrendingDown, TrendingUp, Warehouse,
} from "lucide-react";

// ── Algorithm imports (reused, not duplicated) ────────────────────────────────
import {
  solveNWC, solveLCM, solveVAM, METHOD_META,
  type MethodKey, type SolveResult,
} from "@/lib/transportAlgorithms";
import { TEMPLATES } from "@/pages/transportation/Solve";
import { runMODI, type MODIResult, type MODIIteration } from "@/lib/modiAlgorithm";
import { generateTransportPDF } from "@/lib/generateTransportPDF";
import type { TransportSectorKey } from "@/lib/TransportHistoryContext";

// ── Types ─────────────────────────────────────────────────────────────────────
type Step = "sector" | "input" | "initial" | "optimize";
type OptimizeTab = "modi" | "analysis";
type SectorKey = "industry" | "trade" | "services" | "agriculture" | "custom";

interface Source { name: string; supply: number; }
interface Destination { name: string; demand: number; }

// ── SC sector cards ───────────────────────────────────────────────────────────
const SC_SECTORS = [
  {
    key: "trade" as SectorKey,
    Icon: ShoppingBag,
    nameFr: "Commerce & Distribution",
    nameAr: "تجارة وتوزيع",
    descFr: "Entrepôts régionaux vers points de vente et détaillants.",
    descAr: "مستودعات إقليمية إلى نقاط البيع والتجزئة.",
    routeFr: "2 entrepôts → 4 points de vente",
    routeAr: "مستودعان → 4 نقاط بيع",
    color: "border-amber-200 hover:border-amber-400 hover:bg-amber-50/60",
    iconBg: "bg-amber-100 text-amber-700",
  },
  {
    key: "industry" as SectorKey,
    Icon: Factory,
    nameFr: "Industrie & Logistique",
    nameAr: "صناعة ولوجستيك",
    descFr: "Usines de production vers centres de distribution clients.",
    descAr: "مصانع الإنتاج إلى مراكز توزيع العملاء.",
    routeFr: "3 usines → 4 clients",
    routeAr: "3 مصانع → 4 عملاء",
    color: "border-blue-200 hover:border-blue-400 hover:bg-blue-50/60",
    iconBg: "bg-blue-100 text-blue-700",
  },
  {
    key: "agriculture" as SectorKey,
    Icon: Leaf,
    nameFr: "Agriculture & Marchés",
    nameAr: "فلاحة وأسواق",
    descFr: "Fermes et coopératives vers marchés de gros régionaux.",
    descAr: "مزارع وتعاونيات إلى أسواق الجملة الإقليمية.",
    routeFr: "3 fermes → 4 marchés de gros",
    routeAr: "3 مزارع → 4 أسواق جملة",
    color: "border-green-200 hover:border-green-400 hover:bg-green-50/60",
    iconBg: "bg-green-100 text-green-700",
  },
  {
    key: "services" as SectorKey,
    Icon: Users,
    nameFr: "Services & Livraison",
    nameAr: "خدمات وتوصيل",
    descFr: "Hubs logistiques vers zones de clientèle déséquilibrées.",
    descAr: "مراكز لوجستية إلى مناطق عملاء غير متوازنة.",
    routeFr: "2 hubs → 5 zones clients",
    routeAr: "مركزان → 5 مناطق عملاء",
    color: "border-purple-200 hover:border-purple-400 hover:bg-purple-50/60",
    iconBg: "bg-purple-100 text-purple-700",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number, lang: string, d = 0): string {
  if (!isFinite(n)) return "∞";
  return n.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
}

const blank = <T,>(n: number, factory: (i: number) => T): T[] =>
  Array.from({ length: n }, (_, i) => factory(i));

// ── SC analysis generators ────────────────────────────────────────────────────

interface SCAnalysisLine { text: string; }
interface SCRecommendation {
  icon: string;
  titleFr: string;
  titleAr: string;
  descFr: string;
  descAr: string;
  priority: "high" | "medium" | "low";
}

function buildSCAnalysis(modiResult: MODIResult, initialCost: number, lang: string): SCAnalysisLine[] {
  const t = (fr: string, ar: string) => (lang === "ar" ? ar : fr);
  const { balanced, finalCost, sensitivityRanges } = modiResult;
  const epsilonSet = new Set(modiResult.epsilonCells.map(c => `${c.i},${c.j}`));
  const improvement = initialCost > 0 ? ((initialCost - finalCost) / initialCost) * 100 : 0;
  const lines: SCAnalysisLine[] = [];

  // 1. Overall savings
  if (improvement > 0.1) {
    lines.push({
      text: t(
        `L'optimisation MODI réduit les coûts logistiques de ${improvement.toFixed(1)}% par rapport à la solution heuristique initiale, soit une économie de ${fmt(initialCost - finalCost, lang)} DZD sur un coût total optimal de ${fmt(finalCost, lang)} DZD.`,
        `خفّض تحسين MODI التكاليف اللوجستية بنسبة ${improvement.toFixed(1)}% مقارنة بالحل الأولي، بتوفير ${fmt(initialCost - finalCost, lang)} دج من تكلفة إجمالية مثلى تبلغ ${fmt(finalCost, lang)} دج.`
      ),
    });
  } else {
    lines.push({
      text: t(
        `La méthode heuristique initiale a produit une solution déjà optimale — coût total : ${fmt(finalCost, lang)} DZD. Aucun réacheminement ne peut réduire davantage les coûts logistiques.`,
        `أنتجت الطريقة الأولية حلاً مثالياً بالفعل — التكلفة الإجمالية: ${fmt(finalCost, lang)} دج. لا يمكن لأي إعادة توجيه تقليل التكاليف اللوجستية أكثر.`
      ),
    });
  }

  // 2. Top cost-driver route
  const activeRoutes = sensitivityRanges
    .filter(r => r.allocation > 0 && !epsilonSet.has(`${r.i},${r.j}`))
    .sort((a, b) => (b.allocation * b.unitCost) - (a.allocation * a.unitCost));

  if (activeRoutes.length > 0 && finalCost > 0) {
    const top = activeRoutes[0];
    const topTotal = top.allocation * top.unitCost;
    const pct = Math.round((topTotal / finalCost) * 100);
    lines.push({
      text: t(
        `Le trajet ${top.sourceName} → ${top.destName} est le principal moteur de coût, concentrant ${pct}% des charges logistiques totales (${fmt(topTotal, lang)} DZD pour ${fmt(top.allocation, lang)} unités à ${top.unitCost} DZD/u).`,
        `يُعدّ المسار ${top.sourceName} → ${top.destName} المحرّك الرئيسي للتكاليف، إذ يستأثر بـ ${pct}% من إجمالي الأعباء اللوجستية (${fmt(topTotal, lang)} دج لـ ${fmt(top.allocation, lang)} وحدة بـ${top.unitCost} دج/وحدة).`
      ),
    });

    // Highest unit-cost active route (if different)
    const mostExpensive = [...activeRoutes].sort((a, b) => b.unitCost - a.unitCost)[0];
    if (mostExpensive && mostExpensive !== top) {
      lines.push({
        text: t(
          `Le trajet ${mostExpensive.sourceName} → ${mostExpensive.destName} affiche le coût unitaire le plus élevé (${mostExpensive.unitCost} DZD/u) — une négociation tarifaire avec le transporteur pourrait réduire le coût global.`,
          `يسجّل المسار ${mostExpensive.sourceName} → ${mostExpensive.destName} أعلى تكلفة وحدوية (${mostExpensive.unitCost} دج/وحدة) — قد تؤدي مفاوضة الناقل إلى خفض التكلفة الإجمالية.`
        ),
      });
    }
  }

  // 3. Balance status
  if (balanced.dummySourceIndex !== null) {
    const dummySupply = balanced.sources[balanced.dummySourceIndex]?.supply ?? 0;
    lines.push({
      text: t(
        `Déséquilibre offre-demande détecté : la demande client dépasse la capacité disponible de ${fmt(dummySupply, lang)} unités. Une source fictive a été ajoutée automatiquement — ${fmt(dummySupply, lang)} unités restent non satisfaites.`,
        `تم اكتشاف عدم توازن بين العرض والطلب: يتجاوز طلب العملاء الطاقة المتاحة بـ ${fmt(dummySupply, lang)} وحدة. تمت إضافة مصدر وهمي تلقائياً — تبقى ${fmt(dummySupply, lang)} وحدة غير مُلبَّاة.`
      ),
    });
  } else if (balanced.dummyDestIndex !== null) {
    const dummyDemand = balanced.destinations[balanced.dummyDestIndex]?.demand ?? 0;
    lines.push({
      text: t(
        `Déséquilibre offre-demande détecté : la capacité des entrepôts dépasse la demande de ${fmt(dummyDemand, lang)} unités. Une destination fictive a été ajoutée — ${fmt(dummyDemand, lang)} unités restent en stock non distribué.`,
        `تم اكتشاف عدم توازن: تتجاوز طاقة المستودعات الطلب بـ ${fmt(dummyDemand, lang)} وحدة. تمت إضافة وجهة وهمية — تبقى ${fmt(dummyDemand, lang)} وحدة في مخزون غير موزَّع.`
      ),
    });
  } else {
    lines.push({
      text: t(
        "Le réseau de distribution est parfaitement équilibré : la capacité totale des entrepôts correspond exactement à la demande agrégée des clients. Zéro gaspillage de capacité.",
        "شبكة التوزيع متوازنة تماماً: تتطابق الطاقة الإجمالية للمستودعات مع الطلب المجمَّع للعملاء. صفر هدر في الطاقة."
      ),
    });
  }

  // 4. Route utilization
  const rawM = balanced.dummySourceIndex !== null ? balanced.sources.length - 1 : balanced.sources.length;
  const rawN = balanced.dummyDestIndex   !== null ? balanced.destinations.length - 1 : balanced.destinations.length;
  const totalPossible = rawM * rawN;
  const activeCount = activeRoutes.length;
  if (activeCount > 0 && totalPossible > 0) {
    const utilPct = Math.round((activeCount / totalPossible) * 100);
    lines.push({
      text: t(
        `${activeCount} trajet${activeCount > 1 ? "s actifs" : " actif"} sur ${totalPossible} possibles (${utilPct}% du réseau utilisé). Un réseau logistique concentré réduit les coûts de coordination et facilite le suivi des livraisons.`,
        `${activeCount} مسار${activeCount > 1 ? " نشط" : " نشط"} من أصل ${totalPossible} ممكناً (${utilPct}% من الشبكة مستخدمة). تُسهّل الشبكة اللوجستية المركّزة تقليل تكاليف التنسيق ومتابعة التسليمات.`
      ),
    });
  }

  return lines;
}

function buildSCRecommendations(
  modiResult: MODIResult,
  initialCost: number,
  lang: string
): SCRecommendation[] {
  const { balanced, sensitivityRanges, hasAlternativeOptima, finalCost } = modiResult;
  const epsilonSet = new Set(modiResult.epsilonCells.map(c => `${c.i},${c.j}`));
  const improvement = initialCost > 0 ? ((initialCost - finalCost) / initialCost) * 100 : 0;
  const recs: SCRecommendation[] = [];

  const activeRoutes = sensitivityRanges
    .filter(r => r.allocation > 0 && !epsilonSet.has(`${r.i},${r.j}`));

  // 1. Implement optimal plan
  if (improvement > 0.1) {
    recs.push({
      icon: "🚚",
      priority: "high",
      titleFr: "Déployer immédiatement le plan de distribution optimal",
      titleAr: "تطبيق خطة التوزيع المثلى فوراً",
      descFr: `Le plan MODI économise ${fmt(initialCost - finalCost, lang)} DZD (${improvement.toFixed(1)}%) par rapport à la méthode heuristique. Transmettez le plan révisé aux équipes transport et planifiez le réacheminement dès la prochaine campagne de livraison.`,
      descAr: `توفّر خطة MODI مبلغ ${fmt(initialCost - finalCost, lang)} دج (${improvement.toFixed(1)}%) مقارنة بالطريقة الأولية. وزّع الخطة المحدّثة على فِرَق النقل وخطّط لإعادة التوجيه منذ حملة التسليم القادمة.`,
    });
  }

  // 2. Renegotiate most expensive route
  const mostExpensive = [...activeRoutes].sort((a, b) => b.unitCost - a.unitCost)[0];
  if (mostExpensive && mostExpensive.unitCost > 0) {
    const allowedInc = mostExpensive.allowedIncrease === Infinity
      ? null
      : mostExpensive.allowedIncrease;
    recs.push({
      icon: "💰",
      priority: "high",
      titleFr: `Renégocier le contrat de transport ${mostExpensive.sourceName} → ${mostExpensive.destName}`,
      titleAr: `إعادة التفاوض على عقد النقل ${mostExpensive.sourceName} → ${mostExpensive.destName}`,
      descFr: `Ce trajet affiche le coût unitaire le plus élevé (${mostExpensive.unitCost} DZD/u).${allowedInc !== null ? ` La solution reste optimale jusqu'à ${fmt(mostExpensive.unitCost + allowedInc, lang, 1)} DZD/u.` : ""} Sollicitez plusieurs transporteurs concurrents ou envisagez un transport groupé pour réduire ce poste.`,
      descAr: `يسجّل هذا المسار أعلى تكلفة وحدوية (${mostExpensive.unitCost} دج/وحدة).${allowedInc !== null ? ` يبقى الحل مثالياً حتى ${fmt(mostExpensive.unitCost + allowedInc, lang, 1)} دج/وحدة.` : ""} استعرض عروض ناقلين متعددين أو فكّر في الشحن الجماعي لخفض هذا البند.`,
    });
  }

  // 3. Balance-specific recommendation
  if (balanced.dummySourceIndex !== null) {
    const dummySupply = balanced.sources[balanced.dummySourceIndex]?.supply ?? 0;
    recs.push({
      icon: "🏭",
      priority: "medium",
      titleFr: "Augmenter la capacité de stockage ou diversifier les fournisseurs",
      titleAr: "زيادة طاقة التخزين أو تنويع الموردين",
      descFr: `${fmt(dummySupply, lang)} unités de demande client ne peuvent être satisfaites. Évaluez l'ouverture d'un nouvel entrepôt, l'expansion d'une ligne de production ou la sous-traitance à un prestataire logistique tiers (3PL).`,
      descAr: `${fmt(dummySupply, lang)} وحدة من طلب العملاء لا يمكن تلبيتها. قيّم فتح مستودع جديد أو توسيع خط إنتاج أو التعاقد مع مزود لوجستي خارجي (3PL).`,
    });
  } else if (balanced.dummyDestIndex !== null) {
    const dummyDemand = balanced.destinations[balanced.dummyDestIndex]?.demand ?? 0;
    recs.push({
      icon: "📊",
      priority: "medium",
      titleFr: "Réduire la surproduction ou prospecter de nouveaux marchés",
      titleAr: "تقليص الإنتاج الزائد أو التنقيب عن أسواق جديدة",
      descFr: `${fmt(dummyDemand, lang)} unités resteront en stock non distribué. Adaptez les niveaux de production à la demande réelle ou développez de nouveaux segments clients pour absorber l'excédent et réduire les coûts de détention.`,
      descAr: `${fmt(dummyDemand, lang)} وحدة ستبقى في مخزون غير موزَّع. اضبط مستويات الإنتاج على الطلب الفعلي أو طوّر شرائح عملاء جديدة لامتصاص الفائض وتخفيض تكاليف الاحتفاظ.`,
    });
  }

  // 4. Consolidation (many active routes)
  if (activeRoutes.length > 4) {
    recs.push({
      icon: "📦",
      priority: "medium",
      titleFr: "Consolider les expéditions et créer des points de regroupement",
      titleAr: "توحيد الشحنات وإنشاء نقاط تجميع",
      descFr: `${activeRoutes.length} routes actives génèrent des coûts de coordination élevés (suivi, documentation, interfaces). Envisagez des plateformes de groupage ou des tournées mutualisées pour réduire la complexité opérationnelle.`,
      descAr: `${activeRoutes.length} مسارات نشطة تُولّد تكاليف تنسيق مرتفعة (متابعة، توثيق، واجهات). فكّر في منصات التجميع أو الجولات المشتركة لتخفيض التعقيد التشغيلي.`,
    });
  }

  // 5. Alternative optima → route flexibility
  if (hasAlternativeOptima) {
    recs.push({
      icon: "↔️",
      priority: "low",
      titleFr: "Exploiter la flexibilité des solutions équivalentes pour d'autres critères",
      titleAr: "استغلال مرونة الحلول المتكافئة لمعايير أخرى",
      descFr: `Des plans de distribution alternatifs existent au même coût optimal. Utilisez cette flexibilité pour choisir selon des critères secondaires : délais de livraison, fiabilité des transporteurs, réduction de l'empreinte carbone ou contraintes contractuelles existantes.`,
      descAr: `توجد خطط توزيع بديلة بنفس التكلفة المثلى. استغل هذه المرونة للاختيار وفق معايير ثانوية: مواعيد التسليم، موثوقية الناقلين، تقليص البصمة الكربونية، أو القيود التعاقدية القائمة.`,
    });
  }

  return recs;
}

// ── Stage progress bar ────────────────────────────────────────────────────────
function StageBar({ current, onBack }: { current: 1 | 2 | 3 | 4; onBack: () => void }) {
  const { t } = useLanguage();
  const stages = [
    { n: 1 as const, fr: "Secteur",        ar: "القطاع" },
    { n: 2 as const, fr: "Données",        ar: "البيانات" },
    { n: 3 as const, fr: "Sol. initiale",  ar: "الحل الأولي" },
    { n: 4 as const, fr: "Optimisation",   ar: "التحسين" },
  ];

  return (
    <div className="flex items-center gap-0 text-sm select-none overflow-x-auto pb-1">
      {stages.map((s, idx) => {
        const done   = s.n < current;
        const active = s.n === current;
        const locked = s.n > current;
        return (
          <div key={s.n} className="flex items-center shrink-0">
            {idx > 0 && (
              <div className={cn("h-px w-6 mx-1", done || active ? "bg-primary" : "bg-border")} />
            )}
            <button
              type="button"
              onClick={done ? onBack : undefined}
              disabled={locked}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors text-xs",
                done   && "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20",
                active && "bg-primary text-primary-foreground shadow",
                locked && "text-muted-foreground cursor-not-allowed opacity-50"
              )}
            >
              {done   && <CheckCircle2 className="w-3 h-3" />}
              {active && <span className="font-bold">{s.n}</span>}
              {locked && <span className="text-[10px]">{s.n}</span>}
              <span>{t(s.fr, s.ar)}</span>
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onBack}
        className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <ChevronLeft className="w-3 h-3" />
        {t("Retour", "رجوع")}
      </button>
    </div>
  );
}

// ── Step 1 — Sector selection ──────────────────────────────────────────────────
interface SectorStepProps {
  onSelect: (key: SectorKey) => void;
}
function SectorStep({ onSelect }: SectorStepProps) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-primary text-primary-foreground rounded-xl p-7 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 bg-primary-foreground/15 rounded-full px-4 py-1.5 text-sm font-medium mb-4 w-fit">
            <Truck className="w-4 h-4" />
            {t("النقل والتوزيع — سلاسل الإمداد", "Transport & Distribution — Chaîne d'Approvisionnement")}
          </div>
          <h1 className="text-3xl font-bold mb-3 leading-tight">
            {t("تحسين شبكة التوزيع اللوجستي", "Optimisation du Réseau de Distribution Logistique")}
          </h1>
          <p className="text-primary-foreground/80 text-base leading-relaxed">
            {t(
              "حدّد طاقات مستودعاتك ومصانعك، وحجم طلب عملائك ونقاط بيعك، وتكاليف النقل — واحصل على خطة التوزيع المثلى بطريقة MODI.",
              "Définissez les capacités de vos entrepôts/usines, les demandes de vos clients/points de vente et les coûts de transport — obtenez le plan de distribution optimal via MODI."
            )}
          </p>
        </div>
        <div className="absolute -right-16 -bottom-16 opacity-10 pointer-events-none">
          <Truck className="w-64 h-64" />
        </div>
      </div>

      {/* Sector cards */}
      <div>
        <h2 className="text-lg font-bold mb-1">
          {t("اختر نوع الشبكة اللوجستية", "Choisissez le type de réseau logistique")}
        </h2>
        <p className="text-muted-foreground text-sm mb-4">
          {t(
            "اختر نموذجاً مُعبَّأً مسبقاً ببيانات جزائرية واقعية أو ابدأ من الصفر.",
            "Sélectionnez un modèle pré-rempli avec des données algériennes réalistes, ou commencez de zéro."
          )}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SC_SECTORS.map(s => {
            const Icon = s.Icon;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onSelect(s.key)}
                className={cn(
                  "group relative flex flex-col gap-3 rounded-xl border-2 bg-card p-5 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md text-start",
                  s.color
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("rounded-xl p-2.5 shrink-0", s.iconBg)}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-foreground text-base">{isAr ? s.nameAr : s.nameFr}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{isAr ? s.nameFr : s.nameAr}</div>
                  </div>
                  <ChevronRight className={cn("w-4 h-4 text-muted-foreground mt-1 shrink-0 transition-transform group-hover:translate-x-1", isAr && "rotate-180")} />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{isAr ? s.descAr : s.descFr}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t pt-2">
                  <MapPin className="w-3 h-3" />
                  {isAr ? s.routeAr : s.routeFr}
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom */}
        <button
          type="button"
          onClick={() => onSelect("custom")}
          className={cn(
            "group mt-4 w-full flex items-center gap-4 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-5 transition-all duration-200 hover:border-muted-foreground/60 hover:bg-muted/50",
            isAr ? "flex-row-reverse text-right" : "text-left"
          )}
        >
          <div className="rounded-xl bg-muted p-3 text-muted-foreground shrink-0">
            <PenLine className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">{t("ابدأ من الصفر", "Commencer de zéro")}</p>
            <p className="text-sm text-muted-foreground">{t("أدخل بياناتك الخاصة — مستودعاتك وعملاؤك وتكاليفك.", "Saisissez vos propres données — entrepôts, clients et coûts.")}</p>
          </div>
          <ArrowRight className={cn("w-4 h-4 text-muted-foreground shrink-0", isAr && "rotate-180")} />
        </button>
      </div>
    </div>
  );
}

// ── Step 2 — Matrix input ──────────────────────────────────────────────────────
interface InputStepProps {
  sector: SectorKey;
  name: string; setName: (v: string) => void;
  objectiveType: "minimize" | "maximize"; setObjectiveType: (v: "minimize" | "maximize") => void;
  sources: Source[]; setSources: (fn: (prev: Source[]) => Source[]) => void;
  destinations: Destination[]; setDestinations: (fn: (prev: Destination[]) => Destination[]) => void;
  costs: number[][]; setCosts: (fn: (prev: number[][]) => number[][]) => void;
  onBack: () => void;
  onContinue: () => void;
}
function InputStep({
  sector, name, setName, objectiveType, setObjectiveType,
  sources, setSources, destinations, setDestinations, costs, setCosts,
  onBack, onContinue,
}: InputStepProps) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const totalSupply = sources.reduce((s, r) => s + (r.supply || 0), 0);
  const totalDemand = destinations.reduce((s, d) => s + (d.demand || 0), 0);
  const diff = totalSupply - totalDemand;

  // Source CRUD
  const addSource = () => {
    setSources(p => [...p, { name: "", supply: 0 }]);
    setCosts(p => [...p, Array(destinations.length).fill(0)]);
  };
  const removeSource = (i: number) => {
    if (sources.length <= 1) return;
    setSources(p => p.filter((_, idx) => idx !== i));
    setCosts(p => p.filter((_, idx) => idx !== i));
  };
  const updateSource = (i: number, field: keyof Source, value: string | number) => {
    setSources(p => p.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  // Destination CRUD
  const addDest = () => {
    setDestinations(p => [...p, { name: "", demand: 0 }]);
    setCosts(p => p.map(row => [...row, 0]));
  };
  const removeDest = (j: number) => {
    if (destinations.length <= 1) return;
    setDestinations(p => p.filter((_, idx) => idx !== j));
    setCosts(p => p.map(row => row.filter((_, idx) => idx !== j)));
  };
  const updateDest = (j: number, field: keyof Destination, value: string | number) => {
    setDestinations(p => p.map((d, idx) => idx === j ? { ...d, [field]: value } : d));
  };
  const updateCost = (i: number, j: number, value: number) => {
    setCosts(p => p.map((row, ri) => ri === i ? row.map((c, ci) => ci === j ? value : c) : row));
  };

  function validate() {
    const errs: Record<string, string> = {};
    sources.forEach((s, i) => {
      if (!s.name.trim()) errs[`sn${i}`] = t("Nom requis", "الاسم مطلوب");
      if (s.supply <= 0) errs[`ss${i}`] = t("Capacité > 0", "الطاقة > 0");
    });
    destinations.forEach((d, j) => {
      if (!d.name.trim()) errs[`dn${j}`] = t("Nom requis", "الاسم مطلوب");
      if (d.demand <= 0) errs[`dd${j}`] = t("Demande > 0", "الطلب > 0");
    });
    return errs;
  }

  function handleContinue() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast({ variant: "destructive", title: t("Erreurs de saisie", "أخطاء في الإدخال"), description: t("Corrigez les champs en rouge.", "صحّح الحقول المحددة.") });
      return;
    }
    setErrors({});
    onContinue();
  }

  const srcLabel = t("Entrepôt / Usine", "مستودع / مصنع");
  const dstLabel = t("Client / Point de vente", "عميل / نقطة بيع");

  return (
    <div className="space-y-5">
      {/* General info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("Informations Générales", "معلومات عامة")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("Nom du projet de distribution", "اسم مشروع التوزيع")}</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t("Ex: Distribution Régionale Q3 2026", "مثال: توزيع إقليمي الربع الثالث 2026")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("Objectif", "الهدف")}</Label>
            <RadioGroup value={objectiveType} onValueChange={(v: "minimize" | "maximize") => setObjectiveType(v)} className="flex gap-5 pt-1">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="minimize" id="obj-min" />
                <Label htmlFor="obj-min" className="cursor-pointer font-normal">{t("Minimiser les coûts", "تقليل التكاليف")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="maximize" id="obj-max" />
                <Label htmlFor="obj-max" className="cursor-pointer font-normal">{t("Maximiser les profits", "تعظيم الأرباح")}</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Cost matrix */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="w-4 h-4 text-primary" />
              {t("Matrice des Coûts de Transport", "مصفوفة تكاليف النقل")}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              {t(
                `Lignes = ${srcLabel}s (offre/capacité) · Colonnes = ${dstLabel}s (demande) · Cellules = coût unitaire de transport`,
                `الصفوف = ${srcLabel} (العرض/الطاقة) · الأعمدة = ${dstLabel} (الطلب) · الخلايا = التكلفة الوحدوية للنقل`
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button type="button" size="sm" variant="outline" onClick={addDest}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              {t("Client", "عميل")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={addSource}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              {t("Entrepôt", "مستودع")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 overflow-x-auto">
          <table className="border-collapse text-sm" style={{ minWidth: Math.max(400, 160 + destinations.length * 110 + 100) }}>
            <thead>
              <tr>
                <th className="sticky start-0 z-10 bg-muted px-3 py-2 border-b border-e border-border text-start min-w-[150px]">
                  <span className="text-xs text-muted-foreground font-semibold">{srcLabel}</span>
                </th>
                {destinations.map((d, j) => (
                  <th key={j} className="px-1 py-1 border-b border-e border-border bg-muted min-w-[100px]">
                    <div className="space-y-1 px-1">
                      <Input
                        value={d.name}
                        onChange={e => updateDest(j, "name", e.target.value)}
                        placeholder={`${t("عميل", "Client")} ${j + 1}`}
                        className={cn("h-7 text-xs text-center", errors[`dn${j}`] && "border-destructive")}
                      />
                      <div className="flex items-center gap-1">
                        <Input
                          type="number" min={0}
                          value={d.demand || ""}
                          onChange={e => updateDest(j, "demand", Number(e.target.value))}
                          placeholder={t("طلب", "dem.")}
                          className={cn("h-7 text-xs text-center", errors[`dd${j}`] && "border-destructive")}
                        />
                        <button type="button" onClick={() => removeDest(j)} disabled={destinations.length <= 1} className="text-muted-foreground hover:text-destructive p-0.5 disabled:opacity-30">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 border-b border-border bg-primary/10 text-center text-xs font-bold text-primary min-w-[80px]">
                  {t("Offre", "العرض")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="sticky start-0 z-10 bg-inherit px-2 py-1 border-b border-e border-border">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                        <Input
                          value={s.name}
                          onChange={e => updateSource(i, "name", e.target.value)}
                          placeholder={`${t("مستودع", "Entrepôt")} ${i + 1}`}
                          className={cn("h-7 text-xs flex-1 min-w-[100px]", errors[`sn${i}`] && "border-destructive")}
                        />
                      </div>
                    </div>
                  </td>
                  {destinations.map((_, j) => (
                    <td key={j} className="px-1 py-1 border-b border-e border-border">
                      <Input
                        type="number" min={0}
                        value={costs[i]?.[j] ?? 0}
                        onChange={e => updateCost(i, j, Number(e.target.value))}
                        className="h-8 text-xs text-center w-full"
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1 border-b border-border text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <Input
                        type="number" min={0}
                        value={s.supply || ""}
                        onChange={e => updateSource(i, "supply", Number(e.target.value))}
                        className={cn("h-8 text-xs text-center w-20", errors[`ss${i}`] && "border-destructive")}
                      />
                      <button type="button" onClick={() => removeSource(i)} disabled={sources.length <= 1} className="text-muted-foreground hover:text-destructive p-0.5 disabled:opacity-30">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-primary/5">
                <td className="sticky start-0 z-10 bg-primary/5 px-3 py-2 border-t border-e border-border">
                  <span className="text-xs font-bold text-primary">{t("Demande", "الطلب")}</span>
                </td>
                {destinations.map((d, j) => (
                  <td key={j} className="px-2 py-2 border-t border-e border-border text-center text-xs font-bold text-primary">
                    {d.demand.toLocaleString()}
                  </td>
                ))}
                <td className="px-3 py-2 border-t border-border text-center text-xs font-bold text-primary">
                  {totalSupply.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Balance indicator */}
      <div className={cn(
        "flex items-start gap-3 p-3 rounded-lg border text-sm",
        diff === 0
          ? "bg-green-50 border-green-200 text-green-800"
          : "bg-amber-50 border-amber-200 text-amber-800"
      )}>
        {diff === 0
          ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
          : <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />}
        <span>
          {diff === 0
            ? t("Réseau équilibré — offre totale = demande totale.", "شبكة متوازنة — إجمالي العرض = إجمالي الطلب.")
            : diff > 0
              ? t(`Offre (${totalSupply}) > Demande (${totalDemand}) — une destination fictive sera ajoutée automatiquement.`, `العرض (${totalSupply}) > الطلب (${totalDemand}) — ستُضاف وجهة وهمية تلقائياً.`)
              : t(`Demande (${totalDemand}) > Offre (${totalSupply}) — une source fictive sera ajoutée automatiquement.`, `الطلب (${totalDemand}) > العرض (${totalSupply}) — سيُضاف مصدر وهمي تلقائياً.`)
          }
        </span>
      </div>

      <div className="flex justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft className={cn("w-4 h-4 mr-1", isAr && "rotate-180")} />
          {t("تغيير القطاع", "Changer de secteur")}
        </Button>
        <Button type="button" onClick={handleContinue} size="lg" className="gap-2">
          {t("Calculer la solution initiale", "حساب الحل الأولي")}
          <ArrowRight className={cn("w-4 h-4", isAr && "rotate-180")} />
        </Button>
      </div>
    </div>
  );
}

// ── Step 3 — Initial solution selection ───────────────────────────────────────
interface InitialStepProps {
  results: Record<MethodKey, SolveResult>;
  objective: "minimize" | "maximize";
  selectedMethod: MethodKey;
  onSelectMethod: (m: MethodKey) => void;
  onBack: () => void;
  onContinue: () => void;
}
function InitialStep({ results, objective, selectedMethod, onSelectMethod, onBack, onContinue }: InitialStepProps) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const isMin = objective === "minimize";

  const bestMethod = (Object.keys(results) as MethodKey[]).reduce((prev, cur) =>
    isMin
      ? results[cur].totalCost < results[prev].totalCost ? cur : prev
      : results[cur].totalCost > results[prev].totalCost ? cur : prev
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">{t("Solution initiale", "الحل الأولي")}</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {t(
            "Trois méthodes heuristiques ont été calculées. Sélectionnez la meilleure base de départ pour l'optimisation MODI.",
            "تم حساب ثلاث طرق استدلالية. اختر أفضل نقطة انطلاق لتحسين MODI."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(["nwc", "lcm", "vam"] as MethodKey[]).map(mk => {
          const meta = METHOD_META[mk];
          const result = results[mk];
          const isBest = mk === bestMethod;
          const isSelected = mk === selectedMethod;

          return (
            <button
              key={mk}
              type="button"
              onClick={() => onSelectMethod(mk)}
              className={cn(
                "group relative flex flex-col gap-3 rounded-xl border-2 p-5 text-start transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md",
                isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : meta.color
              )}
            >
              {isBest && (
                <div className="absolute -top-2.5 end-4">
                  <Badge className="bg-green-600 text-white text-xs shadow">
                    {t("الأفضل ✓", "Meilleur ✓")}
                  </Badge>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className={cn("rounded-lg px-2.5 py-1 text-xs font-bold", meta.iconBg)}>
                  {meta.shortFr}
                </div>
                <span className="font-semibold text-foreground text-sm">{t(meta.labelAr, meta.labelFr)}</span>
                {isSelected && <Check className="w-4 h-4 text-primary ms-auto" />}
              </div>
              <div className={cn("rounded-lg p-3 text-center", isBest ? "bg-green-50" : "bg-muted/50")}>
                <div className="text-xs text-muted-foreground mb-0.5">
                  {isMin ? t("التكلفة الأولية", "Coût initial") : t("الربح الأولي", "Profit initial")}
                </div>
                <div className={cn("text-xl font-bold tabular-nums", isBest ? "text-green-700" : "text-foreground")}>
                  {result.totalCost.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {result.steps.filter(s => s.amount > 0).length} {t("تخصيصات", "allocations")}
                  {result.isDegenerate && <span className="ms-1 text-amber-600">⚠</span>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {t(meta.descAr, meta.descFr)}
              </p>
            </button>
          );
        })}
      </div>

      <Alert className="border-primary/20 bg-primary/5">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary text-sm">
          {t("الطريقة المختارة للتحسين", "Méthode sélectionnée pour l'optimisation")} : {t(METHOD_META[selectedMethod].labelAr, METHOD_META[selectedMethod].labelFr)}
        </AlertTitle>
        <AlertDescription className="text-muted-foreground text-xs">
          {t(
            `سيطبّق MODI التحسين التدريجي على هذا الحل الأولي للوصول إلى الخطة اللوجستية المثلى.`,
            `MODI appliquera une amélioration itérative sur cette solution initiale pour atteindre le plan logistique optimal.`
          )}
        </AlertDescription>
      </Alert>

      <div className="flex justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft className={cn("w-4 h-4 mr-1", isAr && "rotate-180")} />
          {t("تعديل البيانات", "Modifier les données")}
        </Button>
        <Button type="button" onClick={onContinue} size="lg" className="gap-2">
          <Zap className="w-4 h-4" />
          {t("تشغيل تحسين MODI", "Lancer l'optimisation MODI")}
          <ArrowRight className={cn("w-4 h-4", isAr && "rotate-180")} />
        </Button>
      </div>
    </div>
  );
}

// ── Step 4 — MODI Optimization + SC Analysis ──────────────────────────────────
interface OptimizeStepProps {
  modiResult: MODIResult;
  initialResult: SolveResult;
  selectedMethod: MethodKey;
  problemName: string;
  objective: "minimize" | "maximize";
  sector: SectorKey;
  onBack: () => void;
  onNewProblem: () => void;
}
function OptimizeStep({
  modiResult, initialResult, selectedMethod, problemName, objective, sector, onBack, onNewProblem,
}: OptimizeStepProps) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { addProblem } = useTransportHistory();
  const { toast } = useToast();

  const [tab, setTab] = useState<OptimizeTab>("modi");
  const [currentIter, setCurrentIter] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const isMin = objective === "minimize";
  const iters = modiResult.iterations;
  const iter = iters[Math.min(currentIter, iters.length - 1)];
  const isLast = currentIter >= iters.length - 1;

  const epsilonSet = new Set(modiResult.epsilonCells.map(c => `${c.i},${c.j}`));
  const activeRoutes = modiResult.sensitivityRanges
    .filter(r => r.allocation > 0 && !epsilonSet.has(`${r.i},${r.j}`))
    .sort((a, b) => (b.allocation * b.unitCost) - (a.allocation * a.unitCost));

  const improvement = initialResult.totalCost > 0
    ? ((initialResult.totalCost - modiResult.finalCost) / initialResult.totalCost) * 100
    : 0;

  // SC analysis (memoized)
  const analysisLines = useMemo(() =>
    buildSCAnalysis(modiResult, initialResult.totalCost, language),
    [modiResult, initialResult.totalCost, language]
  );
  const recommendations = useMemo(() =>
    buildSCRecommendations(modiResult, initialResult.totalCost, language),
    [modiResult, initialResult.totalCost, language]
  );

  function handleSave() {
    if (isSaved) return;
    // Build a synthetic TransportProblem for the history (mirrors the existing history schema)
    const problem = {
      name: problemName || t("توزيع — سلاسل الإمداد", "Distribution — Chaîne d'Approvisionnement"),
      sector,
      objectiveType: objective,
      sources: modiResult.balanced.sources.map((s, i) => ({
        name: s.name,
        supply: s.supply,
      })),
      destinations: modiResult.balanced.destinations.map(d => ({
        name: d.name,
        demand: d.demand,
      })),
      costs: modiResult.balanced.costs,
    };
    addProblem(problem, modiResult, initialResult.totalCost, (sector || "custom") as TransportSectorKey, language);
    setIsSaved(true);
    toast({ title: t("تم الحفظ في السجل ✓", "Enregistré dans l'historique ✓"), description: t("سلاسل الإمداد — النقل والتوزيع", "Chaîne d'approvisionnement — Transport & Distribution") });
  }

  async function handlePDF() {
    if (isExporting) return;
    setIsExporting(true);
    setExportMsg(t("جارٍ إنشاء PDF…", "Génération du PDF…"));
    const problem = {
      name: problemName || t("توزيع — سلاسل الإمداد", "Distribution — Chaîne d'Approvisionnement"),
      sector,
      objectiveType: objective,
      sources: modiResult.balanced.sources,
      destinations: modiResult.balanced.destinations,
      costs: modiResult.balanced.costs,
    };
    try {
      await generateTransportPDF({
        problem,
        modiResult,
        initialCost: initialResult.totalCost,
        managerName: "",
        institutionName: "",
        language,
        onProgress: (step) => setExportMsg(step),
      });
    } catch {
      setExportMsg(t("حدث خطأ أثناء التصدير.", "Erreur lors de l'export."));
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportMsg(null), 3000);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: t("التكلفة المثلى", "Coût optimal"),
            value: `${fmt(modiResult.finalCost, language)} DZD`,
            color: "text-green-700",
            bg: "bg-green-50 border-green-200",
            Icon: CheckCircle2,
            iconColor: "text-green-600",
          },
          {
            label: t("التكلفة الأولية", "Coût initial"),
            value: `${fmt(initialResult.totalCost, language)} DZD`,
            color: "text-foreground",
            bg: "bg-muted/40 border-border",
            Icon: RotateCcw,
            iconColor: "text-muted-foreground",
          },
          {
            label: t("التوفير المحقَّق", "Économie réalisée"),
            value: `${improvement.toFixed(1)}%`,
            color: improvement > 0 ? "text-secondary" : "text-muted-foreground",
            bg: "bg-muted/40 border-border",
            Icon: TrendingDown,
            iconColor: "text-secondary",
          },
          {
            label: t("تكرارات MODI", "Itérations MODI"),
            value: String(iters.length - 1),
            color: "text-foreground",
            bg: "bg-muted/40 border-border",
            Icon: Zap,
            iconColor: "text-primary",
          },
        ].map((k, idx) => (
          <Card key={idx} className={cn("border", k.bg)}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <k.Icon className={cn("w-3.5 h-3.5 shrink-0", k.iconColor)} />
                <span className="text-xs text-muted-foreground leading-tight">{k.label}</span>
              </div>
              <div className={cn("text-base font-bold leading-tight tabular-nums", k.color)}>{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: "modi" as OptimizeTab, fr: "Optimisation pas-à-pas", ar: "التحسين خطوة بخطوة" },
          { id: "analysis" as OptimizeTab, fr: "Analyse Chaîne d'Appro.", ar: "تحليل سلاسل الإمداد" },
        ]).map(tb => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5",
              tab === tb.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tb.id === "modi" ? <Zap className="w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5" />}
            {isAr ? tb.ar : tb.fr}
            {tb.id === "analysis" && modiResult.isOptimal && (
              <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0 ms-1">{t("جاهز", "Prêt")}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: MODI step-through ── */}
      {tab === "modi" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {iter.isOptimal && isLast
                    ? <><CheckCircle2 className="w-4 h-4 text-green-600" />{t("الحل الأمثل ✓", "Solution Optimale ✓")}</>
                    : <><span className="bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">{iter.iterationNumber}</span>{t(`التكرار ${iter.iterationNumber}`, `Itération ${iter.iterationNumber}`)}</>
                  }
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {t("التكلفة", "Coût")} : <strong className="text-foreground">{fmt(iter.totalCost, language)} DZD</strong>
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Compact allocation table for current iteration */}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="text-xs border-collapse" style={{ minWidth: (modiResult.balanced.destinations.length + 2) * 80 + 120 }}>
                  <thead>
                    <tr>
                      <th className="text-start p-2 bg-muted text-muted-foreground min-w-[130px] border-b border-e border-border" />
                      {modiResult.balanced.destinations.map((d, j) => (
                        <th key={j} className="p-2 text-center bg-muted border-b border-e border-border font-medium" style={{ minWidth: 80 }}>
                          <div className="truncate max-w-[90px] mx-auto text-xs">{d.name}</div>
                        </th>
                      ))}
                      <th className="p-2 text-center bg-primary/10 text-primary font-bold border-b border-border text-xs">
                        {t("العرض", "Offre")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {modiResult.balanced.sources.map((s, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                        <td className="p-2 border-b border-e border-border font-medium text-xs">
                          <div className="truncate max-w-[120px]">{s.name}</div>
                        </td>
                        {modiResult.balanced.destinations.map((_, j) => {
                          const alloc = iter.allocation[i]?.[j] ?? 0;
                          const isBasic = iter.isBasic[i]?.[j];
                          const isEntering = iter.enteringCell?.i === i && iter.enteringCell?.j === j;
                          const isLeaving = iter.leavingCell?.i === i && iter.leavingCell?.j === j;
                          const opp = iter.opportunityCosts[i]?.[j];
                          return (
                            <td key={j} className={cn(
                              "p-1 border-b border-e border-border text-center relative",
                              isEntering && "bg-green-100 ring-2 ring-inset ring-green-400",
                              isLeaving  && "bg-red-100 ring-2 ring-inset ring-red-400",
                              !isEntering && !isLeaving && isBasic && "bg-primary/5",
                            )} style={{ minWidth: 80, height: 44 }}>
                              {/* Unit cost top-right */}
                              <span className="absolute top-0.5 end-1 text-[9px] text-muted-foreground tabular-nums">
                                {modiResult.balanced.costs[i]?.[j]}
                              </span>
                              {isBasic ? (
                                <span className={cn("font-bold text-sm", isEntering && "text-green-700", isLeaving && "text-red-700")}>
                                  {epsilonSet.has(`${i},${j}`) ? "ε" : alloc > 0 ? fmt(alloc, language) : "—"}
                                </span>
                              ) : (
                                <span className={cn("text-xs tabular-nums",
                                  opp !== null && Math.abs(opp) < 1e-4 ? "text-blue-600 font-bold" :
                                  opp !== null && (isMin ? opp < 0 : opp > 0) ? "text-red-600 font-bold" : "text-muted-foreground"
                                )}>
                                  {opp !== null ? (Math.abs(opp) < 1e-4 ? "0" : fmt(opp, language, 1)) : "—"}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2 border-b border-border text-center font-semibold text-primary tabular-nums text-xs bg-primary/5">
                          {fmt(iter.allocation[i]?.reduce((a, v) => a + v, 0) ?? 0, language)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-primary/5">
                      <td className="p-2 border-t border-e border-border text-xs font-bold text-primary">{t("الطلب", "Demande")}</td>
                      {modiResult.balanced.destinations.map((d, j) => (
                        <td key={j} className="p-2 border-t border-e border-border text-center text-xs font-semibold">{fmt(d.demand, language)}</td>
                      ))}
                      <td className="p-2 border-t border-border" />
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Step explanation */}
              {iter.isOptimal ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800 text-sm">
                    {t("تم الوصول إلى الحل الأمثل ✓", "Solution optimale atteinte ✓")}
                  </AlertTitle>
                  <AlertDescription className="text-green-700 text-xs">
                    {t(
                      `جميع تكاليف الفرصة ${isMin ? "≥ 0" : "≤ 0"}. لا يمكن تحسين الخطة اللوجستية أكثر. التكلفة الإجمالية المثلى: ${fmt(iter.totalCost, language)} DZD.`,
                      `Tous les coûts d'opportunité sont ${isMin ? "≥ 0" : "≤ 0"}. Aucune amélioration possible. Coût logistique optimal : ${fmt(iter.totalCost, language)} DZD.`
                    )}
                  </AlertDescription>
                </Alert>
              ) : iter.enteringCell ? (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                    <div className="font-semibold text-green-800 mb-1">{t("① الخلية الداخلة", "① Entrante")}</div>
                    <div className="text-green-700">
                      ({iter.enteringCell.i + 1},{iter.enteringCell.j + 1}) Δ={fmt(iter.opportunityCosts[iter.enteringCell.i]?.[iter.enteringCell.j] ?? 0, language, 1)}
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <div className="font-semibold text-amber-800 mb-1">{t("② الحلقة", "② Boucle")}</div>
                    <div className="text-amber-700 text-[10px]">
                      {iter.loop ? iter.loop.map((c, idx) => `${c.sign}(${c.i+1},${c.j+1})`).join("→") : "—"}
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <div className="font-semibold text-red-800 mb-1">{t("③ الخلية الخارجة", "③ Sortante")}</div>
                    <div className="text-red-700">
                      {iter.leavingCell ? `θ=${fmt(iter.theta ?? 0, language)} (${iter.leavingCell.i+1},${iter.leavingCell.j+1})` : "—"}
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setCurrentIter(v => Math.max(0, v - 1))} disabled={currentIter === 0}>
              <ChevronLeft className="w-4 h-4" />{t("السابق", "Précédent")}
            </Button>
            <div className="flex items-center gap-1">
              {iters.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIter(idx)}
                  className={cn(
                    "rounded-full transition-all",
                    idx === currentIter ? "bg-primary w-4 h-2" : idx === iters.length - 1 ? "bg-green-500 w-2 h-2" : "bg-primary/30 w-2 h-2"
                  )}
                />
              ))}
            </div>
            {!isLast ? (
              <Button size="sm" onClick={() => setCurrentIter(v => Math.min(iters.length - 1, v + 1))}>
                {t("التالي", "Suivant")}<ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={() => setTab("analysis")}>
                {t("عرض تحليل سلاسل الإمداد", "Voir l'analyse SC")}<ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
          {!isLast && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setCurrentIter(iters.length - 1)}>
                <CheckCircle2 className="w-3 h-3 mr-1" />{t("الانتقال مباشرة إلى الحل الأمثل", "Aller directement à la solution optimale")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: SC Analysis ── */}
      {tab === "analysis" && (
        <div className="space-y-5">
          {/* Optimal distribution plan */}
          <Card>
            <CardHeader className="pb-2 border-b">
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="w-4 h-4 text-primary" />
                {t("خطة التوزيع المثلى", "Plan de Distribution Optimal")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="px-3 py-2 text-start">{t("المستودع / المصنع", "Entrepôt / Usine")}</th>
                    <th className="px-3 py-2 text-start">{t("العميل / نقطة البيع", "Client / Point de vente")}</th>
                    <th className="px-3 py-2 text-center">{t("الكمية", "Quantité")}</th>
                    <th className="px-3 py-2 text-center">{t("تكلفة/وحدة", "Coût/u")}</th>
                    <th className="px-3 py-2 text-end">{t("التكلفة الإجمالية", "Coût total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRoutes.map((r, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                      <td className="px-3 py-2 font-medium border-b border-border">{r.sourceName}</td>
                      <td className="px-3 py-2 border-b border-border">{r.destName}</td>
                      <td className="px-3 py-2 text-center border-b border-border font-bold text-primary tabular-nums">{fmt(r.allocation, language)}</td>
                      <td className="px-3 py-2 text-center border-b border-border tabular-nums">{r.unitCost}</td>
                      <td className="px-3 py-2 text-end border-b border-border font-semibold tabular-nums text-secondary">
                        {fmt(r.allocation * r.unitCost, language)} DZD
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-green-50 font-bold">
                    <td colSpan={4} className="px-3 py-2.5 text-green-800 border-t-2 border-green-300">
                      {t("المجموع الأمثل", "TOTAL OPTIMAL")}
                    </td>
                    <td className="px-3 py-2.5 text-end text-green-700 text-base border-t-2 border-green-300 tabular-nums">
                      {fmt(modiResult.finalCost, language)} DZD
                    </td>
                  </tr>
                </tbody>
              </table>
              {/* Balance note */}
              {(modiResult.balanced.dummySourceIndex !== null || modiResult.balanced.dummyDestIndex !== null) && (
                <Alert className="mt-3 border-orange-200 bg-orange-50">
                  <Info className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-700 text-xs">
                    {modiResult.balanced.dummySourceIndex !== null
                      ? t(
                          `مصدر وهمي (صف ${modiResult.balanced.dummySourceIndex + 1}): الكميات المخصصة له تمثّل العجز في القدرة — طلب عملاء لا يمكن تلبيته بالطاقة الحالية.`,
                          `Source fictive (ligne ${modiResult.balanced.dummySourceIndex + 1}) : les quantités allouées représentent les déficits de capacité — demande client non satisfaite par la capacité actuelle.`
                        )
                      : t(
                          `وجهة وهمية (عمود ${modiResult.balanced.dummyDestIndex! + 1}): الكميات المخصصة لها تمثّل الفائض غير الموزَّع من المستودعات.`,
                          `Destination fictive (colonne ${modiResult.balanced.dummyDestIndex! + 1}) : les quantités représentent le surplus non distribué des entrepôts.`
                        )
                    }
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* تحليل الوضع */}
          <Card className="border-primary/20">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="flex items-center gap-3 text-xl">
                <span className="rounded-lg bg-primary/10 p-2 text-primary"><BarChart3 className="w-5 h-5" /></span>
                <span>
                  <span className="block">{t("تحليل الوضع اللوجستي", "Analyse de la Situation Logistique")}</span>
                  <span className="block text-sm font-normal text-muted-foreground mt-0.5">
                    {t("Analyse de la Situation Logistique", "تحليل الوضع اللوجستي")}
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              {analysisLines.map((line, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border bg-primary/5 border-primary/20 p-4">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">{line.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* التوصيات الإدارية */}
          {recommendations.length > 0 && (
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary"><Lightbulb className="w-5 h-5" /></span>
                  <span>
                    <span className="block">{t("التوصيات الإدارية للتوزيع", "Recommandations Managériales Distribution")}</span>
                    <span className="block text-sm font-normal text-muted-foreground mt-0.5">
                      {t("Recommandations Managériales Distribution", "التوصيات الإدارية للتوزيع")}
                    </span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                {recommendations.map((rec, i) => {
                  const borderClass =
                    rec.priority === "high"   ? "border-s-red-500 bg-red-50"     :
                    rec.priority === "medium" ? "border-s-amber-500 bg-amber-50" :
                                               "border-s-blue-500 bg-blue-50";
                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-xl border-s-4 p-5 space-y-2",
                        borderClass,
                        isAr ? "border-s-0 border-e-4" : ""
                      )}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl">{rec.icon}</span>
                        <p className="font-bold text-base">{isAr ? rec.titleAr : rec.titleFr}</p>
                        <Badge variant="outline" className="ms-auto text-xs">
                          #{i + 1}
                        </Badge>
                        <Badge className={cn(
                          "text-[10px]",
                          rec.priority === "high" ? "bg-red-600" : rec.priority === "medium" ? "bg-amber-600" : "bg-blue-600"
                        )}>
                          {rec.priority === "high"   ? t("أولوية عالية", "Priorité haute")   :
                           rec.priority === "medium" ? t("أولوية متوسطة", "Priorité moyenne") :
                                                       t("أولوية منخفضة", "Priorité basse")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {isAr ? rec.descAr : rec.descFr}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Sensitivity analysis (compact) */}
          <Card>
            <CardHeader className="pb-2 border-b">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="w-4 h-4 text-amber-600" />
                {t("تحليل الحساسية للمسارات النشطة", "Analyse de Sensibilité — Routes actives")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t(
                  "نطاق تغيير التكلفة الوحدوية الذي يبقى فيه الحل اللوجستي المثالي الحالي صالحاً.",
                  "Plage de variation du coût unitaire pour laquelle le plan logistique optimal reste valide."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-secondary/80 text-white">
                    <th className="px-3 py-2 text-start">{t("المسار", "Route")}</th>
                    <th className="px-3 py-2 text-center">{t("التخصيص", "Alloc.")}</th>
                    <th className="px-3 py-2 text-center">{t("التكلفة", "Coût")}</th>
                    <th className="px-3 py-2 text-center">{t("النطاق [أدنى، أقصى]", "Plage [min, max]")}</th>
                    <th className="px-3 py-2 text-center">{t("هامش ↓", "Marge ↓")}</th>
                    <th className="px-3 py-2 text-center">{t("هامش ↑", "Marge ↑")}</th>
                  </tr>
                </thead>
                <tbody>
                  {modiResult.sensitivityRanges.filter(r => !epsilonSet.has(`${r.i},${r.j}`)).map((r, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                      <td className="px-3 py-1.5 border-b border-border">
                        <span className="font-medium">{r.sourceName}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span>{r.destName}</span>
                      </td>
                      <td className="px-3 py-1.5 text-center border-b border-border font-bold text-primary tabular-nums">{fmt(r.allocation, language)}</td>
                      <td className="px-3 py-1.5 text-center border-b border-border font-semibold tabular-nums">{r.unitCost}</td>
                      <td className="px-3 py-1.5 text-center border-b border-border text-[11px] tabular-nums">
                        [{fmt(r.lowerBound, language, 1)}, {r.upperBound === Infinity ? "∞" : fmt(r.upperBound, language, 1)}]
                      </td>
                      <td className="px-3 py-1.5 text-center border-b border-border text-orange-600 tabular-nums">
                        {r.allowedDecrease === Infinity ? "∞" : fmt(r.allowedDecrease, language, 1)}
                      </td>
                      <td className="px-3 py-1.5 text-center border-b border-border text-green-600 tabular-nums">
                        {r.allowedIncrease === Infinity ? "∞" : fmt(r.allowedIncrease, language, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSave}
              disabled={isSaved}
              variant={isSaved ? "outline" : "default"}
              className="flex-1 gap-2"
            >
              {isSaved ? <Check className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
              {isSaved
                ? t("تم الحفظ في السجل ✓", "Enregistré dans l'historique ✓")
                : t("حفظ في السجل (سلاسل الإمداد)", "Sauvegarder (Chaîne d'Approvisionnement)")}
            </Button>
            <Button onClick={handlePDF} disabled={isExporting} variant="outline" className="flex-1 gap-2">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {t("تصدير PDF", "Exporter PDF")}
            </Button>
            <Button onClick={onNewProblem} variant="ghost" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              {t("مسألة جديدة", "Nouveau problème")}
            </Button>
          </div>
        </div>
      )}

      {/* Export progress */}
      {exportMsg && (
        <div className="fixed bottom-4 end-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg text-sm z-50 flex items-center gap-2">
          {isExporting && <Loader2 className="w-4 h-4 animate-spin" />}
          {exportMsg}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TransportDistribution() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("sector");
  const [sector, setSector] = useState<SectorKey>("custom");

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [objectiveType, setObjectiveType] = useState<"minimize" | "maximize">("minimize");
  const [sources, setSources] = useState<Source[]>([{ name: "", supply: 0 }, { name: "", supply: 0 }]);
  const [destinations, setDestinations] = useState<Destination[]>([{ name: "", demand: 0 }, { name: "", demand: 0 }]);
  const [costs, setCosts] = useState<number[][]>([[0, 0], [0, 0]]);

  // ── Solve results ───────────────────────────────────────────────────────────
  const [allResults, setAllResults] = useState<Record<MethodKey, SolveResult> | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<MethodKey>("vam");
  const [modiResult, setModiResult] = useState<MODIResult | null>(null);
  const [initialResult, setInitialResult] = useState<SolveResult | null>(null);

  // ── Sector selection ────────────────────────────────────────────────────────
  function handleSectorSelect(key: SectorKey) {
    setSector(key);
    const tpl = TEMPLATES[key];
    if (tpl) {
      const lang = language;
      setSources(tpl.sources.map(s => ({ name: lang === "ar" ? s.nameAr : s.nameFr, supply: s.supply })));
      setDestinations(tpl.destinations.map(d => ({ name: lang === "ar" ? d.nameAr : d.nameFr, demand: d.demand })));
      setCosts(tpl.costs.map(row => [...row]));
      setName(lang === "ar" ? tpl.nameAr : tpl.nameFr);
      setObjectiveType(tpl.objectiveType);
    } else {
      setSources([{ name: "", supply: 0 }, { name: "", supply: 0 }]);
      setDestinations([{ name: "", demand: 0 }, { name: "", demand: 0 }]);
      setCosts([[0, 0], [0, 0]]);
      setName("");
      setObjectiveType("minimize");
    }
    setStep("input");
  }

  // ── Compute initial solutions ────────────────────────────────────────────────
  function handleComputeInitial() {
    const input = { sources, destinations, costs, objective: objectiveType };
    const nwcResult = solveNWC(input);
    const lcmResult = solveLCM(input);
    const vamResult = solveVAM(input);
    const results: Record<MethodKey, SolveResult> = { nwc: nwcResult, lcm: lcmResult, vam: vamResult };
    setAllResults(results);

    // Auto-select best
    const best = (["nwc", "lcm", "vam"] as MethodKey[]).reduce((prev, cur) =>
      objectiveType === "minimize"
        ? results[cur].totalCost < results[prev].totalCost ? cur : prev
        : results[cur].totalCost > results[prev].totalCost ? cur : prev
    );
    setSelectedMethod(best);
    setStep("initial");
  }

  // ── Run MODI ─────────────────────────────────────────────────────────────────
  function handleRunMODI() {
    if (!allResults) return;
    const initRes = allResults[selectedMethod];
    const modi = runMODI({
      balanced:      initRes.balanced,
      allocation:    initRes.allocation,
      objective:     objectiveType,
      initialMethod: selectedMethod.toUpperCase(),
    });
    setInitialResult(initRes);
    setModiResult(modi);
    setStep("optimize");
  }

  function handleBack() {
    if (step === "input")    setStep("sector");
    if (step === "initial")  setStep("input");
    if (step === "optimize") setStep("initial");
  }

  function handleNewProblem() {
    setStep("sector");
    setAllResults(null);
    setModiResult(null);
    setInitialResult(null);
  }

  const stageNum: 1 | 2 | 3 | 4 =
    step === "sector"   ? 1 :
    step === "input"    ? 2 :
    step === "initial"  ? 3 : 4;

  return (
    <div
      className={cn("min-h-[100dvh] bg-muted/20", isAr ? "rtl" : "ltr")}
      dir={isAr ? "rtl" : "ltr"}
    >
      <main className="container mx-auto px-4 py-6 space-y-6 max-w-5xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/supply-chain" className="hover:text-primary transition-colors flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            {t("سلاسل الإمداد", "Chaîne d'Approvisionnement")}
          </Link>
          <ChevronRight className={cn("w-3 h-3", isAr && "rotate-180")} />
          <span className="text-foreground font-medium">{t("النقل والتوزيع", "Transport & Distribution")}</span>
        </div>

        {/* Stage bar (hidden on sector step) */}
        {step !== "sector" && (
          <StageBar current={stageNum} onBack={handleBack} />
        )}

        {/* Step content */}
        {step === "sector" && (
          <SectorStep onSelect={handleSectorSelect} />
        )}

        {step === "input" && (
          <InputStep
            sector={sector}
            name={name} setName={setName}
            objectiveType={objectiveType} setObjectiveType={setObjectiveType}
            sources={sources} setSources={setSources}
            destinations={destinations} setDestinations={setDestinations}
            costs={costs} setCosts={setCosts}
            onBack={handleBack}
            onContinue={handleComputeInitial}
          />
        )}

        {step === "initial" && allResults && (
          <InitialStep
            results={allResults}
            objective={objectiveType}
            selectedMethod={selectedMethod}
            onSelectMethod={setSelectedMethod}
            onBack={handleBack}
            onContinue={handleRunMODI}
          />
        )}

        {step === "optimize" && modiResult && initialResult && (
          <OptimizeStep
            modiResult={modiResult}
            initialResult={initialResult}
            selectedMethod={selectedMethod}
            problemName={name}
            objective={objectiveType}
            sector={sector}
            onBack={handleBack}
            onNewProblem={handleNewProblem}
          />
        )}

        {/* Footer */}
        <footer className="border-t pt-6 pb-4 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1 rounded">
              <Package className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-foreground">OptimDZ</span>
            <span>·</span>
            <span>{t("النقل والتوزيع", "Transport & Distribution")}</span>
          </div>
          <Link href="/supply-chain" className="hover:text-primary transition-colors">
            {isAr ? "→ العودة إلى سلاسل الإمداد" : "← Retour à la Chaîne d'Approvisionnement"}
          </Link>
        </footer>
      </main>
    </div>
  );
}
