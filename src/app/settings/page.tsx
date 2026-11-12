"use client";

/**
 * หน้า "ตั้งค่า" (Redesign 13 พ.ย. 69 ตาม Settings.dc.html) — รวมเมนูตั้งค่าที่เคยอยู่ในแถบข้าง
 *   แสดงเฉพาะการ์ดที่ผู้ใช้มีสิทธิ์ (กติกาเดียวกับเมนู lib/navMenu.ts)
 */
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/AuthContext";
import { FEATURES } from "@/lib/features";
import { navGroups, visibleGroups } from "@/lib/navMenu";

const SECTIONS: { title: string; items: { href: string; title: string; sub: string }[] }[] = [
  {
    title: "ผู้ใช้ & ความปลอดภัย",
    items: [
      { href: "/users", title: "ผู้ใช้งานระบบ", sub: "เพิ่ม ปิดใช้งาน รีเซ็ตรหัสผ่าน สิทธิ์เฉพาะคน" },
      { href: "/users/roles", title: "บทบาทและสิทธิ์", sub: "แต่ละบทบาทดู/แก้อะไรได้" },
      { href: "/audit", title: "ประวัติการใช้งาน", sub: "ใครทำอะไรเมื่อไร" },
      { href: "/finance/audit", title: "ประวัติการเงิน", sub: "การรับชำระและการแก้ไขยอด" },
      { href: "/approvals", title: "คำขออนุมัติ", sub: "คำขอแก้ไขหลังปิดงานที่รออนุมัติ" },
    ],
  },
  {
    title: "ข้อมูลที่ใช้ในฟอร์ม",
    items: [
      { href: "/master", title: "ข้อมูลพื้นฐาน", sub: "ทีมช่าง โซน คลัง เซลล์ รุ่นเครื่อง แพ็กเกจ PM" },
      { href: "/group-chat/manage", title: "ทีมเซลล์ & กลุ่มแชท", sub: "สมาชิกทีมเซลล์และกลุ่มแชทช่าง" },
      { href: "/parts", title: "ข้อมูลอะไหล่", sub: "รายการอะไหล่ ราคา และหน่วย" },
    ],
  },
  {
    title: "เอกสาร & บัญชี",
    items: [
      { href: "/settings/company", title: "หัวเอกสารบริษัท", sub: "ชื่อ ที่อยู่ เลขผู้เสียภาษี โลโก้ บนเอกสารพิมพ์" },
      { href: "/settings/stock", title: "วิธีคิดมูลค่าสต๊อก", sub: "ถัวเฉลี่ย หรือ เข้าก่อน-ออกก่อน" },
    ],
  },
];

export default function SettingsPage() {
  const { has, user } = useAuth();
  const allowed = new Set(visibleGroups(navGroups(FEATURES), has, user?.role).flatMap((g) => g.links.map((l) => l.href)));
  const sections = SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => allowed.has(i.href)) })).filter((s) => s.items.length);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
      <Typography component="h1" sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.25 }}>
        ตั้งค่า
      </Typography>
      {sections.length === 0 ? <Typography color="text.secondary">ไม่มีเมนูตั้งค่าที่บัญชีนี้ใช้ได้</Typography> : null}
      {sections.map((s) => (
        <Box key={s.title} component="section" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700, color: "#51626f" }}>
            {s.title}
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(3, minmax(0,1fr))" }, gap: 2 }}>
            {s.items.map((i) => (
              <Box
                key={i.href}
                component={Link}
                href={i.href}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                  p: 2.5,
                  bgcolor: "#fff",
                  border: "1px solid #e2e7ec",
                  borderRadius: "12px",
                  color: "#16202b",
                  textDecoration: "none",
                  "&:hover": { borderColor: "#1b5e37", textDecoration: "none" },
                }}
              >
                <Box component="b" sx={{ fontSize: 16 }}>
                  {i.title}
                </Box>
                <Box component="span" sx={{ fontSize: 14, color: "#51626f" }}>
                  {i.sub}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
