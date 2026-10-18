/**
 * Lab discovery — lists available specs from the `src/specs/` directory.
 *
 * `listLabIds()` is a cheap filename scan (no YAML parsing).
 * `listLabSummaries()` loads each spec's `meta` block for display in the
 * lab picker.
 *
 * Both are server-only: the `server-only` import prevents accidental
 * inclusion in a client bundle.
 */

import "server-only";

import * as fs from "node:fs";
import * as path from "node:path";
import { getLabSpec } from "./get-lab-spec";

const SPECS_DIR = path.join(process.cwd(), "src", "specs");

/**
 * Returns the lab_id strings for every valid `.yaml` file in `src/specs/`.
 * Cheap — no YAML parsing, just a directory listing.
 */
export function listLabIds(): string[] {
  const files = fs.readdirSync(SPECS_DIR);
  return files
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""))
    .sort();
}

export interface LabSummary {
  lab_id: string;
  topic: string;
  ncert_class: number;
  subject: string;
  chapter_reference?: string;
  estimated_duration_minutes?: number;
}

/**
 * Returns a summary card for every available lab. Loads each spec through
 * the standard `getLabSpec` loader (which is `React.cache`-deduped and
 * process-cached), so the first call in a cold start pays the YAML+Zod
 * cost and subsequent calls within the same request are free.
 */
export function listLabSummaries(): LabSummary[] {
  const ids = listLabIds();
  return ids.map((id) => {
    const spec = getLabSpec(id);
    return {
      lab_id: id,
      topic: spec.meta.topic,
      ncert_class: spec.meta.ncert_class,
      subject: spec.meta.subject,
      chapter_reference: spec.meta.chapter_reference,
      estimated_duration_minutes: spec.meta.estimated_duration_minutes,
    };
  });
}
