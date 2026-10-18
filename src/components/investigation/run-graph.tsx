/**
 * RunGraph — a scatter plot of the student's own runs.
 *
 * Points only: no fitted line or curve, because drawing one would be the
 * UI asserting a relationship the student is meant to find. Every value
 * shown (tooltip and screen-reader text) is the engine's value, formatted
 * but never altered. The latest run is highlighted.
 */

import type { Variable } from "@/schema/lab-spec";
import { formatReading } from "@/components/stage/stage-encoding";
import { axisDomain, type GraphPoint } from "./run-graph-data";

interface Props {
  points: GraphPoint[];
  xVar: Variable;
  yVar: Variable;
  latestRunId?: string | undefined;
}

// Plot area inside a 420 × 260 viewBox.
const W = 420;
const H = 260;
const PAD = { left: 56, right: 16, top: 16, bottom: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const axisLabel = (v: Variable) => (v.unit ? `${v.label} (${v.unit})` : v.label);
const withUnit = (value: number, v: Variable) =>
  v.unit ? `${formatReading(value)} ${v.unit}` : formatReading(value);

export function RunGraph({ points, xVar, yVar, latestRunId }: Props) {
  const [x0, x1] = axisDomain(points.map((p) => p.x));
  const [y0, y1] = axisDomain(points.map((p) => p.y));
  const px = (x: number) => PAD.left + ((x - x0) / (x1 - x0)) * PLOT_W;
  const py = (y: number) => PAD.top + PLOT_H - ((y - y0) / (y1 - y0)) * PLOT_H;
  const ticks = (lo: number, hi: number) => [lo, (lo + hi) / 2, hi];

  return (
    <figure className="space-y-1.5" data-testid="run-graph">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto rounded-lg border border-surface-border bg-surface"
        role="img"
        aria-label={`Graph of ${axisLabel(yVar)} against ${axisLabel(xVar)} for ${points.length} run${points.length === 1 ? "" : "s"}.`}
      >
        {/* Grid and ticks */}
        {ticks(x0, x1).map((t, i) => (
          <g key={`x${i}`}>
            <line x1={px(t)} x2={px(t)} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="#e4e7ec" />
            <text x={px(t)} y={PAD.top + PLOT_H + 14} fontSize={10} textAnchor="middle" fill="#64748b">
              {formatReading(Number(t.toPrecision(3)))}
            </text>
          </g>
        ))}
        {ticks(y0, y1).map((t, i) => (
          <g key={`y${i}`}>
            <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={py(t)} y2={py(t)} stroke="#e4e7ec" />
            <text x={PAD.left - 6} y={py(t) + 3} fontSize={10} textAnchor="end" fill="#64748b">
              {formatReading(Number(t.toPrecision(3)))}
            </text>
          </g>
        ))}

        {/* Axes */}
        <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={PAD.top + PLOT_H} y2={PAD.top + PLOT_H} stroke="#94a3b8" />
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="#94a3b8" />
        <text x={PAD.left + PLOT_W / 2} y={H - 8} fontSize={12} textAnchor="middle" fill="#0f172a">
          {axisLabel(xVar)}
        </text>
        <text
          x={14}
          y={PAD.top + PLOT_H / 2}
          fontSize={12}
          textAnchor="middle"
          fill="#0f172a"
          transform={`rotate(-90 14 ${PAD.top + PLOT_H / 2})`}
        >
          {axisLabel(yVar)}
        </text>

        {/* Points */}
        {points.map((p) => {
          const latest = p.runId === latestRunId;
          return (
            <g key={p.runId} data-part="point" data-run={p.runNumber} data-latest={latest ? "true" : "false"}>
              <title>
                {`Run ${p.runNumber}: ${xVar.label} = ${withUnit(p.x, xVar)}, ${yVar.label} = ${withUnit(p.y, yVar)}`}
              </title>
              <circle
                cx={px(p.x)}
                cy={py(p.y)}
                r={latest ? 6 : 4.5}
                fill={latest ? "#4f46e5" : "#a5b4fc"}
                stroke="#3730a3"
                strokeWidth={latest ? 2 : 1}
              />
              <text x={px(p.x) + 7} y={py(p.y) - 6} fontSize={9} fill="#475569">
                {p.runNumber}
              </text>
            </g>
          );
        })}

        {points.length === 0 && (
          <text x={PAD.left + PLOT_W / 2} y={PAD.top + PLOT_H / 2} fontSize={12} textAnchor="middle" fill="#64748b">
            Run the experiment to plot a point.
          </text>
        )}
      </svg>
    </figure>
  );
}
