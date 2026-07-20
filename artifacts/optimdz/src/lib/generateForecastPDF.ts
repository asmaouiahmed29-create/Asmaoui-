import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { ForecastResult, ForecastMode } from "./forecastAlgorithm";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ForecastPDFOptions {
  mode: ForecastMode;
  problemName: string;
  sector: string;
  results: ForecastResult[];
  analysisLines: string[];
  suggestions: { icon: string; title: string; desc: string }[];
  managerName?: string;
  institutionName?: string;
  onProgress?: (step: string) => void;
}

// ── Colour palette (same as inventory PDF) ───────────────────────────────────
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
  red:          "#c62828",
  blue:         "#1565c0",
};

function genId(): string {
  return `FCT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function fNum(n: number, d = 1): string {
  return n.toLocaleString("fr-DZ", { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

function modeLabel(mode: ForecastMode) {
  return {
    "moving-average": { ar: "المتوسط المتحرك", fr: "Moyenne Mobile" },
    "exponential":    { ar: "التمهيد الأسي البسيط", fr: "Lissage Exponentiel Simple" },
  }[mode];
}

// ── Shared shell ──────────────────────────────────────────────────────────────
function pageShell(content: string, pg: number, total: number, subtitle: string): string {
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

function secTitle(ar: string, fr: string): string {
  return `<div style="margin-bottom:12px;margin-top:20px;">
    <h2 style="font-size:15px;font-weight:800;color:${C.primary};margin:0 0 4px;">${ar} · ${fr}</h2>
    <div style="width:40px;height:3px;background:${C.accent};border-radius:2px;"></div>
  </div>`;
}

// ── Page 1: Cover ─────────────────────────────────────────────────────────────
function buildCover(
  opts: ForecastPDFOptions,
  reportId: string,
  generatedAt: string,
  totalPages: number
): string {
  const lbl = modeLabel(opts.mode);
  const avgMAE  = opts.results.length ? opts.results.reduce((s, r) => s + r.mae, 0) / opts.results.length : 0;
  const avgMAPE = opts.results.length ? opts.results.reduce((s, r) => s + r.mape, 0) / opts.results.length : 0;

  const kpis = [
    { label: "عدد المنتجات / Nb. Produits",  value: String(opts.results.length),       color: C.primary },
    { label: "متوسط MAE / MAE Moyen",         value: fNum(avgMAE, 1) + " وحدة",         color: C.accent  },
    { label: "متوسط MAPE / MAPE Moyen",       value: fNum(avgMAPE, 1) + "%",             color: C.accent  },
    { label: "نموذج التنبؤ / Modèle",         value: lbl.fr,                             color: C.primary },
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
      <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-top:1px;">نظام دعم القرار للمؤسسة الجزائرية</div>
    </div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 40px;text-align:center;gap:14px;">
    <div style="font-size:11px;letter-spacing:3px;color:${C.accent};text-transform:uppercase;font-weight:600;">تقرير رسمي · Rapport Officiel</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.6);">إدارة سلاسل الإمداد · Gestion de la Chaîne d'Approvisionnement</div>
    <div style="font-size:24px;font-weight:800;line-height:1.3;direction:rtl;">التنبؤ بالطلب</div>
    <div style="font-size:18px;font-weight:700;color:rgba(255,255,255,0.9);">${lbl.ar}</div>
    <div style="font-size:14px;font-weight:400;color:rgba(255,255,255,0.7);">Prévision de la Demande — ${lbl.fr}</div>
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
      ["المسألة / Problème",   opts.problemName],
      ["القطاع / Secteur",     opts.sector],
      ["النموذج / Modèle",    lbl.fr],
      ["المسؤول / Responsable", opts.managerName || "—"],
      ["المؤسسة / Institution", opts.institutionName || "—"],
      ["رقم التقرير / N°",    reportId],
      ["تاريخ الإصدار / Date", generatedAt],
      ["عدد الصفحات / Pages",  String(totalPages)],
    ].map(([l, v]) => `
      <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:11px 14px;">
        <div style="font-size:9px;color:rgba(255,255,255,0.55);margin-bottom:4px;">${l}</div>
        <div style="font-size:11.5px;font-weight:700;">${v}</div>
      </div>`).join("")}
  </div>
  <div style="height:6px;background:rgba(255,255,255,0.15);"></div>
</div>`;
}

// ── Page 2: Results table ─────────────────────────────────────────────────────
function buildResultsPage(opts: ForecastPDFOptions, totalPages: number): string {
  const lbl = modeLabel(opts.mode);

  const tablesHtml = opts.results.map(r => {
    const rows = r.dataPoints.map((dp, i) => {
      const isNext = i === r.dataPoints.length - 1;
      const actualStr   = dp.actual   !== null ? fNum(dp.actual, 0)   : "—";
      const forecastStr = dp.forecast !== null ? fNum(dp.forecast, 1) : "—";
      const errorStr    = (dp.actual !== null && dp.forecast !== null)
        ? fNum(Math.abs(dp.actual - dp.forecast), 1)
        : "—";
      return `
        <tr style="background:${isNext ? "#e8f5e9" : i % 2 === 0 ? C.white : "#f7f7f7"};">
          <td style="padding:4px 8px;border-bottom:1px solid ${C.border};text-align:center;font-size:8.5px;font-weight:${isNext ? "700" : "400"};">${dp.period}${isNext ? " ★" : ""}</td>
          <td style="padding:4px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;font-size:8.5px;">${actualStr}</td>
          <td style="padding:4px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;font-size:8.5px;font-weight:${isNext ? "800" : "400"};color:${isNext ? C.green : C.primary};">${forecastStr}</td>
          <td style="padding:4px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;font-size:8.5px;color:${C.muted};">${errorStr}</td>
        </tr>`;
    }).join("");

    const trendMap: Record<string, string> = {
      increasing: "↑ صاعد / Haussier",
      decreasing: "↓ هابط / Baissier",
      stable:     "→ مستقر / Stable",
    };
    const volMap: Record<string, string> = {
      high:   "مرتفع / Élevée",
      medium: "متوسط / Moyenne",
      low:    "منخفض / Faible",
    };

    return `
      <div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="background:${C.primary};color:${C.white};width:24px;height:24px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;">${r.id}</span>
            <span style="font-size:13px;font-weight:700;">${r.name}</span>
          </div>
          <div style="display:flex;gap:8px;font-size:9px;">
            <span style="background:${C.primaryLight};padding:3px 8px;border-radius:4px;">MAE: ${fNum(r.mae, 1)}</span>
            <span style="background:${C.primaryLight};padding:3px 8px;border-radius:4px;">MAPE: ${fNum(r.mape, 1)}%</span>
            <span style="background:${C.primaryLight};padding:3px 8px;border-radius:4px;">${trendMap[r.trend]}</span>
            <span style="background:${C.primaryLight};padding:3px 8px;border-radius:4px;">تقلب: ${volMap[r.volatility]}</span>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:${C.primary};color:${C.white};">
              <th style="padding:5px 8px;text-align:center;font-weight:700;font-size:9px;">الفترة / Période</th>
              <th style="padding:5px 8px;text-align:right;font-weight:700;font-size:9px;">الفعلي / Réel</th>
              <th style="padding:5px 8px;text-align:right;font-weight:700;font-size:9px;background:${C.accent};color:${C.text};">التنبؤ / Prévision</th>
              <th style="padding:5px 8px;text-align:right;font-weight:700;font-size:9px;">الخطأ المطلق / Erreur abs.</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:6px;padding:8px 12px;background:${C.primaryLight};border-radius:6px;font-size:9.5px;">
          <strong>تنبؤ الفترة القادمة / Prévision prochaine période :</strong>
          <span style="color:${C.green};font-weight:800;font-size:12px;margin-left:8px;">${fNum(r.nextForecast, 1)} وحدة</span>
        </div>
      </div>`;
  }).join("");

  const content = `
    ${secTitle("نتائج التنبؤ بالطلب", `Résultats — ${lbl.fr}`)}
    <div style="font-size:10px;color:${C.muted};margin-bottom:16px;">${opts.problemName} — ${opts.sector}</div>
    ${tablesHtml}`;

  return pageShell(content, 2, totalPages, `التنبؤ بالطلب · Prévision de la Demande`);
}

// ── Page 3: Analysis + Recommendations ───────────────────────────────────────
function buildAnalysisPage(opts: ForecastPDFOptions, totalPages: number): string {
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

  return pageShell(content, 3, totalPages, `التنبؤ بالطلب · Prévision de la Demande`);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateForecastPDF(opts: ForecastPDFOptions): Promise<void> {
  const reportId    = genId();
  const generatedAt = new Date().toLocaleDateString("fr-DZ");
  const totalPages  = 3;

  const pages = [
    buildCover(opts, reportId, generatedAt, totalPages),
    buildResultsPage(opts, totalPages),
    buildAnalysisPage(opts, totalPages),
  ];

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W   = 794;
  const H   = 1123;

  for (let i = 0; i < pages.length; i++) {
    opts.onProgress?.(`${i + 1}/${totalPages}`);
    const container = document.createElement("div");
    container.style.cssText = `position:fixed;left:-9999px;top:0;width:${W}px;z-index:-1;`;
    container.innerHTML = pages[i];
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2, useCORS: true, backgroundColor: null,
        width: W, height: H, logging: false,
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 595.28, 841.89);
    } finally {
      document.body.removeChild(container);
    }
  }

  const safeName = opts.problemName.replace(/[^a-z0-9\u0600-\u06FF]/gi, "_").substring(0, 40);
  pdf.save(`OptimDZ_Forecast_${safeName}_${reportId}.pdf`);
}
