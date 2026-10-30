import test from "node:test";
import assert from "node:assert/strict";
import { customerCodeProblemOnSave, newCustomerCodeProblem } from "../src/lib/customerCode.ts";

test("D-06: รหัสใหม่ ≤ 4 ตัว A-Z/0-9 · 0 นำหน้าคงไว้", () => {
  assert.equal(newCustomerCodeProblem("0001"), null);
  assert.equal(newCustomerCodeProblem("AB12"), null);
  assert.equal(newCustomerCodeProblem("a1"), null);
  assert.equal(newCustomerCodeProblem(""), null);
  assert.match(newCustomerCodeProblem("ABCDE") ?? "", /ไม่เกิน 4/);
  assert.match(newCustomerCodeProblem("A-1") ?? "", /เฉพาะตัวอักษรอังกฤษและตัวเลข/);
  assert.match(newCustomerCodeProblem("รหัส") ?? "", /เฉพาะตัวอักษรอังกฤษและตัวเลข/);
});

test("D-06: รหัสเดิมยาวกว่า 4 (I2228 / IR084) ไม่เปลี่ยน = ผ่าน · เปลี่ยนเป็นรหัสยาวใหม่ = ไม่ผ่าน", () => {
  assert.equal(customerCodeProblemOnSave("I2228", "I2228"), null);
  assert.equal(customerCodeProblemOnSave(" IR084 ", "IR084"), null);
  assert.match(customerCodeProblemOnSave("IR085", "IR084") ?? "", /ไม่เกิน 4/);
  assert.equal(customerCodeProblemOnSave("IR08", "IR084"), null);
});
