// Nav + ตาราง PM รายเดือน (WP-1/WP-2) — Regression บน localhost (mock API) · ห้ามชี้ไป UAT
//
// ใช้:  FE_URL=http://localhost:3001 LABEL=wp9 node qa/e2e-local/nav-pm-monthly.e2e.mjs [out.json]
//   ONLY = nav | pm | flow
//
// ตรวจ:
//   NAV-1  หัวกลุ่มเมนู 16px + ไอคอน ทุกบทบาท · desktop 1366 และมือถือ 390
//   PM-1   /pm โหลดได้ตามสิทธิ์ (pm:view) · acc ไม่มีสิทธิ์ไม่ได้ตาราง · ไม่มี horizontal scroll ที่ 390px
//   PM-2   ปุ่มเปลี่ยนช่างแสดงเฉพาะผู้มี pm:manage (manager/admin) — backend ตรวจซ้ำ (pmMonthly.fake.test.ts)
//   PM-3   Admin: รายละเอียด → เปลี่ยนช่าง (เหตุผลว่าง = แจ้งเตือน · บันทึก = แถบผลลัพธ์) · ขอบเขตเปลี่ยนผู้ดูแล · 409 แสดงข้อความ
//   PM-4   การ์ดกดกรอง / กดซ้ำกลับ · มุมมองตามช่างเรียงกลุ่ม · หน้าแผน PM เดิม /pm/plans ยังเปิดได้
//   PM-5   ช่างของรอบเห็นปุ่มเสนอวันเวลาเฉพาะแถวของตัวเอง · ส่ง POST /api/pm/propose-machines
//   NET-01 ไม่มีคำขอสำเร็จไปโดเมนอื่น
//
// ข้อมูลเป็น mock — ผลนี้ไม่ใช่ backend integration และไม่ใช่ Customer UAT
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { installMockApi, API_BASE, ROLES } from "./mockApi.mjs";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("@playwright/test"));
}

const FE_URL = (process.env.FE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const LABEL = process.env.LABEL ?? "run";
const ONLY = process.env.ONLY ?? "";
const OUT = process.argv[2];
const WEB_ORIGIN = new URL(FE_URL).origin;
const API_ORIGIN = new URL(API_BASE).origin;
if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(FE_URL).hostname)) {
  console.error(`FE_URL ต้องเป็น localhost เท่านั้น (ได้ ${FE_URL})`);
  process.exit(2);
}

const ROLE_PERMS = JSON.parse(readFileSync(new URL("../../scripts/fixtures/role-permissions.json", import.meta.url), "utf8")).map;
const ROUNDS = JSON.parse(readFileSync(new URL("./fixtures/pm-rounds.json", import.meta.url), "utf8"));
const TECH_USER = "u-tech"; // = USER_ID.tech ใน mockApi.mjs
const DESK = [1366, 900];
const M390 = [390, 844];

const results = [];
const net = { origins: new Map(), failed: new Set() };
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
}
const has = (role, p) => ROLE_PERMS[role].includes(p);

/** แถวของ fixture ปรับตามบทบาท: canReassign ตาม pm:manage · tech เป็นช่างของรอบ P101/P103 แทน t1 */
function rowsFor(role, rows) {
  const manage = has(role, "pm:manage");
  return rows.map((r) => {
    const x = { ...r, canReassign: manage && r.status !== "DONE" };
    if (role === "tech" && x.roundTech?.id === "t1") x.roundTech = { ...x.roundTech, id: TECH_USER };
    return x;
  });
}

async function open(browser, role, vp, { conflictOnce = false } = {}) {
  const mobile = vp[0] < 600;
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, isMobile: mobile, hasTouch: mobile, locale: "th-TH" });
  ctx.on("request", (r) => {
    const o = new URL(r.url()).origin;
    net.origins.set(o, (net.origins.get(o) ?? 0) + 1);
  });
  ctx.on("requestfailed", (r) => net.failed.add(new URL(r.url()).origin));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  await installMockApi(page, role, { webOrigin: WEB_ORIGIN });
  const cap = { reassign: [], propose: [], roundsStatus: [] };
  let conflict = conflictOnce;
  const hdr = { "access-control-allow-origin": WEB_ORIGIN, "access-control-allow-headers": "authorization, content-type, x-client", "content-type": "application/json" };
  const json = (route, status, body) => route.fulfill({ status, headers: hdr, body: JSON.stringify(body) });
  // ลงทะเบียนหลัง installMockApi → ทำงานก่อน · อื่น ๆ ส่งต่อให้ mock เดิม
  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const m = req.method();
    if (m === "OPTIONS") return route.fallback();
    const p = u.pathname;
    if (p === "/api/pm/rounds" && m === "GET") {
      if (!has(role, "pm:view")) {
        cap.roundsStatus.push(403);
        return json(route, 403, { error: { code: "FORBIDDEN", message: "ไม่มีสิทธิ์" } });
      }
      cap.roundsStatus.push(200);
      const k = `${u.searchParams.get("view") || "overview"}|${u.searchParams.get("period") || ""}`;
      const d = ROUNDS[k] ?? ROUNDS["overview|"];
      return json(route, 200, { ...d, canReassign: has(role, "pm:manage"), items: rowsFor(role, d.items) });
    }
    if (p === "/api/pm/rounds/detail" && m === "GET") {
      const id = u.searchParams.get("equipmentId");
      const it = rowsFor(role, ROUNDS["overview|"].items).find((i) => i.equipmentId === id);
      if (!it) return json(route, 404, { error: { code: "NOT_FOUND", message: "ไม่พบเครื่อง" } });
      return json(route, 200, { item: it, latestPm: it.lastPmDate, lastReassign: null, reviewReasonLabel: "", ownerSourceLabel: "" });
    }
    if (p === "/api/pm/rounds/reassign" && m === "POST") {
      if (!has(role, "pm:manage")) return json(route, 403, { error: { code: "FORBIDDEN", message: "ไม่มีสิทธิ์" } });
      const b = JSON.parse(req.postData() || "{}");
      cap.reassign.push(b);
      if (!String(b.reason ?? "").trim()) return json(route, 400, { error: { code: "BAD_REQUEST", message: "กรุณาระบุเหตุผลที่เปลี่ยนช่าง", field: "reason" } });
      if (conflict) {
        conflict = false;
        return json(route, 409, { error: { code: "ROUND_TECH_CHANGED", message: "ช่างของรอบนี้ถูกเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลใหม่" } });
      }
      const from = { id: b.expectedTechId || "", name: "ช่างชัช" };
      const to = b.technicianId ? { id: b.technicianId, name: "ช่างอาท" } : null;
      return json(route, 200, {
        equipmentId: b.equipmentId, serial: "ICE-TEST", scope: b.scope, roundId: "r1", roundMonth: "2026-12",
        from, to: b.scope === "ROUND_ONLY" ? to : from, ownerBefore: null, ownerAfter: b.scope === "OWNER_FROM_NEXT" ? to : null,
        queueId: "", reason: b.reason, at: "2026-11-09T03:00:00.000Z",
      });
    }
    if (p === "/api/pm/propose-machines" && m === "POST") {
      const b = JSON.parse(req.postData() || "{}");
      cap.propose.push(b);
      return json(route, 201, { queue: { id: "Q-1", queueNo: "SQ-2611-001" } });
    }
    return route.fallback();
  });
  return { ctx, page, errors, cap };
}

const settle = (page, ms = 1200) => page.waitForTimeout(ms);
async function openMobileMenu(page) {
  await page.getByRole("button", { name: /เปิดเมนู|เมนู/ }).first().click().catch(() => {});
  await page.waitForTimeout(600);
}

// ---------------------------------------------------------------- NAV-1
async function navAll(browser) {
  for (const role of ROLES)
    for (const vp of [DESK, M390]) {
      const tag = `NAV-1 ${role} ${vp[0]}px`;
      const { ctx, page, errors } = await open(browser, role, vp);
      try {
        await page.goto(`${FE_URL}/dashboard`);
        await settle(page, 2000);
        if (vp[0] < 900) await openMobileMenu(page);
        const heads = await page.evaluate(() =>
          [...document.querySelectorAll('[data-testid="nav-group-toggle"]')].map((h) => {
            const t = h.querySelector("span");
            const cs = t ? getComputedStyle(t) : null;
            return { text: t?.textContent ?? "", size: cs?.fontSize, weight: cs?.fontWeight, icon: !!h.querySelector("svg"), h: Math.round(h.getBoundingClientRect().height) };
          })
        );
        const visible = heads.filter((x) => x.h > 0);
        check(`${tag} มีหัวกลุ่มเมนู`, visible.length > 0, visible.map((x) => x.text));
        check(`${tag} หัวกลุ่ม 16px/700 + ไอคอน · สูง ≥ 44px`, visible.every((x) => x.size === "16px" && Number(x.weight) >= 700 && x.icon && x.h >= 44), visible);
        const pmLink = (await page.locator('nav a[href="/pm"]').count()) > 0;
        check(`${tag} เมนูตาราง PM แสดงตามสิทธิ์ pm:view`, pmLink === has(role, "pm:view"), { pmLink, perm: has(role, "pm:view") });
        check(`${tag} ไม่มี page error`, errors.length === 0, errors);
      } finally {
        await ctx.close();
      }
    }
}

// ---------------------------------------------------------------- PM-1 / PM-2
async function pmAll(browser) {
  for (const role of ROLES)
    for (const vp of [DESK, M390]) {
      const tag = `PM-1 ${role} ${vp[0]}px`;
      const { ctx, page, errors, cap } = await open(browser, role, vp);
      try {
        await page.goto(`${FE_URL}/pm`);
        await settle(page, 2500);
        const title = await page.getByText("ตาราง PM รายเดือน", { exact: false }).count();
        if (!has(role, "pm:view")) {
          check(`${tag} ไม่มี pm:view: ไม่ได้ข้อมูลตาราง`, !cap.roundsStatus.includes(200) && (await page.getByRole("button", { name: /ดูรายละเอียด/ }).count()) === 0, { status: cap.roundsStatus, title });
        } else {
          const rows = await page.getByRole("button", { name: /ดูรายละเอียด/ }).count();
          check(`${tag} แสดงตาราง 11 เครื่อง`, title > 0 && rows === 11, { title, rows });
          const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
          check(`${tag} ไม่มี horizontal scroll`, !hscroll, { hscroll });
          const groups = await page.locator('[data-testid="woms-group-header"]').count();
          check(`${tag} แบ่งกลุ่มตามเดือน 7 กลุ่ม`, groups === 7, { groups });
          const reassignBtns = await page.getByRole("button", { name: /เปลี่ยนช่าง|ระบุช่าง/ }).count();
          const manage = has(role, "pm:manage");
          check(`PM-2 ${role} ${vp[0]}px ปุ่มเปลี่ยนช่าง ${manage ? "แสดง" : "ไม่แสดง"} (pm:manage=${manage})`, manage ? reassignBtns >= 10 : reassignBtns === 0, { reassignBtns });
          if (vp[0] < 600) {
            const small = await page.evaluate(() =>
              [...document.querySelectorAll("main button")]
                .map((b) => b.getBoundingClientRect())
                .filter((r) => r.width > 0 && r.height > 0 && r.height < 32).length
            );
            check(`${tag} ปุ่มในเนื้อหาสูง ≥ 32px`, small === 0, { small });
          }
        }
        check(`${tag} ไม่มี page error`, errors.length === 0, errors);
      } finally {
        await ctx.close();
      }
    }
}

// ---------------------------------------------------------------- PM-3 / PM-4 / PM-5
async function adminFlow(browser, vp) {
  const tag = `PM-3 admin ${vp[0]}px`;
  const { ctx, page, errors, cap } = await open(browser, "admin", vp);
  try {
    await page.goto(`${FE_URL}/pm`);
    await settle(page, 2500);
    await page.getByRole("button", { name: /ครัวบ้านสวน ดูรายละเอียด/ }).first().click();
    await page.getByText("รายละเอียด PM").waitFor({ timeout: 10_000 });
    await settle(page, 600);
    const detailText = await page.getByRole("dialog").innerText();
    check(`${tag} Dialog รายละเอียดมีช่างรอบนี้/ผู้ดูแลประจำ/เซลล์`, /ช่างรอบนี้/.test(detailText) && /ผู้ดูแลประจำ/.test(detailText) && /เซลล์ผู้รับผิดชอบ/.test(detailText), detailText.slice(0, 160));
    await page.getByRole("dialog").getByRole("button", { name: "เปลี่ยนช่าง" }).click();
    await page.locator("#pm-reassign-title").waitFor();
    await page.getByTestId("pm-reassign-save").click();
    await settle(page, 400);
    const errText = (await page.locator("#pm-reassign-reason-helper-text").textContent()) ?? "";
    check(`${tag} เหตุผลว่าง = แจ้ง "กรุณาระบุเหตุผลที่เปลี่ยนช่าง" และไม่ส่งคำขอ`, errText.includes("กรุณาระบุเหตุผลที่เปลี่ยนช่าง") && cap.reassign.length === 0, { errText, sent: cap.reassign.length });
    await page.locator("#pm-reassign-tech").click();
    await page.getByRole("option", { name: "ช่างอาท" }).click();
    await page.fill("#pm-reassign-reason", "ช่างชัชติดงานต่างจังหวัด");
    await page.getByTestId("pm-reassign-save").click();
    await page.getByTestId("pm-feedback").waitFor({ timeout: 10_000 });
    const fb = await page.getByTestId("pm-feedback").textContent();
    const sent = cap.reassign.at(-1) ?? {};
    check(`${tag} บันทึกย้ายเฉพาะรอบ: ส่ง scope/expectedTechId/เหตุผล · แสดงแถบผลลัพธ์`, sent.scope === "ROUND_ONLY" && sent.expectedTechId === "t1" && sent.technicianId && sent.reason === "ช่างชัชติดงานต่างจังหวัด" && /บันทึกแล้ว/.test(fb ?? ""), { sent, fb });

    // เปลี่ยนผู้ดูแลประจำตั้งแต่รอบถัดไป
    await page.getByRole("button", { name: /เปลี่ยนช่าง ICE-|ระบุช่าง ICE-/ }).first().click();
    await page.locator("#pm-reassign-title").waitFor();
    await page.getByText("เปลี่ยนผู้ดูแลประจำตั้งแต่รอบถัดไป").click();
    await page.fill("#pm-reassign-reason", "ย้ายพื้นที่ดูแล");
    await page.getByTestId("pm-reassign-save").click();
    await settle(page, 1200);
    check(`${tag} เลือกเปลี่ยนผู้ดูแลประจำ: ส่ง scope OWNER_FROM_NEXT`, cap.reassign.at(-1)?.scope === "OWNER_FROM_NEXT", cap.reassign.at(-1));

    // PM-4 การ์ดกรอง / กดซ้ำกลับ
    if (vp[0] >= 900) {
      await page.getByRole("button", { name: /ถึงรอบเดือนนี้/ }).first().click();
      await settle(page, 900);
      const u1 = page.url();
      await page.getByRole("button", { name: /ถึงรอบเดือนนี้/ }).first().click();
      await settle(page, 900);
      const u2 = page.url();
      check("PM-4 การ์ดกดครั้งแรกกรอง DUE · กดซ้ำกลับทุกเดือน", /period=DUE/.test(u1) && !/period=/.test(u2), { u1, u2 });
      await page.getByRole("button", { name: "ตารางรายช่าง" }).click();
      await settle(page, 1200);
      const tg = await page.locator('[data-testid="woms-group-header"]').allInnerTexts();
      check("PM-4 มุมมองตามช่าง: กลุ่มยังไม่ระบุช่างอยู่ท้าย", tg.length >= 2 && /ยังไม่ระบุช่าง/.test(tg.at(-1) ?? ""), tg.map((t) => t.replace(/\s+/g, " ")));
      await page.goto(`${FE_URL}/pm/plans`);
      await settle(page, 2000);
      const legacy = await page.getByText("แผน PM รายเดือน (เดิม)").count();
      check("PM-4 หน้าแผน PM เดิม /pm/plans ยังเปิดได้", legacy > 0, { legacy });
      await page.goto(`${FE_URL}/pm/dashboard`);
      await settle(page, 2000);
    }
    check(`${tag} ไม่มี page error (รวม /pm/plans และ /pm/dashboard)`, errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

async function conflictFlow(browser) {
  const tag = "PM-3 admin 409 ช่างถูกเปลี่ยนระหว่างแก้";
  const { ctx, page, errors } = await open(browser, "admin", DESK, { conflictOnce: true });
  try {
    await page.goto(`${FE_URL}/pm`);
    await settle(page, 2500);
    await page.getByRole("button", { name: /เปลี่ยนช่าง ICE-|ระบุช่าง ICE-/ }).first().click();
    await page.locator("#pm-reassign-title").waitFor();
    await page.fill("#pm-reassign-reason", "ทดสอบชนกัน");
    await page.getByTestId("pm-reassign-save").click();
    await settle(page, 900);
    const alert = await page.getByRole("dialog").getByRole("alert").allInnerTexts();
    const stillOpen = await page.locator("#pm-reassign-title").count();
    check(`${tag}: Dialog ยังเปิดและแสดงข้อความจาก backend`, stillOpen === 1 && alert.some((t) => t.includes("ถูกเปลี่ยนไปแล้ว")), { alert, stillOpen });
    check(`${tag}: ไม่มี page error`, errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

async function techPropose(browser, vp) {
  const tag = `PM-5 tech ${vp[0]}px`;
  const { ctx, page, errors, cap } = await open(browser, "tech", vp);
  try {
    await page.goto(`${FE_URL}/pm`);
    await settle(page, 2500);
    const btns = await page.getByRole("button", { name: "เสนอวันเวลา" }).count();
    // fixture: tech เป็นช่างของรอบ P101 (OVERDUE · มีคิวแล้ว → ไม่มีปุ่ม) และ P103 (UPCOMING · ยังไม่มีคิว → มีปุ่ม)
    check(`${tag} ปุ่มเสนอวันเวลาเฉพาะแถวที่ตัวเองเป็นช่างของรอบและยังไม่มีคิว`, btns === 1, { btns });
    await page.getByRole("button", { name: "เสนอวันเวลา" }).first().click();
    await page.locator("#pm-propose-title").waitFor();
    await page.fill("#pm-propose-date", "2030-01-15");
    await page.getByRole("dialog").getByRole("button", { name: "เสนอวันเวลา" }).click();
    await page.getByTestId("pm-feedback").waitFor({ timeout: 10_000 });
    const b = cap.propose.at(-1) ?? {};
    check(`${tag} ส่ง POST /api/pm/propose-machines หนึ่งเครื่อง พร้อมวันเวลา`, Array.isArray(b.equipmentIds) && b.equipmentIds.length === 1 && b.date === "2030-01-15" && !!b.time, b);
    check(`${tag} ไม่มี page error`, errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch();
const t0 = Date.now();
try {
  if (!ONLY || ONLY === "nav") await navAll(browser);
  if (!ONLY || ONLY === "pm") await pmAll(browser);
  if (!ONLY || ONLY === "flow") {
    await adminFlow(browser, DESK);
    await adminFlow(browser, M390);
    await conflictFlow(browser);
    await techPropose(browser, DESK);
    await techPropose(browser, M390);
  }
} finally {
  await browser.close();
}
const origins = [...net.origins.keys()];
const foreign = origins.filter((o) => o !== WEB_ORIGIN && o !== API_ORIGIN && o !== "null");
const reached = foreign.filter((o) => !net.failed.has(o));
check("NET-01 ไม่มีคำขอสำเร็จไปโดเมนอื่น (API ถูก mock · โดเมนอื่นถูก abort)", reached.length === 0, { foreign, reached });

const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
console.log(`\n${LABEL}: ${pass}/${results.length} PASS · ${fail} FAIL · ${Math.round((Date.now() - t0) / 1000)}s · mock API (ไม่ใช่ backend integration)`);
if (OUT) writeFileSync(OUT, JSON.stringify({ label: LABEL, pass, fail, total: results.length, results }, null, 2));
process.exit(fail ? 1 : 0);
