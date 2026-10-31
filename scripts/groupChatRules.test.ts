/** D-13 / D-14 แชทกลุ่ม — กติกาฝั่งหน้าจอ (ส่งซ้ำด้วยคีย์เดิม · ยกเลิกข้อความ) */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CANCEL_WINDOW_MS,
  canCancel,
  cancelErrorMessage,
  cancelledLabel,
  isRetryableSendError,
  latestCreatedAt,
  mergeMessages,
  newClientMessageId,
  sendWithRetry,
} from "../src/lib/groupChatRules.ts";

const T0 = Date.parse("2026-10-30T03:00:00.000Z");
const msg = (over: Record<string, unknown> = {}) => ({
  messageId: "m1",
  kind: "TEXT",
  senderId: "u1",
  createdAt: new Date(T0).toISOString(),
  ...over,
});
const SENDER = { id: "u1", canModerate: false };
const OTHER = { id: "u2", canModerate: false };
const ADMIN = { id: "a1", canModerate: true };

test("D-14: ผู้ส่งยกเลิกได้ภายใน 15 นาที (14:59 ได้ · 15:01 ไม่ได้)", () => {
  assert.equal(canCancel(msg(), T0 + 14 * 60_000 + 59_000, SENDER), "SENDER");
  assert.equal(canCancel(msg(), T0 + CANCEL_WINDOW_MS, SENDER), "SENDER");
  assert.equal(canCancel(msg(), T0 + 15 * 60_000 + 1_000, SENDER), null);
});

test("D-14: ผู้ใช้อื่นยกเลิกไม่ได้ · Admin (chat:moderate) ยกเลิกได้ทุกเวลา", () => {
  assert.equal(canCancel(msg(), T0 + 1000, OTHER), null);
  assert.equal(canCancel(msg(), T0 + 24 * 3600_000, ADMIN), "ADMIN");
  // Admin ที่เป็นผู้ส่งเองภายใน 15 นาที = ในฐานะผู้ส่ง (ไม่บังคับเหตุผล)
  assert.equal(canCancel(msg({ senderId: "a1" }), T0 + 1000, ADMIN), "SENDER");
  assert.equal(canCancel(msg(), T0, null), null);
});

test("D-14: การ์ด/ข้อความระบบ/การ์ดปิดงาน/ยกเลิกแล้ว — ไม่มีปุ่มยกเลิก", () => {
  assert.equal(canCancel(msg({ kind: "CARD" }), T0, ADMIN), null);
  assert.equal(canCancel(msg({ kind: "SYSTEM" }), T0, ADMIN), null);
  assert.equal(canCancel(msg({ jobCard: { type: "JOB_CLOSED" } }), T0, ADMIN), null);
  assert.equal(canCancel(msg({ jobCard: { type: "JOB_REF" } }), T0, SENDER), "SENDER");
  assert.equal(canCancel(msg({ cancelled: true }), T0, ADMIN), null);
});

test("D-14: placeholder และข้อความผิดพลาดภาษาไทย", () => {
  assert.equal(cancelledLabel({ cancelledByRole: "SENDER" }), "ข้อความนี้ถูกยกเลิก");
  assert.equal(cancelledLabel({ cancelledByRole: "ADMIN" }), "ข้อความนี้ถูกยกเลิกโดยผู้ดูแลระบบ");
  assert.equal(cancelErrorMessage(409), "ข้อความนี้ถูกยกเลิกไปแล้ว");
  assert.match(cancelErrorMessage(403), /15 นาที/);
  assert.equal(cancelErrorMessage(403, "ยกเลิกข้อความได้ภายใน 15 นาทีหลังส่งเท่านั้น"), "ยกเลิกข้อความได้ภายใน 15 นาทีหลังส่งเท่านั้น");
  assert.equal(cancelErrorMessage(403, "Forbidden"), "คุณไม่มีสิทธิ์ยกเลิกข้อความนี้ (ผู้ส่งยกเลิกได้ภายใน 15 นาที)");
});

test("รวมข้อความรอบใหม่: แทนที่ข้อความที่ถูกยกเลิก ไม่ซ้ำ เรียงตามเวลา · เวลาล่าสุดไม่ถอยหลัง", () => {
  const a = { messageId: "a", createdAt: "2026-10-30T03:00:00Z", text: "x" };
  const b = { messageId: "b", createdAt: "2026-10-30T03:01:00Z", text: "y" };
  const aCancelled = { messageId: "a", createdAt: "2026-10-30T03:00:00Z", text: "", cancelled: true };
  const c = { messageId: "c", createdAt: "2026-10-30T03:02:00Z", text: "z" };
  const merged = mergeMessages<any>([a, b], [aCancelled, c]);
  assert.deepEqual(merged.map((m) => m.messageId), ["a", "b", "c"]);
  assert.equal(merged[0].cancelled, true);
  assert.equal(mergeMessages<any>([a, b], [b]).length, 2);
  assert.equal(latestCreatedAt(b.createdAt, [aCancelled]), b.createdAt);
  assert.equal(latestCreatedAt(b.createdAt, [aCancelled, c]), c.createdAt);
});

test("D-13: ส่งซ้ำด้วยคีย์เดิมเฉพาะเครือข่ายหลุด/5xx ชั่วคราว · 4xx ไม่ลองซ้ำ", async () => {
  assert.match(newClientMessageId(() => "abc-123"), /^gm-abc-123$/);
  assert.match(newClientMessageId(), /^[A-Za-z0-9_.:-]{8,100}$/);
  assert.equal(isRetryableSendError(0), true);
  assert.equal(isRetryableSendError(503), true);
  assert.equal(isRetryableSendError(400), false);
  assert.equal(isRetryableSendError(409), false);

  const keys: string[] = [];
  const key = newClientMessageId(() => "fixed-key");
  let n = 0;
  const ok = await sendWithRetry(
    async () => {
      keys.push(key);
      if (++n < 3) throw { status: 0 };
      return "sent";
    },
    (e) => (e as { status: number }).status,
    { sleep: async () => {} }
  );
  assert.equal(ok, "sent");
  assert.deepEqual(keys, [key, key, key]);

  let calls = 0;
  await assert.rejects(
    sendWithRetry(
      async () => {
        calls++;
        throw { status: 400 };
      },
      (e) => (e as { status: number }).status,
      { sleep: async () => {} }
    )
  );
  assert.equal(calls, 1);
});

// ---------------------------------------------------------------------------
// WS-01 CHAT-01..04 (31 ต.ค. 69)
// ---------------------------------------------------------------------------
import {
  compareMessages,
  freshMessages,
  isAtBottom,
  latestQueueCardIds,
  newMessageCount,
  olderCursor,
  pollSince,
  preservedScrollTop,
} from "../src/lib/groupChatRules.ts";

const at = (ms: number) => new Date(T0 + ms).toISOString();
const card = (id: string, ms: number, queueId: string, over: Record<string, unknown> = {}) => ({
  messageId: id,
  kind: "CARD",
  senderId: "system",
  createdAt: at(ms),
  ref: { queueId, queueNo: "Q-" + queueId, jobId: "" },
  ...over,
});

test("CHAT-02: เรียงตามเวลา และเวลาเท่ากันตัดสินด้วย messageId เสมอ (ไม่ขึ้นกับลำดับที่ได้รับ)", () => {
  const a = { messageId: "b-2", createdAt: at(0) };
  const b = { messageId: "a-1", createdAt: at(0) };
  const c = { messageId: "0-0", createdAt: at(1) };
  const one = [a, b, c].sort(compareMessages).map((m) => m.messageId);
  const two = [c, b, a].sort(compareMessages).map((m) => m.messageId);
  assert.deepEqual(one, ["a-1", "b-2", "0-0"]);
  assert.deepEqual(two, one);
  // mergeMessages ใช้ลำดับเดียวกัน
  assert.deepEqual(mergeMessages<any>([a], [c, b]).map((m) => m.messageId), one);
});

test("CHAT-02: append-only — การ์ดล่าสุดต่อคิวเท่านั้นที่เป็นการ์ดสถานะปัจจุบัน · การ์ดเก่าคงเป็นประวัติ", () => {
  const list = [card("c1", 0, "Q1"), card("c2", 10, "Q2"), msg({ messageId: "t1", createdAt: at(15) }), card("c3", 20, "Q1"), card("c4", 30, "Q1")];
  assert.deepEqual([...latestQueueCardIds(list)].sort(), ["c2", "c4"]);
  // สถานะใหม่มาถึง: การ์ดเดิมไม่หายไปจากรายการ ไม่ย้ายตำแหน่ง แค่ไม่ใช่ "ล่าสุด"
  const next = mergeMessages<any>(list, [card("c5", 40, "Q1")]);
  assert.deepEqual(next.map((m) => m.messageId), ["c1", "c2", "t1", "c3", "c4", "c5"]);
  assert.deepEqual([...latestQueueCardIds(next)].sort(), ["c2", "c5"]);
  // การ์ดปิดงาน (jobCard) และการ์ดที่ไม่มีคิว ไม่นับเป็นการ์ดสถานะคิว
  assert.equal(latestQueueCardIds([card("j1", 50, "Q1", { jobCard: { type: "JOB_CLOSED" } })]).size, 0);
});

test("CHAT-04: ดึงซ้อนย้อนหลัง 30 วินาที · ตัดซ้ำด้วย messageId (refresh/reconnect ไม่ได้ข้อความซ้ำ)", () => {
  assert.equal(pollSince(at(60_000)), at(30_000));
  assert.equal(pollSince(""), undefined);
  assert.equal(pollSince("not-a-date"), undefined);
  const prev = [msg({ messageId: "a" }), msg({ messageId: "b" })];
  // การ์ดที่ createdAt เก่ากว่าข้อความล่าสุดแต่บันทึกเสร็จทีหลัง — ได้มาในรอบดึงซ้อน
  const late = card("late", -5_000, "Q1");
  const fresh = freshMessages<any>(prev, [prev[0], late, late]);
  assert.deepEqual(fresh.map((m) => m.messageId), ["late"]);
  const merged = mergeMessages<any>(prev, [prev[0], late]);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].messageId, "late");
  assert.equal(mergeMessages<any>(merged, merged).length, 3);
});

test("CHAT-01: โหลดข้อความก่อนหน้า — cursor = เก่าสุด + 1ms · คงตำแหน่งที่กำลังอ่าน", () => {
  assert.equal(olderCursor([{ createdAt: at(5) }, { createdAt: at(1) }]), at(2));
  assert.equal(olderCursor([]), undefined);
  // เดิม scrollHeight 1000 อยู่ที่ 200 (ห่างก้น 800) · เติมด้านบนแล้วสูง 1600 → 800 (ห่างก้น 800 เท่าเดิม)
  assert.equal(preservedScrollTop({ scrollHeight: 1000, scrollTop: 200 }, 1600), 800);
  assert.equal(preservedScrollTop({ scrollHeight: 1000, scrollTop: 0 }, 900), 0);
});

test("CHAT-01: อยู่ล่างสุด = เลื่อนตาม · กำลังอ่านข้อความเก่า = แจ้งข้อความใหม่ (ไม่นับของตนเอง)", () => {
  assert.equal(isAtBottom({ scrollHeight: 1000, scrollTop: 600, clientHeight: 400 }), true);
  assert.equal(isAtBottom({ scrollHeight: 1000, scrollTop: 530, clientHeight: 400 }), true);
  assert.equal(isAtBottom({ scrollHeight: 1000, scrollTop: 300, clientHeight: 400 }), false);
  const fresh = [{ senderId: "u1" }, { senderId: "u2" }, { senderId: "system" }];
  assert.equal(newMessageCount(fresh, "u1", false), 2);
  assert.equal(newMessageCount(fresh, "u1", true), 0);
});

// ---------------------------------------------------------------------------
// Phase B (TD-04) — ลำดับแสดงผล occurredAt · ดึงใหม่ afterSeq · แบ่งหน้า cursor ตรงตัว
// ---------------------------------------------------------------------------
import {
  EMPTY_POLL,
  advancePoll,
  appendedMessages,
  compareTimeline,
  eventChangedStatus,
  eventHeadline,
  eventLink,
  eventTransitionText,
  hasMoreOlder,
  olderQuery,
  pollQuery,
} from "../src/lib/groupChatRules.ts";

type MessagesQuery = { since?: string; before?: string; afterSeq?: number; changedSince?: string };
type SimMsg = { messageId: string; createdAt: string; occurredAt?: string; seq?: number; cancelled?: boolean };

test("PB-01 ข้อความเดิม (ไม่มี seq/occurredAt) เรียงเหมือน Phase A ทุกประการ", () => {
  const legacy: SimMsg[] = [
    { messageId: "b", createdAt: at(1000) },
    { messageId: "a", createdAt: at(1000) },
    { messageId: "c", createdAt: at(0) },
  ];
  assert.deepEqual([...legacy].sort(compareTimeline).map((m) => m.messageId), [...legacy].sort(compareMessages).map((m) => m.messageId));
});

test("PB-02 เหตุการณ์ที่ส่งช้า (occurredAt เก่ากว่า) แทรกตามเวลาจริง · ไม่นับในตัวแจ้งข้อความใหม่", () => {
  const shown: SimMsg[] = [
    { messageId: "m1", createdAt: at(0), seq: 1 },
    { messageId: "m2", createdAt: at(5000), seq: 2 },
  ];
  const late = { messageId: "ev", createdAt: at(9000), occurredAt: at(2000), seq: 4 };
  const newer = { messageId: "m3", createdAt: at(8000), seq: 3 };
  const merged = mergeMessages(shown, [newer, late]);
  assert.deepEqual(merged.map((m) => m.messageId), ["m1", "ev", "m2", "m3"]);
  assert.deepEqual(appendedMessages(shown, [late, newer]).map((m) => m.messageId), ["m3"]);
  // ห้องว่าง → ทุกข้อความเป็นข้อความต่อท้าย
  assert.equal(appendedMessages([], [late]).length, 1);
});

test("PB-03 occurredAt เท่ากัน → seq ตัดสิน (hold/resume/hold มิลลิวินาทีเดียวกัน) · seq เท่ากัน/ไม่มี → messageId", () => {
  const t = at(0);
  const ms: SimMsg[] = [
    { messageId: "z", createdAt: t, occurredAt: t, seq: 3 },
    { messageId: "y", createdAt: t, occurredAt: t, seq: 1 },
    { messageId: "x", createdAt: t, occurredAt: t, seq: 2 },
    { messageId: "w", createdAt: t },
  ];
  assert.deepEqual([...ms].sort(compareTimeline).map((m) => m.messageId), ["w", "y", "x", "z"]);
});

test("PB-04 poll: backend Phase B ใช้ afterSeq/changedSince · afterSeq ไม่ถอยหลังเมื่อผลตอบกลับมาไม่เรียงลำดับ", () => {
  let s = advancePoll(EMPTY_POLL, [{ createdAt: at(0) }], { afterSeq: 10, changedSince: at(1), before: null, hasMore: false });
  assert.deepEqual(pollQuery(s), { afterSeq: 10, changedSince: at(1), since: pollSince(at(0)) });
  s = advancePoll(s, [], { afterSeq: 15, changedSince: at(2), before: null, hasMore: false });
  // ผลของรอบที่ส่งก่อนแต่มาถึงทีหลัง (afterSeq 12) ไม่ทำให้ถอย
  s = advancePoll(s, [], { afterSeq: 12, changedSince: at(1.5), before: null, hasMore: false });
  assert.deepEqual(pollQuery(s), { afterSeq: 15, changedSince: at(2), since: pollSince(at(0)) });
});

test("PB-05 poll: backend รุ่นเดิม (ไม่มี cursor) → since + overlap แบบ Phase A", () => {
  const s = advancePoll(EMPTY_POLL, [{ createdAt: at(60_000) }], undefined);
  assert.deepEqual(pollQuery(s), { since: pollSince(at(60_000)) });
  assert.deepEqual(pollQuery(EMPTY_POLL), { since: undefined });
});

test("PB-06 แบ่งหน้า: ใช้ cursor ตรงตัวของ backend ถ้ามี · hasMore ของ backend ถ้ามี", () => {
  assert.equal(olderQuery(`${at(0)}|m1`, [{ createdAt: at(5) }]), `${at(0)}|m1`);
  assert.equal(olderQuery(null, [{ createdAt: at(5) }]), olderCursor([{ createdAt: at(5) }]));
  assert.equal(hasMoreOlder(300, { afterSeq: 1, changedSince: at(0), before: null, hasMore: false }), false);
  assert.equal(hasMoreOlder(300, null), true);
  assert.equal(hasMoreOlder(10, null), false);
});

/**
 * PB-07 จำลองครบวงจร (ข้อกำหนดเพิ่มเติมข้อ 1): ห้องที่มีข้อความเดิมปน seq · เหตุการณ์ส่งช้า · ยกเลิกข้อความ
 * server จำลองตรงกับ listMessages ของ backend (afterSeq: seq > N หรือ cancelledAt > changedSince
 * หรือ ข้อความไม่มี seq ที่ createdAt > changedSince − 30s · before: (createdAt, messageId) < cursor)
 * ตรวจ: ไม่ตกหล่น · ไม่ซ้ำ · ลำดับเท่ากับการเรียงทั้งชุดใหม่ทุกครั้ง (ตำแหน่งไม่ "กระโดด" ผิดที่)
 */
test("PB-07 occurredAt × createdAt pagination × afterSeq polling — ไม่หาย ไม่ซ้ำ ไม่ผิดตำแหน่ง (สุ่ม 200 รอบ)", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let round = 0; round < 200; round++) {
    const db: (SimMsg & { cancelledAt?: string })[] = [];
    let seq = 0;
    let clock = 0;
    const insert = (legacy: boolean, delayMs = 0) => {
      clock += Math.floor(rnd() * 3); // createdAt ซ้ำกันได้
      const createdAt = at(clock);
      const m: SimMsg = { messageId: `r${round}-${db.length}-${Math.floor(rnd() * 1e6)}`, createdAt };
      if (!legacy) {
        m.seq = ++seq;
        m.occurredAt = delayMs ? at(Math.max(0, clock - delayMs)) : createdAt;
      }
      db.push(m);
    };
    const PAGE = 7;
    const list = (q: MessagesQuery & { now: number }) => {
      let rows = db;
      if (typeof q.afterSeq === "number") {
        const changed = q.changedSince ? Date.parse(q.changedSince) : Infinity;
        // ขอบล่างของข้อความเดิม = เก่ากว่าระหว่าง changedSince − 30s กับ since ของหน้าจอ (เหมือน backend)
        const legacyFloor = Math.min(changed - 30_000, q.since ? Date.parse(q.since) : Infinity);
        rows = rows.filter(
          (m) =>
            (typeof m.seq === "number" && m.seq > q.afterSeq!) ||
            (m.cancelledAt && Date.parse(m.cancelledAt) > changed) ||
            (typeof m.seq !== "number" && Date.parse(m.createdAt) > legacyFloor)
        );
        rows = [...rows].sort((a, b) => (a.seq ?? -1) - (b.seq ?? -1) || a.createdAt.localeCompare(b.createdAt));
        const maxSeq = rows.reduce((n, m) => Math.max(n, m.seq ?? 0), q.afterSeq);
        return { messages: rows.map((m) => ({ ...m })), cursor: { afterSeq: maxSeq, changedSince: at(q.now), before: null, hasMore: false } };
      }
      let sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.messageId.localeCompare(a.messageId));
      if (q.before) {
        const [c, id] = q.before.split("|");
        sorted = sorted.filter((m) => m.createdAt < c || (m.createdAt === c && m.messageId < id));
      }
      const page = sorted.slice(0, PAGE);
      const oldest = page[page.length - 1];
      return {
        messages: page.map((m) => ({ ...m })),
        cursor: { afterSeq: seq, changedSince: at(q.now), before: oldest ? `${oldest.createdAt}|${oldest.messageId}` : null, hasMore: page.length >= PAGE },
      };
    };
    // ประวัติเดิม: ข้อความเดิมไม่มี seq ปนกับข้อความใหม่
    for (let i = 0; i < 15; i++) insert(rnd() < 0.5);
    // โหลดแรก + โหลดย้อนหลังจนหมด
    const first = list({ now: clock });
    let shown: SimMsg[] = mergeMessages([], first.messages);
    let poll = advancePoll(EMPTY_POLL, first.messages, first.cursor);
    let before = first.cursor.before;
    let more = first.cursor.hasMore;
    // ระหว่างผู้ใช้เลื่อนดูย้อนหลัง มีข้อความใหม่/เหตุการณ์ส่งช้า/ข้อความเดิมจาก instance รุ่นเก่า/การยกเลิก
    for (let step = 0; step < 12; step++) {
      const r = rnd();
      if (r < 0.35) insert(false);
      else if (r < 0.55) insert(false, 1 + Math.floor(rnd() * 20)); // เหตุการณ์ส่งช้า
      else if (r < 0.65) insert(true); // instance รุ่นเดิมระหว่างสลับ deploy
      else if (r < 0.75 && db.length) db[Math.floor(rnd() * db.length)].cancelledAt = at(clock + 1), (db[Math.floor(rnd() * db.length)].cancelled = true);
      clock += 1;
      if (rnd() < 0.5) {
        const p = list({ ...pollQuery(poll), now: clock });
        shown = mergeMessages(shown, p.messages);
        poll = advancePoll(poll, p.messages, p.cursor);
      }
      if (more && rnd() < 0.5) {
        const o = list({ before: olderQuery(before, shown), now: clock });
        shown = mergeMessages(shown, o.messages);
        before = o.cursor.before ?? before;
        more = hasMoreOlder(o.messages.length, o.cursor);
      }
    }
    // ดึงต่อจนจบ
    clock += 1;
    const p = list({ ...pollQuery(poll), now: clock });
    shown = mergeMessages(shown, p.messages);
    while (more) {
      const o = list({ before: olderQuery(before, shown), now: clock });
      shown = mergeMessages(shown, o.messages);
      before = o.cursor.before ?? before;
      more = hasMoreOlder(o.messages.length, o.cursor);
    }
    const ids = shown.map((m) => m.messageId);
    assert.equal(new Set(ids).size, ids.length, `round ${round}: ซ้ำ`);
    assert.deepEqual([...ids].sort(), db.map((m) => m.messageId).sort(), `round ${round}: ตกหล่น/เกิน`);
    assert.deepEqual(ids, [...db].sort(compareTimeline).map((m) => m.messageId), `round ${round}: ลำดับไม่ตรงการเรียงทั้งชุด`);
  }
});

test("PB-08 การ์ดเหตุการณ์: หัวการ์ด · ลูกศรเฉพาะเมื่อสถานะเปลี่ยน · ลิงก์ใบงาน/คิว · การ์ดคิวล่าสุดไม่ถูกแย่งโดยเหตุการณ์ส่งช้า", () => {
  assert.equal(eventHeadline({ actionLabel: "พักงาน", queueNo: "Q-1", jobId: "JN-1" }), "พักงาน · Q-1 / JN-1");
  assert.equal(eventHeadline({ actionLabel: "ยกเลิกใบงาน", queueNo: "", jobId: "JN-2" }), "ยกเลิกใบงาน · JN-2");
  assert.equal(eventChangedStatus({ fromStatus: "OPEN", toStatus: "HOLD" }), true);
  assert.equal(eventChangedStatus({ fromStatus: "OPEN", toStatus: "OPEN" }), false);
  assert.equal(eventLink({ entity: "JOB", jobId: "JN-1" }, { queueId: "q" }), "/jobs/JN-1");
  assert.equal(eventLink({ entity: "QUEUE", jobId: "" }, { queueId: "q1" }), "/service-queue/q1");
  assert.equal(eventLink({ entity: "JOB", jobId: "" }, null), null);
  const live = card("c2", 5000, "q1", { seq: 2 });
  const lateOld = card("c3", 9000, "q1", { seq: 3, occurredAt: at(1000) });
  assert.deepEqual([...latestQueueCardIds([card("c1", 0, "q1", { seq: 1 }), live, lateOld])], ["c2"]);
});

test("PB-09 ลูกศรสถานะใช้ชื่อไทย: ใบงาน/คิว · ไม่รู้จัก = รหัสเดิม", () => {
  const labels = { job: { OPEN: "เปิดงาน", HOLD: "พักงาน" }, queue: { WAIT_ASSIGN: "รอจ่ายงาน" } };
  assert.equal(eventTransitionText({ entity: "JOB", fromStatus: "OPEN", toStatus: "HOLD", statusLabel: "พักงาน" }, labels), "เปิดงาน → พักงาน");
  assert.equal(eventTransitionText({ entity: "QUEUE", fromStatus: "WAIT_ASSIGN", toStatus: "WAIT_TECH", statusLabel: "รอช่างตอบ" }, labels), "รอจ่ายงาน → รอช่างตอบ");
  assert.equal(eventTransitionText({ entity: "QUEUE", fromStatus: "X", toStatus: "Y", statusLabel: "" }, labels), "X → Y");
});

test("PB-10 ข้อความเดิม (ไม่มี seq) ที่ createdAt ย้อนหลังในห้องที่เงียบนาน — afterSeq mode ยังส่ง since แบบ Phase A ให้ backend", () => {
  // ข้อความล่าสุดที่เห็น 10 นาทีก่อน · รอบดึงล่าสุด (changedSince) = ตอนนี้
  const s = advancePoll(EMPTY_POLL, [{ createdAt: at(0) }], { afterSeq: 5, changedSince: at(600_000), before: null, hasMore: false });
  const q = pollQuery(s);
  assert.equal(q.since, pollSince(at(0)));
  // ข้อความเดิม createdAt = ล่าสุด − 10s → อยู่ในขอบ since (Phase A CHAT-04) แม้เก่ากว่า changedSince − 30s
  const late = Date.parse(at(-10_000));
  assert.ok(late > Date.parse(q.since!) && late < Date.parse(q.changedSince!) - 30_000);
});
