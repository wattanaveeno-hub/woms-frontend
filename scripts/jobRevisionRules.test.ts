/** Slice job — Q-R3-13 แก้ไขหลังปิดงาน / ลงนามใหม่ · Q-R3-03 ใบงานที่ยกเลิก (ตรรกะหน้าเว็บ) */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRevisionChanges,
  canDecideRevision,
  canRequestRevision,
  customerNameProblem,
  hasRevisionChanges,
  initialRevisionForm,
  isRestrictedJob,
  jobSignatureBadge,
  missingSigners,
  resignActionsFor,
  revisionFormProblem,
} from "../src/lib/jobRevisionRules.ts";

const lines = [
  { id: "l1", serial: "SN-1", resultNote: "เดิม", installedOn: "2026-10-01", result: "DONE" },
  { id: "l2", serial: "SN-2", resultNote: "", installedOn: "", result: "" },
];
const job = { closeNote: "ปิดงานแล้ว" };
const hasAll = () => true;
const hasOnly = (...ps: string[]) => (p: string) => ps.includes(p);

test("initialRevisionForm: ค่าเริ่มต้น = ค่าปัจจุบัน เฉพาะเครื่องที่บันทึกเสร็จ", () => {
  const f = initialRevisionForm(job, lines);
  assert.equal(f.reason, "");
  assert.equal(f.closeNote, "ปิดงานแล้ว");
  assert.deepEqual(f.lines, [{ lineId: "l1", serial: "SN-1", resultNote: "เดิม", installedOn: "2026-10-01" }]);
});

test("buildRevisionChanges: ส่งเฉพาะช่องที่เปลี่ยน · installedOn เฉพาะงานติดตั้ง", () => {
  const f = initialRevisionForm(job, lines);
  assert.equal(hasRevisionChanges(buildRevisionChanges(f, job, lines, true)), false);
  f.lines[0].installedOn = "2026-10-02";
  f.lines[0].resultNote = " ใหม่ ";
  assert.deepEqual(buildRevisionChanges(f, job, lines, true), { lines: [{ lineId: "l1", resultNote: "ใหม่", installedOn: "2026-10-02" }] });
  assert.deepEqual(buildRevisionChanges(f, job, lines, false), { lines: [{ lineId: "l1", resultNote: "ใหม่" }] });
  f.closeNote = "แก้หมายเหตุ";
  assert.equal(buildRevisionChanges(f, job, lines, true).closeNote, "แก้หมายเหตุ");
});

test("revisionFormProblem: ต้องมีเหตุผล และต้องมีการเปลี่ยนแปลง", () => {
  const f = initialRevisionForm(job, lines);
  assert.match(revisionFormProblem(f, buildRevisionChanges(f, job, lines, true)) ?? "", /เหตุผล/);
  f.reason = "บันทึกวันที่ผิด";
  assert.match(revisionFormProblem(f, buildRevisionChanges(f, job, lines, true)) ?? "", /ยังไม่ได้แก้/);
  f.closeNote = "ใหม่";
  assert.equal(revisionFormProblem(f, buildRevisionChanges(f, job, lines, true)), null);
});

test("canRequestRevision: เฉพาะใบงาน CLOSED + jobs:close + ไม่มีคำขอรอ", () => {
  assert.equal(canRequestRevision("CLOSED", hasOnly("jobs:close"), false), true);
  assert.equal(canRequestRevision("CLOSED", hasOnly("jobs:close"), true), false);
  assert.equal(canRequestRevision("OPEN", hasAll, false), false);
  assert.equal(canRequestRevision("CLOSED", hasOnly("jobs:view"), false), false);
});

test("canDecideRevision: Manager (changes:approve) และไม่ใช่คำขอตนเอง", () => {
  const r = { status: "REQUESTED", requestedById: "u1" };
  assert.equal(canDecideRevision(r, "u2", hasOnly("changes:approve")), true);
  assert.equal(canDecideRevision(r, "u1", hasOnly("changes:approve")), false);
  assert.equal(canDecideRevision(r, "u2", hasOnly("changes:view")), false);
  assert.equal(canDecideRevision({ ...r, status: "APPROVED" }, "u2", hasAll), false);
});

test("missingSigners / resignActionsFor: ลูกค้าบันทึกได้โดยผู้มี jobs:close · ลายเซ็นช่างเฉพาะช่างผู้รับผิดชอบ", () => {
  const rev = { status: "APPROVED", signatureStatus: "PENDING_RESIGN", requiredSigners: ["CUSTOMER", "TECHNICIAN"] as const, resigns: [] as { signerType: "CUSTOMER" | "TECHNICIAN" }[] };
  const miss = missingSigners({ ...rev, requiredSigners: [...rev.requiredSigners] });
  assert.deepEqual(miss, ["CUSTOMER", "TECHNICIAN"]);
  assert.deepEqual(missingSigners({ ...rev, requiredSigners: [...rev.requiredSigners], resigns: [{ signerType: "CUSTOMER" }] }), ["TECHNICIAN"]);
  assert.deepEqual(missingSigners({ ...rev, requiredSigners: [...rev.requiredSigners], signatureStatus: "RESIGNED" }), []);
  const j = { technicianIds: ["t1"], closedById: "t1" };
  assert.deepEqual(resignActionsFor(miss, j, "t1", hasOnly("jobs:close")), ["CUSTOMER", "TECHNICIAN"]);
  assert.deepEqual(resignActionsFor(miss, j, "admin", hasOnly("jobs:close")), ["CUSTOMER"]);
  assert.deepEqual(resignActionsFor(miss, j, "t2", hasOnly("jobs:view")), []);
  assert.deepEqual(resignActionsFor(miss, { technicianIds: [], closedById: "a1" }, "a1", hasOnly("jobs:close")), ["CUSTOMER", "TECHNICIAN"]);
});

test("customerNameProblem: ห้ามว่าง ห้ามชื่อช่าง/ผู้บันทึก (ไม่สนช่องว่าง/ตัวพิมพ์)", () => {
  assert.ok(customerNameProblem("", []));
  assert.match(customerNameProblem("  ช่าง  เอ ", ["ช่าง เอ"]) ?? "", /ช่างลงนามแทนลูกค้าไม่ได้/);
  assert.equal(customerNameProblem("คุณลูกค้า", ["ช่าง เอ"]), null);
});

// R4 ADV4-05: ผู้ขอแก้ไขไม่ได้ปุ่มบันทึกลายเซ็นลูกค้า · ชื่อเทียบแบบ normalize (ไทย/คำนำหน้า/เครื่องหมาย) เหมือน backend
test("ADV4-05 resignActionsFor: ผู้ขอแก้ไขฉบับนี้ไม่ได้ปุ่มลายเซ็นลูกค้า (ยังลงนามฝั่งช่างของตนได้)", () => {
  const miss = ["CUSTOMER", "TECHNICIAN"] as ("CUSTOMER" | "TECHNICIAN")[];
  const j = { technicianIds: ["t1"], closedById: "t1" };
  assert.deepEqual(resignActionsFor(miss, j, "admin", hasOnly("jobs:close"), "admin"), []);
  assert.deepEqual(resignActionsFor(miss, j, "t1", hasOnly("jobs:close"), "t1"), ["TECHNICIAN"]);
  assert.deepEqual(resignActionsFor(miss, j, "admin", hasOnly("jobs:close"), "t1"), ["CUSTOMER"]);
});

test("ADV4-05 customerNameProblem: เติมจุด/ช่องว่าง/คำนำหน้า/วรรณยุกต์ ยังเป็นชื่อเดิม · ชื่อลูกค้าทั่วไปผ่าน", () => {
  for (const n of ["ช่างเอ.", " ช่าง  เอ ", "คุณช่างเอ", "นายช่างเอ", "ช่างเอ (ลูกค้า)", "ช่่างเอ"]) assert.ok(customerNameProblem(n, ["ช่างเอ"]), n);
  assert.ok(customerNameProblem("Mr. John Smith", ["john smith"]));
  assert.equal(customerNameProblem("คุณสมหญิง ผู้ตรวจรับ", ["ช่างเอ", "แอดมิน"]), null);
  assert.ok(customerNameProblem("..", []));
});

test("jobSignatureBadge / isRestrictedJob", () => {
  assert.equal(jobSignatureBadge({ status: "CLOSED" }), null);
  assert.deepEqual(jobSignatureBadge({ status: "CLOSED", currentRevisionNo: 2, revisionSignatureStatus: "PENDING_RESIGN" }), { label: "ฉบับแก้ไข r2 · รอลงนามใหม่", tone: "warning" });
  assert.equal(jobSignatureBadge({ status: "CLOSED", currentRevisionNo: 1, revisionSignatureStatus: "RESIGNED" })?.tone, "success");
  assert.equal(isRestrictedJob({ restricted: true }), true);
  assert.equal(isRestrictedJob(null), false);
});
