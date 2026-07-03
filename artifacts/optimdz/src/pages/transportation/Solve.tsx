import { useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { useTransportState } from "@/lib/TransportContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  Factory, ShoppingBag, Users, Leaf, PenLine,
  Plus, Trash2, ArrowRight, ChevronLeft, ChevronRight,
  RotateCcw, AlertTriangle, CheckCircle2, Truck, Info,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type SectorKey = "industry" | "trade" | "services" | "agriculture" | "custom";
type Step = "select" | "form";

interface Source { name: string; supply: number; }
interface Destination { name: string; demand: number; }

// ── Sector selector card metadata ─────────────────────────────────────────────
const SECTOR_CARDS = [
  {
    key: "trade" as SectorKey,
    icon: <ShoppingBag className="w-7 h-7" />,
    nameFr: "Commerce", nameAr: "تجارة",
    descFr: "Distribution de marchandises depuis des entrepôts vers des détaillants régionaux.",
    descAr: "توزيع البضائع من المستودعات إلى تجار التجزئة الإقليميين.",
    routeFr: "2 entrepôts → 4 magasins · Équilibré",
    routeAr: "مستودعان → 4 متاجر · متوازن",
    objectiveFr: "Minimiser le coût de transport",
    objectiveAr: "تقليل تكلفة النقل",
    color: "border-amber-200 hover:border-amber-400 hover:bg-amber-50/60",
    iconBg: "bg-amber-100 text-amber-700",
  },
  {
    key: "industry" as SectorKey,
    icon: <Factory className="w-7 h-7" />,
    nameFr: "Industrie", nameAr: "صناعة",
    descFr: "Acheminement de produits depuis des usines vers des centres de distribution.",
    descAr: "شحن المنتجات من المصانع إلى مراكز التوزيع.",
    routeFr: "3 usines → 4 centres de distribution · Équilibré",
    routeAr: "3 مصانع → 4 مراكز توزيع · متوازن",
    objectiveFr: "Minimiser le coût logistique",
    objectiveAr: "تقليل التكلفة اللوجستية",
    color: "border-blue-200 hover:border-blue-400 hover:bg-blue-50/60",
    iconBg: "bg-blue-100 text-blue-700",
  },
  {
    key: "agriculture" as SectorKey,
    icon: <Leaf className="w-7 h-7" />,
    nameFr: "Agriculture", nameAr: "فلاحة",
    descFr: "Transport de récoltes depuis des fermes vers des marchés de gros régionaux.",
    descAr: "نقل المحاصيل من المزارع إلى أسواق الجملة الإقليمية.",
    routeFr: "3 fermes → 4 marchés de gros · Équilibré",
    routeAr: "3 مزارع → 4 أسواق جملة · متوازن",
    objectiveFr: "Minimiser le coût de transport",
    objectiveAr: "تقليل تكلفة النقل",
    color: "border-green-200 hover:border-green-400 hover:bg-green-50/60",
    iconBg: "bg-green-100 text-green-700",
  },
  {
    key: "services" as SectorKey,
    icon: <Users className="w-7 h-7" />,
    nameFr: "Services", nameAr: "خدمات",
    descFr: "Livraison de colis depuis des hubs logistiques vers des villes clientes.",
    descAr: "توصيل الطرود من مراكز اللوجستيك إلى المدن العميلة.",
    routeFr: "2 hubs → 5 villes · Déséquilibré ⚖️",
    routeAr: "مركزان → 5 مدن · غير متوازن ⚖️",
    objectiveFr: "Minimiser le coût de livraison",
    objectiveAr: "تقليل تكلفة التوصيل",
    color: "border-purple-200 hover:border-purple-400 hover:bg-purple-50/60",
    iconBg: "bg-purple-100 text-purple-700",
  },
];

const SECTOR_LABELS: Record<SectorKey, { fr: string; ar: string }> = {
  industry:    { fr: "Industrie",    ar: "صناعة" },
  trade:       { fr: "Commerce",     ar: "تجارة" },
  services:    { fr: "Services",     ar: "خدمات" },
  agriculture: { fr: "Agriculture",  ar: "فلاحة" },
  custom:      { fr: "Personnalisé", ar: "مخصص"  },
};

// ── Template data ─────────────────────────────────────────────────────────────
export interface Template {
  nameFr: string; nameAr: string;
  objectiveType: "minimize" | "maximize";
  sources: Array<{ nameFr: string; nameAr: string; supply: number }>;
  destinations: Array<{ nameFr: string; nameAr: string; demand: number }>;
  costs: number[][];
}

export const TEMPLATES: Record<SectorKey, Template | null> = {
  trade: {
    nameFr: "Distribution Régionale — Unifast Commerce SPA",
    nameAr: "التوزيع الإقليمي — يونيفاست كوميرس",
    objectiveType: "minimize",
    sources: [
      { nameFr: "Entrepôt Alger",  nameAr: "مستودع الجزائر", supply: 3000 },
      { nameFr: "Entrepôt Oran",   nameAr: "مستودع وهران",   supply: 2000 },
    ],
    destinations: [
      { nameFr: "Détaillant Tlemcen",     nameAr: "تاجر تلمسان",   demand: 1200 },
      { nameFr: "Détaillant Blida",       nameAr: "تاجر البليدة",   demand:  800 },
      { nameFr: "Détaillant Sétif",       nameAr: "تاجر سطيف",      demand: 1500 },
      { nameFr: "Détaillant Constantine", nameAr: "تاجر قسنطينة",   demand: 1500 },
    ],
    costs: [
      [35, 15, 40, 55],
      [20, 30, 50, 65],
    ],
  },
  industry: {
    nameFr: "Logistique Industrielle — Cevital Agro-Alimentaire",
    nameAr: "اللوجستيك الصناعي — سيفيتال للأغذية",
    objectiveType: "minimize",
    sources: [
      { nameFr: "Usine Béjaïa", nameAr: "مصنع بجاية", supply: 5000 },
      { nameFr: "Usine Oran",   nameAr: "مصنع وهران",  supply: 3000 },
      { nameFr: "Usine Annaba", nameAr: "مصنع عنابة",  supply: 2000 },
    ],
    destinations: [
      { nameFr: "Centre Dist. Alger",       nameAr: "مركز توزيع الجزائر",   demand: 4000 },
      { nameFr: "Centre Dist. Constantine", nameAr: "مركز توزيع قسنطينة",   demand: 2500 },
      { nameFr: "Centre Dist. Ouargla",     nameAr: "مركز توزيع ورقلة",     demand: 1500 },
      { nameFr: "Centre Dist. Tamanrasset", nameAr: "مركز توزيع تمنراست",   demand: 2000 },
    ],
    costs: [
      [ 25,  40,  80, 150],
      [ 30,  55,  90, 140],
      [ 45,  30,  75, 160],
    ],
  },
  agriculture: {
    nameFr: "Transport Agrumes — Coopérative Mitidja",
    nameAr: "نقل الحمضيات — تعاونية متيجة",
    objectiveType: "minimize",
    sources: [
      { nameFr: "Ferme Hadjout, Tipaza", nameAr: "مزرعة الحجوط، تيبازة", supply:  800 },
      { nameFr: "Ferme Sig, Mascara",    nameAr: "مزرعة سيق، معسكر",      supply:  600 },
      { nameFr: "Ferme Guelma",          nameAr: "مزرعة قالمة",            supply:  400 },
    ],
    destinations: [
      { nameFr: "Marché Gros Alger",       nameAr: "سوق الجملة الجزائر",   demand:  600 },
      { nameFr: "Marché Gros Oran",        nameAr: "سوق الجملة وهران",     demand:  500 },
      { nameFr: "Marché Gros Constantine", nameAr: "سوق الجملة قسنطينة",   demand:  450 },
      { nameFr: "Marché Gros Annaba",      nameAr: "سوق الجملة عنابة",     demand:  250 },
    ],
    costs: [
      [ 8, 20, 30, 35],
      [25,  8, 40, 45],
      [35, 45, 15,  8],
    ],
  },
  services: {
    nameFr: "Tournée Livraison — Chronopack Algérie",
    nameAr: "جولة التوصيل — كرونوباك الجزائر",
    objectiveType: "minimize",
    sources: [
      { nameFr: "Hub Alger", nameAr: "مركز الجزائر", supply: 1200 },
      { nameFr: "Hub Oran",  nameAr: "مركز وهران",   supply:  800 },
    ],
    destinations: [
      { nameFr: "Tizi Ouzou", nameAr: "تيزي وزو",  demand: 400 },
      { nameFr: "Blida",      nameAr: "البليدة",    demand: 300 },
      { nameFr: "Sétif",      nameAr: "سطيف",       demand: 500 },
      { nameFr: "Batna",      nameAr: "باتنة",      demand: 350 },
      { nameFr: "Annaba",     nameAr: "عنابة",      demand: 300 },
    ],
    costs: [
      [15, 10, 35, 45, 60],
      [40, 20, 45, 55, 70],
    ],
  },
  custom: null,
};

// ── Default blank state ───────────────────────────────────────────────────────
const blankSources   = (): Source[]      => [{ name: "", supply: 0 }, { name: "", supply: 0 }];
const blankDests     = (): Destination[] => [{ name: "", demand: 0 }, { name: "", demand: 0 }];
const blankCosts     = (m: number, n: number): number[][] =>
  Array.from({ length: m }, () => Array(n).fill(0));

// ── Helper: load a template into component state ──────────────────────────────
function templateToState(tpl: Template, lang: "fr" | "ar") {
  const sources: Source[] = tpl.sources.map((s) => ({
    name:   lang === "ar" ? s.nameAr : s.nameFr,
    supply: s.supply,
  }));
  const destinations: Destination[] = tpl.destinations.map((d) => ({
    name:   lang === "ar" ? d.nameAr : d.nameFr,
    demand: d.demand,
  }));
  const costs = tpl.costs.map((row) => [...row]);
  return { sources, destinations, costs };
}

// ── Sector Selector ───────────────────────────────────────────────────────────
function SectorSelector({ onSelect }: { onSelect: (key: SectorKey) => void }) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {t("Choisissez votre secteur", "اختر قطاعك")}
        </h1>
        <p className="text-muted-foreground mt-2 text-base">
          {t(
            "Sélectionnez un modèle pré-rempli avec des données algériennes réalistes, ou commencez de zéro.",
            "اختر نموذجاً مُعبَّأً مسبقاً ببيانات جزائرية واقعية، أو ابدأ من الصفر."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {SECTOR_CARDS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.key)}
            className={cn(
              "group relative flex flex-col gap-4 rounded-xl border-2 bg-card p-6 text-left transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              s.color,
              isAr && "text-right"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className={cn("rounded-xl p-3 shrink-0", s.iconBg)}>{s.icon}</div>
              <ChevronRight
                className={cn(
                  "w-5 h-5 text-muted-foreground mt-1 shrink-0 transition-transform group-hover:translate-x-1",
                  isAr && "rotate-180 group-hover:-translate-x-1 group-hover:translate-x-0"
                )}
              />
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl font-bold text-foreground">
                  {isAr ? s.nameAr : s.nameFr}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  {isAr ? s.nameFr : s.nameAr}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isAr ? s.descAr : s.descFr}
              </p>
            </div>

            <div className="space-y-1 border-t pt-3 mt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("Réseau", "الشبكة")}:
                </span>
                <span className="text-xs font-medium text-foreground">
                  {isAr ? s.routeAr : s.routeFr}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("Objectif", "الهدف")}:
                </span>
                <span className="text-xs text-muted-foreground">
                  {isAr ? s.objectiveAr : s.objectiveFr}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Custom */}
      <div className="border-t pt-6">
        <button
          type="button"
          onClick={() => onSelect("custom")}
          className={cn(
            "group w-full flex items-center gap-4 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-5 transition-all duration-200 hover:border-muted-foreground/60 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            isAr ? "flex-row-reverse text-right" : "text-left"
          )}
        >
          <div className="rounded-xl bg-muted p-3 text-muted-foreground shrink-0">
            <PenLine className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              {t("Commencer de zéro", "ابدأ من الصفر")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                "Pour les utilisateurs avancés — définissez vos propres sources, destinations et coûts.",
                "للمستخدمين المتقدمين — حدد مصادرك ووجهاتك وتكاليفك بنفسك."
              )}
            </p>
          </div>
          <ArrowRight
            className={cn(
              "w-5 h-5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-1",
              isAr && "rotate-180 group-hover:-translate-x-1 group-hover:translate-x-0"
            )}
          />
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TransportSolve() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const search = useSearch();
  const urlSector = new URLSearchParams(search).get("sector") as SectorKey | null;
  const [, setLocation] = useLocation();
  const { setProblem } = useTransportState();
  const { toast } = useToast();

  // Step state — jump straight to form if ?sector= param is present
  const [step, setStep]     = useState<Step>(urlSector ? "form" : "select");
  const [sector, setSector] = useState<SectorKey>(urlSector || "custom");

  // Form state — lazily initialized from URL sector param if present
  const _initTpl = urlSector ? TEMPLATES[urlSector] : null;
  const _initLang = language;
  const [name,          setName]          = useState(() =>
    _initTpl ? (_initLang === "ar" ? _initTpl.nameAr : _initTpl.nameFr) : ""
  );
  const [objectiveType, setObjectiveType] = useState<"minimize" | "maximize">(() =>
    _initTpl?.objectiveType ?? "minimize"
  );
  const [sources,       setSources]       = useState<Source[]>(() =>
    _initTpl
      ? _initTpl.sources.map((s) => ({ name: _initLang === "ar" ? s.nameAr : s.nameFr, supply: s.supply }))
      : blankSources()
  );
  const [destinations,  setDestinations]  = useState<Destination[]>(() =>
    _initTpl
      ? _initTpl.destinations.map((d) => ({ name: _initLang === "ar" ? d.nameAr : d.nameFr, demand: d.demand }))
      : blankDests()
  );
  const [costs,         setCosts]         = useState<number[][]>(() =>
    _initTpl ? _initTpl.costs.map((row) => [...row]) : blankCosts(2, 2)
  );

  // Field-level errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Load template ───────────────────────────────────────────────────────────
  function loadTemplate(key: SectorKey, lang: "fr" | "ar") {
    const tpl = TEMPLATES[key];
    if (!tpl) {
      setSources(blankSources());
      setDestinations(blankDests());
      setCosts(blankCosts(2, 2));
      setName("");
      setObjectiveType("minimize");
    } else {
      const state = templateToState(tpl, lang);
      setSources(state.sources);
      setDestinations(state.destinations);
      setCosts(state.costs);
      setName(lang === "ar" ? tpl.nameAr : tpl.nameFr);
      setObjectiveType(tpl.objectiveType);
    }
    setErrors({});
  }

  const handleSectorSelect = (key: SectorKey) => {
    setSector(key);
    loadTemplate(key, language);
    setStep("form");
  };

  const handleResetTemplate = () => {
    loadTemplate(sector, language);
    toast({
      title: t("Valeurs réinitialisées", "تم إعادة التعيين"),
      description: t("Les valeurs du modèle ont été restaurées.", "تم استعادة قيم النموذج."),
    });
  };

  // ── Sources CRUD ────────────────────────────────────────────────────────────
  const addSource = () => {
    setSources((prev) => [...prev, { name: "", supply: 0 }]);
    setCosts((prev) => [...prev, Array(destinations.length).fill(0)]);
  };

  const removeSource = (i: number) => {
    if (sources.length <= 1) return;
    setSources((prev) => prev.filter((_, idx) => idx !== i));
    setCosts((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateSource = (i: number, field: keyof Source, value: string | number) => {
    setSources((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  // ── Destinations CRUD ───────────────────────────────────────────────────────
  const addDestination = () => {
    setDestinations((prev) => [...prev, { name: "", demand: 0 }]);
    setCosts((prev) => prev.map((row) => [...row, 0]));
  };

  const removeDestination = (j: number) => {
    if (destinations.length <= 1) return;
    setDestinations((prev) => prev.filter((_, idx) => idx !== j));
    setCosts((prev) => prev.map((row) => row.filter((_, idx) => idx !== j)));
  };

  const updateDestination = (j: number, field: keyof Destination, value: string | number) => {
    setDestinations((prev) =>
      prev.map((d, idx) => idx === j ? { ...d, [field]: value } : d)
    );
  };

  // ── Cost update ─────────────────────────────────────────────────────────────
  const updateCost = (i: number, j: number, value: number) => {
    setCosts((prev) =>
      prev.map((row, ri) =>
        ri === i ? row.map((c, ci) => (ci === j ? value : c)) : row
      )
    );
  };

  // ── Balance check ────────────────────────────────────────────────────────────
  const totalSupply = useMemo(() => sources.reduce((s, src) => s + (src.supply || 0), 0), [sources]);
  const totalDemand = useMemo(() => destinations.reduce((s, d) => s + (d.demand || 0), 0), [destinations]);
  const balanceDiff = totalSupply - totalDemand;
  const isBalanced  = balanceDiff === 0;

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};

    sources.forEach((s, i) => {
      if (!s.name.trim())
        errs[`source_name_${i}`] = t("Nom requis", "الاسم مطلوب");
      if (s.supply < 0)
        errs[`source_supply_${i}`] = t("Valeur négative non autorisée", "قيمة سالبة غير مسموح بها");
    });

    destinations.forEach((d, j) => {
      if (!d.name.trim())
        errs[`dest_name_${j}`] = t("Nom requis", "الاسم مطلوب");
      if (d.demand < 0)
        errs[`dest_demand_${j}`] = t("Valeur négative non autorisée", "قيمة سالبة غير مسموح بها");
    });

    costs.forEach((row, i) =>
      row.forEach((c, j) => {
        if (c < 0)
          errs[`cost_${i}_${j}`] = t("Coût négatif non autorisé", "تكلفة سالبة غير مسموح بها");
      })
    );

    if (totalSupply <= 0)
      errs["total_supply"] = t("L'offre totale doit être > 0", "يجب أن يكون إجمالي العرض > 0");
    if (totalDemand <= 0)
      errs["total_demand"] = t("La demande totale doit être > 0", "يجب أن يكون إجمالي الطلب > 0");

    return errs;
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleContinue = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast({
        variant: "destructive",
        title: t("Erreurs de saisie", "أخطاء في الإدخال"),
        description: t(
          "Veuillez corriger les champs en rouge avant de continuer.",
          "يرجى تصحيح الحقول المحددة باللون الأحمر قبل المتابعة."
        ),
      });
      return;
    }
    setErrors({});

    // Store the problem for Stage 2/3
    setProblem({
      name:          name || t("Problème de transport", "مسألة نقل"),
      sector,
      objectiveType,
      sources,
      destinations,
      costs,
    });

    setLocation("/transport/solution");
  };

  // ── Sector label ─────────────────────────────────────────────────────────────
  const sectorLabel = SECTOR_LABELS[sector];

  // ── Render: Step 1 — selector ─────────────────────────────────────────────
  if (step === "select") return <SectorSelector onSelect={handleSectorSelect} />;

  // ── Render: Step 2 — form ─────────────────────────────────────────────────
  const errorCount = Object.keys(errors).length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setStep("select")}
            className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("Retour au choix du secteur", "العودة إلى اختيار القطاع")}
          >
            <ChevronLeft className={cn("w-5 h-5", isAr && "rotate-180")} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-3xl font-bold text-foreground">
                {t("Définir le Problème de Transport", "تحديد مسألة النقل")}
              </h1>
              <Badge variant="secondary" className="text-sm font-medium">
                {isAr ? sectorLabel.ar : sectorLabel.fr}
                {sector !== "custom" && (
                  <span className="ml-1 opacity-60">· {isAr ? sectorLabel.fr : sectorLabel.ar}</span>
                )}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {sector === "custom"
                ? t("Entrez vos propres paramètres de transport.", "أدخل معاملات النقل الخاصة بك.")
                : t("Modèle pré-rempli — vous pouvez modifier les valeurs.", "نموذج مُعبَّأ مسبقاً — يمكنك تعديل القيم.")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={handleResetTemplate}>
            <RotateCcw className="w-4 h-4 mr-1.5" />
            {t("Réinitialiser", "إعادة التعيين")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setStep("select")}>
            <ChevronLeft className={cn("w-4 h-4 mr-1.5", isAr && "rotate-180")} />
            {t("Changer de secteur", "تغيير القطاع")}
          </Button>
        </div>
      </div>

      {/* ── Validation error banner ────────────────────────────────────────── */}
      {errorCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>{t("Erreurs de saisie", "أخطاء في الإدخال")}</AlertTitle>
          <AlertDescription>
            {t(
              `${errorCount} champ(s) nécessitent votre attention. Corrigez les zones surlignées en rouge.`,
              `${errorCount} حقل (حقول) تحتاج إلى انتباهك. صحّح المناطق المحددة باللون الأحمر.`
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* ── General info card ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Informations Générales", "معلومات عامة")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="prob-name">{t("Nom du problème", "اسم المسألة")}</Label>
            <Input
              id="prob-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Ex: Distribution Cevital Q1 2026", "مثال: توزيع سيفيتال الربع الأول 2026")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("Objectif", "الهدف")}</Label>
            <RadioGroup
              value={objectiveType}
              onValueChange={(v: "minimize" | "maximize") => setObjectiveType(v)}
              className="flex gap-6 pt-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="minimize" id="obj-min" />
                <Label htmlFor="obj-min" className="cursor-pointer font-normal">
                  {t("Minimiser le coût", "تقليل التكلفة")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="maximize" id="obj-max" />
                <Label htmlFor="obj-max" className="cursor-pointer font-normal">
                  {t("Maximiser le profit", "تعظيم الربح")}
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* ── Transport matrix card ──────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              {t("Matrice des Coûts de Transport", "مصفوفة تكاليف النقل")}
            </CardTitle>
            <CardDescription className="mt-1">
              {t(
                "Saisissez le coût unitaire de transport de chaque source vers chaque destination, ainsi que les capacités d'offre et de demande.",
                "أدخل تكلفة وحدة النقل من كل مصدر إلى كل وجهة، مع سعات العرض والطلب."
              )}
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addDestination} className="shrink-0">
            <Plus className="w-4 h-4 mr-1.5" />
            {t("Ajouter destination", "إضافة وجهة")}
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: `${Math.max(640, 220 + destinations.length * 144 + 120)}px` }}>

              {/* ── HEADER ROW: destination names ─────────────────────────── */}
              <thead>
                <tr>
                  {/* Corner */}
                  <th className="sticky left-0 z-20 bg-muted px-4 py-3 border-b border-r border-border text-left">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      <Truck className="w-3.5 h-3.5" />
                      {t("Source \\ Destination", "المصدر \\ الوجهة")}
                    </div>
                  </th>

                  {/* Destination header cells */}
                  {destinations.map((dest, j) => (
                    <th key={j} className="bg-muted px-3 py-2 border-b border-r border-border min-w-[140px]">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => removeDestination(j)}
                            disabled={destinations.length <= 1}
                            title={t("Supprimer cette destination", "حذف هذه الوجهة")}
                            className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <Input
                          value={dest.name}
                          onChange={(e) => updateDestination(j, "name", e.target.value)}
                          placeholder={t(`Destination ${j + 1}`, `وجهة ${j + 1}`)}
                          className={cn(
                            "h-7 text-xs font-medium text-center",
                            errors[`dest_name_${j}`] && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        {errors[`dest_name_${j}`] && (
                          <p className="text-[10px] text-destructive text-center leading-tight">
                            {errors[`dest_name_${j}`]}
                          </p>
                        )}
                      </div>
                    </th>
                  ))}

                  {/* Supply column header */}
                  <th className="bg-primary/8 px-4 py-3 border-b border-l border-border min-w-[110px] text-center">
                    <span className="text-xs font-bold text-primary uppercase tracking-wide">
                      {t("Offre", "العرض")}
                    </span>
                    {errors["total_supply"] && (
                      <p className="text-[10px] text-destructive mt-0.5">{errors["total_supply"]}</p>
                    )}
                  </th>
                </tr>
              </thead>

              {/* ── BODY ROWS: sources + costs ────────────────────────────── */}
              <tbody>
                {sources.map((src, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>

                    {/* Source name cell (sticky) */}
                    <td className="sticky left-0 z-10 px-2 py-2 border-b border-r border-border bg-inherit">
                      <div className="flex items-center gap-1.5 min-w-[190px]">
                        <div className="flex-1 space-y-0.5">
                          <Input
                            value={src.name}
                            onChange={(e) => updateSource(i, "name", e.target.value)}
                            placeholder={t(`Source ${i + 1}`, `مصدر ${i + 1}`)}
                            className={cn(
                              "h-7 text-xs font-medium",
                              errors[`source_name_${i}`] && "border-destructive focus-visible:ring-destructive"
                            )}
                          />
                          {errors[`source_name_${i}`] && (
                            <p className="text-[10px] text-destructive leading-tight">
                              {errors[`source_name_${i}`]}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSource(i)}
                          disabled={sources.length <= 1}
                          title={t("Supprimer cette source", "حذف هذا المصدر")}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Cost cells */}
                    {destinations.map((_, j) => (
                      <td key={j} className="px-2 py-2 border-b border-r border-border">
                        <div className="space-y-0.5">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={costs[i]?.[j] ?? 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateCost(i, j, isNaN(val) ? 0 : val);
                            }}
                            className={cn(
                              "h-7 text-center text-sm tabular-nums",
                              errors[`cost_${i}_${j}`] && "border-destructive focus-visible:ring-destructive"
                            )}
                          />
                          {errors[`cost_${i}_${j}`] && (
                            <p className="text-[10px] text-destructive text-center leading-tight">
                              {errors[`cost_${i}_${j}`]}
                            </p>
                          )}
                        </div>
                      </td>
                    ))}

                    {/* Supply value */}
                    <td className="px-2 py-2 border-b border-l border-border bg-primary/5">
                      <div className="space-y-0.5">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={src.supply}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateSource(i, "supply", isNaN(val) ? 0 : val);
                          }}
                          className={cn(
                            "h-7 text-center text-sm font-semibold tabular-nums",
                            errors[`source_supply_${i}`] && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        {errors[`source_supply_${i}`] && (
                          <p className="text-[10px] text-destructive text-center leading-tight">
                            {errors[`source_supply_${i}`]}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Add source row */}
                <tr className="bg-background">
                  <td colSpan={destinations.length + 2} className="px-4 py-2 border-b border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addSource}
                      className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t("Ajouter une source", "إضافة مصدر")}
                    </Button>
                  </td>
                </tr>
              </tbody>

              {/* ── FOOTER ROW: demand values ──────────────────────────────── */}
              <tfoot>
                <tr className="bg-primary/5">
                  <td className="sticky left-0 z-10 bg-primary/5 px-4 py-3 border-t border-r border-border">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-primary uppercase tracking-wide">
                        {t("Demande", "الطلب")}
                      </span>
                      {errors["total_demand"] && (
                        <p className="text-[10px] text-destructive">{errors["total_demand"]}</p>
                      )}
                    </div>
                  </td>
                  {destinations.map((dest, j) => (
                    <td key={j} className="px-2 py-2 border-t border-r border-border">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={dest.demand}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          updateDestination(j, "demand", isNaN(val) ? 0 : val);
                        }}
                        className={cn(
                          "h-7 text-center text-sm font-semibold tabular-nums",
                          errors[`dest_demand_${j}`] && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {errors[`dest_demand_${j}`] && (
                        <p className="text-[10px] text-destructive text-center leading-tight mt-0.5">
                          {errors[`dest_demand_${j}`]}
                        </p>
                      )}
                    </td>
                  ))}
                  {/* Supply total (read-only display) */}
                  <td className="px-4 py-3 border-t border-l border-border text-center">
                    <span className="text-xs text-muted-foreground">
                      {t("Total offre", "إجمالي العرض")}
                    </span>
                    <div className="text-sm font-bold text-primary tabular-nums">
                      {totalSupply.toLocaleString()}
                    </div>
                  </td>
                </tr>

                {/* Demand total row */}
                <tr className="bg-muted/30">
                  <td className="sticky left-0 z-10 bg-muted/30 px-4 py-2 border-r border-border text-xs text-muted-foreground font-medium">
                    {t("Total demande", "إجمالي الطلب")}
                  </td>
                  {destinations.map((dest, j) => (
                    <td key={j} className="px-2 py-2 border-r border-border text-center">
                      <span className="text-sm font-bold text-primary tabular-nums">
                        {(dest.demand || 0).toLocaleString()}
                      </span>
                    </td>
                  ))}
                  <td className="px-4 py-2 border-l border-border text-center">
                    <span className="text-xs text-muted-foreground">{t("Total demande", "إجمالي الطلب")}</span>
                    <div className="text-sm font-bold text-primary tabular-nums">
                      {totalDemand.toLocaleString()}
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Balance check alert ────────────────────────────────────────────── */}
      {isBalanced ? (
        <Alert className="border-green-200 bg-green-50 text-green-900 [&>svg]:text-green-600">
          <CheckCircle2 className="w-4 h-4" />
          <AlertTitle className="text-green-900">
            {t("Problème équilibré ✓", "المسألة متوازنة ✓")}
          </AlertTitle>
          <AlertDescription className="text-green-800">
            {t(
              `Offre totale = Demande totale = ${totalSupply.toLocaleString()} unités. Aucun ajustement nécessaire.`,
              `إجمالي العرض = إجمالي الطلب = ${totalSupply.toLocaleString()} وحدة. لا حاجة لأي تعديل.`
            )}
          </AlertDescription>
        </Alert>
      ) : totalSupply > 0 || totalDemand > 0 ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle className="text-amber-900">
            {t("Problème déséquilibré — ajustement automatique", "مسألة غير متوازنة — تعديل تلقائي")}
          </AlertTitle>
          <AlertDescription className="text-amber-800 space-y-1">
            <p>
              {t(
                `Offre totale : ${totalSupply.toLocaleString()} · Demande totale : ${totalDemand.toLocaleString()} · Écart : ${Math.abs(balanceDiff).toLocaleString()} unités`,
                `إجمالي العرض: ${totalSupply.toLocaleString()} · إجمالي الطلب: ${totalDemand.toLocaleString()} · الفرق: ${Math.abs(balanceDiff).toLocaleString()} وحدة`
              )}
            </p>
            <p className="font-medium">
              {balanceDiff > 0
                ? t(
                    `→ Une destination fictive sera ajoutée automatiquement (demande = ${balanceDiff.toLocaleString()}, coûts = 0) pour équilibrer le problème lors de la résolution.`,
                    `← سيتم إضافة وجهة وهمية تلقائياً (طلب = ${balanceDiff.toLocaleString()}، التكاليف = 0) لتوازن المسألة عند الحل.`
                  )
                : t(
                    `→ Une source fictive sera ajoutée automatiquement (offre = ${Math.abs(balanceDiff).toLocaleString()}, coûts = 0) pour équilibrer le problème lors de la résolution.`,
                    `← سيتم إضافة مصدر وهمي تلقائياً (عرض = ${Math.abs(balanceDiff).toLocaleString()}، التكاليف = 0) لتوازن المسألة عند الحل.`
                  )}
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* ── Continue button ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="w-4 h-4 shrink-0" />
          <span>
            {t(
              "Stage 1 sur 3 — Définissez vos données, puis continuez vers la solution.",
              "المرحلة 1 من 3 — حدد بياناتك، ثم تابع نحو الحل."
            )}
          </span>
        </div>
        <Button
          size="lg"
          className="w-full sm:w-auto px-8"
          onClick={handleContinue}
        >
          <Truck className="w-5 h-5 mr-2" />
          {t("Continuer vers la Solution", "المتابعة نحو الحل")}
          <ArrowRight className={cn("w-4 h-4 ml-2", isAr && "rotate-180")} />
        </Button>
      </div>

    </div>
  );
}
