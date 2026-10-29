/** Customer Recovery Round 2 (30 ต.ค. 2569) — กติกาฝั่งหน้าจอ */
import test from "node:test";
import assert from "node:assert/strict";
import { navGroups, visibleGroups } from "../src/lib/navMenu.ts";
import { applyMention, mentionOptions, mentionQueryOf, mentionsToSend } from "../src/lib/mentions.ts";
import { baht } from "../src/lib/bahtFormat.ts";

const F = { chat: false, serviceQueue: true, techQueue: false };
const PERMS: Record<string, string[]> = {
  sales: ["jobs:view", "jobs:view_all", "svcqueue:view", "svcqueue:request"],
  tech: ["jobs:view", "jobs:close", "svcqueue:view", "svcqueue:respond", "stock:view"],
  admin: ["jobs:view", "jobs:view_all", "svcqueue:view", "svcqueue:admin"],
};
const hrefs = (role: string) =>
  visibleGroups(navGroups(F), (p) => PERMS[role].includes(p), role).flatMap((g) => g.links.map((l) => l.href));

test("N-2: Sale ไม่เห็นเมนูแดชบอร์ด · Admin และช่างยังเห็น (TECH-01 แดชบอร์ดช่างเฉพาะงานตนเอง)", () => {
  assert.ok(!hrefs("sales").includes("/dashboard"));
  assert.ok(hrefs("admin").includes("/dashboard"));
  assert.ok(hrefs("tech").includes("/dashboard"));
});

test("CHAT-02: '@' ท้ายข้อความเปิดรายชื่อ · เลือกแล้วอ้างอิง User ID ไม่ใช่ชื่อ (ชื่อคล้ายกันแยกได้)", () => {
  const members = [
    { id: "u1", name: "สมชาย", role: "sales" },
    { id: "u2", name: "สมชาย ใจดี", role: "tech" },
    { id: "me", name: "แอดมิน", role: "admin" },
  ];
  assert.equal(mentionQueryOf("สวัสดี @สม"), "สม");
  assert.equal(mentionQueryOf("อีเมล a@b"), null);
  assert.equal(mentionQueryOf("ไม่มีแท็ก"), null);
  assert.deepEqual(mentionOptions(members, "สม", "me").map((m) => m.id), ["u1", "u2"]);
  assert.deepEqual(mentionOptions(members, "", "me").map((m) => m.id), ["u1", "u2"]);
  const t = applyMention("ฝากดู @สม", "สมชาย ใจดี");
  assert.equal(t, "ฝากดู @สมชาย ใจดี ");
  // เลือกคนที่สอง (ชื่อยาวกว่า) → ส่งเฉพาะ u2 แม้ข้อความมีคำว่า "@สมชาย" เป็นส่วนหนึ่ง เพราะ u1 ไม่ได้ถูกเลือก
  assert.deepEqual(mentionsToSend(["u2"], members, t), ["u2"]);
  // ลบชื่อออกจากข้อความแล้ว = ไม่แท็ก
  assert.deepEqual(mentionsToSend(["u2"], members, "ฝากดูด้วย"), []);
});

test("BUG-V2-17: baht() แสดง — เมื่อ API ส่งต้นทุนเป็น null ให้ช่าง", () => {
  assert.equal(baht(null), "—");
  assert.equal(baht(undefined), "—");
  assert.equal(baht(1234.5), (1234.5).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
});
