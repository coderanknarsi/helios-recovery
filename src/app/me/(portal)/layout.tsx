import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { Logo } from "@/components/logo";
import { ResidentNav } from "@/components/resident-nav";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { requireResident, touchResidentSession } from "@/lib/resident-access";

export default async function ResidentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireResident();
  // Sliding expiry: an actively used session keeps renewing.
  await touchResidentSession(access.sessionId);

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted/40">
      <ServiceWorkerRegistrar />
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href="/me" aria-label="Resident home">
            <Logo className="h-7 w-auto" />
          </Link>
          {/* Crisis help is one tap away from every screen. */}
          <a
            href="tel:988"
            className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20"
          >
            <LifeBuoy className="h-4 w-4" />
            Crisis help
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-28 pt-6">
        {children}
      </main>

      <ResidentNav />
    </div>
  );
}
