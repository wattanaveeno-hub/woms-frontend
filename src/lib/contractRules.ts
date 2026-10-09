// ---------------------------------------------------------------------------
// กติกาการแสดงผลของโมดูลสัญญา / แดชบอร์ด / Audit — ฟังก์ชันบริสุทธิ์ ทดสอบได้ด้วย node --test
// ไม่มี import จาก React/MUI (import type เท่านั้น) เพื่อให้ scripts/*.test.ts เรียกตรงได้
// ---------------------------------------------------------------------------
import type { Contract, ContractStatus } from "./types";

export type RuleTone = "success" | "warning" | "error" | "info" | "primary" | "neutral";

// ---- DEF-04 ป้ายสถานะงวด ตามวันครบกำหนด ----
/**
 * PAID → "จ่ายแล้ว" · PENDING ที่เลยกำหนด (dueDate < วันนี้ตามเวลาไทย) → "ค้างชำระ"
 * PENDING อื่น ๆ → "รอชำระ"
 * สัญญาร่าง/ยกเลิกไม่มีภาระค้าง (เกณฑ์เดียวกับ overdue ของ backend) จึงไม่ขึ้น "ค้างชำระ"
 */
export function installmentChip(
  it: { status: string; dueDate: string },
  today: string,
  contractStatus?: ContractStatus | string
): { label: string; tone: RuleTone } {
  if (it.status === "PAID") return { label: "จ่ายแล้ว", tone: "success" };
  const live = contractStatus !== "DRAFT" && contractStatus !== "CANCELLED";
  if (live && it.dueDate && it.dueDate < today) return { label: "ค้างชำระ", tone: "error" };
  return { label: "รอชำระ", tone: "neutral" };
}

// ---- DEF-05 ตัวกรองสถานะที่ผู้ใช้เห็น (ใช้ป้ายชุดเดียวกับ options.ts / backend) ----
export const CONTRACT_LIFECYCLE_FILTER_ORDER = ["ACTIVE", "EXPIRING", "EXPIRED", "COMPLETED", "DRAFT", "CANCELLED"] as const;

// ---- DEF-02 / DEF-07 ตัวเลขสรุปสัญญา ----
type ContractLike = Pick<Contract, "status" | "installments"> &
  Partial<Pick<Contract, "lifecycle" | "paymentState" | "overdueAmount" | "overdueCount" | "balance" | "paidAmount">>;

/** สัญญาที่มีภาระจริง (ไม่ใช่ร่าง/ยกเลิก) — เกณฑ์เดียวกับ backend overdue/paymentState */
export function isBindingContract(c: Pick<Contract, "status">): boolean {
  return c.status !== "DRAFT" && c.status !== "CANCELLED";
}

/** ตรงกับ backend domain/contract.ts contractDueInMonth() (GET /api/contracts?due=THIS_MONTH) */
export function contractDueInMonth(c: Pick<Contract, "status"> & { installments?: { status: string; dueDate: string }[] }, month: string): boolean {
  if (!isBindingContract(c)) return false;
  return (c.installments ?? []).some((it) => it.status === "PENDING" && (it.dueDate ?? "").startsWith(month));
}

const outstandingOf = (it: { amount: number; status: string; payment?: { outstanding: number } }) =>
  it.payment ? it.payment.outstanding : it.status === "PENDING" ? it.amount : 0;
const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + (Number(b) || 0), 0) * 100) / 100;

/**
 * การ์ดสรุปบนหน้ารายการสัญญา — ค่าหลักของการ์ด = จำนวน "สัญญา" ที่ตรงกับตัวกรองที่การ์ดพาไป
 * (DEF-07: เดิม "งวดค้างชำระ" แสดงจำนวนงวด แต่กดแล้วได้รายการสัญญา)
 */
export function contractSummaryStats(all: ContractLike[], month: string) {
  const overdue = all.filter((c) => c.paymentState === "OVERDUE");
  const due = all.filter((c) => contractDueInMonth(c, month));
  const dueItems = due.flatMap((c) => (c.installments ?? []).filter((it) => it.status === "PENDING" && it.dueDate.startsWith(month)));
  return {
    active: all.filter((c) => c.status === "ACTIVE").length,
    expiring: all.filter((c) => c.lifecycle === "EXPIRING").length,
    overdueContracts: overdue.length,
    overdueInstallments: overdue.reduce((n, c) => n + (c.overdueCount ?? 0), 0),
    overdueAmount: sum(overdue.map((c) => c.overdueAmount ?? 0)),
    dueContracts: due.length,
    dueInstallments: dueItems.length,
    dueAmount: sum(dueItems.map(outstandingOf)),
  };
}

/**
 * DEF-02 — ตัวเลขการเงินสัญญาบนแดชบอร์ด
 * - overdueAmount: "ยอดค้างชำระรวม" = เฉพาะงวดที่เลยกำหนดของสัญญาที่มีผล (ผลรวม overdueAmount จาก backend)
 *   ตรงกับยอดในรายการ /contracts?payment=OVERDUE
 * - balance / collected: ยอดคงเหลือ/เก็บแล้วตามสัญญา ไม่นับร่างและสัญญาที่ยกเลิก
 */
export function dashboardContractMoney(contracts: ContractLike[]) {
  const binding = contracts.filter(isBindingContract);
  return {
    overdueAmount: sum(contracts.map((c) => c.overdueAmount ?? 0)),
    balance: sum(binding.map((c) => c.balance ?? 0)),
    collected: sum(binding.map((c) => c.paidAmount ?? 0)),
  };
}

// ---- DEF-09 ค้นประวัติสัญญา ----
export interface ContractHistoryFilter {
  q?: string;
  type?: string;
  from?: string; // YYYY-MM-DD (เวลาไทย)
  to?: string;
}
export function filterContractHistory<
  H extends { type: string; at: string; byName?: string; note?: string; fromStatus?: string; toStatus?: string }
>(rows: H[], f: ContractHistoryFilter, labels: { event: Record<string, string>; status: Record<string, string> }, toDate: (at: string) => string): H[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return rows.filter((h) => {
    if (f.type && h.type !== f.type) return false;
    const d = toDate(h.at);
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    if (!q) return true;
    const hay = [
      labels.event[h.type] ?? h.type,
      h.byName ?? "",
      h.note ?? "",
      labels.status[h.fromStatus ?? ""] ?? h.fromStatus ?? "",
      labels.status[h.toStatus ?? ""] ?? h.toStatus ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** ป้ายไทยของ ContractEvent (ตรงกับ CONTRACT_EVENT_LABELS ของ backend) */
export const CONTRACT_EVENT_LABEL: Record<string, string> = {
  CREATE: "สร้างสัญญา",
  STATUS: "เปลี่ยนสถานะ",
  RENEW: "ต่อสัญญา",
  CANCEL: "ยกเลิกสัญญา",
  PAY: "บันทึกชำระ",
  EDIT: "แก้ไขข้อมูล",
  DOCUMENT: "อัปโหลดเอกสาร",
};

// ---- DEF-03 หนังสือสัญญายังไม่ใช่แบบฟอร์มบริษัท ----
/** ข้อความเดียวกับ TEMPLATE_PENDING_NOTE ของ PDF ฝั่งเซิร์ฟเวอร์ (backend src/lib/contractQuotationPdf.ts) */
export const CONTRACT_TEMPLATE_PENDING_NOTE = "แบบฟอร์มบริษัทยังไม่ได้รับ (BLOCKED_BY_TEMPLATE) — เอกสารนี้ใช้รูปแบบมาตรฐานของระบบ";
/** หัวเรื่องหนังสือสัญญาติดคำว่า "ร่าง" จนกว่าจะได้แบบฟอร์มบริษัท (ไม่ขึ้นกับการยืนยันหัวเอกสาร) */
export function contractDocumentTitle(baseTitle: string): string {
  return `${baseTitle} (ร่าง)`;
}

// ---- DEF-13 สถานะการนำเข้าสัญญา ----
export const CONTRACT_IMPORT_STATUS_LABEL: Record<string, string> = {
  RUNNING: "กำลังนำเข้า",
  DONE: "สำเร็จ",
  FAILED: "ล้มเหลว",
};
export function contractImportStatusLabel(s: string): string {
  return CONTRACT_IMPORT_STATUS_LABEL[s] ?? s;
}
