import { describe, it, expect } from "vitest";
import { resolveDecisionTable } from "../src/engine/decision-table";
import type { DecisionTable } from "../src/schema/lab-spec";

describe("decision-table resolver", () => {
  const table: DecisionTable = {
    id: "t",
    inputs: ["a", "b"],
    output: "out",
    rows: [
      { when: { a: "x", b: 1 }, then: "hit1" },
      { when: { a: "y", b: 2 }, then: "hit2" },
    ],
    default: "fallback",
  };

  it("first-match wins", () => {
    const r = resolveDecisionTable(table, { a: "x", b: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("hit1");
  });

  it("no match falls to default", () => {
    const r = resolveDecisionTable(table, { a: "z", b: 99 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("fallback");
  });

  it("no match and no default → not ok", () => {
    const t2 = { ...table };
    delete (t2 as { default?: unknown }).default;
    const r = resolveDecisionTable(t2, { a: "z", b: 99 });
    expect(r.ok).toBe(false);
  });

  it("type-strict: '1' does not equal 1", () => {
    const r = resolveDecisionTable(table, { a: "x", b: "1" as unknown as number });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("fallback");
  });
});
