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
export type NavGroup = { title: string; links: NavLink[] };

export function navGroups(features: { chat: boolean; serviceQueue: boolean; techQueue: boolean }): NavGroup[] {
  return [
    {
      title: "ภาพรวม",
      // ⚠ NAV-01 ระบุ "CEO / Admin Service" — รอยืนยันการจับคู่บทบาท (AUTH-01) จึงคงสิทธิ์เดิม
      links: [{ href: "/dashboard", label: "แดชบอร์ด", perm: "jobs:view" }],
    },
    {
      title: "งานบริการ",
      links: [
        // NAV-01: งานทั้งหมด — Admin / Sale (ช่างใช้โหมดมือถือ · API ยังจำกัดเฉพาะงานของช่างเอง)
        { href: "/jobs", label: "งานทั้งหมด", perm: "jobs:view", notRoles: ["tech"] },
        { href: "/jobs/new", label: "เปิดงาน", perm: "jobs:create" },
        { href: "/chats", label: "แชท", perm: "jobs:view", hidden: !features.chat },
        { href: "/service-queue", label: "คิวช่าง", perm: "svcqueue:view", hidden: !features.serviceQueue },
        { href: "/group-chat", label: "แชทกลุ่ม", perm: "chat:check_queue", anyPerm: ["chat:tech_groups", "chat:own_tech_group"], hidden: !features.serviceQueue },
        { href: "/calendar", label: "ปฏิทินงานช่าง", perm: "calendar:view" },
        { href: "/queue", label: "คิวจัดส่ง/ซ่อม", perm: "queue:view", hidden: !features.techQueue },
        { href: "/queue/slots", label: "ตาราง slot ช่าง", perm: "queue:view", hidden: !features.techQueue },
        { href: "/pm", label: "ตาราง PM", perm: "pm:view" },
        { href: "/notifications", label: "การแจ้งเตือน", perm: "jobs:view" },
        // NAV-02: ติดตามช่าง — ซ่อนเมนู (หน้าเดิมยังอยู่)
        { href: "/tracking", label: "ติดตามช่าง", perm: "tracking:view", hidden: true },
        // NAV-01: โหมดมือถือช่าง — ช่างเท่านั้น (svcqueue:respond มีเฉพาะช่าง)
        { href: "/m", label: "โหมดมือถือช่าง", perm: "svcqueue:respond", onlyRoles: ["tech"] },
      ],
    },
    {
      title: "เครื่อง & ประกัน",
      links: [
        { href: "/equipment", label: "คลังเครื่อง", perm: "equipment:view", notRoles: ["tech"] },
        { href: "/customers", label: "ฐานข้อมูลลูกค้า", perm: "partners:view" },
        { href: "/map", label: "แผนที่", perm: "map:view" },
        // NAV-02: สต๊อกรวม — ตัดเมนู ใช้คลังเครื่อง
        { href: "/inventory", label: "สต็อกรวม", perm: "inventory:view", hidden: true },
        // NAV-01: ข้อมูลอะไหล่ / สต๊อกอะไหล่ — Admin; ช่างเห็นเฉพาะของตนเอง (Sale ไม่อยู่ในรายการ)
        { href: "/parts", label: "ข้อมูลอะไหล่", perm: "stock:view", notRoles: ["sales"] },
        { href: "/stock", label: "สต๊อกอะไหล่", perm: "stock:view", notRoles: ["sales"] },
      ],
    },
    {
      title: "ขาย & สัญญา",
      links: [
        { href: "/contracts", label: "สัญญา", perm: "contracts:view" },
        // NAV-01: ใบเสนอราคา / เอกสารการขาย / ออกเอกสาร — Admin (Sale ไม่เห็นเมนู)
        { href: "/quotations", label: "ใบเสนอราคา", perm: "quotations:view", notRoles: ["sales"] },
        { href: "/documents", label: "เอกสารการขาย", perm: "documents:view", notRoles: ["sales"] },
        { href: "/documents/new", label: "ออกเอกสาร", perm: "documents:create" },
        // NAV-02: คู่ค้า — ตัดเมนู ใช้ฐานข้อมูลลูกค้า (หน้า /partners/* ยังใช้เป็นหน้ารายละเอียดลูกค้า)
        { href: "/partners", label: "คู่ค้า", perm: "partners:view", hidden: true },
        // NAV-01: วางบิลช่าง — Admin / Manager; ช่างเห็นเฉพาะของตนเอง (Sale ไม่เห็น)
        { href: "/bills", label: "วางบิลช่าง", perm: "bill:view", notRoles: ["sales"] },
      ],
    },
    {
      title: "ตั้งค่าระบบ",
      // ⚠ NAV-01 ระบุเมนูย่อยเฉพาะ Manager แต่ "ให้ยืนยันสิทธิ์ Admin ก่อนเปิดใช้" — คงสิทธิ์เดิมจนกว่ายืนยัน
      links: [
        { href: "/master", label: "ข้อมูลพื้นฐาน", perm: "master:manage", anyPerm: ["master:view"] },
        { href: "/settings/company", label: "หัวเอกสารบริษัท", perm: "master:manage", anyPerm: ["master:view"] },
        { href: "/settings/stock", label: "วิธีคิดมูลค่าสต๊อก", perm: "stock:manage" },
        { href: "/users", label: "ผู้ใช้", perm: "users:manage", anyPerm: ["users:view"] },
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
    .map((g) => ({ title: g.title, links: g.links.filter((l) => isLinkVisible(l, has, role)) }))
    .filter((g) => g.links.length > 0);
}
