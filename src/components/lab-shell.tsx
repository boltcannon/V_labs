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
  return (
    <LabSessionProvider labId={labId}>
      <div className="h-screen flex bg-surface-muted overflow-hidden">
        <PhaseNavigator labId={labId} labTopic={publicSpec.meta.topic} />
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </LabSessionProvider>
  );
}
