/**
 * Binds an engine run to CircuitStage props by variable id.
 *
 * Selection only: each prop is the engine's value for one variable, or
 * null if the engine did not define it. Nothing is recomputed here. The
 * ids are the series-circuit binding used by the Class 10 Electricity lab.
 */

import type { Variable } from "@/schema/lab-spec";
import type { RunOutput } from "@/app/lib/experiment-run";
import type { CircuitStageProps } from "./circuit-stage";

export const SERIES_CIRCUIT_BINDING = {
  batteryVoltage: "v",
  ammeterBefore: "i_before_bulb1",
  ammeterAfter: "i_after_bulb1",
  bulb1Power: "p1",
  bulb2Power: "p2",
  current: "i_series",
} as const;

function pick(outputs: Record<string, RunOutput> | null, id: string): number | null {
  const o = outputs?.[id];
  return o && o.status === "defined" && typeof o.value === "number" ? o.value : null;
}

function rangeMax(variables: Variable[], id: string): number {
  return variables.find((v) => v.id === id)?.range?.[1] ?? 1;
}

export function circuitStagePropsFromRun(
  outputs: Record<string, RunOutput> | null,
  variables: Variable[],
): CircuitStageProps {
  const b = SERIES_CIRCUIT_BINDING;
  return {
    batteryVoltage: pick(outputs, b.batteryVoltage),
    ammeterBefore: pick(outputs, b.ammeterBefore),
    ammeterAfter: pick(outputs, b.ammeterAfter),
    bulb1Power: pick(outputs, b.bulb1Power),
    bulb2Power: pick(outputs, b.bulb2Power),
    current: pick(outputs, b.current),
    powerScaleMax: rangeMax(variables, b.bulb1Power),
    currentScaleMax: rangeMax(variables, b.current),
  };
}
