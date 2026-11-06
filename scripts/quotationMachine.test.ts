// CR-QT01 P3 — ตัวเลือกเครื่องในใบเสนอราคาแสดงแหล่งที่มาและสิทธิ์ PM ปัจจุบัน
import test from "node:test";
import assert from "node:assert/strict";
import { machineSourceLabel, pmEntitlementLabel, toEqOption } from "../src/lib/quotationMachine.ts";

test("แหล่งที่มา: เครื่องลูกค้า ขาย/เช่า · สต็อกบริษัทไม่ปนเป็นเครื่องลูกค้า", () => {
  assert.equal(machineSourceLabel({ customerId: "c1", status: "SOLD" }), "ขาย");
  assert.equal(machineSourceLabel({ customerId: "c1", status: "RENTED" }), "เช่า");
  assert.equal(machineSourceLabel({ customerId: "c1", status: "REPAIR", businessType: "SALE" }), "ขาย");
  assert.equal(machineSourceLabel({ customerId: "c1", status: "REPAIR" }), "ไม่ระบุแหล่ง");
  assert.equal(machineSourceLabel({ customerId: "", status: "IN_STOCK" }), "Stock บริษัท");
  // CR-EX01: เครื่องลูกค้าภายนอกแยกแหล่งที่มาระดับเครื่อง
  assert.equal(machineSourceLabel({ customerId: "c1", status: "EXTERNAL" }), "เครื่องลูกค้าภายนอก");
  assert.equal(machineSourceLabel({ customerId: "c1", status: "REPAIR", machineSource: "CUSTOMER_EXTERNAL" }), "เครื่องลูกค้าภายนอก");
});

test("สิทธิ์ PM: Package คงเหลือ / ใช้ครบ / PM เช่า / ไม่มี", () => {
  assert.equal(pmEntitlementLabel({ pmMode: "PACKAGE", pmPackage: "PM 4 ครั้ง", pmPackageRoundsTotal: 4, pmPackageRoundsUsed: 1 }), "PM 4 ครั้ง คงเหลือ 3/4");
  assert.equal(pmEntitlementLabel({ pmMode: "PACKAGE", pmPackageRoundsTotal: 2, pmPackageRoundsUsed: 2 }), "Package PM คงเหลือ 0/2 (ใช้ครบ)");
  assert.equal(pmEntitlementLabel({ pmMode: "RENTAL" }), "PM เช่า");
  assert.equal(pmEntitlementLabel({}), "ไม่มีสิทธิ์ PM");
});

test("toEqOption: สาขา · Pending Serial", () => {
  const o = toEqOption({ id: "e1", serial: "TMP-2026-00001", model: "FZ-200", customerId: "c1", siteId: "s1", siteLabel: "ร้าน A (สาขา 00)", status: "RENTED", hasRealSerial: false });
  assert.deepEqual(o, { id: "e1", serial: "TMP-2026-00001", model: "FZ-200", customerId: "c1", siteId: "s1", siteLabel: "ร้าน A (สาขา 00)", source: "เช่า", entitlement: "ไม่มีสิทธิ์ PM", pendingSerial: true });
});
