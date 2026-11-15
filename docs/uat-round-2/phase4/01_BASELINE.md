# P4-01 Baseline ก่อนเริ่ม Phase 4 (14 พ.ย. 2569)

อ้างอิงคำสั่ง “WOMS — PHASE 4” (OWNER APPROVAL: GRANTED P4-01..P4-12) และคำสั่งต่อเนื่อง “PHASE 4: AUTONOMOUS QA-R2 UAT EXECUTION”
ไม่ได้ commit / push / merge / deploy · ไม่แตะ Production · ไม่ลบ/ปิดใช้งานข้อมูล QA-R2 · ไม่แก้ SN-1000

| รายการ | ค่า |
|---|---|
| woms-frontend | branch main · HEAD a55a0d9 (ไม่เปลี่ยน — ไม่ได้ commit) |
| woms-backend | branch main · HEAD b5c2cec (ไม่เปลี่ยน — ไม่ได้ commit) |
| Backend vitest (ก่อน) | 2,317 PASS / 242 SKIP |
| Frontend node --test (ก่อน) | 333 PASS / 0 FAIL |
| Sandbox E2E (ก่อน) | flow1–15: 158 PASS / 2 FAIL / 1 NOT VERIFIED |
| UAT | localhost:3000 → backend localhost:8000 → Atlas `woms` (ไม่ใช่ Production) |
| ไฟล์ก่อนเขียนทับ | ตรวจ sha256 ไฟล์บนเครื่อง Owner = ไฟล์ต้นฉบับใน sandbox ครบ 16/16 ไฟล์ที่แก้ ก่อน sync |

ข้อสังเกต baseline
- DEF-R5-01 (รายการใบงานไม่มี stage SUBMITTED) เปิดอยู่จาก Phase 3
- Customers ยังต่างจาก design เพราะ API ไม่มีข้อมูลผู้ติดต่อ/รุ่น/ค้างชำระ/งานล่าสุด
- Queue ต่างเล็กน้อย (แถวตัวกรอง)
- การส่งแจ้งเตือนภายนอก NOT VERIFIED
