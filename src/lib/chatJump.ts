// Q-R6-06 (Owner อนุมัติ รอบ 7) — กดผลค้นหาแชทแล้วไปข้อความต้นทาง แม้ยังไม่ได้โหลด
//   ฟังก์ชันบริสุทธิ์ (ทดสอบด้วย node --test) · หน้าจอใช้ผลเพื่อรวมรายการหรือสลับเป็นโหมดดูประวัติ
// ไม่ import ไฟล์อื่น (ให้ node --test โหลดได้ตรง) — ผู้เรียกส่งตัวเรียงลำดับ (compareTimeline) เข้ามา
type Msg = { messageId: string };

function mergeById<T extends Msg>(prev: T[], incoming: T[]): T[] {
  const byId = new Map(incoming.map((m) => [m.messageId, m]));
  const out = prev.map((m) => byId.get(m.messageId) ?? m);
  const seen = new Set(prev.map((m) => m.messageId));
  for (const m of incoming) if (!seen.has(m.messageId)) out.push(m);
  return out;
}

export type JumpPlan = "SCROLL" | "FETCH";

export function planJump(loadedIds: Iterable<string>, targetId: string): JumpPlan {
  for (const id of loadedIds) if (id === targetId) return "SCROLL";
  return "FETCH";
}

export interface AroundResponse<T> {
  messages: T[];
  gap: boolean;
  targetId: string;
  cursor: { before: string | null; hasMore: boolean };
}

/**
 * gap=false: ช่วงที่ได้ต่อชนกับข้อความเก่าสุดที่โหลดอยู่ → รวมเป็นรายการเดียว (ไม่มีรู) · โพลข้อความใหม่ทำงานต่อได้ตามเดิม
 * gap=true : ช่วงห่างจากรายการเดิม → แทนรายการด้วยช่วงนั้น และเข้าโหมดดูประวัติ (ไม่ต่อข้อความใหม่ท้ายช่วงเก่า เพื่อไม่ให้เกิดรู)
 */
export function applyAround<T extends Msg>(prev: T[], r: AroundResponse<T>, compare: (a: T, b: T) => number) {
  if (!r.gap) {
    return { messages: mergeById(prev, r.messages).sort(compare), historyMode: false, olderCursor: r.cursor.before, hasOlder: r.cursor.hasMore };
  }
  return { messages: [...r.messages].sort(compare), historyMode: true, olderCursor: r.cursor.before, hasOlder: r.cursor.hasMore };
}

/** ข้อความแจ้งผู้ใช้ตาม error ของการโหลดช่วง */
export function jumpErrorMessage(status: number | undefined): string {
  if (status === 410) return "ข้อความนี้ถูกยกเลิกแล้ว";
  if (status === 403) return "คุณไม่มีสิทธิ์ในกลุ่มนี้แล้ว";
  if (status === 404) return "ไม่พบข้อความนี้ในกลุ่ม";
  return "โหลดข้อความต้นทางไม่สำเร็จ";
}
