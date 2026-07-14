// ── Assignment Problem — PDF Report Generator ─────────────────────────────────
// Same branding / jsPDF + html2canvas pattern as generateTransportPDF.ts

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { AssignmentProblem } from "./AssignmentContext";
import type { HungarianResult } from "./hungarianAlgorithm";

// ── Brand tokens (identical to Transport/Simplex reports) ────────────────────
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
  return `AFF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
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

// ── Page shell ────────────────────────────────────────────────────────────────
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
  problem: AssignmentProblem,
  result: HungarianResult,
  managerName: string,
  institutionName: string,
  reportId: string,
  generatedAt: string,
  totalPages: number,
  lang: string
): string {
  const isMin  = problem.objectiveType === "minimize";
  const objFr  = isMin ? "Minimisation du Coût" : "Maximisation de la Performance";
  const objAr  = isMin ? "تقليل التكلفة" : "تعظيم الأداء";
  const valLabel = isMin ? "التكلفة المثلى / Coût Optimal" : "الأداء الأمثل / Performance Optimale";

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
          <div style="font-size:10px; color:rgba(255,255,255,0.65); margin-top:1px;">نظام دعم القرار الإداري — مسألة التوزيع (Affectation)</div>
        </div>
      </div>
      <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 40px; text-align:center; gap:16px;">
        <div style="font-size:11px; letter-spacing:3px; color:${C.accent}; text-transform:uppercase; font-weight:600;">تقرير رسمي · Rapport Officiel</div>
        <div style="font-size:28px; font-weight:800; line-height:1.3; direction:rtl;">تقرير مسألة التوزيع — الطريقة الهنغارية</div>
        <div style="font-size:17px; font-weight:400; color:rgba(255,255,255,0.8);">Rapport de la Méthode Hongroise (Affectation)</div>
        <div style="width:60px; height:3px; background:${C.accent}; border-radius:2px; margin:8px 0;"></div>
        <div style="font-size:13px; color:rgba(255,255,255,0.7);">${objAr} · ${objFr}</div>
        <div style="font-size:14px; font-weight:600; margin-top:8px;">${problem.name}</div>
      </div>
      <div style="padding:0 40px 32px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        ${[
          ["المدير / Responsable", managerName || "—"],
          ["المؤسسة / Institution", institutionName || "—"],
          ["القطاع / Secteur", sectorLabel(problem.sector)],
          [valLabel, fmt(result.totalCostReal, lang) + (isMin ? "" : "")],
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
function buildSetupPage(problem: AssignmentProblem, result: HungarianResult, pageNum: number, totalPages: number, lang: string): string {
  const { N, m, n, resourceNames, taskNames, originalCosts, forbidden } = result;

  const cellStyle = (i: number, j: number): string => {
    const isDummy = i >= m || j >= n;
    if (isDummy) return `background:${C.orangeLight}; color:${C.orange};`;
    if (forbidden[i][j]) return `background:${C.redLight}; color:${C.red};`;
    return `background:${C.white};`;
  };

  const matrix = `
    <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:8px;">
      <thead>
        <tr style="background:${C.primary}; color:${C.white};">
          <th style="padding:6px 8px; text-align:left; border:1px solid ${C.border};">Ressource / مورد</th>
          ${taskNames.map(tn => `<th style="padding:6px 8px; text-align:center; border:1px solid ${C.border};">${tn}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${resourceNames.map((rn, i) => `
          <tr>
            <td style="padding:6px 8px; font-weight:600; border:1px solid ${C.border}; background:${C.primaryLight};">${rn}</td>
            ${taskNames.map((_, j) => `
              <td style="padding:6px 8px; text-align:center; border:1px solid ${C.border}; ${cellStyle(i, j)}">
                ${i >= m || j >= n ? "0" : forbidden[i][j] ? "🚫" : fmt(originalCosts[i][j], lang)}
              </td>
            `).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  const forbiddenCount = forbidden.flat().filter(Boolean).length;

  const content = `
    <div style="font-size:18px; font-weight:800; color:${C.primary}; margin-bottom:4px;">Configuration du Problème · إعداد المسألة</div>
    <div style="font-size:11px; color:${C.muted}; margin-bottom:16px;">${m} ressource(s) × ${n} tâche(s)${N !== m || N !== n ? ` · Matrice équilibrée à ${N}×${N} (ligne/colonne fictive ajoutée)` : ""}</div>
    ${matrix}
    ${(N !== m || N !== n) ? `
      <div style="margin-top:12px; padding:10px 14px; background:${C.orangeLight}; border-left:4px solid ${C.orange}; border-radius:4px; font-size:11px; color:${C.orange};">
        <strong>Équilibrage automatique :</strong>
        ${N > m ? `${N - m} ressource(s) fictive(s) (coûts = 0) ont été ajoutée(s) pour équilibrer la matrice.` : ""}
        ${N > n ? `${N - n} tâche(s) fictive(s) (coûts = 0) ont été ajoutée(s) pour équilibrer la matrice.` : ""}
      </div>
    ` : ""}
    <div style="margin-top:16px;">
      <div style="font-size:14px; font-weight:700; color:${C.primary}; margin-bottom:8px;">Résumé · ملخص</div>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
        ${[
          ["Objectif", problem.objectiveType === "minimize" ? "Minimisation" : "Maximisation"],
          ["Cellules interdites", String(forbiddenCount)],
          ["Taille de la matrice résolue", `${N} × ${N}`],
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

// ── Hungarian Iterations page ─────────────────────────────────────────────────
function buildIterationsPage(result: HungarianResult, pageNum: number, totalPages: number, lang: string): string {
  const rows = [
    `<tr style="background:${C.white};">
      <td style="padding:6px 10px; border:1px solid ${C.border}; font-weight:600;">0a</td>
      <td style="padding:6px 10px; border:1px solid ${C.border};">Réduction des lignes (soustraction du minimum de chaque ligne)</td>
    </tr>`,
    `<tr style="background:${C.white};">
      <td style="padding:6px 10px; border:1px solid ${C.border}; font-weight:600;">0b</td>
      <td style="padding:6px 10px; border:1px solid ${C.border};">Réduction des colonnes (soustraction du minimum de chaque colonne)</td>
    </tr>`,
    ...result.iterations.map((it, idx) => `
      <tr style="background:${it.isOptimal ? C.greenLight : C.white};">
        <td style="padding:6px 10px; border:1px solid ${C.border}; font-weight:600;">${idx + 1}</td>
        <td style="padding:6px 10px; border:1px solid ${C.border};">
          ${it.isOptimal
            ? `<span style="color:${C.green}; font-weight:700;">✓ ${it.lineCount} lignes de couverture = N — Solution optimale atteinte</span>`
            : `${it.lineCount} ligne(s) de couverture < N — ajustement : min. non couvert = ${fmt(it.minUncovered ?? 0, lang)} (soustrait des cellules non couvertes, ajouté aux cellules doublement couvertes)`}
        </td>
      </tr>
    `),
  ].join("");

  const content = `
    <div style="font-size:18px; font-weight:800; color:${C.primary}; margin-bottom:4px;">Résolution — Méthode Hongroise · الحل — الطريقة الهنغارية</div>
    <div style="font-size:11px; color:${C.muted}; margin-bottom:16px;">
      ${result.iterations.length} étape(s) de couverture / ajustement effectuée(s) après la double réduction.
    </div>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead>
        <tr style="background:${C.primary}; color:${C.white};">
          <th style="padding:8px 10px; text-align:left; border:1px solid ${C.border}; width:60px;">Étape</th>
          <th style="padding:8px 10px; text-align:left; border:1px solid ${C.border};">Description</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${result.hasAlternativeOptima ? `
      <div style="margin-top:12px; padding:10px 14px; background:${C.blueLight}; border-left:4px solid ${C.blue}; border-radius:4px; font-size:11px; color:${C.blue};">
        <strong>Solutions optimales alternatives :</strong> Des cellules à zéro non utilisées dans l'affectation finale ont été détectées
        (${result.alternativeZeroCells.map(c => `(${c.i+1},${c.j+1})`).join(", ")}).
        D'autres affectations avec le même coût optimal existent.
      </div>
    ` : ""}
    <div style="margin-top:16px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
      <div style="background:${C.greenLight}; border:1px solid ${C.green}; border-radius:8px; padding:14px 16px; text-align:center;">
        <div style="font-size:10px; color:${C.muted}; margin-bottom:4px;">${lang === "ar" ? "القيمة المثلى" : "Valeur optimale"}</div>
        <div style="font-size:22px; font-weight:800; color:${C.green};">${fmt(result.totalCostReal, lang)}</div>
      </div>
      <div style="background:${C.white}; border:1px solid ${C.border}; border-radius:8px; padding:14px 16px; text-align:center;">
        <div style="font-size:10px; color:${C.muted}; margin-bottom:4px;">${lang === "ar" ? "حالة الحل" : "Statut de la solution"}</div>
        <div style="font-size:16px; font-weight:700; color:${result.isInfeasible ? C.red : C.green};">
          ${result.isInfeasible ? "⚠ Infaisable" : "✓ Optimal"}
        </div>
      </div>
    </div>
  `;

  return pageShell(content, pageNum, totalPages, "Méthode Hongroise · الطريقة الهنغارية");
}

// ── Final Assignment page ─────────────────────────────────────────────────────
function buildAssignmentPage(problem: AssignmentProblem, result: HungarianResult, pageNum: number, totalPages: number, lang: string): string {
  const { m, n, resourceNames, taskNames, originalCosts, finalAssignment, unassignedResources, unassignedTasks } = result;

  const rows = finalAssignment
    .filter(({ i, j }) => i < m && j < n)
    .map(({ i, j }) => `
      <tr style="background:${C.white};">
        <td style="padding:6px 10px; border:1px solid ${C.border}; font-weight:600;">${resourceNames[i]}</td>
        <td style="padding:6px 10px; border:1px solid ${C.border}; font-weight:600;">${taskNames[j]}</td>
        <td style="padding:6px 10px; text-align:center; border:1px solid ${C.border}; font-weight:700; color:${C.primary};">${fmt(originalCosts[i][j], lang)}</td>
      </tr>
    `).join("");

  const content = `
    <div style="font-size:18px; font-weight:800; color:${C.primary}; margin-bottom:4px;">Affectation Optimale · التوزيع الأمثل</div>
    <div style="font-size:11px; color:${C.muted}; margin-bottom:16px;">Résultat final de la méthode hongroise</div>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead>
        <tr style="background:${C.primary}; color:${C.white};">
          <th style="padding:8px 10px; text-align:left; border:1px solid ${C.border};">Ressource / مورد</th>
          <th style="padding:8px 10px; text-align:left; border:1px solid ${C.border};">Tâche / مهمة</th>
          <th style="padding:8px 10px; text-align:center; border:1px solid ${C.border};">${problem.objectiveType === "minimize" ? "Coût" : "Score"}</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="background:${C.greenLight}; font-weight:800;">
          <td colspan="2" style="padding:8px 10px; border:1px solid ${C.border}; color:${C.green};">TOTAL / المجموع</td>
          <td style="padding:8px 10px; text-align:center; border:1px solid ${C.border}; font-size:14px; color:${C.green};">${fmt(result.totalCostReal, lang)}</td>
        </tr>
      </tbody>
    </table>
    ${(unassignedResources.length > 0 || unassignedTasks.length > 0) ? `
      <div style="margin-top:16px; padding:12px 16px; background:${C.orangeLight}; border-left:4px solid ${C.orange}; border-radius:4px; font-size:11px; color:${C.orange};">
        <strong>Ressources / tâches non affectées :</strong><br/>
        ${unassignedResources.length > 0 ? `Ressource(s) sans tâche : ${unassignedResources.map(i => resourceNames[i]).join(", ")}.<br/>` : ""}
        ${unassignedTasks.length > 0 ? `Tâche(s) sans ressource : ${unassignedTasks.map(j => taskNames[j]).join(", ")}.` : ""}
        Cela résulte de l'ajout d'une ligne/colonne fictive pour équilibrer une matrice non carrée.
      </div>
    ` : ""}
  `;

  return pageShell(content, pageNum, totalPages, "Affectation Finale · التوزيع النهائي");
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface GenerateAssignmentPDFOptions {
  problem:         AssignmentProblem;
  result:          HungarianResult;
  managerName:     string;
  institutionName: string;
  language:        string;
  onProgress:      (step: string, pct: number) => void;
}

export async function generateAssignmentPDF(opts: GenerateAssignmentPDFOptions): Promise<void> {
  const { problem, result, managerName, institutionName, language, onProgress } = opts;
  const lang = language;

  onProgress("Préparation du rapport…", 5);

  const reportId    = genReportId();
  const generatedAt = new Date().toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  const TOTAL_PAGES = 4;

  const pageHtmls: string[] = [
    buildCover(problem, result, managerName, institutionName, reportId, generatedAt, TOTAL_PAGES, lang),
    buildSetupPage(problem, result, 2, TOTAL_PAGES, lang),
    buildIterationsPage(result, 3, TOTAL_PAGES, lang),
    buildAssignmentPage(problem, result, 4, TOTAL_PAGES, lang),
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
  const filename = `OptimDZ_Affectation_${problem.sector}_${Date.now()}.pdf`;
  pdf.save(filename);
  onProgress("Terminé !", 100);
}
