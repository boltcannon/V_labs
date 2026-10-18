import { describe, it, expect } from "vitest";
import { loadSpec, CLASS_6_PATH, CLASS_9_PATH } from "./helpers";

describe("loader — YAML → typed LabSpec round-trip", () => {
  it("loads the Class 6 biology spec", () => {
    const spec = loadSpec(CLASS_6_PATH);
    expect(spec.meta.ncert_class).toBe(6);
    expect(spec.meta.subject).toBe("biology");
    expect(spec.science_model.decision_tables?.length).toBeGreaterThan(0);
    expect(spec.science_model.variables.some((v) => v.id === "habitat")).toBe(true);
  });

  it("loads the Class 9 physics spec", () => {
    const spec = loadSpec(CLASS_9_PATH);
    expect(spec.meta.ncert_class).toBe(9);
    expect(spec.meta.subject).toBe("physics");
    expect(spec.science_model.rules.some((r) => r.expression?.includes("speed"))).toBe(true);
  });
});
