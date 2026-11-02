/**
 * Run with: node --test --experimental-strip-types lib/business-days.test.ts
 *
 * Every instant here is written in UTC so the result does not depend on the
 * machine's own timezone: that is the whole point of the module.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  businessDaysFrom,
  deadlineStage,
  formatDeadlineEs,
  isExpired,
  todayInMexico,
  formatMonthEs,
  monthMatrix,
  previousBusinessDay,
  shiftMonth,
  TWO_WORKING_WEEKS,
  WORKING_WEEK,
} from "./business-days.ts";

// 2026-08-10 is a Monday.
test("a working week told on Monday ends that Friday", () => {
  assert.equal(businessDaysFrom("2026-08-10", WORKING_WEEK), "2026-08-14");
});

test("a working week from Wednesday crosses the weekend", () => {
  assert.equal(businessDaysFrom("2026-08-12", WORKING_WEEK), "2026-08-18");
});

test("a weekend start rolls to Monday and gets the whole week", () => {
  assert.equal(businessDaysFrom("2026-08-15", WORKING_WEEK), "2026-08-21"); // sábado
  assert.equal(businessDaysFrom("2026-08-16", WORKING_WEEK), "2026-08-21"); // domingo
});

test("ten business days is two calendar weeks", () => {
  assert.equal(businessDaysFrom("2026-08-10", TWO_WORKING_WEEKS), "2026-08-21");
});

// The deadline is inclusive. This is the assertion that fails if anyone
// replaces the timezone lookup with a fixed offset or with local time.
test("the last day is still open until midnight in Mexico", () => {
  const lastMoment = Date.parse("2026-08-15T04:59:00Z"); // 22:59 del 14 en CDMX
  const justAfter = Date.parse("2026-08-15T06:01:00Z"); // 00:01 del 15 en CDMX
  assert.equal(isExpired("2026-08-14", lastMoment), false);
  assert.equal(isExpired("2026-08-14", justAfter), true);
});

test("no deadline never expires", () => {
  assert.equal(isExpired(null, Date.parse("2030-01-01T00:00:00Z")), false);
});

test("today in Mexico is yesterday's date late in UTC", () => {
  assert.equal(todayInMexico(Date.parse("2026-08-15T03:00:00Z")), "2026-08-14");
});

// The wording belongs to ICU, so only the parts that matter are asserted.
test("the label names the weekday, the day and the month", () => {
  const label = formatDeadlineEs("2026-08-14");
  assert.match(label, /viernes/);
  assert.match(label, /14/);
  assert.match(label, /agosto/);
});

/* The month grid the picker draws. */

test("the grid is always six weeks, Monday first", () => {
  const grid = monthMatrix("2026-08");
  assert.equal(grid.length, 42);
  // August 2026 starts on a Saturday, so the first row leads with July.
  assert.equal(grid[0].iso, "2026-07-27");
  assert.equal(grid[0].inMonth, false);
  assert.equal(grid[5].iso, "2026-08-01");
  assert.equal(grid[5].inMonth, true);
  assert.equal(grid.at(-1)!.iso, "2026-09-06");
});

test("a month that starts on Monday has no leading days", () => {
  const grid = monthMatrix("2026-06");
  assert.equal(grid[0].iso, "2026-06-01");
  assert.equal(grid[0].inMonth, true);
});

test("paging crosses the year in both directions", () => {
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-08", 0), "2026-08");
});

test("the month header is capitalized", () => {
  assert.match(formatMonthEs("2026-08"), /^Agosto 2026$/);
});

// 2026-11-05 is a Thursday; the week around it is the fixture for the notices.
test("the business day before a weekday is the day before", () => {
  assert.equal(previousBusinessDay("2026-11-05"), "2026-11-04");
});

test("the business day before a Monday is the Friday", () => {
  assert.equal(previousBusinessDay("2026-11-09"), "2026-11-06");
});

test("the business day before a weekend day is the Friday", () => {
  assert.equal(previousBusinessDay("2026-11-07"), "2026-11-06");
  assert.equal(previousBusinessDay("2026-11-08"), "2026-11-06");
});

// Mexico City is UTC-6 all year, so 9:00 there is 15:00 UTC.
const nineInMexico = (day: number) => Date.UTC(2026, 10, day, 15, 0);

test("the warning fires on the business day before the deadline, from nine", () => {
  assert.equal(deadlineStage("2026-11-05", nineInMexico(4)), "warning");
});

test("the closing notice fires on the last day, from nine", () => {
  assert.equal(deadlineStage("2026-11-05", nineInMexico(5)), "closing");
});

test("nothing fires before nine in Mexico", () => {
  assert.equal(deadlineStage("2026-11-05", nineInMexico(4) - 60_000), null);
  assert.equal(deadlineStage("2026-11-05", nineInMexico(5) - 60_000), null);
});

test("a Monday deadline warns on Friday, not on Sunday", () => {
  assert.equal(deadlineStage("2026-11-09", nineInMexico(6)), "warning");
  assert.equal(deadlineStage("2026-11-09", nineInMexico(8)), null);
});

test("a Sunday deadline warns on Friday and closes on the Sunday itself", () => {
  assert.equal(deadlineStage("2026-11-08", nineInMexico(6)), "warning");
  assert.equal(deadlineStage("2026-11-08", nineInMexico(8)), "closing");
});

test("the evening in Mexico still counts as that day, though UTC has rolled over", () => {
  // 04:00 UTC on the 5th is 22:00 on the 4th in Mexico.
  assert.equal(deadlineStage("2026-11-05", Date.UTC(2026, 10, 5, 4, 0)), "warning");
  // 03:00 UTC on the 6th is 21:00 on the 5th in Mexico.
  assert.equal(deadlineStage("2026-11-05", Date.UTC(2026, 10, 6, 3, 0)), "closing");
});

// Exact days only: links already past their date must stay silent on deploy.
test("an expired link or one with no deadline has no notice", () => {
  assert.equal(deadlineStage("2026-10-05", nineInMexico(4)), null);
  assert.equal(deadlineStage("2026-11-04", nineInMexico(5)), null);
  assert.equal(deadlineStage(null, nineInMexico(4)), null);
});

test("a day between the two notices has none", () => {
  assert.equal(deadlineStage("2026-11-10", nineInMexico(5)), null);
});
