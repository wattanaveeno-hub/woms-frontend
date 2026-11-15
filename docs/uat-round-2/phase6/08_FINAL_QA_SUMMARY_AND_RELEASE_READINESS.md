# 08 — Final QA Summary & Release Readiness (Phase 6 / Master Execution · 14 พ.ย. 2569)

> ตำแหน่งหลักฐาน: `evidence/r8/…` ในเอกสารนี้อยู่ที่ `Claude outputs/uat-round-2/r8-sandbox/…` บนเครื่อง Owner (แยกจาก `r8/` ซึ่งสงวนไว้สำหรับหลักฐาน UAT จริง)

เอกสารนี้ **แทนที่ (supersede)** `phase5/03_RELEASE_READINESS_REPORT.md` เอกสาร Phase 5 คงไว้เป็นประวัติ
ป้ายสถานะ: OWNER CONFIRMED / AUTOMATED PASS / REAL UAT VERIFIED / OWNER-REPORTED UAT EXECUTED / PROPOSED DESIGN / BLOCKED / NOT VERIFIED (นิยามใน 01)

## คำตอบสั้น

**NOT READY FOR RELEASE — รอหลักฐาน UAT จริงและการตัดสินใจด้าน design**

- งานโค้ดรอบนี้เสร็จและผ่านการทดสอบอัตโนมัติครบ
  - BE 2,361/0/242 skip
  - FE 348/0
  - E2E 400/0 รันต่อเนื่อง
- รายการที่ Owner ยืนยันบันทึกเป็น OWNER CONFIRMED แล้ว
- แต่ยังไม่มีหลักฐาน UAT จริงให้ตรวจ (ไม่มีโฟลเดอร์ `r8/` บนเครื่อง) และ Gate B ยังมีหน้าที่เป็น PROPOSED DESIGN กับเรื่องที่ต้องตัดสินใจ
- ผลจาก sandbox อย่างเดียวไม่พอสำหรับคำว่า READY

---

## 1. Owner confirmations

| ID | สถานะ |
|---|---|
| UAT2-17 แบบฟอร์มสัญญาเช่า | **OWNER CONFIRMED** + AUTOMATED PASS |
| UAT2-18 ข้อกำหนดเพิ่มเติม | **OWNER CONFIRMED** + AUTOMATED PASS |
| DEF-P5-02 | **OWNER CONFIRMED** → CLOSED · AUTOMATED PASS |
| DEF-R5-01 | **OWNER CONFIRMED** → CLOSED · AUTOMATED PASS |
| Real UAT (แผน Phase 5) | **OWNER-REPORTED UAT EXECUTED** — automated regression ที่ค้างอยู่ทำครบแล้วในรอบนี้ (ข้อ 10–12) |

ไม่มีการสร้างลายเซ็นหรือชื่อผู้อนุมัติขึ้นเอง รายละเอียดอยู่ใน `01_OWNER_CONFIRMATION_AND_REQUIREMENT_MATRIX.md`

## 2. Numeric fields audited

ตรวจทุกช่องตัวเลขใน frontend **36 กลุ่ม** รายการเต็มอยู่ใน `02_NUMERIC_INPUT_AUDIT.md` ครอบคลุม
- ใบงาน: รายรับ, ค่าใช้จ่าย, อะไหล่, เครื่อง, revision
- วางบิลและรับชำระ
- สัญญาและงวด
- ใบเสนอราคา, เอกสารการขาย
- สต๊อก
- ข้อมูลพื้นฐาน: รุ่นเครื่อง, ประกัน
- คิว/slot
- พิกัด
- ช่องตัวเลขในส่วน PM/Warehouse (เฉพาะ component ของช่อง)

## 3. Numeric fields fixed

แก้ **32 กลุ่มใน 25 ไฟล์** อีก 4 กลุ่มถูกต้องอยู่แล้ว
- เพิ่ม component กลาง `NumberInput`
  - ช่องว่างแสดง placeholder `0` ที่มองเห็นได้จริง
  - พิมพ์ 50000 ได้ 50000
  - ใช้ `type=text` + `inputMode` numeric/decimal
  - ช่องที่ 0 มีความหมายใช้ `zeroAsEmpty={false}`
  - ไม่แทนช่องว่างเป็น 0 เอง
- ภาพก่อน/หลังยืนยันอาการเดิม `050000` → `50000`
- พบและแก้ **OBS-P6-01**: placeholder ถูก MUI ซ่อน

## 4. Design pages found

- Artifact มี **65** หน้า design (ไม่นับ Before-*, Nav, Top)
- มี route รองรับ **58** หน้า (Desktop 51, Mobile 7)
- อีก 7 หน้าเป็นขอบเขต Warehouse/PM ที่ Owner สั่งไม่แตะ
- Coverage: ตรง design 28 · มีความต่าง P2/P3 22 · ต้องตัดสินใจ (BIZ) 8

รายละเอียดอยู่ใน `03_DESIGN_INVENTORY_AND_COVERAGE.md`

## 5. Design pages still missing

Route ในระบบที่ไม่มี design ตรงตัว **16** route
- เขียน PROPOSED DESIGN 13 route:
  - `/bills/new`, `/bills/[id]/edit`, `/bills/[id]/print`
  - `/documents/[id]`, `/inventory`
  - `/jobs/[id]/edit`, `/master/[kind]`
  - `/parts`, `/partners`, `/partners/new`
  - `/quotations/[id]/edit`, `/tracking`
  - `/contracts/[id]/document`
- อีก 3 route ไม่ต้องเขียนใหม่:
  - `/finance/audit` ใช้ Audit design ร่วม
  - `/queue` เป็น legacy
  - `/pm/[id]` อยู่ในขอบเขต PM ที่ไม่แตะ

## 6. Proposed designs

`04_PROPOSED_DESIGNS.md` มี spec ครบ 13 route สถานะทั้งหมดเป็น **PROPOSED DESIGN** (ยังไม่ได้รับอนุมัติจากลูกค้า)
- แต่ละหน้ามี: layout desktop/mobile, component, validation, role visibility, empty/loading/error state และ handoff checklist
- pattern กลางใช้ร่วมกันทุกหน้า
- ไม่เปลี่ยน workflow, permission, API หรือถ้อยคำสัญญา

## 7. Pages implemented (รอบนี้)

| หน้า | การเปลี่ยน | ผล |
|---|---|---|
| Users | ช่องค้นหา + pill กลุ่ม (ทั้งหมด/ช่าง/เซลล์/แอดมิน-ผู้จัดการ/ปิดใช้งาน) พร้อมจำนวน | AUTOMATED PASS (unit 2 + flow21) · ภาพก่อน/หลัง desktop + 390px |
| Calendar | ชื่อหน้า "ปฏิทินช่าง" ให้ตรงเมนูและ design | AUTOMATED PASS |
| Finance | ปุ่ม "ประวัติการเงิน" → `/finance/audit` | AUTOMATED PASS · tech ไม่เห็น |
| ทุกหน้าที่มีช่องตัวเลข | `NumberInput` | AUTOMATED PASS |

ไม่เพิ่ม library, ไม่เปลี่ยน API/navigation/RBAC

## 8. Remaining business decisions

| # | เรื่อง | ที่มา |
|---|---|---|
| 1 | อนุมัติ PROPOSED DESIGN 13 หน้า (ทั้งหมดหรือรายหน้า) | 04 |
| 2 | DashboardSales: ตาราง read-only หรือ action list | 03-E |
| 3 | Documents: taxonomy เอกสารตาม design หรือตามระบบ | 03-E |
| 4 | Finance: รวมงวดสัญญาเช่าเข้าหน้าเดียว + stat cards | 03-E |
| 5 | Notifications: ความหมายแท็บ + เปิด Web Push (VAPID) | 03-E, UAT-P5-C03 |
| 6 | QuotationDetail: สถานะ "ลูกค้าขอแก้ราคา" | 03-E |
| 7 | Account: ผู้ใช้เปลี่ยนรูปโปรไฟล์เอง | 03-E |
| 8 | Chats/คิว legacy: manager ควรเห็นหรือไม่ (OBS-P6-03) | 07 |
| 9 | MBills: ช่างวางบิลบนมือถือ | 03-E |
| 10 | admin เปิด `/users` ไม่ได้ — ตั้งใจหรือไม่ (OBS-P6-02) | 07 |
| 11 | OD-P4-01..06 (เลขข้อสัญญา, ต่อสัญญา, หน้า 1 มีที่ว่าง, PDF เซิร์ฟเวอร์, amendment, ช่องทางแจ้งเตือน) | Phase 4 |
| 12 | LINE / Email อยู่ในขอบเขตหรือไม่ | UAT-P5-C04 |
| 13 | Cleanup ข้อมูล QA-R2 | UAT-P5-C05 |
| 14 | อนุมัติ commit/push (Owner ทำเอง) | — |

## 9. Changed files

Frontend **31 ไฟล์** (แก้ 28 ไฟล์, ใหม่ 3 ไฟล์) และ backend **0 ไฟล์** รายการพร้อม EOL อยู่ใน `05_IMPLEMENTATION_TRACKER.md` ส่วน 1
- ไฟล์ใหม่: `src/components/NumberInput.tsx`, `src/lib/userFilter.ts`, `scripts/userFilter.test.ts`
- Sync ไปเครื่อง Owner แล้ว
  - ตรวจ sha256 ก่อนเขียน 28/28 และหลังเขียน 31/31
  - คง CRLF ของไฟล์เดิม
  - ยังไม่ commit

## 10. Backend results

- `tsc`: PASS
- build: PASS
- vitest: **2,361 PASS · 0 FAIL · 242 SKIP** (เท่า baseline — ไม่มีไฟล์ backend เปลี่ยน)

## 11. Frontend results

- `tsc`: PASS
- `next build`: PASS
- lint: PASS (1 warning เดิม)
- unit: **348 PASS · 0 FAIL · 0 SKIP**
- บนเครื่อง Owner: `tsc` PASS และ `npm test` 348/348

## 12. E2E results

flow1–21 รันต่อเนื่องรอบเดียว ได้ **400 PASS · 0 FAIL · 0 NOT VERIFIED** รายชุดอยู่ใน `06_AUTOMATED_REGRESSION_REPORT.md`

| ชุด | รายการ | PASS |
|---|---|---|
| flow18 | DEF-R5-01 / DEF-P5-01 | 46 |
| flow19 | DEF-P5-02 | 22 |
| flow15 | UAT2-17 | 17 |
| flow17 | UAT2-18 | 110 |
| flow20 | Numeric | 25 |
| flow21 | Design | 22 |

## 13. Real UAT evidence status

**OWNER-REPORTED UAT EXECUTED — ยังไม่ใช่ REAL UAT VERIFIED**
- บนเครื่อง Owner ไม่มีโฟลเดอร์ `Claude outputs/uat-round-2/r8/` (มีถึง r7)
- ฝั่งนี้ทดสอบ UAT จริงเองไม่ได้
  - Chrome ที่เชื่อมอยู่ login ด้วยบัญชีที่ไม่ใช่ QA-R2 จึงหยุดใช้
  - ไฟล์บัญชี QA-R2 ถูกปฏิเสธสิทธิ์ (BLK-P4-01) และไม่ได้พยายามอ่านซ้ำ
- หลักฐานที่ยังขาด แยกรายการ T01–T10, A01–A06, S01–S06, M01–M05 และ numeric บน UAT อยู่ใน 01 ส่วน 2
- ไม่มีรายการ BLOCKED ใดถูกเปลี่ยนเป็น PASS

## 14. Defect status

| ID | สถานะ |
|---|---|
| DEF-R5-01 | CLOSED — OWNER CONFIRMED |
| DEF-P5-02 | CLOSED — OWNER CONFIRMED |
| DEF-P5-01 | FIXED — AUTOMATED PASS (รอหลักฐาน UAT) |
| NUM-P6-01 | FIXED — AUTOMATED PASS |
| OBS-P6-01 | FIXED — AUTOMATED PASS |
| OBS-P6-02, OBS-P6-03 | OPEN (ต้องตัดสินใจ) |
| BLK-P4-01 | OPEN |

Critical 0 · High เปิด 0 · Medium เปิด 0 รายละเอียดอยู่ใน `07_DEFECT_REGISTER_UPDATE.md`

## 15. Gate A — Functional UAT

**NOT PASSED (รอหลักฐาน)** — ดีขึ้นจาก FAIL ใน Phase 5

| เกณฑ์ | ผล |
|---|---|
| Automated regression ครบทุกบทบาท | AUTOMATED PASS |
| Owner ยืนยัน UAT2-17, UAT2-18, DEF-P5-02, DEF-R5-01 | OWNER CONFIRMED |
| Tech/Sales/Manager บน UAT จริง | OWNER-REPORTED — ไม่มีหลักฐานให้ตรวจ |
| Numeric fix บน UAT จริง | NOT VERIFIED (ต้องรีสตาร์ต frontend ของ UAT ให้ใช้โค้ดล่าสุดก่อน) |
| ช่องทางแจ้งเตือนภายนอก | NOT CONFIGURED (รอตัดสินใจ) |

Gate A ผ่านได้ทันทีเมื่อ
1. Owner วางหลักฐานตาม 01 ส่วน 2 ลงใน `r8/` แล้วตรวจผ่าน
2. หรือ Owner ยอมรับ OWNER-REPORTED แทนหลักฐานเป็นลายลักษณ์อักษร

## 16. Gate B — Design Verification

**NOT PASSED**
- 58/65 design มี route รองรับ
- หน้าหลักทั้งหมดตรวจเทียบแล้ว
- ที่ยังค้าง:
  - ความต่าง P2/P3 22 รายการ
  - BIZ 8 รายการ
  - 13 หน้าเป็น PROPOSED DESIGN ที่ยังไม่ได้อนุมัติ
  - หน้าที่ระบุว่า NOT VERIFIED รายละเอียดยังไม่ได้เทียบ layout ทีละส่วน

Gate B ผ่านได้เมื่อ
1. ลูกค้าอนุมัติ 04 (หรือยอมรับขอบเขต)
2. ตัดสินใจเรื่อง BIZ ในข้อ 8
3. ยอมรับหรือแก้ความต่าง P2/P3

## 17. Overall readiness

**NOT READY FOR RELEASE**
- คุณภาพโค้ดและการทดสอบอัตโนมัติอยู่ในระดับพร้อม (0 FAIL ทุกชุด, ไม่มี defect Critical/High ที่เปิดอยู่)
- ที่ขาดคือหลักฐาน UAT จริงและการตัดสินใจด้าน design ซึ่งต้องเป็นมนุษย์ทำ

ลำดับที่แนะนำ
1. รีสตาร์ต frontend บน UAT
2. ทดสอบช่องรายรับใบงาน (พิมพ์ 50000)
3. วางหลักฐานตามแผน Phase 5 ลง `r8/`
4. ตัดสินใจข้อ 8
5. อนุมัติ commit

ไม่ได้ commit / push / merge / deploy / cleanup · ไม่แตะ Production · ไม่ลบข้อมูล QA-R2 · ไม่อ่านไฟล์บัญชีที่ถูกปฏิเสธ · ไม่แก้ถ้อยคำสัญญา
