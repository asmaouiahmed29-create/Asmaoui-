import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { MaintenanceResults, AnalysisLine, RecommendationItem } from "./maintenanceAlgorithm";

export interface MaintenancePDFOptions {
  problemName: string;
  results: MaintenanceResults;
  language: "fr" | "ar";
  analysisLines: AnalysisLine[];
  recommendations: RecommendationItem[];
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
};

function genId(): string {
  return `MNT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function lbl(lang: "fr" | "ar") {
  return (fr: string, ar: string) => (lang === "ar" ? ar : fr);
}

function fmt1(n: number): string { return n.toFixed(1); }
function fmt2(n: number): string { return n.toFixed(2); }

function statusColor(status: string): { bg: string; text: string; label: string; labelAr: string } {
  if (status === "ok")       return { bg: C.greenLight, text: C.green, label: "Bon",     labelAr: "جيد" };
  if (status === "warning")  return { bg: C.amberLight, text: C.amber, label: "Alerte",  labelAr: "تحذير" };
  if (status === "critical") return { bg: C.redLight,   text: C.red,   label: "Critique",labelAr: "حرج" };
  return                            { bg: "#f5f5f5",    text: C.muted, label: "—",       labelAr: "—" };
}

// ── Shared page shell ─────────────────────────────────────────────────────────
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
    <span style="font-size:9px;color:${C.muted};">OptimDZ · ${L("Maintenance des Équipements", "صيانة المعدات")}</span>
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

// ── Cover page ────────────────────────────────────────────────────────────────
function buildCover(opts: MaintenancePDFOptions, reportId: string, generatedAt: string, totalPages: number): string {
  const L = lbl(opts.language);
  const { results } = opts;

  const fd = results.fleetDisponibilite;
  const fdColor = fd === null ? C.muted : fd >= 90 ? C.green : fd >= 80 ? C.amber : C.red;

  const statCards = [
    {
      label: L("Équipements analysés", "معدات محللة"),
      value: String(results.equipments.filter(e => e.status !== "error").length),
      color: C.primary, bg: C.primaryLight,
    },
    {
      label: L("Disponibilité moyenne", "متوسط التوافرية"),
      value: fd !== null ? `${fmt2(fd)}%` : "—",
      color: fdColor, bg: fd === null ? "#f5f5f5" : fd >= 90 ? C.greenLight : fd >= 80 ? C.amberLight : C.redLight,
    },
    {
      label: L("En situation critique", "في وضع حرج"),
      value: String(results.criticalCount),
      color: results.criticalCount > 0 ? C.red : C.green,
      bg:    results.criticalCount > 0 ? C.redLight : C.greenLight,
    },
    {
      label: L("MTTR moyen (h)", "متوسط MTTR (س)"),
      value: results.fleetMttr !== null ? fmt1(results.fleetMttr) : "—",
      color: C.blue, bg: "#e3f2fd",
    },
  ];

  // Results table rows
  const rows = results.equipments.map((eq, i) => {
    const sc = statusColor(eq.status);
    const errorMsg = eq.errorKey === "zero_pannes"
      ? L("Nombre de pannes = 0", "عدد الأعطال = 0")
      : eq.errorKey === "negative_values"
        ? L("Valeur négative", "قيمة سالبة")
        : L("Données manquantes", "بيانات ناقصة");

    return `<tr style="background:${i % 2 === 0 ? "#f8faf9" : C.white};">
      <td style="padding:5px 8px;font-weight:700;border:1px solid ${C.border};">${eq.name}</td>
      <td style="padding:5px 8px;text-align:center;border:1px solid ${C.border};">${eq.pannes > 0 ? String(eq.pannes) : eq.status === "error" ? "—" : String(eq.pannes)}</td>
      <td style="padding:5px 8px;text-align:center;border:1px solid ${C.border};font-weight:700;color:${C.primary};">
        ${eq.mtbf !== null ? fmt1(eq.mtbf) : "<span style='color:" + C.muted + ";font-size:9px;'>" + errorMsg + "</span>"}
      </td>
      <td style="padding:5px 8px;text-align:center;border:1px solid ${C.border};font-weight:700;color:${C.blue};">
        ${eq.mttr !== null ? fmt1(eq.mttr) : "<span style='color:" + C.muted + ";font-size:9px;'>—</span>"}
      </td>
      <td style="padding:5px 8px;text-align:center;border:1px solid ${C.border};font-weight:700;color:${eq.disponibilite !== null ? sc.text : C.muted};">
        ${eq.disponibilite !== null ? fmt2(eq.disponibilite) + "%" : "—"}
      </td>
      <td style="padding:5px 8px;text-align:center;border:1px solid ${C.border};">
        <span style="background:${sc.bg};color:${sc.text};font-size:8px;font-weight:700;padding:2px 8px;border-radius:10px;">
          ${opts.language === "ar" ? sc.labelAr : sc.label}
        </span>
      </td>
    </tr>`;
  }).join("");

  const content = `
    <div style="background:${C.primary};border-radius:12px;padding:32px 40px;margin-bottom:22px;position:relative;overflow:hidden;">
      <div style="position:relative;z-index:1;">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.65);text-transform:uppercase;margin-bottom:8px;">
          ${L("RAPPORT MAINTENANCE — GESTION INDUSTRIELLE", "تقرير الصيانة — التسيير الصناعي")}
        </div>
        <h1 style="font-size:24px;font-weight:900;color:${C.white};margin:0 0 6px;line-height:1.2;">
          ${opts.problemName || L("Maintenance des Équipements", "صيانة المعدات")}
        </h1>
        <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-bottom:10px;">
          ${L("MTBF · MTTR · Taux de disponibilité par équipement", "MTBF · MTTR · معدل التوافرية لكل معدة")}
        </div>
        <div style="margin-top:14px;display:flex;gap:12px;flex-wrap:wrap;">
          <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:7px 14px;">
            <div style="font-size:9px;color:rgba(255,255,255,0.65);">${L("Rapport ID", "معرّف التقرير")}</div>
            <div style="font-size:12px;font-weight:700;color:${C.white};font-family:monospace;">${reportId}</div>
          </div>
          <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:7px 14px;">
            <div style="font-size:9px;color:rgba(255,255,255,0.65);">${L("Généré le", "تاريخ الإنشاء")}</div>
            <div style="font-size:12px;font-weight:700;color:${C.white};">${generatedAt}</div>
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">
      ${statCards.map(s => `
        <div style="background:${s.bg};border:1px solid ${s.color}30;border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:20px;font-weight:900;color:${s.color};">${s.value}</div>
          <div style="font-size:9px;color:${C.muted};margin-top:3px;line-height:1.3;">${s.label}</div>
        </div>`).join("")}
    </div>

    ${secTitle(L("Tableau des Résultats", "جدول النتائج"))}
    <table style="width:100%;border-collapse:collapse;font-size:9px;">
      <thead>
        <tr>
          <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:left;border-radius:4px 0 0 0;">${L("Équipement", "المعدة")}</th>
          <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;">${L("Pannes", "أعطال")}</th>
          <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;">MTBF (h)</th>
          <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;">MTTR (h)</th>
          <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;">${L("Disponibilité", "التوافرية")}</th>
          <th style="background:${C.primary};color:${C.white};padding:6px 8px;text-align:center;border-radius:0 4px 0 0;">${L("Statut", "الحالة")}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  return pageShell(content, 1, totalPages, L("Vue d'ensemble", "نظرة عامة"), opts.language);
}

// ── Analysis + Recommendations page ──────────────────────────────────────────
function buildAnalysisPage(opts: MaintenancePDFOptions, totalPages: number): string {
  const L = lbl(opts.language);
  const colors = [C.green, C.accent, C.primary, C.amber, C.red, C.blue];

  const analysisHtml = opts.analysisLines.map(line => `
    <div style="background:${C.primaryLight};border:1px solid ${C.border};border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:10px;line-height:1.6;">
      ${opts.language === "ar" ? line.ar : line.fr}
    </div>`).join("");

  const recoHtml = opts.recommendations.map((r, i) => `
    <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 16px;margin-bottom:10px;border-left:4px solid ${colors[i % colors.length]};">
      <div style="font-size:11px;font-weight:700;margin-bottom:4px;">${r.icon} ${opts.language === "ar" ? r.ar : r.fr}</div>
      <div style="font-size:9.5px;color:${C.muted};line-height:1.6;">${opts.language === "ar" ? r.descAr : r.descFr}</div>
    </div>`).join("");

  const content = `
    ${secTitle(L("Analyse de la Situation", "تحليل الوضع"))}
    ${analysisHtml}
    ${secTitle(L("Recommandations Managériales", "التوصيات الإدارية"))}
    ${recoHtml}`;

  return pageShell(content, 2, totalPages, L("Analyse & Recommandations", "التحليل والتوصيات"), opts.language);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateMaintenancePDF(opts: MaintenancePDFOptions): Promise<void> {
  const reportId    = genId();
  const generatedAt = new Date().toLocaleDateString("fr-DZ");
  const totalPages  = 2;

  const pages = [
    buildCover(opts, reportId, generatedAt, totalPages),
    buildAnalysisPage(opts, totalPages),
  ];

  opts.onProgress?.("Préparation des pages…", 5);

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;z-index:-1;";
  document.body.appendChild(container);

  const pdf  = new jsPDF({ orientation: "portrait", unit: "px", format: "a4", hotfixes: ["px_scaling"] });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  try {
    for (let i = 0; i < pages.length; i++) {
      opts.onProgress?.(`Page ${i + 1} / ${totalPages}…`, 10 + (i / totalPages) * 75);
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
    const safeName = (opts.problemName || "maintenance").replace(/[^a-z0-9\u0600-\u06FF]/gi, "-").slice(0, 40);
    pdf.save(`optimdz-maintenance-${safeName}-${reportId}.pdf`);
    opts.onProgress?.("Terminé", 100);
  } finally {
    document.body.removeChild(container);
  }
}
