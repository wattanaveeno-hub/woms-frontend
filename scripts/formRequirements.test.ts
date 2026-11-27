/** UX Redesign — ช่องบังคับของฟอร์มเปิดคิว/เปิดงาน ต้องตรงกับกติกาเดิมทุกกรณี และ completion ไม่นับช่องไม่บังคับ */
import test from "node:test";
import assert from "node:assert/strict";
import {
  completionOf,
  jobRequirements,
  missingInOrder,
  queueRequirements,
  sectionSummaries,
  type QueueRequirementInput,
} from "../src/lib/formRequirements.ts";
import { queueFormIssues } from "../src/lib/serviceQueueRules.ts";

const missingFields = (rows: ReturnType<typeof queueRequirements>) =>
  rows.filter((r) => r.required && !r.filled).map((r) => r.field).sort();

test("เปิดคิว: ช่องที่ขาดตรงกับ queueFormIssues ทุกชุดค่าทดสอบ (ไม่เพิ่ม/ไม่ลดกฎ)", () => {
  const jobTypes = ["", "INSTALL", "INSTALL_SALE", "INSTALL_RENT", "REMOVE", "PM", "CM", "OTHER", "MOVE"];
  const subTypes = ["", "PICKUP_REPAIR"];
  const names: Partial<QueueRequirementInput>[] = [{}, { jobName: "ร้าน A" }, { customerName: "บริษัท B" }, { storeName: "สาขา C" }, { jobName: "  " }];
  const contact: Partial<QueueRequirementInput>[] = [{}, { contactName: "คุณนิด", phone: "0812345678" }, { contactName: "คุณนิด" }, { phone: "02" }];
  const place: Partial<QueueRequirementInput>[] = [{}, { address: "88 บางนา" }, { siteId: "S1" }];
  const items: QueueRequirementInput["items"][] = [[], [{ equipmentId: "E1" }], [{ model: "B-301SA" }], [{ machineType: "ตู้แช่" }], [{}], [null]];
  const notes = ["", "ลูกค้าขอเช้า"];
  let n = 0;
  for (const jobType of jobTypes)
    for (const jobSubType of subTypes)
      for (const nm of names)
        for (const c of contact)
          for (const p of place)
            for (const it of items)
              for (const note of notes) {
                const v: QueueRequirementInput = { jobType, jobSubType, note, items: it, ...nm, ...c, ...p };
                const expected = queueFormIssues(v as any).map((i) => i.field).sort();
                assert.deepEqual(missingFields(queueRequirements(v)), expected, JSON.stringify(v));
                n++;
              }
  assert.ok(n > 10_000, `ทดสอบ ${n} ชุด`);
});

test("เปิดคิว: วันที่ลูกค้าสะดวกและหมายเหตุ (ไม่ใช่ อื่น ๆ) ไม่อยู่ในตัวหาร completion", () => {
  const full: QueueRequirementInput = {
    jobType: "INSTALL_SALE", jobName: "ร้าน A", contactName: "คุณนิด", phone: "0812345678", address: "88", items: [{ model: "B-301SA" }],
  };
  const a = completionOf(queueRequirements(full));
  const b = completionOf(queueRequirements({ ...full, preferredDate: "2026-12-01", note: "x" }));
  assert.equal(a.percent, 100);
  assert.deepEqual(a, b, "กรอกช่องไม่บังคับเพิ่มต้องไม่เปลี่ยน completion");
  assert.equal(a.requiredTotal, 6);
  const empty = completionOf(queueRequirements({}));
  assert.equal(empty.requiredDone, 0);
  assert.equal(empty.requiredTotal, 6);
});

test("เปิดคิว: ช่องบังคับตามเงื่อนไขขึ้นเฉพาะเมื่อเงื่อนไขจริง", () => {
  const base = { jobName: "A", contactName: "B", phone: "1", address: "C", items: [{ model: "M" }] };
  assert.equal(completionOf(queueRequirements({ ...base, jobType: "PM" })).requiredTotal, 6);
  assert.equal(completionOf(queueRequirements({ ...base, jobType: "REMOVE" })).requiredTotal, 7, "REMOVE + ประเภทย่อย");
  assert.equal(completionOf(queueRequirements({ ...base, jobType: "OTHER" })).requiredTotal, 7, "OTHER + หมายเหตุ");
  assert.equal(completionOf(queueRequirements({ ...base, jobType: "INSTALL" })).percent < 100, true, "INSTALL เปล่ายังไม่ครบ");
});

test("เปิดงาน: ช่องบังคับตรงกับ createJobSchema + JobForm.submit()", () => {
  const ctx = { isNew: true, hasSalespeople: true };
  const empty = jobRequirements({}, ctx);
  assert.deepEqual(
    empty.filter((r) => r.required).map((r) => r.field).sort(),
    ["installAddress", "jobDate", "jobName", "jobType", "salesPerson", "technicianTeam"]
  );
  // ลูกค้า ผู้ติดต่อ เบอร์ เวลา เครื่อง ไม่บังคับ
  for (const f of ["customerId", "phone", "jobTime", "equipment"]) {
    assert.equal(empty.find((r) => r.field === f)?.required, false, f);
  }
  // ไม่มีรายชื่อเซลล์ → เซลล์ไม่บังคับ · แก้ใบงานเก่า → ที่อยู่ติดตั้งไม่บังคับ และ INSTALL เปล่าไม่ถูกตีกลับ
  const edit = jobRequirements({ jobType: "INSTALL" }, { isNew: false, hasSalespeople: false });
  assert.equal(edit.find((r) => r.field === "salesPerson")?.required, false);
  assert.equal(edit.find((r) => r.field === "installAddress")?.required, false);
  assert.equal(edit.find((r) => r.field === "jobType")?.filled, true);
  assert.equal(jobRequirements({ jobType: "INSTALL" }, ctx).find((r) => r.field === "jobType")?.filled, false);
  // ตามเงื่อนไข
  assert.ok(jobRequirements({ jobType: "REMOVE" }, ctx).some((r) => r.field === "jobSubType" && r.required));
  assert.equal(jobRequirements({ jobType: "OTHER" }, ctx).find((r) => r.field === "note")?.required, true);
  assert.equal(jobRequirements({ jobType: "PM" }, ctx).find((r) => r.field === "note")?.required, false);
  assert.ok(jobRequirements({}, { ...ctx, refJobId: "JN-1" }).some((r) => r.field === "refReason" && r.required && !r.filled));
  assert.ok(!jobRequirements({}, { ...ctx, isNew: false, refJobId: "JN-1" }).some((r) => r.field === "refReason"));
});

test("เปิดงาน: completion นับเฉพาะช่องบังคับ และช่องที่ขาดเรียงตามลำดับส่วนบนจอ", () => {
  const ctx = { isNew: true, hasSalespeople: true };
  const rows = jobRequirements({ jobType: "PM", jobName: "PM ร้าน A", customerId: "C1", phone: "02" }, ctx);
  const c = completionOf(rows);
  assert.equal(c.requiredTotal, 6);
  assert.equal(c.requiredDone, 2);
  assert.equal(c.percent, 33);
  assert.deepEqual(missingInOrder(rows).map((r) => r.field), ["installAddress", "salesPerson", "jobDate", "technicianTeam"]);
});

test("สรุปรายส่วน: ครบ / ต้องกรอกอีก N ช่อง / ไม่บังคับ", () => {
  const rows = jobRequirements({ jobType: "PM", jobName: "x", installAddress: "y" }, { isNew: true, hasSalespeople: false });
  const s = Object.fromEntries(sectionSummaries(rows).map((x) => [x.section, x]));
  assert.equal(s.job.state, "done");
  assert.equal(s.customer.state, "done");
  assert.equal(s.machines.state, "optional");
  assert.equal(s.schedule.state, "missing");
  assert.equal(s.schedule.missingCount, 2);
  assert.equal(s.schedule.firstMissing?.field, "jobDate");
});
