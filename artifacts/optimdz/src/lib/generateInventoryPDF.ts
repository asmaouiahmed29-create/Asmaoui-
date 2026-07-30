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
  suggestions: { icon: string; title: string; desc: string; bgHex?: string; borderHex?: string }[];
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
  blueLight:    "#e3f2fd",
  orange:       "#e65100",
  orangeLight:  "#fff3e0",
  amberBorder:  "#f59e0b",
  amberBg:      "#fffbeb",
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

function catLightBg(cat: "A" | "B" | "C") {
  return { A: C.greenLight, B: C.blueLight, C: C.orangeLight }[cat];
}

// ── Pareto SVG chart ──────────────────────────────────────────────────────────
function buildParetoSvg(results: ABCResult[]): string {
  const W = 680, H = 200;
  const mL = 52, mR = 46, mT = 15, mB = 58;
  const cW = W - mL - mR;
  const cH = H - mT - mB;
  const n = results.length;
  const slot = cW / n;
  const barW = Math.max(8, Math.floor(slot * 0.6));
  const maxVal = results[0]?.annualValue ?? 1;

  // Grid lines & left Y axis (values)
  const gridAndYLeft = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    const y = mT + cH * (1 - pct);
    const val = maxVal * pct;
    const lbl = val >= 1_000_000 ? (val / 1_000_000).toFixed(1) + "M"
              : val >= 1_000     ? (val / 1_000).toFixed(0) + "k"
              : Math.round(val).toString();
    return `<line x1="${mL}" y1="${y.toFixed(1)}" x2="${mL + cW}" y2="${y.toFixed(1)}"
              stroke="#e0e0e0" stroke-width="0.5" stroke-dasharray="3,3"/>
            <text x="${(mL - 4).toFixed(1)}" y="${(y + 3.5).toFixed(1)}"
              font-size="7" text-anchor="end" fill="${C.muted}">${lbl}</text>`;
  }).join("");

  // Right Y axis (percentage)
  const yRight = [0, 25, 50, 75, 100].map(pct => {
    const y = mT + cH * (1 - pct / 100);
    return `<text x="${(W - mR + 4).toFixed(1)}" y="${(y + 3.5).toFixed(1)}"
      font-size="7" text-anchor="start" fill="${C.accent}">${pct}%</text>`;
  }).join("");

  // Bars
  const bars = results.map((r, i) => {
    const x = mL + i * slot + (slot - barW) / 2;
    const bh = cH * (r.annualValue / maxVal);
    const y = mT + cH - bh;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}"
      width="${barW}" height="${bh.toFixed(1)}"
      fill="${catColor(r.category)}" rx="2" opacity="0.85"/>`;
  }).join("");

  // Cumulative line
  const pts = results.map((r, i) => {
    const x = mL + i * slot + slot / 2;
    const y = mT + cH * (1 - r.cumulativePercentage / 100);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const dots = results.map((r, i) => {
    const x = mL + i * slot + slot / 2;
    const y = mT + cH * (1 - r.cumulativePercentage / 100);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${C.accent}" stroke="${C.white}" stroke-width="1"/>`;
  }).join("");

  // 80% and 95% reference lines
  const y80 = mT + cH * (1 - 80 / 100);
  const y95 = mT + cH * (1 - 95 / 100);
  const refLines = `
    <line x1="${mL}" y1="${y80.toFixed(1)}" x2="${mL + cW}" y2="${y80.toFixed(1)}"
      stroke="${C.green}" stroke-width="1" stroke-dasharray="5,3" opacity="0.6"/>
    <text x="${(mL + cW + 2).toFixed(1)}" y="${(y80 - 2).toFixed(1)}"
      font-size="6.5" fill="${C.green}" opacity="0.8">80%</text>
    <line x1="${mL}" y1="${y95.toFixed(1)}" x2="${mL + cW}" y2="${y95.toFixed(1)}"
      stroke="${C.blue}" stroke-width="1" stroke-dasharray="5,3" opacity="0.5"/>
    <text x="${(mL + cW + 2).toFixed(1)}" y="${(y95 - 2).toFixed(1)}"
      font-size="6.5" fill="${C.blue}" opacity="0.7">95%</text>`;

  // X axis labels (truncated, rotated)
  const xLabels = results.map((r, i) => {
    const x = mL + i * slot + slot / 2;
    const y = mT + cH + 8;
    const raw = r.name.replace(/\s*\/\s*.+$/, "").trim(); // keep Arabic side only
    const lbl = raw.length > 12 ? raw.substring(0, 12) + "…" : raw;
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="7"
      text-anchor="end" fill="${C.muted}"
      transform="rotate(-38,${x.toFixed(1)},${y.toFixed(1)})">${lbl}</text>`;
  }).join("");

  // Axes
  const axes = `
    <line x1="${mL}" y1="${mT}" x2="${mL}" y2="${mT + cH}" stroke="${C.muted}" stroke-width="1"/>
    <line x1="${mL}" y1="${mT + cH}" x2="${mL + cW}" y2="${mT + cH}" stroke="${C.muted}" stroke-width="1"/>`;

  // Legend
  const legendY = H - 6;
  const legend = `
    <rect x="${mL}" y="${legendY - 7}" width="10" height="7" fill="${C.green}" rx="1"/>
    <text x="${mL + 13}" y="${legendY}" font-size="7" fill="${C.muted}">A</text>
    <rect x="${mL + 28}" y="${legendY - 7}" width="10" height="7" fill="${C.blue}" rx="1"/>
    <text x="${mL + 41}" y="${legendY}" font-size="7" fill="${C.muted}">B</text>
    <rect x="${mL + 56}" y="${legendY - 7}" width="10" height="7" fill="${C.orange}" rx="1"/>
    <text x="${mL + 69}" y="${legendY}" font-size="7" fill="${C.muted}">C</text>
    <line x1="${mL + 90}" y1="${legendY - 3.5}" x2="${mL + 105}" y2="${legendY - 3.5}"
      stroke="${C.accent}" stroke-width="2"/>
    <circle cx="${mL + 97}" cy="${legendY - 3.5}" r="2.5" fill="${C.accent}"/>
    <text x="${mL + 108}" y="${legendY}" font-size="7" fill="${C.muted}">Cumulatif %</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${gridAndYLeft}
    ${refLines}
    ${bars}
    <polyline points="${pts}" fill="none" stroke="${C.accent}" stroke-width="2"/>
    ${dots}
    ${yRight}
    ${axes}
    ${xLabels}
    ${legend}
  </svg>`;
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
    const results = opts.abcResults;
    const totalVal = results.reduce((s, r) => s + r.annualValue, 0);

    // ── ABC summary badges ────────────────────────────────────────────────────
    const abcSummary = `
      ${secTitle("ملخص التصنيف", "Résumé de Classification")}
      <div style="display:flex;gap:14px;margin-bottom:16px;">
        ${(["A", "B", "C"] as const).map(cat => {
          const items = results.filter(r => r.category === cat);
          const pct = items.reduce((s, r) => s + r.percentage, 0);
          const color = catColor(cat);
          const bg = catLightBg(cat);
          return `
            <div style="flex:1;border:2px solid ${color}33;border-radius:10px;background:${bg};padding:12px 16px;text-align:center;">
              <div style="font-size:26px;font-weight:900;color:${color};line-height:1;">${cat}</div>
              <div style="font-size:11px;font-weight:700;color:${color};margin-top:4px;">${items.length} منتج · ${items.length} produit(s)</div>
              <div style="font-size:10px;color:${C.muted};margin-top:2px;">${pct.toFixed(1)}% من القيمة · de la valeur</div>
              <div style="font-size:9px;color:${C.muted};margin-top:2px;">${fDA(items.reduce((s, r) => s + r.annualValue, 0))}</div>
            </div>`;
        }).join("")}
        <div style="flex:1;border:2px solid ${C.border};border-radius:10px;background:${C.primaryLight};padding:12px 16px;text-align:center;">
          <div style="font-size:22px;font-weight:900;color:${C.primary};line-height:1;">${results.length}</div>
          <div style="font-size:11px;font-weight:700;color:${C.primary};margin-top:4px;">إجمالي المنتجات</div>
          <div style="font-size:10px;color:${C.muted};margin-top:2px;">Total produits</div>
          <div style="font-size:9px;color:${C.muted};margin-top:2px;">${fDA(totalVal)}</div>
        </div>
      </div>`;

    // ── ABC Pareto chart ──────────────────────────────────────────────────────
    const chartHtml = `
      ${secTitle("مخطط باريتو", "Diagramme de Pareto")}
      <div style="margin-bottom:4px;">
        <p style="font-size:9px;color:${C.muted};margin:0 0 6px;">
          القيمة السنوية لكل منتج (أعمدة ملونة حسب الفئة) ونسبة القيمة التراكمية (خط برتقالي) ·
          Valeur annuelle par produit (barres colorées par catégorie) et % cumulatif (courbe)
        </p>
        ${buildParetoSvg(results)}
      </div>`;

    // ── ABC table ─────────────────────────────────────────────────────────────
    const abcTable = `
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
          ${results.map((r, i) => `
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

    tableHtml = abcSummary + chartHtml + abcTable;
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

  // Use actual border/bg colors if provided, otherwise fall back to sensible defaults per icon
  const iconBorderMap: Record<string, string> = {
    "📦": C.green, "✅": C.green, "🟢": C.green, "📊": C.green,
    "⚠️": C.amberBorder, "🛡️": C.amberBorder, "🟡": C.amberBorder,
    "🔴": C.red, "🔵": C.blue, "🔔": C.blue,
  };
  const iconBgMap: Record<string, string> = {
    "📦": C.greenLight, "✅": C.greenLight, "🟢": C.greenLight, "📊": C.greenLight,
    "⚠️": C.amberBg, "🛡️": C.amberBg, "🟡": C.amberBg,
    "🔴": C.redLight, "🔵": C.blueLight, "🔔": C.blueLight,
  };

  const suggestionsHtml = opts.suggestions.map((s) => {
    const borderColor = s.borderHex ?? iconBorderMap[s.icon] ?? C.accent;
    const bgColor = s.bgHex ?? iconBgMap[s.icon] ?? C.primaryLight;
    return `
    <div style="background:${bgColor};border:1px solid ${C.border};border-radius:8px;padding:12px 16px;margin-bottom:10px;border-left:4px solid ${borderColor};">
      <div style="font-size:11px;font-weight:700;margin-bottom:4px;">${s.icon} ${s.title}</div>
      <div style="font-size:9.5px;color:${C.muted};line-height:1.6;">${s.desc}</div>
    </div>`;
  }).join("");

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

  // ABC mode gets extra content on page 2 — it fits but is taller; use same 3-page structure
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
