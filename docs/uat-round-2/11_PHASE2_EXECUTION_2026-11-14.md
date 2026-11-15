# 11 — UAT Round 2 Phase 2 Execution (14 พ.ย. 2569)

อ้างอิงคำสั่ง: “UAT ROUND 2: PHASE 2 EXECUTION — OWNER APPROVAL GRANTED”
ไม่ได้ commit / push / merge / deploy · ไม่แตะ Production · ไม่ลบ/ยกเลิกข้อมูล QA-R2

## 1. Design implementation (ลำดับตามที่อนุมัติ)

| ลำดับ | หน้า | ผล | Regression หลังแก้ |
|---|---|---|---|
| 1 | ServiceQueueNew | DESIGN PASS (ข้อยกเว้น: ไม่มี “ลูกค้าสะดวกเมื่อไร” ตาม QUE-02 v2) | flow6 21/21 PASS (`r4/p1-sqnew-flow6.log`) |
| 2 | JobNew 4 ขั้น | DESIGN PASS (ข้อยกเว้น 3 ข้อ) | flow11 9/9 PASS — เปิดงานจริง + ร่าง + ค่าที่บันทึก (`r4/p2-jobnew-flow11.log`) |
| 3 | JobDetail | DESIGN FAIL (เหลือ checklist หลักฐานปิดงานในแท็บภาพรวม) | flow4 PASS ทุกข้อ ยกเว้น DEF-R3-02 เดิม (`r4/p3-jobdetail-flow4.log`) |
| 4 | ServiceQueueDetail | DESIGN PASS (ข้อยกเว้น 2 ข้อ) — ทดสอบด้วยคิวที่สร้างใหม่ สถานะรอลูกค้าคอนเฟิร์ม | flow6 21/21 PASS (`r4/p4-sqdetail-flow6.log`) |
| 5 | Dashboard → Reports | DESIGN PASS · ย้ายส่วนสรุปไป `/reports` ครบ (ข้อมูล/สิทธิ์/Export/ลิงก์) | flow12 12/12 PASS admin + manager (`r4/p5-dashboard-reports-flow12.log`) |

รายละเอียด: `docs/design-implementation/11_PHASE2_DESIGN_2026-11-14.md`

ไฟล์ที่แก้ (frontend เท่านั้น · backend ไม่เปลี่ยน):
`src/components/serviceQueue/QueueForm.tsx`, `src/app/service-queue/new/page.tsx`, `src/components/JobForm.tsx`, `src/components/JobEquipmentSection.tsx`, `src/app/jobs/new/page.tsx`, `src/app/jobs/[id]/page.tsx`, `src/components/JobDetailCards.tsx`, `src/lib/serviceQueueRules.ts`, `src/app/service-queue/[id]/page.tsx`, `src/app/dashboard/page.tsx`, `src/components/DashboardActionBoard.tsx`, `src/lib/navMenu.ts`
ไฟล์ใหม่: `src/components/DashboardOverview.tsx`, `src/app/reports/page.tsx`, `scripts/queueSteps.test.ts`
ซิงก์ลงเครื่อง Owner แล้ว ตรวจ sha256 ตรงทั้ง 15 ไฟล์ · ก่อนเขียนทับตรวจแล้วว่าไฟล์บนเครื่องตรงกับต้นฉบับใน sandbox (6 ไฟล์ตรง hash, 6 ไฟล์ diff เฉพาะส่วนที่แก้ · `JobEquipmentSection.tsx` คง CRLF ตามไฟล์บนเครื่อง)

## 2. Remaining UAT scenarios (UAT จริง)

| ID | ผล | เหตุผล |
|---|---|---|
| UAT-REMAIN-01 ปิดงานครบวงจร | **BLOCKED** | ดูด้านล่าง |
| UAT-REMAIN-02 นำเข้ารุ่นเครื่อง (ข้อมูล QA-R2) | **BLOCKED** | ดูด้านล่าง |
| UAT-REMAIN-03 เครื่องของลูกค้า (fixture ผ่าน API) | **BLOCKED** | ดูด้านล่าง |
| UAT-REMAIN-04 แจ้งเตือนนอกแชท | **BLOCKED** | ดูด้านล่าง |

สาเหตุร่วม (BLK-R4-01): ทั้ง 4 ข้อต้องใช้บัญชีทดสอบ QA-R2 (admin/manager/sales/tech) เข้าระบบบน UAT ผ่านเบราว์เซอร์ของ Owner (localhost:3000 → backend localhost:8000 → Atlas `woms`)
- เครื่องมือของ session นี้ปฏิเสธการนำรหัสผ่าน QA-R2 จากไฟล์ local (`qa-r2-accounts.local.json`) เข้ามาใช้ ทั้งการอ่านไฟล์และการอัปโหลดไฟล์เข้าหน้าเว็บ
- บัญชีที่ login อยู่ในเบราว์เซอร์คือบัญชี developer ของ Owner — ไม่ใช้แทนบัญชีทดสอบ เพราะทดสอบบทบาท/สิทธิ์ไม่ได้และจะทำรายการในชื่อ Owner
- ไม่ได้ข้ามระบบสิทธิ์ ไม่ได้ reset รหัสผ่าน และไม่ได้สร้างข้อมูลใด ๆ บน UAT ในรอบนี้

ทางปลดล็อก (เลือกอย่างใดอย่างหนึ่ง):
1. Owner อนุญาตให้ session ใช้ไฟล์ `qa-r2-accounts.local.json` (แนบไฟล์ในแชท หรืออนุญาตสิทธิ์อ่าน) แล้วสั่งรันต่อ
2. Owner login บัญชี `qa-r2-admin@qa-r2.local` ในหน้าต่าง/profile แยกของ Chrome แล้วแจ้ง — Claude จะทำ UAT-REMAIN-02 และส่วน admin ของข้อ 01/03/04 (บทบาทอื่นต้อง login ทีละบัญชีเช่นเดียวกัน)

แผนทดสอบที่เตรียมไว้ (รันได้ทันทีเมื่อปลดล็อก — ทุกข้อใช้ข้อมูลที่ขึ้นต้น QA-R2 เท่านั้น):
- 01: เซลล์ QA-R2 เปิดคิวงานซ่อมให้ลูกค้า QA-R2 (เครื่องลูกค้าจากข้อ 03) → Admin จัดช่าง QA-R2 → ช่างเสนอวัน → Admin รับ → เซลล์คอนเฟิร์ม → Admin เปิด JN → ช่างรับทราบ → เริ่มงาน → แนบรูป SN/รูปงาน → บันทึกเครื่องเสร็จ → ลายเซ็นลูกค้า + ลายเซ็นช่าง → ปิดงาน → ตรวจ `GET /api/jobs/:id`, `close-check`, signoff, notification, audit
- 02: ดาวน์โหลด template (`GET /api/equipment-models/import/template.xlsx`) → นำเข้าแถวถูก (รุ่น `QA-R2-MODEL-*`) / แถวผิด / แถวซ้ำ → ตรวจรายงานข้อผิดพลาดรายแถวและว่ารุ่นอื่นไม่เปลี่ยน (นับก่อน/หลัง)
- 03: สร้างเครื่องลูกค้าภายนอก 1 เครื่องให้ลูกค้า QA-R2 สาขา 00 ผ่าน `POST /api/external-equipment` → ตรวจ ownership/สาขา, ใช้ในคิวงานซ่อมได้, ใช้ในคิวติดตั้งไม่ได้ (409 EQUIPMENT_NOT_AVAILABLE), ใช้เครื่องของลูกค้าอื่นไม่ได้ (409 EQUIPMENT_OTHER_CUSTOMER — ไม่มีการเขียนข้อมูล), ช่างสร้างไม่ได้ (403)
- 04: ตรวจ `GET /api/notifications` ของผู้รับแต่ละบทบาทหลังแต่ละ event ในข้อ 01 · unread-count · read/read-all · ลิงก์ไปหน้าคิว/งาน · การส่งภายนอก (Web Push/LINE) = NOT VERIFIED หากไม่มีหลักฐานฝั่งผู้รับ

## 3. Inventory ข้อมูลทดสอบบน UAT

รอบ Phase 2: **ไม่มีข้อมูลใหม่บน UAT** (ไม่ได้รันข้อ 2)
ข้อมูล QA-R2 เดิมจาก Master Execution ยังอยู่ครบ ไม่ได้ลบ/ยกเลิก:
- ผู้ใช้ 4 บัญชี `qa-r2-{admin,manager,sales,tech}@qa-r2.local`
- ทีม “QA-R2 ทีมทดสอบ” + กลุ่มแชท TEAM-6af7e6651e68681ceed2fcc7 (ข้อความ 2 ข้อความ)
- ลูกค้า “QA-R2 ร้านทดสอบ” รหัส 99260101 + สาขา 00
- คิว Q-2026-0088 (ติดตั้ง, รอจัดช่าง, รูป 1 รูป + soft-deleted 2 รูป), Q-2026-0089 (เลื่อนงาน, รอจัดช่าง)
- ใบงาน JN-2026-0132 (HOLD)

ข้อเสนอ cleanup (ยังไม่ทำ — รออนุมัติ): ยกเลิกคิว Q-2026-0088/0089 ด้วยเหตุผล “QA-R2 cleanup” → ยกเลิกใบงาน JN-2026-0132 → ปิดใช้งานบัญชี QA-R2 4 บัญชี → ปิดใช้งานลูกค้า 99260101 (ไม่ hard delete เพื่อคง audit trail)

## 4. Regression (สิ้นสุด Phase 2)

| ชุด | Baseline | Phase 2 | ผล |
|---|---|---|---|
| Backend vitest | 2,317 PASS / 242 SKIP | 2,317 PASS / 242 SKIP (178 files) | PASS — backend ไม่เปลี่ยน |
| Frontend node --test | 326 PASS (328 หลังแก้ช่องเงิน) | 330 PASS / 0 FAIL (+2 queueSteps) — sandbox และบนเครื่อง Owner | PASS |
| Frontend tsc | ผ่าน | ผ่าน (sandbox + บนเครื่อง Owner) | PASS |
| Next build | ผ่าน | ผ่าน (มี route `/reports`) | PASS |
| Sandbox E2E flow1–12 | — | 117 PASS / 2 FAIL | PASS (2 FAIL อธิบายได้ ด้านล่าง) |
| UAT 23 รายการเดิม | 23 PASS | ไม่ได้รันซ้ำ (BLK-R4-01) | NOT TESTED |

FAIL ใน sandbox ที่ไม่ใช่ regression:
- flow4 “admin job no errors” — `GET /api/jobs/:id/photos/summary` ตอบ 500 เพราะ fakeMongo ของ sandbox ไม่มี `aggregate` (DEF-R3-02 เดิม · บน UAT จริงตอบ 200)
- flow5 “dup phone warning” — ต้องรันหลัง flow2 ในฐานข้อมูลชุดเดียวกัน (flow2 ตั้งเบอร์ 02-398-1199) · รันต่อกันแล้ว PASS (`r4/final-flow2-then-flow5.log`)

## 5. Quality Gates

- Gate A — Functional UAT: **FAIL** — UAT-REMAIN-01..04 BLOCKED (BLK-R4-01) · UAT2-17 รอลูกค้ายืนยัน
- Gate B — Design Verification: **FAIL** — JobDetail ยังต่าง 1 จุดหลัก · 44 หน้าไม่มีไฟล์ design · หน้าอื่นใน 13 หน้าที่ยังต่าง (Jobs, Customers, CustomerDetail, Contracts, ContractDetail) อยู่นอกลำดับงานรอบนี้

## Overall: **NOT READY**
