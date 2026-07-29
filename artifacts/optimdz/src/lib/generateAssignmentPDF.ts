// ── Assignment Problem — PDF Report Generator ─────────────────────────────────
// Same branding / jsPDF + html2canvas pattern as generateTransportPDF.ts

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { AssignmentProblem } from "./AssignmentContext";
import type { HungarianResult } from "./hungarianAlgorithm";

// ── Brand tokens ──────────────────────────────────────────────────────────────
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
  amber:        "#b45309",
  amberLight:   "#fffbeb",
  border:       "#c8dad6",
  white:        "#ffffff",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Cover page ────────────────────────────────────────────────────────────────
function buildCover(
  problem: AssignmentProblem,
  result: HungarianResult,
  managerName: string,
  institutionName: string,
  reportId: string,
  generatedAt: string,
  _totalPages: number,
  lang: string,
): string {
  const isMin  = problem.objectiveType === "minimize";
  const objFr  = isMin ? "Minimisation du Coût" : "Maximisation de la Performance";
  const objAr  = isMin ? "تقليل التكلفة" : "تعظيم الأداء";
  const valLabel = isMin ? "التكلفة المثلى / Coût Optimal" : "الأداء الأمثل / Performance Optimale";

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
          ["المدير / Responsable",       managerName     || "—"],
          ["المؤسسة / Institution",      institutionName || "—"],
          ["القطاع / Secteur",           sectorLabel(problem.sector)],
          [valLabel,                     fmt(result.totalCostReal, lang)],
          ["تاريخ الإصدار / Date",       generatedAt],
          ["رقم التقرير / N° Rapport",   reportId],
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
function buildSetupPage(
  problem: AssignmentProblem,
  result: HungarianResult,
  pageNum: number,
  totalPages: number,
  lang: string,
): string {
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
          ["Objectif",                   problem.objectiveType === "minimize" ? "Minimisation" : "Maximisation"],
          ["Cellules interdites",        String(forbiddenCount)],
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
function buildIterationsPage(
  result: HungarianResult,
  pageNum: number,
  totalPages: number,
  lang: string,
): string {
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
            : `${it.lineCount} ligne(s) de couverture &lt; N — ajustement : min. non couvert = ${fmt(it.minUncovered ?? 0, lang)} (soustrait des cellules non couvertes, ajouté aux cellules doublement couvertes)`}
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

// ── Analysis page (KPI strip + alerts + assignment table) ─────────────────────
function buildAnalysisPage(
  problem: AssignmentProblem,
  result: HungarianResult,
  pageNum: number,
  totalPages: number,
  lang: string,
): string {
  const isMax = problem.objectiveType === "maximize";
  const {
    m, n, resourceNames, taskNames, originalCosts, finalAssignment,
    unassignedResources, unassignedTasks, hasAlternativeOptima, alternativeZeroCells,
    isInfeasible, iterations,
  } = result;

  const realPairs    = finalAssignment.filter(({ i, j }) => i < m && j < n);
  const coveringSteps = iterations.length;

  // ── KPI strip (mirrors AnalysisTab's 4 cards) ─────────────────────────────
  const kpiCards = [
    {
      labelFr: isMax ? "Performance optimale" : "Coût optimal",
      labelAr: isMax ? "الأداء الأمثل"        : "التكلفة المثلى",
      value:   fmt(result.totalCostReal, lang),
      bg: C.greenLight, border: C.green, color: C.green,
    },
    {
      labelFr: "Affectations réelles",
      labelAr: "التوزيعات الفعلية",
      value:   `${realPairs.length} / ${Math.max(m, n)}`,
      bg: C.white, border: C.border, color: C.text,
    },
    {
      labelFr: "Étapes de couverture",
      labelAr: "خطوات التغطية",
      value:   String(coveringSteps),
      bg: C.white, border: C.border, color: C.text,
    },
    {
      labelFr: isMax ? "Maximisation"  : "Minimisation",
      labelAr: isMax ? "تعظيم"         : "تقليل",
      value:   isMax ? "Maximisation"  : "Minimisation",
      bg: C.white, border: C.border, color: C.text,
    },
  ];

  const kpiStrip = `
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px;">
      ${kpiCards.map(k => `
        <div style="background:${k.bg}; border:1px solid ${k.border}; border-radius:8px; padding:10px 12px;">
          <div style="font-size:9px; color:${C.muted}; margin-bottom:3px;">${lang === "ar" ? k.labelAr : k.labelFr}</div>
          <div style="font-size:15px; font-weight:800; color:${k.color};">${k.value}</div>
        </div>
      `).join("")}
    </div>
  `;

  // ── Alerts (mirrors the three conditional alerts in AnalysisTab) ──────────
  let alerts = "";

  if (isInfeasible) {
    alerts += `
      <div style="margin-bottom:10px; padding:10px 14px; background:${C.redLight}; border-left:4px solid ${C.red}; border-radius:4px; font-size:11px; color:${C.red};">
        <strong>${lang === "ar" ? "تنبيه — تم اكتشاف توزيع محظور" : "Attention — affectation interdite détectée"}</strong><br/>
        <span style="font-size:10px;">
          ${lang === "ar"
            ? "اضطرت الخوارزمية لاستخدام خلية محظورة لإكمال التوزيع، لأن القيود جعلت المسألة غير قابلة للحل بطريقة أخرى. يرجى مراجعة الممنوعات."
            : "L'algorithme a dû utiliser une cellule marquée comme interdite pour compléter l'affectation, car les contraintes rendaient le problème infaisable autrement. Vérifiez vos interdictions."}
        </span>
      </div>
    `;
  }

  if (hasAlternativeOptima) {
    alerts += `
      <div style="margin-bottom:10px; padding:10px 14px; background:${C.blueLight}; border-left:4px solid ${C.blue}; border-radius:4px; font-size:11px; color:${C.blue};">
        <strong>${lang === "ar" ? "تم اكتشاف حلول مثلى بديلة" : "Solutions optimales alternatives détectées"}</strong><br/>
        <span style="font-size:10px;">
          ${lang === "ar"
            ? `توجد خلايا أخرى بتكلفة مختزلة صفرية (${alternativeZeroCells.map(c => `(${c.i+1},${c.j+1})`).join(", ")}) لم تُستخدم في هذا التوزيع. لذلك يوجد توزيع أمثل بديل بنفس القيمة الإجمالية تماماً.`
            : `D'autres cellules à coût réduit nul (${alternativeZeroCells.map(c => `(${c.i+1},${c.j+1})`).join(", ")}) n'ont pas été utilisées. Il existe au moins une autre affectation optimale avec exactement la même valeur totale.`}
        </span>
      </div>
    `;
  }

  if (unassignedResources.length > 0 || unassignedTasks.length > 0) {
    const unassignedResourceNames = unassignedResources.map(i => resourceNames[i]).join(", ");
    const unassignedTaskNames     = unassignedTasks.map(j => taskNames[j]).join(", ");
    alerts += `
      <div style="margin-bottom:10px; padding:10px 14px; background:${C.orangeLight}; border-left:4px solid ${C.orange}; border-radius:4px; font-size:11px; color:${C.orange};">
        <strong>${lang === "ar" ? "موارد/مهام وهمية — توزيع غير كامل" : "Ressources / tâches fictives — affectation incomplète"}</strong><br/>
        <span style="font-size:10px;">
          ${unassignedResources.length > 0
            ? (lang === "ar"
                ? `${unassignedResourceNames} لا يحصل على أي مهمة: سدّ مورد وهمي الفارق. `
                : `${unassignedResourceNames} ne reçoit aucune tâche : une ressource fictive a comblé l'écart. `)
            : ""}
          ${unassignedTasks.length > 0
            ? (lang === "ar"
                ? `${unassignedTaskNames} لا تُخصَّص لأي مورد: سدّت مهمة وهمية الفارق.`
                : `${unassignedTaskNames} n'est assignée à aucune ressource : une tâche fictive a comblé l'écart.`)
            : ""}
        </span>
      </div>
    `;
  }

  // ── Assignment table ──────────────────────────────────────────────────────
  const isMin = !isMax;
  const scoreLabel = isMin ? (lang === "ar" ? "التكلفة" : "Coût") : (lang === "ar" ? "النقاط" : "Score");

  const rows = realPairs.map(({ i, j }, idx) => `
    <tr style="background:${idx % 2 === 0 ? C.white : C.primaryLight};">
      <td style="padding:6px 10px; border:1px solid ${C.border}; font-weight:600;">${resourceNames[i]}</td>
      <td style="padding:6px 10px; border:1px solid ${C.border}; font-weight:600;">${taskNames[j]}</td>
      <td style="padding:6px 10px; text-align:right; border:1px solid ${C.border}; font-weight:700; color:${C.secondary};">${fmt(originalCosts[i][j], lang)}</td>
    </tr>
  `).join("");

  const content = `
    <div style="font-size:18px; font-weight:800; color:${C.primary}; margin-bottom:4px;">Affectation Optimale · التوزيع الأمثل</div>
    <div style="font-size:11px; color:${C.muted}; margin-bottom:12px;">Résultat final de la méthode hongroise · النتيجة النهائية للطريقة الهنغارية</div>

    ${kpiStrip}
    ${alerts}

    <div style="font-size:14px; font-weight:700; color:${C.primary}; margin-bottom:8px;">${lang === "ar" ? "جدول التوزيع الأمثل" : "Plan d'affectation optimal"}</div>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead>
        <tr style="background:${C.primary}; color:${C.white};">
          <th style="padding:8px 10px; text-align:left; border:1px solid ${C.border};">${lang === "ar" ? "المورد" : "Ressource"}</th>
          <th style="padding:8px 10px; text-align:left; border:1px solid ${C.border};">${lang === "ar" ? "المهمة" : "Tâche"}</th>
          <th style="padding:8px 10px; text-align:right; border:1px solid ${C.border};">${scoreLabel}</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="background:${C.greenLight}; font-weight:800;">
          <td colspan="2" style="padding:8px 10px; border:1px solid ${C.border}; color:${C.green};">
            ${lang === "ar" ? "المجموع الأمثل" : "TOTAL OPTIMAL"}
          </td>
          <td style="padding:8px 10px; text-align:right; border:1px solid ${C.border}; font-size:14px; color:${C.green};">
            ${fmt(result.totalCostReal, lang)}
          </td>
        </tr>
      </tbody>
    </table>
  `;

  return pageShell(content, pageNum, totalPages, lang === "ar" ? "التوزيع الأمثل" : "Affectation Optimale");
}

// ── Situation Analysis + Recommendations page ─────────────────────────────────
// Ports buildAnalysisLines + buildRecommendations from Assignment.tsx

interface AnalysisLine   { fr: string; ar: string; }
interface Recommendation { icon: string; priority: "high" | "medium" | "low"; titleFr: string; titleAr: string; descFr: string; descAr: string; }

function computeAnalysisLines(
  result: HungarianResult,
  isMax: boolean,
  unit: string,
  lang: string,
): AnalysisLine[] {
  const {
    m, n, N, resourceNames, taskNames, originalCosts, finalAssignment,
    unassignedResources, unassignedTasks, hasAlternativeOptima,
    isInfeasible, totalCostReal, iterations, forbidden,
  } = result;

  const lines: AnalysisLine[] = [];
  const realPairs    = finalAssignment.filter(({ i, j }) => i < m && j < n);
  const forbiddenCount = forbidden.flat().filter(Boolean).length;
  const isSquare     = m === n;
  const kIter        = iterations.length;
  const us           = unit ? ` ${unit}` : "";
  const valFmt       = fmt(totalCostReal, lang);

  // 1. Problem scope
  lines.push({
    fr: `La matrice d'affectation compte ${m} ressource${m > 1 ? "s" : ""} et ${n} tâche${n > 1 ? "s" : ""} — matrice ${isSquare ? "carrée" : "non carrée"} (${m}×${n}). L'objectif est la ${isMax ? "maximisation des performances" : "minimisation des coûts"}.`,
    ar: `تضم مصفوفة التوزيع ${m} ${m > 1 ? "موارد" : "مورد"} و${n} ${n > 1 ? "مهام" : "مهمة"} — مصفوفة ${isSquare ? "مربعة" : "غير مربعة"} (${m}×${n}). الهدف هو ${isMax ? "تعظيم الأداء" : "تقليل التكاليف"}.`,
  });

  // 2. Optimal value
  if (isMax) {
    lines.push({
      fr:  `L'algorithme a produit un score de performance optimal de ${valFmt}${us}. Chaque ressource est affectée à la tâche où son avantage comparatif est maximal — aucune permutation alternative ne peut dépasser ce total.`,
      ar:  `أنتجت الخوارزمية درجة أداء مثلى تبلغ ${valFmt}${us}. كل مورد مُخصَّص للمهمة التي يتميز فيها نسبياً أكثر — لا توجد أي مبادلة بديلة تتجاوز هذا المجموع.`,
    });
  } else {
    lines.push({
      fr:  `La valeur optimale obtenue est ${valFmt}${us}. Parmi toutes les permutations d'affectation admissibles, cette combinaison minimise le coût total — aucune autre affectation ne peut faire mieux tout en respectant les contraintes.`,
      ar:  `القيمة المثلى المُحققة هي ${valFmt}${us}. من بين جميع تباديل التوزيع المقبولة، هذه التركيبة تُقلّل إجمالي التكلفة إلى أدنى مستوى ممكن مع احترام القيود.`,
    });
  }

  // 3. Algorithm complexity
  if (kIter <= 1) {
    lines.push({
      fr: `La résolution n'a nécessité que ${kIter === 0 ? "aucune" : "une seule"} itération de couverture : la matrice était déjà quasi-optimale après les étapes de réduction initiale. Le problème présente une faible complexité combinatoire.`,
      ar: `لم تحتج الخوارزمية سوى ${kIter === 0 ? "أي" : "تكرار واحد"} من خطوات التغطية: كانت المصفوفة شبه مثلى بعد الاختزال مباشرةً — تعقيد تركيبي منخفض.`,
    });
  } else if (kIter <= 3) {
    lines.push({
      fr: `La résolution a nécessité ${kIter} itérations de couverture et d'ajustement — une complexité modérée, reflet d'une concurrence entre ressources pour les meilleures tâches.`,
      ar: `احتاجت الخوارزمية إلى ${kIter} تكرارات من التغطية والتعديل — تعقيد معتدل يعكس تنافساً بين الموارد على أفضل المهام.`,
    });
  } else {
    lines.push({
      fr: `La résolution a requis ${kIter} itérations de couverture : le problème présente une structure combinatoire dense avec de nombreuses ressources en compétition. Ce niveau de complexité est entièrement pris en charge par l'algorithme.`,
      ar: `احتاجت الخوارزمية إلى ${kIter} تكرارات من التغطية: المسألة ذات بنية تركيبية كثيفة مع تنافس شديد بين الموارد على أفضل المهام — هذا التعقيد مُعالَج بالكامل بواسطة الخوارزمية.`,
    });
  }

  // 4. Non-square balancing
  if (!isSquare) {
    const addedFr = m < n ? "ressource fictive" : "tâche fictive";
    const addedAr = m < n ? "مورد وهمي" : "مهمة وهمية";
    const unassigned = m < n ? unassignedResources : unassignedTasks;
    const unassignedNames = (m < n
      ? unassignedResources.map(i => resourceNames[i])
      : unassignedTasks.map(j => taskNames[j]));
    lines.push({
      fr: `La matrice étant non carrée (${m}×${n}), une ${addedFr} a été introduite pour équilibrer à ${N}×${N}. ${unassigned.length > 0 ? `En conséquence, ${unassignedNames.join(", ")} ${m < n ? "ne reçoit aucune tâche" : "n'est prise en charge par aucune ressource"} dans ce cycle.` : "Toutes les ressources et tâches ont néanmoins été honorées."}`,
      ar: `بما أن المصفوفة غير مربعة (${m}×${n})، أُضيف ${addedAr} لتوازن الحجم إلى ${N}×${N}. ${unassigned.length > 0 ? `نتيجةً لذلك، ${unassignedNames.join("، ")} ${m < n ? "لا تُخصَّص لأي مهمة" : "لا يتكفل بها أي مورد"} في هذه الدورة.` : "مع ذلك، جميع الموارد والمهام تمت تغطيتها."}`,
    });
  }

  // 5. Forbidden cells
  if (forbiddenCount > 0) {
    lines.push({
      fr: `${forbiddenCount} cellule${forbiddenCount > 1 ? "s interdites" : " interdite"} ont restreint l'espace des solutions admissibles. Ces contraintes métier ont été intégralement respectées dans l'affectation finale${isInfeasible ? " — sauf une, dont le non-respect était inévitable pour garantir une affectation complète" : ""}.`,
      ar: `${forbiddenCount} خلية${forbiddenCount > 1 ? " محظورة" : " محظورة"} قيّدت فضاء الحلول المقبولة. احتُرمت هذه القيود المهنية بالكامل في التوزيع النهائي${isInfeasible ? " — باستثناء قيد واحد كان تجاوزه حتمياً لضمان توزيع كامل" : ""}.`,
    });
  }

  // 6. Best and worst pairs
  if (realPairs.length >= 2) {
    const sorted = [...realPairs].sort((a, b) =>
      isMax
        ? originalCosts[b.i][b.j] - originalCosts[a.i][a.j]
        : originalCosts[a.i][a.j] - originalCosts[b.i][b.j],
    );
    const best  = sorted[0];
    const worst = sorted[sorted.length - 1];
    const bestVal  = fmt(originalCosts[best.i][best.j],  lang);
    const worstVal = fmt(originalCosts[worst.i][worst.j], lang);
    const gap      = Math.abs(originalCosts[best.i][best.j] - originalCosts[worst.i][worst.j]);
    lines.push(isMax ? {
      fr: `La paire la plus performante est ${resourceNames[best.i]} → ${taskNames[best.j]} (${bestVal}${us}). La moins performante est ${resourceNames[worst.i]} → ${taskNames[worst.j]} (${worstVal}${us}) — un écart de ${fmt(gap, lang)}${us} qui illustre la dispersion des compétences au sein du groupe.`,
      ar: `أفضل زوج من حيث الأداء هو ${resourceNames[best.i]} → ${taskNames[best.j]} (${bestVal}${us}). أضعف زوج هو ${resourceNames[worst.i]} → ${taskNames[worst.j]} (${worstVal}${us}) — بفجوة ${fmt(gap, lang)}${us} تعكس تباين الكفاءات داخل المجموعة.`,
    } : {
      fr: `La paire la moins coûteuse est ${resourceNames[best.i]} → ${taskNames[best.j]} (${bestVal}${us}). La plus coûteuse du plan est ${resourceNames[worst.i]} → ${taskNames[worst.j]} (${worstVal}${us}) — un écart de ${fmt(gap, lang)}${us} inhérent aux contraintes opérationnelles.`,
      ar: `أقل زوج تكلفةً هو ${resourceNames[best.i]} → ${taskNames[best.j]} (${bestVal}${us}). أكثر زوج تكلفةً في الحل هو ${resourceNames[worst.i]} → ${taskNames[worst.j]} (${worstVal}${us}) — بفجوة ${fmt(gap, lang)}${us} ناتجة عن القيود التشغيلية.`,
    });
  }

  // 7. Alternative optima
  if (hasAlternativeOptima) {
    lines.push({
      fr: `Des affectations alternatives existent à la même valeur optimale. L'algorithme a retenu un plan parmi plusieurs équivalents — cette multiplicité laisse une marge de manœuvre pour des critères qualitatifs (équité, charge, préférences d'équipe).`,
      ar: `توجد توزيعات بديلة بنفس القيمة المثلى تماماً. اختارت الخوارزمية خطة واحدة من بين عدة خطط متكافئة — هذا التعدد يُتيح هامشاً للتناوب وفق معايير نوعية (الإنصاف، التوازن، التفضيلات).`,
    });
  }

  return lines;
}

function computeRecommendations(
  result: HungarianResult,
  isMax: boolean,
  unit: string,
  lang: string,
): Recommendation[] {
  const {
    m, n, resourceNames, taskNames, originalCosts, finalAssignment,
    unassignedResources, unassignedTasks, hasAlternativeOptima,
    isInfeasible, forbidden,
  } = result;

  const recs: Recommendation[] = [];
  const realPairs      = finalAssignment.filter(({ i, j }) => i < m && j < n);
  const forbiddenCount = forbidden.flat().filter(Boolean).length;
  const isSquare       = m === n;
  const us             = unit ? ` ${unit}` : "";

  // 1. High — deploy plan
  recs.push({
    icon: "✅", priority: "high",
    titleFr: "Déployer immédiatement ce plan d'affectation",
    titleAr: "تطبيق خطة التوزيع هذه فوراً",
    descFr: `L'affectation est mathématiquement optimale — aucune autre combinaison ne fait mieux. Communiquez les ${realPairs.length} affectation${realPairs.length > 1 ? "s" : ""} retenue${realPairs.length > 1 ? "s" : ""} aux responsables concernés, formalisez-les dans un planning et archivez ce rapport comme référence du cycle en cours.`,
    descAr: `التوزيع مضمون رياضياً على أنه مثالي — لا توجد أي تركيبة أخرى تُحقق نتيجة أفضل. أبلغ المسؤولين المعنيين بالتوزيعات الـ ${realPairs.length} المختارة، أدرجها في جدول زمني رسمي، واحتفظ بهذا التقرير كمرجع للدورة الحالية.`,
  });

  // 2. High — infeasible
  if (isInfeasible) {
    recs.push({
      icon: "🚫", priority: "high",
      titleFr: "Revoir les contraintes d'interdiction — le problème est infaisable",
      titleAr: "مراجعة قيود الحظر — المسألة غير قابلة للحل بالقيود الحالية",
      descFr: `L'algorithme a dû enfreindre une interdiction pour produire une affectation complète. Revoyez vos cellules interdites : l'une d'elles est peut-être trop restrictive ou résulte d'une erreur de saisie. Assouplissez les contraintes ou adaptez les ressources disponibles pour rendre le problème faisable.`,
      descAr: `اضطرت الخوارزمية لتجاوز قيد محظور لإنتاج توزيع كامل. راجع الخلايا المحظورة: ربما إحداها مُقيِّدة أكثر من اللازم أو نتيجة خطأ في الإدخال. خفّف القيود أو اضبط الموارد المتاحة لجعل المسألة قابلة للحل.`,
    });
  }

  // 3. Medium — weakest pairing
  if (realPairs.length >= 2) {
    const sorted = [...realPairs].sort((a, b) =>
      isMax
        ? originalCosts[a.i][a.j] - originalCosts[b.i][b.j]
        : originalCosts[b.i][b.j] - originalCosts[a.i][a.j],
    );
    const weakest = sorted[0];
    const weakVal = fmt(originalCosts[weakest.i][weakest.j], lang);
    recs.push(isMax ? {
      icon: "📈", priority: "medium",
      titleFr: `Renforcer les compétences de ${resourceNames[weakest.i]} sur ${taskNames[weakest.j]}`,
      titleAr: `تعزيز كفاءة ${resourceNames[weakest.i]} على ${taskNames[weakest.j]}`,
      descFr: `La paire ${resourceNames[weakest.i]} → ${taskNames[weakest.j]} affiche le score le plus faible du plan (${weakVal}${us}). Un programme de formation ciblé ou un accompagnement par la ressource la plus performante permettrait d'élever le niveau global et d'améliorer la valeur optimale lors du prochain cycle.`,
      descAr: `الزوج ${resourceNames[weakest.i]} → ${taskNames[weakest.j]} يُسجّل أدنى نتيجة في الخطة (${weakVal}${us}). برنامج تدريب مستهدف أو إرشاد من المورد الأعلى أداءً سيرفع المستوى العام ويُحسّن القيمة المثلى في دورة التوزيع القادمة.`,
    } : {
      icon: "💰", priority: "medium",
      titleFr: `Réduire le coût du poste ${resourceNames[weakest.i]} → ${taskNames[weakest.j]}`,
      titleAr: `تخفيض تكلفة البند ${resourceNames[weakest.i]} → ${taskNames[weakest.j]}`,
      descFr: `Cette affectation représente le coût unitaire le plus élevé du plan (${weakVal}${us}). Analysez les causes (distance, durée, complexité) et évaluez si une formation, une réorganisation du poste ou un meilleur outillage peut réduire ce coût lors du prochain cycle.`,
      descAr: `يمثل هذا التوزيع أعلى تكلفة وحدوية في الخطة (${weakVal}${us}). حلّل الأسباب (المسافة، المدة، التعقيد) وقيّم إمكانية تخفيض هذا البند عبر التدريب أو إعادة تنظيم الوظيفة أو تحسين الأدوات في الدورة القادمة.`,
    });
  }

  // 4. Medium — alternative optima
  if (hasAlternativeOptima) {
    recs.push({
      icon: "↔️", priority: "medium",
      titleFr: "Exploiter les solutions équivalentes pour des critères secondaires",
      titleAr: "استغلال الحلول المتكافئة لمعايير ثانوية",
      descFr: `Plusieurs affectations donnent exactement la même valeur optimale. Profitez de cette équivalence pour retenir le plan qui satisfait le mieux des critères qualitatifs : équité de la charge de travail, ancienneté, proximité géographique, préférences des équipes ou équilibre social.`,
      descAr: `عدة توزيعات تُعطي نفس القيمة المثلى تماماً. استغل هذا التكافؤ لاختيار الخطة التي تُرضي أكثر المعايير النوعية: العدالة في توزيع العبء، الأقدمية، القُرب الجغرافي، تفضيلات الفِرَق، أو التوازن الاجتماعي.`,
    });
  }

  // 5a. Medium — unassigned resources
  if (!isSquare && unassignedResources.length > 0) {
    const names = unassignedResources.map(i => resourceNames[i]).join(", ");
    recs.push({
      icon: "🏗️", priority: "medium",
      titleFr: `Valoriser la capacité disponible de : ${names}`,
      titleAr: `توظيف الطاقة المتاحة لـ : ${names}`,
      descFr: `${names} ne reçoit aucune tâche dans ce cycle (matrice non carrée). Envisagez de lui confier des tâches transversales, une action de formation, un soutien à une autre équipe, ou planifiez une rotation pour éviter tout sous-emploi prolongé.`,
      descAr: `${names} غير مخصَّصة لأي مهمة في هذه الدورة (مصفوفة غير مربعة). فكّر في تكليفها بمهام عرضية، تدريب، دعم فريق آخر، أو تخطيط تناوب لتفادي البطالة المطوّلة.`,
    });
  }

  // 5b. Medium — unassigned tasks
  if (!isSquare && unassignedTasks.length > 0) {
    const names = unassignedTasks.map(j => taskNames[j]).join(", ");
    recs.push({
      icon: "📋", priority: "medium",
      titleFr: `Pourvoir la tâche non couverte : ${names}`,
      titleAr: `توفير مورد لتغطية المهمة غير المسندة : ${names}`,
      descFr: `La tâche ${names} n'a été assignée à aucune ressource dans ce cycle. Évaluez un recrutement temporaire, un recours à la sous-traitance, ou réorganisez la priorité des tâches pour couvrir ce besoin lors de la prochaine période.`,
      descAr: `المهمة ${names} لم تُسند لأي مورد في هذه الدورة. قيّم التوظيف المؤقت، الاستعانة بمقاول خارجي، أو أعد ترتيب أولويات المهام لتغطية هذه الحاجة في الفترة القادمة.`,
    });
  }

  // 6. Low — document forbidden cells
  if (forbiddenCount > 0 && !isInfeasible) {
    recs.push({
      icon: "📝", priority: "low",
      titleFr: "Documenter et réviser périodiquement les contraintes d'interdiction",
      titleAr: "توثيق قيود الحظر ومراجعتها دورياً",
      descFr: `${forbiddenCount} cellule${forbiddenCount > 1 ? "s" : ""} interdite${forbiddenCount > 1 ? "s" : ""} ont été appliquées. Chaque contrainte doit être documentée (raison, responsable, date de révision) et réévaluée à chaque cycle pour éviter qu'elle ne devienne obsolète ou trop restrictive.`,
      descAr: `${forbiddenCount} خلية محظورة طُبّقت في هذه المسألة. يجب توثيق كل قيد رسمياً (السبب، المسؤول، تاريخ المراجعة) وإعادة تقييمه في كل دورة توزيع لتفادي تقادمه أو تقييده المفرط.`,
    });
  }

  // 7. Low — periodic review
  recs.push({
    icon: "🔄", priority: "low",
    titleFr: "Planifier une révision périodique de l'affectation",
    titleAr: "جدولة مراجعة دورية لخطة التوزيع",
    descFr: `Toute affectation optimale l'est pour les données du moment. Planifiez une révision systématique à chaque changement significatif : nouvelles ressources, modification des coûts ou des performances, évolution des tâches disponibles. Archivez ce plan dans l'historique pour comparer les cycles futurs.`,
    descAr: `أي توزيع مثالي هو مثالي وفق بيانات اللحظة الراهنة. خطّط لمراجعة منتظمة عند كل تغيير جوهري: موارد جديدة، تعديل التكاليف أو الأداء، تطور المهام المتاحة. أرشف هذه الخطة في السجل للمقارنة مع الدورات القادمة.`,
  });

  return recs;
}

function buildAnalysisRecommendationsPage(
  problem: AssignmentProblem,
  result: HungarianResult,
  unit: string,
  pageNum: number,
  totalPages: number,
  lang: string,
): string {
  const isMax = problem.objectiveType === "maximize";
  const isAr  = lang === "ar";

  const analysisLines   = computeAnalysisLines(result, isMax, unit, lang);
  const recommendations = computeRecommendations(result, isMax, unit, lang);

  // ── Situation Analysis ────────────────────────────────────────────────────
  const analysisRows = analysisLines.map(line => `
    <div style="display:flex; gap:10px; align-items:flex-start; background:${C.primaryLight}; border:1px solid rgba(0,77,64,0.15); border-radius:6px; padding:10px 12px; margin-bottom:8px;">
      <span style="color:${C.primary}; font-size:13px; flex-shrink:0;">✓</span>
      <p style="margin:0; font-size:11px; line-height:1.6; color:${C.text};">${isAr ? line.ar : line.fr}</p>
    </div>
  `).join("");

  // ── Recommendations ───────────────────────────────────────────────────────
  const priorityStyle = (p: "high" | "medium" | "low") => {
    if (p === "high")   return { bg: C.redLight,   border: C.red,   label: isAr ? "أولوية عالية"    : "Priorité haute",   color: C.red };
    if (p === "medium") return { bg: C.amberLight, border: C.amber, label: isAr ? "أولوية متوسطة" : "Priorité moyenne", color: C.amber };
    return                     { bg: C.blueLight,  border: C.blue,  label: isAr ? "أولوية منخفضة" : "Priorité basse",   color: C.blue };
  };

  const recRows = recommendations.map(rec => {
    const ps = priorityStyle(rec.priority);
    return `
      <div style="background:${ps.bg}; border-left:4px solid ${ps.border}; border-radius:6px; padding:10px 14px; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
          <span style="font-size:14px;">${rec.icon}</span>
          <strong style="font-size:11px; color:${C.text};">${isAr ? rec.titleAr : rec.titleFr}</strong>
          <span style="margin-left:auto; background:${ps.border}; color:${C.white}; font-size:9px; padding:2px 6px; border-radius:10px; font-weight:700;">${ps.label}</span>
        </div>
        <p style="margin:0; font-size:10px; line-height:1.55; color:${C.muted};">${isAr ? rec.descAr : rec.descFr}</p>
      </div>
    `;
  }).join("");

  const content = `
    <div style="font-size:18px; font-weight:800; color:${C.primary}; margin-bottom:4px;">
      ${isAr ? "التحليل والتوصيات الإدارية" : "Analyse & Recommandations Managériales"}
    </div>
    <div style="font-size:11px; color:${C.muted}; margin-bottom:14px;">
      ${isAr ? "تحليل الوضع والتوصيات العملية المستنبطة من النتائج المثلى" : "Analyse de la situation et recommandations pratiques issues des résultats optimaux"}
    </div>

    <div style="font-size:13px; font-weight:700; color:${C.primary}; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
      <span>▸</span> ${isAr ? "تحليل الوضع" : "Analyse de la Situation"}
    </div>
    ${analysisRows}

    <div style="font-size:13px; font-weight:700; color:${C.primary}; margin-top:14px; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
      <span>▸</span> ${isAr ? "التوصيات الإدارية" : "Recommandations Managériales"}
    </div>
    ${recRows}
  `;

  return pageShell(content, pageNum, totalPages, isAr ? "التحليل والتوصيات" : "Analyse & Recommandations");
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface GenerateAssignmentPDFOptions {
  problem:         AssignmentProblem;
  result:          HungarianResult;
  unit?:           string;
  managerName:     string;
  institutionName: string;
  language:        string;
  onProgress:      (step: string, pct: number) => void;
}

export async function generateAssignmentPDF(opts: GenerateAssignmentPDFOptions): Promise<void> {
  const { problem, result, managerName, institutionName, language, onProgress } = opts;
  const unit = opts.unit ?? "";
  const lang = language;

  onProgress("Préparation du rapport…", 5);

  const reportId    = genReportId();
  const generatedAt = new Date().toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  const TOTAL_PAGES = 5;

  const pageHtmls: string[] = [
    buildCover(problem, result, managerName, institutionName, reportId, generatedAt, TOTAL_PAGES, lang),
    buildSetupPage(problem, result, 2, TOTAL_PAGES, lang),
    buildIterationsPage(result, 3, TOTAL_PAGES, lang),
    buildAnalysisPage(problem, result, 4, TOTAL_PAGES, lang),
    buildAnalysisRecommendationsPage(problem, result, unit, 5, TOTAL_PAGES, lang),
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
