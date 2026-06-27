import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { ProblemInput, SolveResult } from "@workspace/api-client-react";

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

function buildActions(input: ProblemInput, result: SolveResult, lang: string) {
  const contributions = (result.variables ?? []).map((rv) => {
    const iv = input.variables.find((v) => v.name === rv.name);
    const coef = iv?.coefficient ?? 0;
    return { name: rv.name, value: rv.value, unit: rv.unit, coef, contribution: coef * rv.value };
  });
  const cs = computeConstraintStatuses(input, result);
  const actions: { rank: number; impact: number; textFr: string; textAr: string; type: string }[] = [];

  for (const c of cs) {
    if (c.isBinding && c.shadowPrice !== null && Math.abs(c.shadowPrice) > 1e-4) {
      actions.push({
        rank: 0, impact: Math.abs(c.shadowPrice),
        textFr: `Augmenter la capacité de "${c.name}" — chaque unité supplémentaire rapporte ${fmt(Math.abs(c.shadowPrice), lang, 2)} DZD.`,
        textAr: `زيادة طاقة "${c.name}" — كل وحدة إضافية تُدرّ ${fmt(Math.abs(c.shadowPrice), lang, 2)} دج ربحاً.`,
        type: "critical",
      });
    }
  }
  for (const c of cs) {
    if (!c.isBinding && c.slack > 1e-4) {
      actions.push({
        rank: 0, impact: c.slack * 0.05,
        textFr: `Réduire l'allocation de "${c.name}" de ${fmt(c.slack, lang, 1)} unités inutilisées.`,
        textAr: `تقليل تخصيص "${c.name}" بمقدار ${fmt(c.slack, lang, 1)} وحدة غير مستخدمة.`,
        type: "opportunity",
      });
    }
  }
  const sorted = [...contributions].sort((a, b) => b.contribution - a.contribution);
  for (let i = 0; i < Math.min(2, sorted.length); i++) {
    const v = sorted[i];
    if (v.value > 1e-4) {
      actions.push({
        rank: 0, impact: v.contribution,
        textFr: `${input.objectiveType === "maximize" ? "Produire" : "Utiliser"} ${fmt(v.value, lang, 1)} ${v.unit ?? "unités"} de "${v.name}" — ${i === 0 ? "première" : "deuxième"} source de profit.`,
        textAr: `${input.objectiveType === "maximize" ? "أنتج" : "استخدم"} ${fmt(v.value, lang, 1)} ${v.unit ?? "وحدة"} من "${v.name}" — ${i === 0 ? "المصدر الأول" : "المصدر الثاني"} للربح.`,
        type: "positive",
      });
    }
  }
  actions.sort((a, b) => b.impact - a.impact);
  actions.forEach((a, i) => { a.rank = i + 1; });
  return actions;
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
        <span style="color:rgba(255,255,255,0.6); font-size:10px;">${pageNum} / ${totalPages}</span>
      </div>

      <!-- content -->
      <div style="flex:1; padding:32px 36px 24px; display:flex; flex-direction:column; gap:0;">
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
      <!-- decorative top band -->
      <div style="height:6px; background:${C.accent};"></div>

      <!-- logo row -->
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

      <!-- main title block -->
      <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 40px; text-align:center; gap:16px;">
        <div style="font-size:11px; letter-spacing:3px; color:${C.accent}; text-transform:uppercase; font-weight:600;">تقرير رسمي · Rapport Officiel</div>
        <div style="font-size:30px; font-weight:800; line-height:1.3; direction:rtl;">تقرير تحسين القرار الإداري</div>
        <div style="font-size:18px; font-weight:400; color:rgba(255,255,255,0.8);">Rapport d'Optimisation de Décision Managériale</div>
        <div style="width:60px; height:3px; background:${C.accent}; border-radius:2px; margin:8px 0;"></div>
        <div style="font-size:13px; color:rgba(255,255,255,0.7);">
          ${input.objectiveType === "maximize" ? "تعظيم الربح · Maximisation du Profit" : "تقليل التكاليف · Minimisation des Coûts"}
        </div>
      </div>

      <!-- info cards -->
      <div style="padding:0 40px 32px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        ${[
          ["المدير / Responsable", managerName || "—"],
          ["المؤسسة / Institution", institutionName || "—"],
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

      <!-- stamp circle -->
      <div style="position:absolute; bottom:60px; right:40px; width:110px; height:110px;">
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
function buildProblemPage(input: ProblemInput, _result: SolveResult, totalPages: number) {
  const isMax = input.objectiveType === "maximize";
  const varRows = input.variables.map((v) =>
    `<tr>
      <td style="padding:8px 12px; font-weight:600; border-bottom:1px solid ${C.border};">${v.name}</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; color:${C.muted};">${v.unit ?? "—"}</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-family:monospace;">${fmt(v.coefficient, "fr", 2)} DZD</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border};">${isMax ? "زيادة الربح / Profit+" : "تقليل التكلفة / Coût−"}</td>
    </tr>`
  ).join("");

  const constrRows = input.constraints.map((c, i) => {
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

    <!-- objective block -->
    <div style="background:${C.primaryLight}; border-right:4px solid ${C.primary}; border-radius:8px; padding:14px 16px; margin-bottom:20px; direction:rtl; text-align:right;">
      <div style="font-size:11px; color:${C.muted}; margin-bottom:4px;">نوع المسألة · Type du problème</div>
      <div style="font-size:15px; font-weight:700; color:${C.primary}; margin-bottom:6px;">
        ${isMax ? "🔺 تعظيم الربح الإجمالي / Maximisation du profit total" : "🔻 تقليل التكاليف الإجمالية / Minimisation des coûts totaux"}
      </div>
      <div style="font-size:12px; color:${C.muted}; direction:ltr; text-align:left; font-family:monospace;">
        ${isMax ? "Max" : "Min"} Z = ${input.variables.map((v) => `${fmt(v.coefficient, "fr", 1)}·${v.name}`).join(" + ")}
      </div>
    </div>

    <!-- variables table -->
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

    <!-- constraints table -->
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
  return pageShell(content, 2, totalPages, "ملخص المسألة · Résumé du Problème");
}

// ── Page 3 — Optimal Solution ─────────────────────────────────────────────────
function buildSolutionPage(input: ProblemInput, result: SolveResult, totalPages: number) {
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
      label: "عدد المتغيرات النشطة · Variables Actives",
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
      <td style="padding:8px 12px; font-weight:600; border-bottom:1px solid ${C.border};">${rv.name}</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-family:monospace; font-weight:700; color:${isActive ? C.green : C.muted};">${fmt(rv.value, "fr", 2)}</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; color:${C.muted};">${rv.unit ?? "—"}</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-family:monospace;">${fmt(contribution, "fr", 0)} DZD</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border};">
        <div style="background:${C.border}; border-radius:4px; height:8px; width:100%; position:relative;">
          <div style="background:${isActive ? C.primary : C.muted}; border-radius:4px; height:8px; width:${Math.min(pct, 100).toFixed(1)}%;"></div>
        </div>
        <span style="font-size:10px; color:${C.muted};">${pct.toFixed(1)}%</span>
      </td>
    </tr>`;
  }).join("");

  const csRows = cs.map((c) => `
    <tr style="background:${c.isBinding ? C.orangeLight : C.greenLight}">
      <td style="padding:8px 12px; font-weight:600; border-bottom:1px solid ${C.border};">${c.name}</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-family:monospace;">${fmt(c.rhs - c.slack, "fr", 1)}</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-family:monospace;">${fmt(c.rhs, "fr", 1)}</td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border};">
        <span style="
          padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700;
          background:${c.isBinding ? "#e65100" : C.green}; color:${C.white};
        ">${c.isBinding ? "مستنفدة · SATURÉE" : "متاحة · DISPONIBLE"}</span>
      </td>
      <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-family:monospace; color:${C.muted};">
        ${c.shadowPrice !== null ? fmt(c.shadowPrice, "fr", 2) : "—"}
      </td>
    </tr>
  `).join("");

  const content = `
    <div style="margin-bottom:16px;">
      <h2 style="font-size:20px; font-weight:800; color:${C.primary}; margin:0 0 4px;">الحل الأمثل · Solution Optimale</h2>
      <div style="width:40px; height:3px; background:${C.accent}; border-radius:2px;"></div>
    </div>

    <!-- KPI cards -->
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:20px;">
      ${kpiCards.map((k) => `
        <div style="background:${k.bg}; border-radius:10px; padding:12px; color:${k.color};">
          <div style="font-size:9px; opacity:0.75; margin-bottom:4px; line-height:1.3;">${k.label}</div>
          <div style="font-size:15px; font-weight:800;">${k.value}</div>
        </div>
      `).join("")}
    </div>

    <!-- Variables table -->
    <div style="margin-bottom:18px;">
      <h3 style="font-size:13px; font-weight:700; color:${C.text}; margin:0 0 8px; display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:4px; height:16px; background:${C.secondary}; border-radius:2px;"></span>
        قيم المتغيرات · Valeurs des Variables
      </h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:${C.primary}; color:${C.white};">
            <th style="padding:8px 12px; text-align:left;">المتغير</th>
            <th style="padding:8px 12px; text-align:left;">الكمية</th>
            <th style="padding:8px 12px; text-align:left;">الوحدة</th>
            <th style="padding:8px 12px; text-align:left;">المساهمة</th>
            <th style="padding:8px 12px; text-align:left;">النسبة</th>
          </tr>
        </thead>
        <tbody>${varRows}</tbody>
      </table>
    </div>

    <!-- Resources table -->
    <div>
      <h3 style="font-size:13px; font-weight:700; color:${C.text}; margin:0 0 8px; display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:4px; height:16px; background:${C.accent}; border-radius:2px;"></span>
        حالة الموارد · État des Ressources
      </h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:${C.text}; color:${C.white};">
            <th style="padding:8px 12px; text-align:left;">المورد · Ressource</th>
            <th style="padding:8px 12px; text-align:left;">المستخدم · Utilisé</th>
            <th style="padding:8px 12px; text-align:left;">الحد · Limite</th>
            <th style="padding:8px 12px; text-align:left;">الحالة · Statut</th>
            <th style="padding:8px 12px; text-align:left;">السعر الظل · Prix Ombre</th>
          </tr>
        </thead>
        <tbody>${csRows}</tbody>
      </table>
    </div>
  `;
  return pageShell(content, 3, totalPages, "الحل الأمثل · Solution Optimale");
}

// ── Page 4 — Recommendations ─────────────────────────────────────────────────
function buildRecommendationsPage(input: ProblemInput, result: SolveResult, totalPages: number) {
  const actions = buildActions(input, result, "fr");
  const cs = computeConstraintStatuses(input, result);
  const bindingConstraints = cs.filter((c) => c.isBinding);
  const topBottleneck = bindingConstraints
    .sort((a, b) => Math.abs(b.shadowPrice ?? 0) - Math.abs(a.shadowPrice ?? 0))[0];

  const typeColors: Record<string, [string, string]> = {
    critical: [C.orangeLight, C.orange],
    opportunity: ["#e3f2fd", "#1565c0"],
    positive: [C.greenLight, C.green],
  };
  const typeLabels: Record<string, string> = {
    critical: "⚠️ أولوية قصوى · PRIORITÉ CRITIQUE",
    opportunity: "💡 فرصة · OPPORTUNITÉ",
    positive: "✅ إجراء إيجابي · ACTION POSITIVE",
  };

  const actionItems = actions.map((a) => {
    const [bg, color] = typeColors[a.type] ?? [C.primaryLight, C.primary];
    return `
      <div style="background:${bg}; border-right:4px solid ${color}; border-radius:8px; padding:12px 16px; margin-bottom:10px; display:flex; gap:12px; align-items:flex-start;">
        <div style="background:${color}; color:${C.white}; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; flex-shrink:0;">${a.rank}</div>
        <div style="flex:1;">
          <div style="font-size:10px; font-weight:700; color:${color}; margin-bottom:4px;">${typeLabels[a.type] ?? ""}</div>
          <div style="font-size:13px; color:${C.text}; direction:rtl; text-align:right; margin-bottom:2px;">${a.textAr}</div>
          <div style="font-size:11px; color:${C.muted};">${a.textFr}</div>
          ${a.impact > 0.5 ? `<div style="margin-top:4px; font-size:11px; font-weight:700; color:${color};">+ ${fmt(a.impact, "fr", 0)} DZD</div>` : ""}
        </div>
      </div>
    `;
  }).join("");

  const content = `
    <div style="margin-bottom:16px;">
      <h2 style="font-size:20px; font-weight:800; color:${C.primary}; margin:0 0 4px;">التوصيات الإدارية · Recommandations Managériales</h2>
      <div style="width:40px; height:3px; background:${C.accent}; border-radius:2px;"></div>
    </div>

    ${topBottleneck ? `
      <div style="background:${C.primary}; color:${C.white}; border-radius:10px; padding:14px 18px; margin-bottom:18px; display:flex; gap:12px; align-items:center;">
        <div style="font-size:24px;">⚡</div>
        <div>
          <div style="font-size:10px; opacity:0.7; margin-bottom:2px;">نقطة الاختناق الرئيسية · Goulot d'Étranglement Principal</div>
          <div style="font-size:15px; font-weight:700;">${topBottleneck.name}</div>
          <div style="font-size:11px; opacity:0.8;">
            ${topBottleneck.shadowPrice !== null ? `كل وحدة إضافية = ${fmt(Math.abs(topBottleneck.shadowPrice), "fr", 2)} DZD ربح إضافي` : "مورد محدود"}
          </div>
        </div>
      </div>
    ` : ""}

    <div>${actionItems || `<div style="color:${C.muted}; text-align:center; padding:20px;">لا توجد توصيات إضافية</div>`}</div>

    <div style="margin-top:16px; background:${C.primaryLight}; border-radius:8px; padding:12px 16px;">
      <div style="font-size:11px; font-weight:700; color:${C.primary}; margin-bottom:6px;">🎯 الخطوات التالية · Prochaines Étapes</div>
      <ol style="margin:0; padding-right:18px; font-size:12px; color:${C.text}; direction:rtl; text-align:right;">
        <li style="margin-bottom:4px;">مراجعة هذه التوصيات مع فريق الإدارة في اجتماع قريب.</li>
        <li style="margin-bottom:4px;">تحديد الميزانية اللازمة لرفع طاقة نقطة الاختناق.</li>
        <li style="margin-bottom:4px;">استخدام أداة "ماذا لو" في النظام لاختبار سيناريوهات مختلفة.</li>
        <li>إعادة تشغيل النموذج بعد أي تغيير في الموارد المتاحة.</li>
      </ol>
    </div>
  `;
  return pageShell(content, 4, totalPages, "التوصيات الإدارية · Recommandations");
}

// ── Page 5 — Sensitivity Analysis ────────────────────────────────────────────
function buildSensitivityPage(input: ProblemInput, result: SolveResult, totalPages: number) {
  const sens = result.sensitivityAnalysis;

  function stabilityBadge(inc: number | null | undefined, dec: number | null | undefined, base: number) {
    const ratio = Math.min(
      inc === null || inc === undefined ? Infinity : inc / Math.max(Math.abs(base), 1),
      dec === null || dec === undefined ? Infinity : dec / Math.max(Math.abs(base), 1)
    );
    if (ratio >= 0.25) return [`مستقر · Stable`, C.green, C.greenLight];
    if (ratio >= 0.08) return [`حساس · Sensible`, C.orange, C.orangeLight];
    return [`حرج · Critique`, "#c62828", "#ffebee"];
  }

  const objRows = (sens?.objectiveCoefficients ?? []).map((sv, i) => {
    const v = input.variables[i];
    if (!v) return "";
    const [label, color, bg] = stabilityBadge(sv.allowableIncrease, sv.allowableDecrease, v.coefficient ?? 0);
    return `
      <tr style="background:${bg}">
        <td style="padding:8px 12px; font-weight:600; border-bottom:1px solid ${C.border};">${v.name}</td>
        <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-family:monospace;">${fmt(v.coefficient, "fr", 2)}</td>
        <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-family:monospace; color:${C.green};">
          ${sv.allowableDecrease === null || sv.allowableDecrease === undefined ? "∞" : "−" + fmt(sv.allowableDecrease, "fr", 2)}
        </td>
        <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-family:monospace; color:${C.orange};">
          ${sv.allowableIncrease === null || sv.allowableIncrease === undefined ? "∞" : "+" + fmt(sv.allowableIncrease, "fr", 2)}
        </td>
        <td style="padding:8px 12px; border-bottom:1px solid ${C.border};">
          <span style="padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700; background:${color}; color:${C.white};">${label}</span>
        </td>
      </tr>
    `;
  }).join("");

  const rhsRows = (sens?.constraints ?? []).map((sc, i) => {
    const c = input.constraints[i];
    if (!c) return "";
    const [label, color, bg] = stabilityBadge(sc.allowableIncrease, sc.allowableDecrease, c.rhs);
    return `
      <tr style="background:${bg}">
        <td style="padding:8px 12px; font-weight:600; border-bottom:1px solid ${C.border};">${c.name}</td>
        <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-family:monospace;">${fmt(c.rhs, "fr", 1)}</td>
        <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-family:monospace; color:${C.muted};">
          ${sc.shadowPrice != null ? fmt(sc.shadowPrice, "fr", 2) + " DZD" : "—"}
        </td>
        <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-family:monospace; color:${C.green};">
          ${sc.allowableDecrease === null || sc.allowableDecrease === undefined ? "∞" : "−" + fmt(sc.allowableDecrease, "fr", 2)}
        </td>
        <td style="padding:8px 12px; border-bottom:1px solid ${C.border}; font-family:monospace; color:${C.orange};">
          ${sc.allowableIncrease === null || sc.allowableIncrease === undefined ? "∞" : "+" + fmt(sc.allowableIncrease, "fr", 2)}
        </td>
        <td style="padding:8px 12px; border-bottom:1px solid ${C.border};">
          <span style="padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700; background:${color}; color:${C.white};">${label}</span>
        </td>
      </tr>
    `;
  }).join("");

  const content = `
    <div style="margin-bottom:16px;">
      <h2 style="font-size:20px; font-weight:800; color:${C.primary}; margin:0 0 4px;">تحليل الحساسية · Analyse de Sensibilité</h2>
      <div style="width:40px; height:3px; background:${C.accent}; border-radius:2px;"></div>
    </div>

    <div style="background:${C.primaryLight}; border-radius:8px; padding:12px 16px; margin-bottom:18px; font-size:12px; color:${C.text}; direction:rtl; text-align:right;">
      <strong>ما هو تحليل الحساسية؟</strong><br/>
      يُظهر هذا التحليل مدى استقرار الحل الأمثل عند تغيير معاملات الربح أو حدود الموارد. النطاق الأخضر = آمن، البرتقالي = تحذير، الأحمر = يتغير الحل.
    </div>

    <!-- Objective coefficients -->
    <div style="margin-bottom:18px;">
      <h3 style="font-size:13px; font-weight:700; color:${C.text}; margin:0 0 8px;">معاملات دالة الهدف · Coefficients Objectif</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:${C.primary}; color:${C.white};">
            <th style="padding:8px 12px; text-align:left;">المتغير</th>
            <th style="padding:8px 12px; text-align:left;">القيمة الحالية</th>
            <th style="padding:8px 12px; text-align:left;">تناقص مسموح</th>
            <th style="padding:8px 12px; text-align:left;">تزايد مسموح</th>
            <th style="padding:8px 12px; text-align:left;">الاستقرار</th>
          </tr>
        </thead>
        <tbody>${objRows || `<tr><td colspan="5" style="padding:12px; color:${C.muted}; text-align:center;">لا توجد بيانات</td></tr>`}</tbody>
      </table>
    </div>

    <!-- RHS ranges -->
    <div>
      <h3 style="font-size:13px; font-weight:700; color:${C.text}; margin:0 0 8px;">حدود الموارد (RHS) · Plages RHS</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:${C.text}; color:${C.white};">
            <th style="padding:8px 12px; text-align:left;">القيد</th>
            <th style="padding:8px 12px; text-align:left;">الحد الحالي</th>
            <th style="padding:8px 12px; text-align:left;">السعر الظل</th>
            <th style="padding:8px 12px; text-align:left;">تناقص مسموح</th>
            <th style="padding:8px 12px; text-align:left;">تزايد مسموح</th>
            <th style="padding:8px 12px; text-align:left;">الاستقرار</th>
          </tr>
        </thead>
        <tbody>${rhsRows || `<tr><td colspan="6" style="padding:12px; color:${C.muted}; text-align:center;">لا توجد بيانات</td></tr>`}</tbody>
      </table>
    </div>
  `;
  return pageShell(content, 5, totalPages, "تحليل الحساسية · Sensibilité");
}

// ── Page 6 — Digital Stamp ────────────────────────────────────────────────────
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
      <!-- top bar -->
      <div style="height:6px; background:${C.primary};"></div>
      <div style="background:${C.primary}; padding:10px 40px; display:flex; align-items:center; justify-content:space-between;">
        <span style="color:${C.white}; font-weight:700; font-size:16px;">OptimDZ</span>
        <span style="color:rgba(255,255,255,0.65); font-size:10px;">ختم رقمي · Cachet Numérique</span>
        <span style="color:rgba(255,255,255,0.6); font-size:10px;">${totalPages} / ${totalPages}</span>
      </div>

      <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; gap:32px; text-align:center;">
        <!-- stamp SVG -->
        <div>
          <svg width="200" height="200" viewBox="0 0 200 200">
            <!-- outer ring -->
            <circle cx="100" cy="100" r="95" fill="none" stroke="${C.primary}" stroke-width="3"/>
            <circle cx="100" cy="100" r="85" fill="none" stroke="${C.primary}" stroke-width="1" stroke-dasharray="6 4"/>
            <circle cx="100" cy="100" r="72" fill="${C.primaryLight}"/>
            <!-- inner decoration -->
            <circle cx="100" cy="100" r="60" fill="none" stroke="${C.primary}" stroke-width="1.5" stroke-dasharray="3 2"/>
            <!-- center logo -->
            <rect x="80" y="80" width="40" height="40" rx="8" fill="${C.primary}"/>
            <rect x="88" y="88" width="24" height="24" rx="4" fill="${C.white}"/>
            <rect x="94" y="94" width="12" height="12" rx="2" fill="${C.primary}"/>
            <!-- arc text top -->
            <path id="topArc" d="M 20,100 A 80,80 0 0,1 180,100" fill="none"/>
            <text font-size="11" font-family="Cairo,Inter,sans-serif" font-weight="700" fill="${C.primary}">
              <textPath href="#topArc" startOffset="15%">نظام OptimDZ لدعم القرار الإداري</textPath>
            </text>
            <!-- arc text bottom -->
            <path id="botArc" d="M 20,100 A 80,80 0 0,0 180,100" fill="none"/>
            <text font-size="9" font-family="Cairo,Inter,sans-serif" fill="${C.muted}">
              <textPath href="#botArc" startOffset="10%">Système d'Aide à la Décision · Algérie</textPath>
            </text>
            <!-- year -->
            <text x="100" y="148" text-anchor="middle" fill="${C.primary}" font-size="11" font-family="Cairo,Inter,sans-serif" font-weight="700">${new Date().getFullYear()}</text>
          </svg>
        </div>

        <!-- certification text -->
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

        <!-- info grid -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; width:100%; max-width:520px;">
          ${[
            ["رقم التقرير · N° Rapport", reportId],
            ["تاريخ الإنشاء · Date de Génération", generatedAt],
            ["المدير · Responsable", managerName || "—"],
            ["المؤسسة · Institution", institutionName || "—"],
          ].map(([label, value]) => `
            <div style="background:${C.white}; border:1px solid ${C.border}; border-radius:8px; padding:10px 14px;">
              <div style="font-size:9px; color:${C.muted}; margin-bottom:2px;">${label}</div>
              <div style="font-size:12px; font-weight:700;">${value}</div>
            </div>
          `).join("")}
        </div>

        <!-- signature line -->
        <div style="width:100%; max-width:520px; display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:16px;">
          ${["إمضاء المدير · Signature du Responsable", "ختم المؤسسة · Cachet de l'Institution"].map((label) => `
            <div style="text-align:center;">
              <div style="border-bottom:1.5px solid ${C.text}; height:50px; margin-bottom:6px;"></div>
              <div style="font-size:10px; color:${C.muted};">${label}</div>
            </div>
          `).join("")}
        </div>

        <!-- disclaimer -->
        <div style="font-size:9px; color:${C.muted}; max-width:520px; line-height:1.5; direction:rtl; text-align:center;">
          يُنصح بمراجعة هذا التقرير من قِبَل متخصص قبل اتخاذ قرارات نهائية. النتائج مبنية على بيانات مدخلة وقد تختلف عن الواقع الفعلي.
        </div>
      </div>

      <!-- accent bottom -->
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

  const TOTAL = 6;

  const pages = [
    buildCoverPage(input, result, managerName, institutionName, reportId, generatedAt, TOTAL),
    buildProblemPage(input, result, TOTAL),
    buildSolutionPage(input, result, TOTAL),
    buildRecommendationsPage(input, result, TOTAL),
    buildSensitivityPage(input, result, TOTAL),
    buildStampPage(managerName, institutionName, reportId, generatedAt, TOTAL),
  ];

  // A4 in mm
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Container injected off-screen
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;z-index:-1;";
  document.body.appendChild(container);

  try {
    // Wait for fonts to be ready
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
