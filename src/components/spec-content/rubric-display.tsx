import "server-only";

import type { Assessment } from "@/schema/lab-spec";

interface Props {
  rubric: Assessment["rubric"];
}

/**
 * Rubric renderer.
 *
 * Level-count strategy: we NEVER destructure by fixed positional index —
 * that would silently drop content when a criterion has more levels than
 * the header row, or leave a header empty when it has fewer. Instead we
 * map by index and pick the headers by the criterion's own `levels.length`.
 *
 * When every criterion has exactly 3 levels, we use the canonical
 * "Beginning / Developing / Proficient" headers (per Prompt 2 sign-off).
 * When they differ or aren't 3, we fall back to "Level 1..N" — the row
 * count derives from the widest criterion so no data is lost.
 */
export function RubricDisplay({ rubric }: Props) {
  const maxLevels = rubric.reduce(
    (m, r) => Math.max(m, r.levels.length),
    0,
  );
  const allExactlyThree = rubric.every((r) => r.levels.length === 3);

  const headers: string[] = allExactlyThree
    ? ["Beginning", "Developing", "Proficient"]
    : Array.from({ length: maxLevels }, (_, i) => `Level ${i + 1}`);

  return (
    <div className="overflow-x-auto rounded-md border border-surface-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted">
          <tr>
            <th className="text-left px-4 py-2 font-semibold text-text-muted w-1/4">
              Criterion
            </th>
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left px-4 py-2 font-semibold text-text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rubric.map((row, ri) => (
            <tr
              key={ri}
              className={ri > 0 ? "border-t border-surface-border" : ""}
            >
              <td className="px-4 py-3 align-top font-medium text-text">
                {row.criterion}
              </td>
              {headers.map((_, ci) => (
                <td key={ci} className="px-4 py-3 align-top text-text">
                  {row.levels[ci] ?? (
                    <span className="text-text-soft italic">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
