import type { EventType } from "@/db/schema";

/**
 * The house's local time zone. Vercel runs in UTC, so deriving "today" from
 * the server clock would roll the schedule over at 6pm Central and show
 * residents tomorrow's meetings. One org for now; this becomes a column on
 * `organizations` when a second operator in another zone shows up.
 */
export const APP_TIME_ZONE = "America/Chicago";

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  house_meeting: "House meeting",
  recovery_support: "Recovery support",
  life_skills: "Life skills",
  chore_day: "Chore day",
  outing: "Outing",
  safety_drill: "Safety drill",
  facility_inspection: "Inspection",
  other: "Other",
};

/** Tailwind classes for the type pill, keyed by event type. */
export const EVENT_TYPE_STYLES: Record<EventType, string> = {
  house_meeting: "bg-primary/10 text-primary",
  recovery_support: "bg-accent/10 text-accent",
  life_skills: "bg-accent/10 text-accent",
  chore_day: "bg-primary/10 text-primary",
  outing: "bg-surface-muted text-muted-foreground",
  safety_drill: "bg-red-100 text-red-700",
  facility_inspection: "bg-red-100 text-red-700",
  other: "bg-surface-muted text-muted-foreground",
};

/** Today in the house's time zone, as YYYY-MM-DD. */
export function todayIso(zone: string = APP_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Date maths on YYYY-MM-DD strings is done in UTC deliberately: the values are
 * plain calendar dates, so anchoring them to a zone would let DST shift them.
 */
function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDaysIso(iso: string, days: number): string {
  const dt = toUtc(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** 0 = Sunday .. 6 = Saturday. */
export function dayOfWeekIso(iso: string): number {
  return toUtc(iso).getUTCDay();
}

/** The Monday on or before the given date. */
export function weekStartIso(iso: string): string {
  const dow = dayOfWeekIso(iso);
  return addDaysIso(iso, dow === 0 ? -6 : 1 - dow);
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** "19:00" -> "7:00 PM". */
export function fmtTime(value: string): string {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function fmtTimeRange(start: string, end: string | null): string {
  return end ? `${fmtTime(start)} – ${fmtTime(end)}` : fmtTime(start);
}

/** "Thu, Aug 7" — or "Today"/"Tomorrow" when close enough to matter. */
export function fmtDateLabel(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === addDaysIso(today, 1)) return "Tomorrow";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type WeeklyInput = {
  id: string;
  type: EventType;
  title: string;
  description: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string | null;
  location: string | null;
  mandatory: boolean;
};

type EventInput = {
  id: string;
  type: EventType;
  title: string;
  description: string | null;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  mandatory: boolean;
};

export type AgendaEntry = {
  key: string;
  date: string;
  type: EventType;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  mandatory: boolean;
  recurring: boolean;
};

/**
 * Projects the standing weekly schedule onto real dates and merges in one-off
 * events. Nothing is materialised in the database, so editing a weekly item
 * changes every future occurrence with no backfill.
 */
export function buildAgenda(opts: {
  from: string;
  days: number;
  weekly: WeeklyInput[];
  events: EventInput[];
}): AgendaEntry[] {
  const { from, days, weekly, events } = opts;
  const eventsByDate = new Map<string, EventInput[]>();
  for (const event of events) {
    const list = eventsByDate.get(event.eventDate);
    if (list) list.push(event);
    else eventsByDate.set(event.eventDate, [event]);
  }

  const entries: AgendaEntry[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysIso(from, i);
    const dow = dayOfWeekIso(date);

    for (const item of weekly) {
      if (item.dayOfWeek !== dow) continue;
      entries.push({
        key: `w-${item.id}-${date}`,
        date,
        type: item.type,
        title: item.title,
        description: item.description,
        startTime: item.startTime,
        endTime: item.endTime,
        location: item.location,
        mandatory: item.mandatory,
        recurring: true,
      });
    }

    for (const event of eventsByDate.get(date) ?? []) {
      entries.push({
        key: `e-${event.id}`,
        date,
        type: event.type,
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        mandatory: event.mandatory,
        recurring: false,
      });
    }
  }

  return entries.sort((a, b) =>
    a.date === b.date
      ? a.startTime.localeCompare(b.startTime)
      : a.date.localeCompare(b.date),
  );
}

/** Groups a flat agenda into date-keyed buckets, preserving order. */
export function groupByDate(entries: AgendaEntry[]) {
  const groups: { date: string; entries: AgendaEntry[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.date === entry.date) last.entries.push(entry);
    else groups.push({ date: entry.date, entries: [entry] });
  }
  return groups;
}
