// ---------------------------------------------------------------------------
// ตัวเลือกตัวกรองและป้ายของหน้า Audit Log — ฟังก์ชันบริสุทธิ์ (ทดสอบด้วย node --test)
// ต้องครบตาม AUDIT_ACTIONS / AUDIT_ENTITIES / ROLE_LABELS ของ backend (src/domain/audit.ts, src/domain/user.ts)
// ---------------------------------------------------------------------------
import type { AuditAction, AuditEntity, AuditLog, AuditResult, Role } from "./types";

export const AUDIT_ENTITY_OPTIONS: Array<{ value: AuditEntity; label: string }> = [
  { value: "auth", label: "การเข้าสู่ระบบ" },
  { value: "users", label: "ผู้ใช้งาน" },
  { value: "jobs", label: "ใบงาน" },
  { value: "equipment", label: "เครื่อง" },
  { value: "customer_sites", label: "สาขาลูกค้า" },
  { value: "partners", label: "คู่ค้า/ลูกค้า" },
  { value: "contracts", label: "สัญญาเช่า" },
  { value: "quotations", label: "ใบเสนอราคา" },
  { value: "documents", label: "เอกสารขาย" },
  { value: "pm_schedules", label: "ตาราง PM" },
  { value: "parts", label: "อะไหล่" },
  { value: "stock", label: "สต๊อก" },
  { value: "tech_bills", label: "วางบิลช่าง" },
  { value: "master", label: "ข้อมูลตั้งค่า" },
  // DEF-10
  { value: "change_requests", label: "คำขออนุมัติ" },
  { value: "service_queues", label: "คิวช่าง" },
  { value: "group_chat", label: "แชทกลุ่ม" },
  { value: "job_drafts", label: "ร่างใบงาน" },
  { value: "equipment_models", label: "รุ่นเครื่อง (ข้อมูลหลัก)" },
  // D-11 Financial Workflow v1.0
  { value: "quotation_payments", label: "รายการรับเงิน (ใบเสนอราคา)" },
  { value: "accounting_documents", label: "เอกสารบัญชี" },
  // Activity Log (slice act)
  { value: "audit", label: "ประวัติการใช้งาน" },
  { value: "settings", label: "ตั้งค่าระบบ" },
  { value: "system", label: "ระบบ/สคริปต์" },
  { value: "queue_bookings", label: "ตาราง slot/การจองคิว" },
];

export const AUDIT_ACTION_OPTIONS: Array<{ value: AuditAction; label: string }> = [
  { value: "LOGIN", label: "เข้าสู่ระบบ" },
  { value: "LOGIN_FAILED", label: "เข้าสู่ระบบไม่สำเร็จ" },
  { value: "CREATE", label: "เพิ่มข้อมูล" },
  { value: "UPDATE", label: "แก้ไขข้อมูล" },
  { value: "DELETE", label: "ลบข้อมูล" },
  { value: "STATUS", label: "เปลี่ยนสถานะ" },
  { value: "CLOSE", label: "ปิดงาน" },
  { value: "APPROVE", label: "อนุมัติ" },
  { value: "REJECT", label: "ส่งกลับแก้ไข" },
  { value: "IMPORT", label: "นำเข้าข้อมูล" },
  { value: "EXPORT", label: "ส่งออกข้อมูล" },
  // DEF-10 — BR-07/08 และ Admin Approval (VFB แถว 21)
  { value: "REQUEST", label: "ส่งคำขออนุมัติ" },
  { value: "PAYMENT", label: "บันทึกการชำระ" },
  { value: "PAYMENT_CORRECTION", label: "แก้ไขรายการชำระ" },
  // Activity Log (slice act)
  { value: "LOGOUT", label: "ออกจากระบบ" },
  { value: "LOGIN_LOCKED", label: "ถูกระงับการเข้าสู่ระบบ" },
  { value: "PASSWORD_CHANGE", label: "เปลี่ยนรหัสผ่าน" },
  { value: "PASSWORD_RESET", label: "รีเซ็ตรหัสผ่าน" },
  { value: "ROLE_CHANGE", label: "เปลี่ยนบทบาทผู้ใช้" },
  { value: "ACCESS_DENIED", label: "ถูกปฏิเสธสิทธิ์" },
  { value: "VIEW_SENSITIVE", label: "เปิดดูข้อมูลอ่อนไหว" },
  { value: "SCRIPT", label: "สคริปต์ระบบ" },
];

export const AUDIT_RESULT_OPTIONS: Array<{ value: AuditResult; label: string }> = [
  { value: "SUCCESS", label: "สำเร็จ" },
  { value: "FAILURE", label: "ไม่สำเร็จ" },
  { value: "DENIED", label: "ถูกปฏิเสธสิทธิ์" },
];

export const AUDIT_SOURCE_LABEL: Record<string, string> = {
  web: "หน้าเว็บ",
  api: "API",
  script: "สคริปต์",
  system: "ระบบ",
};
export function auditSourceLabel(s: string | undefined | null): string {
  if (!s) return "—";
  return AUDIT_SOURCE_LABEL[s] ?? s;
}

/** DEF-14 — ป้าย role ชุดเดียวกับหน้าผู้ใช้ / ROLE_LABELS ของ backend */
export const ROLE_LABEL: Record<Role, string> = {
  ceo: "ผู้บริหาร (Master/CEO)",
  admin: "แอดมิน (Administrator)",
  manager: "ผู้จัดการ",
  acc: "บัญชี (ACC)",
  tech: "ช่าง",
  sales: "ฝ่ายขาย",
  viewer: "ผู้ดูข้อมูล",
};
export function roleLabel(role: string | undefined | null): string {
  if (!role) return "";
  return (ROLE_LABEL as Record<string, string>)[role] ?? role;
}

// ---------------------------------------------------------------------------
// Activity Log viewer — ฟังก์ชันบริสุทธิ์ (ทดสอบด้วย node --test: scripts/auditViewer.test.ts)
// ---------------------------------------------------------------------------
export interface AuditViewerFilters {
  q?: string;
  actorId?: string;
  actor?: string;
  module?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  entityRef?: string;
  result?: string;
  /** YYYY-MM-DD ตามวันไทย — backend ตีความเป็นช่วงเวลาไทยแล้วเทียบกับเวลา UTC ที่เก็บ */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  /** เวลาอ้างอิงจากหน้าแรก (backend ส่งมา) — หน้าถัดไปส่งกลับเพื่อให้หน้าไม่เลื่อนเมื่อมีเหตุการณ์ใหม่ */
  asOf?: string;
}

/** query string ของ /api/audit และ /api/audit/export — ตัดค่าว่างทิ้ง ลำดับคงที่ */
export function auditQueryString(f: AuditViewerFilters, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams();
  const keys: Array<keyof AuditViewerFilters> = ["q", "actorId", "actor", "module", "action", "entityType", "entityId", "entityRef", "result", "from", "to", "asOf", "page", "pageSize"];
  for (const k of keys) {
    const raw = f[k];
    const v = typeof raw === "string" ? raw.trim() : raw;
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  for (const [k, v] of Object.entries(extra)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** เวลาในหน้าประวัติ: เก็บ UTC แสดงเวลาไทยระดับวินาที (ไม่ขึ้นกับเขตเวลาของเครื่องที่เปิด) */
// (คำนวณเองแบบเดียวกับ bangkokDateTimeSeconds ใน date.ts — ไฟล์นี้ไม่ import ค่าจากไฟล์อื่น เพื่อให้ node --test โหลดได้ตรง)
export function auditTimeText(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t + 7 * 3600_000).toISOString().slice(0, 19).replace("T", " ");
}

function show(v: unknown): string {
  if (v === undefined) return "";
  if (v === null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export interface AuditCompareRow {
  field: string;
  before: string;
  after: string;
  changed: boolean;
}

/**
 * ตารางเทียบก่อน/หลัง: ใช้รายการเปลี่ยนแปลง (changes) เป็นหลัก แล้วเติมฟิลด์จากสำเนา before/after
 * ที่ไม่อยู่ใน changes (CREATE มีแต่ after · DELETE มีแต่ before) — ค่าที่ถูกซ่อน (null) แสดงเป็น "—"
 */
export function auditCompareRows(a: Pick<AuditLog, "changes" | "before" | "after">): AuditCompareRow[] {
  const rows: AuditCompareRow[] = [];
  const seen = new Set<string>();
  for (const c of a.changes ?? []) {
    seen.add(c.field);
    const before = show(c.before);
    const after = show(c.after);
    rows.push({ field: c.field, before, after, changed: before !== after });
  }
  const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const b = obj(a.before);
  const af = obj(a.after);
  for (const k of Array.from(new Set([...Object.keys(b), ...Object.keys(af)]))) {
    if (seen.has(k) || k === "_id") continue;
    const before = k in b ? show(b[k]) : "";
    const after = k in af ? show(af[k]) : "";
    rows.push({ field: k, before, after, changed: before !== after });
  }
  return rows;
}

/** มีอะไรให้เทียบไหม (ปุ่ม "ก่อน/หลัง") */
export function auditHasComparison(a: Pick<AuditLog, "changes" | "before" | "after">): boolean {
  return auditCompareRows(a).length > 0;
}
