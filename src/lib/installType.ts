// ---------------------------------------------------------------------------
// INST-01 (Customer Feedback v2): เลือกประเภทงานหลัก "ติดตั้ง" แล้วเลือกประเภทย่อย "เช่า" หรือ "ขาย"
// ในฟอร์มเดียวกัน ใช้รูปแบบเดียวกันตั้งแต่เปิดคิวถึงใบงาน
// ค่าที่บันทึกยังเป็น jobType เดิมของระบบ (INSTALL_RENT / INSTALL_SALE) — ไม่ต้องย้ายข้อมูล
// INSTALL (ติดตั้ง ไม่ระบุเช่า/ขาย) เป็นค่าเดิมของข้อมูลเก่า: แสดงได้ แต่การบันทึกใหม่ต้องเลือกเช่า/ขาย
// D-09 (CUSTOMER APPROVED, Round 3): เพิ่มประเภทย่อย "เช่าซื้อ" (INSTALL_HIRE_PURCHASE) — จัดประเภทเท่านั้น
//   ขั้นการเงิน/โอนกรรมสิทธิ์ยังรอ D-11 (ระบบไม่เปลี่ยนสถานะเครื่องและไม่นับรายรับให้งานนี้)
// ---------------------------------------------------------------------------

export const INSTALL_GROUP = "INSTALL_GROUP";
export const INSTALL_SUBTYPES = [
  { value: "INSTALL_RENT", label: "เช่า" },
  { value: "INSTALL_SALE", label: "ขาย" },
  { value: "INSTALL_HIRE_PURCHASE", label: "เช่าซื้อ" },
] as const;

const INSTALL_VALUES = ["INSTALL", "INSTALL_RENT", "INSTALL_SALE", "INSTALL_HIRE_PURCHASE"];

export function isInstallType(jobType: string): boolean {
  return INSTALL_VALUES.includes(jobType);
}

/** ค่าในช่อง "ประเภทงานหลัก" ของ jobType ที่บันทึกจริง */
export function mainTypeOf(jobType: string): string {
  return isInstallType(jobType) ? INSTALL_GROUP : jobType;
}

/** ค่าในช่อง "ประเภทย่อยงานติดตั้ง" ("" = ยังไม่เลือก — รวมข้อมูลเก่า INSTALL) */
export function installSubtypeOf(jobType: string): string {
  return jobType === "INSTALL_RENT" || jobType === "INSTALL_SALE" || jobType === "INSTALL_HIRE_PURCHASE" ? jobType : "";
}

/**
 * ตัวเลือกประเภทงานหลัก: รวม ติดตั้ง/ติดตั้งเช่า/ติดตั้งขาย เป็น "ติดตั้ง" ตัวเดียว
 * hidden = ค่าเดิมที่ไม่ให้เลือกในงานใหม่ (ยังแสดงถ้าเป็นค่าปัจจุบัน)
 */
export function mainTypeOptions(
  jobTypes: { value: string; label: string }[],
  current: string,
  hidden: string[] = []
): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  let installAdded = false;
  for (const o of jobTypes) {
    if (isInstallType(o.value)) {
      if (!installAdded) out.push({ value: INSTALL_GROUP, label: "ติดตั้ง" });
      installAdded = true;
      continue;
    }
    if (hidden.includes(o.value) && o.value !== current) continue;
    out.push(o);
  }
  return out;
}

/** เปลี่ยนประเภทงานหลัก → jobType ที่จะบันทึก (ติดตั้ง = รอเลือกเช่า/ขาย: คงค่าเดิมถ้าเป็นติดตั้งอยู่แล้ว) */
export function jobTypeFromMain(main: string, previous: string): string {
  if (main === INSTALL_GROUP) return isInstallType(previous) ? previous : "INSTALL";
  return main;
}

/** ข้อความผิดพลาดก่อนบันทึก (null = ผ่าน) */
export function installSubtypeError(jobType: string): string | null {
  return jobType === "INSTALL" ? "งานติดตั้งต้องเลือกประเภทย่อย เช่า หรือ ขาย" : null;
}
