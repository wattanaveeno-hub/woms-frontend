// CF v1.1 รอบ 7 · Q-R6-06 กดผลค้นหาแชทไปข้อความต้นทางที่ยังไม่โหลด
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAround, jumpErrorMessage, planJump } from "../src/lib/chatJump.ts";

const m = (id: string, t: string) => ({ messageId: id, createdAt: t });
const cmp = (a: any, b: any) => a.createdAt.localeCompare(b.createdAt) || a.messageId.localeCompare(b.messageId);

test("CJ-1 โหลดอยู่แล้ว = SCROLL · ยังไม่โหลด = FETCH (ไม่ใช่แค่ scroll)", () => {
  assert.equal(planJump(["a", "b"], "b"), "SCROLL");
  assert.equal(planJump(["a", "b"], "z"), "FETCH");
});
test("CJ-2 gap=false: รวมกับรายการเดิมเรียงตามเวลา ไม่ซ้ำ · ไม่เข้าโหมดประวัติ · cursor ก่อนหน้าใหม่", () => {
  const prev = [m("p1", "2026-10-01"), m("p2", "2026-10-02")];
  const r = applyAround(prev, { messages: [m("o1", "2026-01-01"), m("o2", "2026-01-02")], gap: false, targetId: "o2", cursor: { before: "2026-01-01|o1", hasMore: true } }, cmp);
  assert.deepEqual(r.messages.map((x) => x.messageId), ["o1", "o2", "p1", "p2"]);
  assert.equal(r.historyMode, false);
  assert.equal(r.olderCursor, "2026-01-01|o1");
  assert.equal(r.hasOlder, true);
});
test("CJ-3 gap=true: แทนด้วยช่วงที่ได้ + โหมดดูประวัติ (ไม่ต่อข้อความใหม่ท้ายช่วงเก่า)", () => {
  const r = applyAround([m("p1", "2026-10-01")], { messages: [m("o2", "2026-01-02"), m("o1", "2026-01-01")], gap: true, targetId: "o2", cursor: { before: null, hasMore: false } }, cmp);
  assert.deepEqual(r.messages.map((x) => x.messageId), ["o1", "o2"]);
  assert.equal(r.historyMode, true);
});
test("CJ-4 ข้อความ error: ยกเลิก 410 · หมดสิทธิ์ 403 · ไม่พบ 404", () => {
  assert.match(jumpErrorMessage(410), /ยกเลิก/);
  assert.match(jumpErrorMessage(403), /สิทธิ์/);
  assert.match(jumpErrorMessage(404), /ไม่พบ/);
});
