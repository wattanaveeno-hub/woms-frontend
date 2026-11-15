// BD-04 — ป้ายสถานะงวดสัญญาในหน้าการเงิน (ไม่มี import ภายนอก ใช้ทดสอบด้วย node --test ได้)
export type InstallmentPayState = "UNPAID" | "PARTIAL" | "PAID";
export type InstallmentDocStatus = "ISSUED" | "NOT_ISSUED" | "NOT_DUE";
export type Tone = "success" | "warning" | "error" | "info" | "primary" | "neutral";

export function installmentPayLabel(x: { paymentState: InstallmentPayState; overdue: boolean }): string {
  if (x.paymentState === "PAID") return "ชำระครบ";
  if (x.overdue) return x.paymentState === "PARTIAL" ? "ชำระบางส่วน · เลยกำหนด" : "เลยกำหนด";
  return x.paymentState === "PARTIAL" ? "ชำระบางส่วน" : "รอชำระ";
}

export function installmentPayTone(x: { paymentState: InstallmentPayState; overdue: boolean }): Tone {
  if (x.paymentState === "PAID") return "success";
  if (x.overdue) return "error";
  return x.paymentState === "PARTIAL" ? "warning" : "neutral";
}

export function installmentDocLabel(d: InstallmentDocStatus): string {
  return d === "ISSUED" ? "ออกใบเสร็จแล้ว" : d === "NOT_ISSUED" ? "ยังไม่ออกใบเสร็จ" : "—";
}
