// ── MRP (Material Requirements Planning) — pure computation ──────────────────
// No i18n here; all user-facing strings live in the UI layer.

export type PeriodType = "semaines" | "mois";

// ── Input shapes ──────────────────────────────────────────────────────────────
export interface MrpComponent {
  id: string;
  name: string;
  qtyPerUnit: number;    // quantity needed per unit of finished product
  stockInitial: number;
  leadTime: number;       // in periods
  lotSize: number;        // 0 = lot-for-lot (order exactly net need); else round up
}

export interface MrpProduct {
  id: string;
  name: string;
  demands: number[];      // one value per period
  stockInitial: number;
  leadTime: number;       // in periods
  lotSize: number;        // 0 = lot-for-lot
  components: MrpComponent[];
}

export interface MrpInputs {
  problemName: string;
  periodType: PeriodType;
  periodCount: number;
  products: MrpProduct[];
}

// ── Output shapes ─────────────────────────────────────────────────────────────
export interface MrpRowResult {
  besoinsBruts: number;       // gross requirements
  stockDisponible: number;    // projected available at end of period
  besoinsNets: number;        // net requirements (before new receipt)
  ordreReception: number;     // planned order receipt (arrives this period)
  ordreLancement: number;     // planned order launch (placed this period for future receipt)
}

export interface MrpAlert {
  type: "late_order";
  itemName: string;
  msgFr: string;
  msgAr: string;
}

export interface MrpItemResult {
  id: string;
  name: string;
  isComponent: boolean;
  parentName?: string;
  rows: MrpRowResult[];
  totalOrders: number;    // sum of all order receipts (units)
  lateOrders: number;     // count of orders that need launch before period 1 (urgent)
}

export interface MrpResults {
  periodLabels: string[];
  items: MrpItemResult[];
  alerts: MrpAlert[];
  totalOrdersPlanned: number;
  urgentItemCount: number;
}

// ── Core single-level MRP engine ──────────────────────────────────────────────
function runMrp(
  grossRequirements: number[],
  stockInitial: number,
  leadTime: number,
  lotSize: number,
): { rows: MrpRowResult[]; orderLaunches: number[]; lateOrders: number } {
  const n = grossRequirements.length;
  const orderReceipts = new Array(n).fill(0);
  const orderLaunches = new Array(n).fill(0);
  let lateOrders = 0;
  let prevSD = stockInitial;
  const rows: MrpRowResult[] = [];

  for (let p = 0; p < n; p++) {
    const bb = Math.max(0, grossRequirements[p]);
    // Net requirement = max(0, gross – available stock carried from previous period)
    const bn = Math.max(0, bb - prevSD);

    if (bn > 0) {
      // Round up to lot size (1 = lot-for-lot = order exactly bn)
      const effLot = lotSize > 0 ? lotSize : 1;
      const receipt = Math.ceil(bn / effLot) * effLot;
      orderReceipts[p] = receipt;

      // Schedule the launch leadTime periods before the needed receipt
      const launchP = p - leadTime;
      if (launchP >= 0) {
        orderLaunches[launchP] += receipt;
      } else {
        // Order should have been placed before the planning horizon starts
        lateOrders++;
      }
    }

    const sd = prevSD - bb + orderReceipts[p];
    rows.push({
      besoinsBruts: bb,
      stockDisponible: Math.max(0, sd),
      besoinsNets: bn,
      ordreReception: orderReceipts[p],
      ordreLancement: orderLaunches[p],
    });
    prevSD = Math.max(0, sd);
  }

  return { rows, orderLaunches, lateOrders };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function buildPeriodLabels(periodType: PeriodType, count: number): string[] {
  const prefix = periodType === "semaines" ? "S" : "M";
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
}

// ── Main MRP explosion ────────────────────────────────────────────────────────
export function computeMrp(inputs: MrpInputs): MrpResults {
  const { periodCount, products } = inputs;
  const periodLabels = buildPeriodLabels(inputs.periodType, periodCount);

  const items: MrpItemResult[] = [];
  const alerts: MrpAlert[] = [];
  let totalOrdersPlanned = 0;
  let urgentItemCount = 0;

  for (const product of products) {
    // Pad demands to periodCount
    const demands = Array.from({ length: periodCount }, (_, i) => product.demands[i] ?? 0);

    const { rows, orderLaunches, lateOrders } = runMrp(
      demands, product.stockInitial, product.leadTime, product.lotSize,
    );

    const totalOrders = rows.reduce((s, r) => s + r.ordreReception, 0);
    totalOrdersPlanned += totalOrders;

    if (lateOrders > 0) {
      urgentItemCount++;
      alerts.push({
        type: "late_order",
        itemName: product.name,
        msgFr: `${product.name} : ${lateOrders} ordre(s) doit être lancé avant le début de l'horizon de planification. Action immédiate requise.`,
        msgAr: `${product.name} : يجب إطلاق ${lateOrders} أمر(أوامر) قبل بداية أفق التخطيط. إجراء فوري مطلوب.`,
      });
    }

    items.push({
      id: product.id,
      name: product.name,
      isComponent: false,
      rows,
      totalOrders,
      lateOrders,
    });

    // MRP explosion: derive component gross requirements from parent order launches
    for (const comp of product.components) {
      const compGrossReqs = orderLaunches.map(launch => launch * comp.qtyPerUnit);

      const compRes = runMrp(
        compGrossReqs, comp.stockInitial, comp.leadTime, comp.lotSize,
      );

      const compTotal = compRes.rows.reduce((s, r) => s + r.ordreReception, 0);
      totalOrdersPlanned += compTotal;

      if (compRes.lateOrders > 0) {
        urgentItemCount++;
        alerts.push({
          type: "late_order",
          itemName: comp.name,
          msgFr: `Composant "${comp.name}" (→ ${product.name}) : ${compRes.lateOrders} ordre(s) hors horizon de planification.`,
          msgAr: `مكوّن "${comp.name}" (← ${product.name}) : ${compRes.lateOrders} أمر(أوامر) خارج أفق التخطيط.`,
        });
      }

      items.push({
        id: `${product.id}-${comp.id}`,
        name: comp.name,
        isComponent: true,
        parentName: product.name,
        rows: compRes.rows,
        totalOrders: compTotal,
        lateOrders: compRes.lateOrders,
      });
    }
  }

  return { periodLabels, items, alerts, totalOrdersPlanned, urgentItemCount };
}

export function mrpOverallStatus(r: MrpResults): "good" | "warning" | "critical" {
  if (r.urgentItemCount > 0) return "critical";
  if (r.totalOrdersPlanned > 0) return "warning";
  return "good";
}

// ── Bilingual analysis & recommendations generators ───────────────────────────
export function generateMrpAnalysis(results: MrpResults): Array<{ fr: string; ar: string }> {
  const lines: Array<{ fr: string; ar: string }> = [];

  if (results.urgentItemCount > 0) {
    lines.push({
      fr: `⚠ Plan MRP critique : ${results.urgentItemCount} article(s) nécessitent des ordres d'urgence hors horizon de planification.`,
      ar: `⚠ خطة MRP حرجة: ${results.urgentItemCount} صنف(أصناف) يتطلب أوامر عاجلة خارج أفق التخطيط.`,
    });
  }

  for (const item of results.items) {
    const orderPeriods = item.rows.filter(r => r.ordreReception > 0).length;
    if (item.totalOrders > 0) {
      lines.push({
        fr: `${item.isComponent ? "Composant" : "Produit fini"} "${item.name}" : ${orderPeriods} commande(s) planifiée(s) totalisant ${item.totalOrders} unités.`,
        ar: `${item.isComponent ? "مكوّن" : "منتج نهائي"} "${item.name}" : ${orderPeriods} أمر(أوامر) مُخطَّط(ة) بإجمالي ${item.totalOrders} وحدة.`,
      });
    }
    if (item.lateOrders > 0) {
      lines.push({
        fr: `🔴 "${item.name}" : ${item.lateOrders} ordre(s) dépasse le délai — émission immédiate obligatoire.`,
        ar: `🔴 "${item.name}" : ${item.lateOrders} أمر(أوامر) تجاوز الموعد — الإصدار الفوري إلزامي.`,
      });
    }
  }

  if (lines.length === 0) {
    lines.push({
      fr: "✅ Tous les articles sont couverts par le stock disponible — aucun ordre d'approvisionnement n'est nécessaire sur cet horizon.",
      ar: "✅ جميع الأصناف مغطاة بالمخزون المتاح — لا يلزم أي أمر توريد خلال هذا الأفق.",
    });
  }

  return lines;
}

export function generateMrpRecommendations(
  results: MrpResults,
): Array<{ icon: string; fr: string; ar: string; descFr: string; descAr: string }> {
  const recos: Array<{ icon: string; fr: string; ar: string; descFr: string; descAr: string }> = [];

  if (results.urgentItemCount > 0) {
    recos.push({
      icon: "🚨",
      fr: "Lancer les ordres d'urgence immédiatement",
      ar: "إطلاق أوامر الطوارئ فوراً",
      descFr: "Des commandes doivent être passées avant le début de l'horizon de planification. Contactez vos fournisseurs ou lancez la production immédiatement.",
      descAr: "يجب إصدار طلبات قبل بداية أفق التخطيط. تواصل مع مورديك أو أطلق الإنتاج فوراً.",
    });
  }

  if (results.totalOrdersPlanned > 0) {
    recos.push({
      icon: "📋",
      fr: "Respecter scrupuleusement les dates de lancement",
      ar: "الالتزام الدقيق بمواعيد إطلاق الأوامر",
      descFr: "Chaque ordre de lancement planifié doit être émis à la date prévue pour garantir la réception dans les délais et éviter les ruptures de production.",
      descAr: "يجب إصدار كل أمر إطلاق مخطط في موعده لضمان الاستلام في الوقت المحدد وتجنب انقطاع الإنتاج.",
    });

    recos.push({
      icon: "📦",
      fr: "Réévaluer les tailles de lot et le stock tampon",
      ar: "إعادة تقييم أحجام الدفعات ومخزون الأمان",
      descFr: "Des tailles de lot inappropriées créent du sur-stock coûteux ou des pénuries. Évaluez la politique lot-pour-lot ou ajustez les niveaux de stock de sécurité.",
      descAr: "أحجام الدفعات غير المناسبة تُنشئ مخزوناً زائداً مكلفاً أو نقصاً حاداً. قيّم سياسة الدفعة الفردية أو اضبط مستويات مخزون الأمان.",
    });
  }

  recos.push({
    icon: "🔄",
    fr: "Actualiser le plan MRP à chaque nouvelle période",
    ar: "تحديث خطة MRP مع كل فترة جديدة",
    descFr: "La demande réelle dévie souvent des prévisions. Mettez à jour les données à chaque période pour recalculer les ordres et rester en phase avec la réalité.",
    descAr: "كثيراً ما يختلف الطلب الفعلي عن التوقعات. حدّث البيانات مع كل فترة لإعادة حساب الأوامر والبقاء متوافقاً مع الواقع.",
  });

  return recos;
}
