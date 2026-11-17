import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays, checkPickupDate, getPickupWindow, isIsoDate, listPickupDates, listWeekdays, todayInTimeZone, weekdayOf,
} from "@/lib/pickup";
import type { PickupConfig } from "@/lib/types";

const open: PickupConfig = {
  timeZone: "America/Los_Angeles", weekdays: [], unavailableDates: [], minNoticeDays: null, maxAdvanceDays: null, area: "", instructions: "",
};
const scheduled: PickupConfig = {
  ...open, weekdays: ["friday", "saturday"], unavailableDates: ["2026-11-27"], minNoticeDays: 2, maxAdvanceDays: 21,
};
const today = "2026-11-16";

test("date helpers", () => {
  assert.equal(isIsoDate("2026-11-16"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("11/16/2026"), false);
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(weekdayOf(today), "monday");
});

test("today is calculated in the business time zone", () => {
  const now = new Date("2026-11-17T06:30:00Z");
  assert.equal(todayInTimeZone("America/Los_Angeles", now), "2026-11-16");
  assert.equal(todayInTimeZone("UTC", now), "2026-11-17");
});

test("with no schedule set, any date from today onward is accepted", () => {
  assert.equal(checkPickupDate(open, today, today).ok, true);
  assert.equal(checkPickupDate(open, "2027-03-01", today).ok, true);
  assert.equal(checkPickupDate(open, "2026-11-15", today).ok, false);
  assert.equal(checkPickupDate(open, "", today).ok, false);
  assert.deepEqual(listPickupDates(open, today), []);
});

test("a configured schedule limits the dates offered", () => {
  assert.deepEqual(getPickupWindow(scheduled, today), { earliest: "2026-11-18", latest: "2026-12-07" });
  assert.deepEqual(listPickupDates(scheduled, today), ["2026-11-20", "2026-11-21", "2026-11-28", "2026-12-04", "2026-12-05"]);
});

test("dates outside the schedule are refused with a reason", () => {
  for (const date of ["2026-11-17", "2026-11-23", "2026-11-27", "2026-12-11"]) {
    assert.equal(checkPickupDate(scheduled, date, today).ok, false, date);
  }
  const wrongDay = checkPickupDate(scheduled, "2026-11-23", today);
  assert.match(!wrongDay.ok ? wrongDay.reason : "", /Fridays and Saturdays/);
});

test("weekday lists read naturally", () => {
  assert.equal(listWeekdays(["saturday"]), "Saturdays");
  assert.equal(listWeekdays(["saturday", "friday"]), "Fridays and Saturdays");
  assert.equal(listWeekdays(["sunday", "friday", "saturday"]), "Sundays, Fridays and Saturdays");
});
