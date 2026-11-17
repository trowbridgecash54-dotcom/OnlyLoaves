import type { PickupConfig, Weekday } from "./types";

/**
 * Pickup date rules. Dates are plain "YYYY-MM-DD" strings so they never
 * shift across time zones. Every date a customer picks is a preference:
 * nothing is guaranteed until the owner confirms it.
 */

export const WEEKDAYS: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  return toIso(toUtc(value)) === value;
}

/** Today's date in the business's time zone. */
export function todayInTimeZone(timeZone: string, now = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return toIso(now);
  }
}

export function addDays(iso: string, days: number): string {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

export function weekdayOf(iso: string): Weekday {
  return WEEKDAYS[toUtc(iso).getUTCDay()];
}

/** "Saturday, November 21" */
export function formatPickupDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(toUtc(iso));
}

export function formatWeekday(day: Weekday): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/** Earliest and latest dates a customer may ask for. */
export function getPickupWindow(
  config: PickupConfig,
  today: string,
): { earliest: string; latest: string | null } {
  const notice = Math.max(0, config.minNoticeDays ?? 0);
  const earliest = addDays(today, notice);
  const latest =
    config.maxAdvanceDays === null
      ? null
      : addDays(today, Math.max(notice, config.maxAdvanceDays));
  return { earliest, latest };
}

export type DateCheck = { ok: true } | { ok: false; reason: string };

/** Checks one requested date against the owner's pickup settings. */
export function checkPickupDate(
  config: PickupConfig,
  iso: string,
  today: string,
): DateCheck {
  if (!isIsoDate(iso)) {
    return { ok: false, reason: "Choose a pickup date." };
  }
  const { earliest, latest } = getPickupWindow(config, today);
  if (iso < earliest) {
    return {
      ok: false,
      reason:
        earliest === today
          ? "That date has already passed. Choose today or later."
          : `The earliest pickup we can offer is ${formatPickupDate(earliest)}.`,
    };
  }
  if (latest !== null && iso > latest) {
    return {
      ok: false,
      reason: `We're booking pickups through ${formatPickupDate(latest)}.`,
    };
  }
  if (config.unavailableDates.includes(iso)) {
    return {
      ok: false,
      reason: "There's no pickup on that date. Choose another day.",
    };
  }
  if (config.weekdays.length > 0 && !config.weekdays.includes(weekdayOf(iso))) {
    return {
      ok: false,
      reason: `Pickup is offered on ${listWeekdays(config.weekdays)}.`,
    };
  }
  return { ok: true };
}

/**
 * The specific dates the forms offer. Only meaningful once the owner has
 * set pickup weekdays; before that the forms use a free date field.
 */
export function listPickupDates(
  config: PickupConfig,
  today: string,
  limit = 12,
): string[] {
  if (config.weekdays.length === 0) return [];
  const { earliest, latest } = getPickupWindow(config, today);
  const dates: string[] = [];
  // Look at most a year ahead so a misconfiguration can't loop forever.
  for (let offset = 0; offset < 366 && dates.length < limit; offset += 1) {
    const candidate = addDays(earliest, offset);
    if (latest !== null && candidate > latest) break;
    if (checkPickupDate(config, candidate, today).ok) dates.push(candidate);
  }
  return dates;
}

/** ["friday", "saturday"] → "Fridays and Saturdays" */
export function listWeekdays(days: Weekday[]): string {
  const ordered = WEEKDAYS.filter((day) => days.includes(day)).map(
    (day) => `${formatWeekday(day)}s`,
  );
  if (ordered.length <= 1) return ordered.join("");
  if (ordered.length === 2) return ordered.join(" and ");
  return `${ordered.slice(0, -1).join(", ")} and ${ordered[ordered.length - 1]}`;
}
