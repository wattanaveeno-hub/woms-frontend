import test from "node:test";
import assert from "node:assert/strict";
import { customerCodeProblemOnSave, isLegacyCustomerCode, newCustomerCodeProblem } from "../src/lib/customerCode.ts";

test("รหัสลูกค้าใหม่ ไม่เกิน 8 ตัว A-Z/0-9 (UAT 2026-11-16) · 0 นำหน้าคงไว้ · ค่าว่างผ่าน", () => {
  assert.equal(newCustomerCodeProblem("10000302"), null);
  assert.equal(newCustomerCodeProblem("00000001"), null);
  assert.equal(newCustomerCodeProblem("AB12CD34"), null);
  assert.equal(newCustomerCodeProblem(""), null);
  assert.equal(newCustomerCodeProblem("0001"), null);
  assert.equal(newCustomerCodeProblem("I1234"), null);
  assert.equal(newCustomerCodeProblem("IR123"), null);
  assert.match(newCustomerCodeProblem("100000001") ?? "", /ไม่เกิน 8/);
  assert.match(newCustomerCodeProblem("1000-001") ?? "", /เฉพาะตัวอักษรอังกฤษและตัวเลข/);
  assert.match(newCustomerCodeProblem("รหัสลูกค้า") ?? "", /เฉพาะตัวอักษรอังกฤษและตัวเลข/);
});

test("รหัสเดิมไม่เปลี่ยน = ผ่าน · เปลี่ยนได้ถ้าไม่เกิน 8 ตัว · รหัสเดิมที่ยาวเกิน 8 = legacy", () => {
  assert.equal(customerCodeProblemOnSave("I2228", "I2228"), null);
  assert.equal(customerCodeProblemOnSave(" IR084 ", "IR084"), null);
  assert.equal(customerCodeProblemOnSave("ir084", "IR084"), null); // เปลี่ยนแค่ตัวพิมพ์ = รหัสเดิม
  assert.equal(customerCodeProblemOnSave("IR085", "IR084"), null);
  assert.match(customerCodeProblemOnSave("IR0850001", "IR084") ?? "", /ไม่เกิน 8/);
  assert.equal(customerCodeProblemOnSave("10000231", "IR084"), null);
  assert.equal(isLegacyCustomerCode("I2228"), false);
  assert.equal(isLegacyCustomerCode("CUST-0001"), true);
  assert.equal(isLegacyCustomerCode("10000231"), false);
});
