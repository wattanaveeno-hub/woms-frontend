/**
 * กติกาเล็ก ๆ ที่หน้าจอใช้ตัดสินว่าจะแสดงอะไร — แยกออกมาเป็นฟังก์ชันล้วน
 * เพื่อให้มี regression test (scripts/uiRules.test.ts) ป้องกันบั๊กที่เคยแก้แล้วกลับมา
 * ห้าม import อะไรที่เป็น React / alias "@/" ในไฟล์นี้ (เทสต์รันด้วย node --test ตรง ๆ)
 */

export type JobStatusValue = "OPEN" | "HOLD" | "CLOSED" | "CANCELLED";

/** ตัวเลือกตัวกรองสถานะงาน — ต้องมี HOLD เสมอ (backend รับ 4 สถานะ) */
export const JOB_STATUS_FILTER: JobStatusValue[] = ["OPEN", "HOLD", "CLOSED", "CANCELLED"];

/**
 * หน้าช่าง /m/job/[id]: ส่วนท้ายของหน้าแสดงอะไร
 * เคยแสดง "งานนี้ปิดแล้ว" กับงานที่พัก/ยกเลิก — ห้ามกลับไปเป็นแบบนั้น
 */
export function techJobFooter(status: JobStatusValue): "close-form" | "closed" | "hold" | "cancelled" {
  switch (status) {
    case "OPEN":
      return "close-form";
    case "CLOSED":
      return "closed";
    case "HOLD":
      return "hold";
    default:
      return "cancelled";
  }
}

/** หน้ารายละเอียดใบงาน (เดสก์ท็อป) ใช้กติกาเดียวกับหน้าช่าง */
export const jobCloseSection = techJobFooter;

/**
 * ช่องลายเซ็น: ล้างลายเซ็นเมื่อความกว้างของกรอบเปลี่ยนจริงเท่านั้น (เช่นหมุนจอ)
 * มือถือยิง resize ตอนแถบที่อยู่ของเบราว์เซอร์เลื่อนขึ้นลง (ความกว้างเท่าเดิม) — ห้ามล้างตอนนั้น
 */
export function signatureShouldReset(prevWidth: number, nextWidth: number): boolean {
  if (prevWidth < 0) return false; // ครั้งแรกที่วัดขนาด ยังไม่มีลายเซ็น
  return Math.round(prevWidth) !== Math.round(nextWidth);
}

const TEMP_PREFIX = "TMP-";
export function isTempSerial(serial: string | undefined | null): boolean {
  return (serial ?? "").trim().toUpperCase().startsWith(TEMP_PREFIX);
}

/**
 * ฟอร์มแก้ไขเครื่อง: ช่อง Serial แก้ได้หรือไม่
 * เครื่องที่ยังใช้เลขชั่วคราว ต้องลง Serial จริงผ่านปุ่ม "ลง Serial จริง" เท่านั้น
 * (เส้นทางนั้นบันทึกประวัติ SERIAL และย้ายสัญญาที่อ้างเลขเดิมให้ในรายการเดียวกัน — เครื่องเดิม id เดิม)
 */
export function serialEditableInForm(isEdit: boolean, currentSerial: string | undefined | null): boolean {
  if (!isEdit) return true;
  return !isTempSerial(currentSerial);
}

/** รายการแจ้งเตือนที่มาจากแชทต่องาน แสดงเฉพาะเมื่อเปิดฟังก์ชันแชท (HIDE-01) */
export function chatNotificationsEnabled(features: { chat: boolean }): boolean {
  return features.chat === true;
}

/**
 * รหัสสาขา (CUS-02 / BR-13.1) — ข้อความตัวเลข 2 หลัก เช่น "00" · ห้ามแปลงเป็นตัวเลข
 * ค่าว่างได้ (ใช้ชื่อร้านแทน) · ข้อมูลเก่าที่ไม่ตรงรูปแบบและไม่ได้ถูกแก้ ไม่ต้องบังคับ (กติกาเดียวกับ backend)
 */
export function branchNoError(value: string, original?: string): string | null {
  const v = (value ?? "").trim();
  if (v === "") return null;
  if (original !== undefined && v === (original ?? "").trim()) return null;
  return /^\d{2}$/.test(v) ? null : "รหัสสาขาต้องเป็นตัวเลข 2 หลัก เช่น 00 หรือ 01";
}
