// แชทกลุ่ม — กติกาฝั่งหน้าจอของ D-13 (ส่งซ้ำด้วยคีย์เดิม) และ D-14 (ยกเลิกข้อความ)
// ฟังก์ชันบริสุทธิ์ ทดสอบด้วย node --test · backend ตรวจซ้ำทุกข้อเสมอ (เวลาอ้างอิงจาก server)

/** D-14: ผู้ส่งยกเลิกข้อความของตนเองได้ภายใน 15 นาที (ค่าเดียวกับ backend CANCEL_WINDOW_MS) */
export const CANCEL_WINDOW_MS = 15 * 60 * 1000;

export const CANCELLED_TEXT = "ข้อความนี้ถูกยกเลิก";

export type CancelMode = "SENDER" | "ADMIN";

export interface CancellableMessage {
  messageId: string;
  kind: string;
  senderId: string;
  createdAt: string;
  cancelled?: boolean;
  cancelledByRole?: CancelMode;
  jobCard?: { type: string } | null;
}

export interface ChatViewer {
  id: string;
  /** มีสิทธิ์ chat:moderate (Admin) */
  canModerate: boolean;
}

/**
 * D-14: ผู้ใช้นี้กด "ยกเลิกข้อความ" ได้ไหม และในฐานะอะไร
 * - ข้อความของตนเองภายใน 15 นาที → SENDER (ไม่ต้องใส่เหตุผล)
 * - ผู้มี chat:moderate → ADMIN (ต้องใส่เหตุผล) ทุกเวลา
 * - การ์ดคิว/ข้อความระบบ/การ์ดปิดงาน หรือยกเลิกไปแล้ว → null
 */
export function canCancel(m: CancellableMessage, nowMs: number, viewer: ChatViewer | null | undefined): CancelMode | null {
  if (!viewer?.id || m.cancelled) return null;
  if (m.kind !== "TEXT" || m.jobCard?.type === "JOB_CLOSED") return null;
  const sentAt = Date.parse(m.createdAt);
  if (m.senderId === viewer.id && Number.isFinite(sentAt) && nowMs - sentAt <= CANCEL_WINDOW_MS) return "SENDER";
  if (viewer.canModerate) return "ADMIN";
  return null;
}

/** ข้อความ placeholder ของข้อความที่ถูกยกเลิก */
export function cancelledLabel(m: { cancelledByRole?: CancelMode }): string {
  return m.cancelledByRole === "ADMIN" ? `${CANCELLED_TEXT}โดยผู้ดูแลระบบ` : CANCELLED_TEXT;
}

/** ข้อความแสดงผลเมื่อยกเลิกไม่สำเร็จ (backend ส่งข้อความไทยมาด้วย — ใช้เมื่อมี) */
export function cancelErrorMessage(status: number, serverMessage?: string): string {
  if (serverMessage && /[฀-๿]/.test(serverMessage)) return serverMessage;
  if (status === 409) return "ข้อความนี้ถูกยกเลิกไปแล้ว";
  if (status === 403) return "คุณไม่มีสิทธิ์ยกเลิกข้อความนี้ (ผู้ส่งยกเลิกได้ภายใน 15 นาที)";
  if (status === 400) return "กรุณาระบุเหตุผลในการยกเลิกข้อความ";
  return "ยกเลิกข้อความไม่สำเร็จ";
}

/**
 * รวมข้อความจากการดึงรอบใหม่: ข้อความใหม่ต่อท้าย · ข้อความเดิมที่เปลี่ยน (เช่น ถูกยกเลิก) แทนที่ของเดิม
 * เรียงตามเวลาส่งเสมอ
 */
export function mergeMessages<T extends { messageId: string; createdAt: string }>(prev: T[], incoming: T[]): T[] {
  if (!incoming.length) return prev;
  const byId = new Map(incoming.map((m) => [m.messageId, m]));
  const out = prev.map((m) => byId.get(m.messageId) ?? m);
  const seen = new Set(prev.map((m) => m.messageId));
  for (const m of incoming) if (!seen.has(m.messageId)) out.push(m);
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** เวลาข้อความล่าสุดที่เคยเห็น — ไม่ถอยหลังเมื่อรอบดึงได้แค่ข้อความเก่าที่เพิ่งถูกยกเลิก */
export function latestCreatedAt(current: string, messages: { createdAt: string }[]): string {
  let out = current;
  for (const m of messages) if (m.createdAt > out) out = m.createdAt;
  return out;
}

/** D-13: คีย์กันส่งซ้ำต่อการกดส่งหนึ่งครั้ง (ใช้คีย์เดิมทุกครั้งที่ลองใหม่) */
export function newClientMessageId(rand: () => string = defaultRandom): string {
  return `gm-${rand()}`;
}

function defaultRandom(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** D-13: ลองส่งใหม่ได้เฉพาะเมื่อเครือข่ายหลุดหรือเซิร์ฟเวอร์ผิดพลาดชั่วคราว (ไม่ลองซ้ำเมื่อข้อมูลไม่ผ่าน 4xx) */
export function isRetryableSendError(status: number): boolean {
  return status === 0 || status === 502 || status === 503 || status === 504;
}

/** ส่งด้วยการลองใหม่ (คีย์เดิม) — attempts รวมครั้งแรก */
export async function sendWithRetry<T>(
  fn: () => Promise<T>,
  statusOf: (e: unknown) => number | null,
  opts: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {}
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const s = statusOf(e);
      if (s === null || !isRetryableSendError(s) || i === attempts - 1) throw e;
      await sleep((opts.delayMs ?? 800) * (i + 1));
    }
  }
  throw lastErr;
}
