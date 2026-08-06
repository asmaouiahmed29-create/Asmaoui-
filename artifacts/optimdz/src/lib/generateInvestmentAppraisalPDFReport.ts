import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { InvestmentAppraisalResult } from "./investmentAppraisalAlgorithm";
import { fmtYears } from "./investmentAppraisalAlgorithm";

// ── Brand tokens (shared across all OptimDZ PDFs) ─────────────────────────────
const C = {
  primary: "#004d40", primaryLight: "#e0f2f1",
  secondary: "#3a7d44", accent: "#f4a261",
  bg: "#fbf8f1", text: "#0c2621", muted: "#5f7b77",
  orange: "#e65100", orangeLight: "#fff3e0",
  green: "#2e7d32", greenLight: "#e8f5e9",
  red: "#c62828", redLight: "#ffebee",
  border: "#c8dad6", white: "#ffffff",
};

function f(n: number | null | undefined, dec = 2): string {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  return parseFloat(n.toFixed(dec)).toLocaleString("fr-DZ", { maximumFractionDigits: dec });
}
function fDA(n: number | null | undefined): string {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  const abs = Math.abs(Math.round(n));
  return (n < 0 ? "−" : "") + abs.toLocaleString("fr-DZ") + " DA";
}
function genId() {
  return `IA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
function sectorLabel(s?: string) {
  const m: Record<string, string> = {
    trade: "تجارة / Commerce", industry: "صناعة / Industrie",
    services: "خدمات / Services", agriculture: "فلاحة / Agriculture",
    custom: "مخصص / Personnalisé",
  };
  return s ? (m[s] ?? s) : "—";
}

// ── Page shell ────────────────────────────────────────────────────────────────
function pageShell(content: string, pageNum: number, total: number, title: string) {
  return `
  <div style="width:794px;min-height:1123px;background:${C.bg};font-family:'Cairo','Inter',sans-serif;
    color:${C.text};position:relative;box-sizing:border-box;display:flex;flex-direction:column;">
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
      <span style="font-size:9px;color:${C.muted};">نظام OptimDZ لتقييم الجدوى الاستثمارية — Système OptimDZ d'Évaluation Financière de Projets</span>
      <span style="font-size:9px;color:${C.muted};">www.optimdz.replit.app</span>
    </div>
  </div>`;
}

function sectionTitle(fr: string, ar: string) {
  return `<div style="margin-bottom:14px;">
    <h2 style="font-size:19px;font-weight:800;color:${C.primary};margin:0 0 4px;">${ar} · ${fr}</h2>
    <div style="width:40px;height:3px;background:${C.accent};border-radius:2px;"></div>
  </div>`;
}
function kpiCard(label: string, value: string, bg: string, color = C.white) {
  return `<div style="background:${bg};border-radius:10px;padding:11px;color:${color};">
    <div style="font-size:9px;opacity:0.75;margin-bottom:4px;line-height:1.3;">${label}</div>
    <div style="font-size:14px;font-weight:800;">${value}</div>
  </div>`;
}
function analysisRow(icon: string, text: string, bg: string, border: string) {
  return `<div style="display:flex;align-items:flex-start;gap:10px;background:${bg};border:1px solid ${border};
    border-radius:8px;padding:9px 13px;margin-bottom:7px;font-size:11px;line-height:1.55;">
    <span style="font-size:14px;flex-shrink:0;">${icon}</span><span>${text}</span>
  </div>`;
}
function suggestionRow(icon: string, title: string, desc: string, borderColor: string, bg: string) {
  return `<div style="border-left:4px solid ${borderColor};background:${bg};border-radius:0 8px 8px 0;
    padding:9px 13px;margin-bottom:9px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <span style="font-size:13px;">${icon}</span>
      <span style="font-size:12px;font-weight:700;color:${C.text};">${title}</span>
    </div>
    <div style="font-size:10.5px;color:${C.muted};line-height:1.55;">${desc}</div>
  </div>`;
}

// ── Tailwind → inline CSS colour helpers (same as variance PDF) ───────────────
function twBg(cls: string): string {
  const map: Record<string, string> = {
    "bg-primary/10": "rgba(0,77,64,0.1)", "bg-primary/5": "rgba(0,77,64,0.05)",
    "bg-secondary/10": "rgba(58,125,68,0.1)",
    "bg-green-50": "#f0fdf4", "bg-red-50": "#fef2f2",
    "bg-orange-50": "#fff7ed", "bg-amber-50": "#fffbeb",
    "bg-teal-50": "#f0fdfa",  "bg-slate-50": "#f8fafc",
    "bg-white": "#ffffff",
  };
  for (const [k, v] of Object.entries(map)) if (cls.includes(k)) return v;
  return C.primaryLight;
}
function twBorder(cls: string): string {
  const map: Record<string, string> = {
    "border-primary/30": "rgba(0,77,64,0.3)", "border-primary": "#004d40",
    "border-secondary/30": "rgba(58,125,68,0.3)",
    "border-green-300": "#86efac", "border-red-300": "#fca5a5",
    "border-orange-300": "#fdba74", "border-amber-300": "#fcd34d",
    "border-l-primary": "#004d40",
    "border-l-green-600": "#16a34a", "border-l-green-500": "#22c55e",
    "border-l-red-500": "#ef4444", "border-l-amber-500": "#f59e0b",
    "border-l-orange-500": "#f97316",
  };
  for (const [k, v] of Object.entries(map)) if (cls.includes(k)) return v;
  return C.accent;
}

// ── Page 1 — Cover ────────────────────────────────────────────────────────────
function buildCover(
  result: InvestmentAppraisalResult, projectName: string, sector: string | undefined,
  managerName: string, institutionName: string,
  reportId: string, generatedAt: string, totalPages: number
) {
  const pn = projectName || result.input.projectName || "—";
  const npvPositive = result.npv >= 0;
  const verdict = result.npv > 0 && result.irr !== null && result.irr >= result.input.discountRate
    ? "GO ✅" : result.npv < 0 ? "NO-GO 🔴" : "CONDITIONNEL ⚠️";

  return `
  <div style="width:794px;min-height:1123px;background:${C.primary};font-family:'Cairo','Inter',sans-serif;
    color:${C.white};position:relative;box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="height:6px;background:${C.accent};"></div>
    <div style="padding:28px 40px 0;display:flex;align-items:center;gap:12px;">
      <div style="width:40px;height:40px;background:${C.white};border-radius:10px;display:flex;align-items:center;justify-content:center;">
        <div style="width:22px;height:22px;background:${C.primary};border-radius:5px;display:flex;align-items:center;justify-content:center;">
          <div style="width:10px;height:10px;background:${C.white};border-radius:2px;"></div>
        </div>
      </div>
      <div>
        <div style="font-size:22px;font-weight:800;letter-spacing:1px;">OptimDZ</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-top:1px;">نظام دعم القرار · تقييم الجدوى الاستثمارية</div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 40px;text-align:center;gap:14px;">
      <div style="font-size:11px;letter-spacing:3px;color:${C.accent};text-transform:uppercase;font-weight:600;">تقرير رسمي · Rapport Officiel</div>
      <div style="font-size:24px;font-weight:800;line-height:1.3;direction:rtl;">تقرير تقييم الجدوى الاستثمارية</div>
      <div style="font-size:15px;font-weight:400;color:rgba(255,255,255,0.8);">Rapport d'Évaluation Financière — VAN / TRI / Délai de Récupération</div>
      <div style="width:60px;height:3px;background:${C.accent};border-radius:2px;margin:6px 0;"></div>
      <div style="font-size:20px;font-weight:700;color:${C.accent};">${pn}</div>
      <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:12px 24px;margin-top:6px;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;text-align:center;">
          <div>
            <div style="font-size:9px;opacity:0.65;margin-bottom:3px;">صافي القيمة الحالية / VAN</div>
            <div style="font-size:15px;font-weight:800;color:${npvPositive ? "#a5d6a7" : "#ef9a9a"};">${fDA(result.npv)}</div>
          </div>
          <div>
            <div style="font-size:9px;opacity:0.65;margin-bottom:3px;">معدل العائد الداخلي / TRI</div>
            <div style="font-size:15px;font-weight:800;">${result.irr !== null ? f(result.irr, 2) + " %" : "—"}</div>
          </div>
          <div>
            <div style="font-size:9px;opacity:0.65;margin-bottom:3px;">مؤشر الربحية / IP</div>
            <div style="font-size:15px;font-weight:800;">${f(result.profitabilityIndex, 3)}</div>
          </div>
          <div>
            <div style="font-size:9px;opacity:0.65;margin-bottom:3px;">الاستثمار الأولي / I₀</div>
            <div style="font-size:15px;font-weight:800;">${fDA(result.input.initialInvestment)}</div>
          </div>
          <div>
            <div style="font-size:9px;opacity:0.65;margin-bottom:3px;">معدل الخصم / Taux req.</div>
            <div style="font-size:15px;font-weight:800;">${f(result.input.discountRate, 1)} %</div>
          </div>
          <div>
            <div style="font-size:9px;opacity:0.65;margin-bottom:3px;">التوصية / Verdict</div>
            <div style="font-size:15px;font-weight:800;">${verdict}</div>
          </div>
        </div>
      </div>
    </div>
    <div style="padding:0 40px 28px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${[
        ["المشروع / Projet",        pn],
        ["المسؤول / Responsable",   managerName     || "—"],
        ["المؤسسة / Institution",   institutionName || "—"],
        ["القطاع / Secteur",        sectorLabel(sector)],
        ["المدة / Durée",           `${result.input.duration} ans`],
        ["رقم التقرير / N° Rapport", reportId],
        ["تاريخ الإصدار / Date",    generatedAt],
        ["النوع / Type",            "Évaluation — VAN / TRI / IP"],
      ].map(([label, value]) => `
        <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:11px 14px;">
          <div style="font-size:9px;color:rgba(255,255,255,0.55);margin-bottom:4px;">${label}</div>
          <div style="font-size:12px;font-weight:700;">${value}</div>
        </div>`).join("")}
    </div>
    <div style="height:6px;background:rgba(255,255,255,0.15);"></div>
  </div>`;
}

// ── Page 2 — Cash Flow Analysis Table ─────────────────────────────────────────
function buildCashFlowPage(result: InvestmentAppraisalResult, totalPages: number) {
  const { input: inp, npv, irr, simplePayback, discountedPayback, profitabilityIndex, yearRows, totalPV } = result;

  const rows = yearRows.map((row, idx) => {
    const isRecDisc = row.cumulativeDCF >= 0 && (idx === 0 || yearRows[idx - 1].cumulativeDCF < 0);
    const isRecSimp = row.cumulativeCF  >= 0 && (idx === 0 || yearRows[idx - 1].cumulativeCF  < 0);
    return `<tr style="background:${idx % 2 === 0 ? C.white : "#f5f5f5"};">
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};font-size:10.5px;font-weight:${idx === yearRows.length-1 ? "700" : "400"};">
        An ${row.year}${idx === yearRows.length-1 && inp.salvageValue ? " (+VR)" : ""}
      </td>
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;font-size:10.5px;">${fDA(row.cashFlow)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;font-size:10.5px;">${f(row.discountFactor, 4)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;font-size:10.5px;">${fDA(row.presentValue)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;font-size:10.5px;color:${row.cumulativeCF >= 0 ? C.green : C.red};">
        ${fDA(row.cumulativeCF)}${isRecSimp ? " ✅" : ""}
      </td>
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;font-size:10.5px;color:${row.cumulativeDCF >= 0 ? C.green : C.red};">
        ${fDA(row.cumulativeDCF)}${isRecDisc ? " ✅" : ""}
      </td>
    </tr>`;
  }).join("");

  const content = `
    ${sectionTitle("Analyse des Flux — Tableau d'Actualisation", "تحليل التدفقات — جدول الاستحداث")}
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-bottom:16px;">
      ${kpiCard("صافي القيمة الحالية · VAN", fDA(npv), npv >= 0 ? C.green : C.red)}
      ${kpiCard(`معدل العائد الداخلي · TRI`, irr !== null ? f(irr, 2) + " %" : "—", irr !== null && irr >= inp.discountRate ? C.secondary : C.orange)}
      ${kpiCard("مؤشر الربحية · IP", f(profitabilityIndex, 3), profitabilityIndex >= 1 ? C.primary : C.red)}
      ${kpiCard("فترة الاسترداد البسيطة · Délai simple", simplePayback !== null ? fmtYears(simplePayback, "fr") : "—", C.text)}
      ${kpiCard("فترة الاسترداد المخصومة · Délai actualisé", discountedPayback !== null ? fmtYears(discountedPayback, "fr") : "—", discountedPayback !== null && discountedPayback < inp.duration ? C.secondary : C.orange)}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:16px;">
      <thead>
        <tr style="background:${C.primary};color:${C.white};">
          <th style="padding:7px 8px;text-align:left;">السنة · Année</th>
          <th style="padding:7px 8px;text-align:right;">التدفق · Flux (DA)</th>
          <th style="padding:7px 8px;text-align:right;">معامل الخصم · Facteur</th>
          <th style="padding:7px 8px;text-align:right;">القيمة الحالية · VP (DA)</th>
          <th style="padding:7px 8px;text-align:right;">تراكم بسيط · Cum. CF</th>
          <th style="padding:7px 8px;text-align:right;">تراكم مخصوم · Cum. VA</th>
        </tr>
        <tr style="background:#f5f5f5;font-weight:700;font-size:10.5px;">
          <td style="padding:5px 8px;border-bottom:1px solid ${C.border};">An 0</td>
          <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;color:${C.red};">−${fDA(inp.initialInvestment)}</td>
          <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;">1.0000</td>
          <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;color:${C.red};">−${fDA(inp.initialInvestment)}</td>
          <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;color:${C.red};">−${fDA(inp.initialInvestment)}</td>
          <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;color:${C.red};">−${fDA(inp.initialInvestment)}</td>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="background:${C.primaryLight};font-weight:700;border-top:2px solid ${C.primary};">
          <td style="padding:7px 8px;font-size:11px;">المجموع · Total / VAN</td>
          <td style="padding:7px 8px;text-align:right;font-family:monospace;font-size:11px;">${fDA(result.totalCashFlow)}</td>
          <td style="padding:7px 8px;text-align:right;">—</td>
          <td style="padding:7px 8px;text-align:right;font-family:monospace;font-size:11px;">${fDA(totalPV)}</td>
          <td style="padding:7px 8px;text-align:right;">—</td>
          <td style="padding:7px 8px;text-align:right;font-family:monospace;font-size:12px;color:${npv >= 0 ? C.green : C.red};">${fDA(npv)}</td>
        </tr>
      </tbody>
    </table>
    <div style="background:${C.primaryLight};border-radius:8px;padding:12px 14px;font-size:10px;line-height:1.8;font-family:monospace;">
      <strong>الصيغ المُطبَّقة · Formules appliquées:</strong><br/>
      VAN = −I₀ + Σ [CFₜ/(1+r)ᵗ] = −${fDA(inp.initialInvestment)} + ${fDA(totalPV)} = ${fDA(npv)}<br/>
      IP = Σ VA / I₀ = ${fDA(totalPV)} / ${fDA(inp.initialInvestment)} = ${f(profitabilityIndex, 4)}<br/>
      TRI : résoudre VAN(r*) = 0  →  r* = ${irr !== null ? f(irr, 2) + " %" : "—"}<br/>
      r (taux requis) = ${f(inp.discountRate, 1)} %  ·  I₀ = ${fDA(inp.initialInvestment)}  ·  n = ${inp.duration} ans${inp.salvageValue ? `  ·  Valeur résiduelle = ${fDA(inp.salvageValue)}` : ""}
    </div>`;
  return pageShell(content, 2, totalPages, "تحليل التدفقات · Analyse des Flux");
}

// ── Page 3 — Evaluation & Recommendations ─────────────────────────────────────
function buildEvaluationPage(opts: InvestmentAppraisalPDFOptions, totalPages: number) {
  const { result, analysisLines = [], suggestions = [] } = opts;
  const { npv, irr, simplePayback, discountedPayback, profitabilityIndex, input: inp } = result;
  const r = inp.discountRate;
  const n = inp.duration;

  const goCount = [
    npv > 0,
    irr !== null && irr >= r,
    profitabilityIndex >= 1,
    discountedPayback !== null && discountedPayback < n,
  ].filter(Boolean).length;

  const verdictLabel = goCount >= 3
    ? "GO ✅ — الاستثمار موصى به · Investissement recommandé"
    : goCount >= 2
    ? "CONDITIONNEL ⚠️ — استكمال التحليل · Approfondir l'analyse"
    : "NO-GO 🔴 — مراجعة الاستثمار · À revoir";
  const verdictBg     = goCount >= 3 ? C.greenLight : goCount >= 2 ? C.orangeLight : "#ffebee";
  const verdictBorder = goCount >= 3 ? C.green      : goCount >= 2 ? C.orange      : C.red;

  // Criterion badge pills
  const criteria = [
    { ok: npv > 0,                                             label: "VAN > 0" },
    { ok: irr !== null && irr >= r,                            label: `TRI ≥ ${f(r, 1)}%` },
    { ok: profitabilityIndex >= 1,                             label: "IP ≥ 1" },
    { ok: discountedPayback !== null && discountedPayback < n, label: "Récup. act." },
  ];
  const badgesHtml = criteria.map(c =>
    `<span style="display:inline-block;background:${c.ok ? C.greenLight : "#ffebee"};` +
    `color:${c.ok ? C.green : C.red};` +
    `border:1px solid ${c.ok ? C.green + "55" : C.red + "55"};` +
    `border-radius:6px;padding:3px 9px;font-size:9px;font-weight:700;` +
    `white-space:nowrap;margin-right:4px;margin-bottom:3px;">` +
    `${c.ok ? "✅" : "❌"} ${c.label}</span>`
  ).join("");

  // Analysis lines — passed from results page (language-aware, same text as screen)
  const analysisHtml = `<div style="background:${C.primaryLight};border:1px solid ${C.primary}33;border-radius:8px;
    padding:11px 14px;margin-bottom:14px;font-size:11px;line-height:1.65;">
    ${analysisLines.map(line => `<p style="margin:0 0 7px;">${line.text}</p>`).join("")}
  </div>`;

  // Suggestion cards — passed from results page (all cards, bilingual, correct colors)
  const suggestionsHtml = suggestions.map(s =>
    suggestionRow(s.icon, s.title, s.desc, twBorder(s.borderColor), twBg(s.color))
  ).join("");

  // KPI report card grid — mirrors "Rapport d'Évaluation" section on results page
  const kpis = [
    { label: "الاستثمار الأولي · Investissement initial", value: fDA(inp.initialInvestment) },
    { label: "مدة المشروع · Durée du projet",             value: `${n} ans` },
    { label: "معدل الخصم · Taux d'actualisation",         value: `${f(r, 1)} %` },
    { label: "صافي القيمة الحالية · VAN",                 value: fDA(npv) },
    { label: "معدل العائد الداخلي · TRI",                 value: irr !== null ? `${f(irr, 2)} %` : "—" },
    { label: "مؤشر الربحية · IP",                         value: f(profitabilityIndex, 3) },
    { label: "فترة الاسترداد البسيطة · Délai simple",     value: simplePayback  !== null ? fmtYears(simplePayback,  "fr") : "—" },
    { label: "فترة الاسترداد المخصومة · Délai actualisé", value: discountedPayback !== null ? fmtYears(discountedPayback, "fr") : "—" },
    { label: "إجمالي التدفقات · Total flux",              value: fDA(result.totalCashFlow) },
    { label: "إجمالي القيم الحالية · Total VP",           value: fDA(result.totalPV) },
    ...(inp.salvageValue ? [{ label: "القيمة المتبقية · Valeur résiduelle", value: fDA(inp.salvageValue) }] : []),
  ];
  const kpiGridHtml = kpis.map(k =>
    `<div style="background:${C.white};border:1px solid ${C.border};border-radius:8px;padding:9px 11px;">` +
    `<div style="font-size:8px;color:${C.muted};margin-bottom:3px;line-height:1.3;">${k.label}</div>` +
    `<div style="font-size:13px;font-weight:800;color:${C.text};">${k.value}</div>` +
    `</div>`
  ).join("");

  // Formula reminder — mirrors formula box on results page
  const formulaHtml =
    `<div style="background:${C.primaryLight};border:1px solid ${C.primary}33;border-radius:8px;` +
    `padding:11px 14px;font-size:9.5px;line-height:1.8;font-family:monospace;margin-top:10px;">` +
    `<div style="font-family:'Cairo','Inter',sans-serif;font-size:8.5px;font-weight:700;` +
    `color:${C.muted};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">` +
    `الصيغ المُطبَّقة · Formules appliquées</div>` +
    `VAN = −I₀ + Σ [CFₜ/(1+r)ᵗ] = −${fDA(inp.initialInvestment)} + ${fDA(result.totalPV)} = ${fDA(npv)}<br/>` +
    `IP  = Σ VA / I₀ = ${fDA(result.totalPV)} / ${fDA(inp.initialInvestment)} = ${f(profitabilityIndex, 4)}<br/>` +
    `TRI : résoudre VAN(r*) = 0  →  r* = ${irr !== null ? f(irr, 2) + " %" : "—"}<br/>` +
    `r = ${f(r, 1)} %  ·  I₀ = ${fDA(inp.initialInvestment)}  ·  n = ${n} ans` +
    `${inp.salvageValue ? `  ·  VR = ${fDA(inp.salvageValue)}` : ""}` +
    `</div>`;

  const content = `
    ${sectionTitle("التقييم والتوصيات الاستراتيجية", "Évaluation & Recommandations Stratégiques")}
    <div style="border:2px solid ${verdictBorder};background:${verdictBg};border-radius:10px;
      padding:12px 16px;margin-bottom:14px;display:flex;align-items:flex-start;gap:12px;">
      <div style="font-size:28px;flex-shrink:0;">${goCount >= 3 ? "✅" : goCount >= 2 ? "⚠️" : "🔴"}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:800;color:${C.text};margin-bottom:6px;">${verdictLabel}</div>
        <div style="display:flex;flex-wrap:wrap;">${badgesHtml}</div>
      </div>
    </div>
    ${sectionTitle("Analyse de Viabilité", "تحليل الجدوى")}
    <div style="margin-bottom:14px;">${analysisHtml || `<div style="color:${C.muted};font-size:10px;">—</div>`}</div>
    ${sectionTitle("Recommandations Stratégiques", "التوصيات الاستراتيجية")}
    <div style="margin-bottom:16px;">${suggestionsHtml || `<div style="color:${C.muted};font-size:10px;">—</div>`}</div>
    ${sectionTitle("Rapport d'Évaluation · بطاقة التقييم الإداري", "")}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;">${kpiGridHtml}</div>
    ${formulaHtml}`;

  return pageShell(content, 3, totalPages, "التقييم والتوصيات · Évaluation Go/No-Go");
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
        <div style="font-size:22px;font-weight:800;color:${C.primary};">تقرير استثمار معتمد · Rapport Certifié</div>
        <div style="font-size:13px;color:${C.muted};margin-top:4px;">نظام OptimDZ لتقييم الجدوى الاستثمارية</div>
      </div>
      <div style="border:2px dashed ${C.border};border-radius:12px;padding:20px 40px;display:inline-block;">
        <div style="font-size:11px;color:${C.muted};margin-bottom:6px;">رقم تقرير التقييم · Numéro du rapport</div>
        <div style="font-size:18px;font-family:monospace;font-weight:700;color:${C.primary};letter-spacing:2px;">${reportId}</div>
        <div style="font-size:10px;color:${C.muted};margin-top:6px;">${generatedAt}</div>
      </div>
      <div style="font-size:11px;color:${C.muted};max-width:440px;line-height:1.7;">
        هذا التقرير صادر تلقائياً من نظام OptimDZ لتقييم الجدوى الاستثمارية (VAN / TRI / IP).
        المؤشرات المحسوبة مبنية على البيانات المُدخلة وتُعدّ أداة دعم قرار — وليست ضماناً للمردودية الفعلية.
        <br/><br/>
        Ce rapport a été généré automatiquement par le système OptimDZ d'évaluation financière.
        Les indicateurs sont basés sur les données saisies et constituent une aide à la décision — sans garantie de rendement réel.
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

// ── Main export ────────────────────────────────────────────────────────────────
export interface InvestmentAppraisalPDFOptions {
  result: InvestmentAppraisalResult;
  projectName?: string;
  sector?: string;
  managerName?: string;
  institutionName?: string;
  /** Pre-rendered analysis lines from the results page (language-aware) */
  analysisLines?: { icon: string; text: string; color: string }[];
  /** Pre-rendered suggestion cards from the results page (language-aware) */
  suggestions?: { icon: string; title: string; desc: string; color: string; borderColor: string }[];
}

export async function generateInvestmentAppraisalPDFReport(opts: InvestmentAppraisalPDFOptions): Promise<void> {
  const { result, projectName = "", sector, managerName = "", institutionName = "" } = opts;
  const reportId    = genId();
  const generatedAt = new Date().toLocaleDateString("fr-DZ", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const PAGE_W     = 210;
  const totalPages = 4;

  const coverHtml      = buildCover(result, projectName, sector, managerName, institutionName, reportId, generatedAt, totalPages);
  const cashFlowHtml   = buildCashFlowPage(result, totalPages);
  const evaluationHtml = buildEvaluationPage(opts, totalPages);
  const stampHtml      = buildStampPage(reportId, generatedAt, totalPages);

  // Render cover
  const coverContainer = document.createElement("div");
  coverContainer.style.cssText = "position:fixed;left:-9999px;top:-9999px;z-index:-1;";
  coverContainer.innerHTML = coverHtml;
  document.body.appendChild(coverContainer);
  const coverCanvas = await html2canvas(coverContainer.firstElementChild as HTMLElement,
    { scale: 2, useCORS: true, logging: false });
  const coverImgData = coverCanvas.toDataURL("image/jpeg", 0.92);
  const coverPageH   = (coverCanvas.height / coverCanvas.width) * PAGE_W;
  document.body.removeChild(coverContainer);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [PAGE_W, coverPageH] });
  pdf.addImage(coverImgData, "JPEG", 0, 0, PAGE_W, coverPageH);

  await addHtmlPage(pdf, cashFlowHtml,   PAGE_W);
  await addHtmlPage(pdf, evaluationHtml, PAGE_W);
  await addHtmlPage(pdf, stampHtml,      PAGE_W);

  const safeName = (projectName || result.input.projectName || "investissement").replace(/\s+/g, "_");
  pdf.save(`OptimDZ_IA_${safeName}_${Date.now()}.pdf`);
}
