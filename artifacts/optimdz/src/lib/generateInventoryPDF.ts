import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { EOQResult, ReorderResult, ABCResult, InventoryMode } from "./inventoryAlgorithm";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface InventoryPDFOptions {
  mode: InventoryMode;
  problemName: string;
  sector: string;
  eoqResults?: EOQResult[];
  reorderResults?: ReorderResult[];
  abcResults?: ABCResult[];
  analysisLines: string[];
  suggestions: { icon: string; title: string; desc: string }[];
  managerName?: string;
  institutionName?: string;
  onProgress?: (step: string, pct: number) => void;
}

// ── Colour palette ─────────────────────────────────────────────────────────────
const C = {
  primary:      "#004d40",
  primaryLight: "#e0f2f1",
  accent:       "#f4a261",
  bg:           "#fbf8f1",
  text:         "#0c2621",
  muted:        "#5f7b77",
  border:       "#c8dad6",
  white:        "#ffffff",
  green:        "#2e7d32",
  greenLight:   "#e8f5e9",
  red:          "#c62828",
  redLight:     "#ffebee",
  blue:         "#1565c0",
  orange:       "#e65100",
};

function genId(): string {
  return `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function fNum(n: number, decimals = 0): string {
  return n.toLocaleString("fr-DZ", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function fDA(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000
    ? (abs / 1_000_000).toFixed(2) + " M DA"
    : abs >= 1_000
    ? (abs / 1_000).toFixed(1) + " k DA"
    : Math.round(abs).toLocaleString("fr-DZ") + " DA";
  return s;
}

function modeLabel(mode: InventoryMode) {
  return {
    eoq:     { ar: "الكمية الاقتصادية للطلب (EOQ)", fr: "Quantité Économique de Commande (EOQ)" },
    reorder: { ar: "نقطة إعادة الطلب (ROP)", fr: "Point de Commande (ROP)" },
    abc:     { ar: "تصنيف ABC", fr: "Classification ABC" },
  }[mode];
}

function catColor(cat: "A" | "B" | "C") {
  return { A: C.green, B: C.blue, C: C.orange }[cat];
}

// ── Page shell ────────────────────────────────────────────────────────────────
function pageShell(content: string, pg: number, total: number, subtitle: string) {
  return `
<div style="width:794px;min-height:1123px;background:${C.bg};font-family:'Cairo','Inter',sans-serif;
  color:${C.text};box-sizing:border-box;display:flex;flex-direction:column;">
  <div style="background:${C.primary};padding:10px 32px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:28px;height:28px;background:${C.white};border-radius:6px;display:flex;align-items:center;justify-content:center;">
        <div style="width:16px;height:16px;background:${C.primary};border-radius:3px;"></div>
      </div>
      <span style="color:${C.white};font-weight:700;font-size:16px;">OptimDZ</span>
    </div>
    <span style="color:rgba(255,255,255,0.75);font-size:11px;">${subtitle}</span>
    <span style="color:rgba(255,255,255,0.6);font-size:10px;">${pg} / ${total}</span>
  </div>
  <div style="flex:1;padding:28px 36px 20px;display:flex;flex-direction:column;gap:0;">${content}</div>
  <div style="border-top:1px solid ${C.border};padding:8px 36px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
    <span style="font-size:9px;color:${C.muted};">نظام OptimDZ — إدارة سلاسل الإمداد · Gestion de la Chaîne d'Approvisionnement</span>
    <span style="font-size:9px;color:${C.muted};">www.optimdz.replit.app</span>
  </div>
</div>`;
}

function secTitle(ar: string, fr: string) {
  return `<div style="margin-bottom:12px;margin-top:20px;">
    <h2 style="font-size:15px;font-weight:800;color:${C.primary};margin:0 0 4px;">${ar} · ${fr}</h2>
    <div style="width:40px;height:3px;background:${C.accent};border-radius:2px;"></div>
  </div>`;
}

// ── Page 1: Cover ─────────────────────────────────────────────────────────────
function buildCover(opts: InventoryPDFOptions, reportId: string, generatedAt: string, totalPages: number) {
  const lbl = modeLabel(opts.mode);
  const kpis: { label: string; value: string; color: string }[] = [];

  if (opts.mode === "eoq" && opts.eoqResults?.length) {
    const totalCost = opts.eoqResults.reduce((s, r) => s + r.totalCost, 0);
    const avgEOQ = opts.eoqResults.reduce((s, r) => s + r.eoq, 0) / opts.eoqResults.length;
    kpis.push(
      { label: "إجمالي التكلفة السنوية / Coût Total Annuel", value: fDA(totalCost), color: C.accent },
      { label: "متوسط EOQ / EOQ Moyen", value: fNum(avgEOQ, 1) + " وحدة", color: C.primary },
      { label: "عدد المنتجات / Nb. Produits", value: String(opts.eoqResults.length), color: C.primary },
    );
  } else if (opts.mode === "reorder" && opts.reorderResults?.length) {
    kpis.push(
      { label: "عدد المنتجات / Nb. Produits", value: String(opts.reorderResults.length), color: C.primary },
      { label: "أقصى نقطة إعادة طلب / ROP Max", value: fNum(Math.max(...opts.reorderResults.map(r => r.reorderPoint))) + " وحدة", color: C.accent },
    );
  } else if (opts.mode === "abc" && opts.abcResults?.length) {
    const catA = opts.abcResults.filter(r => r.category === "A").length;
    const catB = opts.abcResults.filter(r => r.category === "B").length;
    const catC = opts.abcResults.filter(r => r.category === "C").length;
    kpis.push(
      { label: "الفئة A — أهمية عالية", value: `${catA} منتج`, color: C.green },
      { label: "الفئة B — أهمية متوسطة", value: `${catB} منتج`, color: C.blue },
      { label: "الفئة C — أهمية منخفضة", value: `${catC} منتج`, color: C.orange },
      { label: "إجمالي المنتجات / Total", value: String(opts.abcResults.length), color: C.primary },
    );
  }

  return `
<div style="width:794px;min-height:1123px;background:${C.primary};font-family:'Cairo','Inter',sans-serif;
  color:${C.white};box-sizing:border-box;display:flex;flex-direction:column;">
  <div style="height:6px;background:${C.accent};"></div>
  <div style="padding:28px 40px 0;display:flex;align-items:center;gap:12px;">
    <div style="width:40px;height:40px;background:${C.white};border-radius:10px;display:flex;align-items:center;justify-content:center;">
      <div style="width:22px;height:22px;background:${C.primary};border-radius:5px;"></div>
    </div>
    <div>
      <div style="font-size:22px;font-weight:800;letter-spacing:1px;">OptimDZ</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-top:1px;">نظام دعم القرار للمؤسسة الجزائرية</div>
    </div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 40px;text-align:center;gap:14px;">
    <div style="font-size:11px;letter-spacing:3px;color:${C.accent};text-transform:uppercase;font-weight:600;">تقرير رسمي · Rapport Officiel</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.6);">إدارة سلاسل الإمداد · Gestion de la Chaîne d'Approvisionnement</div>
    <div style="font-size:24px;font-weight:800;line-height:1.3;direction:rtl;">${lbl.ar}</div>
    <div style="font-size:15px;font-weight:400;color:rgba(255,255,255,0.8);">${lbl.fr}</div>
    <div style="width:60px;height:3px;background:${C.accent};border-radius:2px;margin:4px 0;"></div>
    <div style="font-size:22px;font-weight:700;color:${C.accent};">${opts.problemName}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:580px;margin-top:8px;">
      ${kpis.map(k => `
        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:12px 16px;text-align:left;">
          <div style="font-size:9px;color:rgba(255,255,255,0.55);margin-bottom:4px;">${k.label}</div>
          <div style="font-size:18px;font-weight:800;color:${C.accent};">${k.value}</div>
        </div>`).join("")}
    </div>
  </div>
  <div style="padding:0 40px 28px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
    ${[
      ["المسألة / Problème", opts.problemName],
      ["القطاع / Secteur", opts.sector],
      ["النوع / Type", lbl.fr],
      ["المسؤول / Responsable", opts.managerName || "—"],
      ["المؤسسة / Institution", opts.institutionName || "—"],
      ["رقم التقرير / N° Rapport", reportId],
      ["تاريخ الإصدار / Date", generatedAt],
      ["عدد الصفحات / Pages", String(totalPages)],
    ].map(([l, v]) => `
      <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:11px 14px;">
        <div style="font-size:9px;color:rgba(255,255,255,0.55);margin-bottom:4px;">${l}</div>
        <div style="font-size:11.5px;font-weight:700;">${v}</div>
      </div>`).join("")}
  </div>
  <div style="height:6px;background:rgba(255,255,255,0.15);"></div>
</div>`;
}

// ── Page 2: Results ────────────────────────────────────────────────────────────
function buildResultsPage(opts: InventoryPDFOptions, totalPages: number) {
  const lbl = modeLabel(opts.mode);
  let tableHtml = "";

  if (opts.mode === "eoq" && opts.eoqResults?.length) {
    tableHtml = `
      ${secTitle("النتائج الرقمية", "Résultats Numériques")}
      <table style="width:100%;border-collapse:collapse;font-size:8.5px;margin-bottom:16px;">
        <thead>
          <tr style="background:${C.primary};color:${C.white};">
            <th style="padding:6px 8px;text-align:right;font-weight:700;">المنتج</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;">الطلب D</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;">EOQ (وحدة)</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;">طلبات/سنة</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;">دورة (يوم)</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;">تكلفة الطلب</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;">تكلفة الاحتفاظ</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;background:${C.accent};color:${C.text};">التكلفة الإجمالية</th>
          </tr>
        </thead>
        <tbody>
          ${opts.eoqResults.map((r, i) => `
            <tr style="background:${i % 2 === 0 ? C.white : "#f7f7f7"};">
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};font-weight:600;">${r.name}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;">${fNum(r.demand)}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;font-weight:700;color:${C.primary};">${fNum(r.eoq, 1)}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;">${fNum(r.ordersPerYear, 1)}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;">${fNum(r.cycleTime, 0)}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;">${fDA(r.orderingCost)}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;">${fDA(r.carryingCost)}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;font-weight:700;color:${C.green};">${fDA(r.totalCost)}</td>
            </tr>`).join("")}
          <tr style="background:${C.primaryLight};font-weight:800;">
            <td colspan="7" style="padding:6px 8px;border-top:2px solid ${C.primary};text-align:right;">الإجمالي / Total</td>
            <td style="padding:6px 8px;border-top:2px solid ${C.primary};text-align:right;font-family:monospace;color:${C.green};">
              ${fDA(opts.eoqResults.reduce((s, r) => s + r.totalCost, 0))}
            </td>
          </tr>
        </tbody>
      </table>`;
  } else if (opts.mode === "reorder" && opts.reorderResults?.length) {
    tableHtml = `
      ${secTitle("نتائج نقطة إعادة الطلب", "Résultats du Point de Commande")}
      <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:16px;">
        <thead>
          <tr style="background:${C.primary};color:${C.white};">
            <th style="padding:6px 8px;text-align:right;font-weight:700;">المنتج</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;">الطلب اليومي</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;">مهلة التسليم (يوم)</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;">الطلب خلال المهلة</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;">مخزون الأمان</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;background:${C.accent};color:${C.text};">نقطة إعادة الطلب (ROP)</th>
          </tr>
        </thead>
        <tbody>
          ${opts.reorderResults.map((r, i) => `
            <tr style="background:${i % 2 === 0 ? C.white : "#f7f7f7"};">
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};font-weight:600;">${r.name}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;">${fNum(r.dailyDemand, 1)}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;">${fNum(r.leadTime)}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;">${fNum(r.demandDuringLeadTime, 1)}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;">${fNum(r.safetyStock)}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;font-weight:800;color:${C.primary};font-size:11px;">${fNum(r.reorderPoint, 1)}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  } else if (opts.mode === "abc" && opts.abcResults?.length) {
    tableHtml = `
      ${secTitle("تصنيف ABC للمخزون", "Classification ABC des Stocks")}
      <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:16px;">
        <thead>
          <tr style="background:${C.primary};color:${C.white};">
            <th style="padding:6px 8px;text-align:center;font-weight:700;">الترتيب</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;">المنتج</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;">القيمة السنوية (DA)</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;">النسبة %</th>
            <th style="padding:6px 8px;text-align:right;font-weight:700;">التراكمي %</th>
            <th style="padding:6px 8px;text-align:center;font-weight:700;background:${C.accent};color:${C.text};">الفئة</th>
          </tr>
        </thead>
        <tbody>
          ${opts.abcResults.map((r, i) => `
            <tr style="background:${i % 2 === 0 ? C.white : "#f7f7f7"};">
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:center;font-weight:700;">${r.rank}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};font-weight:600;">${r.name}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;">${fDA(r.annualValue)}</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;">${r.percentage.toFixed(1)}%</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;">${r.cumulativePercentage.toFixed(1)}%</td>
              <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:center;">
                <span style="background:${catColor(r.category)}22;color:${catColor(r.category)};font-weight:800;font-size:13px;padding:2px 10px;border-radius:6px;border:1px solid ${catColor(r.category)}44;">${r.category}</span>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  }

  const content = `
    ${secTitle("الوحدة", lbl.fr)}
    <div style="font-size:10px;color:${C.muted};margin-bottom:16px;">${opts.problemName} — ${opts.sector}</div>
    ${tableHtml}`;

  return pageShell(content, 2, totalPages, `${lbl.ar} · ${lbl.fr}`);
}

// ── Page 3: Analysis + Recommendations ───────────────────────────────────────
function buildAnalysisPage(opts: InventoryPDFOptions, totalPages: number) {
  const lbl = modeLabel(opts.mode);

  const analysisHtml = opts.analysisLines.map(line => `
    <div style="background:${C.primaryLight};border:1px solid ${C.border};border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:10px;line-height:1.6;">
      ${line}
    </div>`).join("");

  const suggestionsHtml = opts.suggestions.map((s, i) => `
    <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 16px;margin-bottom:10px;border-left:4px solid ${i === 0 ? C.green : i === 1 ? C.accent : C.blue};">
      <div style="font-size:11px;font-weight:700;margin-bottom:4px;">${s.icon} ${s.title}</div>
      <div style="font-size:9.5px;color:${C.muted};line-height:1.6;">${s.desc}</div>
    </div>`).join("");

  const content = `
    ${secTitle("تحليل الوضع", "Analyse de la Situation")}
    ${analysisHtml}
    ${secTitle("التوصيات الإدارية", "Recommandations Managériales")}
    ${suggestionsHtml}`;

  return pageShell(content, 3, totalPages, `${lbl.ar} · ${lbl.fr}`);
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function generateInventoryPDF(opts: InventoryPDFOptions): Promise<void> {
  const reportId = genId();
  const generatedAt = new Date().toLocaleDateString("fr-DZ");
  const totalPages = 3;
  const lbl = modeLabel(opts.mode);

  const pages = [
    buildCover(opts, reportId, generatedAt, totalPages),
    buildResultsPage(opts, totalPages),
    buildAnalysisPage(opts, totalPages),
  ];

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = 794;
  const H = 1123;

  for (let i = 0; i < pages.length; i++) {
    opts.onProgress?.(`Page ${i + 1}/${totalPages}`, Math.round((i / totalPages) * 80));
    const container = document.createElement("div");
    container.style.cssText = `position:fixed;left:-9999px;top:0;width:${W}px;z-index:-1;`;
    container.innerHTML = pages[i];
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        width: W,
        height: H,
        logging: false,
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 595.28, 841.89);
    } finally {
      document.body.removeChild(container);
    }
  }

  opts.onProgress?.("Finalisation…", 95);
  const safeName = opts.problemName.replace(/[^a-z0-9\u0600-\u06FF]/gi, "_").substring(0, 40);
  pdf.save(`OptimDZ_${opts.mode.toUpperCase()}_${safeName}_${reportId}.pdf`);
  opts.onProgress?.("Terminé", 100);
}
