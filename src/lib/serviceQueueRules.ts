// ---------------------------------------------------------------------------
// คิวช่าง (Chat & Queue v1) — กติกาฝั่งหน้าจอ (ฟังก์ชันบริสุทธิ์ ทดสอบด้วย node --test)
// ---------------------------------------------------------------------------
// หน้าจอซ่อน/แสดงปุ่มตามบทบาทและสถานะเพื่อความสะดวกเท่านั้น
// สิทธิ์จริงตรวจที่ backend ทุกครั้ง (DATA 01) — ฟังก์ชันชุดนี้ต้องตรงกับ backend/domain/serviceQueue.ts

import type { ParsedJobText } from "./jobTextParser";
import type { QueueFormValues, QueueItemInput } from "./serviceQueueApi";

// D-05: DRAFT = ร่างคิว (ยังไม่ส่ง) — เห็นเฉพาะผู้สร้าง ไม่นับเป็นงานค้าง
export type SqStatus = "DRAFT" | "WAIT_ASSIGN" | "WAIT_TECH" | "TECH_REPLIED" | "WAIT_CUSTOMER" | "READY_TO_OPEN" | "RELEASED" | "CANCELLED";
export type SqMode = "NEW" | "RESCHEDULE";
export type TimePeriod = "MORNING" | "LATE_MORNING" | "AFTERNOON" | "EVENING" | "NIGHT" | "UNDEFINED";
export type RoundStatus = "ACTIVE" | "CONFIRMED" | "RELEASED" | "SUPERSEDED" | "REJECTED" | "CANCELLED";
export type Tone = "success" | "warning" | "error" | "info" | "primary" | "neutral";

export const SQ_STATUS_LABEL: Record<SqStatus, string> = {
  DRAFT: "ร่าง (ยังไม่ส่งคิว)",
  WAIT_ASSIGN: "รอจัดช่าง",
  WAIT_TECH: "รอช่างตอบ",
  TECH_REPLIED: "ช่างตอบคิวแล้ว",
  WAIT_CUSTOMER: "รอลูกค้าคอนเฟิร์ม",
  // WF-01 v2: ลูกค้าคอนเฟิร์มแล้ว → Admin ตรวจและกดเปิด JN เสมอ (ไม่เปิดงานอัตโนมัติ)
  READY_TO_OPEN: "ลูกค้าคอนเฟิร์มแล้ว รอ Admin เปิดงาน",
  RELEASED: "ส่งเข้าระบบงานแล้ว",
  CANCELLED: "ยกเลิกคิว",
};

export const SQ_STATUS_TONE: Record<SqStatus, Tone> = {
  DRAFT: "neutral",
  WAIT_ASSIGN: "warning",
  WAIT_TECH: "info",
  TECH_REPLIED: "warning",
  WAIT_CUSTOMER: "primary",
  READY_TO_OPEN: "warning",
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
  ACCEPT_PROPOSAL: "Admin รับคิว",
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
  | "accept"
  | "confirm"
  | "requestNewDate"
  | "openJob"
  | "releaseReschedule"
  | "edit"
  | "cancel";

/**
 * ปุ่มที่แสดงตามบทบาทและสถานะ (QUEUE 03) — backend ตรวจซ้ำทุกปุ่ม
 * FB-08/09 + WF-01 v2: ช่างตอบ → Admin รับคิว (หรือขอวันใหม่) → เซลล์เจ้าของงาน/Admin คอนเฟิร์มลูกค้า
 * → Admin ตรวจและกดเปิด JN (READY_TO_OPEN) — ระบบไม่เปิดงานเองหลังคอนเฟิร์ม
 */
export function queueButtons(q: QueueForActions, v: Viewer): QueueButton[] {
  const admin = v.has("svcqueue:admin");
  const owner = admin || (v.has("svcqueue:request") && !!v.id && q.ownerSaleId === v.id);
  const assignedTech = v.has("svcqueue:respond") && !!v.id && q.techId === v.id;
  const out: QueueButton[] = [];
  // D-05: ร่างไม่มีปุ่มขั้นตอนคิว — ผู้สร้างแก้/ส่ง/ลบร่างจากฟอร์มร่าง
  if (q.status === "DRAFT") return out;
  const open = q.status !== "RELEASED" && q.status !== "CANCELLED";
  if (admin && q.status === "WAIT_ASSIGN") out.push("assign");
  if (admin && (q.status === "WAIT_TECH" || q.status === "TECH_REPLIED" || q.status === "WAIT_CUSTOMER" || q.status === "READY_TO_OPEN")) out.push("reassign");
  if (assignedTech && q.status === "WAIT_TECH") out.push("propose", "reject");
  if (admin && q.status === "TECH_REPLIED") out.push("accept", "requestNewDate");
  if (owner && q.status === "WAIT_CUSTOMER") out.push("confirm", "requestNewDate");
  if (admin && q.status === "READY_TO_OPEN") out.push(q.mode === "RESCHEDULE" ? "releaseReschedule" : "openJob");
  if (admin && open) out.push("edit");
  // คิวที่ผูก JN แล้วยกเลิกจากที่นี่ไม่ได้ (รอยืนยันกติกา) — จัดการที่ใบงานแทน
  if (admin && open && !q.jobId) out.push("cancel");
  return out;
}

/** ตัวกรองสถานะของการ์ดสรุปบน Dashboard (QUEUE 04) */
export const SUMMARY_BUCKETS: { key: "waitAssign" | "waitTech" | "techReplied" | "waitCustomer" | "readyToOpen" | "rescheduling"; label: string; query: string; tone: Tone }[] = [
  { key: "waitAssign", label: "รอจัดช่าง", query: "status=WAIT_ASSIGN", tone: "warning" },
  { key: "waitTech", label: "รอช่างตอบ", query: "status=WAIT_TECH", tone: "info" },
  { key: "techReplied", label: "ช่างตอบคิวแล้ว (รอ Admin รับคิว)", query: "status=TECH_REPLIED", tone: "warning" },
  { key: "waitCustomer", label: "รอคอนเฟิร์มลูกค้า", query: "status=WAIT_CUSTOMER", tone: "primary" },
  { key: "readyToOpen", label: "ลูกค้าคอนเฟิร์มแล้ว รอ Admin เปิดงาน", query: "status=READY_TO_OPEN", tone: "warning" },
  { key: "rescheduling", label: "งานรอเช็คคิวใหม่", query: "mode=RESCHEDULE&status=WAIT_ASSIGN,WAIT_TECH,TECH_REPLIED,WAIT_CUSTOMER,READY_TO_OPEN", tone: "warning" },
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


// ---------------------------------------------------------------------------
// D-05: ช่องที่ต้องครบก่อนส่งคิว (ตรงกับ backend queueCompletenessIssues — backend ตรวจซ้ำเสมอ)
// ---------------------------------------------------------------------------
export interface QueueFieldIssue {
  field: string;
  message: string;
}

/** ชื่อช่องที่ต้องกรอก (ใช้ติดดาว/ป้ายบังคับในฟอร์ม) */
export const QUEUE_REQUIRED_FIELDS = ["jobType", "jobName", "contactName", "phone", "address", "items"] as const;

const txt = (v: unknown) => String(v ?? "").trim();

/** เครื่องที่นับว่าระบุเครื่องได้: เครื่องในคลัง รุ่น หรือประเภทเครื่อง (หมายเหตุอย่างเดียวไม่นับ) */
export function identifiesMachine(it: Partial<QueueItemInput> | null | undefined): boolean {
  return !!it && !!(txt(it.equipmentId) || txt(it.model) || txt(it.machineType));
}

export function queueFormIssues(v: Partial<QueueFormValues> & { customerName?: string; storeName?: string }): QueueFieldIssue[] {
  const out: QueueFieldIssue[] = [];
  if (!txt(v.jobType)) out.push({ field: "jobType", message: "ต้องเลือกประเภทงาน" });
  else if (v.jobType === "INSTALL") out.push({ field: "jobType", message: "งานติดตั้งต้องเลือกประเภทย่อย เช่า ขาย หรือ เช่าซื้อ" });
  else if (v.jobType === "REMOVE" && !txt(v.jobSubType)) out.push({ field: "jobSubType", message: "งานซ่อมถอนต้องเลือกประเภทย่อย" });
  if (!txt(v.jobName) && !txt(v.customerName) && !txt(v.storeName)) out.push({ field: "jobName", message: "ต้องระบุชื่อร้าน/บริษัท/ลูกค้า" });
  if (!txt(v.contactName)) out.push({ field: "contactName", message: "ต้องระบุผู้ติดต่อ" });
  if (!txt(v.phone)) out.push({ field: "phone", message: "ต้องระบุเบอร์โทรผู้ติดต่อ" });
  if (!txt(v.address) && !txt(v.siteId)) out.push({ field: "address", message: "ต้องระบุที่อยู่ หรือเลือกสาขาจากฐานข้อมูลลูกค้า" });
  if (!(Array.isArray(v.items) ? v.items : []).some(identifiesMachine)) {
    out.push({ field: "items", message: "ต้องมีเครื่องอย่างน้อยหนึ่งรายการ (เลือกจากคลัง หรือระบุรุ่น/ประเภทเครื่อง)" });
  }
  if (v.jobType === "OTHER" && !txt(v.note)) out.push({ field: "note", message: "ประเภทงาน “อื่น ๆ” ต้องระบุรายละเอียดในหมายเหตุ" });
  return out;
}

/** D-05: กด Enter ในช่องกรอก (input) ต้องไม่ส่งฟอร์ม — textarea ขึ้นบรรทัดใหม่ได้ตามปกติ */
export function shouldBlockEnter(key: string, tagName: string | undefined | null): boolean {
  return key === "Enter" && String(tagName ?? "").toUpperCase() === "INPUT";
}

/** ป้ายเลขคิวที่แสดง — ร่างยังไม่มีเลขคิวจริง */
export function queueNoLabel(q: { status: string; queueNo: string }): string {
  return q.status === "DRAFT" ? "ร่างคิว (ยังไม่มีเลขคิว)" : q.queueNo;
}

// ---------------------------------------------------------------------------
// D-05: วางข้อความ LINE → ฟอร์มคิว (ใช้ parseJobText เดิม)
//   ใส่เฉพาะช่องที่ยังว่าง (ไม่ทับที่พิมพ์ไว้) · รุ่น/SN → รายการเครื่อง (SN ละหนึ่งเครื่อง)
//   ช่องที่ฟอร์มคิวไม่มี (วันที่ เวลา ทีมช่าง เซลล์ รหัสลูกค้า เครื่องกรอง ประเภทงานที่ตีความไม่ได้) → ต่อท้ายหมายเหตุ
// ---------------------------------------------------------------------------
export function queueFillFromPaste(
  p: Partial<ParsedJobText> | null | undefined,
  current: QueueFormValues
): { values: QueueFormValues; filled: string[] } {
  const v: QueueFormValues = { ...current, items: [...(current.items ?? [])] };
  const filled: string[] = [];
  if (!p) return { values: v, filled };
  const take = (k: "jobName" | "contactName" | "phone" | "mapLink", val: unknown, label: string) => {
    const t = txt(val);
    if (t && !txt(v[k])) {
      v[k] = t;
      filled.push(label);
    }
  };
  // ประเภทงานในฟอร์มคิวไม่มีงานซ่อมถอน (REMOVE) — ตีความได้ชัดเท่านั้นจึงเลือกให้
  let jobTypeUsed = false;
  if (!txt(v.jobType) && txt(p.jobType) && p.jobType !== "REMOVE") {
    v.jobType = txt(p.jobType);
    jobTypeUsed = true;
    filled.push("ประเภทงาน");
  }
  take("jobName", p.shopName, "ชื่อร้าน");
  take("contactName", p.contactName, "ผู้ติดต่อ");
  take("phone", p.phone, "เบอร์โทร");
  const link = txt(p.mapLink);
  if (/^https?:\/\//i.test(link)) take("mapLink", link, "ลิงก์ Map");
  else if (link && !txt(v.address)) {
    v.address = link;
    filled.push("ที่อยู่");
  }
  // เครื่อง: SN ละหนึ่งรายการ (รุ่นเดียวกันตามข้อความ) · ไม่มี SN แต่มีรุ่น = หนึ่งรายการ
  const isFilled = (it: QueueItemInput) => !!(txt(it.equipmentId) || txt(it.machineType) || txt(it.model) || txt(it.serial) || txt(it.note));
  const kept = v.items.filter(isFilled);
  const have = new Set(kept.map((it) => txt(it.serial).toUpperCase()).filter(Boolean));
  const model = txt(p.model);
  const serials = (Array.isArray(p.serials) ? p.serials : []).map(txt).filter(Boolean);
  const added: QueueItemInput[] = [];
  for (const s of serials) {
    if (have.has(s.toUpperCase())) continue;
    have.add(s.toUpperCase());
    added.push({ machineType: "", model, serial: s, note: "" });
  }
  if (!serials.length && model && !kept.some((it) => txt(it.model) === model)) added.push({ machineType: "", model, serial: "", note: "" });
  if (added.length) {
    v.items = [...kept, ...added].slice(0, 50);
    filled.push(`เครื่อง ${added.length} รายการ`);
  }
  // หมายเหตุ: ข้อความหมายเหตุ + ช่องที่ไม่มีในฟอร์มคิว
  const extra = [
    txt(p.note),
    !jobTypeUsed && txt(p.jobTypeRaw) ? `ประเภทงาน (จากข้อความ): ${txt(p.jobTypeRaw)}` : "",
    txt(p.customerCode) ? `รหัสลูกค้า: ${txt(p.customerCode)}` : "",
    txt(p.jobDate) ? `วันที่ลูกค้าแจ้ง: ${txt(p.jobDate)}` : "",
    txt(p.jobTime) ? `เวลาที่ลูกค้าแจ้ง: ${txt(p.jobTime)}` : "",
    txt(p.technicianTeam) ? `ทีมช่าง: ${txt(p.technicianTeam)}` : "",
    txt(p.salesPerson) ? `เซลล์: ${txt(p.salesPerson)}` : "",
    txt(p.filterUnit) ? `เครื่องกรองน้ำ: ${txt(p.filterUnit)}` : "",
  ].filter((line) => line && !txt(v.note).includes(line));
  if (extra.length) {
    v.note = [txt(v.note), ...extra].filter(Boolean).join("\n");
    filled.push("หมายเหตุ");
  }
  return { values: v, filled };
}

// ---------------------------------------------------------------------------
// D-15: ที่อยู่บนการ์ด — ตำบล · อำเภอ · จังหวัด ต่อท้ายที่อยู่เฉพาะส่วนที่ยังไม่อยู่ในที่อยู่ (กันแสดงซ้ำ) ข้ามค่าว่าง
// ---------------------------------------------------------------------------
export function placeText(address: string | undefined | null, parts: Array<string | undefined | null>): string {
  const addr = txt(address);
  const seen = new Set<string>();
  const rest = parts.map(txt).filter((x) => {
    if (!x || addr.includes(x) || seen.has(x)) return false;
    seen.add(x);
    return true;
  });
  return [addr, ...rest].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------
// D-21: วันนี้ตามเวลาไทย (ไม่ขึ้นกับเขตเวลาเครื่อง) — ใช้เป็นค่า min ของช่องวันที่เสนอ
// ---------------------------------------------------------------------------
export function bangkokTodayISO(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

export function isPastBangkokDate(date: string, now: Date = new Date()): boolean {
  return !!date && date < bangkokTodayISO(now);
}

// ---------------------------------------------------------------------------
// D-12: เลือกหลายรายการ PM เสนอคิวเดียว — ต้องเป็นสาขาเดียวกันและมีสาขา
// ---------------------------------------------------------------------------
export function pmSelectionError(items: Array<{ siteId?: string; planId?: string }>): string | null {
  if (items.length <= 1) return null;
  if (new Set(items.map((i) => txt(i.planId))).size > 1) return "เลือกรวมได้เฉพาะรายการในตาราง PM เดียวกัน";
  if (items.some((i) => !txt(i.siteId))) return "ต้องระบุสาขา — รายการที่ไม่มีสาขาเสนอรวมกับรายการอื่นไม่ได้";
  if (new Set(items.map((i) => txt(i.siteId))).size > 1) return "รวมในคิวเดียวได้เฉพาะเครื่องของสาขาเดียวกัน";
  return null;
}

// ---------------------------------------------------------------------------
// D-19: ป้ายแยกเครื่องรุ่นเดียวกัน — ตรงกับ backend machineIdentLabels (ใช้กับหน้า /m ที่โหลดแถวเครื่องของใบงานเอง)
//   "#ลำดับ · ท้าย SN 4 ตัว" (ชนกันยืดจนต่าง) · ไม่มี SN → "ไม่มี SN" · SN ซ้ำ → "SN ซ้ำ ตรวจสอบ"
// ---------------------------------------------------------------------------
export function machineIdentLabels(items: Array<{ serial?: string; internalCode?: string }>): string[] {
  const values = items.map((it) => (txt(it.serial) || txt(it.internalCode)).toUpperCase());
  const tail = (v: string, n: number) => (n >= v.length ? v : v.slice(-n));
  return values.map((v, i) => {
    const n = i + 1;
    if (!v) return `#${n} · ไม่มี SN`;
    const others = values.filter((w, j) => j !== i && !!w);
    if (others.includes(v)) return `#${n} · SN ซ้ำ ตรวจสอบ`;
    let len = Math.min(4, v.length);
    while (len < v.length && others.some((w) => tail(w, len) === tail(v, len))) len++;
    return `#${n} · ${len < v.length ? "…" : ""}${tail(v, len)}`;
  });
}
