import test from "node:test";
import assert from "node:assert/strict";
import { MISSING_APPROVED_PRICE, priceSnapshotText, priceStatusLabel, snapshotNeedsPrice, type PriceSnapshot } from "../src/lib/installPrice.ts";

const S = (over: Partial<PriceSnapshot>): PriceSnapshot => ({
  status: "APPROVED",
  source: "MASTER",
  masterId: "m1",
  type: "ตู้ฟรีส",
  category: "ตู้ยืน",
  model: "HF-78HS",
  standardPrice: 2000,
  priceVersion: 2,
  priceApprovedAt: "2026-10-30T03:00:00.000Z",
  priceApprovedBy: "ผู้จัดการ",
  appliedAt: "2026-10-30T04:00:00.000Z",
  message: "",
  ...over,
});

test("Q-R3-14: snapshot ที่อนุมัติแล้วแสดงราคา ฉบับ และผู้อนุมัติ", () => {
  assert.equal(priceSnapshotText(S({})), "ราคาติดตั้งมาตรฐาน 2,000 บาท (ตู้ฟรีส / ตู้ยืน ฉบับที่ 2 อนุมัติโดย ผู้จัดการ)");
  assert.equal(snapshotNeedsPrice(S({})), false);
});

test("Q-R3-14: ราคาถูกซ่อน (D-22) — ไม่แสดงตัวเลข", () => {
  const t = priceSnapshotText(S({ standardPrice: null }));
  assert.ok(!/\d,\d{3}/.test(t), t);
  assert.ok(t.startsWith("ราคาติดตั้งมาตรฐาน ("), t);
});

test("Q-R3-14: ยังไม่มีราคาที่อนุมัติ = ข้อความชัดเจน ไม่ใช่ 0", () => {
  for (const status of ["UNAPPROVED", "NO_MASTER", "AMBIGUOUS"] as const) {
    const t = priceSnapshotText(S({ status, standardPrice: null }));
    assert.ok(t.startsWith(MISSING_APPROVED_PRICE), t);
    assert.ok(!/(^|\s)0 บาท/.test(t), t);
    assert.equal(snapshotNeedsPrice(S({ status, standardPrice: null })), true);
  }
});

test("Q-R3-14: รายการเดิม (ไม่มี snapshot) ไม่มีข้อความราคา · ป้ายสถานะราคา", () => {
  assert.equal(priceSnapshotText(undefined), "");
  assert.equal(snapshotNeedsPrice(undefined), false);
  assert.equal(priceStatusLabel("APPROVED"), "อนุมัติแล้ว");
  assert.equal(priceStatusLabel(undefined), "ยังไม่อนุมัติ — ไม่ใช้คิดรายรับ");
});
