/**
 * TEMPORARY — Checkpoint 3 live-behaviour verification.
 *
 * Reads pre-built system prompts from scripts/live-test-payloads.json
 * (generated in the cloud container where @/ aliases resolve) and sends
 * each to the Groq API. Records exact raw responses to
 * scripts/live-behaviour-output.json.
 *
 * Usage (from the project root, with .env.local containing GROQ_API_KEY):
 *
 *   npx tsx scripts/run-live-tests.ts
 *
 * NO project imports — only node builtins + the `openai` npm package.
 * This file and its companions are deleted after docs/tutor-behaviour-log.md
 * is produced.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import OpenAI from "openai";

// --- Load .env.local manually (avoids a dotenv dependency) -----------
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf-8");
  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// --- Setup ------------------------------------------------------------
const GROQ_KEY = process.env.GROQ_API_KEY;
if (!GROQ_KEY) {
  console.error("ERROR: GROQ_API_KEY not found in .env.local or environment.");
  process.exit(1);
}

const payloadsPath = path.join(__dirname, "live-test-payloads.json");
if (!fs.existsSync(payloadsPath)) {
  console.error("ERROR: live-test-payloads.json not found. Generate it first.");
  process.exit(1);
}

interface Payload {
  key: string;
  prompt: string;
  model: string;
  max_tokens: number;
  messages: Array<{ role: "system" | "user"; content: string }>;
}

const payloads: Payload[] = JSON.parse(fs.readFileSync(payloadsPath, "utf-8"));

const client = new OpenAI({
  apiKey: GROQ_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// --- Run ---------------------------------------------------------------
async function main() {
  const results: Record<string, { prompt: string; reply: string; error?: string }> = {};

  for (const p of payloads) {
    console.log(`\n>>> Sending: "${p.prompt}"`);

    try {
      const response = await client.chat.completions.create({
        model: p.model,
        max_tokens: p.max_tokens,
        messages: p.messages,
      });
      const reply = response.choices[0]?.message?.content ?? "";
      console.log(`<<< Reply: ${reply}`);
      results[p.key] = { prompt: p.prompt, reply };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`<<< ERROR: ${msg}`);
      results[p.key] = { prompt: p.prompt, reply: "", error: msg };
    }
  }

  const outPath = path.join(__dirname, "live-behaviour-output.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nResults written to ${outPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
