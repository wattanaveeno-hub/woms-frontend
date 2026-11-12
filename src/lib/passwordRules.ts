/**
 * D-04 การจัดการรหัสผ่าน — กฎตรวจฟอร์มเปลี่ยนรหัสผ่าน + เส้นทางที่ใช้ได้ระหว่าง "ต้องเปลี่ยนรหัสผ่าน"
 * ไม่มี import ของ React/Next เพื่อให้ทดสอบด้วย node --test ได้
 */

/** ตรงกับ PASSWORD_MIN_LENGTH ของ backend (domain/user.ts) */
export const PASSWORD_MIN_LENGTH = 8;

/** หน้าเปลี่ยนรหัสผ่านของตัวเอง */
export const CHANGE_PASSWORD_PATH = "/account/password";

/** error code ที่ backend ตอบเมื่อบัญชีต้องเปลี่ยนรหัสผ่านก่อนใช้งาน (403) */
export const PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED";

export interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type ChangePasswordErrors = Partial<Record<keyof ChangePasswordForm, string>>;

/** D-04: ตรวจฟอร์มฝั่งหน้าเว็บ (backend ตรวจซ้ำอีกชั้น) — คืน {} เมื่อผ่าน */
export function validateChangePassword(f: ChangePasswordForm): ChangePasswordErrors {
  const e: ChangePasswordErrors = {};
  if (!f.currentPassword) e.currentPassword = "กรุณากรอกรหัสผ่านปัจจุบัน";
  if (!f.newPassword) e.newPassword = "กรุณากรอกรหัสผ่านใหม่";
  else if (f.newPassword.length < PASSWORD_MIN_LENGTH)
    e.newPassword = `รหัสผ่านใหม่ต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`;
  else if (f.currentPassword && f.newPassword === f.currentPassword)
    e.newPassword = "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน";
  if (!f.confirmPassword) e.confirmPassword = "กรุณายืนยันรหัสผ่านใหม่";
  else if (f.confirmPassword !== f.newPassword) e.confirmPassword = "รหัสผ่านยืนยันไม่ตรงกับรหัสผ่านใหม่";
  return e;
}

/** D-04: ขณะต้องเปลี่ยนรหัสผ่าน ให้อยู่ได้เฉพาะหน้าเปลี่ยนรหัสผ่าน — หน้าอื่นต้องพาไปหน้านี้ */
export function needsPasswordRedirect(mustChangePassword: boolean | undefined, path: string): boolean {
  return mustChangePassword === true && path !== CHANGE_PASSWORD_PATH;
}

/** รายการเงื่อนไขที่แสดงสดใต้ช่องรหัสผ่านใหม่ (บังคับ = backend ตรวจ · แนะนำ = ไม่บังคับ) */
export function passwordChecklist(f: Pick<ChangePasswordForm, "currentPassword" | "newPassword" | "confirmPassword">): {
  label: string;
  ok: boolean;
  required: boolean;
}[] {
  const pw = f.newPassword;
  return [
    { label: `อย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`, ok: pw.length >= PASSWORD_MIN_LENGTH, required: true },
    { label: "ไม่ซ้ำกับรหัสผ่านปัจจุบัน", ok: !!pw && pw !== f.currentPassword, required: true },
    { label: "ยืนยันรหัสผ่านตรงกัน", ok: !!pw && pw === f.confirmPassword, required: true },
    { label: "แนะนำ: ผสมตัวเลขและตัวพิมพ์ใหญ่-เล็ก", ok: /\d/.test(pw) && /[a-z]/.test(pw) && /[A-Z]/.test(pw), required: false },
  ];
}
