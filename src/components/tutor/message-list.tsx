"use client";

import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";
import type { TutorMessage } from "@/app/lib/tutor-types";
import { cn } from "@/lib/cn";

interface Props {
  messages: TutorMessage[];
  pending: boolean;
  error?: string | null;
}

export function MessageList({ messages, pending, error }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending, error]);

  if (messages.length === 0 && !pending && !error) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 text-center text-sm text-text-soft">
        The tutor asks questions and guides your thinking. It does not compute science — the lab engine does that.
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
      role="log"
      aria-live="polite"
    >
      {messages.map((m, i) => {
        const isUser = m.role === "user";
        const Icon = isUser ? User : Bot;
        return (
          <div
            key={i}
            className={cn(
              "flex items-start gap-2",
              isUser ? "flex-row-reverse" : "flex-row",
            )}
          >
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                isUser
                  ? "bg-accent text-text-inverse"
                  : "bg-surface-muted text-text-muted",
              )}
              aria-hidden
            >
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                isUser
                  ? "bg-accent text-text-inverse"
                  : "bg-surface-muted text-text",
              )}
            >
              {m.content.split("\n").map((line, j) => (
                <p key={j} className={j > 0 ? "mt-1" : ""}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        );
      })}

      {pending && (
        <div className="flex items-center gap-2 text-xs text-text-soft">
          <div className="w-6 h-6 rounded-full bg-surface-muted flex items-center justify-center">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <span className="inline-flex gap-0.5">
            <span className="w-1.5 h-1.5 bg-text-soft rounded-full animate-pulse" />
            <span className="w-1.5 h-1.5 bg-text-soft rounded-full animate-pulse [animation-delay:100ms]" />
            <span className="w-1.5 h-1.5 bg-text-soft rounded-full animate-pulse [animation-delay:200ms]" />
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-warning/40 bg-warning-muted p-2.5 text-xs text-text">
          <div className="font-semibold text-warning">Tutor error</div>
          <div className="mt-1">{error}</div>
        </div>
      )}
    </div>
  );
}
