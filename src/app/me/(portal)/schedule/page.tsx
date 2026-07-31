import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { CalendarClock, MapPin } from "lucide-react";
import { db } from "@/db";
import { houseEvents, scheduleItems } from "@/db/schema";
import { requireResident } from "@/lib/resident-access";
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_STYLES,
  addDaysIso,
  buildAgenda,
  fmtDateLabel,
  fmtTimeRange,
  groupByDate,
  todayIso,
} from "@/lib/schedule";

export const dynamic = "force-dynamic";

const DAYS_AHEAD = 14;

export default async function ResidentSchedulePage() {
  const me = await requireResident();
  const today = todayIso();
  const until = addDaysIso(today, DAYS_AHEAD - 1);

  // An item with no house belongs to the whole org.
  const forMyHouse = me.houseId
    ? or(isNull(scheduleItems.houseId), eq(scheduleItems.houseId, me.houseId))
    : isNull(scheduleItems.houseId);
  const eventsForMyHouse = me.houseId
    ? or(isNull(houseEvents.houseId), eq(houseEvents.houseId, me.houseId))
    : isNull(houseEvents.houseId);

  const [weekly, events] = await Promise.all([
    db
      .select({
        id: scheduleItems.id,
        type: scheduleItems.type,
        title: scheduleItems.title,
        description: scheduleItems.description,
        dayOfWeek: scheduleItems.dayOfWeek,
        startTime: scheduleItems.startTime,
        endTime: scheduleItems.endTime,
        location: scheduleItems.location,
        mandatory: scheduleItems.mandatory,
      })
      .from(scheduleItems)
      .where(
        and(
          eq(scheduleItems.orgId, me.orgId),
          eq(scheduleItems.active, true),
          forMyHouse,
        ),
      ),
    db
      .select({
        id: houseEvents.id,
        type: houseEvents.type,
        title: houseEvents.title,
        description: houseEvents.description,
        eventDate: houseEvents.eventDate,
        startTime: houseEvents.startTime,
        endTime: houseEvents.endTime,
        location: houseEvents.location,
        mandatory: houseEvents.mandatory,
      })
      .from(houseEvents)
      .where(
        and(
          eq(houseEvents.orgId, me.orgId),
          isNull(houseEvents.cancelledAt),
          gte(houseEvents.eventDate, today),
          lte(houseEvents.eventDate, until),
          eventsForMyHouse,
        ),
      )
      .orderBy(asc(houseEvents.eventDate)),
  ]);

  const groups = groupByDate(
    buildAgenda({ from: today, days: DAYS_AHEAD, weekly, events }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          What&rsquo;s happening over the next two weeks.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <CalendarClock className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing on the calendar yet. Your house team will add meetings and
            groups here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.date} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {fmtDateLabel(group.date, today)}
              </h2>

              <ul className="space-y-2">
                {group.entries.map((entry) => (
                  <li
                    key={entry.key}
                    className={`rounded-xl border bg-surface p-4 shadow-sm ${
                      entry.mandatory
                        ? "border-primary/30 bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${EVENT_TYPE_STYLES[entry.type]}`}
                      >
                        {EVENT_TYPE_LABELS[entry.type]}
                      </span>
                      {entry.mandatory && (
                        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          Required
                        </span>
                      )}
                    </div>

                    <p className="mt-2 font-medium">{entry.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-4 w-4" />
                        {fmtTimeRange(entry.startTime, entry.endTime)}
                      </span>
                      {entry.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" />
                          {entry.location}
                        </span>
                      )}
                    </p>
                    {entry.description && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {entry.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
