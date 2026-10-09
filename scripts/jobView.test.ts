/** Gap closure (agent B) — D-01 / D-03 / D-05 / D-16 ตรรกะหน้าใบงาน */
import test from "node:test";
import assert from "node:assert/strict";
import { customerCardFields, JOB_FORM_KEYS, legacyMachineShown, pasteExtraNote, pickJobFormValues } from "../src/lib/jobView.ts";

test("D-05 pickJobFormValues: ส่งเฉพาะฟิลด์ของฟอร์ม — ตัดฟิลด์ระบบของใบงานทิ้ง", () => {
  const job = {
    jobId: "JN-2026-0001",
    jobType: "CM",
    jobName: "ซ่อม",
    technicianTeam: "ทีม 1",
    jobDate: "2026-10-20",
    jobTime: "09:00",
    note: "",
    technicianIds: ["u1"],
    installAddress: "ที่อยู่",
    equipmentCount: 3,
    branchNo: "00",
    queueId: "q1",
    queueNo: "Q-1",
    submissionKey: "k",
    acknowledgedAt: "x",
    financeNote: "y",
    customerName: "snapshot",
    updatedAt: "t",
    status: "OPEN",
    photos: [],
  };
  const v = pickJobFormValues(job) as Record<string, unknown>;
  for (const k of ["jobId", "equipmentCount", "branchNo", "queueId", "queueNo", "submissionKey", "acknowledgedAt", "financeNote", "customerName", "updatedAt", "status", "photos"]) {
    assert.equal(k in v, false, k);
  }
  assert.deepEqual(v, {
    jobType: "CM",
    jobName: "ซ่อม",
    technicianTeam: "ทีม 1",
    jobDate: "2026-10-20",
    jobTime: "09:00",
    note: "",
    technicianIds: ["u1"],
    installAddress: "ที่อยู่",
  });
  assert.equal(JOB_FORM_KEYS.length, 18);
});

test("D-03 customerCardFields: snapshot ในใบงานมาก่อน · ค่าสดเป็น fallback · ช่างที่โหลด partner/site ไม่ได้ยังเห็นข้อมูล", () => {
  const job = { customerCode: "C-001", customerName: "บริษัทเดิม", storeName: "ร้านเดิม", branchNo: "00", installAddress: "ที่อยู่ใบงาน", siteLat: 13.7, siteLng: 100.5 };
  // ช่าง: ไม่มี partner/site
  assert.deepEqual(customerCardFields(job, null, null), {
    customerCode: "C-001",
    customerName: "บริษัทเดิม",
    branchNo: "00",
    storeName: "ร้านเดิม",
    address: "ที่อยู่ใบงาน",
    lat: 13.7,
    lng: 100.5,
  });
  // master เปลี่ยนชื่อภายหลัง → ยังแสดงชื่อ ณ วันที่เปิดงาน
  const live = customerCardFields(job, { customerCode: "C-001", name: "ชื่อใหม่" }, { branchNo: "00", storeName: "ร้านใหม่", addressFull: "ที่อยู่สาขา", lat: 1, lng: 2 });
  assert.equal(live.customerName, "บริษัทเดิม");
  assert.equal(live.storeName, "ร้านเดิม");
  // ใบงานเก่าไม่มี snapshot → ใช้ค่าสด
  const old = customerCardFields({ branchNo: "" }, { customerCode: "C-9", name: "เก่า" }, { branchNo: "07", storeName: "สาขา 7", addressFull: "ที่อยู่สาขา", lat: 1, lng: 2 });
  assert.deepEqual(old, { customerCode: "C-9", customerName: "เก่า", branchNo: "07", storeName: "สาขา 7", address: "ที่อยู่สาขา", lat: 1, lng: 2 });
});

test("D-16 pasteExtraNote: ข้อความเครื่องกรองจาก LINE ไม่หาย", () => {
  assert.equal(pasteExtraNote({ filterUnit: "3 ขั้นตอน" }), "เครื่องกรอง: 3 ขั้นตอน");
  assert.equal(pasteExtraNote({ customerCode: "C1", filterUnit: "3 ขั้นตอน", note: "ฝากของ" }), "รหัสลูกค้า C1\nเครื่องกรอง: 3 ขั้นตอน\nฝากของ");
  assert.equal(pasteExtraNote({}), "");
});

test("D-01 legacyMachineShown: รุ่นอย่างเดียว (ไม่มี serial) ก็แสดง · มีแถวเครื่องแล้วไม่แสดง", () => {
  assert.equal(legacyMachineShown(0, { filterUnit: "", model: "IM-130A" }), true);
  assert.equal(legacyMachineShown(0, { filterUnit: "SN-1", model: "" }), true);
  assert.equal(legacyMachineShown(0, { filterUnit: "", model: "" }), false);
  assert.equal(legacyMachineShown(2, { filterUnit: "SN-1", model: "X" }), false);
  assert.equal(legacyMachineShown(0, null), false);
});
