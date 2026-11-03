// EQ-02 Queue → Job full-stack ในเครื่อง: Browser → Frontend (localhost) → Backend จริง (localhost:8000) → MongoDB ในเครื่อง
// เส้นทาง: เปิดคิว (UI) → จัดช่าง/ช่างเสนอวัน/รับ/คอนเฟิร์ม (API จริง ตามบทบาท) → Admin "ตรวจและเปิดงาน (ออก JN)" (UI)
//          → createJobWithEquipment → equipment (คลัง) + job_equipment (แถวใบงาน)
// ไม่ใช้ mock API · ปฏิเสธ URL ที่ไม่ใช่ localhost · คำขอไปโดเมนอื่นถูก abort
// DATA-GAP-Q1 (Solution A): คิวเก็บ modelMasterId ของแถวที่ผู้ใช้เลือก → ใบงาน/เครื่อง/snapshot ใช้แถวนั้น · client เดิมที่ไม่ส่ง id ยังทำงานได้
//
// เตรียม: woms-backend/qa/eq02-queue-fullstack-seed.local.ts (ฐาน woms_qa_*) แล้วรัน backend ชี้ฐานนั้น
// ใช้:  FE_URL=http://localhost:3002 API_URL=http://localhost:8000 QA_PASSWORD=... node qa/e2e-local/eq02-queue-to-job.local.mjs [out.json]
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
const PASSWORD = process.env.QA_PASSWORD ?? "";
const ADMIN = process.env.QA_ADMIN ?? "admin@local.test";
const TECH = process.env.QA_TECH ?? "tech@local.test";
const APPT_DATE = process.env.QA_APPT_DATE ?? "2026-11-20";
const OUT = process.argv[2];
for (const u of [FE_URL, API_URL]) {
  if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(u).hostname)) {
    console.error(`ต้องเป็น localhost เท่านั้น (ได้ ${u})`);
    process.exit(2);
  }
}
if (!PASSWORD) {
  console.error("ต้องกำหนด QA_PASSWORD ของผู้ใช้ทดสอบในฐานข้อมูลในเครื่อง");
  process.exit(2);
}

const results = [];
const facts = {};
const check = (id, ok, detail) => {
  results.push({ id, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${typeof detail === "string" ? detail : JSON.stringify(detail ?? "").slice(0, 500)}`);
};
const finding = (id, detail) => {
  results.push({ id, ok: true, finding: true, detail });
  console.log(`FINDING  ${id}  ${JSON.stringify(detail ?? "").slice(0, 500)}`);
};

async function api(token, method, path, body) {
  const r = await fetch(`${API_URL}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-client": "qa-local" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function login(email) {
  const r = await fetch(`${API_URL}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  return (await r.json()).token;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "th-TH" });
await ctx.route("**/*", (route) => {
  const o = new URL(route.request().url()).origin;
  return o === new URL(FE_URL).origin || o === new URL(API_URL).origin || o === "null" ? route.continue() : route.abort();
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
const sent = { queuePosts: [], release: [] };
page.on("request", (req) => {
  const u = new URL(req.url());
  if (req.method() === "POST" && u.pathname === "/api/service-queue") sent.queuePosts.push(JSON.parse(req.postData() || "{}"));
  if (req.method() === "POST" && /\/api\/service-queue\/[^/]+\/release$/.test(u.pathname)) sent.release.push(u.pathname);
});

const manual = (n) => page.getByTestId("queue-item-manual").nth(n);
const box = (row, label) => row.getByRole("combobox", { name: label, exact: true }).first();
async function pick(row, label, text, optionText = null) {
  const b = box(row, label);
  await b.click();
  await b.fill(text);
  await page.waitForTimeout(400);
  await page.getByRole("option").filter({ hasText: optionText ?? text }).first().click();
  await page.waitForTimeout(300);
}
const vals = async (row, n) => [await box(row, `ประเภทเครื่อง #${n}`).inputValue(), await box(row, "หมวดหมู่ (ใช้กรองรุ่น)").inputValue(), await box(row, "รุ่น").inputValue()];
async function addManual() {
  await page.getByRole("button", { name: "เพิ่มเครื่องที่ยังไม่มีในคลัง" }).click();
  await page.waitForTimeout(400);
}
async function pickStock(sn) {
  await page.getByTestId("picker-sn").fill(sn);
  await page.getByTestId("picker-sn").press("Enter");
  await page.waitForTimeout(1200);
  await page.getByTestId("picker-row").filter({ hasText: sn }).first().getByRole("button", { name: "เพิ่มเข้าคิว" }).click();
  await page.waitForTimeout(500);
}

try {
  // ---- 1) เปิดคิวผ่านหน้าเว็บ (Admin) ----
  await page.goto(`${FE_URL}/login`);
  await page.getByLabel(/อีเมล/).first().fill(ADMIN);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
  const adminToken = await page.evaluate(() => localStorage.getItem("woms_token") ?? "");
  const techToken = await login(TECH);
  check("QJ login admin (UI) + tech (API) กับ backend จริง", !!adminToken && !!techToken, "");
  const models = (await api(adminToken, "GET", "/api/equipment-models")).body?.items ?? [];
  const mid = (model, category) => models.find((r) => r.model === model && r.category === category)?.id ?? "";

  await page.goto(`${FE_URL}/service-queue/new`);
  await page.getByRole("button", { name: "เพิ่มเครื่องที่ยังไม่มีในคลัง" }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(800);
  await page.getByLabel(/^ประเภทงาน/).first().click();
  await page.getByRole("option", { name: "CM", exact: true }).click();
  await page.getByLabel(/ชื่อร้าน \/ บริษัท \/ สาขา/).fill("ร้านทดสอบ Queue→Job");
  await page.getByLabel(/^ผู้ติดต่อ/).fill("คุณทดสอบ");
  await page.getByLabel(/^เบอร์โทร/).fill("0812345678");
  await page.getByLabel(/^ที่อยู่/).first().fill("1 ถนนทดสอบ เขตทดสอบ กรุงเทพฯ");

  // #1 รุ่นที่มี master ชุดเดียว · ไม่มี SN
  await addManual();
  await pick(manual(0), "รุ่น", "hf-78", "HF-78HS");
  // #2 รุ่นชื่อซ้ำ — ผู้ใช้เลือกแถวหมวดหมู่ "ถัง" · ไม่มี SN
  await addManual();
  await pick(manual(1), "รุ่น", "srm-200", "/ ถัง");
  facts.uiItem2 = await vals(manual(1), 2);
  check("QJ #2 UI: ผู้ใช้เลือกรุ่นซ้ำแถว ถัง", facts.uiItem2[0] === "เครื่องทำน้ำแข็ง" && facts.uiItem2[1] === "ถัง" && facts.uiItem2[2] === "SRM-200AB", facts.uiItem2);
  // #3 รุ่นที่มี master ชุดเดียว + มี SN (ยังไม่อยู่ในคลัง)
  await addManual();
  await pick(manual(2), "รุ่น", "b-501", "B-501");
  await manual(2).getByLabel("SN (ถ้ามี)").fill("SN-Q-NEW-1");
  // #4 เครื่องในคลังมี SN + master · #5 เครื่องในคลังรุ่นนอก master
  await page.getByRole("button", { name: "เลือกเครื่องจากคลัง" }).click();
  await page.waitForTimeout(800);
  await pickStock("SN-STOCK-HF");
  await pickStock("SN-STOCK-LEG");
  check("QJ ฟอร์มคิว: เครื่อง manual 3 + จากคลัง 2", (await page.getByTestId("queue-item-manual").count()) === 3 && (await page.getByTestId("queue-item-stock").count()) === 2, [await page.getByTestId("queue-item-manual").count(), await page.getByTestId("queue-item-stock").count()]);
  await page.getByRole("button", { name: "ส่งคิว", exact: true }).click();
  await page.getByTestId("queue-review-confirm").waitFor({ timeout: 10_000 });
  await page.getByTestId("queue-review-confirm").click();
  await page.waitForTimeout(2500);
  const posted = sent.queuePosts.at(-1) ?? {};
  facts.queuePostItems = posted.items;
  const pi = posted.items ?? [];
  check(
    "QJ POST /api/service-queue จากหน้าเว็บ · manual ส่ง modelMasterId ของแถวที่เลือก (รุ่นซ้ำ = แถวถัง) · จากคลังไม่ส่ง · ไม่มี category",
    pi.length === 5 && pi.every((it) => !("category" in it)) && pi[0].modelMasterId === mid("HF-78HS", "ตู้ยืน") && pi[1].modelMasterId === mid("SRM-200AB", "ถัง") && pi[2].modelMasterId === mid("B-501", "ถัง") && !pi[3].modelMasterId && !pi[4].modelMasterId,
    pi.map((it) => [it.machineType, it.model, it.serial, it.equipmentId ?? "", it.modelMasterId ?? null])
  );

  const list = await api(adminToken, "GET", "/api/service-queue");
  const q0 = (list.body?.items ?? []).find((q) => q.jobName === "ร้านทดสอบ Queue→Job");
  check("QJ คิวถูกบันทึกในฐานจริง (WAIT_ASSIGN)", q0?.status === "WAIT_ASSIGN", q0 ? { id: q0.id, status: q0.status, queueNo: q0.queueNo } : list.status);
  if (!q0) throw new Error("ไม่พบคิว");
  facts.queueItemsStored = q0.items.map((it) => ({ machineType: it.machineType, model: it.model, serial: it.serial, equipmentId: it.equipmentId, modelMasterId: it.modelMasterId ?? null }));
  check("QJ คิวเก็บ modelMasterId ที่ผู้ใช้เลือก (#2 = SRM-200AB/ถัง) · เครื่องจากคลังไม่มี id", q0.items[1].modelMasterId === mid("SRM-200AB", "ถัง") && q0.items[0].modelMasterId === mid("HF-78HS", "ตู้ยืน") && !q0.items[3].modelMasterId && !q0.items[4].modelMasterId, facts.queueItemsStored);

  // #6 รุ่นที่ไม่มีใน master — หน้าเว็บเลือกได้เฉพาะรุ่นใน master (EQ-02) จึงเพิ่มด้วย Admin PATCH (API จริง) แบบข้อมูลเดิม/นำเข้า
  // #7 รุ่นชื่อซ้ำจาก client เดิม (ไม่ส่ง modelMasterId) — PATCH นี้ไม่ส่ง id ของรายการเดิมเลย (จำลอง client เดิม) → backend ต้องคง id เดิม
  const items6 = [
    ...q0.items.map((it) => ({ itemId: it.itemId, machineType: it.machineType, model: it.model, serial: it.serial, equipmentId: it.equipmentId, note: it.note })),
    { machineType: "ตู้แช่", model: "OLD-NEW-1", serial: "", equipmentId: "", note: "รุ่นนอก master" },
    { machineType: "เครื่องทำน้ำแข็ง", model: "SRM-200AB", serial: "", equipmentId: "", note: "client เดิม ไม่มี id" },
  ];
  const ed = await api(adminToken, "PATCH", `/api/service-queue/${q0.id}`, { version: q0.version, reason: "QA เพิ่มรุ่นนอก master", items: items6 });
  check("QJ #6/#7 Admin PATCH แบบ client เดิม (ไม่ส่ง id) → ยอมรับ · id เดิมของ #1–#3 คงอยู่ · #7 ไม่มี id", ed.status === 200 && ed.body?.items?.length === 7 && ed.body.items[1].modelMasterId === mid("SRM-200AB", "ถัง") && ed.body.items[0].modelMasterId === mid("HF-78HS", "ตู้ยืน") && !ed.body.items[6].modelMasterId, ed.body?.items?.map((it) => it.modelMasterId ?? null) ?? ed.status);

  // ---- Queue edit (UI) → reload: รุ่นซ้ำแสดงหมวดหมู่ที่บันทึกไว้ · บันทึกซ้ำแล้ว id ไม่หาย ----
  const patches = [];
  const onReq = (req) => {
    const u = new URL(req.url());
    if (req.method() === "PATCH" && u.pathname === `/api/service-queue/${q0.id}`) patches.push(JSON.parse(req.postData() || "{}"));
  };
  page.on("request", onReq);
  await page.goto(`${FE_URL}/service-queue/${q0.id}`);
  await page.getByRole("button", { name: "แก้ไขข้อมูล" }).waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "แก้ไขข้อมูล" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByTestId("queue-item-manual").first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1200);
  const dm = (n) => dlg.getByTestId("queue-item-manual").nth(n);
  const dv = async (n, label) => [await dm(n).getByRole("combobox", { name: label, exact: true }).first().inputValue(), await dm(n).getByRole("combobox", { name: "หมวดหมู่ (ใช้กรองรุ่น)", exact: true }).first().inputValue(), await dm(n).getByRole("combobox", { name: "รุ่น", exact: true }).first().inputValue()];
  facts.editItem2 = await dv(1, "ประเภทเครื่อง #2");
  facts.editItem7 = await dv(4, "ประเภทเครื่อง #7");
  check("QJ แก้คิว (UI) reload: #2 รุ่นซ้ำแสดงหมวดหมู่ ถัง ที่บันทึกไว้", facts.editItem2[0] === "เครื่องทำน้ำแข็ง" && facts.editItem2[1] === "ถัง" && facts.editItem2[2] === "SRM-200AB", facts.editItem2);
  check("QJ แก้คิว (UI) reload: #7 รุ่นซ้ำไม่มี id → หมวดหมู่ว่าง (ไม่เดา)", facts.editItem7[1] === "" && facts.editItem7[2] === "SRM-200AB", facts.editItem7);
  await dlg.getByLabel("เหตุผล/หมายเหตุการแก้ไข (บันทึกใน Log)").fill("QA บันทึกซ้ำ");
  await dlg.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
  await page.waitForTimeout(2000);
  page.off("request", onReq);
  const pb = patches.at(-1)?.items ?? [];
  check("QJ แก้คิว (UI) บันทึก → PATCH ส่ง id ของ #2 (ถัง) · #7 ไม่มี id · ไม่มี category", pb.length === 7 && pb[1].modelMasterId === mid("SRM-200AB", "ถัง") && !pb[6].modelMasterId && pb.every((it) => !("category" in it)), pb.map((it) => it.modelMasterId ?? null));
  const qAfterEdit = await api(adminToken, "GET", `/api/service-queue/${q0.id}`);
  check("QJ หลังบันทึกจากหน้าเว็บ id ในฐานยังเป็นแถวถัง", qAfterEdit.body?.queue?.items?.[1]?.modelMasterId === mid("SRM-200AB", "ถัง"), qAfterEdit.body?.queue?.items?.map((it) => it.modelMasterId ?? null));

  // ---- 2) ขั้นตอนคิวด้วย API จริงตามบทบาท ----
  const techId = (await api(techToken, "GET", "/api/auth/me")).body?.user?.id;
  let q = qAfterEdit.body.queue;
  const as = await api(adminToken, "POST", `/api/service-queue/${q.id}/assign`, { version: q.version, techId, note: "" });
  const pr = await api(techToken, "POST", `/api/service-queue/${q.id}/propose`, { roundNo: as.body?.roundNo, date: APPT_DATE, time: "09:00", note: "" });
  const ac = await api(adminToken, "POST", `/api/service-queue/${q.id}/accept`, { roundNo: pr.body?.queue?.roundNo ?? as.body?.roundNo });
  const cf = await api(adminToken, "POST", `/api/service-queue/${q.id}/confirm`, { roundNo: ac.body?.roundNo });
  check("QJ จัดช่าง → ช่างเสนอวัน → Admin รับ → คอนเฟิร์ม = READY_TO_OPEN", cf.status === 200 && cf.body?.status === "READY_TO_OPEN" && !cf.body?.jobId, [as.status, pr.status, ac.status, cf.status, cf.body?.status]);

  // ---- 3) Admin เปิดงานจากหน้าเว็บ ----
  await page.goto(`${FE_URL}/service-queue/${q.id}`);
  await page.getByRole("button", { name: "ตรวจและเปิดงาน (ออก JN)" }).waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "ตรวจและเปิดงาน (ออก JN)" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "เปิดงาน", exact: true }).click();
  await page.waitForTimeout(3500);
  check("QJ UI กดเปิดงาน → POST /release ครั้งเดียว", sent.release.length === 1, sent.release);
  q = (await api(adminToken, "GET", `/api/service-queue/${q.id}`)).body?.queue;
  check("QJ คิว RELEASED + มี JN", q?.status === "RELEASED" && !!q?.jobId, { status: q?.status, jobId: q?.jobId });
  facts.jobId = q?.jobId;

  // ---- 4) ค่าที่บันทึกจริง (อ่านผ่าน backend จากฐานข้อมูล) ----
  const lines = (await api(adminToken, "GET", `/api/jobs/${q.jobId}/equipment`)).body?.items ?? [];
  check("QJ ใบงานมี 7 แถวเครื่องตามลำดับคิว", lines.length === 7, lines.length);
  const eqs = [];
  for (const l of lines) eqs.push((await api(adminToken, "GET", `/api/equipment/${l.equipmentId}`)).body ?? {});
  const view = lines.map((l, i) => ({
    line: { serial: l.serial, model: l.model, machineType: l.machineType, cost: l.standardCostSnapshot ? { status: l.standardCostSnapshot.status, masterId: l.standardCostSnapshot.masterId ?? "", standardCost: l.standardCostSnapshot.standardCost ?? null, version: l.standardCostSnapshot.version ?? null } : null, install: l.installChargeSnapshot ? { status: l.installChargeSnapshot.status, installCharge: l.installChargeSnapshot.installCharge ?? null } : null },
    equipment: { serial: eqs[i].serial, hasRealSerial: eqs[i].hasRealSerial, model: eqs[i].model, machineType: eqs[i].machineType, category: eqs[i].category, modelMasterId: eqs[i].modelMasterId ?? "", note: eqs[i].note },
  }));
  facts.view = view;
  const [v1, v2, v3, v4, v5, v6, v7] = view;

  check("QJ #1 master ชุดเดียว ไม่มี SN → equipment ตู้ฟรีส / ตู้ยืน / modelMasterId HF · เลขชั่วคราว", v1.equipment.machineType === "ตู้ฟรีส" && v1.equipment.category === "ตู้ยืน" && v1.equipment.modelMasterId === mid("HF-78HS", "ตู้ยืน") && v1.equipment.hasRealSerial === false, v1.equipment);
  check("QJ #1 snapshot ต้นทุน = master HF ที่อนุมัติ (2,000 v2) · ค่าติดตั้ง Model Index 1,500", v1.line.cost?.status === "APPROVED" && v1.line.cost?.masterId === mid("HF-78HS", "ตู้ยืน") && v1.line.cost?.standardCost === 2000 && v1.line.cost?.version === 2 && v1.line.install?.status === "OK" && v1.line.install?.installCharge === 1500, v1.line);

  check("QJ #2 รุ่นซ้ำที่เลือกแถว ถัง → equipment เครื่องทำน้ำแข็ง / ถัง / modelMasterId = แถวถัง (DATA-GAP-Q1 ปิด)", v2.equipment.machineType === "เครื่องทำน้ำแข็ง" && v2.equipment.category === "ถัง" && v2.equipment.modelMasterId === mid("SRM-200AB", "ถัง"), v2.equipment);
  check("QJ #2 snapshot ต้นทุน = แถวถังที่เลือก (UNAPPROVED · ไม่มีตัวเลข เพราะยังไม่อนุมัติ)", v2.line.cost?.status === "UNAPPROVED" && v2.line.cost?.masterId === mid("SRM-200AB", "ถัง") && v2.line.cost?.standardCost === null, v2.line.cost);
  check("QJ #7 รุ่นซ้ำจาก client เดิม (ไม่มี id) → ไม่เดาหมวดหมู่ · snapshot AMBIGUOUS", v7.equipment.machineType === "เครื่องทำน้ำแข็ง" && v7.equipment.category === "" && !v7.equipment.modelMasterId && v7.line.cost?.status === "AMBIGUOUS" && v7.line.cost?.standardCost === null, { equipment: v7.equipment, cost: v7.line.cost });

  check("QJ #3 มี SN (ยังไม่อยู่ในคลัง) → ใบงานสร้างเครื่องเลขชั่วคราว · ประเภท/หมวดหมู่/master จากรุ่น B-501 ชุดเดียว", v3.equipment.hasRealSerial === false && v3.equipment.machineType === "เครื่องทำน้ำแข็ง" && v3.equipment.category === "ถัง" && v3.equipment.modelMasterId === mid("B-501", "ถัง") && String(v3.equipment.note ?? "").includes("SN-Q-NEW-1"), v3.equipment);
  finding("DATA-NOTE-Q2 SN ที่แจ้งในคิว (ไม่อยู่ในคลัง) ไม่ถูกใช้เป็น SN จริงของเครื่อง — เก็บในหมายเหตุ (พฤติกรรมเดิม)", { serial: v3.equipment.serial, note: v3.equipment.note });
  check("QJ #3 snapshot ต้นทุน B-501 = UNAPPROVED (ยังไม่อนุมัติ · ไม่มีตัวเลข)", v3.line.cost?.status === "UNAPPROVED" && v3.line.cost?.masterId === mid("B-501", "ถัง") && v3.line.cost?.standardCost === null, v3.line.cost);

  check("QJ #4 เครื่องในคลังมี SN → ผูกเครื่องเดิม ไม่สร้างใหม่ ข้อมูลคลังคงเดิม", v4.equipment.serial === "SN-STOCK-HF" && v4.equipment.hasRealSerial === true && v4.equipment.category === "ตู้ยืน" && v4.equipment.modelMasterId === mid("HF-78HS", "ตู้ยืน"), v4.equipment);
  check("QJ #4 snapshot ต้นทุน = master ของเครื่อง (2,000 v2) · ค่าติดตั้ง 1,500", v4.line.cost?.status === "APPROVED" && v4.line.cost?.standardCost === 2000 && v4.line.install?.installCharge === 1500, v4.line);

  check("QJ #5 เครื่องในคลังรุ่นนอก master → ข้อมูลคลังคงเดิม (ตู้แช่ / category ว่าง / ไม่มี master)", v5.equipment.serial === "SN-STOCK-LEG" && v5.equipment.machineType === "ตู้แช่" && v5.equipment.category === "" && !v5.equipment.modelMasterId, v5.equipment);
  check("QJ #5 snapshot = NO_MASTER (ไม่มีต้นทุนมาตรฐาน) · ค่าติดตั้งจาก Model Index 900", v5.line.cost?.status === "NO_MASTER" && v5.line.cost?.standardCost === null && v5.line.install?.installCharge === 900, v5.line);

  check("QJ #6 รุ่นนอก master ไม่มี SN → เก็บประเภท ตู้แช่ · category ว่าง · ไม่ผูก master", v6.equipment.machineType === "ตู้แช่" && v6.equipment.category === "" && !v6.equipment.modelMasterId && v6.equipment.hasRealSerial === false, v6.equipment);
  check("QJ #6 snapshot = NO_MASTER · ค่าติดตั้ง MISSING (Model Index ไม่มีรุ่นนี้)", v6.line.cost?.status === "NO_MASTER" && v6.line.install?.status === "MISSING", v6.line);
  check("QJ แถวใบงานเก็บประเภทจากคิวครบทุกแถว", view.every((v, i) => v.line.machineType === ["ตู้ฟรีส", "เครื่องทำน้ำแข็ง", "เครื่องทำน้ำแข็ง", "ตู้ฟรีส", "ตู้แช่", "ตู้แช่", "เครื่องทำน้ำแข็ง"][i]), view.map((v) => v.line.machineType));

  await page.goto(`${FE_URL}/jobs/${q.jobId}`);
  await page.getByRole("button", { name: "เพิ่มเครื่อง", exact: true }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  const text = await page.locator("body").innerText();
  const missing = ["HF-78HS", "SRM-200AB", "B-501", "SN-STOCK-HF", "SN-STOCK-LEG", "OLD-NEW-1"].filter((s) => !text.includes(s));
  check("QJ หน้าใบงานแสดงเครื่องจากคิวครบ", missing.length === 0, { missing });
  check("QJ ไม่มี page error", errors.length === 0, errors);
} catch (e) {
  check("QJ scenario ทำงานจนจบ", false, String(e?.message ?? e).slice(0, 400));
} finally {
  await browser.close();
}
const pass = results.filter((r) => r.ok && !r.finding).length;
const total = results.filter((r) => !r.finding).length;
const fail = total - pass;
console.log(`\nqueue-to-job-local: ${pass}/${total} PASS · ${fail} FAIL · findings ${results.filter((r) => r.finding).length} · backend จริง + MongoDB ในเครื่อง`);
if (OUT) writeFileSync(OUT, JSON.stringify({ feUrl: FE_URL, apiUrl: API_URL, pass, fail, total, facts, results }, null, 2));
process.exit(fail ? 1 : 0);
