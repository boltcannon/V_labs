"use client";
import * as React from "react";
import { cn } from "@/lib/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm " +
          "placeholder:text-text-soft " +
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 " +
          "min-h-[8rem] resize-y",
        className,
      )}
      {...rest}
    />
  );
});
