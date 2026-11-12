// ---------------------------------------------------------------------------
// เมนูหลัก (Customer Feedback v2 · NAV-01 / NAV-02) — ฟังก์ชันบริสุทธิ์ ทดสอบด้วย node --test
// ---------------------------------------------------------------------------
// หลัก: เมนูที่ซ่อนเป็นความสะดวกเท่านั้น สิทธิ์จริงตรวจที่ backend ทุก API
// ปรับเฉพาะบทบาทที่ v2 ระบุชัด (Admin / Sale / ช่าง) · CEO / Manager / viewer คงเดิม
// จนกว่าลูกค้ายืนยัน AUTH-01 (Admin = Admin Service? CEO = Manager?) — ดู 11_OPEN_DECISIONS
//
// NAV-02: ติดตามช่าง = ซ่อนเมนู · สต๊อกรวม = ตัดเมนู (ใช้คลังเครื่อง) · คู่ค้า = ตัดเมนู (ใช้ฐานข้อมูลลูกค้า)
//         การแจ้งเตือน = ยังคงไว้ (รอยืนยันการซ่อนโดยใช้กระดิ่งแทน) · ไม่ลบหน้า/ข้อมูลเดิม เข้าผ่านลิงก์ได้ตามสิทธิ์

export type NavLink = {
  href: string;
  label: string;
  perm: string;
  anyPerm?: string[];
  /** บทบาทที่เห็นเมนูนี้เพิ่มเติม */
  roles?: string[];
  /** บทบาทที่ไม่แสดงเมนูนี้ แม้มีสิทธิ์ (NAV-01 v2 กำหนดรายบทบาท) */
  notRoles?: string[];
  /** แสดงเฉพาะบทบาทเหล่านี้ (เช่น โหมดมือถือช่าง — ช่างเท่านั้น) */
  onlyRoles?: string[];
  hidden?: boolean;
  /** false = ไม่แสดงในแถบข้าง (เข้าจากหน้า "ตั้งค่า" / ปุ่มในหน้า / แถบบน) แต่ยังถือว่าเข้าได้ตามสิทธิ์ */
  sidebar?: boolean;
};
/** ไอคอนของหมวด (ชื่อ string — Nav.tsx map เป็นไอคอน MUI) · เก็บเป็น string เพื่อให้ไฟล์นี้ยังไม่ import React (node --test อ่านได้) */
export type NavGroupIcon = "dashboard" | "service" | "equipment" | "sales" | "finance" | "settings";
export const NAV_GROUP_ICONS: readonly NavGroupIcon[] = ["dashboard", "service", "equipment", "sales", "finance", "settings"];
export type NavGroup = { title: string; icon: NavGroupIcon; links: NavLink[] };

export function navGroups(features: { chat: boolean; serviceQueue: boolean; techQueue: boolean }): NavGroup[] {
  // Redesign 13 พ.ย. 69 — โครงเมนูตาม Nav.dc.html: หน้าหลัก · งานบริการ · ลูกค้า & เครื่อง · ขาย & การเงิน · ตั้งค่า (ล่างสุด)
  //   เมนูย่อยที่ design ไม่แสดงในแถบข้าง (sidebar: false) ยังนับเป็นเมนูที่เข้าได้ตามสิทธิ์ — อยู่ในหน้า "ตั้งค่า" หรือปุ่มในหน้า
  return [
    {
      title: "หน้าหลัก",
      icon: "dashboard",
      // RBAC Matrix DASH-01: SALE ใช้ Dashboard Sales
      links: [
        { href: "/dashboard", label: "หน้าหลัก", perm: "dashboard:view", notRoles: ["sales"] },
        // CR-DS01 (CF v1.1 §9): Dashboard Sales — เซลล์และผู้ดูแลคิว (อ่านอย่างเดียว)
        { href: "/dashboard/sales", label: "Dashboard Sales", perm: "svcqueue:request", anyPerm: ["svcqueue:admin"] },
        // NAV-01: โหมดมือถือช่าง — ช่างเท่านั้น (svcqueue:respond มีเฉพาะช่าง)
        { href: "/m", label: "โหมดมือถือช่าง", perm: "svcqueue:respond", onlyRoles: ["tech"] },
      ],
    },
    {
      title: "งานบริการ",
      icon: "service",
      links: [
        // NAV-01: งานทั้งหมด — Admin / Sale (ช่างใช้โหมดมือถือ · API ยังจำกัดเฉพาะงานของช่างเอง)
        { href: "/jobs", label: "งานทั้งหมด", perm: "jobs:view", notRoles: ["tech"] },
        // ปุ่ม "+ เปิดงาน" อยู่แถบบน (Top.dc.html)
        { href: "/jobs/new", label: "เปิดงาน", perm: "jobs:create", sidebar: false },
        { href: "/calendar", label: "ปฏิทินช่าง", perm: "calendar:view" },
        { href: "/service-queue", label: "คิวช่าง", perm: "svcqueue:view", hidden: !features.serviceQueue },
        { href: "/queue", label: "คิวจัดส่ง/ซ่อม", perm: "queue:view", hidden: !features.techQueue },
        { href: "/queue/slots", label: "ตาราง slot ช่าง", perm: "queue:view", hidden: !features.techQueue, sidebar: false },
        { href: "/pm", label: "ตาราง PM", perm: "pm:view" },
        { href: "/chats", label: "แชท", perm: "jobs:view", hidden: !features.chat },
        // RBAC Matrix CHAT-01: CEO/MASTER = View_only (chat:read_all)
        { href: "/group-chat", label: "แชทกลุ่ม", perm: "chat:check_queue", anyPerm: ["chat:tech_groups", "chat:own_tech_group", "chat:read_all"], hidden: !features.serviceQueue },
        // Q-R3-12 รายการติดตาม · RBAC Matrix FOL-01
        { href: "/follow-ups", label: "รายการติดตาม", perm: "followups:view" },
        // D-20 (CUSTOMER APPROVED): กระดิ่งในแถบบนเปิดหน้าเดียวกัน
        { href: "/notifications", label: "การแจ้งเตือน", perm: "notifications:view", hidden: true },
        // NAV-02: ติดตามช่าง — ซ่อนเมนู (หน้าเดิมยังอยู่)
        { href: "/tracking", label: "ติดตามช่าง", perm: "tracking:view", hidden: true },
      ],
    },
    {
      title: "ลูกค้า & เครื่อง",
      icon: "equipment",
      links: [
        { href: "/customers", label: "ลูกค้า", perm: "partners:view" },
        // RBAC Matrix EQ-01: ดูรายการเครื่อง = inventory:view
        { href: "/equipment", label: "คลังเครื่อง", perm: "inventory:view" },
        { href: "/map", label: "แผนที่", perm: "map:view" },
        // NAV-01: อะไหล่ — Admin; ช่างเห็นเฉพาะของตนเอง · RBAC Matrix PART-01 / INV-01
        { href: "/stock", label: "อะไหล่ & สต๊อก", perm: "stock:view" },
        { href: "/parts", label: "ข้อมูลอะไหล่", perm: "stock:view", sidebar: false },
        // NAV-02: สต๊อกรวม — ตัดเมนู ใช้คลังเครื่อง
        { href: "/inventory", label: "สต็อกรวม", perm: "inventory:view", hidden: true },
      ],
    },
    {
      title: "ขาย & การเงิน",
      icon: "sales",
      links: [
        // NAV-01: ใบเสนอราคา / เอกสารการขาย — Admin (Sale ไม่เห็นเมนู)
        { href: "/quotations", label: "ใบเสนอราคา", perm: "quotations:view" },
        { href: "/contracts", label: "สัญญาเช่า", perm: "contracts:view" },
        // RBAC Matrix SALE-01: SALE · STORE เข้าเมนูออกเอกสารได้ (สร้างได้เฉพาะใบส่งของ — DOC-01)
        { href: "/documents", label: "เอกสารการขาย", perm: "documents:view" },
        { href: "/documents/new", label: "ออกเอกสาร", perm: "documents:create", sidebar: false },
        // NAV-02: คู่ค้า — ตัดเมนู ใช้ฐานข้อมูลลูกค้า
        { href: "/partners", label: "คู่ค้า", perm: "partners:view", hidden: true },
        // NAV-01: วางบิลช่าง — Admin / Manager; ช่างเห็นเฉพาะของตนเอง
        { href: "/bills", label: "วางบิลช่าง", perm: "bill:view" },
        // D-11 Financial Workflow v1.0 — รายรับจากลูกค้าตามใบเสนอราคา
        { href: "/finance", label: "รับชำระ", perm: "finance:view" },
        { href: "/finance/queue", label: "รอตรวจเงินเข้า", perm: "payments:verify" },
      ],
    },
    {
      title: "ตั้งค่า",
      icon: "settings",
      // ทั้งหมวดแสดงเป็นเมนูเดียว "ตั้งค่า" ด้านล่าง → หน้า /settings (Settings.dc.html)
      links: [
        { href: "/users", label: "ผู้ใช้งานระบบ", perm: "users:manage", anyPerm: ["users:view"], sidebar: false },
        { href: "/users/roles", label: "บทบาทและสิทธิ์", perm: "users:manage", anyPerm: ["users:view"], sidebar: false },
        { href: "/audit", label: "ประวัติการใช้งาน", perm: "audit:view", sidebar: false },
        { href: "/finance/audit", label: "ประวัติการเงิน", perm: "finance:view", sidebar: false },
        { href: "/approvals", label: "คำขออนุมัติ", perm: "changes:approve", roles: ["admin"], sidebar: false },
        { href: "/master", label: "ข้อมูลพื้นฐาน", perm: "master:manage", anyPerm: ["master:view"], sidebar: false },
        // CR-CH01 §8.3: ทีมเซลล์และกลุ่มแชท — Admin/Manager
        { href: "/group-chat/manage", label: "ทีมเซลล์ & กลุ่มแชท", perm: "chat:moderate", hidden: !features.serviceQueue, sidebar: false },
        { href: "/settings/company", label: "หัวเอกสารบริษัท", perm: "master:manage", anyPerm: ["master:view"], sidebar: false },
        { href: "/settings/stock", label: "วิธีคิดมูลค่าสต๊อก", perm: "stock:manage", sidebar: false },
      ],
    },
  ];
}

/** หน้า "ตั้งค่า" (/settings) และหน้าลูกของมัน — เมนู "ตั้งค่า" ในแถบข้าง active */
export const SETTINGS_HREFS = ["/settings", "/users", "/audit", "/finance/audit", "/approvals", "/master", "/group-chat/manage"];

export function isLinkVisible(l: NavLink, has: (p: string) => boolean, role: string | undefined): boolean {
  if (l.hidden) return false;
  if (role && (l.notRoles ?? []).includes(role)) return false;
  if (l.onlyRoles && !(role && l.onlyRoles.includes(role))) return false;
  return has(l.perm) || (l.anyPerm ?? []).some((p) => has(p)) || (!!role && (l.roles ?? []).includes(role));
}

export function visibleGroups(groups: NavGroup[], has: (p: string) => boolean, role: string | undefined): NavGroup[] {
  return groups
    .map((g) => ({ ...g, links: g.links.filter((l) => isLinkVisible(l, has, role)) }))
    .filter((g) => g.links.length > 0);
}
