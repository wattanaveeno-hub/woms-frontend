// ---------------------------------------------------------------------------
// คิวช่าง (Chat & Queue v1) — กติกาฝั่งหน้าจอ (ฟังก์ชันบริสุทธิ์ ทดสอบด้วย node --test)
// ---------------------------------------------------------------------------
// หน้าจอซ่อน/แสดงปุ่มตามบทบาทและสถานะเพื่อความสะดวกเท่านั้น
// สิทธิ์จริงตรวจที่ backend ทุกครั้ง (DATA 01) — ฟังก์ชันชุดนี้ต้องตรงกับ backend/domain/serviceQueue.ts

export type SqStatus = "WAIT_ASSIGN" | "WAIT_TECH" | "WAIT_CUSTOMER" | "READY_TO_OPEN" | "RELEASED" | "CANCELLED";
export type SqMode = "NEW" | "RESCHEDULE";
export type TimePeriod = "MORNING" | "LATE_MORNING" | "AFTERNOON" | "EVENING" | "NIGHT" | "UNDEFINED";
export type RoundStatus = "ACTIVE" | "CONFIRMED" | "RELEASED" | "SUPERSEDED" | "REJECTED" | "CANCELLED";
export type Tone = "success" | "warning" | "error" | "info" | "primary" | "neutral";

export const SQ_STATUS_LABEL: Record<SqStatus, string> = {
  WAIT_ASSIGN: "รอจัดช่าง",
  WAIT_TECH: "รอช่างตอบ",
  WAIT_CUSTOMER: "รอลูกค้าคอนเฟิร์ม",
  READY_TO_OPEN: "รอ Admin เปิดงาน",
  RELEASED: "ส่งเข้าระบบงานแล้ว",
  CANCELLED: "ยกเลิกคิว",
};

export const SQ_STATUS_TONE: Record<SqStatus, Tone> = {
  WAIT_ASSIGN: "warning",
  WAIT_TECH: "info",
  WAIT_CUSTOMER: "primary",
  READY_TO_OPEN: "error",
  RELEASED: "success",
  CANCELLED: "neutral",
};

export const ROUND_STATUS_LABEL: Record<RoundStatus, string> = {
  ACTIVE: "รอบปัจจุบัน",
  CONFIRMED: "ลูกค้าคอนเฟิร์มแล้ว",
  RELEASED: "ใช้งานในใบงาน",
  SUPERSEDED: "ถูกแทนด้วยรอบใหม่",
  REJECTED: "ช่างไม่รับคิว",
  CANCELLED: "ยกเลิก",
};

export const TIME_PERIOD_LABEL: Record<TimePeriod, string> = {
  MORNING: "เช้า",
  LATE_MORNING: "สาย",
  AFTERNOON: "บ่าย",
  EVENING: "เย็น",
  NIGHT: "กลางคืน",
  UNDEFINED: "นอกช่วงที่กำหนด (รอยืนยัน)",
};

export const SQ_ACTION_LABEL: Record<string, string> = {
  CREATE: "เปิดคิว",
  EDIT: "แก้ไขข้อมูลคิว",
  ASSIGN: "จัดช่าง",
  REASSIGN: "เปลี่ยนช่าง",
  PROPOSE: "ช่างเสนอวันเวลา",
  REJECT: "ช่างไม่สะดวกรับคิว",
  CONFIRM: "ลูกค้าคอนเฟิร์ม",
  REQUEST_NEW_DATE: "ขอคิวใหม่",
  OPEN_JOB: "Admin เปิดงาน",
  RELEASE_RESCHEDULE: "Admin ยืนยันส่งงานเดิมกลับ",
  RESCHEDULE: "เลื่อนงานกลับเข้าคิว",
  CANCEL: "ยกเลิกคิว",
};

/**
 * ป้ายช่วงเวลาจากเวลาเริ่ม (HH:mm เวลาไทย) — ตรงกับ backend timePeriodOf()
 * ใช้แสดงผลทันทีขณะช่างเลือกเวลา ค่าที่บันทึกจริงคำนวณที่ backend
 * 00:00–04:59 ยังไม่ยืนยันว่าเป็นกลางคืน → UNDEFINED
 */
export function timePeriodOf(time: string, nightIncludesEarly = false): TimePeriod | "" {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((time ?? "").trim());
  if (!m) return "";
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  if (minutes >= 20 * 60) return "NIGHT";
  if (minutes >= 17 * 60) return "EVENING";
  if (minutes >= 13 * 60) return "AFTERNOON";
  if (minutes >= 10 * 60) return "LATE_MORNING";
  if (minutes >= 5 * 60) return "MORNING";
  return nightIncludesEarly ? "NIGHT" : "UNDEFINED";
}

export interface QueueForActions {
  status: SqStatus;
  mode: SqMode;
  ownerSaleId: string;
  techId: string;
  jobId: string;
}

export interface Viewer {
  id: string;
  has: (perm: string) => boolean;
}

export type QueueButton =
  | "assign"
  | "reassign"
  | "propose"
  | "reject"
  | "confirm"
  | "requestNewDate"
  | "openJob"
  | "releaseReschedule"
  | "edit"
  | "cancel";

/** ปุ่มที่แสดงตามบทบาทและสถานะ (QUEUE 03) — backend ตรวจซ้ำทุกปุ่ม */
export function queueButtons(q: QueueForActions, v: Viewer): QueueButton[] {
  const admin = v.has("svcqueue:admin");
  const owner = admin || (v.has("svcqueue:request") && !!v.id && q.ownerSaleId === v.id);
  const assignedTech = v.has("svcqueue:respond") && !!v.id && q.techId === v.id;
  const out: QueueButton[] = [];
  const open = q.status !== "RELEASED" && q.status !== "CANCELLED";
  if (admin && q.status === "WAIT_ASSIGN") out.push("assign");
  if (admin && (q.status === "WAIT_TECH" || q.status === "WAIT_CUSTOMER" || q.status === "READY_TO_OPEN")) out.push("reassign");
  if (assignedTech && q.status === "WAIT_TECH") out.push("propose", "reject");
  if (owner && q.status === "WAIT_CUSTOMER") out.push("confirm", "requestNewDate");
  if (admin && q.status === "READY_TO_OPEN") out.push(q.mode === "RESCHEDULE" ? "releaseReschedule" : "openJob");
  if (admin && open) out.push("edit");
  // คิวที่ผูก JN แล้วยกเลิกจากที่นี่ไม่ได้ (รอยืนยันกติกา) — จัดการที่ใบงานแทน
  if (admin && open && !q.jobId) out.push("cancel");
  return out;
}

/** ตัวกรองสถานะของการ์ดสรุปบน Dashboard (QUEUE 04) */
export const SUMMARY_BUCKETS: { key: "waitAssign" | "waitTech" | "waitCustomer" | "readyToOpen" | "rescheduling"; label: string; query: string; tone: Tone }[] = [
  { key: "waitAssign", label: "รอจัดช่าง", query: "status=WAIT_ASSIGN", tone: "warning" },
  { key: "waitTech", label: "รอช่างตอบ", query: "status=WAIT_TECH", tone: "info" },
  { key: "waitCustomer", label: "รอคอนเฟิร์มลูกค้า", query: "status=WAIT_CUSTOMER", tone: "primary" },
  { key: "readyToOpen", label: "รอ Admin เปิดงาน", query: "status=READY_TO_OPEN", tone: "error" },
  { key: "rescheduling", label: "งานรอเช็คคิวใหม่", query: "mode=RESCHEDULE&status=WAIT_ASSIGN,WAIT_TECH,WAIT_CUSTOMER,READY_TO_OPEN", tone: "warning" },
];

export const CHECK_QUEUE_GROUP = "CHECK_QUEUE";

/** ขนาดไฟล์อ่านง่าย */
export function fileSizeLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** ตรวจไฟล์ก่อนอัปโหลด (ฝั่งหน้าจอ) ตามนโยบายที่ backend ส่งมา — backend ตรวจซ้ำเสมอ */
export function checkFiles(
  files: { name: string; type: string; size: number }[],
  policy: { mime: string[]; maxFileBytes: number; maxFiles: number; maxTotalBytes: number }
): string | null {
  if (files.length > policy.maxFiles) return `แนบไฟล์ได้สูงสุด ${policy.maxFiles} ไฟล์ต่อข้อความ`;
  let total = 0;
  for (const f of files) {
    if (!policy.mime.includes((f.type || "").toLowerCase())) return `ไม่รองรับไฟล์ "${f.name}" (รองรับ: รูปภาพ JPG/PNG/WEBP/GIF และ PDF)`;
    if (f.size > policy.maxFileBytes) return `ไฟล์ "${f.name}" ใหญ่เกิน ${fileSizeLabel(policy.maxFileBytes)}`;
    total += f.size;
  }
  if (total > policy.maxTotalBytes) return `ไฟล์รวมกันใหญ่เกิน ${fileSizeLabel(policy.maxTotalBytes)}`;
  return null;
}

/** เวลาไทยแบบสั้นสำหรับแชท (ไม่ขึ้นกับเขตเวลาของเครื่อง) */
export function bangkokTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t + 7 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
}
