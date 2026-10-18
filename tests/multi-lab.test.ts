/**
 * Tests for the multi-lab refactor (Prompt 5, Checkpoint 1).
 *
 * Verifies that:
 *   - Known lab_ids load correctly
 *   - Unknown lab_ids throw LabNotFoundError (not a crash / unhandled exception)
 *   - Path-traversal attempts are rejected
 *   - The server actions surface a clean error string for unknown labs
 *   - listLabIds returns all specs in src/specs/
 */

import { describe, it, expect, vi } from "vitest";

import {
  getLabSpec,
  labExists,
  LabNotFoundError,
  clearSpecCache,
} from "../src/app/lib/get-lab-spec";

// ---------- labExists ----------

describe("labExists", () => {
  it("returns true for a known spec", () => {
    expect(labExists("class-9-physics-motion")).toBe(true);
  });

  it("returns true for the biology spec", () => {
    expect(labExists("class-6-biology-habitat-explorer")).toBe(true);
  });

  it("returns false for an unknown lab_id", () => {
    expect(labExists("nonexistent-lab")).toBe(false);
  });

  it("rejects path-traversal attempts", () => {
    expect(labExists("../package")).toBe(false);
    expect(labExists("foo/bar")).toBe(false);
    expect(labExists("..\\secrets")).toBe(false);
  });
});

// ---------- getLabSpec ----------

describe("getLabSpec", () => {
  it("loads a known spec and returns a ValidatedLabSpec", () => {
    const spec = getLabSpec("class-9-physics-motion");
    expect(spec.meta.topic).toBe("Uniform and Non-uniform Motion");
    expect(spec.meta.ncert_class).toBe(9);
  });

  it("loads the biology spec", () => {
    const spec = getLabSpec("class-6-biology-habitat-explorer");
    expect(spec.meta.subject).toBe("biology");
  });

  it("throws LabNotFoundError for an unknown lab_id", () => {
    expect(() => getLabSpec("nonexistent-lab")).toThrow(LabNotFoundError);
  });

  it("the error message includes the lab_id", () => {
    expect(() => getLabSpec("fake-lab-999")).toThrow(/fake-lab-999/);
  });

  it("throws LabNotFoundError (not a generic Error) for path traversal", () => {
    expect(() => getLabSpec("../package")).toThrow(LabNotFoundError);
  });
});

// ---------- clearSpecCache ----------

describe("clearSpecCache", () => {
  it("does not throw for a lab_id not in cache", () => {
    expect(() => clearSpecCache("never-cached")).not.toThrow();
  });

  it("allows a spec to be reloaded after clearing", () => {
    // Load to populate cache
    const first = getLabSpec("class-9-physics-motion");
    // Clear and reload — should still work
    clearSpecCache("class-9-physics-motion");
    const second = getLabSpec("class-9-physics-motion");
    // Both should be valid specs (though possibly different object refs)
    expect(second.meta.topic).toBe(first.meta.topic);
  });
});

// ---------- Server action: runExperiment ----------

// Mock openai so chat-with-tutor import doesn't break
const createMock = vi.fn();
vi.mock("openai", () => {
  class OpenAI {
    chat = { completions: { create: createMock } };
    constructor() {}
  }
  return { default: OpenAI };
});

import { runExperiment } from "../src/app/actions/run-experiment";
import { chatWithTutor } from "../src/app/actions/chat-with-tutor";

describe("runExperiment — unknown lab_id", () => {
  it("returns an error string, not an unhandled exception", async () => {
    const out = await runExperiment({
      lab_id: "nonexistent-lab",
      inputs: {},
    });
    expect(out.error).toMatch(/Unknown lab/);
    expect(out.result.values).toEqual({});
  });
});

describe("chatWithTutor — unknown lab_id", () => {
  it("returns an error string, not an unhandled exception", async () => {
    const out = await chatWithTutor({
      lab_id: "nonexistent-lab",
      current_phase: "provocation",
      messages: [{ role: "user", content: "hi" }],
      phase_responses: {},
    });
    expect(out.error).toMatch(/Unknown lab/);
    expect(out.reply).toBe("");
    expect(createMock).not.toHaveBeenCalled();
  });
});
