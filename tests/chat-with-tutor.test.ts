import { describe, it, expect, vi, beforeEach } from "vitest";

// Groq client mock (OpenAI-compatible SDK) — the constructor and
// .chat.completions.create must be replaced or the guard test below
// would try to hit the real API. We use a manual mock via vi.mock so the
// module import itself is safe.
const createMock = vi.fn();
vi.mock("openai", () => {
  class OpenAI {
    chat = { completions: { create: createMock } };
    constructor() {}
  }
  return { default: OpenAI };
});

import { chatWithTutor } from "../src/app/actions/chat-with-tutor";
import { MAX_TURNS } from "../src/app/lib/tutor-constants";
import type { TutorMessage } from "../src/app/lib/tutor-types";

// A lab_id that exists in src/specs/
const VALID_LAB_ID = "class-9-physics-motion";

beforeEach(() => {
  createMock.mockReset();
});

describe("chatWithTutor — 20-message guard", () => {
  it("refuses when messages.length > MAX_TURNS, without calling the API", async () => {
    const messages: TutorMessage[] = Array.from(
      { length: MAX_TURNS + 1 },
      (_, i) => ({ role: "user" as const, content: `msg ${i}` }),
    );
    const out = await chatWithTutor({
      lab_id: VALID_LAB_ID,
      current_phase: "provocation",
      messages,
      phase_responses: {},
    });
    expect(out.error).toMatch(/Long conversation/);
    expect(out.reply).toBe("");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("accepts messages.length <= MAX_TURNS and calls the Groq API", async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: "What did you notice?" } }],
    });
    const messages: TutorMessage[] = [
      { role: "user", content: "Hello" },
    ];
    const out = await chatWithTutor({
      lab_id: VALID_LAB_ID,
      current_phase: "provocation",
      messages,
      phase_responses: {},
    });
    expect(out.error).toBeUndefined();
    expect(out.reply).toBe("What did you notice?");
    expect(createMock).toHaveBeenCalledOnce();
  });
});

describe("chatWithTutor — lab_id provenance", () => {
  it("refuses when the client-sent lab_id does not match any available spec", async () => {
    const out = await chatWithTutor({
      lab_id: "not-the-real-lab",
      current_phase: "provocation",
      messages: [{ role: "user", content: "hi" }],
      phase_responses: {},
    });
    expect(out.error).toMatch(/Unknown lab/);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("accepts any lab_id that has a spec file in src/specs/", async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: "Welcome!" } }],
    });
    const out = await chatWithTutor({
      lab_id: "class-6-biology-habitat-explorer",
      current_phase: "provocation",
      messages: [{ role: "user", content: "hi" }],
      phase_responses: {},
    });
    expect(out.error).toBeUndefined();
    expect(out.reply).toBe("Welcome!");
    expect(createMock).toHaveBeenCalledOnce();
  });
});
