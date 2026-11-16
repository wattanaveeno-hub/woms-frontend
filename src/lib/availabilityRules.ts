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

// ---------------------------------------------------------------------------
// UAT 2026-11-16: ช่างต้องเห็นว่า "ว่างกี่โมง" และ "คิวไหนเสนอไปแล้ว" ในปฏิทินเสนอวัน
//   รวมนัดจริง (ใบงานเปิด) + คิวที่ช่างเสนอวันไปแล้วแต่ยังไม่เป็นใบงาน · เรียงตามเวลา
// ---------------------------------------------------------------------------
export interface ProposedSlot {
  queueId: string;
  queueNo: string;
  date: string;
  time: string;
  title: string;
  status: string;
}
export interface AgendaItem {
  time: string;
  text: string;
  kind: "JOB" | "PROPOSED";
}
/** สถานะคิวที่ช่างเสนอวันไปแล้ว (ยังไม่เป็นใบงาน) */
export const PROPOSED_QUEUE_STATUSES = ["TECH_REPLIED", "WAIT_CUSTOMER", "READY_TO_OPEN"] as const;
const PROPOSED_LABEL: Record<string, string> = { TECH_REPLIED: "รอแอดมินรับ", WAIT_CUSTOMER: "รอลูกค้ายืนยัน", READY_TO_OPEN: "รอเปิดงาน" };

export function agendaByDate(byDate: Map<string, CalendarEvent[]>, proposals: ProposedSlot[], excludeQueueId = ""): Map<string, AgendaItem[]> {
  const m = new Map<string, AgendaItem[]>();
  for (const [d, list] of byDate) m.set(d, list.map((e) => ({ time: e.time || "", text: e.title, kind: "JOB" as const })));
  for (const p of proposals) {
    if (!p.date || p.queueId === excludeQueueId || !(PROPOSED_QUEUE_STATUSES as readonly string[]).includes(p.status)) continue;
    const label = PROPOSED_LABEL[p.status] ?? "เสนอแล้ว";
    m.set(p.date, [...(m.get(p.date) ?? []), { time: p.time || "", text: `เสนอแล้ว ${p.queueNo} ${p.title} (${label})`.replace(/\s+/g, " ").trim(), kind: "PROPOSED" }]);
  }
  for (const list of m.values()) list.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  return m;
}
