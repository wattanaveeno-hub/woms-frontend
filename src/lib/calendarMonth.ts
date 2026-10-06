/**
 * ปฏิทินรายเดือน (JOB-04 / BR-01.5) — ฟังก์ชันล้วน ทำงานบนสตริงวันที่ YYYY-MM-DD เท่านั้น
 * ห้าม import React / alias "@/" (เทสต์รันด้วย node --test ตรง ๆ: scripts/calendarMonth.test.ts)
 * ไม่ผ่าน Date แบบเวลาเครื่อง จึงไม่มีปัญหาวันเลื่อนตามเขตเวลา
 */

export function isMonthString(v: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** 0 = จันทร์ … 6 = อาทิตย์ */
function mondayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/**
 * ช่องวันของตารางเดือน เริ่มวันจันทร์ ครบสัปดาห์เสมอ (จำนวนช่องหาร 7 ลงตัว)
 * inMonth = false คือวันของเดือนก่อน/ถัดไปที่เติมให้ครบแถว
 */
export function monthGrid(month: string): { date: string; inMonth: boolean }[] {
  const first = `${month}-01`;
  const lead = mondayIndex(first);
  const total = Math.ceil((lead + daysInMonth(month)) / 7) * 7;
  const start = addDays(first, -lead);
  return Array.from({ length: total }, (_, i) => {
    const date = addDays(start, i);
    return { date, inMonth: date.slice(0, 7) === month };
  });
}
