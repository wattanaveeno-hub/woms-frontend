// ---------------------------------------------------------------------------
// Round 8 — วางบิลช่างราย Job Machine (BILL-01..07) และ Service Margin (MAR-01..03)
// ---------------------------------------------------------------------------
// แยกไฟล์จาก api.ts / types.ts เพื่อไม่ชนกับการแก้ของโมดูลอื่น
import { request } from "@/lib/api";
import type { BillStatus, TechBill } from "@/lib/types";

export interface BillMachineItem {
  jobId: string;
  jobEquipmentId: string;
  equipmentId: string;
  serial: string;
  model: string;
  jobType: string;
  jobDate: string;
  customerName: string;
  serviceFee: number;
  note: string;
}

export interface BillJobCost {
  jobId: string;
  distanceKm: number;
  ratePerKm: number;
  travelAmount: number;
  hotel: number;
  parking: number;
  equipment: number;
  porter: number;
  other: number;
  note: string;
  attachments?: string[];
}

export interface BillAdjustment {
  at: string;
  byId: string;
  by: string;
  reason: string;
  changes: Array<{ ref: string; field: string; before: number; after: number }>;
}

export interface TechBillV2 extends Omit<TechBill, "totals"> {
  format: "JOB" | "MACHINE";
  machineItems: BillMachineItem[];
  jobCosts: BillJobCost[];
  adjustments: BillAdjustment[];
  locked: boolean;
  approvedTotal?: number;
  reviewedAt?: string;
  holdReason?: string;
  holdAt?: string;
  holdBy?: string;
  printedAt?: string;
  printedBy?: string;
  printCount?: number;
  paymentPendingAt?: string;
  paidAt?: string;
  paidDate?: string;
  paymentRef?: string;
  paymentEvidence?: string;
  hasPaymentEvidence: boolean;
  paidBy?: string;
  receivedConfirmedById?: string;
  receivedConfirmedBy?: string;
  receivedConfirmedAt?: string;
  /** การยืนยันรับเงินรอบก่อนที่ถูกยกเลิกเพราะ Manager แก้รายการจ่ายจนบิลกลับเป็นรอจ่าย */
  receiptHistory?: Array<{ confirmedById: string; confirmedBy: string; confirmedAt: string; resetAt: string; resetReason: string }>;
  submittedAt?: string;
  /** BR-02 — ประวัติการอนุมัติทุกครั้ง */
  approvals?: Array<{ byId: string; byName: string; role: string; at: string; total: number; note: string }>;
  /** BR-06/07 — ยอดตั้ง/จ่ายแล้ว/คงค้าง และรายการจ่าย */
  payment?: import("@/lib/paymentsApi").PaymentSummary;
  payments?: import("@/lib/paymentsApi").PaymentRecord[];
  totals: TechBill["totals"] & { machineCount: number; serviceFeeTotal: number; sharedTotal: number };
}

export interface BillableMachineGroup {
  jobId: string;
  jobName: string;
  jobType: string;
  jobDate: string;
  customerName: string;
  technicianIds: string[];
  technicianTeam: string;
  lockedByBillNo: string;
  billableCount: number;
  machines: Array<{
    jobEquipmentId: string;
    equipmentId: string;
    serial: string;
    model: string;
    billedInBillNo: string;
    /** VFB แถว 9 — false = เครื่องยังไม่บันทึกว่าเสร็จ วางบิลไม่ได้ (backend เดิมไม่ส่งค่านี้ = ถือว่าเสร็จ) */
    done?: boolean;
  }>;
}

export interface MachineRowInput {
  jobEquipmentId: string;
  serviceFee: number;
  note?: string;
}

export interface JobCostInput {
  jobId: string;
  distanceKm: number;
  ratePerKm: number;
  hotel: number;
  parking: number;
  equipment: number;
  porter: number;
  other: number;
  note: string;
  attachments?: string[];
}

export interface PaymentInput {
  paidDate: string;
  paymentRef: string;
  paymentEvidence: string;
}

const qs = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
};
const enc = encodeURIComponent;

export const billsApi = {
  billableMachines: (params: { from?: string; to?: string; technicianId?: string; excludeBillId?: string } = {}) =>
    request<{ items: BillableMachineGroup[]; count: number; machineCount: number; billableMachineCount: number }>(
      `/api/bills/billable-machines${qs(params)}`
    ),
  get: (id: string) => request<TechBillV2>(`/api/bills/${enc(id)}`),
  create: (values: {
    periodFrom: string;
    periodTo: string;
    technicianId?: string;
    machineItems: MachineRowInput[];
    jobCosts: JobCostInput[];
    note?: string;
  }) => request<TechBillV2>("/api/bills", { method: "POST", body: JSON.stringify(values) }),
  patch: (
    id: string,
    values: { machineItems?: MachineRowInput[]; jobCosts?: JobCostInput[]; note?: string; periodFrom?: string; periodTo?: string },
    updatedAt: string
  ) => request<TechBillV2>(`/api/bills/${enc(id)}`, { method: "PATCH", body: JSON.stringify({ ...values, updatedAt }) }),
  setStatus: (id: string, status: BillStatus, note = "", payment?: PaymentInput) =>
    request<TechBillV2>(`/api/bills/${enc(id)}/status`, {
      method: "POST",
      body: JSON.stringify({ status, note, ...(payment ?? {}) }),
    }),
  adjust: (
    id: string,
    values: {
      reason: string;
      machineFees?: Array<{ jobEquipmentId: string; serviceFee: number }>;
      jobCosts?: Array<Partial<JobCostInput> & { jobId: string }>;
    },
    updatedAt: string
  ) => request<TechBillV2>(`/api/bills/${enc(id)}/adjust`, { method: "POST", body: JSON.stringify({ ...values, updatedAt }) }),
  confirmReceipt: (id: string) => request<TechBillV2>(`/api/bills/${enc(id)}/confirm-receipt`, { method: "POST", body: "{}" }),
  reprint: (id: string) => request<TechBillV2>(`/api/bills/${enc(id)}/reprint`, { method: "POST", body: "{}" }),
};

// ---- Service Margin ----
export interface MarginLine {
  source: string;
  sourceLabel: string;
  ref: string;
  date: string;
  description: string;
  revenue: number;
  cost: number;
  jobId?: string;
  billId?: string;
  billStatus?: string;
}

export interface ServiceMargin {
  equipmentId: string;
  serial: string;
  lines: MarginLine[];
  revenueTotal: number;
  costTotal: number;
  net: number;
  bySource: Array<{ source: string; label: string; revenue: number; cost: number }>;
  excluded: Array<{ source: string; reason: string }>;
  basis?: { recognizedStatuses: string[]; pendingStatuses: string[]; note: string };
  pending?: { costTotal: number; lines: MarginLine[] };
  blocked?: Array<{ item: string; question: string; note: string }>;
  assumptions?: string[];
}

export const marginApi = {
  get: (equipmentId: string) => request<ServiceMargin>(`/api/equipment/${enc(equipmentId)}/finance`),
};

/** ยอดค่าใช้จ่ายร่วมของ JN หนึ่งชุด (ใช้แสดงผลก่อนส่ง — server คำนวณซ้ำเสมอ) */
export function jobCostSum(c: Pick<JobCostInput, "distanceKm" | "ratePerKm" | "hotel" | "parking" | "equipment" | "porter" | "other">): number {
  const travel = Math.round((Number(c.distanceKm) || 0) * (Number(c.ratePerKm) || 0) * 100) / 100;
  const rest = (Number(c.hotel) || 0) + (Number(c.parking) || 0) + (Number(c.equipment) || 0) + (Number(c.porter) || 0) + (Number(c.other) || 0);
  return Math.round((travel + rest) * 100) / 100;
}
