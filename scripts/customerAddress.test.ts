import { test } from "node:test";
import assert from "node:assert/strict";
import { addressFromMap, looksLikeMapLink, thaiAddressLabel } from "../src/lib/customerAddress.ts";

test("ลิงก์แผนที่: รับลิงก์ Google/พิกัด · ไม่รับโดเมนอื่น", () => {
  assert.equal(looksLikeMapLink("https://maps.app.goo.gl/AbC"), true);
  assert.equal(looksLikeMapLink("https://www.google.com/maps/place/x/@13.7,100.5,17z"), true);
  assert.equal(looksLikeMapLink("13.7563, 100.5018"), true);
  assert.equal(looksLikeMapLink("https://evil.example/maps"), false);
  assert.equal(looksLikeMapLink(""), false);
});

test("ป้ายที่อยู่: กรุงเทพใช้ แขวง/เขต · ต่างจังหวัดใช้ ต./อ./จ.", () => {
  assert.equal(thaiAddressLabel({ subdistrict: "สีลม", district: "บางรัก", province: "กรุงเทพมหานคร", postcode: "10500" }), "แขวงสีลม เขตบางรัก กรุงเทพมหานคร 10500");
  assert.equal(thaiAddressLabel({ subdistrict: "คลองหนึ่ง", district: "คลองหลวง", province: "ปทุมธานี", postcode: "12120" }), "ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี 12120");
});

test("ผลแผนที่ → ช่องฟอร์ม: overwrite แทนค่า · ไม่ overwrite เติมเฉพาะช่องว่าง · ที่อยู่เติมเมื่อว่างเท่านั้น", () => {
  const g = { lat: 13.72, lng: 100.53, street: "ถนนสีลม", subdistrict: "สีลม", district: "บางรัก", province: "กรุงเทพมหานคร", postcode: "10500" };
  const prev = { address: "99 ซอยเดิม", subdistrict: "เดิม", district: "", province: "", postcode: "", lat: "", lng: "" };
  assert.deepEqual(addressFromMap(prev, g, false), { lat: "13.72", lng: "100.53", district: "บางรัก", province: "กรุงเทพมหานคร", postcode: "10500" });
  assert.deepEqual(addressFromMap(prev, g, true), { lat: "13.72", lng: "100.53", subdistrict: "สีลม", district: "บางรัก", province: "กรุงเทพมหานคร", postcode: "10500" });
  assert.deepEqual(addressFromMap({ ...prev, address: "" }, g, true).address, "ถนนสีลม");
  assert.deepEqual(addressFromMap(prev, { ...g, lat: null, lng: null, subdistrict: "" }, true), { district: "บางรัก", province: "กรุงเทพมหานคร", postcode: "10500" });
});
