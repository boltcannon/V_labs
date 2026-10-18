import "server-only";

import type { Ncl } from "@/schema/lab-spec";

interface Props {
  ncl: Ncl;
}

export function NclContent({ ncl }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Concepts you'll need
        </div>
        <ol className="mt-2 space-y-1.5 list-decimal list-inside marker:text-text-soft">
          {ncl.concepts_required.map((c, i) => (
            <li key={i} className="text-[15px] leading-relaxed text-text">
              {c}
            </li>
          ))}
        </ol>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
          Key terms
        </div>
        <div className="overflow-hidden rounded-md border border-surface-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-text-muted w-40">Term</th>
                <th className="text-left px-4 py-2 font-semibold text-text-muted">Definition</th>
              </tr>
            </thead>
            <tbody>
              {ncl.key_terms.map((kt, i) => (
                <tr
                  key={i}
                  className={i > 0 ? "border-t border-surface-border" : ""}
                >
                  <td className="px-4 py-3 align-top font-medium text-text">{kt.term}</td>
                  <td className="px-4 py-3 align-top text-text">{kt.definition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
