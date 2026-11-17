import type { Fulfillment, Period, Subscription } from "./types";

/**
 * Monthly loaf allowance rules, as plain functions. The database
 * enforces the same limits when a loaf is recorded (see fulfill_loaf in
 * supabase/migrations); these are used to work out period dates and to
 * show the owner what's left.
 *
 *  - A period has an allowance (for the initial plan: 3 loaves of any kind).
 *  - Each fulfilled loaf that hasn't been voided reduces what's left by one.
 *  - Going past the allowance needs the owner to record an extra purchase.
 *  - Only active memberships get a period, and never before they start.
 *  - Unused loaves are never carried into the next period automatically.
 */

export type PeriodRule = "calendar-month" | "anniversary";

function parse(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function iso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day, 12)).toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

/**
 * The period that contains `date`.
 *  - "calendar-month": the 1st through the last day of that month.
 *  - "anniversary": from the member's start day to the day before the
 *    same day next month (start days of 29–31 clamp to the month's length).
 */
export function getPeriodBounds(
  date: string,
  rule: PeriodRule,
  startedOn?: string,
): { startsOn: string; endsOn: string } {
  const { year, month, day } = parse(date);

  if (rule === "calendar-month" || !startedOn) {
    return { startsOn: iso(year, month, 1), endsOn: iso(year, month, daysInMonth(year, month)) };
  }

  const anchor = parse(startedOn).day;
  const anchorIn = (y: number, m: number) => Math.min(anchor, daysInMonth(y, m));

  let startYear = year;
  let startMonth = month;
  if (day < anchorIn(year, month)) {
    startMonth -= 1;
    if (startMonth === 0) {
      startMonth = 12;
      startYear -= 1;
    }
  }
  let nextYear = startYear;
  let nextMonth = startMonth + 1;
  if (nextMonth === 13) {
    nextMonth = 1;
    nextYear += 1;
  }
  const startsOn = iso(startYear, startMonth, anchorIn(startYear, startMonth));
  const nextStart = iso(nextYear, nextMonth, anchorIn(nextYear, nextMonth));
  const end = new Date(`${nextStart}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return { startsOn, endsOn: end.toISOString().slice(0, 10) };
}

export type AllowanceSummary = {
  /** False for paused, canceled or not-yet-started memberships: no allowance applies. */
  applies: boolean;
  allowance: number;
  fulfilled: number;
  /** Loaves beyond the allowance, recorded as extra purchases. */
  extras: number;
  remaining: number;
  startsOn: string;
  endsOn: string;
  period: Period | null;
};

/**
 * What a member has left in the period containing `today`. Reads only:
 * a period row is created when the first loaf or payment is recorded.
 */
export function summarizeAllowance(
  subscription: Pick<Subscription, "status" | "started_on" | "loaves_per_period">,
  rule: PeriodRule,
  periods: Period[],
  fulfillments: Pick<Fulfillment, "period_id" | "voided_at" | "is_authorized_extra">[],
  today: string,
): AllowanceSummary {
  const { startsOn, endsOn } = getPeriodBounds(today, rule, subscription.started_on);
  const period = periods.find((candidate) => candidate.starts_on === startsOn) ?? null;
  const applies = subscription.status === "active" && subscription.started_on <= endsOn;
  const counted = period
    ? fulfillments.filter((row) => row.period_id === period.id && row.voided_at === null)
    : [];
  const allowance = period ? period.allowance : applies ? subscription.loaves_per_period : 0;
  const extras = counted.filter((row) => row.is_authorized_extra).length;
  const fulfilled = counted.length - extras;
  return {
    applies,
    allowance,
    fulfilled,
    extras,
    remaining: applies ? Math.max(0, allowance - fulfilled) : 0,
    startsOn,
    endsOn,
    period,
  };
}

/**
 * Loaves carried into a new period. Always zero unless the owner has
 * chosen (and told members about) a rollover policy.
 */
export function carriedForward(
  policy: "undecided" | "expire" | "rollover" | "credit",
  unusedFromPreviousPeriod: number,
): number {
  return policy === "rollover" ? Math.max(0, unusedFromPreviousPeriod) : 0;
}
