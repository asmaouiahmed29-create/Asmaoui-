import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { QualityResults, XbarResults, PResults } from "./qualityControlAlgorithm";

export interface QualityControlPDFOptions {
  problemName: string;
  results: QualityResults;
  language: "fr" | "ar";
  analysisLines: Array<{ fr: string; ar: string }>;
  recommendations: Array<{ icon: string; fr: string; ar: string; descFr: string; descAr: string }>;
  onProgress?: (step: string, pct: number) => void;
}

// ── Palette ───────────────────────────────────────────────────────────────────
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
  amber:        "#f59e0b",
  amberLight:   "#fef3c7",
  red:          "#c62828",
  redLight:     "#ffebee",
  blue:         "#1565c0",
  blueLight:    "#e3f2fd",
};

function genId(): string {
  return `QC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function lbl(lang: "fr" | "ar") {
  return (fr: string, ar: string) => (lang === "ar" ? ar : fr);
}

function fmtN(n: number, decimals = 3): string {
  return n.toFixed(decimals);
}

function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

// ── Page shell ────────────────────────────────────────────────────────────────
function pageShell(content: string, pg: number, total: number, subtitle: string, lang: "fr" | "ar"): string {
  const L = lbl(lang);
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
    <span style="font-size:9px;color:${C.muted};">OptimDZ · ${L("Gestion de la Qualité", "إدارة الجودة")}</span>
    <span style="font-size:9px;color:${C.muted};">www.optimdz.replit.app</span>
  </div>
</div>`;
}

function secTitle(title: string): string {
  return `<div style="margin-bottom:12px;margin-top:20px;">
    <h2 style="font-size:15px;font-weight:800;color:${C.primary};margin:0 0 4px;">${title}</h2>
    <div style="width:40px;height:3px;background:${C.accent};border-radius:2px;"></div>
  </div>`;
}

// ── Control chart SVG builder ─────────────────────────────────────────────────
function buildChartSvg(results: QualityResults, lang: "fr" | "ar"): string {
  const L = lbl(lang);
  const W = 720; const H = 200;
  const padL = 50; const padR = 20; const padT = 20; const padB = 35;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const isXbar = results.chartType === "xbar";
  const r = results as XbarResults & PResults;

  // Data points
  const yValues  = isXbar
    ? r.samples.map((s: XbarResults["samples"][0]) => s.sampleMean)
    : r.samples.map((s: PResults["samples"][0]) => s.rate);
  const ucl      = isXbar ? r.ucl  : r.uclConstant;
  const lcl      = isXbar ? r.lcl  : r.lclConstant;
  const centerY  = isXbar ? r.grandMean : r.pBar;
  const n        = yValues.length;

  const allVals  = [...yValues, ucl, lcl, centerY].filter(isFinite);
  const minVal   = Math.min(...allVals);
  const maxVal   = Math.max(...allVals);
  const span     = maxVal - minVal || 1;
  const pad      = span * 0.15;
  const yMin     = minVal - pad;
  const yMax     = maxVal + pad;

  function toX(i: number) {
    return padL + (i / Math.max(n - 1, 1)) * chartW;
  }
  function toY(v: number) {
    return padT + (1 - (v - yMin) / (yMax - yMin)) * chartH;
  }
  function fmtY(v: number) {
    return isXbar ? fmtN(v, 2) : `${(v * 100).toFixed(1)}%`;
  }

  // Build line path for data
  const linePath = yValues.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");

  // UCL / Center / LCL lines
  const uclY = toY(ucl).toFixed(1);
  const ctrY = toY(centerY).toFixed(1);
  const lclY = toY(lcl).toFixed(1);
  const x1   = padL.toFixed(1);
  const x2   = (padL + chartW).toFixed(1);

  // Data points
  const dots = yValues.map((v, i) => {
    const s = results.chartType === "xbar"
      ? (results as XbarResults).samples[i]
      : (results as PResults).samples[i];
    const oc = s.isOutOfControl;
    const cx = toX(i).toFixed(1);
    const cy = toY(v).toFixed(1);
    return `<circle cx="${cx}" cy="${cy}" r="5" fill="${oc ? C.red : C.green}" stroke="${C.white}" stroke-width="1.5"/>
      ${oc ? `<circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="${C.red}" stroke-width="1.5" opacity="0.5"/>` : ""}`;
  }).join("");

  // X-axis labels (sample labels, max 15 chars, every nth to avoid crowding)
  const step = n > 10 ? Math.ceil(n / 10) : 1;
  const xLabels = yValues.map((_, i) => {
    if (i % step !== 0 && i !== n - 1) return "";
    const label = results.chartType === "xbar"
      ? (results as XbarResults).samples[i].label
      : (results as PResults).samples[i].label;
    const cx = toX(i).toFixed(1);
    return `<text x="${cx}" y="${(padT + chartH + 18).toFixed(1)}" text-anchor="middle" font-size="8" fill="${C.muted}">${label.slice(0, 8)}</text>`;
  }).join("");

  // Legend
  const legendY = padT + chartH + 28;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="font-family:'Cairo','Inter',sans-serif;">
    <rect width="${W}" height="${H}" fill="${C.primaryLight}" rx="6"/>
    <!-- UCL line -->
    <line x1="${x1}" y1="${uclY}" x2="${x2}" y2="${uclY}" stroke="${C.red}" stroke-width="1.5" stroke-dasharray="6,3"/>
    <text x="${(padL - 4).toFixed(1)}" y="${uclY}" text-anchor="end" font-size="8" fill="${C.red}" dominant-baseline="middle">UCL</text>
    <text x="${(padL + chartW + 3).toFixed(1)}" y="${uclY}" font-size="7" fill="${C.red}" dominant-baseline="middle">${fmtY(ucl)}</text>
    <!-- Center line -->
    <line x1="${x1}" y1="${ctrY}" x2="${x2}" y2="${ctrY}" stroke="${C.primary}" stroke-width="1.5" stroke-dasharray="4,2"/>
    <text x="${(padL - 4).toFixed(1)}" y="${ctrY}" text-anchor="end" font-size="8" fill="${C.primary}" dominant-baseline="middle">${isXbar ? "X̿" : "p̄"}</text>
    <text x="${(padL + chartW + 3).toFixed(1)}" y="${ctrY}" font-size="7" fill="${C.primary}" dominant-baseline="middle">${fmtY(centerY)}</text>
    <!-- LCL line -->
    <line x1="${x1}" y1="${lclY}" x2="${x2}" y2="${lclY}" stroke="${C.blue}" stroke-width="1.5" stroke-dasharray="6,3"/>
    <text x="${(padL - 4).toFixed(1)}" y="${lclY}" text-anchor="end" font-size="8" fill="${C.blue}" dominant-baseline="middle">LCL</text>
    <text x="${(padL + chartW + 3).toFixed(1)}" y="${lclY}" font-size="7" fill="${C.blue}" dominant-baseline="middle">${fmtY(lcl)}</text>
    <!-- Data line -->
    <path d="${linePath}" fill="none" stroke="${C.text}" stroke-width="1.5"/>
    <!-- Dots -->
    ${dots}
    <!-- X labels -->
    ${xLabels}
    <!-- Legend row -->
    <circle cx="${padL}" cy="${legendY}" r="4" fill="${C.green}"/>
    <text x="${padL + 8}" y="${legendY + 1}" font-size="8" fill="${C.muted}" dominant-baseline="middle">${L("Sous contrôle", "تحت السيطرة")}</text>
    <circle cx="${padL + 90}" cy="${legendY}" r="4" fill="${C.red}"/>
    <text x="${padL + 98}" y="${legendY + 1}" font-size="8" fill="${C.muted}" dominant-baseline="middle">${L("Hors contrôle", "خارج السيطرة")}</text>
  </svg>`;
}

// ── Cover page ────────────────────────────────────────────────────────────────
function buildCover(opts: QualityControlPDFOptions, reportId: string, generatedAt: string, totalPages: number): string {
  const L = lbl(opts.language);
  const r = opts.results;
  const isXbar = r.chartType === "xbar";
  const xr = r as XbarResults;
  const pr = r as PResults;

  const chartTypeLabelFr = isXbar ? "Carte de contrôle X-bar (Moyennes)" : "Carte de contrôle P (Taux de défauts)";
  const chartTypeLabelAr = isXbar ? "بطاقة المتوسط (X-bar)" : "بطاقة نسبة العيوب (P)";

  const statCards = isXbar
    ? [
        { label: L("Échantillons analysés", "عينات محللة"), value: String(xr.samples.length), color: C.primary, bg: C.primaryLight },
        { label: L("Hors contrôle", "خارج السيطرة"), value: String(xr.outOfControlCount), color: xr.outOfControlCount > 0 ? C.red : C.green, bg: xr.outOfControlCount > 0 ? C.redLight : C.greenLight },
        { label: L("Moyenne générale X̿", "المتوسط العام X̿"), value: fmtN(xr.grandMean), color: C.primary, bg: C.primaryLight },
        { label: L("Écart-type σ", "الانحراف المعياري σ"), value: fmtN(xr.processStdDev), color: C.blue, bg: C.blueLight },
      ]
    : [
        { label: L("Échantillons analysés", "عينات محللة"), value: String(pr.samples.length), color: C.primary, bg: C.primaryLight },
        { label: L("Hors contrôle", "خارج السيطرة"), value: String(pr.outOfControlCount), color: pr.outOfControlCount > 0 ? C.red : C.green, bg: pr.outOfControlCount > 0 ? C.redLight : C.greenLight },
        { label: L("Taux moyen p̄", "معدل العيوب p̄"), value: pct(pr.pBar), color: pr.pBar > 0.1 ? C.red : pr.pBar > 0.05 ? C.amber : C.green, bg: pr.pBar > 0.1 ? C.redLight : pr.pBar > 0.05 ? C.amberLight : C.greenLight },
        { label: L("Total inspecté", "إجمالي المفحوص"), value: String(pr.totalInspected), color: C.blue, bg: C.blueLight },
      ];

  const statusColor  = r.processStatus === "in-control" ? C.green : C.red;
  const statusLabelFr = r.processStatus === "in-control" ? "SOUS CONTRÔLE" : "HORS CONTRÔLE";
  const statusLabelAr = r.processStatus === "in-control" ? "تحت السيطرة" : "خارج السيطرة";

  const chartSvg = buildChartSvg(r, opts.language);

  const content = `
    <div style="background:${C.primary};border-radius:12px;padding:32px 40px;margin-bottom:22px;position:relative;overflow:hidden;">
      <div style="position:relative;z-index:1;">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.65);text-transform:uppercase;margin-bottom:8px;">
          ${L("RAPPORT QUALITÉ — GESTION INDUSTRIELLE", "تقرير الجودة — التسيير الصناعي")}
        </div>
        <h1 style="font-size:24px;font-weight:900;color:${C.white};margin:0 0 6px;line-height:1.2;">
          ${opts.problemName || L("Gestion de la Qualité", "إدارة الجودة")}
        </h1>
        <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-bottom:10px;">${opts.language === "ar" ? chartTypeLabelAr : chartTypeLabelFr}</div>
        <div style="display:inline-block;background:${statusColor};color:${C.white};font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;">
          ${opts.language === "ar" ? statusLabelAr : statusLabelFr}
        </div>
        <div style="margin-top:14px;display:flex;gap:12px;flex-wrap:wrap;">
          <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:7px 14px;">
            <div style="font-size:9px;color:rgba(255,255,255,0.65);">${L("Rapport ID", "معرّف التقرير")}</div>
            <div style="font-size:12px;font-weight:700;color:${C.white};font-family:monospace;">${reportId}</div>
          </div>
          <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:7px 14px;">
            <div style="font-size:9px;color:rgba(255,255,255,0.65);">${L("Généré le", "تاريخ الإنشاء")}</div>
            <div style="font-size:12px;font-weight:700;color:${C.white};">${generatedAt}</div>
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">
      ${statCards.map(s => `
        <div style="background:${s.bg};border:1px solid ${s.color}30;border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:20px;font-weight:900;color:${s.color};">${s.value}</div>
          <div style="font-size:9px;color:${C.muted};margin-top:3px;line-height:1.3;">${s.label}</div>
        </div>`).join("")}
    </div>

    ${secTitle(L("Carte de Contrôle", "بطاقة المراقبة"))}
    <div style="border:1px solid ${C.border};border-radius:8px;overflow:hidden;margin-bottom:4px;">
      ${chartSvg}
    </div>`;

  return pageShell(content, 1, totalPages, L("Vue d'ensemble", "نظرة عامة"), opts.language);
}

// ── Results table page ────────────────────────────────────────────────────────
function buildTablePage(opts: QualityControlPDFOptions, totalPages: number): string {
  const L = lbl(opts.language);
  const r = opts.results;
  const isXbar = r.chartType === "xbar";

  let tableHtml = "";

  if (isXbar) {
    const xr = r as XbarResults;
    tableHtml = `
      <table style="width:100%;border-collapse:collapse;font-size:9px;">
        <thead>
          <tr>
            <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:left;border-radius:4px 0 0 0;">${L("Échantillon", "العينة")}</th>
            <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;">${L("Mesures", "القياسات")}</th>
            <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;">n</th>
            <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;">x̄ᵢ</th>
            <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;">UCL</th>
            <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;">LCL</th>
            <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;border-radius:0 4px 0 0;">${L("Statut", "الحالة")}</th>
          </tr>
        </thead>
        <tbody>
          ${xr.samples.map((s, i) => {
            const oc = s.isOutOfControl;
            return `<tr style="background:${oc ? C.redLight : i % 2 === 0 ? "#f8faf9" : C.white};">
              <td style="padding:5px 8px;font-weight:700;border:1px solid ${C.border};">${s.label}</td>
              <td style="padding:5px 8px;border:1px solid ${C.border};font-family:monospace;font-size:8px;">${s.measurements.map(m => m.toFixed(2)).join(", ")}</td>
              <td style="padding:5px 8px;text-align:center;border:1px solid ${C.border};">${s.sampleSize}</td>
              <td style="padding:5px 8px;text-align:center;font-weight:700;border:1px solid ${C.border};color:${oc ? C.red : C.primary};">${fmtN(s.sampleMean)}</td>
              <td style="padding:5px 8px;text-align:center;border:1px solid ${C.border};color:${C.red};font-size:8px;">${fmtN(s.ucl)}</td>
              <td style="padding:5px 8px;text-align:center;border:1px solid ${C.border};color:${C.blue};font-size:8px;">${fmtN(s.lcl)}</td>
              <td style="padding:5px 8px;text-align:center;border:1px solid ${C.border};">
                <span style="background:${oc ? C.redLight : C.greenLight};color:${oc ? C.red : C.green};font-size:8px;font-weight:700;padding:2px 6px;border-radius:10px;">
                  ${oc ? (opts.language === "ar" ? "خارج" : "HORS") : (opts.language === "ar" ? "سليم" : "OK")}
                </span>
              </td>
            </tr>`;
          }).join("")}
          <tr style="background:${C.primaryLight};font-weight:800;">
            <td colspan="3" style="padding:6px 8px;border:1px solid ${C.border};">${L("Paramètres de contrôle", "معاملات المراقبة")}</td>
            <td style="padding:6px 8px;text-align:center;border:1px solid ${C.border};color:${C.primary};">${fmtN(xr.grandMean)} (X̿)</td>
            <td style="padding:6px 8px;text-align:center;border:1px solid ${C.border};color:${C.red};">${fmtN(xr.ucl)}</td>
            <td style="padding:6px 8px;text-align:center;border:1px solid ${C.border};color:${C.blue};">${fmtN(xr.lcl)}</td>
            <td style="padding:6px 8px;text-align:center;border:1px solid ${C.border};font-size:8px;color:${C.muted};">σ = ${fmtN(xr.processStdDev)}</td>
          </tr>
        </tbody>
      </table>`;
  } else {
    const pr = r as PResults;
    tableHtml = `
      <table style="width:100%;border-collapse:collapse;font-size:9px;">
        <thead>
          <tr>
            <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:left;border-radius:4px 0 0 0;">${L("Échantillon", "العينة")}</th>
            <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;">n</th>
            <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;">${L("Défauts d", "العيوب d")}</th>
            <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;">pᵢ (%)</th>
            <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;">UCL (%)</th>
            <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;">LCL (%)</th>
            <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;border-radius:0 4px 0 0;">${L("Statut", "الحالة")}</th>
          </tr>
        </thead>
        <tbody>
          ${pr.samples.map((s, i) => {
            const oc = s.isOutOfControl;
            return `<tr style="background:${oc ? C.redLight : i % 2 === 0 ? "#f8faf9" : C.white};">
              <td style="padding:5px 8px;font-weight:700;border:1px solid ${C.border};">${s.label}</td>
              <td style="padding:5px 8px;text-align:center;border:1px solid ${C.border};">${s.n}</td>
              <td style="padding:5px 8px;text-align:center;border:1px solid ${C.border};">${s.d}</td>
              <td style="padding:5px 8px;text-align:center;font-weight:700;border:1px solid ${C.border};color:${oc ? C.red : C.primary};">${pct(s.rate)}</td>
              <td style="padding:5px 8px;text-align:center;border:1px solid ${C.border};color:${C.red};font-size:8px;">${pct(s.ucl)}</td>
              <td style="padding:5px 8px;text-align:center;border:1px solid ${C.border};color:${C.blue};font-size:8px;">${pct(s.lcl)}</td>
              <td style="padding:5px 8px;text-align:center;border:1px solid ${C.border};">
                <span style="background:${oc ? C.redLight : C.greenLight};color:${oc ? C.red : C.green};font-size:8px;font-weight:700;padding:2px 6px;border-radius:10px;">
                  ${oc ? (opts.language === "ar" ? "خارج" : "HORS") : (opts.language === "ar" ? "سليم" : "OK")}
                </span>
              </td>
            </tr>`;
          }).join("")}
          <tr style="background:${C.primaryLight};font-weight:800;">
            <td style="padding:6px 8px;border:1px solid ${C.border};">${L("Total / Moyenne", "الإجمالي / المتوسط")}</td>
            <td style="padding:6px 8px;text-align:center;border:1px solid ${C.border};">${pr.totalInspected}</td>
            <td style="padding:6px 8px;text-align:center;border:1px solid ${C.border};">${pr.totalDefects}</td>
            <td style="padding:6px 8px;text-align:center;border:1px solid ${C.border};color:${C.primary};">${pct(pr.pBar)} (p̄)</td>
            <td style="padding:6px 8px;text-align:center;border:1px solid ${C.border};color:${C.red};">${pct(pr.uclConstant)}</td>
            <td style="padding:6px 8px;text-align:center;border:1px solid ${C.border};color:${C.blue};">${pct(pr.lclConstant)}</td>
            <td style="padding:6px 8px;border:1px solid ${C.border};font-size:8px;color:${C.muted};">ñ = ${pr.avgN.toFixed(1)}</td>
          </tr>
        </tbody>
      </table>`;
  }

  const content = `
    ${secTitle(L(
      isXbar ? "Tableau des Résultats — Carte X-bar" : "Tableau des Résultats — Carte P",
      isXbar ? "جدول النتائج — بطاقة X-bar" : "جدول النتائج — بطاقة P"
    ))}
    ${tableHtml}`;

  return pageShell(content, 2, totalPages, L("Tableau des résultats", "جدول النتائج"), opts.language);
}

// ── Analysis + Recommendations page ──────────────────────────────────────────
function buildAnalysisPage(opts: QualityControlPDFOptions, totalPages: number): string {
  const L = lbl(opts.language);

  const analysisHtml = opts.analysisLines.map(line => `
    <div style="background:${C.primaryLight};border:1px solid ${C.border};border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:10px;line-height:1.6;">
      ${opts.language === "ar" ? line.ar : line.fr}
    </div>`).join("");

  const recoHtml = opts.recommendations.map((r, i) => `
    <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 16px;margin-bottom:10px;border-left:4px solid ${[C.green, C.accent, C.primary, C.amber, C.red, C.blue][i % 6]};">
      <div style="font-size:11px;font-weight:700;margin-bottom:4px;">${r.icon} ${opts.language === "ar" ? r.ar : r.fr}</div>
      <div style="font-size:9.5px;color:${C.muted};line-height:1.6;">${opts.language === "ar" ? r.descAr : r.descFr}</div>
    </div>`).join("");

  const content = `
    ${secTitle(L("Analyse de la Situation", "تحليل الوضع"))}
    ${analysisHtml}
    ${secTitle(L("Recommandations Managériales", "التوصيات الإدارية"))}
    ${recoHtml}`;

  return pageShell(content, 3, totalPages, L("Analyse & Recommandations", "التحليل والتوصيات"), opts.language);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateQualityControlPDF(opts: QualityControlPDFOptions): Promise<void> {
  const reportId = genId();
  const generatedAt = new Date().toLocaleDateString("fr-DZ");
  const totalPages = 3;

  const pages = [
    buildCover(opts, reportId, generatedAt, totalPages),
    buildTablePage(opts, totalPages),
    buildAnalysisPage(opts, totalPages),
  ];

  opts.onProgress?.("Préparation des pages…", 5);

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;z-index:-1;";
  document.body.appendChild(container);

  const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4", hotfixes: ["px_scaling"] });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  try {
    for (let i = 0; i < pages.length; i++) {
      opts.onProgress?.(`Page ${i + 1} / ${totalPages}…`, 10 + (i / totalPages) * 70);
      container.innerHTML = pages[i];
      const el = container.firstElementChild as HTMLElement;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fbf8f1",
        width: 794,
        windowWidth: 794,
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pdfW, pdfH);
    }
    opts.onProgress?.("Téléchargement…", 95);
    const safeName = (opts.problemName || "qualite").replace(/[^a-z0-9\u0600-\u06FF]/gi, "-").slice(0, 40);
    pdf.save(`optimdz-qualite-${safeName}-${reportId}.pdf`);
    opts.onProgress?.("Terminé", 100);
  } finally {
    document.body.removeChild(container);
  }
}
