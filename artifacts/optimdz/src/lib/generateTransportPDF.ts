// ── Transport Problem — PDF Report Generator ──────────────────────────────────
// Same branding / jsPDF + html2canvas pattern as generatePDFReport.ts

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { TransportProblem } from "./TransportContext";
import type { MODIResult, MODIIteration } from "./modiAlgorithm";

// ── Brand tokens (identical to Simplex report) ────────────────────────────────
const C = {
  primary:      "#004d40",
  primaryLight: "#e0f2f1",
  secondary:    "#3a7d44",
  accent:       "#f4a261",
  bg:           "#fbf8f1",
  text:         "#0c2621",
  muted:        "#5f7b77",
  orange:       "#e65100",
  orangeLight:  "#fff3e0",
  green:        "#2e7d32",
  greenLight:   "#e8f5e9",
  red:          "#b71c1c",
  redLight:     "#ffebee",
  blue:         "#0d47a1",
  blueLight:    "#e3f2fd",
  border:       "#c8dad6",
  white:        "#ffffff",
};

function fmt(n: number, lang: string, decimals = 0): string {
  if (!isFinite(n)) return "∞";
  return n.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  });
}

function genReportId(): string {
  return `TRP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function sectorLabel(sector: string): string {
  const map: Record<string, string> = {
    industry:    "صناعة / Industrie",
    trade:       "تجارة / Commerce",
    services:    "خدمات / Services",
    agriculture: "فلاحة / Agriculture",
    custom:      "مخصص / Personnalisé",
  };
  return map[sector] ?? sector;
}

// ── Page shell (same as Simplex) ──────────────────────────────────────────────
function pageShell(content: string, pageNum: number, totalPages: number, title: string): string {
  return `
    <div style="
      width:794px; min-height:1123px; background:${C.bg};
      font-family:'Cairo','Inter',sans-serif; color:${C.text};
      position:relative; box-sizing:border-box; page-break-after:always;
      display:flex; flex-direction:column;
    ">
      <div style="background:${C.primary}; padding:10px 32px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:28px; height:28px; background:${C.white}; border-radius:6px; display:flex; align-items:center; justify-content:center;">
            <div style="width:16px; height:16px; background:${C.primary}; border-radius:3px;"></div>
          </div>
          <span style="color:${C.white}; font-weight:700; font-size:16px; letter-spacing:0.5px;">OptimDZ</span>
        </div>
        <span style="color:rgba(255,255,255,0.75); font-size:11px;">${title}</span>
        <span style="color:rgba(255,255,255,0.6); font-size:10px;">${pageNum} / ${totalPages}</span>
      </div>
      <div style="flex:1; padding:32px 36px 24px; display:flex; flex-direction:column; gap:0;">
        ${content}
      </div>
      <div style="border-top:1px solid ${C.border}; padding:8px 36px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
        <span style="font-size:9px; color:${C.muted};">نظام OptimDZ لدعم القرار الإداري — Système OptimDZ d'Aide à la Décision</span>
        <span style="font-size:9px; color:${C.muted};">www.optimdz.replit.app</span>
      </div>
    </div>
  `;
}

// ── Cover page ─────────────────────────────────────────────────────────────────
function buildCover(
  problem: TransportProblem,
  result: MODIResult,
  managerName: string,
  institutionName: string,
  reportId: string,
  generatedAt: string,
  totalPages: number,
  lang: string
): string {
  const isMin  = problem.objectiveType === "minimize";
  const objFr  = isMin ? "Minimisation du Coût" : "Maximisation du Profit";
  const objAr  = isMin ? "تقليل التكلفة" : "تعظيم الربح";
  const valLabel = isMin ? "التكلفة المثلى / Coût Optimal" : "الربح الأمثل / Profit Optimal";

  void totalPages;
  return `
    <div style="
      width:794px; min-height:1123px; background:${C.primary};
      font-family:'Cairo','Inter',sans-serif; color:${C.white};
      position:relative; box-sizing:border-box; display:flex; flex-direction:column;
    ">
      <div style="height:6px; background:${C.accent};"></div>
      <div style="padding:28px 40px 0; display:flex; align-items:center; gap:12px;">
        <div style="width:40px; height:40px; background:${C.white}; border-radius:10px; display:flex; align-items:center; justify-content:center;">
          <div style="width:22px; height:22px; background:${C.primary}; border-radius:5px; display:flex; align-items:center; justify-content:center;">
            <div style="width:10px; height:10px; background:${C.white}; border-radius:2px;"></div>
          </div>
        </div>
        <div>
          <div style="font-size:22px; font-weight:800; letter-spacing:1px;">OptimDZ</div>
          <div style="font-size:10px; color:rgba(255,255,255,0.65); margin-top:1px;">نظام دعم القرار الإداري — مسألة النقل</div>
        </div>
      </div>
      <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 40px; text-align:center; gap:16px;">
        <div style="font-size:11px; letter-spacing:3px; color:${C.accent}; text-transform:uppercase; font-weight:600;">تقرير رسمي · Rapport Officiel</div>
        <div style="font-size:28px; font-weight:800; line-height:1.3; direction:rtl;">تقرير تحسين مسألة النقل</div>
        <div style="font-size:17px; font-weight:400; color:rgba(255,255,255,0.8);">Rapport d'Optimisation du Problème de Transport</div>
        <div style="width:60px; height:3px; background:${C.accent}; border-radius:2px; margin:8px 0;"></div>
        <div style="font-size:13px; color:rgba(255,255,255,0.7);">${objAr} · ${objFr}</div>
        <div style="font-size:14px; font-weight:600; margin-top:8px;">${lang === "ar" ? problem.name : problem.name}</div>
      </div>
      <div style="padding:0 40px 32px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        ${[
          ["المدير / Responsable", managerName || "—"],
          ["المؤسسة / Institution", institutionName || "—"],
          ["القطاع / Secteur", sectorLabel(problem.sector)],
          [valLabel, fmt(result.finalCost, lang) + " DZD"],
          ["تاريخ الإصدار / Date", generatedAt],
          ["رقم التقرير / N° Rapport", reportId],
        ].map(([label, value]) => `
          <div style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:10px; padding:12px 16px;">
            <div style="font-size:9px; color:rgba(255,255,255,0.55); margin-bottom:4px;">${label}</div>
            <div style="font-size:13px; font-weight:700;">${value}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

// ── Problem Setup page ────────────────────────────────────────────────────────
function buildSetupPage(problem: TransportProblem, result: MODIResult, pageNum: number, totalPages: number, lang: string): string {
  const { balanced } = result;
  const m = balanced.sources.length;
  const n = balanced.destinations.length;

  const hasDummySrc  = balanced.dummySourceIndex !== null;
  const hasDummyDest = balanced.dummyDestIndex !== null;

  const cellStyle = (i: number, j: number): string => {
    const isDs = hasDummySrc  && i === balanced.dummySourceIndex;
    const isDd = hasDummyDest && j === balanced.dummyDestIndex;
    if (isDs || isDd) return `background:${C.orangeLight}; color:${C.orange};`;
    return `background:${C.white};`;
  };

  const matrix = `
    <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:8px;">
      <thead>
        <tr style="background:${C.primary}; color:${C.white};">
          <th style="padding:6px 8px; text-align:left; border:1px solid ${C.border};">Source / وجهة</th>
          ${balanced.destinations.map(d => `<th style="padding:6px 8px; text-align:center; border:1px solid ${C.border};">${d.name}</th>`).join("")}
          <th style="padding:6px 8px; text-align:center; border:1px solid ${C.border}; background:${C.secondary};">Offre / عرض</th>
        </tr>
      </thead>
      <tbody>
        ${balanced.sources.map((s, i) => `
          <tr>
            <td style="padding:6px 8px; font-weight:600; border:1px solid ${C.border}; background:${C.primaryLight};">${s.name}</td>
            ${balanced.destinations.map((_, j) => `
              <td style="padding:6px 8px; text-align:center; border:1px solid ${C.border}; ${cellStyle(i, j)}">
                ${fmt(balanced.costs[i]?.[j] ?? 0, lang)}
              </td>
            `).join("")}
            <td style="padding:6px 8px; text-align:center; font-weight:700; border:1px solid ${C.border}; background:${C.greenLight}; color:${C.green};">${fmt(s.supply, lang)}</td>
          </tr>
        `).join("")}
        <tr style="background:${C.blueLight};">
          <td style="padding:6px 8px; font-weight:600; border:1px solid ${C.border}; color:${C.blue};">Demande / طلب</td>
          ${balanced.destinations.map(d => `<td style="padding:6px 8px; text-align:center; font-weight:700; border:1px solid ${C.border}; color:${C.blue};">${fmt(d.demand, lang)}</td>`).join("")}
          <td style="padding:6px 8px; text-align:center; font-weight:700; border:1px solid ${C.border};">${fmt(balanced.sources.reduce((s,x)=>s+x.supply,0), lang)}</td>
        </tr>
      </tbody>
    </table>
  `;

  const content = `
    <div style="font-size:18px; font-weight:800; color:${C.primary}; margin-bottom:4px;">Configuration du Problème · إعداد المسألة</div>
    <div style="font-size:11px; color:${C.muted}; margin-bottom:16px;">${m} sources × ${n} destinations${hasDummySrc || hasDummyDest ? ` · Équilibrage appliqué (ligne/colonne fictive ajoutée)` : ""}</div>
    ${matrix}
    ${(hasDummySrc || hasDummyDest) ? `
      <div style="margin-top:12px; padding:10px 14px; background:${C.orangeLight}; border-left:4px solid ${C.orange}; border-radius:4px; font-size:11px; color:${C.orange};">
        <strong>Équilibrage automatique :</strong> 
        ${hasDummySrc ? `Une source fictive « Fictive » (offre = ${fmt(balanced.sources[balanced.dummySourceIndex!]?.supply ?? 0, lang)}, coûts = 0) a été ajoutée.` : ""}
        ${hasDummyDest ? `Une destination fictive « Fictive » (demande = ${fmt(balanced.destinations[balanced.dummyDestIndex!]?.demand ?? 0, lang)}, coûts = 0) a été ajoutée.` : ""}
      </div>
    ` : ""}
    <div style="margin-top:16px;">
      <div style="font-size:14px; font-weight:700; color:${C.primary}; margin-bottom:8px;">Résumé · ملخص</div>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
        ${[
          ["Méthode initiale", result.initialMethod.toUpperCase()],
          ["Objectif", problem.objectiveType === "minimize" ? "Minimisation" : "Maximisation"],
          ["Itérations MODI", String(result.iterations.length - 1)],
        ].map(([l, v]) => `
          <div style="background:${C.white}; border:1px solid ${C.border}; border-radius:8px; padding:10px 12px;">
            <div style="font-size:9px; color:${C.muted}; margin-bottom:3px;">${l}</div>
            <div style="font-size:14px; font-weight:700; color:${C.primary};">${v}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  return pageShell(content, pageNum, totalPages, "Configuration · الإعداد");
}

// ── MODI Iterations page ──────────────────────────────────────────────────────
function buildIterationsPage(result: MODIResult, pageNum: number, totalPages: number, lang: string): string {
  const iters = result.iterations;
  const rows = iters.map((it, idx) => {
    const isLast = idx === iters.length - 1;
    return `
      <tr style="background:${isLast ? C.greenLight : C.white};">
        <td style="padding:6px 10px; border:1px solid ${C.border}; font-weight:600;">${it.iterationNumber}</td>
        <td style="padding:6px 10px; border:1px solid ${C.border};">
          ${it.enteringCell
            ? `(${it.enteringCell.i + 1},${it.enteringCell.j + 1}) — θ = ${fmt(it.theta ?? 0, lang)}`
            : `<span style="color:${C.green}; font-weight:700;">✓ Optimal</span>`}
        </td>
        <td style="padding:6px 10px; border:1px solid ${C.border};">
          ${it.leavingCell ? `(${it.leavingCell.i + 1},${it.leavingCell.j + 1})` : "—"}
        </td>
        <td style="padding:6px 10px; border:1px solid ${C.border}; font-weight:700; color:${isLast ? C.green : C.text};">
          ${fmt(it.totalCost, lang)} DZD
        </td>
      </tr>
    `;
  }).join("");

  const content = `
    <div style="font-size:18px; font-weight:800; color:${C.primary}; margin-bottom:4px;">Optimisation MODI · تحسين MODI</div>
    <div style="font-size:11px; color:${C.muted}; margin-bottom:16px;">
      ${result.iterations.length - 1} itération${result.iterations.length > 2 ? "s" : ""} effectuée${result.iterations.length > 2 ? "s" : ""}
      ${result.degeneracyHandled ? " · Dégénérescence traitée (ε-perturbation)" : ""}
    </div>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead>
        <tr style="background:${C.primary}; color:${C.white};">
          <th style="padding:8px 10px; text-align:left; border:1px solid ${C.border};">Itération</th>
          <th style="padding:8px 10px; text-align:left; border:1px solid ${C.border};">Variable entrante · θ</th>
          <th style="padding:8px 10px; text-align:left; border:1px solid ${C.border};">Variable sortante</th>
          <th style="padding:8px 10px; text-align:left; border:1px solid ${C.border};">Coût total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${result.hasAlternativeOptima ? `
      <div style="margin-top:12px; padding:10px 14px; background:${C.blueLight}; border-left:4px solid ${C.blue}; border-radius:4px; font-size:11px; color:${C.blue};">
        <strong>Solutions optimales alternatives :</strong> Des cellules hors-base avec coût d'opportunité = 0 ont été détectées 
        (${result.alternativeOptimaCells.map(c => `(${c.i+1},${c.j+1})`).join(", ")}). 
        La solution présentée est l'une des solutions optimales possibles.
      </div>
    ` : ""}
    <div style="margin-top:16px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
      <div style="background:${C.greenLight}; border:1px solid ${C.green}; border-radius:8px; padding:14px 16px; text-align:center;">
        <div style="font-size:10px; color:${C.muted}; margin-bottom:4px;">${lang === "ar" ? "التكلفة الأمثل" : "Coût optimal"}</div>
        <div style="font-size:22px; font-weight:800; color:${C.green};">${fmt(result.finalCost, lang)} DZD</div>
      </div>
      <div style="background:${C.white}; border:1px solid ${C.border}; border-radius:8px; padding:14px 16px; text-align:center;">
        <div style="font-size:10px; color:${C.muted}; margin-bottom:4px;">${lang === "ar" ? "حالة الحل" : "Statut de la solution"}</div>
        <div style="font-size:16px; font-weight:700; color:${result.isOptimal ? C.green : C.orange};">
          ${result.isOptimal ? "✓ Optimal" : "⚠ Non convergé"}
        </div>
      </div>
    </div>
  `;

  return pageShell(content, pageNum, totalPages, "Optimisation MODI · التحسين");
}

// ── Distribution Plan page ────────────────────────────────────────────────────
function buildDistributionPage(problem: TransportProblem, result: MODIResult, pageNum: number, totalPages: number, lang: string): string {
  const { balanced, finalAllocation, sensitivityRanges } = result;
  const epsilonSet = new Set(result.epsilonCells.map(c => `${c.i},${c.j}`));

  const activeRoutes = sensitivityRanges.filter(r => r.allocation > 0);

  const routeRows = activeRoutes.map(r => `
    <tr style="background:${C.white};">
      <td style="padding:6px 10px; border:1px solid ${C.border}; font-weight:600;">${r.sourceName}</td>
      <td style="padding:6px 10px; border:1px solid ${C.border}; font-weight:600;">${r.destName}</td>
      <td style="padding:6px 10px; text-align:center; border:1px solid ${C.border}; font-weight:700; color:${C.primary};">${fmt(r.allocation, lang)}</td>
      <td style="padding:6px 10px; text-align:center; border:1px solid ${C.border};">${fmt(r.unitCost, lang)}</td>
      <td style="padding:6px 10px; text-align:right; border:1px solid ${C.border}; font-weight:600; color:${C.secondary};">${fmt(r.allocation * r.unitCost, lang)}</td>
    </tr>
  `).join("");

  // Also show zero-allocation routes for completeness
  const m = balanced.sources.length;
  const n = balanced.destinations.length;
  let zeroRows = "";
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if ((finalAllocation[i]?.[j] ?? 0) === 0 && !epsilonSet.has(`${i},${j}`)) {
        // non-used route
      }
    }
  }
  void zeroRows;

  const content = `
    <div style="font-size:18px; font-weight:800; color:${C.primary}; margin-bottom:4px;">Plan de Distribution Optimal · خطة التوزيع المثلى</div>
    <div style="font-size:11px; color:${C.muted}; margin-bottom:16px;">Routes actives uniquement · Routes utilisées dans la solution optimale</div>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead>
        <tr style="background:${C.primary}; color:${C.white};">
          <th style="padding:8px 10px; text-align:left; border:1px solid ${C.border};">Source / مصدر</th>
          <th style="padding:8px 10px; text-align:left; border:1px solid ${C.border};">Destination / وجهة</th>
          <th style="padding:8px 10px; text-align:center; border:1px solid ${C.border};">Quantité / كمية</th>
          <th style="padding:8px 10px; text-align:center; border:1px solid ${C.border};">Coût unitaire</th>
          <th style="padding:8px 10px; text-align:right; border:1px solid ${C.border};">Coût total</th>
        </tr>
      </thead>
      <tbody>
        ${routeRows}
        <tr style="background:${C.greenLight}; font-weight:800;">
          <td colspan="4" style="padding:8px 10px; border:1px solid ${C.border}; color:${C.green};">TOTAL OPTIMAL / المجموع الأمثل</td>
          <td style="padding:8px 10px; text-align:right; border:1px solid ${C.border}; font-size:14px; color:${C.green};">${fmt(result.finalCost, lang)} DZD</td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:20px;">
      <div style="font-size:14px; font-weight:700; color:${C.primary}; margin-bottom:10px;">Analyse de Sensibilité · تحليل الحساسية</div>
      <table style="width:100%; border-collapse:collapse; font-size:11px;">
        <thead>
          <tr style="background:${C.secondary}; color:${C.white};">
            <th style="padding:6px 8px; text-align:left; border:1px solid ${C.border};">Route</th>
            <th style="padding:6px 8px; text-align:center; border:1px solid ${C.border};">Coût actuel</th>
            <th style="padding:6px 8px; text-align:center; border:1px solid ${C.border};">Plage [min, max]</th>
            <th style="padding:6px 8px; text-align:center; border:1px solid ${C.border};">Marge ↓</th>
            <th style="padding:6px 8px; text-align:center; border:1px solid ${C.border};">Marge ↑</th>
          </tr>
        </thead>
        <tbody>
          ${sensitivityRanges.map(r => `
            <tr style="background:${C.white};">
              <td style="padding:5px 8px; border:1px solid ${C.border}; font-size:10px;">${r.sourceName} → ${r.destName}</td>
              <td style="padding:5px 8px; text-align:center; border:1px solid ${C.border}; font-weight:700;">${fmt(r.unitCost, lang)}</td>
              <td style="padding:5px 8px; text-align:center; border:1px solid ${C.border};">[${fmt(r.lowerBound, lang, 2)}, ${r.upperBound === Infinity ? "∞" : fmt(r.upperBound, lang, 2)}]</td>
              <td style="padding:5px 8px; text-align:center; border:1px solid ${C.border}; color:${C.orange};">${r.allowedDecrease === Infinity ? "∞" : fmt(r.allowedDecrease, lang, 2)}</td>
              <td style="padding:5px 8px; text-align:center; border:1px solid ${C.border}; color:${C.secondary};">${r.allowedIncrease === Infinity ? "∞" : fmt(r.allowedIncrease, lang, 2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  return pageShell(content, pageNum, totalPages, "Distribution & Sensibilité · التوزيع والحساسية");
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface GenerateTransportPDFOptions {
  problem:         TransportProblem;
  modiResult:      MODIResult;
  initialCost:     number;
  managerName:     string;
  institutionName: string;
  language:        string;
  onProgress:      (step: string, pct: number) => void;
}

export async function generateTransportPDF(opts: GenerateTransportPDFOptions): Promise<void> {
  const { problem, modiResult, managerName, institutionName, language, onProgress } = opts;
  const lang = language;

  onProgress("Préparation du rapport…", 5);

  const reportId    = genReportId();
  const generatedAt = new Date().toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  const TOTAL_PAGES = 4;

  const pageHtmls: string[] = [
    buildCover(problem, modiResult, managerName, institutionName, reportId, generatedAt, TOTAL_PAGES, lang),
    buildSetupPage(problem, modiResult, 2, TOTAL_PAGES, lang),
    buildIterationsPage(modiResult, 3, TOTAL_PAGES, lang),
    buildDistributionPage(problem, modiResult, 4, TOTAL_PAGES, lang),
  ];

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PAGE_W = 210, PAGE_H = 297;

  for (let p = 0; p < pageHtmls.length; p++) {
    const pct = 10 + Math.round((p / pageHtmls.length) * 85);
    onProgress(`Rendu page ${p + 1} / ${TOTAL_PAGES}…`, pct);

    const container = document.createElement("div");
    container.style.cssText = "position:fixed; left:-9999px; top:0; z-index:-1;";
    container.innerHTML = pageHtmls[p];
    document.body.appendChild(container);

    const el = container.firstElementChild as HTMLElement;
    const canvas = await html2canvas(el, {
      scale: 2, useCORS: true, logging: false,
      backgroundColor: p === 0 ? C.primary : C.bg,
    });
    document.body.removeChild(container);

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    if (p > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, 0, PAGE_W, PAGE_H);
  }

  onProgress("Téléchargement…", 98);
  const filename = `OptimDZ_Transport_${problem.sector}_${Date.now()}.pdf`;
  pdf.save(filename);
  onProgress("Terminé !", 100);
}
