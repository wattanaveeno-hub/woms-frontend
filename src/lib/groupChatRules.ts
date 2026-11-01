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
  /** มีสิทธิ์ chat:moderate (Admin / Manager — Q-R3-05) */
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
export function mergeMessages<T extends TimelineOrderable>(prev: T[], incoming: T[]): T[] {
  if (!incoming.length) return prev;
  const byId = new Map(incoming.map((m) => [m.messageId, m]));
  const out = prev.map((m) => byId.get(m.messageId) ?? m);
  const seen = new Set(prev.map((m) => m.messageId));
  for (const m of incoming) if (!seen.has(m.messageId)) out.push(m);
  return out.sort(compareTimeline);
}

// ---------------------------------------------------------------------------
// WS-01 CHAT-01..04 (31 ต.ค. 69) — ลำดับ · Timeline append-only · การดึงข้อความ · การเลื่อน
// ---------------------------------------------------------------------------

/**
 * CHAT-02: ลำดับเสถียร — เวลาส่ง (server) ก่อน แล้วตัดสินเสมอด้วย messageId
 * (ข้อความที่ createdAt เท่ากันระดับมิลลิวินาทีเรียงเหมือนกันทุกเครื่อง ทุกครั้งที่โหลด)
 */
export function compareMessages(a: { createdAt: string; messageId: string }, b: { createdAt: string; messageId: string }): number {
  return a.createdAt.localeCompare(b.createdAt) || a.messageId.localeCompare(b.messageId);
}

export interface TimelineMessage extends TimelineOrderable {
  kind: string;
  cancelled?: boolean;
  ref?: { queueId: string } | null;
  jobCard?: { type: string } | null;
}

/** การ์ดคิวที่เป็นเหตุการณ์สถานะ (ไม่ใช่การ์ดใบงานปิดงาน/อ้างอิง) */
export function isQueueEventCard(m: TimelineMessage): boolean {
  return m.kind === "CARD" && !m.cancelled && !m.jobCard && !!m.ref?.queueId;
}

/**
 * CHAT-02 (Append-only): การ์ดคิว "ใบล่าสุด" ของแต่ละคิวในห้อง = การ์ดที่แสดงสถานะปัจจุบันพร้อมปุ่ม
 * การ์ดก่อนหน้าทั้งหมดเป็นประวัติเหตุการณ์ อ่านอย่างเดียว ไม่เปลี่ยนตามสถานะใหม่ และไม่ย้ายตำแหน่ง
 * คืน Set ของ messageId ที่เป็นการ์ดล่าสุด (คิดจากลำดับ compareTimeline — event ที่ส่งช้าไม่แย่งเป็นใบล่าสุด)
 */
export function latestQueueCardIds(messages: TimelineMessage[]): Set<string> {
  const last = new Map<string, TimelineMessage>();
  for (const m of messages) {
    if (!isQueueEventCard(m)) continue;
    const k = m.ref!.queueId;
    const cur = last.get(k);
    if (!cur || compareTimeline(m, cur) > 0) last.set(k, m);
  }
  return new Set([...last.values()].map((m) => m.messageId));
}

/**
 * CHAT-04: ระยะดึงซ้อนย้อนหลัง — ข้อความที่ server กำหนดเวลาไว้ก่อนบันทึกเสร็จ (เช่น การ์ดปิดงานที่แนบรูป)
 * อาจปรากฏในฐานข้อมูลหลังรอบดึงก่อนหน้า · ดึงย้อน OVERLAP แล้วตัดซ้ำด้วย messageId จึงไม่หาย
 */
export const POLL_OVERLAP_MS = 30_000;
export function pollSince(lastAt: string, overlapMs = POLL_OVERLAP_MS): string | undefined {
  const t = Date.parse(lastAt);
  if (!lastAt || !Number.isFinite(t)) return undefined;
  return new Date(t - overlapMs).toISOString();
}

/** ข้อความในรอบดึงที่ยังไม่เคยมีในหน้าจอ (ไม่นับข้อความเดิมที่แค่ถูกแทนที่ เช่น ถูกยกเลิก) */
export function freshMessages<T extends { messageId: string }>(prev: T[], incoming: T[]): T[] {
  const seen = new Set(prev.map((m) => m.messageId));
  const out: T[] = [];
  for (const m of incoming) {
    if (seen.has(m.messageId)) continue;
    seen.add(m.messageId);
    out.push(m);
  }
  return out;
}

/** ขนาดหน้าที่ backend ส่งต่อครั้ง (listMessages default 300) */
export const MESSAGE_PAGE_SIZE = 300;

/**
 * CHAT-01: จุดอ้างอิงสำหรับ "โหลดข้อความก่อนหน้า" — backend ใช้ createdAt < before
 * บวก 1 ms เพื่อให้ข้อความที่เวลาเท่ากับข้อความเก่าสุดที่แสดงอยู่ไม่หลุด (ซ้ำได้ ตัดด้วย messageId)
 */
export function olderCursor(messages: { createdAt: string }[]): string | undefined {
  let min = "";
  for (const m of messages) if (!min || m.createdAt < min) min = m.createdAt;
  const t = Date.parse(min);
  if (!min || !Number.isFinite(t)) return undefined;
  return new Date(t + 1).toISOString();
}

/** CHAT-01: ผู้ใช้อยู่ "ล่างสุด" (ภายใน threshold px) — ใช้ตัดสินว่าจะเลื่อนตามข้อความใหม่หรือไม่ */
export const STICK_THRESHOLD_PX = 80;
export function isAtBottom(el: { scrollHeight: number; scrollTop: number; clientHeight: number }, threshold = STICK_THRESHOLD_PX): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

/**
 * FE-01 (BUG-CHAT-RESPONSIVE): ความสูงพื้นที่แชท
 *
 * คำนวณจาก "ขอบล่างของจอที่มองเห็น" และ "ตำแหน่งบนของพื้นที่แชท" เท่านั้น — ห้ามใช้ความสูงของเอกสาร/ของพื้นที่แชทเอง
 * (เดิมใช้ scrollHeight ซึ่งรวมความสูงเดิมของพื้นที่แชท → ได้ค่าเดิมเสมอ ย่อได้แต่ไม่ขยายกลับ
 *  และนับ padding ล่างของหน้า + ที่ว่างจากการซ่อนหัวหน้าบนมือถือเป็น "ที่เว้น")
 * ทุกค่าเป็นพิกัดเอกสาร (px) — visibleBottom = visualViewport.pageTop + visualViewport.height
 * padding ล่างของหน้า (.shell / main ของช่าง) ไม่ได้นับที่นี่ — หน้าแชทหักออกด้วย margin ติดลบของพื้นที่แชท
 * (chatPaneBottomOffset) เพื่อให้เอกสารสูงไม่เกินจอ
 */
export const CHAT_PANE_GUTTER_PX = 8;
/**
 * D-02: ไม่มีค่าต่ำสุดของพื้นที่แชท — พื้นที่แชทสูงไม่เกินส่วนที่มองเห็นเสมอ
 * (เดิม 320 แล้ว 120 — ทั้งสองค่าดันช่องพิมพ์/ปุ่มส่งลงไปใต้คีย์บอร์ดหรือแถบเมนูล่างบนจอเตี้ย)
 * พื้นที่น้อยจัดการด้วย chatPaneLayout(): ย่อ/ซ่อนหัวห้อง และจำกัดความสูงส่วนประกอบของช่องพิมพ์
 */
/** visual viewport เตี้ยกว่า layout viewport เกิน 25% = คีย์บอร์ดบนจอเปิดอยู่ */
export function keyboardLikelyOpen(visualHeight: number, layoutHeight: number): boolean {
  return layoutHeight > 0 && visualHeight < layoutHeight * 0.75;
}
/**
 * D-01: Pinch-zoom ทำให้ visualViewport.height ลดลงเหมือนคีย์บอร์ดเปิด (height = layout / scale)
 * ต้องแยกออกด้วย visualViewport.scale — ซูมอยู่ = ใช้ layout viewport (innerHeight) ไม่ย่อพื้นที่แชทตามการซูม
 */
export const ZOOM_EPSILON = 0.01;
export function isPinchZoomed(scale: number | undefined | null): boolean {
  return typeof scale === "number" && Number.isFinite(scale) && scale > 1 + ZOOM_EPSILON;
}
export interface ViewportSample {
  /** window.visualViewport (null = เบราว์เซอร์ไม่รองรับ) */
  vv: { height: number; pageTop: number; scale: number } | null;
  innerHeight: number;
  scrollY: number;
}
export interface ChatViewport {
  /** ขอบล่างของส่วนที่มองเห็น (พิกัดเอกสาร) — ถ้า resetScroll = ค่าหลังเลื่อนหน้ากลับไปบนสุดแล้ว */
  visibleBottom: number;
  /** ความสูงที่ใช้ตัดสินว่าคีย์บอร์ดเปิด */
  visualHeight: number;
  zoomed: boolean;
  /**
   * D-03: ต้องเรียก window.scrollTo(0, 0)
   * หน้าแชทล็อก scroll ของหน้า (html overflow hidden) และผู้ใช้เลื่อนได้เฉพาะรายการข้อความ
   * → pageTop > 0 ที่ไม่ได้มาจากการซูม = iOS เลื่อนหน้าเอง (ตอนคีย์บอร์ดเปิด หรือค้างหลังปิดคีย์บอร์ด)
   * คืนตำแหน่งเพื่อให้หัวห้องอยู่ในจอ · ขณะซูมไม่คืน (เป็นการเลื่อนดูของผู้ใช้)
   */
  resetScroll: boolean;
}
export const SCROLL_RESET_MIN_PX = 1;
/**
 * @param allowReset false = เพิ่งคืนตำแหน่งไป (กัน loop กับเบราว์เซอร์ที่เลื่อนกลับทันที) → ใช้ตำแหน่งปัจจุบันตามจริง
 */
export function chatViewport(s: ViewportSample, allowReset = true): ChatViewport {
  if (!s.vv || isPinchZoomed(s.vv.scale)) {
    return { visibleBottom: s.scrollY + s.innerHeight, visualHeight: s.innerHeight, zoomed: !!s.vv, resetScroll: false };
  }
  const resetScroll = allowReset && s.vv.pageTop >= SCROLL_RESET_MIN_PX;
  return {
    visibleBottom: (resetScroll ? 0 : s.vv.pageTop) + s.vv.height,
    visualHeight: s.vv.height,
    zoomed: false,
    resetScroll,
  };
}
/** D-03: ช่วงเวลาที่ไม่คืนตำแหน่งซ้ำ (ms) — ถ้าเบราว์เซอร์เลื่อนกลับทันที ยอมใช้ตำแหน่งนั้นแทนการแย่งกันเลื่อน */
export const SCROLL_RESET_COOLDOWN_MS = 500;

export interface ChatPaneInput {
  /** ขอบล่างของส่วนที่มองเห็น (visualViewport.pageTop + visualViewport.height) */
  visibleBottom: number;
  /** ขอบบนของพื้นที่แชท (getBoundingClientRect().top + scrollY) */
  paneTop: number;
  /** visualViewport.height */
  visualHeight: number;
  /** window.innerHeight (layout viewport) */
  layoutHeight: number;
  /** แสดงแถบเมนูล่างของช่างหรือไม่ */
  techNav: boolean;
  /** ความสูงแถบเมนูล่างของช่าง */
  techNavHeight: number;
}
export function chatPaneHeight(v: ChatPaneInput): number {
  const keyboard = keyboardLikelyOpen(v.visualHeight, v.layoutHeight);
  // แถบเมนูล่างของช่างเป็น position: fixed ที่ก้น layout viewport — ตอนคีย์บอร์ดเปิดถูกคีย์บอร์ดทับ จึงไม่ต้องเว้น
  const reserve = (v.techNav && !keyboard ? v.techNavHeight : 0) + CHAT_PANE_GUTTER_PX;
  const available = Math.floor(v.visibleBottom - v.paneTop - reserve);
  return Math.max(0, available);
}

/**
 * D-02: พื้นที่ที่มองเห็นเหลือน้อยกว่าแถวพิมพ์ + ปุ่มส่ง (เช่น มือถือแนวนอน + คีย์บอร์ด เหลือ < 120px)
 * → เลื่อนพื้นที่แชทขึ้นทับส่วนบนของหน้า (AppBar / หัวหน้า) เท่าที่จำเป็น ให้แถวพิมพ์ + ปุ่มส่งอยู่ในจอ
 *   pullUp = ระยะที่เลื่อนขึ้น (ไม่เกินขอบบนของส่วนที่มองเห็น) · ส่วนบนกลับมาเองเมื่อพื้นที่พอ (เช่น ปิดคีย์บอร์ด)
 * paneTop = ตำแหน่งบน "ตามปกติ" (ก่อนเลื่อนขึ้น) — หน้าเว็บหักระยะที่เลื่อนอยู่ออกก่อนส่งมา จึงไม่อ้างผลของตัวเอง
 */
export interface ChatPaneFit {
  height: number;
  pullUp: number;
}
export function chatPaneFit(v: ChatPaneInput & { visibleTop: number }): ChatPaneFit {
  const keyboard = keyboardLikelyOpen(v.visualHeight, v.layoutHeight);
  const reserve = (v.techNav && !keyboard ? v.techNavHeight : 0) + CHAT_PANE_GUTTER_PX;
  const available = Math.floor(v.visibleBottom - v.paneTop - reserve);
  if (available >= CHAT_COMPOSER_ROW_PX) return { height: available, pullUp: 0 };
  const maxPull = Math.max(0, Math.floor(v.paneTop - v.visibleTop));
  const pullUp = Math.min(CHAT_COMPOSER_ROW_PX - available, maxPull);
  return { height: Math.max(0, available + pullUp), pullUp };
}

/**
 * D-02: จัดสรรพื้นที่ในห้องแชทตามความสูงจริง — ช่องพิมพ์และปุ่มส่งต้องอยู่ในจอก่อนอย่างอื่น
 *   หัวห้อง: full (≥ 320) · compact (≥ 160: ชื่อห้อง + ปุ่มย้อนกลับ/สมาชิกแบบเล็ก ไม่แสดงจำนวนสมาชิก/ปุ่มเปิดคิว)
 *            · hidden (< 160: เกิดเฉพาะจอเตี้ยมาก เช่น มือถือแนวนอน + คีย์บอร์ด — ปิดคีย์บอร์ดแล้วกลับมา)
 *   ช่องพิมพ์ทั้งก้อน ≤ 60% ของพื้นที่ใต้หัวห้อง แต่ไม่ต่ำกว่าแถวพิมพ์+ปุ่มส่ง (56px)
 *   ส่วนเสริม (แถบตอบกลับ อ้างอิงใบงาน ไฟล์ รายการแท็ก) ได้ส่วนที่เหลือจากแถวพิมพ์ และเลื่อนในตัวเอง
 *   จำนวนบรรทัดของช่องพิมพ์ลดตามพื้นที่ (1–5)
 */
export const CHAT_HEADER_FULL_MIN_PX = 320;
export const CHAT_HEADER_COMPACT_MIN_PX = 160;
export const CHAT_HEADER_PX = { full: 57, compact: 41, hidden: 0 } as const;
/** แถวช่องพิมพ์ 1 บรรทัด + ปุ่มแนบ/ส่ง + padding */
export const CHAT_COMPOSER_ROW_PX = 56;
export const CHAT_INPUT_LINE_PX = 23;
export const CHAT_MENTION_LIST_MAX_PX = 200;
export const CHAT_INPUT_MAX_ROWS = 5;
export type ChatHeaderMode = "full" | "compact" | "hidden";
export interface ChatPaneLayout {
  header: ChatHeaderMode;
  /** ความสูงสูงสุดของช่องพิมพ์ทั้งก้อน */
  composerMaxPx: number;
  /** ความสูงสูงสุดของส่วนเสริมเหนือแถวพิมพ์ (เลื่อนในตัวเอง) */
  extrasMaxPx: number;
  /** ความสูงสูงสุดของรายการแท็ก */
  mentionMaxPx: number;
  /** จำนวนบรรทัดสูงสุดของช่องพิมพ์ */
  inputMaxRows: number;
  /** แถบตอบกลับแสดงบรรทัดเดียว */
  compactReply: boolean;
}
export function chatPaneLayout(paneHeight: number): ChatPaneLayout {
  const h = Math.max(0, Math.floor(paneHeight));
  const header: ChatHeaderMode = h >= CHAT_HEADER_FULL_MIN_PX ? "full" : h >= CHAT_HEADER_COMPACT_MIN_PX ? "compact" : "hidden";
  const body = Math.max(0, h - CHAT_HEADER_PX[header]);
  const composerMaxPx = Math.max(CHAT_COMPOSER_ROW_PX, Math.floor(body * 0.6));
  const spare = composerMaxPx - CHAT_COMPOSER_ROW_PX;
  const inputMaxRows = Math.max(1, Math.min(CHAT_INPUT_MAX_ROWS, 1 + Math.floor(spare / 2 / CHAT_INPUT_LINE_PX)));
  const extrasMaxPx = Math.max(0, spare - (inputMaxRows - 1) * CHAT_INPUT_LINE_PX);
  return {
    header,
    composerMaxPx,
    extrasMaxPx,
    mentionMaxPx: Math.min(CHAT_MENTION_LIST_MAX_PX, extrasMaxPx),
    inputMaxRows,
    compactReply: header !== "full",
  };
}

/**
 * D-04: element ที่อยู่ "เหนือ" พื้นที่แชทใน flow — พี่น้องก่อนหน้าของพื้นที่แชทและของทุกชั้นที่ครอบ (ถึง stop)
 * เช่น AppBar (Header) และหัวหน้า (WomsPageHeader) — ความสูงเปลี่ยน (ฟอนต์โหลดเสร็จ ตัดบรรทัด แสดง/ซ่อน) = ตำแหน่งบนของพื้นที่แชทเปลี่ยน
 * ใช้กับ ResizeObserver เพื่อวัดใหม่ · ไม่รวมพื้นที่แชทเองหรือ element ที่ครอบ (ขนาดของมันเปลี่ยนตามผลการวัด)
 */
export interface DomNodeLike<T> {
  parentElement: T | null;
  previousElementSibling: T | null;
}
export function elementsAbove<T extends DomNodeLike<T>>(node: T, stop: T | null): T[] {
  const out: T[] = [];
  for (let n: T | null = node; n && n !== stop; n = n.parentElement) {
    for (let sib = n.previousElementSibling; sib; sib = sib.previousElementSibling) out.push(sib);
  }
  return out;
}

/**
 * FE-01: padding/border ด้านล่างของ element ที่ครอบพื้นที่แชท (รวมทุกชั้นถึง body) — ค่าจาก CSS ไม่ขึ้นกับความสูงของพื้นที่แชท
 * หน้าแชทใช้เป็น margin-bottom ติดลบ ให้ขอบล่างของเอกสาร = ขอบล่างของพื้นที่แชท (ไม่มีส่วนเกินให้ scroll)
 */
export function chatPaneBottomOffset(ancestors: { paddingBottom: string; borderBottomWidth: string }[]): number {
  let sum = 0;
  for (const a of ancestors) sum += (parseFloat(a.paddingBottom) || 0) + (parseFloat(a.borderBottomWidth) || 0);
  return Math.round(sum);
}

/**
 * FE-01: สถานะ "อยู่ล่างสุด" หลัง scroll event
 * scroll event ที่เกิดจากการเปลี่ยนขนาด (หมุนจอ/คีย์บอร์ด/ย่อหน้าต่าง → browser ปรับ scrollTop เอง) อ่านค่าทีหลัง
 * ตอนรายการเตี้ยลงแล้ว จึงดูเหมือน "ไม่ได้อยู่ล่างสุด" — ถ้าความสูงรายการเปลี่ยนตั้งแต่ event ก่อน ให้คงสถานะเดิม
 */
export function nextStickToBottom(prevStick: boolean, atBottom: boolean, listResized: boolean): boolean {
  return listResized && prevStick ? true : atBottom;
}

/**
 * CHAT-01: ตำแหน่ง scroll ใหม่หลังเติมข้อความเก่าด้านบน — คงข้อความที่ผู้ใช้กำลังอ่านไว้ที่เดิม
 * (ระยะจากก้นรายการเท่าเดิม)
 */
export function preservedScrollTop(prev: { scrollHeight: number; scrollTop: number }, nextScrollHeight: number): number {
  return Math.max(0, nextScrollHeight - (prev.scrollHeight - prev.scrollTop));
}

/**
 * CHAT-01: จำนวนข้อความใหม่ที่ควรแจ้ง (ตัวแจ้ง "ข้อความใหม่") — ไม่นับข้อความของตนเอง
 * เมื่อผู้ใช้อยู่ล่างสุดจะเลื่อนตามเอง จึงไม่ต้องแจ้ง
 */
export function newMessageCount(fresh: { senderId: string }[], viewerId: string | undefined, atBottom: boolean): number {
  if (atBottom) return 0;
  return fresh.filter((m) => m.senderId !== viewerId).length;
}

/** เวลาข้อความล่าสุดที่เคยเห็น — ไม่ถอยหลังเมื่อรอบดึงได้แค่ข้อความเก่าที่เพิ่งถูกยกเลิก */
export function latestCreatedAt(current: string, messages: { createdAt: string }[]): string {
  let out = current;
  for (const m of messages) if (m.createdAt > out) out = m.createdAt;
  return out;
}

// ---------------------------------------------------------------------------
// Phase B (TD-04 อนุมัติ 31 ต.ค. 69) — ลำดับ 3 แบบ: แสดงผล · ดึงข้อความใหม่ · แบ่งหน้า
// ---------------------------------------------------------------------------
//   แสดงผล  : (occurredAt ?? createdAt, seq ?? -1, messageId) — เหตุการณ์อยู่ตามเวลาที่เกิดจริงแม้ส่งเข้าห้องช้า
//   ดึงใหม่  : afterSeq + changedSince จาก cursor ของ backend (ไม่ตกหล่นแม้เวลาเครื่องต่างกัน)
//             backend รุ่นเดิม (ไม่มี cursor) → ใช้ since + POLL_OVERLAP_MS แบบ Phase A
//   แบ่งหน้า : cursor.before = "createdAt|messageId" ตรงตัว · backend รุ่นเดิม → olderCursor() แบบ Phase A
// ข้อความเดิม (ไม่มี seq/occurredAt) เรียงแบบเดิมทุกประการ (occurredAt = createdAt, seq = -1)

export interface TimelineOrderable {
  messageId: string;
  createdAt: string;
  occurredAt?: string;
  seq?: number;
}

export function occurredAtOf(m: Pick<TimelineOrderable, "createdAt" | "occurredAt">): string {
  return m.occurredAt || m.createdAt;
}

/** ลำดับแสดงผล — ตรงกับ compareTimeline ของ backend */
export function compareTimeline(a: TimelineOrderable, b: TimelineOrderable): number {
  return occurredAtOf(a).localeCompare(occurredAtOf(b)) || (a.seq ?? -1) - (b.seq ?? -1) || a.messageId.localeCompare(b.messageId);
}

/** cursor ที่ backend Phase B ส่งมากับรายการข้อความ (backend รุ่นเดิมไม่มี) */
export interface ServerCursor {
  afterSeq: number;
  changedSince: string;
  before: string | null;
  hasMore: boolean;
}

export interface PollState {
  /** มีเมื่อ backend รองรับ seq */
  afterSeq?: number;
  changedSince?: string;
  /** createdAt ล่าสุดที่เห็น — ใช้เมื่อ backend ไม่มี cursor */
  lastAt: string;
}

export const EMPTY_POLL: PollState = { lastAt: "" };

export type MessagesQuery = { since?: string; before?: string; afterSeq?: number; changedSince?: string };

/** query ของรอบดึงข้อความใหม่ */
export function pollQuery(s: PollState): MessagesQuery {
  if (typeof s.afterSeq === "number") {
    // since = ขอบล่างของข้อความเดิมที่ไม่มี seq แบบ Phase A (backend ใช้ค่าที่เก่ากว่าระหว่าง since กับ changedSince − 30s)
    const since = pollSince(s.lastAt);
    return { afterSeq: s.afterSeq, ...(s.changedSince ? { changedSince: s.changedSince } : {}), ...(since ? { since } : {}) };
  }
  return { since: pollSince(s.lastAt) };
}

/**
 * เลื่อนจุดดึงต่อหลังได้ผล — afterSeq ไม่ถอยหลัง (ผลตอบกลับที่มาช้ากว่ารอบถัดไปไม่ทำให้ดึงซ้ำทั้งก้อน)
 * cursor = null (backend รุ่นเดิม) → ใช้ lastAt แบบ Phase A
 */
export function advancePoll(s: PollState, messages: { createdAt: string }[], cursor?: ServerCursor | null): PollState {
  const lastAt = latestCreatedAt(s.lastAt, messages);
  if (!cursor || typeof cursor.afterSeq !== "number") return { ...s, lastAt };
  const keepOld = typeof s.afterSeq === "number" && s.afterSeq > cursor.afterSeq;
  return {
    afterSeq: keepOld ? s.afterSeq : cursor.afterSeq,
    changedSince: keepOld ? s.changedSince : cursor.changedSince,
    lastAt,
  };
}

/** จุดอ้างอิง "โหลดข้อความก่อนหน้า": cursor ตรงตัวของ backend ถ้ามี · ไม่มีก็ใช้แบบ Phase A */
export function olderQuery(serverBefore: string | null | undefined, messages: { createdAt: string }[]): string | undefined {
  return serverBefore || olderCursor(messages);
}

/** มีหน้าก่อนหน้าอีกไหม — ใช้ hasMore ของ backend ถ้ามี */
export function hasMoreOlder(count: number, cursor?: ServerCursor | null): boolean {
  return cursor && typeof cursor.hasMore === "boolean" ? cursor.hasMore : count >= MESSAGE_PAGE_SIZE;
}

/**
 * ข้อความที่ "ต่อท้าย" Timeline (อยู่ใต้ข้อความล่าสุดที่แสดงอยู่) — นับในตัวแจ้งข้อความใหม่
 * เหตุการณ์ที่ส่งเข้าห้องช้า (occurredAt เก่ากว่าข้อความล่าสุด) ถูกแทรกตามเวลาจริงด้านบน จึงไม่นับ
 */
export function appendedMessages<T extends TimelineOrderable>(prev: T[], fresh: T[]): T[] {
  let newest: T | null = null;
  for (const m of prev) if (!newest || compareTimeline(m, newest) > 0) newest = m;
  if (!newest) return fresh;
  const n = newest;
  return fresh.filter((m) => compareTimeline(m, n) > 0);
}

// ---- สถานะของเหตุการณ์ (Job Status Timeline) ----
export interface TimelineEventView {
  action: string;
  actionLabel: string;
  fromStatus: string;
  toStatus: string;
  statusLabel: string;
  actorName: string;
  actorRole: string;
  at: string;
  entity: "QUEUE" | "JOB" | string;
  queueNo?: string;
  jobId?: string;
  detail?: { reason?: string; jobDateFrom?: string; jobDateTo?: string } | null;
}

/** หัวการ์ดเหตุการณ์: "เหตุการณ์ · Q / JN" (สถานะใหม่อยู่ในชิปของแถวสถานะแล้ว ไม่แสดงซ้ำ) */
export function eventHeadline(e: Pick<TimelineEventView, "actionLabel" | "queueNo" | "jobId">): string {
  return [e.actionLabel, [e.queueNo, e.jobId].filter(Boolean).join(" / ")].filter(Boolean).join(" · ");
}

/** เปลี่ยนสถานะจริงไหม (EDIT/แจ้งเตือนที่สถานะเท่าเดิม → ไม่แสดงลูกศร) */
export function eventChangedStatus(e: Pick<TimelineEventView, "fromStatus" | "toStatus">): boolean {
  return !!e.fromStatus && !!e.toStatus && e.fromStatus !== e.toStatus;
}

/**
 * ชื่อสถานะไทยของ "จาก → เป็น" — ใบงานใช้ตาราง statusLabel (options.ts) · คิวใช้ SQ_STATUS_LABEL
 * (ส่งเข้ามาเป็นพารามิเตอร์ให้ฟังก์ชันบริสุทธิ์) · ไม่รู้จัก = รหัสเดิม · สถานะปลายทางใช้ statusLabel ของ snapshot
 */
export function eventTransitionText(
  e: Pick<TimelineEventView, "entity" | "fromStatus" | "toStatus" | "statusLabel">,
  labels: { job: Record<string, string>; queue: Record<string, string> }
): string {
  const t = e.entity === "JOB" ? labels.job : labels.queue;
  return `${t[e.fromStatus] ?? e.fromStatus} → ${e.statusLabel || t[e.toStatus] || e.toStatus}`;
}

/** ลิงก์ของการ์ดเหตุการณ์: ใบงาน → /jobs/:id · คิว → /service-queue/:id */
export function eventLink(e: Pick<TimelineEventView, "entity" | "jobId">, ref: { queueId?: string } | null | undefined): string | null {
  if (e.entity === "JOB" && e.jobId) return `/jobs/${encodeURIComponent(e.jobId)}`;
  if (ref?.queueId) return `/service-queue/${encodeURIComponent(ref.queueId)}`;
  return null;
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
