/**
 * วันที่ตามเวลาไทย สำหรับฝั่งเบราว์เซอร์
 *
 * ระบบยึด "วันนี้" ของเซิร์ฟเวอร์เป็นหลัก (backend: domain/dateUtil.todayISODate)
 * หน้าเว็บจึงควรใช้ค่าที่ API ส่งมา เช่น serverDate จาก /api/dashboard/jobs
 * หรือให้ backend เป็นคนกรองให้ (เช่น /api/jobs?dateScope=OVERDUE)
 *
 * ฟังก์ชันนี้มีไว้เป็นทางสำรองเท่านั้น สำหรับกรณีที่ผู้ใช้ไม่มีสิทธิ์เรียก API
 * ที่บอกวันที่ของเซิร์ฟเวอร์ (เช่น แจ้งเตือนงวดผ่อนของผู้ใช้ที่ไม่มีสิทธิ์ดูใบงาน)
 * — ตั้งใจไม่ใช้เขตเวลาของเครื่องผู้ใช้ เพราะช่างอาจตั้งเครื่องเป็นเขตเวลาอื่น
 * และเดสก์ท็อป/มือถือต้องเห็นตัวเลขชุดเดียวกันเสมอ
 *
 * ไทยใช้ UTC+7 คงที่ ไม่มี daylight saving จึงบวก offset ตรง ๆ ได้
 */
export const BANGKOK_UTC_OFFSET_MINUTES = 7 * 60;

export function bangkokToday(now: Date = new Date()): string {
  return new Date(now.getTime() + BANGKOK_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}
