import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { BreakEvenResult } from "./breakEvenAlgorithm";

// ── Brand tokens (identical to other OptimDZ PDFs) ────────────────────────────
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
function fDA(n: number | undefined | null): string {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  return Math.round(n).toLocaleString("fr-DZ") + " DA";
}
function genId() {
  return `PF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
function sectorLabel(s?: string) {
  const m: Record<string, string> = {
    trade:       "تجارة / Commerce",
    industry:    "صناعة / Industrie",
    services:    "خدمات / Services",
    agriculture: "فلاحة / Agriculture",
    custom:      "مخصص / Personnalisé",
  };
  return s ? (m[s] ?? s) : "—";
}

// ── Page shell ────────────────────────────────────────────────────────────────
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
      <span style="font-size:9px;color:${C.muted};">نظام OptimDZ لتقييم جدوى المشاريع — Système OptimDZ d'Évaluation de Faisabilité de Projets</span>
      <span style="font-size:9px;color:${C.muted};">www.optimdz.replit.app</span>
    </div>
  </div>`;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
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
function analysisRow(icon: string, text: string, bg: string, border: string) {
  return `<div style="display:flex;align-items:flex-start;gap:10px;background:${bg};border:1px solid ${border};
    border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:11px;line-height:1.6;">
    <span style="font-size:14px;flex-shrink:0;">${icon}</span>
    <span>${text}</span>
  </div>`;
}
function suggestionRow(icon: string, title: string, desc: string, borderColor: string, bg: string) {
  return `<div style="border-left:4px solid ${borderColor};background:${bg};border-radius:0 8px 8px 0;
    padding:10px 14px;margin-bottom:10px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <span style="font-size:14px;">${icon}</span>
      <span style="font-size:12px;font-weight:700;color:${C.text};">${title}</span>
    </div>
    <div style="font-size:11px;color:${C.muted};line-height:1.6;">${desc}</div>
  </div>`;
}

// ── Page 1 — Cover ────────────────────────────────────────────────────────────
function buildCover(
  result: BreakEvenResult, projectName: string, sector: string | undefined,
  managerName: string, institutionName: string,
  reportId: string, generatedAt: string, totalPages: number
) {
  const pn = projectName || result.input.productName || "—";
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
        <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-top:1px;">نظام دعم القرار · تقييم جدوى المشاريع</div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 40px;text-align:center;gap:16px;">
      <div style="font-size:11px;letter-spacing:3px;color:${C.accent};text-transform:uppercase;font-weight:600;">تقرير رسمي · Rapport Officiel</div>
      <div style="font-size:26px;font-weight:800;line-height:1.3;direction:rtl;">تقرير جدوى المشروع — نقطة التعادل</div>
      <div style="font-size:16px;font-weight:400;color:rgba(255,255,255,0.8);">Rapport de Faisabilité de Projet — Seuil de Rentabilité</div>
      <div style="width:60px;height:3px;background:${C.accent};border-radius:2px;margin:8px 0;"></div>
      <div style="font-size:20px;font-weight:700;color:${C.accent};">${pn}</div>
      <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:12px 28px;margin-top:8px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;text-align:center;">
          <div>
            <div style="font-size:9px;opacity:0.65;margin-bottom:3px;">سعر البيع / Prix unitaire</div>
            <div style="font-size:16px;font-weight:800;">${fDA(result.input.sellingPrice)}</div>
          </div>
          <div>
            <div style="font-size:9px;opacity:0.65;margin-bottom:3px;">نقطة تعادل المشروع / Seuil du projet</div>
            <div style="font-size:16px;font-weight:800;">${f(result.breakEvenUnits, 1)} unités</div>
          </div>
          <div>
            <div style="font-size:9px;opacity:0.65;margin-bottom:3px;">رقم أعمال التعادل / CA seuil</div>
            <div style="font-size:16px;font-weight:800;">${fDA(result.breakEvenRevenue)}</div>
          </div>
          <div>
            <div style="font-size:9px;opacity:0.65;margin-bottom:3px;">نسبة هامش المساهمة / Taux CM</div>
            <div style="font-size:16px;font-weight:800;">${f(result.contributionMarginRatio, 1)} %</div>
          </div>
        </div>
      </div>
    </div>
    <div style="padding:0 40px 32px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${[
        ["المشروع / Projet",          pn],
        ["المسؤول / Responsable",      managerName     || "—"],
        ["المؤسسة / Institution",      institutionName || "—"],
        ["القطاع / Secteur",           sectorLabel(sector)],
        ["هامش المساهمة / CM/unité",   fDA(result.contributionMarginPerUnit)],
        ["رقم التقرير / N° Rapport",   reportId],
        ["تاريخ الإصدار / Date",       generatedAt],
        ["النوع / Type",               "Faisabilité — Seuil de Rentabilité"],
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

// ── Page 2 — Feasibility / CVP Analysis ───────────────────────────────────────
function buildFeasibilityPage(result: BreakEvenResult, totalPages: number) {
  const { input: inp, contributionMarginPerUnit: cm, contributionMarginRatio: cmr,
          breakEvenUnits: bepU, breakEvenRevenue: bepR } = result;

  const optionalKpis: string[] = [];
  if (result.targetProfitUnits !== undefined) {
    optionalKpis.push(kpiCard(
      "وحدات لبلوغ الربح المستهدف · Unités pour bénéfice cible",
      `${f(result.targetProfitUnits, 1)} unités`,
      C.secondary
    ));
    optionalKpis.push(kpiCard(
      "رقم أعمال الهدف · CA pour bénéfice cible",
      fDA(result.targetProfitRevenue),
      C.secondary
    ));
  }
  if (result.marginOfSafetyPct !== undefined) {
    optionalKpis.push(kpiCard(
      "هامش الأمان (%) · Marge de sécurité (%)",
      `${f(result.marginOfSafetyPct, 1)} %`,
      result.marginOfSafetyPct >= 20 ? C.green : C.orange
    ));
    if (result.operatingLeverage !== undefined) {
      optionalKpis.push(kpiCard(
        "الرافعة التشغيلية (DOL) · Levier opérationnel",
        `× ${f(result.operatingLeverage, 2)}`,
        C.text
      ));
    }
  }

  const tableRows = [
    ["Prix de vente unitaire du projet", "سعر بيع وحدة المشروع",           fDA(inp.sellingPrice),          C.white],
    ["Coût variable unitaire",           "التكلفة المتغيرة للوحدة",         fDA(inp.variableCost),           C.white],
    ["Marge sur coût variable (CM/u)",   "هامش المساهمة للوحدة",            fDA(cm),                         C.greenLight],
    ["Taux de marge (CM ratio)",         "نسبة هامش المساهمة",              `${f(cmr, 2)} %`,                C.greenLight],
    ["Charges fixes du projet (CF)",     "الأعباء الثابتة للمشروع",         fDA(inp.fixedCosts),             C.white],
    ["Seuil de rentabilité (unités)",    "نقطة تعادل المشروع (وحدات)",       `${f(bepU, 2)} unités`,          C.orangeLight],
    ["Seuil de rentabilité (CA)",        "نقطة تعادل المشروع (رقم أعمال)",  fDA(bepR),                       C.orangeLight],
    ...(inp.expectedSalesVolume !== undefined ? [
      ["Volume de ventes prévu / marché", "الحجم المتوقع / سعة السوق",       `${f(inp.expectedSalesVolume, 0)} unités`, C.white],
      ["Marge de sécurité (unités)",      "هامش الأمان (وحدات)",              `${f(result.marginOfSafetyUnits, 1)} unités`, C.white],
      ["Marge de sécurité (CA)",          "هامش الأمان (CA)",                  fDA(result.marginOfSafetyRevenue), C.white],
      ["Marge de sécurité (%)",           "نسبة هامش الأمان",                  `${f(result.marginOfSafetyPct, 2)} %`, C.white],
      ["Bénéfice net prévu du projet",    "الربح الصافي المتوقع للمشروع",      fDA(result.netProfit),           C.greenLight],
    ] : []),
    ...(inp.targetProfit !== undefined ? [
      ["Bénéfice cible du projet",        "الربح المستهدف للمشروع",            fDA(inp.targetProfit),           C.white],
      ["Unités pour bénéfice cible",      "وحدات الربح المستهدف",              `${f(result.targetProfitUnits, 1)} unités`, C.primaryLight],
    ] : []),
  ] as [string, string, string, string][];

  const rows = tableRows.map(([fr, ar, val, bg]) => `
    <tr style="background:${bg}">
      <td style="padding:7px 10px;border-bottom:1px solid ${C.border};font-size:11px;">${ar} · ${fr}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${C.border};text-align:right;font-family:monospace;font-weight:700;font-size:12px;">${val}</td>
    </tr>`).join("");

  const bepPct = Math.min(100, (bepU / (result.chartMaxUnits || 1)) * 100);
  const esvPct = inp.expectedSalesVolume
    ? Math.min(100, (inp.expectedSalesVolume / (result.chartMaxUnits || 1)) * 100)
    : null;

  const content = `
    ${sectionTitle("Analyse de Viabilité — Seuil de Rentabilité du Projet", "تحليل الجدوى — نقطة تعادل المشروع")}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">
      ${kpiCard("نقطة تعادل المشروع (وحدات) · Seuil projet (unités)", f(bepU, 1) + " unités",  C.primary)}
      ${kpiCard("نقطة تعادل المشروع (CA) · Seuil projet (CA)",        fDA(bepR),                C.orange)}
      ${kpiCard("هامش المساهمة/وحدة · CM/unité",                       fDA(cm),                  C.secondary)}
      ${kpiCard("نسبة الهامش · Taux CM",                                f(cmr, 2) + " %",         C.text)}
    </div>
    ${optionalKpis.length > 0 ? `
    <div style="display:grid;grid-template-columns:repeat(${Math.min(optionalKpis.length, 4)},1fr);gap:10px;margin-bottom:18px;">
      ${optionalKpis.join("")}
    </div>` : ""}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:18px;">
      <div>
        ${subTitle("Tableau de Viabilité du Projet", "جدول جدوى المشروع", C.primary)}
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:${C.primary};color:${C.white};">
              <th style="padding:7px 10px;text-align:left;">البيان · Indicateur</th>
              <th style="padding:7px 10px;text-align:right;">القيمة · Valeur</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div>
        ${subTitle("موقع نقطة التعادل · Position du seuil", "Seuil sur l'axe des unités", C.orange)}
        <div style="background:${C.white};border:1px solid ${C.border};border-radius:8px;padding:14px;font-size:10px;">
          <div style="margin-bottom:8px;font-weight:700;font-size:11px;color:${C.primary};">نقطة تعادل المشروع على محور الكميات</div>
          <div style="position:relative;height:12px;background:#e0e0e0;border-radius:6px;margin-bottom:6px;overflow:hidden;">
            <div style="position:absolute;left:0;top:0;height:100%;width:${bepPct}%;background:${C.orange};border-radius:6px;"></div>
            ${esvPct ? `<div style="position:absolute;left:0;top:0;height:100%;width:${esvPct}%;background:${C.secondary};opacity:0.5;border-radius:6px;"></div>` : ""}
          </div>
          <div style="display:flex;justify-content:space-between;color:${C.muted};margin-bottom:12px;">
            <span>0</span>
            <span style="color:${C.orange};font-weight:700;">● Seuil: ${f(bepU, 1)}</span>
            ${esvPct ? `<span style="color:${C.secondary};font-weight:700;">● Vol.prévu: ${f(inp.expectedSalesVolume, 0)}</span>` : ""}
            <span>${f(result.chartMaxUnits, 0)}</span>
          </div>
          <div style="font-size:10px;color:${C.text};line-height:1.6;">
            <div style="margin-bottom:4px;"><strong>Droite du CA:</strong> y = ${fDA(inp.sellingPrice)} × Qté</div>
            <div style="margin-bottom:4px;"><strong>Droite du CT:</strong> y = ${fDA(inp.fixedCosts)} + ${fDA(inp.variableCost)} × Qté</div>
            <div style="margin-bottom:4px;"><strong>Intersection (seuil projet):</strong> (${f(bepU, 1)} u. ; ${fDA(bepR)})</div>
            ${inp.expectedSalesVolume ? `<div style="color:${result.marginOfSafetyPct! >= 20 ? C.green : C.orange};font-weight:700;">
              Marge de sécurité: ${f(result.marginOfSafetyPct, 1)} % — ${(result.marginOfSafetyPct! >= 20) ? "Satisfaisante ✓" : "À surveiller ⚠"}
            </div>` : ""}
          </div>
        </div>
        <div style="margin-top:12px;background:${C.primaryLight};border-radius:8px;padding:12px;">
          <div style="font-size:10px;font-weight:700;color:${C.primary};margin-bottom:6px;">صيغ التعادل المستخدمة · Formules</div>
          <div style="font-family:monospace;color:${C.text};line-height:1.9;font-size:10px;">
            CM/u = PV − CV = ${fDA(cm)}<br/>
            Taux CM = CM/u ÷ PV = ${f(cmr, 2)} %<br/>
            Seuil projet (Q) = CF ÷ CM/u = ${f(bepU, 2)} unités<br/>
            Seuil projet (CA) = CF ÷ Taux CM = ${fDA(bepR)}
            ${inp.expectedSalesVolume ? `<br/>MS% = (Qvol−Qseuil) ÷ Qvol × 100 = ${f(result.marginOfSafetyPct, 2)} %` : ""}
            ${result.operatingLeverage ? `<br/>DOL = CM totale ÷ Résultat = ×${f(result.operatingLeverage, 2)}` : ""}
          </div>
        </div>
      </div>
    </div>`;
  return pageShell(content, 2, totalPages, "جدوى المشروع · Faisabilité & Seuil de Rentabilité");
}

// ── Page 3 — Feasibility Evaluation & Go/No-Go Recommendations ────────────────
function buildEvaluationPage(
  result: BreakEvenResult, projectName: string, sector: string | undefined, totalPages: number
) {
  const { input: inp, contributionMarginRatio: cmr, breakEvenUnits: bepU } = result;

  const riskLevelAr = cmr < 30 ? "عالية" : cmr < 50 ? "متوسطة" : "منخفضة";

  const analysisItems: [string, string, string, string][] = [
    ["🏗️",
     `المشروع "${projectName || inp.productName || "—"}" ينتمي إلى قطاع ${sectorLabel(sector)}. ` +
     `سعر البيع المقرر ${inp.sellingPrice.toLocaleString("fr-DZ")} DA للوحدة، ` +
     `التكلفة المتغيرة ${inp.variableCost.toLocaleString("fr-DZ")} DA، والأعباء الثابتة المرتبطة بالمشروع ${inp.fixedCosts.toLocaleString("fr-DZ")} DA.`,
     C.primaryLight, C.primary + "50"],
    ["📊",
     `نقطة تعادل المشروع عند ${f(bepU, 1)} وحدة (رقم أعمال ${Math.round(result.breakEvenRevenue).toLocaleString("fr-DZ")} DA). ` +
     `هامش المساهمة ${Math.round(result.contributionMarginPerUnit).toLocaleString("fr-DZ")} DA/وحدة، نسبة ${f(cmr, 1)}%. ` +
     `قبل الوصول إلى هذا الحجم، سيُسجّل المشروع خسائر تشغيلية.`,
     C.greenLight, C.green + "50"],
    [`${cmr >= 50 ? "✅" : cmr >= 30 ? "⚠️" : "🔴"}`,
     `مستوى مخاطرة الالتزام بالأعباء الثابتة: ${riskLevelAr}. ` +
     (cmr >= 50
       ? "نسبة هامش مريحة — نقطة التعادل قابلة للتحقق بحجم مبيعات معتدل. ملف المشروع جيد من منظور التعادل."
       : cmr >= 30
       ? "نسبة هامش مقبولة، لكن تقييم قدرة السوق على استيعاب الحجم المطلوب ضروري قبل الالتزام بالأعباء الثابتة."
       : "نسبة هامش منخفضة — يلزم حجم مبيعات مرتفع للوصول لنقطة التعادل. مخاطر الخسارة عالية عند تأخر بلوغ النقطة."),
     cmr >= 50 ? C.greenLight : cmr >= 30 ? C.orangeLight : "#ffebee",
     cmr >= 50 ? C.green + "50" : cmr >= 30 ? C.orange + "50" : "#ef9a9a"],
    ...(result.marginOfSafetyPct !== undefined ? [[
      `${result.marginOfSafetyPct >= 25 ? "🛡️" : result.marginOfSafetyPct >= 10 ? "⚠️" : "🔴"}`,
      `هامش أمان المشروع عند التشغيل الكامل: ${f(result.marginOfSafetyPct, 1)}% ` +
      `(${f(result.marginOfSafetyUnits, 1)} وحدة / ${Math.round(result.marginOfSafetyRevenue ?? 0).toLocaleString("fr-DZ")} DA). ` +
      (result.marginOfSafetyPct >= 25
        ? "هامش مريح — المشروع يتحمّل تراجعاً في المبيعات قبل الوصول للخسارة."
        : result.marginOfSafetyPct >= 10
        ? "هامش ضيق — يستوجب خطة تسويقية قوية لضمان استدامة النشاط."
        : "هامش حرج — أي انخفاض في الطلب يعرّض المشروع لخسارة فورية. مراجعة التكاليف أو التسعير ضرورية."),
      result.marginOfSafetyPct >= 25 ? C.greenLight : result.marginOfSafetyPct >= 10 ? C.orangeLight : "#ffebee",
      result.marginOfSafetyPct >= 25 ? C.green + "50" : result.marginOfSafetyPct >= 10 ? C.orange + "50" : "#ef9a9a",
    ] as [string, string, string, string]] : []),
  ];

  const suggestions: [string, string, string, string, string][] = [
    ["🎯", "التحقق من قدرة السوق على الاستيعاب · Valider l'absorption du marché",
     `نقطة التعادل تتطلب بيع ${f(bepU, 1)} وحدة دورياً. قبل الالتزام بالأعباء الثابتة للمشروع، قدّر حجم السوق المحلي وتحقق من واقعية الوصول لهذا الحجم في السيناريو الأدنى.`,
     C.primary, C.primaryLight],
    ["📅", "وضع خطة زمنية للوصول إلى التعادل · Planifier l'atteinte du seuil",
     `المشروع الجديد لا يبلغ حجمه الكامل يوم الافتتاح. ضع سيناريو تصاعدياً: في الشهر الأول كم وحدة تستطيع بيعها؟ متى ستصل إلى ${f(bepU, 1)} وحدة؟ هذا المسار يُحدد خطة تمويل الخسائر الأولية.`,
     C.secondary, C.greenLight],
    ["💸", "تمويل مرحلة ما قبل التعادل · Financer la période de lancement",
     `قبل بلوغ ${f(bepU, 1)} وحدة، المشروع يعمل بخسارة تشغيلية. حسب معدل المبيعات الأولي المتوقع، احسب إجمالي الخسائر المتراكمة وتأكد من أن التمويل المتاح (قرض، رأس مال ذاتي) يُغطي هذه المرحلة.`,
     C.orange, C.orangeLight],
    ...(inp.fixedCosts / (inp.sellingPrice * bepU) > 0.5 ? [[
      "🏭", "مراجعة حجم الأعباء الثابتة قبل الالتزام · Revisiter les charges fixes",
      `الأعباء الثابتة المرتبطة بالمشروع مرتفعة نسبياً (${f((inp.fixedCosts / (inp.sellingPrice * bepU)) * 100, 1)}% من رقم أعمال التعادل). ` +
      `ادرس إمكانية تخفيض الالتزامات الثابتة في المرحلة الأولى: استئجار قصير الأجل، معدات مستعملة، عمالة موسمية.`,
      C.secondary, C.greenLight] as [string, string, string, string, string]] : []),
    ...(result.marginOfSafetyPct !== undefined && result.marginOfSafetyPct < 20 ? [[
      "⚠️", "هامش أمان غير كافٍ — إعادة النظر في التسعير · Revoir le modèle économique",
      `هامش الأمان ${f(result.marginOfSafetyPct, 1)}% يعني أن تراجعاً بسيطاً في الطلب يُعيد المشروع إلى الخسارة. ` +
      `درّس رفع السعر بنسبة 10–15% أو تخفيض التكاليف المتغيرة عبر التفاوض مع الموردين قبل إطلاق المشروع.`,
      C.orange, C.orangeLight] as [string, string, string, string, string]] : []),
    ...(result.targetProfitUnits !== undefined ? [[
      "📈", "خطة تحقيق الربح المستهدف · Atteindre le bénéfice cible du projet",
      `لتحقيق الربح المستهدف ${fDA(inp.targetProfit)}، يلزم بيع ${f(result.targetProfitUnits, 1)} وحدة ` +
      `(${f((result.targetProfitUnits ?? 0) - bepU, 1)} وحدة إضافية فوق نقطة التعادل). ` +
      `ضع جدولاً زمنياً واضحاً لبلوغ هذا المستوى وادرس الأدوات التسويقية اللازمة.`,
      C.primary, C.primaryLight] as [string, string, string, string, string]] : []),
  ];

  const analysisHtml = analysisItems.map(([icon, text, bg, border]) =>
    analysisRow(icon, text, bg, border)
  ).join("");
  const suggestionsHtml = suggestions.map(([icon, title, desc, border, bg]) =>
    suggestionRow(icon, title, desc, border, bg)
  ).join("");

  const content = `
    ${sectionTitle("هل المشروع مجدٍ؟ — التقييم الموقفي", "Le projet est-il viable? — Évaluation")}
    ${analysisHtml}
    <div style="margin-top:20px;">
      ${sectionTitle("توصيات قبل الالتزام بالمشروع · Recommandations Pré-lancement", "Recommandations Go / No-Go")}
      ${suggestionsHtml}
    </div>`;
  return pageShell(content, 3, totalPages, "التقييم والتوصيات · Évaluation Go/No-Go");
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
        <div style="font-size:22px;font-weight:800;color:${C.primary};">تقرير جدوى معتمد · Rapport Certifié</div>
        <div style="font-size:13px;color:${C.muted};margin-top:4px;">نظام OptimDZ لتقييم جدوى المشاريع</div>
      </div>
      <div style="border:2px dashed ${C.border};border-radius:12px;padding:20px 40px;display:inline-block;">
        <div style="font-size:11px;color:${C.muted};margin-bottom:6px;">رقم تقرير الجدوى · Numéro du rapport</div>
        <div style="font-size:18px;font-family:monospace;font-weight:700;color:${C.primary};letter-spacing:2px;">${reportId}</div>
        <div style="font-size:10px;color:${C.muted};margin-top:6px;">${generatedAt}</div>
      </div>
      <div style="font-size:11px;color:${C.muted};max-width:420px;line-height:1.7;">
        هذا التقرير صادر تلقائياً من نظام OptimDZ لتقييم جدوى المشاريع — نقطة التعادل.
        القيم المحسوبة مبنية على البيانات المُدخلة وتُعدّ مؤشرات مساعدة لقرار الاستثمار.
        <br/><br/>
        Ce rapport a été généré automatiquement par le système OptimDZ d'évaluation de faisabilité de projets.
        Les indicateurs calculés sont basés sur les données saisies et constituent une aide à la décision d'investissement.
      </div>
    </div>`;
  return pageShell(content, totalPages, totalPages, "الختم الرقمي · Cachet Numérique");
}

// ── Render an HTML string to a jsPDF page ────────────────────────────────────
async function addHtmlPage(pdf: jsPDF, html: string, pageWidth: number) {
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:-9999px;z-index:-1;";
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
      scale: 2, useCORS: true, logging: false,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pageHeight = (canvas.height / canvas.width) * pageWidth;
    pdf.addPage([pageWidth, pageHeight]);
    pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);
  } finally {
    document.body.removeChild(container);
  }
}

// ── Main export ────────────────────────────────────────────────────────────────
export interface ProjectFeasibilityPDFOptions {
  result: BreakEvenResult;
  projectName?: string;
  sector?: string;
  managerName?: string;
  institutionName?: string;
}

export async function generateProjectFeasibilityPDFReport(opts: ProjectFeasibilityPDFOptions): Promise<void> {
  const { result, projectName = "", sector, managerName = "", institutionName = "" } = opts;
  const reportId    = genId();
  const generatedAt = new Date().toLocaleDateString("fr-DZ", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const PAGE_W     = 210; // mm A4
  const totalPages = 4;

  const coverHtml      = buildCover(result, projectName, sector, managerName, institutionName, reportId, generatedAt, totalPages);
  const feasibilityHtml = buildFeasibilityPage(result, totalPages);
  const evaluationHtml  = buildEvaluationPage(result, projectName, sector, totalPages);
  const stampHtml       = buildStampPage(reportId, generatedAt, totalPages);

  // Render cover first
  const coverContainer = document.createElement("div");
  coverContainer.style.cssText = "position:fixed;left:-9999px;top:-9999px;z-index:-1;";
  coverContainer.innerHTML = coverHtml;
  document.body.appendChild(coverContainer);

  const coverCanvas = await html2canvas(coverContainer.firstElementChild as HTMLElement, {
    scale: 2, useCORS: true, logging: false,
  });
  const coverImgData = coverCanvas.toDataURL("image/jpeg", 0.92);
  const coverPageH   = (coverCanvas.height / coverCanvas.width) * PAGE_W;
  document.body.removeChild(coverContainer);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [PAGE_W, coverPageH] });
  pdf.addImage(coverImgData, "JPEG", 0, 0, PAGE_W, coverPageH);

  await addHtmlPage(pdf, feasibilityHtml, PAGE_W);
  await addHtmlPage(pdf, evaluationHtml,  PAGE_W);
  await addHtmlPage(pdf, stampHtml,       PAGE_W);

  const safeName = (projectName || result.input.productName || "projet").replace(/\s+/g, "_");
  const filename = `OptimDZ_JdM_${safeName}_${Date.now()}.pdf`;
  pdf.save(filename);
}
