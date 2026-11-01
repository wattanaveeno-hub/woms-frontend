// FE-01 / FE-02 — Regression บนเครื่อง (localhost + mock API) · ห้ามชี้ไป UAT
//
// ใช้:  FE_URL=http://localhost:3000 LABEL=fix node qa/e2e-local/fe-fix.e2e.mjs [out.json]
//   - ต้อง build หน้าเว็บด้วย NEXT_PUBLIC_API_BASE ค่าเริ่มต้น (http://localhost:8000) หรือส่งค่าเดียวกันตอนรันสคริปต์
//   - API ทั้งหมดถูกดักด้วย mockApi.mjs (ไม่มีคำขอไป backend จริง · โดเมนอื่นถูก abort)
//   - ต้องมีแพ็กเกจ playwright (หรือ @playwright/test) + Chromium
// คีย์บอร์ดมือถือจำลองด้วยการ override visualViewport.height (layout viewport คงเดิม) — ไม่ใช่อุปกรณ์จริง
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { API_BASE, installMockApi, ROLES } from "./mockApi.mjs";

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
if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(FE_URL).hostname)) {
  console.error(`FE_URL ต้องเป็น localhost เท่านั้น (ได้ ${FE_URL})`);
  process.exit(2);
}

const GAP_MAX = 12; // ที่ว่างระหว่างช่องพิมพ์กับขอบล่าง (gutter 8px + ปัดเศษ)
const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
};

const VIEWPORTS = [
  { name: "mobile-360x740", width: 360, height: 740, mobile: true },
  { name: "mobile-390x844", width: 390, height: 844, mobile: true },
  { name: "tablet-768x1024", width: 768, height: 1024, mobile: true },
  { name: "tablet-820x1180", width: 820, height: 1180, mobile: true },
  { name: "tablet-1024x768", width: 1024, height: 768, mobile: true },
  { name: "tablet-1180x820", width: 1180, height: 820, mobile: true },
  { name: "desktop-1366x768", width: 1366, height: 768, mobile: false },
  { name: "desktop-1920x1080", width: 1920, height: 1080, mobile: false },
];
const ROOM = { manager: "CHECK_QUEUE", tech: "TECH-u-tech" };

// NET-01: บันทึกทุกคำขอระดับ context (รวม popup/worker) — ตรวจว่าไม่มีคำขอออกไป backend จริง
const net = { origins: new Map(), failed: new Set() };
const API_ORIGIN = new URL(API_BASE).origin;
async function newPage(browser, role, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, locale: "th-TH" });
  ctx.on("request", (r) => {
    const o = new URL(r.url()).origin;
    net.origins.set(o, (net.origins.get(o) ?? 0) + 1);
  });
  ctx.on("requestfailed", (r) => net.failed.add(new URL(r.url()).origin));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  const log = await installMockApi(page, role, { webOrigin: WEB_ORIGIN });
  return { ctx, page, log, errors };
}

const measure = (page) =>
  page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect() ?? null;
    const cmp = r('[data-testid="chat-composer"]');
    const pane = r('[data-testid="chat-pane"]');
    const nav = r('nav[aria-label="เมนูช่าง"]');
    const list = document.querySelector('[data-testid="chat-scroll"]');
    const grid = document.querySelector('[data-testid="chat-pane"] > div');
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns : "";
    const vv = window.visualViewport;
    const visibleBottom = vv ? vv.offsetTop + vv.height : innerHeight;
    const limit = nav && nav.top < visibleBottom ? nav.top : visibleBottom;
    return {
      vh: innerHeight,
      visibleBottom: Math.round(visibleBottom),
      paneTop: pane ? Math.round(pane.top) : null,
      paneH: pane ? Math.round(pane.height) : null,
      composerBottom: cmp ? Math.round(cmp.bottom) : null,
      gap: cmp ? Math.round(limit - cmp.bottom) : null,
      listH: list ? list.clientHeight : null,
      scrollGap: list ? Math.round(list.scrollHeight - list.scrollTop - list.clientHeight) : null,
      docH: document.documentElement.scrollHeight,
      navTop: nav ? Math.round(nav.top) : null,
      cols,
      conversationW: document.querySelector('[data-testid="chat-header"]')?.getBoundingClientRect().width ?? null,
    };
  });

async function ready(page) {
  await page.waitForSelector('[data-testid="chat-messages"] [id^="msg-"]', { timeout: 20_000 });
  await page.waitForTimeout(400);
}
const okLayout = (m) => m.composerBottom !== null && m.gap >= 0 && m.gap <= GAP_MAX && m.docH <= m.vh + 1;

async function setKeyboard(page, h) {
  await page.evaluate((hh) => {
    const vv = window.visualViewport;
    if (hh === null) delete vv.height;
    else Object.defineProperty(vv, "height", { configurable: true, get: () => hh });
    vv.dispatchEvent(new Event("resize"));
  }, h);
  await page.waitForTimeout(300);
}

async function fe01(browser) {
  for (const role of ["manager", "tech"]) {
    for (const vp of VIEWPORTS) {
      if (role === "tech" && vp.width >= 900) continue; // แถบเมนูล่างของช่างแสดงเฉพาะจอ < md
      const tag = `FE01 ${role} ${vp.name}`;
      const narrow = vp.width < 900;
      const { ctx, page, errors } = await newPage(browser, role, vp);
      try {
        // R1-05 / R1-06 deep link
        await page.goto(`${FE_URL}/group-chat?g=${ROOM[role]}`);
        await ready(page);
        let m = await measure(page);
        check(`${tag} R1-06 deep-link`, okLayout(m) && m.scrollGap <= 80, m);
        if (narrow) check(`${tag} R1-05 list>=55%vh`, m.listH >= 0.55 * m.vh, { listH: m.listH, vh: m.vh, pct: Math.round((100 * m.listH) / m.vh) });
        if (role === "tech") check(`${tag} R1-08 composer เหนือแถบล่าง`, m.navTop !== null && m.composerBottom <= m.navTop && m.gap <= GAP_MAX, m);

        // R1-06 จากรายการกลุ่ม → เปิดห้อง (layout มือถือ)
        if (narrow) {
          await page.goto(`${FE_URL}/group-chat`);
          await page.waitForSelector("text=กลุ่ม", { timeout: 15_000 });
          await page.waitForTimeout(300);
          const name = role === "tech" ? "กลุ่มงานช่าง ช่างทดสอบ" : "กลุ่มเช็คคิว";
          await page.getByText(name, { exact: true }).first().click();
          await ready(page);
          m = await measure(page);
          check(`${tag} R1-06 list→room`, okLayout(m), m);
        }

        // R1-07 คีย์บอร์ด (จำลอง) เปิด 60% แล้วปิด
        const kbH = Math.round(vp.height * 0.6);
        await setKeyboard(page, kbH);
        m = await measure(page);
        check(`${tag} R1-07 keyboard-open composer อยู่เหนือคีย์บอร์ด`, m.composerBottom !== null && m.composerBottom <= kbH + 1 && m.scrollGap <= 80, m);
        await setKeyboard(page, null);
        m = await measure(page);
        check(`${tag} R1-07 keyboard-close กลับเต็มจอ`, okLayout(m), m);

        // R1-07 ย่อ–ขยายหน้าต่าง
        await page.setViewportSize({ width: vp.width, height: Math.round(vp.height * 0.7) });
        await page.waitForTimeout(400);
        m = await measure(page);
        check(`${tag} R1-07 resize-shrink`, okLayout(m), m);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(400);
        m = await measure(page);
        check(`${tag} R1-07 resize-restore`, okLayout(m), m);

        // R1-07 หมุนจอ (มือถือ/แท็บเล็ต)
        if (vp.mobile) {
          await page.setViewportSize({ width: vp.height, height: vp.width });
          await page.waitForTimeout(500);
          const rot = await measure(page);
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.waitForTimeout(500);
          m = await measure(page);
          check(`${tag} R1-07 rotate แนวนอน composer ในจอ`, okLayout(rot), rot);
          check(`${tag} R1-07 rotate→back`, okLayout(m) && m.scrollGap <= 80, m);
        }

        // R1-09 ช่องพิมพ์ขยาย (แถบตอบกลับ)
        const reply = page.getByRole("button", { name: /ตอบกลับ/ }).last();
        if (await reply.count()) {
          await reply.click();
          await page.waitForTimeout(300);
          m = await measure(page);
          check(`${tag} R1-09 reply-chip composer ในจอ`, m.composerBottom <= (m.navTop ?? m.visibleBottom) && m.docH <= m.vh + 1, m);
        }

        // D-FE-02 ความกว้างรายการกลุ่ม (2 คอลัมน์)
        if (!narrow) {
          const want = vp.width >= 1200 ? "300px" : "240px";
          check(`${tag} D-FE-02 คอลัมน์รายการกลุ่ม ${want}`, m.cols.startsWith(want), { cols: m.cols, conversationW: m.conversationW });
        }
        check(`${tag} page-errors = 0`, errors.length === 0, errors);
      } catch (e) {
        check(`${tag} ERROR`, false, String(e).slice(0, 300));
      } finally {
        await ctx.close();
      }
    }
  }
}

async function fe02(browser) {
  const LANDING = { acc: "/finance/queue" };
  for (const role of ROLES) {
    const tag = `FE02 ${role}`;
    const { ctx, page, log, errors } = await newPage(browser, role, { width: 1366, height: 768, mobile: false });
    try {
      await page.clock.install({ time: new Date("2026-10-31T09:00:00+07:00") });
      await page.goto(`${FE_URL}${LANDING[role] ?? "/dashboard"}`);
      await page.waitForLoadState("networkidle");
      await page.clock.runFor(65_000); // ครอบ poll ของแผงงานค้าง (30 วิ) และกระดิ่ง (60 วิ)
      await page.waitForTimeout(800);
      const denied = log.filter((x) => x.status === 403).map((x) => `${x.method} ${x.path}`);
      const methods = [...new Set(log.map((x) => x.method))];
      const bell = await page.locator('a[href="/notifications?view=unread"]').count();
      const shell = await page.evaluate(() => document.querySelector(".shell")?.innerText ?? "");
      check(`${tag} R2-03 403 จากหน้าเว็บ = 0 (65 วิ)`, denied.length === 0, { denied403: denied.length, endpoints: [...new Set(denied)], requests: log.length, unreadCountCalls: log.filter((x) => x.path === "/api/notifications/unread-count").length, notifPollCalls: log.filter((x) => x.path === "/api/jobs").length });
      check(`${tag} R2-03 method = GET เท่านั้น`, methods.every((x) => x === "GET"), methods);
      check(`${tag} D-FE-01 กระดิ่ง ${role === "acc" ? "ซ่อน" : "แสดง"}`, role === "acc" ? bell === 0 : bell === 1, { bell });
      check(`${tag} page-errors = 0`, errors.length === 0, errors);
      results.push({ id: `${tag} R2-04 shell-text`, ok: true, detail: { text: shell.replace(/\s+/g, " ").trim() } });
    } catch (e) {
      check(`${tag} ERROR`, false, String(e).slice(0, 300));
    } finally {
      await ctx.close();
    }
  }
}


// ---- FE-01 Final Review: D-01..D-04 (visualViewport จำลอง: height / pageTop / offsetTop / scale) ----
async function setVV(page, v) {
  await page.evaluate((v) => {
    const vv = window.visualViewport;
    if (!window.__scrollSpy) {
      window.__scrollSpy = true;
      window.__scrollToCalls = 0;
      const orig = window.scrollTo.bind(window);
      // จำลอง iOS: scrollTo(0,0) คืนตำแหน่ง visual viewport ด้วย
      window.scrollTo = (...a) => {
        window.__scrollToCalls++;
        window.__vvOff = 0;
        return orig(...a);
      };
    }
    for (const k of ["height", "pageTop", "offsetTop", "scale"]) delete vv[k];
    if (v) {
      window.__vvOff = v.pageTop ?? 0;
      Object.defineProperty(vv, "height", { configurable: true, get: () => v.height });
      Object.defineProperty(vv, "pageTop", { configurable: true, get: () => window.__vvOff });
      Object.defineProperty(vv, "offsetTop", { configurable: true, get: () => window.__vvOff });
      Object.defineProperty(vv, "scale", { configurable: true, get: () => v.scale ?? 1 });
    }
    vv.dispatchEvent(new Event("resize"));
    vv.dispatchEvent(new Event("scroll"));
  }, v);
  await page.waitForTimeout(650); // > cooldown 500ms ของ D-03
}
const visual = (page) =>
  page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect() ?? null;
    const vv = window.visualViewport;
    const top = vv.offsetTop;
    const bottom = vv.offsetTop + vv.height;
    const send = r('[aria-label="ส่งข้อความ"]');
    const input = r('textarea[aria-label="ข้อความ"]');
    const cmp = r('[data-testid="chat-composer"]');
    const pane = r('[data-testid="chat-pane"]');
    const hdr = r('[data-testid="chat-header"]');
    const list = document.querySelector('[data-testid="chat-scroll"]');
    const nav = r('nav[aria-label="เมนูช่าง"]');
    const limit = nav && nav.top < bottom ? nav.top : bottom;
    const inView = (b) => !!b && b.top >= top - 1 && b.bottom <= limit + 1;
    return {
      vvTop: Math.round(top),
      vvBottom: Math.round(bottom),
      paneH: pane ? Math.round(pane.height) : null,
      paneBottom: pane ? Math.round(pane.bottom) : null,
      composerBottom: cmp ? Math.round(cmp.bottom) : null,
      sendInView: inView(send),
      inputInView: inView(input),
      headerMode: document.querySelector('[data-testid="chat-header"]')?.getAttribute("data-mode") ?? "hidden",
      headerInView: hdr ? inView(hdr) : null,
      scrollGap: list ? Math.round(list.scrollHeight - list.scrollTop - list.clientHeight) : null,
      scrollToCalls: window.__scrollToCalls ?? 0,
      docH: document.documentElement.scrollHeight,
      vh: innerHeight,
      gap: cmp ? Math.round(limit - cmp.bottom) : null,
    };
  });

async function fe01d(browser) {
  const SIZES = [
    { name: "mobile-390x844", width: 390, height: 844, mobile: true },
    { name: "landscape-844x390", width: 844, height: 390, mobile: true },
    { name: "mobile-360x740", width: 360, height: 740, mobile: true },
    { name: "tablet-768x1024", width: 768, height: 1024, mobile: true },
    { name: "desktop-1366x768", width: 1366, height: 768, mobile: false },
  ];
  for (const role of ["manager", "tech"]) {
    for (const vp of SIZES) {
      if (role === "tech" && vp.width >= 900) continue;
      const tag = `FE01-D ${role} ${vp.name}`;
      const { ctx, page, errors } = await newPage(browser, role, vp);
      try {
        await page.goto(`${FE_URL}/group-chat?g=${ROOM[role]}`);
        await ready(page);
        const base = await measure(page);
        check(`${tag} D-02 เปิดห้องแล้วอยู่ข้อความล่าสุด (หัวห้องโหมด ${await page.getAttribute('[data-testid="chat-header"]', "data-mode").catch(() => "hidden")})`, base.scrollGap <= 80 && okLayout(base), base);

        // D-01 pinch-zoom: scale 2 → visualViewport.height = ครึ่งจอ · pageTop เลื่อนดู → พื้นที่แชทไม่เปลี่ยน · ไม่คืนตำแหน่ง
        await setVV(page, { height: Math.round(vp.height / 2), pageTop: Math.round(vp.height / 4), scale: 2 });
        let v = await visual(page);
        check(`${tag} D-01 zoom ไม่ย่อพื้นที่แชท`, v.paneH === base.paneH && v.scrollToCalls === 0, { before: base.paneH, ...v });
        await setVV(page, { height: Math.round(vp.height / 2), pageTop: 10, scale: 2 });
        v = await visual(page);
        check(`${tag} D-01 zoom + เลื่อนดู ค่าเดิม · ไม่ scrollTo`, v.paneH === base.paneH && v.scrollToCalls === 0, v);
        await setVV(page, null);

        // D-03 คีย์บอร์ดเปิด + iOS pan (offsetTop > 0) → คืนตำแหน่ง · หัวห้อง/ช่องพิมพ์อยู่ในจอ
        const kb = Math.round(vp.height * 0.5);
        await setVV(page, { height: kb, pageTop: Math.round(vp.height * 0.3), scale: 1 });
        v = await visual(page);
        check(`${tag} D-03 offsetTop>0 คืนตำแหน่ง · ช่องพิมพ์/ปุ่มส่งในจอ`, v.scrollToCalls >= 1 && v.vvTop === 0 && v.sendInView && v.inputInView && v.paneBottom <= kb + 1, v);
        check(`${tag} D-03 หัวห้องในจอ (ถ้าแสดง)`, v.headerInView !== false, v);
        check(`${tag} D-03 คงข้อความล่าสุด`, v.scrollGap <= 80, v);
        // ปิดคีย์บอร์ดแต่ iOS ค้างเลื่อน 120px → คืนตำแหน่ง · กลับเต็มจอ
        const calls = v.scrollToCalls;
        await setVV(page, { height: vp.height, pageTop: 120, scale: 1 });
        v = await visual(page);
        check(`${tag} D-03 ปิดคีย์บอร์ดแล้วค้างเลื่อน → คืนตำแหน่ง เต็มจอ`, v.scrollToCalls > calls && v.vvTop === 0 && v.gap >= 0 && v.gap <= GAP_MAX, v);
        await setVV(page, null);

        // D-02 พื้นที่ต่ำกว่า 120px และ 120–320px (คีย์บอร์ดเปิด) → พื้นที่แชทไม่เกินจอ · ปุ่มส่งในจอ
        for (const visible of [100, 150, 200, 260]) {
          if (visible >= vp.height * 0.75) continue;
          await setVV(page, { height: visible, pageTop: 0, scale: 1 });
          v = await visual(page);
          check(`${tag} D-02 visible ${visible}px: ปุ่มส่ง/ช่องพิมพ์ในจอ · พื้นที่แชทไม่เกิน`, v.sendInView && v.inputInView && v.paneBottom <= visible + 1, v);
        }

        // D-02 ช่องพิมพ์ขยาย: แถบตอบกลับ + ข้อความ 8 บรรทัด + รายการแท็ก ขณะคีย์บอร์ดเปิด
        await setVV(page, null);
        const reply = page.getByRole("button", { name: /ตอบกลับ/ }).last();
        if (await reply.count()) await reply.click();
        await page.locator('textarea[aria-label="ข้อความ"]').fill(Array.from({ length: 8 }, (_, i) => `บรรทัด ${i + 1}`).join("\n") + "\n@");
        await page.waitForTimeout(300);
        const mentionShown = await page.locator('[role="listbox"][aria-label="เลือกผู้ใช้ที่จะแท็ก"]').count();
        for (const visible of [Math.round(vp.height * 0.5), 200, 150]) {
          if (visible >= vp.height * 0.75) continue;
          await setVV(page, { height: visible, pageTop: 0, scale: 1 });
          v = await visual(page);
          check(`${tag} D-02 ช่องพิมพ์ขยาย (ตอบกลับ+8 บรรทัด+แท็ก) visible ${visible}px: ปุ่มส่งในจอ`, v.sendInView && v.inputInView && v.composerBottom <= v.paneBottom + 1 && v.paneBottom <= visible + 1, { mentionShown, ...v });
        }
        await setVV(page, null);
        v = await visual(page);
        check(`${tag} D-02 คีย์บอร์ดปิด: ช่องพิมพ์ขยายยังอยู่ในพื้นที่แชท`, v.sendInView && v.composerBottom <= v.paneBottom + 1 && v.docH <= v.vh + 1, { mentionShown, ...v });

        // D-04 หัวหน้าสูงขึ้น/ลดลงทีหลัง (จำลองฟอนต์โหลดเสร็จ) → วัดใหม่ ไม่มีที่ว่าง/ไม่ล้นจอ
        await page.locator('textarea[aria-label="ข้อความ"]').fill("");
        const closeReply = page.getByRole("button", { name: "ยกเลิกการตอบกลับ" });
        if (await closeReply.count()) await closeReply.click();
        await page.waitForTimeout(300);
        for (const extra of [40, 0]) {
          await page.evaluate((px) => {
            const h = document.querySelector("header");
            if (h) h.style.paddingTop = px ? `${px}px` : "";
            const t = document.querySelector("h1");
            if (t) t.style.paddingTop = px ? `${px}px` : "";
          }, extra);
          await page.waitForTimeout(400);
          const m = await measure(page);
          check(`${tag} D-04 ส่วนบนสูง +${extra}px → วัดใหม่`, okLayout(m), m);
        }
        check(`${tag} page-errors = 0`, errors.length === 0, errors);
      } catch (e) {
        check(`${tag} ERROR`, false, String(e).slice(0, 300));
      } finally {
        await ctx.close();
      }
    }
  }
}

const browser = await chromium.launch();
const only = process.env.ONLY ?? "";
if (!only || only === "fe01") await fe01(browser);
if (!only || only === "fe02") await fe02(browser);
if (!only || only === "fe01d") await fe01d(browser);
await browser.close();
// NET-01: คำขอทั้งหมดไปที่หน้าเว็บ localhost หรือ API ที่ถูก mock เท่านั้น · origin อื่นต้องถูก abort ทั้งหมด
const external = [...net.origins.keys()].filter((o) => o !== WEB_ORIGIN && o !== API_ORIGIN);
check(
  "NET-01 ไม่มีคำขอไป backend จริง (origin อื่นถูก abort ทั้งหมด · API = mock)",
  external.every((o) => net.failed.has(o)) && !external.some((o) => /onrender\.com|vercel\.app|mongodb/.test(o)) && !net.failed.has(API_ORIGIN),
  { web: net.origins.get(WEB_ORIGIN) ?? 0, apiMocked: net.origins.get(API_ORIGIN) ?? 0, externalAborted: Object.fromEntries(external.map((o) => [o, net.origins.get(o)])) }
);
const pass = results.filter((r) => r.ok).length;
console.log(`\n${LABEL}: ${pass}/${results.length} PASS`);
if (OUT) writeFileSync(OUT, JSON.stringify({ label: LABEL, feUrl: FE_URL, at: new Date().toISOString(), results }, null, 2));
process.exit(results.every((r) => r.ok) ? 0 : 1);
