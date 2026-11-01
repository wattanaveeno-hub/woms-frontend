/**
 * FE-01 BUG-CHAT-RESPONSIVE — ความสูงพื้นที่แชทต้องคำนวณจากจอที่มองเห็นเท่านั้น
 * R1-01..R1-04 ในเอกสาร 08_FRONTEND_FIX_ANALYSIS.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_PANE_GUTTER_PX,
  CHAT_COMPOSER_ROW_PX,
  CHAT_HEADER_PX,
  chatPaneFit,
  chatPaneLayout,
  chatPaneBottomOffset,
  chatPaneHeight,
  chatViewport,
  elementsAbove,
  isPinchZoomed,
  SCROLL_RESET_COOLDOWN_MS,
  keyboardLikelyOpen,
  nextStickToBottom,
} from "../src/lib/groupChatRules.ts";

const NAV = 64;
const base = { visualHeight: 844, layoutHeight: 844, techNav: false, techNavHeight: NAV };
const at = (visibleBottom: number, paneTop: number, over: Partial<typeof base> = {}) =>
  chatPaneHeight({ ...base, visibleBottom, paneTop, visualHeight: visibleBottom, ...over });

/** สูตรเดิม (79b9f93 page.tsx:391-400) — ใช้ยืนยันอาการก่อนแก้ */
function legacy(prevHeight: number, vh: number, top: number, shellPb: number, minDoc: number) {
  const scrollHeight = Math.max(minDoc, top + prevHeight + shellPb);
  const tail = Math.max(0, scrollHeight - (top + prevHeight));
  return Math.max(320, Math.floor(vh - top - tail));
}

test("Reproduce (สูตรเดิม): มือถือ 390×844 จากรายการกลุ่ม → เปิดห้อง ความสูงค้างเท่าเดิม เหลือที่ว่างด้านล่าง", () => {
  const listTop = 194; // AppBar 56 + WomsPageHeader (my 24 + h1 + subtitle)
  const roomTop = 56; // มือถือขณะเปิดห้องซ่อน WomsPageHeader
  const inList = legacy(844 - 170, 844, listTop, 56, 844);
  const inRoom = legacy(inList, 844, roomTop, 56, 844);
  assert.equal(inRoom, inList, "สูตรเดิมไม่ขยายเมื่อหัวหน้าถูกซ่อน");
  assert.ok(844 - (roomTop + inRoom) >= 190, `ที่ว่างใต้พื้นที่แชท ${844 - (roomTop + inRoom)}px`);
});

test("Reproduce (สูตรเดิม): คีย์บอร์ดเปิดแล้วปิด ความสูงค้างเท่าตอนคีย์บอร์ดเปิด ไม่ขยายกลับ", () => {
  const top = 56;
  const h0 = legacy(674, 844, top, 56, 844);
  const kb = legacy(h0, 500, top, 56, 844);
  const after = legacy(kb, 844, top, 56, 844);
  assert.ok(kb < h0);
  assert.equal(after, kb, `ก่อน ${h0} · คีย์บอร์ด ${kb} · หลังปิด ${after}`);
  assert.ok(844 - (top + after) > 400, "ที่ว่างใต้พื้นที่แชทเกินครึ่งจอ");
});

test("R1-01 ไม่ขึ้นกับค่าเดิม: input เดียวกันได้ค่าเดียวกันเสมอ (เรียกซ้ำไม่สะสม)", () => {
  const a = at(844, 56);
  for (let i = 0; i < 5; i++) assert.equal(at(844, 56), a);
  assert.equal(a, 844 - 56 - CHAT_PANE_GUTTER_PX);
});

test("R1-02 รายการกลุ่ม → เปิดห้อง (หัวหน้าถูกซ่อน): สูงขึ้นเท่ากับที่ paneTop ลดลง", () => {
  const list = at(844, 194);
  const room = at(844, 56);
  assert.equal(room - list, 194 - 56);
  assert.equal(844 - (56 + room), CHAT_PANE_GUTTER_PX, "ที่ว่างล่างเหลือแค่ gutter");
});

test("R1-03 คีย์บอร์ดเปิด 844→500 แล้วปิด: ตอนเปิดช่องพิมพ์อยู่เหนือคีย์บอร์ด · ปิดแล้วกลับเท่าเดิม", () => {
  const before = at(844, 56);
  const open = at(500, 56, { layoutHeight: 844 });
  assert.equal(keyboardLikelyOpen(500, 844), true);
  assert.equal(open, 500 - 56 - CHAT_PANE_GUTTER_PX);
  assert.ok(56 + open <= 500, "ขอบล่างพื้นที่แชทไม่เกินขอบบนคีย์บอร์ด");
  assert.equal(at(844, 56), before);
});

test("R1-03 / D-02 คีย์บอร์ดเปิดบนจอเตี้ย (landscape): พอดีส่วนที่มองเห็นเสมอ แม้ต่ำกว่า 120px", () => {
  assert.equal(at(300, 56, { layoutHeight: 844 }), 300 - 56 - CHAT_PANE_GUTTER_PX);
  assert.equal(at(150, 56, { layoutHeight: 390 }), 150 - 56 - CHAT_PANE_GUTTER_PX, "86px — ไม่ดันขึ้นเป็น 120");
});

test("R1-03 iOS เลื่อน visual viewport (pageTop > 0) ตอนคีย์บอร์ดเปิด: ใช้ขอบล่างที่มองเห็นจริง", () => {
  // visualViewport.pageTop 120 + height 420 → ขอบล่างที่มองเห็น = 540
  const h = chatPaneHeight({ ...base, visibleBottom: 540, paneTop: 56, visualHeight: 420, layoutHeight: 844 });
  assert.equal(56 + h + CHAT_PANE_GUTTER_PX, 540);
});

test("R1-04 ช่าง (แถบเมนูล่าง): เว้นแค่ 64 + gutter · คีย์บอร์ดเปิดไม่เว้นแถบล่าง (ถูกคีย์บอร์ดทับ)", () => {
  assert.equal(at(844, 56, { techNav: true }), 844 - 56 - NAV - CHAT_PANE_GUTTER_PX);
  assert.equal(at(500, 56, { techNav: true, layoutHeight: 844 }), 500 - 56 - CHAT_PANE_GUTTER_PX);
  // Android resizes-content: layout viewport หดตาม → ไม่ถือว่าคีย์บอร์ดเปิด → แถบล่างยังอยู่เหนือคีย์บอร์ด ต้องเว้น
  assert.equal(at(500, 56, { techNav: true, layoutHeight: 500 }), 500 - 56 - NAV - CHAT_PANE_GUTTER_PX);
});

test("R1-07 ย่อแล้วขยายหน้าต่าง / หมุนจอ: กลับเป็นค่าตามจอปัจจุบันทุกครั้ง", () => {
  const seq = [
    [768, 182],
    [600, 182],
    [1080, 182],
    [768, 182],
  ];
  const got = seq.map(([vh, top]) => at(vh, top, { layoutHeight: vh }));
  assert.deepEqual(got, [768 - 182 - 8, 600 - 182 - 8, 1080 - 182 - 8, 768 - 182 - 8]);
  // portrait 1024 (Tablet ใช้ layout มือถือ) ↔ landscape 768 (2 คอลัมน์)
  assert.equal(at(1024, 56, { layoutHeight: 1024 }), 1024 - 56 - 8);
  assert.equal(at(768, 182, { layoutHeight: 768 }), 768 - 182 - 8);
  assert.equal(at(1024, 56, { layoutHeight: 1024 }), 1024 - 56 - 8);
});

test("จอเตี้ย (มือถือแนวนอน): พอดีจอ ช่องพิมพ์ไม่ถูกดันออกนอกจอ/ใต้แถบเมนูล่าง (เดิมบังคับ 320 / 120)", () => {
  assert.equal(keyboardLikelyOpen(800, 844), false);
  assert.equal(at(360, 56, { layoutHeight: 360 }), 360 - 56 - CHAT_PANE_GUTTER_PX);
  const tech = at(390, 57, { techNav: true, layoutHeight: 390 });
  assert.equal(57 + tech + CHAT_PANE_GUTTER_PX, 390 - NAV, "ขอบล่างพื้นที่แชท + gutter = ขอบบนแถบเมนูล่าง");
  assert.equal(at(100, 56, { layoutHeight: 100 }), 100 - 56 - CHAT_PANE_GUTTER_PX);
  assert.equal(at(50, 56, { layoutHeight: 50 }), 0, "ไม่ติดลบ");
});

test("chatPaneBottomOffset: รวม padding/border ล่างของทุกชั้น (.shell 56 + main ของช่าง 80) · ค่าว่าง/ไม่ใช่ตัวเลข = 0", () => {
  assert.equal(
    chatPaneBottomOffset([
      { paddingBottom: "56px", borderBottomWidth: "0px" },
      { paddingBottom: "80px", borderBottomWidth: "0px" },
      { paddingBottom: "", borderBottomWidth: "1px" },
    ]),
    137
  );
  assert.equal(chatPaneBottomOffset([]), 0);
});

test("R1-07 หมุนจอ: scroll event จากการเปลี่ยนขนาดไม่ทำให้หลุดจากล่างสุด · การเลื่อนของผู้ใช้ยังยกเลิกได้", () => {
  // หลักฐานจาก Chromium 390×844 → 844×390: scroll event อ่านค่าหลังรายการเตี้ยลง (gap 431px)
  assert.equal(nextStickToBottom(true, false, true), true, "เปลี่ยนขนาด + เดิมอยู่ล่างสุด → คงไว้");
  assert.equal(nextStickToBottom(true, false, false), false, "ผู้ใช้เลื่อนขึ้น → ไม่ตามล่างสุด");
  assert.equal(nextStickToBottom(false, false, true), false, "เดิมไม่ได้อยู่ล่างสุด → ไม่ดึงลง");
  assert.equal(nextStickToBottom(false, true, false), true);
});

test("D-01 Pinch-zoom (scale > 1) ไม่ถือเป็นคีย์บอร์ด: ใช้ layout viewport · พื้นที่แชทไม่หดตามการซูม", () => {
  // 390×844 ซูม 2 เท่า: visualViewport.height = 422 · pageTop = ตำแหน่งที่เลื่อนดู
  const zoomed = chatViewport({ vv: { height: 422, pageTop: 300, scale: 2 }, innerHeight: 844, scrollY: 0 });
  assert.deepEqual(zoomed, { visibleBottom: 844, visualHeight: 844, zoomed: true, resetScroll: false });
  const h = chatPaneHeight({ visibleBottom: zoomed.visibleBottom, paneTop: 56, visualHeight: zoomed.visualHeight, layoutHeight: 844, techNav: false, techNavHeight: NAV });
  assert.equal(h, 844 - 56 - CHAT_PANE_GUTTER_PX, "เท่ากับตอนไม่ซูม");
  assert.equal(keyboardLikelyOpen(zoomed.visualHeight, 844), false);
  // เลื่อนดูขณะซูม (pageTop เปลี่ยน) → ค่าเท่าเดิม
  assert.deepEqual(chatViewport({ vv: { height: 422, pageTop: 10, scale: 2 }, innerHeight: 844, scrollY: 0 }), zoomed);
});

test("D-01 ไม่ซูม (scale = 1) + คีย์บอร์ดเปิด: ยังใช้ visualViewport ตามเดิม · ไม่มี visualViewport = innerHeight", () => {
  assert.deepEqual(chatViewport({ vv: { height: 500, pageTop: 0, scale: 1 }, innerHeight: 844, scrollY: 0 }), { visibleBottom: 500, visualHeight: 500, zoomed: false, resetScroll: false });
  assert.deepEqual(chatViewport({ vv: null, innerHeight: 700, scrollY: 0 }), { visibleBottom: 700, visualHeight: 700, zoomed: false, resetScroll: false });
  assert.equal(isPinchZoomed(1), false);
  assert.equal(isPinchZoomed(1.005), false, "ปัดเศษของเบราว์เซอร์");
  assert.equal(isPinchZoomed(1.5), true);
  assert.equal(isPinchZoomed(undefined), false);
  assert.equal(isPinchZoomed(Number.NaN), false);
});

test("D-03 iOS เลื่อนหน้าเองตอนคีย์บอร์ดเปิด (offsetTop/pageTop > 0): คืนตำแหน่งบนสุด · คำนวณจากขอบบน → หัวห้องอยู่ในจอ", () => {
  // คีย์บอร์ดเปิด: visual 420 · iOS pan 300 → เดิมขอบล่าง = 720 (หัวห้องหลุดจอ)
  const v = chatViewport({ vv: { height: 420, pageTop: 300, scale: 1 }, innerHeight: 844, scrollY: 0 });
  assert.equal(v.resetScroll, true);
  assert.equal(v.visibleBottom, 420, "หลังคืนตำแหน่ง ขอบล่าง = ความสูงที่มองเห็น");
  const h = chatPaneHeight({ visibleBottom: v.visibleBottom, paneTop: 56, visualHeight: v.visualHeight, layoutHeight: 844, techNav: false, techNavHeight: NAV });
  assert.equal(56 + h + CHAT_PANE_GUTTER_PX, 420);
});

test("D-03 หลังปิดคีย์บอร์ด iOS ค้าง scrollY > 0: คืนตำแหน่ง · cooldown: ไม่คืนซ้ำ ใช้ตำแหน่งจริงแทน (ไม่แย่งกับเบราว์เซอร์)", () => {
  const after = chatViewport({ vv: { height: 844, pageTop: 120, scale: 1 }, innerHeight: 844, scrollY: 120 });
  assert.equal(after.resetScroll, true);
  assert.equal(after.visibleBottom, 844);
  const cooling = chatViewport({ vv: { height: 844, pageTop: 120, scale: 1 }, innerHeight: 844, scrollY: 120 }, false);
  assert.equal(cooling.resetScroll, false);
  assert.equal(cooling.visibleBottom, 964, "ใช้พิกัดจริง (pageTop + height)");
  assert.ok(SCROLL_RESET_COOLDOWN_MS >= 300);
});

test("D-03 ไม่กระทบการเลื่อนของผู้ใช้: ขณะซูม (ผู้ใช้เลื่อนดู) ไม่คืนตำแหน่ง · อยู่บนสุดแล้วไม่เรียกซ้ำ", () => {
  assert.equal(chatViewport({ vv: { height: 422, pageTop: 300, scale: 2 }, innerHeight: 844, scrollY: 300 }).resetScroll, false);
  assert.equal(chatViewport({ vv: { height: 844, pageTop: 0, scale: 1 }, innerHeight: 844, scrollY: 0 }).resetScroll, false);
  assert.equal(chatViewport({ vv: { height: 844, pageTop: 0.4, scale: 1 }, innerHeight: 844, scrollY: 0 }).resetScroll, false, "เศษ subpixel");
});

test("D-02 พื้นที่แชทไม่สูงเกินส่วนที่มองเห็น: ทุกค่า visibleBottom/paneTop → ขอบล่าง ≤ ขอบที่มองเห็น", () => {
  for (const vb of [40, 86, 119, 120, 150, 200, 320, 500, 844]) {
    for (const techNav of [false, true]) {
      const h = at(vb, 56, { techNav, layoutHeight: vb < 400 ? 844 : vb });
      const limit = techNav && vb >= 400 ? vb - NAV : vb;
      assert.ok(56 + h <= Math.max(56, limit), `visibleBottom ${vb} techNav ${techNav}: bottom ${56 + h} > ${limit}`);
    }
  }
});

test("D-02 chatPaneLayout: หัวห้อง full ≥ 320 · compact ≥ 160 · ซ่อน < 160", () => {
  assert.equal(chatPaneLayout(779).header, "full");
  assert.equal(chatPaneLayout(320).header, "full");
  assert.equal(chatPaneLayout(319).header, "compact");
  assert.equal(chatPaneLayout(160).header, "compact");
  assert.equal(chatPaneLayout(159).header, "hidden");
  assert.equal(chatPaneLayout(86).header, "hidden");
  assert.equal(chatPaneLayout(0).header, "hidden");
});

test("D-02 chatPaneLayout: แถวพิมพ์ + ปุ่มส่งได้พื้นที่ก่อน · หัวห้อง + ช่องพิมพ์ไม่เกินพื้นที่แชท (เมื่อ ≥ แถวพิมพ์)", () => {
  for (let h = CHAT_COMPOSER_ROW_PX; h <= 1200; h += 7) {
    const l = chatPaneLayout(h);
    assert.ok(l.composerMaxPx >= CHAT_COMPOSER_ROW_PX, `h ${h}`);
    assert.ok(CHAT_HEADER_PX[l.header] + l.composerMaxPx <= h, `h ${h}: header ${CHAT_HEADER_PX[l.header]} + composer ${l.composerMaxPx}`);
    assert.ok(l.extrasMaxPx >= 0 && l.mentionMaxPx <= l.extrasMaxPx && l.mentionMaxPx <= 200);
    assert.ok(l.inputMaxRows >= 1 && l.inputMaxRows <= 5);
    assert.ok(CHAT_COMPOSER_ROW_PX + (l.inputMaxRows - 1) * 23 + l.extrasMaxPx <= l.composerMaxPx, `h ${h}: ช่องพิมพ์ขยายเต็มที่ยังไม่เกินกรอบ`);
  }
});

test("D-02 chatPaneLayout: จอปกติคงพฤติกรรมเดิม (5 บรรทัด · รายการแท็ก 200px · แถบตอบกลับ 2 บรรทัด)", () => {
  const l = chatPaneLayout(779);
  assert.deepEqual({ rows: l.inputMaxRows, mention: l.mentionMaxPx, compact: l.compactReply }, { rows: 5, mention: 200, compact: false });
  const kb = chatPaneLayout(86); // iPhone แนวนอน + คีย์บอร์ด
  assert.deepEqual({ header: kb.header, rows: kb.inputMaxRows, composer: kb.composerMaxPx, extras: kb.extrasMaxPx }, { header: "hidden", rows: 1, composer: CHAT_COMPOSER_ROW_PX, extras: 0 });
  const mid = chatPaneLayout(250);
  assert.equal(mid.header, "compact");
  assert.ok(mid.inputMaxRows < 5 && mid.mentionMaxPx < 200 && mid.compactReply);
});

test("D-04 elementsAbove: AppBar + หัวหน้า (พี่น้องก่อนหน้าทุกชั้น) · ไม่รวมพื้นที่แชท/ชั้นที่ครอบ/ส่วนที่อยู่ใต้", () => {
  type N = { name: string; parentElement: N | null; previousElementSibling: N | null };
  const mk = (name: string, parent: N | null, prev: N | null = null): N => ({ name, parentElement: parent, previousElementSibling: prev });
  const body = mk("body", null);
  const appShell = mk("app-shell", body);
  const nav = mk("nav", appShell);
  const main = mk("main", appShell, nav);
  const appBar = mk("appbar", main);
  const shell = mk("shell", main, appBar);
  const pageHeader = mk("page-header", shell);
  const pane = mk("chat-pane", shell, pageHeader);
  const names = elementsAbove(pane, body).map((n) => n.name);
  assert.deepEqual(names, ["page-header", "appbar", "nav"]);
  assert.ok(!names.includes("chat-pane") && !names.includes("shell") && !names.includes("main"));
  // มือถือขณะเปิดห้อง: ไม่มีหัวหน้า
  const pane2 = mk("chat-pane", shell);
  assert.deepEqual(elementsAbove(pane2, body).map((n) => n.name), ["appbar", "nav"]);
});

test("D-02 chatPaneFit: พื้นที่ต่ำกว่าแถวพิมพ์ → เลื่อนพื้นที่แชทขึ้นทับส่วนบนเท่าที่จำเป็น · ปุ่มส่งอยู่ในจอ", () => {
  const fit = (visibleBottom: number, paneTop: number, over: Record<string, unknown> = {}) =>
    chatPaneFit({ visibleTop: 0, visibleBottom, paneTop, visualHeight: visibleBottom, layoutHeight: 844, techNav: false, techNavHeight: NAV, ...over });
  // มือถือ: เหลือ 100px · AppBar 56 → available 36 < 56 → เลื่อนขึ้น 20
  assert.deepEqual(fit(100, 56), { height: CHAT_COMPOSER_ROW_PX, pullUp: CHAT_COMPOSER_ROW_PX - 36 });
  // desktop จอเตี้ยมาก: paneTop 160 > ส่วนที่มองเห็น 100 → เลื่อนขึ้นจนแถวพิมพ์พอดี
  const d = fit(100, 160);
  assert.equal(d.height, CHAT_COMPOSER_ROW_PX);
  assert.equal(160 - d.pullUp + d.height + CHAT_PANE_GUTTER_PX, 100, "ขอบล่าง + gutter = ขอบล่างที่มองเห็น");
  // พื้นที่พอ → ไม่เลื่อน (เท่า chatPaneHeight)
  assert.deepEqual(fit(844, 56), { height: 844 - 56 - CHAT_PANE_GUTTER_PX, pullUp: 0 });
  // ไม่เลื่อนเกินขอบบนของส่วนที่มองเห็น (เหลือน้อยกว่าแถวพิมพ์เอง)
  const tiny = fit(40, 56);
  assert.equal(56 - tiny.pullUp >= 0, true);
  assert.equal(tiny.pullUp, 56);
  // iOS pan: visibleTop 300 · ขอบล่าง 400 · paneTop 56 → ไม่ต้องเลื่อน (available 336)
  assert.equal(chatPaneFit({ visibleTop: 300, visibleBottom: 400, paneTop: 56, visualHeight: 100, layoutHeight: 844, techNav: false, techNavHeight: NAV }).pullUp, 0);
  // ช่าง + แถบล่าง (คีย์บอร์ดปิด) จอเตี้ย
  const t = fit(150, 56, { techNav: true, layoutHeight: 150 });
  assert.equal(56 - t.pullUp + t.height, 150 - NAV - CHAT_PANE_GUTTER_PX);
});

test("D-02 chatPaneFit: ทุกขนาด ขอบล่างพื้นที่แชทไม่เกินส่วนที่มองเห็น · ขอบบนไม่สูงกว่าส่วนที่มองเห็น", () => {
  for (let vb = 30; vb <= 900; vb += 10) {
    for (const top of [56, 120, 160, 200]) {
      const f = chatPaneFit({ visibleTop: 0, visibleBottom: vb, paneTop: top, visualHeight: vb, layoutHeight: 844, techNav: false, techNavHeight: NAV });
      assert.ok(top - f.pullUp >= 0, `vb ${vb} top ${top}`);
      assert.ok(top - f.pullUp + f.height + CHAT_PANE_GUTTER_PX <= vb || f.height === 0, `vb ${vb} top ${top}: ${JSON.stringify(f)}`);
      if (vb >= CHAT_COMPOSER_ROW_PX + CHAT_PANE_GUTTER_PX) assert.ok(f.height >= CHAT_COMPOSER_ROW_PX, `vb ${vb} top ${top}: แถวพิมพ์ต้องพอ`);
    }
  }
});
