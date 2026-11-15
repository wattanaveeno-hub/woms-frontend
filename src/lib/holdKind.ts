// UAT2-14: แยก "เลื่อนวันเข้า (รอเช็คคิวใหม่)" ออกจาก "พักงาน" ในการแสดงผล
//   ไม่มีสถานะใหม่ในระบบ — ใบงานที่ถูกเลื่อนผ่าน "แจ้งเลื่อนงาน" ยังเป็น HOLD ตามเดิม (backend rescheduleJob)
//   แต่เหตุผลขึ้นต้นด้วย "รอเช็คคิวใหม่:" ซึ่ง backend ใส่ให้เสมอ → ใช้แยกป้ายและเหตุผลที่แสดง
export const RESCHEDULE_HOLD_PREFIX = "รอเช็คคิวใหม่:";

export type HoldKind = "RESCHEDULE" | "HOLD" | null;

export function holdKindOf(job: { status?: string; holdReason?: string | null }): HoldKind {
  if (job.status !== "HOLD") return null;
  return String(job.holdReason ?? "").trim().startsWith(RESCHEDULE_HOLD_PREFIX) ? "RESCHEDULE" : "HOLD";
}

/** ป้ายสถานะสำหรับแสดง */
export function holdLabelOf(job: { status?: string; holdReason?: string | null }): string | null {
  const k = holdKindOf(job);
  return k === "RESCHEDULE" ? "เลื่อนวันเข้า · รอเช็คคิวใหม่" : k === "HOLD" ? "พักงาน" : null;
}

/** เหตุผลโดยตัดคำนำหน้าระบบออก */
export function holdReasonText(job: { holdReason?: string | null }): string {
  const r = String(job.holdReason ?? "").trim();
  return r.startsWith(RESCHEDULE_HOLD_PREFIX) ? r.slice(RESCHEDULE_HOLD_PREFIX.length).trim() : r;
}
