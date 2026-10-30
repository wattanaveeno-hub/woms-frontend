# 05 · QA Test Cases

ชุดทดสอบที่ใช้จริงในรอบนี้ · script อยู่ใน `qa/customer-recovery/` (backend repo) · ทุกชุดรันกับ QA environment แยก (local MongoDB replica set, DB `woms_qa_*` ที่ drop/seed ใหม่ทุกรอบ — script ปฏิเสธ URL ที่ไม่ใช่ localhost และ DB ที่ไม่ขึ้นต้นด้วย `woms_qa`)

บัญชีทดสอบ (seed QA เท่านั้น รหัสผ่าน `QaPass123!`): `admin2@qa.local` (admin) · `sales@qa.local`, `sales2@qa.local` (sales) · `tech@qa.local`, `tech2@qa.local` (tech) · `manager@qa.local` · `ceo2@qa.local`

## A. API + Database integration (`qa/customer-recovery/api-qa.mjs`)

ทุก scenario ยิง HTTP จริงไปที่ backend แล้วตรวจผลใน MongoDB โดยตรง

| Test ID | Requirement | สิ่งที่ตรวจ (ย่อ) |
|---|---|---|
| QA-WF01-01 | WF-01, WF-02, FB-10 | Sale คอนเฟิร์ม → ไม่มี JN (DB) · คิว READY_TO_OPEN · Sale เปิด JN 403 · Admin เปิด 200 · ยิงเปิดซ้ำ 3 ครั้งพร้อมกันไม่มี 2xx · DB มี JN เดียว · queue.jobId = job.jobId · 2 Job Machine ผูก item · event OPEN_JOB ผู้ทำ = Admin |
| QA-WF01-02 | WF-01 | Admin คอนเฟิร์มเอง/กดซ้ำ ไม่มี JN |
| QA-WF01-03 | FB-08 | เซลล์ที่ไม่ใช่เจ้าของงาน คอนเฟิร์ม/ขอคิวใหม่ = 403 |
| QA-CHAT05-01 | CHAT-05, WF-01 ข้อ 5 | ขอคิวใหม่ 2 รอบ → note เดิม + หมายเหตุใหม่ต่อท้ายตามลำดับ · ไม่มีหมายเหตุ = 400/409 |
| QA-AUTH-01 | NAV-01, TECH-01 | ช่าง B เปิดคิว/ใบงานของช่าง A = 403/404 · list ไม่รวม · Sale จัดช่าง = 403 |
| QA-JOB01-01 | JOB-01 | `GET /api/jobs` เรียง createdAt desc |
| QA-PM01-01 | PM-01..03 | ช่างเสนอจากตาราง PM → คิว TECH_REPLIED ผูก plan/item/เครื่อง · กดซ้ำไม่มีคิวที่สอง · ช่างอื่น 403 · Admin รับ/คอนเฟิร์ม/เปิด → JN ชนิด PM · รายการ JOB_CREATED · lastPmDate ไม่เปลี่ยน · ปุ่มเดิม "สร้างใบงานจาก PM" = 409 |
| QA-PM02-01 | PM-02 | ยกเลิกคิว PM → รายการกลับ PLANNED ไม่มีคิว · lastPmDate ไม่เปลี่ยน · เสนอใหม่ได้ |
| QA-INST-01 | QUE-01, INST-02/03, EQ-04 | คิวเก็บเงื่อนไข PM/เครื่องกรอง · คิวที่ PM เช่าไม่ครบ = 400 · Job Machine ได้ค่าจากคิว · ไม่สร้างเครื่องซ้ำ · เปิดงานไม่ตั้งฐาน PM · ช่างอื่นปิดไม่ได้ 403 · ปิดงาน → lastPmDate = วันที่ติดตั้งเสร็จจริง · interval 3 · baseline INSTALL · RENTED/RENTAL · nextPmDate = +3 เดือน · ไม่มี event PM |
| QA-PM03-02 | PM-01 ข้อ 7 | ปิดใบงาน PM จากคิว PM → รายการ DONE หลังปิดเท่านั้น · lastPmDate = วันใบงาน · ป้าย "เข้า PM แล้ว" |
| QA-QT01-01 | QT-01, FB-21 | Sale ผูกไม่ได้ · Admin ผูกได้ ไม่มี JN ใหม่ · ลิงก์ใบงานเห็นใบเสนอราคา · ผูกใบงานอื่นซ้ำ 409 · JN ไม่มีอยู่ 400 · Manager PATCH ใส่ `cancelledJobIds/jobId` ไม่ถูกบันทึก |
| QA-NAV01-API | NAV-01 | Sale GET quotations/documents/bills/stock/parts = 403 · Admin 200 · Sale เห็นตาราง PM ครบ · ช่าง quotations 403 · CEO คงเดิม 200 |
| QA-TECH02-01 | TECH-02 | รับทราบเก็บเวลา+user id · IN_PROGRESS ไม่ย้อน · ช่างอื่น 403 |
| QA-CON01-01 | CON-01 | สร้างสัญญาด้วย SN ตัวเล็ก + รุ่นผิด → DB เก็บรุ่นจากคลัง · เปิดใหม่ถูกต้อง |
| QA-REV-PM | QA F-01/02/13, CHAT-04 | รายการในคิว: skip 409, ยกเลิกตาราง 409 · ช่างไม่รับ → "รอ Admin จัดช่าง" · ช่างที่ไม่รับเองไม่ได้ข้อความ "ถูกยกเลิก" |
| QA-REV-INST | QA F-03/04 | นัด 2027-01-20 ปิดวันนี้ → lastPmDate = วันนี้ · ขายเครื่องเก่าไม่ระบุ PM → PM ล่าสุดเดิมคงอยู่ |
| QA-REV-QUEUE | QA F-05/09/10/11 | แก้คิวลบ PM → ค่ารอบ/ความถี่ถูกล้าง · คิวใหม่ INSTALL 400 · JSON เสีย/null 400 · ขอคิวใหม่หลังเปิดงาน 409 |
| QA-REV-QT | QA F-08/15 | ใบเสนอราคาที่สองผูกใบงานเดิม 409 · คนละลูกค้า 409 · Sale ไม่เห็นใบเสนอราคาในลิงก์ใบงาน · Admin เห็น |

## B. Browser E2E (`qa/customer-recovery/e2e.mjs`, Playwright + Chromium)

Frontend production build → API → MongoDB เดียวกัน · ตรวจหน้าจอ + DB · screenshot ทุก scenario

| Test ID | Requirement | Viewport | สิ่งที่ตรวจ |
|---|---|---|---|
| E2E-NAV-01 | NAV-01/02 | Desktop 1280 | **ล็อกอินผ่านหน้าจอจริง** Admin/Sale · เมนูที่ต้องเห็น/ต้องไม่เห็น 36 จุด · ยุบ/ขยายหมวด · Sale เปิด `/quotations` ตรงได้ข้อความไม่มีสิทธิ์ |
| E2E-QUE-01 | QUE-01/02/04/05, INST-01 | Desktop | ไม่มีช่องวันเวลาที่ลูกค้าต้องการ · ประเภทหลัก "ติดตั้ง" เดียว + ย่อย "เช่า" · Enter/ปุ่มค้นหา SN ไม่ submit (DB ไม่มีคิวเพิ่ม, URL เดิม, หมายเหตุยังอยู่) · ถอดเครื่องสุดท้าย → "ยังไม่ได้เลือกเครื่อง" · เครื่องในคลังไม่ถูกลบ · ส่งโดยไม่มีเครื่อง = แจ้ง ไม่บันทึก · PM เช่า 2 ปี ทุก 4 เดือน + เครื่องกรองบันทึกใน DB |
| E2E-QUE-03 | QUE-03, FB-02 | Desktop | Sale เห็นปุ่มเพิ่มสาขา · Enter ในช่องสาขาไม่บันทึกคิว · บันทึกสาขาลง DB · หมายเหตุคิวยังอยู่ |
| E2E-WF01-01 | WF-01/02, CHAT-06 | Desktop | dialog คอนเฟิร์มบอกว่ารอ Admin · ไม่มี JN (DB) · หน้าแสดงสถานะใหม่ · Sale ไม่มีปุ่มเปิด JN · Admin กด "ตรวจและเปิดงาน (ออก JN)" → JN เดียว · ลิงก์ JN · เครื่องกรองถึง Job Machine · การ์ดแชทมีผู้ติดต่อ/เบอร์ อำเภอ/จังหวัด ปุ่ม "เปิดแผนที่" ลิงก์ Google Maps |
| E2E-PM01-01 | PM-01/02, TECH-01 | **Pixel 7 (มือถือ)** | ช่างเห็นปุ่ม "เสนอวันเวลา" เฉพาะรายการของตน · เสนอผ่าน dialog → DB คิว TECH_REPLIED · ตารางแสดง "ช่างเสนอแล้วรอ Admin" · หน้า /m · Admin เห็นป้ายแหล่งที่มา |
| E2E-JOB-01 | JOB-01, EQ-03, INST-01 | Desktop | แถวแรกของงานทั้งหมด = JN ที่เปิดล่าสุด (เทียบ DB) · หน้าเปิดงานไม่มีช่อง "รุ่น" รวม · เลือกติดตั้งแล้วมีช่องประเภทย่อย |
| E2E-CON-01 | CON-01 | Desktop | พิมพ์ SN ตัวเล็ก → รุ่นอ่านอย่างเดียวจากคลัง · เปลี่ยนเป็น SN นอกคลัง → ช่องรุ่นกลับมาแก้ได้ |

## C. Unit / route tests (ใน repo)

| ไฟล์ | ชนิด | หมายเหตุ |
|---|---|---|
| backend `test/customerFeedbackV2.test.ts` (ใหม่ 10 tests) | route + fakeMongo | JOB-01 sort · CHAT-05 · PM-02 สถานะ · PM-01/03 propose/สิทธิ์/กันซ้ำ/เปิดงาน/ยกเลิก · QA F-01/F-02 (ไม่มี JN กำพร้า) · Sale เห็น PM · ผ่าน mutation check (ปิดการผูก PM / กลับลำดับ sort → test ล้ม) |
| backend `test/serviceQueue.test.ts` (ปรับ) | route + fakeMongo | AT 08 เขียนใหม่ตาม WF-01 v2 (เดิมทดสอบ FB-10) · AT 07/10 · R2-07 · ข้อความ CHAT-04 |
| backend `test/fbV1.test.ts`, `gap_job_sources.test.ts` (ปรับ) | route | เพิ่มขั้น Admin เปิด JN หลังคอนเฟิร์ม |
| backend `test/round8_jobs.test.ts` (ปรับ) | route | ป้าย PM-02 ใหม่ · AT-06: ติดตั้งตั้งฐาน PM (INST-03) แต่ไม่ตัดรอบ Package/ไม่มี event PM |
| backend `test/round8_customers.test.ts` (ปรับ) | route | QUE-03: Sale เพิ่มสาขาได้ viewer ไม่ได้ ลบลูกค้าไม่ได้ |
| backend `test/vfbClose.mongo.int.test.ts` (ปรับ) | **MongoDB replica set จริง** | ส่ง techSignature (FB-14) · แสดงสถานะคำขอเมื่อ assertion ล้ม |
| backend `test/helpers/fakeMongo.ts` (ปรับ) | test double | `$in:[null]` ตรงกับฟิลด์ที่ไม่มี (เหมือน MongoDB จริง) |
| frontend `scripts/customerFeedbackV2.test.ts` (ใหม่ 4 tests) | node --test | INST-01 ตัวเลือกประเภท · NAV-01/02 เมนูตามบทบาท · WF-01 ป้าย/ปุ่ม |

## D. อื่น ๆ

- `qa/customer-recovery/race-groups.ts` — upsert กลุ่มช่างพร้อมกันบน DB ใหม่ (BUG-V2-21)
- Independent QA scripts: `evidence/independent-qa/t*.mjs` (24 scenarios โดยผู้ตรวจแยก)

## E. สิ่งที่ยังไม่มี test

CHAT-01/02/03 (ฟังก์ชันยังไม่ทำ) · TECH-01/02 ส่วน UI ช่าง · TECH-03 · QT-02 · บิล/Manager อนุมัติ (WF-01 ข้อ 8) · Import Excel · การแจ้งเตือนค้าง (FB-16) · ปุ่มผูกใบเสนอราคาผ่าน browser · dialog แก้ไขคิว (QA F-05/F-06 ฝั่ง UI) · ทดสอบ concurrent edit จากสองหน้าจอผ่าน browser · network interruption ระหว่างบันทึก (ทดสอบเฉพาะระดับ API ผ่าน failpoint ใน unit test เดิม)
