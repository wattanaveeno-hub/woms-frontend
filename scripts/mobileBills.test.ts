import { test } from "node:test";
import assert from "node:assert/strict";
import { filterMobileBills, mobileBillAction, mobileBillGroup, mobileBillSummary } from "../src/lib/mobileBills.ts";

const b = (status: string, grandTotal: number) => ({ status, totals: { grandTotal } });

test("BD-10 กลุ่มสถานะบิลบนมือถือ + ยอดรวมเป็นสตางค์", () => {
  const bills = [b("RETURNED", 450), b("SUBMITTED", 1400.1), b("UNDER_REVIEW", 0.2), b("APPROVED", 600), b("PAID", 800), b("DRAFT", 99), b("CANCELLED", 5)];
  const s = mobileBillSummary(bills);
  assert.deepEqual(s.counts, { all: 6, draft: 1, returned: 1, review: 2, approved: 2 });
  assert.equal(s.review, 1400.3);
  assert.equal(s.approved, 1400);
  assert.equal(s.total, 2800.3);
  assert.equal(filterMobileBills(bills, "review").length, 2);
  assert.equal(filterMobileBills(bills, "all").some((x) => x.status === "CANCELLED"), false);
  assert.equal(mobileBillGroup("ON_HOLD"), "returned");
  assert.equal(mobileBillGroup("CANCELLED"), "");
  assert.equal(mobileBillAction("RETURNED"), "ตีกลับ · แก้แล้วส่งใหม่");
  assert.equal(mobileBillAction("APPROVED"), "");
});
