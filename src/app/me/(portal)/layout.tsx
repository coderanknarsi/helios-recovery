import { requireResident, touchResidentSession } from "@/lib/resident-access";

export default async function ResidentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireResident();
  // Sliding expiry: an actively used session keeps renewing.
  await touchResidentSession(access.sessionId);

  return <div className="min-h-screen bg-surface-muted/40">{children}</div>;
}
