/**
 * Decision-table resolver.
 *
 * A decision table is a first-match categorical rule:
 *   Given values for the declared `inputs`, walk `rows` in order. The first
 *   row whose entire `when` clause matches wins; its `then` is the output.
 *   If no row matches, `default` (if present) is used. Otherwise, the
 *   outcome is undefined.
 *
 * `when` matches by strict equality on Scalar (===). Booleans, numbers and
 * strings are all valid; type coercion is intentionally NOT performed —
 * a teacher who writes `when: {both_zero: "true"}` would get a validation-
 * time error from Zod because Zod treats YAML `true` and `"true"` as
 * distinct scalars.
 */

import type { DecisionTable } from "../schema/lab-spec";
import type { Scalar } from "./types";

export type DecisionTableResult =
  | { ok: true; value: Scalar; matched_row: number }
  | { ok: true; value: Scalar; matched_row: null; used_default: true }
  | { ok: false; reason: "no_match_no_default" };

export function resolveDecisionTable(
  table: DecisionTable,
  scope: Record<string, Scalar>,
): DecisionTableResult {
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i]!;
    let matched = true;
    for (const key of Object.keys(row.when)) {
      const expected = row.when[key]!;
      const actual = scope[key];
      if (actual !== expected) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return { ok: true, value: row.then, matched_row: i };
    }
  }
  if (table.default !== undefined) {
    return {
      ok: true,
      value: table.default,
      matched_row: null,
      used_default: true,
    };
  }
  return { ok: false, reason: "no_match_no_default" };
}
