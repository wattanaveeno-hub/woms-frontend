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
};
/** ไอคอนของหมวด (ชื่อ string — Nav.tsx map เป็นไอคอน MUI) · เก็บเป็น string เพื่อให้ไฟล์นี้ยังไม่ import React (node --test อ่านได้) */
export type NavGroupIcon = "dashboard" | "service" | "equipment" | "sales" | "finance" | "settings";
export const NAV_GROUP_ICONS: readonly NavGroupIcon[] = ["dashboard", "service", "equipment", "sales", "finance", "settings"];
export type NavGroup = { title: string; icon: NavGroupIcon; links: NavLink[] };

export function navGroups(features: { chat: boolean; serviceQueue: boolean; techQueue: boolean }): NavGroup[] {
  return [
    {
      title: "ภาพรวม",
      icon: "dashboard",
      // ⚠ NAV-01 ระบุ "CEO / Admin Service" — รอยืนยันการจับคู่บทบาท (AUTH-01) จึงคงสิทธิ์เดิม
      // Round 2 N-2: Sale ไม่อยู่ในรายชื่อผู้ดูแดชบอร์ดของ v2 (CEO / Admin Service) — ซ่อนเมนูและ API ไม่ส่งยอดเงิน
      links: [
        // RBAC Matrix DASH-01: SALE = ตามเงื่อนไข (จำนวนเครื่องเช่า/ขาย · สัญญาเช่า) → ใช้ Dashboard Sales · STORE = ข้อมูลเครื่อง
        { href: "/dashboard", label: "แดชบอร์ด", perm: "dashboard:view", notRoles: ["sales"] },
        // CR-DS01 (CF v1.1 §9): Dashboard Sales — เซลล์และผู้ดูแลคิว (อ่านอย่างเดียว)
        { href: "/dashboard/sales", label: "Dashboard Sales", perm: "svcqueue:request", anyPerm: ["svcqueue:admin"] },
      ],
    },
    {
      title: "งานบริการ",
      icon: "service",
      links: [
        // NAV-01: งานทั้งหมด — Admin / Sale (ช่างใช้โหมดมือถือ · API ยังจำกัดเฉพาะงานของช่างเอง)
        { href: "/jobs", label: "งานทั้งหมด", perm: "jobs:view", notRoles: ["tech"] },
        { href: "/jobs/new", label: "เปิดงาน", perm: "jobs:create" },
        { href: "/chats", label: "แชท", perm: "jobs:view", hidden: !features.chat },
        { href: "/service-queue", label: "คิวช่าง", perm: "svcqueue:view", hidden: !features.serviceQueue },
        // RBAC Matrix CHAT-01: CEO/MASTER = View_only (chat:read_all)
        { href: "/group-chat", label: "แชทกลุ่ม", perm: "chat:check_queue", anyPerm: ["chat:tech_groups", "chat:own_tech_group", "chat:read_all"], hidden: !features.serviceQueue },
        // CR-CH01 §8.3: ทีมเซลล์และกลุ่มแชท — Admin/Manager (D01 ข้อเสนอ)
        { href: "/group-chat/manage", label: "ทีมเซลล์ & กลุ่มแชท", perm: "chat:moderate", hidden: !features.serviceQueue },
        { href: "/calendar", label: "ปฏิทินงานช่าง", perm: "calendar:view" },
        { href: "/queue", label: "คิวจัดส่ง/ซ่อม", perm: "queue:view", hidden: !features.techQueue },
        { href: "/queue/slots", label: "ตาราง slot ช่าง", perm: "queue:view", hidden: !features.techQueue },
        { href: "/pm", label: "ตาราง PM", perm: "pm:view" },
        { href: "/pm/dashboard", label: "Dashboard PM", perm: "pm:view" },
        // Q-R3-12 รายการติดตาม (Admin/Manager) · Q-R3-13 คิวคำขอแก้ไขหลังปิดงาน (Manager อนุมัติ · CEO ดู)
        // RBAC Matrix FOL-01
        { href: "/follow-ups", label: "รายการติดตาม", perm: "followups:view" },
        // D-20 (CUSTOMER APPROVED): ซ่อนเมนูแยก — กระดิ่งในแถบบนเปิดหน้าเดียวกันได้ทุกหน้า ทั้งเดสก์ท็อปและมือถือ
        //   หน้า /notifications ประวัติ และสถานะอ่านแล้ว/ยังไม่อ่าน ยังอยู่ครบ
        { href: "/notifications", label: "การแจ้งเตือน", perm: "notifications:view", hidden: true },
        // NAV-02: ติดตามช่าง — ซ่อนเมนู (หน้าเดิมยังอยู่)
        { href: "/tracking", label: "ติดตามช่าง", perm: "tracking:view", hidden: true },
        // NAV-01: โหมดมือถือช่าง — ช่างเท่านั้น (svcqueue:respond มีเฉพาะช่าง)
        { href: "/m", label: "โหมดมือถือช่าง", perm: "svcqueue:respond", onlyRoles: ["tech"] },
      ],
    },
    {
      title: "เครื่อง & ประกัน",
      icon: "equipment",
      links: [
        // RBAC Matrix EQ-01: ดูรายการเครื่อง = inventory:view (SALE ดูรายละเอียดเครื่องผ่านลูกค้า/งานเท่านั้น)
        { href: "/equipment", label: "คลังเครื่อง", perm: "inventory:view" },
        { href: "/customers", label: "ฐานข้อมูลลูกค้า", perm: "partners:view" },
        { href: "/map", label: "แผนที่", perm: "map:view" },
        // NAV-02: สต๊อกรวม — ตัดเมนู ใช้คลังเครื่อง
        { href: "/inventory", label: "สต็อกรวม", perm: "inventory:view", hidden: true },
        // NAV-01: ข้อมูลอะไหล่ / สต๊อกอะไหล่ — Admin; ช่างเห็นเฉพาะของตนเอง (Sale ไม่อยู่ในรายการ)
        // RBAC Matrix PART-01 / INV-01
        { href: "/parts", label: "ข้อมูลอะไหล่", perm: "stock:view" },
        { href: "/stock", label: "สต๊อกอะไหล่", perm: "stock:view" },
      ],
    },
    {
      title: "ขาย & สัญญา",
      icon: "sales",
      links: [
        { href: "/contracts", label: "สัญญา", perm: "contracts:view" },
        // NAV-01: ใบเสนอราคา / เอกสารการขาย / ออกเอกสาร — Admin (Sale ไม่เห็นเมนู)
        { href: "/quotations", label: "ใบเสนอราคา", perm: "quotations:view" },
        // RBAC Matrix SALE-01: SALE · STORE เข้าเมนูออกเอกสารได้ (สร้างได้เฉพาะใบส่งของ — DOC-01)
        { href: "/documents", label: "เอกสารการขาย", perm: "documents:view" },
        { href: "/documents/new", label: "ออกเอกสาร", perm: "documents:create" },
        // NAV-02: คู่ค้า — ตัดเมนู ใช้ฐานข้อมูลลูกค้า (หน้า /partners/* ยังใช้เป็นหน้ารายละเอียดลูกค้า)
        { href: "/partners", label: "คู่ค้า", perm: "partners:view", hidden: true },
        // NAV-01: วางบิลช่าง — Admin / Manager; ช่างเห็นเฉพาะของตนเอง (Sale ไม่เห็น)
        { href: "/bills", label: "วางบิลช่าง", perm: "bill:view" },
      ],
    },
    {
      // D-11 Financial Workflow v1.0 — รายรับจากลูกค้าตามใบเสนอราคา (ไม่ใช่วางบิลช่าง) · Sale/ช่าง/Viewer ไม่มี finance:view
      title: "การเงิน",
      icon: "finance",
      links: [
        { href: "/finance/queue", label: "รอตรวจสอบเงินเข้า", perm: "payments:verify" },
        { href: "/finance", label: "สถานะรับชำระ", perm: "finance:view" },
        { href: "/finance/audit", label: "ประวัติการเงิน", perm: "finance:view" },
      ],
    },
    {
      title: "ตั้งค่าระบบ",
      icon: "settings",
      // ⚠ NAV-01 ระบุเมนูย่อยเฉพาะ Manager แต่ "ให้ยืนยันสิทธิ์ Admin ก่อนเปิดใช้" — คงสิทธิ์เดิมจนกว่ายืนยัน
      links: [
        { href: "/master", label: "ข้อมูลพื้นฐาน", perm: "master:manage", anyPerm: ["master:view"] },
        { href: "/settings/company", label: "หัวเอกสารบริษัท", perm: "master:manage", anyPerm: ["master:view"] },
        { href: "/settings/stock", label: "วิธีคิดมูลค่าสต๊อก", perm: "stock:manage" },
        { href: "/users", label: "ผู้ใช้", perm: "users:manage", anyPerm: ["users:view"] },
        { href: "/users/roles", label: "บทบาทและสิทธิ์", perm: "users:manage", anyPerm: ["users:view"] },
        { href: "/audit", label: "ประวัติการใช้งาน", perm: "audit:view" },
        { href: "/approvals", label: "คำขออนุมัติ", perm: "changes:approve", roles: ["admin"] },
      ],
    },
  ];
}

export function isLinkVisible(l: NavLink, has: (p: string) => boolean, role: string | undefined): boolean {
  if (l.hidden) return false;
  if (role && (l.notRoles ?? []).includes(role)) return false;
  if (l.onlyRoles && !(role && l.onlyRoles.includes(role))) return false;
  return has(l.perm) || (l.anyPerm ?? []).some((p) => has(p)) || (!!role && (l.roles ?? []).includes(role));
}

export function visibleGroups(groups: NavGroup[], has: (p: string) => boolean, role: string | undefined): NavGroup[] {
  return groups
    .map((g) => ({ title: g.title, icon: g.icon, links: g.links.filter((l) => isLinkVisible(l, has, role)) }))
    .filter((g) => g.links.length > 0);
}
