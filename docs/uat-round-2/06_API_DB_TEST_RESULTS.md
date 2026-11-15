# 06 — API / Database Test Results บน UAT จริง

## สภาพแวดล้อม (ตรวจก่อนเขียนข้อมูล)
- Frontend: `http://localhost:3000` (เครื่อง Owner · Next dev) → `NEXT_PUBLIC_API_BASE` ค่าเริ่มต้น `http://localhost:8000`
- Backend: `http://localhost:8000` (เครื่อง Owner · `tsx watch`) → MongoDB Atlas cluster `ac-st3mhyg…` db `woms` = ฐาน UAT (Owner ยืนยัน 12 พ.ย. 69) · ไม่ใช่ Production (ยังไม่มี Production)
- ตัวตน: เซสชัน Administrator ของ Owner ใช้เฉพาะสร้างบัญชี QA และอ่าน audit · การทดสอบทั้งหมดใช้บัญชี QA-R2
- การเข้าถึง localhost:3000 ครั้งก่อนล้มเหลว: รอบนี้ตรวจแล้วเข้าได้ปกติ · ไม่พบหลักฐานว่าเป็นสิทธิ์ของ extension — สาเหตุที่เป็นไปได้: หน้า Next dev กำลัง compile ใหม่หลังไฟล์ถูกซิงก์ (เกิดซ้ำรอบนี้: backend `tsx watch` รีสตาร์ตแล้วเซสชันหมดอายุ Owner ต้อง login ใหม่ 1 ครั้ง)

## ข้อมูลทดสอบที่สร้าง (test-owned · ขึ้นต้น QA-R2)
| ชนิด | ค่า |
|---|---|
| ผู้ใช้ | qa-r2-admin / qa-r2-manager / qa-r2-sales / qa-r2-tech @qa-r2.local (tech เบอร์ 0990260101) — รหัสผ่านสุ่ม เก็บใน `Claude outputs/uat-round-2/qa-r2-accounts.local.json` (ไม่อยู่ใน git) |
| ทีมเซลล์ | QA-R2 ทีมทดสอบ (กลุ่มแชท TEAM-6af7e6651e68681ceed2fcc7) |
| ลูกค้า | QA-R2 ร้านทดสอบ (รหัส 99260101) + สาขา 00 |
| คิว | Q-2026-0088 (ติดตั้ง · อ้างเครื่องในคลัง 1 เครื่อง · WAIT_ASSIGN) · Q-2026-0089 (ซ่อม · โหมด RESCHEDULE · WAIT_ASSIGN) |
| ใบงาน | JN-2026-0132 (HOLD — รอเช็คคิวใหม่) |
| แชท | 2 ข้อความในกลุ่มทีม QA (1 ข้อความมีรูป) |
| รูปหน้างาน | 3 รูปใน Q-2026-0088 (ลบแบบมีร่องรอย 2 รูป) |

ไม่ได้แก้ข้อมูลลูกค้า/เครื่อง/ใบงานเดิม · ไม่ได้รันคำสั่งลบหรือ migration

Cleanup ที่แนะนำ (รอ Owner ตัดสินใจ — ยังไม่ทำ เพื่อให้ตรวจย้อนได้): ยกเลิก Q-2026-0088 / Q-2026-0089 และ JN-2026-0132 · ปิดใช้งานผู้ใช้ QA-R2 4 บัญชี · ปิดทีม QA-R2 · ลูกค้า QA-R2 คงไว้หรือปิดใช้งาน

## ผล (14 พ.ย. 2569 ~04:35–04:47 UTC)
| # | Test | Request → Response | ผล |
|---|---|---|---|
| 1 | Login QA 4 บัญชี + เปลี่ยนรหัสครั้งแรก | 200 / mustChangePassword → change-password 200 | PASS |
| 2 | UAT2-04 login เบอร์ | `POST /api/auth/login {email:"0990260101"}` 200 (user = qa-r2-tech) · รหัสผิด 401 "เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง" | PASS |
| 3 | UAT2-04 เบอร์ซ้ำ | `PATCH /api/users/<sales> {phone:"099-026-0101"}` 409 field `phone` | PASS |
| 4 | UAT2-05 | `GET /api/meta/options` → salespeople มี "QA-R2 sales" | PASS |
| 5 | UAT2-06 | `POST /api/group-chat/teams` 201 · memberIds มี sales · หน้า /users แสดงทีม | PASS |
| 6 | D-R2-01 picker | `GET /api/equipment/picker?availableOnly=1` total 2 สถานะ IN_STOCK ทั้งหมด · ไม่มีรุ่น count 0 | PASS |
| 7 | UAT2-08 | ร่างคิวติดตั้ง 201 · แนบ 2 รูป 201 · ไฟล์ PDF 400 | PASS |
| 8 | D-R2-04 ก่อนส่ง | เจ้าของร่างลบ 200 · รายการเหลือ 1 รูป | PASS |
| 9 | ส่งร่าง | `POST /:id/submit` 200 → Q-2026-0088 WAIT_ASSIGN | PASS |
| 10 | D-R2-04 หลังส่ง | เซลล์ 403 · ช่าง 403 · Admin ไม่ใส่เหตุผล 400 (รูปยังเปิดได้ 200) · Admin ใส่เหตุผล 200 | PASS |
| 11 | D-R2-04 audit | `GET /api/audit` พบ 2 แถว DELETE: ผู้ลบ เวลา ชื่อไฟล์+photoId คิว ก่อน/หลังส่ง เหตุผล | PASS |
| 12 | คิวซ่อม → JN | create 201 → assign → propose (ช่าง QA) → accept → confirm (เซลล์) → release = RELEASED · JN-2026-0132 | PASS |
| 13 | UAT2-01 API | `GET /api/calendar?technicianId=…` (ช่าง) 200 | PASS |
| 14 | UAT2-13 | `GET /api/service-queue?q=JN-2026-0132` → Q-2026-0089 | PASS |
| 15 | D-R2-02 สิทธิ์ | เซลล์ 403 · ช่าง 403 · ไม่ใส่เหตุผล 400 | PASS |
| 16 | D-R2-02 แจ้งเลื่อน | 201 → คิว WAIT_ASSIGN mode RESCHEDULE (กลับไปเลือกช่าง) · ใบงาน OPEN→HOLD · holdReason "รอเช็คคิวใหม่: …" · holdBy QA-R2 admin · appointmentHistory +1 · ข้อมูลใบงานเดิมยังอยู่ | PASS |
| 17 | D-R2-02 replay | ส่ง requestId เดิมซ้ำ 200 · audit มี 1 แถว | PASS |
| 18 | D-R2-02 audit | แถว audit entity jobs JN-2026-0132: actor QA-R2 admin · เวลา · status OPEN→HOLD · rescheduleReason · queue Q-2026-0089 (WAIT_ASSIGN) | PASS |
| 19 | D-R2-02 แจ้งเตือน | การ์ด "เลื่อนงานกลับเข้าคิว — Q-2026-0089 / JN-2026-0132 · เหตุผล …" ในกลุ่มทีม QA · events: CONFIRM → OPEN_JOB → RESCHEDULE | PASS |
| 20 | UAT2-11 | ค้น "QA-R2 sales" ในกลุ่มทีม → 6 ข้อความของผู้ส่งนั้น | PASS |
| 21 | UAT2-07 | ไฟล์แนบ: GET คืนชื่อ/ชนิด/เนื้อไฟล์ตรงกับที่ส่ง · ช่างนอกกลุ่ม 403 | PASS |
| 22 | DEF-500 photos/summary | `GET /api/jobs/JN-2026-0132/photos/summary` บน MongoDB จริง = 200 `{"lines":{},"site":0}` | PASS (ดู 09) |
| 23 | UI บน UAT (เซสชัน Owner อ่านอย่างเดียว) | /jobs/JN-2026-0132: ชิป "เลื่อนวันเข้า" + กล่อง "เลื่อนวันเข้า · รอเช็คคิวใหม่" + เหตุผล · /service-queue/<Q-0088>: "ยังไม่ออก JN" + รูป 1 + ปุ่มลบ (Admin) · /group-chat ทีม QA: ปุ่มดาวน์โหลด · /users: ทีมเซลล์ QA · ตารางคิว: JN ทุกแถว + avatar · สัญญาเช่าจริง: data-font=bundled 2 แผ่น | PASS |

ไม่ได้ทดสอบบน UAT: นำเข้ารุ่นเครื่องจริง (dry-run เท่านั้น) · เลือกเครื่องที่เช่าอยู่/เครื่องของลูกค้า (ไม่มีข้อมูลเครื่องแบบนั้นใน UAT) · ช่างรับทราบ/เริ่ม/ปิดงานบน UAT (ใบงาน QA ถูกเลื่อนเป็น HOLD) · การพิมพ์ลงกระดาษจริง
