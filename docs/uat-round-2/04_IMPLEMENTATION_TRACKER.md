# 04 — Implementation Tracker

| ID | สถานะ Implementation | หลักฐานการทดสอบ | ผล |
|---|---|---|---|
| UAT2-01 ปฏิทินช่าง | IMPLEMENTED | unit 3 ข้อ · sandbox flow8 · UAT: `GET /api/calendar` ด้วยบัญชี QA-R2 tech = 200 | PASS (sandbox UI) · PASS (UAT API) · UAT UI NOT TESTED |
| UAT2-02 Import รุ่นเครื่อง | IMPLEMENTED | unit 4 ข้อ · UAT: dry-run API ตอบ validation · UI มีปุ่ม (sandbox) | PASS (dry-run) · การนำเข้าจริงบน UAT ไม่ได้ทำ (เลี่ยงเพิ่ม master data) = NOT TESTED |
| UAT2-03 | OUT OF SCOPE | — | — |
| UAT2-04 Login เบอร์ | IMPLEMENTED | unit 4 · UAT: login เบอร์+รหัส 200 · รหัสผิด 401 · ตั้งเบอร์ซ้ำ 409 · หน้าผู้ใช้แสดงเบอร์ | PASS |
| UAT2-05 เซลล์ผูกผู้ใช้ | IMPLEMENTED | UAT: `/api/meta/options` salespeople มี "QA-R2 sales" | PASS |
| UAT2-06 ทีมเซลล์ | IMPLEMENTED | UAT: สร้างทีม QA-R2 → หน้าผู้ใช้แสดง "ทีมเซลล์: QA-R2 ทีมทดสอบ" + ปุ่มกำหนดทีม | PASS |
| UAT2-07 ดาวน์โหลดรูปแชท | IMPLEMENTED | UAT: ส่งรูปในกลุ่มทีม QA → `GET /api/group-chat/files/:id` คืนไฟล์เดิมตรงทุก byte · ช่างที่ไม่ใช่สมาชิก 403 · หน้าแชทมีปุ่มดาวน์โหลด 1 ปุ่ม · sandbox: ไฟล์ดาวน์โหลดชื่อถูก | PASS (ไม่ได้กดดาวน์โหลดลงเครื่อง Owner) |
| UAT2-08 รูปตอนเปิดคิว | IMPLEMENTED | sandbox flow6 (UI) · UAT API แนบ 2 รูป · ไฟล์ไม่ใช่รูป 400 | PASS |
| UAT2-09 / D-R2-01 | IMPLEMENTED | unit 4+3 · UAT: picker availableOnly คืนเฉพาะ IN_STOCK | PASS (ติดตั้ง) · กรณีเครื่องเช่าอยู่/ซ่อมเครื่องของลูกค้า บน UAT: NOT TESTED (UAT มีเครื่องในระบบ 2 เครื่อง สถานะในคลังทั้งคู่ — ไม่แก้ข้อมูลเครื่องเพื่อทดสอบ) · ครอบคลุมด้วย unit |
| UAT2-10 แยกเครื่องที่เลือก | IMPLEMENTED | sandbox flow6 | PASS (sandbox) |
| UAT2-11 ค้นแชท | IMPLEMENTED | unit 2 · UAT: ค้น "QA-R2 sales" พบข้อความของผู้ส่งนั้น 6 รายการ | PASS |
| UAT2-12 Avatar | IMPLEMENTED | UAT UI: ตารางคิวมี avatar 14 จุด · หน้าแชทกลุ่ม 11 จุด | PASS |
| UAT2-13 JN | IMPLEMENTED | UAT: ค้น JN-2026-0132 พบคิว · ตารางคิวแสดง JN/“ยังไม่ออก JN” ทุกแถว · หน้าคิวแสดง “ยังไม่ออก JN” · sandbox: บอร์ดแสดง JN | PASS |
| UAT2-14 / D-R2-02 | IMPLEMENTED | unit 4 · UAT ดูตาราง 06 | PASS |
| UAT2-15 / D-R2-04 | IMPLEMENTED | unit 3+3 · UAT ดูตาราง 06 | PASS |
| UAT2-16 | OUT OF SCOPE | — | — |
| UAT2-17 / D-R2-03 | IMPLEMENTED | PDF 9 ชุด (2/2/4 หน้า A4 · ฟอนต์ Sarabun ฟอนต์เดียว) · UAT: เปิดสัญญาจริง data-font=bundled 2 แผ่น มีช่องลงชื่อ | PASS (ด้านเทคนิค) · **รอลูกค้ายืนยันด้วยตา** |
| UAT2-18 ข้อกำหนดเพิ่มเติมในสัญญาเช่า (Phase 4) | IMPLEMENTED | unit BE 19 + FE 9 · sandbox flow17 110/110 · PDF 5 ชุด ตรวจทุกหน้า · UAT (admin): สร้าง/ตรวจข้อมูลผิด/รายละเอียด/เอกสารพิมพ์/คำขออนุมัติ 202/admin อนุมัติเอง 403 · manager อนุมัติ BLOCKED · `phase4/06_…`, `07_…` | PASS (ด้านเทคนิค ส่วนที่รันได้) · **รอลูกค้ายืนยัน** |
| UAT2-18 (อัปเดต Phase 5) | IMPLEMENTED | + คำขออนุมัติ: unit 8 · flow19 22/22 (อนุมัติผ่าน UI · รายละเอียด/เอกสาร/PDF ใช้ชุดที่อนุมัติ · audit · RBAC) · DEF-P5-02 แก้แล้ว | PASS (sandbox) · real UAT manager BLOCKED · **รอลูกค้ายืนยัน** |

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
