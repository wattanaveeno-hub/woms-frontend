/** Gap closure (agent D) — กติกาแสดงผลสัญญา / แดชบอร์ด / Audit (DEF-02,04,05,07,09,10,13,14,03) */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CONTRACT_EVENT_LABEL,
  CONTRACT_LIFECYCLE_FILTER_ORDER,
  CONTRACT_TEMPLATE_PENDING_NOTE,
  contractDocumentTitle,
  contractDueInMonth,
  contractImportStatusLabel,
  contractSummaryStats,
  dashboardContractMoney,
  filterContractHistory,
  installmentChip,
} from "../src/lib/contractRules.ts";
import { contractLifecycleLabel, contractStatusLabel } from "../src/lib/options.ts";
import { AUDIT_ACTION_OPTIONS, AUDIT_ENTITY_OPTIONS, roleLabel } from "../src/lib/auditOptions.ts";

const TODAY = "2026-10-10";

test("DEF-04 ป้ายงวด: จ่ายแล้ว / ค้างชำระ (เลยกำหนด) / รอชำระ (ยังไม่ถึงกำหนด)", () => {
  assert.deepEqual(installmentChip({ status: "PAID", dueDate: "2026-01-01" }, TODAY, "ACTIVE"), { label: "จ่ายแล้ว", tone: "success" });
  assert.deepEqual(installmentChip({ status: "PENDING", dueDate: "2026-10-09" }, TODAY, "ACTIVE"), { label: "ค้างชำระ", tone: "error" });
  // ครบกำหนดวันนี้ = ยังไม่เลยกำหนด (เกณฑ์เดียวกับ backend: dueDate < today)
  assert.equal(installmentChip({ status: "PENDING", dueDate: TODAY }, TODAY, "ACTIVE").label, "รอชำระ");
  assert.equal(installmentChip({ status: "PENDING", dueDate: "2026-11-10" }, TODAY, "ACTIVE").label, "รอชำระ");
  // สัญญาเริ่มเดือนหน้า → ทุกงวดรอชำระ
  for (const d of ["2026-11-01", "2026-12-01", "2027-01-01"]) {
    assert.equal(installmentChip({ status: "PENDING", dueDate: d }, TODAY, "ACTIVE").label, "รอชำระ");
  }
  // ร่าง / ยกเลิก ไม่มีภาระค้าง
  assert.equal(installmentChip({ status: "PENDING", dueDate: "2026-01-01" }, TODAY, "DRAFT").label, "รอชำระ");
  assert.equal(installmentChip({ status: "PENDING", dueDate: "2026-01-01" }, TODAY, "CANCELLED").label, "รอชำระ");
});

test("DEF-05 ป้ายสถานะสัญญาชุดเดียว ตาม CON-02 และตรงกับ backend", () => {
  assert.deepEqual(contractStatusLabel, {
    DRAFT: "ร่างสัญญา",
    ACTIVE: "กำลังใช้งาน",
    COMPLETED: "สิ้นสุดสัญญา",
    EXPIRED: "หมดอายุ",
    CANCELLED: "ยกเลิกสัญญา",
  });
  assert.equal(contractLifecycleLabel.EXPIRING, "ใกล้หมดสัญญา");
  for (const k of CONTRACT_LIFECYCLE_FILTER_ORDER) assert.ok(contractLifecycleLabel[k], k);
  assert.ok(!Object.values(contractLifecycleLabel).includes("ชำระครบแล้ว"));
  // เทียบกับ backend เมื่อ repo อยู่ข้างกัน (โครงสร้างงานปกติ)
  const be = path.resolve(import.meta.dirname, "../../woms-backend/src/domain/contract.ts");
  if (fs.existsSync(be)) {
    const src = fs.readFileSync(be, "utf8");
    for (const v of Object.values(contractLifecycleLabel)) assert.ok(src.includes(`"${v}"`), `backend ไม่มีป้าย ${v}`);
  }
});

const inst = (dueDate: string, status: "PAID" | "PENDING", amount = 1000) => ({ no: 1, dueDate, amount, status, paidDate: "" });
const contracts: any[] = [
  // ACTIVE ค้าง 2 งวด + งวดเดือนนี้
  { status: "ACTIVE", lifecycle: "ACTIVE", paymentState: "OVERDUE", overdueCount: 2, overdueAmount: 2000, balance: 5000, paidAmount: 1000,
    installments: [inst("2026-08-01", "PAID"), inst("2026-09-01", "PENDING"), inst("2026-09-15", "PENDING"), inst("2026-10-20", "PENDING"), inst("2026-11-01", "PENDING")] },
  // ACTIVE งวดอนาคตทั้งหมด
  { status: "ACTIVE", lifecycle: "EXPIRING", paymentState: "ON_TIME", overdueCount: 0, overdueAmount: 0, balance: 3000, paidAmount: 0,
    installments: [inst("2026-11-01", "PENDING"), inst("2026-12-01", "PENDING"), inst("2027-01-01", "PENDING")] },
  // ร่าง / ยกเลิก — ไม่นับ
  { status: "DRAFT", lifecycle: "DRAFT", paymentState: "NONE", overdueAmount: 0, balance: 9000, paidAmount: 0, installments: [inst("2026-10-05", "PENDING", 9000)] },
  { status: "CANCELLED", lifecycle: "CANCELLED", paymentState: "NONE", overdueAmount: 0, balance: 7000, paidAmount: 500, installments: [inst("2026-10-05", "PENDING", 7000)] },
];

test("DEF-07 การ์ดสรุป: ค่าหลัก = จำนวนสัญญาที่ตัวกรองคืน", () => {
  const s = contractSummaryStats(contracts, "2026-10");
  assert.equal(s.active, 2);
  assert.equal(s.expiring, 1);
  // ตรงกับ GET /api/contracts?payment=OVERDUE (นับสัญญา)
  assert.equal(s.overdueContracts, contracts.filter((c) => c.paymentState === "OVERDUE").length);
  assert.equal(s.overdueInstallments, 2);
  assert.equal(s.overdueAmount, 2000);
  // ตรงกับ GET /api/contracts?due=THIS_MONTH
  assert.equal(s.dueContracts, contracts.filter((c) => contractDueInMonth(c, "2026-10")).length);
  assert.equal(s.dueContracts, 1);
  assert.equal(s.dueInstallments, 1);
  assert.equal(s.dueAmount, 1000);
});

test("DEF-02 แดชบอร์ด: ยอดค้างชำระรวม = ผลรวม overdueAmount · ยอดคงเหลือไม่นับร่าง/ยกเลิก", () => {
  const m = dashboardContractMoney(contracts);
  assert.equal(m.overdueAmount, 2000);
  assert.equal(m.overdueAmount, contracts.filter((c) => c.paymentState === "OVERDUE").reduce((a, c) => a + c.overdueAmount, 0));
  assert.equal(m.balance, 8000);
  assert.equal(m.collected, 1000);
});

test("DEF-09 ค้นประวัติสัญญา: คำค้น / ประเภท / ช่วงวันที่", () => {
  const rows = [
    { type: "CREATE", at: "2026-01-01T03:00:00.000Z", byName: "แอดมิน", note: "", fromStatus: "", toStatus: "" },
    { type: "PAY", at: "2026-02-01T03:00:00.000Z", byName: "ผู้จัดการ", note: "รับชำระงวดที่ 1 จำนวน 1000 บาท", fromStatus: "ACTIVE", toStatus: "ACTIVE" },
    { type: "STATUS", at: "2026-03-01T18:00:00.000Z", byName: "ผู้จัดการ", note: "", fromStatus: "ACTIVE", toStatus: "COMPLETED" },
  ];
  const labels = { event: CONTRACT_EVENT_LABEL, status: contractStatusLabel as Record<string, string> };
  const toDate = (at: string) => new Date(Date.parse(at) + 7 * 3600_000).toISOString().slice(0, 10);
  assert.deepEqual(filterContractHistory(rows, { q: "รับชำระ" }, labels, toDate).map((r) => r.type), ["PAY"]);
  assert.deepEqual(filterContractHistory(rows, { q: "บันทึกชำระ" }, labels, toDate).map((r) => r.type), ["PAY"]);
  assert.deepEqual(filterContractHistory(rows, { q: "สิ้นสุดสัญญา" }, labels, toDate).map((r) => r.type), ["STATUS"]);
  assert.deepEqual(filterContractHistory(rows, { type: "CREATE" }, labels, toDate).map((r) => r.type), ["CREATE"]);
  // 2026-03-01T18:00Z = 2 มี.ค. เวลาไทย
  assert.deepEqual(filterContractHistory(rows, { from: "2026-03-02" }, labels, toDate).map((r) => r.type), ["STATUS"]);
  assert.deepEqual(filterContractHistory(rows, { to: "2026-03-01" }, labels, toDate).map((r) => r.type), ["CREATE", "PAY"]);
  assert.equal(filterContractHistory(rows, {}, labels, toDate).length, 3);
});

test("DEF-13 สถานะการนำเข้าเป็นภาษาไทย", () => {
  assert.equal(contractImportStatusLabel("RUNNING"), "กำลังนำเข้า");
  assert.equal(contractImportStatusLabel("DONE"), "สำเร็จ");
  assert.equal(contractImportStatusLabel("FAILED"), "ล้มเหลว");
});

test("DEF-10 / DEF-14 ตัวกรอง Audit ครบ และป้าย role ภาษาไทย", () => {
  const actions = AUDIT_ACTION_OPTIONS.map((o) => o.value);
  for (const a of ["REQUEST", "PAYMENT", "PAYMENT_CORRECTION"]) assert.ok(actions.includes(a as any), a);
  assert.equal(AUDIT_ACTION_OPTIONS.find((o) => o.value === "PAYMENT_CORRECTION")?.label, "แก้ไขรายการชำระ");
  const entities = AUDIT_ENTITY_OPTIONS.map((o) => o.value);
  for (const e of ["change_requests", "service_queues", "group_chat", "job_drafts"]) assert.ok(entities.includes(e as any), e);
  const be = path.resolve(import.meta.dirname, "../../woms-backend/src/domain/audit.ts");
  if (fs.existsSync(be)) {
    const src = fs.readFileSync(be, "utf8");
    const block = (name: string) => src.slice(src.indexOf(`export const ${name} = [`), src.indexOf("] as const", src.indexOf(`export const ${name} = [`)));
    const beActions = [...block("AUDIT_ACTIONS").matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
    const beEntities = [...block("AUDIT_ENTITIES").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    assert.deepEqual([...actions].sort(), [...beActions].sort());
    assert.deepEqual([...entities].sort(), [...beEntities].sort());
  }
  assert.equal(roleLabel("manager"), "ผู้จัดการ");
  assert.equal(roleLabel("ceo"), "ผู้บริหาร (Master/CEO)");
  assert.equal(roleLabel("unknown"), "unknown");
  assert.equal(roleLabel(""), "");
});

test("DEF-03 หนังสือสัญญา: ข้อความรอแบบฟอร์มตรงกับ PDF ฝั่งเซิร์ฟเวอร์ และหัวเรื่องติด (ร่าง)", () => {
  assert.equal(contractDocumentTitle("หนังสือสัญญาเช่า"), "หนังสือสัญญาเช่า (ร่าง)");
  assert.match(CONTRACT_TEMPLATE_PENDING_NOTE, /แบบฟอร์มบริษัทยังไม่ได้รับ/);
  const be = path.resolve(import.meta.dirname, "../../woms-backend/src/lib/contractQuotationPdf.ts");
  if (fs.existsSync(be)) assert.ok(fs.readFileSync(be, "utf8").includes(`"${CONTRACT_TEMPLATE_PENDING_NOTE}"`));
});
