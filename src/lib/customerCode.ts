// รหัสลูกค้า: รหัสใหม่หรือที่แก้ยาวได้ไม่เกิน 8 ตัว (A-Z / 0-9) — UAT 2026-11-16 Owner (เดิม 13 พ.ย. 2569 ต้อง 8 ตัวพอดี)
// เก็บเป็นข้อความ (0 นำหน้าคงไว้) · กรอกเองได้ ระบบตรวจซ้ำกับฐานข้อมูล · ค่าว่าง = ไม่ระบุรหัส
// รหัสเดิมที่ไม่ใช่ 8 หลัก (เช่น I2228, IR084) ใช้ต่อได้ถ้าไม่เปลี่ยน — กติกาเดียวกับ backend domain/partner.ts
export const NEW_CUSTOMER_CODE_LENGTH = 8;

export function normalizeCustomerCodeInput(code: string): string {
  return String(code ?? "").trim().replace(/\s+/g, " ");
}

export function newCustomerCodeProblem(code: string): string | null {
  const v = normalizeCustomerCodeInput(code);
  if (!v) return null;
  if (!/^[A-Za-z0-9]+$/.test(v)) return "รหัสลูกค้าใช้ได้เฉพาะตัวอักษรอังกฤษและตัวเลข";
  // UAT 2026-11-16 (Owner): ใส่กี่ตัวก็ได้ ไม่เกิน 8 (เดิมต้อง 8 ตัวพอดี)
  if (v.length > NEW_CUSTOMER_CODE_LENGTH) return `รหัสลูกค้ายาวได้ไม่เกิน ${NEW_CUSTOMER_CODE_LENGTH} ตัว (ตอนนี้ ${v.length} ตัว)`;
  return null;
}

/** ตรวจตอนบันทึก: รหัสที่ไม่เปลี่ยนจากค่าเดิมผ่านเสมอ (รหัสเดิมที่ไม่ใช่ 8 หลักไม่ถูกบังคับแก้) */
export function customerCodeProblemOnSave(next: string, original = ""): string | null {
  const a = normalizeCustomerCodeInput(next);
  const o = normalizeCustomerCodeInput(original);
  if (a.toLowerCase() === o.toLowerCase()) return null;
  return newCustomerCodeProblem(a);
}

/** รหัสเดิมในระบบที่ไม่ตรงกติกาใหม่ (ใช้บอกผู้ใช้ว่ารหัสนี้ยังใช้ต่อได้) */
export function isLegacyCustomerCode(code: string): boolean {
  const v = normalizeCustomerCodeInput(code);
  return Boolean(v) && newCustomerCodeProblem(v) !== null;
}
