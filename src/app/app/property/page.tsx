import type { Metadata } from "next";
import { Building2 } from "lucide-react";

export const metadata: Metadata = { title: "Property" };

export default function PropertyPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Property</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Houses, rooms, and beds.
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-border bg-surface p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
          <Building2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold">
          Property management is coming next
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          A virtual bed board with occupancy across all your houses, room and
          bed assignments, hold-a-bed, and maintenance requests.
        </p>
      </div>
    </div>
  );
}
