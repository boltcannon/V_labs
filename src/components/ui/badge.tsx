import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "success" | "warning" | "locked" | "muted";

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  default: "bg-accent-muted text-accent-strong",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  locked: "bg-locked-muted text-locked",
  muted: "bg-surface-muted text-text-soft border border-surface-border",
};

export function Badge({ className, variant = "default", ...rest }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        styles[variant],
        className,
      )}
      {...rest}
    />
  );
}
