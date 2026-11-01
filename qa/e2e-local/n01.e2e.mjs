// N-01 Group Chat Initial Scroll — Regression บน localhost (mock API) · ห้ามชี้ไป UAT
//
// ใช้:  FE_URL=http://localhost:3001 LABEL=after node qa/e2e-local/n01.e2e.mjs [out.json]
//   DEEP_RUNS (ค่าเริ่มต้น 50) · LIST_RUNS (20) · ASYNC_RUNS (5) ต่อบทบาท
// เกณฑ์ "อยู่ข้อความล่าสุด" = ระยะจากก้นรายการ ≤ 80px (STICK_THRESHOLD_PX เดิม)
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
const DEEP_RUNS = +(process.env.DEEP_RUNS ?? 50);
const LIST_RUNS = +(process.env.LIST_RUNS ?? 20);
const ASYNC_RUNS = +(process.env.ASYNC_RUNS ?? 5);
const STICK = 80;
const POLL_WAIT = 6500; // POLL_MS ของหน้าแชท = 5000
const ROOM = { manager: { key: "CHECK_QUEUE", name: "กลุ่มเช็คคิว" }, tech: { key: "TECH-u-tech", name: "กลุ่มงานช่าง ช่างทดสอบ" } };

const results = [];
const observations = [];
const check = (id, ok, detail) => {
  results.push({ id, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)}`);
};
const net = { origins: new Map(), failed: new Set() };

async function open(browser, role, vp, opts = {}) {
  const mobile = !opts.desktop;
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, isMobile: mobile, hasTouch: mobile, locale: "th-TH" });
  ctx.on("request", (r) => {
    const o = new URL(r.url()).origin;
    net.origins.set(o, (net.origins.get(o) ?? 0) + 1);
  });
  ctx.on("requestfailed", (r) => net.failed.add(new URL(r.url()).origin));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  const ctl = { pending: [] };
  await installMockApi(page, role, { webOrigin: WEB_ORIGIN, messagesDelayMs: opts.delay ?? 0, ctl });
  return { ctx, page, errors, ctl };
}
const state = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="chat-scroll"]');
    if (!el) return null;
    const ids = [...document.querySelectorAll('[data-testid="chat-messages"] [id^="msg-"]')].map((e) => e.id.slice(4));
    return {
      gap: Math.round(el.scrollHeight - el.scrollTop - el.clientHeight),
      top: Math.round(el.scrollTop),
      sh: el.scrollHeight,
      ch: el.clientHeight,
      n: ids.length,
      last: ids[ids.length - 1] ?? null,
      indicator: !!document.querySelector('[data-testid="new-message-indicator"]'),
    };
  });
async function ready(page) {
  await page.waitForSelector('[data-testid="chat-messages"] [id^="msg-"]', { timeout: 20_000 });
  await page.waitForTimeout(600);
}
async function wheelUp(page, dy = -1500) {
  const box = await page.locator('[data-testid="chat-scroll"]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(400);
}
async function touchScrollUp(page, times = 3) {
  // 3 ครั้ง ≈ 1,500–2,000px ใกล้เคียง wheel — ถ้าอ่านอยู่ใกล้ล่างสุด (< ~800px) การหมุนเป็นแนวนอนทำให้เนื้อหาเตี้ยลงจน
  // เบราว์เซอร์ปรับ scrollTop ถึงล่างสุดเอง (พฤติกรรมเดิมก่อน N-01 — บันทึกแยกเป็น N-02)
  for (let i = 0; i < times; i++) await touchDragOnce(page);
}
async function touchDragOnce(page) {
  // ลากนิ้วลง (เลื่อนรายการขึ้น) ด้วย CDP touch events จริง — synthesizeScrollGesture ไม่เลื่อนรายการใน headless
  const box = await page.locator('[data-testid="chat-scroll"]').boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x = Math.round(box.x + box.width / 2);
  const y0 = Math.round(box.y + box.height * 0.2);
  const y1 = Math.round(box.y + box.height * 0.9);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let y = y0; y <= y1; y += 20) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(600);
}

// ---- ชุดทดสอบ ----
async function deepLink(browser, role, vp, runs, delay = 0, tag = "deep-link") {
  let pass = 0;
  const fails = [];
  for (let i = 0; i < runs; i++) {
    const { ctx, page, errors } = await open(browser, role, vp, { delay });
    try {
      await page.goto(`${FE_URL}/group-chat?g=${ROOM[role].key}`);
      await ready(page);
      const s = await state(page);
      if (s && s.gap <= STICK && s.last && errors.length === 0) pass++;
      else fails.push({ run: i, ...s, errors });
    } catch (e) {
      fails.push({ run: i, error: String(e).slice(0, 200) });
    } finally {
      await ctx.close();
    }
  }
  check(`N01 ${role} ${vp.join("x")} ${tag}${delay ? ` delay ${delay}ms` : ""} ${runs} รอบ: เปิดแล้วอยู่ข้อความล่าสุด`, pass === runs, { pass, runs, fails: fails.slice(0, 5) });
}

async function fromList(browser, role, runs) {
  let pass = 0;
  const fails = [];
  for (let i = 0; i < runs; i++) {
    const { ctx, page, errors } = await open(browser, role, [390, 844]);
    try {
      await page.goto(`${FE_URL}/group-chat`);
      await page.getByText(ROOM[role].name, { exact: true }).first().click({ timeout: 15_000 });
      await ready(page);
      const s = await state(page);
      if (s && s.gap <= STICK && errors.length === 0) pass++;
      else fails.push({ run: i, ...s, errors });
    } catch (e) {
      fails.push({ run: i, error: String(e).slice(0, 200) });
    } finally {
      await ctx.close();
    }
  }
  check(`N01 ${role} 390x844 รายการ→ห้อง ${runs} รอบ: อยู่ข้อความล่าสุด`, pass === runs, { pass, runs, fails: fails.slice(0, 5) });
}

async function readingOld(browser, role, vp, how) {
  const tag = `N01 ${role} ${vp.join("x")} อ่านย้อนหลัง (${how})`;
  const { ctx, page, errors, ctl } = await open(browser, role, vp);
  try {
    await page.goto(`${FE_URL}/group-chat?g=${ROOM[role].key}`);
    await ready(page);
    const s0 = await state(page);
    check(`${tag} เปิดแล้วอยู่ล่างสุด`, s0.gap <= STICK, s0);
    if (how === "wheel") await wheelUp(page);
    else await touchScrollUp(page, 3);
    await page.waitForTimeout(1500);
    const s1 = await state(page);
    check(`${tag} เลื่อนขึ้นแล้วไม่ถูกดึงลงล่าง`, s1.gap > 300, s1);
    // ข้อความใหม่เข้าระหว่างอ่าน → ไม่ดึงลง · แสดงตัวแจ้งข้อความใหม่
    ctl.pending.push(newMockMessage(ROOM[role].key, 41));
    await page.waitForTimeout(POLL_WAIT);
    const s2 = await state(page);
    check(`${tag} ข้อความใหม่ระหว่างอ่าน: ตำแหน่งเดิม + ตัวแจ้งข้อความใหม่`, Math.abs(s2.top - s1.top) <= 5 && s2.gap > 300 && s2.indicator && s2.n === s1.n + 1, { s1, s2 });
    // หมุนจอระหว่างอ่าน → ยังไม่ดึงลง
    await page.setViewportSize({ width: vp[1], height: vp[0] });
    await page.waitForTimeout(700);
    await page.setViewportSize({ width: vp[0], height: vp[1] });
    await page.waitForTimeout(700);
    const s3 = await state(page);
    check(`${tag} หมุนจอระหว่างอ่าน: ไม่ดึงลงล่าง`, s3.gap > 300, s3);
    // กดตัวแจ้ง → ไปข้อความล่าสุด แล้วข้อความใหม่ถัดไปตามลงมา
    await page.locator('[data-testid="new-message-indicator"]').click();
    await page.waitForTimeout(500);
    const s4 = await state(page);
    check(`${tag} กดตัวแจ้งข้อความใหม่ → ล่างสุด`, s4.gap <= STICK && !s4.indicator, s4);
    ctl.pending.push(newMockMessage(ROOM[role].key, 42));
    await page.waitForTimeout(POLL_WAIT);
    const s5 = await state(page);
    check(`${tag} อยู่ล่างสุด + ข้อความใหม่ → ตามลงมา`, s5.gap <= STICK && s5.last?.endsWith("m042"), s5);
    // ผู้ใช้เลื่อนกลับลงล่างสุดเอง → ตามข้อความใหม่อีกครั้ง
    if (how === "wheel") {
      await wheelUp(page);
      await wheelUp(page, 100000);
      await page.waitForTimeout(1200);
      ctl.pending.push(newMockMessage(ROOM[role].key, 43));
      await page.waitForTimeout(POLL_WAIT);
      const s6 = await state(page);
      check(`${tag} เลื่อนขึ้นแล้วกลับลงเอง → ตามข้อความใหม่`, s6.gap <= STICK && s6.last?.endsWith("m043"), s6);
    }
    check(`${tag} page-errors = 0`, errors.length === 0, errors);
  } catch (e) {
    check(`${tag} ERROR`, false, String(e).slice(0, 300));
  } finally {
    await ctx.close();
  }
}

// QA F1/F2 (รอบ 1): scroll ที่ไม่ได้มาจาก wheel/touch ต้องไม่ถูกดึงกลับล่างสุด
async function keyboardAndFocus(browser, role) {
  for (const vp of [[1280, 800], [800, 600]]) {
    const tag = `N01 ${role} ${vp.join("x")} desktop`;
    const { ctx, page, errors } = await open(browser, role, vp, { desktop: true });
    try {
      await page.goto(`${FE_URL}/group-chat?g=${ROOM[role].key}`);
      await ready(page);
      // F1: คลิกในรายการ รอ > 1 วินาที แล้วกด PageUp 3 ครั้ง (โฟกัสอยู่ body)
      const box = await page.locator('[data-testid="chat-scroll"]').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + 20);
      await page.waitForTimeout(1500);
      const s0 = await state(page);
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press("PageUp");
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(1200);
      const s1 = await state(page);
      check(`${tag} QA-F1 PageUp หลังคลิก 1.5s: เลื่อนขึ้นได้ ไม่ถูกดึงกลับ`, s0.gap <= STICK && s1.gap > 300, { s0, s1 });
      // F2: focus ปุ่มที่อยู่นอกจอ (ตอบกลับของข้อความแรก) → เบราว์เซอร์เลื่อนไปหา และคงอยู่
      await page.locator('[data-testid="chat-scroll"]').evaluate((el) => (el.scrollTop = el.scrollHeight));
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        const b = document.querySelector('[data-testid="chat-messages"] button');
        b?.focus();
      });
      await page.waitForTimeout(1200);
      const f = await page.evaluate(() => {
        const b = document.activeElement;
        const el = document.querySelector('[data-testid="chat-scroll"]');
        const r = b.getBoundingClientRect();
        const l = el.getBoundingClientRect();
        return { tag: b.tagName, text: (b.textContent || "").trim().slice(0, 20), inView: r.bottom > l.top && r.top < l.bottom, gap: Math.round(el.scrollHeight - el.scrollTop - el.clientHeight) };
      });
      check(`${tag} QA-F2 focus ปุ่มนอกจอ: มองเห็นปุ่ม ไม่ถูกดึงกลับ`, f.tag === "BUTTON" && f.inView && f.gap > 300, f);
      check(`${tag} page-errors = 0`, errors.length === 0, errors);
    } catch (e) {
      check(`${tag} ERROR`, false, String(e).slice(0, 300));
    } finally {
      await ctx.close();
    }
  }
}

async function n02Observation(browser, role) {
  // ข้อสังเกต N-02 (ไม่นับคะแนน · พฤติกรรมเดิม): อ่านอยู่ใกล้ล่างสุดแล้วหมุนจอ
  const { ctx, page } = await open(browser, role, [390, 844]);
  try {
    await page.goto(`${FE_URL}/group-chat?g=${ROOM[role].key}`);
    await ready(page);
    await touchScrollUp(page, 1);
    const a = await state(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(700);
    const b = await state(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(700);
    const c = await state(page);
    observations.push({ id: `N02 ${role} อ่านใกล้ล่างสุดแล้วหมุนจอ`, beforeRotate: a, landscape: b, back: c });
    console.log(`INFO  N02 ${role} gap ก่อนหมุน ${a.gap} → แนวนอน ${b.gap} → กลับ ${c.gap}`);
  } finally {
    await ctx.close();
  }
}

async function keyboardAtBottom(browser, role) {
  const tag = `N01 ${role} 390x844 คีย์บอร์ด/ย่อหน้าต่าง ขณะอยู่ล่างสุด`;
  const { ctx, page, errors } = await open(browser, role, [390, 844]);
  try {
    await page.goto(`${FE_URL}/group-chat?g=${ROOM[role].key}`);
    await ready(page);
    await page.evaluate(() => {
      const vv = window.visualViewport;
      Object.defineProperty(vv, "height", { configurable: true, get: () => 420 });
      vv.dispatchEvent(new Event("resize"));
    });
    await page.waitForTimeout(600);
    const k = await state(page);
    await page.evaluate(() => {
      delete window.visualViewport.height;
      window.visualViewport.dispatchEvent(new Event("resize"));
    });
    await page.waitForTimeout(600);
    await page.setViewportSize({ width: 390, height: 600 });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    const r = await state(page);
    check(tag, k.gap <= STICK && r.gap <= STICK && errors.length === 0, { keyboard: k, restored: r, errors });
  } catch (e) {
    check(`${tag} ERROR`, false, String(e).slice(0, 300));
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch();
const ONLY = process.env.ONLY ?? "";
const t0 = Date.now();
for (const role of ["manager", "tech"]) {
  if (!ONLY || ONLY === "deep") {
    await deepLink(browser, role, [844, 390], DEEP_RUNS);
    await deepLink(browser, role, [390, 844], DEEP_RUNS);
  }
  if (!ONLY || ONLY === "list") await fromList(browser, role, LIST_RUNS);
  if (!ONLY || ONLY === "async") for (const d of [300, 1000, 2500]) await deepLink(browser, role, [844, 390], ASYNC_RUNS, d, "async");
  if (!ONLY || ONLY === "read") {
    await readingOld(browser, role, [390, 844], "wheel");
    await readingOld(browser, role, [390, 844], "touch");
  }
  if (!ONLY || ONLY === "kb") await keyboardAtBottom(browser, role);
  if (!ONLY || ONLY === "kbfocus") await keyboardAndFocus(browser, role);
  if (!ONLY || ONLY === "n02") await n02Observation(browser, role);
}
await browser.close();
const external = [...net.origins.keys()].filter((o) => o !== WEB_ORIGIN && o !== API_ORIGIN);
check(
  "NET-01 ไม่มีคำขอไป backend จริง",
  external.every((o) => net.failed.has(o)) && !external.some((o) => /onrender\.com|vercel\.app|mongodb/.test(o)) && !net.failed.has(API_ORIGIN),
  { web: net.origins.get(WEB_ORIGIN) ?? 0, apiMocked: net.origins.get(API_ORIGIN) ?? 0, externalAborted: Object.fromEntries(external.map((o) => [o, net.origins.get(o)])) }
);
const pass = results.filter((r) => r.ok).length;
console.log(`\n${LABEL}: ${pass}/${results.length} PASS · ${Math.round((Date.now() - t0) / 1000)}s`);
if (OUT) writeFileSync(OUT, JSON.stringify({ label: LABEL, feUrl: FE_URL, at: new Date().toISOString(), results, observations }, null, 2));
process.exit(results.every((r) => r.ok) ? 0 : 1);
