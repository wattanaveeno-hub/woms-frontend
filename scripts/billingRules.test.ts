/**
 * Gap closure (Audit C) — กติกาแสดงผลวางบิล/ใบเสนอราคา
 *   DEF-02 ยืนยันรับเงินแสดงเฉพาะบิล PAID · DEF-03 หลักฐานรายรายการ · DEF-06 ป้าย ACTIVE/VOID · DEF-08 ป้าย SENT
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isPdfSrc, isReceiptConfirmed, paymentEvidenceSrc, paymentRecordStatusLabel } from "../src/lib/billingRules.ts";
import { quotationStatusLabel } from "../src/lib/options.ts";

test("DEF-02 ยืนยันรับเงินแล้ว = สถานะ PAID และมีเวลายืนยันเท่านั้น", () => {
  assert.equal(isReceiptConfirmed({ status: "PAID", receivedConfirmedAt: "2026-10-01T00:00:00Z" }), true);
  assert.equal(isReceiptConfirmed({ status: "PAYMENT_PENDING", receivedConfirmedAt: "2026-10-01T00:00:00Z" }), false);
  assert.equal(isReceiptConfirmed({ status: "PAID", receivedConfirmedAt: "" }), false);
  assert.equal(isReceiptConfirmed({ status: "PAID" }), false);
});

test("DEF-03 หลักฐานรายรายการ: รับเฉพาะรูป/PDF แบบ data URL", () => {
  assert.equal(paymentEvidenceSrc({ evidence: "data:image/png;base64,AAAA" }), "data:image/png;base64,AAAA");
  assert.equal(paymentEvidenceSrc({ evidence: "data:application/pdf;base64,JVBE" }), "data:application/pdf;base64,JVBE");
  assert.equal(paymentEvidenceSrc({ evidence: "data:text/html;base64,AAAA" }), null);
  assert.equal(paymentEvidenceSrc({ evidence: "javascript:alert(1)" }), null);
  assert.equal(paymentEvidenceSrc({ evidence: "" }), null);
  assert.equal(paymentEvidenceSrc(null), null);
});

test("R2: หลักฐานที่เก็บในที่เก็บไฟล์ (presigned URL) แสดงได้เฉพาะรูป/PDF · ลิงก์อื่นไม่รับ", () => {
  const h = "a".repeat(64);
  const img = `https://acc1.r2.cloudflarestorage.com/woms-uat/bill-files/${h}.jpg?X-Amz-Signature=x`;
  const pdf = `https://acc1.r2.cloudflarestorage.com/woms-uat/bill-files/${h}.pdf?X-Amz-Expires=3600`;
  assert.equal(paymentEvidenceSrc({ evidence: img }), img);
  assert.equal(paymentEvidenceSrc({ evidence: pdf }), pdf);
  assert.equal(paymentEvidenceSrc({ evidence: `https://acc1.r2.cloudflarestorage.com/woms-uat/x/${h}.html?x` }), null);
  assert.equal(paymentEvidenceSrc({ evidence: `https://evil.example/woms-uat/bill-files/${h}.jpg` }), null);
  assert.equal(paymentEvidenceSrc({ evidence: `http://acc1.r2.cloudflarestorage.com/woms-uat/bill-files/${h}.jpg` }), null);
  assert.equal(isPdfSrc(pdf), true);
  assert.equal(isPdfSrc(img), false);
  assert.equal(isPdfSrc("data:application/pdf;base64,JVBE"), true);
  assert.equal(isPdfSrc("data:image/png;base64,AAAA"), false);
  assert.equal(isPdfSrc(""), false);
});

test("DEF-06 ประวัติแก้ไขไม่แสดง enum ดิบ", () => {
  assert.equal(paymentRecordStatusLabel("ACTIVE"), "มีผล");
  assert.equal(paymentRecordStatusLabel("VOID"), "ยกเลิกแล้ว");
  const line = `${paymentRecordStatusLabel("ACTIVE")} → ${paymentRecordStatusLabel("VOID")}`;
  assert.doesNotMatch(line, /ACTIVE|VOID/);
});

test("DEF-08 ใบเสนอราคา SENT แสดงเป็น รอตอบรับ (QUO-03)", () => {
  assert.equal(quotationStatusLabel.SENT, "รอตอบรับ");
  assert.equal(quotationStatusLabel.ACCEPTED, "ตอบรับ");
  assert.equal(quotationStatusLabel.REJECTED, "ปฏิเสธ");
});
