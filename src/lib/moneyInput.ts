/**
 * ช่องตัวเลข/เงิน — ตัด 0 นำหน้าที่ค้างจากค่าเริ่มต้น (UAT: พิมพ์ "3" ในช่องที่มี "0" แล้วได้ "03")
 *   "03" → "3" · "0005" → "5" · "0" → "0" · "0.5" → "0.5" · "00.5" → "0.5" · "1,000" คงเดิม · "" คงเดิม
 */
export function stripLeadingZeros(raw: string): string {
  return raw.replace(/^(\s*)0+(?=\d)/, "$1");
}

/** ค่าที่แสดงในช่อง: ค่าเริ่มต้น 0 แสดงเป็นช่องว่าง (มี placeholder "0") ผู้ใช้พิมพ์ทับได้ทันที */
export function moneyDisplay(raw: string | undefined, value: number | undefined): string {
  if (raw !== undefined) return raw;
  return value ? String(value) : "";
}

// ---------------------------------------------------------------------------
// Numeric input UX (Master Execution 14 พ.ย. 2569) — กติกาเดียวของช่องตัวเลขทั้งระบบ
//   ช่องว่าง = แสดง placeholder "0" ไม่ใส่ "0" เป็นข้อความจริง · พิมพ์ "50000" ได้ "50000" ไม่ใช่ "050000"
//   ค่าที่บันทึกไว้แล้ว (ไม่ใช่ 0) แสดงตามเดิม · ทศนิยมคงเดิม · ค่าติดลบตามกติกาของช่อง
//   ไม่แปลงช่องว่างเป็น 0 ระหว่างแก้ — การแปลงตอนบันทึกเป็นกติกาเดิมของแต่ละฟอร์ม
// ---------------------------------------------------------------------------
export interface NumericTextOptions {
  /** จำนวนเต็มเท่านั้น (ไม่รับจุดทศนิยม) */
  integer?: boolean;
  /** รับเครื่องหมายลบนำหน้า (เช่น พิกัด) */
  allowNegative?: boolean;
}

/**
 * ทำความสะอาดข้อความที่ผู้ใช้พิมพ์: ตัดอักขระที่ไม่ใช่ตัวเลข/จุด/ลบ (ตามกติกา), จุดได้ตัวเดียว, ลบได้เฉพาะหน้าสุด,
 * ตัด 0 นำหน้า ("050000" → "50000", "00.5" → "0.5", "-05" → "-5") · ไม่เติม 0 ให้เอง · "" คงเป็น ""
 * จุลภาคหลักพันถูกตัด (ช่องเงินเดิม parseMoney ก็ตัดจุลภาคก่อนแปลงอยู่แล้ว)
 */
export function sanitizeNumericText(raw: string, opts: NumericTextOptions = {}): string {
  let s = String(raw ?? "").replace(/[\s,]/g, "");
  const neg = !!opts.allowNegative && s.startsWith("-");
  s = s.replace(opts.integer ? /[^\d]/g : /[^\d.]/g, "");
  if (!opts.integer) {
    const i = s.indexOf(".");
    if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "");
  }
  s = s.replace(/^0+(?=\d)/, "");
  return (neg ? "-" : "") + s;
}

/** ค่าเริ่มต้นที่แสดงในช่องจากค่าที่มีอยู่: null/undefined/"" → "" · 0 → "" เมื่อ zeroAsEmpty (ค่าเริ่มต้นที่ยังไม่ได้กรอก) · อื่น ๆ แสดงตามค่า */
export function numericInitialText(value: number | string | null | undefined, zeroAsEmpty = true): string {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  if (s === "") return "";
  if (zeroAsEmpty && Number(s) === 0 && /^-?0*(\.0*)?$/.test(s)) return "";
  return s;
}

/** แปลงข้อความเป็นตัวเลขสำหรับ state แบบตัวเลข: "" / "-" / "." → null (ให้ผู้เรียกตัดสินตามกติกาเดิม) */
export function numericTextValue(text: string): number | null {
  if (text === "" || text === "-" || text === "." || text === "-.") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}
