import { describe, it, expect } from "vitest";
import { runLab, planLab } from "../src/engine/rule-engine";
import { loadSpec, CLASS_6_PATH, CLASS_9_PATH } from "./helpers";

describe("engine — Class 9 physics correctness", () => {
  const spec = loadSpec(CLASS_9_PATH);

  it("scenario 1: uniform motion, distance = speed * time", () => {
    const r = runLab(spec, { speed: 10, time: 5 });
    expect(r.status.distance).toBe("defined");
    expect(r.values.distance).toBe(50);
    expect(r.executed_rules).toContain("distance_from_speed_time");
  });

  it("scenario 2: average speed on a two-leg journey (Umang's cycling example)", () => {
    // 500 m in 50 s (10 m/s), 500 m in 100 s (5 m/s).
    // Naive mean of speeds: 7.5 m/s. Correct average speed: 1000/150 = 6.666...
    const r = runLab(spec, {
      leg1_distance: 500,
      leg1_time: 50,
      leg2_distance: 500,
      leg2_time: 100,
    });
    expect(r.status.average_speed).toBe("defined");
    expect(r.values.average_speed).toBeCloseTo(1000 / 150, 6);
    expect(r.status.speed_leg1).toBe("defined");
    expect(r.values.speed_leg1).toBe(10);
    expect(r.values.speed_leg2).toBe(5);
    // Not the arithmetic mean:
    expect(r.values.average_speed).not.toBeCloseTo(7.5, 3);
  });

  it("scenario 3: classifies uniform motion when both legs have equal speed", () => {
    const r = runLab(spec, {
      leg1_distance: 100,
      leg1_time: 10,
      leg2_distance: 100,
      leg2_time: 10,
    });
    expect(r.values.motion_class).toBe("uniform");
    expect(r.status.motion_class).toBe("defined");
  });

  it("scenario 4: classifies at_rest when both leg speeds are zero", () => {
    const r = runLab(spec, {
      leg1_distance: 0,
      leg1_time: 10,
      leg2_distance: 0,
      leg2_time: 10,
    });
    expect(r.values.motion_class).toBe("at_rest");
  });

  it("scenario 5: classifies non_uniform when leg speeds differ", () => {
    const r = runLab(spec, {
      leg1_distance: 100,
      leg1_time: 10,   // 10 m/s
      leg2_distance: 100,
      leg2_time: 25,   // 4 m/s
    });
    expect(r.values.motion_class).toBe("non_uniform");
  });
});

describe("engine — Class 6 biology correctness", () => {
  const spec = loadSpec(CLASS_6_PATH);

  it("scenario 1: fish (scales + fins) in aquatic habitat is well_adapted", () => {
    const r = runLab(spec, {
      habitat: "aquatic",
      body_covering: "scales",
      limb_type: "fins",
      water_storage: false,
    });
    expect(r.values.organism_class).toBe("fish");
    expect(r.values.is_well_adapted).toBe("well_adapted");
  });

  it("scenario 2: cactus (spines + roots) in desert with water_storage is well_adapted", () => {
    const r = runLab(spec, {
      habitat: "desert",
      body_covering: "spines",
      limb_type: "roots",
      water_storage: true,
    });
    expect(r.values.organism_class).toBe("cactus");
    expect(r.values.is_well_adapted).toBe("well_adapted");
  });

  it("scenario 3: fish placed in a desert is poorly_adapted", () => {
    const r = runLab(spec, {
      habitat: "desert",
      body_covering: "scales",
      limb_type: "fins",
      water_storage: false,
    });
    expect(r.values.organism_class).toBe("fish");
    expect(r.values.is_well_adapted).toBe("poorly_adapted");
  });

  it("scenario 4: unknown combination falls to 'unknown' via the classifier default", () => {
    const r = runLab(spec, {
      habitat: "grassland",
      body_covering: "waxy_cuticle",
      limb_type: "wings",
      water_storage: false,
    });
    expect(r.values.organism_class).toBe("unknown");
  });
});

describe("engine — planLab exposes topological order", () => {
  it("class 9 rules execute in dependency order", () => {
    const spec = loadSpec(CLASS_9_PATH);
    const order = planLab(spec).topological_order;
    // speed_leg1_calc and speed_leg2_calc must precede speeds_equal_flag,
    // which must precede classify_motion.
    const idx = (id: string) => order.indexOf(id);
    expect(idx("speed_leg1_calc")).toBeLessThan(idx("speeds_equal_flag"));
    expect(idx("speed_leg2_calc")).toBeLessThan(idx("speeds_equal_flag"));
    expect(idx("speeds_equal_flag")).toBeLessThan(idx("classify_motion"));
    expect(idx("both_zero_flag")).toBeLessThan(idx("classify_motion"));
  });

  it("class 6 rules order: classify_organism precedes adaptation_fit", () => {
    const spec = loadSpec(CLASS_6_PATH);
    const order = planLab(spec).topological_order;
    expect(order.indexOf("classify_organism")).toBeLessThan(
      order.indexOf("adaptation_fit"),
    );
  });
});
