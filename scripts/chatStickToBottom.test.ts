/**
 * N-01 Group Chat Initial Scroll — แยก scroll ที่หน้าเว็บสั่งเอง (programmatic) ออกจาก scroll อื่น
 * หลักฐาน (trace build, Chromium 844×390 ช่าง, 7/40 รอบ): scrollToBottom ทำงานก่อนข้อความ render (ยังเป็นตัวโหลด)
 * → scroll event มาถึงหลังข้อความ render แล้ว อ่านได้ scrollTop 67 / scrollHeight 4428 / clientHeight 165
 * → สูตรเดิมตั้ง stick = false → เปิดห้องแล้วไม่อยู่ข้อความล่าสุด
 * QA รอบ 1 (F1/F2): การเดา "ผู้ใช้กำลังเลื่อน" จาก wheel/touch/keydown บนรายการ พลาด PageUp (โฟกัสอยู่ body) และ focus scroll
 * → เปลี่ยนเป็นทำเครื่องหมายเฉพาะ scroll ที่หน้าเว็บสั่งเอง
 * trace รอบ 2 (6/40): เบราว์เซอร์ปรับ scrollTop เองตอนตัวโหลดถูกแทนด้วยข้อความ (59 → 67 · scrollHeight 224 → 4428)
 * → นับ event ที่ scrollHeight เปลี่ยนจาก event ก่อนว่าไม่ใช่ผู้ใช้ด้วย
 */
import test from "node:test";
import assert from "node:assert/strict";
import { anchorRestoreTop, firstVisibleIndex, isAtBottom, nextStickToBottom, PROGRAMMATIC_SCROLL_WINDOW_MS, programmaticScrollPending, stickAfterScroll } from "../src/lib/groupChatRules.ts";

const TRACE_EVENT = { scrollTop: 67, scrollHeight: 4428, clientHeight: 165 }; // ค่าจาก trace รอบที่พลาด
const C = (o: Partial<{ listResized: boolean; contentResized: boolean; programmatic: boolean }> = {}) => ({ listResized: false, contentResized: false, programmatic: false, ...o });

test("N-01 reproduce (สูตรเดิม): scroll event ที่หน้าเว็บสั่งเองอ่านค่าหลังเนื้อหาเปลี่ยน → หลุดจากล่างสุด", () => {
  assert.equal(isAtBottom(TRACE_EVENT), false);
  assert.equal(nextStickToBottom(true, isAtBottom(TRACE_EVENT), false), false, "พฤติกรรมเดิม = บั๊ก");
});

test("N-01: event ของ scroll ที่หน้าเว็บสั่งเอง (ค้างเครื่องหมาย) → คงอยู่ล่างสุด", () => {
  assert.equal(stickAfterScroll(true, isAtBottom(TRACE_EVENT), C({ programmatic: true })), true);
  assert.equal(stickAfterScroll(true, false, C({ listResized: true, programmatic: true })), true, "พร้อมรายการเปลี่ยนขนาด");
});

test("N-01: scroll ที่ไม่ได้สั่งเอง (wheel / touch / PageUp ที่โฟกัส body / ลาก scrollbar / focus) → ใช้กติกาเดิม = เลื่อนขึ้นอ่านได้", () => {
  assert.equal(stickAfterScroll(true, false, C()), false, "QA F1: PageUp ต้องหลุดจากล่างสุด ไม่ถูกดึงกลับ");
  assert.equal(stickAfterScroll(true, false, C()), nextStickToBottom(true, false, false));
  assert.equal(stickAfterScroll(true, false, C({ listResized: true })), nextStickToBottom(true, false, true), "การปรับ scrollTop ของเบราว์เซอร์ตอนเปลี่ยนขนาด (เดิม)");
});

test("N-01: อ่านย้อนหลังอยู่ (ไม่อยู่ล่างสุด) — scroll ที่หน้าเว็บสั่ง (คงตำแหน่งตอนโหลดข้อความเก่า) ไม่ดึงลง", () => {
  assert.equal(stickAfterScroll(false, false, C({ programmatic: true })), false);
  assert.equal(stickAfterScroll(false, false, C()), false);
});

test("N-01: กลับมาอยู่ล่างสุด (ผู้ใช้เลื่อนเอง หรือหน้าเว็บพาไป) → ตามข้อความใหม่", () => {
  assert.equal(stickAfterScroll(false, true, C()), true);
  assert.equal(stickAfterScroll(false, true, C({ programmatic: true })), true);
});

test("N-01 programmaticScrollPending: ภายใน 1 วินาทีหลังหน้าเว็บตั้ง scrollTop · ไม่มีเครื่องหมาย = ไม่ใช่", () => {
  assert.equal(PROGRAMMATIC_SCROLL_WINDOW_MS, 1000);
  assert.equal(programmaticScrollPending(5000, 0), false, "ไม่มีเครื่องหมาย");
  assert.equal(programmaticScrollPending(5000, 4900), true, "trace: event มาถึงหลังตั้งค่า ~100ms");
  assert.equal(programmaticScrollPending(5000, 4000), true, "ขอบ 1000ms");
  assert.equal(programmaticScrollPending(5000, 3999), false, "เกินเวลา = event ของผู้ใช้");
  assert.equal(programmaticScrollPending(5000, 6000), false, "เวลาย้อน ไม่นับ");
});

test("N-01 รอบ 2: เบราว์เซอร์ปรับ scrollTop เองตอนเนื้อหาเปลี่ยนขนาด (ตัวโหลด → ข้อความ) → คงอยู่ล่างสุด", () => {
  // trace-r2: event ที่ 2 ไม่มีเครื่องหมาย programmatic · scrollHeight 224 → 4428 · clientHeight คงที่
  assert.equal(stickAfterScroll(true, isAtBottom(TRACE_EVENT), C({ contentResized: true })), true);
  assert.equal(stickAfterScroll(true, isAtBottom(TRACE_EVENT), C()), false, "ถ้าไม่นับ contentResized = บั๊กรอบ 2");
});

test("N-01 รอบ 2: อ่านย้อนหลังอยู่ + เนื้อหาเปลี่ยนขนาด (รูปโหลด / ข้อความใหม่) → ไม่ดึงลง", () => {
  assert.equal(stickAfterScroll(false, false, C({ contentResized: true })), false);
});

// ---- N-02: หมุนจอ/รายการเปลี่ยนขนาดขณะอ่านย้อนหลัง ----
// trace N-02 (390×844 → 844×390 ช่าง · gap 500): width เปลี่ยนก่อน · scrollHeight 5232 → 4428 ขณะ clientHeight ยัง 569
// → เบราว์เซอร์ clamp scrollTop 4163 → 3859 (ก้นรายการ) → event อ่านได้ atBottom = true
const CLAMP_EVENT = { scrollTop: 3859, scrollHeight: 4428, clientHeight: 569 };

test("N-02 U-1: อ่านย้อนหลัง + เนื้อหาเปลี่ยนขนาดจน clamp ถึงก้น → ยังไม่อยู่ล่างสุด", () => {
  assert.equal(isAtBottom(CLAMP_EVENT), true);
  assert.equal(stickAfterScroll(false, isAtBottom(CLAMP_EVENT), C({ contentResized: true })), false);
});

test("N-02 U-2: อ่านย้อนหลัง + รายการเปลี่ยนขนาด (ความสูง/ความกว้าง) แล้วอยู่ก้น → ยังไม่อยู่ล่างสุด", () => {
  assert.equal(stickAfterScroll(false, true, C({ listResized: true })), false);
});

test("N-02 U-3: อ่านย้อนหลัง + ทั้งรายการและเนื้อหาเปลี่ยนขนาด → ยังไม่อยู่ล่างสุด", () => {
  assert.equal(stickAfterScroll(false, true, C({ contentResized: true, listResized: true })), false);
});

test("N-02 U-4: event จากการคืนตำแหน่งอ่าน (layoutRestore) ไม่เปลี่ยนสถานะ แม้ถูก clamp ถึงก้น", () => {
  assert.equal(stickAfterScroll(false, true, { ...C({ programmatic: true }), layoutRestore: true }), false);
  assert.equal(stickAfterScroll(true, false, { ...C({ programmatic: true }), layoutRestore: true }), true);
});

test("N-02 U-5: อยู่ล่างสุด + เนื้อหาเปลี่ยนขนาด → คงอยู่ล่างสุด (N-01 เดิม)", () => {
  assert.equal(stickAfterScroll(true, false, C({ contentResized: true })), true);
  assert.equal(stickAfterScroll(true, false, C({ listResized: true })), true);
});

test("N-02 U-6: ผู้ใช้เลื่อนเองถึงก้น → อยู่ล่างสุด", () => {
  assert.equal(stickAfterScroll(false, true, C()), true);
});

test("N-02 U-7: ผู้ใช้เลื่อนขึ้นจากก้น → หลุดจากล่างสุด", () => {
  assert.equal(stickAfterScroll(true, false, C()), false);
});

const A = { room: "TECH-u-tech", id: "msg-TECH-u-tech-m030", offset: -71 };

test("N-02 U-8: คำนวณ scrollTop ที่คืน anchor ไประยะเดิม", () => {
  // anchor อยู่ต่ำกว่าเดิม 120px → เลื่อนลง 120px
  assert.equal(anchorRestoreTop(A, A.room, 100 + -71 + 120, 100, 3000, 5000), 3120);
  // anchor อยู่สูงกว่าเดิม → เลื่อนขึ้น
  assert.equal(anchorRestoreTop(A, A.room, 100 - 71 - 400, 100, 3000, 5000), 2600);
  // อยู่ที่เดิม → ค่าเดิม
  assert.equal(anchorRestoreTop(A, A.room, 29, 100, 3000, 5000), 3000);
  // คืนได้ไม่เกินช่วงที่ scroll ได้ (clamp) · ไม่ติดลบ
  assert.equal(anchorRestoreTop(A, A.room, 29 + 900, 100, 3900, 4263), 4263);
  assert.equal(anchorRestoreTop(A, A.room, 29 - 5000, 100, 3000, 4263), 0);
});

test("N-02 U-9: ไม่พบ anchor / ไม่มี anchor / ค่าไม่ใช่ตัวเลข → null (ไม่คืนตำแหน่ง ไม่ error)", () => {
  assert.equal(anchorRestoreTop(A, A.room, null, 100, 3000, 5000), null);
  assert.equal(anchorRestoreTop(null, A.room, 200, 100, 3000, 5000), null);
  assert.equal(anchorRestoreTop(A, A.room, Number.NaN, 100, 3000, 5000), null);
  assert.equal(firstVisibleIndex(0, () => 0, 100), -1);
});

test("N-02 U-10: anchor ของห้องอื่น / ไม่มีห้อง → null", () => {
  assert.equal(anchorRestoreTop(A, "CHECK_QUEUE", 200, 100, 3000, 5000), null);
  assert.equal(anchorRestoreTop(A, null, 200, 100, 3000, 5000), null);
});

test("N-02 firstVisibleIndex: ข้อความแรกที่ขอบล่างพ้นขอบบนรายการ", () => {
  const bottoms = [10, 60, 99, 101, 102, 150, 300];
  assert.equal(firstVisibleIndex(bottoms.length, (i) => bottoms[i], 100), 4, "ต้องพ้น listTop + 1");
  assert.equal(firstVisibleIndex(bottoms.length, (i) => bottoms[i], 0), 0);
  assert.equal(firstVisibleIndex(bottoms.length, (i) => bottoms[i], 500), -1);
  let reads = 0;
  const many = Array.from({ length: 1000 }, (_, i) => i * 50 + 40);
  assert.equal(firstVisibleIndex(many.length, (i) => (reads++, many[i]), 20000), 400);
  assert.ok(reads <= 11, `อ่าน rect ${reads} ครั้ง`);
});
