import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { ComparisonResult, AlternativeResult } from "./investmentComparisonAlgorithm";
import { computeEAA } from "./investmentComparisonAlgorithm";

const C = {
  primary: "#004d40", primaryLight: "#e0f2f1",
  accent: "#f4a261", bg: "#fbf8f1", text: "#0c2621",
  muted: "#5f7b77", border: "#c8dad6", white: "#ffffff",
  green: "#2e7d32", greenLight: "#e8f5e9",
  red: "#c62828", redLight: "#ffebee",
  orange: "#e65100", orangeLight: "#fff3e0",
};

const COLORS = ["#004d40", "#f4a261", "#3a7d44", "#7b5ea7", "#c2522b"];

function f(n: number | null | undefined, dec = 2): string {
  if (n == null || !isFinite(n)) return "—";
  return parseFloat(n.toFixed(dec)).toLocaleString("fr-DZ", { maximumFractionDigits: dec });
}
function fDA(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(Math.round(n));
  return (n < 0 ? "−" : "") + abs.toLocaleString("fr-DZ") + " DA";
}
function genId() {
  return `CMP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
function medalOf(rank: number) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
}

function pageShell(content: string, pageNum: number, total: number, title: string) {
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
      <span style="color:rgba(255,255,255,0.75);font-size:11px;">${title}</span>
      <span style="color:rgba(255,255,255,0.6);font-size:10px;">${pageNum} / ${total}</span>
    </div>
    <div style="flex:1;padding:28px 36px 20px;display:flex;flex-direction:column;gap:0;">${content}</div>
    <div style="border-top:1px solid ${C.border};padding:8px 36px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
      <span style="font-size:9px;color:${C.muted};">نظام OptimDZ — مقارنة البدائل الاستثمارية · Comparaison des Alternatives d'Investissement</span>
      <span style="font-size:9px;color:${C.muted};">www.optimdz.replit.app</span>
    </div>
  </div>`;
}

function sectionTitle(fr: string, ar: string) {
  return `<div style="margin-bottom:12px;">
    <h2 style="font-size:17px;font-weight:800;color:${C.primary};margin:0 0 4px;">${ar} · ${fr}</h2>
    <div style="width:40px;height:3px;background:${C.accent};border-radius:2px;"></div>
  </div>`;
}

// ── Page 1 — Cover ─────────────────────────────────────────────────────────────
function buildCover(
  cr: ComparisonResult,
  projectTitle: string, sector: string | undefined,
  managerName: string, institutionName: string,
  reportId: string, generatedAt: string, totalPages: number
) {
  const { winner, alternatives, discountRate, unequalDurations, primaryCriterion } = cr;

  const altRows = alternatives.map((alt, idx) => {
    const isWinner = alt.overallRank === 1;
    const npv = alt.appraisal.npv;
    return `
      <div style="border:2px solid ${isWinner ? C.accent : C.border};background:${isWinner ? "rgba(244,162,97,0.12)" : "rgba(255,255,255,0.07)"};
        border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px;">
        <div style="width:14px;height:14px;border-radius:50%;background:${COLORS[idx]};flex-shrink:0;"></div>
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:700;color:${C.white};">${alt.input.name}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.65);">
            I₀: ${fDA(alt.input.initialInvestment)} · ${alt.input.duration} ans · VAN: ${fDA(npv)}
            ${unequalDurations && alt.eaa !== null ? ` · EAA: ${fDA(alt.eaa)}/an` : ""}
          </div>
        </div>
        ${isWinner ? `<div style="font-size:18px;">🥇</div>` : ""}
      </div>`;
  }).join("");

  const sectorMap: Record<string, string> = {
    trade: "Commerce", industry: "Industrie", agriculture: "Agriculture",
    services: "Services", custom: "Personnalisé",
  };

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
        <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-top:1px;">نظام دعم القرار · مقارنة البدائل الاستثمارية</div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 40px;text-align:center;gap:14px;">
      <div style="font-size:11px;letter-spacing:3px;color:${C.accent};text-transform:uppercase;font-weight:600;">تقرير رسمي · Rapport Officiel</div>
      <div style="font-size:24px;font-weight:800;line-height:1.3;direction:rtl;">تقرير مقارنة البدائل الاستثمارية</div>
      <div style="font-size:15px;font-weight:400;color:rgba(255,255,255,0.8);">Rapport de Comparaison des Alternatives d'Investissement</div>
      <div style="width:60px;height:3px;background:${C.accent};border-radius:2px;margin:6px 0;"></div>
      <div style="font-size:20px;font-weight:700;color:${C.accent};">${projectTitle || "—"}</div>

      <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:14px 20px;width:100%;max-width:600px;">
        <div style="font-size:10px;color:rgba(255,255,255,0.55);margin-bottom:10px;text-align:center;">ALTERNATIVES COMPARÉES</div>
        <div style="display:flex;flex-direction:column;gap:8px;">${altRows}</div>
      </div>

      <div style="background:rgba(244,162,97,0.15);border:1px solid ${C.accent};border-radius:10px;padding:12px 20px;margin-top:4px;">
        <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-bottom:4px;">
          🏆 RECOMMANDATION — Critère: ${primaryCriterion === "eaa" ? "EAA (durées inégales)" : "VAN (durées égales)"}
        </div>
        <div style="font-size:17px;font-weight:800;color:${C.accent};">${winner.input.name}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.7);">
          ${primaryCriterion === "eaa"
            ? `EAA = ${fDA(winner.eaa)}/an · VAN = ${fDA(winner.appraisal.npv)}`
            : `VAN = ${fDA(winner.appraisal.npv)} · TRI = ${winner.appraisal.irr !== null ? f(winner.appraisal.irr, 1) + "%" : "—"}`}
        </div>
      </div>
    </div>
    <div style="padding:0 40px 28px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${[
        ["المقاربة / Titre",         projectTitle || "—"],
        ["المسؤول / Responsable",    managerName  || "—"],
        ["المؤسسة / Institution",    institutionName || "—"],
        ["القطاع / Secteur",         sectorMap[sector ?? ""] ?? (sector || "—")],
        ["عدد البدائل / Nb. alt.",   String(alternatives.length)],
        ["معدل الخصم / Taux",        `${discountRate} %`],
        ["رقم التقرير / N° Rapport", reportId],
        ["تاريخ الإصدار / Date",     generatedAt],
      ].map(([label, value]) => `
        <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:11px 14px;">
          <div style="font-size:9px;color:rgba(255,255,255,0.55);margin-bottom:4px;">${label}</div>
          <div style="font-size:12px;font-weight:700;">${value}</div>
        </div>`).join("")}
    </div>
    <div style="height:6px;background:rgba(255,255,255,0.15);"></div>
  </div>`;
}

// ── Page 2 — Comparison Table ─────────────────────────────────────────────────
function buildComparisonTablePage(cr: ComparisonResult, totalPages: number) {
  const { alternatives, unequalDurations, primaryCriterion, winner } = cr;

  const colW = Math.floor(500 / alternatives.length);

  const headerCols = alternatives.map((alt, i) => {
    const isWin = alt.overallRank === 1;
    return `<th style="padding:8px;text-align:center;width:${colW}px;background:${isWin ? C.accent : "transparent"};color:${isWin ? C.white : C.white};">
      <div style="font-size:9px;opacity:0.7;margin-bottom:2px;">${medalOf(alt.overallRank)}</div>
      <div style="font-size:10.5px;font-weight:700;">${alt.input.name}</div>
      <div style="font-size:8.5px;opacity:0.65;margin-top:1px;">I₀: ${fDA(alt.appraisal.input.initialInvestment)} · ${alt.input.duration} ans</div>
    </th>`;
  }).join("");

  interface RowDef {
    label: string; key: string; isPrimary?: boolean; 
    values: string[]; colors: string[];
  }
  const rows: RowDef[] = [
    {
      label: `${unequalDurations && primaryCriterion === "eaa" ? "★ " : ""}VAN (NPV)`,
      key: "npv", isPrimary: !unequalDurations,
      values: alternatives.map(a => fDA(a.appraisal.npv)),
      colors: alternatives.map(a => a.appraisal.npv > 0 ? C.green : C.red),
    },
    ...(unequalDurations ? [{
      label: "★ EAA — Rente Équivalente Annuelle",
      key: "eaa", isPrimary: true,
      values: alternatives.map(a => a.eaa !== null ? fDA(a.eaa) + "/an" : "—"),
      colors: alternatives.map(a => a.eaa !== null && a.eaa > 0 ? C.green : C.red),
    }] : []),
    {
      label: "TRI (IRR)",
      key: "irr",
      values: alternatives.map(a => a.appraisal.irr !== null ? f(a.appraisal.irr, 2) + " %" : "—"),
      colors: alternatives.map(a => {
        if (a.appraisal.irr === null) return C.muted;
        return a.appraisal.irr >= cr.discountRate ? C.green : C.red;
      }),
    },
    {
      label: "Indice de Rentabilité (IP)",
      key: "pi",
      values: alternatives.map(a => f(a.appraisal.profitabilityIndex, 3)),
      colors: alternatives.map(a => a.appraisal.profitabilityIndex >= 1 ? C.green : C.red),
    },
    {
      label: "Récupération simple",
      key: "pb",
      values: alternatives.map(a => a.appraisal.simplePayback !== null
        ? `${f(a.appraisal.simplePayback, 1)} ans` : "—"),
      colors: alternatives.map(() => C.text),
    },
    {
      label: "Récupération actualisée",
      key: "dpb",
      values: alternatives.map(a => a.appraisal.discountedPayback !== null
        ? `${f(a.appraisal.discountedPayback, 1)} ans` : "> durée"),
      colors: alternatives.map(a =>
        a.appraisal.discountedPayback !== null && a.appraisal.discountedPayback < a.input.duration
          ? C.green : C.orange),
    },
    {
      label: "Investissement total I₀",
      key: "i0",
      values: alternatives.map(a => fDA(a.appraisal.input.initialInvestment)),
      colors: alternatives.map(() => C.text),
    },
    {
      label: "Durée du projet",
      key: "dur",
      values: alternatives.map(a => `${a.input.duration} ans`),
      colors: alternatives.map(() => C.text),
    },
    {
      label: "Classement global",
      key: "rank",
      values: alternatives.map(a => `${medalOf(a.overallRank)}`),
      colors: alternatives.map(a => a.overallRank === 1 ? C.orange : C.text),
    },
  ];

  const tableRows = rows.map((row, ri) => {
    const bg = row.isPrimary ? C.primaryLight : ri % 2 === 0 ? C.white : "#f5f5f5";
    const cells = row.values.map((val, ci) => {
      const isWin = alternatives[ci].overallRank === 1;
      return `<td style="padding:6px 8px;border-bottom:1px solid ${C.border};text-align:center;
        font-family:monospace;font-size:10.5px;color:${row.colors[ci]};font-weight:${isWin ? "700" : "500"};
        background:${isWin && row.isPrimary ? "#fff9f0" : "transparent"};">
        ${val}
      </td>`;
    }).join("");
    return `<tr style="background:${bg};">
      <td style="padding:6px 10px;border-bottom:1px solid ${C.border};font-size:10px;font-weight:${row.isPrimary ? "700" : "500"};
        color:${row.isPrimary ? C.primary : C.text};">${row.label}</td>
      ${cells}
    </tr>`;
  }).join("");

  const content = `
    ${sectionTitle("Tableau Comparatif des Alternatives", "جدول مقارنة البدائل الاستثمارية")}
    <div style="margin-bottom:10px;font-size:9.5px;color:${C.muted};">
      Taux d'actualisation commun : <strong>${cr.discountRate} %</strong>
      ${unequalDurations ? ` · ⚠️ Durées inégales → critère principal = EAA (Rente Équivalente Annuelle)` : ""}
      · Critère principal marqué ★
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:10px;">
      <thead>
        <tr style="background:${C.primary};color:${C.white};">
          <th style="padding:8px 10px;text-align:left;font-size:10px;">Indicateur</th>
          ${headerCols}
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>

    ${cr.hasRankingConflicts ? `
      <div style="margin-top:16px;background:${C.orangeLight};border:1px solid ${C.accent};border-radius:8px;padding:12px 14px;font-size:10px;line-height:1.65;">
        <strong>⚠️ Conflits de classement détectés :</strong><br/>
        ${cr.conflictDetails.map(d =>
          `• "${d.altName}" (1er selon ${primaryCriterion.toUpperCase()}) est ${d.rank}${d.rank === 2 ? "ème" : "ème"} selon <strong>${d.criterion}</strong> — 1er selon ce critère : <strong>${d.vs}</strong>.`
        ).join("<br/>")}
        <br/><em style="color:${C.muted};">La VAN${unequalDurations ? "/EAA" : ""} reste le critère de référence en finance de projet.</em>
      </div>
    ` : `
      <div style="margin-top:16px;background:${C.greenLight};border:1px solid #a5d6a7;border-radius:8px;padding:10px 14px;font-size:10px;">
        ✅ Aucun conflit de classement — tous les indicateurs convergent vers la même alternative recommandée : <strong>${winner.input.name}</strong>.
      </div>
    `}`;

  return pageShell(content, 2, totalPages, "جدول المقارنة · Tableau Comparatif");
}

// ── Page 3 — Charts + Analysis ────────────────────────────────────────────────
function buildChartsAndAnalysisPage(
  cr: ComparisonResult, totalPages: number
) {
  const { alternatives, winner, unequalDurations, primaryCriterion, conflictDetails } = cr;

  // ── NPV Bar Chart (HTML divs) ──────────────────────────────────────────────
  const npvs = alternatives.map(a => a.appraisal.npv);
  const absMax = Math.max(...npvs.map(Math.abs), 1);
  const barMaxW = 420;

  const npvBars = alternatives.map((alt, i) => {
    const npv = alt.appraisal.npv;
    const barW = Math.abs(npv / absMax) * barMaxW;
    const isPos = npv >= 0;
    const isWin = alt.overallRank === 1;
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="width:160px;text-align:right;font-size:10px;font-weight:${isWin ? "700" : "500"};flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${alt.input.name}</div>
        <div style="width:${barMaxW}px;position:relative;height:22px;background:#f0f0f0;border-radius:4px;flex-shrink:0;">
          <div style="position:absolute;${isPos ? "left:0" : `right:${barMaxW - barW}px`};width:${barW.toFixed(1)}px;height:22px;
            background:${COLORS[i]};border-radius:${isPos ? "4px" : "4px"};opacity:${isWin ? "1" : "0.75"};"></div>
          <div style="position:absolute;left:${(barMaxW / 2).toFixed(0)}px;top:0;width:1px;height:22px;background:${C.primary};opacity:0.3;"></div>
        </div>
        <div style="font-size:10px;font-family:monospace;font-weight:700;color:${isPos ? C.green : C.red};white-space:nowrap;">${fDA(npv)}</div>
        ${isWin ? "<div style=\"font-size:14px;\">🥇</div>" : ""}
      </div>`;
  }).join("");

  // ── EAA bar (if unequal durations) ────────────────────────────────────────
  let eaaBars = "";
  if (unequalDurations) {
    const eaaVals = alternatives.map(a => a.eaa ?? 0);
    const eaaAbsMax = Math.max(...eaaVals.map(Math.abs), 1);
    eaaBars = alternatives.map((alt, i) => {
      const eaa = alt.eaa ?? 0;
      const bw = Math.abs(eaa / eaaAbsMax) * barMaxW;
      const isPos = eaa >= 0;
      const isWin = alt.overallRank === 1;
      return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="width:160px;text-align:right;font-size:10px;font-weight:${isWin ? "700" : "500"};flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${alt.input.name}</div>
          <div style="width:${barMaxW}px;position:relative;height:22px;background:#f0f0f0;border-radius:4px;flex-shrink:0;">
            <div style="position:absolute;left:0;width:${bw.toFixed(1)}px;height:22px;background:${COLORS[i]};border-radius:4px;opacity:${isWin ? "1" : "0.75"};"></div>
          </div>
          <div style="font-size:10px;font-family:monospace;font-weight:700;color:${isPos ? C.green : C.red};white-space:nowrap;">${fDA(eaa)}/an</div>
          ${isWin ? "<div style=\"font-size:14px;\">🥇</div>" : ""}
        </div>`;
    }).join("");
  }

  // ── Analysis lines ────────────────────────────────────────────────────────
  const npvRange = Math.max(...npvs) - Math.min(...npvs);
  const sorted = [...alternatives].sort((a, b) => a.overallRank - b.overallRank);
  const best = sorted[0], second = sorted[1];

  const marginStatement = unequalDurations && best.eaa !== null && second.eaa !== null
    ? `L'avantage EAA de "${best.input.name}" sur "${second.input.name}" est de ${fDA(best.eaa - second.eaa)}/an.`
    : `L'avantage VAN de "${best.input.name}" sur "${second.input.name}" est de ${fDA(best.appraisal.npv - second.appraisal.npv)}.`;

  const conflictText = conflictDetails.length > 0
    ? conflictDetails.map(d => `⚠️ "${d.altName}" (1er selon ${primaryCriterion.toUpperCase()}) mais ${d.rank}${d.rank === 2 ? "ème" : "ème"} selon ${d.criterion} — 1er selon ce critère : "${d.vs}". <em>Priorité à la VAN${unequalDurations ? "/EAA" : ""} : elle mesure la création de richesse absolue.</em>`).join(" ")
    : `✅ Convergence totale : tous les indicateurs désignent "${winner.input.name}" comme la meilleure alternative — signal fort de robustesse.`;

  const content = `
    ${sectionTitle("Comparaison Visuelle — VAN par Alternative", "المقارنة البصرية — NPV لكل بديل")}
    <div style="padding:12px 0 4px;">${npvBars}</div>

    ${unequalDurations ? `
      ${sectionTitle("★ EAA — Rente Équivalente Annuelle (Durées inégales)", "★ EAA — المعدل السنوي المكافئ (مدد مختلفة)")}
      <div style="font-size:9px;color:${C.muted};margin-bottom:8px;">
        L'EAA permet de comparer des projets de durées différentes en ramenant la VAN à une valeur annuelle équivalente.
      </div>
      <div style="padding:8px 0;">${eaaBars}</div>
    ` : ""}

    <div style="margin-top:16px;background:${C.primaryLight};border-radius:8px;padding:14px 16px;font-size:10.5px;line-height:1.75;">
      <strong>📊 Synthèse :</strong><br/>
      🏆 Alternative recommandée : <strong>${winner.input.name}</strong> 
      (${primaryCriterion === "eaa" ? `EAA = ${fDA(winner.eaa)}/an` : `VAN = ${fDA(winner.appraisal.npv)}`}).<br/>
      ${marginStatement}<br/>
      ${conflictText}<br/>
      ${unequalDurations
        ? `📐 Note méthodologique : les durées diffèrent entre alternatives (${alternatives.map(a => `${a.input.name}: ${a.input.duration} ans`).join(", ")}). L'EAA a été utilisée comme critère de décision principal pour assurer une comparaison équitable.`
        : `📐 Les durées sont identiques (${alternatives[0].input.duration} ans) — la VAN est le critère de décision approprié.`}
    </div>

    ${sectionTitle("Recommandation & Facteurs Non-Financiers", "التوصية والعوامل غير المالية")}
    <div style="font-size:10.5px;line-height:1.75;color:${C.text};">
      Choisissez <strong>${winner.input.name}</strong> sur la base des indicateurs financiers. 
      Avant de finaliser, considérez également : la capacité opérationnelle et de gestion disponible, 
      l'alignement stratégique avec les objectifs à long terme, la tolérance au risque et les incertitudes de l'environnement, 
      et les facteurs réglementaires ou de marché spécifiques au secteur.
      <br/><br/>
      Les projections financières restent des estimations — leur fiabilité dépend directement de la qualité des données d'entrée. 
      Consultez un expert financier pour valider ces hypothèses avant tout engagement.
    </div>`;

  return pageShell(content, 3, totalPages, "المخططات والتحليل · Graphiques & Analyse");
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
        <div style="font-size:22px;font-weight:800;color:${C.primary};">تقرير مقارنة معتمد · Rapport Certifié</div>
        <div style="font-size:13px;color:${C.muted};margin-top:4px;">نظام OptimDZ لمقارنة البدائل الاستثمارية</div>
      </div>
      <div style="border:2px dashed ${C.border};border-radius:12px;padding:20px 40px;display:inline-block;">
        <div style="font-size:11px;color:${C.muted};margin-bottom:6px;">رقم تقرير المقارنة · Numéro du rapport</div>
        <div style="font-size:18px;font-family:monospace;font-weight:700;color:${C.primary};letter-spacing:2px;">${reportId}</div>
        <div style="font-size:10px;color:${C.muted};margin-top:6px;">${generatedAt}</div>
      </div>
      <div style="font-size:11px;color:${C.muted};max-width:440px;line-height:1.7;">
        هذا التقرير صادر تلقائياً من نظام OptimDZ لمقارنة البدائل الاستثمارية.
        النتائج مبنية على البيانات المُدخلة وتُعدّ أداة دعم قرار — وليست ضماناً للمردودية الفعلية.
        <br/><br/>
        Ce rapport a été généré automatiquement par le système OptimDZ de Comparaison des Alternatives.
        Il constitue une aide à la décision — non une garantie de rentabilité.
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

// ── Main export ───────────────────────────────────────────────────────────────
export interface ComparisonPDFOptions {
  result: ComparisonResult;
  projectTitle?: string;
  sector?: string;
  managerName?: string;
  institutionName?: string;
}

export async function generateComparisonPDFReport(opts: ComparisonPDFOptions): Promise<void> {
  const { result, projectTitle = "", sector, managerName = "", institutionName = "" } = opts;
  const reportId    = genId();
  const generatedAt = new Date().toLocaleDateString("fr-DZ", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const PAGE_W     = 210;
  const totalPages = 4;

  const coverHtml = buildCover(result, projectTitle, sector, managerName, institutionName, reportId, generatedAt, totalPages);
  const tableHtml = buildComparisonTablePage(result, totalPages);
  const chartsHtml = buildChartsAndAnalysisPage(result, totalPages);
  const stampHtml  = buildStampPage(reportId, generatedAt, totalPages);

  const coverContainer = document.createElement("div");
  coverContainer.style.cssText = "position:fixed;left:-9999px;top:-9999px;z-index:-1;";
  coverContainer.innerHTML = coverHtml;
  document.body.appendChild(coverContainer);
  const coverCanvas = await html2canvas(coverContainer.firstElementChild as HTMLElement,
    { scale: 2, useCORS: true, logging: false });
  const coverImgData = coverCanvas.toDataURL("image/jpeg", 0.92);
  const coverPageH = (coverCanvas.height / coverCanvas.width) * PAGE_W;
  document.body.removeChild(coverContainer);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [PAGE_W, coverPageH] });
  pdf.addImage(coverImgData, "JPEG", 0, 0, PAGE_W, coverPageH);
  await addHtmlPage(pdf, tableHtml,  PAGE_W);
  await addHtmlPage(pdf, chartsHtml, PAGE_W);
  await addHtmlPage(pdf, stampHtml,  PAGE_W);

  const safe = (projectTitle || "comparaison").replace(/\s+/g, "_");
  pdf.save(`OptimDZ_CMP_${safe}_${Date.now()}.pdf`);
}
