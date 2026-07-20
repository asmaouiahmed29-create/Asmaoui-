// ── Types ─────────────────────────────────────────────────────────────────────
export type ForecastMode = "moving-average" | "exponential";

export interface HistoryPoint {
  period: string; // label e.g. "T1", "يناير 2024"
  value: number;
}

export interface ForecastProduct {
  id: string;
  name: string;
  history: HistoryPoint[];
  windowSize: number; // Moving Average: k periods (≥1)
  alpha: number;      // Exponential Smoothing: α ∈ (0,1)
}

export interface ForecastDataPoint {
  period: string;
  actual: number | null;
  forecast: number | null;
}

export interface ForecastResult {
  id: string;
  name: string;
  mode: ForecastMode;
  history: HistoryPoint[];
  dataPoints: ForecastDataPoint[]; // historical + one future point
  nextForecast: number;
  mae: number;   // Mean Absolute Error on in-sample forecasts
  mape: number;  // Mean Absolute Percentage Error (%)
  trend: "increasing" | "decreasing" | "stable";
  volatility: "high" | "medium" | "low";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function detectTrend(values: number[]): "increasing" | "decreasing" | "stable" {
  if (values.length < 3) return "stable";
  const half = Math.floor(values.length / 2);
  const first  = values.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const second = values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
  const pct = (second - first) / (first || 1);
  if (pct > 0.05)  return "increasing";
  if (pct < -0.05) return "decreasing";
  return "stable";
}

function detectVolatility(values: number[]): "high" | "medium" | "low" {
  if (values.length < 2) return "low";
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const cv   = Math.sqrt(
    values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
  ) / (mean || 1);
  if (cv > 0.25) return "high";
  if (cv > 0.12) return "medium";
  return "low";
}

function calcMAE(actuals: number[], forecasts: number[]): number {
  const n = Math.min(actuals.length, forecasts.length);
  if (n === 0) return 0;
  return actuals.slice(0, n).reduce((s, a, i) => s + Math.abs(a - forecasts[i]), 0) / n;
}

function calcMAPE(actuals: number[], forecasts: number[]): number {
  const n = Math.min(actuals.length, forecasts.length);
  if (n === 0) return 0;
  const pairs = actuals.slice(0, n).map((a, i) => ({ a, f: forecasts[i] })).filter(p => p.a !== 0);
  if (pairs.length === 0) return 0;
  return pairs.reduce((s, p) => s + Math.abs(p.a - p.f) / Math.abs(p.a), 0) / pairs.length * 100;
}

// ── Moving Average ────────────────────────────────────────────────────────────
export function computeMovingAverage(product: ForecastProduct): ForecastResult {
  const vals = product.history.map(h => h.value);
  const k    = Math.max(1, Math.min(product.windowSize, vals.length));
  const dataPoints: ForecastDataPoint[] = [];
  const inSampleActuals:   number[] = [];
  const inSampleForecasts: number[] = [];

  for (let t = 0; t < vals.length; t++) {
    let forecast: number | null = null;
    if (t >= k) {
      forecast = vals.slice(t - k, t).reduce((a, b) => a + b, 0) / k;
      inSampleActuals.push(vals[t]);
      inSampleForecasts.push(forecast);
    }
    dataPoints.push({ period: product.history[t].period, actual: vals[t], forecast });
  }

  const nextForecast = vals.length >= k
    ? vals.slice(-k).reduce((a, b) => a + b, 0) / k
    : vals.length > 0 ? vals[vals.length - 1] : 0;

  // Auto-label next period
  const lastLabel = product.history[product.history.length - 1]?.period ?? "T0";
  const match = lastLabel.match(/(\d+)$/);
  const nextLabel = match ? lastLabel.replace(/(\d+)$/, String(Number(match[1]) + 1)) : lastLabel + "+1";
  dataPoints.push({ period: nextLabel, actual: null, forecast: nextForecast });

  return {
    id: product.id,
    name: product.name,
    mode: "moving-average",
    history: product.history,
    dataPoints,
    nextForecast,
    mae:  calcMAE(inSampleActuals, inSampleForecasts),
    mape: calcMAPE(inSampleActuals, inSampleForecasts),
    trend:      detectTrend(vals),
    volatility: detectVolatility(vals),
  };
}

// ── Simple Exponential Smoothing ──────────────────────────────────────────────
export function computeExponentialSmoothing(product: ForecastProduct): ForecastResult {
  const vals  = product.history.map(h => h.value);
  const alpha = Math.max(0.01, Math.min(0.99, product.alpha));
  const dataPoints: ForecastDataPoint[] = [];
  const inSampleActuals:   number[] = [];
  const inSampleForecasts: number[] = [];

  // Initialise with first actual value (level = S1 = Y1)
  let S = vals[0] ?? 0;

  for (let t = 0; t < vals.length; t++) {
    const forecast: number | null = t === 0 ? null : S;
    if (t > 0) {
      inSampleActuals.push(vals[t]);
      inSampleForecasts.push(S);
    }
    dataPoints.push({ period: product.history[t].period, actual: vals[t], forecast });
    S = alpha * vals[t] + (1 - alpha) * S;
  }

  const nextForecast = S;
  const lastLabel = product.history[product.history.length - 1]?.period ?? "T0";
  const match = lastLabel.match(/(\d+)$/);
  const nextLabel = match ? lastLabel.replace(/(\d+)$/, String(Number(match[1]) + 1)) : lastLabel + "+1";
  dataPoints.push({ period: nextLabel, actual: null, forecast: nextForecast });

  return {
    id: product.id,
    name: product.name,
    mode: "exponential",
    history: product.history,
    dataPoints,
    nextForecast,
    mae:  calcMAE(inSampleActuals, inSampleForecasts),
    mape: calcMAPE(inSampleActuals, inSampleForecasts),
    trend:      detectTrend(vals),
    volatility: detectVolatility(vals),
  };
}

// ── Entry point ───────────────────────────────────────────────────────────────
export function computeForecast(
  products: ForecastProduct[],
  mode: ForecastMode
): ForecastResult[] {
  return products.map(p =>
    mode === "moving-average"
      ? computeMovingAverage(p)
      : computeExponentialSmoothing(p)
  );
}
