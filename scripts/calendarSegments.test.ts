// CF v1.1 · BR-01 C-2 / CAL-D01 — แยก Active Appointment / HOLD ในปฏิทิน
import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarEventKind, filterBySegment, segmentCounts } from "../src/lib/calendarSegments.ts";

const ev = (jobId: string, status: any, extra: any = {}) => ({ jobId, status, ...extra });

test("CS-K1 OPEN + activeAppointment → ACTIVE · OPEN ไม่มีฟิลด์ (backend เดิม) → ACTIVE", () => {
  assert.equal(calendarEventKind(ev("a", "OPEN", { activeAppointment: true })), "ACTIVE");
  assert.equal(calendarEventKind(ev("a", "OPEN")), "ACTIVE");
});
test("CS-K2 HOLD หรือ onHold → HOLD ไม่ใช่นัดที่ต้องไป", () => {
  assert.equal(calendarEventKind(ev("a", "HOLD", { activeAppointment: false, onHold: true })), "HOLD");
  assert.equal(calendarEventKind(ev("a", "HOLD")), "HOLD");
});
test("CS-K3 OPEN ที่ activeAppointment=false (รอยืนยันรอบใหม่) ไม่นับเป็น ACTIVE", () => {
  assert.equal(calendarEventKind(ev("a", "OPEN", { activeAppointment: false })), "OTHER");
});
test("CS-F1 กรองตาม segment และนับใบงานหลายช่างครั้งเดียว", () => {
  const list = [ev("1", "OPEN"), ev("1", "OPEN"), ev("2", "HOLD", { onHold: true }), ev("3", "OPEN", { activeAppointment: false })];
  assert.deepEqual(filterBySegment(list, "HOLD").map((e) => e.jobId), ["2"]);
  assert.deepEqual(filterBySegment(list, "ACTIVE").map((e) => e.jobId), ["1", "1"]);
  assert.equal(filterBySegment(list, "ALL").length, 4);
  assert.deepEqual(segmentCounts(list), { ALL: 3, ACTIVE: 1, HOLD: 1 });
});
