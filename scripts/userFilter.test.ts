import { test } from "node:test";
import assert from "node:assert/strict";
import { filterUsers } from "../src/lib/userFilter.ts";

const U = (id: string, role: string, active = true, extra: Record<string, string> = {}) => ({ id, name: `ผู้ใช้ ${id}`, email: `${id}@x.test`, role, active, ...extra }) as any;
const items = [U("a", "admin"), U("m", "manager"), U("t1", "tech", true, { phone: "099-026-0101" }), U("t2", "tech", false), U("s", "sales"), U("v", "viewer")];

test("กลุ่มบทบาท: ช่าง/เซลล์/แอดมิน-ผู้จัดการ นับเฉพาะที่ใช้งาน · ปิดใช้งานแยกกลุ่ม · ทั้งหมดรวมทุกบัญชี", () => {
  assert.deepEqual(filterUsers(items, "", "TECH").map((u) => u.id), ["t1"]);
  assert.deepEqual(filterUsers(items, "", "SALES").map((u) => u.id), ["s"]);
  assert.deepEqual(filterUsers(items, "", "ADMIN").map((u) => u.id), ["a", "m"]);
  assert.deepEqual(filterUsers(items, "", "INACTIVE").map((u) => u.id), ["t2"]);
  assert.equal(filterUsers(items, "", "ALL").length, 6);
});

test("ค้นหา: ชื่อ/อีเมล (ไม่สนตัวพิมพ์) · เบอร์โทรตัวเลขอย่างน้อย 3 หลัก", () => {
  assert.deepEqual(filterUsers(items, "S@X", "ALL").map((u) => u.id), ["s"]);
  assert.deepEqual(filterUsers(items, "0990260101", "ALL").map((u) => u.id), ["t1"]);
  assert.deepEqual(filterUsers(items, "ผู้ใช้ m", "ADMIN").map((u) => u.id), ["m"]);
  assert.deepEqual(filterUsers(items, "zz", "ALL"), []);
});
