/** JOB-01 / MCH-03 — แยกข้อความเปิดงานจาก LINE (ตัวอย่างจริงจาก VFB) */
import test from "node:test";
import assert from "node:assert/strict";
import { jobTypeFromText, parseJobText, thaiDateToISO, thaiTimeToHHMM } from "../src/lib/jobTextParser.ts";

const SAMPLE_1 = `ประเภทงาน : คอนเฟิร์มจัดส่งและติดตั้ง
ร้าน: โรงแรมท่าอากาศยานสุวรรณภูมิ (I2160) บริษัท โรงแรม ท่าอากาศยานสุวรรณภูมิ จำกัด 999
ทีมช่าง: ช่างอาท
เซลล์: ST
รุ่น: IM-35M-2-LM
เครื่องกรองน้ำ 3 ขั้นตอน
ติดต่อ: คุณประสงค์
เบอร์: 0931273898
วันที่: 25/9/69
เวลา: 11.00 น.
โลเคชั่น : https://maps.app.goo.gl/8QeaL4cwgfa5ZFo18
หมายเหตุ :`;

const SAMPLE_2 = `ประเภทงาน: CM
ชื่อร้าน:
I2228-บริษัท ดีลิคัพ จำกัด
ทีมช่าง:
เซลล์: VP
ตู้เย็น : HRW-147LS4
SN:5198210500597
วันที่:
เวลา :
ติดต่อ: คุณนา
เบอร์: 092 279 9656
โลเคชั่น:https://share.google/DQAhnM4KwGXYqki6b
หมายเหตุ: ลูกค้าไม่ได้ซื้อเครื่องกับทางเรา
ตรวจเช็คเสนอราคาอะไหล่`;

// ข้อความที่คัดลอกมาแล้ววรรณยุกต์หาย (เช่น จาก PDF) — หัวข้อยังต้องอ่านได้
const SAMPLE_3_NO_TONES = `I1589 บจก.ธนวรรณ เครื่องเย็น
ชื่อราน: บริษัท วังนอย เบเวอเรช จํากัด (สํานักงานใหญ)
ทีมชาง: คุณชัข
เซลล: กิ๊ฟ
รุน: SRM-200AB+B-301SA (ติดตั้งไป 21/4/69 )
เครื่องกรองนํ้า: เครื่องกรองนํ้า 3 ขั้นตอน
ติดตอ: คุณนอง
เบอร: 063-669-4894
วันที่: 5/10/69
เวลา: 9.00 น.
โลเคชั่น: https://maps.app.goo.gl/1agEaXJxnWxSn3JA6
หมายเหตุ: นํ้าแข็งผลิตไดนอย
( ลูกคามีซื้อแพ็คเกจ PM เพิ่ม ระยะเวลา 1 ป เขาทุก 6 เดือน )`;

test("ตัวอย่าง 1: ติดตั้งที่ไม่บอกเช่า/ขาย → ไม่เดาประเภทงาน แต่เตือน · ช่องอื่นครบ", () => {
  const p = parseJobText(SAMPLE_1);
  assert.equal(p.jobType, "");
  assert.ok(p.warnings.some((w) => w.includes("ตีความไม่ได้ชัด")));
  assert.equal(p.customerCode, "I2160");
  assert.equal(p.technicianTeam, "ช่างอาท");
  assert.equal(p.salesPerson, "ST");
  assert.equal(p.model, "IM-35M-2-LM");
  assert.equal(p.filterUnit, "เครื่องกรองน้ำ 3 ขั้นตอน");
  assert.equal(p.contactName, "คุณประสงค์");
  assert.equal(p.phone, "0931273898");
  assert.equal(p.jobDate, "2026-09-25");
  assert.equal(p.jobTime, "11:00");
  assert.equal(p.mapLink, "https://maps.app.goo.gl/8QeaL4cwgfa5ZFo18");
  assert.equal(p.note, "");
});

test("ตัวอย่าง 2: ชื่อร้านอยู่บรรทัดถัดไป · SN · หมายเหตุหลายบรรทัด · วันที่ว่าง", () => {
  const p = parseJobText(SAMPLE_2);
  assert.equal(p.jobType, "CM");
  assert.equal(p.shopName, "I2228-บริษัท ดีลิคัพ จำกัด");
  assert.equal(p.customerCode, "I2228");
  assert.equal(p.technicianTeam, "");
  assert.equal(p.model, "HRW-147LS4");
  assert.deepEqual(p.serials, ["5198210500597"]);
  assert.equal(p.phone, "0922799656");
  assert.equal(p.mapLink, "https://share.google/DQAhnM4KwGXYqki6b");
  assert.equal(p.note, "ลูกค้าไม่ได้ซื้อเครื่องกับทางเรา\nตรวจเช็คเสนอราคาอะไหล่");
  assert.equal(p.jobDate, "");
  assert.ok(p.warnings.includes("ไม่พบวันที่นัดในข้อความ"));
});

test("ตัวอย่าง 3: ข้อความไม่มีวรรณยุกต์ยังอ่านหัวข้อได้ · รหัสลูกค้าจากบรรทัดแรก · ตัดหมายเหตุในวงเล็บของรุ่น", () => {
  const p = parseJobText(SAMPLE_3_NO_TONES);
  assert.equal(p.customerCode, "I1589");
  assert.equal(p.shopName, "บริษัท วังนอย เบเวอเรช จํากัด (สํานักงานใหญ)");
  assert.equal(p.technicianTeam, "คุณชัข");
  assert.equal(p.salesPerson, "กิ๊ฟ");
  assert.equal(p.model, "SRM-200AB+B-301SA");
  assert.equal(p.contactName, "คุณนอง");
  assert.equal(p.phone, "0636694894");
  assert.equal(p.jobDate, "2026-10-05");
  assert.equal(p.jobTime, "09:00");
  assert.match(p.note, /PM เพิ่ม/);
});

test("ประเภทงาน / วันที่ / เวลา", () => {
  assert.equal(jobTypeFromText("CM + PM"), "PM_CM");
  assert.equal(jobTypeFromText("pm"), "PM");
  assert.equal(jobTypeFromText("ติดตั้งเช่า"), "INSTALL_RENT");
  assert.equal(jobTypeFromText("ติดตั้งขาย"), "INSTALL_SALE");
  assert.equal(jobTypeFromText("ย้ายเครื่อง"), "MOVE");
  assert.equal(jobTypeFromText("เก็บเครื่อง"), "RETRIEVE");
  assert.equal(jobTypeFromText("เปลี่ยนอะไหล่"), "PART_REPLACE");
  assert.equal(jobTypeFromText("ตรวจเช็ค"), "");
  assert.equal(thaiDateToISO("25/9/69"), "2026-09-25");
  assert.equal(thaiDateToISO("1/1/2570"), "2027-01-01");
  assert.equal(thaiDateToISO("31/2/69"), "");
  assert.equal(thaiTimeToHHMM("11.00 น."), "11:00");
  assert.equal(thaiTimeToHHMM("9:30"), "09:30");
  assert.equal(thaiTimeToHHMM("25.00"), "");
});
