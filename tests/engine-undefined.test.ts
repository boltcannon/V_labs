import { describe, it, expect } from "vitest";
import { runLab } from "../src/engine/rule-engine";
import { loadSpec, CLASS_9_PATH } from "./helpers";

/**
 * Undefined-outcome propagation — the specific behaviour Umang called out
 * as a Checkpoint 2 requirement. Division by zero, non-finite results, and
 * missing inputs must never appear as science; they must appear as
 * status='undefined' with an executed_rules trace that shows why.
 */

describe("engine — undefined-outcome handling", () => {
  const spec = loadSpec(CLASS_9_PATH);

  it("zero leg1_time makes speed_leg1 undefined and does not poison unrelated outputs", () => {
    const r = runLab(spec, {
      leg1_distance: 100,
      leg1_time: 0,          // <-- division by zero on leg 1
      leg2_distance: 100,
      leg2_time: 10,
    });
    expect(r.status.speed_leg1).toBe("undefined");
    expect(r.values.speed_leg1).toBe(null);
    // Downstream: speeds_equal depends on speed_leg1, so it is undefined too.
    expect(r.status.speeds_equal).toBe("undefined");
    // motion_class depends on speeds_equal → undefined.
    expect(r.status.motion_class).toBe("undefined");
    // average_speed does NOT depend on speed_leg1, so it should be defined:
    // (100 + 100) / (0 + 10) = 20 m/s.
    expect(r.status.average_speed).toBe("defined");
    expect(r.values.average_speed).toBe(20);

    // The skipped_rules trace names the missing input:
    const skipped = r.skipped_rules.find((s) => s.rule_id === "speed_leg1_calc");
    expect(skipped).toBeDefined();
    expect(skipped?.reason).toBe("non_finite_result");
  });

  it("both leg times zero: total-time zero makes average_speed undefined too", () => {
    const r = runLab(spec, {
      leg1_distance: 0,
      leg1_time: 0,
      leg2_distance: 0,
      leg2_time: 0,
    });
    expect(r.status.average_speed).toBe("undefined");
    expect(r.status.speed_leg1).toBe("undefined");
    expect(r.status.speed_leg2).toBe("undefined");
    expect(r.status.motion_class).toBe("undefined");
  });

  it("zero distance but positive time: speed = 0, well-defined", () => {
    const r = runLab(spec, {
      leg1_distance: 0,
      leg1_time: 10,
      leg2_distance: 0,
      leg2_time: 10,
    });
    expect(r.status.speed_leg1).toBe("defined");
    expect(r.values.speed_leg1).toBe(0);
    expect(r.values.motion_class).toBe("at_rest");
  });

  it("missing inputs mark downstream vars not_computed / undefined, not throw", () => {
    // Only leg1_* supplied; leg2_* missing.
    const r = runLab(spec, {
      leg1_distance: 100,
      leg1_time: 10,
    });
    // speed_leg1 defined; speed_leg2 undefined; motion_class undefined.
    expect(r.status.speed_leg1).toBe("defined");
    expect(r.status.speed_leg2).toBe("undefined");
    expect(r.status.motion_class).toBe("undefined");

    // The skipped_rules trace names the missing_input for the short-circuited rule.
    const skipped = r.skipped_rules.find((s) => s.rule_id === "speed_leg2_calc");
    expect(skipped?.missing_input).toBe("leg2_distance"); // first missing
    expect(skipped?.reason).toBe("undefined_input");
  });

  it("Infinity in an input is rejected via type-checking (throws by default)", () => {
    expect(() =>
      runLab(spec, { speed: Infinity, time: 5 }),
    ).toThrow(/non-finite/);
  });

  it("NaN in an input is rejected via type-checking (throws by default)", () => {
    expect(() =>
      runLab(spec, { speed: NaN, time: 5 }),
    ).toThrow(/non-finite/);
  });

  it("tolerate_bad_inputs: a NaN input is marked undefined, propagates downstream", () => {
    const r = runLab(
      spec,
      { speed: NaN, time: 5 },
      { tolerate_bad_inputs: true },
    );
    expect(r.status.speed).toBe("undefined");
    expect(r.status.distance).toBe("undefined");
  });

  it("undefined never appears as a raw NaN or Infinity in values", () => {
    const r = runLab(spec, {
      leg1_distance: 1,
      leg1_time: 0,
      leg2_distance: 1,
      leg2_time: 1,
    });
    for (const [id, v] of Object.entries(r.values)) {
      if (r.status[id] !== "defined") {
        expect(v).toBe(null);
      } else {
        if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
