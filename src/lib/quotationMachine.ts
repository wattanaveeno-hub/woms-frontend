// CR-QT01 P3 — ข้อมูลเครื่องในตัวเลือกของใบเสนอราคา (pure · ทดสอบได้ด้วย node --test)
/** CR-QT01 P3: ตัวเลือกเครื่องแสดงลูกค้า/สาขา/แหล่งที่มา/สิทธิ์ PM ปัจจุบัน */
export type EqOption = { id: string; serial: string; model: string; customerId?: string; siteId?: string; siteLabel?: string; source?: string; entitlement?: string; pendingSerial?: boolean };

/** แหล่งที่มาของเครื่อง (อ่านจากสถานะ/ประเภทธุรกิจที่มีอยู่ — เครื่องภายนอกยังไม่มีแบบข้อมูล: หัวข้อ 14) */
export function machineSourceLabel(e: { status?: string; businessType?: string; customerId?: string }): string {
  if (!String(e.customerId ?? "").trim()) return e.status === "IN_STOCK" ? "Stock บริษัท" : "-";
  if (e.status === "SOLD" || e.businessType === "SALE") return "ขาย";
  if (e.status === "RENTED" || e.businessType === "RENTAL") return "เช่า";
  return "ไม่ระบุแหล่ง";
}
/** สิทธิ์ PM ปัจจุบันของเครื่อง (Package คงเหลือ / PM เช่า / ไม่มี) */
export function pmEntitlementLabel(e: { pmMode?: string; pmPackage?: string; pmPackageRoundsTotal?: number; pmPackageRoundsUsed?: number }): string {
  const total = Number(e.pmPackageRoundsTotal ?? 0) || 0;
  const used = Number(e.pmPackageRoundsUsed ?? 0) || 0;
  if (e.pmMode === "PACKAGE" && total > 0) return `${e.pmPackage || "Package PM"} คงเหลือ ${Math.max(0, total - used)}/${total}${used >= total ? " (ใช้ครบ)" : ""}`;
  if (e.pmMode === "RENTAL") return "PM เช่า";
  return "ไม่มีสิทธิ์ PM";
}
export function toEqOption(e: any): EqOption {
  return {
    id: e.id,
    serial: e.serial,
    model: e.model,
    customerId: e.customerId ?? "",
    siteId: e.siteId ?? "",
    siteLabel: e.siteLabel ?? "",
    source: machineSourceLabel(e),
    entitlement: pmEntitlementLabel(e),
    pendingSerial: e.hasRealSerial === false,
  };
}

