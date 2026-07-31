import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileSignature,
  MapPin,
  Phone,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { db } from "@/db";
import {
  choreAssignments,
  chores,
  intakeDocuments,
  residentLogs,
  residentNotifications,
} from "@/db/schema";
import { requireResident } from "@/lib/resident-access";
import { todayIso, weekStartIso } from "@/lib/schedule";
import { InstallHint } from "@/components/install-hint";
import { NotificationSettings } from "@/components/notification-settings";
import { markNotificationsRead } from "./push-actions";
import { setChoreDone } from "./chore-actions";

export const dynamic = "force-dynamic";

const logTypeLabels: Record<string, string> = {
  note: "Note",
  drug_test: "Drug test",
  infraction: "Infraction",
  pass: "Pass",
  chore: "Chore",
  medication: "Medication",
};

const resultStyles: Record<string, string> = {
  pass: "bg-accent/10 text-accent",
  fail: "bg-red-50 text-red-700",
  refused: "bg-red-50 text-red-700",
  pending: "bg-primary/10 text-primary",
};

/** Formats a YYYY-MM-DD date without shifting it across time zones. */
function fmtDay(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

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

  const [docs, updates] = await Promise.all([
    db
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
      ),
    db
      .select({
        id: residentLogs.id,
        type: residentLogs.type,
        occurredAt: residentLogs.occurredAt,
        title: residentLogs.title,
        detail: residentLogs.detail,
        result: residentLogs.result,
      })
      .from(residentLogs)
      .where(
        and(
          eq(residentLogs.residentId, me.residentId),
          eq(residentLogs.orgId, me.orgId),
          eq(residentLogs.visibleToResident, true),
        ),
      )
      .orderBy(desc(residentLogs.occurredAt), desc(residentLogs.createdAt))
      .limit(10),
  ]);

  const messages = await db
    .select({
      id: residentNotifications.id,
      title: residentNotifications.title,
      body: residentNotifications.body,
      createdAt: residentNotifications.createdAt,
      readAt: residentNotifications.readAt,
    })
    .from(residentNotifications)
    .where(
      and(
        eq(residentNotifications.residentId, me.residentId),
        eq(residentNotifications.orgId, me.orgId),
      ),
    )
    .orderBy(desc(residentNotifications.createdAt))
    .limit(5);

  const unread = messages.filter((m) => m.readAt === null).length;

  const myChores = await db
    .select({
      id: choreAssignments.id,
      status: choreAssignments.status,
      dueDate: choreAssignments.dueDate,
      name: chores.name,
      description: chores.description,
    })
    .from(choreAssignments)
    .innerJoin(chores, eq(chores.id, choreAssignments.choreId))
    .where(
      and(
        eq(choreAssignments.residentId, me.residentId),
        eq(choreAssignments.orgId, me.orgId),
        eq(choreAssignments.weekStart, weekStartIso(todayIso())),
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

      {myChores.length > 0 && (
        <section>
          <h2 className="text-base font-semibold">Your chores this week</h2>
          <ul className="mt-2 space-y-2">
            {myChores.map((chore) => {
              const done =
                chore.status === "completed" || chore.status === "verified";
              return (
                <li
                  key={chore.id}
                  className={`rounded-xl border p-4 shadow-sm ${
                    done ? "border-border bg-surface" : "border-primary/30 bg-primary/5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <ClipboardCheck
                      className={`mt-0.5 h-5 w-5 shrink-0 ${done ? "text-accent" : "text-primary"}`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{chore.name}</p>
                      {chore.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {chore.description}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {chore.status === "verified"
                          ? "Checked off by your house team."
                          : chore.status === "missed"
                            ? "Marked missed."
                            : `Due ${fmtDay(chore.dueDate)}`}
                      </p>
                    </div>
                  </div>

                  {chore.status !== "verified" && (
                    <form action={setChoreDone} className="mt-3">
                      <input type="hidden" name="id" value={chore.id} />
                      <input
                        type="hidden"
                        name="done"
                        value={done ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        className={
                          done
                            ? "text-xs font-medium text-muted-foreground transition hover:text-foreground"
                            : "inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
                        }
                      >
                        {done ? "Undo" : "Mark it done"}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {messages.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">
              Messages
              {unread > 0 && (
                <span className="ml-2 inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {unread} new
                </span>
              )}
            </h2>
            {unread > 0 && (
              <form action={markNotificationsRead}>
                <button
                  type="submit"
                  className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
                >
                  Mark all read
                </button>
              </form>
            )}
          </div>
          <ul className="mt-3 space-y-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-xl border p-4 shadow-sm ${
                  m.readAt === null
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-surface"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <MessageSquare
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      m.readAt === null ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{m.title}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                      {m.body}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.createdAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {updates.length > 0 && (
        <section>
          <h2 className="text-base font-semibold">Your record</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Entries your house team has shared with you. If something looks
            wrong, talk to your house manager.
          </p>
          <ul className="mt-3 space-y-3">
            {updates.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {logTypeLabels[entry.type] ?? entry.type}
                  </span>
                  {entry.result && (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        resultStyles[entry.result] ??
                        "bg-surface-muted text-muted-foreground"
                      }`}
                    >
                      {entry.result}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {fmtDay(entry.occurredAt)}
                  </span>
                </div>
                {entry.title && (
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {entry.title}
                  </p>
                )}
                {entry.detail && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {entry.detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {me.houseName && (
        <Link
          href="/me/house"
          className="block rounded-xl border border-border bg-surface p-6 shadow-sm transition hover:border-primary"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{me.houseName}</h2>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </div>
          {address && (
            <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              {address}
            </p>
          )}
          <p className="mt-2 text-sm font-medium text-primary">
            House rules, safety info &amp; policies
          </p>
        </Link>
      )}

      {(me.houseManagerPhone ?? me.housePhone) && (
        <a
          href={`tel:${(me.houseManagerPhone ?? me.housePhone ?? "").replace(/[^\d+]/g, "")}`}
          className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm font-medium text-primary shadow-sm transition hover:border-primary"
        >
          <Phone className="h-4 w-4 shrink-0" />
          Call {me.houseManagerName ?? "the house"} ·{" "}
          {me.houseManagerPhone ?? me.housePhone}
        </a>
      )}

      <NotificationSettings
        vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
      />

      <InstallHint />
    </div>
  );
}
