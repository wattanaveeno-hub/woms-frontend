# 09 — Defect Register

| ID | ระดับ | Requirement | อาการ (ขั้นตอน) | คาดหวัง | จริง | สาเหตุ | แก้ | Retest | สถานะ |
|---|---|---|---|---|---|---|---|---|---|
| DEF-R3-01 | Medium | UAT2-17 / D-R2-03 | เปิดสัญญาเช่า → พิมพ์ต้นฉบับ | 2 หน้า A4 | 3 หน้า (หน้าสุดท้ายว่าง) · ทั้งสองฉบับ 5 หน้า | redesign app shell (`.app-shell .app-content` padding 16/32/64px) ติดไปตอนพิมพ์ — ความจำเพาะของ selector ชนะ `.shell {padding:0}` ใน `@media print` | `globals.css` print: `.app-shell .app-content { padding: 0 !important }` | PDF 9 ชุด: 2/2/4 หน้า | CLOSED |
| DEF-R3-02 | Low (สภาพแวดล้อมทดสอบ) | Regression ปิดงาน | sandbox `GET /api/jobs/:id/photos/summary` | 200 | 500 | `TypeError: c.aggregate is not a function` ที่ `jobPhotoRepo.photoCountsByLine` — fakeMongo ไม่มี `aggregate` | ไม่ต้องแก้แอป | UAT MongoDB จริง 200 `{"lines":{},"site":0}` | CLOSED — Test fixture limitation (ไม่ใช่ defect ของระบบ / ไม่ใช่ regression) |
| DEF-R3-03 | Low | Design | หน้า "/" | — | redirect ไป /jobs ส่วน Dashboard อยู่ที่ /dashboard | เป็นพฤติกรรมเดิม (เมนูหน้าหลักชี้ /dashboard) | ไม่แก้ | — | INFO |

ไม่มี defect Critical/High ค้าง

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
