# P4-09 UAT regression บน UAT จริง (localhost:3000 → localhost:8000 → Atlas `woms`)

## วิธียืนยันตัวตน และข้อจำกัด (BLK-P4-01)
- ใช้ session QA-R2 admin ที่ Owner login ไว้ (ยืนยัน `/api/auth/me` = “QA-R2 admin” role admin ก่อนทดสอบ)
- คำสั่ง “AUTONOMOUS QA-R2 UAT EXECUTION” อนุญาตให้อ่าน `qa-r2-accounts.local.json` — ลองอ่าน 1 ครั้ง (พิมพ์เฉพาะโครงสร้าง ไม่พิมพ์รหัสผ่าน) **ถูกปฏิเสธโดยระบบตรวจสิทธิ์ของเครื่องมือ (classifier: Unauthorized Access)** · ไม่ได้ลองวิธีอื่นเพื่อเลี่ยง
- ผล: บทบาท tech / sales / manager ทดสอบอัตโนมัติไม่ได้ในรอบนี้ → **BLOCKED** จนกว่า Owner จะ login บทบาทนั้นในเบราว์เซอร์ หรือเปิดสิทธิ์ให้เครื่องมือ

## UAT 23 รายการเดิม (Master Execution · `06_API_DB_TEST_RESULTS.md`)
รันซ้ำแบบอ่านสถานะที่บันทึกไว้ + ตรวจเชิงลบที่ไม่เขียนข้อมูล (ไม่สร้างข้อมูลซ้ำ)

| # | รายการ | บทบาท | ผล Phase 4 | หลักฐาน |
|---|---|---|---|---|
| 1 | Login บัญชี QA | admin | PASS (admin) · manager/sales/tech BLOCKED | `/api/auth/me` |
| 2 | UAT2-04 login เบอร์ | tech | BLOCKED | — |
| 3 | เบอร์ซ้ำ 409 | manager | BLOCKED | — |
| 4 | UAT2-05 salespeople มี “QA-R2 sales” | admin | PASS | `/api/meta/options` 200 |
| 5 | UAT2-06 ทีม QA-R2 มีเซลล์ | admin | PASS (memberIds มี QA-R2 sales) | `/api/group-chat/teams` 200 |
| 6 | picker availableOnly เฉพาะ IN_STOCK | admin | PASS (3 เครื่อง IN_STOCK ทั้งหมด) | `/api/equipment/picker?availableOnly=1` 200 |
| 7 | Q-2026-0088 ติดตั้ง WAIT_ASSIGN | admin | PASS | `/api/service-queue?q=` 200 |
| 8 | รูปที่เหลือหลังลบ = 1 | admin | PASS | `/site-photos` 200 |
| 9 | ส่งร่างแล้วเป็น WAIT_ASSIGN | admin | PASS (สถานะคงอยู่) | — |
| 10 | ลบรูปหลังส่ง: sales/tech 403 | sales/tech | BLOCKED | — |
| 11 | audit ลบรูป | manager | BLOCKED (admin ได้ 403 — `audit:view` ไม่ใช่สิทธิ์ admin) | — |
| 12 | คิวซ่อม → JN-2026-0132 | admin | PASS (สถานะคงอยู่) | — |
| 13 | ปฏิทินช่าง | tech | BLOCKED | — |
| 14 | ค้น JN-2026-0132 → Q-2026-0089 RESCHEDULE | admin | PASS | `/api/service-queue?q=JN-2026-0132` |
| 15 | แจ้งเลื่อน: sales/tech 403 | sales/tech | BLOCKED | — |
| 16 | JN-2026-0132 HOLD · holdReason · holdBy · appointmentHistory 1 | admin | PASS | `/api/jobs/JN-2026-0132` 200 |
| 17 | replay requestId | admin | NOT RE-RUN (การรันซ้ำจะเขียนข้อมูล) | ผลเดิม PASS |
| 18 | audit jobs | manager | BLOCKED (admin 403) | — |
| 19 | การ์ดเลื่อนงานในแชท | sales | BLOCKED | — |
| 20 | ค้นแชท | sales | BLOCKED | — |
| 21 | ไฟล์แชท + ช่างนอกกลุ่ม 403 | sales/tech | BLOCKED | — |
| 22 | photos/summary บน MongoDB จริง 200 | admin | PASS `{"lines":{},"site":0}` | — |
| 23 | UI บน UAT | admin | PASS (หน้า /service-queue, /customers, /contracts/:id, เอกสารสัญญา แสดงถูก) | `r6/uat/*.jpg` |

สรุป 23 รายการ: PASS 12 · BLOCKED 10 · NOT RE-RUN 1 · FAIL 0

## Phase 4 บน UAT
| ID | บทบาท | Expected | Actual | ผล | หลักฐาน |
|---|---|---|---|---|---|
| P4-UAT-01 DEF-R5-01 stage ใน list | admin | ตรงกับสถานะใบงาน | JN-2026-0133 CONFIRMED · 0132 OPEN (HOLD) | PASS (อ่าน) | — |
| P4-UAT-02 DEF-R5-01 ช่างส่งงาน → รอตรวจปิด | tech→admin | แท็บนับรวม · ปุ่มตรวจปิด | — | **BLOCKED** | Q-2026-0092 รอ tech |
| P4-UAT-03 customer summary extras | admin | ฟิลด์ใหม่ครบ | ครบ | PASS | `03_…` |
| P4-UAT-04 หน้า Customers | admin | ตาม design | ตาม design | PASS | `p4-customers-admin.jpg` |
| P4-UAT-05 หน้า Queue | admin | ตัวกรองแถวเดียว + ปุ่มขั้นถัดไป | ตามคาด | PASS | `p4-queue-board-admin.jpg` |
| P4-UAT-06 สร้างสัญญาร่าง + ข้อกำหนด | admin | 201 | 201 CT-2026-0003 | PASS | — |
| P4-UAT-07 ตรวจข้อมูลผิด | admin | 400 ×3 | 400 ×3 | PASS | — |
| P4-UAT-08 รายละเอียดสัญญา | admin | หัวข้อ + เลข 6–8 + หลายบรรทัด + ปุ่มแก้ (ร่าง) | ตามคาด | PASS | `uat2-18-contract-detail-admin.jpg` |
| P4-UAT-09 เอกสารพิมพ์ | admin | ข้อกำหนดก่อนลายเซ็น ไม่ทับ | ตามคาด | PASS | `uat2-18-document-sheets.jpg` |
| P4-UAT-10 Admin แก้ → คำขออนุมัติ | admin | 202 ข้อมูลไม่เปลี่ยน | 202 CR-20261114-9F79E1 | PASS | — |
| P4-UAT-11 Admin อนุมัติเอง | admin | 403 | 403 · CR PENDING | PASS | — |
| P4-UAT-12 Manager อนุมัติ CR → ข้อกำหนดใหม่ + history + audit + เอกสาร | manager | ใช้ชุดที่ขอ | — | **BLOCKED** | — |
| P4-UAT-13 แจ้งเตือนในระบบ (admin) | admin | list/unread 200 | 6 รายการ · unread 2 | PASS | — |
| P4-UAT-14 สถานะตัวส่งแจ้งเตือน (users:manage) | admin | 403 | 403 | PASS | — |
| P4-UAT-15 บทบาท sales / manager / tech | — | — | — | **BLOCKED** | BLK-P4-01 |
