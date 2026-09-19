/**
 * วันที่เชิงธุรกิจของระบบ = วันที่ตามเวลาไทย (Asia/Bangkok)
 *
 * แยกให้ชัดระหว่างสองอย่าง:
 *   1) date-only (YYYY-MM-DD) — "วันทำงาน" เช่น วันนัด วันที่เอกสาร ช่วงของปฏิทิน
 *      ต้องยึดเวลาไทยเสมอ ไม่ใช่ UTC และไม่ใช่เขตเวลาของเครื่องผู้ใช้
 *   2) timestamp (ISO เต็มรูปแบบ มี Z) — เวลาที่เกิดเหตุจริง เช่น createdAt/updatedAt
 *      ยังเก็บและส่งเป็น UTC เหมือนเดิมทุกประการ ฟังก์ชันในไฟล์นี้ไม่แตะ
 *
 * backend มีนิยามเดียวกันที่ domain/dateUtil.todayISODate() — ถ้า API ตัวไหนบอก
 * วันที่ของเซิร์ฟเวอร์มาด้วย (เช่น serverDate จาก /api/dashboard/jobs) ให้ใช้ค่านั้นก่อน
 * ฟังก์ชันที่นี่ใช้เมื่อหน้าเว็บต้องรู้ "วันนี้" เองก่อนเรียก API (เช่น ค่าเริ่มต้นของฟอร์ม)
 *
 * ไทยใช้ UTC+7 คงที่ ไม่มี daylight saving จึงบวก offset ตรง ๆ ได้
 * โดยไม่ต้องพึ่ง Intl หรือเขตเวลาที่ตั้งไว้ในเครื่องผู้ใช้
 */
export const BANGKOK_UTC_OFFSET_MINUTES = 7 * 60;

/** วันที่วันนี้ตามเวลาไทย (YYYY-MM-DD) */
export function bangkokToday(now: Date = new Date()): string {
  return bangkokDate(now);
}

/** แปลง timestamp ใด ๆ เป็นวันที่ตามเวลาไทย */
export function bangkokDate(at: Date | string = new Date()): string {
  const t = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (!Number.isFinite(t)) return "";
  return new Date(t + BANGKOK_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

/** เวลาตามนาฬิกาไทย HH:mm:ss (ใช้แสดงผลเท่านั้น) */
export function bangkokTime(at: Date | string = new Date()): string {
  const t = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (!Number.isFinite(t)) return "";
  return new Date(t + BANGKOK_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(11, 19);
}

// ---------------------------------------------------------------------------
// เลขคณิตของ date-only — ทำงานบนสตริง YYYY-MM-DD ล้วน
// ---------------------------------------------------------------------------
// ใช้ UTC ภายในโดยตั้งใจ เพราะเป็นการบวกวันบนปฏิทินล้วน ๆ ไม่เกี่ยวกับเขตเวลา
// (รับ/คืนเป็น YYYY-MM-DD เสมอ จึงไม่มีทางเลื่อนวันจากเขตเวลาของเครื่อง)

/** บวก/ลบจำนวนวันจากวันที่แบบ date-only */
export function addDaysISO(date: string, n: number): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(t)) return "";
  return new Date(t + n * 86_400_000).toISOString().slice(0, 10);
}

/** วันในสัปดาห์ของ date-only: 0 = จันทร์ … 6 = อาทิตย์ (สัปดาห์เริ่มวันจันทร์) */
export function weekdayIndexISO(date: string): number {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(t)) return 0;
  return (new Date(t).getUTCDay() + 6) % 7;
}

/** วันจันทร์ต้นสัปดาห์ของวันที่ที่ให้มา (date-only) */
export function startOfWeekISO(date: string): string {
  return addDaysISO(date, -weekdayIndexISO(date));
}

/** แยกส่วนของ date-only ไว้แสดงผล (ไม่ผ่าน Date object จึงไม่เลื่อนวัน) */
export function partsISO(date: string): { year: number; month: number; day: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { year: y || 0, month: m || 0, day: d || 0 };
}

/** รูปแบบสั้นสำหรับหัวคอลัมน์ปฏิทิน เช่น 14/9 */
export function dayMonthLabel(date: string): string {
  const { month, day } = partsISO(date);
  return `${day}/${month}`;
}
