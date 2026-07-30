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

// ── Bidi-safe span helpers ─────────────────────────────────────────────────────
// html2canvas re-implements text rendering and does not correctly apply the
// Unicode Bidirectional Algorithm for mixed AR/FR inline text.  Without
// explicit directional isolation, Arabic strong characters cause the whole
// text run to be treated as RTL, reversing Latin characters entirely.
// Wrapping each directional run in display:inline-block with an explicit
// direction forces html2canvas to render each run independently.
function arSpan(text: string): string {
  return `<span style="display:inline-block;direction:rtl;unicode-bidi:isolate;">${text}</span>`;
}
function frSpan(text: string): string {
  return `<span style="display:inline-block;direction:ltr;unicode-bidi:isolate;">${text}</span>`;
}
// Arabic · French  (Arabic shown first in source order)
function arFr(ar: string, fr: string, sep = " · "): string {
  return `${arSpan(ar)}${sep}${frSpan(fr)}`;
}
// French · Arabic  (French shown first in source order)
function frAr(fr: string, ar: string, sep = " · "): string {
  return `${frSpan(fr)}${sep}${arSpan(ar)}`;
}
// French / Arabic  (slash-separated, FR label first)
function frSlashAr(fr: string, ar: string): string {
  return `${frSpan(fr)} / ${arSpan(ar)}`;
}
// Arabic / French  (slash-separated, AR label first)
function arSlashFr(ar: string, fr: string): string {
  return `${arSpan(ar)} / ${frSpan(fr)}`;
}

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
    industry:    arSlashFr("صناعة", "Industrie"),
    trade:       arSlashFr("تجارة", "Commerce"),
    services:    arSlashFr("خدمات", "Services"),
    agriculture: arSlashFr("فلاحة", "Agriculture"),
    custom:      arSlashFr("مخصص", "Personnalisé"),
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
        <span style="font-size:9px; color:${C.muted};">${arFr("نظام OptimDZ لدعم القرار الإداري", "Système OptimDZ d'Aide à la Décision", " — ")}</span>
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
  const valLabel = isMin ? arSlashFr("التكلفة المثلى", "Coût Optimal") : arSlashFr("الربح الأمثل", "Profit Optimal");

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
        <div style="font-size:11px; letter-spacing:3px; color:${C.accent}; text-transform:uppercase; font-weight:600; direction:ltr;">${arFr("تقرير رسمي", "Rapport Officiel")}</div>
        <div style="font-size:28px; font-weight:800; line-height:1.3; direction:rtl;">تقرير تحسين مسألة النقل</div>
        <div style="font-size:17px; font-weight:400; color:rgba(255,255,255,0.8);">Rapport d'Optimisation du Problème de Transport</div>
        <div style="width:60px; height:3px; background:${C.accent}; border-radius:2px; margin:8px 0;"></div>
        <div style="font-size:13px; color:rgba(255,255,255,0.7);">${arFr(objAr, objFr)}</div>
        <div style="font-size:14px; font-weight:600; margin-top:8px;">${lang === "ar" ? problem.name : problem.name}</div>
      </div>
      <div style="padding:0 40px 32px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        ${[
          [arSlashFr("المدير", "Responsable"), managerName || "—"],
          [arSlashFr("المؤسسة", "Institution"), institutionName || "—"],
          [arSlashFr("القطاع", "Secteur"), sectorLabel(problem.sector)],
          [valLabel, fmt(result.finalCost, lang) + " DZD"],
          [arSlashFr("تاريخ الإصدار", "Date"), generatedAt],
          [arSlashFr("رقم التقرير", "N° Rapport"), reportId],
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
          <th style="padding:6px 8px; text-align:left; border:1px solid ${C.border};">${frSlashAr("Source", "وجهة")}</th>
          ${balanced.destinations.map(d => `<th style="padding:6px 8px; text-align:center; border:1px solid ${C.border};">${d.name}</th>`).join("")}
          <th style="padding:6px 8px; text-align:center; border:1px solid ${C.border}; background:${C.secondary};">${frSlashAr("Offre", "عرض")}</th>
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
          <td style="padding:6px 8px; font-weight:600; border:1px solid ${C.border}; color:${C.blue};">${frSlashAr("Demande", "طلب")}</td>
          ${balanced.destinations.map(d => `<td style="padding:6px 8px; text-align:center; font-weight:700; border:1px solid ${C.border}; color:${C.blue};">${fmt(d.demand, lang)}</td>`).join("")}
          <td style="padding:6px 8px; text-align:center; font-weight:700; border:1px solid ${C.border};">${fmt(balanced.sources.reduce((s,x)=>s+x.supply,0), lang)}</td>
        </tr>
      </tbody>
    </table>
  `;

  const content = `
    <div style="font-size:18px; font-weight:800; color:${C.primary}; margin-bottom:4px;">${frAr("Configuration du Problème", "إعداد المسألة")}</div>
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
      <div style="font-size:14px; font-weight:700; color:${C.primary}; margin-bottom:8px;">${frAr("Résumé", "ملخص")}</div>
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

  return pageShell(content, pageNum, totalPages, frAr("Configuration", "الإعداد"));
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
    <div style="font-size:18px; font-weight:800; color:${C.primary}; margin-bottom:4px;">${frAr("Optimisation MODI", "تحسين MODI")}</div>
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

  return pageShell(content, pageNum, totalPages, frAr("Optimisation MODI", "التحسين"));
}

// ── Distribution Plan page ────────────────────────────────────────────────────
function buildDistributionPage(
  problem: TransportProblem,
  result: MODIResult,
  initialCost: number,
  pageNum: number,
  totalPages: number,
  lang: string,
): string {
  const { balanced, sensitivityRanges } = result;
  const epsilonSet = new Set(result.epsilonCells.map(c => `${c.i},${c.j}`));

  // Mirror the UI: active routes exclude epsilon cells (like AnalysisTab does)
  const activeRoutes = sensitivityRanges.filter(
    r => r.allocation > 0 && !epsilonSet.has(`${r.i},${r.j}`),
  );

  const improvement = initialCost > 0
    ? ((initialCost - result.finalCost) / initialCost) * 100
    : 0;
  const totalIters = result.iterations.length - 1;
  const isMin = problem.objectiveType === "minimize";

  // ── KPI strip (mirrors AnalysisTab's 4 cards) ─────────────────────────────
  const kpiStrip = `
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:16px;">
      <div style="background:${C.greenLight}; border:1px solid ${C.green}; border-radius:8px; padding:10px 12px;">
        <div style="font-size:9px; color:${C.muted}; margin-bottom:3px;">${frSlashAr(isMin ? "Coût optimal" : "Profit optimal", isMin ? "التكلفة المثلى" : "الربح الأمثل")}</div>
        <div style="font-size:15px; font-weight:800; color:${C.green};">${fmt(result.finalCost, lang)} DZD</div>
      </div>
      <div style="background:${C.white}; border:1px solid ${C.border}; border-radius:8px; padding:10px 12px;">
        <div style="font-size:9px; color:${C.muted}; margin-bottom:3px;">${frSlashAr("Coût initial", "التكلفة الابتدائية")}</div>
        <div style="font-size:15px; font-weight:800; color:${C.text};">${fmt(initialCost, lang)} DZD</div>
      </div>
      <div style="background:${C.white}; border:1px solid ${C.border}; border-radius:8px; padding:10px 12px;">
        <div style="font-size:9px; color:${C.muted}; margin-bottom:3px;">${frSlashAr("Amélioration", "التحسين")}</div>
        <div style="font-size:15px; font-weight:800; color:${improvement > 0 ? C.secondary : C.muted};">${improvement.toFixed(1)}%</div>
      </div>
      <div style="background:${C.white}; border:1px solid ${C.border}; border-radius:8px; padding:10px 12px;">
        <div style="font-size:9px; color:${C.muted}; margin-bottom:3px;">${frSlashAr("Itérations MODI", "تكرارات MODI")}</div>
        <div style="font-size:15px; font-weight:800; color:${C.text};">${totalIters}</div>
      </div>
    </div>
  `;

  // ── Distribution table ────────────────────────────────────────────────────
  const routeRows = activeRoutes.map((r, idx) => `
    <tr style="background:${idx % 2 === 0 ? C.white : C.primaryLight};">
      <td style="padding:6px 10px; border:1px solid ${C.border}; font-weight:600;">${r.sourceName}</td>
      <td style="padding:6px 10px; border:1px solid ${C.border}; font-weight:600;">${r.destName}</td>
      <td style="padding:6px 10px; text-align:center; border:1px solid ${C.border}; font-weight:700; color:${C.primary};">${fmt(r.allocation, lang)}</td>
      <td style="padding:6px 10px; text-align:center; border:1px solid ${C.border};">${fmt(r.unitCost, lang)}</td>
      <td style="padding:6px 10px; text-align:right; border:1px solid ${C.border}; font-weight:600; color:${C.secondary};">${fmt(r.allocation * r.unitCost, lang)} DZD</td>
    </tr>
  `).join("");

  // ── Dummy row/col explanation alert (mirrors AnalysisTab) ─────────────────
  const hasDummySrc  = balanced.dummySourceIndex !== null;
  const hasDummyDest = balanced.dummyDestIndex   !== null;
  const dummyAlert   = (hasDummySrc || hasDummyDest) ? `
    <div style="margin-top:10px; padding:9px 12px; background:${C.orangeLight}; border-left:4px solid ${C.orange}; border-radius:4px; font-size:10px; color:${C.orange};">
      ${hasDummySrc
        ? `Source fictive (ligne ${(balanced.dummySourceIndex ?? 0) + 1}) : les quantités allouées représentent les capacités inutilisées de la destination correspondante.`
        : `Destination fictive (colonne ${(balanced.dummyDestIndex ?? 0) + 1}) : les quantités allouées représentent les surplus non distribués de la source correspondante.`}
    </div>
  ` : "";

  // ── Sensitivity table — with Alloc. column, epsilon filtered ─────────────
  const sensitivityRows = sensitivityRanges
    .filter(r => !epsilonSet.has(`${r.i},${r.j}`))
    .map((r, idx) => `
      <tr style="background:${idx % 2 === 0 ? C.white : C.primaryLight};">
        <td style="padding:5px 8px; border:1px solid ${C.border}; font-size:10px;">
          <span style="font-weight:600;">${r.sourceName}</span>
          <span style="color:${C.muted};"> → </span>
          <span>${r.destName}</span>
        </td>
        <td style="padding:5px 8px; text-align:center; border:1px solid ${C.border}; font-weight:700; color:${C.primary};">${fmt(r.allocation, lang)}</td>
        <td style="padding:5px 8px; text-align:center; border:1px solid ${C.border}; font-weight:700;">${fmt(r.unitCost, lang)}</td>
        <td style="padding:5px 8px; text-align:center; border:1px solid ${C.border}; font-size:10px;">[${fmt(r.lowerBound, lang, 1)},&nbsp;${r.upperBound === Infinity ? "∞" : fmt(r.upperBound, lang, 1)}]</td>
        <td style="padding:5px 8px; text-align:center; border:1px solid ${C.border}; color:${C.orange};">${r.allowedDecrease === Infinity ? "∞" : fmt(r.allowedDecrease, lang, 1)}</td>
        <td style="padding:5px 8px; text-align:center; border:1px solid ${C.border}; color:${C.secondary};">${r.allowedIncrease === Infinity ? "∞" : fmt(r.allowedIncrease, lang, 1)}</td>
      </tr>
    `).join("");

  const content = `
    <div style="font-size:18px; font-weight:800; color:${C.primary}; margin-bottom:4px;">${frAr("Analyse & Distribution", "التحليل والتوزيع")}</div>
    <div style="font-size:11px; color:${C.muted}; margin-bottom:12px;">${frAr("Résultats optimaux — plan de distribution et analyse de sensibilité", "النتائج المثلى — خطة التوزيع وتحليل الحساسية")}</div>

    ${kpiStrip}

    <div style="font-size:14px; font-weight:700; color:${C.primary}; margin-bottom:8px;">${frAr("Plan de Distribution Optimal", "خطة التوزيع المثلى")}</div>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead>
        <tr style="background:${C.primary}; color:${C.white};">
          <th style="padding:8px 10px; text-align:left; border:1px solid ${C.border};">${frSlashAr("Source", "مصدر")}</th>
          <th style="padding:8px 10px; text-align:left; border:1px solid ${C.border};">${frSlashAr("Destination", "وجهة")}</th>
          <th style="padding:8px 10px; text-align:center; border:1px solid ${C.border};">${frSlashAr("Quantité", "كمية")}</th>
          <th style="padding:8px 10px; text-align:center; border:1px solid ${C.border};">${frSlashAr("Coût unit.", "تكلفة الوحدة")}</th>
          <th style="padding:8px 10px; text-align:right; border:1px solid ${C.border};">${frSlashAr("Contribution", "المساهمة")}</th>
        </tr>
      </thead>
      <tbody>
        ${routeRows}
        <tr style="background:${C.greenLight}; font-weight:800;">
          <td colspan="4" style="padding:8px 10px; border:1px solid ${C.border}; color:${C.green};">${frSlashAr("TOTAL OPTIMAL", "المجموع الأمثل")}</td>
          <td style="padding:8px 10px; text-align:right; border:1px solid ${C.border}; font-size:14px; color:${C.green};">${fmt(result.finalCost, lang)} DZD</td>
        </tr>
      </tbody>
    </table>
    ${dummyAlert}

    <div style="margin-top:16px;">
      <div style="font-size:14px; font-weight:700; color:${C.primary}; margin-bottom:6px;">${frAr("Analyse de Sensibilité", "تحليل الحساسية")}</div>
      <div style="font-size:10px; color:${C.muted}; margin-bottom:8px;">
        ${frAr(
          "Plage de variation du coût unitaire pour laquelle la solution optimale actuelle reste valide.",
          "نطاق تغيير التكلفة الوحدوية الذي يبقى فيه الحل الأمثل الحالي صالحاً.",
        )}
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:11px;">
        <thead>
          <tr style="background:${C.secondary}; color:${C.white};">
            <th style="padding:6px 8px; text-align:left; border:1px solid ${C.border};">${frSlashAr("Route", "المسار")}</th>
            <th style="padding:6px 8px; text-align:center; border:1px solid ${C.border};">${frSlashAr("Alloc.", "التخصيص")}</th>
            <th style="padding:6px 8px; text-align:center; border:1px solid ${C.border};">${frSlashAr("Coût actuel", "التكلفة الحالية")}</th>
            <th style="padding:6px 8px; text-align:center; border:1px solid ${C.border};">${frSlashAr("Plage [min, max]", "النطاق [أدنى، أقصى]")}</th>
            <th style="padding:6px 8px; text-align:center; border:1px solid ${C.border};">Marge ↓</th>
            <th style="padding:6px 8px; text-align:center; border:1px solid ${C.border};">Marge ↑</th>
          </tr>
        </thead>
        <tbody>${sensitivityRows}</tbody>
      </table>
    </div>
  `;

  return pageShell(content, pageNum, totalPages, frAr("Distribution &amp; Sensibilité", "التوزيع والحساسية"));
}

// ── Analysis + Recommendations data builders ──────────────────────────────────
// Mirrors buildSCAnalysis / buildSCRecommendations from TransportDistribution.tsx
// (duplicated here so the PDF generator has no React dependency)

interface PDFRecommendation {
  icon:     string;
  titleFr:  string;
  titleAr:  string;
  descFr:   string;
  descAr:   string;
  priority: "high" | "medium" | "low";
}

function buildSCAnalysisPDF(modiResult: MODIResult, initialCost: number, lang: string): string[] {
  const { balanced, finalCost, sensitivityRanges } = modiResult;
  const epsilonSet = new Set(modiResult.epsilonCells.map(c => `${c.i},${c.j}`));
  const improvement = initialCost > 0 ? ((initialCost - finalCost) / initialCost) * 100 : 0;
  const t = (fr: string, ar: string) => lang === "ar" ? ar : fr;
  const lines: string[] = [];

  // 1. Overall savings
  if (improvement > 0.1) {
    lines.push(t(
      `L'optimisation MODI réduit les coûts logistiques de ${improvement.toFixed(1)}% par rapport à la solution heuristique initiale, soit une économie de ${fmt(initialCost - finalCost, lang)} DZD sur un coût total optimal de ${fmt(finalCost, lang)} DZD.`,
      `خفّض تحسين MODI التكاليف اللوجستية بنسبة ${improvement.toFixed(1)}% مقارنة بالحل الأولي، بتوفير ${fmt(initialCost - finalCost, lang)} دج من تكلفة إجمالية مثلى تبلغ ${fmt(finalCost, lang)} دج.`,
    ));
  } else {
    lines.push(t(
      `La méthode heuristique initiale a produit une solution déjà optimale — coût total : ${fmt(finalCost, lang)} DZD. Aucun réacheminement ne peut réduire davantage les coûts logistiques.`,
      `أنتجت الطريقة الأولية حلاً مثالياً بالفعل — التكلفة الإجمالية: ${fmt(finalCost, lang)} دج. لا يمكن لأي إعادة توجيه تقليل التكاليف اللوجستية أكثر.`,
    ));
  }

  // 2. Top cost-driver route
  const activeRoutes = sensitivityRanges
    .filter(r => r.allocation > 0 && !epsilonSet.has(`${r.i},${r.j}`))
    .sort((a, b) => (b.allocation * b.unitCost) - (a.allocation * a.unitCost));

  if (activeRoutes.length > 0 && finalCost > 0) {
    const top = activeRoutes[0];
    const topTotal = top.allocation * top.unitCost;
    const pct = Math.round((topTotal / finalCost) * 100);
    lines.push(t(
      `Le trajet ${top.sourceName} → ${top.destName} est le principal moteur de coût, concentrant ${pct}% des charges logistiques totales (${fmt(topTotal, lang)} DZD pour ${fmt(top.allocation, lang)} unités à ${top.unitCost} DZD/u).`,
      `يُعدّ المسار ${top.sourceName} → ${top.destName} المحرّك الرئيسي للتكاليف، إذ يستأثر بـ ${pct}% من إجمالي الأعباء اللوجستية (${fmt(topTotal, lang)} دج لـ ${fmt(top.allocation, lang)} وحدة بـ${top.unitCost} دج/وحدة).`,
    ));
    const mostExpensive = [...activeRoutes].sort((a, b) => b.unitCost - a.unitCost)[0];
    if (mostExpensive && mostExpensive !== top) {
      lines.push(t(
        `Le trajet ${mostExpensive.sourceName} → ${mostExpensive.destName} affiche le coût unitaire le plus élevé (${mostExpensive.unitCost} DZD/u) — une négociation tarifaire avec le transporteur pourrait réduire le coût global.`,
        `يسجّل المسار ${mostExpensive.sourceName} → ${mostExpensive.destName} أعلى تكلفة وحدوية (${mostExpensive.unitCost} دج/وحدة) — قد تؤدي مفاوضة الناقل إلى خفض التكلفة الإجمالية.`,
      ));
    }
  }

  // 3. Balance status
  if (balanced.dummySourceIndex !== null) {
    const dummySupply = balanced.sources[balanced.dummySourceIndex]?.supply ?? 0;
    lines.push(t(
      `Déséquilibre offre-demande détecté : la demande client dépasse la capacité disponible de ${fmt(dummySupply, lang)} unités. Une source fictive a été ajoutée automatiquement — ${fmt(dummySupply, lang)} unités restent non satisfaites.`,
      `تم اكتشاف عدم توازن بين العرض والطلب: يتجاوز طلب العملاء الطاقة المتاحة بـ ${fmt(dummySupply, lang)} وحدة. تمت إضافة مصدر وهمي تلقائياً — تبقى ${fmt(dummySupply, lang)} وحدة غير مُلبَّاة.`,
    ));
  } else if (balanced.dummyDestIndex !== null) {
    const dummyDemand = balanced.destinations[balanced.dummyDestIndex]?.demand ?? 0;
    lines.push(t(
      `Déséquilibre offre-demande détecté : la capacité des entrepôts dépasse la demande de ${fmt(dummyDemand, lang)} unités. Une destination fictive a été ajoutée — ${fmt(dummyDemand, lang)} unités restent en stock non distribué.`,
      `تم اكتشاف عدم توازن: تتجاوز طاقة المستودعات الطلب بـ ${fmt(dummyDemand, lang)} وحدة. تمت إضافة وجهة وهمية — تبقى ${fmt(dummyDemand, lang)} وحدة في مخزون غير موزَّع.`,
    ));
  } else {
    lines.push(t(
      "Le réseau de distribution est parfaitement équilibré : la capacité totale des entrepôts correspond exactement à la demande agrégée des clients. Zéro gaspillage de capacité.",
      "شبكة التوزيع متوازنة تماماً: تتطابق الطاقة الإجمالية للمستودعات مع الطلب المجمَّع للعملاء. صفر هدر في الطاقة.",
    ));
  }

  // 4. Route utilization
  const rawM = balanced.dummySourceIndex !== null ? balanced.sources.length - 1 : balanced.sources.length;
  const rawN = balanced.dummyDestIndex   !== null ? balanced.destinations.length - 1 : balanced.destinations.length;
  const totalPossible = rawM * rawN;
  const activeCount = activeRoutes.length;
  if (activeCount > 0 && totalPossible > 0) {
    const utilPct = Math.round((activeCount / totalPossible) * 100);
    lines.push(t(
      `${activeCount} trajet${activeCount > 1 ? "s actifs" : " actif"} sur ${totalPossible} possibles (${utilPct}% du réseau utilisé). Un réseau logistique concentré réduit les coûts de coordination et facilite le suivi des livraisons.`,
      `${activeCount} مسار${activeCount > 1 ? " نشط" : " نشط"} من أصل ${totalPossible} ممكناً (${utilPct}% من الشبكة مستخدمة). تُسهّل الشبكة اللوجستية المركّزة تقليل تكاليف التنسيق ومتابعة التسليمات.`,
    ));
  }

  return lines;
}

function buildSCRecsPDF(modiResult: MODIResult, initialCost: number, lang: string): PDFRecommendation[] {
  const { balanced, sensitivityRanges, hasAlternativeOptima, finalCost } = modiResult;
  const epsilonSet = new Set(modiResult.epsilonCells.map(c => `${c.i},${c.j}`));
  const improvement = initialCost > 0 ? ((initialCost - finalCost) / initialCost) * 100 : 0;
  const recs: PDFRecommendation[] = [];

  const activeRoutes = sensitivityRanges.filter(r => r.allocation > 0 && !epsilonSet.has(`${r.i},${r.j}`));

  // 1. Implement optimal plan
  if (improvement > 0.1) {
    recs.push({
      icon: "🚚", priority: "high",
      titleFr: "Déployer immédiatement le plan de distribution optimal",
      titleAr: "تطبيق خطة التوزيع المثلى فوراً",
      descFr: `Le plan MODI économise ${fmt(initialCost - finalCost, lang)} DZD (${improvement.toFixed(1)}%) par rapport à la méthode heuristique. Transmettez le plan révisé aux équipes transport et planifiez le réacheminement dès la prochaine campagne de livraison.`,
      descAr: `توفّر خطة MODI مبلغ ${fmt(initialCost - finalCost, lang)} دج (${improvement.toFixed(1)}%) مقارنة بالطريقة الأولية. وزّع الخطة المحدّثة على فِرَق النقل وخطّط لإعادة التوجيه منذ حملة التسليم القادمة.`,
    });
  }

  // 2. Renegotiate most expensive route
  const mostExpensive = [...activeRoutes].sort((a, b) => b.unitCost - a.unitCost)[0];
  if (mostExpensive && mostExpensive.unitCost > 0) {
    const allowedInc = mostExpensive.allowedIncrease === Infinity ? null : mostExpensive.allowedIncrease;
    recs.push({
      icon: "💰", priority: "high",
      titleFr: `Renégocier le contrat de transport ${mostExpensive.sourceName} → ${mostExpensive.destName}`,
      titleAr: `إعادة التفاوض على عقد النقل ${mostExpensive.sourceName} → ${mostExpensive.destName}`,
      descFr: `Ce trajet affiche le coût unitaire le plus élevé (${mostExpensive.unitCost} DZD/u).${allowedInc !== null ? ` La solution reste optimale jusqu'à ${fmt(mostExpensive.unitCost + allowedInc, lang, 1)} DZD/u.` : ""} Sollicitez plusieurs transporteurs concurrents ou envisagez un transport groupé pour réduire ce poste.`,
      descAr: `يسجّل هذا المسار أعلى تكلفة وحدوية (${mostExpensive.unitCost} دج/وحدة).${allowedInc !== null ? ` يبقى الحل مثالياً حتى ${fmt(mostExpensive.unitCost + allowedInc, lang, 1)} دج/وحدة.` : ""} استعرض عروض ناقلين متعددين أو فكّر في الشحن الجماعي لخفض هذا البند.`,
    });
  }

  // 3. Balance-specific
  if (balanced.dummySourceIndex !== null) {
    const dummySupply = balanced.sources[balanced.dummySourceIndex]?.supply ?? 0;
    recs.push({
      icon: "🏭", priority: "medium",
      titleFr: "Augmenter la capacité de stockage ou diversifier les fournisseurs",
      titleAr: "زيادة طاقة التخزين أو تنويع الموردين",
      descFr: `${fmt(dummySupply, lang)} unités de demande client ne peuvent être satisfaites. Évaluez l'ouverture d'un nouvel entrepôt, l'expansion d'une ligne de production ou la sous-traitance à un prestataire logistique tiers (3PL).`,
      descAr: `${fmt(dummySupply, lang)} وحدة من طلب العملاء لا يمكن تلبيتها. قيّم فتح مستودع جديد أو توسيع خط إنتاج أو التعاقد مع مزود لوجستي خارجي (3PL).`,
    });
  } else if (balanced.dummyDestIndex !== null) {
    const dummyDemand = balanced.destinations[balanced.dummyDestIndex]?.demand ?? 0;
    recs.push({
      icon: "📊", priority: "medium",
      titleFr: "Réduire la surproduction ou prospecter de nouveaux marchés",
      titleAr: "تقليص الإنتاج الزائد أو التنقيب عن أسواق جديدة",
      descFr: `${fmt(dummyDemand, lang)} unités resteront en stock non distribué. Adaptez les niveaux de production à la demande réelle ou développez de nouveaux segments clients pour absorber l'excédent et réduire les coûts de détention.`,
      descAr: `${fmt(dummyDemand, lang)} وحدة ستبقى في مخزون غير موزَّع. اضبط مستويات الإنتاج على الطلب الفعلي أو طوّر شرائح عملاء جديدة لامتصاص الفائض وتخفيض تكاليف الاحتفاظ.`,
    });
  }

  // 4. Consolidation (many active routes)
  if (activeRoutes.length > 4) {
    recs.push({
      icon: "📦", priority: "medium",
      titleFr: "Consolider les expéditions et créer des points de regroupement",
      titleAr: "توحيد الشحنات وإنشاء نقاط تجميع",
      descFr: `${activeRoutes.length} routes actives génèrent des coûts de coordination élevés (suivi, documentation, interfaces). Envisagez des plateformes de groupage ou des tournées mutualisées pour réduire la complexité opérationnelle.`,
      descAr: `${activeRoutes.length} مسارات نشطة تُولّد تكاليف تنسيق مرتفعة (متابعة، توثيق، واجهات). فكّر في منصات التجميع أو الجولات المشتركة لتخفيض التعقيد التشغيلي.`,
    });
  }

  // 5. Alternative optima → route flexibility
  if (hasAlternativeOptima) {
    recs.push({
      icon: "↔️", priority: "low",
      titleFr: "Exploiter la flexibilité des solutions équivalentes pour d'autres critères",
      titleAr: "استغلال مرونة الحلول المتكافئة لمعايير أخرى",
      descFr: `Des plans de distribution alternatifs existent au même coût optimal. Utilisez cette flexibilité pour choisir selon des critères secondaires : délais de livraison, fiabilité des transporteurs, réduction de l'empreinte carbone ou contraintes contractuelles existantes.`,
      descAr: `توجد خطط توزيع بديلة بنفس التكلفة المثلى. استغل هذه المرونة للاختيار وفق معايير ثانوية: مواعيد التسليم، موثوقية الناقلين، تقليص البصمة الكربونية، أو القيود التعاقدية القائمة.`,
    });
  }

  return recs;
}

// ── Page 5: Analysis + Recommendations ───────────────────────────────────────
function buildAnalysisRecsPage(
  modiResult: MODIResult,
  initialCost: number,
  pageNum: number,
  totalPages: number,
  lang: string,
): string {
  const t = (fr: string, ar: string) => lang === "ar" ? ar : fr;
  const analysisLines = buildSCAnalysisPDF(modiResult, initialCost, lang);
  const recs = buildSCRecsPDF(modiResult, initialCost, lang);

  // ── Analysis bullet rows ──────────────────────────────────────────────────
  const analysisHtml = analysisLines.map(line => `
    <div style="display:flex; align-items:flex-start; gap:10px; padding:11px 14px;
      background:${C.primaryLight}; border:1px solid rgba(0,77,64,0.15); border-radius:8px; margin-bottom:7px;">
      <span style="color:${C.primary}; font-size:13px; flex-shrink:0; margin-top:1px; font-weight:700;">✓</span>
      <p style="font-size:11px; line-height:1.65; margin:0; color:${C.text};">${line}</p>
    </div>
  `).join("");

  // ── Priority styling helpers ──────────────────────────────────────────────
  const borderColor = (p: string) =>
    p === "high" ? C.red : p === "medium" ? C.accent : C.blue;
  const bgColor = (p: string) =>
    p === "high" ? C.redLight : p === "medium" ? C.orangeLight : C.blueLight;
  const badgeBg = (p: string) =>
    p === "high" ? C.red : p === "medium" ? C.orange : C.blue;
  const priorityLabel = (p: string) => t(
    p === "high" ? "Priorité haute" : p === "medium" ? "Priorité moyenne" : "Priorité basse",
    p === "high" ? "أولوية عالية"  : p === "medium" ? "أولوية متوسطة"  : "أولوية منخفضة",
  );

  const recsHtml = recs.map((rec, i) => `
    <div style="border-radius:10px; padding:13px 16px; margin-bottom:9px;
      border-left:4px solid ${borderColor(rec.priority)}; background:${bgColor(rec.priority)};">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px; flex-wrap:wrap;">
        <span style="font-size:17px; line-height:1;">${rec.icon}</span>
        <strong style="font-size:11.5px; color:${C.text}; flex:1; min-width:0;">
          ${t(rec.titleFr, rec.titleAr)}
        </strong>
        <span style="font-size:8.5px; background:${badgeBg(rec.priority)}; color:${C.white};
          padding:2px 8px; border-radius:10px; font-weight:700; white-space:nowrap;">
          ${priorityLabel(rec.priority)}
        </span>
        <span style="font-size:9px; color:${C.muted}; flex-shrink:0;">#${i + 1}</span>
      </div>
      <p style="font-size:10.5px; line-height:1.6; color:${C.muted}; margin:0;">
        ${t(rec.descFr, rec.descAr)}
      </p>
    </div>
  `).join("");

  const content = `
    <div style="font-size:18px; font-weight:800; color:${C.primary}; margin-bottom:4px;">
      ${frAr("Analyse &amp; Recommandations", "التحليل والتوصيات")}
    </div>
    <div style="font-size:11px; color:${C.muted}; margin-bottom:18px;">
      ${frAr("Analyse logistique complète et recommandations managériales", "تحليل لوجستي شامل وتوصيات إدارية")}
    </div>

    <div style="font-size:13px; font-weight:700; color:${C.primary}; margin-bottom:10px;
      display:flex; align-items:center; gap:8px;">
      <span style="width:4px; height:18px; background:${C.accent}; border-radius:2px; display:inline-block;"></span>
      ${frAr("Analyse de la Situation Logistique", "تحليل الوضع اللوجستي")}
    </div>
    <div style="margin-bottom:20px;">
      ${analysisHtml}
    </div>

    ${recs.length > 0 ? `
    <div style="font-size:13px; font-weight:700; color:${C.primary}; margin-bottom:10px;
      display:flex; align-items:center; gap:8px;">
      <span style="width:4px; height:18px; background:${C.accent}; border-radius:2px; display:inline-block;"></span>
      ${frAr("Recommandations Managériales — Distribution", "التوصيات الإدارية للتوزيع")}
    </div>
    ${recsHtml}
    ` : ""}
  `;

  return pageShell(content, pageNum, totalPages,
    frAr("Analyse &amp; Recommandations", "التحليل والتوصيات"));
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
  const { problem, modiResult, initialCost, managerName, institutionName, language, onProgress } = opts;
  const lang = language;

  onProgress("Préparation du rapport…", 5);

  const reportId    = genReportId();
  const generatedAt = new Date().toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  const TOTAL_PAGES = 5;

  const pageHtmls: string[] = [
    buildCover(problem, modiResult, managerName, institutionName, reportId, generatedAt, TOTAL_PAGES, lang),
    buildSetupPage(problem, modiResult, 2, TOTAL_PAGES, lang),
    buildIterationsPage(modiResult, 3, TOTAL_PAGES, lang),
    buildDistributionPage(problem, modiResult, initialCost, 4, TOTAL_PAGES, lang),
    buildAnalysisRecsPage(modiResult, initialCost, 5, TOTAL_PAGES, lang),
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
