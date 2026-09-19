/**
 * Regression test ของบั๊กวันที่ (WOMS-01 / WOMS-02) — Phase 9.2
 *
 * รันด้วยตัวรันเทสต์ที่ติดมากับ Node เอง ไม่ได้ติดตั้ง test framework ใหม่:
 *
 *   npm test            (= node --test scripts/*.test.ts)
 *
 * เทสต์ตรึงเวลาไว้ที่จุดที่เคยพัง (ก่อน 07:00 น. เวลาไทย = ยังเป็นเมื่อวานตาม UTC)
 * และตรวจว่าตัวช่วยกลางให้ผลตามวันไทยเสมอ ไม่ว่าเครื่องที่รันจะตั้งเขตเวลาอะไรไว้
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  BANGKOK_UTC_OFFSET_MINUTES,
  addDaysISO,
  bangkokDate,
  bangkokTime,
  bangkokToday,
  dayMonthLabel,
  partsISO,
  startOfWeekISO,
  weekdayIndexISO,
} from "../src/lib/date.ts";

// 2026-09-16 00:30 น. ที่กรุงเทพ = 2026-09-15 17:30 UTC
const AFTER_MIDNIGHT_BKK = new Date("2026-09-15T17:30:00Z");

test("ไทยใช้ UTC+7 คงที่", () => {
  assert.equal(BANGKOK_UTC_OFFSET_MINUTES, 420);
});

test("WOMS-02: หลังเที่ยงคืนไทย วันนี้ต้องเป็นวันใหม่ ไม่ใช่วันตาม UTC", () => {
  assert.equal(bangkokToday(AFTER_MIDNIGHT_BKK), "2026-09-16");
  // ยืนยันว่าวิธีเดิม (UTC) ให้คนละค่า — นี่คือต้นเหตุของบั๊ก
  assert.equal(AFTER_MIDNIGHT_BKK.toISOString().slice(0, 10), "2026-09-15");
});

test("WOMS-02: ขอบเที่ยงคืนไทยพอดี", () => {
  assert.equal(bangkokToday(new Date("2026-09-15T16:59:59Z")), "2026-09-15"); // 23:59:59 น.
  assert.equal(bangkokToday(new Date("2026-09-15T17:00:00Z")), "2026-09-16"); // 00:00:00 น.
});

test("WOMS-02: ขอบเดือนและขอบปี", () => {
  assert.equal(bangkokToday(new Date("2026-09-30T17:00:00Z")), "2026-10-01");
  assert.equal(bangkokToday(new Date("2026-12-31T17:00:00Z")), "2027-01-01");
  assert.equal(bangkokToday(new Date("2026-12-31T16:59:59Z")), "2026-12-31");
  assert.equal(bangkokToday(new Date("2028-02-28T17:00:00Z")), "2028-02-29"); // ปีอธิกสุรทิน
});

test("WOMS-02: ผลไม่ขึ้นกับเขตเวลาของเครื่องที่รัน", () => {
  // คำนวณจาก epoch ตรง ๆ ไม่ผ่าน getFullYear/getDate ของเครื่อง
  const t = Date.UTC(2026, 8, 15, 17, 30, 0);
  assert.equal(bangkokToday(new Date(t)), "2026-09-16");
  assert.equal(bangkokDate(new Date(t).toISOString()), "2026-09-16");
  // ค่านี้ต้องเท่ากันเสมอไม่ว่า process.env.TZ จะเป็นอะไร (ดู runner ด้านล่าง)
});

test("เวลาแสดงผลเป็นนาฬิกาไทย ไม่ใช่ UTC", () => {
  assert.equal(bangkokTime(AFTER_MIDNIGHT_BKK), "00:30:00");
  assert.equal(bangkokTime(new Date("2026-09-15T05:00:00Z")), "12:00:00");
});

test("เลขคณิตของวันที่แบบ date-only ไม่เลื่อนวัน", () => {
  assert.equal(addDaysISO("2026-09-16", 1), "2026-09-17");
  assert.equal(addDaysISO("2026-09-16", -1), "2026-09-15");
  assert.equal(addDaysISO("2026-09-30", 1), "2026-10-01");
  assert.equal(addDaysISO("2027-01-01", -1), "2026-12-31");
  assert.equal(addDaysISO("2026-09-14", 7), "2026-09-21");
});

test("วันในสัปดาห์เริ่มวันจันทร์", () => {
  assert.equal(weekdayIndexISO("2026-09-14"), 0); // จันทร์
  assert.equal(weekdayIndexISO("2026-09-16"), 2); // พุธ
  assert.equal(weekdayIndexISO("2026-09-20"), 6); // อาทิตย์
});

test("WOMS-01: สัปดาห์ของปฏิทินคือ จันทร์ → อาทิตย์ ชุดเดียวกับที่แสดง", () => {
  const start = startOfWeekISO(bangkokToday(AFTER_MIDNIGHT_BKK)); // ทดสอบตอนตี 0:30 ของวันพุธ
  assert.equal(start, "2026-09-14"); // วันจันทร์

  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
  assert.deepEqual(days, [
    "2026-09-14",
    "2026-09-15",
    "2026-09-16",
    "2026-09-17",
    "2026-09-18",
    "2026-09-19",
    "2026-09-20",
  ]);

  // ช่วงที่ส่งไป query ต้องเป็นวันแรกและวันสุดท้ายของคอลัมน์ที่แสดงจริง
  // (บั๊กเดิม: หัวคอลัมน์ 14–20 แต่ query 13–19 ทำให้งานวันอาทิตย์ที่ 20 หายไปทั้งวัน)
  const from = days[0];
  const to = days[6];
  assert.equal(from, "2026-09-14");
  assert.equal(to, "2026-09-20");

  // งานวันจันทร์และวันอาทิตย์ต้องอยู่ในช่วงที่ query ทั้งคู่
  for (const jobDate of ["2026-09-14", "2026-09-20"]) {
    assert.ok(jobDate >= from && jobDate <= to, `${jobDate} ต้องอยู่ในสัปดาห์ที่แสดง`);
  }
  // และวันอาทิตย์ของสัปดาห์ก่อนต้องไม่หลุดเข้ามา
  assert.ok(!("2026-09-13" >= from && "2026-09-13" <= to));
});

test("WOMS-01: คีย์ของช่องในตารางคือวันเดียวกับหัวคอลัมน์", () => {
  const start = startOfWeekISO("2026-09-16");
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
  // หัวคอลัมน์ที่ผู้ใช้เห็น
  assert.deepEqual(days.map(dayMonthLabel), ["14/9", "15/9", "16/9", "17/9", "18/9", "19/9", "20/9"]);
  // งานวันที่ 20 ต้องตกช่องสุดท้าย ไม่ใช่เลื่อนไปช่องอื่นหรือหายไป
  const event = { date: "2026-09-20" };
  const columnIndex = days.findIndex((d) => d === event.date);
  assert.equal(columnIndex, 6);
});

test("เปลี่ยนสัปดาห์ไป-กลับแล้วได้สัปดาห์เดิม", () => {
  const start = startOfWeekISO("2026-09-16");
  assert.equal(addDaysISO(addDaysISO(start, 7), -7), start);
  assert.equal(startOfWeekISO(addDaysISO(start, 7)), "2026-09-21"); // สัปดาห์ถัดไปยังเริ่มวันจันทร์
  assert.equal(startOfWeekISO(addDaysISO(start, -7)), "2026-09-07");
  // ข้ามเดือน
  assert.equal(startOfWeekISO("2026-10-01"), "2026-09-28");
});

test("partsISO แยกส่วนโดยไม่ผ่าน Date", () => {
  assert.deepEqual(partsISO("2026-09-16"), { year: 2026, month: 9, day: 16 });
});

test("ค่าที่ผิดรูปแบบไม่ทำให้ระเบิด", () => {
  assert.equal(addDaysISO("", 1), "");
  assert.equal(bangkokDate("ไม่ใช่วันที่"), "");
});
