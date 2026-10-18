/**
 * Server-side spec loader — the ONLY place in the Next.js app that touches
 * the loader. The `server-only` import makes this file a build error
 * if a client component (or transitively client) ever imports it.
 *
 * Multi-lab: accepts a `labId` parameter so any lab in `src/specs/` can be
 * loaded on demand. The process-level cache is a Map keyed by lab_id, so
 * multiple labs can be hot simultaneously.
 */

import "server-only";

import * as React from "react";
import * as path from "node:path";
import * as fs from "node:fs";
import { loadLabSpecFromFile } from "@/loader/spec-loader";
import type { ValidatedLabSpec } from "@/schema/lab-spec";

/* ------------------------------------------------------------------ */
/*  Error thrown when a requested lab_id has no matching spec file     */
/* ------------------------------------------------------------------ */

export class LabNotFoundError extends Error {
  constructor(public labId: string) {
    super(`No spec found for lab '${labId}'.`);
    this.name = "LabNotFoundError";
  }
}

/* ------------------------------------------------------------------ */
/*  Cheap existence check — no YAML parsing                            */
/* ------------------------------------------------------------------ */

const SPECS_DIR = path.join(process.cwd(), "src", "specs");

export function labExists(labId: string): boolean {
  // Guard against path traversal — a lab_id should be a simple slug.
  if (labId.includes("/") || labId.includes("\\") || labId.includes("..")) {
    return false;
  }
  return fs.existsSync(path.join(SPECS_DIR, `${labId}.yaml`));
}

/* ------------------------------------------------------------------ */
/*  React.cache wrapper (safe in both RSC and Vitest)                  */
/* ------------------------------------------------------------------ */

/**
 * `React.cache` is only defined in RSC-aware React entrypoints. In a
 * Vitest run the imported React is a plain build without `cache`, so we
 * fall back to identity — the module-level `processCache` below still
 * dedupes across calls.
 */
const cacheFn: <F extends (...args: never[]) => unknown>(f: F) => F =
  (React as unknown as { cache?: <F>(f: F) => F }).cache ??
  (<F,>(f: F) => f);

/* ------------------------------------------------------------------ */
/*  Process-level cache (Map: supports multiple labs simultaneously)   */
/* ------------------------------------------------------------------ */

const processCache = new Map<string, ValidatedLabSpec>();

function loadOnce(id: string): ValidatedLabSpec {
  const cached = processCache.get(id);
  if (cached) return cached;
  const abs = path.join(SPECS_DIR, `${id}.yaml`);
  const spec = loadLabSpecFromFile(abs);
  processCache.set(id, spec);
  return spec;
}

/* ------------------------------------------------------------------ */
/*  Cache invalidation (for the authoring wizard's save action)        */
/* ------------------------------------------------------------------ */

/**
 * Evict a single lab from the process-level cache. Call this from
 * `saveLabSpec` after writing a new or updated YAML file so the next
 * `getLabSpec(labId)` reparses from disk.
 *
 * NOTE: the caller (`saveLabSpec`) must also call
 * `revalidatePath("/")` so Next.js regenerates the lab-picker page
 * and any cached RSC trees that reference this lab.
 */
export function clearSpecCache(labId: string): void {
  processCache.delete(labId);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Two-layer cache:
 *   - `React.cache` dedupes calls within a single RSC/Server Action request.
 *   - `processCache` (module-level Map) keeps parsed specs across requests
 *     for the life of the server process.
 * Both are safe together: the request-level cache is a fast in-request
 * dedupe; the process cache means only the first request in a cold start
 * pays the YAML+Zod cost per lab.
 *
 * Throws `LabNotFoundError` if the lab_id has no matching spec file.
 */
export const getLabSpec = cacheFn((labId: string): ValidatedLabSpec => {
  if (!labExists(labId)) {
    throw new LabNotFoundError(labId);
  }
  return loadOnce(labId);
});
