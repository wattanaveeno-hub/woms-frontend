// FB-21 — สถานะใบเสนอราคาที่แก้ไขได้ (ต้องตรงกับ backend QUOTATION_EDITABLE_STATUSES)
// ตอบรับแล้ว (ACCEPTED) และยกเลิกแล้ว (CANCELLED) แก้ไม่ได้ — ไม่เปิดสิทธิ์เกินกฎเดิม
export const QUOTATION_EDITABLE_STATUSES = ["DRAFT", "SENT", "REJECTED", "EXPIRED"] as const;

export function quotationEditable(status: string): boolean {
  return (QUOTATION_EDITABLE_STATUSES as readonly string[]).includes(status);
}
