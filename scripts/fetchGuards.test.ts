/**
 * FE-02 (O-01) — หน้าเว็บไม่เรียก API ที่บทบาทไม่มีสิทธิ์ (กัน ACCESS_DENIED ที่ไม่จำเป็น)
 * สิทธิ์ต่อบทบาท: scripts/fixtures/role-permissions.json
 *   = สำเนาจาก woms-backend/qa/uat-browser/data/role-permissions.json (สร้างจาก ROLE_PERMISSIONS ของ backend 0149dd3)
 * หลักฐานเดิม: Playwright UAT 36/36 (31 ต.ค. 69) — 403 ตอนโหลดหน้าของ acc 6 · sales 2 · tech 6
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  anyFetch,
  canViewCompanyInventorySummary,
  dashboardFetchPlan,
  notificationsFetchPlan,
  showNotificationBell,
} from "../src/lib/fetchGuards.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/role-permissions.json", import.meta.url), "utf8")) as {
  roles: string[];
  map: Record<string, string[]>;
};
const ROLES = ["manager", "admin", "ceo", "viewer", "acc", "sales", "tech"] as const;
const hasOf = (role: string) => {
  const perms = new Set(fixture.map[role]);
  assert.ok(fixture.map[role], `fixture ต้องมีบทบาท ${role}`);
  return (p: string) => perms.has(p);
};

// guard ฝั่ง backend (routes/*.ts @ 0149dd3) — ใช้ตรวจว่า plan ไม่เรียก endpoint ที่จะได้ 403
const BACKEND_GUARD: Record<string, (has: (p: string) => boolean) => boolean> = {
  "GET /api/equipment/summary": (h) => h("inventory:view") && h("jobs:view_all"),
  "GET /api/contracts": (h) => h("contracts:view"),
  "GET /api/jobs": (h) => h("jobs:view"),
  "GET /api/quotations": (h) => h("quotations:view"),
  "GET /api/queue/bookings": (h) => h("queue:view"),
  "GET /api/documents": (h) => h("documents:view"),
  "GET /api/dashboard/equipment": (h) => h("equipment:view"),
  "GET /api/dashboard/jobs": (h) => h("jobs:view"),
  "GET /api/notifications/unread-count": (h) => h("jobs:view"),
  "GET /api/submissions": (h) => h("jobs:view"),
  "GET /api/chat/unread/summary": (h) => h("jobs:view"),
};
const DASH_ENDPOINT: Record<string, string> = {
  equipmentSummary: "GET /api/equipment/summary",
  contracts: "GET /api/contracts",
  jobs: "GET /api/jobs",
  quotations: "GET /api/quotations",
  bookings: "GET /api/queue/bookings",
  documents: "GET /api/documents",
  equipmentDashboard: "GET /api/dashboard/equipment",
  jobDashboard: "GET /api/dashboard/jobs",
};
const NOTIF_ENDPOINT: Record<string, string> = {
  jobDashboard: "GET /api/dashboard/jobs",
  overdueJobs: "GET /api/jobs",
  openJobs: "GET /api/jobs",
  contracts: "GET /api/contracts",
  equipmentSummary: "GET /api/equipment/summary",
  submissions: "GET /api/submissions",
  unreadChats: "GET /api/chat/unread/summary",
};
const calls = (plan: object, map: Record<string, string>) =>
  Object.entries(plan)
    .filter(([, on]) => on)
    .map(([k]) => map[k]);

for (const flags of [{ techQueue: false, chat: false }, { techQueue: true, chat: true }]) {
  const tag = flags.techQueue ? "flag เปิด" : "flag ปิด";
  for (const role of ROLES) {
    test(`R2-01 ${role} (${tag}): Dashboard / Notifications / Bell ไม่เรียก endpoint ที่ backend จะตอบ 403`, () => {
      const has = hasOf(role);
      for (const ep of calls(dashboardFetchPlan(has, flags), DASH_ENDPOINT)) assert.ok(BACKEND_GUARD[ep](has), `Dashboard ${ep}`);
      for (const ep of calls(notificationsFetchPlan(has, flags), NOTIF_ENDPOINT)) assert.ok(BACKEND_GUARD[ep](has), `Notifications ${ep}`);
      if (showNotificationBell(has)) assert.ok(BACKEND_GUARD["GET /api/notifications/unread-count"](has));
    });
    test(`R2-01b ${role} (${tag}): ทุก endpoint ที่มีสิทธิ์ยังถูกเรียก (ไม่มีการ์ด/แจ้งเตือนหาย)`, () => {
      const has = hasOf(role);
      const dash = dashboardFetchPlan(has, flags) as unknown as Record<string, boolean>;
      for (const [k, ep] of Object.entries(DASH_ENDPOINT)) {
        const expected = BACKEND_GUARD[ep](has) && (k !== "bookings" || flags.techQueue);
        assert.equal(dash[k], expected, `Dashboard ${k}`);
      }
      const notif = notificationsFetchPlan(has, flags) as unknown as Record<string, boolean>;
      for (const [k, ep] of Object.entries(NOTIF_ENDPOINT)) {
        const expected = BACKEND_GUARD[ep](has) && (!["submissions", "unreadChats"].includes(k) || flags.chat);
        assert.equal(notif[k], expected, `Notifications ${k}`);
      }
    });
  }
}

test("R2-01 หลักฐาน UAT: acc ไม่เรียก 6 endpoint ที่เคยได้ 403 · ไม่เห็นกระดิ่ง (D-FE-01 A) · ไม่ poll แผงงานค้าง", () => {
  const has = hasOf("acc");
  const notif = notificationsFetchPlan(has, { chat: false });
  assert.equal(showNotificationBell(has), false);
  assert.deepEqual(calls(notif, NOTIF_ENDPOINT), []);
  assert.equal(anyFetch(notif), false);
  const dash = dashboardFetchPlan(has, { techQueue: false });
  assert.equal(dash.jobs || dash.jobDashboard || dash.contracts || dash.equipmentSummary, false);
});

test("R2-01 หลักฐาน UAT: sales ไม่เรียก /api/documents และ /api/quotations (NAV-01 v2)", () => {
  const dash = dashboardFetchPlan(hasOf("sales"), { techQueue: false });
  assert.equal(dash.documents, false);
  assert.equal(dash.quotations, false);
  assert.equal(dash.contracts, true);
  assert.equal(dash.equipmentSummary, true);
});

test("R2-01 หลักฐาน UAT: tech ไม่เรียก contracts / equipment summary / documents / quotations · ยังเห็นงานของตัวเอง", () => {
  const has = hasOf("tech");
  assert.equal(canViewCompanyInventorySummary(has), false, "ช่างมี inventory:view แต่ถูกจำกัดข้อมูล (ไม่มี jobs:view_all)");
  const dash = dashboardFetchPlan(has, { techQueue: false });
  assert.deepEqual(
    { c: dash.contracts, s: dash.equipmentSummary, d: dash.documents, q: dash.quotations, j: dash.jobs, jd: dash.jobDashboard },
    { c: false, s: false, d: false, q: false, j: true, jd: true }
  );
  const notif = notificationsFetchPlan(has, { chat: false });
  assert.equal(notif.contracts, false);
  assert.equal(notif.equipmentSummary, false);
  assert.equal(notif.overdueJobs, true);
  assert.equal(showNotificationBell(has), true);
});

test("R2-02 manager / admin / ceo / viewer: Dashboard เรียกครบเหมือนก่อนแก้ (ยกเว้นคิวที่ซ่อนด้วย flag)", () => {
  for (const role of ["manager", "admin", "ceo", "viewer"]) {
    const plan = dashboardFetchPlan(hasOf(role), { techQueue: false });
    const { bookings, ...rest } = plan;
    assert.equal(bookings, false);
    assert.ok(Object.values(rest).every(Boolean), `${role}: ${JSON.stringify(plan)}`);
    const notif = notificationsFetchPlan(hasOf(role), { chat: false });
    assert.ok(notif.jobDashboard && notif.overdueJobs && notif.openJobs && notif.contracts && notif.equipmentSummary, role);
    assert.equal(showNotificationBell(hasOf(role)), true);
  }
});
