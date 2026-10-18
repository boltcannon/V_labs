"use server";

/**
 * Server Action: save a teacher-authored lab spec from the wizard.
 *
 * Flow:
 *   1. Receive the wizard's LabSpec-shaped plain object.
 *   2. Serialize to YAML via js-yaml.
 *   3. Validate through `parseLabSpec()` — the same Zod pipeline the
 *      loader uses for hand-authored YAML. This is the thesis claim:
 *      wizard-authored specs pass the identical validation as the
 *      exemplar specs.
 *   4. Write to `src/specs/{labId}.yaml`.
 *   5. Clear the process-level spec cache + Next.js page cache.
 *   6. Return success or structured validation errors.
 *
 * Security notes:
 *   - labId is sanitised (no path traversal).
 *   - YAML is validated BEFORE writing (no invalid spec on disk).
 *   - This action runs server-side only ("use server" + server-only).
 */

import "server-only";

import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import { revalidatePath } from "next/cache";
import { parseLabSpec } from "@/loader/spec-loader";
import { SpecValidationError } from "@/loader/spec-loader";
import { clearSpecCache } from "@/app/lib/get-lab-spec";
import type { LabSpec } from "@/schema/lab-spec";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SaveLabSpecInput {
  /** The spec data from the wizard (plain object, no brand). */
  spec: LabSpec;
  /**
   * Explicit lab_id override. If omitted, derived from meta:
   *   class-{ncert_class}-{subject}-{topic_slug}
   */
  labId?: string | undefined;
}

export interface SaveLabSpecSuccess {
  ok: true;
  labId: string;
  filePath: string;
}

export interface SaveLabSpecFailure {
  ok: false;
  errors: Array<{ path: string; message: string }>;
}

export type SaveLabSpecResult = SaveLabSpecSuccess | SaveLabSpecFailure;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const SPECS_DIR = path.join(process.cwd(), "src", "specs");

/** Derive a filesystem-safe lab_id from the meta block. */
function deriveLabId(spec: LabSpec): string {
  const slug = spec.meta.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `class-${spec.meta.ncert_class}-${spec.meta.subject}-${slug}`;
}

/** Guard against path-traversal: lab_id must be a simple slug. */
function isValidLabId(labId: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(labId) &&
    !labId.includes("..") &&
    !labId.includes("/") &&
    !labId.includes("\\");
}

/* ------------------------------------------------------------------ */
/*  Save action                                                        */
/* ------------------------------------------------------------------ */

export async function saveLabSpec(
  input: SaveLabSpecInput,
): Promise<SaveLabSpecResult> {
  const labId = input.labId ?? deriveLabId(input.spec);

  // 1. Validate the lab_id shape.
  if (!isValidLabId(labId)) {
    return {
      ok: false,
      errors: [{ path: "labId", message: `Invalid lab_id: '${labId}'.` }],
    };
  }

  // 2. Serialize to YAML.
  const yamlText = yaml.dump(input.spec, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });

  // 3. Validate through parseLabSpec — same Zod path as the loader.
  //    This IS the Principle 9 enforcement: the wizard's output must
  //    survive the same schema the engine trusts.
  try {
    parseLabSpec(yamlText, `wizard:${labId}`);
  } catch (err) {
    if (err instanceof SpecValidationError) {
      return { ok: false, errors: err.issues };
    }
    return {
      ok: false,
      errors: [{
        path: "",
        message: err instanceof Error ? err.message : "Unknown validation error",
      }],
    };
  }

  // 4. Write to disk.
  const filePath = path.join(SPECS_DIR, `${labId}.yaml`);
  fs.writeFileSync(filePath, yamlText, "utf8");

  // 5. Invalidate caches.
  clearSpecCache(labId);
  revalidatePath("/");

  return { ok: true, labId, filePath };
}
