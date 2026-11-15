import { test } from "node:test";
import assert from "node:assert/strict";
import { moneyDisplay, stripLeadingZeros } from "../src/lib/moneyInput.ts";

test("ตัด 0 นำหน้าเมื่อพิมพ์ต่อจากค่าเริ่มต้น 0", () => {
  assert.equal(stripLeadingZeros("03"), "3");
  assert.equal(stripLeadingZeros("0005"), "5");
  assert.equal(stripLeadingZeros("0"), "0");
  assert.equal(stripLeadingZeros("0.5"), "0.5");
  assert.equal(stripLeadingZeros("00.5"), "0.5");
  assert.equal(stripLeadingZeros("1,000"), "1,000");
  assert.equal(stripLeadingZeros("2400"), "2400");
  assert.equal(stripLeadingZeros(""), "");
});

test("ค่าเริ่มต้น 0 แสดงเป็นช่องว่าง · ค่าที่กรอกแล้วแสดงตามเดิม", () => {
  assert.equal(moneyDisplay(undefined, 0), "");
  assert.equal(moneyDisplay(undefined, 2400), "2400");
  assert.equal(moneyDisplay("03", 3), "03");
  assert.equal(moneyDisplay("", 0), "");
});

// ---- Numeric input UX (Master Execution 14 พ.ย. 2569) ----
import { numericInitialText, numericTextValue, sanitizeNumericText } from "../src/lib/moneyInput.ts";

test("numeric: พิมพ์ต่อจาก 0 ไม่ค้าง 0 นำหน้า · 50000 = 50000", () => {
  assert.equal(sanitizeNumericText("050000"), "50000");
  assert.equal(sanitizeNumericText("50000"), "50000");
  assert.equal(sanitizeNumericText("0"), "0");
  assert.equal(sanitizeNumericText(""), "");
  assert.equal(sanitizeNumericText("00.25"), "0.25");
  assert.equal(sanitizeNumericText("1,250.50"), "1250.50");
  assert.equal(sanitizeNumericText("12.3.4"), "12.34");
  assert.equal(sanitizeNumericText("1e5"), "15");
  assert.equal(sanitizeNumericText("abc"), "");
});

test("numeric: จำนวนเต็ม / ค่าติดลบตามกติกาช่อง", () => {
  assert.equal(sanitizeNumericText("12.5", { integer: true }), "125");
  assert.equal(sanitizeNumericText("-5"), "5");
  assert.equal(sanitizeNumericText("-05.5", { allowNegative: true }), "-5.5");
  assert.equal(sanitizeNumericText("1-2", { allowNegative: true }), "12");
});

test("numeric: ค่าเริ่มต้น — ว่าง/0 แสดงช่องว่าง · ค่าที่บันทึกแล้วแสดงตามเดิม · ทศนิยมคงเดิม", () => {
  assert.equal(numericInitialText(0), "");
  assert.equal(numericInitialText("0"), "");
  assert.equal(numericInitialText("0.00"), "");
  assert.equal(numericInitialText(null), "");
  assert.equal(numericInitialText(undefined), "");
  assert.equal(numericInitialText(""), "");
  assert.equal(numericInitialText(0, false), "0");
  assert.equal(numericInitialText(2400), "2400");
  assert.equal(numericInitialText(13.7563), "13.7563");
  assert.equal(numericInitialText("1500.50"), "1500.50");
  assert.equal(numericInitialText(-12.5), "-12.5");
});

test("numeric: ข้อความ → ตัวเลข (ว่าง/ยังพิมพ์ไม่จบ = null)", () => {
  assert.equal(numericTextValue(""), null);
  assert.equal(numericTextValue("-"), null);
  assert.equal(numericTextValue("."), null);
  assert.equal(numericTextValue("13."), 13);
  assert.equal(numericTextValue("0"), 0);
  assert.equal(numericTextValue("50000"), 50000);
  assert.equal(numericTextValue("-5.5"), -5.5);
});
