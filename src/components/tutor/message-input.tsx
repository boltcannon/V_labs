"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const send = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) send();
    }
  };

  return (
    <div className="border-t border-surface-border p-2.5 bg-surface">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask a question…"
          rows={2}
          disabled={disabled ?? false}
          className={cn(
            "flex-1 resize-none rounded-md border border-surface-border bg-surface px-2 py-1.5 text-sm",
            "placeholder:text-text-soft",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            disabled && "opacity-60",
          )}
        />
        <Button
          onClick={send}
          disabled={(disabled ?? false) || value.trim().length === 0}
          size="sm"
          aria-label="Send message"
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </Button>
      </div>
      <p className="mt-1.5 text-[10px] text-text-soft">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  );
}
