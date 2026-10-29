# 01 · As-Is System Architecture and Workflow Report

รอบ: Customer Recovery 29 ต.ค. 2569 · เขียนจากการอ่านโค้ดจริงและการรันระบบใน QA environment แยก (ไม่ได้อ้าง README หรือรายงานรอบก่อน)

## 1. Snapshot ที่ตรวจ

| Repo | Baseline (ก่อนแก้) | หลังแก้ (branch `fix/customer-recovery-2026-10-29`) |
|---|---|---|
| woms-backend | `611ee4dc478a3f7f145130d7266b30fe88bcbc07` (main, "fix: feedback r4") | `992072c350d9ac5fb9f88d6cf631e51b46eec503` |
| woms-frontend | `af8afe4b7b2c1cb325b9eaeec209041f239725bb` (main, "fix: feedback r4") | `ab465af111499aa0b928ad35e7322c946f1b87b9` |

ขนาดโค้ด: backend ~60k บรรทัด TS (src + test 93 ไฟล์ test) · frontend ~41k บรรทัด TS/TSX

## 2. สถาปัตยกรรม

```
Browser (Next.js 14 App Router + MUI 6, client components)
   │  fetch + Bearer JWT (localStorage "woms_token")   NEXT_PUBLIC_API_BASE
   ▼
woms-backend (Express 4, TypeScript, zod validation, helmet, rate-limit login 10/นาที)
   │  middleware/auth.ts: authenticate (JWT) → requirePermission / requireAnyPermission (RBAC จาก domain/user.ts)
   │  routes/* → mongo/*Repo.ts (data access) · domain/* (pure rules) · lib/* (notify, push, audit, pdf)
   ▼
MongoDB (DATA_SOURCE=mongo; รองรับ Google Sheets แบบเดิมสำหรับ jobs เท่านั้น)
   transaction: db/mongo.ts runAtomic → session.withTransaction เมื่อเป็น replica set, ไม่งั้นใช้ compensating write
   lock: mongo/opLock.ts (withOpLocks) กันกดซ้ำ/สองหน้าจอ
```

Scheduler ภายใน (`lib/scheduler.ts`) แจ้งเตือนทุก 15 นาที · Web Push (`lib/push.ts`) · Audit log (`audit_logs`)

## 3. Collection หลักและความสัมพันธ์

| Collection | คีย์/ความสัมพันธ์ |
|---|---|
| `jobs` | `jobId` (JN-YYYY-NNNN, unique) · `queueId` (unique partial: 1 JN ต่อคิว) · `customerId`/`siteId` · `technicianIds[]` · `status` OPEN/HOLD/CLOSED/CANCELLED · `stage` |
| `job_equipment` (Job Machine) | `jobId` + `equipmentId` · ข้อมูลรายเครื่อง (filterUnit, warranty*, pmMode/pmRounds/pmEveryMonths/pmYears, contractId) · `result` DONE · หลักฐานรูป |
| `equipment` (Machine Record) | `serial` unique + `serialKey` (ตัวพิมพ์ใหญ่) · `hasRealSerial` (Pending Serial) · `status` IN_STOCK/RENTED/SOLD/… · `lastPmDate` + `pmIntervalMonths` (คำนวณรอบด้วย domain/pm.ts) |
| `equipment_events` | ประวัติเครื่อง append-only อ้าง JN (`refType: JOB`) |
| `service_queues` + `service_queue_events` | คิวช่าง Q-YYYY-NNNN · `rounds[]` รอบนัด · `items[]` (itemId คงที่, equipmentId, jobEquipmentId) · `jobId` เมื่อเปิดงาน · event log append-only |
| `pm_schedules` | ตาราง PM 1 เดือน × 1 ช่าง (unique) · `items[]` ต่อเครื่อง `status` PLANNED/JOB_CREATED/DONE/SKIPPED · `jobId` (จองด้วย RESERVED:) |
| `chat_groups` / `group_messages` | กลุ่มเช็คคิว (CHECK_QUEUE) + กลุ่มงานช่างละ 1 กลุ่ม (`TECH-<userId>`) · ข้อความ CARD/SYSTEM อ้าง `ref.queueId` |
| `contracts` | สัญญา + `serial`/`model` · ผูกเครื่องภายหลังได้ |
| `quotations` | ใบเสนอราคา · `jobId` เมื่อเปิดงาน/ผูกงาน |
| `technician_bills`, `signoffs`, `notifications`, `partners`, `customer_sites`, `users`, … | วางบิล · ลายเซ็น · แจ้งเตือน · ลูกค้า/สาขา · ผู้ใช้ |

## 4. บทบาทและสิทธิ์ (As-Is ก่อนแก้)

`domain/user.ts` — สิทธิ์ผูกกับ **บทบาท** เท่านั้น (ไม่มีสิทธิ์รายผู้ใช้): `ceo` (ดูทั้งหมด + อนุมัติบางอย่าง), `manager` (ทุกสิทธิ์), `admin` (ทุกสิทธิ์ยกเว้นจัดการผู้ใช้/อนุมัติ), `tech` (งานของตน), `sales` (ดูทุกอย่าง + เปิดคิว/คอนเฟิร์มคิวของตน), `viewer` (ดูอย่างเดียว)
ไม่มีบทบาท "Admin Service" ในระบบ · การกรอง "ของตนเอง" ของช่างทำที่ API สำหรับ jobs, calendar, service-queue, group-chat, pm, bills, job parts แต่ **ไม่ทำ** สำหรับ equipment/map, stock, dashboard บางตัวเลข (รายละเอียด: `evidence/discovery-nav-auth.md`)

## 5. Workflow ที่ trace แล้ว (UI → API → persistence → state)

### 5.1 คิว → JN (ก่อนแก้)
1. เซลล์ `/service-queue/new` → `POST /api/service-queue` → `service_queues` status `WAIT_ASSIGN` + การ์ดในกลุ่มเช็คคิว
2. Admin จัดช่าง `POST /:id/assign` → `WAIT_TECH` + การ์ดกลุ่มช่าง
3. ช่างเสนอ `POST /:id/propose` → `TECH_REPLIED`
4. Admin รับคิว `POST /:id/accept` → `WAIT_CUSTOMER`
5. **เซลล์/Admin คอนเฟิร์ม `POST /:id/confirm` → ระบบเรียก `releaseInner(auto)` ทันที → `createJobWithEquipment` → `jobs` + `job_equipment` → `RELEASED` (event `OPEN_JOB` บันทึกผู้ทำเป็นเซลล์)** ← ขัดกับ WF-01 v2
6. `READY_TO_OPEN` ใช้เป็นสถานะกู้คืนเมื่อเปิดอัตโนมัติไม่สำเร็จเท่านั้น

### 5.2 ตาราง PM (ก่อนแก้)
Admin สร้างตาราง (`POST /api/pm/plans`) → อนุมัติ/ส่ง (`/status`) → Admin กด "สร้างใบงาน" (`/items/:itemId/job`) ได้ JN ทันที → ปิดงาน PM → `markPmItemDone` + `lastPmDate` เดินหน้า
**ไม่มีเส้นทางให้ช่างเสนอวันจากตาราง PM และไม่เชื่อมกับระบบคิว** (PM-01)

### 5.3 ปิดงาน
`POST /api/jobs/:id/close` ต้องมีลายเซ็นลูกค้า + ลายเซ็นช่าง (FB-14) + ทุกเครื่องมีหลักฐานและบันทึก DONE → `runAtomic`: ปิดใบงาน, PM/Package ของเครื่อง, สถานะคลัง (`inventoryEffectOfClose`: ติดตั้งเช่า → RENTED/RENTAL ฯลฯ), ประวัติเครื่อง
งานติดตั้ง **ไม่ตั้ง** `lastPmDate` (INST-03)

### 5.4 จุดเชื่อมระหว่าง repo
Frontend เรียก API ผ่าน `src/lib/api.ts` และ `src/lib/serviceQueueApi.ts` · type ใน `src/lib/types.ts` คัดลอกโครงจาก backend ด้วยมือ (ไม่มี shared package) · กติกาปุ่มคิว `src/lib/serviceQueueRules.ts` ต้องตรงกับ `backend/domain/serviceQueue.ts`

## 6. การทดสอบและ automation ที่มีอยู่ (ก่อนแก้)

| Repo | คำสั่ง | สภาพจริง (รัน 29 ต.ค. 23:13) |
|---|---|---|
| backend | `npm run typecheck` / `build` / `test` (vitest + fakeMongo ในหน่วยความจำ) | ผ่าน · 1177 passed, 18 skipped |
| backend | `*.mongo.int.test.ts` (ต้องตั้ง `MONGO_RS_URI`/`MONGO_TEST_URI`) | **ปกติถูก skip** · เมื่อรันกับ replica set จริง: 1 ล้ม (vfbClose IT2) |
| frontend | `npm run typecheck` / `test` / `test:tz` (node --test, ฟังก์ชันบริสุทธิ์) / `build` | ผ่าน · 83 tests |
| frontend | `npm run lint` | **ใช้ไม่ได้** — `next lint` ยังไม่ได้ตั้งค่า ESLint (ถามแบบ interactive) |
| ทั้งคู่ | Browser E2E / API integration กับ DB จริง | **ไม่มี** ในโปรเจกต์ |

ข้อจำกัดสำคัญ: unit test ฝั่ง backend ใช้ fakeMongo — ไม่จับปัญหา lock/transaction/index ของ MongoDB จริง (พบ 2 defect ในรอบนี้ที่ fakeMongo ไม่เห็น: BUG-V2-12, BUG-V2-21)

## 7. Environment ที่ใช้ตรวจ (isolated QA)

- MongoDB 8.0.23 replica set `rs0` ที่ 127.0.0.1 (ติดตั้งจาก conda-forge ใน container; Docker Hub/mongodb.org ถูก proxy ปฏิเสธ)
- Backend รันจาก source ด้วย `tsx` ที่ port 8100 (fix), 8101 (baseline main ผ่าน git worktree), 8102 (independent QA)
- Frontend `next build` (standalone) ที่ port 3100 ชี้ API 8100
- DB แยกต่อการรัน (`woms_qa_*`) drop และ seed ใหม่ทุกครั้ง · **ไม่มีการเชื่อมต่อ production หรือข้อมูลจริง**
- Chromium ผ่าน Playwright 1.63 (desktop 1280px และ Pixel 7 สำหรับช่าง)

## 8. เอกสารประกอบ

- `evidence/discovery-nav-auth.md`, `evidence/discovery-queue-equipment.md`, `evidence/discovery-chat-tech-qt.md` — ผลอ่านโค้ดรายข้อพร้อม file:line (snapshot baseline)
- `evidence/requirements.md` — requirement ที่ถอดจาก PDF ลูกค้าทั้ง 2 ฉบับ
