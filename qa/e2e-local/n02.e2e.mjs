// N-02 Group Chat — หมุนจอขณะอ่านย้อนหลัง · Regression บน localhost (mock API) · ห้ามชี้ไป UAT
//
// ใช้:  FE_URL=http://localhost:3001 LABEL=after node qa/e2e-local/n02.e2e.mjs [out.json]
//   REPS (ค่าเริ่มต้น 3) = จำนวนรอบต่อจุดทดสอบ
// หมุนจอ = สลับขนาด viewport (Chromium mobile emulation) — ไม่แทนอุปกรณ์จริง (iOS Safari / Android Chrome)
// เกณฑ์ (doc 16 / คำสั่ง 1 พ.ย.):
//   AC-1 อ่านย้อนหลังแล้วหมุน → ยังไม่ "อยู่ล่างสุด" (ข้อความใหม่ไม่ดึงลง + มีตัวบอกข้อความใหม่)
//   AC-2 ข้อความที่อ่านอยู่ยังเห็น · คลาด ≤ 24px เมื่อคืนตำแหน่งได้ (ไม่ได้ = รายการ clamp ที่ก้น)
//   AC-3 หมุนกลับ → ข้อความเดิม คลาด ≤ 24px
//   AC-4 อยู่ล่างสุดแล้วหมุน → ยังอยู่ล่างสุด · AC-5 ข้อความใหม่ไม่ดึงลงขณะอ่าน · AC-6 กดตัวบอก → ล่างสุดและตามต่อ
//   AC-8 deep link / สลับห้อง A→B→A ไม่ regression
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { API_BASE, installMockApi, newMockMessage } from "./mockApi.mjs";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("@playwright/test"));
}

const FE_URL = (process.env.FE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const LABEL = process.env.LABEL ?? "run";
const OUT = process.argv[2];
const WEB_ORIGIN = new URL(FE_URL).origin;
const API_ORIGIN = new URL(API_BASE).origin;
if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(FE_URL).hostname)) {
  console.error(`FE_URL ต้องเป็น localhost เท่านั้น (ได้ ${FE_URL})`);
  process.exit(2);
}
const REPS = +(process.env.REPS ?? 3);
const STICK = 80;
const TOL = 24;
const POLL_WAIT = 6500; // POLL_MS ของหน้าแชท = 5000
const P = [390, 844];
const L = [844, 390];
const ROOM = { manager: { key: "CHECK_QUEUE", name: "กลุ่มเช็คคิว" }, tech: { key: "TECH-u-tech", name: "กลุ่มงานช่าง ช่างทดสอบ" } };
const OTHER = { key: "TECH-u-tech", name: "กลุ่มงานช่าง ช่างทดสอบ" }; // ห้อง B ของ manager

const results = [];
const observations = [];
// status: PASS · LIMITATION (ผ่านเกณฑ์ แต่เป็นข้อจำกัดที่บันทึกไว้ — ไม่นับเป็น FAIL) · FAIL
const record = (id, status, detail) => {
  results.push({ id, ok: status !== "FAIL", status, detail });
  console.log(`${status === "LIMITATION" ? "LIMIT" : status}  ${id}  ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)}`);
};
const check = (id, ok, detail) => record(id, ok ? "PASS" : "FAIL", detail);
const net = { origins: new Map(), failed: new Set() };

async function open(browser, role, vp, { images = null, url = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, isMobile: true, hasTouch: true, locale: "th-TH" });
  ctx.on("request", (r) => {
    const o = new URL(r.url()).origin;
    net.origins.set(o, (net.origins.get(o) ?? 0) + 1);
  });
  ctx.on("requestfailed", (r) => net.failed.add(new URL(r.url()).origin));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  const ctl = { pending: [] };
  await installMockApi(page, role, { webOrigin: WEB_ORIGIN, ctl });
  if (images) await imageRoutes(page, ROOM[role].key, images);
  await page.goto(url ?? `${FE_URL}/group-chat?g=${ROOM[role].key}`);
  await ready(page);
  return { ctx, page, errors, ctl };
}

// N-02: ห้องที่มีรูป (ข้อความลำดับ images.seqs) — รูปตอบช้า images.delayMs (เนื้อหาเปลี่ยนความสูงหลังหมุนจอ)
async function imageRoutes(page, key, { seqs, delayMs }) {
  const svg = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="180"><rect width="220" height="180" fill="#9ab"/></svg>').toString("base64");
  const hdr = { "access-control-allow-origin": WEB_ORIGIN, "access-control-allow-headers": "authorization, content-type", "content-type": "application/json" };
  await page.route(`${API_ORIGIN}/api/group-chat/groups/${key}/messages*`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fallback();
    const u = new URL(req.url());
    if (u.searchParams.has("afterSeq") || u.searchParams.has("since") || u.searchParams.has("before")) return route.fallback();
    const msgs = Array.from({ length: 40 }, (_, j) => {
      const m = newMockMessage(key, j + 1);
      if (seqs.includes(j + 1)) m.attachments = [{ fileId: `img${j + 1}`, name: `img${j + 1}.png`, mime: "image/png", size: 300 }];
      return m;
    });
    return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify({ messages: msgs, cards: {}, cursor: { before: null, afterSeq: 40, changedSince: msgs[39].createdAt } }) });
  });
  await page.route(`${API_ORIGIN}/api/group-chat/files/*`, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    await new Promise((r) => setTimeout(r, delayMs));
    const id = route.request().url().split("/").pop();
    return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify({ name: id, mime: "image/png", size: 300, dataUrl: svg }) });
  });
}

async function ready(page) {
  await page.waitForSelector('[data-testid="chat-messages"] [id^="msg-"]', { timeout: 20_000 });
  await page.waitForTimeout(800);
}

// ตำแหน่งอ่าน: ข้อความที่ผู้ใช้อ่าน (first) + ระยะจากขอบบน · anchorId = ข้อความที่ติดตาม
const state = (page, anchorId = null) =>
  page.evaluate((anchorId) => {
    const el = document.querySelector('[data-testid="chat-scroll"]');
    if (!el) return null;
    const lr = el.getBoundingClientRect();
    const msgs = [...document.querySelectorAll('[data-testid="chat-messages"] [id^="msg-"]')];
    // ข้อความที่ผู้ใช้กำลังอ่าน = ข้อความแรกที่เริ่มในจอ (ขอบบนไม่ถูกตัด) · ไม่มี = ข้อความแรกที่เห็นบางส่วน
    const first =
      msgs.find((m) => m.getBoundingClientRect().top >= lr.top - 1 && m.getBoundingClientRect().top < lr.bottom) ??
      msgs.find((m) => m.getBoundingClientRect().bottom > lr.top + 1);
    const a = anchorId ? document.getElementById(anchorId) : null;
    const ar = a?.getBoundingClientRect();
    return {
      top: Math.round(el.scrollTop),
      sh: el.scrollHeight,
      ch: el.clientHeight,
      gap: Math.round(el.scrollHeight - el.scrollTop - el.clientHeight),
      firstId: first?.id ?? null,
      firstOff: first ? Math.round(first.getBoundingClientRect().top - lr.top) : null,
      anchorOff: ar ? Math.round(ar.top - lr.top) : null,
      anchorVisible: ar ? ar.bottom > lr.top && ar.top < lr.bottom : null,
      indicator: !!document.querySelector('[data-testid="new-message-indicator"]'),
      last: msgs.length ? msgs[msgs.length - 1].id : null,
    };
  }, anchorId);

// เลื่อนแบบผู้ใช้ (หน้าเว็บไม่ได้ทำเครื่องหมาย) ไปที่ระยะ gap จากก้นรายการ
async function readAtGap(page, gap) {
  await page.evaluate((gap) => {
    const el = document.querySelector('[data-testid="chat-scroll"]');
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight - gap);
  }, gap);
  await page.waitForTimeout(500);
}
async function touchUp(page) {
  const box = await page.locator('[data-testid="chat-scroll"]').boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x = Math.round(box.x + box.width / 2);
  const y0 = Math.round(box.y + box.height * 0.2);
  const y1 = Math.round(box.y + box.height * 0.9);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let y = y0; y <= y1; y += 20) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(700);
}
async function rotate(page, vp) {
  await page.setViewportSize({ width: vp[0], height: vp[1] });
  await page.waitForTimeout(900);
}
let seq = 100;
async function newMessage(page, ctl, role, anchorId = null) {
  ctl.pending.push(newMockMessage(ROOM[role].key, ++seq));
  await page.waitForTimeout(POLL_WAIT);
  return state(page, anchorId);
}
// AC-2: คืนตำแหน่งได้ → คลาด ≤ TOL · คืนไม่ได้ (clamp ที่ก้น) → ยอมรับเมื่ออยู่ก้นรายการ
const restored = (before, after) =>
  after.anchorOff !== null && (Math.abs(after.anchorOff - before.firstOff) <= TOL || (after.gap <= 1 && after.anchorOff > before.firstOff));
// AC-1/AC-5: ยังไม่ "อยู่ล่างสุด" = มีตัวบอกข้อความใหม่ · และไม่ถูกเลื่อนตาม (gap > STICK)
//   ยกเว้นกรณีรายการถูก clamp ที่ก้นอยู่แล้วก่อนข้อความใหม่ (คืนตำแหน่งไม่ได้): Chromium scroll anchoring คงก้นรายการเอง
//   → ตรวจสถานะจากตัวบอกข้อความใหม่ และบันทึก clamped: true ไว้ในรายละเอียด (รายงานแยก)
//   L-2 (Final QA): กรณี clamp ต้องยืนยันว่า "ข้อความที่อ่านยังมองเห็น" ด้วย ไม่ใช่ดูแค่ตัวบอก
//   PASS = ตัวบอกขึ้น + ไม่ถูกเลื่อนตาม · LIMITATION = clamp + ตัวบอกขึ้น + ข้อความที่อ่านยังเห็น (Chromium anchoring เลื่อนตาม)
//   FAIL = ไม่มีตัวบอก · หรือถูกเลื่อนตามโดยไม่ได้ clamp · หรือ clamp แล้วข้อความที่อ่านหลุดจอ
function followCheck(id, prev, after) {
  const detail = { gap: after.gap, indicator: after.indicator, clamped: prev.gap <= 1, anchorOff: after.anchorOff, anchorVisible: after.anchorVisible };
  if (!after.indicator) return record(id, "FAIL", detail);
  if (after.gap > STICK) return record(id, "PASS", detail);
  if (prev.gap <= 1 && after.anchorVisible) return record(`${id} [L-2 clamp]`, "LIMITATION", detail);
  return record(id, "FAIL", detail);
}

// ---- 1, 3, 4: P→L (→ ข้อความใหม่) → P ที่หลายระยะ ----
async function portraitLandscape(browser, role) {
  for (const gap of [150, 300, 500, 800, 1200, 2000]) {
    for (let r = 0; r < REPS; r++) {
      const tag = `N02 ${role} P→L→P gap ${gap} #${r + 1}`;
      const { ctx, page, ctl, errors } = await open(browser, role, P);
      try {
        await readAtGap(page, gap);
        const a = await state(page);
        await rotate(page, L);
        const b = await state(page, a.firstId);
        check(`${tag} AC-2 แนวนอน ข้อความเดิมยังเห็น`, b.anchorVisible && restored(a, b), { before: a.firstOff, after: b.anchorOff, gap: b.gap });
        const b2 = await newMessage(page, ctl, role, a.firstId);
        followCheck(`${tag} AC-1/AC-5 ข้อความใหม่ไม่ดึงลง + ตัวบอก`, b, b2);
        await rotate(page, P);
        const c = await state(page, a.firstId);
        check(`${tag} AC-3 กลับแนวตั้ง ข้อความเดิม (≤${TOL}px)`, c.anchorVisible && Math.abs(c.anchorOff - a.firstOff) <= TOL, { before: a.firstOff, back: c.anchorOff });
        check(`${tag} ไม่มี page error`, errors.length === 0, errors);
      } finally {
        await ctx.close();
      }
    }
  }
}

// ---- 2: L→P ----
async function landscapePortrait(browser, role) {
  for (const gap of [150, 300, 600, 1200]) {
    for (let r = 0; r < REPS; r++) {
      const tag = `N02 ${role} L→P gap ${gap} #${r + 1}`;
      const { ctx, page, ctl, errors } = await open(browser, role, L);
      try {
        await readAtGap(page, gap);
        const a = await state(page);
        await rotate(page, P);
        const b = await state(page, a.firstId);
        check(`${tag} AC-2 ข้อความเดิม (≤${TOL}px หรือ clamp ที่ก้น)`, b.anchorVisible && restored(a, b), { before: a.firstOff, after: b.anchorOff, gap: b.gap, clamped: b.gap <= 1 });
        const b2 = await newMessage(page, ctl, role, a.firstId);
        followCheck(`${tag} AC-1 ข้อความใหม่ไม่ดึงลง`, b, b2);
        check(`${tag} ไม่มี page error`, errors.length === 0, errors);
      } finally {
        await ctx.close();
      }
    }
  }
}

// ---- 4: ข้อความใหม่ขณะอ่านย้อนหลัง (ไม่หมุน) ----
async function newWhileReading(browser, role) {
  for (let r = 0; r < REPS; r++) {
    const tag = `N02 ${role} อ่านย้อนหลัง + ข้อความใหม่ #${r + 1}`;
    const { ctx, page, ctl } = await open(browser, role, P);
    try {
      await readAtGap(page, 500);
      const a = await state(page);
      const b = await newMessage(page, ctl, role);
      const c = await state(page, a.firstId);
      check(`${tag} AC-5`, b.indicator && b.gap > STICK && Math.abs(c.anchorOff - a.firstOff) <= TOL, { gap: b.gap, before: a.firstOff, after: c.anchorOff });
    } finally {
      await ctx.close();
    }
  }
}

// ---- 5: เลื่อนด้วยนิ้ว (CDP touch) แล้วหมุน ----
async function touchThenRotate(browser, role) {
  for (let r = 0; r < REPS; r++) {
    const tag = `N02 ${role} touch → P→L→P #${r + 1}`;
    const { ctx, page, ctl } = await open(browser, role, P);
    try {
      await touchUp(page);
      const a = await state(page);
      await rotate(page, L);
      const b = await state(page, a.firstId);
      check(`${tag} AC-2`, b.anchorVisible && restored(a, b), { touchGap: a.gap, before: a.firstOff, after: b.anchorOff, gap: b.gap });
      const b2 = await newMessage(page, ctl, role, a.firstId);
      followCheck(`${tag} AC-1`, b, b2);
      await rotate(page, P);
      const c = await state(page, a.firstId);
      check(`${tag} AC-3`, c.anchorVisible && Math.abs(c.anchorOff - a.firstOff) <= TOL, { before: a.firstOff, back: c.anchorOff });
    } finally {
      await ctx.close();
    }
  }
}

// ---- 6: อยู่ล่างสุดแล้วหมุน ----
async function bottomRotate(browser, role) {
  for (let r = 0; r < REPS; r++) {
    const tag = `N02 ${role} ล่างสุด → หมุน #${r + 1}`;
    const { ctx, page, ctl } = await open(browser, role, P);
    try {
      const a = await state(page);
      await rotate(page, L);
      const b = await state(page);
      await rotate(page, P);
      const c = await state(page);
      const d = await newMessage(page, ctl, role);
      check(`${tag} AC-4`, a.gap <= STICK && b.gap <= STICK && c.gap <= STICK, { start: a.gap, landscape: b.gap, back: c.gap });
      check(`${tag} AC-4 ข้อความใหม่ตามลง`, d.gap <= STICK && !d.indicator, { gap: d.gap, indicator: d.indicator });
    } finally {
      await ctx.close();
    }
  }
}

// ---- 7: กดตัวบอกข้อความใหม่ ----
async function indicatorClick(browser, role) {
  for (let r = 0; r < REPS; r++) {
    const tag = `N02 ${role} หมุนแล้วกดตัวบอกข้อความใหม่ #${r + 1}`;
    const { ctx, page, ctl } = await open(browser, role, P);
    try {
      await readAtGap(page, 500);
      await rotate(page, L);
      const a = await newMessage(page, ctl, role);
      if (!a.indicator) {
        check(`${tag} AC-6`, false, { reason: "ไม่มีตัวบอกข้อความใหม่ (ถูกดึงลงแล้ว)", gap: a.gap });
        continue;
      }
      await page.locator('[data-testid="new-message-indicator"]').click();
      await page.waitForTimeout(700);
      const b = await state(page);
      const c = await newMessage(page, ctl, role, b.firstId);
      check(`${tag} AC-6`, a.indicator && b.gap <= STICK && c.gap <= STICK && !c.indicator, { before: a.gap, afterClick: b.gap, next: c.gap });
    } finally {
      await ctx.close();
    }
  }
}

// ---- 8: deep link ----
async function deepLink(browser, role) {
  for (let r = 0; r < REPS * 2; r++) {
    const tag = `N02 ${role} deep link ?g= #${r + 1}`;
    const { ctx, page } = await open(browser, role, r % 2 ? L : P);
    try {
      const a = await state(page);
      check(`${tag} AC-8 อยู่ข้อความล่าสุด`, a.gap <= STICK && a.last?.endsWith("m040"), { gap: a.gap, last: a.last });
    } finally {
      await ctx.close();
    }
  }
}

// ---- 9: สลับห้อง A → B → A (manager) ----
async function switchTo(page, room) {
  await page.getByRole("button", { name: "กลับไปรายการกลุ่ม" }).click();
  await page.waitForTimeout(300);
  await page.getByText(room.name, { exact: true }).first().click();
  await page.waitForFunction((k) => {
    const ids = [...document.querySelectorAll('[data-testid="chat-messages"] [id^="msg-"]')];
    return ids.length > 0 && ids[ids.length - 1].id.includes(k);
  }, room.key, { timeout: 20_000 });
  await page.waitForTimeout(800);
}
async function roomSwitch(browser) {
  for (let r = 0; r < REPS; r++) {
    const tag = `N02 manager A→B→A #${r + 1}`;
    const { ctx, page, errors } = await open(browser, "manager", P);
    try {
      await readAtGap(page, 500); // อ่านย้อนหลังในห้อง A
      await switchTo(page, OTHER);
      const b = await state(page);
      await rotate(page, L); // หมุนในห้อง B — ต้องไม่ใช้ตำแหน่งอ่านของห้อง A
      const b2 = await state(page);
      await rotate(page, P);
      await switchTo(page, ROOM.manager);
      const c = await state(page);
      check(`${tag} AC-8 ห้อง B เปิดที่ข้อความล่าสุด และหมุนแล้วยังล่างสุด`, b.gap <= STICK && b2.gap <= STICK && b.last.includes(OTHER.key), { b: b.gap, rotated: b2.gap });
      check(`${tag} AC-8 กลับห้อง A เปิดที่ข้อความล่าสุด`, c.gap <= STICK && c.last.includes(ROOM.manager.key), { gap: c.gap });
      check(`${tag} ไม่มี page error`, errors.length === 0, errors);
    } finally {
      await ctx.close();
    }
  }
}

// ---- 10: รูปโหลดช้าระหว่างหมุน ----
async function slowImages(browser, role) {
  for (let r = 0; r < REPS; r++) {
    // รูปในข้อความ 37–40 (ใต้ตำแหน่งอ่าน) โหลดเสร็จหลังหมุน → เนื้อหาสูงขึ้นใต้ข้อความที่อ่านอยู่
    const tag = `N02 ${role} รูปโหลดช้า (ใต้ตำแหน่งอ่าน) #${r + 1}`;
    const { ctx, page, ctl } = await open(browser, role, P, { images: { seqs: [37, 38, 39, 40], delayMs: 2500 } });
    try {
      await readAtGap(page, 1500);
      const a = await state(page);
      await rotate(page, L);
      await page.waitForTimeout(2500); // รูปโหลดเสร็จ
      const b = await state(page, a.firstId);
      check(`${tag} AC-1/AC-2 ไม่ถูกดึงลง ข้อความเดิมยังเห็น`, b.anchorVisible && Math.abs(b.anchorOff - a.firstOff) <= TOL && b.gap > STICK, { before: a.firstOff, after: b.anchorOff, gap: b.gap });
      const c = await newMessage(page, ctl, role, b.firstId);
      check(`${tag} AC-5 ข้อความใหม่ไม่ดึงลง`, c.indicator && c.gap > STICK, { gap: c.gap });
    } finally {
      await ctx.close();
    }
  }
  {
    // ข้อสังเกต (ไม่นับคะแนน): รูปเหนือข้อความที่อ่านโหลดเสร็จระหว่างอ่าน — เนื้อหาเปลี่ยนอย่างเดียว F2 ไม่คืนตำแหน่ง (นอกขอบเขต doc 16)
    const { ctx, page } = await open(browser, role, P, { images: { seqs: Array.from({ length: 20 }, (_, i) => i + 21), delayMs: 2500 } });
    try {
      await readAtGap(page, 900);
      const a = await state(page);
      await rotate(page, L);
      await page.waitForTimeout(3000);
      const b = await state(page, a.firstId);
      observations.push({ id: `N02 ${role} รูปเหนือตำแหน่งอ่านโหลดช้า (ข้อสังเกต)`, before: a.firstOff, after: b.anchorOff, drift: b.anchorOff === null ? null : b.anchorOff - a.firstOff, gap: b.gap });
      console.log(`INFO  N02 ${role} รูปเหนือตำแหน่งอ่าน: ข้อความเดิม ${a.firstOff} → ${b.anchorOff} · gap ${b.gap}`);
    } finally {
      await ctx.close();
    }
  }
  for (let r = 0; r < REPS; r++) {
    // อยู่ล่างสุด + รูปโหลดช้าหลังหมุน → ยังอยู่ล่างสุด (CHAT-01 / FE-01 เดิม)
    const tag = `N02 ${role} รูปโหลดช้า ขณะอยู่ล่างสุด #${r + 1}`;
    const { ctx, page } = await open(browser, role, P, { images: { seqs: [36, 37, 38, 39, 40], delayMs: 2000 } });
    try {
      await rotate(page, L);
      await page.waitForTimeout(2500);
      const b = await state(page);
      check(`${tag} AC-4`, b.gap <= STICK, { gap: b.gap });
    } finally {
      await ctx.close();
    }
  }
}

// ---- 11: ผู้ใช้เลื่อนเองระหว่างหมุน ----
async function scrollDuringResize(browser, role) {
  for (let r = 0; r < REPS; r++) {
    const tag = `N02 ${role} เลื่อนเองระหว่างหมุน #${r + 1}`;
    const { ctx, page, ctl, errors } = await open(browser, role, P);
    try {
      await readAtGap(page, 500);
      await Promise.all([page.setViewportSize({ width: L[0], height: L[1] }), touchUp(page)]);
      await page.waitForTimeout(900);
      const b = await state(page);
      const c = await newMessage(page, ctl, role, b.firstId);
      followCheck(`${tag} AC-1 ยังไม่อยู่ล่างสุด (ข้อความใหม่ไม่ดึงลง)`, b, c);
      check(`${tag} ไม่มี page error`, errors.length === 0, errors);
    } finally {
      await ctx.close();
    }
  }
}

const browser = await chromium.launch();
const t0 = Date.now();
try {
  for (const role of ["tech", "manager"]) {
    await portraitLandscape(browser, role);
    await landscapePortrait(browser, role);
    await newWhileReading(browser, role);
    await touchThenRotate(browser, role);
    await bottomRotate(browser, role);
    await indicatorClick(browser, role);
    await deepLink(browser, role);
    await slowImages(browser, role);
    await scrollDuringResize(browser, role);
  }
  await roomSwitch(browser);
} finally {
  await browser.close();
}

const origins = [...net.origins.keys()];
const foreign = origins.filter((o) => o !== WEB_ORIGIN && o !== API_ORIGIN && !o.startsWith("data:") && o !== "null");
const reached = foreign.filter((o) => !net.failed.has(o));
check("NET-01 ไม่มีคำขอสำเร็จไปโดเมนอื่น (API ถูก mock · โดเมนอื่นถูก abort)", reached.length === 0, { origins, aborted: [...net.failed] });

const pass = results.filter((r) => r.status === "PASS").length;
const limitation = results.filter((r) => r.status === "LIMITATION").length;
const fail = results.filter((r) => r.status === "FAIL").length;
console.log(`\n${LABEL}: ${pass} PASS · ${limitation} LIMITATION · ${fail} FAIL · total ${results.length} · ${Math.round((Date.now() - t0) / 1000)}s`);
if (OUT) writeFileSync(OUT, JSON.stringify({ label: LABEL, pass, limitation, fail, total: results.length, results, observations }, null, 2));
process.exit(fail ? 1 : 0);
