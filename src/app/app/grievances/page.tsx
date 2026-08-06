import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare, ShieldCheck, UserRound } from "lucide-react";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  grievances,
  grievanceUpdates,
  houses,
  profiles,
  residents,
} from "@/db/schema";
import { getAccess } from "@/lib/access";
import {
  GRIEVANCE_ABOUT_LABELS,
  GRIEVANCE_STATUS_LABELS,
  GRIEVANCE_STATUS_STYLES,
  OPEN_GRIEVANCE_STATUSES,
} from "@/lib/grievances";
import { addGrievanceUpdate, assignGrievance } from "./actions";

export const metadata: Metadata = { title: "Concerns" };

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

export default async function GrievancesPage() {
  const access = await getAccess();

  // House managers never see complaints that name staff.
  const scope = access.isAdmin
    ? eq(grievances.orgId, access.orgId)
    : and(
        eq(grievances.orgId, access.orgId),
        eq(grievances.adminOnly, false),
        access.houseIds?.length
          ? inArray(grievances.houseId, access.houseIds)
          : sql`false`,
      );

  const rows = await db
    .select({
      id: grievances.id,
      about: grievances.about,
      subject: grievances.subject,
      detail: grievances.detail,
      status: grievances.status,
      adminOnly: grievances.adminOnly,
      resolution: grievances.resolution,
      createdAt: grievances.createdAt,
      houseName: houses.name,
      residentId: grievances.residentId,
      firstName: residents.firstName,
      lastName: residents.lastName,
      assignedName: profiles.fullName,
    })
    .from(grievances)
    .leftJoin(houses, eq(houses.id, grievances.houseId))
    .leftJoin(residents, eq(residents.id, grievances.residentId))
    .leftJoin(profiles, eq(profiles.id, grievances.assignedTo))
    .where(scope)
    .orderBy(desc(grievances.createdAt));

  const updates = rows.length
    ? await db
        .select({
          grievanceId: grievanceUpdates.grievanceId,
          note: grievanceUpdates.note,
          visibleToResident: grievanceUpdates.visibleToResident,
          createdAt: grievanceUpdates.createdAt,
          authorName: profiles.fullName,
        })
        .from(grievanceUpdates)
        .leftJoin(profiles, eq(profiles.id, grievanceUpdates.authorId))
        .where(
          or(
            ...rows.map((r) => eq(grievanceUpdates.grievanceId, r.id)),
          ),
        )
        .orderBy(asc(grievanceUpdates.createdAt))
    : [];

  const trail = new Map<string, typeof updates>();
  for (const u of updates) {
    const list = trail.get(u.grievanceId) ?? [];
    list.push(u);
    trail.set(u.grievanceId, list);
  }

  const open = rows.filter((r) => OPEN_GRIEVANCE_STATUSES.includes(r.status));
  const closed = rows.filter((r) => !OPEN_GRIEVANCE_STATUSES.includes(r.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Concerns</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grievances residents have raised. Every one gets a written outcome,
          and the trail below cannot be edited after the fact.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <MessagesSquare className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Nothing raised yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Residents file these from Support in their app. Silence is not
            always good news &mdash; ask at house meetings whether people know
            the process exists.
          </p>
          <Link
            href="/app/content"
            className="mt-4 inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium transition hover:border-primary hover:text-primary"
          >
            Review the grievance policy
          </Link>
        </div>
      ) : (
        <>
          <Section
            title={`Open (${open.length})`}
            items={open}
            trail={trail}
            editable
          />
          {closed.length > 0 && (
            <Section
              title={`Closed (${closed.length})`}
              items={closed}
              trail={trail}
            />
          )}
        </>
      )}
    </div>
  );
}

type Row = {
  id: string;
  about: keyof typeof GRIEVANCE_ABOUT_LABELS;
  subject: string;
  detail: string;
  status: keyof typeof GRIEVANCE_STATUS_LABELS;
  adminOnly: boolean;
  resolution: string | null;
  createdAt: Date;
  houseName: string | null;
  residentId: string | null;
  firstName: string | null;
  lastName: string | null;
  assignedName: string | null;
};

type Trail = Map<
  string,
  {
    note: string;
    visibleToResident: boolean;
    createdAt: Date;
    authorName: string | null;
  }[]
>;

function Section({
  title,
  items,
  trail,
  editable = false,
}: {
  title: string;
  items: Row[];
  trail: Trail;
  editable?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {items.map((g) => {
        const notes = trail.get(g.id) ?? [];
        return (
          <article
            key={g.id}
            className="rounded-xl border border-border bg-surface p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{g.subject}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {GRIEVANCE_ABOUT_LABELS[g.about]}
                  {g.houseName ? ` · ${g.houseName}` : ""} ·{" "}
                  {g.createdAt.toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {g.adminOnly && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                    <ShieldCheck className="h-3 w-3" />
                    Leadership only
                  </span>
                )}
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${GRIEVANCE_STATUS_STYLES[g.status]}`}
                >
                  {GRIEVANCE_STATUS_LABELS[g.status]}
                </span>
              </div>
            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm">{g.detail}</p>

            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserRound className="h-3.5 w-3.5" />
              {g.residentId ? (
                <Link
                  href={`/app/residents/${g.residentId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {g.firstName} {g.lastName}
                </Link>
              ) : (
                "Filed anonymously"
              )}
              {g.assignedName ? ` · handled by ${g.assignedName}` : ""}
            </p>

            {notes.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-border pt-3">
                {notes.map((n, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-xs text-muted-foreground">
                      {n.createdAt.toLocaleDateString()}
                      {n.authorName ? ` · ${n.authorName}` : ""}
                      {n.visibleToResident ? " · shared with resident" : ""}
                    </span>
                    <span className="mt-0.5 block">{n.note}</span>
                  </li>
                ))}
              </ul>
            )}

            {editable && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                {!g.assignedName && (
                  <form action={assignGrievance}>
                    <input type="hidden" name="grievanceId" value={g.id} />
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium transition hover:border-primary hover:text-primary"
                    >
                      I&rsquo;ll handle this
                    </button>
                  </form>
                )}
                <details className="w-full">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-primary">
                    Add an update or close it out
                  </summary>
                  <form action={addGrievanceUpdate} className="mt-3 space-y-3">
                    <input type="hidden" name="grievanceId" value={g.id} />
                    <textarea
                      name="note"
                      required
                      rows={3}
                      placeholder="What you did, what you found, what happens next."
                      className={fieldClass}
                    />
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="text-sm">
                        <span className="font-medium">Move to</span>
                        <select
                          name="status"
                          defaultValue=""
                          className={fieldClass}
                        >
                          <option value="">Leave as is</option>
                          <option value="under_review">Being looked into</option>
                          <option value="resolved">Resolved</option>
                          <option value="escalated">Escalated</option>
                          <option value="withdrawn">Withdrawn</option>
                        </select>
                      </label>
                      {g.residentId && (
                        <label className="flex items-center gap-2 pb-2.5 text-sm">
                          <input
                            type="checkbox"
                            name="visibleToResident"
                            defaultChecked
                            className="h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring/40"
                          />
                          Show this to the resident
                        </label>
                      )}
                      <button
                        type="submit"
                        className="mb-1 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
                      >
                        Save update
                      </button>
                    </div>
                  </form>
                </details>
              </div>
            )}

            {g.resolution && !editable && (
              <div className="mt-3 rounded-lg bg-surface-muted p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Outcome
                </p>
                <p className="mt-1 text-sm">{g.resolution}</p>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
