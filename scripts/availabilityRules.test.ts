import test from "node:test";
import assert from "node:assert/strict";
import { addDaysISO, appointmentsByDate, isActiveAppointment } from "../src/lib/availabilityRules.ts";

const ev = (o: Record<string, unknown>) => ({ jobId: "J1", title: "t", team: "A", jobType: "CM", date: "2026-11-14", time: "09:00", status: "OPEN", ...o }) as any;

test("UAT2-01 นับเฉพาะนัดที่ต้องไปจริง", () => {
  assert.equal(isActiveAppointment(ev({})), true);
  assert.equal(isActiveAppointment(ev({ status: "CLOSED" })), false);
  assert.equal(isActiveAppointment(ev({ status: "CANCELLED" })), false);
  assert.equal(isActiveAppointment(ev({ onHold: true })), false);
  assert.equal(isActiveAppointment(ev({ activeAppointment: false })), false);
});

test("UAT2-01 รวมรายวัน ไม่นับซ้ำ เรียงเวลา", () => {
  const m = appointmentsByDate([ev({ jobId: "B", time: "13:00" }), ev({ jobId: "A", time: "09:00" }), ev({ jobId: "A", time: "09:00" }), ev({ jobId: "C", date: "2026-11-15", status: "HOLD" })]);
  assert.deepEqual(m.get("2026-11-14")!.map((e) => e.jobId), ["A", "B"]);
  assert.equal(m.has("2026-11-15"), false);
});

test("addDaysISO ข้ามเดือน/ปี", () => {
  assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysISO("2026-11-14", 13), "2026-11-27");
});
