"use client";

/**
 * A student-facing checklist rendered from the spec's
 * `assessment.formative_checks`. The tick state is LOCAL — it lives in a
 * component-level useState only and is not part of `LabSessionState`.
 *
 * Rationale: formative checks are self-monitoring prompts the student
 * ticks to notice their own progress. They are not evidence the AI tutor
 * needs to consume in Prompt 4, they don't affect phase status, and they
 * don't need to be persisted alongside submitted responses. Keeping them
 * out of session state keeps the mental model of "state that matters" tight.
 */

import { useState } from "react";
import { CheckSquare, Square } from "lucide-react";

interface Props {
  items: string[];
}

export function FormativeChecklist({ items }: Props) {
  const [ticked, setTicked] = useState<boolean[]>(() =>
    items.map(() => false),
  );

  const toggle = (i: number) => {
    setTicked((prev) => {
      const next = prev.slice();
      next[i] = !next[i];
      return next;
    });
  };

  return (
    <ul className="space-y-1.5">
      {items.map((text, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => toggle(i)}
            className="w-full text-left flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-muted transition"
            aria-pressed={ticked[i] ?? false}
          >
            {ticked[i] ? (
              <CheckSquare className="w-4 h-4 mt-0.5 text-accent shrink-0" />
            ) : (
              <Square className="w-4 h-4 mt-0.5 text-text-soft shrink-0" />
            )}
            <span
              className={
                "text-sm leading-relaxed " +
                (ticked[i] ? "text-text-soft line-through" : "text-text")
              }
            >
              {text}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
