// D-07A: Type → Category → Model (Equipment Model Master) — กติกาเปลี่ยนค่าแบบลำดับชั้น + Auto Fill
// ฟังก์ชันล้วน (ทดสอบด้วย node --test) · backend ตรวจความสัมพันธ์ซ้ำทุกครั้ง (ไม่พึ่งหน้าเว็บ)

export interface MasterRow {
  id: string;
  type: string;
  category: string;
  model: string;
  /** ต้นทุนมาตรฐาน (ค่าอ้างอิง — ไม่ใช่ราคาค่าติดตั้ง ห้ามเติมลงช่องราคาใด ๆ) · null = ไม่มีสิทธิ์ดูต้นทุน */
  standardCost: number | null;
  costStatus?: "APPROVED" | "UNAPPROVED";
}
export interface CascadeValue {
  machineType: string;
  category: string;
  model: string;
}
export interface CascadeResult extends CascadeValue {
  /** รุ่นที่เลือกตรง master ชุดเดียว (ใช้แสดงต้นทุนมาตรฐานเป็นข้อมูลอ้างอิง) */
  master: MasterRow | null;
}

// ADV3-07 / ADV3C-03: ตัดอักขระมองไม่เห็น (Unicode Cf + อักขระว่างอื่น) ให้ตรงกับ backend
export const normKey = (v: unknown) => String(v ?? "").replace(/[\p{Cf}\u034F\uFE00-\uFE0F\u{E0100}-\u{E01EF}\u115F\u1160\u3164\uFFA0\u2800]/gu, "").normalize("NFC").trim().replace(/\s+/g, " ").toUpperCase();
const eq = (a: unknown, b: unknown) => normKey(a) === normKey(b);

export function categoriesFor(type: string, rows: MasterRow[]): string[] {
  return uniq(rows.filter((r) => !type || eq(r.type, type)).map((r) => r.category));
}
export function modelsFor(type: string, category: string, rows: MasterRow[]): MasterRow[] {
  return rows.filter((r) => (!type || eq(r.type, type)) && (!category || eq(r.category, category)));
}
function uniq(xs: string[]) {
  const m = new Map<string, string>();
  for (const x of xs) if (!m.has(normKey(x))) m.set(normKey(x), x);
  return [...m.values()].sort((a, b) => a.localeCompare(b, "th"));
}
/** รุ่นที่ตรง master (ไม่สนตัวพิมพ์/ช่องว่าง) ภายใต้ประเภท/หมวดหมู่ที่เลือก — ตรงชุดเดียวเท่านั้นจึงถือว่า "ตรง" */
export function matchMaster(v: CascadeValue, rows: MasterRow[]): MasterRow | null {
  if (!normKey(v.model)) return null;
  const hits = rows.filter((r) => eq(r.model, v.model) && (!v.machineType || eq(r.type, v.machineType)) && (!v.category || eq(r.category, v.category)));
  return hits.length === 1 ? hits[0] : null;
}
const isMasterModel = (model: string, rows: MasterRow[]) => rows.some((r) => eq(r.model, model));

export function changeType(cur: CascadeValue, type: string, rows: MasterRow[]): CascadeResult {
  const next = { ...cur, machineType: type };
  // หมวดหมู่เดิมไม่อยู่ใต้ประเภทใหม่ (ตาม master) → ล้าง
  if (next.category && rows.some((r) => eq(r.category, next.category)) && !categoriesFor(type, rows).some((c) => eq(c, next.category))) next.category = "";
  // รุ่นเดิมเป็นรุ่นใน master แต่ไม่อยู่ใต้ประเภท(+หมวดหมู่)ใหม่ → ล้าง · รุ่นนอก master (ข้อมูลเดิม) ไม่ล้าง
  if (next.model && isMasterModel(next.model, rows) && !modelsFor(type, next.category, rows).some((r) => eq(r.model, next.model))) next.model = "";
  return { ...next, master: matchMaster(next, rows) };
}

export function changeCategory(cur: CascadeValue, category: string, rows: MasterRow[]): CascadeResult {
  const next = { ...cur, category };
  if (!next.machineType && category) {
    const types = uniq(rows.filter((r) => eq(r.category, category)).map((r) => r.type));
    if (types.length === 1) next.machineType = types[0];
  }
  if (next.model && isMasterModel(next.model, rows) && !modelsFor(next.machineType, category, rows).some((r) => eq(r.model, next.model))) next.model = "";
  return { ...next, master: matchMaster(next, rows) };
}

/** เลือก/พิมพ์รุ่น: ตรง master ชุดเดียว → เติมประเภท/หมวดหมู่ (Auto Fill) · พิมพ์รุ่นนอก master → คงค่าอื่นไว้ */
export function changeModel(cur: CascadeValue, model: string, rows: MasterRow[], picked?: MasterRow | null): CascadeResult {
  if (picked) return { machineType: picked.type, category: picked.category, model: picked.model, master: picked };
  const next = { ...cur, model };
  const hits = rows.filter((r) => eq(r.model, model));
  const fit = hits.filter((r) => (!cur.machineType || eq(r.type, cur.machineType)) && (!cur.category || eq(r.category, cur.category)));
  if (fit.length === 1) return { machineType: fit[0].type, category: fit[0].category, model: fit[0].model, master: fit[0] };
  return { ...next, master: null };
}

/** ข้อความเตือนเมื่อค่าปัจจุบันขัดกับ master (backend จะปฏิเสธ) */
export function cascadeProblem(v: CascadeValue, rows: MasterRow[], opts: { hasCategory: boolean } = { hasCategory: true }): string {
  if (!normKey(v.model)) return "";
  const hits = rows.filter((r) => eq(r.model, v.model));
  if (!hits.length) return "";
  const fit = hits.filter((r) => (!v.machineType || eq(r.type, v.machineType)) && (!opts.hasCategory || !v.category || eq(r.category, v.category)));
  if (fit.length) return "";
  return `รุ่น ${v.model} ในข้อมูลหลักเป็น ${hits.map((r) => (opts.hasCategory ? `${r.type} / ${r.category}` : r.type)).join(", ")}`;
}

// ---- EQ-02: ตัวเลือกของ Searchable Dropdown 3 ช่อง (ประเภท → หมวดหมู่ → รุ่น) ----
// เลือกได้เฉพาะค่าใน master (ไม่รับข้อความพิมพ์เอง) · ค่าเดิมของเครื่อง/คิวที่ไม่อยู่ใน master (ข้อมูลก่อน D-07B)
// แสดงเป็นตัวเลือก "ข้อมูลเดิม" เพื่อให้เปิด/บันทึกเอกสารเดิมได้โดยค่าไม่หาย — ไม่สร้าง mapping ใหม่

/** ตัวเลือกข้อความ (ประเภท / หมวดหมู่) · legacy = ค่าปัจจุบันที่ไม่อยู่ในรายการ (ข้อมูลเดิม) */
export interface TextOption {
  value: string;
  legacy: boolean;
}
/** ตัวเลือกรุ่น = แถว master · legacy = ค่ารุ่นปัจจุบันที่ไม่อยู่ใน master (ข้อมูลเดิม · id ขึ้นต้น "legacy:") */
export interface ModelOption extends MasterRow {
  legacy?: boolean;
}

function withCurrent(values: string[], current: string): TextOption[] {
  const out = values.map((value) => ({ value, legacy: false }));
  if (normKey(current) && !values.some((x) => eq(x, current))) out.push({ value: current, legacy: true });
  return out;
}

/** ประเภท = ประเภทระบบเดิม (systemTypes) + ประเภทใน master + ค่าปัจจุบัน (ถ้าไม่อยู่ในรายการ = ข้อมูลเดิม) */
export function typeOptionsFor(rows: MasterRow[], current: string, systemTypes: readonly string[] = []): TextOption[] {
  return withCurrent(uniqKeepOrder([...systemTypes, ...rows.map((r) => r.type)]), current);
}
/** หมวดหมู่ใต้ประเภทที่เลือก (ไม่เลือกประเภท = ทุกหมวดหมู่) + ค่าปัจจุบัน */
export function categoryOptionsFor(type: string, rows: MasterRow[], current: string): TextOption[] {
  return withCurrent(categoriesFor(type, rows), current);
}
/** รุ่นใต้ประเภท(+หมวดหมู่) · เรียงตามชื่อรุ่น · ค่ารุ่นปัจจุบันที่ไม่อยู่ใน master ต่อท้ายเป็นข้อมูลเดิม */
export function modelOptionsFor(type: string, category: string, rows: MasterRow[], currentModel: string): ModelOption[] {
  const list: ModelOption[] = [...modelsFor(type, category, rows)].sort((a, b) => a.model.localeCompare(b.model, "th") || a.category.localeCompare(b.category, "th"));
  if (normKey(currentModel) && !rows.some((r) => eq(r.model, currentModel))) list.push(legacyModel(currentModel));
  return list;
}
export function legacyModel(model: string): ModelOption {
  return { id: `legacy:${normKey(model)}`, type: "", category: "", model, standardCost: null, legacy: true };
}

/**
 * ค่าที่ช่องรุ่นแสดง: แถว master ที่ตรงชุดเดียว → รุ่นชื่อเดียวกันในตัวเลือก (รุ่นซ้ำต่างหมวดหมู่ เลือกตาม pickedId ก่อน)
 * → ข้อมูลเดิม · ไม่มีรุ่น = null
 */
export function modelValueFor(v: CascadeValue, rows: MasterRow[], options: ModelOption[], pickedId = ""): ModelOption | null {
  if (!normKey(v.model)) return null;
  const exact = matchMaster(v, rows);
  if (exact) return options.find((o) => o.id === exact.id) ?? exact;
  const same = options.filter((o) => eq(o.model, v.model));
  // รุ่นใน master แต่ไม่อยู่ใต้ประเภท/หมวดหมู่ที่เลือก (ขัดกัน — มีข้อความเตือน cascadeProblem) → แสดงแถว master ไม่ใช่ "ข้อมูลเดิม"
  return same.find((o) => o.id === pickedId) ?? same[0] ?? rows.find((r) => eq(r.model, v.model)) ?? legacyModel(v.model);
}

/** EQ-02: หมวดหมู่ที่อนุมานจาก master เมื่อฟอร์มไม่บันทึกหมวดหมู่ (คิว) — ตรงชุดเดียวเท่านั้น ไม่เดา */
export function inferCategory(type: string, model: string, rows: MasterRow[]): string {
  if (!normKey(model)) return "";
  const hits = rows.filter((r) => eq(r.model, model) && (!type || eq(r.type, type)));
  const cats = uniq(hits.map((r) => r.category));
  return cats.length === 1 ? cats[0] : "";
}

/** EQ-02: ค้นหาแบบ contains ไม่สนตัวพิมพ์/ช่องว่างซ้ำ (เทียบด้วย normKey เดียวกับ backend) */
export function matchesQuery(label: string, query: string): boolean {
  const q = normKey(query);
  return !q || normKey(label).includes(q);
}

function uniqKeepOrder(xs: string[]) {
  const m = new Map<string, string>();
  for (const x of xs) if (normKey(x) && !m.has(normKey(x))) m.set(normKey(x), x);
  return [...m.values()];
}

/**
 * EQ-02: ประเภทที่เลือกได้เมื่อรุ่นถูกกำหนดแล้ว (รายการเครื่องในใบงาน — รุ่นมาจากเครื่องในคลัง แก้ที่ใบงานไม่ได้)
 * รุ่นอยู่ใน master → เฉพาะประเภทของรุ่นนั้น (backend ปฏิเสธประเภทที่ขัด) · รุ่นนอก master / ไม่มีรุ่น → ทุกประเภทที่ยอมรับ
 * ค่าปัจจุบันที่ไม่อยู่ในรายการแสดงเป็นข้อมูลเดิม
 */
export function typeOptionsForModel(model: string, rows: MasterRow[], current: string, systemTypes: readonly string[] = []): TextOption[] {
  const hits = normKey(model) ? rows.filter((r) => eq(r.model, model)) : [];
  if (!hits.length) return typeOptionsFor(rows, current, systemTypes);
  return withCurrent(uniqKeepOrder(hits.map((r) => r.type)), current);
}
