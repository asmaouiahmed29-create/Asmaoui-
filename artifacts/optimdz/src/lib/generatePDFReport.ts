import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { ProblemInput, SolveResult, SimplexStep } from "@workspace/api-client-react";

// ── brand tokens ──────────────────────────────────────────────────────────────
const C = {
  primary: "#004d40",
  primaryLight: "#e0f2f1",
  secondary: "#3a7d44",
  accent: "#f4a261",
  bg: "#fbf8f1",
  text: "#0c2621",
  muted: "#5f7b77",
  orange: "#e65100",
  orangeLight: "#fff3e0",
  green: "#2e7d32",
  greenLight: "#e8f5e9",
  border: "#c8dad6",
  white: "#ffffff",
};

const CHART_PALETTE = [
  "#004d40","#3a7d44","#0d6e6e","#1565c0",
  "#4527a0","#6a1b9a","#c62828","#e65100",
];

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number, lang: string, decimals = 0) {
  return n.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  });
}

function genReportId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `OPT-${ts}-${rand}`;
}

function sectorLabel(sectorId: string | null | undefined) {
  const map: Record<string, string> = {
    industry: "صناعة / Industrie",
    trade: "تجارة / Commerce",
    services: "خدمات / Services",
    agriculture: "فلاحة / Agriculture",
  };
  return sectorId ? (map[sectorId] ?? sectorId) : "—";
}

function rangeClass(value: number | null | undefined, base: number): "wide" | "narrow" | "critical" {
  if (value === null || value === undefined) return "wide";
  if (base === 0) return "narrow";
  const ratio = value / Math.abs(base);
  if (ratio >= 0.25) return "wide";
  if (ratio >= 0.08) return "narrow";
  return "critical";
}

function computeConstraintStatuses(input: ProblemInput, result: SolveResult) {
  return input.constraints.map((c, i) => {
    const lhsValue = c.coefficients.reduce((sum, coef, j) => {
      const vv = result.variables?.[j]?.value ?? 0;
      return sum + coef * vv;
    }, 0);
    const slack =
      c.operator === "<=" ? c.rhs - lhsValue :
      c.operator === ">=" ? lhsValue - c.rhs : 0;
    const sensRow = result.sensitivityAnalysis?.constraints?.[i];
    return {
      name: c.name,
      slack: Math.max(0, slack),
      rhs: c.rhs,
      shadowPrice: sensRow?.shadowPrice ?? null,
      isBinding: Math.abs(slack) < 1e-4,
      operator: c.operator,
    };
  });
}

function computeStability(result: SolveResult): "stable" | "moderate" | "sensitive" | null {
  const sa = result.sensitivityAnalysis;
  if (!sa) return null;
  let wideCount = 0, total = 0;
  (sa.objectiveCoefficients ?? []).forEach((v) => {
    const inBasis = v.allowableIncrease !== undefined || v.allowableDecrease !== undefined;
    if (!inBasis) return;
    total += 2;
    if (rangeClass(v.allowableIncrease, v.currentValue) === "wide") wideCount++;
    if (rangeClass(v.allowableDecrease, v.currentValue) === "wide") wideCount++;
  });
  (sa.constraints ?? []).forEach((c) => {
    total += 2;
    if (rangeClass(c.allowableIncrease, c.currentValue) === "wide") wideCount++;
    if (rangeClass(c.allowableDecrease, c.currentValue) === "wide") wideCount++;
  });
  if (total === 0) return "stable";
  const ratio = wideCount / total;
  if (ratio >= 0.65) return "stable";
  if (ratio >= 0.35) return "moderate";
  return "sensitive";
}

// ── Page wrapper ──────────────────────────────────────────────────────────────
function pageShell(content: string, pageNum: number, totalPages: number, title: string) {
  return `
    <div style="
      width:794px; min-height:1123px; background:${C.bg};
      font-family:'Cairo','Inter',sans-serif; color:${C.text};
      position:relative; box-sizing:border-box; page-break-after:always;
      display:flex; flex-direction:column;
    ">
      <!-- header bar -->
      <div style="background:${C.primary}; padding:10px 32px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:28px; height:28px; background:${C.white}; border-radius:6px; display:flex; align-items:center; justify-content:center;">
            <div style="width:16px; height:16px; background:${C.primary}; border-radius:3px;"></div>
          </div>
          <span style="color:${C.white}; font-weight:700; font-size:16px; letter-spacing:0.5px;">OptimDZ</span>
        </div>
        <span style="color:rgba(255,255,255,0.75); font-size:11px;">${title}</span>
        <span style="color:rgba(255,255,255,0.6); font-size:10px; direction:ltr; display:inline-block;">${pageNum} / ${totalPages}</span>
      </div>

      <!-- content -->
      <div style="flex:1; padding:28px 36px 20px; display:flex; flex-direction:column; gap:0;">
        ${content}
      </div>

      <!-- footer -->
      <div style="border-top:1px solid ${C.border}; padding:8px 36px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
        <span style="font-size:9px; color:${C.muted};">نظام OptimDZ لدعم القرار الإداري — Système OptimDZ d'Aide à la Décision</span>
        <span style="font-size:9px; color:${C.muted};">www.optimdz.replit.app</span>
      </div>
    </div>
  `;
}

// ── Page 1 — Cover ────────────────────────────────────────────────────────────
function buildCoverPage(
  input: ProblemInput, result: SolveResult,
  managerName: string, institutionName: string,
  reportId: string, generatedAt: string, totalPages: number
) {
  const sector = (input as unknown as Record<string, unknown>)?.templateId as string | undefined;
  return `
    <div style="
      width:794px; min-height:1123px; background:${C.primary};
      font-family:'Cairo','Inter',sans-serif; color:${C.white};
      position:relative; box-sizing:border-box;
      display:flex; flex-direction:column;
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
          <div style="font-size:10px; color:rgba(255,255,255,0.65); margin-top:1px;">نظام دعم القرار الإداري بالبرمجة الخطية</div>
        </div>
      </div>

      <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 40px; text-align:center; gap:16px;">
        <div style="font-size:11px; letter-spacing:3px; color:${C.accent}; text-transform:uppercase; font-weight:600; direction:rtl; unicode-bidi:bidi-override;">تقرير رسمي · Rapport Officiel</div>
        <div style="font-size:30px; font-weight:800; line-height:1.3; direction:rtl;">تقرير تحسين القرار الإداري</div>
        <div style="font-size:18px; font-weight:400; color:rgba(255,255,255,0.8);">Rapport d'Optimisation de Décision Managériale</div>
        <div style="width:60px; height:3px; background:${C.accent}; border-radius:2px; margin:8px 0;"></div>
        <div style="font-size:13px; color:rgba(255,255,255,0.7);">
          ${input.objectiveType === "maximize" ? "تعظيم الربح · Maximisation du Profit" : "تقليل التكاليف · Minimisation des Coûts"}
        </div>
        <div style="font-size:12px; color:rgba(255,255,255,0.55);">
          ${totalPages} صفحة · ${totalPages} pages
        </div>
      </div>

      <div style="padding:0 40px 32px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        ${[
          ["المدير / Responsable", (managerName || "").trim() || "—"],
          ["المؤسسة / Institution", (institutionName || "").trim() || "—"],
          ["القطاع / Secteur", sectorLabel(sector)],
          ["القيمة المثلى / Valeur Optimale", fmt(result.optimalValue ?? 0, "fr") + " DZD"],
          ["تاريخ الإصدار / Date", generatedAt],
          ["رقم التقرير / N° Rapport", reportId],
        ].map(([label, value]) => `
          <div style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:10px; padding:12px 16px;">
            <div style="font-size:9px; color:rgba(255,255,255,0.55); margin-bottom:4px;">${label}</div>
            <div style="font-size:13px; font-weight:700; word-break:break-all;">${value}</div>
          </div>
        `).join("")}
      </div>

      <div style="position:absolute; top:90px; right:40px; width:110px; height:110px;">
        <svg width="110" height="110" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r="52" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
          <circle cx="55" cy="55" r="44" fill="none" stroke="${C.accent}" stroke-width="1.5" stroke-dasharray="4 3"/>
          <circle cx="55" cy="55" r="36" fill="rgba(255,255,255,0.05)"/>
          <text x="55" y="48" text-anchor="middle" fill="${C.white}" font-size="8" font-family="Cairo,Inter,sans-serif" font-weight="700">OptimDZ</text>
          <text x="55" y="60" text-anchor="middle" fill="${C.accent}" font-size="7" font-family="Cairo,Inter,sans-serif">نظام المصادق</text>
          <text x="55" y="72" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="6" font-family="Cairo,Inter,sans-serif">${new Date().getFullYear()}</text>
        </svg>
      </div>

      <div style="height:6px; background:rgba(255,255,255,0.15);"></div>
    </div>
  `;
}

// ── Page 2 — Problem Summary ──────────────────────────────────────────────────
function buildProblemPage(input: ProblemInput, _result: SolveResult, pageNum: number, totalPages: number) {
  const isMax = input.objectiveType === "maximize";
  const varRows = input.variables.map((v) =>
    `<tr>
      <td style="padding:8px 12px; font-weight:600; border-bottom:1px solid ${C.border};">${v.name}</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; color:${C.muted};">${v.unit ?? "—"}</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-family:monospace;">${fmt(v.coefficient, "fr", 2)} DZD</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border};">${isMax ? "زيادة الربح / Profit+" : "تقليل التكلفة / Coût−"}</td>
    </tr>`
  ).join("");

  const constrRows = input.constraints.map((c) => {
    const expr = c.coefficients
      .map((cf, j) => `${fmt(cf, "fr", 1)}·${input.variables[j]?.name ?? `x${j + 1}`}`)
      .join(" + ");
    return `<tr>
      <td style="padding:8px 12px; font-weight:600; border-bottom:1px solid ${C.border};">${c.name}</td>
      <td style="padding:8px 12px; font-size:11px; border-bottom:1px solid ${C.border}; font-family:monospace; color:${C.muted};">${expr}</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; text-align:center;">${c.operator}</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-weight:600;">${fmt(c.rhs, "fr", 1)}</td>
    </tr>`;
  }).join("");

  const content = `
    <div style="margin-bottom:20px;">
      <h2 style="font-size:20px; font-weight:800; color:${C.primary}; margin:0 0 4px;">ملخص المسألة · Résumé du Problème</h2>
      <div style="width:40px; height:3px; background:${C.accent}; border-radius:2px;"></div>
    </div>

    <div style="background:${C.primaryLight}; border-right:4px solid ${C.primary}; border-radius:8px; padding:14px 16px; margin-bottom:20px; direction:rtl; text-align:right;">
      <div style="font-size:11px; color:${C.muted}; margin-bottom:4px;">نوع المسألة · Type du problème</div>
      <div style="font-size:15px; font-weight:700; color:${C.primary}; margin-bottom:6px;">
        ${isMax ? "🔺 تعظيم الربح الإجمالي / Maximisation du profit total" : "🔻 تقليل التكاليف الإجمالية / Minimisation des coûts totaux"}
      </div>
      <div style="font-size:12px; color:${C.muted}; direction:ltr; text-align:left; font-family:monospace;">
        ${isMax ? "Max" : "Min"} Z = ${input.variables.map((v) => `${fmt(v.coefficient, "fr", 1)}·${v.name}`).join(" + ")}
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <h3 style="font-size:13px; font-weight:700; color:${C.text}; margin:0 0 8px; display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:4px; height:16px; background:${C.secondary}; border-radius:2px;"></span>
        متغيرات القرار · Variables de Décision
      </h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:${C.primary}; color:${C.white};">
            <th style="padding:8px 12px; text-align:left; border-radius:6px 0 0 0;">المتغير / Variable</th>
            <th style="padding:8px 12px; text-align:left;">الوحدة / Unité</th>
            <th style="padding:8px 12px; text-align:left;">المعامل / Coefficient</th>
            <th style="padding:8px 12px; text-align:left; border-radius:0 6px 0 0;">الدور / Rôle</th>
          </tr>
        </thead>
        <tbody style="background:${C.white};">${varRows}</tbody>
      </table>
    </div>

    <div>
      <h3 style="font-size:13px; font-weight:700; color:${C.text}; margin:0 0 8px; display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:4px; height:16px; background:${C.accent}; border-radius:2px;"></span>
        قيود المسألة · Contraintes du Problème
      </h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:${C.text}; color:${C.white};">
            <th style="padding:8px 12px; text-align:left; border-radius:6px 0 0 0;">القيد / Contrainte</th>
            <th style="padding:8px 12px; text-align:left;">التعبير / Expression</th>
            <th style="padding:8px 12px; text-align:center;">الإشارة</th>
            <th style="padding:8px 12px; text-align:left; border-radius:0 6px 0 0;">الطرف الأيمن / RHS</th>
          </tr>
        </thead>
        <tbody style="background:${C.white};">${constrRows}</tbody>
      </table>
    </div>
  `;
  return pageShell(content, pageNum, totalPages, "ملخص المسألة · Résumé du Problème");
}

// ── Page 3 — Optimal Solution + Managerial Summary ───────────────────────────
function buildSolutionPage(input: ProblemInput, result: SolveResult, pageNum: number, totalPages: number) {
  const cs = computeConstraintStatuses(input, result);
  const totalContrib = result.variables?.reduce((s, rv) => {
    const iv = input.variables.find((v) => v.name === rv.name);
    return s + (iv?.coefficient ?? 0) * rv.value;
  }, 0) ?? 0;

  const kpiCards = [
    {
      label: "القيمة المثلى · Valeur Optimale",
      value: fmt(result.optimalValue ?? 0, "fr") + " DZD",
      bg: C.primary, color: C.white,
    },
    {
      label: "المتغيرات النشطة · Variables Actives",
      value: String((result.variables ?? []).filter((v) => v.value > 1e-4).length) + " / " + (result.variables?.length ?? 0),
      bg: C.secondary, color: C.white,
    },
    {
      label: "القيود الملزمة · Contraintes Actives",
      value: String(cs.filter((c) => c.isBinding).length) + " / " + cs.length,
      bg: C.orange, color: C.white,
    },
    {
      label: "نسبة الاستغلال · Taux d'Utilisation",
      value: cs.length > 0
        ? Math.round((cs.filter((c) => c.isBinding).length / cs.length) * 100) + "%"
        : "—",
      bg: C.text, color: C.white,
    },
  ];

  const varRows = (result.variables ?? []).map((rv) => {
    const iv = input.variables.find((v) => v.name === rv.name);
    const coef = iv?.coefficient ?? 0;
    const contribution = coef * rv.value;
    const pct = totalContrib > 0 ? (contribution / totalContrib) * 100 : 0;
    const isActive = rv.value > 1e-4;
    return `<tr style="background:${isActive ? C.greenLight : "#fafafa"}">
      <td style="padding:7px 12px; font-weight:600; border-bottom:1px solid ${C.border};">${rv.name}</td>
      <td style="padding:7px 12px; border-bottom:1px solid ${C.border}; font-family:monospace; font-weight:700; color:${isActive ? C.green : C.muted};">${fmt(rv.value, "fr", 2)}</td>
      <td style="padding:7px 12px; border-bottom:1px solid ${C.border}; color:${C.muted};">${rv.unit ?? "—"}</td>
      <td style="padding:7px 12px; border-bottom:1px solid ${C.border}; font-family:monospace;">${fmt(contribution, "fr", 0)} DZD</td>
      <td style="padding:7px 12px; border-bottom:1px solid ${C.border};">
        <div style="background:${C.border}; border-radius:4px; height:7px; width:100%; position:relative;">
          <div style="background:${isActive ? C.primary : C.muted}; border-radius:4px; height:7px; width:${Math.min(pct, 100).toFixed(1)}%;"></div>
        </div>
        <span style="font-size:9px; color:${C.muted};">${pct.toFixed(1)}%</span>
      </td>
    </tr>`;
  }).join("");

  const csRows = cs.map((c) => `
    <tr style="background:${c.isBinding ? C.orangeLight : C.greenLight}">
      <td style="padding:7px 12px; font-weight:600; border-bottom:1px solid ${C.border};">${c.name}</td>
      <td style="padding:7px 12px; border-bottom:1px solid ${C.border}; font-family:monospace;">${fmt(c.rhs - c.slack, "fr", 1)}</td>
      <td style="padding:7px 12px; border-bottom:1px solid ${C.border}; font-family:monospace;">${fmt(c.rhs, "fr", 1)}</td>
      <td style="padding:7px 12px; border-bottom:1px solid ${C.border};">
        <span style="padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700; background:${c.isBinding ? C.orange : C.green}; color:${C.white};">${c.isBinding ? "مستنفدة · SATURÉE" : "متاحة · DISPONIBLE"}</span>
      </td>
      <td style="padding:7px 12px; border-bottom:1px solid ${C.border}; font-family:monospace; color:${C.muted};">
        ${c.shadowPrice !== null ? fmt(c.shadowPrice, "fr", 2) : "—"}
      </td>
    </tr>
  `).join("");

  // Managerial summary block
  const summaryHtml = (result.managerialSummary || result.managerialSummaryAr) ? `
    <div style="background:${C.primaryLight}; border-right:4px solid ${C.primary}; border-radius:8px; padding:12px 16px; margin-bottom:16px;">
      <div style="font-size:10px; color:${C.muted}; font-weight:600; margin-bottom:6px; letter-spacing:0.3px;">ملخص إداري · Résumé Décisionnel</div>
      ${result.managerialSummary ? `<div style="font-size:12px; color:${C.text}; line-height:1.6; margin-bottom:${result.managerialSummaryAr ? "6px" : "0"};">${result.managerialSummary}</div>` : ""}
      ${result.managerialSummaryAr ? `<div style="font-size:11px; color:${C.muted}; direction:rtl; text-align:right; border-top:1px solid ${C.border}; padding-top:6px;">${result.managerialSummaryAr}</div>` : ""}
    </div>
  ` : "";

  const content = `
    <div style="margin-bottom:14px;">
      <h2 style="font-size:20px; font-weight:800; color:${C.primary}; margin:0 0 4px;">الحل الأمثل · Solution Optimale</h2>
      <div style="width:40px; height:3px; background:${C.accent}; border-radius:2px;"></div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px;">
      ${kpiCards.map((k) => `
        <div style="background:${k.bg}; border-radius:10px; padding:12px; color:${k.color};">
          <div style="font-size:9px; opacity:0.75; margin-bottom:4px; line-height:1.3;">${k.label}</div>
          <div style="font-size:15px; font-weight:800;">${k.value}</div>
        </div>
      `).join("")}
    </div>

    ${summaryHtml}

    <div style="margin-bottom:16px;">
      <h3 style="font-size:12px; font-weight:700; color:${C.text}; margin:0 0 7px; display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:4px; height:14px; background:${C.secondary}; border-radius:2px;"></span>
        قيم المتغيرات · Valeurs des Variables
      </h3>
      <table style="width:100%; border-collapse:collapse; font-size:11px;">
        <thead>
          <tr style="background:${C.primary}; color:${C.white};">
            <th style="padding:7px 12px; text-align:left;">المتغير</th>
            <th style="padding:7px 12px; text-align:left;">الكمية</th>
            <th style="padding:7px 12px; text-align:left;">الوحدة</th>
            <th style="padding:7px 12px; text-align:left;">المساهمة</th>
            <th style="padding:7px 12px; text-align:left;">النسبة</th>
          </tr>
        </thead>
        <tbody>${varRows}</tbody>
      </table>
    </div>

    <div>
      <h3 style="font-size:12px; font-weight:700; color:${C.text}; margin:0 0 7px; display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:4px; height:14px; background:${C.accent}; border-radius:2px;"></span>
        حالة الموارد · État des Ressources
      </h3>
      <table style="width:100%; border-collapse:collapse; font-size:11px;">
        <thead>
          <tr style="background:${C.text}; color:${C.white};">
            <th style="padding:7px 12px; text-align:left;">المورد · Ressource</th>
            <th style="padding:7px 12px; text-align:left;">المستخدم · Utilisé</th>
            <th style="padding:7px 12px; text-align:left;">الحد · Limite</th>
            <th style="padding:7px 12px; text-align:left;">الحالة · Statut</th>
            <th style="padding:7px 12px; text-align:left;">السعر الظل</th>
          </tr>
        </thead>
        <tbody>${csRows}</tbody>
      </table>
    </div>
  `;
  return pageShell(content, pageNum, totalPages, "الحل الأمثل · Solution Optimale");
}

// ── Page 4 — KPI Charts ───────────────────────────────────────────────────────
function buildKPIChartsPage(input: ProblemInput, result: SolveResult, pageNum: number, totalPages: number) {
  const vars = result.variables ?? [];

  // Allocation bars
  const maxAlloc = Math.max(...vars.map((v) => v.value), 1);
  const allocBars = vars.map((v) => ({
    name: v.name,
    value: v.value,
    unit: v.unit ?? "",
    pct: (v.value / maxAlloc) * 100,
    active: v.value > 1e-4,
  }));

  // Contribution bars
  const contribs = vars
    .map((v, i) => {
      const coef = input.variables[i]?.coefficient ?? 0;
      return { name: v.name, value: Math.abs(coef * v.value) };
    })
    .filter((d) => d.value > 1e-6)
    .sort((a, b) => b.value - a.value);
  const maxContrib = Math.max(...contribs.map((d) => d.value), 1);

  // Resource usage bars
  const resourceBars = input.constraints.map((c, i) => {
    const used = vars.reduce((sum, v, j) => sum + c.coefficients[j] * v.value, 0);
    const pct = c.rhs > 0 ? Math.min(Math.round((used / c.rhs) * 100), 100) : 0;
    const isBinding = result.sensitivityAnalysis?.constraints?.[i]?.isCritical ?? false;
    const slack = c.rhs - used;
    return { name: c.name, used, rhs: c.rhs, pct, isBinding, unit: c.unit ?? "", slack: Math.max(0, slack) };
  });

  const allocHtml = allocBars.map((b) => `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:7px;">
      <div style="width:90px; font-size:11px; color:${C.text}; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${b.name}</div>
      <div style="flex:1; background:${C.border}; border-radius:4px; height:18px; overflow:hidden;">
        <div style="background:${b.active ? C.secondary : C.border}; border-radius:4px; height:18px; width:${b.pct.toFixed(1)}%;"></div>
      </div>
      <div style="width:90px; font-size:11px; color:${C.muted}; font-family:monospace; text-align:right;">${fmt(b.value, "fr", 1)} ${b.unit}</div>
    </div>
  `).join("");

  const contribHtml = contribs.map((b, i) => `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:7px;">
      <div style="width:90px; font-size:11px; color:${C.text}; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${b.name}</div>
      <div style="flex:1; background:${C.border}; border-radius:4px; height:18px; overflow:hidden;">
        <div style="background:${CHART_PALETTE[i % CHART_PALETTE.length]}; border-radius:4px; height:18px; width:${((b.value / maxContrib) * 100).toFixed(1)}%;"></div>
      </div>
      <div style="width:90px; font-size:11px; color:${C.muted}; font-family:monospace; text-align:right;">${fmt(b.value, "fr", 0)} DZD</div>
    </div>
  `).join("");

  const resourceHtml = resourceBars.map((r) => `
    <div style="margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
        <span style="font-size:11px; font-weight:600; color:${C.text};">${r.name}${r.unit ? ` (${r.unit})` : ""}</span>
        <span style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:11px; font-weight:700; color:${r.isBinding ? C.orange : C.green};">${r.pct}%</span>
          <span style="padding:2px 7px; border-radius:10px; font-size:9px; font-weight:700; background:${r.isBinding ? C.orange : C.green}; color:${C.white};">${r.isBinding ? "مستنفدة · SATURÉE" : "متاحة · DISPONIBLE"}</span>
        </span>
      </div>
      <div style="background:${C.border}; border-radius:6px; height:14px; overflow:hidden;">
        <div style="background:${r.isBinding ? C.orange : C.secondary}; border-radius:6px; height:14px; width:${r.pct}%;"></div>
      </div>
      <div style="display:flex; justify-content:space-between; margin-top:3px;">
        <span style="font-size:9px; color:${C.muted};">Utilisé · مستخدم: <strong>${fmt(r.used, "fr", 1)}</strong></span>
        <span style="font-size:9px; color:${C.muted};">Surplus · فائض: <strong>${fmt(r.slack, "fr", 1)}</strong></span>
        <span style="font-size:9px; color:${C.muted};">Limite · الحد: <strong>${fmt(r.rhs, "fr", 1)}</strong></span>
      </div>
    </div>
  `).join("");

  const content = `
    <div style="margin-bottom:16px;">
      <h2 style="font-size:20px; font-weight:800; color:${C.primary}; margin:0 0 4px;">لوحة المؤشرات · Tableau de Bord</h2>
      <div style="width:40px; height:3px; background:${C.accent}; border-radius:2px;"></div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px;">
      <div>
        <h3 style="font-size:12px; font-weight:700; color:${C.text}; margin:0 0 10px; display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:4px; height:14px; background:${C.secondary}; border-radius:2px;"></span>
          الكميات المثلى · Quantités optimales
        </h3>
        ${allocHtml || `<div style="color:${C.muted}; font-size:11px;">لا توجد بيانات</div>`}
      </div>
      <div>
        <h3 style="font-size:12px; font-weight:700; color:${C.text}; margin:0 0 10px; display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:4px; height:14px; background:${CHART_PALETTE[0]}; border-radius:2px;"></span>
          المساهمة في الربح · Contribution au profit
        </h3>
        ${contribHtml || `<div style="color:${C.muted}; font-size:11px;">لا توجد بيانات</div>`}
        <div style="font-size:9px; color:${C.muted}; margin-top:4px;">القيمة = المعامل × الكمية · Valeur = coefficient × quantité</div>
      </div>
    </div>

    <div>
      <h3 style="font-size:12px; font-weight:700; color:${C.text}; margin:0 0 10px; display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:4px; height:14px; background:${C.primary}; border-radius:2px;"></span>
        استخدام الموارد · Utilisation des ressources
      </h3>
      ${resourceHtml || `<div style="color:${C.muted}; font-size:11px;">لا توجد قيود</div>`}
    </div>
  `;
  return pageShell(content, pageNum, totalPages, "لوحة المؤشرات · Dashboard");
}

// ── Page 5 — Managerial Recommendations (full) ────────────────────────────────
function buildRecommendationsPage(input: ProblemInput, result: SolveResult, pageNum: number, totalPages: number) {
  const isMax = input.objectiveType === "maximize";
  const cs = computeConstraintStatuses(input, result);
  const bindingConstraints = cs.filter((c) => c.isBinding);
  const topBottleneck = [...bindingConstraints]
    .sort((a, b) => Math.abs(b.shadowPrice ?? 0) - Math.abs(a.shadowPrice ?? 0))[0];

  // Variable production plan
  const totalContrib = (result.variables ?? []).reduce((s, rv) => {
    const iv = input.variables.find((v) => v.name === rv.name);
    return s + (iv?.coefficient ?? 0) * rv.value;
  }, 0);

  const varPlanRows = (result.variables ?? []).map((rv) => {
    const iv = input.variables.find((v) => v.name === rv.name);
    const coef = iv?.coefficient ?? 0;
    const contribution = coef * rv.value;
    const pct = totalContrib > 0 ? ((contribution / totalContrib) * 100).toFixed(1) : "0";
    const isActive = rv.value > 1e-4;
    return `<tr style="background:${isActive ? C.greenLight : "#fafafa"}">
      <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-weight:600; font-size:11px;">${rv.name}</td>
      <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-family:monospace; color:${isActive ? C.green : C.muted}; font-weight:700; font-size:11px;">
        ${fmt(rv.value, "fr", 1)} ${rv.unit ?? ""}
      </td>
      <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-family:monospace; font-size:11px;">${fmt(contribution, "fr", 0)} DZD</td>
      <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-size:10px; color:${C.muted};">
        <div style="background:${C.border}; border-radius:3px; height:6px; width:100%; margin-bottom:2px;">
          <div style="background:${isActive ? C.secondary : C.muted}; border-radius:3px; height:6px; width:${Math.min(parseFloat(pct), 100)}%;"></div>
        </div>
        ${pct}%
      </td>
    </tr>`;
  }).join("");

  // Constraint status
  const csRows = cs.map((c) => `
    <tr style="background:${c.isBinding ? C.orangeLight : C.greenLight}">
      <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-weight:600; font-size:11px;">${c.name}</td>
      <td style="padding:7px 10px; border-bottom:1px solid ${C.border};">
        <span style="padding:2px 7px; border-radius:10px; font-size:9px; font-weight:700; background:${c.isBinding ? C.orange : C.green}; color:${C.white};">
          ${c.isBinding ? "مستنفدة · SATURÉE" : "متاحة · DISPONIBLE"}
        </span>
      </td>
      <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-size:11px; color:${C.text};">
        ${c.isBinding
          ? `⚠️ استُنفد — كل وحدة إضافية تُدرّ${c.shadowPrice !== null ? ` ${fmt(Math.abs(c.shadowPrice ?? 0), "fr", 2)} DZD` : " قيمة إضافية"}`
          : `✅ Surplus: ${fmt(c.slack, "fr", 1)} unités disponibles`}
      </td>
    </tr>
  `).join("");

  // Prioritized actions
  const typeColors: Record<string, [string, string]> = {
    critical: [C.orangeLight, C.orange],
    opportunity: ["#e3f2fd", "#1565c0"],
    positive: [C.greenLight, C.green],
  };
  const typeLabels: Record<string, string> = {
    critical: "⚠️ PRIORITÉ CRITIQUE · أولوية قصوى",
    opportunity: "💡 OPPORTUNITÉ · فرصة",
    positive: "✅ ACTION POSITIVE · إجراء إيجابي",
  };

  // Build actions (same logic as before)
  const contributions = (result.variables ?? []).map((rv) => {
    const iv = input.variables.find((v) => v.name === rv.name);
    const coef = iv?.coefficient ?? 0;
    return { name: rv.name, value: rv.value, unit: rv.unit, coef, contribution: coef * rv.value };
  });
  const actions: { rank: number; impact: number; textFr: string; textAr: string; type: string }[] = [];
  for (const c of cs) {
    if (c.isBinding && c.shadowPrice !== null && Math.abs(c.shadowPrice) > 1e-4) {
      actions.push({ rank: 0, impact: Math.abs(c.shadowPrice), textFr: `Augmenter la capacité de "${c.name}" — chaque unité rapporte ${fmt(Math.abs(c.shadowPrice), "fr", 2)} DZD.`, textAr: `زيادة طاقة "${c.name}" — كل وحدة إضافية تُدرّ ${fmt(Math.abs(c.shadowPrice), "fr", 2)} دج.`, type: "critical" });
    }
  }
  for (const c of cs) {
    if (!c.isBinding && c.slack > 1e-4) {
      actions.push({ rank: 0, impact: c.slack * 0.05, textFr: `Réduire l'allocation de "${c.name}" de ${fmt(c.slack, "fr", 1)} unités inutilisées.`, textAr: `تقليل تخصيص "${c.name}" بمقدار ${fmt(c.slack, "fr", 1)} وحدة غير مستخدمة.`, type: "opportunity" });
    }
  }
  const sorted = [...contributions].sort((a, b) => b.contribution - a.contribution);
  for (let i = 0; i < Math.min(2, sorted.length); i++) {
    const v = sorted[i];
    if (v.value > 1e-4) {
      actions.push({ rank: 0, impact: v.contribution, textFr: `${isMax ? "Produire" : "Utiliser"} ${fmt(v.value, "fr", 1)} ${v.unit ?? "unités"} de "${v.name}" — ${i === 0 ? "première" : "deuxième"} source de ${isMax ? "profit" : "économies"}.`, textAr: `${isMax ? "أنتج" : "استخدم"} ${fmt(v.value, "fr", 1)} ${v.unit ?? "وحدة"} من "${v.name}" — ${i === 0 ? "المصدر الأول" : "المصدر الثاني"} للربح.`, type: "positive" });
    }
  }
  actions.sort((a, b) => b.impact - a.impact);
  actions.forEach((a, i) => { a.rank = i + 1; });

  const actionItems = actions.map((a) => {
    const [bg, color] = typeColors[a.type] ?? [C.primaryLight, C.primary];
    return `
      <div style="background:${bg}; border-right:4px solid ${color}; border-radius:8px; padding:10px 14px; margin-bottom:8px; display:flex; gap:10px; align-items:flex-start;">
        <div style="background:${color}; color:${C.white}; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px; flex-shrink:0;">${a.rank}</div>
        <div style="flex:1;">
          <div style="font-size:9px; font-weight:700; color:${color}; margin-bottom:3px;">${typeLabels[a.type] ?? ""}</div>
          <div style="font-size:12px; color:${C.text}; direction:rtl; text-align:right; margin-bottom:2px;">${a.textAr}</div>
          <div style="font-size:11px; color:${C.muted};">${a.textFr}</div>
          ${a.impact > 0.5 ? `<div style="margin-top:3px; font-size:11px; font-weight:700; color:${color};">+ ${fmt(a.impact, "fr", 0)} DZD</div>` : ""}
        </div>
      </div>
    `;
  }).join("");

  const content = `
    <div style="margin-bottom:14px;">
      <h2 style="font-size:20px; font-weight:800; color:${C.primary}; margin:0 0 4px;">التوصيات الإدارية · Recommandations Managériales</h2>
      <div style="width:40px; height:3px; background:${C.accent}; border-radius:2px;"></div>
    </div>

    <!-- Objective headline -->
    <div style="background:${C.primaryLight}; border:1px solid ${C.border}; border-radius:8px; padding:10px 14px; margin-bottom:14px; display:flex; align-items:center; gap:10px;">
      <div style="font-size:20px;">${isMax ? "📈" : "📉"}</div>
      <div>
        <div style="font-size:13px; font-weight:700; color:${C.primary};">
          ${isMax ? "Profit optimal" : "Coût minimal"}: ${fmt(result.optimalValue ?? 0, "fr")} DZD — ${isMax ? "الربح الأمثل" : "التكلفة الأدنى"}: ${fmt(result.optimalValue ?? 0, "fr")} دج
        </div>
        <div style="font-size:11px; color:${C.muted};">C'est le maximum réalisable avec les ressources actuelles · هذا أقصى ما يمكن تحقيقه بالموارد الحالية</div>
      </div>
    </div>

    <!-- Variable production plan -->
    ${varPlanRows ? `
    <div style="margin-bottom:14px;">
      <h3 style="font-size:12px; font-weight:700; color:${C.text}; margin:0 0 7px; display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:4px; height:13px; background:${C.secondary}; border-radius:2px;"></span>
        خطة الإنتاج / التوزيع · Plan de Production / Allocation
      </h3>
      <table style="width:100%; border-collapse:collapse; font-size:11px;">
        <thead>
          <tr style="background:${C.primary}; color:${C.white};">
            <th style="padding:6px 10px; text-align:left;">المتغير / Variable</th>
            <th style="padding:6px 10px; text-align:left;">الكمية / Quantité</th>
            <th style="padding:6px 10px; text-align:left;">المساهمة / Contribution</th>
            <th style="padding:6px 10px; text-align:left;">النسبة / Part</th>
          </tr>
        </thead>
        <tbody>${varPlanRows}</tbody>
      </table>
    </div>
    ` : ""}

    <!-- Constraint status -->
    ${csRows ? `
    <div style="margin-bottom:14px;">
      <h3 style="font-size:12px; font-weight:700; color:${C.text}; margin:0 0 7px; display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:4px; height:13px; background:${C.accent}; border-radius:2px;"></span>
        حالة الموارد · État des Ressources
        <span style="font-size:10px; font-weight:400; color:${C.muted};">(${cs.filter(c => c.isBinding).length} مستنفدة · ${cs.filter(c => !c.isBinding).length} متاحة)</span>
      </h3>
      <table style="width:100%; border-collapse:collapse; font-size:11px;">
        <thead>
          <tr style="background:${C.text}; color:${C.white};">
            <th style="padding:6px 10px; text-align:left;">المورد / Ressource</th>
            <th style="padding:6px 10px; text-align:left;">الحالة / Statut</th>
            <th style="padding:6px 10px; text-align:left;">التفسير / Interprétation</th>
          </tr>
        </thead>
        <tbody>${csRows}</tbody>
      </table>
    </div>
    ` : ""}

    <!-- Bottleneck banner -->
    ${topBottleneck ? `
      <div style="background:${C.primary}; color:${C.white}; border-radius:8px; padding:10px 16px; margin-bottom:10px; display:flex; gap:10px; align-items:center;">
        <div style="font-size:20px;">⚡</div>
        <div>
          <div style="font-size:9px; opacity:0.7; margin-bottom:1px;">نقطة الاختناق الرئيسية · Goulot d'Étranglement Principal</div>
          <div style="font-size:13px; font-weight:700;">${topBottleneck.name}</div>
          <div style="font-size:11px; opacity:0.8;">
            ${topBottleneck.shadowPrice !== null ? `كل وحدة إضافية = ${fmt(Math.abs(topBottleneck.shadowPrice), "fr", 2)} DZD ربح إضافي · Chaque unité suppl. = ${fmt(Math.abs(topBottleneck.shadowPrice), "fr", 2)} DZD` : "مورد محدود · Ressource limitante"}
          </div>
        </div>
      </div>
    ` : ""}

    <!-- Actions -->
    ${actionItems ? `
    <div>
      <h3 style="font-size:12px; font-weight:700; color:${C.text}; margin:0 0 8px; display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:4px; height:13px; background:${C.primary}; border-radius:2px;"></span>
        الأولويات التنفيذية · Actions Prioritaires
      </h3>
      ${actionItems}
    </div>
    ` : ""}
  `;
  return pageShell(content, pageNum, totalPages, "التوصيات الإدارية · Recommandations");
}

// ── Page 6 — Optim Assistant ──────────────────────────────────────────────────
function buildOptimAssistantPage(input: ProblemInput, result: SolveResult, pageNum: number, totalPages: number) {
  const vars = result.variables ?? [];
  const constraints = result.sensitivityAnalysis?.constraints ?? [];
  const objectiveType = input.objectiveType;
  const optVal = result.optimalValue ?? 0;

  // P1 — Why optimal
  const activeVars = vars.filter((v) => v.value > 1e-4);
  const zeroVars = vars.filter((v) => v.value <= 1e-4);
  const mixFr = activeVars.map((v) => `${fmt(v.value, "fr", 1)} ${v.unit ?? "unités"} de "${v.name}"`).join(" et ");
  const mixAr = activeVars.map((v) => `${fmt(v.value, "fr", 1)} ${v.unit ?? "وحدة"} من "${v.name}"`).join(" و");
  const zeroFr = zeroVars.length > 0 ? ` La production de "${zeroVars.map((v) => v.name).join(", ")}" est nulle car elle n'ajoute pas de valeur supplémentaire.` : "";
  const zeroAr = zeroVars.length > 0 ? ` إنتاج "${zeroVars.map((v) => v.name).join("، ")}" صفر لأنه لا يضيف قيمة إضافية.` : "";
  const p1Fr = `Ce mélange — ${mixFr || "aucune variable active"} — a été sélectionné car il exploite les ressources disponibles de la manière la plus efficace possible, atteignant le ${objectiveType === "maximize" ? "profit maximum" : "coût minimum"} de ${fmt(optVal, "fr")} DZD. L'algorithme Simplex a testé toutes les combinaisons possibles et confirmé qu'aucune autre allocation ne peut faire mieux.${zeroFr}`;
  const p1Ar = `تم اختيار هذا المزيج — ${mixAr || "لا يوجد متغير نشط"} — لأنه يستغل الموارد المتاحة بأكمل صورة ممكنة مع تحقيق ${objectiveType === "maximize" ? "أعلى ربح" : "أدنى تكلفة"}: ${fmt(optVal, "fr")} دج. اختبرت خوارزمية السمبلكس جميع التوليفات الممكنة وأكدت أن أي توزيع آخر لن يكون أفضل.${zeroAr}`;

  // P2 — Bottleneck
  const binding = constraints
    .filter((c) => c.isCritical && c.shadowPrice !== null && Math.abs(c.shadowPrice ?? 0) > 1e-4)
    .sort((a, b) => Math.abs(b.shadowPrice ?? 0) - Math.abs(a.shadowPrice ?? 0));
  let p2Fr: string, p2Ar: string;
  if (binding.length > 0) {
    const top = binding[0];
    const impact10 = Math.abs(top.shadowPrice ?? 0) * 10;
    p2Fr = `Le facteur limitant principal de votre ${objectiveType === "maximize" ? "profit" : "performance"} est "${top.name}". Cette ressource est entièrement saturée — ajouter 10 unités supplémentaires augmenterait votre ${objectiveType === "maximize" ? "profit" : "efficacité"} de ${fmt(impact10, "fr")} DZD (${fmt(Math.abs(top.shadowPrice ?? 0), "fr")} DZD par unité).${binding.length > 1 ? ` "${binding[1].name}" est aussi saturé avec un impact de ${fmt(Math.abs(binding[1].shadowPrice ?? 0), "fr")} DZD/unité.` : ""}`;
    p2Ar = `المورد الأكثر تأثيراً على ${objectiveType === "maximize" ? "ربحك" : "أدائك"} هو "${top.name}". هذا المورد استُنفد بالكامل — لو زدته بـ 10 وحدات، ${objectiveType === "maximize" ? "ربحك سيرتفع" : "تكلفتك ستنخفض"} بـ ${fmt(impact10, "fr")} دج (${fmt(Math.abs(top.shadowPrice ?? 0), "fr")} دج لكل وحدة إضافية).${binding.length > 1 ? ` "${binding[1].name}" أيضاً مستنفد بتأثير ${fmt(Math.abs(binding[1].shadowPrice ?? 0), "fr")} دج/وحدة.` : ""}`;
  } else {
    p2Fr = `Aucune ressource n'est entièrement saturée dans votre solution actuelle. Vous avez des marges de manœuvre sur l'ensemble de vos ressources — des ajustements mineurs des contraintes n'auraient pas d'impact significatif sur votre ${objectiveType === "maximize" ? "profit" : "coût"}.`;
    p2Ar = `لا يوجد مورد مستنفد بالكامل في حلك الحالي. لديك هامش في جميع مواردك، والتعديلات الطفيفة على القيود لن يكون لها تأثير كبير على ${objectiveType === "maximize" ? "ربحك" : "تكلفتك"}.`;
  }

  // P3 — Most profitable variable
  const inputVarMap: Record<string, number> = {};
  for (const iv of input.variables) inputVarMap[iv.name] = iv.coefficient;
  const ranked = vars
    .filter((v) => v.value > 1e-4)
    .map((v) => ({ ...v, coefficient: inputVarMap[v.name] ?? 0, contribution: (inputVarMap[v.name] ?? 0) * v.value }))
    .sort((a, b) => b.coefficient - a.coefficient);
  let p3Fr: string, p3Ar: string;
  if (ranked.length >= 2) {
    const top = ranked[0], second = ranked[1];
    const diff = top.coefficient - second.coefficient;
    p3Fr = `En comparant vos variables, "${top.name}" génère ${fmt(top.coefficient, "fr")} DZD par ${top.unit ?? "unité"} — soit ${fmt(diff, "fr")} DZD de plus que "${second.name}" (${fmt(second.coefficient, "fr")} DZD/${second.unit ?? "unité"}). Avec ${fmt(top.value, "fr", 1)} ${top.unit ?? "unités"} produites, "${top.name}" contribue ${fmt(top.contribution, "fr")} DZD au total.`;
    p3Ar = `بمقارنة متغيراتك، "${top.name}" يُدرّ ${fmt(top.coefficient, "fr")} دج/${top.unit ?? "وحدة"} — أي بفارق ${fmt(diff, "fr")} دج عن "${second.name}" (${fmt(second.coefficient, "fr")} دج/${second.unit ?? "وحدة"}). مع إنتاج ${fmt(top.value, "fr", 1)} ${top.unit ?? "وحدة"}، يساهم "${top.name}" بـ ${fmt(top.contribution, "fr")} دج من الإجمالي.`;
  } else if (ranked.length === 1) {
    const top = ranked[0];
    p3Fr = `"${top.name}" est votre seule variable active. Elle génère ${fmt(top.coefficient, "fr")} DZD par ${top.unit ?? "unité"} et constitue l'intégralité de votre ${objectiveType === "maximize" ? "profit" : "résultat"} optimal (${fmt(optVal, "fr")} DZD).`;
    p3Ar = `"${top.name}" هو المتغير الوحيد النشط. يُدرّ ${fmt(top.coefficient, "fr")} دج/${top.unit ?? "وحدة"} ويُشكّل كامل ${objectiveType === "maximize" ? "ربحك" : "نتيجتك"} المثلى (${fmt(optVal, "fr")} دج).`;
  } else {
    p3Fr = `Aucune variable active dans la solution.`;
    p3Ar = `لا يوجد متغير نشط في الحل.`;
  }

  // P4 — Next action
  let p4Fr: string, p4Ar: string;
  if (binding.length > 0) {
    const bn = binding[0];
    p4Fr = `Action prioritaire : augmentez la capacité de "${bn.name}" en premier. Chaque unité supplémentaire vous rapporte ${fmt(Math.abs(bn.shadowPrice ?? 0), "fr")} DZD — c'est l'investissement à plus fort retour dans votre modèle actuel.`;
    p4Ar = `الأولوية التنفيذية: ركّز على زيادة طاقة "${bn.name}" أولاً. كل وحدة إضافية تُدرّ ${fmt(Math.abs(bn.shadowPrice ?? 0), "fr")} دج — هذا هو الاستثمار الأعلى عائداً في نموذجك الحالي.`;
  } else if (ranked.length > 0) {
    const top = ranked[0];
    p4Fr = `Votre modèle est bien équilibré. Concentrez-vous sur le maintien de la production de "${top.name}" et explorez des opportunités d'expansion globale de vos ressources pour débloquer un potentiel de croissance supplémentaire.`;
    p4Ar = `نموذجك متوازن جيداً. ركّز على الحفاظ على ${objectiveType === "maximize" ? "إنتاج" : "استخدام"} "${top.name}" واستكشف فرص التوسع العام في مواردك لإطلاق إمكانات نمو إضافية.`;
  } else {
    p4Fr = `Révisez les paramètres de votre modèle pour identifier des pistes d'amélioration.`;
    p4Ar = `راجع معلمات نموذجك لتحديد فرص التحسين.`;
  }

  const paragraphs = [
    { labelFr: "Pourquoi cette solution est optimale", labelAr: "لماذا هذا الحل هو الأمثل", fr: p1Fr, ar: p1Ar },
    { labelFr: "Le goulot d'étranglement", labelAr: "نقطة الاختناق", fr: p2Fr, ar: p2Ar },
    { labelFr: "Le scénario le plus rentable", labelAr: "السيناريو الأكثر ربحية", fr: p3Fr, ar: p3Ar },
    { labelFr: "Action recommandée", labelAr: "الإجراء الموصى به", fr: p4Fr, ar: p4Ar },
  ];

  const bubblesHtml = paragraphs.map((p, i) => `
    <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:14px;">
      ${i === 0
        ? `<div style="width:32px; height:32px; background:${C.primary}; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:${C.white}; font-size:15px; margin-top:2px;">◆</div>`
        : `<div style="width:32px; flex-shrink:0;"></div>`}
      <div style="flex:1; background:${C.primaryLight}; border:1px solid ${C.border}; border-radius:12px; border-top-left-radius:3px; padding:11px 14px;">
        <div style="font-size:9px; font-weight:700; color:${C.primary}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px;">
          ${p.labelFr} · ${p.labelAr}
        </div>
        <div style="font-size:12px; color:${C.text}; line-height:1.6; margin-bottom:5px;">${p.fr}</div>
        <div style="font-size:11px; color:${C.muted}; line-height:1.5; border-top:1px solid ${C.border}; padding-top:5px; direction:rtl; text-align:right;">${p.ar}</div>
      </div>
    </div>
  `).join("");

  const content = `
    <div style="margin-bottom:16px;">
      <h2 style="font-size:20px; font-weight:800; color:${C.primary}; margin:0 0 4px;">تحليل OptimDZ · Analyse OptimDZ</h2>
      <div style="width:40px; height:3px; background:${C.accent}; border-radius:2px;"></div>
      <p style="font-size:11px; color:${C.muted}; margin:6px 0 0;">شرح الحل بلغة بسيطة — Explication en langage simple</p>
    </div>
    ${bubblesHtml}
  `;
  return pageShell(content, pageNum, totalPages, "تحليل OptimDZ · Analyse");
}

// ── Page 7 — Sensitivity Analysis (enhanced) ──────────────────────────────────
function buildSensitivityPage(input: ProblemInput, result: SolveResult, pageNum: number, totalPages: number) {
  const sens = result.sensitivityAnalysis;
  const isMax = input.objectiveType === "maximize";

  // Stability
  const stability = computeStability(result);
  const stabilityConfig: Record<string, { bg: string; color: string; icon: string; label: string }> = {
    stable: { bg: "#e8f5e9", color: C.green, icon: "🛡️", label: "الحل مستقر جداً · Solution très stable — هوامش واسعة، تصرف بثقة" },
    moderate: { bg: C.orangeLight, color: C.orange, icon: "⚠️", label: "الحل حساس لبعض المتغيرات · Solution modérément sensible — راقب التغييرات" },
    sensitive: { bg: "#ffebee", color: "#c62828", icon: "🚨", label: "الحل حساس · Solution sensible — أي تغيير في السوق قد يغير القرار الأمثل" },
  };
  const stab = stability ? stabilityConfig[stability] : null;

  function stabilityBadge(value: number | null | undefined, base: number) {
    const cls = (value === null || value === undefined) ? "wide" : rangeClass(value, base);
    const color = cls === "wide" ? C.green : cls === "narrow" ? C.orange : "#c62828";
    const label = cls === "wide" ? "مستقر · Stable" : cls === "narrow" ? "حساس · Sensible" : "حرج · Critique";
    return `<span style="padding:2px 7px; border-radius:10px; font-size:9px; font-weight:700; background:${color}; color:${C.white};">${label}</span>`;
  }

  const objRows = (sens?.objectiveCoefficients ?? []).map((sv, i) => {
    const v = input.variables[i];
    if (!v) return "";
    let explanation = "";
    if (sv.allowableDecrease !== null && sv.allowableDecrease !== undefined) {
      explanation = `Le ${isMax ? "profit" : "coût"} de "${v.name}" peut baisser jusqu'à ${fmt(sv.allowableDecrease, "fr")} DZD sans changer la décision.`;
    } else if (sv.allowableIncrease !== null && sv.allowableIncrease !== undefined) {
      explanation = `Au-delà de ${fmt(v.coefficient + sv.allowableIncrease, "fr")} DZD, le plan optimal change.`;
    } else {
      explanation = `Coefficient flexible — solution stable quel que soit le prix.`;
    }
    return `
      <tr>
        <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-weight:600; font-size:11px;">${v.name}</td>
        <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-family:monospace; font-size:11px; text-align:center;">${fmt(v.coefficient, "fr", 2)}</td>
        <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-family:monospace; font-size:11px; text-align:center; color:${C.green};">
          ${sv.allowableDecrease === null || sv.allowableDecrease === undefined ? "∞" : "−" + fmt(sv.allowableDecrease, "fr", 2)}
        </td>
        <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-family:monospace; font-size:11px; text-align:center; color:${C.orange};">
          ${sv.allowableIncrease === null || sv.allowableIncrease === undefined ? "∞" : "+" + fmt(sv.allowableIncrease, "fr", 2)}
        </td>
        <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; text-align:center;">
          ${stabilityBadge(Math.min(sv.allowableIncrease ?? Infinity, sv.allowableDecrease ?? Infinity), v.coefficient ?? 0)}
        </td>
        <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-size:10px; color:${C.muted}; max-width:160px;">${explanation}</td>
      </tr>
    `;
  }).join("");

  const rhsRows = (sens?.constraints ?? []).map((sc, i) => {
    const c = input.constraints[i];
    if (!c) return "";
    let explanation = "";
    if (sc.shadowPrice !== null && sc.shadowPrice !== undefined && Math.abs(sc.shadowPrice) > 1e-6) {
      explanation = `Chaque unité suppl. de "${c.name}" ${isMax ? "↑ profit" : "↓ coût"} de ${fmt(Math.abs(sc.shadowPrice), "fr", 2)} DZD.`;
      if (sc.allowableIncrease !== null && sc.allowableIncrease !== undefined) {
        explanation += ` Max +${fmt(sc.allowableIncrease, "fr")} unités.`;
      }
    } else {
      explanation = `Ressource non contraignante — surplus disponible.`;
    }
    return `
      <tr style="background:${sc.isCritical ? C.orangeLight : C.greenLight}">
        <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-weight:600; font-size:11px;">${c.name}</td>
        <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-family:monospace; font-size:11px; text-align:center;">${fmt(c.rhs, "fr", 1)}</td>
        <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-family:monospace; font-size:11px; text-align:center; color:${C.muted};">
          ${sc.shadowPrice != null ? fmt(sc.shadowPrice, "fr", 2) + " DZD" : "—"}
        </td>
        <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-family:monospace; font-size:11px; text-align:center; color:${C.green};">
          ${sc.allowableDecrease === null || sc.allowableDecrease === undefined ? "∞" : "−" + fmt(sc.allowableDecrease, "fr", 2)}
        </td>
        <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-family:monospace; font-size:11px; text-align:center; color:${C.orange};">
          ${sc.allowableIncrease === null || sc.allowableIncrease === undefined ? "∞" : "+" + fmt(sc.allowableIncrease, "fr", 2)}
        </td>
        <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; text-align:center;">
          ${stabilityBadge(Math.min(sc.allowableIncrease ?? Infinity, sc.allowableDecrease ?? Infinity), c.rhs)}
        </td>
        <td style="padding:7px 10px; border-bottom:1px solid ${C.border}; font-size:10px; color:${C.muted}; max-width:130px;">${explanation}</td>
      </tr>
    `;
  }).join("");

  const content = `
    <div style="margin-bottom:14px;">
      <h2 style="font-size:20px; font-weight:800; color:${C.primary}; margin:0 0 4px;">تحليل الحساسية · Analyse de Sensibilité</h2>
      <div style="width:40px; height:3px; background:${C.accent}; border-radius:2px;"></div>
    </div>

    ${stab ? `
    <div style="background:${stab.bg}; border:2px solid ${stab.color}; border-radius:10px; padding:12px 16px; margin-bottom:14px; display:flex; gap:10px; align-items:flex-start;">
      <div style="font-size:22px;">${stab.icon}</div>
      <div>
        <div style="font-size:12px; font-weight:700; color:${stab.color}; margin-bottom:3px;">${stab.label}</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
          <span style="padding:2px 8px; border-radius:8px; font-size:9px; font-weight:700; background:${C.green}; color:${C.white};">● هامش ≥ 25% · Marge ≥ 25% → مستقر · Stable</span>
          <span style="padding:2px 8px; border-radius:8px; font-size:9px; font-weight:700; background:${C.orange}; color:${C.white};">● هامش 8–25% · 8–25% → تحذير · Sensible</span>
          <span style="padding:2px 8px; border-radius:8px; font-size:9px; font-weight:700; background:#c62828; color:${C.white};">● هامش < 8% · < 8% → حرج · Critique</span>
        </div>
      </div>
    </div>
    ` : ""}

    <div style="background:${C.primaryLight}; border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:11px; color:${C.text}; direction:rtl; text-align:right;">
      <strong>ما هو تحليل الحساسية؟</strong><br/>
      يُظهر هذا التحليل مدى استقرار الحل الأمثل عند تغيير معاملات الربح أو حدود الموارد. النطاق الأخضر = آمن، البرتقالي = تحذير، الأحمر = يتغير الحل.
    </div>

    <div style="margin-bottom:16px;">
      <h3 style="font-size:12px; font-weight:700; color:${C.text}; margin:0 0 7px;">معاملات دالة الهدف · Coefficients Objectif</h3>
      <table style="width:100%; border-collapse:collapse; font-size:11px;">
        <thead>
          <tr style="background:${C.primary}; color:${C.white};">
            <th style="padding:6px 10px; text-align:left;">المتغير</th>
            <th style="padding:6px 10px; text-align:center;">الحالي</th>
            <th style="padding:6px 10px; text-align:center;">تناقص مسموح</th>
            <th style="padding:6px 10px; text-align:center;">تزايد مسموح</th>
            <th style="padding:6px 10px; text-align:center;">الاستقرار</th>
            <th style="padding:6px 10px; text-align:left;">تفسير · Explication</th>
          </tr>
        </thead>
        <tbody>${objRows || `<tr><td colspan="6" style="padding:10px; color:${C.muted}; text-align:center; font-size:11px;">لا توجد بيانات</td></tr>`}</tbody>
      </table>
    </div>

    <div>
      <h3 style="font-size:12px; font-weight:700; color:${C.text}; margin:0 0 7px;">حدود الموارد (RHS) · Plages RHS</h3>
      <table style="width:100%; border-collapse:collapse; font-size:11px;">
        <thead>
          <tr style="background:${C.text}; color:${C.white};">
            <th style="padding:6px 10px; text-align:left;">القيد</th>
            <th style="padding:6px 10px; text-align:center;">الحد الحالي</th>
            <th style="padding:6px 10px; text-align:center;">السعر الظل</th>
            <th style="padding:6px 10px; text-align:center;">تناقص مسموح</th>
            <th style="padding:6px 10px; text-align:center;">تزايد مسموح</th>
            <th style="padding:6px 10px; text-align:center;">الاستقرار</th>
            <th style="padding:6px 10px; text-align:left;">تفسير · Explication</th>
          </tr>
        </thead>
        <tbody>${rhsRows || `<tr><td colspan="7" style="padding:10px; color:${C.muted}; text-align:center; font-size:11px;">لا توجد بيانات</td></tr>`}</tbody>
      </table>
    </div>
  `;
  return pageShell(content, pageNum, totalPages, "تحليل الحساسية · Sensibilité");
}

// ── Page(s) — Simplex Steps ───────────────────────────────────────────────────
function buildSimplexStepsPage(
  steps: SimplexStep[], groupIdx: number, totalGroups: number,
  pageNum: number, totalPages: number
) {
  const titleSuffix = totalGroups > 1 ? ` (${groupIdx}/${totalGroups})` : "";

  const stepsHtml = steps.map((step) => {
    const colCount = step.tableau[0]?.row.length ?? 0;
    // Build column headers from known structure
    const colHeaders = Array.from({ length: colCount }, (_, ci) =>
      ci === colCount - 1 ? "b" : `c${ci + 1}`
    );

    const rowsHtml = step.tableau.map((row, rIdx) => {
      const isZRow = rIdx === step.tableau.length - 1;
      return `<tr style="background:${isZRow ? C.primaryLight : C.white}; ${isZRow ? "font-weight:700;" : ""}">
        <td style="padding:4px 8px; border:1px solid ${C.border}; font-weight:600; background:${C.primaryLight}; white-space:nowrap; font-size:10px;">${row.basisVariable}</td>
        ${row.row.map((val, cIdx) => {
          const isPivot = row.pivotColumn === cIdx && row.pivotRow === rIdx;
          return `<td style="padding:4px 8px; border:1px solid ${C.border}; text-align:right; font-family:monospace; font-size:10px; ${isPivot ? `background:${C.accent}; color:${C.white}; font-weight:700;` : ""}">
            ${Math.abs(val) < 1e-9 ? "0" : val.toFixed(3)}
          </td>`;
        }).join("")}
      </tr>`;
    }).join("");

    return `
      <div style="margin-bottom:16px; border:1px solid ${C.border}; border-radius:8px; overflow:hidden;">
        <div style="background:${C.primary}; padding:8px 14px; display:flex; align-items:center; gap:10px;">
          <div style="background:${C.white}; color:${C.primary}; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px; flex-shrink:0;">${step.iteration}</div>
          <div>
            <div style="font-size:11px; color:${C.white};">${step.explanation}</div>
            <div style="font-size:10px; color:rgba(255,255,255,0.7); direction:rtl;">${step.explanationAr}</div>
          </div>
        </div>
        <div style="padding:10px 12px; overflow-x:auto;">
          <table style="border-collapse:collapse; font-size:10px; min-width:100%;">
            <thead>
              <tr style="background:${C.primaryLight};">
                <th style="padding:4px 8px; border:1px solid ${C.border}; text-align:left; font-size:9px; color:${C.text};">Base</th>
                ${colHeaders.map((h) => `<th style="padding:4px 8px; border:1px solid ${C.border}; text-align:right; font-size:9px; color:${C.text};">${h}</th>`).join("")}
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          ${step.pivotElement ? `<div style="font-size:9px; color:${C.muted}; margin-top:4px;">Élément pivot · العنصر المحوري: <strong>${step.pivotElement}</strong></div>` : ""}
        </div>
      </div>
    `;
  }).join("");

  const content = `
    <div style="margin-bottom:16px;">
      <h2 style="font-size:20px; font-weight:800; color:${C.primary}; margin:0 0 4px;">تفاصيل التكرارات · Détail des Itérations${titleSuffix}</h2>
      <div style="width:40px; height:3px; background:${C.accent}; border-radius:2px;"></div>
      <p style="font-size:11px; color:${C.muted}; margin:6px 0 0;">
        <span style="background:${C.accent}; color:${C.white}; padding:1px 6px; border-radius:4px; font-size:9px; font-weight:700;">■</span>
        الخلية المحورية · Cellule pivot (mise en évidence en orange)
      </p>
    </div>
    ${stepsHtml}
  `;
  return pageShell(content, pageNum, totalPages, `التكرارات · Itérations${titleSuffix}`);
}

// ── Last Page — Digital Stamp ──────────────────────────────────────────────────
function buildStampPage(
  managerName: string, institutionName: string,
  reportId: string, generatedAt: string, totalPages: number
) {
  return `
    <div style="
      width:794px; min-height:1123px;
      font-family:'Cairo','Inter',sans-serif; color:${C.text};
      position:relative; box-sizing:border-box;
      display:flex; flex-direction:column;
      background: linear-gradient(160deg, ${C.primaryLight} 0%, ${C.white} 60%);
    ">
      <div style="height:6px; background:${C.primary};"></div>
      <div style="background:${C.primary}; padding:10px 40px; display:flex; align-items:center; justify-content:space-between;">
        <span style="color:${C.white}; font-weight:700; font-size:16px;">OptimDZ</span>
        <span style="color:rgba(255,255,255,0.65); font-size:10px;">ختم رقمي · Cachet Numérique</span>
        <span style="color:rgba(255,255,255,0.6); font-size:10px;">${totalPages} / ${totalPages}</span>
      </div>

      <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; gap:28px; text-align:center;">
        <div>
          <svg width="200" height="200" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="95" fill="none" stroke="${C.primary}" stroke-width="3"/>
            <circle cx="100" cy="100" r="85" fill="none" stroke="${C.primary}" stroke-width="1" stroke-dasharray="6 4"/>
            <circle cx="100" cy="100" r="72" fill="${C.primaryLight}"/>
            <circle cx="100" cy="100" r="60" fill="none" stroke="${C.primary}" stroke-width="1.5" stroke-dasharray="3 2"/>
            <rect x="80" y="80" width="40" height="40" rx="8" fill="${C.primary}"/>
            <rect x="88" y="88" width="24" height="24" rx="4" fill="${C.white}"/>
            <rect x="94" y="94" width="12" height="12" rx="2" fill="${C.primary}"/>
            <path id="topArc" d="M 20,100 A 80,80 0 0,1 180,100" fill="none"/>
            <text font-size="11" font-family="Cairo,Inter,sans-serif" font-weight="700" fill="${C.primary}">
              <textPath href="#topArc" startOffset="15%">نظام OptimDZ لدعم القرار الإداري</textPath>
            </text>
            <path id="botArc" d="M 20,100 A 80,80 0 0,0 180,100" fill="none"/>
            <text font-size="9" font-family="Cairo,Inter,sans-serif" fill="${C.muted}">
              <textPath href="#botArc" startOffset="10%">Système d'Aide à la Décision · Algérie</textPath>
            </text>
            <text x="100" y="148" text-anchor="middle" fill="${C.primary}" font-size="11" font-family="Cairo,Inter,sans-serif" font-weight="700">${new Date().getFullYear()}</text>
          </svg>
        </div>

        <div style="max-width:520px;">
          <div style="font-size:18px; font-weight:800; color:${C.primary}; margin-bottom:8px; direction:rtl;">
            هذا التقرير صادر عن نظام OptimDZ لدعم القرار الإداري
          </div>
          <div style="font-size:13px; color:${C.muted}; margin-bottom:6px;">
            Ce rapport a été généré automatiquement par le système OptimDZ d'aide à la décision managériale.
          </div>
          <div style="font-size:11px; color:${C.muted};">
            المعطيات الواردة في هذا التقرير تستند إلى بيانات أدخلها المستخدم وخوارزمية Simplex للبرمجة الخطية.
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; width:100%; max-width:520px;">
          ${[
            ["رقم التقرير · N° Rapport", reportId],
            ["تاريخ الإنشاء · Date de Génération", generatedAt],
            ["المدير · Responsable", (managerName || "").trim() || "—"],
            ["المؤسسة · Institution", (institutionName || "").trim() || "—"],
          ].map(([label, value]) => `
            <div style="background:${C.white}; border:1px solid ${C.border}; border-radius:8px; padding:10px 14px;">
              <div style="font-size:9px; color:${C.muted}; margin-bottom:2px;">${label}</div>
              <div style="font-size:12px; font-weight:700;">${value}</div>
            </div>
          `).join("")}
        </div>

        <div style="width:100%; max-width:520px; display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:16px;">
          ${["إمضاء المدير · Signature du Responsable", "ختم المؤسسة · Cachet de l'Institution"].map((label) => `
            <div style="text-align:center;">
              <div style="border-bottom:1.5px solid ${C.text}; height:50px; margin-bottom:6px;"></div>
              <div style="font-size:10px; color:${C.muted};">${label}</div>
            </div>
          `).join("")}
        </div>

        <div style="font-size:9px; color:${C.muted}; max-width:520px; line-height:1.5; direction:rtl; text-align:center;">
          يُنصح بمراجعة هذا التقرير من قِبَل متخصص قبل اتخاذ قرارات نهائية. النتائج مبنية على بيانات مدخلة وقد تختلف عن الواقع الفعلي.
        </div>
      </div>

      <div style="height:6px; background:${C.accent};"></div>
    </div>
  `;
}

// ── Main export function ──────────────────────────────────────────────────────
export interface PDFExportOptions {
  input: ProblemInput;
  result: SolveResult;
  managerName?: string;
  institutionName?: string;
  language?: string;
  onProgress?: (step: string, pct: number) => void;
}

export async function generatePDFReport(opts: PDFExportOptions): Promise<void> {
  const { input, result, managerName = "", institutionName = "", onProgress } = opts;

  const reportId = genReportId();
  const now = new Date();
  const generatedAt = now.toLocaleString("fr-DZ", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

  // Determine which optional pages exist
  const hasSens = !!(
    result.sensitivityAnalysis &&
    ((result.sensitivityAnalysis.objectiveCoefficients?.length ?? 0) > 0 ||
     (result.sensitivityAnalysis.constraints?.length ?? 0) > 0)
  );
  const steps = result.steps ?? [];
  const hasSteps = steps.length > 0;
  const STEPS_PER_PAGE = 3;
  const stepsPageCount = hasSteps ? Math.ceil(steps.length / STEPS_PER_PAGE) : 0;

  // Total pages: Cover(1) + Problem(2) + Solution(3) + Charts(4) + Recs(5) + Assistant(6)
  //             + Sensitivity(optional) + Steps(optional, variable) + Stamp(1)
  const TOTAL = 7 + (hasSens ? 1 : 0) + stepsPageCount;

  // Page numbers
  let nextPNum = 7;
  const sensPageNum = hasSens ? nextPNum++ : null;
  const stepsPageNums: number[] = [];
  for (let i = 0; i < stepsPageCount; i++) stepsPageNums.push(nextPNum++);
  const stampPageNum = nextPNum; // == TOTAL

  // Build all pages
  const pages: string[] = [
    buildCoverPage(input, result, managerName, institutionName, reportId, generatedAt, TOTAL),
    buildProblemPage(input, result, 2, TOTAL),
    buildSolutionPage(input, result, 3, TOTAL),
    buildKPIChartsPage(input, result, 4, TOTAL),
    buildRecommendationsPage(input, result, 5, TOTAL),
    buildOptimAssistantPage(input, result, 6, TOTAL),
  ];

  if (hasSens && sensPageNum !== null) {
    pages.push(buildSensitivityPage(input, result, sensPageNum, TOTAL));
  }

  for (let i = 0; i < stepsPageCount; i++) {
    const group = steps.slice(i * STEPS_PER_PAGE, (i + 1) * STEPS_PER_PAGE);
    pages.push(buildSimplexStepsPage(group, i + 1, stepsPageCount, stepsPageNums[i], TOTAL));
  }

  pages.push(buildStampPage(managerName, institutionName, reportId, generatedAt, stampPageNum));

  // A4 in mm
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;z-index:-1;";
  document.body.appendChild(container);

  try {
    await document.fonts.ready;

    for (let i = 0; i < pages.length; i++) {
      onProgress?.(`Rendering page ${i + 1}/${TOTAL}…`, Math.round((i / TOTAL) * 80));

      container.innerHTML = pages[i];
      const el = container.firstElementChild as HTMLElement;

      await new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: 794,
        windowWidth: 794,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);

      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH, undefined, "FAST");
    }

    onProgress?.("Saving PDF…", 90);
    const fileName = `OptimDZ_Rapport_${reportId}.pdf`;
    pdf.save(fileName);
    onProgress?.("Done", 100);
  } finally {
    document.body.removeChild(container);
  }
}
