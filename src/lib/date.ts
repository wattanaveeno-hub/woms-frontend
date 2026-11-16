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

// ---------------------------------------------------------------------------
// timestamp (ISO instant) → ข้อความสำหรับหน้าจอ ตามเวลาไทยเสมอ
// ---------------------------------------------------------------------------
// เดิมทั้งระบบใช้ `iso.slice(0, 16).replace("T", " ")` ซึ่งเป็นการ "ตัดสตริง"
// ไม่ใช่การแปลงเขตเวลา จึงแสดงเป็น UTC ช้ากว่าเวลาไทย 7 ชั่วโมง (WOMS QA BUG-018)
// ผลที่ร้ายกว่าเวลาผิดคือ ทุกเหตุการณ์ก่อน 07:00 น. เวลาไทย จะแสดงเป็น "วันของเมื่อวาน"
// ตัวช่วยชุดนี้เป็นทางเดียวที่หน้าจอควรใช้แสดง createdAt / updatedAt / closedAt ฯลฯ

// ---------------------------------------------------------------------------
// UAT 2026-11-16 (Owner): รูปแบบวันที่ที่แสดงทั้งระบบ = วว/ดด/ปปปป (ค.ศ.) เช่น 16/11/2026
//   ค่าที่เก็บ/ส่ง API ยังเป็น YYYY-MM-DD / ISO เหมือนเดิม — เปลี่ยนเฉพาะตอนแสดงผล
// ---------------------------------------------------------------------------
/** YYYY-MM-DD หรือ ISO instant → `16/11/2026` (instant ใช้วันที่ตามเวลาไทย) · ค่าอื่นคืนตามเดิม (เช่น "—") · null/undefined → "" */
export function fmtDate(v: string | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = bangkokDate(s);
    if (d) return fmtDate(d);
  }
  return s;
}

/** `16/11/2026` → `2026-11-16` · รับ YYYY-MM-DD ตรง ๆ ด้วย · ปี พ.ศ. แปลงเป็น ค.ศ. · ไม่ใช่วันที่จริง → null */
export function parseDisplayDate(text: string): string | null {
  const t = String(text ?? "").trim();
  let y = 0, m = 0, d = 0;
  let r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (r) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return null;
  // พิมพ์ปี พ.ศ. ตามความเคยชิน (เช่น 2569) → แปลงเป็น ค.ศ. ให้
  if (y > 2400 && y < 2800) y -= 543;
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const back = new Date(`${iso}T00:00:00Z`);
  return back.getUTCFullYear() === y && back.getUTCMonth() + 1 === m && back.getUTCDate() === d ? iso : null;
}

/** `16/11/2026 11:29` — วันและเวลาไทยของ instant ที่ให้มา (คืน "" เมื่อค่าไม่ถูกต้อง) */
export function bangkokDateTime(at: Date | string | null | undefined): string {
  if (at === null || at === undefined || at === "") return "";
  const t = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (!Number.isFinite(t)) return "";
  const iso = new Date(t + BANGKOK_UTC_OFFSET_MINUTES * 60_000).toISOString();
  return `${fmtDate(iso.slice(0, 10))} ${iso.slice(11, 16)}`;
}

/**
 * เหมือน bangkokDateTime แต่คืนค่าสำรองเมื่อไม่มีข้อมูล (ค่าตั้งต้น "—")
 * ใช้ในคอลัมน์ตารางที่ต้องมีอะไรสักอย่างเสมอ
 */
export function bangkokDateTimeOr(at: Date | string | null | undefined, fallback = "—"): string {
  return bangkokDateTime(at) || fallback;
}

/**
 * `2026-09-19 11:29:11` — วันและเวลาไทยระดับวินาที
 * ใช้กับ audit log ที่ต้องเทียบลำดับเหตุการณ์ให้ละเอียดกว่าระดับนาที
 */
export function bangkokDateTimeSeconds(at: Date | string | null | undefined): string {
  if (at === null || at === undefined || at === "") return "";
  const t = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (!Number.isFinite(t)) return "";
  const iso = new Date(t + BANGKOK_UTC_OFFSET_MINUTES * 60_000).toISOString();
  return `${fmtDate(iso.slice(0, 10))} ${iso.slice(11, 19)}`;
}

/** `11:29` — เวลาไทยแบบ HH:mm (ใช้ในห้องแชทที่แสดงเฉพาะเวลา) */
export function bangkokClock(at: Date | string | null | undefined): string {
  const s = bangkokDateTime(at);
  return s ? s.slice(11) : "";
}

const TH_DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const TH_MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/**
 * วันที่แบบไทยสำหรับให้คนอ่าน (ENTECH design system: ไม่แสดง 2026-11-16 ให้ผู้ใช้อ่าน)
 * วันนี้ / พรุ่งนี้ / เมื่อวาน หรือ "จ. 16 พ.ย." · ใส่ปี พ.ศ. เมื่อไม่ใช่ปีนี้
 */
export function thaiDayLabel(date: string, today: string = bangkokToday()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return "";
  if (date === today) return "วันนี้";
  if (date === addDaysISO(today, 1)) return "พรุ่งนี้";
  if (date === addDaysISO(today, -1)) return "เมื่อวาน";
  // UAT 2026-11-16: วันที่ทั้งระบบ วว/ดด/ปปปป (ค.ศ.) — คงคำ วันนี้/พรุ่งนี้/เมื่อวาน ไว้
  return `${TH_DOW[weekdayIndexISO(date) === 6 ? 0 : weekdayIndexISO(date) + 1]} ${fmtDate(date)}`;
}
