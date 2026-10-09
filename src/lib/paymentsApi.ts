// ---------------------------------------------------------------------------
// BR-06 / BR-07 / BR-08 — รายการรับ/จ่ายเงิน (บิลช่าง + งวดสัญญา)
// ---------------------------------------------------------------------------
import { request } from "@/lib/api";
import type { Contract } from "@/lib/types";
import type { TechBillV2 } from "@/lib/billsApi";

export type PaymentMethod = "TRANSFER" | "CASH" | "CHEQUE" | "OTHER";
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  TRANSFER: "โอนเงิน",
  CASH: "เงินสด",
  CHEQUE: "เช็ค",
  OTHER: "อื่น ๆ",
};
export type PaymentState = "UNPAID" | "PARTIAL" | "PAID";
export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  UNPAID: "ยังไม่ชำระ",
  PARTIAL: "ชำระบางส่วน",
  PAID: "ชำระครบ",
};

export interface PaymentValues {
  amount: number;
  paidDate: string;
  method: PaymentMethod;
  reference: string;
  status: "ACTIVE" | "VOID";
}
export interface PaymentCorrection {
  correctionId: string;
  requestId: string;
  before: PaymentValues;
  after: PaymentValues;
  note: string;
  byId: string;
  byName: string;
  byRole: string;
  at: string;
}
export interface PaymentRecord extends PaymentValues {
  paymentId: string;
  requestId: string;
  evidence: string;
  evidenceFileId: string;
  evidenceName: string;
  recordedById: string;
  recordedBy: string;
  createdAt: string;
  correctedAt: string;
  corrections: PaymentCorrection[];
  legacy?: boolean;
}
export interface PaymentSummary {
  due: number;
  paid: number;
  outstanding: number;
  state: PaymentState;
  paymentCount: number;
  correctionCount: number;
}

export interface CorrectionBody {
  amount?: number;
  paidDate?: string;
  method?: PaymentMethod;
  reference?: string;
  void?: boolean;
  note: string;
  requestId: string;
}

/** คีย์กันส่งซ้ำ — สร้างครั้งเดียวต่อการเปิดกล่อง แล้วส่งค่าเดิมเมื่อกดซ้ำ/ลองใหม่ */
export function newRequestId(prefix = "pay"): string {
  const rnd =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${rnd}`;
}

export const paymentsApi = {
  billPayments: (id: string) =>
    request<{ payment: PaymentSummary; payments: PaymentRecord[]; canRecord: boolean; canCorrect: boolean }>(`/api/bills/${id}/payments`),
  recordBillPayment: (
    id: string,
    body: { amount: number; paidDate: string; method: PaymentMethod; reference: string; evidence: string; requestId: string }
  ) =>
    request<{ bill: TechBillV2; payment: PaymentRecord; replayed: boolean }>(`/api/bills/${id}/payments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  correctBillPayment: (id: string, paymentId: string, body: CorrectionBody) =>
    request<{ bill: TechBillV2; payment: PaymentRecord; correction: PaymentCorrection; replayed: boolean }>(
      `/api/bills/${id}/payments/${encodeURIComponent(paymentId)}`,
      { method: "PATCH", body: JSON.stringify(body) }
    ),
  recordInstallmentPayment: (
    id: string,
    no: number,
    body: {
      amount: number;
      paidDate: string;
      method: PaymentMethod;
      reference: string;
      evidence: { name: string; dataUrl: string } | null;
      requestId: string;
    }
  ) =>
    request<{ contract: Contract; payment: PaymentRecord; replayed: boolean }>(`/api/contracts/${id}/installments/${no}/payments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  correctInstallmentPayment: (id: string, no: number, paymentId: string, body: CorrectionBody) =>
    request<{ contract: Contract; payment: PaymentRecord; correction: PaymentCorrection; replayed: boolean }>(
      `/api/contracts/${id}/installments/${no}/payments/${encodeURIComponent(paymentId)}`,
      { method: "PATCH", body: JSON.stringify(body) }
    ),
};
