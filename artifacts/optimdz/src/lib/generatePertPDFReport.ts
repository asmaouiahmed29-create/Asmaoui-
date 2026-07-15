import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { ActivityResult, PertCpmResult, CrashResult, CrashStep } from "./pertCpmAlgorithm";

// ── Brand tokens (identical to Simplex PDF) ───────────────────────────────────
const C = {
  primary: "#004d40", primaryLight: "#e0f2f1",
  secondary: "#3a7d44", accent: "#f4a261",
  bg: "#fbf8f1", text: "#0c2621", muted: "#5f7b77",
  orange: "#e65100", orangeLight: "#fff3e0",
  green: "#2e7d32", greenLight: "#e8f5e9",
  border: "#c8dad6", white: "#ffffff",
};

function f(n: number | undefined | null, dec = 2): string {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  return parseFloat(n.toFixed(dec)).toLocaleString("fr-DZ", { maximumFractionDigits: dec });
}
function fDZD(n: number | undefined | null): string {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  return Math.round(n).toLocaleString("fr-DZ") + " DA";
}
function genId() {
  return `PERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}
function sectorLabel(s?: string) {
  const m: Record<string, string> = {
    trade: "تجارة / Commerce", industry: "صناعة / Industrie",
    services: "خدمات / Services", agriculture: "فلاحة / Agriculture", custom: "مخصص / Personnalisé",
  };
  return s ? (m[s] ?? s) : "—";
}

// ── Page shell (identical header/footer pattern) ──────────────────────────────
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
    <div style="flex:1;padding:32px 36px 24px;display:flex;flex-direction:column;gap:0;">${content}</div>
    <div style="border-top:1px solid ${C.border};padding:8px 36px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
      <span style="font-size:9px;color:${C.muted};">نظام OptimDZ للمسار الحرج والتخطيط الشبكي — Système OptimDZ PERT/CPM</span>
      <span style="font-size:9px;color:${C.muted};">www.optimdz.replit.app</span>
    </div>
  </div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sectionTitle(fr: string, ar: string) {
  return `<div style="margin-bottom:16px;">
    <h2 style="font-size:20px;font-weight:800;color:${C.primary};margin:0 0 4px;">${ar} · ${fr}</h2>
    <div style="width:40px;height:3px;background:${C.accent};border-radius:2px;"></div>
  </div>`;
}
function subTitle(fr: string, ar: string, color = C.secondary) {
  return `<h3 style="font-size:13px;font-weight:700;color:${C.text};margin:0 0 8px;display:flex;align-items:center;gap:6px;">
    <span style="display:inline-block;width:4px;height:16px;background:${color};border-radius:2px;"></span>
    ${ar} · ${fr}
  </h3>`;
}
function kpiCard(label: string, value: string, bg: string, color = C.white) {
  return `<div style="background:${bg};border-radius:10px;padding:12px;color:${color};">
    <div style="font-size:9px;opacity:0.75;margin-bottom:4px;line-height:1.3;">${label}</div>
    <div style="font-size:15px;font-weight:800;">${value}</div>
  </div>`;
}

// ── Page 1 — Cover ────────────────────────────────────────────────────────────
function buildCover(
  projectName: string, sector: string | undefined, mode: string,
  projectDuration: number, criticalPath: string[], criticalNames: string[],
  managerName: string, institutionName: string,
  reportId: string, generatedAt: string, totalPages: number
) {
  const cpText = criticalPath.join(" → ");
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
        <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-top:1px;">نظام دعم القرار · التخطيط بالمسار الحرج</div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 40px;text-align:center;gap:16px;">
      <div style="font-size:11px;letter-spacing:3px;color:${C.accent};text-transform:uppercase;font-weight:600;">تقرير رسمي · Rapport Officiel</div>
      <div style="font-size:28px;font-weight:800;line-height:1.3;direction:rtl;">تقرير تخطيط المشروع بالمسار الحرج</div>
      <div style="font-size:17px;font-weight:400;color:rgba(255,255,255,0.8);">Rapport de Planification PERT/CPM</div>
      <div style="width:60px;height:3px;background:${C.accent};border-radius:2px;margin:8px 0;"></div>
      <div style="font-size:20px;font-weight:700;color:${C.accent};">${projectName || "—"}</div>
      <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:12px 24px;margin-top:8px;">
        <div style="font-size:11px;opacity:0.7;margin-bottom:6px;">المسار الحرج · Chemin Critique</div>
        <div style="font-size:14px;font-weight:700;font-family:monospace;letter-spacing:1px;">${cpText}</div>
        <div style="font-size:11px;opacity:0.75;margin-top:4px;">${criticalNames.join(" → ")}</div>
      </div>
    </div>
    <div style="padding:0 40px 32px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${[
        ["المدير / Responsable", managerName || "—"],
        ["المؤسسة / Institution", institutionName || "—"],
        ["القطاع / Secteur", sectorLabel(sector)],
        ["مدة المشروع / Durée", f(projectDuration, 2) + " semaines"],
        ["النمط / Mode", mode === "PERT" ? "PERT — Probabiliste" : "CPM — Déterministe"],
        ["رقم التقرير / N° Rapport", reportId],
        ["تاريخ الإصدار / Date", generatedAt],
        ["الصفحات / Pages", String(totalPages)],
      ].map(([label, value]) => `
        <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:12px 16px;">
          <div style="font-size:9px;color:rgba(255,255,255,0.55);margin-bottom:4px;">${label}</div>
          <div style="font-size:13px;font-weight:700;">${value}</div>
        </div>
      `).join("")}
    </div>
    <div style="height:6px;background:rgba(255,255,255,0.15);"></div>
  </div>`;
}

// ── Page 2 — Activity Analysis ────────────────────────────────────────────────
function buildActivityPage(
  activities: ActivityResult[], criticalPath: string[], mode: string, totalPages: number
) {
  const totalCritical = activities.filter((a) => a.isCritical).length;
  const totalNonCrit  = activities.length - totalCritical;
  const maxSlack      = Math.max(...activities.map((a) => a.slack), 0);

  const rows = activities.map((a) => {
    const isCrit = a.isCritical;
    const bg = isCrit ? C.greenLight : C.white;
    const dur = mode === "PERT" ? f(a.expectedDuration, 2) : f(a.duration, 2);
    const extraCols = mode === "PERT"
      ? `<td style="padding:6px 8px;border-bottom:1px solid ${C.border};text-align:center;">${f(a.variance, 4)}</td>`
      : "";
    return `<tr style="background:${bg}">
      <td style="padding:6px 8px;border-bottom:1px solid ${C.border};font-weight:700;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:4px;
          background:${isCrit ? C.primary : C.muted};color:${C.white};font-size:11px;">${a.id}</span>
      </td>
      <td style="padding:6px 8px;border-bottom:1px solid ${C.border};font-size:11px;">${a.name}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;">${dur}</td>
      ${extraCols}
      <td style="padding:6px 8px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;">${f(a.ES, 2)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;">${f(a.EF, 2)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;">${f(a.LS, 2)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;">${f(a.LF, 2)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${C.border};text-align:center;font-weight:700;color:${isCrit ? "#dc2626" : C.muted};">${f(a.slack, 2)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${C.border};text-align:center;">
        ${isCrit ? `<span style="background:${C.primary};color:${C.white};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;">★ حرج</span>` : "—"}
      </td>
    </tr>`;
  }).join("");

  const durHeader = mode === "PERT"
    ? `<th style="padding:6px 8px;text-align:center;">tₑ</th><th style="padding:6px 8px;text-align:center;">σ²</th>`
    : `<th style="padding:6px 8px;text-align:center;">Durée</th>`;

  const content = `
    ${sectionTitle("Analyse des Activités", "تحليل الأنشطة")}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">
      ${kpiCard("عدد الأنشطة · Activités", String(activities.length), C.primary)}
      ${kpiCard("أنشطة حرجة · Critiques", `${totalCritical} / ${activities.length}`, C.orange)}
      ${kpiCard("أنشطة غير حرجة · Non-critiques", String(totalNonCrit), C.secondary)}
      ${kpiCard("أقصى مهلة · Marge max.", f(maxSlack, 2) + " sem.", C.text)}
    </div>
    ${subTitle("Tableau ES / EF / LS / LF / Marge", "جدول التحليل الكامل")}
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="background:${C.primary};color:${C.white};">
          <th style="padding:6px 8px;text-align:left;">ID</th>
          <th style="padding:6px 8px;text-align:left;">النشاط / Activité</th>
          ${durHeader}
          <th style="padding:6px 8px;text-align:center;">ES</th>
          <th style="padding:6px 8px;text-align:center;">EF</th>
          <th style="padding:6px 8px;text-align:center;">LS</th>
          <th style="padding:6px 8px;text-align:center;">LF</th>
          <th style="padding:6px 8px;text-align:center;">Marge</th>
          <th style="padding:6px 8px;text-align:center;">Statut</th>
        </tr>
      </thead>
      <tbody style="background:${C.white};">${rows}</tbody>
    </table>
    <div style="margin-top:14px;background:${C.primaryLight};border-radius:8px;padding:10px 14px;">
      <div style="font-size:11px;font-weight:700;color:${C.primary};margin-bottom:4px;">المسار الحرج · Chemin Critique</div>
      <div style="font-size:13px;font-family:monospace;color:${C.text};">
        ${criticalPath.join(" → ")}
      </div>
      <div style="font-size:10px;color:${C.muted};margin-top:3px;">
        ${criticalPath.map((id) => activities.find((a) => a.id === id)?.name ?? id).join(" → ")}
      </div>
    </div>`;
  return pageShell(content, 2, totalPages, "تحليل الأنشطة · Analyse des Activités");
}

// ── Page 3 — PERT Probabilistic Analysis ─────────────────────────────────────
function buildPertPage(
  activities: ActivityResult[], result: PertCpmResult, totalPages: number
) {
  const critActs = activities.filter((a) => a.isCritical);
  const rows = critActs.map((a) => `
    <tr style="background:${C.greenLight}">
      <td style="padding:6px 10px;border-bottom:1px solid ${C.border};font-weight:700;">${a.id}</td>
      <td style="padding:6px 10px;border-bottom:1px solid ${C.border};font-size:11px;">${a.name}</td>
      <td style="padding:6px 10px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;">${f(a.expectedDuration, 2)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;">${f(a.variance, 4)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;">${f(Math.sqrt(a.variance ?? 0), 4)}</td>
    </tr>`).join("");

  const content = `
    ${sectionTitle("Analyse Probabiliste PERT", "التحليل الاحتمالي PERT")}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
      ${kpiCard("مدة المشروع المتوقعة E[T] · Durée Espérée", f(result.projectDuration, 2) + " semaines", C.primary)}
      ${kpiCard("تباين المشروع σ²(T) · Variance", f(result.projectVariance, 4), C.secondary)}
      ${kpiCard("الانحراف المعياري σ(T) · Écart-type", f(result.projectStdDev, 4) + " semaines", C.text)}
    </div>
    ${subTitle("الأنشطة الحرجة — تفاصيل PERT", "Activités Critiques — Détail PERT", C.primary)}
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px;">
      <thead>
        <tr style="background:${C.primary};color:${C.white};">
          <th style="padding:7px 10px;text-align:left;">ID</th>
          <th style="padding:7px 10px;text-align:left;">النشاط / Activité</th>
          <th style="padding:7px 10px;text-align:center;">tₑ</th>
          <th style="padding:7px 10px;text-align:center;">σ²</th>
          <th style="padding:7px 10px;text-align:center;">σ</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="background:${C.primaryLight};border-radius:8px;padding:14px 16px;font-size:12px;direction:rtl;text-align:right;">
      <div style="font-weight:700;color:${C.primary};margin-bottom:6px;">صيغ PERT المستخدمة · Formules PERT utilisées</div>
      <div style="font-family:monospace;color:${C.text};line-height:1.8;">
        tₑ = (O + 4M + P) / 6 &nbsp;|&nbsp; σ² = ((P − O) / 6)² &nbsp;|&nbsp; σ(projet) = √Σσ²(critique)
      </div>
      <div style="margin-top:8px;color:${C.muted};font-size:11px;">
        الصيغة الاحتمالية: P(T ≤ T_cible) = Φ((T_cible − E[T]) / σ(T)) حيث Φ دالة التوزيع الطبيعي المعياري
      </div>
    </div>`;
  return pageShell(content, 3, totalPages, "التحليل الاحتمالي · Analyse Probabiliste PERT");
}

// ── Page 4 — Crashing Analysis ────────────────────────────────────────────────
function buildCrashPage(crash: CrashResult, activities: ActivityResult[], totalPages: number) {
  const achieved  = crash.isTargetAchieved;
  const hasCost   = crash.steps.some((s) => s.totalCost !== undefined);
  const savedDur  = crash.originalDuration - crash.achievedDuration;
  const addedCost = crash.steps.reduce((s, step) => s + step.addedDirectCost, 0);

  const rows = crash.steps.map((s, i) => {
    const isMin = hasCost && crash.minCostPoint?.stepIdx === i + 1;
    return `<tr style="background:${isMin ? "#fff8e1" : i % 2 === 0 ? C.white : "#fafafa"}">
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:center;font-weight:700;">${s.iteration}</td>
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};font-family:monospace;font-weight:600;">${s.activityId}</td>
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};font-size:11px;">${s.activityName}</td>
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:center;">1</td>
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;">${fDZD(s.costSlope)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;color:${C.orange};">${fDZD(s.addedDirectCost)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;font-weight:700;">${f(s.newDuration, 2)}</td>
      ${hasCost ? `
        <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;">${fDZD(s.overheadCost)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid ${C.border};text-align:center;font-family:monospace;font-weight:${isMin ? "800" : "400"};color:${isMin ? "#1565c0" : C.text};">${fDZD(s.totalCost)}${isMin ? " ★" : ""}</td>
      ` : ""}
    </tr>`;
  }).join("");

  const extraHeaders = hasCost
    ? `<th style="padding:5px 8px;text-align:center;">Frais gén.</th><th style="padding:5px 8px;text-align:center;">Coût Total</th>`
    : "";

  const content = `
    ${sectionTitle("Analyse de l'Accélération (Crashing)", "تحليل تسريع المشروع")}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">
      ${kpiCard("المدة الأصلية · Durée initiale", f(crash.originalDuration, 2) + " sem.", C.muted, C.white)}
      ${kpiCard("المدة المحققة · Durée atteinte", f(crash.achievedDuration, 2) + " sem.", achieved ? C.primary : C.orange)}
      ${kpiCard("تخفيض المدة · Gain de durée", f(savedDur, 2) + " sem.", C.secondary)}
      ${kpiCard("تكلفة التسريع · Coût crashing", fDZD(addedCost), C.text)}
    </div>
    <div style="background:${achieved ? C.greenLight : C.orangeLight};border-right:4px solid ${achieved ? C.green : C.orange};
      border-radius:8px;padding:10px 14px;margin-bottom:16px;">
      <div style="font-weight:700;color:${achieved ? C.green : C.orange};font-size:13px;">
        ${achieved
          ? `✅ المدة المستهدفة (${f(crash.targetDuration, 2)} sem.) محققة`
          : `⚠️ المدة المستهدفة (${f(crash.targetDuration, 2)} sem.) لم تُحقق — أفضل ما يمكن تحقيقه: ${f(crash.achievedDuration, 2)} sem.`}
      </div>
    </div>
    ${hasCost && crash.minCostPoint ? `
    <div style="background:#e3f2fd;border-right:4px solid #1565c0;border-radius:8px;padding:10px 14px;margin-bottom:16px;">
      <div style="font-weight:700;color:#1565c0;font-size:12px;">
        ★ النقطة الأمثل للتكلفة: مدة ${f(crash.minCostPoint.duration, 2)} أسبوع بتكلفة إجمالية ${fDZD(crash.minCostPoint.totalCost)}
      </div>
    </div>` : ""}
    ${subTitle("تفاصيل خطوات التسريع", "Détail des itérations de crashing", C.accent)}
    <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
      <thead>
        <tr style="background:${C.primary};color:${C.white};">
          <th style="padding:5px 8px;text-align:center;">#</th>
          <th style="padding:5px 8px;text-align:center;">ID</th>
          <th style="padding:5px 8px;text-align:left;">النشاط</th>
          <th style="padding:5px 8px;text-align:center;">Δdur.</th>
          <th style="padding:5px 8px;text-align:center;">Pente (DA/sem)</th>
          <th style="padding:5px 8px;text-align:center;">Coût ajouté</th>
          <th style="padding:5px 8px;text-align:center;">Dur. projet</th>
          ${extraHeaders}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  return pageShell(content, hasCost ? 4 : 4, totalPages, "تسريع المشروع · Crashing");
}

// ── Page — Situational Analysis & Recommendations ─────────────────────────────
function buildAnalysisPage(
  projectName: string, mode: string,
  result: PertCpmResult, crash: CrashResult | undefined,
  pageNum: number, totalPages: number
) {
  const { activities, criticalPath, projectDuration } = result;
  const critActs    = activities.filter((a) => a.isCritical);
  const nonCritActs = activities.filter((a) => !a.isCritical);
  const maxSlack    = Math.max(...activities.map((a) => a.slack), 0);
  const avgSlack    = nonCritActs.length > 0
    ? nonCritActs.reduce((s, a) => s + a.slack, 0) / nonCritActs.length : 0;

  // Risk activities: lowest slack (non-zero) or highest variance (PERT)
  const riskActs = mode === "PERT"
    ? [...activities].filter((a) => !a.isCritical && (a.variance ?? 0) > 0)
        .sort((a, b) => (b.variance ?? 0) - (a.variance ?? 0)).slice(0, 3)
    : [...activities].filter((a) => !a.isCritical && a.slack > 0)
        .sort((a, b) => a.slack - b.slack).slice(0, 3);

  const highSlackActs = [...nonCritActs].sort((a, b) => b.slack - a.slack).slice(0, 3);

  const situationParagraph = `
    <div style="background:${C.primaryLight};border-radius:8px;padding:14px 16px;margin-bottom:16px;direction:rtl;text-align:right;">
      <div style="font-size:12px;color:${C.text};line-height:1.8;">
        يضم المشروع <strong>${activities.length} نشاطاً</strong>، تنتهي على مدار 
        <strong>${mode === "PERT" ? f(projectDuration, 2) : projectDuration} أسبوع</strong>.
        المسار الحرج يشمل <strong>${criticalPath.length} نشاطاً</strong> (${criticalPath.join("→")})
        لا تتمتع بأي مهلة ويجب مراقبتها باستمرار.
        ${nonCritActs.length > 0 
          ? `أما الأنشطة الـ${nonCritActs.length} غير الحرجة فلديها مهلة متوسطة ${f(avgSlack, 1)} أسبوع، 
             ويمكن توظيف هذه المرونة في إعادة توزيع الموارد.`
          : "جميع الأنشطة حرجة ولا يوجد هامش للتأخير."}
        ${mode === "PERT"
          ? ` الانحراف المعياري للمشروع ${f(result.projectStdDev, 2)} أسبوع يعكس درجة عدم اليقين في الجدول الزمني.`
          : ""}
      </div>
    </div>`;

  const crashSection = crash && crash.steps.length > 0 ? `
    <div style="background:${C.orangeLight};border-right:4px solid ${C.orange};border-radius:8px;padding:12px 16px;margin-bottom:16px;direction:rtl;text-align:right;">
      <div style="font-size:11px;font-weight:700;color:${C.orange};margin-bottom:6px;">📉 نتيجة تسريع المشروع</div>
      <div style="font-size:12px;color:${C.text};line-height:1.7;">
        تم تقليص المدة من <strong>${f(crash.originalDuration, 2)}</strong> إلى 
        <strong>${f(crash.achievedDuration, 2)} أسبوع</strong> (توفير ${f(crash.originalDuration - crash.achievedDuration, 2)} أسبوع)
        بتكلفة مباشرة إضافية 
        <strong>${fDZD(crash.steps.reduce((s, st) => s + st.addedDirectCost, 0))}</strong>.
        ${crash.isTargetAchieved ? "المدة المستهدفة حُققت بالكامل." : `لم تُحقق المدة المستهدفة (${f(crash.targetDuration, 2)} أسبوع) — جميع إمكانيات التسريع استُنفدت.`}
        ${crash.minCostPoint ? ` النقطة الأمثل للتكلفة الإجمالية هي ${f(crash.minCostPoint.duration, 2)} أسبوع.` : ""}
      </div>
    </div>` : "";

  const riskSection = riskActs.length > 0 ? `
    ${subTitle("أنشطة الخطر · Activités à Risque", C.orange)}
    <div style="margin-bottom:14px;">
      ${riskActs.map((a) => `
        <div style="display:flex;align-items:center;gap:10px;padding:7px 12px;background:${C.orangeLight};
          border-radius:6px;margin-bottom:6px;">
          <span style="background:${C.orange};color:${C.white};padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;">${a.id}</span>
          <span style="font-size:12px;font-weight:600;">${a.name}</span>
          <span style="font-size:11px;color:${C.muted};margin-left:auto;">
            ${mode === "PERT"
              ? `σ² = ${f(a.variance, 4)} | σ = ${f(Math.sqrt(a.variance ?? 0), 3)}`
              : `Marge = ${f(a.slack, 2)} sem.`}
          </span>
        </div>`).join("")}
    </div>` : "";

  const recommItems = [
    `<div style="background:${C.primaryLight};border-right:4px solid ${C.primary};border-radius:7px;padding:10px 14px;margin-bottom:8px;">
      <div style="font-size:10px;font-weight:700;color:${C.primary};margin-bottom:3px;">⚠️ المسار الحرج · Surveillance Critique</div>
      <div style="font-size:12px;color:${C.text};direction:rtl;text-align:right;">
        يجب مراقبة الأنشطة ${critActs.map((a) => a.id).join("، ")} بصفة يومية — أي تأخر فيها يُؤخر المشروع بأكمله.
      </div>
    </div>`,
    mode === "PERT" && riskActs.length > 0
      ? `<div style="background:${C.orangeLight};border-right:4px solid ${C.orange};border-radius:7px;padding:10px 14px;margin-bottom:8px;">
          <div style="font-size:10px;font-weight:700;color:${C.orange};margin-bottom:3px;">📊 عدم اليقين PERT · Incertitude PERT</div>
          <div style="font-size:12px;color:${C.text};direction:rtl;text-align:right;">
            الأنشطة ${riskActs.map((a) => a.id).join("، ")} ذات تشتت عالٍ — أعد التقديرات مع الفريق لتضييق النطاق O-M-P.
          </div>
        </div>` : "",
    highSlackActs.length > 0
      ? `<div style="background:${C.greenLight};border-right:4px solid ${C.green};border-radius:7px;padding:10px 14px;margin-bottom:8px;">
          <div style="font-size:10px;font-weight:700;color:${C.green};margin-bottom:3px;">🔄 إعادة توزيع الموارد · Réaffectation</div>
          <div style="font-size:12px;color:${C.text};direction:rtl;text-align:right;">
            الأنشطة ${highSlackActs.map((a) => `${a.id} (مهلة ${f(a.slack, 1)} أسبوع)`).join("، ")} يمكن تأجيل بعض مواردها لتعزيز المسار الحرج.
          </div>
        </div>` : "",
  ].filter(Boolean).join("");

  const content = `
    ${sectionTitle("التحليل الموقفي والتوصيات", "Analyse Situationnelle & Recommandations")}
    ${situationParagraph}
    ${crashSection}
    ${subTitle("التوصيات الإدارية الأولوية", "Actions Managériales Prioritaires", C.primary)}
    ${recommItems}
    ${riskSection}`;

  return pageShell(content, pageNum, totalPages, "التوصيات · Recommandations");
}

// ── Page — Digital Stamp (identical to Simplex) ───────────────────────────────
function buildStamp(
  managerName: string, institutionName: string,
  reportId: string, generatedAt: string, totalPages: number
) {
  return `
  <div style="width:794px;min-height:1123px;font-family:'Cairo','Inter',sans-serif;color:${C.text};
    position:relative;box-sizing:border-box;display:flex;flex-direction:column;
    background:linear-gradient(160deg,${C.primaryLight} 0%,${C.white} 60%);">
    <div style="height:6px;background:${C.primary};"></div>
    <div style="background:${C.primary};padding:10px 40px;display:flex;align-items:center;justify-content:space-between;">
      <span style="color:${C.white};font-weight:700;font-size:16px;">OptimDZ</span>
      <span style="color:rgba(255,255,255,0.65);font-size:10px;">ختم رقمي · Cachet Numérique</span>
      <span style="color:rgba(255,255,255,0.6);font-size:10px;">${totalPages} / ${totalPages}</span>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;gap:28px;text-align:center;">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="95" fill="none" stroke="${C.primary}" stroke-width="3"/>
        <circle cx="100" cy="100" r="85" fill="none" stroke="${C.primary}" stroke-width="1" stroke-dasharray="6 4"/>
        <circle cx="100" cy="100" r="72" fill="${C.primaryLight}"/>
        <circle cx="100" cy="100" r="60" fill="none" stroke="${C.primary}" stroke-width="1.5" stroke-dasharray="3 2"/>
        <rect x="80" y="80" width="40" height="40" rx="8" fill="${C.primary}"/>
        <rect x="88" y="88" width="24" height="24" rx="4" fill="${C.white}"/>
        <rect x="94" y="94" width="12" height="12" rx="2" fill="${C.primary}"/>
        <path id="ta" d="M 20,100 A 80,80 0 0,1 180,100" fill="none"/>
        <text font-size="10" font-family="Cairo,Inter,sans-serif" font-weight="700" fill="${C.primary}">
          <textPath href="#ta" startOffset="12%">نظام OptimDZ للمسار الحرج PERT/CPM</textPath>
        </text>
        <path id="tb" d="M 20,100 A 80,80 0 0,0 180,100" fill="none"/>
        <text font-size="9" font-family="Cairo,Inter,sans-serif" fill="${C.muted}">
          <textPath href="#tb" startOffset="8%">Système de Planification · Algérie</textPath>
        </text>
        <text x="100" y="148" text-anchor="middle" fill="${C.primary}" font-size="11"
          font-family="Cairo,Inter,sans-serif" font-weight="700">${new Date().getFullYear()}</text>
      </svg>
      <div style="max-width:520px;">
        <div style="font-size:17px;font-weight:800;color:${C.primary};margin-bottom:8px;direction:rtl;">
          هذا التقرير صادر عن نظام OptimDZ للتخطيط الشبكي
        </div>
        <div style="font-size:12px;color:${C.muted};">
          Ce rapport a été généré par le module PERT/CPM du système OptimDZ.
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;max-width:520px;">
        ${[["رقم التقرير · N° Rapport", reportId],
           ["تاريخ الإنشاء · Date", generatedAt],
           ["المدير · Responsable", managerName || "—"],
           ["المؤسسة · Institution", institutionName || "—"],
        ].map(([label, value]) => `
          <div style="background:${C.white};border:1px solid ${C.border};border-radius:8px;padding:10px 14px;">
            <div style="font-size:9px;color:${C.muted};margin-bottom:2px;">${label}</div>
            <div style="font-size:12px;font-weight:700;">${value}</div>
          </div>`).join("")}
      </div>
      <div style="width:100%;max-width:520px;display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:12px;">
        ${["إمضاء المدير · Signature", "ختم المؤسسة · Cachet"].map((label) => `
          <div style="text-align:center;">
            <div style="border-bottom:1.5px solid ${C.text};height:50px;margin-bottom:6px;"></div>
            <div style="font-size:10px;color:${C.muted};">${label}</div>
          </div>`).join("")}
      </div>
    </div>
    <div style="height:6px;background:${C.accent};"></div>
  </div>`;
}

// ── Public export options ─────────────────────────────────────────────────────
export interface PertPDFOptions {
  projectName: string;
  sector?: string;
  mode: "CPM" | "PERT";
  result: PertCpmResult;
  crashResult?: CrashResult;
  managerName?: string;
  institutionName?: string;
  onProgress?: (step: string, pct: number) => void;
}

export async function generatePertPDFReport(opts: PertPDFOptions): Promise<void> {
  const {
    projectName, sector, mode, result, crashResult,
    managerName = "", institutionName = "", onProgress,
  } = opts;

  const reportId   = genId();
  const generatedAt = new Date().toLocaleString("fr-DZ", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  const criticalNames = result.criticalPath.map(
    (id) => result.activities.find((a) => a.id === id)?.name ?? id
  );

  // Build page list
  const hasCrash = !!(crashResult && crashResult.steps.length > 0);
  const hasPert  = mode === "PERT";
  // Pages: cover + activity + (pert?) + (crash?) + analysis + stamp
  const TOTAL = 3 + (hasPert ? 1 : 0) + (hasCrash ? 1 : 0) + 1;
  let pageNum = 2;
  const pages: string[] = [
    buildCover(
      projectName, sector, mode, result.projectDuration, result.criticalPath,
      criticalNames, managerName, institutionName, reportId, generatedAt, TOTAL
    ),
    buildActivityPage(result.activities, result.criticalPath, mode, TOTAL),
  ];

  if (hasPert) { pages.push(buildPertPage(result.activities, result, TOTAL)); pageNum++; }
  if (hasCrash) { pages.push(buildCrashPage(crashResult!, result.activities, TOTAL)); pageNum++; }

  const analysisPageNum = pages.length + 1;
  pages.push(buildAnalysisPage(projectName, mode, result, crashResult, analysisPageNum, TOTAL));
  pages.push(buildStamp(managerName, institutionName, reportId, generatedAt, TOTAL));

  // Render with html2canvas
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw  = pdf.internal.pageSize.getWidth();
  const ph  = pdf.internal.pageSize.getHeight();

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;z-index:-1;";
  document.body.appendChild(container);

  try {
    await document.fonts.ready;
    for (let i = 0; i < pages.length; i++) {
      onProgress?.(`Rendu page ${i + 1}/${TOTAL}…`, Math.round((i / TOTAL) * 85));
      container.innerHTML = pages[i];
      const el = container.firstElementChild as HTMLElement;
      await new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, allowTaint: true,
        backgroundColor: null, width: 794, windowWidth: 794, logging: false,
      });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", 0, 0, pw, ph, undefined, "FAST");
    }
    onProgress?.("Sauvegarde PDF…", 92);
    pdf.save(`OptimDZ_PERT_${reportId}.pdf`);
    onProgress?.("Terminé", 100);
  } finally {
    document.body.removeChild(container);
  }
}
