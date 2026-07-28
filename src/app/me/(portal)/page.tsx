import Link from "next/link";
import { and, eq } from "drizzle-orm";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  FileSignature,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";
import { db } from "@/db";
import { intakeDocuments } from "@/db/schema";
import { requireResident } from "@/lib/resident-access";

export const dynamic = "force-dynamic";

/** Whole days between a YYYY-MM-DD date and today, or null if unusable. */
function daysSince(value: string | null) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Sparkles;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default async function ResidentHomePage() {
  const me = await requireResident();

  const docs = await db
    .select({
      id: intakeDocuments.id,
      status: intakeDocuments.status,
    })
    .from(intakeDocuments)
    .where(
      and(
        eq(intakeDocuments.residentId, me.residentId),
        eq(intakeDocuments.orgId, me.orgId),
      ),
    );

  const unsigned = docs.filter((d) => d.status !== "signed").length;
  const daysHere = daysSince(me.admitDate);
  const daysSober = daysSince(me.sobrietyDate);

  const placement = me.houseName
    ? [me.houseName, me.roomName, me.bedLabel ? `Bed ${me.bedLabel}` : null]
        .filter(Boolean)
        .join(" · ")
    : null;

  const address = [
    me.houseAddressLine1,
    [me.houseCity, me.houseState].filter(Boolean).join(", "),
    me.housePostalCode,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Hi, {me.firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {placement ?? "Your placement is being finalized."}
        </p>
      </div>

      {unsigned > 0 ? (
        <Link
          href="/me/documents"
          className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 transition hover:bg-primary/10"
        >
          <FileSignature className="h-5 w-5 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {unsigned} document{unsigned === 1 ? "" : "s"} need
              {unsigned === 1 ? "s" : ""} your signature
            </p>
            <p className="text-xs text-muted-foreground">
              Read and sign to stay in good standing.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
        </Link>
      ) : docs.length > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />
          <p className="text-sm text-muted-foreground">
            You&rsquo;re all caught up on paperwork.
          </p>
        </div>
      ) : null}

      {(daysHere !== null || daysSober !== null) && (
        <div className="grid grid-cols-2 gap-3">
          {daysSober !== null && (
            <Stat
              icon={Sparkles}
              value={daysSober.toLocaleString()}
              label={daysSober === 1 ? "day in recovery" : "days in recovery"}
            />
          )}
          {daysHere !== null && (
            <Stat
              icon={CalendarCheck}
              value={daysHere.toLocaleString()}
              label={daysHere === 1 ? "day at your house" : "days at your house"}
            />
          )}
        </div>
      )}

      {me.houseName && (
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold">{me.houseName}</h2>
          {address && (
            <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              {address}
            </p>
          )}
          {me.housePhone && (
            <a
              href={`tel:${me.housePhone.replace(/[^\d+]/g, "")}`}
              className="mt-2 flex items-center gap-2 text-sm font-medium text-primary transition hover:text-primary-hover"
            >
              <Phone className="h-4 w-4 shrink-0" />
              {me.housePhone}
            </a>
          )}
        </section>
      )}

      <p className="text-center text-xs text-muted-foreground">
        More is coming here soon — house rules, chores, and passes.
      </p>
    </div>
  );
}
