/**
 * CircuitStage — a battery, two bulbs in series, and an ammeter on each
 * side of bulb 1, drawn from engine outputs only.
 *
 * Every prop is a reading the engine already produced (or a display
 * scale from a variable's declared range). The component computes no
 * physics: it never derives one reading from another, and it never
 * clamps a reading it displays. Glow and flow speed are visual encodings
 * of the given power and current (see `stage-encoding.ts`).
 */

import {
  flowDurationSeconds,
  formatReading,
  glowLevel,
} from "./stage-encoding";

export interface CircuitStageProps {
  batteryVoltage: number | null;
  /** Ammeter just before bulb 1. */
  ammeterBefore: number | null;
  /** Ammeter just after bulb 1. */
  ammeterAfter: number | null;
  bulb1Power: number | null;
  bulb2Power: number | null;
  /** Loop current — drives flow-dot speed. */
  current: number | null;
  /** Display scale for glow (declared range max of bulb power). */
  powerScaleMax: number;
  /** Display scale for flow speed (declared range max of current). */
  currentScaleMax: number;
}

// Layout (viewBox units). The loop runs battery → A1 → bulb 1 → A2 →
// bulb 2 → back to the battery.
const LOOP = "M 60 130 L 60 50 L 480 50 L 480 210 L 60 210 Z";
const FLOW_DOTS = 8;

const withUnit = (value: number | null, unit: string) =>
  value === null || !Number.isFinite(value) ? "—" : `${formatReading(value)} ${unit}`;

export function CircuitStage(props: CircuitStageProps) {
  const {
    batteryVoltage,
    ammeterBefore,
    ammeterAfter,
    bulb1Power,
    bulb2Power,
    current,
    powerScaleMax,
    currentScaleMax,
  } = props;
  const flow = flowDurationSeconds(current, currentScaleMax);
  const summary =
    `Series circuit. Battery ${withUnit(batteryVoltage, "volts")}. ` +
    `Ammeter before bulb 1 reads ${withUnit(ammeterBefore, "amperes")}; ` +
    `ammeter after bulb 1 reads ${withUnit(ammeterAfter, "amperes")}.`;

  return (
    <svg
      viewBox="0 0 540 260"
      role="img"
      aria-label={summary}
      className="w-full h-auto rounded-lg border border-surface-border bg-surface"
      data-testid="circuit-stage"
    >
      <title>{summary}</title>

      {/* Wires */}
      <path d={LOOP} fill="none" stroke="#94a3b8" strokeWidth={3} strokeLinejoin="round" />

      {/* Flow dots — only when there is a current reading */}
      {flow !== null && (
        <g data-part="flow" data-duration={String(flow)}>
          {Array.from({ length: FLOW_DOTS }, (_, k) => (
            <circle key={k} data-part="flow-dot" r={3.5} fill="#4f46e5">
              <animateMotion
                path={LOOP}
                dur={`${flow}s`}
                begin={`${(-k * flow) / FLOW_DOTS}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>
      )}

      {/* Battery */}
      <g>
        <rect x={40} y={112} width={40} height={36} fill="#ffffff" />
        <line x1={44} y1={120} x2={76} y2={120} stroke="#0f172a" strokeWidth={4} />
        <line x1={50} y1={132} x2={70} y2={132} stroke="#0f172a" strokeWidth={4} />
        <line x1={44} y1={144} x2={76} y2={144} stroke="#0f172a" strokeWidth={4} opacity={0} />
        <text x={92} y={136} fontSize={14} fill="#0f172a" data-part="battery-label">
          {withUnit(batteryVoltage, "V")}
        </text>
      </g>

      <Ammeter cx={160} cy={50} part="ammeter-before" label="before bulb 1" reading={ammeterBefore} />
      <Bulb cx={270} cy={50} part="bulb1" name="Bulb 1" power={bulb1Power} scaleMax={powerScaleMax} labelBelow />
      <Ammeter cx={380} cy={50} part="ammeter-after" label="after bulb 1" reading={ammeterAfter} />
      <Bulb cx={480} cy={140} part="bulb2" name="Bulb 2" power={bulb2Power} scaleMax={powerScaleMax} labelLeft />
    </svg>
  );
}

function Ammeter({
  cx,
  cy,
  part,
  label,
  reading,
}: {
  cx: number;
  cy: number;
  part: string;
  label: string;
  reading: number | null;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={18} fill="#ffffff" stroke="#0f172a" strokeWidth={2} />
      <text x={cx} y={cy + 5} fontSize={15} fontWeight={600} textAnchor="middle" fill="#0f172a">
        A
      </text>
      <text x={cx} y={cy + 40} fontSize={14} fontWeight={600} textAnchor="middle" fill="#0f172a" data-part={`${part}-reading`}>
        {withUnit(reading, "A")}
      </text>
      <text x={cx} y={cy + 56} fontSize={11} textAnchor="middle" fill="#64748b">
        {label}
      </text>
    </g>
  );
}

function Bulb({
  cx,
  cy,
  part,
  name,
  power,
  scaleMax,
  labelBelow,
  labelLeft,
}: {
  cx: number;
  cy: number;
  part: string;
  name: string;
  power: number | null;
  scaleMax: number;
  labelBelow?: boolean;
  labelLeft?: boolean;
}) {
  const glow = glowLevel(power, scaleMax);
  const lx = labelLeft ? cx - 30 : cx;
  const ly = labelBelow ? cy + 40 : cy + 5;
  const anchor = labelLeft ? "end" : "middle";
  return (
    <g>
      <circle
        data-part={`${part}-glow`}
        data-glow={String(glow)}
        cx={cx}
        cy={cy}
        r={32}
        fill="#fbbf24"
        fillOpacity={glow * 0.85}
      />
      <circle cx={cx} cy={cy} r={16} fill="#fffbeb" stroke="#0f172a" strokeWidth={2} />
      <path
        d={`M ${cx - 8} ${cy + 6} L ${cx - 4} ${cy - 6} L ${cx} ${cy + 6} L ${cx + 4} ${cy - 6} L ${cx + 8} ${cy + 6}`}
        fill="none"
        stroke="#b45309"
        strokeWidth={1.5}
      />
      <text x={lx} y={ly} fontSize={12} textAnchor={anchor} fill="#64748b">
        {name}
      </text>
      <text x={lx} y={ly + 16} fontSize={13} fontWeight={600} textAnchor={anchor} fill="#0f172a" data-part={`${part}-power`}>
        {withUnit(power, "W")}
      </text>
    </g>
  );
}
