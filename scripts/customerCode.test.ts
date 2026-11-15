import test from "node:test";
import assert from "node:assert/strict";
import { customerCodeProblemOnSave, isLegacyCustomerCode, newCustomerCodeProblem } from "../src/lib/customerCode.ts";

test("รหัสลูกค้าใหม่ 8 หลัก A-Z/0-9 · 0 นำหน้าคงไว้ · ค่าว่างผ่าน", () => {
  assert.equal(newCustomerCodeProblem("10000302"), null);
  assert.equal(newCustomerCodeProblem("00000001"), null);
  assert.equal(newCustomerCodeProblem("AB12CD34"), null);
  assert.equal(newCustomerCodeProblem(""), null);
  assert.match(newCustomerCodeProblem("0001") ?? "", /8 หลัก/);
  assert.match(newCustomerCodeProblem("100000001") ?? "", /8 หลัก/);
  assert.match(newCustomerCodeProblem("1000-001") ?? "", /เฉพาะตัวอักษรอังกฤษและตัวเลข/);
  assert.match(newCustomerCodeProblem("รหัสลูกค้า") ?? "", /เฉพาะตัวอักษรอังกฤษและตัวเลข/);
});

test("รหัสเดิมที่ไม่ใช่ 8 หลัก (I2228 / IR084) ไม่เปลี่ยน = ผ่าน · เปลี่ยนต้องเป็น 8 หลัก", () => {
  assert.equal(customerCodeProblemOnSave("I2228", "I2228"), null);
  assert.equal(customerCodeProblemOnSave(" IR084 ", "IR084"), null);
  assert.equal(customerCodeProblemOnSave("ir084", "IR084"), null); // เปลี่ยนแค่ตัวพิมพ์ = รหัสเดิม
  assert.match(customerCodeProblemOnSave("IR085", "IR084") ?? "", /8 หลัก/);
  assert.equal(customerCodeProblemOnSave("10000231", "IR084"), null);
  assert.equal(isLegacyCustomerCode("I2228"), true);
  assert.equal(isLegacyCustomerCode("10000231"), false);
});
