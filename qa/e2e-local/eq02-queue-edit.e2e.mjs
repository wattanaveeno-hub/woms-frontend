// EQ-02 หน้าแก้ไขคิว (/service-queue/[id]) — ประเภท → หมวดหมู่ → รุ่น · localhost + mock API (ไม่ใช่ backend integration) · ห้ามชี้ไป UAT
//
// ใช้:  FE_URL=http://localhost:3002 LABEL=after node qa/e2e-local/eq02-queue-edit.e2e.mjs [out.json]
// ครอบคลุม: Admin แก้คิว (Dialog) · คิวที่ผูก JN แล้ว · ผู้สร้างแก้ร่างคิว · desktop/mobile
// ตรวจ body ที่ส่งจริง: ไม่มี category / ราคา · modelMasterId (optional · DATA-GAP-Q1 Solution A) = แถวที่ผู้ใช้เลือก · ข้อมูลเดิมไม่หาย
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { API_BASE, installMockApi } from "./mockApi.mjs";

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

const M = (id, type, category, model) => ({ id, type, category, model, standardCost: 2000, costStatus: "APPROVED", active: true });
const MASTER = [
  M("m1", "ตู้ฟรีส", "ตู้ยืน", "HF-78HS"),
  M("m2", "ตู้แช่", "ตู้นอน", "RT-188MA-F"),
  M("m4", "เครื่องทำน้ำแข็ง", "หัว", "SRM-200AB"),
  M("m5", "เครื่องทำน้ำแข็ง", "ถัง", "B-501"),
  M("m7", "เครื่องทำน้ำแข็ง", "ถัง", "SRM-200AB"), // รุ่นชื่อซ้ำต่างหมวดหมู่
];
const ITEM = (itemId, machineType, model, extra = {}) => ({ itemId, machineType, model, serial: "", equipmentId: "", internalCode: "", note: "", jobEquipmentId: "", ...extra });
const QUEUE = (id, extra = {}) => ({
  id, queueNo: `Q-${id}`, mode: "NEW", status: "WAIT_ASSIGN", statusLabel: "รอจัดช่าง", version: 3,
  jobType: "CM", jobSubType: "", customerType: "", jobName: "ร้านทดสอบ EQ-02", customerId: "", siteId: "", branchNo: "", customerName: "", storeName: "",
  address: "1 ถนนทดสอบ", contactName: "คุณทดสอบ", phone: "0812345678", mapLink: "", note: "หมายเหตุเดิม", preferredDate: "", preferredTime: "",
  items: [
    ITEM("it1", "ตู้แช่", "OLD-77", { note: "เครื่องเดิมนอก master" }), // ข้อมูลเดิม
    ITEM("it2", "เครื่องทำน้ำแข็ง", "B-501"), // รุ่นใน master ชุดเดียว
    ITEM("it3", "เครื่องทำน้ำแข็ง", "SRM-200AB"), // รุ่นซ้ำ 2 หมวดหมู่
    ITEM("it4", "ตู้ฟรีส", "HF-78HS", { serial: "SN-ABC-100", equipmentId: "E1", internalCode: "M0001" }), // จากคลัง
    ITEM("it5", "เครื่องทำน้ำแข็ง", "SRM-200AB", { modelMasterId: "m7" }), // DATA-GAP-Q1: รุ่นซ้ำ + id ที่บันทึกไว้ (แถว ถัง)
  ],
  ownerSaleId: "", ownerSaleName: "", createdById: "u-adm", createdByName: "QA admin", techId: "", techName: "", roundNo: 0, rounds: [],
  apptDate: "", apptTime: "", period: "", periodLabel: "", current: null, pendingSerialCount: 0, jobId: "", releasedAt: "", rescheduleReason: "",
  cancelReason: "", cancelledAt: "", cancelledByName: "", createdAt: "2026-11-01T02:00:00.000Z", updatedAt: "2026-11-01T02:00:00.000Z",
  ...extra,
});
const QUEUES = {
  SQ1: QUEUE("SQ1"),
  SQJ: QUEUE("SQJ", { status: "WAIT_TECH", statusLabel: "รอช่าง", jobId: "JN-0001", jobStatus: "OPEN", techId: "u-tech", techName: "ช่าง" }),
  SQD: QUEUE("SQD", { status: "DRAFT", statusLabel: "ร่าง", queueNo: "" }),
};
const ALLOWED_ITEM_KEYS = new Set(["itemId", "machineType", "model", "serial", "equipmentId", "internalCode", "note", "jobEquipmentId", "identLabel", "filterUnit", "warrantyMonths", "warrantyStart", "pmMode", "pmRounds", "pmEveryMonths", "pmYears", "modelMasterId"]);

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${typeof detail === "string" ? detail : JSON.stringify(detail ?? "").slice(0, 300)}`);
};
const net = { origins: new Map(), failed: new Set() };

async function open(browser, role, vp, mobile = false) {
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
  const cap = { patches: [], drafts: [] };
  const queues = JSON.parse(JSON.stringify(QUEUES));
  const hdr = { "access-control-allow-origin": WEB_ORIGIN, "access-control-allow-headers": "authorization, content-type, x-client", "content-type": "application/json" };
  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const m = req.method();
    if (m === "OPTIONS") return route.fallback();
    const ok = (b, s = 200) => route.fulfill({ status: s, headers: hdr, body: JSON.stringify(b) });
    if (u.pathname === "/api/equipment-models" && m === "GET") return ok({ items: MASTER, count: MASTER.length });
    if (u.pathname === "/api/service-queue/sales") return ok({ items: [] });
    let mm = u.pathname.match(/^\/api\/service-queue\/(SQ1|SQJ|SQD)$/);
    if (mm && m === "GET") return ok({ queue: queues[mm[1]], events: [], messages: [], jobEquipment: [], conflicts: [] });
    if (mm && m === "PATCH") {
      const body = JSON.parse(req.postData() || "{}");
      cap.patches.push({ id: mm[1], body });
      const q = queues[mm[1]];
      Object.assign(q, body.items ? { ...body, items: body.items.map((it, i) => ({ ...ITEM(it.itemId ?? `n${i}`, "", ""), ...it })) } : body, { version: q.version + 1 });
      return ok(q);
    }
    mm = u.pathname.match(/^\/api\/service-queue\/(SQD)\/draft$/);
    if (mm && m === "PATCH") {
      const body = JSON.parse(req.postData() || "{}");
      cap.drafts.push(body);
      const q = queues.SQD;
      Object.assign(q, { ...body, items: (body.items ?? q.items).map((it, i) => ({ ...ITEM(it.itemId ?? `n${i}`, "", ""), ...it })) }, { version: q.version + 1 });
      return ok(q);
    }
    if (u.pathname === "/api/equipment/picker" && m === "GET") return ok({ items: [], total: 0, models: [], machineTypes: ["ตู้แช่", "เครื่องทำน้ำแข็ง", "อื่น ๆ", "ตู้ฟรีส"] });
    return route.fallback();
  });
  return { ctx, page, errors, cap };
}

// ช่องของเครื่องรายการที่ n (queue-item-manual) — ชื่อช่องซ้ำกันทุกรายการ จึงจำกัดขอบเขตด้วยรายการ
const manual = (scope, n) => scope.getByTestId("queue-item-manual").nth(n);
const box = (row, label) => row.getByRole("combobox", { name: label, exact: true }).first();
const CAT = "หมวดหมู่ (ใช้กรองรุ่น)";
async function optionsOf(page, row, label) {
  await box(row, label).click();
  await page.waitForTimeout(250);
  const opts = await page.getByRole("option").allInnerTexts();
  await page.keyboard.press("Escape");
  return opts.map((t) => t.replace(/\s+/g, " ").trim());
}
async function pick(page, row, label, text, optionText = null) {
  const b = box(row, label);
  await b.click();
  await b.fill(text);
  await page.waitForTimeout(250);
  await page.getByRole("option").filter({ hasText: optionText ?? text }).first().click();
  await page.waitForTimeout(250);
}
const vals = async (row, typeLabel) => [await box(row, typeLabel).inputValue(), await box(row, CAT).inputValue(), await box(row, "รุ่น").inputValue()];
const PRICE_KEY = /price|cost|charge|snapshot/i;

function checkItemsShape(tag, items) {
  const extra = items.flatMap((it) => Object.keys(it).filter((k) => !ALLOWED_ITEM_KEYS.has(k)));
  check(`${tag} body รายการเครื่องไม่มีฟิลด์ที่ API คิวไม่รองรับ (category / ราคา)`, extra.length === 0 && !items.some((it) => PRICE_KEY.test(JSON.stringify(Object.keys(it)))), extra);
}

async function adminEdit(browser, mobile) {
  const tag = `EQ02 แก้คิว Admin ${mobile ? "mobile" : "desktop"}`;
  const { ctx, page, errors, cap } = await open(browser, "admin", mobile ? [390, 844] : [1366, 768], mobile);
  try {
    await page.goto(`${FE_URL}/service-queue/SQ1`);
    await page.getByRole("button", { name: "แก้ไขข้อมูล" }).waitFor({ timeout: 20_000 });
    await page.getByRole("button", { name: "แก้ไขข้อมูล" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByTestId("queue-item-manual").first().waitFor({ timeout: 10_000 });
    await page.waitForTimeout(600);
    check(`${tag} เปิด Dialog แก้ไข · รายการเครื่องเดิม 4 manual + 1 จากคลัง`, (await dlg.getByTestId("queue-item-manual").count()) === 4 && (await dlg.getByTestId("queue-item-stock").count()) === 1, [await dlg.getByTestId("queue-item-manual").count(), await dlg.getByTestId("queue-item-stock").count()]);
    const r1 = manual(dlg, 0), r2 = manual(dlg, 1), r3 = manual(dlg, 2);
    const v1 = await vals(r1, "ประเภทเครื่อง #1");
    check(`${tag} #1 ข้อมูลเดิม (รุ่นนอก master) โหลดครบ ค่าไม่หาย`, v1[0] === "ตู้แช่" && v1[2] === "OLD-77", v1);
    const o1 = await optionsOf(page, r1, "รุ่น");
    check(`${tag} #1 รุ่นเดิมแสดงเป็นตัวเลือก "ข้อมูลเดิม"`, o1.some((t) => t.includes("OLD-77") && t.includes("ข้อมูลเดิม")), o1);
    const v2 = await vals(r2, "ประเภทเครื่อง #2");
    check(`${tag} #2 รุ่นใน master ชุดเดียว → หมวดหมู่อนุมานจาก master`, v2[0] === "เครื่องทำน้ำแข็ง" && v2[1] === "ถัง" && v2[2] === "B-501", v2);
    const v3 = await vals(r3, "ประเภทเครื่อง #3");
    check(`${tag} #3 รุ่นซ้ำ 2 หมวดหมู่ → ไม่เดาหมวดหมู่`, v3[0] === "เครื่องทำน้ำแข็ง" && v3[1] === "" && v3[2] === "SRM-200AB", v3);
    const v5 = await vals(manual(dlg, 3), "ประเภทเครื่อง #5");
    check(`${tag} #5 รุ่นซ้ำที่บันทึก modelMasterId (m7) → reload แสดงหมวดหมู่ ถัง ตามที่เลือก`, v5[0] === "เครื่องทำน้ำแข็ง" && v5[1] === "ถัง" && v5[2] === "SRM-200AB", v5);
    // เปลี่ยนรุ่นของ #2 ด้วยการค้นหา → เติมประเภท/หมวดหมู่ตาม master
    await box(r2, "ประเภทเครื่อง #2").click();
    await r2.locator(".MuiAutocomplete-root").first().locator(".MuiAutocomplete-clearIndicator").click({ force: true });
    await page.keyboard.press("Escape");
    await box(r2, CAT).click();
    await r2.locator(".MuiAutocomplete-root").nth(1).locator(".MuiAutocomplete-clearIndicator").click({ force: true });
    await page.keyboard.press("Escape");
    await pick(page, r2, "รุ่น", "hf", "HF-78HS");
    const v2b = await vals(r2, "ประเภทเครื่อง #2");
    check(`${tag} #2 ค้นหา "hf" เลือก HF-78HS → ประเภท ตู้ฟรีส / หมวดหมู่ ตู้ยืน`, v2b[0] === "ตู้ฟรีส" && v2b[1] === "ตู้ยืน" && v2b[2] === "HF-78HS", v2b);
    // #3 เลือกหมวดหมู่ "หัว" เพื่อกรอง → รุ่นยังคงเดิม (SRM-200AB อยู่ในหมวดหมู่นั้น)
    await pick(page, r3, CAT, "หัว");
    const v3b = await vals(r3, "ประเภทเครื่อง #3");
    check(`${tag} #3 เลือกหมวดหมู่กรอง "หัว" → รุ่นซ้ำยังเลือกอยู่`, v3b[1] === "หัว" && v3b[2] === "SRM-200AB", v3b);
    await dlg.getByLabel("เหตุผล/หมายเหตุการแก้ไข (บันทึกใน Log)").fill("EQ-02 ทดสอบ");
    await dlg.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
    await page.waitForTimeout(1200);
    const p = cap.patches.at(-1);
    check(`${tag} บันทึก → PATCH /api/service-queue/SQ1 ครั้งเดียว พร้อม version + เหตุผล`, cap.patches.length === 1 && p?.body?.version === 3 && p?.body?.reason === "EQ-02 ทดสอบ", cap.patches.map((x) => x.id));
    const items = p?.body?.items ?? [];
    checkItemsShape(tag, items);
    const by = Object.fromEntries(items.map((it) => [it.itemId, it]));
    check(`${tag} #1 ข้อมูลเดิมส่งกลับค่าเดิม (ตู้แช่ / OLD-77 / หมายเหตุ)`, by.it1?.machineType === "ตู้แช่" && by.it1?.model === "OLD-77" && by.it1?.note === "เครื่องเดิมนอก master", by.it1);
    check(`${tag} #2 ส่งประเภท/รุ่นใหม่ (ตู้ฟรีส / HF-78HS) คงรหัสรายการเดิม`, by.it2?.machineType === "ตู้ฟรีส" && by.it2?.model === "HF-78HS", by.it2);
    check(`${tag} #3 รุ่นซ้ำส่งค่าเดิม ไม่ส่งหมวดหมู่ที่ใช้กรอง`, by.it3?.machineType === "เครื่องทำน้ำแข็ง" && by.it3?.model === "SRM-200AB" && !("category" in (by.it3 ?? {})), by.it3);
    check(`${tag} เครื่องจากคลังคง equipmentId/SN เดิม · ไม่ส่ง modelMasterId`, by.it4?.equipmentId === "E1" && by.it4?.serial === "SN-ABC-100" && !by.it4?.modelMasterId, by.it4);
    check(`${tag} modelMasterId ที่ส่ง: #2 HF-78HS = m1 · #3 กรองหัว = m4 · #5 คงแถวถัง m7 · #1 ข้อมูลเดิมไม่มี id`, by.it2?.modelMasterId === "m1" && by.it3?.modelMasterId === "m4" && by.it5?.modelMasterId === "m7" && !by.it1?.modelMasterId, [by.it1?.modelMasterId, by.it2?.modelMasterId, by.it3?.modelMasterId, by.it5?.modelMasterId]);
    check(`${tag} Dialog ปิดหลังบันทึก`, (await page.getByRole("dialog").count()) === 0, await page.getByRole("dialog").count());
    check(`${tag} ไม่มี page error`, errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

async function linkedJob(browser) {
  const tag = "EQ02 แก้คิวที่ผูก JN แล้ว";
  const { ctx, page, errors, cap } = await open(browser, "admin", [1366, 768]);
  try {
    await page.goto(`${FE_URL}/service-queue/SQJ`);
    await page.getByRole("button", { name: "แก้ไขข้อมูล" }).waitFor({ timeout: 20_000 });
    await page.getByRole("button", { name: "แก้ไขข้อมูล" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByText("คิวนี้ผูกกับใบงาน JN-0001 แล้ว", { exact: false }).waitFor({ timeout: 10_000 });
    check(`${tag} แสดงคำเตือนว่าแก้เครื่องที่หน้าใบงาน`, true, "");
    await dlg.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
    await page.waitForTimeout(1200);
    const b = cap.patches.at(-1)?.body ?? {};
    const keys = Object.keys(b).sort();
    check(`${tag} PATCH ส่งเฉพาะหมายเหตุ/เซลล์ (ไม่ส่งรายการเครื่อง) — พฤติกรรมเดิม`, JSON.stringify(keys) === JSON.stringify(["note", "ownerSaleId", "reason", "version"]), keys);
    check(`${tag} ไม่มี page error`, errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

async function draftEdit(browser) {
  const tag = "EQ02 แก้ร่างคิว";
  const { ctx, page, errors, cap } = await open(browser, "admin", [1366, 768]);
  try {
    await page.goto(`${FE_URL}/service-queue/SQD`);
    await page.getByTestId("queue-item-manual").first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(600);
    const r3 = manual(page, 2);
    const v3 = await vals(r3, "ประเภทเครื่อง #3");
    check(`${tag} รุ่นซ้ำไม่เดาหมวดหมู่`, v3[1] === "" && v3[2] === "SRM-200AB", v3);
    const r1 = manual(page, 0);
    await pick(page, r1, "ประเภทเครื่อง #1", "ฟรีส", "ตู้ฟรีส");
    const v1 = await vals(r1, "ประเภทเครื่อง #1");
    check(`${tag} เปลี่ยนประเภทของข้อมูลเดิม → รุ่นนอก master ไม่ถูกล้าง (กติกาเดิม changeType)`, v1[0] === "ตู้ฟรีส" && v1[2] === "OLD-77", v1);
    await page.getByTestId("queue-save-draft").click();
    await page.waitForTimeout(1200);
    const b = cap.drafts.at(-1) ?? {};
    check(`${tag} บันทึกร่าง → PATCH /draft ครั้งเดียว`, cap.drafts.length === 1 && b.version === 3, cap.drafts.length);
    checkItemsShape(tag, b.items ?? []);
    const it1 = (b.items ?? []).find((x) => x.itemId === "it1");
    check(`${tag} รายการ #1 ส่งประเภทใหม่ + รุ่นเดิม`, it1?.machineType === "ตู้ฟรีส" && it1?.model === "OLD-77", it1);
    check(`${tag} ไม่มี page error`, errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch();
const t0 = Date.now();
for (const [name, fn] of [
  ["adminEdit desktop", () => adminEdit(browser, false)],
  ["adminEdit mobile", () => adminEdit(browser, true)],
  ["linkedJob", () => linkedJob(browser)],
  ["draftEdit", () => draftEdit(browser)],
]) {
  try {
    await fn();
  } catch (e) {
    check(`EQ02 queue-edit scenario ${name} ทำงานจนจบ`, false, String(e?.message ?? e).slice(0, 300));
  }
}
await browser.close();
const origins = [...net.origins.keys()];
const foreign = origins.filter((o) => o !== WEB_ORIGIN && o !== API_ORIGIN && o !== "null");
const reached = foreign.filter((o) => !net.failed.has(o));
check("EQ02 queue-edit ไม่มีคำขอออกนอก localhost/mock API", reached.length === 0, { foreign, reached });
const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
console.log(`\n${LABEL}: ${pass}/${results.length} PASS · ${fail} FAIL · ${Math.round((Date.now() - t0) / 1000)}s · mock API (ไม่ใช่ backend integration)`);
if (OUT) writeFileSync(OUT, JSON.stringify({ label: LABEL, feUrl: FE_URL, pass, fail, total: results.length, results }, null, 2));
process.exit(fail ? 1 : 0);
