# 10 — UAT Round 2 Summary

| ID | สถานะ |
|---|---|
| UAT2-01 ปฏิทินช่าง | IMPLEMENTED · PASS (sandbox) |
| UAT2-02 นำเข้ารุ่นเครื่อง | IMPLEMENTED · PASS |
| UAT2-03 Package PM | OUT OF SCOPE |
| UAT2-04 Login เบอร์โทร | IMPLEMENTED · PASS |
| UAT2-05 เซลล์ผูกผู้ใช้ | IMPLEMENTED · PASS (unit) |
| UAT2-06 ทีมของ Sales ในหน้าผู้ใช้ | IMPLEMENTED · PASS |
| UAT2-07 ดาวน์โหลดรูปแชท | IMPLEMENTED · PASS |
| UAT2-08 รูปหน้างานตอนเปิดคิว | IMPLEMENTED · PASS |
| UAT2-09 เครื่องว่างในคลังเท่านั้น | IMPLEMENTED · PASS (งานติดตั้ง/ยังไม่เลือกประเภท; งานซ่อม/บริการยังเห็นเครื่องที่ลูกค้าใช้อยู่ — ต้องยืนยัน) |
| UAT2-10 แยกเครื่องที่เลือกแล้ว | IMPLEMENTED · PASS |
| UAT2-11 ค้นแชทครบ | IMPLEMENTED · PASS (เพิ่มชื่อผู้ส่ง) |
| UAT2-12 Icon ประจำผู้ใช้ | IMPLEMENTED · NOT VERIFIED (ไม่มีภาพยืนยัน) |
| UAT2-13 JN ในใบคิว | IMPLEMENTED · PASS |
| UAT2-14 แจ้งเลื่อนงาน | IMPLEMENTED · PASS · ส่วน status แยกในฐานข้อมูล = BLOCKED FOR BUSINESS DECISION (ตอนนี้แยกด้วยป้าย ไม่เพิ่ม enum) |
| UAT2-15 เก็บรูปหน้างาน | IMPLEMENTED · PASS |
| UAT2-16 รับเครื่องเข้าคลัง | OUT OF SCOPE |
| UAT2-17 สัญญาเช่า | IMPLEMENTED · รอลูกค้ายืนยันด้วยตา |

## คำถามที่ต้องตัดสินใจ
1. UAT2-09: งานซ่อม/PM/บริการ ให้แสดงเฉพาะเครื่องว่างในคลังด้วยหรือไม่ (ตอนนี้แสดงทุกเครื่อง เพราะเครื่องที่ต้องซ่อมมักอยู่ที่ลูกค้า)
2. UAT2-14: ต้องการ status ใหม่ "เลื่อนวัน" ในฐานข้อมูลหรือไม่ (กระทบรายงาน/ตัวกรอง/PM ที่อ่าน HOLD)
3. UAT2-17: สัญญาเช่ายังใช้ Cordia New เมื่อเครื่องมีฟอนต์ และใช้ Sarabun เมื่อไม่มี — ถ้าต้องการให้หน้าตาเหมือนกันทุกเครื่อง ต้องเลือกฟอนต์ที่ฝังในระบบฟอนต์เดียว
4. รูปหน้างาน: ลบรูปได้หรือไม่ / ใครลบได้ (ตอนนี้ลบไม่ได้ เก็บเป็นหลักฐาน)

## ผลรวม
**NOT READY FOR UAT REVIEW** — โค้ดและ test ใน sandbox ผ่านครบ แต่ยังไม่ได้ทดสอบกับ UAT จริง (Chrome extension เข้า localhost:3000 ไม่ได้) และยังไม่ได้สร้างบัญชีทดสอบ QA-R2 · หลัง Owner รีสตาร์ตเครื่อง local และเปิดสิทธิ์ให้ extension Claude จะรัน 07 บน UAT แล้วอัปเดตสถานะ


---
# อัปเดต 14 พ.ย. 2569 — Master Execution (แทนที่ผลรวมเดิมด้านบน)

| | จำนวน |
|---|---|
| Requirement ทั้งหมด | 17 |
| Implemented | 15 |
| Verified PASS (มีหลักฐาน) | 14 (01, 02 dry-run, 04, 05, 06, 07, 08, 09 ติดตั้ง, 10 sandbox, 11, 12, 13, 14, 15) |
| รอลูกค้ายืนยัน | 1 (17) |
| Out of scope | 2 (03, 16) |

Decision D-R2-01..04: implement แล้ว · test ใหม่ Backend 11 ข้อ · ทดสอบบน UAT แล้ว (ดู 06)

Defect: Critical 0 · High 0 · Medium 1 (DEF-R3-01 แก้แล้ว retest ผ่าน) · Low 2 (ปิด/INFO)

## Quality Gates
- Gate A — Functional UAT: **FAIL (ยังไม่ครบ)** — ทดสอบบน UAT ผ่านทุกข้อที่รัน แต่ยังไม่ได้รัน: ปิดงานครบวงจรบน UAT, นำเข้ารุ่นเครื่องจริง, เลือกเครื่องลูกค้า (ไม่มีข้อมูลใน UAT), แจ้งเตือนนอกแชท และ UAT2-17 รอลูกค้ายืนยัน
- Gate B — Design Verification: **FAIL** — ดู docs/design-implementation/10_FINAL_QA_SUMMARY.md

## Overall: **NOT READY FOR UAT REVIEW**


---
# สถานะปัจจุบัน (authoritative) — อัปเดต 14 พ.ย. 2569 Phase 2
ส่วนด้านบนเป็นประวัติ — สถานะที่ใช้อ้างอิงคือส่วนนี้ · รายละเอียด `11_PHASE2_EXECUTION_2026-11-14.md`

- Design รอบ Phase 2: ServiceQueueNew PASS · JobNew PASS · JobDetail FAIL (เหลือ checklist หลักฐานปิดงาน) · ServiceQueueDetail PASS · Dashboard PASS (สรุปย้ายไป /reports ครบ)
- UAT-REMAIN-01..04: BLOCKED — session นี้ใช้รหัสผ่านบัญชี QA-R2 ไม่ได้ (BLK-R4-01) · ไม่มีข้อมูลใหม่บน UAT
- Regression: BE 2,317/242 · FE 330/0 · tsc/build ผ่าน · sandbox E2E 117 PASS / 2 FAIL (ไม่ใช่ regression)
- Gate A: FAIL · Gate B: FAIL
- **Overall: NOT READY**


---
# สถานะปัจจุบัน (authoritative) — อัปเดต 14 พ.ย. 2569 Phase 3
ส่วน “สถานะปัจจุบัน” ของ Phase 2 ด้านบนเป็นประวัติแล้ว · รายละเอียด `12_PHASE3_STATUS_2026-11-14.md`

- Implementation: JobDetail (หลักฐานปิดงาน), Jobs, Customers (บางส่วน), CustomerDetail, Contracts, ContractDetail — เสร็จ · frontend เท่านั้น
- Functional UAT: UAT-REMAIN-01 PASS (JN-2026-0133 ปิดครบวงจร) · 02 PASS · 03 PASS · 04 PASS ในระบบ / ส่งภายนอก NOT VERIFIED · UAT2-17 รอลูกค้า · DEF-R5-01 OPEN
- Design: PASS 11 หน้า · FAIL 1 (Customers — ต้องเพิ่มข้อมูล API) · ต่างเล็กน้อย 1 (Queue) · BLOCKED 44
- Regression: BE 2,317/242 · FE 333/0 · tsc/build ผ่าน · sandbox E2E 158 PASS / 2 FAIL / 1 NOT VERIFIED = PARTIAL / KNOWN LIMITATION
- Gate A: FAIL · Gate B: FAIL
- **Overall: NOT READY**


---
# สถานะปัจจุบัน (authoritative) — อัปเดต 14 พ.ย. 2569 Phase 4
ส่วน “สถานะปัจจุบัน” ของ Phase 3 ด้านบนเป็นประวัติแล้ว · รายละเอียด `phase4/12_PHASE4_FINAL_REPORT.md`

- Implementation: DEF-R5-01 (backend stage projection) · Customer Summary API · Customers · Queue · UAT2-18 ข้อกำหนดเพิ่มเติมในสัญญา — เสร็จ · sync ลงเครื่อง Owner (sha256 ตรง)
- Functional UAT (admin): PASS ทุกข้อที่รัน · tech/sales/manager BLOCKED (BLK-P4-01: เครื่องมือถูกปฏิเสธการอ่านไฟล์บัญชี QA-R2) · DEF-R5-01 ยังไม่ปิด · UAT2-17/UAT2-18 รอลูกค้า · แจ้งเตือนภายนอก: Web Push ไม่ได้ตั้งค่า · LINE/Email ไม่มีในระบบ
- UAT 23 รายการเดิม: PASS 12 · BLOCKED 10 · NOT RE-RUN 1 · FAIL 0
- Design: 13/13 หน้าที่มี design PASS (มีข้อยกเว้น) · 44 หน้าไม่มี reference
- Regression: BE 2,350/242 · FE 342/0 · tsc/build ผ่าน · sandbox E2E flow1–17 282 PASS / 2 FAIL = PARTIAL / KNOWN LIMITATION
- Gate A: FAIL · Gate B: FAIL
- **Overall: NOT READY FOR UAT REVIEW**


---
# สถานะปัจจุบัน (authoritative) — อัปเดต 14 พ.ย. 2569 Phase 5
ส่วน Phase 4 ด้านบนเป็นประวัติแล้ว · รายละเอียด `phase5/01_PHASE5_EXECUTION_REPORT.md`, `phase5/03_RELEASE_READINESS_REPORT.md` · แผนทดสอบจริง `phase5/02_REAL_UAT_TEST_PLAN.md`

- Sandbox: PASS — BE 2,361/242 · FE 342/0 · tsc/build · E2E flow1–19 353 PASS / 0 FAIL (แก้ 2 FAIL เดิมโดยเทสต์เข้มขึ้น)
- DEF-R5-01: sandbox PASS ครบ workflow (flow18) · real UAT BLOCKED → ยังไม่ปิด
- Defect ใหม่: DEF-P5-01 (ปุ่มตรวจปิดของช่าง) · DEF-P5-02 (ผู้อนุมัติไม่เห็นข้อความข้อกำหนด — พบบน UAT จริง) · แก้แล้ว sandbox PASS
- Real UAT: admin PASS ส่วนที่รัน · tech/sales/manager BLOCKED · ลูกค้ายืนยัน UAT2-17/18 BLOCKED
- Gate A: FAIL · Gate B: FAIL
- **Overall: NOT READY FOR UAT REVIEW**

---

## Phase 6 / Master Execution (14 พ.ย. 2569) — superseding update

ส่วนนี้แทนที่สถานะเดิมเฉพาะรายการที่ระบุ รายละเอียดอยู่ใน `docs/uat-round-2/phase6/` (01–08)

- **OWNER CONFIRMED:** UAT2-17, UAT2-18, DEF-P5-02 (CLOSED), DEF-R5-01 (CLOSED)
- **Real UAT:** OWNER-REPORTED UAT EXECUTED — ยังไม่มีหลักฐานใน `Claude outputs/uat-round-2/r8/` จึงยังไม่ใช่ REAL UAT VERIFIED (รายการหลักฐานที่ขาด: `phase6/01` ส่วน 2)
- **Numeric input:** ตรวจ 36 กลุ่ม แก้ 32 กลุ่มใน 25 ไฟล์ ด้วย `NumberInput` (placeholder 0, ไม่มี 0 นำหน้า) — NUM-P6-01, OBS-P6-01 FIXED · AUTOMATED PASS
- **Design:** 65 design / 58 มี route · implement Users filter, Calendar title, Finance link · PROPOSED DESIGN 13 route (`phase6/04`) · BIZ 8 รายการ
- **Automated:**
  - BE 2,361 PASS / 0 FAIL / 242 SKIP
  - FE 348/0
  - E2E flow1–21 รันต่อเนื่อง 400/0
- **Gate A:** NOT PASSED (รอหลักฐาน) · **Gate B:** NOT PASSED · **Overall:** NOT READY FOR RELEASE (`phase6/08`)
- เปิดอยู่: DEF-P5-01 (รอหลักฐาน UAT), OBS-P6-02, OBS-P6-03, BLK-P4-01

---

## Phase 7 / ทุก requirement ยกเว้น PM (15 พ.ย. 2569) — superseding update

ส่วนนี้แทนที่สถานะ Phase 6 ด้านบน รายละเอียดอยู่ใน `docs/uat-round-2/phase7/01_PHASE7_MASTER_EXECUTION_REPORT.md`

- **UAT2-16 รับเครื่องเข้าคลัง:** เดิม OUT OF SCOPE → IMPLEMENTED + VERIFIED (sandbox) — ใบรับ `RCV-YYYY-NNNN`, API ใหม่ 3 ตัว, collection `equipment_receipts`
- **Warehouse:** สต็อกรวมแยกคอลัมน์จอง + ตารางแยกตามคลัง · หน้าอะไหล่ & สต๊อกตาม design · DEF-P7-01 (คลังช่างผูกบัญชีช่าง) FIXED
- **Design:** 14 board PROPOSED ใหม่ใน Claude Design (13 route ที่ไม่มี design + หน้ารับเครื่อง) · แก้ความต่างของหน้าที่มีอยู่ 12 หน้า
- **RBAC:** เพิ่ม gate ฝั่ง frontend ให้ `/documents`, `/group-chat/manage` · OBS-P6-02 = ตาม Matrix (CLOSED) · OBS-P6-03 = HIDE-01 → business decision
- **Automated:** BE 2,369 PASS / 0 FAIL / 242 SKIP · FE 350/0 · E2E flow1–24 487/0
- **Real UAT:** ยังไม่ได้ทดสอบ (ยังไม่ deploy) · business decision เปิด 14 รายการ
- **Overall:** NOT READY FOR RELEASE
