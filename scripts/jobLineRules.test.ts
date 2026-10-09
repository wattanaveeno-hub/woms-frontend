/** JOB-01 / AT-04 — กติกาข้อมูลรายเครื่องตามประเภทงาน (ต้องตรงกับ backend lineFieldIssues) */
import test from "node:test";
import assert from "node:assert/strict";
import { lineFieldIssues, warrantyAllowed } from "../src/lib/jobLineRules.ts";

test("ประกันบริษัทเฉพาะงานติดตั้งขาย (และค่าเดิม INSTALL)", () => {
  assert.equal(warrantyAllowed("INSTALL_SALE"), true);
  assert.equal(warrantyAllowed("INSTALL"), true);
  for (const t of ["INSTALL_RENT", "PM", "CM", "PM_CM", "MOVE", "RETRIEVE", "REMOVE", "PART_REPLACE", "OTHER", ""]) {
    assert.equal(warrantyAllowed(t), false, t);
    assert.equal(lineFieldIssues(t, { warrantyMonths: 12 })[0]?.field, "warrantyMonths", t);
    assert.equal(lineFieldIssues(t, { warrantyStart: "2026-10-01" }).length, 1, t);
    assert.deepEqual(lineFieldIssues(t, { warrantyMonths: 0, warrantyStart: "" }), [], t);
  }
  assert.deepEqual(lineFieldIssues("INSTALL_SALE", { warrantyMonths: 12, warrantyStart: "2026-10-01" }), []);
  assert.equal(lineFieldIssues("INSTALL_SALE", { warrantyStart: "2026-10-01" })[0]?.field, "warrantyMonths");
});

test("PM Package / เช่า ต้องครบตามแบบที่เลือก", () => {
  assert.deepEqual(
    lineFieldIssues("PM", { pmMode: "PACKAGE" }).map((i) => i.field),
    ["pmRounds", "pmEveryMonths"]
  );
  assert.deepEqual(lineFieldIssues("PM", { pmMode: "PACKAGE", pmRounds: 2, pmEveryMonths: 6 }), []);
  assert.deepEqual(
    lineFieldIssues("INSTALL_RENT", { pmMode: "RENTAL", pmEveryMonths: 3 }).map((i) => i.field),
    ["pmYears"]
  );
  assert.deepEqual(lineFieldIssues("INSTALL_RENT", { pmMode: "RENTAL", pmYears: 3, pmEveryMonths: 3 }), []);
  assert.deepEqual(lineFieldIssues("CM", { pmMode: "", pmRounds: 5 }), []);
});
