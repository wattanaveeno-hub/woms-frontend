// N-01 Final Verification (PM/SA) — สลับห้อง A→B→A และ programmatic-scroll race · localhost + mock API · ห้ามชี้ไป UAT
//
// ใช้:  FE_URL=http://localhost:3004 LABEL=after REPS=3 node qa/e2e-local/n01-final.e2e.mjs [out.json]
//   ONLY = switch | race | images
// เกณฑ์:
//   - "อยู่ข้อความล่าสุด" = ระยะจากก้น ≤ 80px (STICK_THRESHOLD_PX เดิม)
//   - "ผู้ใช้เลื่อนอ่านข้อความเก่าได้" = หลังผู้ใช้เลื่อน ระยะจากก้น > 300px และไม่ถูกดึงกลับภายใน 1.5 วินาที
//   - รายงาน "จำนวน step ที่หาย" ของ wheel (ถ้า event ของผู้ใช้ถูกนับเป็นของหน้าเว็บ/เลย์เอาต์)
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
const REPS = +(process.env.REPS ?? 3);
const ONLY = process.env.ONLY ?? "";
const WEB_ORIGIN = new URL(FE_URL).origin;
const API_ORIGIN = new URL(API_BASE).origin;
if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(FE_URL).hostname)) {
  console.error(`FE_URL ต้องเป็น localhost เท่านั้น (ได้ ${FE_URL})`);
  process.exit(2);
}
const STICK = 80;
const A = { key: "CHECK_QUEUE", name: "กลุ่มเช็คคิว" };
const B = { key: "TECH-u-tech", name: "กลุ่มงานช่าง ช่างทดสอบ" };

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(detail).slice(0, 260)}`);
};
const net = { origins: new Map(), failed: new Set() };

async function open(browser, vp, { desktop = false, images = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, isMobile: !desktop, hasTouch: !desktop, locale: "th-TH" });
  ctx.on("request", (r) => {
    const o = new URL(r.url()).origin;
    net.origins.set(o, (net.origins.get(o) ?? 0) + 1);
  });
  ctx.on("requestfailed", (r) => net.failed.add(new URL(r.url()).origin));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  const ctl = { pending: [] };
  await installMockApi(page, "manager", { webOrigin: WEB_ORIGIN, ctl });
  if (images) await imageRoutes(page, images);
  return { ctx, page, errors, ctl };
}

// ห้องที่มีรูป 20 รูป (ข้อความ 21–40) — รูปโหลดทยอยห่างกัน stagger ms (เนื้อหาเปลี่ยนความสูงระหว่างผู้ใช้เลื่อน)
async function imageRoutes(page, stagger) {
  const svg = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="170"><rect width="200" height="170" fill="#9ab"/></svg>').toString("base64");
  const hdr = { "access-control-allow-origin": WEB_ORIGIN, "access-control-allow-headers": "authorization, content-type", "content-type": "application/json" };
  let t0 = 0;
  let n = 0;
  await page.route(`${API_ORIGIN}/api/group-chat/groups/${A.key}/messages*`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fallback();
    const u = new URL(req.url());
    if (u.searchParams.has("afterSeq") || u.searchParams.has("since") || u.searchParams.has("before")) return route.fallback();
    const msgs = Array.from({ length: 40 }, (_, j) => {
      const m = newMockMessage(A.key, j + 1);
      if (j + 1 > 20) m.attachments = [{ fileId: `f${j + 1}`, name: `img${j + 1}.svg`, mime: "image/svg+xml", size: 300 }];
      return m;
    });
    return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify({ messages: msgs, cards: {}, cursor: { before: null, afterSeq: 40, changedSince: msgs[39].createdAt } }) });
  });
  await page.route(`${API_ORIGIN}/api/group-chat/files/*`, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    if (!t0) t0 = Date.now();
    const due = t0 + 600 + n++ * stagger;
    await new Promise((r) => setTimeout(r, Math.max(0, due - Date.now())));
    const id = route.request().url().split("/").pop();
    return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify({ name: id, mime: "image/svg+xml", size: 300, dataUrl: svg }) });
  });
}

const state = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="chat-scroll"]');
    if (!el) return null;
    const ids = [...document.querySelectorAll('[data-testid="chat-messages"] [id^="msg-"]')].map((e) => e.id.slice(4));
    return { gap: Math.round(el.scrollHeight - el.scrollTop - el.clientHeight), top: Math.round(el.scrollTop), sh: el.scrollHeight, n: ids.length, last: ids[ids.length - 1] ?? null, indicator: !!document.querySelector('[data-testid="new-message-indicator"]') };
  });
async function waitRoom(page, room) {
  await page.waitForFunction((k) => {
    const ids = [...document.querySelectorAll('[data-testid="chat-messages"] [id^="msg-"]')];
    return ids.length > 0 && ids[ids.length - 1].id.includes(k);
  }, room.key, { timeout: 20_000 });
}
async function listCenter(page) {
  const b = await page.locator('[data-testid="chat-scroll"]').boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
}
// wheel ทีละ step แล้วนับว่า step ไหนถูกดึงกลับ (scrollTop ไม่ลดลงหรือกลับไปล่างสุด)
async function wheelSteps(page, steps = 3, dy = -400, gapMs = 120) {
  const { x, y } = await listCenter(page);
  await page.mouse.move(x, y);
  const series = [];
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(gapMs);
    series.push((await state(page)).gap);
  }
  await page.waitForTimeout(1500);
  const end = await state(page);
  let lost = 0;
  let prev = 0;
  for (const g of series) {
    if (g <= prev + 50) lost++;
    prev = g;
  }
  return { series, end, lost };
}
async function pageUps(page, times = 3) {
  const { x, b } = await listCenter(page);
  await page.mouse.click(x, b.y + 20);
  for (let i = 0; i < times; i++) {
    await page.keyboard.press("PageUp");
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1500);
  return { end: await state(page) };
}
async function touchDrag(page) {
  const { x, b } = await listCenter(page);
  const cdp = await page.context().newCDPSession(page);
  const y0 = Math.round(b.y + b.height * 0.2);
  const y1 = Math.round(b.y + b.height * 0.9);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: Math.round(x), y: y0 }] });
  for (let yy = y0; yy <= y1; yy += 20) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: Math.round(x), y: yy }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(1500);
  return { end: await state(page) };
}
async function switchTo(page, room, desktop) {
  if (!desktop) {
    await page.getByRole("button", { name: "กลับไปรายการกลุ่ม" }).click();
    await page.waitForTimeout(300);
  }
  await page.getByText(room.name, { exact: true }).first().click();
  await waitRoom(page, room);
}

// ---- 1. สลับห้อง A → B → A ----
async function roomSwitch(browser, desktop) {
  const vp = desktop ? [1366, 768] : [390, 844];
  const tag = `SW ${desktop ? "desktop 1366x768" : "mobile 390x844"}`;
  for (let r = 0; r < REPS; r++) {
    // reading-now = อ่านย้อนในห้อง A แล้วสลับไป B และเลื่อนทันที (0ms) ที่ข้อความ B ขึ้น — ค่าที่จำไว้จากห้อง A ยังไม่ถูกแทน
    for (const mode of ["bottom", "reading", "reading-now"]) {
      const t = `${tag} ${mode} #${r + 1}`;
      const { ctx, page, errors, ctl } = await open(browser, vp, { desktop });
      try {
        await page.goto(`${FE_URL}/group-chat?g=${A.key}`);
        await waitRoom(page, A);
        await page.waitForTimeout(700);
        const a0 = await state(page);
        if (mode !== "bottom") {
          await wheelSteps(page, 3, -500);
        }
        const a1 = await state(page);
        await switchTo(page, B, desktop);
        if (mode !== "reading-now") await page.waitForTimeout(700);
        const b0 = await state(page);
        // ผู้ใช้เลื่อนทันทีหลังเปิดห้อง B (อยู่ในช่วงเครื่องหมาย programmatic ของ scrollToBottom)
        const bw = await wheelSteps(page, 3, -400, 100);
        ctl.pending.push(newMockMessage(B.key, 41));
        await page.waitForTimeout(6500);
        const b1 = await state(page);
        await switchTo(page, A, desktop);
        await page.waitForTimeout(700);
        const a2 = await state(page);
        check(`${t} A เปิดแล้วอยู่ล่างสุด`, a0.gap <= STICK, a0);
        if (mode !== "bottom") check(`${t} A อ่านย้อนได้`, a1.gap > 300, a1);
        check(`${t} B (หลังสลับ) อยู่ล่างสุด`, b0.gap <= STICK && b0.last?.includes(B.key), b0);
        check(`${t} B เลื่อนขึ้นทันทีหลังเปิด: อ่านย้อนได้ (step หาย ${bw.lost}/3)`, bw.end.gap > 300, bw);
        check(`${t} B ข้อความใหม่ระหว่างอ่าน: ไม่ดึงลง + ตัวแจ้ง`, b1.gap > 300 && b1.indicator, b1);
        check(`${t} กลับห้อง A: อยู่ข้อความล่าสุด`, a2.gap <= STICK && a2.last?.includes(A.key), a2);
        check(`${t} page-errors = 0`, errors.length === 0, errors);
      } catch (e) {
        check(`${t} ERROR`, false, String(e).slice(0, 300));
      } finally {
        await ctx.close();
      }
    }
  }
}

// ---- 2. ผู้ใช้เลื่อนภายใน 1,000ms หลัง programmatic scroll (ข้อความใหม่เข้าขณะอยู่ล่างสุด) ----
async function race(browser, action, offset) {
  const desktop = action !== "touch";
  const vp = desktop ? [1366, 768] : [390, 844];
  for (let r = 0; r < REPS; r++) {
    const t = `RACE ${action} +${offset}ms #${r + 1}`;
    const { ctx, page, errors, ctl } = await open(browser, vp, { desktop });
    try {
      await page.goto(`${FE_URL}/group-chat?g=${A.key}`);
      await waitRoom(page, A);
      await page.waitForTimeout(900);
      const n0 = (await state(page)).n;
      ctl.pending.push(newMockMessage(A.key, 41));
      await page.waitForFunction((n) => document.querySelectorAll('[data-testid="chat-messages"] [id^="msg-"]').length > n, n0, { timeout: 12_000 });
      if (offset) await page.waitForTimeout(offset);
      const res = action === "wheel" ? await wheelSteps(page, 3, -400, 100) : action === "pageup" ? await pageUps(page, 3) : await touchDrag(page);
      // อ่านอยู่แล้วมีข้อความใหม่อีก → ไม่ดึงลง
      ctl.pending.push(newMockMessage(A.key, 42));
      await page.waitForTimeout(6500);
      const after = await state(page);
      check(`${t} เลื่อนอ่านข้อความเก่าได้${res.lost !== undefined ? ` (step หาย ${res.lost}/3)` : ""}`, res.end.gap > 300, res);
      check(`${t} ข้อความใหม่ระหว่างอ่าน: ไม่ดึงลง`, after.gap > 300 && after.indicator, after);
      check(`${t} page-errors = 0`, errors.length === 0, errors);
    } catch (e) {
      check(`${t} ERROR`, false, String(e).slice(0, 300));
    } finally {
      await ctx.close();
    }
  }
}

// ---- 3. รูปโหลดทยอย (เนื้อหาเปลี่ยนความสูง) ระหว่างผู้ใช้เลื่อน ----
async function images(browser, stagger) {
  for (let r = 0; r < REPS; r++) {
    const t = `IMG stagger ${stagger}ms #${r + 1}`;
    const { ctx, page, errors } = await open(browser, [1366, 768], { desktop: true, images: stagger });
    try {
      await page.goto(`${FE_URL}/group-chat?g=${A.key}`);
      await waitRoom(page, A);
      await page.waitForTimeout(300); // รูปยังโหลดไม่ครบ
      const res = await wheelSteps(page, 4, -400, 120);
      await page.waitForTimeout(2500); // รูปโหลดครบ
      const end = await state(page);
      check(`${t} เลื่อนขึ้นระหว่างรูปโหลด: อ่านย้อนได้ (step หาย ${res.lost}/4)`, res.end.gap > 300 && end.gap > 300, { ...res, final: end });
      check(`${t} page-errors = 0`, errors.length === 0, errors);
    } catch (e) {
      check(`${t} ERROR`, false, String(e).slice(0, 300));
    } finally {
      await ctx.close();
    }
  }
  // เปิดห้องที่มีรูปแล้วไม่แตะ → อยู่ข้อความล่าสุดหลังรูปโหลดครบ
  for (let r = 0; r < REPS; r++) {
    const t = `IMG stagger ${stagger}ms เปิดห้องไม่แตะ #${r + 1}`;
    const { ctx, page } = await open(browser, [1366, 768], { desktop: true, images: stagger });
    try {
      await page.goto(`${FE_URL}/group-chat?g=${A.key}`);
      await waitRoom(page, A);
      await page.waitForTimeout(4000);
      const s = await state(page);
      check(`${t} อยู่ข้อความล่าสุดหลังรูปโหลดครบ`, s.gap <= STICK, s);
    } catch (e) {
      check(`${t} ERROR`, false, String(e).slice(0, 300));
    } finally {
      await ctx.close();
    }
  }
}

const browser = await chromium.launch();
const t0 = Date.now();
if (!ONLY || ONLY === "switch") {
  await roomSwitch(browser, true);
  await roomSwitch(browser, false);
}
if (!ONLY || ONLY === "race") for (const action of ["wheel", "pageup", "touch"]) for (const off of [0, 100, 300, 600, 900]) await race(browser, action, off);
if (!ONLY || ONLY === "images") for (const st of [150, 16]) await images(browser, st);
await browser.close();
const external = [...net.origins.keys()].filter((o) => o !== WEB_ORIGIN && o !== API_ORIGIN);
check("NET-01 ไม่มีคำขอไป backend จริง", external.every((o) => net.failed.has(o)) && !external.some((o) => /onrender\.com|vercel\.app|mongodb/.test(o)) && !net.failed.has(API_ORIGIN), {
  web: net.origins.get(WEB_ORIGIN) ?? 0,
  apiMocked: net.origins.get(API_ORIGIN) ?? 0,
  externalAborted: Object.fromEntries(external.map((o) => [o, net.origins.get(o)])),
});
const pass = results.filter((r) => r.ok).length;
console.log(`\n${LABEL}: ${pass}/${results.length} PASS · ${Math.round((Date.now() - t0) / 1000)}s`);
if (OUT) writeFileSync(OUT, JSON.stringify({ label: LABEL, feUrl: FE_URL, at: new Date().toISOString(), reps: REPS, results }, null, 2));
process.exit(results.every((r) => r.ok) ? 0 : 1);
