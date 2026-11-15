# 07 — Defect Register Update (Phase 6 / Master Execution)

วันที่: 2026-11-14 · ส่วนนี้ **แทนที่ (supersede)** สถานะใน `phase5/03_RELEASE_READINESS_REPORT.md` และ `design-implementation/09_DEFECT_REGISTER.md` เฉพาะแถวที่ระบุ ประวัติเดิมคงไว้

| ID | Severity | เรื่อง | สถานะเดิม | สถานะใหม่ | หลักฐาน |
|---|---|---|---|---|---|
| DEF-R5-01 | Medium | stage SUBMITTED ไม่แสดงใน list / แท็บ "รอตรวจปิด" | FIXED · real UAT BLOCKED | **CLOSED — OWNER CONFIRMED** · AUTOMATED PASS | flow18 (ดู 06) · ไม่มีหลักฐาน UAT ในโฟลเดอร์ r8 |
| DEF-P5-01 | Medium | tech เห็นปุ่ม "ตรวจปิด" | FIXED · real UAT (tech/sales) BLOCKED | **FIXED — AUTOMATED PASS** · real UAT: OWNER-REPORTED (ไม่มีหลักฐาน) | flow18 · Owner ไม่ได้ระบุ ID นี้ในการยืนยัน จึงยังไม่ปิดเป็น OWNER CONFIRMED |
| DEF-P5-02 | High | ผู้อนุมัติไม่เห็นข้อความข้อกำหนดในคำขอแก้ไข | FIXED · ยืนยันบน UAT BLOCKED | **CLOSED — OWNER CONFIRMED** · AUTOMATED PASS | flow19 + `p5_contractApproval` · คำขอเดิม CR-20261114-9F79E1 ยังมี `changes: []` (ข้อมูลก่อนแก้ ไม่ได้แก้ย้อนหลัง) |
| NUM-P6-01 | Medium | ช่องตัวเลขพิมพ์ต่อจาก "0" ได้ "050000" (ช่องรายรับ/ค่าใช้จ่ายใบงาน และช่องอื่นที่ใช้ `type=number` + ค่าเริ่มต้น 0) | ใหม่ (Owner รายงาน) | **FIXED — AUTOMATED PASS** · real UAT NOT VERIFIED | ภาพก่อน `050000` / หลัง `50000` · unit + flow20 |
| OBS-P6-01 | Low | placeholder "0" ถูก MUI ซ่อนเมื่อช่องว่างและยังไม่โฟกัส | ใหม่ (พบระหว่างตรวจภาพ) | **FIXED — AUTOMATED PASS** | assertion ใหม่ใน flow20: FAIL บน build ก่อนแก้ → PASS หลังแก้ |
| BLK-P4-01 | Process | ไม่มีสิทธิ์อ่านไฟล์บัญชี QA-R2 / ไม่มี session บัญชี QA-R2 | OPEN | **OPEN** | ไม่ได้พยายามอ่านไฟล์ซ้ำ · Chrome ที่เชื่อมอยู่เป็นบัญชีที่ไม่ใช่ QA-R2 จึงหยุดใช้ |
| OBS-P6-02 | Info | บนสภาพแวดล้อมทดสอบ admin เปิด `/users` ไม่ได้ (API 403, หน้าแสดง "ไม่มีสิทธิ์") ส่วน manager/ceo เปิดได้ | ใหม่ (สังเกต) | **OPEN — ต้องยืนยันว่าเป็นสิทธิ์ที่ตั้งใจ** | flow21 · พฤติกรรมเดิม ไม่ได้เปลี่ยน RBAC |
| OBS-P6-03 | Info | manager เปิด `/chats`, `/queue/new`, `/queue/slots` แล้วไม่มีหัวหน้า (หน้าว่างหรือ gate) | ใหม่ (สังเกต) | **OPEN — BIZ** | `extract_app.py` (manager) |

สรุปหลังรอบนี้: Critical 0 · High ที่ยังเปิด 0 · Medium ที่ยังเปิด 0 (DEF-P5-01 รอหลักฐาน UAT จริงเท่านั้น) · Process blocker 1 (BLK-P4-01)
