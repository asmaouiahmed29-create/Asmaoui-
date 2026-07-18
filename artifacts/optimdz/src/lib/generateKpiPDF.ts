import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { KpiTrackingResult, PeriodResult } from "./kpiTrackingAlgorithm";
import { fmtDAFull, fmtPct, fmtPctAbs, fmtN } from "./kpiTrackingAlgorithm";

const C = {
  primary: "#004d40", primaryLight: "#e0f2f1",
  accent: "#f4a261", bg: "#fbf8f1", text: "#0c2621",
  muted: "#5f7b77", border: "#c8dad6", white: "#ffffff",
  green: "#2e7d32", greenLight: "#e8f5e9",
  red: "#c62828", redLight: "#ffebee",
  orange: "#e65100", orangeLight: "#fff3e0",
  revenue: "#004d40",
  costs: "#c62828",
  profit: "#e65100",
  margin: "#2e7d32",
  target: "#7b5ea7",
};

function f(n: number | null | undefined, dec = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return parseFloat(n.toFixed(dec)).toLocaleString("fr-DZ", { maximumFractionDigits: dec });
}
function fDA(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(Math.round(n));
  const str = abs >= 1_000_000
    ? (abs / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + " M DA"
    : abs >= 1_000
    ? (abs / 1_000).toFixed(1).replace(/\.0$/, "") + " k DA"
    : abs.toLocaleString("fr-DZ") + " DA";
  return (n < 0 ? "−" : "") + str;
}
function genId() {
  return `KPI-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function pageShell(content: string, pageNum: number, total: number, title: string) {
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
      <span style="color:rgba(255,255,255,0.75);font-size:11px;">${title}</span>
      <span style="color:rgba(255,255,255,0.6);font-size:10px;">${pageNum} / ${total}</span>
    </div>
    <div style="flex:1;padding:28px 36px 20px;display:flex;flex-direction:column;gap:0;">${content}</div>
    <div style="border-top:1px solid ${C.border};padding:8px 36px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
      <span style="font-size:9px;color:${C.muted};">نظام OptimDZ — تتبع مؤشرات الأداء · Suivi Manuel des KPI</span>
      <span style="font-size:9px;color:${C.muted};">www.optimdz.replit.app</span>
    </div>
  </div>`;
}

function sectionTitle(fr: string, ar: string) {
  return `<div style="margin-bottom:12px;margin-top:18px;">
    <h2 style="font-size:16px;font-weight:800;color:${C.primary};margin:0 0 4px;">${ar} · ${fr}</h2>
    <div style="width:40px;height:3px;background:${C.accent};border-radius:2px;"></div>
  </div>`;
}

// ── Page 1 — Cover ─────────────────────────────────────────────────────────────
function buildCover(
  result: KpiTrackingResult,
  managerName: string, institutionName: string,
  reportId: string, generatedAt: string, totalPages: number
) {
  const { summary, businessName, periodType, periods } = result;
  const latest = periods[periods.length - 1];
  const periodRange = `${periods[0].label} → ${latest.label}`;

  const trendIcon = (t: "up" | "down" | "stable") =>
    t === "up" ? "📈" : t === "down" ? "📉" : "➡️";
  const trendColor = (t: "up" | "down" | "stable") =>
    t === "up" ? C.green : t === "down" ? C.red : C.muted;

  const kpiCards = [
    { label: "آخر CA / Dernier CA", value: fDA(summary.latestRevenue), trend: summary.revenueTrend, color: C.revenue },
    { label: "آخر ربح / Dernier bénéfice", value: fDA(summary.latestProfit), trend: summary.profitTrend, color: summary.latestProfit >= 0 ? C.green : C.red },
    { label: "هامش الربح / Marge bénéfice", value: fmtPctAbs(summary.latestMarginPct), trend: summary.marginTrend, color: summary.latestMarginPct >= 0 ? C.green : C.red },
    { label: "نمو CA متوسط / Croissance CA moy.", value: fmtPct(summary.avgRevenueGrowthPct), trend: summary.avgRevenueGrowthPct >= 0 ? "up" as const : "down" as const, color: summary.avgRevenueGrowthPct >= 0 ? C.green : C.red },
  ];

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
        <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-top:1px;">نظام دعم القرار · تتبع مؤشرات الأداء</div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 40px;text-align:center;gap:14px;">
      <div style="font-size:11px;letter-spacing:3px;color:${C.accent};text-transform:uppercase;font-weight:600;">تقرير رسمي · Rapport Officiel</div>
      <div style="font-size:24px;font-weight:800;line-height:1.3;direction:rtl;">تقرير مؤشرات الأداء الرئيسية</div>
      <div style="font-size:15px;font-weight:400;color:rgba(255,255,255,0.8);">Rapport de Suivi des KPI</div>
      <div style="width:60px;height:3px;background:${C.accent};border-radius:2px;margin:4px 0;"></div>
      <div style="font-size:22px;font-weight:700;color:${C.accent};">${businessName}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.7);">
        ${periodType === "monthly" ? "Suivi mensuel · تتبع شهري" : "Suivi trimestriel · تتبع ربع سنوي"} 
        &nbsp;·&nbsp; ${periods.length} ${periodType === "monthly" ? "mois" : "trimestres"}
        &nbsp;·&nbsp; ${periodRange}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:580px;margin-top:8px;">
        ${kpiCards.map(kpi => `
          <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:12px 16px;text-align:left;">
            <div style="font-size:9px;color:rgba(255,255,255,0.55);margin-bottom:4px;">${kpi.label}</div>
            <div style="font-size:18px;font-weight:800;color:${C.accent};">${kpi.value}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.6);margin-top:2px;">${trendIcon(kpi.trend)} ${kpi.trend === "up" ? "En hausse" : kpi.trend === "down" ? "En baisse" : "Stable"}</div>
          </div>`).join("")}
      </div>
    </div>
    <div style="padding:0 40px 28px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${[
        ["المؤسسة / Entreprise", businessName],
        ["المسؤول / Responsable", managerName || "—"],
        ["المنظمة / Organisation", institutionName || "—"],
        ["نوع الفترة / Type période", periodType === "monthly" ? "Mensuel / شهري" : "Trimestriel / ربع سنوي"],
        ["عدد الفترات / Nb. périodes", String(periods.length)],
        ["النطاق الزمني / Période", periodRange],
        ["رقم التقرير / N° Rapport", reportId],
        ["تاريخ الإصدار / Date", generatedAt],
      ].map(([label, value]) => `
        <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:11px 14px;">
          <div style="font-size:9px;color:rgba(255,255,255,0.55);margin-bottom:4px;">${label}</div>
          <div style="font-size:11.5px;font-weight:700;">${value}</div>
        </div>`).join("")}
    </div>
    <div style="height:6px;background:rgba(255,255,255,0.15);"></div>
  </div>`;
}

// ── Page 2 — KPI Trends Table + Bar Charts ────────────────────────────────────
function buildTrendsPage(result: KpiTrackingResult, totalPages: number) {
  const { periods } = result;

  // Revenue bar chart
  const maxRev = Math.max(...periods.map(p => p.revenue), 1);
  const maxBarW = 340;

  const revBars = periods.map((p, i) => {
    const w = (p.revenue / maxRev) * maxBarW;
    return `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px;">
        <div style="width:90px;font-size:9px;color:${C.muted};text-align:right;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.label}</div>
        <div style="width:${maxBarW}px;height:18px;background:#f0f0f0;border-radius:3px;position:relative;flex-shrink:0;">
          <div style="width:${w.toFixed(0)}px;height:18px;background:${C.revenue};border-radius:3px;opacity:${i === periods.length - 1 ? "1" : "0.75"};"></div>
        </div>
        <div style="font-size:9px;font-family:monospace;color:${C.revenue};font-weight:700;white-space:nowrap;">${fDA(p.revenue)}</div>
      </div>`;
  }).join("");

  // Profit bar chart
  const maxAbsProfit = Math.max(...periods.map(p => Math.abs(p.netProfit)), 1);
  const profBars = periods.map((p, i) => {
    const isPos = p.netProfit >= 0;
    const w = (Math.abs(p.netProfit) / maxAbsProfit) * maxBarW;
    return `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px;">
        <div style="width:90px;font-size:9px;color:${C.muted};text-align:right;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.label}</div>
        <div style="width:${maxBarW}px;height:18px;background:#f0f0f0;border-radius:3px;position:relative;flex-shrink:0;">
          <div style="width:${w.toFixed(0)}px;height:18px;background:${isPos ? C.profit : C.red};border-radius:3px;opacity:${i === periods.length - 1 ? "1" : "0.75"};"></div>
        </div>
        <div style="font-size:9px;font-family:monospace;color:${isPos ? C.profit : C.red};font-weight:700;white-space:nowrap;">${fDA(p.netProfit)}</div>
      </div>`;
  }).join("");

  // KPI table
  const tableRows = periods.map((p, i) => {
    const isLast = i === periods.length - 1;
    const growthCell = (g: number | undefined) => {
      if (g === undefined) return `<td style="padding:5px 6px;border-bottom:1px solid ${C.border};text-align:center;font-size:9px;color:${C.muted};">—</td>`;
      const color = g > 0 ? C.green : g < 0 ? C.red : C.muted;
      return `<td style="padding:5px 6px;border-bottom:1px solid ${C.border};text-align:center;font-size:9px;font-weight:700;color:${color};">${g > 0 ? "+" : ""}${f(g, 1)}%</td>`;
    };
    const bg = isLast ? C.primaryLight : i % 2 === 0 ? C.white : "#f7f7f7";
    return `<tr style="background:${bg};">
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};font-size:9.5px;font-weight:${isLast ? "700" : "500"};">${p.label}</td>
      <td style="padding:5px 6px;border-bottom:1px solid ${C.border};text-align:right;font-size:9.5px;font-family:monospace;color:${C.revenue};">${fDA(p.revenue)}</td>
      <td style="padding:5px 6px;border-bottom:1px solid ${C.border};text-align:right;font-size:9.5px;font-family:monospace;color:${C.red};">${fDA(p.totalCosts)}</td>
      <td style="padding:5px 6px;border-bottom:1px solid ${C.border};text-align:right;font-size:9.5px;font-family:monospace;color:${p.netProfit >= 0 ? C.green : C.red};font-weight:700;">${fDA(p.netProfit)}</td>
      <td style="padding:5px 6px;border-bottom:1px solid ${C.border};text-align:center;font-size:9.5px;color:${p.profitMarginPct >= 0 ? C.green : C.red};font-weight:600;">${f(p.profitMarginPct, 1)}%</td>
      ${growthCell(p.revenueGrowthPct)}
      ${growthCell(p.profitGrowthPct)}
    </tr>`;
  }).join("");

  const content = `
    ${sectionTitle("Tableau des KPI par Période", "جدول مؤشرات الأداء حسب الفترة")}
    <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:16px;">
      <thead>
        <tr style="background:${C.primary};color:${C.white};">
          <th style="padding:6px 8px;text-align:left;font-size:9px;">Période</th>
          <th style="padding:6px 6px;text-align:right;font-size:9px;">CA</th>
          <th style="padding:6px 6px;text-align:right;font-size:9px;">Charges</th>
          <th style="padding:6px 6px;text-align:right;font-size:9px;">Bénéfice</th>
          <th style="padding:6px 6px;text-align:center;font-size:9px;">Marge %</th>
          <th style="padding:6px 6px;text-align:center;font-size:9px;">Δ CA %</th>
          <th style="padding:6px 6px;text-align:center;font-size:9px;">Δ Bén. %</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>

    ${sectionTitle("Évolution du Chiffre d'Affaires", "تطور رقم الأعمال")}
    <div style="padding:8px 0 12px;">${revBars}</div>

    ${sectionTitle("Évolution du Bénéfice Net", "تطور صافي الربح")}
    <div style="padding:8px 0;">${profBars}</div>`;

  return pageShell(content, 2, totalPages, "جدول الأداء والمخططات · Tableau & Graphiques");
}

// ── Page 3 — Analysis, Targets & Suggestions ─────────────────────────────────
function buildAnalysisPage(
  result: KpiTrackingResult,
  analysis: string[], suggestions: { title: string; desc: string; icon: string }[],
  totalPages: number
) {
  const { summary, periods } = result;
  const hasTargets = summary.hasTargets;

  // Actual vs Target table (if targets exist)
  let targetSection = "";
  if (hasTargets) {
    const targetRows = periods
      .filter(p => p.targetRevenue !== undefined || p.targetProfit !== undefined)
      .map((p, i) => {
        const bg = i % 2 === 0 ? C.white : "#f7f7f7";
        const revCell = p.targetRevenue !== undefined
          ? `<td style="font-size:9px;padding:5px 6px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;color:${C.target};">${fDA(p.targetRevenue)}</td>
             <td style="font-size:9px;padding:5px 6px;border-bottom:1px solid ${C.border};text-align:center;font-weight:700;color:${(p.revenueVsTargetPct ?? 0) >= 0 ? C.green : C.red};">${p.revenueVsTargetPct !== undefined ? (p.revenueVsTargetPct > 0 ? "+" : "") + f(p.revenueVsTargetPct, 1) + "%" : "—"}</td>`
          : `<td style="font-size:9px;padding:5px 6px;border-bottom:1px solid ${C.border};text-align:center;color:${C.muted};">—</td><td style="font-size:9px;padding:5px 6px;border-bottom:1px solid ${C.border};text-align:center;color:${C.muted};">—</td>`;
        const profCell = p.targetProfit !== undefined
          ? `<td style="font-size:9px;padding:5px 6px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;color:${C.target};">${fDA(p.targetProfit)}</td>
             <td style="font-size:9px;padding:5px 6px;border-bottom:1px solid ${C.border};text-align:center;font-weight:700;color:${(p.profitVsTargetPct ?? 0) >= 0 ? C.green : C.red};">${p.profitVsTargetPct !== undefined ? (p.profitVsTargetPct > 0 ? "+" : "") + f(p.profitVsTargetPct, 1) + "%" : "—"}</td>`
          : `<td style="font-size:9px;padding:5px 6px;border-bottom:1px solid ${C.border};text-align:center;color:${C.muted};">—</td><td style="font-size:9px;padding:5px 6px;border-bottom:1px solid ${C.border};text-align:center;color:${C.muted};">—</td>`;
        return `<tr style="background:${bg};">
          <td style="font-size:9.5px;padding:5px 8px;border-bottom:1px solid ${C.border};">${p.label}</td>
          <td style="font-size:9px;padding:5px 6px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;color:${C.revenue};">${fDA(p.revenue)}</td>
          ${revCell}
          <td style="font-size:9px;padding:5px 6px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;color:${p.netProfit >= 0 ? C.green : C.red};">${fDA(p.netProfit)}</td>
          ${profCell}
        </tr>`;
      }).join("");

    targetSection = `
      ${sectionTitle("Réalisé vs Objectifs", "الفعلي مقابل الأهداف")}
      <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:14px;">
        <thead>
          <tr style="background:${C.primary};color:${C.white};">
            <th style="padding:6px 8px;text-align:left;font-size:9px;">Période</th>
            <th style="padding:6px 6px;text-align:right;font-size:9px;">CA réel</th>
            <th style="padding:6px 6px;text-align:center;font-size:9px;">Obj. CA</th>
            <th style="padding:6px 6px;text-align:center;font-size:9px;">Écart CA</th>
            <th style="padding:6px 6px;text-align:right;font-size:9px;">Bén. réel</th>
            <th style="padding:6px 6px;text-align:center;font-size:9px;">Obj. Bén.</th>
            <th style="padding:6px 6px;text-align:center;font-size:9px;">Écart Bén.</th>
          </tr>
        </thead>
        <tbody>${targetRows}</tbody>
      </table>`;
  }

  const analysisHtml = analysis.map(line => `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 12px;background:${C.primaryLight};border-radius:6px;margin-bottom:7px;font-size:10px;line-height:1.65;">
      ${line}
    </div>`).join("");

  const suggestionsHtml = suggestions.map(s => `
    <div style="border-left:4px solid ${C.accent};padding:8px 12px;background:${C.white};border-radius:0 6px 6px 0;margin-bottom:8px;">
      <div style="font-size:10.5px;font-weight:700;color:${C.text};margin-bottom:3px;">${s.icon} ${s.title}</div>
      <div style="font-size:9.5px;color:${C.muted};line-height:1.65;">${s.desc}</div>
    </div>`).join("");

  const content = `
    ${targetSection}
    ${sectionTitle("Analyse Automatique de la Situation", "التحليل التلقائي للوضع")}
    <div style="margin-bottom:14px;">${analysisHtml}</div>
    ${sectionTitle("Recommandations", "التوصيات")}
    <div>${suggestionsHtml}</div>`;

  return pageShell(content, 3, totalPages, "التحليل والتوصيات · Analyse & Recommandations");
}

// ── Page 4 — Digital Stamp ────────────────────────────────────────────────────
function buildStampPage(reportId: string, generatedAt: string, totalPages: number) {
  const content = `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;text-align:center;">
      <div style="width:80px;height:80px;background:${C.primary};border-radius:50%;display:flex;align-items:center;justify-content:center;">
        <div style="width:50px;height:50px;background:${C.white};border-radius:50%;display:flex;align-items:center;justify-content:center;">
          <div style="width:28px;height:28px;background:${C.primary};border-radius:50%;"></div>
        </div>
      </div>
      <div>
        <div style="font-size:22px;font-weight:800;color:${C.primary};">تقرير KPI معتمد · Rapport KPI Certifié</div>
        <div style="font-size:13px;color:${C.muted};margin-top:4px;">نظام OptimDZ لتتبع مؤشرات الأداء</div>
      </div>
      <div style="border:2px dashed ${C.border};border-radius:12px;padding:20px 40px;display:inline-block;">
        <div style="font-size:11px;color:${C.muted};margin-bottom:6px;">رقم التقرير · Numéro du rapport</div>
        <div style="font-size:18px;font-family:monospace;font-weight:700;color:${C.primary};letter-spacing:2px;">${reportId}</div>
        <div style="font-size:10px;color:${C.muted};margin-top:6px;">${generatedAt}</div>
      </div>
      <div style="font-size:11px;color:${C.muted};max-width:440px;line-height:1.7;">
        هذا التقرير صادر تلقائياً من نظام OptimDZ لتتبع مؤشرات الأداء الرئيسية.
        النتائج مبنية على البيانات المُدخلة وتُعدّ أداة دعم قرار.
        <br/><br/>
        Ce rapport a été généré automatiquement par le système OptimDZ de Suivi des KPI.
        Il constitue un outil d'aide à la décision basé sur les données saisies.
      </div>
    </div>`;
  return pageShell(content, totalPages, totalPages, "الختم الرقمي · Cachet Numérique");
}

// ── Render helper ─────────────────────────────────────────────────────────────
async function addHtmlPage(pdf: jsPDF, html: string, pageWidth: number) {
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:-9999px;z-index:-1;";
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container.firstElementChild as HTMLElement,
      { scale: 2, useCORS: true, logging: false });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pageHeight = (canvas.height / canvas.width) * pageWidth;
    pdf.addPage([pageWidth, pageHeight]);
    pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);
  } finally {
    document.body.removeChild(container);
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export interface KpiPDFOptions {
  result: KpiTrackingResult;
  analysisLines: string[];
  suggestions: { title: string; desc: string; icon: string }[];
  managerName?: string;
  institutionName?: string;
}

export async function generateKpiPDFReport(opts: KpiPDFOptions): Promise<void> {
  const { result, analysisLines, suggestions, managerName = "", institutionName = "" } = opts;
  const reportId    = genId();
  const generatedAt = new Date().toLocaleDateString("fr-DZ", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const PAGE_W     = 210;
  const totalPages = 4;

  const coverHtml    = buildCover(result, managerName, institutionName, reportId, generatedAt, totalPages);
  const trendsHtml   = buildTrendsPage(result, totalPages);
  const analysisHtml = buildAnalysisPage(result, analysisLines, suggestions, totalPages);
  const stampHtml    = buildStampPage(reportId, generatedAt, totalPages);

  // Render cover first (sets PDF dimensions)
  const coverContainer = document.createElement("div");
  coverContainer.style.cssText = "position:fixed;left:-9999px;top:-9999px;z-index:-1;";
  coverContainer.innerHTML = coverHtml;
  document.body.appendChild(coverContainer);
  const coverCanvas = await html2canvas(coverContainer.firstElementChild as HTMLElement,
    { scale: 2, useCORS: true, logging: false });
  const coverImgData = coverCanvas.toDataURL("image/jpeg", 0.92);
  const coverPageH = (coverCanvas.height / coverCanvas.width) * PAGE_W;
  document.body.removeChild(coverContainer);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [PAGE_W, coverPageH] });
  pdf.addImage(coverImgData, "JPEG", 0, 0, PAGE_W, coverPageH);
  await addHtmlPage(pdf, trendsHtml,   PAGE_W);
  await addHtmlPage(pdf, analysisHtml, PAGE_W);
  await addHtmlPage(pdf, stampHtml,    PAGE_W);

  const safe = (result.businessName || "kpi").replace(/\s+/g, "_").slice(0, 30);
  pdf.save(`OptimDZ_KPI_${safe}_${Date.now()}.pdf`);
}
