import { test } from "node:test";
import assert from "node:assert/strict";
import { apptRelative } from "../src/lib/apptRelative.ts";

test("apptRelative: วันนี้/พรุ่งนี้/เลยนัด/อีก N วัน/ไม่มีวันนัด", () => {
  assert.equal(apptRelative("2026-11-14", "09:00", "2026-11-14").main, "วันนี้ 09:00");
  assert.equal(apptRelative("2026-11-15", "", "2026-11-14").main, "พรุ่งนี้");
  assert.equal(apptRelative("2026-11-10", "13:00", "2026-11-14").days, -4);
  assert.equal(apptRelative("2026-11-20", "", "2026-11-14").sub, "อีก 6 วัน");
  assert.deepEqual(apptRelative(undefined, undefined, "2026-11-14"), { main: "—", sub: "ยังไม่นัด", days: null });
});
