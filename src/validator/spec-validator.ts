/**
 * Spec validator for schema v2 (rules V1–V7; V8 is a regression property
 * checked by tests: v1 specs load and return no issues here).
 *
 * Runs AFTER the loader: Zod has already checked shapes, so this module
 * checks what Zod cannot —
 *   V1  misconception references exist and agree; revision fields non-blank
 *   V2  at each prediction's experiment preset, exactly one option is true
 *   V3  at that preset, every misconception-mapped option is false
 *   V4  robustness: mapped options stay false at K seeded sample points
 *       across the ranges of the experiment's unlocked (manipulated)
 *       input variables; a failure names the point
 *   V5  prediction item and option ids unique; an option is detected by
 *       at most one misconception
 *   V6  choice options route to existing misconceptions; when choice
 *       points exist, every misconception is reachable from one
 *   V7  if misconceptions exist, prediction.gate is true
 *
 * Deterministic by construction: `correct_when` is evaluated by the
 * engine's own expression parser against `runLab()` outputs, and V4 uses
 * a seeded PRNG. No LLM anywhere (CLAUDE.md §8 rule 3).
 */

import type {
  Experiment,
  PredictionItem,
  PredictionOption,
  ValidatedLabSpec,
  Variable,
} from "../schema/lab-spec";
import { runLab } from "../engine/rule-engine";
import {
  evaluateCondition,
  parseCondition,
  type ParsedCondition,
} from "../engine/expression-evaluator";
import type { EngineResult, Scalar } from "../engine/types";
import { mulberry32 } from "./prng";

export type SpecRule = "V1" | "V2" | "V3" | "V4" | "V5" | "V6" | "V7";

export interface SpecIssue {
  rule: SpecRule;
  /** Dotted path to the offending field, for the authoring UI. */
  path: string;
  message: string;
  /** V4 only: the sampled input point at which the check failed. */
  point?: Record<string, Scalar>;
}

export interface ValidateSpecOptions {
  /** V4 sample count. Default 64. */
  samples?: number;
  /** V4 PRNG seed. Default 1. */
  seed?: number;
}

export const DEFAULT_V4_SAMPLES = 64;
export const DEFAULT_V4_SEED = 1;

const REVISION_FIELDS = [
  "explain_prompt",
  "compare_prompt",
  "revise_prompt",
  "alternative_model",
] as const;

interface OptionEntry {
  item: PredictionItem;
  option: PredictionOption;
  path: string;
}

export function validateSpec(
  spec: ValidatedLabSpec,
  options: ValidateSpecOptions = {},
): SpecIssue[] {
  const samples = options.samples ?? DEFAULT_V4_SAMPLES;
  const seed = options.seed ?? DEFAULT_V4_SEED;

  const issues: SpecIssue[] = [];
  const add = (rule: SpecRule, path: string, message: string) =>
    issues.push({ rule, path, message });

  const items = spec.prediction?.items ?? [];
  const misconceptions = spec.misconceptions ?? [];
  const choicePoints = spec.choice_points ?? [];
  const experiments = new Map(spec.investigation.experiments.map((e) => [e.id, e]));
  const varsById = new Map(spec.science_model.variables.map((v) => [v.id, v]));
  const misconceptionIds = new Set(misconceptions.map((m) => m.id));

  /* ---------------- V5: unique ids ---------------- */

  const optionIndex = new Map<string, OptionEntry>();
  const itemIds = new Set<string>();
  items.forEach((item, i) => {
    if (itemIds.has(item.id)) {
      add("V5", `prediction.items[${i}].id`, `Prediction item id '${item.id}' is used more than once.`);
    }
    itemIds.add(item.id);
    item.options.forEach((option, j) => {
      const path = `prediction.items[${i}].options[${j}]`;
      if (optionIndex.has(option.id)) {
        add("V5", `${path}.id`, `Prediction option id '${option.id}' is used more than once. Option ids must be unique across all items.`);
      } else {
        optionIndex.set(option.id, { item, option, path });
      }
    });
  });

  const detectors = new Map<string, string[]>();
  for (const m of misconceptions) {
    const opt = m.detected_when.prediction_option;
    detectors.set(opt, [...(detectors.get(opt) ?? []), m.id]);
  }
  for (const [opt, ids] of detectors) {
    if (ids.length > 1) {
      add("V5", "misconceptions", `Prediction option '${opt}' is detected by ${ids.length} misconceptions (${ids.join(", ")}). Each option maps to at most one misconception.`);
    }
  }

  /* ---------------- V1: misconception references ---------------- */

  for (const [id, entry] of optionIndex) {
    const target = entry.option.maps_to_misconception;
    if (target != null && !misconceptionIds.has(target)) {
      add("V1", `${entry.path}.maps_to_misconception`, `Option '${id}' maps to unknown misconception '${target}'.`);
    }
  }

  misconceptions.forEach((m, k) => {
    const path = `misconceptions[${k}]`;
    for (const f of REVISION_FIELDS) {
      if (m.revision[f].trim() === "") {
        add("V1", `${path}.revision.${f}`, `Misconception '${m.id}' revision.${f} is blank.`);
      }
    }

    const optId = m.detected_when.prediction_option;
    const entry = optionIndex.get(optId);
    if (!entry) {
      add("V1", `${path}.detected_when.prediction_option`, `Misconception '${m.id}' detected_when names unknown prediction option '${optId}'.`);
    } else if (entry.option.maps_to_misconception !== m.id) {
      const mapped = entry.option.maps_to_misconception;
      add("V1", `${path}.detected_when.prediction_option`, `Misconception '${m.id}' is detected by option '${optId}', but that option maps to ${mapped ? `'${mapped}'` : "no misconception"}.`);
    }

    const expId = m.discrepant_event.experiment_ref;
    if (!experiments.has(expId)) {
      add("V1", `${path}.discrepant_event.experiment_ref`, `Misconception '${m.id}' discrepant_event names unknown experiment '${expId}'.`);
    } else if (entry && entry.item.experiment_ref !== expId) {
      add("V1", `${path}.discrepant_event.experiment_ref`, `Misconception '${m.id}' discrepant_event experiment '${expId}' does not match '${entry.item.experiment_ref}', the experiment that resolves prediction '${entry.item.id}'.`);
    }
  });

  /* ---------------- V7: misconceptions need the gate ---------------- */

  if (misconceptions.length > 0) {
    if (!spec.prediction) {
      add("V7", "prediction", "Misconceptions are declared but there is no prediction section; a prediction gate is required.");
    } else if (!spec.prediction.gate) {
      add("V7", "prediction.gate", "Misconceptions are declared, so prediction.gate must be true.");
    }
  }

  /* ---------------- V6: choice-point routing ---------------- */

  const routed = new Set<string>();
  choicePoints.forEach((cp, c) => {
    cp.options.forEach((o, j) => {
      routed.add(o.routes_to_misconception);
      if (!misconceptionIds.has(o.routes_to_misconception)) {
        add("V6", `choice_points[${c}].options[${j}].routes_to_misconception`, `Choice option '${o.id}' routes to unknown misconception '${o.routes_to_misconception}'.`);
      }
    });
  });
  if (choicePoints.length > 0) {
    misconceptions.forEach((m, k) => {
      if (!routed.has(m.id)) {
        add("V6", `misconceptions[${k}]`, `Misconception '${m.id}' is not reachable from any choice option.`);
      }
    });
  }

  /* ---------------- V2 / V3 / V4: engine-evaluated ---------------- */

  items.forEach((item, i) => {
    issues.push(...checkItem(spec, item, i, experiments, varsById, samples, seed));
  });

  return issues;
}

/* ------------------------------------------------------------------ */
/* Per-item engine checks (V2, V3, V4)                                 */
/* ------------------------------------------------------------------ */

type RunOutcome = { ok: true; result: EngineResult } | { ok: false; message: string };

function safeRun(spec: ValidatedLabSpec, inputs: Record<string, Scalar>): RunOutcome {
  try {
    return { ok: true, result: runLab(spec, inputs) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

type OptionEval =
  | { ok: true; value: boolean }
  | { ok: false; message: string };

/** Evaluate one parsed condition against an engine result. */
function evalAt(cond: ParsedCondition, result: EngineResult, where: string): OptionEval {
  const scope: Record<string, Scalar> = {};
  for (const v of cond.variables) {
    if (result.status[v] !== "defined") {
      return {
        ok: false,
        message: `uses '${v}', which is not defined ${where} (status: ${result.status[v] ?? "unknown"})`,
      };
    }
    scope[v] = result.values[v] as Scalar;
  }
  const r = evaluateCondition(cond, scope);
  if (r.ok) return r;
  if (r.reason === "not_boolean") {
    return { ok: false, message: `'${cond.source}' is not true/false (got ${JSON.stringify(r.raw)})` };
  }
  return { ok: false, message: `'${cond.source}' failed to evaluate: ${r.message}` };
}

function formatPoint(point: Record<string, Scalar>): string {
  return Object.entries(point)
    .map(([k, v]) => `${k}=${typeof v === "number" ? Number(v.toFixed(4)) : String(v)}`)
    .join(", ");
}

function samplePoint(
  preset: Record<string, Scalar>,
  unlocked: Variable[],
  rng: () => number,
): Record<string, Scalar> {
  const point: Record<string, Scalar> = { ...preset };
  for (const v of unlocked) {
    if (v.type === "number" && v.range) {
      const [lo, hi] = v.range;
      point[v.id] = lo + rng() * (hi - lo);
    } else if (v.type === "categorical" && v.options && v.options.length > 0) {
      point[v.id] = v.options[Math.floor(rng() * v.options.length)]!;
    } else if (v.type === "boolean") {
      point[v.id] = rng() < 0.5;
    }
  }
  return point;
}

function checkItem(
  spec: ValidatedLabSpec,
  item: PredictionItem,
  i: number,
  experiments: Map<string, Experiment>,
  varsById: Map<string, Variable>,
  samples: number,
  seed: number,
): SpecIssue[] {
  const out: SpecIssue[] = [];
  const itemPath = `prediction.items[${i}]`;

  const exp = experiments.get(item.experiment_ref);
  if (!exp) {
    out.push({ rule: "V2", path: `${itemPath}.experiment_ref`, message: `Prediction '${item.id}' names unknown experiment '${item.experiment_ref}'.` });
    return out;
  }
  if (!exp.preset) {
    out.push({ rule: "V2", path: `${itemPath}.experiment_ref`, message: `Prediction '${item.id}': experiment '${exp.id}' has no preset, so its correct option cannot be checked.` });
    return out;
  }
  const preset = exp.preset;

  // Parse every option's condition; any failure stops the engine checks
  // for this item, since "exactly one true" is then undecidable.
  const parsed: Array<{ option: PredictionOption; cond: ParsedCondition; path: string }> = [];
  let parseFailed = false;
  item.options.forEach((option, j) => {
    const path = `${itemPath}.options[${j}].correct_when`;
    let cond: ParsedCondition;
    try {
      cond = parseCondition(option.correct_when);
    } catch (err) {
      out.push({ rule: "V2", path, message: `Option '${option.id}': ${(err as Error).message}` });
      parseFailed = true;
      return;
    }
    const unknown = cond.variables.filter((v) => !varsById.has(v));
    if (unknown.length > 0) {
      for (const v of unknown) {
        out.push({ rule: "V2", path, message: `Option '${option.id}' correct_when uses unknown variable '${v}'.` });
      }
      parseFailed = true;
      return;
    }
    parsed.push({ option, cond, path });
  });
  if (parseFailed) return out;

  // V2: exactly one option true at the preset.
  const atPreset = safeRun(spec, preset);
  if (!atPreset.ok) {
    out.push({ rule: "V2", path: `${itemPath}.experiment_ref`, message: `Prediction '${item.id}': the engine failed at the preset of '${exp.id}': ${atPreset.message}` });
    return out;
  }
  const presetValues = new Map<string, boolean>();
  let evalFailed = false;
  for (const p of parsed) {
    const r = evalAt(p.cond, atPreset.result, "at the preset");
    if (!r.ok) {
      out.push({ rule: "V2", path: p.path, message: `Option '${p.option.id}' correct_when ${r.message}.` });
      evalFailed = true;
    } else {
      presetValues.set(p.option.id, r.value);
    }
  }
  if (evalFailed) return out;

  const trueIds = [...presetValues].filter(([, v]) => v).map(([id]) => id);
  if (trueIds.length !== 1) {
    out.push({
      rule: "V2",
      path: `${itemPath}.options`,
      message: `Prediction '${item.id}': ${trueIds.length} options are true at the preset of '${exp.id}' (${formatPoint(preset)})${trueIds.length ? `: ${trueIds.join(", ")}` : ""}. Exactly one must be.`,
    });
  }

  // V3: misconception-mapped options are false at the preset.
  const mapped = parsed.filter((p) => p.option.maps_to_misconception != null);
  for (const p of mapped) {
    if (presetValues.get(p.option.id)) {
      out.push({
        rule: "V3",
        path: p.path,
        message: `Option '${p.option.id}' maps to misconception '${p.option.maps_to_misconception}' but is true at the preset of '${exp.id}' (${formatPoint(preset)}), so the event is not discrepant.`,
      });
    }
  }

  // V4: mapped options stay false across the unlocked variables' ranges.
  // Options already caught by V3 are skipped — they fail at the preset.
  const toSample = mapped.filter((p) => presetValues.get(p.option.id) === false);
  const unlocked = exp.manipulated_vars
    .map((id) => varsById.get(id))
    .filter((v): v is Variable => v !== undefined && v.role === "input");
  if (toSample.length === 0 || unlocked.length === 0) return out;

  const rng = mulberry32(seed);
  const failed = new Set<string>();
  for (let k = 0; k < samples && failed.size < toSample.length; k++) {
    const point = samplePoint(preset, unlocked, rng);
    const where = `at sample ${k + 1} of ${samples} (seed ${seed}): ${formatPoint(point)}`;
    const run = safeRun(spec, point);
    for (const p of toSample) {
      if (failed.has(p.option.id)) continue;
      if (!run.ok) {
        failed.add(p.option.id);
        out.push({ rule: "V4", path: p.path, point, message: `Option '${p.option.id}': the engine failed ${where}: ${run.message}` });
        continue;
      }
      const r = evalAt(p.cond, run.result, where);
      if (!r.ok) {
        failed.add(p.option.id);
        out.push({ rule: "V4", path: p.path, point, message: `Option '${p.option.id}' could not be checked: correct_when ${r.message}.` });
      } else if (r.value) {
        failed.add(p.option.id);
        out.push({
          rule: "V4",
          path: p.path,
          point,
          message: `Option '${p.option.id}' (misconception '${p.option.maps_to_misconception}') comes true ${where}. A student who changes ${unlocked.map((v) => v.id).join(", ")} can reach this point, where the misconception's prediction is confirmed, so the event is not reliably discrepant. Lock these variables or rework the prediction.`,
        });
      }
    }
  }
  return out;
}
