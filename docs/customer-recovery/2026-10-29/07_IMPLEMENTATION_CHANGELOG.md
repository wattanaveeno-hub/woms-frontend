# 07 · Implementation Changelog

Branch `fix/customer-recovery-2026-10-29` ทั้งสอง repo · แตกจาก `main` (backend `611ee4d`, frontend `af8afe4`) · **ยังไม่ merge, ยังไม่ deploy, ไม่มี migration และไม่แตะข้อมูล production**

## Backend (6 commits · 29 files · +1067 / −158)

| Commit | สรุป |
|---|---|
| `9d1bf58` | WF-01: คอนเฟิร์มไม่เปิด JN · PM-01..03: `POST /api/pm/plans/:id/items/:itemId/propose`, ผูก/คืนรายการ PM · JOB-01 sort · CHAT-05 หมายเหตุต่อท้าย · CHAT-04 ถ้อยคำ · ปรับ test จาก FB-10 → WF-01 · fakeMongo `$in:[null]` |
| `b76453d` | QUE-01/INST-02 ฟิลด์รายเครื่องในคิว · INST-03 ฐาน PM จากการติดตั้ง · CHAT-06 ข้อมูลการ์ด · NAV-01 ถอดสิทธิ์ดูของ Sale · QT-01 `POST /api/quotations/:id/link-job` + PATCH strip · TECH-02 ขั้นไม่ย้อน · CON-01 รุ่นจากคลัง · test DB จริงที่ล้าสมัย |
| `1eeb1d9` | QUE-03 Sale เพิ่มสาขาได้ |
| `789938e` | BUG-V2-12 รอ index ก่อนทรานแซกชันปิดงาน · test AT-16 ตาม QUE-03 |
| `bea098c` | BUG-V2-21 รอ unique index กลุ่มแชทก่อน upsert + retry E11000 |
| `992072c` | แก้ตาม independent QA: F-01..F-05, F-08..F-13, F-15, F-17, ไม่มี JN กำพร้า, jobLinkedAt |

ไฟล์ที่แก้
- `src/domain/serviceQueue.ts` — ป้าย READY_TO_OPEN · ฟิลด์ source/pm* ของคิว · SqItem line fields · sourceLabel
- `src/mongo/serviceQueueRepo.ts` — confirmCustomer (ไม่ release) · proposeFromPmItem · release ผูกรายการ PM (ตรวจก่อนออก JN) · cancel คืนรายการ PM · requestNewDate (บังคับ+ต่อท้ายหมายเหตุ) · buildItems/line fields + validation · ปฏิเสธคิวใหม่ INSTALL
- `src/lib/serviceQueueNotify.ts` — แจ้ง Admin เมื่อคอนเฟิร์ม · ถ้อยคำ CHAT-04 · การ์ดเข้ากลุ่มช่างสำหรับคิว PM · ป้าย PM ในข้อความ
- `src/domain/pmPlan.ts`, `src/mongo/pmPlanRepo.ts`, `src/data/pmPlanRepo.ts`, `src/routes/pm.ts` — queue link ของรายการ · PM_FLOW_LABELS · reserve/commit/release/link/assert · กันตัด/ยกเลิกตารางขณะมีคิว · route propose · `pm:view_all`
- `src/domain/user.ts` — `pm:view_all` · Sale ไม่มี quotations/documents/bill/stock view
- `src/domain/job.ts`, `src/routes/jobs.ts` — sortByOpenedDesc · ซ่อนใบเสนอราคา/บิลในลิงก์ใบงานตามสิทธิ์
- `src/mongo/jobCloseService.ts` — ฐาน PM จากการติดตั้ง (วันเสร็จจริง, เฉพาะแถวที่ระบุ PM, ครั้งเดียว, event แยก)
- `src/mongo/jobsRepo.ts` — stage ไม่ย้อน · acknowledgedById
- `src/routes/groupChat.ts` — ฟิลด์การ์ด CHAT-06
- `src/mongo/groupChatRepo.ts` — รอ unique index + retry
- `src/mongo/equipmentRepo.ts` — warmEquipmentIndexes รอ index build จริง
- `src/routes/quotations.ts`, `src/mongo/quotationRepo.ts` — link-job (1 ใบต่อใบงาน, ลูกค้าตรง) · PATCH `.strip()` · ล้าง jobLinkedAt เมื่อใบงานยกเลิก
- `src/mongo/contractRepo.ts` — รุ่น/SN จาก Machine Record
- `src/routes/partners.ts` — `POST /:id/sites` รับ customers:quick_create
- `src/routes/serviceQueue.ts` — schema ฟิลด์รายเครื่อง
- `src/lib/errorResponse.ts` — JSON เสีย → 400
- tests: ดู 05 หมวด C

## Frontend (2 commits · 18 files · +757 / −188)

| Commit | สรุป |
|---|---|
| `9aff3bd` | UI ของ WF-01, PM-01/02, CHAT-06, NAV-01/02, INST-01, QUE-01..05, EQ-03, CON-01, QT-01, CHAT-05 |
| `ab465af` | แก้ตาม independent QA (F-05, F-06, ป้าย PM ในหน้าคิว, เมนูมือถือเฉพาะช่าง ฯลฯ) |

ไฟล์ที่แก้
- `src/lib/serviceQueueRules.ts`, `src/app/service-queue/[id]/page.tsx`, `src/components/serviceQueue/QueueBits.tsx`, `src/lib/serviceQueueApi.ts` — สถานะ/ปุ่ม/ข้อความ WF-01 · การ์ด CHAT-06 · หมายเหตุขอคิวใหม่บังคับ · ป้าย PM · โหลดฟิลด์รายเครื่องในการแก้ไข
- `src/app/service-queue/page.tsx` — ป้าย PM ในรายการ
- `src/components/serviceQueue/QueueForm.tsx`, `QueueItemExtras.tsx` (ใหม่) — ประเภทหลัก/ย่อยติดตั้ง · ตัดวันเวลาที่ลูกค้าต้องการ · ถอดเครื่องสุดท้าย + empty state · ตรวจก่อนส่ง · ฟิลด์เครื่องกรอง/ประกัน/PM
- `src/components/MachinePicker.tsx` — ไม่มี form ซ้อน
- `src/components/JobForm.tsx` — ประเภทย่อยติดตั้ง · ไม่มีช่องรุ่นรวม · Sale เพิ่มสาขา · Enter ในแผงสาขาไม่ submit
- `src/components/ContractForm.tsx` — รุ่นจาก Machine Record
- `src/app/pm/page.tsx`, `src/lib/api.ts`, `src/lib/types.ts` — ปุ่ม/dialog เสนอวันเวลา · สถานะ PM-02 · ลิงก์คิว · link-job
- `src/app/quotations/[id]/page.tsx` — ปุ่ม "ผูกกับใบงานที่มีอยู่"
- `src/lib/navMenu.ts` (ใหม่), `src/components/Nav.tsx` — เมนูตามบทบาท v2 · หมวดยุบ–ขยาย
- `src/lib/installType.ts` (ใหม่) — กติกาประเภทหลัก/ย่อยติดตั้ง
- `scripts/customerFeedbackV2.test.ts` (ใหม่)

## การเปลี่ยนแปลงข้อมูล (schema)

ทั้งหมดเป็นฟิลด์ **optional แบบ additive** — เอกสารเดิมอ่านได้ตามเดิม ไม่ต้องรัน migration:
`service_queues`: `source`, `pmPlanId`, `pmItemId`, `pmMonth`, `pmDueDate`, `items[].filterUnit/warranty*/pm*` · `pm_schedules.items[]`: `queueId`, `queueNo`, `queueProposed*`, `cancelledQueueIds` · `equipment`: `pmBaselineSource`, `pmBaselineJobId`, `pmBaselineSourceLineId` · `jobs`: `acknowledgedById` · `quotations`: `jobLinkedAt`, `jobLinkedById`, `jobLinkedBy`

## พฤติกรรมที่เปลี่ยนสำหรับผู้ใช้ (ต้องแจ้งก่อน UAT)
1. คอนเฟิร์มลูกค้าแล้ว **ไม่มีใบงานทันที** — Admin ต้องกด "ตรวจและเปิดงาน (ออก JN)" (รวมคิวเลื่อนงาน: "ยืนยันส่งงานเดิมกลับ")
2. ขอคิวใหม่ต้องกรอกหมายเหตุ
3. Sale ไม่เห็นใบเสนอราคา เอกสารการขาย วางบิลช่าง ข้อมูล/สต๊อกอะไหล่
4. งานติดตั้งต้องเลือกเช่า/ขาย · ไม่มีช่องวันเวลาที่ลูกค้าต้องการในหน้าเปิดคิว
5. ปิดงานติดตั้งที่ระบุ PM จะตั้ง "PM ล่าสุด" เป็นวันติดตั้งเสร็จ
