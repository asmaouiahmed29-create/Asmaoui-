import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { ScKpiResults, KpiStatus } from "./supplyChainKpiAlgorithm";
import { fPct, fRot, fDA } from "./supplyChainKpiAlgorithm";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ScKpiPDFOptions {
  results: ScKpiResults;
  language: "fr" | "ar";
  analysisLines: string[];
  recommendations: { icon: string; title: string; desc: string }[];
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
};

function genId() {
  return `SCKPI-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// ── Language helper ───────────────────────────────────────────────────────────
function makeLbl(lang: "fr" | "ar") {
  return (fr: string, ar: string) => (lang === "ar" ? ar : fr);
}

// ── Status colour ─────────────────────────────────────────────────────────────
function statusColor(s: KpiStatus) {
  return { good: C.green, medium: C.amber, bad: C.red }[s];
}
function statusBg(s: KpiStatus) {
  return { good: C.greenLight, medium: C.amberLight, bad: C.redLight }[s];
}

// ── Page shell ────────────────────────────────────────────────────────────────
function pageShell(content: string, pg: number, total: number, subtitle: string, lang: "fr" | "ar") {
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
    <span style="font-size:9px;color:${C.muted};">OptimDZ · ${lbl("Indicateurs de Performance — Chaîne d'Approvisionnement", "مؤشرات الأداء — سلاسل الإمداد")}</span>
    <span style="font-size:9px;color:${C.muted};">www.optimdz.replit.app</span>
  </div>
</div>`;
}

function secTitle(title: string) {
  return `<div style="margin-bottom:12px;margin-top:20px;">
    <h2 style="font-size:15px;font-weight:800;color:${C.primary};margin:0 0 4px;">${title}</h2>
    <div style="width:40px;height:3px;background:${C.accent};border-radius:2px;"></div>
  </div>`;
}

// ── Cover page ────────────────────────────────────────────────────────────────
function buildCover(opts: ScKpiPDFOptions, reportId: string, generatedAt: string, totalPages: number) {
  const lbl = makeLbl(opts.language);
  const { results } = opts;

  const kpiCards: { label: string; value: string; color: string; bg: string }[] = [];
  if (results.tauxRotation) {
    kpiCards.push({
      label: lbl("Taux de Rotation", "معدل دوران المخزون"),
      value: fRot(results.tauxRotation.value),
      color: statusColor(results.tauxRotation.status),
      bg: statusBg(results.tauxRotation.status),
    });
  }
  if (results.tauxService) {
    kpiCards.push({
      label: lbl("Taux de Service", "نسبة الخدمة"),
      value: fPct(results.tauxService.value),
      color: statusColor(results.tauxService.status),
      bg: statusBg(results.tauxService.status),
    });
  }
  if (results.coutTotal) {
    kpiCards.push({
      label: lbl("Coût d'Approvisionnement", "تكلفة الإمداد الإجمالية"),
      value: fDA(results.coutTotal.value),
      color: C.primary,
      bg: C.primaryLight,
    });
  }
  if (results.tauxRupture) {
    kpiCards.push({
      label: lbl("Taux de Rupture", "نسبة النقص"),
      value: fPct(results.tauxRupture.value),
      color: statusColor(results.tauxRupture.status),
      bg: statusBg(results.tauxRupture.status),
    });
  }

  const periodLabel = {
    mois:      lbl("Mensuel", "شهري"),
    trimestre: lbl("Trimestriel", "ربع سنوي"),
    annee:     lbl("Annuel", "سنوي"),
  }[results.period];

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
      <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-top:1px;">${lbl("Système d'aide à la décision — Entreprise algérienne", "نظام دعم القرار للمؤسسة الجزائرية")}</div>
    </div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 40px;text-align:center;gap:14px;">
    <div style="font-size:11px;letter-spacing:3px;color:${C.accent};text-transform:uppercase;font-weight:600;">${lbl("Rapport Officiel", "تقرير رسمي")}</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.6);">${lbl("Gestion de la Chaîne d'Approvisionnement", "إدارة سلاسل الإمداد")}</div>
    <div style="font-size:24px;font-weight:800;line-height:1.3;">${lbl("Indicateurs de Performance", "مؤشرات الأداء")}</div>
    <div style="font-size:14px;color:rgba(255,255,255,0.75);">${lbl("Supply Chain KPI Dashboard", "لوحة مؤشرات سلسلة الإمداد")}</div>
    <div style="width:60px;height:3px;background:${C.accent};border-radius:2px;margin:4px 0;"></div>
    <div style="font-size:22px;font-weight:700;color:${C.accent};">${results.problemName}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:580px;margin-top:8px;">
      ${kpiCards.map(k => `
        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:12px 16px;text-align:left;">
          <div style="font-size:9px;color:rgba(255,255,255,0.55);margin-bottom:4px;">${k.label}</div>
          <div style="font-size:20px;font-weight:800;color:${C.accent};">${k.value}</div>
        </div>`).join("")}
    </div>
  </div>
  <div style="padding:0 40px 28px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
    ${[
      [lbl("Problème", "المسألة"),          results.problemName],
      [lbl("Période", "فترة التحليل"),       periodLabel],
      [lbl("KPI Analysés", "المؤشرات المحللة"), String(results.activeCount)],
      [lbl("N° Rapport", "رقم التقرير"),     reportId],
      [lbl("Date d'édition", "تاريخ الإصدار"), generatedAt],
      [lbl("Pages", "عدد الصفحات"),          String(totalPages)],
    ].map(([l, v]) => `
      <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:11px 14px;">
        <div style="font-size:9px;color:rgba(255,255,255,0.55);margin-bottom:4px;">${l}</div>
        <div style="font-size:11.5px;font-weight:700;">${v}</div>
      </div>`).join("")}
  </div>
  <div style="height:6px;background:rgba(255,255,255,0.15);"></div>
</div>`;
}

// ── Results page ──────────────────────────────────────────────────────────────
function buildResultsPage(opts: ScKpiPDFOptions, totalPages: number) {
  const lbl = makeLbl(opts.language);
  const { results } = opts;
  const rows: { label: string; value: string; bench: string; status: KpiStatus | null; color: string; bg: string }[] = [];

  if (results.tauxRotation) {
    rows.push({
      label: lbl("Taux de Rotation des Stocks", "معدل دوران المخزون"),
      value: fRot(results.tauxRotation.value),
      bench: lbl("≥ 6 : Bon · 2–6 : Moyen · < 2 : Mauvais", "≥ ٦ : جيد · ٢–٦ : متوسط · < ٢ : ضعيف"),
      status: results.tauxRotation.status,
      color: statusColor(results.tauxRotation.status),
      bg: statusBg(results.tauxRotation.status),
    });
  }
  if (results.tauxService) {
    rows.push({
      label: lbl("Taux de Service", "نسبة الخدمة"),
      value: fPct(results.tauxService.value),
      bench: lbl("≥ 95% : Bon · 90–95% : Moyen · < 90% : Mauvais", "≥ ٩٥% : جيد · ٩٠–٩٥% : متوسط · < ٩٠% : ضعيف"),
      status: results.tauxService.status,
      color: statusColor(results.tauxService.status),
      bg: statusBg(results.tauxService.status),
    });
  }
  if (results.coutTotal) {
    const b = results.coutTotal.breakdown;
    rows.push({
      label: lbl("Coût d'Approvisionnement Total", "تكلفة الإمداد الإجمالية"),
      value: fDA(results.coutTotal.value),
      bench: lbl(
        `Transport : ${fDA(b.coutTransport)} · Stockage : ${fDA(b.coutStockage)} · Commande : ${fDA(b.coutCommande)} · Rupture : ${fDA(b.coutRupture)}`,
        `نقل: ${fDA(b.coutTransport)} · تخزين: ${fDA(b.coutStockage)} · طلب: ${fDA(b.coutCommande)} · نقص: ${fDA(b.coutRupture)}`,
      ),
      status: null,
      color: C.primary,
      bg: C.primaryLight,
    });
  }
  if (results.tauxRupture) {
    rows.push({
      label: lbl("Taux de Rupture de Stock", "نسبة النقص من المخزون"),
      value: fPct(results.tauxRupture.value),
      bench: lbl("≤ 1% : Bon · 1–5% : Moyen · > 5% : Mauvais", "≤ ١% : جيد · ١–٥% : متوسط · > ٥% : ضعيف"),
      status: results.tauxRupture.status,
      color: statusColor(results.tauxRupture.status),
      bg: statusBg(results.tauxRupture.status),
    });
  }

  const content = `
    ${secTitle(lbl("Tableau de Bord — KPI", "لوحة المؤشرات — KPI"))}
    <div style="font-size:10px;color:${C.muted};margin-bottom:20px;">${results.problemName} · ${lbl("Période", "فترة")} : ${results.period}</div>
    ${rows.map(r => `
      <div style="background:${r.bg};border:1px solid ${r.color}44;border-radius:10px;padding:14px 18px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:11px;font-weight:700;color:${C.text};margin-bottom:4px;">${r.label}</div>
          <div style="font-size:9px;color:${C.muted};">${r.bench}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:16px;">
          <div style="font-size:22px;font-weight:800;color:${r.color};">${r.value}</div>
          ${r.status ? `<div style="font-size:9px;font-weight:700;color:${r.color};text-transform:uppercase;">${
            r.status === "good" ? lbl("Bon", "جيد") : r.status === "medium" ? lbl("Moyen", "متوسط") : lbl("Mauvais", "ضعيف")
          }</div>` : ""}
        </div>
      </div>`).join("")}`;

  return pageShell(content, 2, totalPages, lbl("Résultats KPI", "نتائج المؤشرات"), opts.language);
}

// ── Analysis + Recommendations page ──────────────────────────────────────────
function buildAnalysisPage(opts: ScKpiPDFOptions, totalPages: number) {
  const lbl = makeLbl(opts.language);

  const analysisHtml = opts.analysisLines.map(line => `
    <div style="background:${C.primaryLight};border:1px solid ${C.border};border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:10px;line-height:1.6;">
      ${line}
    </div>`).join("");

  const recoHtml = opts.recommendations.map((r, i) => `
    <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 16px;margin-bottom:10px;border-left:4px solid ${[C.green, C.accent, C.primary, C.amber][i % 4]};">
      <div style="font-size:11px;font-weight:700;margin-bottom:4px;">${r.icon} ${r.title}</div>
      <div style="font-size:9.5px;color:${C.muted};line-height:1.6;">${r.desc}</div>
    </div>`).join("");

  const content = `
    ${secTitle(lbl("Analyse de la Situation", "تحليل الوضع"))}
    ${analysisHtml}
    ${secTitle(lbl("Recommandations Managériales", "التوصيات الإدارية"))}
    ${recoHtml}`;

  return pageShell(content, 3, totalPages, lbl("Analyse & Recommandations", "التحليل والتوصيات"), opts.language);
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function generateScKpiPDF(opts: ScKpiPDFOptions): Promise<void> {
  const reportId = genId();
  const generatedAt = new Date().toLocaleDateString("fr-DZ");
  const totalPages = 3;

  const pages = [
    buildCover(opts, reportId, generatedAt, totalPages),
    buildResultsPage(opts, totalPages),
    buildAnalysisPage(opts, totalPages),
  ];

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = 794;
  const H = 1123;

  for (let i = 0; i < pages.length; i++) {
    opts.onProgress?.(`${i + 1}/${totalPages}`, Math.round((i / totalPages) * 85));
    const container = document.createElement("div");
    container.style.cssText = `position:fixed;left:-9999px;top:0;width:${W}px;z-index:-1;`;
    container.innerHTML = pages[i];
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        width: W,
        height: H,
        logging: false,
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 595.28, 841.89);
    } finally {
      document.body.removeChild(container);
    }
  }

  opts.onProgress?.("…", 98);
  const safeName = opts.results.problemName.replace(/[^a-z0-9\u0600-\u06FF]/gi, "_").substring(0, 40);
  pdf.save(`OptimDZ_SCKPI_${safeName}_${reportId}.pdf`);
  opts.onProgress?.("done", 100);
}
