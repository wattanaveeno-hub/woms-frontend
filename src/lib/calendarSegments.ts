// BR-01 C-2/C-3 · CAL-D01 — แยกรายการในปฏิทินเป็น "นัดหมายที่ต้องไป" กับ "งานพัก (HOLD)"
//   งานปิด/ยกเลิกไม่อยู่ในปฏิทิน (ดูที่ประวัติงาน /jobs/history)
//   งาน HOLD แสดงที่วันนัดเดิมเพื่ออ้างอิงเท่านั้น — ไม่นับเป็นนัดที่ช่างต้องไป จนกว่ารอบคิวใหม่จะยืนยัน
import type { CalendarEvent } from "./types";

export type CalendarSegment = "ALL" | "ACTIVE" | "HOLD";
export type CalendarEventKind = "ACTIVE" | "HOLD" | "OTHER";

export const CALENDAR_SEGMENT_LABEL: Record<CalendarSegment, string> = {
  ALL: "ทั้งหมด",
  ACTIVE: "นัดหมายที่ต้องไป",
  HOLD: "งานพัก (รอคิวใหม่)",
};

export function calendarEventKind(e: Pick<CalendarEvent, "status" | "activeAppointment" | "onHold">): CalendarEventKind {
  if (e.status === "HOLD" || e.onHold === true) return "HOLD";
  // backend รุ่นเดิมไม่ส่ง activeAppointment → ถือว่า OPEN = นัดที่ต้องไป
  if (e.status === "OPEN" && e.activeAppointment !== false) return "ACTIVE";
  return "OTHER";
}

export function filterBySegment<T extends Pick<CalendarEvent, "status" | "activeAppointment" | "onHold">>(events: T[], seg: CalendarSegment): T[] {
  if (seg === "ALL") return events;
  return events.filter((e) => calendarEventKind(e) === seg);
}

export function segmentCounts<T extends Pick<CalendarEvent, "jobId" | "status" | "activeAppointment" | "onHold">>(events: T[]) {
  const seen = new Set<string>();
  const out = { ALL: 0, ACTIVE: 0, HOLD: 0 };
  for (const e of events) {
    if (seen.has(e.jobId)) continue; // ใบงานหลายช่างอยู่หลาย lane — นับครั้งเดียว
    seen.add(e.jobId);
    out.ALL += 1;
    const k = calendarEventKind(e);
    if (k === "ACTIVE") out.ACTIVE += 1;
    if (k === "HOLD") out.HOLD += 1;
  }
  return out;
}
