export interface TemplateVariable {
  name: string;
  nameAr: string;
  coefficient: number;
  unit: string;
}

export interface TemplateConstraint {
  name: string;
  nameAr: string;
  coefficients: number[];
  operator: "<=" | ">=" | "=";
  rhs: number;
  unit?: string | null;
}

export interface Template {
  sector: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  objectiveType: "maximize" | "minimize";
  variables: TemplateVariable[];
  constraints: TemplateConstraint[];
}

export const templates: Template[] = [
  {
    sector: "industry",
    name: "Industrie (صناعة)",
    nameAr: "صناعة",
    description: "Une usine produisant 2 produits. Maximiser le profit face aux contraintes de machine et matières premières.",
    descriptionAr: "مصنع يُنتج منتجَين. تعظيم الربح مع قيود ساعات الآلة والمواد الخام.",
    objectiveType: "maximize",
    variables: [
      { name: "Produit A", nameAr: "منتج أ", coefficient: 5000, unit: "DA/unité" },
      { name: "Produit B", nameAr: "منتج ب", coefficient: 4000, unit: "DA/unité" },
    ],
    constraints: [
      {
        name: "Heures machine",
        nameAr: "ساعات الآلة",
        coefficients: [2, 1],
        operator: "<=",
        rhs: 100,
        unit: "heures",
      },
      {
        name: "Matières premières",
        nameAr: "المواد الخام",
        coefficients: [1, 2],
        operator: "<=",
        rhs: 80,
        unit: "kg",
      },
      {
        name: "Capacité de stockage",
        nameAr: "طاقة التخزين",
        coefficients: [1, 1],
        operator: "<=",
        rhs: 60,
        unit: "unités",
      },
    ],
  },
  {
    sector: "trade",
    name: "Commerce (تجارة)",
    nameAr: "تجارة",
    description: "Un magasin gérant 3 types de produits. Maximiser le chiffre d'affaires sous contraintes de stockage et budget.",
    descriptionAr: "متجر يدير 3 أنواع من المنتجات. تعظيم الإيرادات في ظل قيود التخزين والميزانية.",
    objectiveType: "maximize",
    variables: [
      { name: "Électronique", nameAr: "إلكترونيات", coefficient: 8000, unit: "DA/unité" },
      { name: "Vêtements", nameAr: "ملابس", coefficient: 5000, unit: "DA/unité" },
      { name: "Alimentaire", nameAr: "مواد غذائية", coefficient: 2000, unit: "DA/unité" },
    ],
    constraints: [
      {
        name: "Espace de stockage",
        nameAr: "مساحة التخزين",
        coefficients: [2, 3, 1],
        operator: "<=",
        rhs: 120,
        unit: "m²",
      },
      {
        name: "Budget d'achat",
        nameAr: "ميزانية الشراء",
        coefficients: [6000, 4000, 1000],
        operator: "<=",
        rhs: 300000,
        unit: "DA",
      },
      {
        name: "Capacité de vente",
        nameAr: "طاقة البيع",
        coefficients: [1, 1, 1],
        operator: "<=",
        rhs: 80,
        unit: "unités",
      },
    ],
  },
  {
    sector: "services",
    name: "Services (خدمات)",
    nameAr: "خدمات",
    description: "Une société de services allouant les heures de travail sur 2 types de prestations. Maximiser le profit.",
    descriptionAr: "شركة خدمات تُوزّع ساعات العمل على نوعَين من الخدمات. تعظيم الربح.",
    objectiveType: "maximize",
    variables: [
      { name: "Conseil en gestion", nameAr: "استشارة إدارية", coefficient: 15000, unit: "DA/jour" },
      { name: "Formation professionnelle", nameAr: "تدريب مهني", coefficient: 8000, unit: "DA/jour" },
    ],
    constraints: [
      {
        name: "Heures de travail",
        nameAr: "ساعات العمل",
        coefficients: [8, 6],
        operator: "<=",
        rhs: 240,
        unit: "h/mois",
      },
      {
        name: "Coût d'exploitation",
        nameAr: "تكلفة التشغيل",
        coefficients: [3000, 1500],
        operator: "<=",
        rhs: 60000,
        unit: "DA/mois",
      },
      {
        name: "Capacité formateurs",
        nameAr: "طاقة المدربين",
        coefficients: [1, 2],
        operator: "<=",
        rhs: 30,
        unit: "jours",
      },
    ],
  },
  {
    sector: "agriculture",
    name: "Agriculture (فلاحة)",
    nameAr: "فلاحة",
    description: "Une exploitation agricole répartissant terres et eau sur 2 cultures. Maximiser le profit de la récolte.",
    descriptionAr: "مزرعة تُوزّع الأراضي والمياه على محصولَين. تعظيم أرباح الحصاد.",
    objectiveType: "maximize",
    variables: [
      { name: "Blé", nameAr: "قمح", coefficient: 3500, unit: "DA/hectare" },
      { name: "Pomme de terre", nameAr: "بطاطا", coefficient: 6000, unit: "DA/hectare" },
    ],
    constraints: [
      {
        name: "Superficie agricole",
        nameAr: "المساحة الزراعية",
        coefficients: [1, 1],
        operator: "<=",
        rhs: 100,
        unit: "hectares",
      },
      {
        name: "Ressources en eau",
        nameAr: "موارد المياه",
        coefficients: [3, 5],
        operator: "<=",
        rhs: 400,
        unit: "m³/jour",
      },
      {
        name: "Main d'œuvre",
        nameAr: "العمالة",
        coefficients: [2, 4],
        operator: "<=",
        rhs: 280,
        unit: "jours/homme",
      },
    ],
  },
  {
    sector: "custom",
    name: "Personnalisé",
    nameAr: "مخصص",
    description: "Commencez de zéro. Définissez vos propres variables, contraintes et objectif.",
    descriptionAr: "ابدأ من الصفر. حدد متغيراتك وقيودك وهدفك بنفسك.",
    objectiveType: "maximize",
    variables: [
      { name: "X1", nameAr: "س١", coefficient: 1, unit: "" },
      { name: "X2", nameAr: "س٢", coefficient: 1, unit: "" },
    ],
    constraints: [
      {
        name: "Contrainte 1",
        nameAr: "القيد 1",
        coefficients: [1, 1],
        operator: "<=",
        rhs: 100,
        unit: null,
      },
    ],
  },
];
