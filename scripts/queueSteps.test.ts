import { test } from "node:test";
import assert from "node:assert/strict";
import { queueSteps } from "../src/lib/serviceQueueRules.ts";

const base = { mode: "NEW" as const, createdAt: "2026-11-14T05:00:00Z", createdByName: "นภา" };

test("queueSteps: WAIT_CUSTOMER = 4 ขั้นเสร็จ ขั้นที่ 5 ปัจจุบัน + เวลา/ผู้ทำจาก event", () => {
  const ev = [
    { fromStatus: "", toStatus: "WAIT_ASSIGN", at: "t1", actorName: "นภา" },
    { fromStatus: "WAIT_ASSIGN", toStatus: "WAIT_TECH", at: "t2", actorName: "วรรณา" },
    { fromStatus: "WAIT_TECH", toStatus: "TECH_REPLIED", at: "t3", actorName: "สมศักดิ์" },
    { fromStatus: "TECH_REPLIED", toStatus: "WAIT_CUSTOMER", at: "t4", actorName: "วรรณา" },
  ];
  const s = queueSteps({ ...base, status: "WAIT_CUSTOMER" }, ev);
  assert.deepEqual(s.map((x) => x.state), ["done", "done", "done", "done", "cur", "todo"]);
  assert.equal(s[2].by, "สมศักดิ์");
  assert.equal(s[3].at, "t4");
  assert.equal(s[4].at, undefined);
});

test("queueSteps: CANCELLED ไม่มีขั้นปัจจุบัน · RESCHEDULE ขั้นสุดท้าย = ส่งงานเดิมกลับ · RELEASED เสร็จทุกขั้น", () => {
  assert.ok(queueSteps({ ...base, status: "CANCELLED" }, []).every((x) => x.state === "todo"));
  const r = queueSteps({ ...base, mode: "RESCHEDULE", status: "RELEASED" }, []);
  assert.equal(r[5].label, "ส่งงานเดิมกลับ");
  assert.ok(r.every((x) => x.state === "done"));
  assert.equal(r[0].by, "นภา");
});
