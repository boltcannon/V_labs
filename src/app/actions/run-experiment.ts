"use server";

/**
 * Server Action: execute the deterministic rule engine on behalf of the
 * Investigation UI. Called from client components, but the actual `runLab`
 * call happens on the server, in the same module graph as
 * `get-lab-spec.ts`. The `ValidatedLabSpec` brand never crosses the wire.
 *
 * Multi-lab: validates `lab_id` against available specs via `labExists()`,
 * then loads that specific spec. Any lab in `src/specs/` is playable.
 */

import { getLabSpec, labExists } from "@/app/lib/get-lab-spec";
import { runLab } from "@/engine/rule-engine";
import type { EngineResult, Scalar } from "@/engine/types";

export interface RunExperimentInput {
  lab_id: string;
  inputs: Record<string, Scalar>;
  experiment_id?: string;
}

export interface RunExperimentOutput {
  result: EngineResult;
  error?: string;
}

const NULL_RESULT: EngineResult = {
  values: {},
  status: {},
  executed_rules: [],
  skipped_rules: [],
  topological_order: [],
};

export async function runExperiment(
  input: RunExperimentInput,
): Promise<RunExperimentOutput> {
  if (!labExists(input.lab_id)) {
    return { result: NULL_RESULT, error: `Unknown lab '${input.lab_id}'.` };
  }
  const spec = getLabSpec(input.lab_id);
  try {
    const result = runLab(spec, input.inputs);
    return { result };
  } catch (err) {
    return {
      result: NULL_RESULT,
      error: err instanceof Error ? err.message : "Unknown engine error",
    };
  }
}
