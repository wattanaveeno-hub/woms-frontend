// CUS-01 (Audit A D-21) — ปุ่มย้อนกลับของหน้าลูกค้า/คู่ค้า ต้องกลับไปหน้าที่ผู้ใช้มา
// เดิมกลับ "/partners (รายการคู่ค้า)" เสมอ แม้เข้ามาจาก "ฐานข้อมูลลูกค้า"
// from: ค่าจาก ?from= ในลิงก์ ("customers" | "partners") · ไม่มี → ดูจากประเภท (ผู้จัดจำหน่าย → คู่ค้า, อื่น ๆ → ลูกค้า)

export type PartnerBackFrom = "customers" | "partners" | "";

export function partnerBackFrom(search: string): PartnerBackFrom {
  const v = new URLSearchParams(search ?? "").get("from");
  return v === "customers" || v === "partners" ? v : "";
}

export function partnerBack(type: string | undefined, from: PartnerBackFrom): { href: string; label: string } {
  const toCustomers = from === "customers" || (from === "" && !!type && type !== "SUPPLIER");
  return toCustomers ? { href: "/customers", label: "ฐานข้อมูลลูกค้า" } : { href: "/partners", label: "รายการคู่ค้า" };
}

/** ต่อ ?from= ให้ลิงก์ไปหน้าคู่ค้า เพื่อให้ปุ่มย้อนกลับถูกหน้า */
export function withFrom(href: string, from: PartnerBackFrom): string {
  return from ? `${href}${href.includes("?") ? "&" : "?"}from=${from}` : href;
}
