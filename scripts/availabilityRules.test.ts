import test from "node:test";
import assert from "node:assert/strict";
import { addDaysISO, agendaByDate, appointmentsByDate, isActiveAppointment } from "../src/lib/availabilityRules.ts";

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

test("UAT 2026-11-16 ปฏิทินเสนอวัน: รวมนัดจริง + คิวที่เสนอแล้ว เรียงเวลา · ไม่นับคิวที่กำลังเสนอ/สถานะอื่น", () => {
  const byDate = appointmentsByDate([ev({ jobId: "J1", time: "13:00", title: "ติดตั้ง ร้าน A" })]);
  const props = [
    { queueId: "q1", queueNo: "Q-1", date: "2026-11-14", time: "09:00", title: "ร้าน B", status: "TECH_REPLIED" },
    { queueId: "q2", queueNo: "Q-2", date: "2026-11-14", time: "10:00", title: "ร้าน C", status: "WAIT_TECH" },
    { queueId: "q3", queueNo: "Q-3", date: "2026-11-14", time: "11:00", title: "ร้าน D", status: "WAIT_CUSTOMER" },
    { queueId: "q4", queueNo: "Q-4", date: "2026-11-15", time: "", title: "ร้าน E", status: "READY_TO_OPEN" },
  ];
  const m = agendaByDate(byDate, props, "q3");
  assert.deepEqual(m.get("2026-11-14")!.map((a) => [a.time, a.kind]), [["09:00", "PROPOSED"], ["13:00", "JOB"]]);
  assert.match(m.get("2026-11-14")![0].text, /เสนอแล้ว Q-1 ร้าน B \(รอแอดมินรับ\)/);
  assert.deepEqual(m.get("2026-11-15")!.map((a) => a.kind), ["PROPOSED"]);
});
