import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { CalendarClock, MapPin, Repeat } from "lucide-react";
import { db } from "@/db";
import { houseEvents, houses, scheduleItems } from "@/db/schema";
import { getAccess } from "@/lib/access";
import {
  DAY_NAMES,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_STYLES,
  fmtDateLabel,
  fmtTimeRange,
  todayIso,
} from "@/lib/schedule";
import {
  cancelHouseEvent,
  createHouseEvent,
  createScheduleItem,
  deleteHouseEvent,
  deleteScheduleItem,
  toggleScheduleItem,
} from "./actions";

export const dynamic = "force-dynamic";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

const typeOptions = Object.entries(EVENT_TYPE_LABELS);

function HouseSelect({
  houseRows,
  canPickAll,
}: {
  houseRows: { id: string; name: string }[];
  canPickAll: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">House</span>
      <select name="houseId" className={fieldClass} defaultValue="">
        {canPickAll && <option value="">Every house</option>}
        {houseRows.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function SchedulePage() {
  const access = await getAccess();
  const today = todayIso();
  const scoped = access.houseIds;

  const [houseRows, weekly, events] = await Promise.all([
    db
      .select({ id: houses.id, name: houses.name })
      .from(houses)
      .where(
        scoped
          ? and(eq(houses.orgId, access.orgId), inArray(houses.id, scoped.length ? scoped : [""]))
          : eq(houses.orgId, access.orgId),
      )
      .orderBy(asc(houses.name)),
    db
      .select()
      .from(scheduleItems)
      .where(eq(scheduleItems.orgId, access.orgId))
      .orderBy(asc(scheduleItems.dayOfWeek), asc(scheduleItems.startTime)),
    db
      .select()
      .from(houseEvents)
      .where(
        and(
          eq(houseEvents.orgId, access.orgId),
          gte(houseEvents.eventDate, today),
        ),
      )
      .orderBy(asc(houseEvents.eventDate), asc(houseEvents.startTime)),
  ]);

  const houseName = new Map(houseRows.map((h) => [h.id, h.name]));
  // Managers only see items for their houses, plus anything org-wide.
  const visible = <T extends { houseId: string | null }>(rows: T[]) =>
    scoped ? rows.filter((r) => !r.houseId || scoped.includes(r.houseId)) : rows;

  const weeklyVisible = visible(weekly);
  const eventsVisible = visible(events);
  const byDay = DAY_NAMES.map((name, index) => ({
    name,
    index,
    items: weeklyVisible.filter((i) => i.dayOfWeek === index),
  }));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The standing weekly rhythm of the house plus anything one-off.
          Residents see all of it on their Schedule tab. This doubles as the
          written weekly schedule of recovery support services that NARR
          certification asks for.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Every week</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {byDay.map((day) => (
            <div
              key={day.name}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <p className="text-sm font-semibold">{day.name}</p>
              {day.items.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">Nothing yet</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {day.items.map((item) => (
                    <li key={item.id} className="text-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`font-medium ${item.active ? "" : "text-muted-foreground line-through"}`}
                        >
                          {item.title}
                        </span>
                        {item.mandatory && (
                          <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fmtTimeRange(item.startTime, item.endTime)}
                        {item.location ? ` · ${item.location}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.houseId
                          ? (houseName.get(item.houseId) ?? "House")
                          : "Every house"}
                      </p>
                      <div className="mt-1.5 flex gap-3 text-xs">
                        <form action={toggleScheduleItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            type="submit"
                            className="font-medium text-muted-foreground transition hover:text-primary"
                          >
                            {item.active ? "Pause" : "Resume"}
                          </button>
                        </form>
                        <form action={deleteScheduleItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            type="submit"
                            className="font-medium text-muted-foreground transition hover:text-red-700"
                          >
                            Remove
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <details className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <summary className="flex cursor-pointer items-center gap-2 text-base font-semibold">
            <Repeat className="h-4 w-4 text-primary" />
            Add something weekly
          </summary>

          <form action={createScheduleItem} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium">What is it</span>
                <input
                  name="title"
                  required
                  placeholder="House meeting"
                  className={fieldClass}
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium">Type</span>
                <select
                  name="type"
                  className={fieldClass}
                  defaultValue="recovery_support"
                >
                  {typeOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-medium">Day</span>
                <select name="dayOfWeek" className={fieldClass} defaultValue="2">
                  {DAY_NAMES.map((name, index) => (
                    <option key={name} value={index}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-medium">Starts</span>
                <input
                  type="time"
                  name="startTime"
                  required
                  className={fieldClass}
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium">Ends (optional)</span>
                <input type="time" name="endTime" className={fieldClass} />
              </label>

              <label className="block text-sm">
                <span className="font-medium">Where</span>
                <input
                  name="location"
                  placeholder="Living room"
                  className={fieldClass}
                />
              </label>

              <HouseSelect houseRows={houseRows} canPickAll={access.isAdmin} />
            </div>

            <label className="block text-sm">
              <span className="font-medium">Details (optional)</span>
              <textarea
                name="description"
                rows={2}
                placeholder="Bring your weekly goals."
                className={fieldClass}
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="mandatory"
                className="h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring/40"
              />
              Attendance is required
            </label>

            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
            >
              Add to the weekly schedule
            </button>
          </form>
        </details>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Coming up (one-off)</h2>

        {eventsVisible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing one-off on the calendar.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {eventsVisible.map((event) => (
              <li
                key={event.id}
                className="rounded-xl border border-border bg-surface p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${EVENT_TYPE_STYLES[event.type]}`}
                  >
                    {EVENT_TYPE_LABELS[event.type]}
                  </span>
                  {event.mandatory && (
                    <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      Required
                    </span>
                  )}
                  {event.cancelledAt && (
                    <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      Cancelled
                    </span>
                  )}
                </div>

                <p
                  className={`mt-2 font-medium ${event.cancelledAt ? "line-through" : ""}`}
                >
                  {event.title}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4" />
                    {fmtDateLabel(event.eventDate, today)},{" "}
                    {fmtTimeRange(event.startTime, event.endTime)}
                  </span>
                  {event.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {event.location}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {event.houseId
                    ? (houseName.get(event.houseId) ?? "House")
                    : "Every house"}
                </p>
                {event.description && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {event.description}
                  </p>
                )}

                <div className="mt-3 flex gap-4 text-sm">
                  <form action={cancelHouseEvent}>
                    <input type="hidden" name="id" value={event.id} />
                    <button
                      type="submit"
                      className="font-medium text-muted-foreground transition hover:text-primary"
                    >
                      {event.cancelledAt ? "Restore" : "Cancel & tell residents"}
                    </button>
                  </form>
                  <form action={deleteHouseEvent}>
                    <input type="hidden" name="id" value={event.id} />
                    <button
                      type="submit"
                      className="font-medium text-muted-foreground transition hover:text-red-700"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <details className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <summary className="flex cursor-pointer items-center gap-2 text-base font-semibold">
            <CalendarClock className="h-4 w-4 text-primary" />
            Add a one-off event
          </summary>

          <form action={createHouseEvent} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium">What is it</span>
                <input
                  name="title"
                  required
                  placeholder="House cookout"
                  className={fieldClass}
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium">Type</span>
                <select name="type" className={fieldClass} defaultValue="other">
                  {typeOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-medium">Date</span>
                <input
                  type="date"
                  name="eventDate"
                  required
                  defaultValue={today}
                  className={fieldClass}
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium">Starts</span>
                <input
                  type="time"
                  name="startTime"
                  required
                  className={fieldClass}
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium">Ends (optional)</span>
                <input type="time" name="endTime" className={fieldClass} />
              </label>

              <label className="block text-sm">
                <span className="font-medium">Where</span>
                <input
                  name="location"
                  placeholder="Back patio"
                  className={fieldClass}
                />
              </label>

              <HouseSelect houseRows={houseRows} canPickAll={access.isAdmin} />
            </div>

            <label className="block text-sm">
              <span className="font-medium">Details (optional)</span>
              <textarea
                name="description"
                rows={2}
                className={fieldClass}
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="mandatory"
                className="h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring/40"
              />
              Attendance is required
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="notify"
                defaultChecked
                className="h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring/40"
              />
              Notify residents
            </label>

            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
            >
              Add to the calendar
            </button>
          </form>
        </details>
      </section>
    </div>
  );
}
