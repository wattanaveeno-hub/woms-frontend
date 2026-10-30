import test from "node:test";
import assert from "node:assert/strict";
import { categoriesFor, changeCategory, changeModel, changeType, cascadeProblem, modelsFor, type MasterRow } from "../src/lib/equipmentModelCascade.ts";

const R = (id: string, type: string, category: string, model: string, standardPrice = 2000): MasterRow => ({ id, type, category, model, standardPrice });
const rows = [
  R("1", "ตู้ฟรีส", "ตู้ยืน", "HF-78HS"),
  R("2", "ตู้แช่", "ตู้นอน", "RT-188MA-F"),
  R("3", "เครื่องทำน้ำแข็ง", "หัว+ถัง", "IM-220A + B-301"),
  R("4", "เครื่องทำน้ำแข็ง", "หัว", "SRM-200AB", 2500),
  R("5", "เครื่องทำน้ำแข็ง", "ถัง", "B-501"),
  R("6", "เครื่องทำน้ำแข็ง", "เครื่องถังเก็บในตัว", "SRM-125A"),
];
const empty = { machineType: "", category: "", model: "" };

test("D-07A: หมวดหมู่กรองตามประเภท · รุ่นกรองตามประเภท+หมวดหมู่", () => {
  assert.deepEqual(categoriesFor("เครื่องทำน้ำแข็ง", rows).sort(), ["ถัง", "หัว", "หัว+ถัง", "เครื่องถังเก็บในตัว"].sort());
  assert.deepEqual(modelsFor("เครื่องทำน้ำแข็ง", "หัว", rows).map((r) => r.model), ["SRM-200AB"]);
  assert.equal(categoriesFor("", rows).length, 6);
});

test("D-07A: เลือกรุ่น → เติมประเภท หมวดหมู่ และราคามาตรฐาน (Auto Fill)", () => {
  const r = changeModel(empty, "SRM-200AB", rows, rows[3]);
  assert.deepEqual([r.machineType, r.category, r.model, r.master?.standardPrice], ["เครื่องทำน้ำแข็ง", "หัว", "SRM-200AB", 2500]);
  const typed = changeModel(empty, " hf-78hs ", rows);
  assert.deepEqual([typed.machineType, typed.category, typed.model], ["ตู้ฟรีส", "ตู้ยืน", "HF-78HS"]);
});

test("D-07A: เปลี่ยนประเภท/หมวดหมู่ → ล้างค่าลูกที่ไม่ตรง · รุ่นนอก master (ข้อมูลเดิม) ไม่ถูกล้าง", () => {
  const picked = changeModel(empty, "SRM-200AB", rows, rows[3]);
  const t = changeType(picked, "ตู้แช่", rows);
  assert.deepEqual([t.machineType, t.category, t.model, t.master], ["ตู้แช่", "", "", null]);
  const c = changeCategory(picked, "ถัง", rows);
  assert.deepEqual([c.machineType, c.category, c.model], ["เครื่องทำน้ำแข็ง", "ถัง", ""]);
  const legacy = changeType({ machineType: "ตู้แช่", category: "ตู้นอน", model: "LEGACY-1" }, "เครื่องทำน้ำแข็ง", rows);
  assert.deepEqual([legacy.category, legacy.model], ["", "LEGACY-1"]);
  // เลือกหมวดหมู่ก่อนประเภท: หมวดหมู่อยู่ใต้ประเภทเดียว → เติมประเภท
  assert.equal(changeCategory(empty, "ตู้ยืน", rows).machineType, "ตู้ฟรีส");
});

test("D-07A: ค่าที่ขัดกับ master แสดงข้อความ (backend จะปฏิเสธ)", () => {
  assert.match(cascadeProblem({ machineType: "ตู้แช่", category: "", model: "HF-78HS" }, rows), /ตู้ฟรีส/);
  assert.equal(cascadeProblem({ machineType: "ตู้ฟรีส", category: "ตู้ยืน", model: "HF-78HS" }, rows), "");
  assert.equal(cascadeProblem({ machineType: "ตู้แช่", category: "", model: "LEGACY" }, rows), "");
  assert.equal(cascadeProblem({ machineType: "ตู้ฟรีส", category: "อื่น", model: "HF-78HS" }, rows, { hasCategory: false }), "");
});
