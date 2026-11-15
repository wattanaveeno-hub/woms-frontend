// รหัสลูกค้า (แทน D-06 เดิม ≤ 4 ตัว · Owner สั่งเปลี่ยน 13 พ.ย. 2569): รหัสใหม่หรือที่แก้ต้องมี 8 หลัก (A-Z / 0-9)
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
  if (v.length !== NEW_CUSTOMER_CODE_LENGTH) return `รหัสลูกค้าใหม่ต้องมี ${NEW_CUSTOMER_CODE_LENGTH} หลัก (ตอนนี้ ${v.length} หลัก)`;
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
