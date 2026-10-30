/** Round 3 (คิวงาน) — D-05 / D-12 / D-15 / D-19 / D-21 กติกาฝั่งหน้าจอ (ฟังก์ชันบริสุทธิ์) */
import test from "node:test";
import assert from "node:assert/strict";
import { parseJobText } from "../src/lib/jobTextParser.ts";
import {
  bangkokTodayISO,
  identifiesMachine,
  isPastBangkokDate,
  machineIdentLabels,
  placeText,
  pmSelectionError,
  queueButtons,
  queueFillFromPaste,
  queueFormIssues,
  queueNoLabel,
  shouldBlockEnter,
} from "../src/lib/serviceQueueRules.ts";

const EMPTY = {
  jobType: "",
  jobSubType: "",
  customerType: "",
  jobName: "",
  customerId: "",
  siteId: "",
  address: "",
  contactName: "",
  phone: "",
  mapLink: "",
  note: "",
  preferredDate: "",
  preferredTime: "",
  ownerSaleId: "",
  items: [] as any[],
};
const FULL = {
  ...EMPTY,
  jobType: "CM",
  jobName: "ร้านทดสอบ",
  contactName: "คุณเอ",
  phone: "0810000000",
  address: "1 ถนนทดสอบ",
  items: [{ machineType: "", model: "FZ-200", serial: "", note: "" }],
};

// ---------------------------------------------------------------------------
test("D-05 queueFormIssues: ครบ → ไม่มีปัญหา · สาขาแทนที่อยู่ได้ · ชื่อลูกค้าแทนชื่อร้านได้", () => {
  assert.deepEqual(queueFormIssues(FULL), []);
  assert.deepEqual(queueFormIssues({ ...FULL, address: "", siteId: "S1" }), []);
  assert.deepEqual(queueFormIssues({ ...FULL, jobName: "", customerName: "บริษัท" }), []);
  assert.deepEqual(queueFormIssues({ ...FULL, items: [{ machineType: "", model: "", serial: "", note: "", equipmentId: "E1" }] }), []);
});

test("D-05 queueFormIssues: ขาดแต่ละช่อง → field ตรงช่อง", () => {
  const field = (patch: Record<string, unknown>) => queueFormIssues({ ...FULL, ...patch } as any).map((i) => i.field);
  assert.deepEqual(field({ jobType: "" }), ["jobType"]);
  assert.deepEqual(field({ jobType: "INSTALL" }), ["jobType"]);
  assert.deepEqual(field({ jobType: "REMOVE", jobSubType: "" }), ["jobSubType"]);
  assert.deepEqual(field({ jobName: "" }), ["jobName"]);
  assert.deepEqual(field({ contactName: "  " }), ["contactName"]);
  assert.deepEqual(field({ phone: "" }), ["phone"]);
  assert.deepEqual(field({ address: "", siteId: "" }), ["address"]);
  assert.deepEqual(field({ items: [] }), ["items"]);
  // หมายเหตุอย่างเดียวไม่นับเป็นเครื่อง · SN อย่างเดียวไม่นับ (ต้องมีรุ่น/ประเภท/เครื่องในคลัง)
  assert.deepEqual(field({ items: [{ machineType: "", model: "", serial: "", note: "เครื่องหน้าร้าน" }] }), ["items"]);
  assert.deepEqual(field({ jobType: "OTHER", note: "" }), ["note"]);
  assert.deepEqual(field({ jobType: "OTHER", note: "ตรวจหน้างาน" }), []);
});

test("D-05 queueFormIssues: ข้อมูลผิดรูปแบบ/ว่างทั้งหมดไม่ทำให้ล้ม", () => {
  assert.deepEqual(
    queueFormIssues({}).map((i) => i.field),
    ["jobType", "jobName", "contactName", "phone", "address", "items"]
  );
  assert.deepEqual(queueFormIssues({ ...FULL, items: null as any }).map((i) => i.field), ["items"]);
  assert.deepEqual(queueFormIssues({ ...FULL, items: [null, undefined] as any }).map((i) => i.field), ["items"]);
  assert.equal(identifiesMachine({ model: "  " }), false);
  assert.equal(identifiesMachine({ machineType: "ตู้แช่" }), true);
});

test("D-05 shouldBlockEnter: Enter ใน input ไม่ส่งฟอร์ม · textarea/ปุ่ม/ปุ่มอื่นไม่ถูกบล็อก", () => {
  assert.equal(shouldBlockEnter("Enter", "INPUT"), true);
  assert.equal(shouldBlockEnter("Enter", "input"), true);
  assert.equal(shouldBlockEnter("Enter", "TEXTAREA"), false);
  assert.equal(shouldBlockEnter("Enter", "BUTTON"), false);
  assert.equal(shouldBlockEnter("a", "INPUT"), false);
  assert.equal(shouldBlockEnter("Enter", undefined), false);
});

test("D-05 queueNoLabel / queueButtons: ร่างไม่มีเลขคิวจริงและไม่มีปุ่มขั้นตอนคิว", () => {
  assert.equal(queueNoLabel({ status: "DRAFT", queueNo: "DRAFT-abc" }), "ร่างคิว (ยังไม่มีเลขคิว)");
  assert.equal(queueNoLabel({ status: "WAIT_ASSIGN", queueNo: "Q-2026-0001" }), "Q-2026-0001");
  const admin = { id: "a", has: () => true };
  assert.deepEqual(queueButtons({ status: "DRAFT", mode: "NEW", ownerSaleId: "a", techId: "", jobId: "" }, admin), []);
});

// ---------------------------------------------------------------------------
const LINE = `ประเภทงาน: CM
ชื่อร้าน:
I2228-บริษัท ดีลิคัพ จำกัด
ทีมช่าง: ช่างอาท
เซลล์: VP
ตู้เย็น : HRW-147LS4
SN:5198210500597, 5198210500598
วันที่: 25/9/69
เวลา : 11.00 น.
ติดต่อ: คุณนา
เบอร์: 092 279 9656
โลเคชั่น:https://share.google/DQAhnM4KwGXYqki6b
หมายเหตุ: ลูกค้าไม่ได้ซื้อเครื่องกับทางเรา`;

test("D-05 วางข้อความ LINE → ชื่อร้าน ผู้ติดต่อ เบอร์ Map · SN ละหนึ่งเครื่อง · ช่องที่ไม่มีในฟอร์มต่อท้ายหมายเหตุ", () => {
  const { values, filled } = queueFillFromPaste(parseJobText(LINE), { ...EMPTY });
  assert.equal(values.jobType, "CM");
  assert.equal(values.jobName, "I2228-บริษัท ดีลิคัพ จำกัด");
  assert.equal(values.contactName, "คุณนา");
  assert.equal(values.phone, "0922799656");
  assert.equal(values.mapLink, "https://share.google/DQAhnM4KwGXYqki6b");
  assert.deepEqual(
    values.items.map((i) => [i.model, i.serial]),
    [
      ["HRW-147LS4", "5198210500597"],
      ["HRW-147LS4", "5198210500598"],
    ]
  );
  const note = values.note.split("\n");
  assert.equal(note[0], "ลูกค้าไม่ได้ซื้อเครื่องกับทางเรา");
  assert.ok(note.includes("วันที่ลูกค้าแจ้ง: 2026-09-25"));
  assert.ok(note.includes("เวลาที่ลูกค้าแจ้ง: 11:00"));
  assert.ok(note.includes("ทีมช่าง: ช่างอาท"));
  assert.ok(note.includes("เซลล์: VP"));
  assert.ok(note.includes("รหัสลูกค้า: I2228"));
  assert.ok(filled.includes("เครื่อง 2 รายการ"));
  // ผลลัพธ์ยังต้องกรอกที่อยู่/สาขาเองก่อนส่งคิว
  assert.deepEqual(queueFormIssues(values).map((i) => i.field), ["address"]);
});

test("D-05 วางข้อความ: ไม่ทับช่องที่กรอกแล้ว · SN ที่มีอยู่แล้วไม่เพิ่มซ้ำ · วางซ้ำหมายเหตุไม่ซ้ำ", () => {
  const current = { ...FULL, items: [{ machineType: "", model: "HRW-147LS4", serial: "5198210500597", note: "" }], note: "เดิม" };
  const once = queueFillFromPaste(parseJobText(LINE), current).values;
  assert.equal(once.jobType, "CM");
  assert.equal(once.jobName, "ร้านทดสอบ");
  assert.equal(once.contactName, "คุณเอ");
  assert.equal(once.phone, "0810000000");
  assert.deepEqual(once.items.map((i) => i.serial), ["5198210500597", "5198210500598"]);
  assert.ok(once.note.startsWith("เดิม\n"));
  // ประเภทงานในฟอร์มเลือกไว้แล้ว → ข้อความประเภทงานไปอยู่ในหมายเหตุ
  assert.ok(once.note.includes("ประเภทงาน (จากข้อความ): CM"));
  const twice = queueFillFromPaste(parseJobText(LINE), once).values;
  assert.equal(twice.note, once.note);
  assert.equal(twice.items.length, 2);
});

test("D-05 วางข้อความ: รุ่นไม่มี SN = หนึ่งเครื่อง · ประเภทงานไม่ชัด/งานซ่อมถอนไม่เลือกให้", () => {
  const p = parseJobText("ประเภทงาน: คอนเฟิร์มจัดส่งและติดตั้ง\nร้าน: ร้านเอ\nรุ่น: IM-35M-2-LM\nเครื่องกรองน้ำ: 3 ขั้นตอน");
  const { values } = queueFillFromPaste(p, { ...EMPTY });
  assert.equal(values.jobType, "");
  assert.deepEqual(values.items.map((i) => [i.model, i.serial]), [["IM-35M-2-LM", ""]]);
  assert.ok(values.note.includes("ประเภทงาน (จากข้อความ): คอนเฟิร์มจัดส่งและติดตั้ง"));
  assert.ok(values.note.includes("เครื่องกรองน้ำ: 3 ขั้นตอน"));
  const removeType = queueFillFromPaste({ jobType: "REMOVE", jobTypeRaw: "ถอน" }, { ...EMPTY }).values;
  assert.equal(removeType.jobType, "");
});

test("D-05 วางข้อความผิดรูปแบบ/ว่าง: ไม่ล้ม ไม่เปลี่ยนฟอร์ม", () => {
  const blank = queueFillFromPaste(parseJobText(""), { ...FULL });
  assert.deepEqual(blank.values.items, FULL.items);
  assert.equal(blank.values.jobName, FULL.jobName);
  const junk = queueFillFromPaste(parseJobText(":::\n----------\n???"), { ...EMPTY });
  assert.equal(junk.values.items.length, 0);
  assert.equal(queueFillFromPaste(null, { ...FULL }).filled.length, 0);
  // ค่าแปลกในผลแยก (ไม่ใช่ข้อความ) ถูกข้าม
  const odd = queueFillFromPaste({ serials: [null as any, "", "  "], phone: undefined, mapLink: "ไม่ใช่ลิงก์" }, { ...EMPTY });
  assert.equal(odd.values.items.length, 0);
  assert.equal(odd.values.mapLink, "");
  assert.equal(odd.values.address, "ไม่ใช่ลิงก์");
});

// ---------------------------------------------------------------------------
test("D-15 placeText: ตำบล · อำเภอ · จังหวัด ข้ามค่าว่างและส่วนที่อยู่ในที่อยู่แล้ว", () => {
  assert.equal(placeText("5 ถนนทดสอบ", ["สุริยวงศ์", "บางรัก", "กรุงเทพฯ"]), "5 ถนนทดสอบ · สุริยวงศ์ · บางรัก · กรุงเทพฯ");
  assert.equal(placeText("5 ถนนทดสอบ สุริยวงศ์ บางรัก", ["สุริยวงศ์", "บางรัก", "กรุงเทพฯ"]), "5 ถนนทดสอบ สุริยวงศ์ บางรัก · กรุงเทพฯ");
  // สาขาเดิมไม่มีตำบล
  assert.equal(placeText("9 ถนนเดิม", [undefined, "เมือง", "เชียงใหม่"]), "9 ถนนเดิม · เมือง · เชียงใหม่");
  assert.equal(placeText("", ["", null, ""]), "");
  assert.equal(placeText(undefined, ["ลาดยาว", "ลาดยาว"]), "ลาดยาว");
});

// ---------------------------------------------------------------------------
test("D-19 machineIdentLabels ตรงกับ backend", () => {
  assert.deepEqual(machineIdentLabels([{ serial: "SN0001234" }, { serial: "SN0005678" }]), ["#1 · …1234", "#2 · …5678"]);
  assert.deepEqual(machineIdentLabels([{ serial: "AB-91234" }, { serial: "AB-81234" }]), ["#1 · …91234", "#2 · …81234"]);
  assert.deepEqual(machineIdentLabels([{ serial: "" }, {}]), ["#1 · ไม่มี SN", "#2 · ไม่มี SN"]);
  assert.deepEqual(machineIdentLabels([{ serial: "SN-1234" }, { serial: "sn-1234" }]), ["#1 · SN ซ้ำ ตรวจสอบ", "#2 · SN ซ้ำ ตรวจสอบ"]);
  assert.deepEqual(machineIdentLabels([{ internalCode: "TMP-000777" }]), ["#1 · …0777"]);
});

// ---------------------------------------------------------------------------
test("D-21 bangkokTodayISO / isPastBangkokDate: ขอบวันตามเวลาไทย", () => {
  // 00:30 น. (+07) วันที่ 10 = UTC ยังวันที่ 9 แต่วันนี้ของไทยคือวันที่ 10
  const early = new Date("2026-11-10T00:30:00+07:00");
  assert.equal(bangkokTodayISO(early), "2026-11-10");
  assert.equal(isPastBangkokDate("2026-11-10", early), false);
  assert.equal(isPastBangkokDate("2026-11-09", early), true);
  const late = new Date("2026-11-09T23:59:00+07:00");
  assert.equal(bangkokTodayISO(late), "2026-11-09");
  assert.equal(isPastBangkokDate("2026-11-09", late), false);
  assert.equal(isPastBangkokDate("2026-11-08", late), true);
  assert.equal(isPastBangkokDate("", late), false);
});

// ---------------------------------------------------------------------------
test("D-12 pmSelectionError: สาขาเดียวกันผ่าน · ต่างสาขา/ไม่มีสาขา/ต่างตาราง ไม่ผ่าน", () => {
  assert.equal(pmSelectionError([]), null);
  assert.equal(pmSelectionError([{ siteId: "" }]), null);
  assert.equal(pmSelectionError([{ siteId: "S1", planId: "P" }, { siteId: "S1", planId: "P" }]), null);
  assert.match(pmSelectionError([{ siteId: "S1", planId: "P" }, { siteId: "S2", planId: "P" }]) ?? "", /สาขาเดียวกัน/);
  assert.match(pmSelectionError([{ siteId: "S1", planId: "P" }, { siteId: "", planId: "P" }]) ?? "", /ต้องระบุสาขา/);
  assert.match(pmSelectionError([{ siteId: "S1", planId: "P" }, { siteId: "S1", planId: "Q" }]) ?? "", /ตาราง PM เดียวกัน/);
});
