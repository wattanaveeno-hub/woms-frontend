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
  canCaptureCustomerResign,
  revisionFormProblem,
  buildPartsChanges,
  initialPartsDraft,
  canDesignateCollector,
  collectorFormProblem,
  revisionFieldLabel,
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
  // ADV5-01: ลายเซ็นลูกค้าเฉพาะช่างที่ได้รับมอบหมาย (เดิม: ผู้มี jobs:close ทุกคน รวม Admin)
  assert.deepEqual(resignActionsFor(miss, j, "t1", hasOnly("jobs:close"), { role: "tech" }), ["CUSTOMER", "TECHNICIAN"]);
  assert.deepEqual(resignActionsFor(miss, j, "admin", hasOnly("jobs:close"), { role: "admin" }), []);
  assert.deepEqual(resignActionsFor(miss, j, "t2", hasOnly("jobs:view"), { role: "tech" }), []);
  // ใบงานไม่ระบุช่าง: ผู้ปิดงานลงนามฝั่งช่างได้ แต่ลายเซ็นลูกค้าไม่มีใครบันทึกได้ (ไม่มีช่างที่ได้รับมอบหมาย)
  assert.deepEqual(resignActionsFor(miss, { technicianIds: [], closedById: "a1" }, "a1", hasOnly("jobs:close"), { role: "admin" }), ["TECHNICIAN"]);
});

test("customerNameProblem: ห้ามว่าง ห้ามชื่อช่าง/ผู้บันทึก (ไม่สนช่องว่าง/ตัวพิมพ์)", () => {
  assert.ok(customerNameProblem("", []));
  assert.match(customerNameProblem("  ช่าง  เอ ", ["ช่าง เอ"]) ?? "", /ช่างลงนามแทนลูกค้าไม่ได้/);
  assert.equal(customerNameProblem("คุณลูกค้า", ["ช่าง เอ"]), null);
});

// R4 ADV4-05: ผู้ขอแก้ไขไม่ได้ปุ่มบันทึกลายเซ็นลูกค้า · ชื่อเทียบแบบ normalize (ไทย/คำนำหน้า/เครื่องหมาย) เหมือน backend
// R5 ADV5-01: เปลี่ยนจาก "ผู้ขอแก้ไขไม่ได้" (ADV4-05) เป็น "เฉพาะช่างที่ได้รับมอบหมาย" — ช่างผู้ขอแก้ไขเองบันทึกได้ (อยู่กับลูกค้า)
test("ADV5-01 resignActionsFor: ลายเซ็นลูกค้าเฉพาะช่างที่ได้รับมอบหมาย · สำนักงาน/ผู้อนุมัติ/ช่างอื่นไม่มีปุ่ม", () => {
  const miss = ["CUSTOMER", "TECHNICIAN"] as ("CUSTOMER" | "TECHNICIAN")[];
  const j = { technicianIds: ["t1", "t3"], closedById: "t1" };
  const all = () => true;
  for (const role of ["admin", "manager", "ceo", "sales", "acc", "viewer"]) assert.deepEqual(resignActionsFor(miss, j, "x", all, { role }), [], role);
  assert.deepEqual(resignActionsFor(miss, j, "m1", all, { role: "manager", decidedById: "m1" }), []);
  assert.deepEqual(resignActionsFor(miss, j, "t2", hasOnly("jobs:close"), { role: "tech" }), []);
  assert.deepEqual(resignActionsFor(miss, j, "t1", hasOnly("jobs:close"), { role: "tech" }), ["CUSTOMER", "TECHNICIAN"]);
  assert.deepEqual(resignActionsFor(miss, j, "t3", hasOnly("jobs:close"), { role: "tech" }), ["CUSTOMER", "TECHNICIAN"]);
  // ไม่ส่ง role → ไม่ให้ปุ่มลูกค้า (ปลอดภัยไว้ก่อน)
  assert.deepEqual(resignActionsFor(miss, j, "t1", hasOnly("jobs:close")), ["TECHNICIAN"]);
  assert.equal(canCaptureCustomerResign(j, { id: "t1", role: "tech" }, "t1"), false);
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

// ---- P-07 อะไหล่หลังปิดงาน ----
const partLines = [
  { lineId: "l1", serial: "SN-1", partsUsed: [{ id: "u1", partCode: "P-1", partName: "มอเตอร์", qty: 1, unit: "ชิ้น", unitCost: 850, note: "" }] },
];
test("P-07 buildPartsChanges: ไม่เปลี่ยน = ไม่ส่ง · แก้จำนวน/หมายเหตุ · ลบ · เพิ่ม", () => {
  const d0 = initialPartsDraft(partLines);
  assert.deepEqual(buildPartsChanges(d0, partLines, true), { changes: [], problem: null });
  const d1 = initialPartsDraft(partLines);
  d1[0].uses[0].qty = "2";
  d1[0].uses[0].note = "เปลี่ยน 2 ตัว";
  assert.deepEqual(buildPartsChanges(d1, partLines, true).changes, [{ op: "UPDATE", lineId: "l1", useId: "u1", qty: 2, note: "เปลี่ยน 2 ตัว" }]);
  const d2 = initialPartsDraft(partLines);
  d2[0].uses[0].remove = true;
  assert.deepEqual(buildPartsChanges(d2, partLines, false).changes, [{ op: "REMOVE", lineId: "l1", useId: "u1" }]);
  const d3 = initialPartsDraft(partLines);
  d3[0].adds.push({ key: "k", partId: "p2", qty: "3", unit: "ชิ้น", unitCost: "120", note: "" });
  assert.deepEqual(buildPartsChanges(d3, partLines, true).changes, [{ op: "ADD", lineId: "l1", partId: "p2", qty: 3, unit: "ชิ้น", unitCost: 120 }]);
  // ผู้ไม่มี parts:cost_edit: ไม่ส่งต้นทุนเลย (backend ตอบ 403 ถ้าส่ง)
  assert.deepEqual(buildPartsChanges(d3, partLines, false).changes, [{ op: "ADD", lineId: "l1", partId: "p2", qty: 3, unit: "ชิ้น" }]);
  const bad = initialPartsDraft(partLines);
  bad[0].uses[0].qty = "0";
  assert.ok(buildPartsChanges(bad, partLines, true).problem);
  const noPart = initialPartsDraft(partLines);
  noPart[0].adds.push({ key: "k", partId: "", qty: "1", unit: "", unitCost: "", note: "" });
  assert.ok(buildPartsChanges(noPart, partLines, true).problem);
});
test("P-07 ต้นทุนที่ API ซ่อน (null) ไม่ถูกส่งกลับเป็น 0", () => {
  const masked = [{ ...partLines[0], partsUsed: [{ ...partLines[0].partsUsed[0], unitCost: null }] }];
  const d = initialPartsDraft(masked as any);
  assert.equal(d[0].uses[0].unitCost, "");
  d[0].uses[0].qty = "4";
  assert.deepEqual(buildPartsChanges(d, masked as any, false).changes, [{ op: "UPDATE", lineId: "l1", useId: "u1", qty: 4 }]);
});
test("P-07 revisionFormProblem: คำขอที่แก้เฉพาะอะไหล่ส่งได้ · ป้ายช่องผลต่าง", () => {
  assert.equal(revisionFormProblem({ reason: "แก้อะไหล่ที่ใช้", closeNote: "", lines: [] }, { partsChanges: [{ op: "REMOVE", lineId: "l1", useId: "u1" }] }), null);
  assert.equal(revisionFieldLabel("partsUsed[SN-1]"), "อะไหล่ที่ใช้ [SN-1]");
  assert.equal(revisionFieldLabel("closeNote"), "หมายเหตุปิดงาน");
});

// ---- P-08 ช่างเก็บลายเซ็น ----
test("P-08 ปุ่มมอบหมายเฉพาะ Manager บนฉบับที่รอลงนามใหม่ · ฟอร์มต้องมีช่าง + เหตุผล", () => {
  const rev = { status: "APPROVED", signatureStatus: "PENDING_RESIGN" };
  assert.equal(canDesignateCollector(rev, hasOnly("changes:approve")), true);
  assert.equal(canDesignateCollector(rev, hasOnly("jobs:close", "changes:view")), false);
  assert.equal(canDesignateCollector({ ...rev, signatureStatus: "RESIGNED" }, hasAll), false);
  assert.equal(canDesignateCollector(null, hasAll), false);
  assert.ok(collectorFormProblem("", "เหตุผลยาวพอ"));
  assert.ok(collectorFormProblem("t1", "สั้น"));
  assert.equal(collectorFormProblem("t1", "ใบงานไม่มีช่าง"), null);
});
test("P-08 ช่างเก็บลายเซ็นเห็นปุ่มลงนามทั้งลูกค้าและช่าง · ช่างอื่น/Manager ไม่เห็นปุ่มลูกค้า", () => {
  const noTechJob = { technicianIds: [] as string[], closedById: "admin" };
  const both = ["CUSTOMER", "TECHNICIAN"] as const;
  assert.deepEqual(resignActionsFor([...both], noTechJob, "tB", hasOnly("jobs:close"), { role: "tech", collectorId: "tB" }), ["CUSTOMER", "TECHNICIAN"]);
  assert.deepEqual(resignActionsFor([...both], noTechJob, "tC", hasOnly("jobs:close"), { role: "tech", collectorId: "tB" }), []);
  assert.deepEqual(resignActionsFor([...both], noTechJob, "mgr", hasAll, { role: "manager", collectorId: "mgr" }), []);
  assert.equal(canCaptureCustomerResign({ technicianIds: [] }, { id: "tB", role: "tech" }, "", "tB"), true);
  // ช่างผู้รับผิดชอบเดิมยังลงนามได้แม้มีผู้ถูกมอบหมาย
  assert.deepEqual(resignActionsFor([...both], { technicianIds: ["tA"] }, "tA", hasOnly("jobs:close"), { role: "tech", collectorId: "tB" }), ["CUSTOMER", "TECHNICIAN"]);
});
