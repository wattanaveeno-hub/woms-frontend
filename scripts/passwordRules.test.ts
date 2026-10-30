/**
 * D-04 การจัดการรหัสผ่าน — กฎฟอร์มเปลี่ยนรหัสผ่าน
 *   npm test  (= node --test scripts/*.test.ts)
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  CHANGE_PASSWORD_PATH,
  PASSWORD_MIN_LENGTH,
  needsPasswordRedirect,
  validateChangePassword,
} from "../src/lib/passwordRules.ts";

const ok = { currentPassword: "old-pass-1", newPassword: "new-pass-12", confirmPassword: "new-pass-12" };

test("ฟอร์มถูกต้อง → ไม่มี error", () => {
  assert.deepEqual(validateChangePassword(ok), {});
});

test("ช่องว่างทุกช่อง → ข้อความภาษาไทยครบทุกช่อง", () => {
  const e = validateChangePassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
  assert.equal(e.currentPassword, "กรุณากรอกรหัสผ่านปัจจุบัน");
  assert.equal(e.newPassword, "กรุณากรอกรหัสผ่านใหม่");
  assert.equal(e.confirmPassword, "กรุณายืนยันรหัสผ่านใหม่");
});

test("รหัสผ่านใหม่สั้นกว่า 8 ตัว", () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8);
  const e = validateChangePassword({ ...ok, newPassword: "1234567", confirmPassword: "1234567" });
  assert.equal(e.newPassword, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
  assert.deepEqual(validateChangePassword({ ...ok, newPassword: "12345678", confirmPassword: "12345678" }), {});
});

test("รหัสผ่านใหม่ซ้ำกับรหัสผ่านปัจจุบัน", () => {
  const e = validateChangePassword({ currentPassword: "same-pass-1", newPassword: "same-pass-1", confirmPassword: "same-pass-1" });
  assert.equal(e.newPassword, "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน");
});

test("ยืนยันรหัสผ่านไม่ตรง", () => {
  const e = validateChangePassword({ ...ok, confirmPassword: "new-pass-13" });
  assert.equal(e.confirmPassword, "รหัสผ่านยืนยันไม่ตรงกับรหัสผ่านใหม่");
  assert.equal(e.newPassword, undefined);
});

test("ต้องเปลี่ยนรหัสผ่าน → ทุกหน้ายกเว้นหน้าเปลี่ยนรหัสผ่านต้อง redirect", () => {
  assert.equal(CHANGE_PASSWORD_PATH, "/account/password");
  assert.equal(needsPasswordRedirect(true, "/dashboard"), true);
  assert.equal(needsPasswordRedirect(true, "/m"), true);
  assert.equal(needsPasswordRedirect(true, CHANGE_PASSWORD_PATH), false);
  assert.equal(needsPasswordRedirect(false, "/dashboard"), false);
  // บัญชีเดิมที่ไม่มีฟิลด์ → ไม่บังคับ
  assert.equal(needsPasswordRedirect(undefined, "/dashboard"), false);
});
