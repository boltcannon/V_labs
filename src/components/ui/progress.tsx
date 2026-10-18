import * as React from "react";
import { cn } from "@/lib/cn";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  /** 0..1 */
  value: number;
}

export function Progress({ value, className, ...rest }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-surface-muted border border-surface-border",
        className,
      )}
      {...rest}
    >
      <div
        className="h-full bg-accent transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
