/**
 * Rule engine — the deterministic core of the framework.
 *
 * PRINCIPLE 1 IS ENFORCED HERE, MECHANICALLY:
 *   1. No `fetch`, no network, no `eval`, no LLM SDK. This file has no runtime
 *      dependency on anything outside expr-eval + the LabSpec types.
 *   2. Every scientific outcome that reaches a consumer (a student, a chart,
 *      the AI tutor's prompt) originates in `runLab()` — a pure function of
 *      (LabSpec, inputs).
 *
 * Rules are evaluated in TOPOLOGICAL ORDER by variable dependency, NOT the
 * YAML author's declaration order. This lets a teacher write rules in any
 * order that reads well; the engine works out the real order.
 *
 * Cycle handling: if rules form a dependency cycle (A's output feeds B, B's
 * feeds A) the engine refuses to run the lab and returns an error naming
 * every rule in the cycle. A future authoring UI can surface this directly.
 *
 * Undefined propagation: an input that is missing, NaN, ±Infinity, or the
 * result of a rule that itself was skipped is treated as `undefined`. Any
 * rule that would consume an undefined input is skipped and its own output
 * marked `undefined`. The engine never quotes NaN as science.
 */

import type {
  LabSpec,
  Rule,
  DecisionTable,
  Variable,
  ValidatedLabSpec,
} from "../schema/lab-spec";
import {
  parseRuleExpression,
  evaluateExpression,
  type ParsedExpression,
} from "./expression-evaluator";
import { resolveDecisionTable } from "./decision-table";
import type {
  EngineInputs,
  EngineResult,
  Scalar,
  SkippedRule,
  VariableStatus,
} from "./types";

/* ------------------------------------------------------------------ */
/* Dependency analysis                                                 */
/* ------------------------------------------------------------------ */

interface RuleNode {
  rule: Rule;
  output_var: string;
  input_vars: string[];
  parsed_expression?: ParsedExpression;
  decision_table?: DecisionTable;
}

interface BuildResult {
  nodes: RuleNode[]; // index-aligned with topo_order below
  by_id: Map<string, RuleNode>;
  variables_by_id: Map<string, Variable>;
  tables_by_id: Map<string, DecisionTable>;
}

function buildNodes(spec: ValidatedLabSpec): BuildResult {
  const tables_by_id = new Map(
    (spec.science_model.decision_tables ?? []).map((t) => [t.id, t]),
  );
  const variables_by_id = new Map(
    spec.science_model.variables.map((v) => [v.id, v]),
  );

  const nodes: RuleNode[] = [];
  for (const rule of spec.science_model.rules) {
    if (rule.expression) {
      const parsed = parseRuleExpression(rule.expression);
      // Only keep RHS vars that are declared variables (filter out fns).
      const declared_inputs = parsed.rhs_variables.filter((v) =>
        variables_by_id.has(v),
      );
      nodes.push({
        rule,
        output_var: parsed.target,
        input_vars: declared_inputs,
        parsed_expression: parsed,
      });
    } else if (rule.decision_table_ref) {
      const table = tables_by_id.get(rule.decision_table_ref);
      if (!table) {
        // Zod already reports this; guard defensively.
        throw new Error(
          `Rule '${rule.id}' references unknown decision_table '${rule.decision_table_ref}'.`,
        );
      }
      nodes.push({
        rule,
        output_var: table.output,
        input_vars: [...table.inputs],
        decision_table: table,
      });
    } else {
      throw new Error(
        `Rule '${rule.id}' has neither expression nor decision_table_ref.`,
      );
    }
  }

  const by_id = new Map(nodes.map((n) => [n.rule.id, n]));
  return { nodes, by_id, variables_by_id, tables_by_id };
}

/* ------------------------------------------------------------------ */
/* Topological sort with cycle detection                               */
/* ------------------------------------------------------------------ */

export class CycleError extends Error {
  constructor(public cycle_rule_ids: string[]) {
    super(
      `Rule dependency cycle detected: ${cycle_rule_ids.join(" -> ")} -> ${
        cycle_rule_ids[0]
      }`,
    );
    this.name = "CycleError";
  }
}

interface TopoResult {
  order: string[]; // rule ids in evaluation order
}

/**
 * Kahn's algorithm. Edge R1 -> R2 iff R2 reads a variable that R1 writes.
 * On cycle, we run a DFS to name every rule in the cycle for the error.
 */
function topologicalSort(build: BuildResult): TopoResult {
  const rule_ids = build.nodes.map((n) => n.rule.id);
  const producer_of = new Map<string, string>(); // var_id -> rule_id
  for (const n of build.nodes) producer_of.set(n.output_var, n.rule.id);

  // adjacency: producer -> consumers
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const rid of rule_ids) {
    adj.set(rid, []);
    indeg.set(rid, 0);
  }
  for (const n of build.nodes) {
    for (const iv of n.input_vars) {
      const producer = producer_of.get(iv);
      if (producer && producer !== n.rule.id) {
        adj.get(producer)!.push(n.rule.id);
        indeg.set(n.rule.id, (indeg.get(n.rule.id) ?? 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const rid of rule_ids) {
    if ((indeg.get(rid) ?? 0) === 0) queue.push(rid);
  }
  // Stable order: sort by declaration index so tests are deterministic.
  const declared_index = new Map(rule_ids.map((r, i) => [r, i]));
  queue.sort((a, b) => declared_index.get(a)! - declared_index.get(b)!);

  const order: string[] = [];
  while (queue.length > 0) {
    const rid = queue.shift()!;
    order.push(rid);
    const next = adj.get(rid)!.slice().sort(
      (a, b) => declared_index.get(a)! - declared_index.get(b)!,
    );
    for (const dep of next) {
      indeg.set(dep, (indeg.get(dep) ?? 0) - 1);
      if ((indeg.get(dep) ?? 0) === 0) queue.push(dep);
    }
  }

  if (order.length !== rule_ids.length) {
    // Find a cycle among the remaining rules via DFS.
    const remaining = new Set(rule_ids.filter((r) => !order.includes(r)));
    const cycle = findCycle(remaining, adj);
    throw new CycleError(cycle);
  }

  return { order };
}

function findCycle(
  remaining: Set<string>,
  adj: Map<string, string[]>,
): string[] {
  // DFS from any remaining rule until we hit a gray node; walk back through
  // the parent map to reconstruct the cycle.
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();
  for (const r of remaining) {
    color.set(r, WHITE);
    parent.set(r, null);
  }

  let cycleFrom: string | null = null;
  let cycleTo: string | null = null;

  const stack: Array<{ node: string; iter: number }> = [];
  for (const start of remaining) {
    if (color.get(start) !== WHITE) continue;
    stack.push({ node: start, iter: 0 });
    color.set(start, GRAY);
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const neighbours = (adj.get(top.node) ?? []).filter((n) =>
        remaining.has(n),
      );
      if (top.iter < neighbours.length) {
        const nxt = neighbours[top.iter]!;
        top.iter++;
        const c = color.get(nxt);
        if (c === WHITE) {
          color.set(nxt, GRAY);
          parent.set(nxt, top.node);
          stack.push({ node: nxt, iter: 0 });
        } else if (c === GRAY) {
          cycleFrom = top.node;
          cycleTo = nxt;
          break;
        }
      } else {
        color.set(top.node, BLACK);
        stack.pop();
      }
    }
    if (cycleFrom) break;
  }

  if (!cycleFrom || !cycleTo) {
    // Should not happen — remaining implies at least one cycle.
    return [...remaining];
  }
  const cycle: string[] = [cycleFrom];
  let cur: string | null = cycleFrom;
  while (cur !== null && cur !== cycleTo) {
    cur = parent.get(cur) ?? null;
    if (cur === null) break;
    cycle.push(cur);
  }
  return cycle.reverse();
}

/* ------------------------------------------------------------------ */
/* Public: plan (topo order) and run                                   */
/* ------------------------------------------------------------------ */

export function planLab(
  spec: ValidatedLabSpec,
): { topological_order: string[] } {
  const build = buildNodes(spec);
  const topo = topologicalSort(build);
  return { topological_order: topo.order };
}

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

function typeCheckInput(v: Variable, val: Scalar): string | null {
  if (v.type === "number") {
    if (typeof val !== "number") return `expected number, got ${typeof val}`;
    if (!Number.isFinite(val)) return `input value is non-finite (${val})`;
    if (v.range) {
      const [lo, hi] = v.range;
      if (val < lo || val > hi) return `value ${val} out of range [${lo}, ${hi}]`;
    }
    return null;
  }
  if (v.type === "categorical") {
    if (typeof val !== "string") return `expected string, got ${typeof val}`;
    if (v.options && !v.options.includes(val)) {
      return `value '${val}' not in options ${JSON.stringify(v.options)}`;
    }
    return null;
  }
  if (v.type === "boolean") {
    if (typeof val !== "boolean") return `expected boolean, got ${typeof val}`;
    return null;
  }
  return null;
}

export interface RunLabOptions {
  /**
   * If true, an input variable whose value fails range/option/type checks is
   * treated as `undefined` instead of throwing. Default false — the caller
   * should preflight inputs. Useful for exploratory UIs.
   */
  tolerate_bad_inputs?: boolean;
}

/**
 * Execute the lab.
 *
 * The `spec` parameter is `ValidatedLabSpec`, not `LabSpec`, so a caller
 * that hand-constructs a spec object literal will fail to typecheck. The
 * brand is producible only inside `src/schema/lab-spec.ts`, which is
 * called only from the loader after Zod validation succeeds. This is how
 * Principle 8 is enforced by the type system.
 */
export function runLab(
  spec: ValidatedLabSpec,
  inputs: EngineInputs,
  options: RunLabOptions = {},
): EngineResult {
  const build = buildNodes(spec);
  const { order } = topologicalSort(build);

  const values: Record<string, Scalar | null> = {};
  const status: Record<string, VariableStatus> = {};
  for (const v of spec.science_model.variables) {
    values[v.id] = null;
    status[v.id] = "not_computed";
  }

  // Seed inputs.
  for (const [id, raw] of Object.entries(inputs)) {
    const v = build.variables_by_id.get(id);
    if (!v) {
      throw new Error(`Input '${id}' is not a declared variable.`);
    }
    const err = typeCheckInput(v, raw);
    if (err) {
      if (options.tolerate_bad_inputs) {
        status[id] = "undefined";
        continue;
      }
      throw new Error(`Input '${id}' invalid: ${err}`);
    }
    values[id] = raw;
    status[id] = "defined";
  }

  const executed_rules: string[] = [];
  const skipped_rules: SkippedRule[] = [];

  for (const rid of order) {
    const node = build.by_id.get(rid)!;

    // Short-circuit: any input variable not defined -> skip.
    let missing: string | null = null;
    for (const iv of node.input_vars) {
      if (status[iv] !== "defined") {
        missing = iv;
        break;
      }
    }
    if (missing !== null) {
      skipped_rules.push({
        rule_id: rid,
        missing_input: missing,
        reason: "undefined_input",
      });
      status[node.output_var] = "undefined";
      continue;
    }

    // Build a scope over declared inputs only.
    const scope: Record<string, Scalar> = {};
    for (const iv of node.input_vars) {
      scope[iv] = values[iv] as Scalar;
    }

    if (node.parsed_expression) {
      const result = evaluateExpression(node.parsed_expression, scope);
      if (!result.ok) {
        skipped_rules.push({ rule_id: rid, reason: result.reason });
        status[node.output_var] = "undefined";
        continue;
      }
      values[node.output_var] = result.value;
      status[node.output_var] = "defined";
      executed_rules.push(rid);
      continue;
    }

    if (node.decision_table) {
      const result = resolveDecisionTable(node.decision_table, scope);
      if (!result.ok) {
        skipped_rules.push({ rule_id: rid, reason: result.reason });
        status[node.output_var] = "undefined";
        continue;
      }
      values[node.output_var] = result.value;
      status[node.output_var] = "defined";
      executed_rules.push(rid);
      continue;
    }
  }

  return {
    values,
    status,
    executed_rules,
    skipped_rules,
    topological_order: order,
  };
}
