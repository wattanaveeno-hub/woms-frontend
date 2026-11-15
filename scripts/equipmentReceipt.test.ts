import { test } from "node:test";
import assert from "node:assert/strict";
import { activeReceiptMachines, costSatang, receiptStatusLabel, receiptTotals, splitSerials } from "../src/lib/equipmentReceipt.ts";

test("splitSerials: บรรทัดใหม่ / จุลภาค / tab / ช่องว่างหัวท้าย / บรรทัดว่าง", () => {
  assert.deepEqual(splitSerials("A1\nA2\r\n\n  A3  ,A4;A5\tA6\n"), ["A1", "A2", "A3", "A4", "A5", "A6"]);
  assert.deepEqual(splitSerials(""), []);
});

test("receiptTotals: รวมเครื่อง · เลขชั่วคราวส่วนที่ไม่ระบุ · Serial เกินจำนวน", () => {
  const t = receiptTotals([
    { model: "RO-5", quantityText: "3", serialsText: "A\nB", condition: "NEW" },
    { model: "HF", quantityText: "", serialsText: "", condition: "NEW" },
    { model: "X", quantityText: "1", serialsText: "C\nD", condition: "USED" },
  ]);
  assert.equal(t.total, 4);
  assert.equal(t.temp, 1);
  assert.deepEqual(t.lines.map((l) => l.overflow), [false, false, true]);
  assert.equal(t.anyOverflow, true);
});

test("BD-02 ต้นทุน: สตางค์ · ว่าง = ไม่ระบุ · รวมเฉพาะบรรทัดที่มีต้นทุน", () => {
  assert.equal(costSatang(""), null);
  assert.equal(costSatang("0.1"), 10);
  assert.equal(costSatang("-1"), null);
  const t = receiptTotals([
    { model: "A", quantityText: "3", serialsText: "", condition: "NEW", unitCostText: "0.1" },
    { model: "B", quantityText: "2", serialsText: "", condition: "NEW", unitCostText: "" },
  ]);
  assert.equal(t.totalCost, 0.3);
  assert.equal(receiptTotals([{ model: "A", quantityText: "1", serialsText: "", condition: "NEW" }]).totalCost, null);
});

test("BD-12 เครื่องที่ยังยกเลิกได้ + ป้ายสถานะ", () => {
  const m = activeReceiptMachines({ lines: [{ equipmentIds: ["a", "b"], serials: ["S1", "S2"] }], cancellations: [{ equipmentIds: ["a"] }] });
  assert.deepEqual(m, [{ id: "a", serial: "S1", cancelled: true }, { id: "b", serial: "S2", cancelled: false }]);
  assert.equal(receiptStatusLabel(undefined), "รับเข้าแล้ว");
  assert.equal(receiptStatusLabel("CANCELLED"), "ยกเลิกแล้ว");
});
