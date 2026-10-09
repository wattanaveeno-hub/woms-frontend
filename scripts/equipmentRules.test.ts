/** Audit A — กติกาหน้าเครื่อง: D-02 วางข้อความเพิ่มเครื่อง · D-03 การ์ด PM · D-13 แจ้งเตือน PM */
import test from "node:test";
import assert from "node:assert/strict";
import { parseJobText } from "../src/lib/jobTextParser.ts";
import {
  alertSortValue,
  equipmentFromParsed,
  parseLatLng,
  pmNeedsAlert,
  pmPlanRows,
  pmPlanSummary,
  splitInlineHeadings,
} from "../src/lib/equipmentRules.ts";

const fromText = (t: string) => equipmentFromParsed(parseJobText(splitInlineHeadings(t)));

test("D-02 ตัวอย่าง VFB บรรทัดเดียวคั่นด้วย / → รุ่น · เครื่องกรอง · SN", () => {
  const r = fromText("รุ่น: KM-40C / เครื่องกรองน้ำ: 3 ขั้นตอน / SN:5198210500597");
  assert.equal(r.model, "KM-40C");
  assert.equal(r.filterUnit, "3 ขั้นตอน");
  assert.equal(r.serial, "5198210500597");
  assert.deepEqual(r.extraSerials, []);
});

test("D-02 ข้อความหลายบรรทัด: ลูกค้า/ติดต่อ/เบอร์ไปหมายเหตุ · ลิงก์มีพิกัด → lat/lng", () => {
  const r = fromText(
    [
      "ร้าน: I2228-บริษัท ดีลิคัพ จำกัด",
      "รุ่น: IM-35M-2-LM",
      "SN: 5198210500597",
      "ติดต่อ: คุณนา",
      "เบอร์: 092 279 9656",
      "โลเคชั่น: https://www.google.com/maps?q=13.7,100.5",
    ].join("\n")
  );
  assert.equal(r.customerCode, "I2228");
  assert.equal(r.lat, 13.7);
  assert.equal(r.lng, 100.5);
  assert.match(r.note, /ติดต่อ: คุณนา/);
  assert.match(r.note, /เบอร์: 0922799656/);
});

test("D-02 ลิงก์ย่อไม่มีพิกัด → ไม่เดาพิกัด เก็บลิงก์ไว้ในหมายเหตุ + คำเตือน", () => {
  const r = fromText("รุ่น: SRM-45A\nโลเคชั่น: https://maps.app.goo.gl/3LF1LRPJ8b997DRHA");
  assert.equal(r.lat, 0);
  assert.equal(r.lng, 0);
  assert.match(r.note, /maps\.app\.goo\.gl/);
  assert.ok(r.warnings.some((w) => w.includes("ไม่มีพิกัด")));
});

test("D-02 วันที่ 25/9/69 ไม่ถูกแยกเป็นหัวข้อ", () => {
  assert.equal(splitInlineHeadings("วันที่: 25/9/69"), "วันที่: 25/9/69");
});

test("D-02 หลาย SN → ใส่ตัวแรก ที่เหลือแจ้งเตือน", () => {
  const r = fromText("SN: AAAA1111, BBBB2222");
  assert.equal(r.serial, "AAAA1111");
  assert.deepEqual(r.extraSerials, ["BBBB2222"]);
});

test("parseLatLng รูปแบบ @lat,lng และ !3d!4d", () => {
  assert.deepEqual(parseLatLng("https://www.google.com/maps/@13.75,100.49,15z"), { lat: 13.75, lng: 100.49 });
  assert.deepEqual(parseLatLng("x!3d13.1!4d100.2"), { lat: 13.1, lng: 100.2 });
  assert.equal(parseLatLng("https://maps.app.goo.gl/abc"), null);
});

test("D-03 การ์ด PM แบบ Package: 4 รอบ เหลือ 3", () => {
  const e = { pmMode: "PACKAGE" as const, pmPackageRoundsTotal: 4, pmPackageRemaining: 3, pmIntervalMonths: 3 };
  assert.equal(pmPlanSummary(e), "Package · 4 รอบ · เหลือ 3");
  assert.deepEqual(pmPlanRows(e), [
    ["ประเภท PM", "Package"],
    ["จำนวนรอบ", "4 รอบ"],
    ["รอบคงเหลือ", "3 รอบ"],
    ["รอบ PM", "ทุก 3 เดือน"],
  ]);
});

test("D-03 การ์ด PM แบบเช่า แสดงระยะสัญญา (ปี) · ไม่แสดงจำนวนรอบ", () => {
  const rows = pmPlanRows({ pmMode: "RENTAL", pmRentalYears: 2, pmIntervalMonths: 6 });
  assert.deepEqual(rows.map((r) => r[0]), ["ประเภท PM", "ระยะสัญญา (ปี)", "รอบ PM"]);
  assert.equal(rows[1][1], "2 ปี");
});

test("D-13 แจ้งเตือน PM เฉพาะ DUE_SOON / OVERDUE และเรียงตามความเร่ง", () => {
  assert.equal(pmNeedsAlert("DUE_SOON"), true);
  assert.equal(pmNeedsAlert("OVERDUE"), true);
  assert.equal(pmNeedsAlert("ON_SCHEDULE"), false);
  assert.equal(pmNeedsAlert("NOT_CONFIGURED"), false);
  assert.ok(alertSortValue({ pmStatus: "OVERDUE" }) > alertSortValue({ pmStatus: "DUE_SOON" }));
  assert.ok(alertSortValue({ pmStatus: "DUE_SOON" }) > alertSortValue({ needsSerial: true }));
  assert.equal(alertSortValue({}), 0);
});

import { partnerBack, partnerBackFrom, withFrom } from "../src/lib/partnerNav.ts";

test("D-21 ย้อนกลับจากหน้าลูกค้า: มาจากฐานข้อมูลลูกค้า → /customers · มาจากคู่ค้า → /partners", () => {
  assert.deepEqual(partnerBack("CUSTOMER", "customers"), { href: "/customers", label: "ฐานข้อมูลลูกค้า" });
  assert.deepEqual(partnerBack("CUSTOMER", "partners"), { href: "/partners", label: "รายการคู่ค้า" });
  assert.equal(partnerBack("SUPPLIER", "").href, "/partners");
  assert.equal(partnerBack("BOTH", "").href, "/customers");
  assert.equal(partnerBack(undefined, "").href, "/partners");
  assert.equal(partnerBackFrom("?from=customers"), "customers");
  assert.equal(partnerBackFrom("?from=evil"), "");
  assert.equal(withFrom("/partners/abc", "customers"), "/partners/abc?from=customers");
  assert.equal(withFrom("/partners/abc", ""), "/partners/abc");
});
