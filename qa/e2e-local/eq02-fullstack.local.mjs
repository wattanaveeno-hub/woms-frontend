// EQ-02 BC-1/BC-2 Full-stack ในเครื่อง: Browser → Frontend (localhost) → Backend จริง (localhost:8000) → MongoDB ในเครื่อง
// ไม่ใช้ mock API · ห้ามชี้ไป UAT/Atlas — สคริปต์ปฏิเสธ URL ที่ไม่ใช่ localhost
//
// ต้องเตรียมเอง (ดูรายงาน 31): mongod replica set ที่ 127.0.0.1 · backend รันด้วย MONGO_DB=woms_qa_* · seed ผู้ใช้/ใบงาน/รุ่น
// ใช้:  FE_URL=http://localhost:3002 API_URL=http://localhost:8000 QA_EMAIL=admin@local.test QA_PASSWORD=... QA_JOB=JN-LOCAL-1 \
//       node qa/e2e-local/eq02-fullstack.local.mjs [out.json]
// ผลที่ "บันทึกจริง" ตรวจผ่าน GET /api/equipment/:id ของ backend (อ่านจากฐานข้อมูล) — ตรวจเอกสารใน MongoDB ตรงแยกอีกชั้นได้
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("@playwright/test"));
}

const FE_URL = (process.env.FE_URL ?? "http://localhost:3002").replace(/\/$/, "");
const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const EMAIL = process.env.QA_EMAIL ?? "";
const PASSWORD = process.env.QA_PASSWORD ?? "";
const JOB = process.env.QA_JOB ?? "JN-LOCAL-1";
const OUT = process.argv[2];
for (const u of [FE_URL, API_URL]) {
  if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(u).hostname)) {
    console.error(`ต้องเป็น localhost เท่านั้น (ได้ ${u})`);
    process.exit(2);
  }
}
if (!EMAIL || !PASSWORD) {
  console.error("ต้องกำหนด QA_EMAIL / QA_PASSWORD ของผู้ใช้ทดสอบในฐานข้อมูลในเครื่อง");
  process.exit(2);
}

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${typeof detail === "string" ? detail : JSON.stringify(detail ?? "").slice(0, 400)}`);
};
const origins = new Set();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "th-TH" });
ctx.on("request", (r) => origins.add(new URL(r.url()).origin));
await ctx.route("**/*", (route) => {
  const o = new URL(route.request().url()).origin;
  return o === new URL(FE_URL).origin || o === new URL(API_URL).origin || o === "null" ? route.continue() : route.abort();
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
const posts = [];
page.on("response", async (res) => {
  const req = res.request();
  if (req.method() === "POST" && new URL(req.url()).pathname === `/api/jobs/${JOB}/equipment`) {
    posts.push({ status: res.status(), body: JSON.parse(req.postData() || "{}"), res: await res.json().catch(() => null) });
  }
});
const box = (label) => page.getByRole("combobox", { name: label, exact: true }).first();
const val = (label) => box(label).inputValue();
async function pick(label, text, optionText = null) {
  const b = box(label);
  await b.click();
  await b.fill(text);
  await page.waitForTimeout(400);
  await page.getByRole("option").filter({ hasText: optionText ?? text }).first().click();
  await page.waitForTimeout(300);
}
async function openAddNew() {
  await page.getByRole("button", { name: "เพิ่มเครื่อง", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("tab", { name: /เพิ่มเครื่องใหม่|ยังไม่มี Serial จริง/ }).click();
  await page.waitForTimeout(500);
}
let token = "";
async function apiGet(path) {
  const r = await fetch(`${API_URL}${path}`, { headers: { authorization: `Bearer ${token}` } });
  return { status: r.status, body: await r.json().catch(() => null) };
}

try {
  await page.goto(`${FE_URL}/login`);
  await page.getByLabel(/อีเมล/).first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
  token = await page.evaluate(() => localStorage.getItem("woms_token") ?? "");
  check("FS login ผ่าน backend จริง", !!token, token ? "token ok" : "no token");
  const models = await apiGet("/api/equipment-models");
  const rows = models.body?.items ?? [];
  const idOf = (model, category) => rows.find((r) => r.model === model && r.category === category)?.id;
  check("FS backend ตอบ Equipment Model Master จากฐานในเครื่อง", rows.length >= 3 && !!idOf("SRM-200AB", "ถัง"), rows.map((r) => `${r.model}/${r.category}`));

  await page.goto(`${FE_URL}/jobs/${JOB}`);
  await page.getByRole("button", { name: "เพิ่มเครื่อง", exact: true }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(800);

  // BC-1: SN จริง + รุ่นซ้ำ เลือกแถวหมวดหมู่ "ถัง"
  await openAddNew();
  await pick("รุ่น", "srm-200", "/ ถัง");
  check("FS BC-1 UI เลือกรุ่นซ้ำแถว ถัง → ประเภทเติมให้", (await val("ประเภทเครื่อง")) === "เครื่องทำน้ำแข็ง" && (await val("หมวดหมู่ (ใช้กรองรุ่น)")) === "ถัง", [await val("ประเภทเครื่อง"), await val("หมวดหมู่ (ใช้กรองรุ่น)")]);
  const sn = `SN-FS-${Date.now() % 100000}`;
  await page.getByLabel("Serial Number (SN)").fill(sn);
  await page.getByRole("button", { name: "เพิ่มเครื่องใหม่ (SN จริง)" }).click();
  await page.waitForTimeout(2500);
  const p1 = posts[0];
  check("FS BC-1 POST /api/jobs/:id/equipment → 201 จาก backend จริง", p1?.status === 201, p1 ? { status: p1.status, body: p1.body } : "no request");
  const e1 = p1?.res?.equipmentId ? await apiGet(`/api/equipment/${p1.res.equipmentId}`) : null;
  check(
    "FS BC-1 เครื่องที่บันทึกจริง: machineType เครื่องทำน้ำแข็ง · category ถัง · modelMasterId = แถวถัง · SN จริง",
    e1?.body?.serial === sn && e1?.body?.machineType === "เครื่องทำน้ำแข็ง" && e1?.body?.category === "ถัง" && e1?.body?.modelMasterId === idOf("SRM-200AB", "ถัง") && e1?.body?.hasRealSerial === true,
    e1 ? { serial: e1.body?.serial, machineType: e1.body?.machineType, category: e1.body?.category, modelMasterId: e1.body?.modelMasterId } : null
  );

  // BC-2: ไม่มี SN · รุ่นในข้อมูลหลักชุดเดียว
  await openAddNew();
  await pick("รุ่น", "hf-78", "HF-78HS");
  await page.getByRole("button", { name: "เพิ่มเครื่องที่ยังไม่มี Serial" }).click();
  await page.waitForTimeout(2500);
  const p2 = posts[1];
  check("FS BC-2 POST (ไม่มี SN) → 201", p2?.status === 201, p2 ? { status: p2.status, body: p2.body } : "no request");
  const e2 = p2?.res?.equipmentId ? await apiGet(`/api/equipment/${p2.res.equipmentId}`) : null;
  check(
    "FS BC-2 เครื่องชั่วคราวที่บันทึกจริง: machineType ตู้ฟรีส · category ตู้ยืน · modelMasterId · ไม่มี SN จริง",
    e2?.body?.machineType === "ตู้ฟรีส" && e2?.body?.category === "ตู้ยืน" && e2?.body?.modelMasterId === idOf("HF-78HS", "ตู้ยืน") && e2?.body?.hasRealSerial === false,
    e2 ? { serial: e2.body?.serial, machineType: e2.body?.machineType, category: e2.body?.category, modelMasterId: e2.body?.modelMasterId, hasRealSerial: e2.body?.hasRealSerial } : null
  );

  // แสดงผลหลังโหลดใหม่จากฐานจริง
  await page.reload();
  await page.getByRole("button", { name: "เพิ่มเครื่อง", exact: true }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(800);
  const text = await page.locator("body").innerText();
  check("FS Reload ใบงาน → แสดงเครื่องทั้ง 2 จากฐานจริง", text.includes(sn) && text.includes("SRM-200AB") && text.includes("HF-78HS"), "");
  check("FS ไม่มี page error", errors.length === 0, errors);
} catch (e) {
  check("FS scenario ทำงานจนจบ", false, String(e?.message ?? e).slice(0, 300));
} finally {
  await browser.close();
}
const foreign = [...origins].filter((o) => o !== new URL(FE_URL).origin && o !== new URL(API_URL).origin && o !== "null");
check("FS ไม่มีคำขอที่ไปถึงภายนอก (นอก localhost ถูก abort)", true, { blockedOrigins: foreign });
const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
console.log(`\nfullstack-local: ${pass}/${results.length} PASS · ${fail} FAIL · backend จริง + MongoDB ในเครื่อง`);
if (OUT) writeFileSync(OUT, JSON.stringify({ feUrl: FE_URL, apiUrl: API_URL, pass, fail, total: results.length, results }, null, 2));
process.exit(fail ? 1 : 0);
