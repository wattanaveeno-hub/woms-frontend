import { test } from "node:test";
import assert from "node:assert/strict";
import { installmentDocLabel, installmentPayLabel, installmentPayTone } from "../src/lib/financeInstallments.ts";

test("BD-04 ป้ายสถานะงวด", () => {
  assert.equal(installmentPayLabel({ paymentState: "PAID", overdue: false }), "ชำระครบ");
  assert.equal(installmentPayLabel({ paymentState: "UNPAID", overdue: true }), "เลยกำหนด");
  assert.equal(installmentPayLabel({ paymentState: "PARTIAL", overdue: true }), "ชำระบางส่วน · เลยกำหนด");
  assert.equal(installmentPayLabel({ paymentState: "PARTIAL", overdue: false }), "ชำระบางส่วน");
  assert.equal(installmentPayLabel({ paymentState: "UNPAID", overdue: false }), "รอชำระ");
  assert.equal(installmentPayTone({ paymentState: "UNPAID", overdue: true }), "error");
  assert.equal(installmentPayTone({ paymentState: "PAID", overdue: true }), "success");
  assert.equal(installmentDocLabel("ISSUED"), "ออกใบเสร็จแล้ว");
  assert.equal(installmentDocLabel("NOT_ISSUED"), "ยังไม่ออกใบเสร็จ");
  assert.equal(installmentDocLabel("NOT_DUE"), "—");
});
