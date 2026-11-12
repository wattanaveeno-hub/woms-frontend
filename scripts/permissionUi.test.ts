/**
 * หน้าบทบาท / สิทธิ์รายบุคคล (12 พ.ย. 69) — ตารางสิทธิ์และกติกาเพิ่ม/ตัด
 *   npm test  (= node --test scripts/*.test.ts)
 */
import test from "node:test";
import assert from "node:assert/strict";

import { buildMatrix, canDeny, canGrant, permLabel } from "../src/lib/permissionUi.ts";
import { passwordChecklist } from "../src/lib/passwordRules.ts";

const items = [
  { key: "jobs:view", group: "jobs", action: "view", uiGroup: "jobs", uiAction: "view" },
  { key: "jobs:view_all", group: "jobs", action: "view_all", uiGroup: "jobs", uiAction: "view" },
  { key: "jobs:create", group: "jobs", action: "create", uiGroup: "jobs", uiAction: "create" },
  { key: "bill:export", group: "bill", action: "export", uiGroup: "bills", uiAction: "export" },
] as const;

test("buildMatrix นับสิทธิ์ที่ถือต่อช่อง (เรื่อง × การกระทำ)", () => {
  const m = buildMatrix(items as any, new Set(["jobs:view", "bill:export"]));
  assert.deepEqual(m.get("jobs|view"), { total: 2, on: 1, keys: ["jobs:view"] });
  assert.deepEqual(m.get("jobs|create"), { total: 1, on: 0, keys: [] });
  assert.deepEqual(m.get("bills|export"), { total: 1, on: 1, keys: ["bill:export"] });
  assert.equal(m.get("bills|view"), undefined);
});

test("canGrant: ต้องอยู่ในรายการมอบต่อได้ · ห้ามสิทธิ์ขอบเขตข้อมูล · Developer มอบได้ทุกตัวยกเว้นขอบเขต", () => {
  assert.equal(canGrant("jobs:create", ["jobs:create"], false), true);
  assert.equal(canGrant("bill:approve", ["jobs:create"], false), false);
  assert.equal(canGrant("jobs:view_all", ["jobs:view_all"], false), false);
  assert.equal(canGrant("bill:approve", [], true), true);
  assert.equal(canGrant("jobs:view_all", [], true), false);
});

test("canDeny: ตัดได้ทุกสิทธิ์ ยกเว้นจัดการผู้ใช้", () => {
  assert.equal(canDeny("bill:export"), true);
  assert.equal(canDeny("users:manage"), false);
});

test("permLabel แปลเป็นภาษาไทย · ไม่รู้จัก = คืนรหัสเดิม", () => {
  assert.equal(permLabel("bill:export"), "บิลช่าง · ส่งออก");
  assert.equal(permLabel("foo:bar"), "foo:bar");
});

test("passwordChecklist: 3 ข้อบังคับ + 1 ข้อแนะนำ", () => {
  const c = passwordChecklist({ currentPassword: "old-pass-1", newPassword: "NewPass12", confirmPassword: "NewPass12" });
  assert.deepEqual(c.map((x) => [x.ok, x.required]), [[true, true], [true, true], [true, true], [true, false]]);
  const bad = passwordChecklist({ currentPassword: "same1234", newPassword: "same1234", confirmPassword: "x" });
  assert.deepEqual(bad.map((x) => x.ok), [true, false, false, false]);
});
