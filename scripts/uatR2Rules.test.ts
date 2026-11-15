import { test } from "node:test";
import assert from "node:assert/strict";
import { holdKindOf, holdLabelOf, holdReasonText } from "../src/lib/holdKind.ts";

test("UAT2-14: ใบงานเลื่อนวันเข้า (backend ใส่ 'รอเช็คคิวใหม่:') แยกจากพักงาน", () => {
  const r = { status: "HOLD", holdReason: "รอเช็คคิวใหม่: ลูกค้าขอเลื่อนเป็นสัปดาห์หน้า" };
  assert.equal(holdKindOf(r), "RESCHEDULE");
  assert.equal(holdLabelOf(r), "เลื่อนวันเข้า · รอเช็คคิวใหม่");
  assert.equal(holdReasonText(r), "ลูกค้าขอเลื่อนเป็นสัปดาห์หน้า");
});

test("UAT2-14: พักงานปกติยังเป็นพักงาน · ใบงานไม่ HOLD ไม่มีป้าย", () => {
  assert.equal(holdKindOf({ status: "HOLD", holdReason: "รออะไหล่" }), "HOLD");
  assert.equal(holdLabelOf({ status: "HOLD", holdReason: "" }), "พักงาน");
  assert.equal(holdKindOf({ status: "OPEN", holdReason: "รอเช็คคิวใหม่: x" }), null);
  assert.equal(holdReasonText({ holdReason: "รออะไหล่" }), "รออะไหล่");
});

import { jnLabel } from "../src/lib/serviceQueueRules.ts";
test("UAT2-13: ป้าย JN ไม่ซ้ำคำนำหน้า · ยังไม่ออก JN", () => {
  assert.equal(jnLabel("JN-2026-0006"), "JN-2026-0006");
  assert.equal(jnLabel("6911-001"), "JN 6911-001");
  assert.equal(jnLabel(""), "ยังไม่ออก JN");
});
