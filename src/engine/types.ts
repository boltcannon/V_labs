/**
 * Engine-facing types.
 *
 * `EngineResult.status` is the mechanism that keeps principle 1 honest under
 * numerically ill-defined inputs (dividing by zero, NaN propagation): a
 * variable whose producing rule cannot yield a finite scalar is marked
 * `undefined`, and every downstream rule that would consume it is skipped,
 * NOT silently given NaN. Callers (including the future AI tutor layer) can
 * inspect `status[var_id]` before quoting a number.
 */

export type Scalar = string | number | boolean;

/**
 * defined      — the engine produced a finite, well-typed value for this variable.
 * undefined    — an executed rule produced NaN / ±Infinity / no match, OR the rule
 *                that would produce this variable was skipped because one of its
 *                inputs was itself `undefined` / `not_computed`.
 * not_computed — no rule fires that produces this variable AND it was not supplied
 *                by the caller. This is the resting state for inputs a student
 *                simply hasn't set yet.
 */
export type VariableStatus = "defined" | "undefined" | "not_computed";

export interface SkippedRule {
  rule_id: string;
  /** Which upstream variable was undefined/not_computed. */
  missing_input?: string;
  /** Free-form reason: undefined_input | non_finite_result | no_match_no_default | cycle. */
  reason: string;
}

export interface EngineResult {
  /** Value for every declared variable. `null` for variables whose status is not `defined`. */
  values: Record<string, Scalar | null>;
  status: Record<string, VariableStatus>;
  /** Rule ids that ran and produced a finite value, in the order they ran. */
  executed_rules: string[];
  /** Rule ids that were skipped or produced an undefined result, with reasons. */
  skipped_rules: SkippedRule[];
  /**
   * The topological order the engine chose. Callers can log this to debug
   * "why did my rule run before its inputs?" — the answer will always be
   * "your spec disagrees with your mental model", never "the engine did".
   */
  topological_order: string[];
}

export type EngineInputs = Record<string, Scalar>;
