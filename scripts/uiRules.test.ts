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
  scaleSignatureStroke,
  renderSignatureStrokes,
  toCanonicalPoint,
  signatureHasInk,
  signatureStrokeScale,
  signatureWidthChanged,
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

// R10-02: เปลี่ยนชื่อจาก signatureShouldReset — ความกว้างเปลี่ยนแล้ว "ปรับขนาดภาพ" ไม่ได้ล้างลายเซ็น (UX-R3-01)
test("ลายเซ็น: หมุนจอ (ความกว้างเปลี่ยน) = ต้องปรับขนาดภาพ · แถบที่อยู่เลื่อน (ความกว้างเท่าเดิม) = ไม่ต้องทำอะไร", () => {
  assert.equal(signatureWidthChanged(-1, 390), false);
  assert.equal(signatureWidthChanged(390, 390), false);
  assert.equal(signatureWidthChanged(390.4, 390), false);
  assert.equal(signatureWidthChanged(390, 844), true);
});

// ADV11B-04: เดิม signatureRescaleRect ย่อจาก bitmap ของกรอบทุกครั้งที่ความกว้างเปลี่ยน → หมุนจอไปกลับแล้วลายเซ็นเล็กลงสะสม
test("ADV11B-04 ลายเซ็น: scale = min(1, ความกว้างใหม่/ความกว้างตอนวาด) — ไม่ขยายเกินขนาดที่วาด", () => {
  assert.equal(signatureStrokeScale(393, 851), 1);
  assert.equal(signatureStrokeScale(851, 393), 393 / 851);
  assert.equal(signatureStrokeScale(393, 393), 1);
  assert.equal(signatureStrokeScale(0, 393), 0);
  assert.equal(signatureStrokeScale(393, 0), 0);
});

test("ADV11B-04 ลายเซ็น: ย่อสัดส่วนเดียวกันทั้งสองแกน ชิดซ้ายบน · หมุนไปกลับ 3 รอบได้ขนาดเดิมทุกจุด (ไม่ย่อสะสม)", () => {
  const stroke = { widthAtDraw: 851, points: [{ x: 20, y: 20 }, { x: 400, y: 120 }, { x: 800, y: 60 }] };
  const narrow = scaleSignatureStroke(stroke, 393);
  const s = 393 / 851;
  assert.deepEqual(narrow, stroke.points.map((p) => ({ x: p.x * s, y: p.y * s })));
  // สัดส่วนกว้าง/สูงของเส้นเท่าเดิม (ไม่ยืดแนวนอน)
  const ratio = (pts: Array<{ x: number; y: number }>) => (Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x))) / (Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)));
  assert.ok(Math.abs(ratio(narrow) - ratio(stroke.points)) < 1e-9);
  // ไปกลับ 851 → 393 → 851 สามรอบ: คำนวณจากจุดเดิมเสมอ ผลสุดท้าย = จุดเดิม
  let pts = stroke.points;
  for (let i = 0; i < 3; i++) {
    pts = scaleSignatureStroke(stroke, 393);
    pts = scaleSignatureStroke(stroke, 851);
  }
  assert.deepEqual(pts, stroke.points);
  // เส้นที่วาดในกรอบแคบ ไม่ถูกขยายเมื่อกรอบกว้างขึ้น
  const small = { widthAtDraw: 393, points: [{ x: 10, y: 10 }, { x: 300, y: 90 }] };
  assert.deepEqual(scaleSignatureStroke(small, 851), small.points);
  assert.deepEqual(scaleSignatureStroke(small, 0), []);
});

test("ADV11B-04 ลายเซ็น: แตะเฉย ๆ (จุดเดียว) ไม่นับเป็นลายเซ็น · ล้างแล้วไม่มีเส้น", () => {
  assert.equal(signatureHasInk([]), false);
  assert.equal(signatureHasInk([{ widthAtDraw: 393, points: [{ x: 1, y: 1 }] }]), false);
  assert.equal(signatureHasInk([{ widthAtDraw: 393, points: [{ x: 1, y: 1 }, { x: 5, y: 5 }] }]), true);
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

test("ADV12-05: เส้นที่วาดตอนกรอบกว้างต่างกันย่อด้วยสัดส่วนเดียว — ตำแหน่งเทียบกันคงเดิม", () => {
  // ชื่อเซ็นตอนแนวนอน (กว้าง 851 = ฐาน) · ขีดเส้นใต้ตอนแนวตั้ง (393) → แปลงเป็นพิกัดฐานก่อนเก็บ
  const base = 851;
  const name = { widthAtDraw: base, points: [{ x: 100, y: 50 }, { x: 700, y: 60 }] };
  const underlineDisplay = [{ x: 46, y: 40 }, { x: 323, y: 40 }]; // เห็นใต้ชื่อบนจอแคบ
  const underline = { widthAtDraw: base, points: underlineDisplay.map((p) => toCanonicalPoint(p, base, 393)) };
  for (const w of [393, 851, 393, 851, 600]) {
    const [n, u] = renderSignatureStrokes([name, underline], base, w);
    // เส้นใต้ยังอยู่ช่วงเดียวกับชื่อในทุกความกว้าง (ปลายซ้าย/ขวาใกล้กัน ภายใน 2px หลังย่อ)
    assert.ok(Math.abs(u[0].x - n[0].x) <= 2 && Math.abs(u[1].x - n[1].x) <= 2, `w=${w}`);
  }
  // หมุนกลับมาความกว้างฐาน = พิกัดเดิม
  assert.deepEqual(renderSignatureStrokes([name], base, base)[0], name.points);
});
