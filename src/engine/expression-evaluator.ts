/**
 * Expression evaluator.
 *
 * Principle 1, mechanical enforcement: this file does NOT use JavaScript
 * `eval()` or the `Function` constructor. Rule expressions authored by a
 * teacher are parsed by `expr-eval` — a proper AST parser with a fixed
 * set of allowed operators and functions — and evaluated against a
 * variable scope only. There is no runtime code path from a rule string
 * to the JS runtime.
 *
 * Every rule expression MUST have the form `<var_id> = <expression>`:
 *   distance = speed * time
 *   both_zero = (speed_leg1 == 0) and (speed_leg2 == 0)
 *   speeds_equal = abs(speed_leg1 - speed_leg2) < 0.001
 * The LHS is the output variable id; the RHS is evaluated.
 *
 * Any evaluation that produces NaN or ±Infinity is reported as
 * `{ok: false}`; the engine translates that into `status = undefined`.
 */

import { Parser, type Expression } from "expr-eval";
import type { Scalar } from "./types";

const parser = new Parser({
  operators: {
    // Arithmetic
    add: true,
    subtract: true,
    multiply: true,
    divide: true,
    remainder: true,
    power: true,
    // Comparison
    comparison: true,
    // Logical
    logical: true,
    // No `in`, no `assignment`, no `conditional` — teachers use rules and
    // decision tables to express those, not embedded ternary logic.
    conditional: false,
    assignment: false,
    "in": false,
  },
});

// expr-eval ships a `random()` function. It is a function, not an
// operator, so the `operators` options above cannot switch it off — it
// has to be removed from the function table. Without it, `random` is just
// an unknown name: a rule using it fails to evaluate and a prediction
// condition using it fails validator V2. Principle 1: the engine never
// produces a non-deterministic value.
delete (parser.functions as Record<string, unknown>).random;

/** Result of parsing a full rule expression. Cached per rule. */
export interface ParsedExpression {
  /** LHS: the target variable id. */
  target: string;
  /** RHS: parsed AST, evaluable against a scope. */
  ast: Expression;
  /** Free variables appearing on the RHS (used for dependency ordering). */
  rhs_variables: string[];
}

/**
 * Split "target = expression" into its two halves. Accepts assignment `=` but
 * rejects comparison `==`, `!=`, `<=`, `>=` in the target position.
 *
 * @throws Error with a specific message if the expression is malformed.
 */
export function splitAssignment(expr: string): { target: string; rhs: string } {
  // Match: whitespace, snake_case id, whitespace, one '=' NOT followed by '=', then rest.
  const m = /^\s*([a-z][a-z0-9_]*)\s*=(?!=)\s*(.+)$/s.exec(expr);
  if (!m) {
    throw new Error(
      `Expression '${expr}' is not of the form 'target = expression'. ` +
        `Every rule expression must assign to exactly one variable id on the left of a single '='.`,
    );
  }
  return { target: m[1]!, rhs: m[2]!.trim() };
}

export function parseRuleExpression(expr: string): ParsedExpression {
  const { target, rhs } = splitAssignment(expr);
  let ast: Expression;
  try {
    ast = parser.parse(rhs);
  } catch (err) {
    throw new Error(
      `Failed to parse RHS of rule expression '${expr}': ${(err as Error).message}`,
    );
  }
  return {
    target,
    ast,
    rhs_variables: ast.variables(),
  };
}

/**
 * A bare true/false condition over variable ids, e.g.
 * "i_after_bulb1 < i_before_bulb1". Used for schema v2
 * `prediction.items[].options[].correct_when`. Same parser, same operator
 * whitelist as rule expressions — but no `target =` on the left.
 */
export interface ParsedCondition {
  source: string;
  ast: Expression;
  /** Free variables (function names excluded). */
  variables: string[];
}

/** @throws Error if the condition does not parse. */
export function parseCondition(expr: string): ParsedCondition {
  let ast: Expression;
  try {
    ast = parser.parse(expr);
  } catch (err) {
    throw new Error(
      `Condition '${expr}' does not parse: ${(err as Error).message}`,
    );
  }
  return { source: expr, ast, variables: ast.variables() };
}

export type ConditionResult =
  | { ok: true; value: boolean }
  | { ok: false; reason: "not_boolean"; raw: unknown }
  | { ok: false; reason: "evaluation_error"; message: string };

/**
 * Evaluate a parsed condition against a scope. Never throws: a non-boolean
 * result or an evaluation error is returned as `{ok: false}` so a caller
 * (the spec validator) can report it against the offending option.
 */
export function evaluateCondition(
  parsed: ParsedCondition,
  scope: Record<string, Scalar>,
): ConditionResult {
  let raw: unknown;
  try {
    raw = parsed.ast.evaluate(scope as unknown as Record<string, number>);
  } catch (err) {
    return { ok: false, reason: "evaluation_error", message: (err as Error).message };
  }
  if (typeof raw !== "boolean") return { ok: false, reason: "not_boolean", raw };
  return { ok: true, value: raw };
}

/** Result of an expression evaluation. */
export type EvalResult =
  | { ok: true; value: Scalar }
  | { ok: false; reason: "non_finite_result"; raw: number };

/**
 * Evaluate a parsed expression against a scope of variable values.
 * Never throws for numerical issues — division by zero, log of a negative,
 * etc. are reported as `{ok: false, reason: 'non_finite_result'}` so the
 * engine can mark the target variable `undefined` and short-circuit.
 */
export function evaluateExpression(
  parsed: ParsedExpression,
  scope: Record<string, Scalar>,
): EvalResult {
  let raw: unknown;
  try {
    // expr-eval accepts a plain scope object at runtime; its typed signature
    // is narrower than what we actually pass, so we cast at the boundary.
    raw = parsed.ast.evaluate(scope as unknown as Record<string, number>);
  } catch (err) {
    // expr-eval raises on unknown identifiers; the engine layer prevents
    // this by checking status BEFORE calling evaluate, so if we hit here
    // it's a bug in the engine — surface it plainly.
    throw new Error(
      `Rule expression '${parsed.target} = ...' failed to evaluate: ${(err as Error).message}`,
    );
  }

  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) {
      return { ok: false, reason: "non_finite_result", raw };
    }
    return { ok: true, value: raw };
  }
  if (typeof raw === "boolean") {
    return { ok: true, value: raw };
  }
  if (typeof raw === "string") {
    return { ok: true, value: raw };
  }
  // Unexpected type (object, undefined) — treat as undefined outcome.
  return { ok: false, reason: "non_finite_result", raw: NaN };
}
