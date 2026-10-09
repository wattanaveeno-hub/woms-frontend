/** Dashboard สรุปผล — กติกาแสดงผลที่ไม่ขึ้นกับ React */
import test from "node:test";
import assert from "node:assert/strict";
import {
  createLatestGuard,
  dateRangeError,
  stockValuationStatus,
  summaryQuery,
  valuationMessage,
} from "../src/lib/dashboardRules.ts";

test("มูลค่าสต๊อก: แยกสถานะ 4 แบบ และไม่แทนด้วย 0", () => {
  assert.equal(stockValuationStatus({ valuationMethod: "", totalValue: null }), "METHOD_UNSET");
  assert.equal(stockValuationStatus({ valuationMethod: "STANDARD", totalValue: null }), "COST_INCOMPLETE");
  assert.equal(stockValuationStatus({ valuationMethod: "STANDARD", totalValue: 0 }), "OK");
  assert.equal(stockValuationStatus({ valuationMethod: "STANDARD", valuationStatus: "ERROR", totalValue: null }), "ERROR");
  assert.equal(valuationMessage("OK", true), null);
});

test("ยังไม่ได้เลือกวิธี: ผู้ดูแลเห็นลิงก์ตั้งค่า ผู้ใช้ทั่วไปเห็นข้อความให้ติดต่อผู้ดูแล", () => {
  const admin = valuationMessage("METHOD_UNSET", true)!;
  const user = valuationMessage("METHOD_UNSET", false)!;
  assert.equal(admin.settingsLink, true);
  assert.equal(user.settingsLink, false);
  assert.equal(user.text, "ยังไม่ได้กำหนดวิธีคิดมูลค่าสต๊อก กรุณาติดต่อผู้ดูแลระบบ");
  for (const m of [admin, user, valuationMessage("COST_INCOMPLETE", true, 3)!, valuationMessage("ERROR", true)!]) {
    assert.doesNotMatch(m.text, /Requirement|ระบบเดิม/);
  }
  assert.match(valuationMessage("COST_INCOMPLETE", false, 3)!.text, /3 รายการ/);
});

test("ช่วงวันที่: วันเริ่มมากกว่าวันสิ้นสุดถูกปฏิเสธ วันเดียวกันใช้ได้", () => {
  assert.equal(dateRangeError("2026-10-01", "2026-09-01"), "วันที่เริ่มต้องไม่มากกว่าวันที่สิ้นสุด");
  assert.equal(dateRangeError("2026-09-30", "2026-09-30"), "");
  assert.equal(dateRangeError("", "2026-09-30"), "");
});

test("query ของสรุปและ Export ใช้ชุดเดียวกัน และข้ามค่าว่าง", () => {
  assert.equal(summaryQuery({}), "");
  assert.equal(
    summaryQuery({ from: "2026-09-01", to: "2026-09-30", jobType: "PM", team: "", technicianId: "u1" }),
    "?from=2026-09-01&to=2026-09-30&jobType=PM&technicianId=u1"
  );
});

test("ผลลัพธ์เก่าที่กลับมาทีหลังต้องไม่ทับผลของตัวกรองล่าสุด", () => {
  const g = createLatestGuard();
  const first = g.next();
  const second = g.next();
  assert.equal(g.isLatest(first), false);
  assert.equal(g.isLatest(second), true);
});
