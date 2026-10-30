// Activity Log viewer (slice act) — ฟังก์ชันบริสุทธิ์ของหน้า /audit
//   เวลาไทยจากเวลา UTC (ไม่ขึ้นกับเขตเวลาของเครื่อง) · query string ของตัวกรอง · ตารางก่อน/หลัง · ตัวเลือกครบตาม backend
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_ENTITY_OPTIONS,
  AUDIT_RESULT_OPTIONS,
  auditCompareRows,
  auditHasComparison,
  auditQueryString,
  auditSourceLabel,
  auditTimeText,
} from "../src/lib/auditOptions.ts";

test("ACT-FE-01 เวลา UTC → เวลาไทย ระดับวินาที (ข้ามวันตอนก่อน 07:00 น. ไทย)", () => {
  assert.equal(auditTimeText("2026-10-30T07:00:00.000Z"), "2026-10-30 14:00:00");
  assert.equal(auditTimeText("2026-10-29T17:00:00.000Z"), "2026-10-30 00:00:00");
  assert.equal(auditTimeText("2026-12-31T16:59:59.000Z"), "2026-12-31 23:59:59");
  assert.equal(auditTimeText("2026-12-31T17:00:00.000Z"), "2027-01-01 00:00:00");
  assert.equal(auditTimeText(""), "");
  assert.equal(auditTimeText("not-a-date"), "");
  assert.equal(auditTimeText(null), "");
});

test("ACT-FE-02 เวลาไทยเหมือนกันไม่ว่าเครื่องตั้ง TZ อะไร", () => {
  const prev = process.env.TZ;
  for (const tz of ["UTC", "America/New_York", "Asia/Bangkok"]) {
    process.env.TZ = tz;
    assert.equal(auditTimeText("2026-10-30T23:30:00.000Z"), "2026-10-31 06:30:00", tz);
  }
  process.env.TZ = prev;
});

test("ACT-FE-03 query string: ตัดค่าว่าง · ส่งวันที่ตามที่เลือก (วันไทย) · page/pageSize · format สำหรับส่งออก", () => {
  assert.equal(auditQueryString({}), "");
  assert.equal(auditQueryString({ q: "  ", module: "", action: "LOGIN" }), "?action=LOGIN");
  const s = auditQueryString({ q: "JN-2026", actorId: "u1", module: "jobs", result: "DENIED", from: "2026-10-30", to: "2026-10-31", page: 2, pageSize: 25 });
  const p = new URLSearchParams(s.slice(1));
  assert.equal(p.get("q"), "JN-2026");
  assert.equal(p.get("actorId"), "u1");
  assert.equal(p.get("module"), "jobs");
  assert.equal(p.get("result"), "DENIED");
  assert.equal(p.get("from"), "2026-10-30");
  assert.equal(p.get("to"), "2026-10-31");
  assert.equal(p.get("page"), "2");
  assert.equal(p.get("pageSize"), "25");
  assert.equal(auditQueryString({ module: "audit" }, { format: "csv" }), "?module=audit&format=csv");
  assert.equal(auditQueryString({ q: "a&b=c" }), "?q=a%26b%3Dc");
  assert.equal(auditQueryString({ page: 2, asOf: "2026-10-30T07:00:00.000Z" }), "?asOf=2026-10-30T07%3A00%3A00.000Z&page=2");
});

test("ACT-FE-04 ตารางก่อน/หลัง: changes ก่อน แล้วเติมจาก before/after · ค่าที่ถูกซ่อน (null) แสดง —", () => {
  const rows = auditCompareRows({
    changes: [
      { field: "role", before: "tech", after: "sales" },
      { field: "standardCost", before: null, after: null },
    ],
    before: { role: "tech", name: "ก" },
    after: { role: "sales", name: "ข", team: "A" },
  });
  assert.deepEqual(rows, [
    { field: "role", before: "tech", after: "sales", changed: true },
    { field: "standardCost", before: "—", after: "—", changed: false },
    { field: "name", before: "ก", after: "ข", changed: true },
    { field: "team", before: "", after: "A", changed: true },
  ]);
  // CREATE มีแต่ after
  assert.deepEqual(auditCompareRows({ changes: [], after: { email: "n@t.co", zones: ["A"] } }), [
    { field: "email", before: "", after: "n@t.co", changed: true },
    { field: "zones", before: "", after: '["A"]', changed: true },
  ]);
  assert.equal(auditHasComparison({ changes: [] }), false);
  assert.equal(auditHasComparison({ changes: [], before: { status: "ISSUED" } }), true);
});

test("ACT-FE-05 ตัวเลือกตัวกรองครบตาม backend (actions/entities) + ผล + ที่มา", () => {
  const actions = AUDIT_ACTION_OPTIONS.map((o) => o.value as string);
  for (const a of ["LOGOUT", "LOGIN_LOCKED", "PASSWORD_CHANGE", "PASSWORD_RESET", "ROLE_CHANGE", "ACCESS_DENIED", "VIEW_SENSITIVE", "SCRIPT"]) assert.ok(actions.includes(a), a);
  const entities = AUDIT_ENTITY_OPTIONS.map((o) => o.value as string);
  for (const e of ["audit", "settings", "system", "queue_bookings"]) assert.ok(entities.includes(e), e);
  assert.deepEqual(AUDIT_RESULT_OPTIONS.map((o) => o.value), ["SUCCESS", "FAILURE", "DENIED"]);
  assert.equal(auditSourceLabel("web"), "หน้าเว็บ");
  assert.equal(auditSourceLabel("script"), "สคริปต์");
  assert.equal(auditSourceLabel(""), "—");
  // ตรวจกับ backend ใน worktree เดียวกัน (ถ้ามี) — รายการต้องตรงกันทุกตัว
  const be = path.resolve(import.meta.dirname, "../../woms-backend/src/domain/audit.ts");
  if (fs.existsSync(be)) {
    const src = fs.readFileSync(be, "utf8");
    const block = (name: string) => src.slice(src.indexOf(`export const ${name} = [`), src.indexOf("] as const", src.indexOf(`export const ${name} = [`)));
    assert.deepEqual([...new Set(actions)].sort(), [...block("AUDIT_ACTIONS").matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]).sort());
    assert.deepEqual([...new Set(entities)].sort(), [...block("AUDIT_ENTITIES").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort());
    assert.deepEqual(AUDIT_RESULT_OPTIONS.map((o) => o.value).sort(), [...block("AUDIT_RESULTS").matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]).sort());
  }
});
