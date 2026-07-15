// ── Network Diagram (Activity-on-Node, SVG) ─────────────────────────────────
import { fmt } from "@/lib/pertCpmAlgorithm";
import type { ActivityResult } from "@/lib/pertCpmAlgorithm";

interface Props {
  results: ActivityResult[];
  /** predecessor lists, keyed by activity id */
  predecessors: Record<string, string[]>;
  criticalPath: string[];
  t: (fr: string, ar: string) => string;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const NW = 174;   // node width
const NH = 84;    // node height (3 rows × 28px)
const HG = 72;    // horizontal gap between columns
const VG = 24;    // vertical gap within column
const PAD = 22;   // diagram padding

// ── Compute layer-based layout ────────────────────────────────────────────────
function computeLayout(results: ActivityResult[], preds: Record<string, string[]>) {
  const ids = new Set(results.map((r) => r.id));
  const levelMap = new Map<string, number>();

  // Compute longest path level (results are already in topo order)
  for (const r of results) {
    const ps = (preds[r.id] ?? []).filter((p) => ids.has(p));
    const lv = ps.length > 0 ? Math.max(...ps.map((p) => levelMap.get(p) ?? 0)) + 1 : 0;
    levelMap.set(r.id, lv);
  }

  const maxLevel = Math.max(...[...levelMap.values()], 0);
  const byLevel  = new Map<number, string[]>();
  for (let i = 0; i <= maxLevel; i++) byLevel.set(i, []);
  for (const r of results) byLevel.get(levelMap.get(r.id) ?? 0)!.push(r.id);

  const maxCount = Math.max(...[...byLevel.values()].map((g) => g.length), 1);
  const totalW = PAD * 2 + (maxLevel + 1) * NW + maxLevel * HG;
  const totalH = PAD * 2 + maxCount * NH + (maxCount - 1) * VG;

  const nodes = new Map<string, { x: number; y: number; result: ActivityResult }>();
  for (const [level, idsInLevel] of byLevel) {
    const count  = idsInLevel.length;
    const colH   = count * NH + (count - 1) * VG;
    const startY = PAD + (totalH - 2 * PAD - colH) / 2;
    idsInLevel.forEach((id, idx) => {
      const r = results.find((x) => x.id === id)!;
      nodes.set(id, {
        x: PAD + level * (NW + HG),
        y: startY + idx * (NH + VG),
        result: r,
      });
    });
  }

  return { nodes, totalW: Math.max(totalW, 200), totalH: Math.max(totalH, 140) };
}

// ── Single activity box ────────────────────────────────────────────────────────
function NodeBox({
  x, y, r, critical, t,
}: {
  x: number; y: number; r: ActivityResult; critical: boolean;
  t: (fr: string, ar: string) => string;
}) {
  const ROW = NH / 3;           // 28px
  const C1  = NW * 0.21;        // ES/LS column
  const C2  = NW * 0.58;        // name / duration / slack column
  const C3  = NW * 0.21;        // EF/LF column

  const stroke      = critical ? "#004d40" : "#94a3b8";
  const strokeW     = critical ? 2.5 : 1;
  const bgFill      = critical ? "#effaf6" : "#ffffff";
  const mainColor   = critical ? "#004d40" : "#1e293b";
  const subColor    = "#64748b";
  const slackColor  = critical ? "#dc2626" : "#64748b";

  const label = r.name.length > 14 ? r.name.slice(0, 13) + "…" : r.name;

  return (
    <g>
      <rect x={x} y={y} width={NW} height={NH} rx={5}
        fill={bgFill} stroke={stroke} strokeWidth={strokeW} />

      {/* horizontal dividers */}
      <line x1={x} y1={y + ROW}      x2={x + NW} y2={y + ROW}      stroke={stroke} strokeWidth={0.5} />
      <line x1={x} y1={y + 2 * ROW}  x2={x + NW} y2={y + 2 * ROW}  stroke={stroke} strokeWidth={0.5} />
      {/* vertical dividers */}
      <line x1={x + C1}       y1={y} x2={x + C1}       y2={y + NH} stroke={stroke} strokeWidth={0.5} />
      <line x1={x + C1 + C2}  y1={y} x2={x + C1 + C2}  y2={y + NH} stroke={stroke} strokeWidth={0.5} />

      {/* Row 1 — ES | Name | EF */}
      <text x={x + C1 / 2}            y={y + ROW / 2 + 5}  textAnchor="middle" fontSize={11} fontWeight="700" fill={mainColor}>{fmt(r.ES)}</text>
      <text x={x + C1 + C2 / 2}       y={y + ROW / 2 + 5}  textAnchor="middle" fontSize={10} fontWeight="600" fill={mainColor}>{label}</text>
      <text x={x + C1 + C2 + C3 / 2}  y={y + ROW / 2 + 5}  textAnchor="middle" fontSize={11} fontWeight="700" fill={mainColor}>{fmt(r.EF)}</text>

      {/* Row 2 — id | duration */}
      <text x={x + C1 / 2}      y={y + ROW + ROW / 2 + 5}  textAnchor="middle" fontSize={9}  fill={subColor}>[{r.id}]</text>
      <text x={x + C1 + C2 / 2} y={y + ROW + ROW / 2 + 5}  textAnchor="middle" fontSize={10} fill={subColor}>{fmt(r.duration)} sem.</text>

      {/* Row 3 — LS | Slack | LF */}
      <text x={x + C1 / 2}            y={y + 2 * ROW + ROW / 2 + 5}  textAnchor="middle" fontSize={11} fontWeight="700" fill={mainColor}>{fmt(r.LS)}</text>
      <text x={x + C1 + C2 / 2}       y={y + 2 * ROW + ROW / 2 + 5}  textAnchor="middle" fontSize={10} fill={slackColor}>
        {t("Marge", "مهلة")}: {fmt(r.slack)}
      </text>
      <text x={x + C1 + C2 + C3 / 2}  y={y + 2 * ROW + ROW / 2 + 5}  textAnchor="middle" fontSize={11} fontWeight="700" fill={mainColor}>{fmt(r.LF)}</text>
    </g>
  );
}

// ── Main diagram ───────────────────────────────────────────────────────────────
export function NetworkDiagram({ results, predecessors, criticalPath, t }: Props) {
  if (results.length === 0) return null;

  const { nodes, totalW, totalH } = computeLayout(results, predecessors);
  const criticalSet = new Set(criticalPath);

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <svg
        width={totalW}
        height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        style={{ minWidth: totalW, display: "block" }}
        fontFamily="Inter, system-ui, sans-serif"
      >
        <defs>
          <marker id="arrowN" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto">
            <path d="M0 0 L7 3.5 L0 7 Z" fill="#94a3b8" />
          </marker>
          <marker id="arrowC" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto">
            <path d="M0 0 L7 3.5 L0 7 Z" fill="#004d40" />
          </marker>
        </defs>

        {/* ── Edges ─────────────────────────────────────────────────────── */}
        {results.flatMap((r) =>
          (predecessors[r.id] ?? []).map((predId) => {
            const src = nodes.get(predId);
            const tgt = nodes.get(r.id);
            if (!src || !tgt) return null;
            const x1 = src.x + NW;       const y1 = src.y + NH / 2;
            const x2 = tgt.x;            const y2 = tgt.y + NH / 2;
            const dx = (x2 - x1) * 0.45;
            const isCrit = criticalSet.has(predId) && criticalSet.has(r.id);
            return (
              <path
                key={`${predId}→${r.id}`}
                d={`M ${x1} ${y1} C ${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`}
                fill="none"
                stroke={isCrit ? "#004d40" : "#cbd5e1"}
                strokeWidth={isCrit ? 2.5 : 1.5}
                markerEnd={isCrit ? "url(#arrowC)" : "url(#arrowN)"}
              />
            );
          })
        )}

        {/* ── Nodes ─────────────────────────────────────────────────────── */}
        {[...nodes.entries()].map(([id, { x, y, result }]) => (
          <NodeBox
            key={id} x={x} y={y} r={result}
            critical={criticalSet.has(id)} t={t}
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-6 px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded border-2 border-primary bg-[#effaf6]" />
          {t("Activité critique", "نشاط حرج")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded border border-slate-300 bg-white" />
          {t("Activité non critique", "نشاط غير حرج")}
        </span>
        <span className="font-mono opacity-70">
          {t("ES | Nom | EF  /  LS | Marge | LF", "ES | الاسم | EF  /  LS | المهلة | LF")}
        </span>
      </div>
    </div>
  );
}
