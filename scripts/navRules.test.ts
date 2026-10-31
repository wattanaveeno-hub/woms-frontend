/** Navigation — บั๊กเมนูข้างหายในหน้า /map และ /master (startsWith("/m")) และเมนู Active ซ้อน */
import test from "node:test";
import assert from "node:assert/strict";
import { activeHref, isTechModePath, isUnder } from "../src/lib/navRules.ts";

test("โหมดช่างมือถือเฉพาะ /m และหน้าลูก — /map และ /master ไม่ใช่โหมดช่าง", () => {
  for (const p of ["/m", "/m/job/new", "/m/job/J01", "/m/booking/x"]) assert.equal(isTechModePath(p), true, p);
  for (const p of ["/map", "/master", "/master/team", "/master/warranty-presets", "/dashboard", "/"]) assert.equal(isTechModePath(p), false, p);
});

test("isUnder เทียบทั้ง segment", () => {
  assert.equal(isUnder("/jobs/J01", "/jobs"), true);
  assert.equal(isUnder("/jobs", "/jobs"), true);
  assert.equal(isUnder("/jobsx", "/jobs"), false);
  assert.equal(isUnder("/partners", "/parts"), false);
});

const HREFS = ["/dashboard", "/jobs", "/jobs/new", "/pm", "/equipment", "/map", "/parts", "/stock", "/documents", "/documents/new", "/partners", "/bills", "/master", "/settings/company", "/settings/stock", "/m"];

test("Active มีได้รายการเดียว และจับหน้าลูกได้", () => {
  const cases: Array<[string, string | null]> = [
    ["/jobs", "/jobs"], ["/jobs/new", "/jobs/new"], ["/jobs/J01", "/jobs"], ["/jobs/J01/chat", "/jobs"],
    ["/documents", "/documents"], ["/documents/new", "/documents/new"], ["/documents/abc", "/documents"],
    ["/master/team", "/master"], ["/master/warranty-presets", "/master"], ["/map", "/map"],
    ["/partners/new", "/partners"], ["/parts/abc", "/parts"], ["/settings/stock", "/settings/stock"], ["/stock", "/stock"],
    ["/bills/x/edit", "/bills"], ["/login", null], ["/chats", null],
  ];
  for (const [p, want] of cases) assert.equal(activeHref(p, HREFS), want, p);
});

test("เมนูที่ผู้ใช้ไม่มีสิทธิ์ (ไม่อยู่ใน hrefs) ไม่ถูกเลือกเป็น Active", () => {
  assert.equal(activeHref("/jobs/new", ["/jobs"]), "/jobs");
  assert.equal(activeHref("/users", ["/jobs"]), null);
});

// WS-02: ด่านสิทธิ์ /m (src/app/m/layout.tsx) ใช้สิทธิ์เดียวกับเมนู "โหมดมือถือช่าง" เสมอ
import { TECH_MODE_PERMISSION } from "../src/lib/navRules.ts";
import { navGroups as navGroupsForM } from "../src/lib/navMenu.ts";
test("WS-02: สิทธิ์เข้า /m = perm ของเมนู /m (svcqueue:respond)", () => {
  const m = navGroupsForM({ chat: false, serviceQueue: true, techQueue: false }).flatMap((g) => g.links).find((l) => l.href === "/m");
  assert.equal(m?.perm, TECH_MODE_PERMISSION);
  assert.equal(TECH_MODE_PERMISSION, "svcqueue:respond");
});
