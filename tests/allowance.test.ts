import assert from "node:assert/strict";
import { test } from "node:test";
import { carriedForward, getPeriodBounds, summarizeAllowance } from "@/lib/allowance";
import type { Period } from "@/lib/types";

const period: Period = {
  id: "p1", subscription_id: "s1", starts_on: "2026-11-01", ends_on: "2026-11-30", allowance: 3,
  authorized_extra_loaves: 0, payment_status: "unpaid", paid_on: null, payment_note: "",
};
const sub = { status: "active" as const, started_on: "2026-10-05", loaves_per_period: 3 };
const loaf = (extra = false, voided: string | null = null) => ({ period_id: "p1", is_authorized_extra: extra, voided_at: voided });

test("calendar-month periods run from the 1st to the last day", () => {
  assert.deepEqual(getPeriodBounds("2026-11-16", "calendar-month"), { startsOn: "2026-11-01", endsOn: "2026-11-30" });
  assert.deepEqual(getPeriodBounds("2028-02-10", "calendar-month"), { startsOn: "2028-02-01", endsOn: "2028-02-29" });
});

test("anniversary periods follow the member's start day, clamping short months", () => {
  assert.deepEqual(getPeriodBounds("2026-11-16", "anniversary", "2026-09-20"), { startsOn: "2026-10-20", endsOn: "2026-11-19" });
  assert.deepEqual(getPeriodBounds("2027-02-28", "anniversary", "2026-12-31"), { startsOn: "2027-02-28", endsOn: "2027-03-30" });
});

test("3 allowance, 1 fulfilled → 2 remaining; all 3 → 0", () => {
  const one = summarizeAllowance(sub, "calendar-month", [period], [loaf()], "2026-11-16");
  assert.deepEqual([one.allowance, one.fulfilled, one.remaining], [3, 1, 2]);
  const all = summarizeAllowance(sub, "calendar-month", [period], [loaf(), loaf(), loaf()], "2026-11-16");
  assert.equal(all.remaining, 0);
});

test("voided records give the loaf back; extras don't use the allowance", () => {
  const s = summarizeAllowance(sub, "calendar-month", [period], [loaf(), loaf(false, "2026-11-10"), loaf(true)], "2026-11-16");
  assert.deepEqual([s.fulfilled, s.extras, s.remaining], [1, 1, 2]);
});

test("before any period exists, an active member shows the plan allowance", () => {
  const s = summarizeAllowance(sub, "calendar-month", [], [], "2026-12-03");
  assert.deepEqual([s.applies, s.allowance, s.remaining, s.period], [true, 3, 3, null]);
});

test("paused, canceled and not-yet-started members get no allowance", () => {
  for (const status of ["paused", "canceled"] as const) {
    assert.equal(summarizeAllowance({ ...sub, status }, "calendar-month", [], [], "2026-11-16").remaining, 0);
  }
  const future = summarizeAllowance({ ...sub, started_on: "2027-01-05" }, "calendar-month", [], [], "2026-11-16");
  assert.deepEqual([future.applies, future.remaining], [false, 0]);
});

test("unused loaves only carry forward under a rollover rule", () => {
  assert.equal(carriedForward("undecided", 2), 0);
  assert.equal(carriedForward("expire", 2), 0);
  assert.equal(carriedForward("rollover", 2), 2);
});
