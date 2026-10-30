/** D-11 Financial Workflow v1.0 — กติกาหน้าเว็บการเงิน (ต้องตรงกับ backend src/domain/finance.ts / quotation.ts) */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  FIN_AGG_STATE_LABEL,
  FIN_PAYMENT_STATE_LABEL,
  landingPath,
  parseFinAmount,
  paymentActions,
  canRecordPayment,
  quotationStatusNeedsInput,
  newIdempotencyKey,
} from "../src/lib/financeRules.ts";
import { navGroups, visibleGroups } from "../src/lib/navMenu.ts";
import { quotationTransitions } from "../src/lib/options.ts";
import { quotationEditable, quotationEditCreatesRevision } from "../src/lib/quotationRules.ts";

const perms = (list: string[]) => (p: string) => list.includes(p);
const ACC = ["quotations:view", "quotations:print", "partners:view", "finance:view", "payments:record", "payments:verify", "payments:void", "accounting_docs:record"];
const ADMIN_FIN = ["jobs:view", "quotations:view", "finance:view", "payments:record", "accounting_docs:record"];

test("ป้ายสถานะตรงเอกสาร D-11 (4.2 / 4.3)", () => {
  assert.equal(FIN_AGG_STATE_LABEL.PARTIALLY_PAID, "ชำระบางส่วน");
  assert.equal(FIN_AGG_STATE_LABEL.PAID, "ชำระครบแล้ว");
  assert.equal(FIN_PAYMENT_STATE_LABEL.PENDING_VERIFICATION, "รอบัญชีตรวจสอบ");
  const be = path.resolve(import.meta.dirname, "../../woms-backend/src/domain/finance.ts");
  if (fs.existsSync(be)) {
    const src = fs.readFileSync(be, "utf8");
    for (const [k, v] of Object.entries(FIN_PAYMENT_STATE_LABEL)) assert.ok(src.includes(`${k}: "${v}"`), k);
    for (const [k, v] of Object.entries(FIN_AGG_STATE_LABEL)) assert.ok(src.includes(`${k}: "${v}"`), k);
  }
});

test("ปุ่มรายการรับเงินตามสิทธิ์ + สถานะ: Admin ไม่มีปุ่มยืนยัน/ยกเลิก · ACC มี · ไม่ผ่าน → ส่งตรวจใหม่", () => {
  assert.deepEqual(paymentActions("PENDING_VERIFICATION", perms(ACC)), ["verify", "reject"]);
  assert.deepEqual(paymentActions("PENDING_VERIFICATION", perms(ADMIN_FIN)), []);
  assert.deepEqual(paymentActions("VERIFIED", perms(ACC)), ["void"]);
  assert.deepEqual(paymentActions("VERIFIED", perms(ADMIN_FIN)), []);
  assert.deepEqual(paymentActions("REJECTED", perms(ADMIN_FIN)), ["resubmit"]);
  assert.deepEqual(paymentActions("VOIDED", perms(ACC)), []);
  assert.equal(canRecordPayment("ACCEPTED", perms(ADMIN_FIN)), true);
  assert.equal(canRecordPayment("SENT", perms(ADMIN_FIN)), false);
  assert.equal(canRecordPayment("ACCEPTED", perms(["quotations:view"])), false);
});

test("ยอดเงิน: > 0 · ทศนิยม ≤ 2 · คอมมาได้", () => {
  assert.equal(parseFinAmount("3,000"), 3000);
  assert.equal(parseFinAmount("0.5"), 0.5);
  for (const bad of ["0", "-1", "1.234", "abc", "", "1e5", "100000001"]) assert.equal(parseFinAmount(bad), null, bad);
});

test("คีย์กันบันทึกซ้ำตรงรูปแบบที่ backend รับ และไม่ซ้ำกัน", () => {
  const a = newIdempotencyKey("pay");
  const b = newIdempotencyKey("pay");
  assert.match(a, /^[A-Za-z0-9_\-:.]{8,100}$/);
  assert.notEqual(a, b);
});

test("หน้าแรก: ACC → คิวรอตรวจ · CEO (finance:view อย่างเดียวแต่มี jobs:view) → แดชบอร์ด", () => {
  assert.equal(landingPath(perms(ACC)), "/finance/queue");
  assert.equal(landingPath(perms(["finance:view"])), "/finance");
  assert.equal(landingPath(perms(["jobs:view", "finance:view"])), "/dashboard");
});

test("เมนูการเงิน: ACC เห็นคิว/สถานะ/ประวัติ · Admin ไม่เห็นคิว (ไม่มีสิทธิ์ตรวจ) · Sale/ช่างไม่เห็นกลุ่มการเงิน", () => {
  const groups = navGroups({ chat: true, serviceQueue: true, techQueue: true });
  const hrefs = (list: string[], role: string) => visibleGroups(groups, perms(list), role).flatMap((g) => g.links.map((l) => l.href));
  const acc = hrefs(ACC, "acc");
  for (const h of ["/finance/queue", "/finance", "/finance/audit", "/quotations"]) assert.ok(acc.includes(h), h);
  assert.ok(!acc.includes("/jobs"));
  const adm = hrefs(ADMIN_FIN, "admin");
  assert.ok(adm.includes("/finance") && !adm.includes("/finance/queue"));
  for (const role of ["sales", "tech"]) {
    const h = hrefs(["jobs:view", "pm:view"], role);
    assert.ok(!h.some((x) => x.startsWith("/finance")), role);
  }
});

test("ใบเสนอราคา 4.1: ไม่มีเส้นทางใหม่เข้า EXPIRED · ปฏิเสธแล้วส่งซ้ำไม่ได้ · แก้หลังส่ง = Revision", () => {
  for (const tos of Object.values(quotationTransitions)) assert.ok(!tos.includes("EXPIRED"));
  assert.deepEqual(quotationTransitions.REJECTED, ["CANCELLED"]);
  assert.equal(quotationEditable("ACCEPTED"), true);
  assert.equal(quotationEditable("CANCELLED"), false);
  assert.equal(quotationEditCreatesRevision("ACCEPTED"), true);
  assert.equal(quotationEditCreatesRevision("DRAFT"), false);
  assert.equal(quotationStatusNeedsInput("ACCEPTED"), "approval");
  assert.equal(quotationStatusNeedsInput("CANCELLED"), "reason");
  assert.equal(quotationStatusNeedsInput("SENT"), null);
  const be = path.resolve(import.meta.dirname, "../../woms-backend/src/domain/quotation.ts");
  if (fs.existsSync(be)) {
    const src = fs.readFileSync(be, "utf8");
    const block = src.slice(src.indexOf("export const QUOTATION_TRANSITIONS"), src.indexOf("};", src.indexOf("export const QUOTATION_TRANSITIONS")));
    for (const [from, tos] of Object.entries(quotationTransitions)) {
      const m = new RegExp(`${from}: \\[([^\\]]*)\\]`).exec(block);
      assert.ok(m, from);
      assert.deepEqual([...m![1].matchAll(/"([A-Z]+)"/g)].map((x) => x[1]), tos, from);
    }
  }
});
