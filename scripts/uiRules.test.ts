/**
 * Regression test ของบั๊ก UI ที่แก้ระหว่างย้ายไป MUI
 *   npm test  (= node --test scripts/*.test.ts)
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  JOB_STATUS_FILTER,
  chatNotificationsEnabled,
  isTempSerial,
  serialEditableInForm,
  signatureShouldReset,
  techJobFooter,
} from "../src/lib/uiRules.ts";

test("ตัวกรองสถานะงานมี HOLD (พักงาน)", () => {
  assert.deepEqual(JOB_STATUS_FILTER, ["OPEN", "HOLD", "CLOSED", "CANCELLED"]);
});

test("หน้าช่าง: งานพัก/ยกเลิก ไม่แสดงว่าปิดแล้ว", () => {
  assert.equal(techJobFooter("OPEN"), "close-form");
  assert.equal(techJobFooter("CLOSED"), "closed");
  assert.equal(techJobFooter("HOLD"), "hold");
  assert.equal(techJobFooter("CANCELLED"), "cancelled");
});

test("ลายเซ็น: หมุนจอ (ความกว้างเปลี่ยน) ต้องล้าง · แถบที่อยู่เลื่อน (ความกว้างเท่าเดิม) ต้องไม่ล้าง", () => {
  assert.equal(signatureShouldReset(-1, 390), false);
  assert.equal(signatureShouldReset(390, 390), false);
  assert.equal(signatureShouldReset(390.4, 390), false);
  assert.equal(signatureShouldReset(390, 844), true);
});

test("Serial ชั่วคราว: ฟอร์มแก้ไขล็อกช่อง Serial ให้ไปใช้ปุ่มลง Serial จริง", () => {
  assert.equal(isTempSerial("TMP-2026-00001"), true);
  assert.equal(isTempSerial("tmp-2026-00001"), true);
  assert.equal(isTempSerial("SN-001"), false);
  assert.equal(serialEditableInForm(false, ""), true);
  assert.equal(serialEditableInForm(true, "TMP-2026-00001"), false);
  assert.equal(serialEditableInForm(true, "SN-001"), true);
});

test("แชทต่องานที่ซ่อนไว้ ไม่ส่งรายการแจ้งเตือนจากแชท", () => {
  assert.equal(chatNotificationsEnabled({ chat: false }), false);
  assert.equal(chatNotificationsEnabled({ chat: true }), true);
});

test("หน้ารายละเอียดใบงานใช้กติกาเดียวกับหน้าช่าง (ไม่แสดงหลักฐานปิดงานกับงานพัก)", async () => {
  const { jobCloseSection } = await import("../src/lib/uiRules.ts");
  assert.equal(jobCloseSection("HOLD"), "hold");
  assert.equal(jobCloseSection("CLOSED"), "closed");
});

test("รหัสสาขา: ตัวเลข 2 หลักแบบข้อความ ('00' ต้องผ่านและไม่กลายเป็น 0)", async () => {
  const { branchNoError } = await import("../src/lib/uiRules.ts");
  assert.equal(branchNoError("00"), null);
  assert.equal(branchNoError("07"), null);
  assert.equal(branchNoError(""), null);
  assert.notEqual(branchNoError("0"), null);
  assert.notEqual(branchNoError("001"), null);
  assert.notEqual(branchNoError("A1"), null);
  // ข้อมูลเก่าที่ไม่ได้แก้ ไม่บังคับ
  assert.equal(branchNoError("001", "001"), null);
});
