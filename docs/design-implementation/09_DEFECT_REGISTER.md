# 09 — Defect Register (Design)
| ID | หน้า | อาการ | สถานะ |
|---|---|---|---|
| DEF-R3-01 | เอกสารสัญญาเช่า | พิมพ์แล้วมีหน้าว่างต่อท้าย (ระยะขอบ app shell จาก redesign ติดไปกระดาษ) | CLOSED — แก้ `globals.css` print · retest 2/2/4 หน้า |
| GAP-xx | 9 หน้าใน 02 | ไม่ตรง design | OPEN |

## Phase 2 (14 พ.ย. 2569)
| ID | Severity | Route | อาการ / Repro | Expected | Actual | Root cause | Fix | Retest | Regression impact |
|---|---|---|---|---|---|---|---|---|---|
| BLK-R4-01 | Blocker (test environment) | UAT ทั้งหมด | เริ่ม UAT-REMAIN-01..04 ต้อง login บัญชี QA-R2 | session ใช้บัญชีทดสอบได้ | เครื่องมือปฏิเสธการนำรหัสผ่านจากไฟล์ local เข้ามาใช้ | ข้อจำกัดสิทธิ์ของ session | ต้องให้ Owner อนุญาตไฟล์ หรือ login ให้ | — | ไม่มี (ไม่ใช่ defect ของแอป) |
| OBS-R4-01 | Info | /jobs/[id] (sandbox) | เปิดใบงาน → `photos/summary` 500 | 200 | 500 ใน sandbox เท่านั้น | fakeMongo ไม่มี aggregate (เดียวกับ DEF-R3-02) | ไม่ต้องแก้แอป | UAT จริงเคยตอบ 200 | ไม่มี |

ไม่พบ product defect ใหม่จากการแก้ 5 หน้าในรอบนี้

## Phase 3 (14 พ.ย. 2569)
| ID | Severity | Route | อาการ / Repro | Expected | Actual | Root cause | Fix | Retest | Regression impact |
|---|---|---|---|---|---|---|---|---|---|
| DEF-R5-01 | Medium (มีก่อนรอบนี้) | /jobs | ช่างส่งงาน (`#ส่งงาน`) → เปิดรายการงาน | งานอยู่แท็บ “รอตรวจปิด” + ปุ่ม “ตรวจปิด” | แท็บ = 0 · ปุ่มไม่ขึ้น · `/api/jobs` stage = IN_PROGRESS ขณะ `/stage` = SUBMITTED | list ใช้ stage ที่เก็บ (ACKNOWLEDGED/IN_PROGRESS) ไม่ได้รวม submission ที่ PENDING | ยังไม่แก้ — ต้องแก้ backend list (รออนุมัติ) | sandbox flow14 NOT VERIFIED | แท็บ/ปุ่มรอตรวจปิดเท่านั้น |
| OBS-R5-01 | Info | UAT data | ทดสอบเครื่องลูกค้าอื่นด้วยเครื่องคลัง SN-1000 → สร้างคิว Q-2026-0090 | (ความเข้าใจของผู้ทดสอบ) ถูกปฏิเสธ | 201 — กติกา D-R2-01 ปฏิเสธเฉพาะเครื่องที่ผูกลูกค้ารายอื่น | ออกแบบ test ผิด ไม่ใช่ defect ของแอป | ใช้ลูกค้าที่สอง + QA-R2-EXT-0002 แทน → 409 ถูกต้อง | SN-1000 ไม่เปลี่ยน | อยู่ในรายการ cleanup |


## Phase 4 (14 พ.ย. 2569) — authoritative
| ID | Severity | สรุป | สถานะ |
|---|---|---|---|
| DEF-R5-01 | Medium | Job list ไม่มี stage SUBMITTED | FIXED ใน code (unit 7/7 · flow14 14/14) · ยืนยันบน UAT ยัง BLOCKED → ยังไม่ปิด |
| BLK-P4-01 | Blocker (process) | เครื่องมือถูกปฏิเสธการอ่านไฟล์บัญชี QA-R2 → ทดสอบ tech/sales/manager ไม่ได้ | OPEN |
| OBS-P4-01 | Info | flow14 ค้นหา 1 แถว FAIL เมื่อรันต่อจาก flow อื่น · ข้อมูลใหม่ PASS | KNOWN LIMITATION |
| OBS-P4-02 | Info | ตัวเลข E2E ในแชท “321/2” ผิด · ค่าจริง 282/2 | แก้แล้วในรายงาน |
| OBS-P4-03 | Info | vitest backend รันจาก Linux VM บนเครื่อง Owner ไม่ได้ | ให้ Owner รันบน Windows |


## Phase 5 (14 พ.ย. 2569) — authoritative
| ID | Severity | สรุป | สถานะ |
|---|---|---|---|
| DEF-R5-01 | Medium | Job list ไม่มี stage SUBMITTED | FIXED · sandbox PASS ครบ workflow (flow18) · real UAT BLOCKED → ยังไม่ปิด |
| DEF-P5-01 | Medium | ช่างเห็นปุ่ม “ตรวจปิด” (หน้าเว็บใช้ jobs:close แต่ backend ตรวจ jobs:edit) | FIXED `src/app/jobs/page.tsx` · sandbox PASS · real UAT BLOCKED |
| DEF-P5-02 | High | หน้าคำขออนุมัติไม่แสดงข้อความข้อกำหนดที่ขอเปลี่ยน (array → “[N รายการ]” / สลับลำดับไม่ขึ้นเลย) · พบจริงบน UAT (CR-20261114-9F79E1 changes ว่าง) | FIXED (hook describeChanges + หน้า /approvals หลายบรรทัด) · sandbox PASS · ยืนยันบน UAT BLOCKED |
| OBS-R4-01 | Info | sandbox photos/summary 500 | RESOLVED — fakeMongo aggregate (stage ที่ไม่รองรับ throw) |
| OBS-P4-01 | Info | flow14 ค้นหา FAIL เมื่อรันต่อเนื่อง | RESOLVED — fixture เลือกงานที่อยู่ในแท็บจริง + ตรวจว่าแถวเป็นงานที่ค้น |

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
