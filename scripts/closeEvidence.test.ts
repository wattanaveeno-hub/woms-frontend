import { test } from "node:test";
import assert from "node:assert/strict";
import { closeEvidenceItems } from "../src/lib/closeEvidence.ts";

test("closeEvidence: ใบงานเปิด — จัดกลุ่มเหตุผลจาก close-check ตามข้อความ backend · ลายเซ็น = ต้องเซ็นตอนปิดงาน", () => {
  const items = closeEvidenceItems(
    { status: "OPEN", jobType: "CM" },
    {
      canClose: false,
      machines: 2,
      done: 1,
      signatureRequired: true,
      reasons: [
        "ปิดงานไม่ได้ — หลักฐานรายเครื่องยังไม่ครบ: ET-1 ขาดรูปงานที่ทำ",
        "ปิดใบงานไม่ได้ — ยังมีเครื่องที่ยังไม่บันทึกว่าเสร็จ 1 เครื่อง: ET-2",
      ],
    }
  );
  const by = Object.fromEntries(items.map((i) => [i.key, i]));
  assert.equal(by["lines-done"].state, "missing");
  assert.equal(by["lines-done"].label, "บันทึกเสร็จทุกเครื่อง (1/2)");
  assert.equal(by["photos"].state, "missing");
  assert.match(by["photos"].detail!, /ET-1/);
  assert.equal(by["customer-signature"].state, "at-close");
  assert.equal(by["tech-signature"].state, "at-close");
  assert.equal(items.filter((i) => i.key === "other").length, 0);
});

test("closeEvidence: เหตุผลที่ไม่รู้จักแสดงตามจริง · ไม่มีเครื่อง = ไม่แสดงข้อรายเครื่อง · ปิดแล้วอ่านลายเซ็นจากใบงาน", () => {
  const open = closeEvidenceItems({ status: "HOLD" }, { canClose: false, machines: 0, done: 0, signatureRequired: true, reasons: ["ใบงานพักอยู่"] });
  assert.deepEqual(open.map((i) => i.key), ["customer-signature", "tech-signature", "other"]);
  assert.equal(open[2].label, "ใบงานพักอยู่");
  const closed = closeEvidenceItems({ status: "CLOSED", signature: "ref", closedByName: "ช่าง A" }, null);
  assert.ok(closed.every((i) => i.state === "ok"));
  const noTech = closeEvidenceItems({ status: "CLOSED", signature: "" }, null);
  assert.equal(noTech.find((i) => i.key === "customer-signature")!.state, "missing");
  assert.equal(noTech.find((i) => i.key === "tech-signature")!.state, "missing");
});
