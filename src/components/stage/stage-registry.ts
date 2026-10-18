/**
 * Which labs get a live visual stage on the Investigation phase.
 *
 * A stage is UI code (it draws a particular apparatus), so the binding is
 * code too: lab id → stage kind. Labs not listed keep the plain controls
 * and the explicit Run button. Moving this into the spec (a declared
 * stage plus variable bindings) is an open design question.
 */

export type StageKind = "series_circuit";

export const LAB_STAGES: Readonly<Record<string, StageKind>> = {
  "class-10-physics-electricity": "series_circuit",
};
