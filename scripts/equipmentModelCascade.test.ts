import test from "node:test";
import assert from "node:assert/strict";
import { categoriesFor, changeCategory, changeModel, changeType, cascadeProblem, modelsFor, normKey, type MasterRow } from "../src/lib/equipmentModelCascade.ts";

const R = (id: string, type: string, category: string, model: string, standardCost = 2000): MasterRow => ({ id, type, category, model, standardCost });
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
  assert.deepEqual([r.machineType, r.category, r.model, r.master?.standardCost], ["เครื่องทำน้ำแข็ง", "หัว", "SRM-200AB", 2500]);
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

test("ADV3-07 normKey ตัดอักขระมองไม่เห็น", () => {
  assert.equal(normKey("HF-78HS\u200B"), normKey("hf-78hs"));
  assert.equal(normKey("\uFEFFRT 188"), "RT 188");
  assert.equal(normKey("HF-78HS\u034F\uFE0F\u3164\u2800"), "HF-78HS");
  assert.equal(normKey("ตู้แช่"), "ตู้แช่");
});

// ---- EQ-02: Searchable Dropdown 3 ช่อง ----
import { categoryOptionsFor, inferCategory, legacyModel, matchesQuery, modelOptionsFor, modelValueFor, typeOptionsFor, typeOptionsForModel } from "../src/lib/equipmentModelCascade.ts";

const SYSTEM = ["ตู้แช่", "เครื่องทำน้ำแข็ง", "อื่น ๆ"];
// รุ่นชื่อซ้ำต่างหมวดหมู่ (ข้อมูลทดสอบเท่านั้น)
const dup = [...rows, R("7", "เครื่องทำน้ำแข็ง", "ถัง", "SRM-200AB", 1800)];

test("EQ-02: ประเภท = ประเภทระบบ + master ไม่ซ้ำ · ค่าเดิมนอกรายการเป็นข้อมูลเดิม", () => {
  const t = typeOptionsFor(rows, "", SYSTEM);
  assert.deepEqual(t.map((o) => o.value), ["ตู้แช่", "เครื่องทำน้ำแข็ง", "อื่น ๆ", "ตู้ฟรีส"]);
  assert.ok(t.every((o) => !o.legacy));
  const legacy = typeOptionsFor(rows, "ตู้เย็นเก่า", SYSTEM);
  assert.deepEqual(legacy.at(-1), { value: "ตู้เย็นเก่า", legacy: true });
  assert.equal(typeOptionsFor(rows, " ตู้แช่ ", SYSTEM).filter((o) => o.legacy).length, 0, "ช่องว่าง/ตัวพิมพ์ไม่ทำให้เป็นข้อมูลเดิม");
});

test("EQ-02: หมวดหมู่กรองตามประเภท · ค่าเดิมนอก master ต่อท้าย", () => {
  assert.deepEqual(categoryOptionsFor("ตู้แช่", rows, "").map((o) => o.value), ["ตู้นอน"]);
  assert.deepEqual(categoryOptionsFor("ตู้แช่", rows, "ตู้ทรงสูง").at(-1), { value: "ตู้ทรงสูง", legacy: true });
  assert.equal(categoryOptionsFor("", rows, "").length, 6);
});

test("EQ-02: รุ่นกรองตามประเภท+หมวดหมู่ · รุ่นนอก master แสดงเป็นข้อมูลเดิม · ไม่สร้างแถวใหม่", () => {
  assert.deepEqual(modelOptionsFor("เครื่องทำน้ำแข็ง", "หัว", rows, "").map((o) => o.model), ["SRM-200AB"]);
  const withLegacy = modelOptionsFor("ตู้แช่", "", rows, "LEGACY-9");
  assert.deepEqual(withLegacy.map((o) => o.model), ["RT-188MA-F", "LEGACY-9"]);
  assert.equal(withLegacy.at(-1)?.legacy, true);
  assert.equal(withLegacy.at(-1)?.id, "legacy:LEGACY-9");
  // รุ่นที่อยู่ใน master (แม้ไม่อยู่ใต้ประเภทนี้) ไม่ถูกทำเป็นข้อมูลเดิม
  assert.equal(modelOptionsFor("ตู้แช่", "", rows, "HF-78HS").some((o) => o.legacy), false);
});

test("EQ-02: รุ่นชื่อซ้ำต่างหมวดหมู่ — ตัวเลือกแยกแถว (id) · ค่าที่แสดงตามหมวดหมู่ / แถวที่เลือก", () => {
  const opts = modelOptionsFor("เครื่องทำน้ำแข็ง", "", dup, "SRM-200AB");
  assert.deepEqual(opts.filter((o) => o.model === "SRM-200AB").map((o) => o.category).sort(), ["ถัง", "หัว"].sort());
  // บันทึกหมวดหมู่ (คลัง): ตรงชุดเดียว
  assert.equal(modelValueFor({ machineType: "เครื่องทำน้ำแข็ง", category: "ถัง", model: "SRM-200AB" }, dup, opts)?.id, "7");
  // ไม่บันทึกหมวดหมู่ (คิว): ใช้แถวที่เลือกล่าสุด
  assert.equal(modelValueFor({ machineType: "เครื่องทำน้ำแข็ง", category: "", model: "SRM-200AB" }, dup, opts, "7")?.id, "7");
  assert.equal(modelValueFor({ machineType: "เครื่องทำน้ำแข็ง", category: "", model: "SRM-200AB" }, dup, opts, "4")?.id, "4");
  // เลือกแถว → เติมหมวดหมู่ของแถวนั้น (ไม่เดา)
  const r = changeModel({ machineType: "", category: "", model: "" }, "SRM-200AB", dup, dup[6]);
  assert.deepEqual([r.machineType, r.category, r.master?.id], ["เครื่องทำน้ำแข็ง", "ถัง", "7"]);
  // พิมพ์ชื่อซ้ำโดยไม่ระบุหมวดหมู่ → ไม่เติมหมวดหมู่ (ตรงหลายชุด)
  assert.equal(changeModel({ machineType: "เครื่องทำน้ำแข็ง", category: "", model: "" }, "SRM-200AB", dup).category, "");
});

test("EQ-02: ค่าที่แสดง — ไม่มีรุ่น = null · รุ่นนอก master = ข้อมูลเดิม · รุ่นใน master ที่ขัดประเภท = แถว master", () => {
  const opts = modelOptionsFor("ตู้แช่", "", rows, "");
  assert.equal(modelValueFor({ machineType: "ตู้แช่", category: "", model: "" }, rows, opts), null);
  assert.deepEqual(modelValueFor({ machineType: "ตู้แช่", category: "", model: "OLD-1" }, rows, opts), legacyModel("OLD-1"));
  assert.equal(modelValueFor({ machineType: "ตู้แช่", category: "", model: "HF-78HS" }, rows, opts)?.id, "1");
});

test("EQ-02: หมวดหมู่สำหรับกรอง (คิว) อนุมานจาก master เฉพาะเมื่อตรงชุดเดียว", () => {
  assert.equal(inferCategory("ตู้ฟรีส", "HF-78HS", rows), "ตู้ยืน");
  assert.equal(inferCategory("", "hf-78hs", rows), "ตู้ยืน");
  assert.equal(inferCategory("เครื่องทำน้ำแข็ง", "SRM-200AB", dup), "", "ตรงหลายหมวดหมู่ ไม่เดา");
  assert.equal(inferCategory("ตู้แช่", "LEGACY", rows), "");
  assert.equal(inferCategory("ตู้แช่", "", rows), "");
});

test("EQ-02: ค้นหาแบบ contains ไม่สนตัวพิมพ์/ช่องว่าง (normKey เดียวกับ backend)", () => {
  assert.equal(matchesQuery("SRM-200AB", "200"), true);
  assert.equal(matchesQuery("SRM-200AB", "srm-2"), true);
  assert.equal(matchesQuery("IM-220A + B-301", "a  +  b"), true);
  assert.equal(matchesQuery("เครื่องทำน้ำแข็ง", "น้ำแข็ง"), true);
  assert.equal(matchesQuery("ตู้ยืน", "นอน"), false);
  assert.equal(matchesQuery("ตู้ยืน", ""), true);
  assert.equal(matchesQuery("HF-78HS", "hf-78hs​"), true);
});

test("EQ-02: รายการเครื่องในใบงาน — ประเภทตามรุ่นที่กำหนด (รุ่นใน master) · รุ่นนอก master = ทุกประเภท", () => {
  assert.deepEqual(typeOptionsForModel("HF-78HS", rows, "ตู้ฟรีส", SYSTEM).map((o) => o.value), ["ตู้ฟรีส"]);
  assert.deepEqual(typeOptionsForModel("hf-78hs", rows, "", SYSTEM).map((o) => o.value), ["ตู้ฟรีส"]);
  // ค่าเดิมที่ขัดกับ master ยังแสดง (ข้อมูลเดิม) — ไม่ล้างเอง
  assert.deepEqual(typeOptionsForModel("HF-78HS", rows, "ตู้แช่", SYSTEM).at(-1), { value: "ตู้แช่", legacy: true });
  assert.deepEqual(typeOptionsForModel("LEGACY-9", rows, "", SYSTEM).map((o) => o.value), ["ตู้แช่", "เครื่องทำน้ำแข็ง", "อื่น ๆ", "ตู้ฟรีส"]);
  assert.deepEqual(typeOptionsForModel("", rows, "", SYSTEM).length, 4);
  // รุ่นชื่อซ้ำต่างหมวดหมู่ ประเภทเดียวกัน → ประเภทเดียว
  assert.deepEqual(typeOptionsForModel("SRM-200AB", dup, "", SYSTEM).map((o) => o.value), ["เครื่องทำน้ำแข็ง"]);
});
