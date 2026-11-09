/** ตาราง PM รายเดือน — กติกาฝั่งหน้าเว็บ (FE-PM-01..13) และการแบ่งกลุ่มของตาราง (FE-TBL-01..03) */
import test from "node:test";
import assert from "node:assert/strict";
import {
  PM_ROUND_STATUSES,
  PM_ROUND_STATUS_LABEL,
  PM_ROUND_STATUS_TONE,
  addMonth,
  canPullEarly,
  cleanSearch,
  dateLabel,
  earlyFormError,
  earlyPreviewOf,
  noteFormError,
  statusText,
  filtersToQuery,
  monthBadge,
  monthLabel,
  parseRoundFilters,
  periodOptionGroups,
  reassignFormError,
  remainingText,
  shortYearMonth,
  techCell,
  togglePeriod,
} from "../src/lib/pmRoundRules.ts";
import { flattenGroups, groupRows, withGroupHeaders } from "../src/lib/tableGroups.ts";

test("FE-PM-01 ป้ายเดือนปี พ.ศ. ย่อ/เต็ม · ข้ามปี · ไม่มีค่า = ยังคำนวณไม่ได้", () => {
  assert.equal(monthLabel("2026-11"), "พ.ย. 2569");
  assert.equal(monthLabel("2026-11", true), "พฤศจิกายน 2569");
  assert.equal(monthLabel("2027-01"), "ม.ค. 2570");
  assert.equal(monthLabel(""), "ยังคำนวณไม่ได้");
  assert.equal(monthLabel("2026-13"), "ยังคำนวณไม่ได้");
  assert.equal(monthBadge("2026-09"), "ก.ย.");
  assert.equal(dateLabel("2026-11-12"), "12 พ.ย. 2569");
  assert.equal(addMonth("2026-12", 1), "2027-01");
  assert.equal(shortYearMonth("2027-01"), "ม.ค. 70");
});

test("FE-PM-02 สถานะ → ป้าย/โทนตาม Handoff ครบ 6 ค่า", () => {
  assert.deepEqual(
    PM_ROUND_STATUSES.map((s) => [s, PM_ROUND_STATUS_LABEL[s], PM_ROUND_STATUS_TONE[s]]),
    [
      ["OVERDUE", "ค้างจากเดือนก่อน", "error"],
      ["DUE", "ถึงรอบเดือนนี้", "warning"],
      ["UPCOMING", "ใกล้ถึงรอบ", "info"],
      ["LATER", "ยังไม่ถึงรอบ", "neutral"],
      ["DONE", "ทำแล้ว", "success"],
      ["NEEDS_REVIEW", "รอตรวจข้อมูล", "neutral"],
    ]
  );
});

test("FE-PM-03 ตัวกรองรอบ PM: ตามสถานะ 6 · ตามเดือนจาก API เรียงเก่า→ใหม่ ไม่ซ้ำ", () => {
  const g = periodOptionGroups(["2026-12", "2026-09", "2026-12", "bad"]);
  assert.equal(g[0].label, "ตามสถานะ");
  assert.equal(g[0].options.length, 6);
  assert.deepEqual(g[1].options, [{ value: "2026-09", label: "กันยายน 2569" }, { value: "2026-12", label: "ธันวาคม 2569" }]);
});

test("FE-PM-04 การ์ด: กดครั้งแรกกรอง · กดซ้ำกลับเป็นทุกเดือน", () => {
  assert.equal(togglePeriod("", "DUE"), "DUE");
  assert.equal(togglePeriod("DUE", "DUE"), "");
  assert.equal(togglePeriod("OVERDUE", "DUE"), "DUE");
});

test("FE-PM-05 ประเภท PM: เหลือ X รอบ · 0 = สีอันตราย · เครื่องเช่าไม่มีตัวเลข", () => {
  assert.deepEqual(remainingText({ remaining: 3 }), { text: "เหลือ 3 รอบ", zero: false });
  assert.deepEqual(remainingText({ remaining: 0 }), { text: "เหลือ 0 รอบ", zero: true });
  assert.equal(remainingText(null), null);
});

test("FE-PM-06 ช่าง: ยังไม่ระบุ = ระบุช่าง · ปรับเฉพาะรอบ · ทำแล้วไม่มีช่าง = –", () => {
  assert.deepEqual(techCell({ status: "DUE", roundTech: null }), { text: "ระบุช่าง", unassigned: true, roundOnly: false });
  assert.deepEqual(techCell({ status: "DUE", roundTech: { name: "ช่างอาท", source: "ADMIN_ROUND" } }), { text: "ช่างอาท", unassigned: false, roundOnly: true });
  assert.deepEqual(techCell({ status: "DONE", roundTech: null }), { text: "–", unassigned: false, roundOnly: false });
});

test("FE-PM-07 ฟอร์มเปลี่ยนช่าง: เหตุผลว่าง/ช่องว่าง/เกิน 160 · ย้ายเฉพาะรอบต้องเลือกช่าง", () => {
  assert.equal(reassignFormError({ scope: "ROUND_ONLY", technicianId: "t", reason: "  " })?.message, "กรุณาระบุเหตุผลที่เปลี่ยนช่าง");
  assert.equal(reassignFormError({ scope: "ROUND_ONLY", technicianId: "t", reason: "ก".repeat(161) })?.field, "reason");
  assert.equal(reassignFormError({ scope: "ROUND_ONLY", technicianId: "", reason: "x" })?.field, "technicianId");
  assert.equal(reassignFormError({ scope: "OWNER_FROM_NEXT", technicianId: "", reason: "x" }), null);
});

test("FE-PM-08 ตัวกรองใน URL: ค่าเริ่มต้น = ภาพรวม + ทุกเดือน · ค่าผิดรูปแบบถูกเมิน · เขียนกลับได้", () => {
  const q = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
  assert.deepEqual(parseRoundFilters(q({})), { view: "overview", period: "", technicianId: "", q: "" });
  assert.deepEqual(parseRoundFilters(q({ view: "technicians", period: "2026-11", tech: "UNASSIGNED" })), { view: "technicians", period: "2026-11", technicianId: "UNASSIGNED", q: "" });
  assert.deepEqual(parseRoundFilters(q({ view: "x", period: "2026-13", tech: "<script>" })), { view: "overview", period: "", technicianId: "", q: "" });
  assert.equal(filtersToQuery({ view: "overview", period: "", technicianId: "", q: "" }), "");
  assert.equal(filtersToQuery({ view: "technicians", period: "DUE", technicianId: "t1", q: "" }), "?view=technicians&period=DUE&tech=t1");
  assert.equal(filtersToQuery({ view: "overview", period: "DUE", technicianId: "", q: "ICE 01" }), "?period=DUE&q=ICE+01");
});

test("FE-TBL-01 groupRows: ลำดับตาม order · กลุ่มนอก order ต่อท้าย · ในกลุ่มคงลำดับเดิม", () => {
  const rows = [{ g: "B", n: 1 }, { g: "U", n: 2 }, { g: "A", n: 3 }, { g: "B", n: 4 }, { g: "X", n: 5 }];
  const groups = groupRows(rows, (r) => r.g, ["A", "B", "U"]);
  assert.deepEqual(groups.map((g) => [g.key, g.rows.map((r) => r.n)]), [["A", [3]], ["B", [1, 4]], ["U", [2]], ["X", [5]]]);
  const flat = flattenGroups(groups);
  assert.deepEqual(flat.rows.map((r) => r.n), [3, 1, 4, 2, 5]);
  assert.equal(flat.counts.get("B"), 2);
});

test("FE-TBL-02 หัวกลุ่มแทรกเมื่อกลุ่มเปลี่ยน · หน้าถัดไปที่เริ่มกลางกลุ่มมีหัวกลุ่มซ้ำ", () => {
  const page2 = [{ g: "B", n: 4 }, { g: "U", n: 2 }];
  assert.deepEqual(withGroupHeaders(page2, (r) => r.g), [{ header: "B" }, { row: page2[0] }, { header: "U" }, { row: page2[1] }]);
});

test("FE-TBL-03 ไม่ส่ง order = ลำดับที่พบ (ตารางที่ไม่ใช้ groupBy ไม่เรียกฟังก์ชันนี้เลย)", () => {
  assert.deepEqual(groupRows([{ g: "Z" }, { g: "A" }], (r) => r.g).map((g) => g.key), ["Z", "A"]);
});

test("FE-PM-09 คำค้น (PM-06): ตัดช่องว่าง/อักขระควบคุม · ยาวไม่เกิน 64 · ค่าใน URL ผ่าน cleanSearch", () => {
  assert.equal(cleanSearch("  ICE-01   21 "), "ICE-01 21");
  assert.equal(cleanSearch("a\u0000b\nc"), "a b c");
  assert.equal(cleanSearch("ก".repeat(80)).length, 64);
  assert.equal(cleanSearch(null), "");
  const q = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
  assert.equal(parseRoundFilters(q({ q: "  vp " })).q, "vp");
});

test("FE-PM-10 ตัวอย่างผลต่อรอบถัดไป (PM-07): แผน ม.ค. 70 · ทำ พ.ย. 69 · ทุก 3 เดือน → คงแผน เม.ย. 70 · ขยับ ก.พ. 70 · นอกแผน ม.ค. 70", () => {
  assert.deepEqual(earlyPreviewOf({ plannedMonth: "2027-01", dueDate: "2027-01-15", intervalMonths: 3, currentMonth: "2026-11" }), {
    plannedMonth: "2027-01",
    workMonth: "2026-11",
    keepPlanNext: "2027-04",
    shiftActualNextIfDoneInWorkMonth: "2027-02",
    unscheduledKeepsPlan: "2027-01",
  });
  assert.equal(earlyPreviewOf({ plannedMonth: "2027-01", dueDate: "", intervalMonths: 0, currentMonth: "2026-11" }).keepPlanNext, "");
});

test("FE-PM-11 ปุ่มนัด PM ก่อนรอบ: เฉพาะรอบตามแผนที่อยู่หลังเดือนนี้ · ไม่ใช่ทำแล้ว/รอตรวจ/หยุดบริการ/นอกแผน", () => {
  const r = { kind: "SCHEDULED", status: "UPCOMING", plannedMonth: "2027-01", roundMonth: "2027-01", earlyMode: "", entitlementEnded: false, serviceStopped: false };
  assert.equal(canPullEarly(r, "2026-11"), true);
  assert.equal(canPullEarly({ ...r, plannedMonth: "2026-11", roundMonth: "2026-11", status: "DUE" }, "2026-11"), false);
  assert.equal(canPullEarly({ ...r, status: "NEEDS_REVIEW" }, "2026-11"), false);
  assert.equal(canPullEarly({ ...r, serviceStopped: true }, "2026-11"), false);
  assert.equal(canPullEarly({ ...r, kind: "UNSCHEDULED" }, "2026-11"), false);
  assert.equal(canPullEarly({ ...r, entitlementEnded: true }, "2026-11"), true); // ยังเพิ่ม PM นอกแผนได้
});

test("FE-PM-12 ฟอร์มนัด PM ก่อนรอบ: ต้องเลือกประเภท · ใช้แทนรอบต้องเลือกวิธีวางแผน · เหตุผลบังคับ ≤160 · ไม่มีช่องวันเวลา", () => {
  assert.equal(earlyFormError({ requestType: "", planMode: "", reason: "x" })?.field, "requestType");
  assert.equal(earlyFormError({ requestType: "REPLACE", planMode: "", reason: "x" })?.field, "planMode");
  assert.equal(earlyFormError({ requestType: "REPLACE", planMode: "KEEP_PLAN", reason: " " })?.field, "reason");
  assert.equal(earlyFormError({ requestType: "UNSCHEDULED", planMode: "", reason: "ก".repeat(161) })?.field, "reason");
  assert.equal(earlyFormError({ requestType: "UNSCHEDULED", planMode: "", reason: "ลูกค้าขอ" }), null);
});

test("FE-PM-13 หมายเหตุลูกค้า ≤200 · ป้าย ทำแล้ว · เข้าก่อนรอบ", () => {
  assert.equal(noteFormError("ก".repeat(200)), null);
  assert.match(noteFormError("ก".repeat(201)) ?? "", /200/);
  assert.equal(statusText({ status: "DONE", earlyDone: true }), "ทำแล้ว · เข้าก่อนรอบ");
  assert.equal(statusText({ status: "DONE", earlyDone: false }), "ทำแล้ว");
  assert.equal(statusText({ status: "DUE" }), "ถึงรอบเดือนนี้");
});
