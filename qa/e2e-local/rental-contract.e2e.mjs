// สัญญาเช่าเครื่องทำน้ำแข็ง (ต้นฉบับ/คู่ฉบับ) — Render จริงบน Chromium + mock API (ไม่มีคำขอไป backend/UAT)
//
// รัน:  npm run build && npx next start -p 3001 &
//       FE_URL=http://localhost:3001 OUT=<โฟลเดอร์ผลลัพธ์ นอก repo> node qa/e2e-local/rental-contract.e2e.mjs
// ผลลัพธ์ (ภาพ/PDF/JSON) เขียนลง OUT เท่านั้น — เป็นหลักฐาน QA ไม่ commit
//
// ข้อมูลในไฟล์นี้เป็นข้อมูลทดสอบ (mock) สำหรับตรวจรูปแบบเอกสาร ไม่ใช่ข้อมูลลูกค้าจริง
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { API_BASE, deniedFor, installMockApi } from "./mockApi.mjs";

const FE = process.env.FE_URL ?? "http://localhost:3001";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(FE)) throw new Error("FE_URL ต้องเป็น localhost");
const OUT = process.env.OUT ?? "./rental-contract-out";
mkdirSync(OUT, { recursive: true });

const PARTNER = { id: "p1", name: "บริษัท ทดสอบระบบ จำกัด", type: "CUSTOMER", phone: "", email: "", address: "ที่อยู่ในฐานลูกค้า", taxId: "0105555000001", contactPerson: "", note: "", customerCode: "T001", customerKind: "COMPANY", createdAt: "", updatedAt: "" };
const SITE = { id: "s1", partnerId: "p1", branchNo: "01", storeName: "สาขาทดสอบ สีลม", contactPerson: "", phone: "", address: "1 ถนนสีลม", subdistrict: "สุริยวงศ์", district: "บางรัก", province: "กรุงเทพมหานคร", postcode: "10500", zone: "", lat: 0, lng: 0, active: true, note: "", addressFull: "1 ถนนสีลม บางรัก กรุงเทพมหานคร 10500", label: "สาขาทดสอบ สีลม (สาขา 01)", createdAt: "", updatedAt: "" };
const CONTRACT = {
  id: "c1", contractNo: "CT-2026-0007", type: "RENTAL", status: "ACTIVE", partnerId: "p1", siteId: "s1",
  customerName: "บริษัท ทดสอบระบบ จำกัด", customerPhone: "", customerAddress: "99/1 หมู่ 2 ถนนทดสอบ ตำบลบางเตย อำเภอสามพราน จังหวัดนครปฐม 73210",
  siteAddress: "", siteLat: 0, siteLng: 0, zone: "", siteAddressFull: "", serial: "ICE-TEST-0001", model: "IM-240AME", startDate: "2026-11-01",
  rentPerMonth: 2500, periodMonths: 12, deposit: 5000, totalPrice: 0, downPayment: 0, installmentCount: 0, installments: [], note: "",
  createdAt: "", updatedAt: "", endDate: "2027-11-01", totalAmount: 30000, paidAmount: 0, balance: 30000, paidCount: 0, nextDueDate: "",
  equipment: { id: "e1", serial: "ICE-TEST-0001", model: "IM-240AME", status: "RENTED" }, equipmentId: "e1",
};
const LONG = "เลขที่ 1234/567 อาคารทดสอบความยาวที่อยู่พิเศษ ชั้น 25 ห้อง 2501-2510 ถนนเจริญกรุงตัดใหม่ แขวงบางคอแหลม เขตบางคอแหลม กรุงเทพมหานคร 10120 (ตรงข้ามศูนย์การค้า ทางเข้าด้านหลังอาคารจอดรถ ประตู 3)";

const SCENARIOS = {
  full: { contract: CONTRACT, partner: PARTNER, sites: [SITE] },
  long: {
    contract: { ...CONTRACT, customerName: "บริษัท ทดสอบระบบชื่อยาวมากเป็นพิเศษเพื่อทดสอบการตัดบรรทัด อินเตอร์เนชั่นแนล โฮลดิ้งส์ จำกัด (มหาชน)", customerAddress: LONG, siteAddress: LONG, rentPerMonth: 1234567.5, deposit: 9876543.25, periodMonths: 36, endDate: "2029-11-01" },
    partner: PARTNER,
    sites: [{ ...SITE, storeName: "สาขาทดสอบชื่อยาวพิเศษ ศูนย์การค้าแห่งใหม่ ชั้นใต้ดิน โซนอาหาร" }],
  },
  legacy: { contract: { ...CONTRACT, partnerId: "", siteId: "", customerAddress: "", periodMonths: 18, deposit: 0, endDate: "2028-05-01", status: "DRAFT" }, partner: null, sites: [] },
};

const ME_PERMS = {
  manager: null, // ตาม fixture
  "acc-view-only": ["dashboard:view", "contracts:view", "contracts:create", "partners:view"], // ACC ปัจจุบัน: ดูได้ ไม่มี contracts:print
  tech: null,
};

async function open(browser, { role, scenario, copy }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const baseRole = role === "acc-view-only" ? "acc" : role;
  const log = await installMockApi(page, baseRole, { webOrigin: new URL(FE).origin });
  const sc = SCENARIOS[scenario];
  const api = new URL(API_BASE).origin;
  await page.route(`${api}/**`, async (route) => {
    const u = new URL(route.request().url());
    const method = route.request().method();
    const json = (status, body) => route.fulfill({ status, headers: { "access-control-allow-origin": new URL(FE).origin, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fallback();
    if (u.pathname === "/api/auth/me" && ME_PERMS[role]) {
      return json(200, { user: { id: "u-acc", email: "acc@qa.local", name: "QA acc", role: "acc", active: true, mustChangePassword: false }, permissions: ME_PERMS[role] });
    }
    const perms = ME_PERMS[role];
    const denied = perms ? !({ "/api/contracts/c1": "contracts:view", "/api/partners/p1": "partners:view", "/api/partners/p1/sites": "partners:view" }[u.pathname] ? perms.includes({ "/api/contracts/c1": "contracts:view", "/api/partners/p1": "partners:view", "/api/partners/p1/sites": "partners:view" }[u.pathname]) : true) : deniedFor(baseRole, method, u.pathname);
    if (u.pathname === "/api/contracts/c1") return denied ? json(403, { error: "FORBIDDEN", message: "ไม่มีสิทธิ์" }) : json(200, sc.contract);
    if (u.pathname === "/api/partners/p1") return denied || !sc.partner ? json(denied ? 403 : 404, { error: "X", message: denied ? "ไม่มีสิทธิ์" : "ไม่พบ" }) : json(200, sc.partner);
    if (u.pathname === "/api/partners/p1/sites") return denied ? json(403, { error: "FORBIDDEN", message: "ไม่มีสิทธิ์" }) : json(200, { items: sc.sites, count: sc.sites.length });
    return route.fallback();
  });
  await page.goto(`${FE}/contracts/c1/document?copy=${copy}`, { waitUntil: "networkidle" });
  return { ctx, page, log };
}

async function inspect(page) {
  return page.evaluate(() => {
    const sheets = [...document.querySelectorAll(".rc-sheet")].map((s) => {
      const r = s.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(s).paddingBottom);
      const body = s.querySelector(".rc-body");
      const last = body?.lastElementChild?.getBoundingClientRect();
      const footer = s.querySelector(".rc-footer")?.getBoundingClientRect();
      const limit = footer ? footer.top : r.bottom - pad;
      // ทุกบรรทัดข้อความต้องอยู่ในขอบกระดาษ (ไม่ล้น/ไม่ถูกตัด)
      const outside = [...s.querySelectorAll("p")].filter((p) => {
        const pr = p.getBoundingClientRect();
        return pr.bottom > r.bottom - pad + 0.5 || pr.right > r.right - 0.5 || pr.left < r.left + 0.5;
      }).length;
      // ข้อความทับกัน: ย่อหน้าที่กล่องซ้อนกันในแนวตั้ง (คอลัมน์ลายเซ็นแยกซ้าย/ขวา จึงเทียบเฉพาะคอลัมน์เดียวกัน)
      const ps = [...s.querySelectorAll("p")].map((p) => ({ col: p.closest(".rc-sign-col")?.className ?? "main", r: p.getBoundingClientRect() }));
      let overlaps = 0;
      for (let i = 0; i < ps.length; i++)
        for (let j = i + 1; j < ps.length; j++)
          if (ps[i].col === ps[j].col && ps[i].r.bottom > ps[j].r.top + 0.5 && ps[j].r.bottom > ps[i].r.top + 0.5) overlaps++;
      return {
        page: s.dataset.page,
        copy: s.dataset.copy,
        widthMm: +(r.width / 3.7795).toFixed(2),
        heightMm: +(r.height / 3.7795).toFixed(2),
        fit: getComputedStyle(s).getPropertyValue("--rc-fit").trim(),
        spareMm: +((limit - (last?.bottom ?? 0)) / 3.7795).toFixed(2),
        outside,
        overlaps,
        copyLabel: s.querySelector("[data-testid=rc-copy-label]")?.textContent ?? "",
        blanks: [...s.querySelectorAll(".rc-blank")].map((b) => b.dataset.field),
        font: getComputedStyle(s.querySelector("p")).fontFamily,
        text: s.innerText,
      };
    });
    return { ready: document.querySelector(".rc-viewer")?.dataset.ready, font: document.querySelector(".rc-viewer")?.dataset.font, sheets, toolbar: document.querySelector(".rc-toolbar")?.innerText ?? "" };
  });
}

const results = [];
const browser = await chromium.launch();
try {
  for (const scenario of Object.keys(SCENARIOS)) {
    for (const copy of ["original", "duplicate", "both"]) {
      const { ctx, page } = await open(browser, { role: "manager", scenario, copy });
      await page.waitForSelector(".rc-viewer[data-ready='1']", { timeout: 20000 });
      await page.evaluate(() => document.fonts.ready);
      const info = await inspect(page);
      const tag = `${scenario}-${copy}`;
      await page.screenshot({ path: `${OUT}/screen-${tag}.png`, fullPage: true });
      await page.emulateMedia({ media: "print" });
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      writeFileSync(`${OUT}/print-${tag}.pdf`, pdf);
      const printInfo = await inspect(page);
      results.push({ scenario, copy, screen: { ...info, sheets: info.sheets.map(({ text, ...x }) => x) }, print: { sheets: printInfo.sheets.map(({ text, ...x }) => x) }, text: info.sheets.map((s) => s.text) });
      await ctx.close();
    }
  }
  // RBAC: มี contracts:view แต่ไม่มี contracts:print · ไม่มี contracts:view
  for (const role of ["acc-view-only", "tech"]) {
    const { ctx, page, log } = await open(browser, { role, scenario: "full", copy: "original" });
    await page.waitForTimeout(1500);
    const toolbar = await page.locator(".rc-toolbar").innerText().catch(() => "");
    const printButtons = await page.locator("button", { hasText: "พิมพ์" }).count();
    const sheetsScreen = await page.locator(".rc-sheet").count();
    await page.emulateMedia({ media: "print" });
    const printVisible = await page.locator(".rc-sheet").first().isVisible().catch(() => false);
    const bodyText = (await page.locator("body").innerText()).slice(0, 400);
    await page.screenshot({ path: `${OUT}/rbac-${role}.png`, fullPage: false });
    results.push({ rbac: role, toolbar, printButtons, sheetsScreen, sheetVisibleWhenPrinting: printVisible, bodyText, contractCalls: log.filter((l) => l.path.includes("contract")) });
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
console.log(`OK ${results.length} รายการ → ${OUT}/results.json`);
