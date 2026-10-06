/** JOB-04 ปฏิทินรายเดือน — ตารางวันต้องครบเดือนและเริ่มวันจันทร์ */
import test from "node:test";
import assert from "node:assert/strict";
import { daysInMonth, isMonthString, monthGrid, shiftMonth } from "../src/lib/calendarMonth.ts";

test("กันยายน 2026 เริ่มวันอังคาร → ช่องแรกเป็นวันจันทร์ 31 ส.ค. และมีวันที่ 1–30 ครบ", () => {
  const g = monthGrid("2026-09");
  assert.equal(g.length % 7, 0);
  assert.equal(g[0].date, "2026-08-31");
  assert.equal(g[0].inMonth, false);
  const inMonth = g.filter((d) => d.inMonth).map((d) => d.date);
  assert.equal(inMonth.length, 30);
  assert.equal(inMonth[0], "2026-09-01");
  assert.equal(inMonth[29], "2026-09-30");
});

test("กุมภาพันธ์ปีอธิกสุรทิน และการเลื่อนเดือนข้ามปี", () => {
  assert.equal(daysInMonth("2028-02"), 29);
  assert.equal(daysInMonth("2026-02"), 28);
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(isMonthString("2026-13"), false);
  assert.equal(isMonthString("2026-09"), true);
});
