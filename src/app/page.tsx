import { listLabSummaries } from "@/app/lib/list-lab-specs";
import { LabPickerCard } from "@/components/lab-picker-card";

export default function RootPage() {
  const labs = listLabSummaries();

  return (
    <main className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-text">
            Virtual Labs
          </h1>
          <p className="mt-2 text-text-muted">
            Choose a lab to begin your investigation.
          </p>
        </div>

        {labs.length === 0 ? (
          <p className="text-center text-text-muted">
            No labs available. Add a <code>.yaml</code> spec to{" "}
            <code>src/specs/</code> to get started.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {labs.map((lab) => (
              <LabPickerCard key={lab.lab_id} lab={lab} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
