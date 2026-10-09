/** คิวช่าง (Chat & Queue v1) — กติกาหน้าจอ: ช่วงเวลา AT 06 และปุ่มตามบทบาท/สถานะ */
import test from "node:test";
import assert from "node:assert/strict";
import { checkFiles, queueButtons, timePeriodOf, type QueueForActions } from "../src/lib/serviceQueueRules.ts";

test("AT 06 ช่วงเวลาที่จุดรอยต่อ ตรงกับ backend", () => {
  const cases: [string, string][] = [
    ["05:00", "MORNING"], ["09:59", "MORNING"], ["10:00", "LATE_MORNING"], ["12:59", "LATE_MORNING"],
    ["13:00", "AFTERNOON"], ["16:59", "AFTERNOON"], ["17:00", "EVENING"], ["19:59", "EVENING"],
    ["20:00", "NIGHT"], ["23:59", "NIGHT"], ["04:59", "UNDEFINED"], ["00:00", "UNDEFINED"],
  ];
  for (const [t, p] of cases) assert.equal(timePeriodOf(t), p, t);
  assert.equal(timePeriodOf("04:59", true), "NIGHT");
  assert.equal(timePeriodOf("25:00"), "");
});

const perms = (...p: string[]) => (x: string) => p.includes(x);
const ADMIN = { id: "a", has: perms("svcqueue:view", "svcqueue:view_all", "svcqueue:request", "svcqueue:admin") };
const SALE_A = { id: "sa", has: perms("svcqueue:view", "svcqueue:view_all", "svcqueue:request") };
const SALE_B = { id: "sb", has: perms("svcqueue:view", "svcqueue:view_all", "svcqueue:request") };
const TECH_A = { id: "ta", has: perms("svcqueue:view", "svcqueue:respond") };
const TECH_B = { id: "tb", has: perms("svcqueue:view", "svcqueue:respond") };
const q = (patch: Partial<QueueForActions>): QueueForActions => ({ status: "WAIT_ASSIGN", mode: "NEW", ownerSaleId: "sa", techId: "", jobId: "", ...patch });

test("ปุ่มตามบทบาท: เจ้าของงานคอนเฟิร์มได้ เซลล์อื่นไม่ได้ · ช่างตอบเฉพาะคิวตนเอง", () => {
  const wc = q({ status: "WAIT_CUSTOMER", techId: "ta" });
  assert.deepEqual(queueButtons(wc, SALE_A), ["confirm", "requestNewDate"]);
  assert.deepEqual(queueButtons(wc, SALE_B), []);
  assert.ok(queueButtons(wc, ADMIN).includes("confirm"));
  const wt = q({ status: "WAIT_TECH", techId: "ta" });
  assert.deepEqual(queueButtons(wt, TECH_A), ["propose", "reject"]);
  assert.deepEqual(queueButtons(wt, TECH_B), []);
  assert.deepEqual(queueButtons(q({}), ADMIN), ["assign", "edit", "cancel"]);
});

test("เปิดงาน vs ยืนยันส่งงานเดิมกลับ · คิวที่ผูก JN ยกเลิกจากที่นี่ไม่ได้", () => {
  assert.ok(queueButtons(q({ status: "READY_TO_OPEN", techId: "ta" }), ADMIN).includes("openJob"));
  const r = queueButtons(q({ status: "READY_TO_OPEN", techId: "ta", mode: "RESCHEDULE", jobId: "JOB-1" }), ADMIN);
  assert.ok(r.includes("releaseReschedule"));
  assert.ok(!r.includes("cancel"));
  assert.deepEqual(queueButtons(q({ status: "READY_TO_OPEN", techId: "ta" }), SALE_A), []);
  assert.deepEqual(queueButtons(q({ status: "RELEASED", jobId: "JOB-1" }), ADMIN), []);
});

test("ตรวจไฟล์แนบตามนโยบาย", () => {
  const policy = { mime: ["image/png", "application/pdf"], maxFileBytes: 100, maxFiles: 2, maxTotalBytes: 150 };
  assert.equal(checkFiles([{ name: "a.png", type: "image/png", size: 50 }], policy), null);
  assert.match(checkFiles([{ name: "a.txt", type: "text/plain", size: 5 }], policy) ?? "", /ไม่รองรับ/);
  assert.match(checkFiles([{ name: "a.png", type: "image/png", size: 101 }], policy) ?? "", /ใหญ่เกิน/);
  assert.match(checkFiles([{ name: "a.png", type: "image/png", size: 80 }, { name: "b.pdf", type: "application/pdf", size: 80 }], policy) ?? "", /รวมกัน/);
});
