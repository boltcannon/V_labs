"use client";

import { LabSessionProvider } from "@/components/lab-session-provider";
import { PhaseNavigator } from "@/components/phase-navigator";
import type { PublicLabSpec } from "@/schema/lab-spec";

interface Props {
  labId: string;
  /**
   * Reserved for future use — the shell doesn't currently need spec data
   * (the navigator reads only session state), but we forward it here so
   * child pages can access it via context if we later add a spec provider.
   */
  publicSpec: PublicLabSpec;
  children: React.ReactNode;
}

export function LabShell({ labId, publicSpec, children }: Props) {
  // publicSpec is intentionally accepted; a future SpecProvider will
  // publish it to descendants. In Prompt 2 each phase page reads its slice
  // of the spec directly from the server layer.
  void publicSpec;

  return (
    <LabSessionProvider labId={labId}>
      <div className="min-h-screen flex bg-surface-muted">
        <PhaseNavigator labId={labId} />
        <main className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </LabSessionProvider>
  );
}
