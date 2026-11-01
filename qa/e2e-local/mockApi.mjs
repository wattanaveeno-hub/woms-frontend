// Mock API สำหรับทดสอบ Frontend บนเครื่อง (localhost) — ไม่มีคำขอใดออกไปถึง backend จริง/UAT
//
// - ดักทุกคำขอไป API_BASE ด้วย Playwright page.route แล้วตอบจากข้อมูลจำลองในไฟล์นี้
// - สิทธิ์ต่อบทบาท: scripts/fixtures/role-permissions.json (= ROLE_PERMISSIONS ของ backend 0149dd3)
// - guard ต่อ route: qa/e2e-local/fixtures/api-routes.json (= woms-backend/qa/uat-browser/data/api-routes.json)
//   ไม่มีสิทธิ์ → ตอบ 403 เหมือน backend (ใช้นับ "คำขอที่จะเกิด ACCESS_DENIED")
// - คำขอไปโดเมนอื่นที่ไม่ใช่หน้าเว็บ localhost ถูก abort ทั้งหมด (กันหลุดไป onrender.com / vercel.app)
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const ROLE_PERMS = JSON.parse(readFileSync(new URL("scripts/fixtures/role-permissions.json", ROOT), "utf8")).map;
const ROUTES = JSON.parse(readFileSync(new URL("qa/e2e-local/fixtures/api-routes.json", ROOT), "utf8"));

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
export const ROLES = ["manager", "admin", "ceo", "viewer", "acc", "sales", "tech"];

const compiled = ROUTES.map((r) => ({
  ...r,
  re: new RegExp("^" + r.path.replace(/:[A-Za-z]+/g, "[^/]+") + "$"),
  // route คงที่ (ไม่มี :param) ชนะ route ที่มี param เมื่อ match ทั้งคู่
  rank: (r.path.match(/:/g) ?? []).length,
}));

export function guardOf(method, path) {
  const hits = compiled.filter((r) => r.method === method && r.re.test(path)).sort((a, b) => a.rank - b.rank);
  return hits[0] ?? null;
}

/** backend ตอบ 403 หรือไม่ (ตาม allOf ของ route + ข้อจำกัดข้อมูลที่ไม่ใช่ permission ตรง ๆ) */
export function deniedFor(role, method, path) {
  const perms = new Set(ROLE_PERMS[role]);
  const g = guardOf(method, path);
  if (g && !g.allOf.every((anyOf) => anyOf.some((p) => perms.has(p)))) return true;
  // routes/equipment.ts BUG-V2-17: ผู้ถูกจำกัดข้อมูล (ไม่มี jobs:view_all) ไม่ได้ภาพรวมคลังทั้งบริษัท
  if (method === "GET" && path === "/api/equipment/summary" && !perms.has("jobs:view_all")) return true;
  return false;
}

const T0 = Date.parse("2026-10-31T02:00:00.000Z");
const iso = (i) => new Date(T0 + i * 60_000).toISOString();
const POLICY = { mime: ["image/jpeg", "image/png", "application/pdf"], maxFileBytes: 5_000_000, maxFiles: 5, maxTotalBytes: 10_000_000 };
const USER_ID = { manager: "u-mgr", admin: "u-adm", ceo: "u-ceo", viewer: "u-view", acc: "u-acc", sales: "u-sales", tech: "u-tech" };

function msg(groupKey, i, senderId, senderName, senderRole) {
  return {
    messageId: `${groupKey}-m${String(i).padStart(3, "0")}`,
    groupKey,
    kind: "TEXT",
    text: `ข้อความทดสอบที่ ${i} — ตรวจความสูงพื้นที่แชท บรรทัดยาวพอให้ตัดบรรทัดบนจอแคบ`,
    senderId,
    senderName,
    senderRole,
    createdAt: iso(i),
    replyTo: null,
    ref: null,
    attachments: [],
    seq: i,
    occurredAt: iso(i),
  };
}
function groupsFor(role) {
  const tech = { groupKey: "TECH-u-tech", name: "กลุ่มงานช่าง ช่างทดสอบ", type: "TECH", techId: "u-tech" };
  const check = { groupKey: "CHECK_QUEUE", name: "กลุ่มเช็คคิว", type: "CHECK_QUEUE", techId: "" };
  const perms = new Set(ROLE_PERMS[role]);
  const out = [];
  if (perms.has("chat:check_queue")) out.push(check);
  if (perms.has("chat:tech_groups") || perms.has("chat:own_tech_group")) out.push(tech);
  return out.map((g) => ({ ...g, lastMessage: msg(g.groupKey, 40, "u-other", "ผู้ใช้อื่น", "admin"), unread: 0 }));
}
function messagesFor(role, key) {
  const me = USER_ID[role];
  return Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? msg(key, i + 1, me, "ฉัน", role) : msg(key, i + 1, "u-other", "ผู้ใช้อื่น", "admin")));
}

/** N-01: ข้อความใหม่สำหรับ poll (ทดสอบ "มีข้อความใหม่ระหว่างอ่านย้อนหลัง") */
export function newMockMessage(key, i, sender = "u-other") {
  return msg(key, i, sender, sender === "u-other" ? "ผู้ใช้อื่น" : "ฉัน", "admin");
}

function body(role, method, path, search, ctl) {
  if (path === "/api/auth/me")
    return { user: { id: USER_ID[role], email: `${role}@qa.local`, name: `QA ${role}`, role, active: true, mustChangePassword: false }, permissions: ROLE_PERMS[role] };
  if (path === "/api/group-chat/groups") return { items: groupsFor(role), attachmentPolicy: POLICY };
  let m = path.match(/^\/api\/group-chat\/groups\/([^/]+)\/messages$/);
  if (m && method === "GET") {
    const key = decodeURIComponent(m[1]);
    // รอบแรก (ไม่มี query) = 40 ข้อความ · poll ถัดไป = ไม่มีข้อความใหม่
    const first = !search.has("since") && !search.has("afterSeq") && !search.has("before");
    // N-01: ctl.pending = ข้อความใหม่ที่ test ใส่ไว้ ส่งออกในรอบ poll ถัดไป
    const messages = first ? messagesFor(role, key) : ctl ? ctl.pending.splice(0) : [];
    const last = messages.length ? messages[messages.length - 1].seq : 40;
    return { messages, cards: {}, cursor: { before: null, afterSeq: Math.max(40, last), changedSince: iso(Math.max(40, last)) } };
  }
  m = path.match(/^\/api\/group-chat\/groups\/([^/]+)\/read$/);
  if (m) return { ok: true };
  m = path.match(/^\/api\/group-chat\/groups\/([^/]+)$/);
  if (m) {
    const key = decodeURIComponent(m[1]);
    const g = groupsFor(role).find((x) => x.groupKey === key);
    return { groupKey: key, type: g?.type ?? "TECH", name: g?.name ?? key, members: [{ id: USER_ID[role], name: "ฉัน", role }, { id: "u-other", name: "ผู้ใช้อื่น", role: "admin" }], attachmentPolicy: POLICY };
  }
  if (path === "/api/service-queue/summary") return { myResponse: 0, myToConfirm: 0, open: 0, total: 0 };
  if (path === "/api/notifications/unread-count") return { count: 2, unread: 2, actionRequired: 0 };
  if (path === "/api/dashboard/jobs") return { total: 5, open: 3, closed: 2, today: 1, overdue: 1, serverDate: "2026-10-31", technicianCount: 2 };
  if (path === "/api/dashboard/equipment")
    return { total: 4, byPmStatus: { ON: 2, DUE: 1, OVERDUE: 1 }, byWarranty: { ACTIVE: 2, EXPIRING: 1, EXPIRED: 1 }, needsSerial: 0, rentalWithoutContract: 0, rental: 2, sold: 2, pmAttention: [], pmAttentionTotal: 0, needsSerialItems: [] };
  if (path === "/api/equipment/summary") return { total: 4, byStatus: { ACTIVE: 4 }, warrantyExpiring: 1, warrantyExpired: 1 };
  if (path === "/api/jobs") return { jobs: [], count: 0 };
  if (path === "/api/dashboard/summary")
    return {
      filter: {},
      serverDate: "2026-10-31",
      scope: { dateBasis: "jobDate", jobVisibility: "ALL", filteredSections: [], unfilteredSections: [] },
      jobs: { total: 5, byType: { INSTALL: 3, PM: 2 }, byStatus: { OPEN: 3, CLOSED: 2 }, byTechnicianTeam: {}, revenueTotal: null, costTotal: null, net: null },
      pm: { total: 2, done: 1, openJobs: 1, hold: 0, cancelled: 0, dueSoon: 1, overdue: 0, planItems: {} },
      stock: null,
      contracts: null,
      sectionErrors: [],
      sources: { jobsScanned: 5, jobsMatchedFilter: 5, equipmentScanned: 4 },
    };
  if (path === "/api/meta/options" || path === "/api/options") return { jobTypes: [], teams: [], technicians: [] };
  return { items: [], count: 0 };
}

/**
 * ติดตั้ง mock บน page · คืน log ของคำขอ API ทั้งหมด { method, path, status }
 */
/**
 * @param opts.messagesDelayMs N-01: หน่วงคำตอบรายการข้อความรอบแรก (จำลองข้อความโหลดแบบ asynchronous)
 * @param opts.ctl N-01: { pending: [] } — ข้อความใหม่ที่จะส่งในรอบ poll ถัดไป
 */
export async function installMockApi(page, role, { webOrigin, messagesDelayMs = 0, ctl = null }) {
  const log = [];
  const base = new URL(API_BASE);
  await page.route("**/*", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.origin === base.origin) {
      const method = req.method();
      if (method === "OPTIONS") return route.fulfill({ status: 204, headers: cors(webOrigin) });
      const path = u.pathname;
      const denied = deniedFor(role, method, path);
      if (messagesDelayMs && method === "GET" && /\/messages$/.test(path) && !u.searchParams.has("afterSeq") && !u.searchParams.has("since"))
        await new Promise((r) => setTimeout(r, messagesDelayMs));
      const status = denied ? 403 : 200;
      log.push({ method, path, status, at: Date.now() });
      return route.fulfill({
        status,
        headers: { ...cors(webOrigin), "content-type": "application/json" },
        body: JSON.stringify(denied ? { error: "FORBIDDEN", message: "ไม่มีสิทธิ์" } : body(role, method, path, u.searchParams, ctl)),
      });
    }
    if (u.origin === webOrigin || u.protocol === "data:" || u.protocol === "blob:") return route.continue();
    return route.abort(); // fonts.googleapis.com / CDN / โดเมนอื่น — ไม่ออกเน็ต
  });
  await page.addInitScript(() => localStorage.setItem("woms_token", "local-mock-token"));
  return log;
}

function cors(origin) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "authorization, content-type, idempotency-key, x-client-message-id",
    "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  };
}
