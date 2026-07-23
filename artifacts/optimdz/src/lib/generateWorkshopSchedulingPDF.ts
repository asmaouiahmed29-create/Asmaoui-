import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { SchedulingResults, SchedulingRule } from "./workshopSchedulingAlgorithm";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface WorkshopSchedulingPDFOptions {
  problemName: string;
  rule: SchedulingRule;
  results: SchedulingResults;
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
  return `WS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function lbl(lang: "fr" | "ar") {
  return (fr: string, ar: string) => (lang === "ar" ? ar : fr);
}

function fmt(n: number): string {
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
    <span style="font-size:9px;color:${C.muted};">OptimDZ · ${L("Ordonnancement des Ateliers", "جدولة الورشات")}</span>
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
function buildCover(opts: WorkshopSchedulingPDFOptions, reportId: string, generatedAt: string, totalPages: number): string {
  const L = lbl(opts.language);
  const { results } = opts;
  const delayedCount = results.sequence.filter(t => t.delay > 0).length;

  const ruleLabel = {
    SPT: L("Plus Court Traitement (SPT)", "أقصر وقت معالجة (SPT)"),
    EDD: L("Date d'Échéance la Plus Proche (EDD)", "أقرب تاريخ استحقاق (EDD)"),
    FIFO: L("Premier Arrivé Premier Servi (FIFO)", "الأول وصولاً الأول خدمةً (FIFO)"),
  }[opts.rule];

  const statCards = [
    {
      label: L("Tâches planifiées", "مهام مجدولة"),
      value: String(results.sequence.length),
      color: C.primary, bg: C.primaryLight,
    },
    {
      label: L("Tâches en retard", "مهام متأخرة"),
      value: String(delayedCount),
      color: delayedCount > 0 ? C.red : C.green,
      bg: delayedCount > 0 ? C.redLight : C.greenLight,
    },
    {
      label: L("Retard maximal", "التأخير الأقصى"),
      value: fmt(results.maxDelay),
      color: results.maxDelay > 0 ? C.amber : C.green,
      bg: results.maxDelay > 0 ? C.amberLight : C.greenLight,
    },
    {
      label: L("Durée totale (makespan)", "المدة الكلية"),
      value: fmt(results.makespan),
      color: C.blue, bg: C.blueLight,
    },
  ];

  const content = `
    <div style="background:${C.primary};border-radius:12px;padding:36px 40px;margin-bottom:28px;position:relative;overflow:hidden;">
      <div style="position:relative;z-index:1;">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.65);text-transform:uppercase;margin-bottom:10px;">
          ${L("RAPPORT D'ORDONNANCEMENT — GESTION INDUSTRIELLE", "تقرير الجدولة — التسيير الصناعي")}
        </div>
        <h1 style="font-size:26px;font-weight:900;color:${C.white};margin:0 0 8px;line-height:1.2;">
          ${opts.problemName || L("Ordonnancement des Ateliers", "جدولة الورشات")}
        </h1>
        <div style="font-size:11px;color:rgba(255,255,255,0.75);margin-top:2px;font-weight:600;">
          ${L("Règle appliquée", "القاعدة المطبقة")} : ${ruleLabel}
        </div>
        <div style="margin-top:20px;display:flex;gap:16px;flex-wrap:wrap;">
          <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 16px;">
            <div style="font-size:9px;color:rgba(255,255,255,0.65);">${L("Rapport ID", "معرّف التقرير")}</div>
            <div style="font-size:12px;font-weight:700;color:${C.white};font-family:monospace;">${reportId}</div>
          </div>
          <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 16px;">
            <div style="font-size:9px;color:rgba(255,255,255,0.65);">${L("Généré le", "تاريخ الإنشاء")}</div>
            <div style="font-size:12px;font-weight:700;color:${C.white};">${generatedAt}</div>
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

    ${secTitle(L("Séquence d'ordonnancement", "تسلسل الجدولة"))}
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${results.sequence.map(task => `
        <div style="display:flex;align-items:center;justify-content:space-between;background:${task.delay > 0 ? C.redLight : C.primaryLight};border:1px solid ${task.delay > 0 ? C.red + "40" : C.border};border-radius:8px;padding:8px 14px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:22px;height:22px;border-radius:50%;background:${C.primary};color:${C.white};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0;">${task.rank}</div>
            <span style="font-size:11px;font-weight:700;">${task.name}</span>
          </div>
          <div style="display:flex;gap:16px;align-items:center;">
            <span style="font-size:10px;color:${C.muted};">${L("Durée", "مدة")}: <strong>${task.duration}</strong></span>
            <span style="font-size:10px;color:${C.muted};">${L("Fin", "نهاية")}: <strong>${fmt(task.completionTime)}</strong></span>
            ${task.delay > 0
              ? `<span style="background:${C.redLight};color:${C.red};font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;">${L("Retard", "تأخير")} ${fmt(task.delay)}</span>`
              : `<span style="background:${C.greenLight};color:${C.green};font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;">✓ ${L("Dans les délais", "في الوقت")}</span>`}
          </div>
        </div>`).join("")}
    </div>`;

  return pageShell(content, 1, totalPages, L("Vue d'ensemble", "نظرة عامة"), opts.language);
}

// ── Results table page ────────────────────────────────────────────────────────
function buildTablePage(opts: WorkshopSchedulingPDFOptions, totalPages: number): string {
  const L = lbl(opts.language);
  const { results } = opts;
  const isFifo = opts.rule === "FIFO";

  const content = `
    ${secTitle(L("Tableau Détaillé des Résultats", "جدول النتائج التفصيلي"))}
    <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:24px;">
      <thead>
        <tr>
          <th style="background:${C.primary};color:${C.white};padding:7px 10px;text-align:center;border-radius:4px 0 0 0;">#</th>
          <th style="background:${C.primary};color:${C.white};padding:7px 10px;text-align:left;">${L("Tâche", "المهمة")}</th>
          <th style="background:${C.primary};color:${C.white};padding:7px 10px;text-align:center;">${L("Durée", "المدة")}</th>
          ${isFifo ? `<th style="background:${C.primary};color:${C.white};padding:7px 10px;text-align:center;">${L("Arrivée", "الوصول")}</th>` : ""}
          <th style="background:${C.primary};color:${C.white};padding:7px 10px;text-align:center;">${L("Échéance", "الأجل")}</th>
          <th style="background:${C.primary};color:${C.white};padding:7px 10px;text-align:center;">${L("Début", "البداية")}</th>
          <th style="background:${C.primary};color:${C.white};padding:7px 10px;text-align:center;">${L("Temps de fin", "وقت الإنهاء")}</th>
          <th style="background:${C.primary};color:${C.white};padding:7px 10px;text-align:center;border-radius:0 4px 0 0;">${L("Retard", "التأخير")}</th>
        </tr>
      </thead>
      <tbody>
        ${results.sequence.map((task, i) => `
          <tr style="background:${task.delay > 0 ? C.redLight : (i % 2 === 0 ? "#f8faf9" : C.white)};">
            <td style="padding:6px 10px;text-align:center;border:1px solid ${C.border};font-weight:800;color:${C.primary};">${task.rank}</td>
            <td style="padding:6px 10px;border:1px solid ${C.border};font-weight:700;">${task.name}</td>
            <td style="padding:6px 10px;text-align:center;border:1px solid ${C.border};">${task.duration}</td>
            ${isFifo ? `<td style="padding:6px 10px;text-align:center;border:1px solid ${C.border};">${task.arrivalDate}</td>` : ""}
            <td style="padding:6px 10px;text-align:center;border:1px solid ${C.border};">${task.dueDate}</td>
            <td style="padding:6px 10px;text-align:center;border:1px solid ${C.border};">${fmt(task.startTime)}</td>
            <td style="padding:6px 10px;text-align:center;border:1px solid ${C.border};font-weight:700;color:${C.primary};">${fmt(task.completionTime)}</td>
            <td style="padding:6px 10px;text-align:center;border:1px solid ${C.border};font-weight:700;color:${task.delay > 0 ? C.red : C.green};">
              ${task.delay > 0 ? fmt(task.delay) : "—"}
            </td>
          </tr>`).join("")}
      </tbody>
    </table>

    ${secTitle(L("Indicateurs de Performance", "مؤشرات الأداء"))}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      <div style="background:${C.primaryLight};border:1px solid ${C.border};border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:20px;font-weight:900;color:${C.primary};">${fmt(results.avgCompletionTime)}</div>
        <div style="font-size:9px;color:${C.muted};margin-top:4px;">${L("Temps de fin moyen", "متوسط وقت الإنهاء")}</div>
      </div>
      <div style="background:${results.avgDelay > 0 ? C.amberLight : C.greenLight};border:1px solid ${C.border};border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:20px;font-weight:900;color:${results.avgDelay > 0 ? C.amber : C.green};">${fmt(results.avgDelay)}</div>
        <div style="font-size:9px;color:${C.muted};margin-top:4px;">${L("Retard moyen", "متوسط التأخير")}</div>
      </div>
      <div style="background:${results.maxDelay > 0 ? C.redLight : C.greenLight};border:1px solid ${C.border};border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:20px;font-weight:900;color:${results.maxDelay > 0 ? C.red : C.green};">${fmt(results.maxDelay)}</div>
        <div style="font-size:9px;color:${C.muted};margin-top:4px;">${L("Retard maximal", "التأخير الأقصى")}</div>
      </div>
    </div>`;

  return pageShell(content, 2, totalPages, L("Tableau des résultats", "جدول النتائج"), opts.language);
}

// ── Analysis + Recommendations page ──────────────────────────────────────────
function buildAnalysisPage(opts: WorkshopSchedulingPDFOptions, totalPages: number): string {
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
export async function generateWorkshopSchedulingPDF(opts: WorkshopSchedulingPDFOptions): Promise<void> {
  const reportId = genId();
  const generatedAt = new Date().toLocaleDateString("fr-DZ");
  const totalPages = 3;

  const pages = [
    buildCover(opts, reportId, generatedAt, totalPages),
    buildTablePage(opts, totalPages),
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
    const safeName = (opts.problemName || "ordonnancement").replace(/[^a-z0-9\u0600-\u06FF]/gi, "-").slice(0, 40);
    pdf.save(`optimdz-ordonnancement-${safeName}-${reportId}.pdf`);
    opts.onProgress?.("Terminé", 100);
  } finally {
    document.body.removeChild(container);
  }
}
