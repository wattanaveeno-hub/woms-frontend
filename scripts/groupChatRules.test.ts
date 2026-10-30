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
