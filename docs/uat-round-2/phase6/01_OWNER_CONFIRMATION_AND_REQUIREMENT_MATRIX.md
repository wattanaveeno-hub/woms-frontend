# 01 — Owner Confirmation & Requirement Matrix (Phase 6 / Master Execution)

วันที่: 2026-11-14 · เอกสารนี้ **แทนที่ (supersede)** สถานะใน `phase5/03_RELEASE_READINESS_REPORT.md` เฉพาะแถวที่ระบุ ส่วนเอกสาร Phase 5 คงไว้ตามเดิมเป็นประวัติ

## ป้ายสถานะที่ใช้

| ป้าย | ความหมาย | หลักฐานที่ต้องมี |
|---|---|---|
| **OWNER CONFIRMED** | Owner ยืนยันในข้อความสั่งงาน | ข้อความของ Owner (Master Execution Prompt, 14 พ.ย. 2569) |
| **AUTOMATED PASS** | ผ่านการทดสอบอัตโนมัติใน sandbox (fakeMongo + fixture) | log ใน `evidence/r8/` |
| **REAL UAT VERIFIED** | มีหลักฐานจาก UAT จริง (Atlas `woms`) ที่ตรวจได้ | ภาพหน้าจอ/ผล API ใน `Claude outputs/uat-round-2/r8/` |
| **OWNER-REPORTED UAT EXECUTED** | Owner แจ้งว่าทดสอบบน UAT จริงแล้ว แต่ยังไม่มีหลักฐานให้ตรวจ | ข้อความของ Owner เท่านั้น |
| **BLOCKED** | ทำต่อไม่ได้เพราะขาดสิ่งที่ระบุ | — |
| **NOT VERIFIED** | ยังไม่ได้ตรวจ | — |
| **PROPOSED DESIGN** | spec ที่เสนอ ยังไม่ได้รับอนุมัติจากลูกค้า | `04_PROPOSED_DESIGNS.md` |

OWNER CONFIRMED กับ AUTOMATED PASS เป็นคนละเรื่อง เอกสารนี้ไม่เอาข้อใดไปแทนอีกข้อ

## 1. Owner confirmations ที่บันทึกในรอบนี้

| ID | เรื่อง | สถานะเดิม (Phase 5) | สถานะใหม่ | การทดสอบอัตโนมัติ (แยกต่างหาก) |
|---|---|---|---|---|
| UAT2-17 | แบบฟอร์มสัญญาเช่า (เอกสารสัญญา + pagination) | Customer acceptance BLOCKED | **OWNER CONFIRMED** | AUTOMATED PASS — flow15, flow17 และ unit `contractClauses` (ผลรอบนี้ใน 06) |
| UAT2-18 | ข้อกำหนดเพิ่มเติมในสัญญา (สร้าง/ตรวจ/แสดง/พิมพ์/อนุมัติ) | admin PASS · manager/ลูกค้า BLOCKED | **OWNER CONFIRMED** | AUTOMATED PASS — flow17, flow19, BE `p4_*`/`p5_contractApproval` (ผลรอบนี้ใน 06) |
| DEF-P5-02 | ผู้อนุมัติเห็นข้อความข้อกำหนดเต็มในคำขอแก้ไข | FIXED · ยืนยันบน UAT BLOCKED | **OWNER CONFIRMED** (ปิดได้ตามการยืนยันของ Owner) | AUTOMATED PASS — flow19 + `p5_contractApproval` |
| DEF-R5-01 | stage SUBMITTED ใน list + แท็บ/ปุ่ม "ตรวจปิด" | FIXED · real UAT BLOCKED | **OWNER CONFIRMED** (ปิดได้ตามการยืนยันของ Owner) | AUTOMATED PASS — flow18 + unit |
| Real UAT รอบ Phase 5 | แผน `phase5/02_REAL_UAT_TEST_PLAN.md` | NOT EXECUTED | **OWNER-REPORTED UAT EXECUTED** | — |

ข้อสังเกต
- ไม่มีการลงนามแทนลูกค้า เอกสารนี้ไม่สร้างลายเซ็นหรือชื่อผู้อนุมัติขึ้นเอง
- UAT2-17/18 เป็น OWNER CONFIRMED ไม่ใช่ "customer signed-off" ถ้าสัญญาจ้างกำหนดให้ลูกค้าลงนามรับ ต้องเก็บลายเซ็นลูกค้าแยกต่างหาก
- DEF-P5-02: คำขอเดิม `CR-20261114-9F79E1` สร้างก่อนแก้ จึงยังมี `changes: []` ในฐานข้อมูล ข้อมูลเดิมนี้ไม่ได้ถูกแก้ย้อนหลัง

## 2. หลักฐาน UAT จริง — สถานะ

ตรวจโฟลเดอร์หลักฐานบนเครื่อง Owner เมื่อ 14 พ.ย. 2569 (อ่านอย่างเดียว ไม่เปิดไฟล์บัญชี):
- `Claude outputs/uat-round-2/` มี r3–r7, logs, screens
- **ไม่มีโฟลเดอร์ `r8/`** ซึ่งเป็นที่เก็บหลักฐานตามแผน Phase 5

ผลคือทุกรายการด้านล่างเป็น **OWNER-REPORTED UAT EXECUTED** และยัง **ไม่ใช่ REAL UAT VERIFIED** เพราะยังไม่มีหลักฐานที่ตรวจได้ การทดสอบทางเบราว์เซอร์จากฝั่งนี้ก็ทำไม่ได้ ด้วยสองเหตุผล
- Chrome ที่เชื่อมอยู่ login ด้วยบัญชีที่ไม่ใช่ QA-R2 จึงหยุดใช้และปิดแท็บ
- ไฟล์บัญชี QA-R2 ถูกปฏิเสธสิทธิ์อ่าน (BLK-P4-01) และไม่ได้พยายามอ่านซ้ำ

### หลักฐานที่ยังขาด (ต่อรายการ)

| ID แผน | หลักฐานขั้นต่ำที่ต้องมีเพื่อเปลี่ยนเป็น REAL UAT VERIFIED |
|---|---|
| UAT-P5-T01/T02 | ภาพหน้าจอ login ด้วยเบอร์สำเร็จ + ผล `/api/auth/me` (role=tech) · ภาพข้อความ 401 |
| UAT-P5-T03 | ภาพสถานะ Q-2026-0092 "ช่างตอบแล้ว · รอ Admin รับคิว" |
| UAT-P5-A01 | เลข JN ที่เปิดจาก Q-2026-0092 |
| UAT-P5-T04/T05 | ผล `GET /api/jobs/<JN>/stage` = SUBMITTED |
| UAT-P5-T06 | ภาพ /jobs ของ tech ที่ไม่มีปุ่ม "ตรวจปิด" + ผล confirm = 403 (DEF-P5-01) |
| UAT-P5-A02 | ภาพแท็บ "รอตรวจปิด" ที่มี JN นี้ + stage จาก list ตรงกับ endpoint (DEF-R5-01) |
| UAT-P5-A03/A04/T09 | stage IN_PROGRESS หลังตีกลับ → CONFIRMED/CLOSED |
| UAT-P5-A05/M01 | เลขคำขอใหม่ + ภาพตารางก่อน/หลังข้อความเต็ม + สถานะ APPROVED (DEF-P5-02) |
| UAT-P5-A06 | ผล approve ด้วย admin = 403 |
| UAT-P5-S01..S06 | ภาพ/ผล API ของ sales ตามตาราง C |
| UAT-P5-M02 | ไฟล์ PDF สัญญา CT-2026-0003 หลังอนุมัติ |
| UAT-P5-M03/M04 | ผล audit query และ 409 field phone |
| UAT-P5-T07/T08/T10 | ผล 403 / ภาพแจ้งเตือน / ผล 200 |
| Numeric (รอบนี้) | ภาพช่องรายรับ/ค่าใช้จ่ายใบงานบน UAT หลัง sync: placeholder 0 และพิมพ์ 50000 ได้ 50000 |

ทางที่เร็วที่สุด: Owner วางภาพหน้าจอและผล API ที่ทดสอบแล้วลงใน `Claude outputs/uat-round-2/r8/` โดยตั้งชื่อตาม ID (เช่น `UAT-P5-A02.png`) แล้วให้ตรวจรอบถัดไป ห้ามใส่รหัสผ่านหรือ token ในหลักฐาน

## 3. Requirement matrix (เฉพาะรายการที่สถานะเปลี่ยนหรือเพิ่มในรอบนี้)

| Req | รายละเอียด | OWNER | AUTOMATED | REAL UAT | หมายเหตุ |
|---|---|---|---|---|---|
| UAT2-17 | แบบฟอร์มสัญญาเช่า | OWNER CONFIRMED | AUTOMATED PASS | OWNER-REPORTED | |
| UAT2-18 | ข้อกำหนดเพิ่มเติม | OWNER CONFIRMED | AUTOMATED PASS | OWNER-REPORTED | |
| DEF-R5-01 | stage SUBMITTED ใน list | OWNER CONFIRMED | AUTOMATED PASS | OWNER-REPORTED | |
| DEF-P5-01 | ปุ่มตรวจปิดตาม `jobs:edit` | — | AUTOMATED PASS | OWNER-REPORTED | Owner ไม่ได้ระบุชื่อใน confirmation จึงไม่ติดป้าย OWNER CONFIRMED |
| DEF-P5-02 | ผู้อนุมัติเห็นข้อความเต็ม | OWNER CONFIRMED | AUTOMATED PASS | OWNER-REPORTED | |
| NUM-01 | ช่องตัวเลข: ว่าง → placeholder 0, ไม่มีศูนย์นำหน้า | — | AUTOMATED PASS (unit + flow20) | NOT VERIFIED | ใหม่ในรอบนี้ (02) |
| DES-01 | Users ค้นหา + กรองกลุ่ม | — | AUTOMATED PASS (unit + flow21) | NOT VERIFIED | ใหม่ (03 ส่วน D) |
| DES-02 | Calendar ชื่อหน้าตรงเมนู | — | AUTOMATED PASS (flow21) | NOT VERIFIED | ใหม่ |
| DES-03 | Finance ปุ่มประวัติการเงิน | — | AUTOMATED PASS (flow21) | NOT VERIFIED | ใหม่ |
| DES-P | 13 หน้าที่ไม่มี design | — | — | — | PROPOSED DESIGN (04) |

ผล AUTOMATED ของรอบนี้ (ตัวเลข PASS/FAIL/SKIP) อยู่ใน `06_AUTOMATED_REGRESSION_REPORT.md`
