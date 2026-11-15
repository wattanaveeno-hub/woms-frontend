# WOMS — Release Readiness Report (UAT Round 2 · สิ้นสุด Phase 5 · 14 พ.ย. 2569)

## คำตอบสั้น
**NOT READY FOR UAT REVIEW** — โค้ดและการทดสอบอัตโนมัติผ่านครบ แต่ Gate A ต้องการการทดสอบบน UAT จริงด้วยบัญชี Tech/Sales/Manager และการยืนยันจากลูกค้า ซึ่งยังไม่ได้ทำ และ Gate B ยังไม่มี design reference ครบ

## Sandbox PASS vs Real UAT
| รายการ | Sandbox (fixture · fakeMongo · ไม่ใช้รหัสผ่านจริง) | Real UAT (Atlas `woms`) |
|---|---|---|
| DEF-R5-01 stage SUBMITTED ใน list + แท็บ/ปุ่ม “ตรวจปิด” | **PASS** (flow18 46/46, unit 7/7) | **BLOCKED** — ต้อง session tech (UAT-P5-T03..T09, A01..A04) |
| DEF-P5-01 ปุ่ม “ตรวจปิด” ตามสิทธิ์ `jobs:edit` | **PASS** | admin: หน้า /jobs หลัง sync ปกติ · tech/sales **BLOCKED** |
| DEF-P5-02 ผู้อนุมัติเห็นข้อความข้อกำหนด | **PASS** (unit + flow19) | ยืนยันว่ามีปัญหาบน UAT (CR เดิม changes ว่าง) · การแก้ **BLOCKED** รอ manager (UAT-P5-A05, M01) |
| UAT2-18 ข้อกำหนดเพิ่มเติม (สร้าง/ตรวจ/แสดง/พิมพ์) | **PASS** | admin **PASS** (Phase 4) |
| UAT2-18 อนุมัติ/ audit / PDF หลังอนุมัติ | **PASS** | **BLOCKED** (manager) |
| Customer Summary API / Customers / Queue | **PASS** | admin **PASS** · sales **BLOCKED** |
| UAT2-04 login ด้วยเบอร์ | **PASS** (fixture) | **BLOCKED** (tech) |
| UAT 23 รายการเดิม | — | PASS 12 · BLOCKED 10 · NOT RE-RUN 1 · FAIL 0 |
| แจ้งเตือนในระบบ | PASS | PASS (admin) |
| Web Push / LINE / Email | — | NOT CONFIGURED / UNSUPPORTED / UNSUPPORTED |
| Customer acceptance UAT2-17, UAT2-18 | — | **BLOCKED** (ลูกค้า) |

## Quality gates
| Gate | ผล | เหตุผล |
|---|---|---|
| A — Functional UAT | **FAIL** | บทบาท Tech/Sales/Manager ยังไม่ได้ทดสอบบน UAT จริง · DEF-R5-01/DEF-P5-01/DEF-P5-02 ยืนยันบน UAT ไม่ครบ · ลูกค้ายังไม่ยืนยัน UAT2-17/18 · แจ้งเตือนภายนอกไม่ได้ตั้งค่า |
| B — Design Verification | **FAIL** | 13/13 หน้าที่มี design ผ่าน (มีข้อยกเว้นบันทึกไว้) · 44 หน้าไม่มี reference |
| Automated regression | **PASS** | BE 2,361/242 · FE 342/0 · tsc/build · E2E 353/0 |

## Defects
| ID | Severity | สถานะ |
|---|---|---|
| DEF-R5-01 | Medium | FIXED · sandbox PASS · real UAT BLOCKED → ยังไม่ปิด |
| DEF-P5-01 | Medium | FIXED · sandbox PASS · real UAT (tech/sales) BLOCKED |
| DEF-P5-02 | High | FIXED · sandbox PASS · พบจริงบน UAT · ยืนยันการแก้บน UAT BLOCKED |
| OBS-R4-01, OBS-P4-01 | Info | RESOLVED (สภาพแวดล้อม/เทสต์) |
| BLK-P4-01 | Process | OPEN — ต้องมีคน login บัญชี QA-R2 |
Critical 0 · High ที่เปิดอยู่บน UAT 1 (DEF-P5-02 รอยืนยัน)

## สิ่งที่ต้องให้มนุษย์ทำ (ที่เหลือทั้งหมด)
1. ทดสอบตาม `02_REAL_UAT_TEST_PLAN.md` ด้วยบัญชี QA-R2 (Tech → Admin → Sales → Manager) ประมาณ 45–60 นาที — รวมยกเลิก CR-20261114-9F79E1 แล้วขอใหม่ (A05) และ manager อนุมัติ (M01)
2. ลูกค้ายืนยัน UAT2-17 และ UAT2-18 จาก PDF ตัวอย่าง
3. ตัดสินใจ OD-P4-01..06 (เลขข้อ, ต่อสัญญา, หน้า 1 มีที่ว่าง, PDF เซิร์ฟเวอร์, amendment, ช่องทางแจ้งเตือน)
4. Owner รัน `npm test` ของ backend บน Windows
5. อนุมัติ cleanup ข้อมูล QA-R2 (ถ้าต้องการ) และอนุมัติ commit/push แยกต่างหาก
6. จัดหา design reference ของ 44 หน้า (หรือยอมรับขอบเขต Gate B)

ไม่ได้ commit / push / merge / deploy / cleanup · ไม่แตะ Production
