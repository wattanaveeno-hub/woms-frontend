// EQ-02 Searchable Dropdown ประเภท → หมวดหมู่ → รุ่น · localhost + mock API · ห้ามชี้ไป UAT
//
// ใช้:  FE_URL=http://localhost:3002 LABEL=after node qa/e2e-local/eq02.e2e.mjs [out.json]
// master ที่ใช้ทดสอบ = ตัวอย่างความสัมพันธ์ในคำสั่ง EQ-02 (ใช้ตรวจความสัมพันธ์เท่านั้น — อยู่ใน mock ไม่ใช่ข้อมูลจริง)
//   + รุ่นชื่อซ้ำต่างหมวดหมู่ 1 แถว (ทดสอบ id) · คำขอบันทึกถูกดักและตรวจ body (ไม่มีข้อมูลไปที่ใด)
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

const M = (id, type, category, model, cost = 2000) => ({ id, type, category, model, standardCost: cost, costStatus: "APPROVED", active: true });
const MASTER = [
  M("m1", "ตู้ฟรีส", "ตู้ยืน", "HF-78HS"),
  M("m2", "ตู้แช่", "ตู้นอน", "RT-188MA-F"),
  M("m3", "เครื่องทำน้ำแข็ง", "หัว+ถัง", "IM-220A + B-301"),
  M("m4", "เครื่องทำน้ำแข็ง", "หัว", "SRM-200AB", 2500),
  M("m5", "เครื่องทำน้ำแข็ง", "ถัง", "B-501"),
  M("m6", "เครื่องทำน้ำแข็ง", "เครื่องถังเก็บในตัว", "SRM-125A"),
  M("m7", "เครื่องทำน้ำแข็ง", "ถัง", "SRM-200AB", 1800), // รุ่นชื่อซ้ำต่างหมวดหมู่ (ทดสอบ)
];
// เครื่องเดิม: หมวดหมู่/รุ่นไม่อยู่ใน master (ข้อมูลก่อน D-07B)
const LEGACY_EQ = {
  id: "EQ-LEG",
  serial: "SN-LEG-001",
  hasRealSerial: true,
  model: "OLD-77",
  category: "ตู้ทรงสูง",
  machineType: "ตู้แช่",
  status: "IN_STOCK",
  customerName: "",
  customerId: "",
  siteId: "",
  siteLabel: "",
  supplier: "",
  warehouse: "คลังหลัก",
  location: "",
  address: "",
  district: "",
  province: "",
  postcode: "",
  zone: "",
  addressFull: "",
  inboundDate: "2026-01-05",
  installDate: "",
  lat: 0,
  lng: 0,
  warranties: [],
  supplierWarrantyStart: "",
  supplierWarrantyMonths: 0,
  customerWarrantyStart: "",
  customerWarrantyMonths: 0,
  note: "",
  supplierWarrantyEnd: "",
  supplierWarrantyStatus: "NONE",
  customerWarrantyEnd: "",
  customerWarrantyStatus: "NONE",
  warrantyEnd: "",
  warrantyStatus: "NONE",
  warrantyDaysLeft: 0,
  needsSerial: false,
  updatedAt: "2026-10-31T02:00:00.000Z",
  createdAt: "2026-01-05T02:00:00.000Z",
};

// ใบงาน J1 (เปิดอยู่) · L1 = เครื่องเดิม (รุ่นนอก master) · L2 = รุ่นใน master พร้อม snapshot ต้นทุน/ค่าติดตั้งเดิม
const JOB = {
  jobId: "J1", jobType: "INSTALL_SALE", jobSubType: "", jobName: "ทดสอบ EQ-02", technicianTeam: "ทีม A", technicianIds: [], salesPerson: "",
  model: "", filterUnit: "", contactName: "", phone: "", jobDate: "2026-11-02", jobTime: "", mapLink: "", note: "", status: "OPEN",
  createdAt: "2026-11-01T02:00:00.000Z", updatedAt: "2026-11-01T02:00:00.000Z", closedAt: "", signerName: "", closeNote: "", signature: "", photos: [],
  stage: "OPEN", rescheduleRequests: [],
};
const LINE_BASE = {
  jobId: "J1", hasRealSerial: true, note: "", linked: true, needsSerial: false, source: "JOB", createdAt: "2026-11-01T02:00:00.000Z",
  filterUnit: "", warrantyMonths: 0, warrantyStart: "", pmMode: "", pmRounds: 0, pmEveryMonths: 0, pmYears: 0, installDiscount: 0,
};
const JOB_LINES = [
  { ...LINE_BASE, id: "L1", equipmentId: "EQ-OLD", serial: "SN-OLD-1", model: "OLD-77", machineType: "ตู้แช่" },
  {
    ...LINE_BASE, id: "L2", equipmentId: "EQ-HF", serial: "SN-HF-1", model: "HF-78HS", machineType: "ตู้ฟรีส",
    standardCostSnapshot: { status: "APPROVED", source: "MASTER", masterId: "m1", type: "ตู้ฟรีส", category: "ตู้ยืน", model: "HF-78HS", standardCost: 1999, version: 1, approvedAt: "2026-10-30T02:00:00.000Z", approvedBy: "ผู้จัดการ", appliedAt: "2026-11-01T02:00:00.000Z" },
    installChargeSnapshot: { source: "MODEL_INDEX", modelIndexId: "x1", modelIndexValue: "HF-78HS", model: "HF-78HS", installCharge: 1500, status: "OK", capturedAt: "2026-11-01T02:00:00.000Z", verified: false, message: "" },
  },
];

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
  const cap = { posts: [], patches: [], picker: [], jobPosts: [], jobPatches: [], jobGets: 0 };
  const jobLines = JOB_LINES.map((l) => JSON.parse(JSON.stringify(l)));
  const hdr = { "access-control-allow-origin": WEB_ORIGIN, "access-control-allow-headers": "authorization, content-type, x-client", "content-type": "application/json" };
  const seeCost = role === "manager" || role === "admin";
  // ลงทะเบียนหลัง installMockApi → ทำงานก่อน (Playwright ใช้ route ล่าสุดก่อน) · อื่น ๆ ส่งต่อให้ mock เดิม
  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const m = req.method();
    if (m === "OPTIONS") return route.fallback();
    if (u.pathname === "/api/equipment-models" && m === "GET")
      return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify({ items: MASTER.map((r) => ({ ...r, standardCost: seeCost ? r.standardCost : null })), count: MASTER.length }) });
    if (u.pathname === "/api/equipment" && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      cap.posts.push(body);
      return route.fulfill({ status: 201, headers: hdr, body: JSON.stringify({ ...LEGACY_EQ, ...body, id: "EQ-NEW" }) });
    }
    if (u.pathname === "/api/equipment/EQ-LEG" && m === "GET") return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify(LEGACY_EQ) });
    // หลังบันทึกเครื่องใหม่ หน้าเปลี่ยนไป /equipment/EQ-NEW — ตอบข้อมูลที่บันทึกล่าสุด (ไม่ให้การ์ดอื่นพังจากรูปแบบ mock)
    if (u.pathname === "/api/equipment/EQ-NEW" && m === "GET") return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify({ ...LEGACY_EQ, ...(cap.posts.at(-1) ?? {}), id: "EQ-NEW" }) });
    if (/^\/api\/contracts\/by-equipment\/EQ-NEW$/.test(u.pathname))
      return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify({ equipment: { id: "EQ-NEW", serial: "SN-EQ02-NEW", model: "", status: "IN_STOCK" }, active: null, contracts: [] }) });
    if (u.pathname === "/api/equipment/EQ-NEW/finance") return route.fulfill({ status: 403, headers: hdr, body: JSON.stringify({ error: { code: "FORBIDDEN", message: "mock" } }) });
    // การ์ดอื่นในหน้าเครื่อง (ไม่เกี่ยวกับ EQ-02) — การ์ดการเงินตอบ 403 (แสดงสถานะผิดพลาดของการ์ด) · สัญญาตอบรูปแบบขั้นต่ำ
    if (u.pathname === "/api/equipment/EQ-LEG/finance") return route.fulfill({ status: 403, headers: hdr, body: JSON.stringify({ error: { code: "FORBIDDEN", message: "mock" } }) });
    if (u.pathname === "/api/contracts/by-equipment/EQ-LEG" && m === "GET")
      return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify({ equipment: { id: "EQ-LEG", serial: LEGACY_EQ.serial, model: LEGACY_EQ.model, status: LEGACY_EQ.status }, active: null, contracts: [] }) });
    if (u.pathname === "/api/equipment/EQ-LEG" && m === "PATCH") {
      const body = JSON.parse(req.postData() || "{}");
      cap.patches.push(body);
      return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify({ ...LEGACY_EQ, ...body, updatedAt: "2026-11-01T02:00:00.000Z" }) });
    }
    // ---- ใบงาน J1 (mock — ไม่ใช่ backend integration) ----
    if (u.pathname === "/api/jobs/J1" && m === "GET") return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify(JOB) });
    if (u.pathname === "/api/jobs/J1/equipment" && m === "GET") {
      cap.jobGets++;
      return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify({ items: jobLines, count: jobLines.length }) });
    }
    if (u.pathname === "/api/jobs/J1/equipment" && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      cap.jobPosts.push(body);
      const n = jobLines.length + 1;
      const line = {
        ...JOB_LINES[0],
        id: `L${n}`,
        equipmentId: body.equipmentId || `EQ-J${n}`,
        serial: body.serial || `TMP-000${n}`,
        hasRealSerial: !!body.serial,
        needsSerial: !body.serial,
        model: body.model || "",
        machineType: body.machineType || "",
        note: body.note || "",
        standardCostSnapshot: undefined,
        installChargeSnapshot: undefined,
      };
      jobLines.push(line);
      return route.fulfill({ status: 201, headers: hdr, body: JSON.stringify(line) });
    }
    const lm = u.pathname.match(/^\/api\/jobs\/J1\/equipment\/([^/]+)$/);
    if (lm && m === "PATCH") {
      const body = JSON.parse(req.postData() || "{}");
      cap.jobPatches.push({ lineId: lm[1], body });
      const line = jobLines.find((l) => l.id === lm[1]);
      if (line) Object.assign(line, body);
      return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify(line ?? {}) });
    }
    // การ์ดอื่นของหน้าใบงาน (ไม่เกี่ยวกับ EQ-02) → 403 (การ์ดแสดงสถานะผิดพลาดของตัวเอง)
    if (u.pathname.startsWith("/api/jobs/J1/")) return route.fulfill({ status: 403, headers: hdr, body: JSON.stringify({ error: { code: "FORBIDDEN", message: "mock" } }) });
    if (u.pathname === "/api/equipment/picker" && m === "GET") {
      cap.picker.push(Object.fromEntries(u.searchParams));
      const q = (u.searchParams.get("q") ?? "").toLowerCase();
      const all = [
        { id: "E1", serial: "SN-ABC-100", hasRealSerial: true, pendingSerial: false, internalCode: "M0001", display: "SN-ABC-100", model: "HF-78HS", machineType: "ตู้ฟรีส", condition: "NEW", conditionEffective: "NEW", status: "IN_STOCK", holderName: "ETE", customerId: "", siteId: "", filterUnit: "" },
        { id: "E2", serial: "SN-XYZ-200", hasRealSerial: true, pendingSerial: false, internalCode: "M0002", display: "SN-XYZ-200", model: "B-501", machineType: "เครื่องทำน้ำแข็ง", condition: "USED", conditionEffective: "USED", status: "IN_STOCK", holderName: "ETE", customerId: "", siteId: "", filterUnit: "" },
      ];
      const items = q ? all.filter((e) => e.serial.toLowerCase().includes(q) || e.internalCode.toLowerCase().includes(q)) : all;
      return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify({ items, total: items.length, models: [], machineTypes: ["ตู้แช่", "เครื่องทำน้ำแข็ง", "อื่น ๆ", "ตู้ฟรีส"] }) });
    }
    return route.fallback();
  });
  return { ctx, page, errors, cap, jobLines };
}

// ชื่อช่องตรงตัว (เช่น "รุ่น" ไม่ให้ไปตรงกับ "หมวดหมู่ (ใช้กรองรุ่น)") · RegExp สำหรับช่องที่มีดาวบังคับ
const box = (page, label) => page.getByRole("combobox", typeof label === "string" ? { name: label, exact: true } : { name: label }).first();
const MODEL = /^รุ่นเครื่อง/;
async function optionsOf(page, label) {
  await box(page, label).click();
  await page.waitForTimeout(250);
  const opts = await page.getByRole("option").allInnerTexts();
  await page.keyboard.press("Escape");
  return opts.map((t) => t.replace(/\s+/g, " ").trim());
}
async function typeIn(page, label, text) {
  const b = box(page, label);
  await b.click();
  await b.fill(text);
  await page.waitForTimeout(250);
  return (await page.getByRole("option").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
}
async function pick(page, label, text, optionText = null) {
  const opts = await typeIn(page, label, text);
  const o = page.getByRole("option").filter({ hasText: optionText ?? text }).first();
  await o.click();
  await page.waitForTimeout(250);
  return opts;
}
const val = (page, label) => box(page, label).inputValue();
// ปุ่มล้าง (×) ของช่องนั้น — ปุ่มแสดงเมื่อ hover/focus
async function clearField(page, label) {
  const b = box(page, label);
  await b.click();
  await b.locator("xpath=ancestor::div[contains(@class,'MuiAutocomplete-root')][1]").locator(".MuiAutocomplete-clearIndicator").click({ force: true });
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
}

async function equipmentNew(browser, mobile) {
  const tag = `EQ02 ${mobile ? "mobile 390x844" : "desktop 1366x768"} เพิ่มเครื่องใหม่`;
  const { ctx, page, errors, cap } = await open(browser, "manager", mobile ? [390, 844] : [1366, 768], mobile);
  try {
    await page.goto(`${FE_URL}/equipment/new`);
    await box(page, "ประเภทเครื่อง").waitFor({ timeout: 20_000 });
    await page.waitForTimeout(800);
    // คลิกแล้วแสดงตัวเลือกทั้งหมด (ประเภทระบบ + master ไม่ซ้ำ)
    const types = await optionsOf(page, "ประเภทเครื่อง");
    check(`${tag} คลิกประเภท → แสดงตัวเลือก`, ["ตู้แช่", "เครื่องทำน้ำแข็ง", "อื่น ๆ", "ตู้ฟรีส"].every((t) => types.includes(t)) && types.length === 4, types);
    // ค้นหา contains + ไม่สนตัวพิมพ์
    const found = await typeIn(page, "ประเภทเครื่อง", "น้ำแข็ง");
    check(`${tag} ค้นหาประเภท "น้ำแข็ง" (contains)`, found.length === 1 && found[0] === "เครื่องทำน้ำแข็ง", found);
    const none = await typeIn(page, "ประเภทเครื่อง", "zzz");
    const emptyText = await page.locator(".MuiAutocomplete-noOptions").innerText().catch(() => "");
    check(`${tag} Empty state`, none.length === 0 && emptyText.includes("ไม่พบรายการ"), emptyText);
    await page.keyboard.press("Escape");
    await pick(page, "ประเภทเครื่อง", "น้ำแข็ง", "เครื่องทำน้ำแข็ง");
    check(`${tag} เลือกประเภท → แสดงในช่อง`, (await val(page, "ประเภทเครื่อง")) === "เครื่องทำน้ำแข็ง", await val(page, "ประเภทเครื่อง"));
    // หมวดหมู่กรองตามประเภท
    const cats = await optionsOf(page, "หมวดหมู่");
    check(`${tag} หมวดหมู่กรองตามประเภท (4 รายการ ไม่มีตู้ยืน/ตู้นอน)`, cats.length === 4 && !cats.includes("ตู้ยืน") && !cats.includes("ตู้นอน"), cats);
    // รุ่นก่อนเลือกหมวดหมู่ = ทุกรุ่นของประเภท · รุ่นชื่อซ้ำแสดง 2 แถวต่างหมวดหมู่
    const mAll = await optionsOf(page, MODEL);
    const dups = mAll.filter((t) => t.startsWith("SRM-200AB"));
    check(`${tag} รุ่นชื่อซ้ำต่างหมวดหมู่แสดงแยก (ประเภท/หมวดหมู่กำกับ)`, dups.length === 2 && dups.some((t) => t.includes("/ หัว")) && dups.some((t) => t.includes("/ ถัง")), dups);
    // เลือกรุ่นซ้ำแถว "ถัง" → หมวดหมู่ = ถัง
    await typeIn(page, MODEL, "srm-200");
    await page.getByRole("option").filter({ hasText: "/ ถัง" }).first().click();
    await page.waitForTimeout(300);
    check(`${tag} เลือกรุ่นซ้ำแถวหมวดหมู่ ถัง → เติมหมวดหมู่ ถัง`, (await val(page, "หมวดหมู่")) === "ถัง" && (await val(page, MODEL)) === "SRM-200AB", [await val(page, "หมวดหมู่"), await val(page, MODEL)]);
    const helper = await page.getByText(/ต้นทุนมาตรฐาน 1,800 บาท/).count();
    check(`${tag} แสดงต้นทุนมาตรฐานของแถวที่เลือก (ค่าอ้างอิง)`, helper === 1, helper);
    // เปลี่ยนหมวดหมู่ → ล้างรุ่นที่ไม่สัมพันธ์
    await pick(page, "หมวดหมู่", "หัว", "หัว+ถัง");
    check(`${tag} เปลี่ยนหมวดหมู่ → ล้างรุ่นที่ไม่สัมพันธ์`, (await val(page, MODEL)) === "", await val(page, MODEL));
    const mHT = await optionsOf(page, MODEL);
    check(`${tag} รุ่นกรองตามหมวดหมู่ หัว+ถัง`, mHT.length === 1 && mHT[0].startsWith("IM-220A + B-301"), mHT);
    // ค้นหาแบบมีช่องว่าง/ตัวพิมพ์
    const sp = await typeIn(page, MODEL, "im-220a  + b");
    check(`${tag} ค้นหารุ่นไม่สนตัวพิมพ์/ช่องว่าง`, sp.length === 1, sp);
    // ไม่รับข้อความพิมพ์เอง
    await box(page, MODEL).fill("NOT-IN-MASTER");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    check(`${tag} พิมพ์รุ่นนอก master แล้วออกจากช่อง → ไม่บันทึกค่า`, (await val(page, MODEL)) === "", await val(page, MODEL));
    // Keyboard: เปิด/เลื่อน/เลือกด้วยปุ่ม
    await box(page, MODEL).focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    check(`${tag} Keyboard ArrowDown + Enter เลือกรุ่น`, (await val(page, MODEL)) === "IM-220A + B-301", await val(page, MODEL));
    // เปลี่ยนประเภท → ล้างหมวดหมู่/รุ่นที่ไม่สัมพันธ์
    await pick(page, "ประเภทเครื่อง", "ตู้แช่");
    check(`${tag} เปลี่ยนประเภท → ล้างหมวดหมู่และรุ่น`, (await val(page, "หมวดหมู่")) === "" && (await val(page, MODEL)) === "", [await val(page, "หมวดหมู่"), await val(page, MODEL)]);
    // Clear / Reselect
    await pick(page, MODEL, "RT-188");
    check(`${tag} เลือกรุ่น → เติมหมวดหมู่ ตู้นอน`, (await val(page, "หมวดหมู่")) === "ตู้นอน", await val(page, "หมวดหมู่"));
    await clearField(page, MODEL);
    const afterClear = await val(page, MODEL);
    await pick(page, MODEL, "RT-188");
    check(`${tag} Clear แล้วเลือกใหม่`, afterClear === "" && (await val(page, MODEL)) === "RT-188MA-F", { afterClear, after: await val(page, MODEL) });
    // บันทึก: body มีประเภท/หมวดหมู่/รุ่นตาม master · ไม่มีฟิลด์ราคาจาก master
    await page.getByLabel(/Serial/).first().fill("SN-EQ02-NEW");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.waitForTimeout(1200);
    const body = cap.posts[0] ?? null;
    check(
      `${tag} บันทึก → POST /api/equipment ประเภท/หมวดหมู่/รุ่นตาม master`,
      body && body.machineType === "ตู้แช่" && body.category === "ตู้นอน" && body.model === "RT-188MA-F",
      body ? { machineType: body.machineType, category: body.category, model: body.model } : "ไม่มีคำขอ"
    );
    const priceKeys = body ? Object.keys(body).filter((k) => /price|cost/i.test(k)) : [];
    check(`${tag} ไม่ส่งราคา/ต้นทุนจาก master ไปกับเครื่อง`, body && priceKeys.length === 0, priceKeys);
    check(`${tag} ไม่มี page error`, errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

async function equipmentLegacy(browser) {
  const tag = "EQ02 เครื่องเดิม (หมวดหมู่/รุ่นนอก master)";
  const { ctx, page, errors, cap } = await open(browser, "manager", [1366, 768]);
  try {
    await page.goto(`${FE_URL}/equipment/EQ-LEG`);
    await box(page, MODEL).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(800);
    const v = [await val(page, "ประเภทเครื่อง"), await val(page, "หมวดหมู่"), await val(page, MODEL)];
    check(`${tag} เปิดแล้วแสดงค่าเดิมครบ`, v[0] === "ตู้แช่" && v[1] === "ตู้ทรงสูง" && v[2] === "OLD-77", v);
    const note = await page.getByText("รุ่นนี้ยังไม่อยู่ในข้อมูลหลัก (ข้อมูลเดิม)").count();
    check(`${tag} แจ้งว่ารุ่นเป็นข้อมูลเดิม`, note === 1, note);
    // หมวดหมู่เดิม (ตู้ทรงสูง) ไม่มีใน master → ไม่มีรุ่น master ใต้หมวดหมู่นี้ · เหลือค่าเดิมกำกับ "ข้อมูลเดิม"
    const models = await optionsOf(page, MODEL);
    check(`${tag} ตัวเลือกรุ่นใต้หมวดหมู่เดิม = ค่าเดิมกำกับ "ข้อมูลเดิม" เท่านั้น`, models.length === 1 && models[0].startsWith("OLD-77") && models[0].includes("ข้อมูลเดิม"), models);
    const cats = await optionsOf(page, "หมวดหมู่");
    check(`${tag} ตัวเลือกหมวดหมู่ = master ใต้ประเภท + ค่าเดิมกำกับ "ข้อมูลเดิม"`, cats.includes("ตู้นอน") && cats.some((t) => t.startsWith("ตู้ทรงสูง") && t.includes("ข้อมูลเดิม")), cats);
    await page.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
    await page.waitForTimeout(1200);
    const body = cap.patches[0] ?? null;
    check(
      `${tag} บันทึกโดยไม่แก้ → ค่าเดิมไม่หาย/ไม่ถูกแทน`,
      body && body.machineType === "ตู้แช่" && body.category === "ตู้ทรงสูง" && body.model === "OLD-77",
      body ? { machineType: body.machineType, category: body.category, model: body.model } : "ไม่มีคำขอ"
    );
    const priceKeys = body ? Object.keys(body).filter((k) => /price|cost/i.test(k)) : [];
    check(`${tag} ไม่มีราคา/ต้นทุนถูกเติม`, body && priceKeys.length === 0, priceKeys);
    check(`${tag} ไม่มี page error`, errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

async function queueForm(browser, role, mobile) {
  const tag = `EQ02 คิว ${role} ${mobile ? "mobile" : "desktop"}`;
  const { ctx, page, errors, cap } = await open(browser, role, mobile ? [390, 844] : [1366, 768], mobile);
  try {
    await page.goto(`${FE_URL}/service-queue/new`);
    await page.getByRole("button", { name: "เพิ่มเครื่องที่ยังไม่มีในคลัง" }).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "เพิ่มเครื่องที่ยังไม่มีในคลัง" }).click();
    await page.waitForTimeout(400);
    const T = "ประเภทเครื่อง #1";
    await pick(page, T, "ฟรีส", "ตู้ฟรีส");
    const cats = await optionsOf(page, "หมวดหมู่ (ใช้กรองรุ่น)");
    check(`${tag} หมวดหมู่ (กรองรุ่น) ตามประเภท`, cats.length === 1 && cats[0] === "ตู้ยืน", cats);
    await pick(page, "หมวดหมู่ (ใช้กรองรุ่น)", "ตู้ยืน");
    const models = await optionsOf(page, "รุ่น");
    check(`${tag} รุ่นกรองตามประเภท+หมวดหมู่`, models.length === 1 && models[0].startsWith("HF-78HS"), models);
    await pick(page, "รุ่น", "hf");
    check(`${tag} เลือกรุ่น`, (await val(page, "รุ่น")) === "HF-78HS", await val(page, "รุ่น"));
    await pick(page, T, "แช่", "ตู้แช่");
    check(`${tag} เปลี่ยนประเภท → ล้างหมวดหมู่/รุ่น`, (await val(page, "หมวดหมู่ (ใช้กรองรุ่น)")) === "" && (await val(page, "รุ่น")) === "", [await val(page, "หมวดหมู่ (ใช้กรองรุ่น)"), await val(page, "รุ่น")]);
    // เลือกรุ่นโดยไม่เลือกหมวดหมู่ → เติมประเภทให้ และแสดงหมวดหมู่ของแถวนั้น
    await clearField(page, T);
    await pick(page, "รุ่น", "b-501");
    check(`${tag} เลือกรุ่นก่อน → เติมประเภท + แสดงหมวดหมู่`, (await val(page, T)) === "เครื่องทำน้ำแข็ง" && (await val(page, "หมวดหมู่ (ใช้กรองรุ่น)")) === "ถัง", [await val(page, T), await val(page, "หมวดหมู่ (ใช้กรองรุ่น)")]);
    // เลือกเครื่องจากคลัง + ค้นหา SN / รหัสเครื่อง (MachinePicker เดิม)
    await page.getByRole("button", { name: "เลือกเครื่องจากคลัง" }).click();
    await page.waitForTimeout(600);
    await page.getByTestId("picker-sn").fill("xyz");
    await page.getByTestId("picker-sn").press("Enter");
    await page.waitForTimeout(800);
    const rows = await page.getByTestId("picker-row").allInnerTexts();
    const lastQ = cap.picker.at(-1)?.q ?? "";
    check(`${tag} ค้นหา SN ตรงจากคลัง (พฤติกรรมเดิม)`, lastQ === "xyz" && rows.length === 1 && rows[0].includes("SN-XYZ-200"), { q: lastQ, rows: rows.length });
    await page.getByTestId("picker-sn").fill("m0001");
    await page.getByTestId("picker-sn").press("Enter");
    await page.waitForTimeout(800);
    const rows2 = await page.getByTestId("picker-row").allInnerTexts();
    check(`${tag} ค้นหารหัสเครื่อง`, rows2.length === 1 && rows2[0].includes("SN-ABC-100"), rows2.length);
    await page.getByTestId("picker-row").first().getByRole("button").first().click();
    await page.waitForTimeout(500);
    check(`${tag} เลือกเครื่องจากคลัง → เพิ่มในคิว (ผูกเครื่องเดิม)`, (await page.getByTestId("queue-item-stock").count()) === 1, await page.getByTestId("queue-item-stock").count());
    check(`${tag} ไม่มี page error`, errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

async function rbacRead(browser) {
  // ผู้ไม่เห็นต้นทุน (sales) — master ส่ง standardCost = null → ไม่แสดงต้นทุน · ยังเลือกได้
  const { ctx, page, errors } = await open(browser, "sales", [1366, 768]);
  try {
    await page.goto(`${FE_URL}/service-queue/new`);
    await page.getByRole("button", { name: "เพิ่มเครื่องที่ยังไม่มีในคลัง" }).click({ timeout: 20_000 });
    await page.waitForTimeout(400);
    await pick(page, "รุ่น", "SRM-125");
    const txt = await page.locator("body").innerText();
    check("EQ02 RBAC sales: เลือกรุ่นได้ ไม่เห็นต้นทุน", (await val(page, "รุ่น")) === "SRM-125A" && !txt.includes("ต้นทุนมาตรฐาน"), await val(page, "รุ่น"));
    check("EQ02 RBAC sales: ไม่มี page error", errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

// ---- ใบงาน: แท็บ "เพิ่มเครื่องใหม่" + แก้รายการเครื่อง (mock API) ----
const PRICE_KEY = /price|cost|charge|snapshot/i;
async function openAddNew(page) {
  await page.getByRole("button", { name: "เพิ่มเครื่อง", exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole("tab", { name: /เพิ่มเครื่องใหม่|ยังไม่มี Serial จริง/ }).click();
  await page.waitForTimeout(400);
}
async function jobNewMachine(browser, mobile) {
  const tag = `EQ02 ใบงาน ${mobile ? "mobile 390x844" : "desktop 1366x900"} เพิ่มเครื่องใหม่`;
  const { ctx, page, errors, cap, jobLines } = await open(browser, "manager", mobile ? [390, 844] : [1366, 900], mobile);
  try {
    await page.goto(`${FE_URL}/jobs/J1`);
    await page.getByRole("button", { name: "เพิ่มเครื่อง", exact: true }).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(600);
    const before = await page.locator('[data-testid="line-standard-cost"]').allInnerTexts();
    await openAddNew(page);
    const T = "ประเภทเครื่อง";
    const C = "หมวดหมู่ (ใช้กรองรุ่น)";
    const R = "รุ่น";
    const types = await optionsOf(page, T);
    check(`${tag} ประเภท = ประเภทระบบ + master ("อื่น ๆ" คงไว้)`, types.length === 4 && types.includes("อื่น ๆ") && types.includes("ตู้ฟรีส"), types);
    await pick(page, T, "น้ำแข็ง", "เครื่องทำน้ำแข็ง");
    const cats = await optionsOf(page, C);
    check(`${tag} หมวดหมู่กรองตามประเภท`, cats.length === 4 && !cats.includes("ตู้ยืน"), cats);
    const dups = (await optionsOf(page, R)).filter((t) => t.startsWith("SRM-200AB"));
    check(`${tag} รุ่นชื่อซ้ำต่างหมวดหมู่แสดงแยก`, dups.length === 2, dups);
    await typeIn(page, R, "srm-200");
    await page.getByRole("option").filter({ hasText: "/ ถัง" }).first().click();
    await page.waitForTimeout(300);
    check(`${tag} เลือกรุ่นซ้ำแถว ถัง → หมวดหมู่ ถัง`, (await val(page, C)) === "ถัง" && (await val(page, R)) === "SRM-200AB", [await val(page, C), await val(page, R)]);
    // เปลี่ยนหมวดหมู่ → ล้างรุ่น · เปลี่ยนประเภท → ล้างหมวดหมู่/รุ่น
    await pick(page, C, "หัว", "หัว+ถัง");
    check(`${tag} เปลี่ยนหมวดหมู่ → ล้างรุ่น`, (await val(page, R)) === "", await val(page, R));
    await pick(page, T, "ฟรีส", "ตู้ฟรีส");
    check(`${tag} เปลี่ยนประเภท → ล้างหมวดหมู่และรุ่น`, (await val(page, C)) === "" && (await val(page, R)) === "", [await val(page, C), await val(page, R)]);
    // ไม่รับข้อความพิมพ์เอง + คำแนะนำให้เพิ่ม master
    await box(page, R).fill("NOT-IN-MASTER");
    const empty = await page.locator(".MuiAutocomplete-noOptions").innerText().catch(() => "");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    const hint = await page.getByTestId("job-new-master-hint").innerText();
    check(`${tag} พิมพ์รุ่นนอก master → ไม่บันทึกค่า · Empty state · แนะนำให้เพิ่ม master`, (await val(page, R)) === "" && empty.includes("ไม่พบรายการ") && hint.includes("รุ่นเครื่อง (ข้อมูลหลัก)"), { value: await val(page, R), empty, hint });
    // Keyboard: เลือกรุ่นด้วย ArrowDown + Enter
    await box(page, R).focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    check(`${tag} Keyboard เลือกรุ่น`, (await val(page, R)) === "HF-78HS", await val(page, R));
    // Clear / Reselect → รุ่นซ้ำแถว ถัง แล้วบันทึกพร้อม SN
    // ล้างประเภท (หมวดหมู่ ตู้ยืน ที่เติมจากรุ่นยังอยู่ — ตรงกับกติกา changeType เดิม) แล้วล้างหมวดหมู่
    await clearField(page, T);
    await clearField(page, C);
    await pick(page, R, "srm-200", "/ ถัง");
    check(`${tag} Clear แล้วเลือกรุ่นก่อน → เติมประเภท`, (await val(page, T)) === "เครื่องทำน้ำแข็ง" && (await val(page, C)) === "ถัง", [await val(page, T), await val(page, C)]);
    await page.getByLabel("Serial Number (SN)").fill("SN-JOB-NEW");
    await page.getByRole("button", { name: "เพิ่มเครื่องใหม่ (SN จริง)" }).click();
    await page.waitForTimeout(1200);
    const b1 = cap.jobPosts[0] ?? null;
    const keys1 = b1 ? Object.keys(b1).sort() : [];
    check(
      `${tag} บันทึก (SN จริง) → payload ตาม API: serial, createNew, model, machineType, modelMasterId (แถวที่เลือก), note`,
      b1 && b1.serial === "SN-JOB-NEW" && b1.createNew === true && b1.model === "SRM-200AB" && b1.machineType === "เครื่องทำน้ำแข็ง" && b1.modelMasterId === "m7" && b1.note === "",
      b1
    );
    check(`${tag} payload ไม่มีหมวดหมู่ และไม่มีฟิลด์ราคา/ต้นทุน`, b1 && !("category" in b1) && !keys1.some((k) => PRICE_KEY.test(k)), keys1);
    const shown = await page.locator("body").innerText();
    check(`${tag} Save → Reload แสดงเครื่องใหม่ในใบงาน`, cap.jobGets >= 2 && shown.includes("SN-JOB-NEW") && shown.includes("SRM-200AB"), { gets: cap.jobGets });
    // เพิ่มเครื่องที่ยังไม่มี SN (เลือกรุ่นอย่างเดียว)
    await openAddNew(page);
    await pick(page, R, "RT-188");
    await page.getByRole("button", { name: "เพิ่มเครื่องที่ยังไม่มี Serial" }).click();
    await page.waitForTimeout(1200);
    const b2 = cap.jobPosts[1] ?? null;
    check(
      `${tag} บันทึก (ยังไม่มี SN) → payload model + machineType + modelMasterId · ไม่มี serial/category`,
      b2 && b2.model === "RT-188MA-F" && b2.machineType === "ตู้แช่" && b2.modelMasterId === "m2" && !b2.serial && !("category" in b2) && !Object.keys(b2).some((k) => PRICE_KEY.test(k)),
      b2
    );
    // Edit: แถวใหม่ที่เพิ่ม → ประเภทจำกัดตามรุ่น
    const editBtns = page.getByRole("button", { name: "ข้อมูลเครื่อง" });
    const idxNew = jobLines.findIndex((l) => l.serial === "SN-JOB-NEW");
    await editBtns.nth(idxNew).click();
    await page.waitForTimeout(400);
    const lt = await optionsOf(page, "ประเภทเครื่อง");
    check(`${tag} Edit แถวใหม่ → ประเภทตามรุ่นใน master`, lt.length === 1 && lt[0] === "เครื่องทำน้ำแข็ง", lt);
    const after = await page.locator('[data-testid="line-standard-cost"]').allInnerTexts();
    check(`${tag} ต้นทุนมาตรฐานของรายการเดิมไม่เปลี่ยน`, before.length >= 1 && after.slice(0, before.length).join("|") === before.join("|"), { before, after });
    check(`${tag} ไม่มี page error`, errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

async function jobLineEdit(browser) {
  const tag = "EQ02 ใบงาน แก้รายการเครื่อง";
  const { ctx, page, errors, cap } = await open(browser, "manager", [1366, 900]);
  try {
    await page.goto(`${FE_URL}/jobs/J1`);
    await page.getByRole("button", { name: "ข้อมูลเครื่อง" }).first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(600);
    const editBtns = page.getByRole("button", { name: "ข้อมูลเครื่อง" });
    // L2 (รุ่นใน master) → ประเภทเฉพาะของรุ่น · ไม่แก้ = ไม่ส่งคำขอ
    await editBtns.nth(1).click();
    await page.waitForTimeout(400);
    const lineType = page.getByTestId("job-line-machine-type");
    check(`${tag} L2 แสดงประเภทเดิม`, (await lineType.inputValue()) === "ตู้ฟรีส", await lineType.inputValue());
    const t2 = await optionsOf(page, "ประเภทเครื่อง");
    check(`${tag} L2 รุ่นใน master → ประเภทจำกัดตามรุ่น (กัน 400 จาก backend)`, t2.length === 1 && t2[0] === "ตู้ฟรีส", t2);
    await page.getByRole("button", { name: "บันทึกข้อมูลเครื่อง" }).click();
    await page.waitForTimeout(600);
    check(`${tag} L2 บันทึกโดยไม่แก้ → ไม่ส่ง PATCH`, cap.jobPatches.length === 0, cap.jobPatches);
    // L1 (รุ่นนอก master) → ทุกประเภท · ค้นหา · เปลี่ยนแล้วส่งเฉพาะประเภท
    await editBtns.nth(0).click();
    await page.waitForTimeout(400);
    check(`${tag} L1 แสดงประเภทเดิม`, (await page.getByTestId("job-line-machine-type").inputValue()) === "ตู้แช่", await page.getByTestId("job-line-machine-type").inputValue());
    const t1 = await optionsOf(page, "ประเภทเครื่อง");
    check(`${tag} L1 รุ่นนอก master → ทุกประเภทที่ยอมรับ`, t1.length === 4, t1);
    const f1 = await typeIn(page, "ประเภทเครื่อง", "แข็ง");
    check(`${tag} L1 ค้นหาประเภท (contains)`, f1.length === 1 && f1[0] === "เครื่องทำน้ำแข็ง", f1);
    await page.getByRole("option").first().click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "บันทึกข้อมูลเครื่อง" }).click();
    await page.waitForTimeout(1000);
    const pb = cap.jobPatches[0] ?? null;
    check(`${tag} L1 PATCH ส่งเฉพาะประเภท (ไม่มี model/category/ราคา)`, pb && pb.lineId === "L1" && JSON.stringify(pb.body) === JSON.stringify({ machineType: "เครื่องทำน้ำแข็ง" }), pb);
    const txt = await page.locator("body").innerText();
    check(`${tag} Reload แสดงประเภทใหม่ของ L1`, txt.includes("เครื่องทำน้ำแข็ง"), "");
    check(`${tag} ไม่มี page error`, errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

async function jobPickFromStock(browser) {
  const tag = "EQ02 ใบงาน เลือกจากคลัง / ค้นหา SN";
  const { ctx, page, errors, cap } = await open(browser, "manager", [1366, 900]);
  try {
    await page.goto(`${FE_URL}/jobs/J1`);
    await page.getByRole("button", { name: "เพิ่มเครื่อง", exact: true }).click({ timeout: 20_000 });
    await page.waitForTimeout(600);
    await page.getByTestId("picker-sn").fill("abc");
    await page.getByTestId("picker-sn").press("Enter");
    await page.waitForTimeout(800);
    const rows = await page.getByTestId("picker-row").allInnerTexts();
    check(`${tag} ค้นหา SN ตรง (พฤติกรรมเดิม)`, (cap.picker.at(-1)?.q ?? "") === "abc" && rows.length === 1 && rows[0].includes("SN-ABC-100"), rows.length);
    await page.getByTestId("picker-row").first().getByRole("button").first().click();
    await page.waitForTimeout(1200);
    const b = cap.jobPosts[0] ?? null;
    check(`${tag} เลือกเครื่อง → POST อ้าง equipmentId เดิม (ไม่สร้างเครื่องใหม่)`, b && b.equipmentId === "E1" && !b.createNew && !b.serial, b);
    check(`${tag} ไม่มี page error`, errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

async function jobCreateMode(browser) {
  const tag = "EQ02 เปิดงานใหม่ (โหมด create)";
  const { ctx, page, errors, cap } = await open(browser, "manager", [1366, 900]);
  try {
    await page.goto(`${FE_URL}/jobs/new`);
    await page.getByRole("button", { name: "เพิ่มเครื่อง", exact: true }).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(600);
    await openAddNew(page);
    await pick(page, "รุ่น", "B-501");
    check(`${tag} เลือกรุ่น → เติมประเภท/หมวดหมู่`, (await val(page, "ประเภทเครื่อง")) === "เครื่องทำน้ำแข็ง" && (await val(page, "หมวดหมู่ (ใช้กรองรุ่น)")) === "ถัง", [await val(page, "ประเภทเครื่อง"), await val(page, "หมวดหมู่ (ใช้กรองรุ่น)")]);
    await page.getByRole("button", { name: "เพิ่มเครื่องที่ยังไม่มี Serial" }).click();
    await page.waitForTimeout(500);
    const txt = await page.locator("body").innerText();
    check(`${tag} รายการรอบันทึกแสดงรุ่น`, txt.includes("B-501"), "");
    await page.getByRole("button", { name: "ข้อมูลเครื่อง" }).first().click();
    await page.waitForTimeout(400);
    const t = await page.getByTestId("job-line-machine-type").inputValue();
    const opts = await optionsOf(page, "ประเภทเครื่อง");
    check(`${tag} แก้รายการรอบันทึก → ประเภทที่เลือกไว้ + จำกัดตามรุ่น`, t === "เครื่องทำน้ำแข็ง" && opts.length === 1, { t, opts });
    check(`${tag} ไม่มีคำขอเพิ่มเครื่องไป API ก่อนบันทึกใบงาน (โหมด create)`, cap.jobPosts.length === 0, cap.jobPosts.length);
    check(`${tag} ไม่มี page error`, errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

async function jobRbac(browser) {
  const { ctx, page, errors } = await open(browser, "sales", [1366, 900]);
  try {
    await page.goto(`${FE_URL}/jobs/J1`);
    await page.getByText("รายละเอียดเครื่อง").first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(800);
    const add = await page.getByRole("button", { name: "เพิ่มเครื่อง", exact: true }).count();
    const edit = await page.getByRole("button", { name: "ข้อมูลเครื่อง" }).count();
    const cost = await page.locator('[data-testid="line-standard-cost"]').count();
    check("EQ02 RBAC ใบงาน sales (ไม่มี jobs:edit): ไม่มีปุ่มเพิ่ม/แก้เครื่อง · ไม่เห็นต้นทุน", add === 0 && edit === 0 && cost === 0, { add, edit, cost });
    check("EQ02 RBAC ใบงาน sales: ไม่มี page error", errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch();
const t0 = Date.now();
try {
  await equipmentNew(browser, false);
  await equipmentNew(browser, true);
  await equipmentLegacy(browser);
  await queueForm(browser, "manager", false);
  await queueForm(browser, "sales", true);
  await rbacRead(browser);
  await jobNewMachine(browser, false);
  await jobNewMachine(browser, true);
  await jobLineEdit(browser);
  await jobPickFromStock(browser);
  await jobCreateMode(browser);
  await jobRbac(browser);
} finally {
  await browser.close();
}
const origins = [...net.origins.keys()];
const foreign = origins.filter((o) => o !== WEB_ORIGIN && o !== API_ORIGIN && o !== "null");
const reached = foreign.filter((o) => !net.failed.has(o));
check("NET-01 ไม่มีคำขอสำเร็จไปโดเมนอื่น (API ถูก mock · โดเมนอื่นถูก abort)", reached.length === 0, { origins, aborted: [...net.failed] });

const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
console.log(`\n${LABEL}: ${pass}/${results.length} PASS · ${fail} FAIL · ${Math.round((Date.now() - t0) / 1000)}s`);
if (OUT) writeFileSync(OUT, JSON.stringify({ label: LABEL, pass, fail, total: results.length, results }, null, 2));
process.exit(fail ? 1 : 0);
