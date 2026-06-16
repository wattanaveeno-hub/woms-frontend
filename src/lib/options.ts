import type {
  PartnerType,
  JobType,
  JobSubType,
  JobStatus,
  MasterKind,
  EquipmentStatus,
  WarrantyStatus,
  ContractType,
  ContractStatus,
  QuotationStatus,
} from "./types";

export const partnerTypeLabel: Record<PartnerType, string> = {
  CUSTOMER: "ลูกค้า",
  SUPPLIER: "ผู้จัดจำหน่าย",
  BOTH: "ลูกค้า/ผู้จัดจำหน่าย",
};

export const masterLabel: Record<MasterKind, string> = {
  team: "ทีมช่าง",
  model: "รุ่นเครื่อง",
};

export const equipmentStatusLabel: Record<EquipmentStatus, string> = {
  IN_STOCK: "ว่าง (ในคลัง)",
  RENTED: "ปล่อยเช่า",
  SOLD: "ขายแล้ว",
  REPAIR: "ส่งซ่อม",
  RETIRED: "ปลดระวาง",
};

export const warrantyStatusLabel: Record<WarrantyStatus, string> = {
  NONE: "ไม่มีข้อมูล",
  ACTIVE: "อยู่ในประกัน",
  EXPIRING: "ใกล้หมดประกัน",
  EXPIRED: "หมดประกัน",
};

export const contractTypeLabel: Record<ContractType, string> = {
  RENTAL: "เช่า",
  HIRE_PURCHASE: "เช่าซื้อ",
  SALE: "ขาย",
};

export const contractStatusLabel: Record<ContractStatus, string> = {
  ACTIVE: "กำลังใช้งาน",
  COMPLETED: "สิ้นสุด",
  CANCELLED: "ยกเลิก",
};

export const quotationStatusLabel: Record<QuotationStatus, string> = {
  DRAFT: "ร่าง",
  SENT: "ส่งแล้ว",
  ACCEPTED: "ตอบรับ",
  REJECTED: "ปฏิเสธ",
  EXPIRED: "หมดอายุ",
};

export function fmtMoney(n: number): string {
  return (n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const jobTypeLabel: Record<JobType, string> = {
  INSTALL: "ติดตั้ง",
  PM: "PM",
  CM: "CM",
  PM_CM: "PM+CM",
  REMOVE: "ซ่อมถอน",
};

export const subTypeLabel: Record<Exclude<JobSubType, "">, string> = {
  PICKUP_REPAIR: "ยกเครื่องซ่อม",
  RETURN: "ยกเครื่องคืน",
};

export const statusLabel: Record<JobStatus, string> = {
  OPEN: "เปิดงาน",
  CLOSED: "ปิดงาน",
};

export function fmtDateTime(date: string, time: string): string {
  if (!date) return "—";
  return time ? `${date} ${time}` : date;
}
