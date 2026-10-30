// D-06 (CUSTOMER APPROVED): รหัสลูกค้าใหม่หรือที่แก้ ยาวไม่เกิน 4 ตัว (A-Z / 0-9) เก็บเป็นข้อความ (0 นำหน้าคงไว้)
// รหัสเดิมที่ยาวกว่า 4 (เช่น I2228, IR084) ใช้ต่อได้ถ้าไม่เปลี่ยน — กติกาเดียวกับ backend domain/partner.ts
export const NEW_CUSTOMER_CODE_MAX = 4;

export function newCustomerCodeProblem(code: string): string | null {
  const v = String(code ?? "").trim().replace(/\s+/g, " ");
  if (!v) return null;
  if (v.length > NEW_CUSTOMER_CODE_MAX) return `รหัสลูกค้าใหม่ยาวได้ไม่เกิน ${NEW_CUSTOMER_CODE_MAX} ตัวอักษร`;
  if (!/^[A-Za-z0-9]+$/.test(v)) return "รหัสลูกค้าใหม่ใช้ได้เฉพาะตัวอักษรอังกฤษและตัวเลข";
  return null;
}

/** ตรวจตอนบันทึก: รหัสที่ไม่เปลี่ยนจากค่าเดิมผ่านเสมอ (รหัสเดิมยาวกว่า 4 ไม่ถูกบังคับแก้) */
export function customerCodeProblemOnSave(next: string, original = ""): string | null {
  const a = String(next ?? "").trim();
  if (a === String(original ?? "").trim()) return null;
  return newCustomerCodeProblem(a);
}
