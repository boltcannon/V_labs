import "server-only";

import { Brain } from "lucide-react";
import type { Reflection } from "@/schema/lab-spec";

interface Props {
  reflection: Reflection;
}

export function ReflectionContent({ reflection }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Reflection prompts
        </div>
        <ol className="mt-2 space-y-1.5 list-decimal list-inside marker:text-text-soft">
          {reflection.reflection_prompts.map((p, i) => (
            <li key={i} className="text-[15px] leading-relaxed text-text">
              {p}
            </li>
          ))}
        </ol>
      </div>

      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          <Brain className="w-3.5 h-3.5" />
          Think about your thinking
        </div>
        <ol className="mt-2 space-y-1.5 list-decimal list-inside marker:text-text-soft">
          {reflection.metacognitive_prompts.map((p, i) => (
            <li key={i} className="text-[15px] leading-relaxed text-text">
              {p}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
