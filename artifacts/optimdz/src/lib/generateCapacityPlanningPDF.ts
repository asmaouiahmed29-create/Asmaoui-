import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { CapacityResults } from "./capacityPlanningAlgorithm";

export interface CapacityPlanningPDFOptions {
  problemName: string;
  results: CapacityResults;
  language: "fr" | "ar";
  analysisLines: Array<{ fr: string; ar: string }>;
  recommendations: Array<{ icon: string; fr: string; ar: string; descFr: string; descAr: string }>;
  onProgress?: (step: string, pct: number) => void;
}

// ── Palette ───────────────────────────────────────────────────────────────────
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
  amber:        "#f59e0b",
  amberLight:   "#fef3c7",
  red:          "#c62828",
  redLight:     "#ffebee",
  blue:         "#1565c0",
  blueLight:    "#e3f2fd",
};

function genId(): string {
  return `CP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function lbl(lang: "fr" | "ar") {
  return (fr: string, ar: string) => (lang === "ar" ? ar : fr);
}

function fmtRate(r: number): string {
  if (!isFinite(r)) return "∞";
  return `${r.toFixed(1)}%`;
}

function fmtNum(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

// ── Page shell ────────────────────────────────────────────────────────────────
function pageShell(content: string, pg: number, total: number, subtitle: string, lang: "fr" | "ar"): string {
  const L = lbl(lang);
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
    <span style="font-size:9px;color:${C.muted};">OptimDZ · ${L("Planification des Capacités", "تخطيط الطاقة الإنتاجية")}</span>
    <span style="font-size:9px;color:${C.muted};">www.optimdz.replit.app</span>
  </div>
</div>`;
}

function secTitle(title: string): string {
  return `<div style="margin-bottom:12px;margin-top:20px;">
    <h2 style="font-size:15px;font-weight:800;color:${C.primary};margin:0 0 4px;">${title}</h2>
    <div style="width:40px;height:3px;background:${C.accent};border-radius:2px;"></div>
  </div>`;
}

function statusColor(status: string): { text: string; bg: string } {
  if (status === "critical")  return { text: C.red,   bg: C.redLight };
  if (status === "warning")   return { text: C.amber, bg: C.amberLight };
  if (status === "underused") return { text: C.blue,  bg: C.blueLight };
  return { text: C.green, bg: C.greenLight };
}

// ── Cover page ────────────────────────────────────────────────────────────────
function buildCover(opts: CapacityPlanningPDFOptions, reportId: string, generatedAt: string, totalPages: number): string {
  const L = lbl(opts.language);
  const { results } = opts;

  const statCards = [
    { label: L("Centres analysés", "مراكز محللة"), value: String(results.centers.length), color: C.primary, bg: C.primaryLight },
    { label: L("Goulots d'étranglement", "اختناقات"), value: String(results.bottleneckCenterCount), color: results.bottleneckCenterCount > 0 ? C.red : C.green, bg: results.bottleneckCenterCount > 0 ? C.redLight : C.greenLight },
    { label: L("Utilisation globale", "الاستخدام الإجمالي"), value: fmtRate(results.overallUtilization), color: results.overallUtilization > 85 ? C.amber : C.green, bg: results.overallUtilization > 85 ? C.amberLight : C.greenLight },
    { label: L("Périodes analysées", "فترات محللة"), value: String(results.periodLabels.length), color: C.blue, bg: C.blueLight },
  ];

  const overallStatusLabel = {
    critical: L("CRITIQUE — Goulots détectés", "حرج — اختناقات مكتشفة"),
    warning:  L("ATTENTION — Capacités tendues", "تحذير — طاقات متوترة"),
    good:     L("SAIN — Capacités équilibrées", "صحي — طاقات متوازنة"),
  }[results.overallStatus];

  const overallStatusColor = { critical: C.red, warning: C.amber, good: C.green }[results.overallStatus];

  const content = `
    <div style="background:${C.primary};border-radius:12px;padding:36px 40px;margin-bottom:28px;position:relative;overflow:hidden;">
      <div style="position:relative;z-index:1;">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.65);text-transform:uppercase;margin-bottom:10px;">
          ${L("RAPPORT DE CAPACITÉ — GESTION INDUSTRIELLE", "تقرير الطاقة الإنتاجية — التسيير الصناعي")}
        </div>
        <h1 style="font-size:26px;font-weight:900;color:${C.white};margin:0 0 8px;line-height:1.2;">
          ${opts.problemName || L("Planification des Capacités", "تخطيط الطاقة الإنتاجية")}
        </h1>
        <div style="display:inline-block;margin-top:12px;background:${overallStatusColor};color:${C.white};font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;">
          ${overallStatusLabel}
        </div>
        <div style="margin-top:16px;display:flex;gap:16px;flex-wrap:wrap;">
          <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 16px;">
            <div style="font-size:9px;color:rgba(255,255,255,0.65);">${L("Rapport ID", "معرّف التقرير")}</div>
            <div style="font-size:12px;font-weight:700;color:${C.white};font-family:monospace;">${reportId}</div>
          </div>
          <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 16px;">
            <div style="font-size:9px;color:rgba(255,255,255,0.65);">${L("Généré le", "تاريخ الإنشاء")}</div>
            <div style="font-size:12px;font-weight:700;color:${C.white};">${generatedAt}</div>
          </div>
          <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 16px;">
            <div style="font-size:9px;color:rgba(255,255,255,0.65);">${L("Horizon", "الأفق")}</div>
            <div style="font-size:12px;font-weight:700;color:${C.white};">${results.periodLabels[0]} → ${results.periodLabels[results.periodLabels.length - 1]}</div>
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
      ${statCards.map(s => `
        <div style="background:${s.bg};border:1px solid ${s.color}30;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:22px;font-weight:900;color:${s.color};">${s.value}</div>
          <div style="font-size:9px;color:${C.muted};margin-top:3px;line-height:1.3;">${s.label}</div>
        </div>`).join("")}
    </div>

    ${secTitle(L("Vue d'ensemble des Centres", "نظرة عامة على المراكز"))}
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${results.centers.map(c => {
        const sc = statusColor(c.status);
        const statusLabelMap: Record<string, string> = {
          critical:  opts.language === "ar" ? "حرج" : "CRITIQUE",
          warning:   opts.language === "ar" ? "تحذير" : "ATTENTION",
          underused: opts.language === "ar" ? "طاقة فائضة" : "SOUS-UTILISÉ",
          good:      opts.language === "ar" ? "سليم" : "SAIN",
        };
        return `
        <div style="display:flex;align-items:center;justify-content:space-between;background:${C.primaryLight};border:1px solid ${C.border};border-radius:8px;padding:8px 14px;">
          <span style="font-size:11px;font-weight:700;">${c.name}</span>
          <div style="display:flex;gap:10px;align-items:center;">
            <span style="font-size:10px;color:${C.muted};">${L("Utilisation moy.", "متوسط الاستخدام")}: <strong>${fmtRate(c.avgUtilizationRate)}</strong></span>
            <span style="font-size:10px;color:${C.muted};">${L("Pic", "الذروة")}: <strong>${fmtRate(c.maxUtilizationRate)}</strong></span>
            <span style="background:${sc.bg};color:${sc.text};font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;">${statusLabelMap[c.status]}</span>
          </div>
        </div>`;
      }).join("")}
    </div>`;

  return pageShell(content, 1, totalPages, L("Vue d'ensemble", "نظرة عامة"), opts.language);
}

// ── Detail tables page ────────────────────────────────────────────────────────
function buildTablesPage(opts: CapacityPlanningPDFOptions, totalPages: number): string {
  const L = lbl(opts.language);
  const { results } = opts;
  const periods = results.periodLabels;
  const colW = Math.min(55, Math.floor(460 / Math.max(periods.length, 1)));

  function buildCenterTable(c: typeof results.centers[0]): string {
    const sc = statusColor(c.status);
    const statusLabelMap: Record<string, string> = {
      critical:  opts.language === "ar" ? "حرج" : "CRITIQUE",
      warning:   opts.language === "ar" ? "تحذير" : "ATTENTION",
      underused: opts.language === "ar" ? "طاقة فائضة" : "SOUS-UTILISÉ",
      good:      opts.language === "ar" ? "سليم" : "SAIN",
    };

    type RowKey = "capacity" | "load" | "utilizationRate" | "capacityGap";
    const rows: Array<{ key: RowKey; label: string }> = [
      { key: "capacity",        label: L("Capacité disponible", "الطاقة المتاحة") },
      { key: "load",            label: L("Charge demandée", "الحمل المطلوب") },
      { key: "utilizationRate", label: L("Taux de charge (%)", "معدل التحميل (%)") },
      { key: "capacityGap",     label: L("Écart de capacité", "فجوة الطاقة") },
    ];

    return `
      <div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:800;">${c.name}</span>
          <span style="background:${sc.bg};color:${sc.text};font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;">${statusLabelMap[c.status]}</span>
          <span style="font-size:10px;color:${C.muted};">${L("Utilisation moy.", "متوسط")}: ${fmtRate(c.avgUtilizationRate)}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:9px;">
          <thead>
            <tr>
              <th style="background:${C.primary};color:${C.white};padding:5px 8px;text-align:left;border-radius:4px 0 0 0;min-width:130px;">${L("Indicateur", "المؤشر")}</th>
              ${periods.map((p, i) => `<th style="background:${C.primary};color:${C.white};padding:5px 4px;text-align:center;width:${colW}px;${i === periods.length - 1 ? "border-radius:0 4px 0 0;" : ""}">${p}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, ri) => `
              <tr style="background:${ri % 2 === 0 ? "#f8faf9" : C.white};">
                <td style="padding:4px 8px;font-weight:600;color:${C.muted};border:1px solid ${C.border};">${row.label}</td>
                ${c.periods.map(p => {
                  const val = p[row.key] as number;
                  let bg = "transparent";
                  let fw = "400";
                  let display = "";

                  if (row.key === "utilizationRate") {
                    display = fmtRate(val);
                    if (p.isBottleneck) { bg = C.redLight; fw = "800"; }
                    else if (val > 85)  { bg = C.amberLight; fw = "700"; }
                    else                { fw = "600"; }
                  } else if (row.key === "capacityGap") {
                    display = fmtNum(val);
                    if (val < 0)  { bg = C.redLight; fw = "700"; }
                    else if (val === 0) { bg = C.amberLight; fw = "600"; }
                    else          { bg = C.greenLight; fw = "600"; }
                  } else {
                    display = fmtNum(val);
                    if (val === 0) fw = "400";
                    else fw = "600";
                  }

                  return `<td style="padding:4px;text-align:center;border:1px solid ${C.border};background:${bg};font-weight:${fw};">${val === 0 && row.key !== "capacityGap" ? "—" : display}</td>`;
                }).join("")}
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  const content = `
    ${secTitle(L("Tableaux de Charge par Centre", "جداول التحميل لكل مركز"))}
    ${results.centers.map(buildCenterTable).join("")}`;

  return pageShell(content, 2, totalPages, L("Tableaux de charge", "جداول التحميل"), opts.language);
}

// ── Analysis + Recommendations page ──────────────────────────────────────────
function buildAnalysisPage(opts: CapacityPlanningPDFOptions, totalPages: number): string {
  const L = lbl(opts.language);

  const analysisHtml = opts.analysisLines.map(line => `
    <div style="background:${C.primaryLight};border:1px solid ${C.border};border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:10px;line-height:1.6;">
      ${opts.language === "ar" ? line.ar : line.fr}
    </div>`).join("");

  const recoHtml = opts.recommendations.map((r, i) => `
    <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 16px;margin-bottom:10px;border-left:4px solid ${[C.green, C.accent, C.primary, C.amber][i % 4]};">
      <div style="font-size:11px;font-weight:700;margin-bottom:4px;">${r.icon} ${opts.language === "ar" ? r.ar : r.fr}</div>
      <div style="font-size:9.5px;color:${C.muted};line-height:1.6;">${opts.language === "ar" ? r.descAr : r.descFr}</div>
    </div>`).join("");

  const content = `
    ${secTitle(L("Analyse de la Situation", "تحليل الوضع"))}
    ${analysisHtml}
    ${secTitle(L("Recommandations Managériales", "التوصيات الإدارية"))}
    ${recoHtml}`;

  return pageShell(content, 3, totalPages, L("Analyse & Recommandations", "التحليل والتوصيات"), opts.language);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateCapacityPlanningPDF(opts: CapacityPlanningPDFOptions): Promise<void> {
  const reportId = genId();
  const generatedAt = new Date().toLocaleDateString("fr-DZ");
  const totalPages = 3;

  const pages = [
    buildCover(opts, reportId, generatedAt, totalPages),
    buildTablesPage(opts, totalPages),
    buildAnalysisPage(opts, totalPages),
  ];

  opts.onProgress?.("Préparation des pages…", 5);

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;z-index:-1;";
  document.body.appendChild(container);

  const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4", hotfixes: ["px_scaling"] });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  try {
    for (let i = 0; i < pages.length; i++) {
      opts.onProgress?.(`Page ${i + 1} / ${totalPages}…`, 10 + (i / totalPages) * 70);
      container.innerHTML = pages[i];
      const el = container.firstElementChild as HTMLElement;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fbf8f1",
        width: 794,
        windowWidth: 794,
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pdfW, pdfH);
    }
    opts.onProgress?.("Téléchargement…", 95);
    const safeName = (opts.problemName || "capacite").replace(/[^a-z0-9\u0600-\u06FF]/gi, "-").slice(0, 40);
    pdf.save(`optimdz-capacite-${safeName}-${reportId}.pdf`);
    opts.onProgress?.("Terminé", 100);
  } finally {
    document.body.removeChild(container);
  }
}
