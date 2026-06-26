import { Factory, ShoppingBag, Users, Leaf, PenLine, ArrowRight, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/utils";

export type SectorKey = "industry" | "trade" | "services" | "agriculture" | "custom";

interface SectorCard {
  key: SectorKey;
  icon: React.ReactNode;
  nameFr: string;
  nameAr: string;
  descFr: string;
  descAr: string;
  objectiveFr: string;
  objectiveAr: string;
  varsFr: string;
  varsAr: string;
  color: string;
  iconBg: string;
}

const SECTORS: SectorCard[] = [
  {
    key: "industry",
    icon: <Factory className="w-7 h-7" />,
    nameFr: "Industrie",
    nameAr: "صناعة",
    descFr: "Optimisez la production d'une usine avec 2 produits.",
    descAr: "حسّن إنتاج مصنع بمنتجَين.",
    objectiveFr: "Maximiser le profit",
    objectiveAr: "تعظيم الربح",
    varsFr: "Heures machine · Matières premières · Stockage",
    varsAr: "ساعات الآلة · المواد الخام · التخزين",
    color: "border-blue-200 hover:border-blue-400 hover:bg-blue-50/60",
    iconBg: "bg-blue-100 text-blue-700",
  },
  {
    key: "trade",
    icon: <ShoppingBag className="w-7 h-7" />,
    nameFr: "Commerce",
    nameAr: "تجارة",
    descFr: "Gérez les stocks d'un magasin avec 3 types de produits.",
    descAr: "أدر مخزون متجر بـ 3 أنواع من المنتجات.",
    objectiveFr: "Maximiser le chiffre d'affaires",
    objectiveAr: "تعظيم الإيرادات",
    varsFr: "Espace de stockage · Budget · Capacité de vente",
    varsAr: "مساحة التخزين · الميزانية · طاقة البيع",
    color: "border-amber-200 hover:border-amber-400 hover:bg-amber-50/60",
    iconBg: "bg-amber-100 text-amber-700",
  },
  {
    key: "services",
    icon: <Users className="w-7 h-7" />,
    nameFr: "Services",
    nameAr: "خدمات",
    descFr: "Allouez les heures de travail sur 2 types de prestations.",
    descAr: "وزّع ساعات العمل على نوعَين من الخدمات.",
    objectiveFr: "Maximiser le profit",
    objectiveAr: "تعظيم الربح",
    varsFr: "Heures de travail · Coûts d'exploitation · Formateurs",
    varsAr: "ساعات العمل · تكاليف التشغيل · المدربون",
    color: "border-purple-200 hover:border-purple-400 hover:bg-purple-50/60",
    iconBg: "bg-purple-100 text-purple-700",
  },
  {
    key: "agriculture",
    icon: <Leaf className="w-7 h-7" />,
    nameFr: "Agriculture",
    nameAr: "فلاحة",
    descFr: "Répartissez terres et eau sur 2 cultures pour maximiser la récolte.",
    descAr: "وزّع الأراضي والمياه على محصولَين لتعظيم الحصاد.",
    objectiveFr: "Maximiser le profit de récolte",
    objectiveAr: "تعظيم أرباح الحصاد",
    varsFr: "Superficie · Eau · Main d'œuvre",
    varsAr: "المساحة · المياه · العمالة",
    color: "border-green-200 hover:border-green-400 hover:bg-green-50/60",
    iconBg: "bg-green-100 text-green-700",
  },
];

interface TemplateSelectorProps {
  onSelect: (sector: SectorKey) => void;
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const { t, language } = useLanguage();

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {t("Choisissez votre secteur", "اختر قطاعك")}
        </h1>
        <p className="text-muted-foreground mt-2 text-base">
          {t(
            "Sélectionnez un modèle pré-rempli avec des valeurs algériennes réalistes, ou commencez de zéro.",
            "اختر نموذجاً مُعبَّأً مسبقاً بقيم جزائرية واقعية، أو ابدأ من الصفر."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {SECTORS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.key)}
            className={cn(
              "group relative flex flex-col gap-4 rounded-xl border-2 bg-card p-6 text-left transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              s.color,
              language === "ar" && "text-right"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className={cn("rounded-xl p-3 shrink-0", s.iconBg)}>
                {s.icon}
              </div>
              <ChevronRight
                className={cn(
                  "w-5 h-5 text-muted-foreground mt-1 shrink-0 transition-transform group-hover:translate-x-1",
                  language === "ar" && "rotate-180 group-hover:-translate-x-1 group-hover:translate-x-0"
                )}
              />
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl font-bold text-foreground">
                  {language === "ar" ? s.nameAr : s.nameFr}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  {language === "ar" ? s.nameFr : s.nameAr}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {language === "ar" ? s.descAr : s.descFr}
              </p>
            </div>

            <div className="space-y-1 border-t pt-3 mt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("Objectif", "الهدف")}:
                </span>
                <span className="text-xs font-medium text-foreground">
                  {language === "ar" ? s.objectiveAr : s.objectiveFr}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("Contraintes", "القيود")}:
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {language === "ar" ? s.varsAr : s.varsFr}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="border-t pt-6">
        <button
          type="button"
          onClick={() => onSelect("custom")}
          className={cn(
            "group w-full flex items-center gap-4 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-5 transition-all duration-200 hover:border-muted-foreground/60 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            language === "ar" ? "flex-row-reverse text-right" : "text-left"
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
                "Pour les utilisateurs avancés — définissez vos propres variables et contraintes.",
                "للمستخدمين المتقدمين — حدد متغيراتك وقيودك بنفسك."
              )}
            </p>
          </div>
          <ArrowRight
            className={cn(
              "w-5 h-5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-1",
              language === "ar" && "rotate-180 group-hover:-translate-x-1 group-hover:translate-x-0"
            )}
          />
        </button>
      </div>
    </div>
  );
}
