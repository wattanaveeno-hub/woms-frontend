// กติกาปิดงานฝั่งหน้าเว็บ (VFB 28/9/69 แถว 7–9) — ใช้แสดงเหตุผลก่อนกด เซิร์ฟเวอร์ตรวจซ้ำเสมอ
import type { JobEquipmentLine } from "@/lib/types";

/** แถว 9: "เสร็จ" = result DONE เท่านั้น */
export function lineIsDone(l: Pick<JobEquipmentLine, "result">): boolean {
  return l.result === "DONE";
}

/** แถว 7: ส่วน SN ครบเมื่อมีรูป SN หรือเลขใบส่งสินค้า/IV อ้างอิง */
export function lineHasSnEvidence(l: { snPhotos?: string[]; noSnRef?: { docNo?: string } | null }): boolean {
  return (l.snPhotos ?? []).length > 0 || Boolean(l.noSnRef && (l.noSnRef.docNo ?? "").trim());
}

/** เหตุผลที่ยังปิดใบงานไม่ได้ (ว่าง = ปิดได้) */
export function closeReasons(s: { pending: string[]; missingEvidence: number; hasSignature: boolean }): string[] {
  const out: string[] = [];
  if (s.missingEvidence > 0) out.push(`หลักฐานรายเครื่องยังไม่ครบ ${s.missingEvidence} เครื่อง`);
  if (s.pending.length > 0) out.push(`มีเครื่องที่ยังไม่บันทึกว่าเสร็จ ${s.pending.length} เครื่อง: ${s.pending.join(", ")}`);
  if (!s.hasSignature) out.push("ยังไม่มีลายเซ็นตรวจรับ");
  return out;
}
