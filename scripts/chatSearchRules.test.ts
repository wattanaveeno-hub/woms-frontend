// CHAT-SR02 ค้นข้อความแบบ LINE · CHAT-AV01 รูปโปรไฟล์ — ฟังก์ชันบริสุทธิ์
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avatarColorOf,
  avatarStale,
  centerSquare,
  filterMembers,
  initialsOf,
  normalizeTerm,
  positionLabel,
  resultDateLabel,
  searchableTextOf,
  snippetAround,
  splitHighlight,
  stepResult,
} from "../src/lib/chatSearchRules.ts";

test("SR-U1 คำค้น: ตัดช่องว่าง · น้อยกว่า 2 ตัวอักษร = ว่าง · ไม่เกิน 100", () => {
  assert.equal(normalizeTerm("  Ro "), "Ro");
  assert.equal(normalizeTerm(" R "), "");
  assert.equal(normalizeTerm("ก".repeat(150)).length, 100);
});

test("SR-U2 ไฮไลต์: ไม่สนตัวพิมพ์ · หลายตำแหน่ง · ไม่ตีความ regex", () => {
  assert.deepEqual(splitHighlight("Hello Roland ro", "RO"), [
    { text: "Hello ", hit: false },
    { text: "Ro", hit: true },
    { text: "land ", hit: false },
    { text: "ro", hit: true },
  ]);
  assert.deepEqual(splitHighlight("a.b(c)", ".b("), [
    { text: "a", hit: false },
    { text: ".b(", hit: true },
    { text: "c)", hit: false },
  ]);
  assert.deepEqual(splitHighlight("abc", ""), [{ text: "abc", hit: false }]);
  assert.deepEqual(splitHighlight("", "x"), []);
});

test("SR-U3 ข้อความย่อ: คำที่ตรงท้ายข้อความยาวยังอยู่ในผล", () => {
  const long = "ก".repeat(200) + " คิว Q-2026-001 " + "ข".repeat(50);
  const s = snippetAround(long, "q-2026-001", 60);
  assert.ok(s.includes("Q-2026-001"), s);
  assert.ok(s.startsWith("…") && s.endsWith("…"));
  assert.ok(s.length <= 62);
  assert.equal(snippetAround("สั้น", "x"), "สั้น");
});

test("SR-U4 ข้อความของผล: ไฟล์แนบ / Reply / เลขคิว ตามสิ่งที่ตรง", () => {
  assert.equal(searchableTextOf({ text: "", attachments: [{ name: "ใบเสนอราคา.pdf" }] }, "ใบเสนอ"), "📎 ใบเสนอราคา.pdf");
  assert.equal(searchableTextOf({ text: "โอเค", replyTo: { excerpt: "ไป Roland" } }, "roland"), "↩ ไป Roland");
  // CHAT-SR03: ตรงในการ์ดคิว → แสดงช่องที่ตรง · ข้อความเองตรงก่อน = ใช้ข้อความ
  assert.equal(searchableTextOf({ text: "Admin รับคิว", cardMatch: { label: "เซลล์", value: "ฝ่ายขาย ก๊ฟ" } }, "ก๊ฟ"), "🗂 เซลล์: ฝ่ายขาย ก๊ฟ");
  assert.equal(searchableTextOf({ text: "รับคิว ร้านก๊ฟ", cardMatch: { label: "ร้าน", value: "ร้านก๊ฟ" } }, "ก๊ฟ"), "รับคิว ร้านก๊ฟ");
  assert.equal(searchableTextOf({ text: "โอเค", replyTo: { excerpt: "ไป Roland", cancelled: true } }, "roland"), "โอเค");
  assert.equal(searchableTextOf({ text: "", ref: { queueNo: "Q-1", jobId: "JN-9" } }, "q-1"), "Q-1 / JN-9");
});

test("SR-U5 สมาชิก: กรองตามชื่อ · คำว่าง = ไม่มีผล", () => {
  const ms = [{ name: "Roland" }, { name: "Robert" }, { name: "สมชาย" }];
  assert.deepEqual(filterMembers(ms, "rol").map((m) => m.name), ["Roland"]);
  assert.deepEqual(filterMembers(ms, "ro").map((m) => m.name), ["Roland", "Robert"]);
  assert.deepEqual(filterMembers(ms, " "), []);
});

test("SR-U6 ปุ่ม ▲▼: ▲ = เก่ากว่า · ▼ = ใหม่กว่า · สุดรายการแต่มีหน้าต่อไป = LOAD", () => {
  assert.deepEqual(stepResult(0, 3, "older", false), { kind: "GO", index: 1 });
  assert.deepEqual(stepResult(2, 3, "older", false), { kind: "NONE" });
  assert.deepEqual(stepResult(2, 3, "older", true), { kind: "LOAD" });
  assert.deepEqual(stepResult(0, 3, "newer", true), { kind: "NONE" });
  assert.deepEqual(stepResult(2, 3, "newer", false), { kind: "GO", index: 1 });
  assert.deepEqual(stepResult(0, 0, "older", false), { kind: "NONE" });
  assert.equal(positionLabel(2, 65, false), "3/65");
  assert.equal(positionLabel(0, 50, true), "1/50+");
});

test("SR-U7 วันที่ผลแบบ LINE (เวลาไทย)", () => {
  const now = new Date("2026-11-12T05:00:00.000Z"); // 12:00 ไทย
  assert.equal(resultDateLabel("2026-11-12T02:05:00.000Z", now), "09:05");
  assert.equal(resultDateLabel("2026-11-11T18:30:00.000Z", now), "01:30"); // 12 พ.ย. 01:30 ไทย = วันเดียวกัน
  assert.equal(resultDateLabel("2026-04-25T03:00:00.000Z", now), "25 เม.ย.");
  assert.equal(resultDateLabel("2025-04-20T03:00:00.000Z", now), "20/4/68");
  assert.equal(resultDateLabel("bad", now), "");
});

test("AV-U1 อักษรย่อ: ข้ามสระหน้า · อังกฤษตัวใหญ่ · ว่าง = ?", () => {
  assert.equal(initialsOf("เอกชัย ใจดี"), "อ");
  assert.equal(initialsOf("ไพโรจน์"), "พ");
  assert.equal(initialsOf("robert"), "R");
  assert.equal(initialsOf("  "), "?");
  assert.equal(avatarColorOf("u1"), avatarColorOf("u1"));
});

test("AV-U2 cache รูป: presigned หมดอายุ 45 นาที · data URL ไม่หมด · ไม่มีรายการ = ต้องโหลด", () => {
  assert.equal(avatarStale(undefined, 0), true);
  assert.equal(avatarStale({ url: "https://x/y", at: 0 }, 44 * 60_000), false);
  assert.equal(avatarStale({ url: "https://x/y", at: 0 }, 46 * 60_000), true);
  assert.equal(avatarStale({ url: null, at: 0 }, 46 * 60_000), true);
  assert.equal(avatarStale({ url: "data:image/png;base64,AA", at: 0 }, 1e12), false);
  assert.deepEqual(centerSquare(400, 300), { sx: 50, sy: 0, size: 300 });
});
