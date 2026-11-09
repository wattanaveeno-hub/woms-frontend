// ---------------------------------------------------------------------------
// ตาราง PM รายเดือน (WOMS_PM_Monthly_Requirements_2026-11-09) — กติกาฝั่งหน้าเว็บ (ฟังก์ชันบริสุทธิ์ · node --test)
//   สถานะคำนวณที่ backend เท่านั้น — ไฟล์นี้แปลงค่าเป็นข้อความ/ตัวเลือก/ลำดับการแสดงผล
// ---------------------------------------------------------------------------
export const PM_ROUND_STATUSES = ["OVERDUE", "DUE", "UPCOMING", "LATER", "DONE", "NEEDS_REVIEW"] as const;
export type PmRoundStatus = (typeof PM_ROUND_STATUSES)[number];

/** ป้ายสถานะ (Handoff ส่วนที่ 2) — โทนสีอยู่ที่ PmRoundStatusChip (WomsStatusChip.tsx) */
export const PM_ROUND_STATUS_LABEL: Record<PmRoundStatus, string> = {
  OVERDUE: "ค้างจากเดือนก่อน",
  DUE: "ถึงรอบเดือนนี้",
  UPCOMING: "ใกล้ถึงรอบ",
  LATER: "ยังไม่ถึงรอบ",
  DONE: "ทำแล้ว",
  NEEDS_REVIEW: "รอตรวจข้อมูล",
};
export type PmRoundTone = "error" | "warning" | "info" | "neutral" | "success";
export const PM_ROUND_STATUS_TONE: Record<PmRoundStatus, PmRoundTone> = {
  OVERDUE: "error",
  DUE: "warning",
  UPCOMING: "info",
  LATER: "neutral",
  DONE: "success",
  NEEDS_REVIEW: "neutral",
};
/** ตัวเลือก "ตามสถานะ" ในตัวกรองรอบ PM (ข้อความสั้นตาม mockup) */
export const PM_PERIOD_STATUS_OPTIONS: { value: PmRoundStatus; label: string }[] = [
  { value: "OVERDUE", label: "งานค้าง" },
  { value: "DUE", label: "ถึงรอบเดือนนี้" },
  { value: "UPCOMING", label: "ใกล้ถึงรอบ" },
  { value: "LATER", label: "ยังไม่ถึงรอบ" },
  { value: "DONE", label: "ทำแล้ว" },
  { value: "NEEDS_REVIEW", label: "รอตรวจข้อมูล" },
];

const TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const YM = /^(\d{4})-(0[1-9]|1[0-2])$/;
const YMD = /^(\d{4})-(0[1-9]|1[0-2])-(\d{2})$/;

/** "2026-11" → "พ.ย. 2569" (full = "พฤศจิกายน 2569") · ไม่มีค่า = "ยังคำนวณไม่ได้" */
export function monthLabel(ym: string, full = false): string {
  const m = YM.exec(ym ?? "");
  if (!m) return "ยังคำนวณไม่ได้";
  return `${(full ? TH_FULL : TH_SHORT)[Number(m[2]) - 1]} ${Number(m[1]) + 543}`;
}
/** ป้ายเดือนสั้นในหัวกลุ่ม ("พ.ย.") */
export function monthBadge(ym: string): string {
  const m = YM.exec(ym ?? "");
  return m ? TH_SHORT[Number(m[2]) - 1] : "?";
}
/** "2026-11-12" → "12 พ.ย. 2569" */
export function dateLabel(ymd: string): string {
  const m = YMD.exec(ymd ?? "");
  if (!m) return "–";
  return `${Number(m[3])} ${TH_SHORT[Number(m[2]) - 1]} ${Number(m[1]) + 543}`;
}
/** ช่วงใกล้ถึงรอบ (เดือนถัดไป 1–2 เดือน) สำหรับข้อความใต้การ์ด เช่น "ธ.ค. 69 – ม.ค. 70" */
export function addMonth(ym: string, n: number): string {
  const m = YM.exec(ym ?? "");
  if (!m) return "";
  const i = Number(m[1]) * 12 + Number(m[2]) - 1 + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}
export function shortYearMonth(ym: string): string {
  const m = YM.exec(ym ?? "");
  if (!m) return "";
  return `${TH_SHORT[Number(m[2]) - 1]} ${String(Number(m[1]) + 543).slice(-2)}`;
}

export type PmView = "overview" | "technicians";
export interface PmRoundFilters {
  view: PmView;
  period: string;
  technicianId: string;
  /** v1.2 PM-06: คำค้น (ภาพรวม) */
  q: string;
}
export const PM_SEARCH_MAX = 64;
/** คำค้นจาก URL/ช่องค้นหา: ตัดช่องว่างซ้ำ ตัดอักขระควบคุม ยาวไม่เกิน 64 */
export function cleanSearch(v: string | null | undefined): string {
  return String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PM_SEARCH_MAX);
}
/** อ่านตัวกรองจาก URL (ค่าผิดรูปแบบ = ค่าเริ่มต้น · PM-01 เปิดที่ภาพรวม + ทุกเดือน) */
export function parseRoundFilters(q: { get(name: string): string | null }): PmRoundFilters {
  const view = q.get("view") === "technicians" ? "technicians" : "overview";
  const p = q.get("period") ?? "";
  const period = (PM_ROUND_STATUSES as readonly string[]).includes(p) || YM.test(p) ? p : "";
  const t = (q.get("tech") ?? "").trim();
  const technicianId = /^[A-Za-z0-9_-]{1,64}$/.test(t) ? t : "";
  return { view, period, technicianId, q: cleanSearch(q.get("q")) };
}
export function filtersToQuery(f: PmRoundFilters): string {
  const p = new URLSearchParams();
  if (f.view !== "overview") p.set("view", f.view);
  if (f.period) p.set("period", f.period);
  if (f.technicianId) p.set("tech", f.technicianId);
  if (f.q) p.set("q", f.q);
  const s = p.toString();
  return s ? `?${s}` : "";
}
/** กดการ์ดสถานะ: กดครั้งแรก = กรองสถานะนั้น · กดซ้ำ = กลับเป็นทุกเดือน (2.1) */
export function togglePeriod(current: string, status: string): string {
  return current === status ? "" : status;
}

/** ตัวเลือกตัวกรองรอบ PM: ทุกเดือน · ตามสถานะ · ตามเดือน (เดือนจาก API) */
export function periodOptionGroups(months: string[]) {
  return [
    { label: "ตามสถานะ", options: PM_PERIOD_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
    { label: "ตามเดือน", options: [...new Set(months)].filter((m) => YM.test(m)).sort().map((m) => ({ value: m, label: monthLabel(m, true) })) },
  ];
}

export type PmRoundType = "RENTAL" | "PACKAGE" | "INTERVAL_ONLY";
export const PM_ROUND_TYPE_LABEL: Record<PmRoundType, string> = { RENTAL: "เครื่องเช่า", PACKAGE: "เครื่องซื้อแพ็กเกจ", INTERVAL_ONLY: "ตั้งรอบอย่างเดียว" };
/** "เหลือ X รอบ" — null = ไม่มีตัวเลข (เครื่องเช่าล้วน / ตั้งรอบอย่างเดียว) · zero = ใช้สีอันตราย */
export function remainingText(pkg: { remaining: number } | null | undefined): { text: string; zero: boolean } | null {
  if (!pkg) return null;
  const n = Math.max(0, Number(pkg.remaining) || 0);
  return { text: `เหลือ ${n} รอบ`, zero: n === 0 };
}

export const OWNER_SOURCE_LABEL: Record<string, string> = {
  ADMIN: "Admin กำหนด",
  LATEST_SERVICE: "ช่างที่เข้าบริการล่าสุด",
  INSTALLER: "ช่างผู้ติดตั้ง",
  NONE: "ยังไม่มีประวัติช่าง",
};

/** ข้อความช่องช่างในแถว */
export function techCell(row: { status: string; roundTech: { name: string; source: string } | null }): { text: string; unassigned: boolean; roundOnly: boolean } {
  if (!row.roundTech || !row.roundTech.name) return { text: row.status === "DONE" ? "–" : "ระบุช่าง", unassigned: row.status !== "DONE", roundOnly: false };
  return { text: row.roundTech.name, unassigned: false, roundOnly: row.roundTech.source === "ADMIN_ROUND" };
}

export const REASSIGN_REASON_MAX = 160;
/** ตรวจฟอร์มเปลี่ยนช่างฝั่งหน้าเว็บ (backend ตรวจซ้ำ) */
export function reassignFormError(v: { scope: string; technicianId: string; reason: string }): { field: "reason" | "technicianId"; message: string } | null {
  if (!v.reason.trim()) return { field: "reason", message: "กรุณาระบุเหตุผลที่เปลี่ยนช่าง" };
  if (v.reason.trim().length > REASSIGN_REASON_MAX) return { field: "reason", message: `เหตุผลยาวได้ไม่เกิน ${REASSIGN_REASON_MAX} ตัวอักษร` };
  if (v.scope === "ROUND_ONLY" && !v.technicianId) return { field: "technicianId", message: "ย้ายเฉพาะรอบนี้ต้องเลือกช่าง" };
  return null;
}

// ---------------------------------------------------------------------------
// v1.2 — หมายเหตุลูกค้า · นัด PM ก่อนรอบ · ป้ายสถานะ · เสนอคิวจากแถว
// ---------------------------------------------------------------------------
export const PM_NOTE_MAX = 200;
export function noteFormError(note: string): string | null {
  return note.trim().length > PM_NOTE_MAX ? `หมายเหตุยาวได้ไม่เกิน ${PM_NOTE_MAX} ตัวอักษร` : null;
}

export type PmPlanModeKey = "KEEP_PLAN" | "SHIFT_ACTUAL";
export const PM_PLAN_MODE_LABEL: Record<PmPlanModeKey, string> = { KEEP_PLAN: "คงรอบตามแผน", SHIFT_ACTUAL: "ขยับตามวันที่ทำจริง" };

/** ป้ายสถานะของแถว: ทำแล้วก่อนเดือนตามแผน = "ทำแล้ว · เข้าก่อนรอบ" (PM-07) */
export function statusText(r: { status: PmRoundStatus; earlyDone?: boolean }): string {
  return r.status === "DONE" && r.earlyDone ? "ทำแล้ว · เข้าก่อนรอบ" : PM_ROUND_STATUS_LABEL[r.status];
}

/** ตัวอย่างผลต่อรอบถัดไป (ก่อน Admin ยืนยัน) — สูตรเดียวกับ backend earlyPreview */
export function earlyPreviewOf(v: { plannedMonth: string; dueDate: string; intervalMonths: number; currentMonth: string }) {
  const n = Number(v.intervalMonths) || 0;
  const plannedBase = YMD.test(v.dueDate) ? v.dueDate.slice(0, 7) : v.plannedMonth;
  return {
    plannedMonth: v.plannedMonth,
    workMonth: v.currentMonth,
    keepPlanNext: n > 0 ? addMonth(plannedBase, n) : "",
    shiftActualNextIfDoneInWorkMonth: n > 0 ? addMonth(v.currentMonth, n) : "",
    unscheduledKeepsPlan: v.plannedMonth,
  };
}

/** ใช้แทนรอบเดิมได้เมื่อเดือนตามแผนอยู่หลังเดือนนี้ (เครื่องที่มีรอบในอนาคต) */
export function canPullEarly(r: { kind?: string; status: string; plannedMonth?: string; roundMonth: string; earlyMode?: string; entitlementEnded: boolean; serviceStopped: boolean }, currentMonth: string): boolean {
  if (r.kind === "UNSCHEDULED" || r.status === "DONE" || r.status === "NEEDS_REVIEW" || r.serviceStopped) return false;
  const planned = r.plannedMonth || r.roundMonth;
  return YM.test(planned) && YM.test(currentMonth) && planned > currentMonth;
}

export interface EarlyForm {
  requestType: "REPLACE" | "UNSCHEDULED" | "";
  planMode: PmPlanModeKey | "";
  reason: string;
}
export function earlyFormError(v: EarlyForm): { field: "requestType" | "planMode" | "reason"; message: string } | null {
  if (!v.requestType) return { field: "requestType", message: "เลือกประเภทคำขอ" };
  if (v.requestType === "REPLACE" && !v.planMode) return { field: "planMode", message: "เลือกวิธีวางแผนรอบถัดไป" };
  if (!v.reason.trim()) return { field: "reason", message: "กรุณาระบุเหตุผลที่ขอเข้าก่อน" };
  if (v.reason.trim().length > REASSIGN_REASON_MAX) return { field: "reason", message: `เหตุผลยาวได้ไม่เกิน ${REASSIGN_REASON_MAX} ตัวอักษร` };
  return null;
}

/** ข้อความแทนปุ่มเสนอคิว (ช่างของรอบที่ยังเสนอไม่ได้) */
export const PROPOSE_BLOCK_TEXT: Record<string, string> = {
  OWNER_UNCONFIRMED: "รอ Admin ยืนยันผู้ดูแลก่อนเสนอคิว",
  NOT_DUE: "ยังไม่ถึงรอบ",
  HAS_WORK: "",
  STOPPED: "หยุดบริการ",
};
