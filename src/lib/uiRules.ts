/**
 * กติกาเล็ก ๆ ที่หน้าจอใช้ตัดสินว่าจะแสดงอะไร — แยกออกมาเป็นฟังก์ชันล้วน
 * เพื่อให้มี regression test (scripts/uiRules.test.ts) ป้องกันบั๊กที่เคยแก้แล้วกลับมา
 * ห้าม import อะไรที่เป็น React / alias "@/" ในไฟล์นี้ (เทสต์รันด้วย node --test ตรง ๆ)
 */

export type JobStatusValue = "OPEN" | "HOLD" | "CLOSED" | "CANCELLED";

/** ตัวเลือกตัวกรองสถานะงาน — ต้องมี HOLD เสมอ (backend รับ 4 สถานะ) */
export const JOB_STATUS_FILTER: JobStatusValue[] = ["OPEN", "HOLD", "CLOSED", "CANCELLED"];

/**
 * หน้าช่าง /m/job/[id]: ส่วนท้ายของหน้าแสดงอะไร
 * เคยแสดง "งานนี้ปิดแล้ว" กับงานที่พัก/ยกเลิก — ห้ามกลับไปเป็นแบบนั้น
 */
export function techJobFooter(status: JobStatusValue): "close-form" | "closed" | "hold" | "cancelled" {
  switch (status) {
    case "OPEN":
      return "close-form";
    case "CLOSED":
      return "closed";
    case "HOLD":
      return "hold";
    default:
      return "cancelled";
  }
}

/** หน้ารายละเอียดใบงาน (เดสก์ท็อป) ใช้กติกาเดียวกับหน้าช่าง */
export const jobCloseSection = techJobFooter;

/**
 * ช่องลายเซ็น: ความกว้างของกรอบเปลี่ยนจริงหรือไม่ (เช่นหมุนจอ) — true = ต้องปรับขนาดภาพ (ไม่ล้างลายเซ็น — วาดใหม่จากเส้นเดิม ดู scaleSignatureStroke)
 * มือถือยิง resize ตอนแถบที่อยู่ของเบราว์เซอร์เลื่อนขึ้นลง (ความกว้างเท่าเดิม) → false ไม่ต้องทำอะไร
 * R10-02: เดิมชื่อ signatureShouldReset ซึ่งไม่ตรงความหมาย (ตั้งแต่ UX-R3-01 ไม่ได้ล้างลายเซ็นแล้ว)
 */
export function signatureWidthChanged(prevWidth: number, nextWidth: number): boolean {
  if (prevWidth < 0) return false; // ครั้งแรกที่วัดขนาด ยังไม่มีลายเซ็น
  return Math.round(prevWidth) !== Math.round(nextWidth);
}

/**
 * ADV11B-04 (แทน R10-01 signatureRescaleRect): ช่องลายเซ็นเก็บ "เส้น" เป็นรายการจุด (หน่วย CSS px) + ความกว้างกรอบตอนวาด
 * เมื่อความกว้างเปลี่ยน วาดใหม่ทุกเส้นจากจุดเดิม ด้วยสัดส่วนเดียวกันทั้งสองแกน scale = min(1, ความกว้างใหม่ / ความกว้างตอนวาด)
 * ต่อเส้น วางชิดซ้ายบน — ไม่ย่อจากภาพที่ย่อแล้ว จึงไม่ย่อสะสมเมื่อหมุนจอไปกลับหลายรอบ และไม่เบลอ
 * (เดิมย่อจาก bitmap ของกรอบ: หมุนไปกลับ 3 รอบเหลือ ~10% ของความกว้างเดิม)
 * ความสูงกรอบคงที่ และ scale ≤ 1 จึงไม่ล้นกรอบ · ภาพที่ส่งออก = ภาพที่เห็นในกรอบ
 */
export interface SignaturePoint {
  x: number;
  y: number;
}
export interface SignatureStroke {
  /** ความกว้างกรอบ (CSS px) ตอนวาดเส้นนี้ */
  widthAtDraw: number;
  points: SignaturePoint[];
}

export function signatureStrokeScale(widthAtDraw: number, newWidth: number): number {
  if (!(widthAtDraw > 0) || !(newWidth > 0)) return 0;
  return Math.min(1, newWidth / widthAtDraw);
}

/** จุดของเส้นสำหรับกรอบความกว้าง newWidth (ชิดซ้ายบน) — คำนวณจากจุดเดิมเสมอ */
export function scaleSignatureStroke(stroke: SignatureStroke, newWidth: number): SignaturePoint[] {
  const s = signatureStrokeScale(stroke.widthAtDraw, newWidth);
  if (s <= 0) return [];
  return stroke.points.map((p) => ({ x: p.x * s, y: p.y * s }));
}

/**
 * ADV12-05: ทุกเส้นใช้ "ระบบพิกัดเดียวกัน" (canonical — ความกว้างฐาน baseWidth) และย่อด้วยสัดส่วนเดียว
 * scale = min(1, ความกว้างกรอบ / baseWidth) — เส้นที่วาดตอนกรอบกว้างต่างกันจึงยังอยู่ตำแหน่งเดิมเทียบกัน
 * (เดิมย่อรายเส้นตามความกว้างตอนวาด → เซ็นตอนแนวนอน ขีดเส้นใต้ตอนแนวตั้ง แล้วหมุนกลับ เส้นใต้ไม่อยู่ใต้ชื่อ)
 * จุดที่ผู้ใช้ลากบนกรอบ (display) แปลงเป็น canonical ด้วยการหารด้วย scale ปัจจุบัน
 */
export function renderSignatureStrokes(strokes: SignatureStroke[], baseWidth: number, newWidth: number): SignaturePoint[][] {
  const s = signatureStrokeScale(baseWidth, newWidth);
  if (s <= 0) return strokes.map(() => []);
  return strokes.map((st) => st.points.map((p) => ({ x: p.x * s, y: p.y * s })));
}
export function toCanonicalPoint(p: SignaturePoint, baseWidth: number, displayWidth: number): SignaturePoint {
  const s = signatureStrokeScale(baseWidth, displayWidth);
  return s > 0 ? { x: p.x / s, y: p.y / s } : p;
}

/** มีเส้นที่วาดจริงหรือไม่ (เส้นต้องมีอย่างน้อย 2 จุด — แตะเฉย ๆ ไม่นับเป็นลายเซ็น) */
export function signatureHasInk(strokes: SignatureStroke[]): boolean {
  return strokes.some((s) => s.points.length >= 2);
}

const TEMP_PREFIX = "TMP-";
export function isTempSerial(serial: string | undefined | null): boolean {
  return (serial ?? "").trim().toUpperCase().startsWith(TEMP_PREFIX);
}

/**
 * ฟอร์มแก้ไขเครื่อง: ช่อง Serial แก้ได้หรือไม่
 * เครื่องที่ยังใช้เลขชั่วคราว ต้องลง Serial จริงผ่านปุ่ม "ลง Serial จริง" เท่านั้น
 * (เส้นทางนั้นบันทึกประวัติ SERIAL และย้ายสัญญาที่อ้างเลขเดิมให้ในรายการเดียวกัน — เครื่องเดิม id เดิม)
 */
export function serialEditableInForm(isEdit: boolean, currentSerial: string | undefined | null): boolean {
  if (!isEdit) return true;
  return !isTempSerial(currentSerial);
}

/** รายการแจ้งเตือนที่มาจากแชทต่องาน แสดงเฉพาะเมื่อเปิดฟังก์ชันแชท (HIDE-01) */
export function chatNotificationsEnabled(features: { chat: boolean }): boolean {
  return features.chat === true;
}

/**
 * รหัสสาขา (CUS-02 / BR-13.1) — ข้อความตัวเลข 2 หลัก เช่น "00" · ห้ามแปลงเป็นตัวเลข
 * ค่าว่างได้ (ใช้ชื่อร้านแทน) · ข้อมูลเก่าที่ไม่ตรงรูปแบบและไม่ได้ถูกแก้ ไม่ต้องบังคับ (กติกาเดียวกับ backend)
 */
export function branchNoError(value: string, original?: string): string | null {
  const v = (value ?? "").trim();
  if (v === "") return null;
  if (original !== undefined && v === (original ?? "").trim()) return null;
  return /^\d{2}$/.test(v) ? null : "รหัสสาขาต้องเป็นตัวเลข 2 หลัก เช่น 00 หรือ 01";
}
