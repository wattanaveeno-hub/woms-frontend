# 10 — Final QA Summary (Design Implementation)

- หน้าที่อยู่ในขอบเขต: 57 (ไม่รวมคลังเครื่อง/PM/ภาพก่อนแก้)
- มีภาพ design ให้เทียบ: 13 · BLOCKED: 44 (ดึงไฟล์ artboard ไม่ได้ครบ)
- ตรง design: 2 · ต่างเล็กน้อย: 1 · ต่างมาก: 9 · ยังไม่ยืนยัน: 1

**Gate B — Design Verification: FAIL**

เหตุผล: inventory ไม่ครบทุกหน้า · หน้าหลัก 9 หน้ายังต่างจาก design อย่างมีนัยสำคัญ (ดู 02) · ไม่มีภาพเทียบสำหรับ 44 หน้า

สิ่งที่ต้องทำต่อ (เรียงตามผลต่อการใช้งาน):
1. ServiceQueueNew, JobNew, JobDetail (flow หลัก — เสี่ยงสูง ต้องทดสอบ regression เต็ม)
2. Jobs, Contracts, ContractDetail, Customers, CustomerDetail
3. Main (/dashboard) — ต้องตัดสินใจเรื่องส่วนสรุปที่ design ไม่มี
4. ดึงไฟล์ design อีก 44 หน้า (ต้องอนุญาตการคัดลอกไฟล์ หรือ export ภาพจาก canvas) แล้ววิเคราะห์ต่อ


---
# สถานะปัจจุบัน (authoritative) — อัปเดต 14 พ.ย. 2569 Phase 2
ส่วนด้านบนเป็นประวัติ · รายละเอียด `11_PHASE2_DESIGN_2026-11-14.md`

| กลุ่ม | จำนวน |
|---|---|
| มีไฟล์ design ให้เทียบ | 13 |
| DESIGN PASS | 6 — ContractNew, CustomerNew, ServiceQueueNew, JobNew, ServiceQueueDetail, Main |
| ต่างเล็กน้อย | 1 — Queue |
| DESIGN FAIL | 6 — JobDetail (เหลือ 1 จุดหลัก), Jobs, Customers, CustomerDetail, Contracts, ContractDetail |
| BLOCKED (ไม่มีไฟล์ design) | 44 |

**Gate B — Design Verification: FAIL**
ต้องการจาก Owner: export ภาพหรือไฟล์ `.dc.html` ของ 44 หน้าที่เหลือ (การคัดลอกไฟล์จาก Artifact ถูกปฏิเสธในรอบก่อน)


---
# สถานะปัจจุบัน (authoritative) — อัปเดต 14 พ.ย. 2569 Phase 3
ตารางของ Phase 2 ด้านบนเป็นประวัติ · รายละเอียด `12_PHASE3_DESIGN_2026-11-14.md`

| กลุ่ม | จำนวน |
|---|---|
| มีไฟล์ design ให้เทียบ | 13 |
| DESIGN PASS (มีภาพเทียบ + ข้อยกเว้นที่บันทึกไว้) | 11 — ContractNew, CustomerNew, ServiceQueueNew, JobNew, ServiceQueueDetail, Main, JobDetail, Jobs, CustomerDetail, Contracts, ContractDetail |
| ต่างเล็กน้อย | 1 — Queue |
| DESIGN FAIL | 1 — Customers (ข้อมูล ผู้ติดต่อหลัก/รุ่นเครื่อง/ค้างงวด/งานล่าสุด/เซลล์ ไม่มีใน API) |
| BLOCKED (ไม่มีไฟล์ design) | 44 — ขอ export จาก Owner แล้ว |

**Gate B — Design Verification: FAIL** · ไม่อ้างว่า design ครบจนกว่าจะได้ไฟล์ 44 หน้า


---
## Phase 4 (14 พ.ย. 2569) — authoritative
- Customers: **DESIGN PASS (มีข้อยกเว้น)** — คอลัมน์ ติดต่อ/เครื่อง/สัญญา/งานล่าสุด/เซลล์ จาก Customer Summary API ใหม่ (`r6/design/Customers.compare.png`)
- Queue: **DESIGN PASS (มีข้อยกเว้น)** — แถวตัวกรองเดียว · ปุ่มขั้นถัดไปบนการ์ด (`r6/design/Queue.compare.png`, `Queue.mobile390.png`)
- 13/13 หน้าที่มี design PASS · 44 หน้าไม่มี reference → Gate B FAIL
- รายละเอียด `docs/uat-round-2/phase4/04_CUSTOMERS_DESIGN.md`, `05_QUEUE_DESIGN.md`, `12_PHASE4_FINAL_REPORT.md`

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
