// ---------------------------------------------------------------------------
// D-11 Financial Workflow v1.0 — ป้าย/กติกาฝั่งหน้าเว็บ (ฟังก์ชันบริสุทธิ์ ทดสอบด้วย node --test)
// ต้องตรงกับ backend src/domain/finance.ts — สิทธิ์จริงตรวจที่ backend ทุก API
// ---------------------------------------------------------------------------

export type FinPaymentState = "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED" | "VOIDED";
export type FinAggState = "UNPAID" | "PARTIALLY_PAID" | "PAID";
export type FinPaymentChannel = "TRANSFER" | "CASH" | "CHEQUE" | "CREDIT_CARD" | "OTHER";
export type AccDocType = "RECEIPT" | "TAX_INVOICE" | "RECEIPT_TAX_INVOICE";
export type DeliveryChannel = "EMAIL" | "LINE" | "POST" | "HAND" | "OTHER";
export type FinException =
  | "OVERPAID"
  | "ZERO_DUE"
  | "PAYMENTS_ON_PREVIOUS_REVISION"
  | "CANCELLED_WITH_MONEY"
  | "DOC_FOR_UNVERIFIED_PAYMENT";

export const FIN_PAYMENT_STATE_LABEL: Record<FinPaymentState, string> = {
  PENDING_VERIFICATION: "รอบัญชีตรวจสอบ",
  VERIFIED: "ยืนยันรับเงินแล้ว",
  REJECTED: "ไม่ผ่านการตรวจสอบ",
  VOIDED: "ยกเลิกรายการ",
};
export const FIN_AGG_STATE_LABEL: Record<FinAggState, string> = {
  UNPAID: "ยังไม่ชำระ",
  PARTIALLY_PAID: "ชำระบางส่วน",
  PAID: "ชำระครบแล้ว",
};
export const FIN_CHANNEL_LABEL: Record<FinPaymentChannel, string> = {
  TRANSFER: "โอนเงิน",
  CASH: "เงินสด",
  CHEQUE: "เช็ค",
  CREDIT_CARD: "บัตรเครดิต",
  OTHER: "อื่น ๆ",
};
export const ACC_DOC_TYPE_LABEL: Record<AccDocType, string> = {
  RECEIPT: "ใบเสร็จรับเงิน",
  TAX_INVOICE: "ใบกำกับภาษี",
  RECEIPT_TAX_INVOICE: "ใบเสร็จรับเงิน/ใบกำกับภาษี (เอกสารรวม)",
};
export const DELIVERY_CHANNEL_LABEL: Record<DeliveryChannel, string> = {
  EMAIL: "อีเมล",
  LINE: "LINE",
  POST: "ไปรษณีย์",
  HAND: "ส่งมอบด้วยตนเอง",
  OTHER: "อื่น ๆ",
};
export const FIN_EXCEPTION_LABEL: Record<FinException, string> = {
  OVERPAID: "รับเงินเกินยอดที่ต้องชำระ — รอตรวจสอบ (ระบบไม่ปรับยอดหรือตัดส่วนต่างเอง)",
  ZERO_DUE: "ยอดที่ต้องชำระเป็นศูนย์แต่มีรายการรับเงิน — รอตรวจสอบ",
  PAYMENTS_ON_PREVIOUS_REVISION: "มีรายการรับเงินที่อ้างอิง Revision เดิม — ระบบไม่ย้ายหรือปรับยอดตาม Revision ใหม่",
  CANCELLED_WITH_MONEY: "ใบเสนอราคายกเลิกแล้วแต่มีรายการรับเงิน — ระบบไม่ยกเลิกเงินรับตามอัตโนมัติ",
  DOC_FOR_UNVERIFIED_PAYMENT: "มีเอกสารบัญชีที่อ้างอิงรายการซึ่งยังไม่ยืนยันรับเงิน",
};

/** สีชิปของสถานะรายการรับเงิน (MUI color) */
export function paymentStateTone(s: FinPaymentState): "warning" | "success" | "error" | "default" {
  return s === "PENDING_VERIFICATION" ? "warning" : s === "VERIFIED" ? "success" : s === "REJECTED" ? "error" : "default";
}
export function aggStateTone(s: FinAggState): "default" | "warning" | "success" {
  return s === "PAID" ? "success" : s === "PARTIALLY_PAID" ? "warning" : "default";
}

/** ปุ่มของรายการรับเงินตามสิทธิ์ + สถานะ (ตรงกับ FIN_PAYMENT_TRANSITIONS ของ backend) */
export function paymentActions(status: FinPaymentState, has: (p: string) => boolean): Array<"verify" | "reject" | "void" | "resubmit"> {
  const out: Array<"verify" | "reject" | "void" | "resubmit"> = [];
  if (status === "PENDING_VERIFICATION" && has("payments:verify")) out.push("verify", "reject");
  if (status === "VERIFIED" && has("payments:void")) out.push("void");
  if (status === "REJECTED" && has("payments:record")) out.push("resubmit");
  return out;
}

/** แจ้งชำระได้เฉพาะใบที่ลูกค้าอนุมัติแล้ว */
export function canRecordPayment(quotationStatus: string, has: (p: string) => boolean): boolean {
  return quotationStatus === "ACCEPTED" && has("payments:record");
}

/** ตรวจยอดเงินก่อนส่ง (backend ตรวจซ้ำ): > 0 และทศนิยมไม่เกิน 2 ตำแหน่ง */
export function parseFinAmount(raw: string): number | null {
  const s = String(raw ?? "").replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n <= 100_000_000 ? n : null;
}

/** คีย์กันบันทึกซ้ำ — คงที่ต่อการเปิดฟอร์มหนึ่งครั้ง (กดซ้ำ/ลองใหม่ไม่สร้างรายการซ้ำ) */
export function newIdempotencyKey(prefix = "fin"): string {
  const rnd =
    typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function"
      ? (crypto as any).randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${rnd}`;
}

/**
 * หน้าแรกหลังเข้าสู่ระบบ — ACC ไม่มีสิทธิ์ใบงาน/แดชบอร์ด จึงไปหน้าคิวรอตรวจสอบ (ถ้าตรวจได้) หรือสถานะรับชำระ
 */
export function landingPath(has: (p: string) => boolean): string {
  if (has("jobs:view")) return "/dashboard";
  if (has("payments:verify")) return "/finance/queue";
  if (has("finance:view")) return "/finance";
  if (has("quotations:view")) return "/quotations";
  return "/dashboard";
}

/** สถานะใบเสนอราคาที่ต้องระบุเหตุผล / หลักฐาน (ตรงกับ backend D-11 4.1) */
export const QUOTATION_REASON_REQUIRED = ["REJECTED", "CANCELLED"] as const;
export function quotationStatusNeedsInput(target: string): "reason" | "approval" | null {
  if (target === "ACCEPTED") return "approval";
  if ((QUOTATION_REASON_REQUIRED as readonly string[]).includes(target)) return "reason";
  return null;
}
