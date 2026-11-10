// Owner 10 พ.ย. 69: ซ่อน Dashboard PM — เมนูถูกซ่อน (navMenu.ts) และเปิด /pm/dashboard ตรง ๆ ได้ 404
// โค้ดหน้า (page.tsx) ยังอยู่ครบ · เปิดใช้อีกครั้ง = ลบไฟล์นี้ และเอา hidden ออกจากเมนู
import { notFound } from "next/navigation";

export default function PmDashboardHiddenLayout(_: { children: React.ReactNode }) {
  notFound();
}
