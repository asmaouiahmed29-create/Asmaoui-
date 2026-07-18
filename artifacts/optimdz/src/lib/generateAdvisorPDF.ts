import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ── Brand tokens ───────────────────────────────────────────────────────────────
const C = {
  primary: "#004d40", primaryLight: "#e0f2f1",
  accent: "#f4a261", bg: "#fbf8f1", text: "#0c2621",
  muted: "#5f7b77", border: "#c8dad6", white: "#ffffff",
  green: "#2e7d32", greenLight: "#e8f5e9",
  amber: "#f59e0b", amberLight: "#fffbeb",
  red: "#c62828", redLight: "#ffebee",
  blue: "#1565c0", blueLight: "#e3f2fd",
};

function fDA(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(Math.round(n));
  const str = abs >= 1_000_000
    ? (abs / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + " M DA"
    : abs >= 1_000
    ? (abs / 1_000).toFixed(1).replace(/\.0$/, "") + " k DA"
    : abs.toLocaleString("fr-DZ") + " DA";
  return (n < 0 ? "−" : "") + str;
}
function fPct(n: number | null | undefined, dec = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(dec) + " %";
}
function fPctAbs(n: number | null | undefined, dec = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return n.toFixed(dec) + " %";
}
function genId() {
  return `ADV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export type OverallRating = "strong" | "good" | "caution" | "alert";

export interface AdvisorSynthesis {
  rating: OverallRating;
  verdictFr: string;
  verdictAr: string;
  reasoningFr: string[];
  reasoningAr: string[];
  kpi: {
    businessName: string; periodCount: number;
    latestProfit: number; latestMarginPct: number;
    avgProfitGrowthPct: number; overallProfitTrend: string;
    health: "strong" | "mixed" | "weak";
  } | null;
  investment: {
    projectName: string; npv: number; irr: number | null;
    profitabilityIndex: number; verdict: "go" | "conditional" | "nogo";
  } | null;
  breakEven: {
    productName: string; marginOfSafetyPct: number;
    breakEvenRevenue: number; safetyLevel: "safe" | "moderate" | "risky";
  } | null;
  sensitivity: {
    mostSensitiveVar: string | null;
    riskLevel: "low" | "moderate" | "high" | "very-high";
    minBreakEvenPct: number | null;
  } | null;
  comparison: { winner: string; winnerNPV: number } | null;
  dataPointsFr: string[];
  dataPointsAr: string[];
  nextStepsFr: string[];
  nextStepsAr: string[];
}

function ratingColor(r: OverallRating) {
  return r === "strong" ? C.green : r === "good" ? C.blue : r === "caution" ? C.amber : C.red;
}
function ratingColorLight(r: OverallRating) {
  return r === "strong" ? C.greenLight : r === "good" ? C.blueLight : r === "caution" ? C.amberLight : C.redLight;
}
function ratingIcon(r: OverallRating) {
  return r === "strong" ? "🟢" : r === "good" ? "🔵" : r === "caution" ? "🟡" : "🔴";
}
function ratingLabelFr(r: OverallRating) {
  return r === "strong" ? "SITUATION FORTE" : r === "good" ? "SITUATION FAVORABLE" : r === "caution" ? "VIGILANCE RECOMMANDÉE" : "ALERTE — ACTION REQUISE";
}
function ratingLabelAr(r: OverallRating) {
  return r === "strong" ? "وضع قوي" : r === "good" ? "وضع مناسب" : r === "caution" ? "يُنصح باليقظة" : "تنبيه — مطلوب اتخاذ إجراء";
}

function pageShell(content: string, pageNum: number, total: number) {
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
      <span style="color:rgba(255,255,255,0.75);font-size:11px;">التوصية الشاملة · Conseiller d'Affaires Complet</span>
      <span style="color:rgba(255,255,255,0.6);font-size:10px;">${pageNum} / ${total}</span>
    </div>
    <div style="flex:1;padding:28px 36px 20px;display:flex;flex-direction:column;gap:0;">${content}</div>
    <div style="border-top:1px solid ${C.border};padding:8px 36px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
      <span style="font-size:9px;color:${C.muted};">نظام OptimDZ — مساعد القرار الذكي · Assistant de Décision Intelligent</span>
      <span style="font-size:9px;color:${C.muted};">www.optimdz.replit.app</span>
    </div>
  </div>`;
}

function sectionTitle(fr: string, ar: string) {
  return `<div style="margin-bottom:10px;margin-top:18px;">
    <h2 style="font-size:15px;font-weight:800;color:${C.primary};margin:0 0 4px;">${ar} · ${fr}</h2>
    <div style="width:36px;height:3px;background:${C.accent};border-radius:2px;"></div>
  </div>`;
}

function buildCoverPage(
  s: AdvisorSynthesis,
  managerName: string, institutionName: string,
  reportId: string, generatedAt: string
) {
  const rc = ratingColor(s.rating);
  const rl = ratingColorLight(s.rating);

  const kpiBlock = s.kpi ? `
    <div style="background:${C.white};border:1px solid ${C.border};border-radius:8px;padding:14px;margin-bottom:10px;">
      <div style="font-size:11px;color:${C.muted};margin-bottom:6px;font-weight:600;">📊 SUIVI KPI · تتبع المؤشرات</div>
      <div style="font-size:13px;font-weight:700;color:${C.text};">${s.kpi.businessName} — ${s.kpi.periodCount} périodes / فترات</div>
      <div style="font-size:11px;color:${C.muted};margin-top:4px;">
        Dernier bénéfice: <strong>${fDA(s.kpi.latestProfit)}</strong> · Marge: <strong>${fPctAbs(s.kpi.latestMarginPct)}</strong> · 
        Croissance moy.: <strong>${fPct(s.kpi.avgProfitGrowthPct)}</strong>
      </div>
    </div>` : "";

  const investBlock = s.investment ? `
    <div style="background:${C.white};border:1px solid ${C.border};border-radius:8px;padding:14px;margin-bottom:10px;">
      <div style="font-size:11px;color:${C.muted};margin-bottom:6px;font-weight:600;">💹 ÉVALUATION INVESTISSEMENT · تقييم الاستثمار</div>
      <div style="font-size:13px;font-weight:700;color:${C.text};">${s.investment.projectName}</div>
      <div style="font-size:11px;color:${C.muted};margin-top:4px;">
        NPV: <strong>${fDA(s.investment.npv)}</strong> · IRR: <strong>${s.investment.irr !== null ? fPct(s.investment.irr) : "—"}</strong> · 
        IP: <strong>${s.investment.profitabilityIndex.toFixed(2)}</strong> · Verdict: <strong>${s.investment.verdict.toUpperCase()}</strong>
      </div>
    </div>` : "";

  const breakEvenBlock = s.breakEven ? `
    <div style="background:${C.white};border:1px solid ${C.border};border-radius:8px;padding:14px;margin-bottom:10px;">
      <div style="font-size:11px;color:${C.muted};margin-bottom:6px;font-weight:600;">📈 SEUIL DE RENTABILITÉ · نقطة التعادل</div>
      <div style="font-size:13px;font-weight:700;color:${C.text};">${s.breakEven.productName}</div>
      <div style="font-size:11px;color:${C.muted};margin-top:4px;">
        Seuil: <strong>${fDA(s.breakEven.breakEvenRevenue)}</strong> · Marge de sécurité: <strong>${fPctAbs(s.breakEven.marginOfSafetyPct)}</strong>
      </div>
    </div>` : "";

  const sensBlock = s.sensitivity ? `
    <div style="background:${C.white};border:1px solid ${C.border};border-radius:8px;padding:14px;margin-bottom:10px;">
      <div style="font-size:11px;color:${C.muted};margin-bottom:6px;font-weight:600;">🌡️ SENSIBILITÉ · الحساسية</div>
      <div style="font-size:11px;color:${C.muted};">
        Variable critique: <strong>${s.sensitivity.mostSensitiveVar ?? "—"}</strong> · 
        Tolérance min.: <strong>${s.sensitivity.minBreakEvenPct !== null ? fPctAbs(Math.abs(s.sensitivity.minBreakEvenPct)) : "—"}</strong> · 
        Risque: <strong>${s.sensitivity.riskLevel.toUpperCase()}</strong>
      </div>
    </div>` : "";

  const compBlock = s.comparison ? `
    <div style="background:${C.white};border:1px solid ${C.border};border-radius:8px;padding:14px;margin-bottom:10px;">
      <div style="font-size:11px;color:${C.muted};margin-bottom:6px;font-weight:600;">⚖️ COMPARAISON ALTERNATIVES · مقارنة البدائل</div>
      <div style="font-size:11px;color:${C.muted};">
        Meilleure alternative: <strong>${s.comparison.winner}</strong> · NPV gagnant: <strong>${fDA(s.comparison.winnerNPV)}</strong>
      </div>
    </div>` : "";

  const reasoningRows = s.reasoningFr.map((fr, i) =>
    `<div style="background:${C.white};border-left:3px solid ${rc};padding:10px 12px;border-radius:0 6px 6px 0;margin-bottom:8px;font-size:11px;line-height:1.5;color:${C.text};">
      <span style="font-weight:700;color:${rc};">${i + 1}. </span>${fr}
    </div>`
  ).join("");

  return pageShell(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <div>
        <div style="font-size:20px;font-weight:800;color:${C.primary};margin-bottom:2px;">Rapport — التوصية الشاملة</div>
        <div style="font-size:12px;color:${C.muted};">Conseiller d'Affaires Complet · مساعد الأعمال الشامل</div>
      </div>
      <div style="text-align:right;font-size:10px;color:${C.muted};">
        <div>${managerName ? `${managerName}` : "—"}</div>
        <div>${institutionName ? institutionName : ""}</div>
        <div style="margin-top:4px;font-family:monospace;font-size:9px;">${reportId}</div>
        <div>${generatedAt}</div>
      </div>
    </div>

    <!-- Overall verdict card -->
    <div style="background:${rl};border:2px solid ${rc};border-radius:12px;padding:20px 24px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <span style="font-size:28px;">${ratingIcon(s.rating)}</span>
        <div>
          <div style="font-size:11px;color:${rc};font-weight:700;letter-spacing:1px;">${ratingLabelFr(s.rating)} · ${ratingLabelAr(s.rating)}</div>
          <div style="font-size:15px;font-weight:800;color:${C.text};margin-top:2px;">${s.verdictFr}</div>
          <div style="font-size:12px;color:${C.muted};margin-top:2px;">${s.verdictAr}</div>
        </div>
      </div>
      <div style="height:1px;background:${rc};opacity:0.2;margin-bottom:12px;"></div>
      ${reasoningRows}
    </div>

    <!-- Data snapshots -->
    ${sectionTitle("Données utilisées", "البيانات المستخدمة")}
    ${kpiBlock}${investBlock}${breakEvenBlock}${sensBlock}${compBlock}
  `, 1, 2);
}

function buildAnalysisPage(s: AdvisorSynthesis) {
  const nextStepRows = s.nextStepsFr.map((fr, i) =>
    `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
      <span style="background:${C.primary};color:${C.white};font-size:10px;font-weight:700;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</span>
      <div style="font-size:11px;color:${C.text};line-height:1.5;">
        <div>${fr}</div>
        <div style="color:${C.muted};margin-top:2px;">${s.nextStepsAr[i] ?? ""}</div>
      </div>
    </div>`
  ).join("");

  const dataPointRows = s.dataPointsFr.map((fr, i) =>
    `<div style="background:${C.white};border:1px solid ${C.border};border-radius:6px;padding:8px 12px;margin-bottom:6px;font-size:10px;color:${C.muted};line-height:1.4;">
      <div style="color:${C.text};margin-bottom:2px;">${fr}</div>
      <div>${s.dataPointsAr[i] ?? ""}</div>
    </div>`
  ).join("");

  return pageShell(`
    ${sectionTitle("Prochaines étapes recommandées", "الخطوات التالية الموصى بها")}
    ${nextStepRows}

    ${sectionTitle("Traçabilité des données", "مصادر البيانات المرجعية")}
    <p style="font-size:10px;color:${C.muted};margin-bottom:10px;line-height:1.4;">
      L'ensemble des affirmations contenues dans ce rapport se basent exclusivement sur les données sauvegardées suivantes.
      تستند جميع التأكيدات الواردة في هذا التقرير حصرياً على البيانات المحفوظة التالية.
    </p>
    ${dataPointRows}

    <div style="margin-top:20px;padding:12px 16px;background:${C.primaryLight};border-radius:8px;border:1px solid ${C.border};">
      <p style="font-size:10px;color:${C.muted};margin:0;line-height:1.5;">
        ⚠️ Ce rapport est généré automatiquement à partir des données saisies sur la plateforme OptimDZ. 
        Il ne constitue pas un conseil financier ou légal. Consultez un expert avant toute décision d'investissement majeure.
        <br/>هذا التقرير مُولَّد تلقائياً من البيانات المُدخلة على منصة OptimDZ. لا يُعدّ نصيحة مالية أو قانونية. استشر خبيراً قبل أي قرار استثماري مهم.
      </p>
    </div>
  `, 2, 2);
}

async function renderPage(html: string): Promise<HTMLCanvasElement> {
  const div = document.createElement("div");
  div.style.cssText = "position:fixed;left:-9999px;top:0;z-index:-1;";
  div.innerHTML = html;
  document.body.appendChild(div);
  const canvas = await html2canvas(div.firstElementChild as HTMLElement, {
    scale: 2, useCORS: true, backgroundColor: null,
  });
  document.body.removeChild(div);
  return canvas;
}

export async function generateAdvisorPDFReport(opts: {
  synthesis: AdvisorSynthesis;
  managerName: string;
  institutionName: string;
}) {
  const { synthesis: s, managerName, institutionName } = opts;
  const reportId = genId();
  const generatedAt = new Date().toLocaleDateString("fr-DZ", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const [c1, c2] = await Promise.all([
    renderPage(buildCoverPage(s, managerName, institutionName, reportId, generatedAt)),
    renderPage(buildAnalysisPage(s)),
  ]);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297;

  pdf.addImage(c1.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, W, H);
  pdf.addPage();
  pdf.addImage(c2.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, W, H);

  pdf.save(`OptimDZ_Conseiller_Affaires_${reportId}.pdf`);
}
