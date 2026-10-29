# 05 · Defect Closure Register (Round 2)

สถานะใช้คำตามใบงานเท่านั้น · "PASS — EXECUTED & VERIFIED" = แก้แล้วและรันทดสอบซ้ำบน API+MongoDB จริงหรือ browser ผ่านในรอบสุดท้าย (ดู 08) · ไม่นับ FIXED — AWAITING RETEST เป็น PASS
Commit: backend `1ff51f7`, `9553b0e`, แก้ตามผู้ตรวจอิสระ `f457998`, `ea0cf62`, `f93098b`, `0a10e18`, `242f643` · frontend `6602268`, `439465f` · รอบทดสอบสุดท้าย: backend `242f643` / frontend `439465f` (08)

## 1. สรุป

นับราย ID จากตารางหัวข้อ 2–5 (BUG-V2-18 กับ QA-F14 นับแยก · R2-D1/D2 นับแยก · D-22 เป็นเรื่องนโยบาย ไม่นับ)

| กลุ่ม | ID | PASS — EXECUTED & VERIFIED | PARTIAL — VERIFIED WITH LIMITATIONS | FIXED — AWAITING RETEST | BLOCKED — BUSINESS CONFIRMATION | เปิดอยู่ (FAIL) |
|---|---|---|---|---|---|---|
| 2. เปิดอยู่ตอนเริ่ม Round 2 | 17 | 11 | 2 (BUG-V2-21, QA-C6) | 2 (QA-C4, QA-C5) | 2 (QA-F16, QA-F18) | 0 |
| 3. ใหม่จาก audit / E2E | 6 | 6 | 0 | 0 | 0 | 0 |
| 4. ใหม่จากผู้ตรวจอิสระ (R2-F01..F15) | 15 | 15 | 0 | 0 | 0 | 0 |
| 5. ปิดแล้วใน Round 1 — รันซ้ำ | 31 | 31 | 0 | 0 | 0 | 0 |
| **รวม** | **69** | **63** | **2** | **2** | **2** | **0** |

- High/Critical ที่ยังเปิดในโค้ด: **0** · High ที่ปิดใน Round 2: BUG-V2-17, BUG-V2-19, N-1, R2-F01..F04, F09, F12, F14
- BUG-V2-17 และ R2-F01/F02 เป็น**นโยบายชั่วคราว** ที่ยังรอลูกค้ารับรอง (D-03, D-22) — โค้ดผ่านการทดสอบ แต่กติกาธุรกิจยังไม่ยืนยัน
- FIXED — AWAITING RETEST **ไม่นับเป็น PASS**

## 2. Defect ที่เปิดอยู่ตอนเริ่ม Round 2

### BUG-V2-17 · High → **PASS — EXECUTED & VERIFIED** (นโยบายชั่วคราว · D-03 ยังเปิด)
- **เดิม:** ช่างเรียกเครื่อง/แผนที่/สต๊อก/ต้นทุนทั้งบริษัทผ่าน API และเปิดเครื่องคนอื่นด้วย id ได้
- **Reproduce:** unit Round 2 บนโค้ด `992072c` ล้ม 16/17 (`evidence/r2-unit-on-992072c.log.txt`)
- **Root cause:** route ตรวจเฉพาะ permission (`equipment:view`, `stock:view`) ไม่มีขอบเขตเจ้าของข้อมูล · หน้าเว็บซ่อนเมนูแทน
- **แก้:** ดู 04 หัวข้อ 4 (`src/lib/dataScope.ts`, `src/mongo/techDataScope.ts`, routes equipment/customers/stock/parts/jobParts/dashboard/queue)
- **ทดสอบ:** security-matrix 9 scenarios · E2E-R2-09 · unit 7 tests
- **ความเสี่ยงที่เหลือ:** นโยบายยังไม่ได้รับรอง (D-03) · ช่างไม่เห็นยอดคลังกลาง · ใบงานเก่าไม่มี technicianIds

### BUG-V2-19 · High (เดิมบันทึก Medium/NOT TESTED) → **PASS — EXECUTED & VERIFIED**
- **เดิม:** `POST /api/submissions/:id/confirm` ปิดงาน OPEN โดยไม่มีลายเซ็นช่าง
- **Reproduce:** unit บน `992072c` — confirm แล้วใบงานถูกปิด (test ล้ม) · API Round 2 (หลังแก้) ยืนยันว่า 409
- **Root cause:** เส้นทางนี้เรียก `closeJobWithPm` ตรงโดยไม่ผ่านการตรวจ `techSignature` ของ `POST /api/jobs/:id/close`
- **แก้:** `src/routes/chat.ts` — ใบงาน OPEN ต้องมี signoff `JOB_CLOSE` ของช่างที่ได้รับมอบหมาย มิฉะนั้น 409 · ไม่สร้างนโยบายลายเซ็นใหม่ (ใช้กติกาเดิมของ FB-14)
- **ทดสอบ:** R2-SIG-01 (ส่งงานจากแชท → 409, ใบงานยัง OPEN, submission ยัง PENDING · ปิดโดยเครื่องไม่ครบ 4xx · ไม่มีลายเซ็นช่าง 400 · มีลายเซ็นปิดได้ signoff 1 รายการ · ปิดซ้ำ 4xx) · E2E-R2-06 · unit
- **เหลือ:** ไม่มีฟังก์ชัน "เปิดงานใหม่ (reopen ใบงาน)" ในระบบจึงทดสอบไม่ได้ · การแก้หลังลงนามรอ D-16

### BUG-V2-18 + QA-F14 · Low (รากเดียวกัน) → **PASS — EXECUTED & VERIFIED**
- **เดิม:** ช่างที่ถูกย้ายออกได้แจ้งเตือนลิงก์ไปหน้าคิวที่เปิดไม่ได้ (403)
- **Root cause:** ใช้แจ้งเตือนชุดเดียวกับผู้รับคนอื่น (url หน้าคิว) ทั้งที่สิทธิ์ดูคิวเป็นของช่างปัจจุบัน
- **แก้:** `src/lib/serviceQueueNotify.ts` แจ้งช่างเดิมแยก ลิงก์ไปกลุ่มงานของตน · หน้าคิว FE แสดง "คุณไม่ได้รับผิดชอบคิวนี้แล้ว" + ปุ่มกลับหน้างาน แทน error
- **ทดสอบ:** R2-TECH02-01 · E2E-R2-12 (มือถือ) · unit AT10 (ปรับ)
- **เหลือ:** เจ้าของตาราง PM ยังเปิดคิวที่ย้ายให้คนอื่นไม่ได้ (ตั้งใจ — D-21)

### BUG-V2-21 · Medium → **PARTIAL — VERIFIED WITH LIMITATIONS**
- **เดิม:** กลุ่มงานช่างซ้ำบน DB ใหม่ · unique index สร้างไม่ได้
- **Reproduce:** fresh DB หลายโปรเซส 10 รอบบน main และ 10 รอบบนโค้ดใหม่ — **ไม่เกิดซ้ำทั้งคู่** (ยืนยันไม่ได้ว่าการแก้ Round 1 คือสาเหตุที่หาย) · กรณี index สร้างไม่ได้เพราะมีกลุ่มซ้ำเดิม: บนโค้ด Round 1 **เกิดเอกสารซ้ำใหม่ 2 ใน 3 รอบ** (`race-mp-fix-predup.json`)
- **Root cause (ยืนยันแล้วบางส่วน):** upsert โดยไม่มี unique index ไม่กันการสร้างซ้ำเมื่อหลายคำขอพร้อมกัน
- **แก้ Round 2:** `src/mongo/groupChatRepo.ts` — ไม่มี index = สร้างกลุ่มภายใต้ op lock · log เมื่อสร้าง index ไม่ได้ · รายการกลุ่มรวม groupKey ซ้ำเป็นหนึ่ง
- **ทดสอบ:** หลังแก้ ข้อมูลซ้ำเดิม 10 รอบ ไม่มีเอกสารซ้ำใหม่ · E2E-R2-08 (6 แท็บพร้อมกันบน DB ใหม่) · unit
- **ข้อจำกัด:** สาเหตุเดิมบน DB ใหม่ reproduce แบบกำหนดซ้ำไม่ได้ · กลุ่มซ้ำที่มีอยู่แล้วใน production ต้องใช้ M-01 (09) · ถ้า collection ถูกลบขณะเซิร์ฟเวอร์ทำงาน index จะไม่ถูกสร้างใหม่จนรีสตาร์ท

### QA-F06 · Medium → **PASS — EXECUTED & VERIFIED** (Round 1 ระบุ FIXED แต่ browser พบว่ายังไม่ทำงาน)
- **พบใน Round 2 (E2E-R2-02):** แก้คิวเลื่อนงานของใบงาน INSTALL เดิมยังบันทึกไม่ได้ จาก 2 สาเหตุใหม่
  - **R2-D1** ฟอร์มบังคับเลือกเครื่อง ทั้งที่รายการเครื่องของคิวที่ผูก JN จัดการที่ใบงาน (ใบงานไม่มีแถวเครื่อง = แก้ไม่ได้เลย)
  - **R2-D2** หน้าเว็บส่งชื่อลูกค้า/ร้าน/รหัสที่ฟอร์มคำนวณใหม่ backend ปฏิเสธ "แก้ customerCode, customerName, storeName ที่หน้าใบงาน" ทั้งที่ผู้ใช้ไม่ได้แก้
- **แก้:** FE `439465f` — `QueueForm` รับ `itemsFromJob` · EditDialog ส่งเฉพาะหมายเหตุ/เซลล์เจ้าของงานสำหรับคิวที่ผูก JN + ข้อความอธิบาย
- **ทดสอบ:** E2E-R2-02 (DB note อัปเดต, jobType คง INSTALL)

### QA-F07 (TECH-02) · Medium → **PASS — EXECUTED & VERIFIED**
- **เดิม:** ช่างเห็นประวัติรอบนัด บทสนทนา Log และ SN ในหน้าคิว และ API ส่งข้อมูลเหล่านี้ทั้งหมด
- **แก้:** `toTechQueueView` (domain) + routes `GET /api/service-queue`, `/:id`, `/jobs/:jobId` · FE ซ่อนส่วนต่าง ๆ เมื่อ `techView`
- **ทดสอบ:** R2-TECH02-01 · E2E-R2-05 · unit
- **เหลือ:** แยกเครื่องรุ่นเดียวกัน (D-19) · ข้อความ "[ขอคิวใหม่ รอบ n …]" ในหมายเหตุคิวยังแสดงให้ช่าง (เป็นข้อกำหนด CHAT-05)

### QA-F08 · Medium → **PASS — EXECUTED & VERIFIED**
- **เดิม:** กรณีลูกค้าต่างถูกบังด้วยกฎใบเดียวต่อใบงาน · ไม่มีข้อมูลลูกค้าก็ผูกได้ · ยิงพร้อมกันผูกได้หลายใบ
- **แก้:** `linkQuotationToExistingJob` — ตรวจลูกค้าก่อน · ต้องมีลูกค้าทั้งสองฝั่ง · op lock ต่อ JN
- **ทดสอบ:** R2-QT-01 (พร้อมกัน 3 → 1) · E2E-R2-01 · unit
- **ผลข้างเคียง:** ใบเสนอราคา/ใบงานเดิมที่ไม่มีรหัสลูกค้าจะผูกไม่ได้จนกว่าจะระบุลูกค้า (แจ้งผู้ใช้)

### QA-C7 (race ยกเลิกตาราง PM) · Low → **PASS — EXECUTED & VERIFIED**
- **Root cause:** ตรวจ "มีคิวค้าง" จากเอกสารที่อ่านก่อนเขียน · การจองคิวไม่ตรวจสถานะตาราง ณ เวลาเขียน
- **แก้:** เงื่อนไขอยู่ในคำสั่ง update ทั้งสองฝั่ง (`setPmPlanStatus`, `reservePmQueueSlot`)
- **ทดสอบ:** R2-PM-01 (10 รอบพร้อมกัน ไม่มีตารางยกเลิกที่มีคิวค้าง) · E2E-R2-07 · unit

### QA-C1..C6 (แยกรายการ)
| ID | เรื่อง | ผลรันใน Round 2 | สถานะ |
|---|---|---|---|
| QA-C1 | ป้าย PM ในหน้าคิว | R1 E2E-PM01-01 regression (หน้าคิวของ Admin แสดง "งานจากตาราง PM") | PASS — EXECUTED & VERIFIED |
| QA-C2 | เมนูมือถือเฉพาะช่าง | R1 E2E-NAV-01 regression (Admin/Sale ไม่เห็น /m) · FE unit | PASS — EXECUTED & VERIFIED |
| QA-C3 | id หมวดเมนูไม่ซ้ำ | R1 E2E-NAV-01 (ยุบ–ขยายหมวด) | PASS — EXECUTED & VERIFIED |
| QA-C4 | ประเภทย่อยว่างในหน้าแก้ใบงาน | ไม่ได้ทดสอบ browser หน้าแก้ใบงาน | FIXED — AWAITING RETEST |
| QA-C5 | jobLinkedAt ไม่ล้างเมื่อยกเลิกใบงาน (+ jobLinkedBy/ById ใน Round 2) | unit เท่านั้น | FIXED — AWAITING RETEST |
| QA-C6 | ค่าประกันค้างเมื่อเปลี่ยนประเภทงาน | R2-QUE-01 (ติดตั้งเช่าไม่เก็บประกัน — ฝั่ง API) · FE ไม่ได้ทดสอบ browser | PARTIAL — VERIFIED WITH LIMITATIONS |

### QA-F16 · Medium (ยกระดับจาก Low) → **BLOCKED — BUSINESS CONFIRMATION** (D-17)
### QA-F18 · Low → **BLOCKED — BUSINESS CONFIRMATION** (D-21 — เสนอวันย้อนหลังได้ ทั้งคิวปกติและ PM ตามกติกาเดิม ไม่เปลี่ยนเอง)

## 3. Defect ใหม่ที่พบใน Round 2

| ID | Sev | พบจาก | เรื่อง | แก้ที่ | สถานะ |
|---|---|---|---|---|---|
| N-1 | High | Audit (อ่านโค้ด) → unit + API ยืนยัน | สัญญามีผลซ้ำบนเครื่องเดียวกันเมื่อพิมพ์ Serial ตัวพิมพ์เล็ก | `contractRepo.createContract` ตรวจหลังแปลง Serial + collation | PASS — EXECUTED & VERIFIED (R2-CON-01) |
| N-2 | Medium | Audit | Sale ได้ยอดรายรับ/ต้นทุนทั้งบริษัทจากแดชบอร์ด | `dashboard.ts` null สำหรับผู้ไม่มี quotations:view · ซ่อนเมนู Sale | PASS — EXECUTED & VERIFIED (unit · API SEC-SALE-01, SEC-FIN-01 · E2E-R2-09) |
| N-3 | Medium | Audit | Sale อ่านตำแหน่งช่างผ่าน API | ตัด `tracking:view` ของ Sale | PASS — EXECUTED & VERIFIED (unit · API SEC-SALE-01 → 403) |
| R2-D1, R2-D2 | Medium | E2E-R2-02 | แก้คิวที่ผูก JN ไม่ได้ (ดู QA-F06) | FE `439465f` | PASS — EXECUTED & VERIFIED |
| QA-F12 (ส่วนที่สอง) | Low | Audit + API | "ช่าง ช่าง บี" ในข้อความย้ายช่าง | `techLabel()` | PASS — EXECUTED & VERIFIED (R2-TECH02-01) |
| D-22 | — | ตรวจด้วยคำขอจริง | ยอดเงินรายใบงานส่งให้ Sale/ช่าง (เรื่องนโยบาย ไม่นับเป็น defect) | ปิดในโค้ดแล้วด้วย R2-F01/F02 (`f457998`) | BLOCKED — BUSINESS CONFIRMATION (ลูกค้ายืนยันนโยบาย) |
| R2-F* | — | Independent QA Round 2 | ดูหัวข้อ 4 | | |

## 4. ผล Independent QA Round 2

ผู้ตรวจแยกจากผู้พัฒนา ใช้ API/DB แยก · 6 รอบ (08) · ทุกรายการแก้แล้วและผู้ตรวจรันซ้ำยืนยัน + อยู่ในชุดทดสอบรอบสุดท้าย

| ID | Sev | เรื่อง | พบบน | แก้ที่ | หลักฐานรอบสุดท้าย | สถานะ |
|---|---|---|---|---|---|---|
| R2-F01 | High | Sale ได้ยอดเงินรายใบงานจาก API ใบงาน/Export (N-2 ไม่ครบ) | `9553b0e` | `f457998` `jobFinanceGuard` | SEC-FIN-01 · ผู้ตรวจไล่ 26 endpoint + 2 XLSX | PASS — EXECUTED & VERIFIED (D-22 รอยืนยัน) |
| R2-F02 | High | ช่างได้ยอดเงินใบงานของตน | `9553b0e` | `f457998` | SEC-FIN-01 | PASS — EXECUTED & VERIFIED |
| R2-F03 | High | สร้างสัญญาพร้อมกันบนเครื่องเดียว → หลายสัญญามีผล | `9553b0e` | `f457998` lock ต่อ Serial | SEC-CON-01 (3 รอบ × 5 คำขอ) | PASS — EXECUTED & VERIFIED |
| R2-F04 | High | ผูกเครื่องพร้อมกัน → หลายสัญญามีผล | `9553b0e` | `f457998` | SEC-CON-01 | PASS — EXECUTED & VERIFIED |
| R2-F05 | Medium | link-equipment ตรวจซ้ำแบบสนตัวพิมพ์ | `9553b0e` | `f457998` collation | SEC-CON-01 | PASS — EXECUTED & VERIFIED |
| R2-F06 | Medium | ช่างเปิด SN/ประวัติเครื่องในขั้นคิวผ่าน API เครื่อง (เลี่ยง TECH-02) | `9553b0e` | `f457998` ตัดคิวออกจากขอบเขตเครื่อง | SEC-SCOPE-02 | PASS — EXECUTED & VERIFIED |
| R2-F07 | Low | สิทธิ์เครื่องไม่หมดเมื่อคิว/ใบงานยกเลิก | `9553b0e` | `f457998` | SEC-SCOPE-02 | PASS — EXECUTED & VERIFIED |
| R2-F08 | Low | ทำเครื่องหมายอ่านแจ้งเตือนของคนอื่นได้ (มีมาก่อน Round 2) | `9553b0e` | `f457998` | SEC-NOTIF-01 | PASS — EXECUTED & VERIFIED |
| R2-F09 | High | เปิดใช้งานสัญญาหมดอายุ 2 ฉบับพร้อมกัน → 2 ACTIVE | `f457998` | `ea0cf62` lock ใน setContractStatus | SEC-CON-01 (3 รอบ) · ผู้ตรวจ 5 รอบ | PASS — EXECUTED & VERIFIED |
| R2-F10 | Medium | เปิดใช้งานซ้ำ: ตรวจสนตัวพิมพ์ ไม่นับร่าง | `f457998` | `ea0cf62` | SEC-CON-01 · unit | PASS — EXECUTED & VERIFIED |
| R2-F11 | Low | นำเข้า Excel: Serial ตัวเล็ก → "ไม่พบเครื่อง" | `f457998` | `ea0cf62` | unit `contractImport.test.ts` · ผู้ตรวจ RVF-07 | PASS — EXECUTED & VERIFIED |
| R2-F12 | High | ต่อสัญญาไม่มี lock และตรวจสนตัวพิมพ์ → 2 ACTIVE | `ea0cf62` | `f93098b` | SEC-CON-02 (5 รอบ) | PASS — EXECUTED & VERIFIED |
| R2-F13 | Low | dry-run นำเข้าไม่แจ้งเครื่องไม่ว่าง — **regression ที่ `ea0cf62` สร้างเอง** | `ea0cf62` | `f93098b` | unit · ผู้ตรวจ RVF-07 | PASS — EXECUTED & VERIFIED |
| R2-F14 | High | เปลี่ยน Serial เครื่องย้ายสัญญาไปเลขที่มีสัญญามีผล → 2 ACTIVE | `f93098b` | `0a10e18` `withSerialRelinkGuard` | SEC-CON-03 · ผู้ตรวจ race 5 รอบ | PASS — EXECUTED & VERIFIED |
| R2-F15 | Medium | ยกเลิกรายการชำระของสัญญาชำระครบ → กลับ ACTIVE ซ้อนสัญญาใหม่ | `0a10e18` | `242f643` | SEC-CON-04 · ผู้ตรวจ race 5 รอบ | PASS — EXECUTED & VERIFIED (D-23 รอยืนยัน) |

ข้อสังเกตจากผู้ตรวจ (ไม่ใช่ defect · ส่งให้ลูกค้าตัดสิน): ช่างยังเห็นรายการเครื่อง (มี SN) ของใบงานที่ถูกยกเลิกผ่าน `GET /api/jobs/:id/equipment` ตามสิทธิ์ใบงานเดิม ขณะที่ `/api/equipment/:id` ตอบ 403 — รวมไว้ใน D-03 · `jobFinanceGuard` ครอบเฉพาะ JSON — export ไฟล์ใหม่ในอนาคตที่มียอดเงินใบงานต้องตรวจเอง (ความเสี่ยงใน 12)

**ข้อสรุปเรื่องกระบวนการ:** R2-F03..F15 เป็นกติกาเดียว (เครื่องละ 1 สัญญามีผล) ที่ถูกเจาะทีละเส้นทาง 6 เส้นทาง และมี 1 regression จากการแก้เอง (F13) — ระบบบังคับกติกานี้ในโค้ดเท่านั้น จึงเสนอ unique index (M-04 ใน 09) เป็นงานถัดไป

## 5. Defect จาก Round 1 ที่ปิดแล้ว — ตรวจหลักฐานซ้ำ

| ID | หลักฐานที่รันในรอบสุดท้าย Round 2 | สถานะ |
|---|---|---|
| BUG-V2-01 | E2E-R2-11, R1 QA-WF01-01/02 regression | PASS — EXECUTED & VERIFIED |
| BUG-V2-02 | R1 QA-PM01/02/03 + E2E-PM01-01 regression, E2E-R2-07 | PASS — EXECUTED & VERIFIED |
| BUG-V2-03 | R2-QUE-01 (รวมประกัน), R1 QA-INST-01 | PASS — EXECUTED & VERIFIED |
| BUG-V2-04 | R1 QA-INST-01, QA-REV-INST regression | PASS — EXECUTED & VERIFIED |
| BUG-V2-05, -07, -22 | R1 E2E-QUE-01 regression | PASS — EXECUTED & VERIFIED |
| BUG-V2-06 | R1 E2E-QUE-03 regression | PASS — EXECUTED & VERIFIED |
| BUG-V2-08 | R1 QA-JOB01-01 + E2E-JOB-01 regression | PASS — EXECUTED & VERIFIED |
| BUG-V2-09 | R2-CHAT05-01 (400 ไม่ใช่ 409), E2E-R2-03 | PASS — EXECUTED & VERIFIED |
| BUG-V2-10 | unit AT10 (ถ้อยคำ), R2-TECH02-01 | PASS — EXECUTED & VERIFIED |
| BUG-V2-11 | R2-CON-01, R1 E2E-CON-01 | PASS — EXECUTED & VERIFIED |
| BUG-V2-12 | real-DB 3 ไฟล์ (รอบสุดท้าย) | PASS — EXECUTED & VERIFIED · *ไม่มีหลักฐานก่อนแก้ (ดู 02)* |
| BUG-V2-13 | R1 QA-QT01-01 regression | PASS — EXECUTED & VERIFIED |
| BUG-V2-14 | R1 QA-TECH02-01 regression, E2E-R2-04 | PASS — EXECUTED & VERIFIED |
| BUG-V2-15 | R1 E2E-JOB-01 regression | PASS — EXECUTED & VERIFIED |
| BUG-V2-16 (High) | R1 QA-NAV01-API regression, SEC-STK-01, SEC-REGR-01 | PASS — EXECUTED & VERIFIED |
| BUG-V2-20 | E2E-R2-11 (อำเภอ/จังหวัดครั้งเดียวในการ์ด) | PASS — EXECUTED & VERIFIED |
| TEST-01 | real-DB vfbClose | PASS — EXECUTED & VERIFIED |
| QA-F01, F02 | R1 QA-REV-PM regression, E2E-R2-07 | PASS — EXECUTED & VERIFIED |
| QA-F03 | R1 QA-REV-INST regression (+ fallback วันที่ปิดงาน: unit) | PASS — EXECUTED & VERIFIED |
| QA-F04, F09, F10, F11, F13 | R1 QA-REV-* regression | PASS — EXECUTED & VERIFIED |
| QA-F05 | R1 QA-REV-QUEUE (API) + E2E-R2-02 (UI โหลดค่าเดิม) | PASS — EXECUTED & VERIFIED |
| QA-F12 | R1 QA-REV-PM + R2-TECH02-01 | PASS — EXECUTED & VERIFIED |
| QA-F15 (Medium) | R2-BILL-01 (ใบเสนอราคา + บิล), E2E-R2-10 | PASS — EXECUTED & VERIFIED |
| QA-F17 | R2-CON-01 | PASS — EXECUTED & VERIFIED |
