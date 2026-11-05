// UAT-UX-01 — ข้อความ Service Margin สำหรับผู้ใช้: ไม่มีรหัสภายใน · เนื้อความ/ตัวเลขคงเดิม
import test from "node:test";
import assert from "node:assert/strict";
import { assumptionText, costBasisText, toUserText } from "../src/lib/financeText.ts";

const CODE = /CURRENT_IMPLEMENTATION_ASSUMPTION|ADV\d|\bQ-\d|MAR-\d|IDX-\d|\bD-\d|owner decision|job_equipment/;

// ข้อความจริงจาก backend (domain/equipmentFinance.ts · mongo/serviceMarginService.ts)
const BACKEND = [
  "รายรับติดตั้ง (ราคาค่าติดตั้งจาก Model Index − ส่วนลดรายเครื่อง) — ยังไม่ยืนยันราคาค่าติดตั้ง (ADV3-01)",
  "ราคาค่าติดตั้งรุ่น FZ-200 1,800 (Model Index ณ วันที่เพิ่มเครื่อง 2026-10-30) − ส่วนลดรายเครื่อง 300 บาท · ยังไม่ยืนยัน (ADV3-01)",
  "งานติดตั้งยังไม่ได้ยืนยันปิดงาน จึงยังไม่รับรู้รายรับ (Q-07)",
  "MAR-03 — Service Margin ไม่รวมราคาขายและต้นทุนซื้อเครื่อง",
  "ไม่อยู่ในสูตร MAR-01..03 และเป็นยอดทั้งใบงาน จึงไม่นำมารวมเพื่อไม่ให้นับซ้ำกับ QUO/บิลช่าง",
  "ขั้นการเงินของงานเช่าซื้อยังไม่ได้รับอนุมัติ (D-11) จึงไม่นับรายรับ",
  "ADV3-01: แหล่ง/กติกาอนุมัติราคาค่าติดตั้งยังไม่ได้รับการยืนยันจากลูกค้า",
  "เปิดเป็นงานติดตั้ง JN-2026-0024 รายรับติดตั้งใช้ MAR-01 จึงไม่นับรายการ QUO ซ้ำ",
  "ยอดคำนวณสดจากสถานะปัจจุบันของบิลและ QUO (Q-06 / Q-07)",
];
const ASSUMPTIONS = [
  'CURRENT_IMPLEMENTATION_ASSUMPTION (Q-07): "ยืนยันงานติดตั้ง" = ใบงานติดตั้งสถานะ CLOSED (Admin ยืนยันปิดงาน) · ส่วนลดรายเครื่องเป็นบาท',
  'รายรับติดตั้ง = ราคาค่าติดตั้งจาก Model Index (IDX-01/MAR-01) − ส่วนลดรายเครื่อง · รายการใหม่ใช้ราคาที่แช่แข็งตอนเพิ่มเครื่องเข้าใบงาน · รายการเดิมใช้ Model Index ปัจจุบันตามเดิม (ป้าย "ข้อมูลเดิม") · ยังไม่ยืนยันราคาค่าติดตั้ง (ADV3-01)',
  "ต้นทุนมาตรฐานใน Equipment Model Master (รวมค่าของรุ่นตัวอย่าง) เป็นค่าอ้างอิงเปรียบเทียบ — ไม่ใช่รายรับ และไม่รวมในต้นทุน/กำไร (owner decision 30 ต.ค. 2569)",
  "CURRENT_IMPLEMENTATION_ASSUMPTION (Q-08): ตัวหารค่าใช้จ่ายร่วม = จำนวนเครื่องทั้งหมดในใบงาน (job_equipment) · ปัดทีละส่วน 2 ตำแหน่ง เศษไปอยู่ที่เครื่องสุดท้าย เพื่อให้ผลรวมเท่ายอดจริง",
  "รายรับจาก QUO = qty × ราคาต่อหน่วย − ส่วนลดบรรทัด (ก่อน VAT) · ส่วนลดท้ายบิลและ VAT ไม่ถูกกระจายลงรายเครื่อง",
];

test("toUserText: ข้อความจาก backend ไม่เหลือรหัสภายใน", () => {
  for (const s of BACKEND) assert.doesNotMatch(toUserText(s), CODE, s);
});

test("toUserText: ตัวเลข วันที่ เลขใบงาน และคำเตือน 'ยังไม่ยืนยัน' คงอยู่", () => {
  const t = toUserText(BACKEND[1]);
  for (const k of ["1,800", "300", "2026-10-30", "ยังไม่ยืนยัน", "ส่วนลดรายเครื่อง"]) assert.ok(t.includes(k), `${k} หายจาก: ${t}`);
  assert.ok(toUserText(BACKEND[7]).includes("JN-2026-0024"));
  assert.equal(toUserText(BACKEND[0]), "รายรับติดตั้ง (ราคาค่าติดตั้งจาก Model Index − ส่วนลดรายเครื่อง) — ยังไม่ยืนยันราคาค่าติดตั้ง");
  assert.equal(toUserText(BACKEND[3]), "Service Margin ไม่รวมราคาขายและต้นทุนซื้อเครื่อง");
  assert.equal(toUserText(BACKEND[6]), "แหล่ง/กติกาอนุมัติราคาค่าติดตั้งยังไม่ได้รับการยืนยันจากลูกค้า");
});

test("toUserText: ข้อความที่ไม่มีรหัส ไม่ถูกแก้", () => {
  for (const s of ["ค่าบริการ JN-2026-0024 · สถานะ พักรอข้อมูล", "ค่าใช้จ่ายร่วม JN-2026-0024 50 บาท ÷ 2 เครื่อง", "(ไม่ได้คิดเป็น 0)", ""]) assert.equal(toUserText(s), s);
  assert.equal(toUserText(undefined), "");
});

test("assumptionText: สมมติฐานทั้ง 5 ข้อเป็นภาษาผู้ใช้ ไม่มีรหัส", () => {
  for (const a of ASSUMPTIONS) {
    const t = assumptionText(a);
    assert.doesNotMatch(t, CODE, t);
    assert.ok(t.length > 20);
  }
  assert.match(assumptionText(ASSUMPTIONS[3]), /หารเท่ากันตามจำนวนเครื่องในใบงาน/);
});

test("costBasisText: ใช้สถานะจาก backend เป็นชื่อไทย · ระบุยอดรอและบิลยกเลิก", () => {
  const t = costBasisText(["APPROVED", "PRINTED", "PAYMENT_PENDING", "PAID"]);
  assert.equal(t, "ระบบนับรายจ่ายเมื่อบิลช่างได้รับการอนุมัติแล้ว (อนุมัติแล้ว / พิมพ์แล้ว / รอจ่าย / จ่ายแล้ว) · บิลที่ยังไม่อนุมัติแสดงเป็นยอดรอ · บิลที่ยกเลิกไม่นับ");
  assert.match(costBasisText(["APPROVED", "NEW_STATUS"]), /NEW_STATUS/); // สถานะใหม่ที่ยังไม่มีชื่อไทย ไม่หายไปเงียบ ๆ
});
