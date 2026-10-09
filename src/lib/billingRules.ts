// ---------------------------------------------------------------------------
// กติกาแสดงผลวางบิล/การจ่าย (pure — ทดสอบด้วย node --test ได้)
// ---------------------------------------------------------------------------

/** DEF-06 — ป้ายสถานะรายการชำระ (ไม่แสดง enum ดิบบนหน้าจอ) */
export const PAYMENT_RECORD_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "มีผล",
  VOID: "ยกเลิกแล้ว",
};
export function paymentRecordStatusLabel(s: string | undefined): string {
  return PAYMENT_RECORD_STATUS_LABELS[String(s ?? "")] ?? String(s ?? "-");
}

/**
 * DEF-03 — หลักฐานของรายการชำระแต่ละรายการ (BILL-06)
 * คืนค่าเฉพาะ data URL ของรูปหรือ PDF เท่านั้น (กันลิงก์ประเภทอื่น เช่น data:text/html)
 */
export function paymentEvidenceSrc(p: { evidence?: string } | null | undefined): string | null {
  const v = String(p?.evidence ?? "");
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v) || /^data:application\/pdf;base64,/i.test(v)) return v;
  return null;
}

/**
 * DEF-02 — "ช่างยืนยันรับเงินแล้ว" มีความหมายเฉพาะบิลที่ยังจ่ายครบ (PAID)
 * ถ้ายอดถูกแก้จนกลับเป็นรอจ่าย การยืนยันเดิมไม่ใช้กับยอดใหม่
 */
export function isReceiptConfirmed(b: { status: string; receivedConfirmedAt?: string }): boolean {
  return b.status === "PAID" && !!b.receivedConfirmedAt;
}
