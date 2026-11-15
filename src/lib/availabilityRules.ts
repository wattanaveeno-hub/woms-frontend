// UAT2-01 — กติกาปฏิทินว่าง/ไม่ว่างของช่าง (ใช้ในหน้าต่างเสนอวันเวลาคิว)
import type { CalendarEvent } from "./types";

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** นัดที่ต้องไปจริง — ใบงานเปิดอยู่ ไม่ใช่งานพัก/ปิด/ยกเลิก */
export function isActiveAppointment(e: Pick<CalendarEvent, "status" | "activeAppointment" | "onHold">): boolean {
  if (e.activeAppointment === false || e.onHold) return false;
  return e.status === "OPEN";
}

/** รวมนัดรายวัน (ไม่นับใบงานซ้ำ) เรียงตามเวลา */
export function appointmentsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const m = new Map<string, CalendarEvent[]>();
  const seen = new Set<string>();
  for (const e of events) {
    if (!isActiveAppointment(e) || seen.has(e.jobId)) continue;
    seen.add(e.jobId);
    m.set(e.date, [...(m.get(e.date) ?? []), e]);
  }
  for (const list of m.values()) list.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  return m;
}
