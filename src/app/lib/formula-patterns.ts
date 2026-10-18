/**
 * Formula Pattern Library — reusable expression templates for the
 * authoring wizard's Formula Pattern Picker.
 *
 * Each pattern describes a common mathematical relationship a teacher
 * might use in a science model. The wizard renders slots for the
 * teacher to fill in (which variables map to which role), then
 * generates the expression string the engine expects.
 *
 * The Threshold pattern is special: it produces a boolean derived
 * variable suitable as an input to a decision table — the same
 * bridge pattern proven in the Class 9 motion spec (expression →
 * derived boolean → decision table → categorical output).
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PatternSlot {
  /** Slot identifier used in the template, e.g. "A", "B", "OUT". */
  id: string;
  /** Human-readable label, e.g. "Output variable", "First operand". */
  label: string;
  /**
   * Constraint on which variable types can fill this slot.
   *   - "number" — only number-typed variables
   *   - "boolean" — only boolean-typed variables
   *   - "any" — any variable type
   */
  variableType: "number" | "boolean" | "any";
  /** Whether this slot is the rule's output (left-hand side). */
  isOutput: boolean;
}

export interface FormulaPattern {
  id: string;
  label: string;
  description: string;
  /**
   * The template expression using slot ids as placeholders.
   * Example: "OUT = A * B"
   */
  template: string;
  slots: PatternSlot[];
  /**
   * When true, the output variable should be typed as boolean.
   * The wizard uses this to auto-set the output variable's type.
   */
  outputIsBoolean?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Pattern definitions                                                */
/* ------------------------------------------------------------------ */

export const FORMULA_PATTERNS: FormulaPattern[] = [
  {
    id: "linear",
    label: "Product (Y = A × B)",
    description:
      "Output equals the product of two inputs. Common for physics relationships like distance = speed × time.",
    template: "OUT = A * B",
    slots: [
      { id: "OUT", label: "Output variable", variableType: "number", isOutput: true },
      { id: "A", label: "First operand", variableType: "number", isOutput: false },
      { id: "B", label: "Second operand", variableType: "number", isOutput: false },
    ],
  },
  {
    id: "division",
    label: "Division (Y = A / B)",
    description:
      "Output equals one input divided by another. Common for ratios like speed = distance / time, or pressure = force / area.",
    template: "OUT = A / B",
    slots: [
      { id: "OUT", label: "Output variable", variableType: "number", isOutput: true },
      { id: "A", label: "Numerator", variableType: "number", isOutput: false },
      { id: "B", label: "Denominator", variableType: "number", isOutput: false },
    ],
  },
  {
    id: "sum",
    label: "Sum (Y = A + B)",
    description:
      "Output equals the sum of two inputs. Useful for totals like total_distance = leg1_distance + leg2_distance.",
    template: "OUT = A + B",
    slots: [
      { id: "OUT", label: "Output variable", variableType: "number", isOutput: true },
      { id: "A", label: "First addend", variableType: "number", isOutput: false },
      { id: "B", label: "Second addend", variableType: "number", isOutput: false },
    ],
  },
  {
    id: "difference",
    label: "Difference (Y = A − B)",
    description:
      "Output equals one input minus another. Useful for changes, e.g. temperature_change = final_temp − initial_temp.",
    template: "OUT = A - B",
    slots: [
      { id: "OUT", label: "Output variable", variableType: "number", isOutput: true },
      { id: "A", label: "Minuend", variableType: "number", isOutput: false },
      { id: "B", label: "Subtrahend", variableType: "number", isOutput: false },
    ],
  },
  {
    id: "threshold",
    label: "Threshold (Y = A > value)",
    description:
      "Output is true when an input exceeds a numeric threshold. Produces a boolean variable that can feed a decision table — the bridge from continuous to categorical.",
    template: "OUT = A > THRESHOLD",
    slots: [
      { id: "OUT", label: "Output boolean", variableType: "boolean", isOutput: true },
      { id: "A", label: "Variable to compare", variableType: "number", isOutput: false },
    ],
    outputIsBoolean: true,
  },
  {
    id: "threshold_lte",
    label: "Threshold ≤ (Y = A <= value)",
    description:
      "Output is true when an input is at or below a threshold. The complement of the > threshold pattern.",
    template: "OUT = A <= THRESHOLD",
    slots: [
      { id: "OUT", label: "Output boolean", variableType: "boolean", isOutput: true },
      { id: "A", label: "Variable to compare", variableType: "number", isOutput: false },
    ],
    outputIsBoolean: true,
  },
  {
    id: "two_part_average",
    label: "Two-part average (Y = (A₁ + A₂) / (B₁ + B₂))",
    description:
      "Output equals the sum of two numerators divided by the sum of two denominators. The correct formula for average speed over two legs — NOT the arithmetic mean of the two leg speeds.",
    template: "OUT = (A1 + A2) / (B1 + B2)",
    slots: [
      { id: "OUT", label: "Output variable", variableType: "number", isOutput: true },
      { id: "A1", label: "First numerator", variableType: "number", isOutput: false },
      { id: "A2", label: "Second numerator", variableType: "number", isOutput: false },
      { id: "B1", label: "First denominator", variableType: "number", isOutput: false },
      { id: "B2", label: "Second denominator", variableType: "number", isOutput: false },
    ],
  },
  {
    id: "equality_within_tolerance",
    label: "Equality within tolerance (Y = |A − B| < ε)",
    description:
      "Output is true when the absolute difference of two inputs is below a tolerance. Safer than exact equality for floating-point comparisons, e.g. speeds_equal = abs(v1 - v2) < 0.001.",
    template: "OUT = abs(A - B) < THRESHOLD",
    slots: [
      { id: "OUT", label: "Output boolean", variableType: "boolean", isOutput: true },
      { id: "A", label: "First operand", variableType: "number", isOutput: false },
      { id: "B", label: "Second operand", variableType: "number", isOutput: false },
    ],
    outputIsBoolean: true,
  },
  {
    id: "both_zero_check",
    label: "Both-zero check (Y = (A == 0) and (B == 0))",
    description:
      "Output is true when both inputs are zero. Used in the Class 9 motion spec to detect the 'at rest' case before classifying motion type.",
    template: "OUT = (A == 0) and (B == 0)",
    slots: [
      { id: "OUT", label: "Output boolean", variableType: "boolean", isOutput: true },
      { id: "A", label: "First value", variableType: "number", isOutput: false },
      { id: "B", label: "Second value", variableType: "number", isOutput: false },
    ],
    outputIsBoolean: true,
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Given a pattern and a mapping of slot ids → variable ids, plus an
 * optional threshold value, returns the engine-ready expression string.
 *
 * Example:
 *   instantiatePattern(
 *     FORMULA_PATTERNS.find(p => p.id === "division")!,
 *     { OUT: "pressure", A: "force", B: "area" },
 *   )
 *   → "pressure = force / area"
 */
export function instantiatePattern(
  pattern: FormulaPattern,
  slotMapping: Record<string, string>,
  thresholdValue?: number,
): string {
  let expr = pattern.template;
  for (const slot of pattern.slots) {
    const varId = slotMapping[slot.id];
    if (!varId) {
      throw new Error(`Slot '${slot.id}' not mapped for pattern '${pattern.id}'.`);
    }
    expr = expr.replaceAll(slot.id, varId);
  }
  if (expr.includes("THRESHOLD")) {
    if (thresholdValue === undefined) {
      throw new Error(`Pattern '${pattern.id}' requires a threshold value.`);
    }
    expr = expr.replaceAll("THRESHOLD", String(thresholdValue));
  }
  return expr;
}

/**
 * Returns the pattern object by id, or undefined if not found.
 */
export function getPatternById(id: string): FormulaPattern | undefined {
  return FORMULA_PATTERNS.find((p) => p.id === id);
}
