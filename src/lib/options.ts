import type {
  PartnerType,
  WarrantyProvider,
  EquipmentEventType,
  DocumentType,
  DocumentStatus,
  PaymentMethod,
  BookingType,
  BookingStatus,
  SlotStatus,
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
  zone: "โซนบริการ",
  category: "หมวดหมู่เครื่อง",
  warehouse: "คลังจัดเก็บ",
};

export const warrantyProviderLabel: Record<WarrantyProvider, string> = {
  BRAND: "ประกันแบรนด์",
  AGENT: "ประกันตัวแทน",
  OTHER: "ประกันอื่น ๆ",
};

export const equipmentEventLabel: Record<EquipmentEventType, string> = {
  CREATE: "รับเข้าคลัง",
  MOVE: "ย้ายที่อยู่",
  STATUS: "เปลี่ยนสถานะ",
  ASSIGN: "ส่งมอบลูกค้า",
  RETURN: "รับคืนเข้าคลัง",
  WARRANTY: "แก้ไขประกัน",
  EDIT: "แก้ไขข้อมูล",
  CHECK: "ตรวจสอบตำแหน่ง",
  SERIAL: "ลง Serial จริง",
  DELETE: "ลบออกจากระบบ",
};

export const equipmentStatusLabel: Record<EquipmentStatus, string> = {
  IN_STOCK: "ว่าง (ในคลัง)",
  RESERVED: "จอง",
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

export const documentTypeLabel: Record<DocumentType, string> = {
  INVOICE: "ใบแจ้งหนี้ / ใบวางบิล",
  RECEIPT: "ใบเสร็จรับเงิน",
  TAX_INVOICE: "ใบเสร็จรับเงิน / ใบกำกับภาษี",
  CREDIT_NOTE: "ใบลดหนี้",
  DELIVERY_NOTE: "ใบส่งของ / ใบส่งมอบงาน",
  CONTRACT: "หนังสือสัญญา",
  WARRANTY_CARD: "ใบรับประกัน",
};

export const documentStatusLabel: Record<DocumentStatus, string> = {
  ISSUED: "ออกแล้ว",
  VOID: "ยกเลิก (void)",
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  CASH: "เงินสด",
  TRANSFER: "โอนเงิน",
  CHEQUE: "เช็ค",
  CARD: "บัตรเครดิต",
  CREDIT: "เครดิต (ยังไม่ชำระ)",
  OTHER: "อื่น ๆ",
};

export const bookingTypeLabel: Record<BookingType, string> = {
  DELIVERY: "จัดส่ง",
  REPAIR: "ซ่อม",
  INSTALL: "ติดตั้ง",
  PM: "PM (บำรุงรักษา)",
  PICKUP: "ยกเครื่องกลับ",
};

export const bookingStatusLabel: Record<BookingStatus, string> = {
  BOOKED: "จองคิวแล้ว",
  ON_THE_WAY: "กำลังเดินทาง",
  ARRIVED: "ถึงหน้างานแล้ว",
  DONE: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

export const slotStatusLabel: Record<SlotStatus, string> = {
  OPEN: "เปิดรับคิว",
  BLOCKED: "ปิดรับคิว",
};
