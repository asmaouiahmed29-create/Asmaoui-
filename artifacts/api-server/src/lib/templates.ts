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
    name: "Manufacturing Profit Maximization",
    nameAr: "تعظيم الربح الصناعي",
    description: "Maximize profit from two industrial products given machine hours and raw material constraints.",
    descriptionAr: "تعظيم الربح من منتجَين صناعيَّين مع مراعاة قيود ساعات الآلة والمواد الخام.",
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
        name: "Matière première",
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
    sector: "agriculture",
    name: "Agricultural Resource Allocation",
    nameAr: "توزيع الموارد الزراعية",
    description: "Maximize revenue from crop production given land area, water, and labor constraints.",
    descriptionAr: "تعظيم الإيرادات من إنتاج المحاصيل مع مراعاة قيود المساحة والمياه والعمالة.",
    objectiveType: "maximize",
    variables: [
      { name: "Blé", nameAr: "قمح", coefficient: 3500, unit: "DA/hectare" },
      { name: "Orge", nameAr: "شعير", coefficient: 2800, unit: "DA/hectare" },
      { name: "Pomme de terre", nameAr: "بطاطا", coefficient: 6000, unit: "DA/hectare" },
    ],
    constraints: [
      {
        name: "Superficie agricole",
        nameAr: "المساحة الزراعية",
        coefficients: [1, 1, 1],
        operator: "<=",
        rhs: 150,
        unit: "hectares",
      },
      {
        name: "Ressources en eau",
        nameAr: "موارد المياه",
        coefficients: [3, 2, 5],
        operator: "<=",
        rhs: 450,
        unit: "m³/jour",
      },
      {
        name: "Main d'oeuvre",
        nameAr: "العمالة",
        coefficients: [2, 1, 4],
        operator: "<=",
        rhs: 300,
        unit: "jours/homme",
      },
    ],
  },
  {
    sector: "trade",
    name: "Trade Cost Minimization",
    nameAr: "تقليل تكاليف التجارة",
    description: "Minimize logistics cost while meeting minimum demand requirements for multiple product lines.",
    descriptionAr: "تقليل تكاليف اللوجستيات مع تلبية متطلبات الطلب الأدنى لخطوط المنتجات المتعددة.",
    objectiveType: "minimize",
    variables: [
      { name: "Transport routier", nameAr: "النقل البري", coefficient: 150, unit: "DA/km" },
      { name: "Transport ferroviaire", nameAr: "النقل بالسكك الحديدية", coefficient: 80, unit: "DA/km" },
    ],
    constraints: [
      {
        name: "Demande minimale Nord",
        nameAr: "الطلب الأدنى للشمال",
        coefficients: [2, 1],
        operator: ">=",
        rhs: 200,
        unit: "tonnes",
      },
      {
        name: "Demande minimale Sud",
        nameAr: "الطلب الأدنى للجنوب",
        coefficients: [1, 3],
        operator: ">=",
        rhs: 180,
        unit: "tonnes",
      },
      {
        name: "Capacité totale",
        nameAr: "الطاقة الإجمالية",
        coefficients: [1, 1],
        operator: "<=",
        rhs: 300,
        unit: "tonnes",
      },
    ],
  },
  {
    sector: "custom",
    name: "Custom Problem",
    nameAr: "مشكلة مخصصة",
    description: "Start from scratch with a blank problem. Define your own variables, constraints and objective.",
    descriptionAr: "ابدأ من الصفر بمشكلة فارغة. حدد متغيراتك وقيودك وهدفك بنفسك.",
    objectiveType: "maximize",
    variables: [
      { name: "x1", nameAr: "س١", coefficient: 1, unit: "unités" },
      { name: "x2", nameAr: "س٢", coefficient: 1, unit: "unités" },
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
