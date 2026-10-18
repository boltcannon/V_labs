"use client";
import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md";

interface Props
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-text-inverse hover:bg-accent-strong",
  ghost: "bg-transparent text-text hover:bg-surface-muted",
  outline:
    "bg-surface border border-surface-border text-text hover:bg-surface-muted",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

export const Button = React.forwardRef<HTMLButtonElement, Props>(
  function Button({ className, variant = "primary", size = "md", ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...rest}
      />
    );
  },
);
