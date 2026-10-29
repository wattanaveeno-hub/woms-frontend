/** Customer Feedback v2 (29 ต.ค. 2569) — กติกาฝั่งหน้าจอที่เพิ่ม/เปลี่ยนในรอบ customer recovery */
import test from "node:test";
import assert from "node:assert/strict";
import { INSTALL_GROUP, installSubtypeError, installSubtypeOf, jobTypeFromMain, mainTypeOf, mainTypeOptions } from "../src/lib/installType.ts";
import { navGroups, visibleGroups } from "../src/lib/navMenu.ts";
import { SQ_STATUS_LABEL, queueButtons } from "../src/lib/serviceQueueRules.ts";

const JOB_TYPES = [
  { value: "INSTALL", label: "ติดตั้ง" },
  { value: "INSTALL_RENT", label: "ติดตั้งเช่า" },
  { value: "INSTALL_SALE", label: "ติดตั้งขาย" },
  { value: "PM", label: "PM" },
  { value: "REMOVE", label: "ซ่อมถอน" },
  { value: "OTHER", label: "อื่น ๆ" },
];

test("INST-01: ติดตั้ง/ติดตั้งเช่า/ติดตั้งขาย รวมเป็นประเภทหลัก 'ติดตั้ง' ตัวเดียว แล้วเลือกเช่า/ขาย", () => {
  const opts = mainTypeOptions(JOB_TYPES, "", ["REMOVE"]);
  assert.deepEqual(opts.map((o) => o.value), [INSTALL_GROUP, "PM", "OTHER"]);
  assert.equal(opts[0].label, "ติดตั้ง");
  assert.equal(mainTypeOf("INSTALL_RENT"), INSTALL_GROUP);
  assert.equal(installSubtypeOf("INSTALL_SALE"), "INSTALL_SALE");
  assert.equal(installSubtypeOf("INSTALL"), "");
  assert.equal(jobTypeFromMain(INSTALL_GROUP, "PM"), "INSTALL");
  assert.equal(jobTypeFromMain(INSTALL_GROUP, "INSTALL_SALE"), "INSTALL_SALE");
  assert.equal(jobTypeFromMain("PM", "INSTALL_SALE"), "PM");
  assert.match(installSubtypeError("INSTALL") ?? "", /เช่า หรือ ขาย/);
  assert.equal(installSubtypeError("INSTALL_RENT"), null);
  // ข้อมูลเก่าที่เป็น REMOVE ยังแสดงค่าของตัวเองได้
  assert.ok(mainTypeOptions(JOB_TYPES, "REMOVE", ["REMOVE"]).some((o) => o.value === "REMOVE"));
});

const PERMS: Record<string, string[]> = {
  // สำเนาย่อจาก woms-backend/src/domain/user.ts (หลังปรับ NAV-01 v2) — เฉพาะสิทธิ์ที่เมนูใช้
  admin: ["jobs:view", "jobs:create", "svcqueue:view", "chat:check_queue", "calendar:view", "pm:view", "equipment:view", "partners:view", "map:view", "inventory:view", "stock:view", "contracts:view", "quotations:view", "documents:view", "documents:create", "bill:view", "master:manage", "stock:manage", "tracking:view"],
  sales: ["jobs:view", "svcqueue:view", "chat:check_queue", "calendar:view", "pm:view", "equipment:view", "partners:view", "map:view", "inventory:view", "contracts:view", "tracking:view"],
  tech: ["jobs:view", "svcqueue:view", "svcqueue:respond", "chat:own_tech_group", "calendar:view", "pm:view", "equipment:view", "inventory:view", "map:view", "stock:view", "bill:view"],
};
const menu = (role: string) =>
  visibleGroups(navGroups({ chat: false, serviceQueue: true, techQueue: false }), (p) => PERMS[role].includes(p), role).flatMap((g) => g.links.map((l) => l.href));

test("NAV-02: ติดตามช่าง / สต๊อกรวม / คู่ค้า ไม่อยู่ในเมนู · การแจ้งเตือนยังอยู่ (รอยืนยัน)", () => {
  for (const r of ["admin", "sales", "tech"]) {
    const m = menu(r);
    for (const h of ["/tracking", "/inventory", "/partners"]) assert.ok(!m.includes(h), `${r} ${h}`);
  }
  assert.ok(menu("admin").includes("/notifications"));
});

test("NAV-01: โหมดมือถือช่าง — ช่างเท่านั้น · ใบเสนอราคา/เอกสาร/บิล/อะไหล่ — ไม่แสดงให้ Sale", () => {
  assert.ok(menu("tech").includes("/m"));
  assert.ok(!menu("admin").includes("/m"));
  assert.ok(!menu("sales").includes("/m"));
  for (const h of ["/quotations", "/documents", "/bills", "/parts", "/stock"]) assert.ok(!menu("sales").includes(h), h);
  for (const h of ["/quotations", "/documents", "/documents/new", "/bills", "/parts", "/stock"]) assert.ok(menu("admin").includes(h), h);
  // ช่าง: ไม่เห็นงานทั้งหมด/คลังเครื่องในเมนู (ใช้โหมดมือถือ) แต่เห็นวางบิล/อะไหล่/PM/แผนที่ของตนเอง
  for (const h of ["/jobs", "/equipment"]) assert.ok(!menu("tech").includes(h), h);
  for (const h of ["/bills", "/stock", "/pm", "/map", "/service-queue", "/group-chat"]) assert.ok(menu("tech").includes(h), h);
});

test("WF-01: คอนเฟิร์มลูกค้าแล้ว = รอ Admin เปิดงาน · ปุ่มเปิด JN มีเฉพาะ Admin · เซลล์ไม่มีปุ่มเปิดงาน", () => {
  assert.equal(SQ_STATUS_LABEL.READY_TO_OPEN, "ลูกค้าคอนเฟิร์มแล้ว รอ Admin เปิดงาน");
  const q = { status: "READY_TO_OPEN" as const, mode: "NEW" as const, ownerSaleId: "s1", techId: "t1", jobId: "" };
  const admin = queueButtons(q, { id: "a1", has: (p) => p === "svcqueue:admin" });
  assert.ok(admin.includes("openJob"));
  const sale = queueButtons(q, { id: "s1", has: (p) => p === "svcqueue:request" });
  assert.ok(!sale.includes("openJob"));
  const wc = queueButtons({ ...q, status: "WAIT_CUSTOMER" }, { id: "s1", has: (p) => p === "svcqueue:request" });
  assert.ok(wc.includes("confirm"));
});
