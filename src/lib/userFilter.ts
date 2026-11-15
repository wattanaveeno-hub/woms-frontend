/**
 * ENTECH design (Users.dc.html) — ค้นหา + กลุ่มบทบาทในหน้าผู้ใช้ (กรองที่หน้าเว็บจากรายการที่ API คืนอยู่แล้ว)
 * กลุ่ม: ช่าง (tech) · เซลล์ (sales) · แอดมิน/ผู้จัดการ (admin, manager, ceo, developer) · ปิดใช้งาน (active=false)
 * กลุ่มบทบาทนับเฉพาะบัญชีที่ใช้งานอยู่ — บัญชีที่ปิดใช้งานอยู่ในกลุ่ม "ปิดใช้งาน"
 */
import type { AuthUser } from "./types";

export type UserView = "ALL" | "TECH" | "SALES" | "ADMIN" | "INACTIVE";

const ADMIN_ROLES = new Set(["admin", "manager", "ceo", "developer"]);

export function filterUsers(items: AuthUser[], q: string, view: UserView): AuthUser[] {
  const s = q.trim().toLowerCase();
  const digits = s.replace(/\D/g, "");
  return items.filter((u) => {
    if (view === "INACTIVE" && u.active !== false) return false;
    if (view !== "ALL" && view !== "INACTIVE" && u.active === false) return false;
    if (view === "TECH" && u.role !== "tech") return false;
    if (view === "SALES" && u.role !== "sales") return false;
    if (view === "ADMIN" && !ADMIN_ROLES.has(u.role)) return false;
    if (!s) return true;
    const hay = `${u.name ?? ""} ${u.email ?? ""}`.toLowerCase();
    if (hay.includes(s)) return true;
    return digits.length >= 3 && (u.phone ?? "").replace(/\D/g, "").includes(digits);
  });
}
