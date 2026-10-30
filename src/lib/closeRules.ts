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
export function closeReasons(s: { pending: string[]; missingEvidence: number; hasSignature: boolean; missingInstallDate?: string[] }): string[] {
  const out: string[] = [];
  if (s.missingEvidence > 0) out.push(`หลักฐานรายเครื่องยังไม่ครบ ${s.missingEvidence} เครื่อง`);
  if (s.pending.length > 0) out.push(`มีเครื่องที่ยังไม่บันทึกว่าเสร็จ ${s.pending.length} เครื่อง: ${s.pending.join(", ")}`);
  // D-10: งานติดตั้ง — เครื่องที่เสร็จแล้วต้องมีวันที่ติดตั้งจริง (ตรงกับกติกาฝั่งเซิร์ฟเวอร์)
  if (s.missingInstallDate?.length) out.push(`ยังไม่ระบุวันที่ติดตั้งเสร็จจริง ${s.missingInstallDate.length} เครื่อง: ${s.missingInstallDate.join(", ")}`);
  if (!s.hasSignature) out.push("ยังไม่มีลายเซ็นตรวจรับ");
  return out;
}

/** D-10: เครื่องที่บันทึกเสร็จแล้วแต่ยังไม่มีวันที่ติดตั้งจริง (เรียกเฉพาะงานติดตั้ง) */
export function linesMissingInstallDate<T extends { result?: string; installedOn?: string }>(lines: T[]): T[] {
  return lines.filter((l) => l.result === "DONE" && !String(l.installedOn ?? "").trim());
}
