// ---------------------------------------------------------------------------
// ตัวเลือกตัวกรองและป้ายของหน้า Audit Log — ฟังก์ชันบริสุทธิ์ (ทดสอบด้วย node --test)
// ต้องครบตาม AUDIT_ACTIONS / AUDIT_ENTITIES / ROLE_LABELS ของ backend (src/domain/audit.ts, src/domain/user.ts)
// ---------------------------------------------------------------------------
import type { AuditAction, AuditEntity, Role } from "./types";

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
];

/** DEF-14 — ป้าย role ชุดเดียวกับหน้าผู้ใช้ / ROLE_LABELS ของ backend */
export const ROLE_LABEL: Record<Role, string> = {
  ceo: "ผู้บริหาร (Master/CEO)",
  admin: "แอดมิน (Administrator)",
  manager: "ผู้จัดการ",
  tech: "ช่าง",
  sales: "ฝ่ายขาย",
  viewer: "ผู้ดูข้อมูล",
};
export function roleLabel(role: string | undefined | null): string {
  if (!role) return "";
  return (ROLE_LABEL as Record<string, string>)[role] ?? role;
}
