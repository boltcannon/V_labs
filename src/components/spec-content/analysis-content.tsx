import "server-only";

import type { Analysis } from "@/schema/lab-spec";

interface Props {
  analysis: Analysis;
}

export function AnalysisContent({ analysis }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Guiding questions
        </div>
        <ol className="mt-2 space-y-1.5 list-decimal list-inside marker:text-text-soft">
          {analysis.guiding_questions.map((q, i) => (
            <li key={i} className="text-[15px] leading-relaxed text-text">
              {q}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
