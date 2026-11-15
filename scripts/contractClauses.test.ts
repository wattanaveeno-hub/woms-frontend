/** UAT2-18 ข้อกำหนดเพิ่มเติมในสัญญา — ตรวจข้อความ · เลขข้อ · การจัดหน้า (splitClauses) */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLAUSE_LIMITS,
  MAIN_CLAUSE_LAST,
  clauseNumber,
  clausesOf,
  normalizeClauseText,
  splitClauses,
  toClausePayload,
  validateClauseTexts,
} from "../src/lib/contractClauses.ts";
import { RENTAL_PAGE1, RENTAL_TERMS, paragraphText } from "../src/lib/rentalContract.ts";

test("เลขข้อเริ่มต่อจากข้อสุดท้ายของเนื้อสัญญาหน้า 1 (ตรงกับแม่แบบจริง)", () => {
  const nums = RENTAL_PAGE1.map((p) => /^(\d+)\.\s/.exec(paragraphText(p, () => ""))?.[1]).filter(Boolean).map(Number);
  assert.equal(Math.max(...nums), MAIN_CLAUSE_LAST);
  assert.equal(clauseNumber(0), MAIN_CLAUSE_LAST + 1);
  assert.equal(clauseNumber(2), MAIN_CLAUSE_LAST + 3);
  // ข้อความแม่แบบไม่ถูกแก้ (ข้อตกลงท้ายสัญญายังเป็นชุดเลข 1..15 ของตัวเอง)
  assert.equal(RENTAL_TERMS[RENTAL_TERMS.length - 1].id, "15");
  assert.ok(RENTAL_PAGE1.some((p) => p.id === "witness"));
});

test("normalize: CRLF/ช่องว่างท้ายบรรทัด/อักขระซ่อน · ภาษาไทยคงเดิม", () => {
  assert.equal(normalizeClauseText(" ก่อน\r\nหลัง  \r\n"), "ก่อน\nหลัง");
  assert.equal(normalizeClauseText("ผู้‮เช่า"), "ผู้เช่า");
});

test("validate: ว่าง · HTML · ยาวเกิน · บรรทัดเกิน · จำนวนข้อเกิน · ผ่าน", () => {
  const r = validateClauseTexts(["", "<script>x</script>", "ก".repeat(CLAUSE_LIMITS.maxChars + 1), Array(CLAUSE_LIMITS.maxLines + 1).fill("ก").join("\n"), "ปกติ < 5 บาท"]);
  assert.match(r.perItem[0]!, /ว่าง/);
  assert.match(r.perItem[1]!, /HTML/);
  assert.match(r.perItem[2]!, /1001/);
  assert.match(r.perItem[3]!, /บรรทัด/);
  assert.equal(r.perItem[4], null);
  assert.match(validateClauseTexts(Array(CLAUSE_LIMITS.maxClauses + 1).fill("ก")).overall!, /ไม่เกิน/);
});

test("payload เรียง 1..n ตามลำดับบนจอ · clausesOf เรียงตาม order และรับสัญญาเดิมที่ไม่มีฟิลด์", () => {
  assert.deepEqual(toClausePayload(["ข ", "ก"]), [{ order: 1, text: "ข" }, { order: 2, text: "ก" }]);
  assert.deepEqual(clausesOf({ additionalClauses: [{ order: 2, text: "b" }, { order: 1, text: "a" }] }).map((c) => c.text), ["a", "b"]);
  assert.deepEqual(clausesOf({}), []);
  assert.deepEqual(clausesOf(null), []);
});

test("splitClauses: พอในหน้า 1 → แผ่นเดียว (ส่วนท้ายหน้า 1)", () => {
  assert.deepEqual(splitClauses([30, 30], 300, 900, 150, 20), [2]);
});
test("splitClauses: ล้นหน้า 1 → ข้อที่เหลือขึ้นแผ่นต่อเนื่อง ไม่ตัดกลางข้อ", () => {
  // หน้า 1 เหลือ 200: หัวข้อ 20 + 100 + 60 = 180 · ข้อ 3 (100) ไม่พอ → แผ่น 2
  assert.deepEqual(splitClauses([100, 60, 100], 200, 900, 150, 20), [2, 1]);
});
test("splitClauses: ส่วนท้ายไม่พอในแผ่นสุดท้าย → ยกข้อสุดท้ายไปพร้อมส่วนท้าย (ลายเซ็นไม่อยู่ลำพัง)", () => {
  // หน้า 1: 20 + 3×50 = 170 ≤ 200 แต่ +ส่วนท้าย 150 ไม่พอ → ข้อ 3 ไปแผ่น 2 พร้อมส่วนท้าย
  assert.deepEqual(splitClauses([50, 50, 50], 200, 900, 150, 20), [2, 1]);
});
test("splitClauses: ข้อเดียวในหน้า 1 ส่วนท้ายไม่พอ → ย้ายข้อนั้นไปแผ่นใหม่ (หัวข้อไม่ค้างหน้า 1)", () => {
  assert.deepEqual(splitClauses([100], 150, 900, 150, 20), [0, 1]);
});
test("splitClauses: หลายแผ่น (20 ข้อยาว)", () => {
  const sp = splitClauses(Array(20).fill(200), 400, 900, 150, 20);
  assert.equal(sp.reduce((a, b) => a + b, 0), 20);
  assert.ok(sp.length >= 4);
  // ทุกแผ่นต่อเนื่องมีอย่างน้อย 1 ข้อ · แผ่นสุดท้ายรับส่วนท้ายได้
  assert.ok(sp.slice(1).every((n) => n > 0));
  assert.ok(sp[sp.length - 1] * 200 + 150 <= 900);
});
