import { useMemo } from "react";
import type { ProblemInput, SolveResult } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Coins, Package2, AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

interface Props {
  input: ProblemInput;
  result: SolveResult;
}

const COLORS = {
  green: "#16a34a",
  blue: "#2563eb",
  indigo: "#4f46e5",
  orange: "#ea580c",
  red: "#dc2626",
  teal: "#0d9488",
  slate: "#94a3b8",
};

const CONTRIB_PALETTE = [
  "#16a34a", "#15803d", "#166534", "#14532d",
  "#0d9488", "#0891b2", "#2563eb", "#4f46e5",
];

function fmt(n: number, lang: string, decimals = 2) {
  return n.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR", {
    maximumFractionDigits: decimals,
  });
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  labelSec: string;
  value: React.ReactNode;
  sub?: string;
  className?: string;
}

function MetricCard({ icon, label, labelSec, value, sub, className }: MetricCardProps) {
  return (
    <Card className={cn("border-2 overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="rounded-xl p-2.5 bg-background/60">{icon}</div>
        </div>
        <div className="mt-3">
          <p className="text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5 font-mono">{sub}</p>}
        </div>
        <div className="mt-2">
          <p className="text-sm font-semibold text-foreground/80">{label}</p>
          <p className="text-xs text-muted-foreground">{labelSec}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DonutCard({
  name,
  used,
  remaining,
  usagePct,
  binding,
  unit,
  lang,
}: {
  name: string;
  used: number;
  remaining: number;
  usagePct: number;
  binding: boolean;
  unit: string;
  lang: string;
}) {
  const { t } = useLanguage();
  const data = [
    { name: t("Utilisé", "مستخدم"), value: used },
    { name: t("Disponible", "متاح"), value: Math.max(remaining, 0) },
  ];
  const usedColor = binding ? COLORS.red : COLORS.green;
  const remainingColor = binding ? "#fca5a5" : "#86efac";

  return (
    <div className={cn(
      "rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all",
      binding ? "border-red-300 bg-red-50/40" : "border-green-300 bg-green-50/40"
    )}>
      <p className="text-sm font-semibold text-foreground text-center leading-tight">{name}</p>
      {unit && <p className="text-xs text-muted-foreground -mt-1">{unit}</p>}

      <div className="relative w-28 h-28">
        <PieChart width={112} height={112}>
          <Pie
            data={data}
            cx={52}
            cy={52}
            innerRadius={32}
            outerRadius={50}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
            animationBegin={200}
            animationDuration={900}
          >
            <Cell fill={usedColor} />
            <Cell fill={remainingColor} />
          </Pie>
        </PieChart>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn(
            "text-lg font-extrabold",
            binding ? "text-red-700" : "text-green-700"
          )}>
            {usagePct}%
          </span>
        </div>
      </div>

      <div className="w-full space-y-1 text-xs">
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: usedColor }} />
            {t("مستخدم", "Utilisé")}
          </span>
          <span className="font-mono font-bold">{fmt(used, lang, 1)}</span>
        </div>
        <div className="flex justify-between items-center text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: remainingColor }} />
            {t("متاح", "Disponible")}
          </span>
          <span className="font-mono">{fmt(Math.max(remaining, 0), lang, 1)}</span>
        </div>
      </div>

      <span className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-bold border",
        binding
          ? "bg-red-100 text-red-800 border-red-300"
          : "bg-green-100 text-green-800 border-green-300"
      )}>
        {binding ? t("مُقيِّد", "Saturé") : t("فائض", "Surplus")}
      </span>
    </div>
  );
}

const CustomBarTooltip = ({
  active, payload, label, unit, lang
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit?: string;
  lang: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover/95 backdrop-blur-sm px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="font-mono text-primary mt-0.5">
        {fmt(payload[0].value, lang)} {unit ?? ""}
      </p>
    </div>
  );
};

export function KPIDashboard({ input, result }: Props) {
  const { t, language } = useLanguage();
  const isMax = input.objectiveType === "maximize";
  const optVal = result.optimalValue ?? 0;
  const vars = result.variables ?? [];
  const sa = result.sensitivityAnalysis;

  const bindingCount = sa?.constraints.filter((c) => c.isCritical).length ?? 0;
  const surplusCount = (sa?.constraints.length ?? 0) - bindingCount;

  // Allocation bar data
  const maxQty = Math.max(...vars.map((v) => v.value), 1);
  const allocationData = vars.map((v) => ({ name: v.name, value: v.value, unit: v.unit ?? "" }));

  // Contribution bar data (coefficient × quantity)
  const contributionData = useMemo(() => {
    return [...vars]
      .map((v, i) => ({
        name: v.name,
        value: Math.round(Math.abs(input.variables[i].coefficient * v.value) * 100) / 100,
      }))
      .filter((d) => d.value > 1e-6)
      .sort((a, b) => b.value - a.value);
  }, [vars, input.variables]);

  // Resource usage donut data
  const resourceData = useMemo(() => {
    return input.constraints.map((c, i) => {
      const used = vars.reduce((sum, v, j) => sum + c.coefficients[j] * v.value, 0);
      const remaining = c.rhs - used;
      const usagePct = c.rhs > 0 ? Math.round((used / c.rhs) * 100) : 0;
      const binding = sa?.constraints[i]?.isCritical ?? false;
      return {
        name: c.name,
        used: Math.round(used * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        usagePct,
        binding,
        unit: c.unit ?? "",
      };
    });
  }, [input.constraints, vars, sa]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <BarChart3 className="w-6 h-6" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {t("لوحة المؤشرات", "Tableau de Bord")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("Tableau de Bord", "لوحة المؤشرات")} — {t("نظرة عامة على الأداء", "Vue d'ensemble des performances")}
          </p>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Coins className="w-6 h-6 text-green-600" />}
          label={isMax ? t("الربح الأمثل", "Profit optimal") : t("التكلفة المثلى", "Coût optimal")}
          labelSec={isMax ? t("Profit optimal", "الربح الأمثل") : t("Coût optimal", "التكلفة المثلى")}
          value={
            <span className="text-green-700">
              {fmt(optVal, language, 0)}
            </span>
          }
          sub="DZD / دج"
          className="border-green-300 bg-gradient-to-br from-green-50 to-emerald-50/30"
        />

        <MetricCard
          icon={<Package2 className="w-6 h-6 text-blue-600" />}
          label={t("المنتجات النشطة", "Produits actifs")}
          labelSec={t("Produits actifs", "المنتجات النشطة")}
          value={<span className="text-blue-700">{vars.filter((v) => v.value > 1e-6).length}</span>}
          sub={`/ ${vars.length} ${t("إجمالي", "total")}`}
          className="border-blue-200 bg-gradient-to-br from-blue-50/60 to-indigo-50/20"
        />

        <MetricCard
          icon={<AlertTriangle className="w-6 h-6 text-orange-500" />}
          label={t("قيود مُقيِّدة", "Contraintes actives")}
          labelSec={t("Contraintes actives", "قيود مُقيِّدة")}
          value={<span className={bindingCount > 0 ? "text-orange-600" : "text-muted-foreground"}>{bindingCount}</span>}
          sub={t("عنق الزجاجة", "goulots d'étranglement")}
          className={cn(
            "border-orange-200 bg-gradient-to-br from-orange-50/60 to-amber-50/20",
            bindingCount === 0 && "opacity-60"
          )}
        />

        <MetricCard
          icon={<CheckCircle2 className="w-6 h-6 text-teal-600" />}
          label={t("موارد فائضة", "Ressources excédentaires")}
          labelSec={t("Ressources excédentaires", "موارد فائضة")}
          value={<span className="text-teal-700">{surplusCount}</span>}
          sub={t("مورد غير مُقيِّد", "ressource non contraignante")}
          className="border-teal-200 bg-gradient-to-br from-teal-50/60 to-cyan-50/20"
        />
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Allocation bar chart */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {t("الكميات المثلى", "Quantités optimales")}
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                {t("Quantités optimales", "الكميات المثلى")} — {t("خطة الإنتاج/التخصيص", "Plan de production/allocation")}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {allocationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={allocationData}
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  layout="vertical"
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => fmt(v, language, 0)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fontSize: 11, fill: "#374151", fontWeight: 600 }}
                  />
                  <RechartTooltip
                    content={({ active, payload, label }) => (
                      <CustomBarTooltip
                        active={active}
                        payload={payload as { value: number }[]}
                        label={label as string}
                        lang={language}
                      />
                    )}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 6, 6, 0]}
                    animationDuration={900}
                    animationBegin={100}
                  >
                    {allocationData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.value === maxQty ? COLORS.green : COLORS.blue}
                        fillOpacity={entry.value > 1e-6 ? 1 : 0.25}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center">
                {t("لا توجد بيانات", "Aucune donnée")}
              </p>
            )}
            <p className="text-xs text-muted-foreground text-center mt-1">
              <span className="inline-flex items-center gap-1 mr-3">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.green }} />
                {t("الأعلى قيمة", "Valeur la plus haute")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.blue }} />
                {t("الباقون", "Autres")}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Profit contribution bar chart */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {t("مساهمة كل منتج في الربح", "Contribution au profit par produit")}
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                {t("Contribution au profit par produit", "مساهمة كل منتج في الربح")} — {t("مرتبة تنازلياً", "triée par ordre décroissant")}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {contributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={contributionData}
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  layout="vertical"
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => fmt(v, language, 0)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fontSize: 11, fill: "#374151", fontWeight: 600 }}
                  />
                  <RechartTooltip
                    content={({ active, payload, label }) => (
                      <CustomBarTooltip
                        active={active}
                        payload={payload as { value: number }[]}
                        label={label as string}
                        lang={language}
                        unit="DZD"
                      />
                    )}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 6, 6, 0]}
                    animationDuration={900}
                    animationBegin={300}
                  >
                    {contributionData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={CONTRIB_PALETTE[index % CONTRIB_PALETTE.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center">
                {t("لا توجد بيانات", "Aucune donnée")}
              </p>
            )}
            <p className="text-xs text-muted-foreground text-center mt-1">
              {t("القيمة = المعامل × الكمية", "Valeur = coefficient × quantité")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Resource usage donuts */}
      {resourceData.length > 0 && (
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {t("استخدام الموارد", "Utilisation des ressources")}
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                {t("Utilisation des ressources", "استخدام الموارد")} —{" "}
                {t("المستخدم مقابل المتاح لكل قيد", "Utilisé vs Disponible pour chaque contrainte")}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "grid gap-4",
              resourceData.length === 1 && "grid-cols-1 max-w-xs mx-auto",
              resourceData.length === 2 && "grid-cols-2",
              resourceData.length === 3 && "grid-cols-3",
              resourceData.length >= 4 && "grid-cols-2 md:grid-cols-4",
            )}>
              {resourceData.map((r, i) => (
                <DonutCard key={i} {...r} lang={language} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
