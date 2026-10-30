# 06 · Bug Register

ทุก defect ที่พบในรอบนี้ ไม่ตัดรายการที่ยังไม่แก้ · ผลทดสอบอ้างไฟล์ใน `evidence/` · commit อ้าง branch `fix/customer-recovery-2026-10-29`
Baseline = backend `611ee4d` / frontend `af8afe4` · Final = backend `992072c` / frontend `ab465af`

สถานะ: `PASS — EXECUTED & VERIFIED` = แก้แล้วและรันทดสอบซ้ำผ่าน · `FIXED — AWAITING RETEST` = แก้แล้วแต่พิสูจน์แบบกำหนดซ้ำไม่ได้ · `FAIL — REPRODUCED` = ยังเป็นปัญหาอยู่

## สรุป

| ID | Req | Sev | สรุป | Status |
|---|---|---|---|---|
| BUG-V2-01 | WF-01 | Critical | คอนเฟิร์มลูกค้าแล้วระบบเปิด JN เองในนามเซลล์ | PASS — EXECUTED & VERIFIED |
| BUG-V2-02 | PM-01/02/03 | High | ไม่มีทางส่งคิวจากตาราง PM / ไม่แยกสถานะ PM | PASS — EXECUTED & VERIFIED |
| BUG-V2-03 | QUE-01/INST-02/EQ-04 | High | คิวไม่มีเครื่องกรอง/ประกัน/PM → กรอกซ้ำที่ใบงาน | PASS — EXECUTED & VERIFIED |
| BUG-V2-04 | INST-03 | High | ติดตั้งสำเร็จไม่ตั้งฐาน PM | PASS — EXECUTED & VERIFIED |
| BUG-V2-05 | QUE-05 | High | ค้นหาเครื่อง = บันทึกคิว (form ซ้อน) | PASS — EXECUTED & VERIFIED |
| BUG-V2-06 | QUE-03 | High | Sale เพิ่มสาขาไม่ได้ · Enter ในช่องสาขาบันทึกคิว | PASS — EXECUTED & VERIFIED |
| BUG-V2-07 | QUE-04 | Medium | ถอดเครื่องสุดท้ายไม่ได้ | PASS — EXECUTED & VERIFIED |
| BUG-V2-08 | JOB-01 | Medium | งานทั้งหมดเรียงตามวันนัด | PASS — EXECUTED & VERIFIED |
| BUG-V2-09 | CHAT-05 | Medium | ขอคิวใหม่ไม่บังคับ/ไม่ต่อท้ายหมายเหตุ | PASS — EXECUTED & VERIFIED |
| BUG-V2-10 | CHAT-04 | Low | ข้อความถึงช่างเดิมไม่ตรงถ้อยคำ | PASS — EXECUTED & VERIFIED |
| BUG-V2-11 | CON-01 | Medium | สัญญา: รุ่นไม่มาจาก Machine Record | PASS — EXECUTED & VERIFIED |
| BUG-V2-12 | FB-14/VFB | High | ปิดงานล้ม 502 แบบสุ่ม (LockTimeout) บน replica set จริง | PASS — EXECUTED & VERIFIED |
| BUG-V2-13 | FB-21/QT-01 | High | PATCH ใบเสนอราคาเขียนฟิลด์ระบบได้ (ปลอมการผูกใบงาน) | PASS — EXECUTED & VERIFIED |
| BUG-V2-14 | TECH-02 | Medium | ขั้นงานย้อน IN_PROGRESS → ACKNOWLEDGED | PASS — EXECUTED & VERIFIED |
| BUG-V2-15 | EQ-03 | Medium | ช่องรุ่นระดับใบงานแยกนอกการ์ดเครื่อง | PASS — EXECUTED & VERIFIED |
| BUG-V2-16 | NAV-01/02 | Medium | Sale เรียก API ใบเสนอราคา/เอกสาร/บิล/อะไหล่ได้ · เมนูไม่ตาม v2 | PASS — EXECUTED & VERIFIED |
| BUG-V2-17 | NAV-01/TECH-01 | High | ช่างเรียก API คลังเครื่อง/แผนที่/สต๊อก/บางตัวเลข dashboard ทั้งบริษัท | FAIL — REPRODUCED (source) · BLOCKED นิยาม |
| BUG-V2-18 | WF-02/CHAT-04 | Low | แจ้งเตือนช่างเดิมชี้ลิงก์คิวที่เปิดไม่ได้ (403) | FAIL — REPRODUCED (source) |
| BUG-V2-19 | FB-14 | Medium | `/api/submissions/:id/confirm` อาจปิดงานโดยไม่มีลายเซ็นช่าง | NOT TESTED (สงสัยจากโค้ด, ฟังก์ชันแชทใบงานถูกซ่อน) |
| BUG-V2-20 | CHAT-06 | Low | การ์ดแสดงอำเภอ/จังหวัดซ้ำ | PASS — EXECUTED & VERIFIED |
| BUG-V2-21 | CHAT | Medium | กลุ่มงานช่างซ้ำบน DB ใหม่ · unique index สร้างไม่ได้ | FIXED — AWAITING RETEST |
| BUG-V2-22 | QUE-02 | Low | ยังมีช่องวัน/เวลาที่ลูกค้าต้องการ | PASS — EXECUTED & VERIFIED |
| TEST-01 | — | Test defect | vfbClose IT2 (DB จริง) ไม่ส่ง techSignature จึงล้มทุกคำขอ | PASS — EXECUTED & VERIFIED |
| QA-F01 | PM-02/03 | High | ตัดรายการ PM ที่อยู่ในคิวได้ แล้วเปิดงานทับ SKIPPED | PASS — EXECUTED & VERIFIED |
| QA-F02 | PM-02/03 | Medium | ยกเลิกตาราง PM ระหว่างมีคิว · เปิดงานในตารางที่ยกเลิก (และ JN กำพร้า) | PASS — EXECUTED & VERIFIED |
| QA-F03 | INST-03 | Medium | ฐาน PM ใช้วันนัด (อนาคตได้) | PASS — EXECUTED & VERIFIED |
| QA-F04 | INST-03 | Medium | ติดตั้งขายเครื่องเก่าไม่ระบุ PM แต่ทับ PM ล่าสุด | PASS — EXECUTED & VERIFIED |
| QA-F05 | QUE-01 | Medium | แก้คิวล้างค่า PM ไม่ได้ · dialog แก้ไม่โหลดค่าเดิม | PASS — EXECUTED & VERIFIED (API) · UI code-read |
| QA-F06 | INST-01 | Medium | แก้คิวเลื่อนงานของใบงาน INSTALL เดิมไม่ได้ | FIXED — AWAITING RETEST (FE, ไม่ได้รัน browser) |
| QA-F07 | TECH-02 | Medium | ช่างยังเห็นประวัติรอบนัด/บทสนทนา/Log | FAIL — REPRODUCED |
| QA-F08 | QT-01 | Medium | ผูกหลายใบเสนอราคากับใบงานเดียว/คนละลูกค้า | PASS — EXECUTED & VERIFIED |
| QA-F09 | INST-01 | Low | API รับคิวใหม่ INSTALL ไม่ระบุเช่า/ขาย | PASS — EXECUTED & VERIFIED |
| QA-F10 | — | Low | JSON เสีย/null → 500 (มีก่อนรอบนี้) | PASS — EXECUTED & VERIFIED |
| QA-F11 | CHAT-05 | Low | ขอคิวใหม่ในคิวที่เปิดงานแล้วได้ 400 แทน 409 | PASS — EXECUTED & VERIFIED |
| QA-F12 | CHAT-04 | Low | ช่างที่ไม่รับคิวเองได้ข้อความ "ถูกยกเลิก" · ชื่อ "ช่าง ช่าง" | PASS — EXECUTED & VERIFIED |
| QA-F13 | PM-02 | Low | ช่างไม่รับ → ตารางแสดงผิดเป็นรอช่างเสนอใหม่ | PASS — EXECUTED & VERIFIED |
| QA-F14 | PM-01 | Low | ช่างเจ้าของตารางเปิดลิงก์คิวที่ย้ายให้ช่างอื่นไม่ได้ (403) | FAIL — REPRODUCED · ยอมรับได้ (ไม่ใช่ผู้รับผิดชอบแล้ว) รอยืนยัน |
| QA-F15 | NAV-01 | Low | Sale เห็นเลข/สถานะใบเสนอราคาผ่านลิงก์ใบงาน | PASS — EXECUTED & VERIFIED |
| QA-F16 | QT-01 | Low | ผูกใบงานไม่ผ่านขั้นขออนุมัติของ Admin | BLOCKED — BUSINESS CONFIRMATION (D-17) |
| QA-F17 | CON-01 | Low | สัญญาเก็บ Serial ตามที่พิมพ์ (ตัวเล็ก) | PASS — EXECUTED & VERIFIED |
| QA-F18 | PM-01 | Low | เสนอวัน PM ย้อนหลังได้ (เหมือนการเสนอวันปกติเดิม) | FAIL — REPRODUCED · ไม่แก้ (กติกาเดิม) รอยืนยัน |
| QA-C1..C7 | หลายข้อ | Low | ข้อสงสัยจากอ่านโค้ด FE (ป้าย PM ในหน้าคิว, เมนูมือถือของ Manager, id หมวดเมนู, subtype ว่างในหน้าแก้ใบงาน, jobLinkedAt ไม่ล้าง, ค่าประกันค้าง, race ยกเลิกตาราง) | 6 แก้แล้ว (FIXED — AWAITING RETEST: ไม่ได้ทดสอบ browser แยก) · race ยกเลิกตาราง: เปิดอยู่ (Low) |

## รายละเอียด (ข้อที่สำคัญ)

### BUG-V2-01 · Critical · WF-01 — คอนเฟิร์มลูกค้าแล้วระบบเปิด JN เอง
- Steps: Sale สร้างคิว → Admin จัดช่าง → ช่างเสนอ → Admin รับคิว → Sale `POST /api/service-queue/:id/confirm`
- Expected (v2): ไม่สร้าง JN · รอ Admin ตรวจและกดเปิด JN
- Actual (baseline): `jobs` มี 1 ใบผูก queueId ทันที · คิว `RELEASED` · event `OPEN_JOB` actorRole `sales` · Admin กดเปิดได้ 409
- Root cause (verified): `confirmCustomer` เรียก `releaseInner(id, round, actor, {auto:true})` ตาม FB-10 v1
- Files: BE `src/mongo/serviceQueueRepo.ts`, `src/lib/serviceQueueNotify.ts`, `src/domain/serviceQueue.ts` · FE `src/lib/serviceQueueRules.ts`, `src/app/service-queue/[id]/page.tsx`, `src/components/serviceQueue/QueueBits.tsx`
- Fix: confirm → `READY_TO_OPEN` เท่านั้น · แจ้ง Admin · ป้าย/ปุ่ม FE ใหม่ · คงด่านกัน JN ซ้ำเดิม (unique index + op lock)
- Regression risk: ผู้ใช้ที่คุ้นกับการเปิดงานอัตโนมัติ · คิวเลื่อนงานเปลี่ยนเป็น Admin ยืนยันส่งงานกลับด้วย (ยืนยันโดย independent QA)
- Evidence: `evidence/baseline/api-qa-baseline-full.log` (FAIL) → `evidence/final-v2/api-qa.log` (PASS) · `evidence/final-v2/e2e/wf01-*.png`
- Tests: QA-WF01-01/02/03, E2E-WF01-01, `serviceQueue.test.ts` AT 08 (เขียนใหม่ตาม v2)

### BUG-V2-12 · High — ปิดงานล้มแบบสุ่มบน MongoDB replica set จริง
- Steps: `MONGO_TEST_URI=… vitest run test/vfbClose.mongo.int.test.ts` (ร่วมกับชุดอื่น) · ปิดงานพร้อมกัน 5 คำขอ
- Expected: 200 หนึ่งคำขอ 409 สี่คำขอ
- Actual: คำขอที่ได้ล็อก ได้ 502 `Unable to acquire IX lock on '…equipment' within 5ms` → ใบงานไม่ปิด
- Root cause (verified): `warmEquipmentIndexes()` ถูกเรียกก่อนทรานแซกชันเพื่อเตรียม index แต่ `createIndex` เป็น fire-and-forget ทรานแซกชันจึงชนกับ index build
- Fix: เก็บ promise ของ index build และ `await` ใน `warmEquipmentIndexes` (`src/mongo/equipmentRepo.ts`)
- Evidence: `evidence/final/be-mongo-int.log` (ก่อนแก้: 502) · รันซ้ำ 5 รอบ 18/18 · `evidence/final-v2/be-mongo-int.log`
- Risk ใน production: ต่ำ (index มีอยู่แล้ว) ยกเว้นหลัง deploy ใหม่/ฐานข้อมูลใหม่

### BUG-V2-13 · High · security — PATCH ใบเสนอราคาเขียนฟิลด์ระบบได้
- Steps: Manager `PATCH /api/quotations/:id {updatedAt, note, cancelledJobIds:["JN-FAKE"], jobId:"JN-FAKE2"}`
- Actual (baseline): `cancelledJobIds:["JN-FAKE"]` ถูกบันทึก → `jobLinks` ถือว่าเป็นใบเสนอราคาของ JN-FAKE
- Root cause: zod `.passthrough()` · Fix: `.strip()` (`src/routes/quotations.ts`)
- Evidence: baseline QA-QT01-01 `{"c":["JN-FAKE"]}` → final PASS

### BUG-V2-17 · High · ยังเปิดอยู่ — ข้อมูล "ของตนเอง" ของช่าง
- Source: `GET /api/equipment` (หน้าแผนที่) ไม่กรองตามช่าง · `/api/stock/*` ให้ช่างอ่านทุกคลัง/ยอด/ธุรกรรม · dashboard นับอุปกรณ์/ประกัน/PM/สต๊อกทั้งบริษัท (`discovery-nav-auth.md` §ข้อ 4–7)
- ไม่แก้ในรอบนี้: AUTH-01 ให้ลูกค้านิยาม "ของตนเอง" (ของที่เบิก/ถือครอง/ใช้ในงาน) ก่อน — การเดากติกาอาจซ่อนข้อมูลที่ช่างต้องใช้หน้างาน
- Status: FAIL (ยืนยันจากโค้ด, ไม่ได้รัน) + BLOCKED — BUSINESS CONFIRMATION (D-03)

### BUG-V2-21 · Medium — กลุ่มงานช่างซ้ำ
- พบใน DB `woms_qa_final_e2e`: `TECH-<id>` 2 เอกสารต่อช่าง (createdAt ต่างกัน 2 ms) และไม่มี index `uniq_group_key`
- Root cause (verified by code + DB state): unique index สร้างแบบ fire-and-forget · `GET /groups` เรียก `ensureTechGroup` ของทุกช่างพร้อมกัน → upsert ชนกันก่อน index พร้อม → index สร้างไม่ได้ตลอดไป
- Fix: รอ index ก่อน upsert + ทำซ้ำเมื่อได้ E11000 (`src/mongo/groupChatRepo.ts`)
- Reproduce แบบกำหนดซ้ำไม่ได้ (0/12 รอบทั้ง baseline และ fix ด้วย `qa/race-groups.ts`) · หลังแก้ E2E 3 รอบ: กลุ่มไม่ซ้ำ index ครบ → จัดเป็น FIXED — AWAITING RETEST
- ข้อควรทำก่อน deploy: ตรวจ `chat_groups` ใน production ว่ามี groupKey ซ้ำ/ไม่มี unique index หรือไม่ (ดู 09)

### QA-F01..F18
รายละเอียด repro/หลักฐานของ independent QA: `evidence/INDEPENDENT_QA_REVIEW.md` · การแก้: backend commit `992072c`, frontend `ab465af` · regression: QA-REV-PM, QA-REV-INST, QA-REV-QUEUE, QA-REV-QT (`evidence/final-v2/api-qa.log`) และ `customerFeedbackV2.test.ts` (ตาราง PM ยกเลิก → ไม่มี JN กำพร้า — test นี้จับ defect เพิ่มที่ release สร้าง JN ก่อนตรวจรายการ PM และได้แก้แล้วใน commit เดียวกัน)
