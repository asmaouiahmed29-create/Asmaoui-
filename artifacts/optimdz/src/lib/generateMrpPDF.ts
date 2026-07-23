import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { MrpResults, MrpItemResult } from "./mrpAlgorithm";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MrpPDFOptions {
  problemName: string;
  periodType: string; // "semaines" | "mois" — raw value, translated in caller
  results: MrpResults;
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
  return `MRP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// ── Language helper ───────────────────────────────────────────────────────────
function makeLbl(lang: "fr" | "ar") {
  return (fr: string, ar: string) => (lang === "ar" ? ar : fr);
}

// ── Page shell ────────────────────────────────────────────────────────────────
function pageShell(content: string, pg: number, total: number, subtitle: string, lang: "fr" | "ar"): string {
  const lbl = makeLbl(lang);
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
    <span style="font-size:9px;color:${C.muted};">OptimDZ · ${lbl("Planification de la Production — MRP", "تخطيط الإنتاج — MRP")}</span>
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
function buildCover(opts: MrpPDFOptions, reportId: string, generatedAt: string, totalPages: number): string {
  const lbl = makeLbl(opts.language);
  const { results } = opts;

  const statCards = [
    {
      label: lbl("Articles planifiés", "أصناف مخططة"),
      value: String(results.items.length),
      color: C.primary,
      bg: C.primaryLight,
    },
    {
      label: lbl("Ordres planifiés (unités)", "أوامر مخططة (وحدات)"),
      value: String(results.totalOrdersPlanned),
      color: results.totalOrdersPlanned > 0 ? C.amber : C.green,
      bg: results.totalOrdersPlanned > 0 ? C.amberLight : C.greenLight,
    },
    {
      label: lbl("Alertes urgentes", "تنبيهات عاجلة"),
      value: String(results.urgentItemCount),
      color: results.urgentItemCount > 0 ? C.red : C.green,
      bg: results.urgentItemCount > 0 ? C.redLight : C.greenLight,
    },
    {
      label: lbl("Périodes analysées", "فترات محللة"),
      value: String(results.periodLabels.length),
      color: C.blue,
      bg: C.blueLight,
    },
  ];

  const content = `
    <!-- Hero -->
    <div style="background:${C.primary};border-radius:12px;padding:36px 40px;margin-bottom:28px;position:relative;overflow:hidden;">
      <div style="position:relative;z-index:1;">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.65);text-transform:uppercase;margin-bottom:10px;">
          ${lbl("RAPPORT MRP — GESTION INDUSTRIELLE", "تقرير MRP — التسيير الصناعي")}
        </div>
        <h1 style="font-size:26px;font-weight:900;color:${C.white};margin:0 0 8px;line-height:1.2;">
          ${opts.problemName || lbl("Planification de la Production", "تخطيط الإنتاج")}
        </h1>
        <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-top:1px;">${lbl("Système de Planification des Ressources de Production", "نظام تخطيط موارد الإنتاج")}</div>
        <div style="margin-top:20px;display:flex;gap:16px;flex-wrap:wrap;">
          <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 16px;">
            <div style="font-size:9px;color:rgba(255,255,255,0.65);">${lbl("Rapport ID", "معرّف التقرير")}</div>
            <div style="font-size:12px;font-weight:700;color:${C.white};font-family:monospace;">${reportId}</div>
          </div>
          <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 16px;">
            <div style="font-size:9px;color:rgba(255,255,255,0.65);">${lbl("Généré le", "تاريخ الإنشاء")}</div>
            <div style="font-size:12px;font-weight:700;color:${C.white};">${generatedAt}</div>
          </div>
          <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 16px;">
            <div style="font-size:9px;color:rgba(255,255,255,0.65);">${lbl("Horizon", "أفق التخطيط")}</div>
            <div style="font-size:12px;font-weight:700;color:${C.white};">${results.periodLabels[0]} → ${results.periodLabels[results.periodLabels.length - 1]}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- KPI row -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
      ${statCards.map(s => `
        <div style="background:${s.bg};border:1px solid ${s.color}30;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:22px;font-weight:900;color:${s.color};">${s.value}</div>
          <div style="font-size:9px;color:${C.muted};margin-top:3px;line-height:1.3;">${s.label}</div>
        </div>`).join("")}
    </div>

    <!-- Items list preview -->
    ${secTitle(lbl("Articles planifiés", "الأصناف المخططة"))}
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${results.items.map(item => `
        <div style="display:flex;align-items:center;justify-content:space-between;background:${C.primaryLight};border:1px solid ${C.border};border-radius:8px;padding:8px 14px;">
          <div>
            <span style="font-size:9px;color:${C.muted};font-weight:600;margin-right:6px;">${item.isComponent ? lbl("COMPOSANT", "مكوّن") : lbl("PRODUIT FINI", "منتج نهائي")}</span>
            <span style="font-size:11px;font-weight:700;">${item.name}</span>
            ${item.parentName ? `<span style="font-size:9px;color:${C.muted};"> → ${item.parentName}</span>` : ""}
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            ${item.lateOrders > 0 ? `<span style="background:${C.redLight};color:${C.red};font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;">${lbl("URGENT", "عاجل")}</span>` : ""}
            <span style="font-size:10px;font-weight:700;color:${item.totalOrders > 0 ? C.primary : C.muted};">${item.totalOrders} ${lbl("u.", "وحدة")}</span>
          </div>
        </div>`).join("")}
    </div>`;

  return pageShell(content, 1, totalPages, lbl("Vue d'ensemble", "نظرة عامة"), opts.language);
}

// ── MRP Tables page ───────────────────────────────────────────────────────────
function buildTablesPage(opts: MrpPDFOptions, totalPages: number): string {
  const lbl = makeLbl(opts.language);
  const { results } = opts;
  const periods = results.periodLabels;

  function rowLabel(key: string): string {
    return {
      besoinsBruts: lbl("Besoins Bruts", "الاحتياجات الإجمالية"),
      stockDisponible: lbl("Stock Disponible", "المخزون المتاح"),
      besoinsNets: lbl("Besoins Nets", "الاحتياجات الصافية"),
      ordreReception: lbl("Ordres Réception", "أوامر الاستلام"),
      ordreLancement: lbl("Ordres Lancement", "أوامر الإطلاق"),
    }[key] || key;
  }

  function rowBg(key: string, val: number): string {
    if (key === "besoinsNets" && val > 0) return C.amberLight;
    if (key === "stockDisponible" && val === 0) return C.redLight;
    if (key === "ordreReception" && val > 0) return C.blueLight;
    if (key === "ordreLancement" && val > 0) return C.primaryLight;
    return C.white;
  }

  function buildItemTable(item: MrpItemResult): string {
    const keys: (keyof MrpItemResult["rows"][0])[] = [
      "besoinsBruts", "stockDisponible", "besoinsNets", "ordreReception", "ordreLancement"
    ];
    const colW = Math.min(60, Math.floor(480 / Math.max(periods.length, 1)));

    return `
      <div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:9px;font-weight:700;background:${item.isComponent ? C.amberLight : C.primaryLight};color:${item.isComponent ? C.amber : C.primary};padding:2px 8px;border-radius:20px;">
            ${item.isComponent ? lbl("COMPOSANT", "مكوّن") : lbl("PRODUIT FINI", "منتج نهائي")}
          </span>
          <span style="font-size:12px;font-weight:800;">${item.name}</span>
          ${item.parentName ? `<span style="font-size:9px;color:${C.muted};">(← ${item.parentName})</span>` : ""}
          ${item.lateOrders > 0 ? `<span style="background:${C.redLight};color:${C.red};font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;">${lbl("URGENT", "عاجل")}</span>` : ""}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:9px;">
          <thead>
            <tr>
              <th style="background:${C.primary};color:${C.white};padding:5px 8px;text-align:left;border-radius:4px 0 0 0;font-weight:700;min-width:120px;">${lbl("Indicateur", "المؤشر")}</th>
              ${periods.map((p, i) => `<th style="background:${C.primary};color:${C.white};padding:5px 4px;text-align:center;width:${colW}px;${i === periods.length - 1 ? "border-radius:0 4px 0 0;" : ""}">${p}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${keys.map((key, ki) => `
              <tr style="background:${ki % 2 === 0 ? "#f8faf9" : C.white};">
                <td style="padding:4px 8px;font-weight:600;color:${C.muted};border:1px solid ${C.border};">${rowLabel(key)}</td>
                ${item.rows.map(r => {
                  const val = r[key] as number;
                  const bg = rowBg(key, val);
                  return `<td style="padding:4px;text-align:center;border:1px solid ${C.border};background:${bg};font-weight:${val > 0 ? "700" : "400"};">${val > 0 ? val : "—"}</td>`;
                }).join("")}
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  const content = `
    ${secTitle(lbl("Tableaux MRP par Article", "جداول MRP لكل صنف"))}
    ${results.items.map(buildItemTable).join("")}`;

  return pageShell(content, 2, totalPages, lbl("Tableaux MRP", "جداول MRP"), opts.language);
}

// ── Analysis + Recommendations page ──────────────────────────────────────────
function buildAnalysisPage(opts: MrpPDFOptions, totalPages: number): string {
  const lbl = makeLbl(opts.language);

  const analysisHtml = opts.analysisLines.map(line => `
    <div style="background:${C.primaryLight};border:1px solid ${C.border};border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:10px;line-height:1.6;">
      ${opts.language === "ar" ? line.ar : line.fr}
    </div>`).join("");

  const recoHtml = opts.recommendations.map((r, i) => `
    <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 16px;margin-bottom:10px;border-left:4px solid ${[C.green, C.accent, C.primary, C.amber][i % 4]};">
      <div style="font-size:11px;font-weight:700;margin-bottom:4px;">${r.icon} ${opts.language === "ar" ? r.ar : r.fr}</div>
      <div style="font-size:9.5px;color:${C.muted};line-height:1.6;">${opts.language === "ar" ? r.descAr : r.descFr}</div>
    </div>`).join("");

  const alertHtml = opts.results.alerts.length > 0 ? `
    ${secTitle(lbl("⚠ Alertes Urgentes", "⚠ التنبيهات العاجلة"))}
    ${opts.results.alerts.map(a => `
      <div style="background:${C.redLight};border:1px solid ${C.red}40;border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:10px;line-height:1.6;color:${C.red};">
        ${opts.language === "ar" ? a.msgAr : a.msgFr}
      </div>`).join("")}
  ` : "";

  const content = `
    ${alertHtml}
    ${secTitle(lbl("Analyse de la Situation", "تحليل الوضع"))}
    ${analysisHtml}
    ${secTitle(lbl("Recommandations Managériales", "التوصيات الإدارية"))}
    ${recoHtml}`;

  return pageShell(content, 3, totalPages, lbl("Analyse & Recommandations", "التحليل والتوصيات"), opts.language);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateMrpPDF(opts: MrpPDFOptions): Promise<void> {
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
    const safeName = (opts.problemName || "mrp-plan").replace(/[^a-z0-9\u0600-\u06FF]/gi, "-").slice(0, 40);
    pdf.save(`optimdz-mrp-${safeName}-${reportId}.pdf`);
    opts.onProgress?.("Terminé", 100);
  } finally {
    document.body.removeChild(container);
  }
}
