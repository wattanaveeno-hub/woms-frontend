/** MoM 23/11/69 — กติกาหน้าจอใหม่ (MOM-17 เทียบนัด · MOM-18 เปิดคิวใหม่จากคิวเดิม) */
import test from "node:test";
import assert from "node:assert/strict";
import { APPT_MATCH_MINUTES, compareAppointment, queueToFormValues } from "../src/lib/serviceQueueRules.ts";

test("MOM-17 ลูกค้าไม่ระบุวัน / ช่างยังไม่เสนอ — ไม่ตัดสิน", () => {
  assert.equal(compareAppointment({}, { date: "2026-11-27" }).state, "unspecified");
  assert.equal(compareAppointment({ date: "2026-11-27" }, null).state, "noproposal");
  assert.equal(compareAppointment({ date: "2026-11-27" }, { date: "" }).state, "noproposal");
});

test("MOM-17 วันต่าง = ไม่ตรง พร้อมบอกช้า/เร็วกี่วัน", () => {
  const late = compareAppointment({ date: "2026-11-27", time: "10:00" }, { date: "2026-11-29", time: "10:00" });
  assert.equal(late.state, "mismatch");
  assert.equal(late.diffDays, 2);
  assert.match(late.text, /ช้ากว่า 2 วัน/);
  const early = compareAppointment({ date: "2026-11-27" }, { date: "2026-11-26" });
  assert.equal(early.diffDays, -1);
  assert.match(early.text, /เร็วกว่า 1 วัน/);
  // ข้ามเดือน/ปี
  assert.equal(compareAppointment({ date: "2026-12-31" }, { date: "2027-01-01" }).diffDays, 1);
});

test("MOM-17 วันเดียวกัน: เวลาห่างไม่เกินเกณฑ์ = ตรง · เกิน = ไม่ตรง · ฝั่งใดไม่ระบุเวลา = ตรง", () => {
  // Owner 27 พ.ย.: ±10 นาที
  assert.equal(APPT_MATCH_MINUTES, 10);
  assert.equal(compareAppointment({ date: "2026-11-27", time: "10:00" }, { date: "2026-11-27", time: "10:10" }).state, "match");
  assert.equal(compareAppointment({ date: "2026-11-27", time: "10:00" }, { date: "2026-11-27", time: "09:50" }).state, "match");
  const late = compareAppointment({ date: "2026-11-27", time: "10:00" }, { date: "2026-11-27", time: "10:11" });
  assert.equal(late.state, "mismatch");
  assert.match(late.text, /ช้ากว่า 11 นาที/);
  assert.match(compareAppointment({ date: "2026-11-27", time: "10:00" }, { date: "2026-11-27", time: "08:30" }).text, /เร็วกว่า 1 ชม\. 30 นาที/);
  const m = compareAppointment({ date: "2026-11-27", time: "10:00" }, { date: "2026-11-27", time: "18:00" });
  assert.equal(m.state, "mismatch");
  assert.match(m.text, /เวลาไม่ตรง/);
  assert.equal(compareAppointment({ date: "2026-11-27" }, { date: "2026-11-27", time: "18:00" }).state, "match");
  assert.equal(compareAppointment({ date: "2026-11-27", time: "09:00" }, { date: "2026-11-27" }).state, "match");
});

const base = {
  jobType: "INSTALL_SALE", jobSubType: "", customerType: "IN", jobName: "ร้าน A", customerId: "C1", siteId: "S1",
  address: "88", contactName: "คุณนิด", phone: "081", mapLink: "", note: "ติดตั้ง 2 เครื่อง",
  preferredDate: "2026-11-20", preferredTime: "10:00", ownerSaleId: "U1",
  items: [{ itemId: "IT-1", equipmentId: "E1", model: "B-301SA", machineType: "ถัง", serial: "SN1", note: "x", pmMode: "FREE", pmRounds: 2 }],
};

test("MOM-18 clone: ไม่คัดลอกรหัสรายการ · ล้างวันลูกค้าสะดวกที่ผ่านไปแล้ว · ข้อมูลอื่นครบ", () => {
  const v = queueToFormValues(base, { clone: true, now: new Date("2026-11-27T03:00:00Z") });
  assert.equal((v.items[0] as any).itemId, undefined);
  assert.equal(v.items[0].equipmentId, "E1");
  assert.equal((v.items[0] as any).pmRounds, 2);
  assert.equal(v.preferredDate, "");
  assert.equal(v.preferredTime, "");
  assert.equal(v.jobName, "ร้าน A");
  assert.equal(v.note, "ติดตั้ง 2 เครื่อง");
  const future = queueToFormValues({ ...base, preferredDate: "2026-12-05" }, { clone: true, now: new Date("2026-11-27T03:00:00Z") });
  assert.equal(future.preferredDate, "2026-12-05");
});

test("แก้คิวเดิม (ไม่ clone) คงรหัสรายการและวันเดิม", () => {
  const v = queueToFormValues(base);
  assert.equal((v.items[0] as any).itemId, "IT-1");
  assert.equal(v.preferredDate, "2026-11-20");
});

import { sortSerialsForModel } from "../src/lib/contractRules.ts";
test("MOM-33 SN รุ่นเดียวกับสัญญาขึ้นก่อน เรียงตาม SN (ตัวเลขเรียงแบบธรรมชาติ) · ไม่ตัดรุ่นอื่น", () => {
  const items = [
    { serial: "SN-10", model: "B-301SA" },
    { serial: "SN-2", model: "IM-100A" },
    { serial: "SN-9", model: "b-301sa " },
    { serial: "SN-1", model: "IM-100A" },
  ];
  const r = sortSerialsForModel(items, "B-301SA");
  assert.deepEqual(r.map((x) => x.serial), ["SN-9", "SN-10", "SN-1", "SN-2"]);
  assert.deepEqual(r.map((x) => x.sameModel), [true, true, false, false]);
  assert.deepEqual(sortSerialsForModel(items, "").map((x) => x.serial), ["SN-1", "SN-2", "SN-9", "SN-10"]);
});

import { AUTO_REFRESH_MS, shouldRefreshNow } from "../src/lib/useAutoRefresh.ts";
test("MOM-34 รีเฟรชอัตโนมัติ: เฉพาะแท็บที่เปิดอยู่ และเว้นห่างอย่างน้อยตามกำหนด", () => {
  assert.equal(AUTO_REFRESH_MS, 30_000);
  assert.equal(shouldRefreshNow(0, 15_000, 10_000, true), true);
  assert.equal(shouldRefreshNow(10_000, 15_000, 10_000, true), false);
  assert.equal(shouldRefreshNow(0, 60_000, 10_000, false), false);
});
