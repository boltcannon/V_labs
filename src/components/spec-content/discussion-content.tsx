import "server-only";

import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Discussion } from "@/schema/lab-spec";

interface Props {
  discussion: Discussion;
}

export function DiscussionContent({ discussion }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Badge variant="muted" className="gap-1">
          <Users className="w-3.5 h-3.5" />
          {discussion.peer_interaction_type}
        </Badge>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Discussion prompts
        </div>
        <ol className="mt-2 space-y-1.5 list-decimal list-inside marker:text-text-soft">
          {discussion.discussion_prompts.map((p, i) => (
            <li key={i} className="text-[15px] leading-relaxed text-text">
              {p}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
