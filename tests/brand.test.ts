import { describe, it, expect } from "vitest";
import { runLab } from "../src/engine/rule-engine";
import type { LabSpec } from "../src/schema/lab-spec";
import { loadSpec, CLASS_9_PATH } from "./helpers";

/**
 * Compile-time and run-time enforcement of Principle 8.
 *
 * The engine's public API accepts only `ValidatedLabSpec`, a phantom-branded
 * subtype that only the loader can produce. A hand-constructed `LabSpec`
 * literal — the kind an AI-generated caller might synthesize — must fail
 * to typecheck at the call site.
 *
 * The @ts-expect-error line below is the assertion: if the brand were ever
 * removed, this line would compile without an error and `tsc` would fail
 * the build because the expected error was not raised. That is the test.
 */

describe("brand — engine refuses hand-built LabSpec at the type level", () => {
  it("compiles a real loaded spec (positive control)", () => {
    const spec = loadSpec(CLASS_9_PATH);
    const r = runLab(spec, { speed: 10, time: 5 });
    expect(r.status.distance).toBe("defined");
  });

  it("refuses a hand-built LabSpec literal at compile time", () => {
    const forged = {} as unknown as LabSpec;
    try {
      // @ts-expect-error — runLab requires ValidatedLabSpec, and a plain
      // LabSpec (even a valid one) cannot satisfy the brand. Removing this
      // ts-expect-error will fail the build — THAT is the assertion.
      // Runtime behaviour on a forged input is undefined and irrelevant;
      // we only care that the type checker refused the call.
      runLab(forged, {});
    } catch {
      // expected: forged object has no science_model, engine throws.
    }
    expect(true).toBe(true);
  });
});
