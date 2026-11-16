// ENTECH design (Jobs.dc.html) — แสดงวันนัดแบบอ่านง่าย (ฟังก์ชันบริสุทธิ์ · ทดสอบใน scripts/apptRelative.test.ts)
/** วันนัดแบบอ่านง่าย (ENTECH design): วันนี้/พรุ่งนี้/เมื่อวาน + เวลา · บรรทัดรอง = วันที่ หรือ "อีก N วัน" */
export function apptRelative(date: string | undefined, time: string | undefined, today: string): { main: string; sub: string; days: number | null } {
  if (!date) return { main: "—", sub: "ยังไม่นัด", days: null };
  const d0 = Date.parse(`${today}T00:00:00Z`);
  const d1 = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(d1)) return { main: date, sub: time || "", days: null };
  const days = Math.round((d1 - d0) / 86_400_000);
  // UAT 2026-11-16: วันที่ทั้งระบบ วว/ดด/ปปปป (ค.ศ.) — คงชื่อวันย่อไว้หน้า
  const wd = new Date(d1).toLocaleDateString("th-TH", { weekday: "short", timeZone: "UTC" });
  const dt = `${wd} ${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
  const word = days === 0 ? "วันนี้" : days === 1 ? "พรุ่งนี้" : days === -1 ? "เมื่อวาน" : dt;
  return {
    main: `${word}${time ? ` ${time}` : ""}`,
    sub: days === 0 || days === 1 || days === -1 ? dt : days > 1 ? `อีก ${days} วัน` : dt,
    days,
  };
}

