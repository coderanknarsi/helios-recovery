import Link from "next/link";
import { and, eq } from "drizzle-orm";
import {
  ChevronRight,
  Clock,
  Cigarette,
  Car,
  Flame,
  MoonStar,
  Phone,
  ShieldPlus,
  UserRound,
} from "lucide-react";
import { db } from "@/db";
import { contentBlocks, houses } from "@/db/schema";
import { requireResident } from "@/lib/resident-access";
import { RESIDENT_CONTENT } from "@/lib/resident-content";

export const dynamic = "force-dynamic";

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

export default async function ResidentHousePage() {
  const me = await requireResident();

  const [house] = me.houseId
    ? await db
        .select()
        .from(houses)
        .where(and(eq(houses.id, me.houseId), eq(houses.orgId, me.orgId)))
        .limit(1)
    : [];

  const blocks = await db
    .select({ slug: contentBlocks.slug, title: contentBlocks.title })
    .from(contentBlocks)
    .where(eq(contentBlocks.orgId, me.orgId));

  // Keep the catalog's order rather than whatever the database returns.
  const published = RESIDENT_CONTENT.map((definition) =>
    blocks.find((b) => b.slug === definition.slug),
  ).filter((b): b is { slug: string; title: string } => Boolean(b));

  const details = [
    house?.managerName && {
      icon: UserRound,
      label: "House manager",
      value: house.managerName,
    },
    house?.curfew && { icon: Clock, label: "Curfew", value: house.curfew },
    house?.quietHours && {
      icon: MoonStar,
      label: "Quiet hours",
      value: house.quietHours,
    },
    house?.smokingArea && {
      icon: Cigarette,
      label: "Smoking",
      value: house.smokingArea,
    },
    house?.parkingNotes && {
      icon: Car,
      label: "Parking",
      value: house.parkingNotes,
    },
  ].filter(Boolean) as {
    icon: typeof Clock;
    label: string;
    value: string;
  }[];

  const hasSafety = Boolean(house?.naloxoneLocations || house?.evacuationNotes);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{house?.name ?? "Your house"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How this home runs, and the policies you agreed to.
        </p>
      </div>

      {hasSafety && (
        <section className="rounded-xl border border-accent/30 bg-accent/5 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ShieldPlus className="h-5 w-5 shrink-0 text-accent" />
            Safety
          </h2>
          {house?.naloxoneLocations && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground">
                Naloxone (Narcan) is kept here
              </p>
              <p className="mt-0.5 text-sm whitespace-pre-wrap">
                {house.naloxoneLocations}
              </p>
            </div>
          )}
          {house?.evacuationNotes && (
            <div className="mt-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Flame className="h-3.5 w-3.5 shrink-0" />
                If there&rsquo;s a fire
              </p>
              <p className="mt-0.5 text-sm whitespace-pre-wrap">
                {house.evacuationNotes}
              </p>
            </div>
          )}
        </section>
      )}

      {(details.length > 0 || house?.managerPhone || house?.phone) && (
        <section className="rounded-xl border border-border bg-surface px-5 py-2 shadow-sm">
          <div className="divide-y divide-border">
            {details.map((d) => (
              <Detail key={d.label} {...d} />
            ))}
            {(house?.managerPhone || house?.phone) && (
              <div className="py-3">
                <a
                  href={`tel:${(house.managerPhone ?? house.phone ?? "").replace(/[^\d+]/g, "")}`}
                  className="flex items-center gap-3 text-sm font-medium text-primary transition hover:text-primary-hover"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  Call the house · {house.managerPhone ?? house.phone}
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-base font-semibold">Policies</h2>
        {published.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-border bg-surface p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Your house team hasn&rsquo;t published any policies yet. Ask them
              for a paper copy in the meantime.
            </p>
          </div>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            {published.map((block) => (
              <li key={block.slug} className="border-b border-border last:border-0">
                <Link
                  href={`/me/house/${block.slug}`}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-surface-muted/60"
                >
                  <span className="text-sm font-medium">{block.title}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
