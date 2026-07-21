import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { Criterion, SupplierResult, SupplierAnalysis } from "./supplierAlgorithm";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SupplierPDFOptions {
  problemName: string;
  criteria: Criterion[];
  results: SupplierResult[];
  analysis: SupplierAnalysis | null;
  analysisLines: string[];
  suggestions: { icon: string; title: string; desc: string }[];
  scale: 10 | 100;
  managerName?: string;
  institutionName?: string;
  onProgress?: (step: string) => void;
}

// ── Colour palette ────────────────────────────────────────────────────────────
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
  gold:         "#b8860b",
};

function genId(): string {
  return `SUP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
function fNum(n: number, d = 1): string {
  return n.toLocaleString("fr-DZ", { maximumFractionDigits: d, minimumFractionDigits: 0 });
}
function rankMedal(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
}

// ── Shared shell ──────────────────────────────────────────────────────────────
function pageShell(content: string, pg: number, total: number): string {
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
    <span style="color:rgba(255,255,255,0.75);font-size:11px;">اختيار الموردين · Sélection des Fournisseurs</span>
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
function buildCover(opts: SupplierPDFOptions, reportId: string, date: string, total: number): string {
  const top   = opts.results[0];
  const kpis  = [
    { label: "عدد الموردين / Nb. Fournisseurs", value: String(opts.results.length),       color: C.primary },
    { label: "عدد المعايير / Nb. Critères",    value: String(opts.criteria.length),       color: C.primary },
    { label: "أفضل مورد / Meilleur Fournisseur", value: top?.name ?? "—",                 color: C.gold    },
    { label: "أفضل نقطة / Score Max",           value: top ? fNum(top.totalScore, 1) + " / 100" : "—", color: C.green },
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
    <div style="font-size:26px;font-weight:800;line-height:1.3;direction:rtl;">اختيار الموردين</div>
    <div style="font-size:15px;font-weight:400;color:rgba(255,255,255,0.8);">Sélection Multicritère des Fournisseurs</div>
    <div style="width:60px;height:3px;background:${C.accent};border-radius:2px;margin:4px 0;"></div>
    <div style="font-size:22px;font-weight:700;color:${C.accent};">${opts.problemName}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:580px;margin-top:8px;">
      ${kpis.map(k => `
        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:12px 16px;text-align:left;">
          <div style="font-size:9px;color:rgba(255,255,255,0.55);margin-bottom:4px;">${k.label}</div>
          <div style="font-size:16px;font-weight:800;color:${C.accent};">${k.value}</div>
        </div>`).join("")}
    </div>
  </div>
  <div style="padding:0 40px 28px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
    ${[
      ["المسألة / Problème",    opts.problemName],
      ["المعايير / Critères",   opts.criteria.map(c => c.name).join(", ")],
      ["السلم / Échelle",       `0 – ${opts.scale}`],
      ["المسؤول / Responsable", opts.managerName  || "—"],
      ["المؤسسة / Institution", opts.institutionName || "—"],
      ["رقم التقرير / N°",     reportId],
      ["تاريخ الإصدار / Date",  date],
      ["عدد الصفحات / Pages",   String(total)],
    ].map(([l, v]) => `
      <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:11px 14px;">
        <div style="font-size:9px;color:rgba(255,255,255,0.55);margin-bottom:4px;">${l}</div>
        <div style="font-size:11px;font-weight:700;">${v}</div>
      </div>`).join("")}
  </div>
  <div style="height:6px;background:rgba(255,255,255,0.15);"></div>
</div>`;
}

// ── Page 2: Ranked table ──────────────────────────────────────────────────────
function buildResultsPage(opts: SupplierPDFOptions, total: number): string {
  const colW = Math.max(60, Math.floor(500 / (opts.criteria.length + 1)));

  const criteriaHeaderCells = opts.criteria.map(c =>
    `<th style="padding:5px 6px;text-align:center;font-size:8px;font-weight:700;background:${C.primaryLight};color:${C.primary};">
      ${c.name}<br/><span style="font-weight:400;font-size:7px;">(${c.weight}%)</span>
    </th>`
  ).join("");

  const rows = opts.results.map((r, i) => {
    const isTop = i === 0;
    const scoreCells = opts.criteria.map(c =>
      `<td style="padding:4px 6px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;font-size:8.5px;">
        ${fNum(r.scores[c.id] ?? 0, 0)}
        <span style="color:${C.muted};font-size:7px;"> (${fNum(r.weightedScores[c.id] ?? 0, 1)})</span>
      </td>`
    ).join("");
    return `<tr style="background:${isTop ? "#e8f5e9" : i % 2 === 0 ? C.white : "#f7f7f7"};">
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};font-weight:${isTop ? "800" : "600"};font-size:9px;white-space:nowrap;">
        ${rankMedal(r.rank)} ${r.name}
      </td>
      ${scoreCells}
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;font-weight:800;font-size:10px;color:${isTop ? C.green : C.primary};">
        ${fNum(r.totalScore, 1)}
      </td>
    </tr>`;
  }).join("");

  // Mini bar chart using inline divs
  const maxScore = opts.results[0]?.totalScore || 100;
  const bars = opts.results.map((r, i) => {
    const w = maxScore > 0 ? (r.totalScore / maxScore) * 380 : 0;
    const isTop = i === 0;
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:120px;font-size:9px;font-weight:${isTop ? "700" : "400"};text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${rankMedal(r.rank)} ${r.name}</div>
        <div style="height:18px;background:${isTop ? C.green : C.primary};border-radius:4px;width:${Math.round(w)}px;min-width:4px;"></div>
        <div style="font-size:9px;font-weight:700;color:${isTop ? C.green : C.text};">${fNum(r.totalScore, 1)}</div>
      </div>`;
  }).join("");

  const content = `
    ${secTitle("نتائج التقييم المرجّح", "Résultats — Classement Pondéré")}
    <div style="font-size:10px;color:${C.muted};margin-bottom:14px;">${opts.problemName} — Échelle : 0–${opts.scale}</div>

    <div style="overflow-x:auto;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;min-width:${colW * (opts.criteria.length + 2)}px;">
        <thead>
          <tr style="background:${C.primary};color:${C.white};">
            <th style="padding:6px 8px;text-align:left;font-size:9px;font-weight:700;">المورد / Fournisseur</th>
            ${criteriaHeaderCells}
            <th style="padding:6px 8px;text-align:center;font-size:9px;font-weight:700;background:${C.accent};color:${C.text};">النقاط / Score Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="font-size:8px;color:${C.muted};margin-bottom:16px;">
      ملاحظة · Note : القيم بين قوسين = المساهمة المرجّحة لكل معيار / Les valeurs entre parenthèses = contribution pondérée par critère.
    </div>

    ${secTitle("مقارنة بيانية", "Comparaison Graphique")}
    <div style="background:${C.white};border:1px solid ${C.border};border-radius:8px;padding:16px;">
      ${bars}
      <div style="font-size:8px;color:${C.muted};margin-top:8px;">النقاط الإجمالية المرجّحة / Scores totaux pondérés (max 100)</div>
    </div>`;

  return pageShell(content, 2, total);
}

// ── Page 3: Analysis + Recommendations ───────────────────────────────────────
function buildAnalysisPage(opts: SupplierPDFOptions, total: number): string {
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

  return pageShell(content, 3, total);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateSupplierPDF(opts: SupplierPDFOptions): Promise<void> {
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
  pdf.save(`OptimDZ_Suppliers_${safeName}_${reportId}.pdf`);
}
