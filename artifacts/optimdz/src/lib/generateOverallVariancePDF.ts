import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface OverallVariancePDFComponent {
  type: string;
  nameFr: string;
  nameAr: string;
  emoji: string;
  rawValue: number;
  absPct: number;
  problemName: string;
}

export interface OverallVariancePDFOptions {
  problemName: string;
  components: OverallVariancePDFComponent[];
  grandTotal: number;
  dominantType: string;
  referenceBase: number;
  analysisLines: { icon: string; text: string }[];
  suggestions: { icon: string; title: string; desc: string }[];
  managerName?: string;
  institutionName?: string;
  onProgress?: (step: string, pct: number) => void;
}

// ── Colour palette ─────────────────────────────────────────────────────────────
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
  red:          "#c62828",
  redLight:     "#ffebee",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function genId(): string {
  return `OVR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function fDA(n: number): string {
  const abs  = Math.abs(n);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const s    = abs >= 1_000_000
    ? (abs / 1_000_000).toFixed(2) + " M DA"
    : abs >= 1_000
    ? (abs / 1_000).toFixed(1) + " k DA"
    : Math.round(abs).toLocaleString("fr-DZ") + " DA";
  return (sign ? sign + "\u202F" : "") + s;
}

function favColor(v: number, type: string): string {
  if (v === 0) return C.muted;
  // revenue: positive = good; costs: negative = good
  const isGood = type === "revenue" ? v > 0 : v < 0;
  return isGood ? C.green : C.red;
}

function totalColor(v: number): string {
  if (v === 0) return C.muted;
  return v > 0 ? C.green : C.red;
}

// ── Page shell ─────────────────────────────────────────────────────────────────
function pageShell(content: string, pg: number, total: number, subtitle: string): string {
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
    <span style="font-size:9px;color:${C.muted};">نظام OptimDZ — تركيب انحرافات النتيجة · Synthèse des Écarts sur Résultat</span>
    <span style="font-size:9px;color:${C.muted};">www.optimdz.replit.app</span>
  </div>
</div>`;
}

function secTitle(fr: string, ar: string): string {
  return `<div style="margin-bottom:12px;margin-top:20px;">
    <h2 style="font-size:15px;font-weight:800;color:${C.primary};margin:0 0 4px;">${ar} · ${fr}</h2>
    <div style="width:40px;height:3px;background:${C.accent};border-radius:2px;"></div>
  </div>`;
}

// ── Page 1: Cover ──────────────────────────────────────────────────────────────
function buildCover(opts: OverallVariancePDFOptions, reportId: string, generatedAt: string, totalPages: number): string {
  const tot = opts.grandTotal;
  const totCol = totalColor(tot);

  const kpis = [
    ...opts.components.map(c => ({
      label: `${c.emoji} ${c.nameAr} · ${c.nameFr}`,
      value: fDA(c.rawValue),
      color: favColor(c.rawValue, c.type),
    })),
    { label: "⚖️ الانحراف الإجمالي · Écart Total", value: fDA(tot), color: totCol },
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
    <div style="font-size:22px;font-weight:800;line-height:1.3;direction:rtl;">تركيب انحرافات النتيجة</div>
    <div style="font-size:15px;font-weight:400;color:rgba(255,255,255,0.8);">Synthèse des Écarts sur Résultat</div>
    <div style="width:60px;height:3px;background:${C.accent};border-radius:2px;margin:4px 0;"></div>
    <div style="font-size:22px;font-weight:700;color:${C.accent};">${opts.problemName}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.7);">4 composantes analysées</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:580px;margin-top:8px;">
      ${kpis.map(k => `
        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:12px 16px;text-align:left;">
          <div style="font-size:9px;color:rgba(255,255,255,0.55);margin-bottom:4px;">${k.label}</div>
          <div style="font-size:18px;font-weight:800;color:${C.accent};">${k.value}</div>
        </div>`).join("")}
    </div>
  </div>
  <div style="padding:0 40px 28px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
    ${[
      ["المسألة / Problème", opts.problemName],
      ["النوع / Type", "Synthèse des Écarts sur Résultat"],
      ["المكوّنات / Composantes", "4 (Revenus + Matières + M.O. + C.I.)"],
      ["الانحراف الإجمالي / Écart Total", fDA(tot)],
      ["العامل المسيطر / Facteur dominant", opts.dominantType === "equal" ? "Équilibrés" : opts.dominantType],
      ["المسؤول / Responsable", opts.managerName || "—"],
      ["رقم التقرير / N° Rapport", reportId],
      ["تاريخ الإصدار / Date", generatedAt],
    ].map(([l, v]) => `
      <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:11px 14px;">
        <div style="font-size:9px;color:rgba(255,255,255,0.55);margin-bottom:4px;">${l}</div>
        <div style="font-size:11.5px;font-weight:700;">${v}</div>
      </div>`).join("")}
  </div>
  <div style="height:6px;background:rgba(255,255,255,0.15);"></div>
</div>`;
}

// ── Page 2: Results + Waterfall ────────────────────────────────────────────────
function buildResultsPage(opts: OverallVariancePDFOptions, totalPages: number): string {
  const { components, grandTotal } = opts;
  const fc = (v: number, type: string) => favColor(v, type);

  // Detailed table
  const tableRows = components.map((c, i) => {
    const bg    = i % 2 === 0 ? C.white : "#f7f7f7";
    const col   = fc(c.rawValue, c.type);
    const isFav = c.type === "revenue" ? c.rawValue > 0 : c.rawValue < 0;
    const badge = c.rawValue === 0 ? "محايد" : isFav ? "✓ مُلائم" : "✗ غير مُلائم";
    return `<tr style="background:${bg};">
      <td style="padding:6px 8px;border-bottom:1px solid ${C.border};font-size:10px;font-weight:600;">${c.emoji} ${c.nameAr} · ${c.nameFr}</td>
      <td style="padding:6px 6px;border-bottom:1px solid ${C.border};font-size:9px;text-align:right;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.problemName}</td>
      <td style="padding:6px 6px;border-bottom:1px solid ${C.border};text-align:right;font-size:10px;font-family:monospace;font-weight:700;color:${col};">${fDA(c.rawValue)}</td>
      <td style="padding:6px 6px;border-bottom:1px solid ${C.border};text-align:right;font-size:10px;font-family:monospace;">${c.absPct.toFixed(1)} %</td>
      <td style="padding:6px 6px;border-bottom:1px solid ${C.border};text-align:center;font-size:9px;font-weight:700;color:${col};">${badge}</td>
    </tr>`;
  }).join("");

  const totCol = totalColor(grandTotal);
  const totRow = `<tr style="background:${C.primaryLight};">
    <td colspan="2" style="padding:6px 8px;font-size:10.5px;font-weight:800;color:${C.primary};">⚖️ الانحراف الإجمالي / TOTAL</td>
    <td style="padding:6px 6px;text-align:right;font-size:10px;font-family:monospace;font-weight:800;color:${totCol};">${fDA(grandTotal)}</td>
    <td style="padding:6px 6px;text-align:right;font-size:10px;font-family:monospace;font-weight:700;">100 %</td>
    <td style="padding:6px 6px;text-align:center;font-size:9px;font-weight:700;color:${totCol};">${grandTotal === 0 ? "محايد" : grandTotal > 0 ? "✓ مُلائم" : "✗ غير مُلائم"}</td>
  </tr>`;

  // Waterfall chart (horizontal bars)
  const running: number[] = [0];
  for (const c of components) running.push(running[running.length - 1] + c.rawValue);
  const allBreaks = [0, ...running, grandTotal];
  const chartMin  = Math.min(...allBreaks);
  const chartMax  = Math.max(...allBreaks);
  const range     = Math.max(Math.abs(chartMax - chartMin), 1);
  const CHART_W   = 440; // px in HTML space
  const toPx      = (v: number) => ((v - chartMin) / range) * CHART_W;
  const zeroX     = toPx(0);

  const waterfallBars = components.map((c, i) => {
    const from   = running[i];
    const to     = running[i + 1];
    const col    = fc(c.rawValue, c.type);
    const leftPx = toPx(Math.min(from, to));
    const widPx  = Math.max(Math.abs(to - from) / range * CHART_W, 2);
    return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px;">
      <div style="width:130px;font-size:9px;color:${C.muted};text-align:right;flex-shrink:0;">${c.emoji} ${c.nameFr}</div>
      <div style="width:${CHART_W}px;height:20px;background:#f0f0f0;border-radius:3px;position:relative;flex-shrink:0;">
        <div style="position:absolute;top:0;bottom:0;width:1px;background:${C.border};left:${zeroX.toFixed(0)}px;"></div>
        <div style="position:absolute;top:2px;bottom:2px;left:${leftPx.toFixed(0)}px;width:${widPx.toFixed(0)}px;background:${col};border-radius:2px;opacity:0.85;"></div>
      </div>
      <div style="font-size:9px;font-family:monospace;color:${col};font-weight:700;white-space:nowrap;">${fDA(c.rawValue)}</div>
    </div>`;
  }).join("");

  // Total bar
  const totLeftPx = toPx(Math.min(0, grandTotal));
  const totWidPx  = Math.max(Math.abs(grandTotal) / range * CHART_W, 2);
  const waterfallTotal = `
    <div style="display:flex;align-items:center;gap:6px;margin-top:4px;padding-top:6px;border-top:1px solid ${C.border};">
      <div style="width:130px;font-size:9px;color:${C.primary};font-weight:800;text-align:right;flex-shrink:0;">⚖️ Écart Total</div>
      <div style="width:${CHART_W}px;height:24px;background:#f0f0f0;border-radius:3px;position:relative;flex-shrink:0;">
        <div style="position:absolute;top:0;bottom:0;width:1px;background:${C.border};left:${zeroX.toFixed(0)}px;"></div>
        <div style="position:absolute;top:2px;bottom:2px;left:${totLeftPx.toFixed(0)}px;width:${totWidPx.toFixed(0)}px;background:${totCol};border-radius:2px;opacity:0.9;"></div>
      </div>
      <div style="font-size:10px;font-family:monospace;color:${totCol};font-weight:800;white-space:nowrap;">${fDA(grandTotal)}</div>
    </div>`;

  const content = `
    ${secTitle("Tableau Détaillé des Composantes", "جدول المكوّنات التفصيلي")}
    <div style="overflow:auto;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;font-size:9.5px;">
        <thead>
          <tr style="background:${C.primary};color:${C.white};">
            <th style="padding:7px 8px;text-align:left;font-size:9px;">الانحراف / Composante</th>
            <th style="padding:7px 6px;text-align:right;font-size:9px;">المصدر / Source</th>
            <th style="padding:7px 6px;text-align:right;font-size:9px;">القيمة / Valeur</th>
            <th style="padding:7px 6px;text-align:right;font-size:9px;">% المساهمة</th>
            <th style="padding:7px 6px;text-align:center;font-size:9px;">الحالة</th>
          </tr>
        </thead>
        <tbody>${tableRows}${totRow}</tbody>
      </table>
    </div>

    ${secTitle("Cascade des Écarts (Waterfall)", "تتالي الانحرافات")}
    <div style="padding:8px 0;">
      ${waterfallBars}
      ${waterfallTotal}
    </div>`;

  return pageShell(content, 2, totalPages, "النتائج · Tableau des Résultats");
}

// ── Page 3: Ratios + Analysis + Recommendations ────────────────────────────────
function buildAnalysisPage(opts: OverallVariancePDFOptions, totalPages: number): string {
  const { components, grandTotal, referenceBase } = opts;

  const analysisHtml = opts.analysisLines.map(line => `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 12px;background:${C.primaryLight};border-radius:6px;margin-bottom:7px;font-size:10px;line-height:1.65;">
      ${line.icon} ${line.text}
    </div>`).join("");

  const suggestionsHtml = opts.suggestions.map(s => `
    <div style="border-left:4px solid ${C.accent};padding:8px 12px;background:${C.white};border-radius:0 6px 6px 0;margin-bottom:8px;">
      <div style="font-size:10.5px;font-weight:700;color:${C.text};margin-bottom:3px;">${s.icon} ${s.title}</div>
      <div style="font-size:9.5px;color:${C.muted};line-height:1.65;">${s.desc}</div>
    </div>`).join("");

  // KPI grid
  const kpiCells = [
    ...components.map(c => ({ label: `${c.emoji} ${c.nameAr}`, value: fDA(c.rawValue), color: favColor(c.rawValue, c.type) })),
    { label: "⚖️ الانحراف الإجمالي", value: fDA(grandTotal), color: totalColor(grandTotal) },
    { label: "العامل المسيطر", value: opts.dominantType === "equal" ? "متوازن · Équilibrés" : opts.dominantType, color: C.primary },
  ].map(k => `
    <div style="background:${C.white};border:1px solid ${C.border};border-radius:8px;padding:10px 12px;">
      <div style="font-size:8.5px;color:${C.muted};margin-bottom:3px;">${k.label}</div>
      <div style="font-size:14px;font-weight:800;color:${k.color};">${k.value}</div>
    </div>`).join("");

  // Ratios
  let ratiosHtml = "";
  if (referenceBase > 0) {
    const ratioItems = [
      ...components.map(c => ({ label: `${c.emoji} ${c.nameAr} · ${c.nameFr}`, v: c.rawValue, type: c.type })),
      { label: "⚖️ الانحراف الإجمالي · Écart Total", v: grandTotal, type: "_total" },
    ];
    ratiosHtml = ratioItems.map(item => {
      const p    = (item.v / referenceBase) * 100;
      const ap   = Math.abs(p);
      const col  = ap < 5 ? C.green : ap < 15 ? "#e65100" : C.red;
      const bdg  = ap < 5 ? "مقبول · Acceptable" : ap < 15 ? "يستدعي انتباه · Vigilance" : "حرج · Critique";
      const bBg  = ap < 5 ? "#e8f5e9" : ap < 15 ? "#fff3e0" : C.redLight;
      const barW = Math.min(ap * 4, 100);
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:${C.white};border:1px solid ${C.border};border-radius:6px;margin-bottom:5px;">
        <div style="width:130px;font-size:8.5px;color:${C.text};font-weight:600;flex-shrink:0;">${item.label}</div>
        <div style="flex:1;height:8px;background:#f0f0f0;border-radius:4px;max-width:120px;">
          <div style="width:${barW.toFixed(0)}%;height:8px;background:${col};border-radius:4px;opacity:0.85;"></div>
        </div>
        <div style="font-size:9px;font-family:monospace;color:${col};font-weight:700;width:44px;text-align:right;">${p >= 0 ? "+" : ""}${p.toFixed(1)}%</div>
        <div style="font-size:8px;font-weight:700;color:${col};background:${bBg};padding:2px 6px;border-radius:4px;white-space:nowrap;">${bdg}</div>
      </div>`;
    }).join("");
  }

  const content = `
    ${secTitle("Synthèse des Indicateurs", "ملخص المؤشرات")}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px;">${kpiCells}</div>

    ${referenceBase > 0 ? `
    ${secTitle("مؤشرات ونسب التسيير · Ratios de Gestion", "مؤشرات ونسب التسيير")}
    <div style="margin-bottom:6px;font-size:8.5px;color:${C.muted};">القاعدة المرجعية: ${fDA(referenceBase)} · Seuils : vert &lt;5% · orange 5–15% · rouge &gt;15%</div>
    <div style="margin-bottom:12px;">${ratiosHtml}</div>
    ` : ""}

    ${secTitle("Analyse de la Situation", "تحليل الوضع")}
    <div style="margin-bottom:14px;">${analysisHtml}</div>

    ${secTitle("Recommandations Managériales", "التوصيات الإدارية")}
    <div>${suggestionsHtml}</div>`;

  return pageShell(content, 3, totalPages, "التحليل والتوصيات · Analyse & Recommandations");
}

// ── Page 4: Stamp ──────────────────────────────────────────────────────────────
function buildStampPage(reportId: string, generatedAt: string, totalPages: number): string {
  const content = `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;text-align:center;">
      <div style="width:80px;height:80px;background:${C.primary};border-radius:50%;display:flex;align-items:center;justify-content:center;">
        <div style="width:50px;height:50px;background:${C.white};border-radius:50%;display:flex;align-items:center;justify-content:center;">
          <div style="width:28px;height:28px;background:${C.primary};border-radius:50%;"></div>
        </div>
      </div>
      <div>
        <div style="font-size:22px;font-weight:800;color:${C.primary};">تقرير تركيب انحرافات النتيجة معتمد</div>
        <div style="font-size:13px;color:${C.muted};margin-top:4px;">Rapport de Synthèse des Écarts sur Résultat Certifié</div>
      </div>
      <div style="border:2px dashed ${C.border};border-radius:12px;padding:20px 40px;display:inline-block;">
        <div style="font-size:11px;color:${C.muted};margin-bottom:6px;">رقم التقرير · Numéro du rapport</div>
        <div style="font-size:18px;font-family:monospace;font-weight:700;color:${C.primary};letter-spacing:2px;">${reportId}</div>
        <div style="font-size:10px;color:${C.muted};margin-top:6px;">${generatedAt}</div>
      </div>
      <div style="font-size:11px;color:${C.muted};max-width:440px;line-height:1.7;">
        هذا التقرير صادر تلقائياً من نظام OptimDZ لتحليل الانحرافات.
        النتائج مبنية على البيانات المُدخلة وتُعدّ أداة دعم قرار للمديرين الجزائريين.
        <br/><br/>
        Ce rapport a été généré automatiquement par le système OptimDZ — Synthèse des Écarts sur Résultat.
        Il constitue un outil d'aide à la décision basé sur les données saisies.
      </div>
    </div>`;
  return pageShell(content, totalPages, totalPages, "الختم الرقمي · Cachet Numérique");
}

// ── Render helper ──────────────────────────────────────────────────────────────
async function addHtmlPage(pdf: jsPDF, html: string, pw: number): Promise<void> {
  const div = document.createElement("div");
  div.style.cssText = "position:fixed;left:-9999px;top:-9999px;z-index:-1;";
  div.innerHTML = html;
  document.body.appendChild(div);
  try {
    const canvas = await html2canvas(div.firstElementChild as HTMLElement, {
      scale: 2, useCORS: true, logging: false,
    });
    const img = canvas.toDataURL("image/jpeg", 0.92);
    const ph  = (canvas.height / canvas.width) * pw;
    pdf.addPage([pw, ph]);
    pdf.addImage(img, "JPEG", 0, 0, pw, ph);
  } finally {
    document.body.removeChild(div);
  }
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function generateOverallVariancePDF(opts: OverallVariancePDFOptions): Promise<void> {
  const prog = opts.onProgress ?? (() => {});
  const reportId    = genId();
  const generatedAt = new Date().toLocaleDateString("fr-DZ", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const PAGE_W     = 210;
  const totalPages = 4;

  prog("Génération de la couverture…", 10);
  const coverHtml    = buildCover(opts, reportId, generatedAt, totalPages);
  const resHtml      = buildResultsPage(opts, totalPages);
  const analysisHtml = buildAnalysisPage(opts, totalPages);
  const stampHtml    = buildStampPage(reportId, generatedAt, totalPages);

  prog("Rendu de la couverture…", 20);
  const coverDiv = document.createElement("div");
  coverDiv.style.cssText = "position:fixed;left:-9999px;top:-9999px;z-index:-1;";
  coverDiv.innerHTML = coverHtml;
  document.body.appendChild(coverDiv);
  const coverCanvas = await html2canvas(coverDiv.firstElementChild as HTMLElement, {
    scale: 2, useCORS: true, logging: false,
  });
  const coverImg   = coverCanvas.toDataURL("image/jpeg", 0.92);
  const coverPageH = (coverCanvas.height / coverCanvas.width) * PAGE_W;
  document.body.removeChild(coverDiv);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [PAGE_W, coverPageH] });
  pdf.addImage(coverImg, "JPEG", 0, 0, PAGE_W, coverPageH);

  prog("Rendu des résultats…", 45);
  await addHtmlPage(pdf, resHtml, PAGE_W);

  prog("Rendu de l'analyse…", 65);
  await addHtmlPage(pdf, analysisHtml, PAGE_W);

  prog("Rendu du cachet…", 85);
  await addHtmlPage(pdf, stampHtml, PAGE_W);

  prog("Téléchargement…", 95);
  const safe = (opts.problemName || "overall").replace(/\s+/g, "_").slice(0, 30);
  pdf.save(`OptimDZ_Synthèse_Résultat_${safe}_${Date.now()}.pdf`);
  prog("Terminé.", 100);
}
