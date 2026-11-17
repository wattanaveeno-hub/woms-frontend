/**
 * หน้าบทบาท / สิทธิ์รายบุคคล (12 พ.ย. 69) — จัดสิทธิ์ย่อยเป็นตาราง "เรื่อง × ดู/สร้าง/แก้ไข/อนุมัติ/ส่งออก"
 * backend ส่ง uiGroup/uiAction มากับ GET /api/roles/catalog · ไฟล์นี้ไม่มี React เพื่อทดสอบด้วย node --test ได้
 */
import type { PermUiAction, PermUiGroup, RolesCatalogResponse } from "./api";

export type CatalogItem = RolesCatalogResponse["items"][number];

export const UI_ACTION_COLUMNS: { key: Exclude<PermUiAction, "other">; label: string }[] = [
  { key: "view", label: "ดู" },
  { key: "create", label: "สร้าง" },
  { key: "edit", label: "แก้ไข" },
  { key: "approve", label: "อนุมัติ / ปิด" },
  { key: "export", label: "ส่งออก" },
];

export const DEFAULT_UI_GROUPS: { key: PermUiGroup; label: string }[] = [
  { key: "jobs", label: "ใบงาน" },
  { key: "queue", label: "คิวช่าง / คิวจัดส่ง / แชท" },
  { key: "pm", label: "ตาราง PM" },
  { key: "customers", label: "ลูกค้า & เครื่อง & อะไหล่" },
  { key: "sales", label: "สัญญา & ใบเสนอราคา & เอกสาร" },
  { key: "bills", label: "วางบิลช่าง" },
  { key: "finance", label: "การเงิน / รับชำระ" },
  { key: "settings", label: "ผู้ใช้ & ตั้งค่า" },
];

/** ชื่อเรื่อง (resource) ภาษาไทย — ส่วนหน้า ":" ของสิทธิ์ */
const RESOURCE_LABEL: Record<string, string> = {
  jobs: "ใบงาน", calendar: "ปฏิทิน", dashboard: "แดชบอร์ด", notifications: "แจ้งเตือน", followups: "รายการติดตาม",
  svcqueue: "คิวช่าง", queue: "คิวจัดส่ง", slots: "ช่วงเวลาช่าง", tracking: "ตำแหน่งช่าง", chat: "แชท",
  pm: "PM", partners: "ลูกค้า/คู่ค้า", customers: "ลูกค้า", equipment: "เครื่อง", inventory: "คลังเครื่อง", map: "แผนที่",
  stock: "สต๊อก", parts: "อะไหล่", contracts: "สัญญา", quotations: "ใบเสนอราคา", documents: "เอกสารการขาย",
  bill: "บิลช่าง", finance: "การเงิน", payments: "รับชำระ", payment: "รับชำระ", accounting_docs: "เอกสารบัญชี",
  users: "ผู้ใช้", master: "ข้อมูลพื้นฐาน", audit: "ประวัติการใช้งาน", changes: "คำขออนุมัติ",
};
const ACTION_LABEL: Record<string, string> = {
  view: "ดู", view_all: "ดูทั้งหมด", read_all: "อ่านทั้งหมด", create: "สร้าง", edit: "แก้ไข", delete: "ลบ", close: "ปิด",
  manage: "จัดการ", approve: "อนุมัติ", export: "ส่งออก", print: "พิมพ์", status: "เปลี่ยนสถานะ", review: "ตรวจ",
  submit: "ส่ง", pay: "บันทึกชำระ", void: "ยกเลิก", book: "จอง", request: "ขอ", respond: "ตอบ", admin: "ดูแล",
  record: "บันทึก", verify: "ยืนยัน", receive: "รับเข้า", issue: "เบิก", transfer: "โอน", adjust: "ปรับยอด",
  hold: "พัก", resume: "ทำต่อ", attach: "แนบรูป", record_result: "บันทึกผล", cost_view: "ดูต้นทุน", cost_edit: "แก้ต้นทุน",
  set_serial: "เติม SN", finance: "การเงินรายเครื่อง", unapprove: "ถอนอนุมัติ", confirm_receipt: "ยืนยันรับเงิน",
  quick_create: "เพิ่มด่วน", own: "ของตัวเอง", report: "ส่งตำแหน่ง", resolve: "ปิดรายการ", correct: "แก้รายการ",
  moderate: "ดูแลข้อความ", assign_sales: "กำหนดเซลล์",
};

export function permLabel(key: string): string {
  const [res, act = ""] = key.split(":");
  const r = RESOURCE_LABEL[res];
  const a = ACTION_LABEL[act];
  return r && a ? `${r} · ${a}` : key;
}

export type MatrixCell = { total: number; on: number; keys: string[] };

/** นับสิทธิ์ที่ถือในแต่ละช่องของตาราง (สิทธิ์ uiAction=other ไม่อยู่ในตาราง แต่ยังนับในรายละเอียด) */
export function buildMatrix(items: CatalogItem[], held: ReadonlySet<string>): Map<string, MatrixCell> {
  const m = new Map<string, MatrixCell>();
  for (const it of items) {
    const g = it.uiGroup ?? "settings";
    const a = it.uiAction ?? "other";
    const k = `${g}|${a}`;
    const cell = m.get(k) ?? { total: 0, on: 0, keys: [] };
    cell.total += 1;
    if (held.has(it.key)) {
      cell.on += 1;
      cell.keys.push(it.key);
    }
    m.set(k, cell);
  }
  return m;
}

/** สิทธิ์ที่มอบเพิ่มรายคนได้ — ต้องอยู่ในรายการมอบต่อได้ของผู้แก้ และไม่ใช่สิทธิ์ขอบเขตข้อมูล (backend ตรวจซ้ำ) */
export function canGrant(key: string, delegable: readonly string[] | undefined, actorIsDeveloper: boolean): boolean {
  if (key.endsWith(":view_all")) return false;
  return actorIsDeveloper || (delegable ?? []).includes(key);
}

/** สิทธิ์ที่ตัดรายคนได้ — ทุกตัว ยกเว้นสิทธิ์จัดการผู้ใช้ (ใช้การเปลี่ยนบทบาทแทน) */
export function canDeny(key: string): boolean {
  return key !== "users:manage";
}

/**
 * Custom Role: สิทธิ์ย่อยที่ได้อัตโนมัติเมื่อมีสิทธิ์แม่ — ตรงกับ LEGACY_IMPLIED ใน woms-backend src/domain/customRole.ts
 * key = สิทธิ์ย่อย · value = สิทธิ์แม่
 */
export const CUSTOM_ROLE_IMPLIED_BY: Record<string, string> = {
  "dashboard:view": "jobs:view",
  "notifications:view": "jobs:view",
  "jobs:hold": "jobs:edit",
  "jobs:resume": "jobs:edit",
  "jobs:record_result": "jobs:close",
  "jobs:attach": "jobs:close",
  "bill:confirm_receipt": "bill:submit",
  "equipment:set_serial": "equipment:edit",
};
