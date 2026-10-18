import { listLabSummaries } from "@/app/lib/list-lab-specs";
import { LabPickerCard } from "@/components/lab-picker-card";
import { Beaker } from "lucide-react";

export default function RootPage() {
  const labs = listLabSummaries();

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-accent via-accent-strong to-[#1e1b4b] text-text-inverse">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2260%22%20height%3D%2260%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221.5%22%20fill%3D%22rgba(255%2C255%2C255%2C0.08)%22%2F%3E%3C%2Fsvg%3E')] opacity-60" />
        <div className="relative mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm">
              <Beaker className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium tracking-wide uppercase opacity-80">
              SAIL Framework
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Virtual Labs
          </h1>
          <p className="mt-3 text-lg text-white/70 max-w-xl">
            AI-scaffolded inquiry labs for Indian school classrooms.
            Choose a lab to begin your investigation.
          </p>
        </div>
      </div>

      {/* Lab grid */}
      <div className="mx-auto max-w-5xl px-6 -mt-8 pb-16 relative z-10">
        {labs.length === 0 ? (
          <p className="text-center text-text-muted py-12">
            No labs available. Add a <code>.yaml</code> spec to{" "}
            <code>src/specs/</code> to get started.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {labs.map((lab) => (
              <LabPickerCard key={lab.lab_id} lab={lab} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
