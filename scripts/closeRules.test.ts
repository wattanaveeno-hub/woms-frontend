/** ปิดงาน VFB 28/9/69 แถว 7–9 — กติกาฝั่งหน้าเว็บ (เซิร์ฟเวอร์ตรวจซ้ำเสมอ) */
import test from "node:test";
import assert from "node:assert/strict";
import { closeReasons, lineHasSnEvidence, lineIsDone } from "../src/lib/closeRules.ts";

test("แถว 9: เสร็จ = DONE เท่านั้น (ค่าสำรอง PARTIAL/SKIPPED ไม่นับ)", () => {
  assert.equal(lineIsDone({ result: "DONE" }), true);
  for (const r of ["", undefined, "PARTIAL", "FAILED", "SKIPPED"]) assert.equal(lineIsDone({ result: r as any }), false, String(r));
});

test("แถว 7: ส่วน SN ครบเมื่อมีรูป SN หรือเลขใบส่งสินค้า/IV · เลขว่างไม่นับ", () => {
  assert.equal(lineHasSnEvidence({ snPhotos: ["x"] }), true);
  assert.equal(lineHasSnEvidence({ snPhotos: [], noSnRef: { docNo: "DN-1" } }), true);
  assert.equal(lineHasSnEvidence({ snPhotos: [], noSnRef: { docNo: "  " } }), false);
  assert.equal(lineHasSnEvidence({}), false);
});

test("เหตุผลที่ยังปิดไม่ได้ครบทุกข้อ · ครบเงื่อนไขแล้วไม่มีเหตุผล", () => {
  const r = closeReasons({ pending: ["SN-2"], missingEvidence: 1, hasSignature: false });
  assert.equal(r.length, 3);
  assert.match(r.join(" "), /SN-2/);
  assert.match(r.join(" "), /ลายเซ็นตรวจรับ/);
  assert.deepEqual(closeReasons({ pending: [], missingEvidence: 0, hasSignature: true }), []);
});
