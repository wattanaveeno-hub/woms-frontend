// FB-21 + D-11 4.1 — สถานะใบเสนอราคาที่แก้ไขได้ (ต้องตรงกับ backend QUOTATION_EDITABLE_STATUSES)
// DRAFT แก้ในฉบับเดิม · SENT/ACCEPTED/REJECTED/EXPIRED แก้แล้วได้ Revision ใหม่ (ฉบับเดิมเก็บไว้) · CANCELLED แก้ไม่ได้
export const QUOTATION_EDITABLE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;
export const QUOTATION_REVISION_STATUSES = ["SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;

export function quotationEditable(status: string): boolean {
  return (QUOTATION_EDITABLE_STATUSES as readonly string[]).includes(status);
}

/** แก้ไขแล้วจะได้ Revision ใหม่หรือไม่ */
export function quotationEditCreatesRevision(status: string): boolean {
  return (QUOTATION_REVISION_STATUSES as readonly string[]).includes(status);
}
