// D-07A: Type → Category → Model (Equipment Model Master) — กติกาเปลี่ยนค่าแบบลำดับชั้น + Auto Fill
// ฟังก์ชันล้วน (ทดสอบด้วย node --test) · backend ตรวจความสัมพันธ์ซ้ำทุกครั้ง (ไม่พึ่งหน้าเว็บ)

export interface MasterRow {
  id: string;
  type: string;
  category: string;
  model: string;
  standardPrice: number;
}
export interface CascadeValue {
  machineType: string;
  category: string;
  model: string;
}
export interface CascadeResult extends CascadeValue {
  /** รุ่นที่เลือกตรง master ชุดเดียว (ใช้แสดงราคามาตรฐาน) */
  master: MasterRow | null;
}

export const normKey = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ").toUpperCase();
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
