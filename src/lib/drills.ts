import type { DrillAttendance, DrillType } from "@/db/schema";

export const DRILL_TYPE_LABELS: Record<DrillType, string> = {
  fire_evacuation: "Fire evacuation",
  severe_weather: "Severe weather",
  overdose_response: "Overdose response",
  other: "Other",
};

export const DRILL_TYPE_HINTS: Record<DrillType, string> = {
  fire_evacuation: "Everyone out, meeting point, headcount.",
  severe_weather: "Tornado warning. Lowest floor, interior room, no windows.",
  overdose_response: "Find the naloxone, call 911, rescue breathing.",
  other: "Anything else you walked the house through.",
};

export const DRILL_ATTENDANCE_LABELS: Record<DrillAttendance, string> = {
  present: "Took part",
  absent: "Not here",
  briefed_later: "Briefed after",
};

export const DRILL_TYPE_VALUES: DrillType[] = [
  "fire_evacuation",
  "severe_weather",
  "overdose_response",
  "other",
];

/**
 * UNVERIFIED — confirm against the Iowa affiliate's checklist before the
 * certification application. These are a defensible default, not a citation.
 */
export const DRILL_CADENCE_DAYS: Record<DrillType, number | null> = {
  fire_evacuation: 90,
  severe_weather: 180,
  overdose_response: 180,
  other: null,
};

/** Drill types whose last run is missing or older than their cadence. */
export function overdueDrills(
  lastByType: Map<DrillType, string>,
  today: string,
): DrillType[] {
  return DRILL_TYPE_VALUES.filter((type) => {
    const cadence = DRILL_CADENCE_DAYS[type];
    if (cadence === null) return false;
    const last = lastByType.get(type);
    if (!last) return true;
    return daysSince(last, today) > cadence;
  });
}

export function daysSince(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function fmtEvacuation(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
