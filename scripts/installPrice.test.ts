// owner decision 30 ต.ค. 69: ค่าใน Equipment Model Master = ต้นทุนมาตรฐาน (ไม่ใช่ราคาติดตั้ง) — เทสต์เดิม (ราคาติดตั้งมาตรฐาน) ถูกแทนที่
import test from "node:test";
import assert from "node:assert/strict";
import {
  MISSING_APPROVED_COST,
  MISSING_INSTALL_CHARGE,
  costSnapshotNeedsValue,
  costSnapshotText,
  costStatusLabel,
  installChargeNeedsCapture,
  installChargeText,
  type StandardCostSnapshot,
} from "../src/lib/installPrice.ts";

const S = (over: Partial<StandardCostSnapshot>): StandardCostSnapshot => ({
  status: "APPROVED",
  source: "MASTER",
  masterId: "m1",
  type: "ตู้ฟรีส",
  category: "ตู้ยืน",
  model: "HF-78HS",
  standardCost: 2000,
  version: 2,
  approvedAt: "2026-10-30T03:00:00.000Z",
  approvedBy: "ผู้จัดการ",
  appliedAt: "2026-10-30T04:00:00.000Z",
  message: "",
  ...over,
});

test("ต้นทุนมาตรฐานที่อนุมัติ: แสดงค่า ฉบับ ผู้อนุมัติ และบอกว่าไม่รวมกำไร/ไม่ใช่รายรับ · ไม่มีคำว่า ราคา", () => {
  const t = costSnapshotText(S({}));
  assert.ok(t.startsWith("ต้นทุนมาตรฐาน 2,000 บาท (ตู้ฟรีส / ตู้ยืน ฉบับที่ 2 อนุมัติโดย ผู้จัดการ)"), t);
  assert.ok(t.includes("ไม่รวมในต้นทุน/กำไร") && t.includes("ไม่ใช่รายรับ"), t);
  assert.ok(!/ราคา/.test(t), t);
  assert.equal(costSnapshotNeedsValue(S({})), false);
});

test("ไม่มีสิทธิ์ดูต้นทุน (null) — ไม่แสดงตัวเลข", () => {
  const t = costSnapshotText(S({ standardCost: null }));
  assert.ok(!/\d,\d{3}/.test(t), t);
});

test("ยังไม่มีต้นทุนที่อนุมัติ = ข้อความชัดเจน ไม่ใช่ 0", () => {
  for (const status of ["UNAPPROVED", "NO_MASTER", "AMBIGUOUS"] as const) {
    const t = costSnapshotText(S({ status, standardCost: null }));
    assert.ok(t.startsWith(MISSING_APPROVED_COST), t);
    assert.ok(!/(^|\s)0 บาท/.test(t), t);
    assert.equal(costSnapshotNeedsValue(S({ status, standardCost: null })), true);
  }
  assert.equal(costSnapshotText(undefined), "");
  assert.equal(costStatusLabel("APPROVED"), "อนุมัติเป็นต้นทุนมาตรฐานแล้ว");
  assert.equal(costStatusLabel(undefined), "ยังไม่อนุมัติ");
});

test("ราคาค่าติดตั้งจาก Model Index ติดป้ายยังไม่ยืนยัน (ADV3-01) · ไม่มี = ข้อความ ไม่ใช่ 0", () => {
  const base = { source: "MODEL_INDEX" as const, modelIndexId: "1", modelIndexValue: "OLD-RT", model: "OLD-RT", capturedAt: "", verified: false as const, message: "" };
  assert.equal(installChargeText({ ...base, installCharge: 5000, status: "OK" }), "ราคาค่าติดตั้ง (Model Index) 5,000 บาท — ยังไม่ยืนยันราคาค่าติดตั้ง (ADV3-01)");
  assert.equal(installChargeText({ ...base, installCharge: null, status: "MISSING" }), MISSING_INSTALL_CHARGE);
  assert.equal(installChargeText(undefined), "");
});

test("ADV11A-02: รายการที่ยังไม่ได้บันทึกราคาค่าติดตั้ง (MISSING / ERROR) แสดงปุ่มบันทึกของ Manager · OK ไม่แสดง", () => {
  const base = { source: "MODEL_INDEX" as const, modelIndexId: "", modelIndexValue: "", model: "HF-78HS", capturedAt: "", verified: false as const, message: "" };
  assert.equal(installChargeNeedsCapture({ ...base, installCharge: null, status: "MISSING" }), true);
  assert.equal(installChargeNeedsCapture({ ...base, installCharge: null, status: "ERROR" }), true);
  assert.equal(installChargeNeedsCapture({ ...base, installCharge: 5000, status: "OK" }), false);
  assert.equal(installChargeNeedsCapture(undefined), false);
  assert.match(installChargeText({ ...base, installCharge: null, status: "ERROR" }), /อ่าน Model Index ไม่ได้/);
});
