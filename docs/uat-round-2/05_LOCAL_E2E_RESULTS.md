# 05 — Local E2E Results (sandbox)

สภาพแวดล้อม: Frontend `next build && next start` (port 3100) + Backend จริงบน fakeMongo (port 8100, ข้อมูลสังเคราะห์) · Playwright + Chrome 153 · viewport 1440×900 · ไม่เชื่อม UAT/Production
หลักฐาน: `Claude outputs/uat-round-2/screens/`

| Scenario | ผล | หลักฐาน |
|---|---|---|
| UAT2-09 หน้าเปิดคิว: ตัวเลือกเครื่องแสดงเฉพาะเครื่องว่าง (SN-UAT2-003 สถานะเช่า ไม่แสดง) | PASS | flow6 |
| UAT2-10 เลือกเครื่องแล้ว: แถวพื้นเขียว + ชิป "เลือกแล้ว" + "เลือกแล้ว 1 เครื่อง" | PASS | uat2-10-picker-selected.png |
| UAT2-08 เลือกรูปหน้างาน 2 รูปตอนเปิดคิว → บันทึกร่าง → หน้าร่างแสดง 2 รูป · เปิดรูปแล้วมีปุ่มดาวน์โหลด | PASS | uat2-08-queue-new.png, uat2-08-queue-detail-photos.png |
| UAT2-13 คิวที่ยังไม่ออก JN แสดง "ยังไม่ออก JN" · มุมมองตารางมีบรรทัด JN ทุกแถว · การ์ดบอร์ดคิวเลื่อนงานแสดง JN | PASS | uat2-13-queue-list.png |
| UAT2-14 ใบงาน OPEN มีปุ่ม "แจ้งเลื่อนงาน" · ไม่ใส่เหตุผล = แจ้งเตือน · ส่งแล้วไปหน้าคิวใหม่สถานะ "รอจัดช่าง" พร้อมเหตุผล · ใบงานแสดง "เลื่อนวันเข้า · รอเช็คคิวใหม่" + เหตุผล (ไม่ใช่ "พักงาน") · status ในฐานข้อมูลยังเป็น HOLD | PASS | uat2-14-dialog.png, uat2-14-queue-after.png, uat2-14-job-after.png |
| UAT2-06 หน้าผู้ใช้: Sales "ยังไม่อยู่ในทีม" → กำหนดทีม → แสดง "ทีมเซลล์: …" และ API memberIds ตรง | PASS | uat2-06-assign-team.png |
| UAT2-04 ตั้งเบอร์ช่างจากหน้าผู้ใช้ · ตั้งเบอร์ซ้ำกับช่างอีกคน → ถูกปฏิเสธ (เบอร์คนที่สองยังว่าง) · login ด้วยเบอร์+รหัสผ่าน เข้าได้ · รหัสผิด 401 | PASS | uat2-04-users-phone.png |
| UAT2-07 รูปในแชทมีปุ่มดาวน์โหลด · ไฟล์ที่ได้ชื่อ "หน้าร้าน.png" ขนาด 2,328 bytes | PASS | downloaded-หน้าร้าน.png |
| UAT2-11 พิมพ์ "แอดมิน" ในค้นหาแชท → พบข้อความของแอดมิน | PASS | uat2-11-chat-search-sender.png |
| UAT2-02 dry-run import ผ่าน API · หน้า master รุ่นเครื่องมีปุ่ม "นำเข้ารุ่นเครื่องจาก Excel" | PASS | uat2-02-models-import.png |
| UAT2-01 ช่างกด "เสนอวันเวลาเริ่ม" → มีปฏิทิน 14 วัน (เช่น ส.14 = 2 งาน, อ.17 = 1 งาน, อื่น ๆ ว่าง) | PASS | uat2-01-propose-calendar.png |
| UAT2-17 ย่อหน้าไทยแบบ justify เดิม vs inter-character (ภาพเทียบ) | PASS (ด้านเทคนิค) · รอลูกค้ายืนยัน | uat2-17-thai-justify-before-after.png |
| UAT2-12 avatar ในรายการคิว | NOT VERIFIED (ไม่มี screenshot เฉพาะ · build/tsc ผ่าน) | — |

## Regression (flow เดิม)
| Flow | ผล | หมายเหตุ |
|---|---|---|
| flow1 ลูกค้าใหม่ / รหัสซ้ำ / ค้นหา | PASS 13/13 | ปรับ harness ให้ใช้ฟอร์มใหม่ (เลือก "บุคคล") — ไม่ใช่การแก้ระบบ |
| flow2 แก้ลูกค้า → คำขออนุมัติ → อนุมัติ | PASS 5/5 | |
| flow3 คิว: สร้าง → จัดช่าง → ช่างเสนอ → รับ → ยืนยัน → เปิดงาน JN | PASS 11/11 | |
| flow4 ช่างรับทราบ/เริ่มงาน/step strip | PASS 6/7 | FAIL 1 = `photos/summary` 500 เฉพาะ fakeMongo (ไม่รองรับ aggregate) เป็นข้อจำกัด sandbox ที่มีก่อนรอบนี้ |
| flow5 ฟอร์มลูกค้าใหม่ | PASS (รันแรก) | รันซ้ำล้มเพราะข้อมูลซ้ำจากรันก่อน (data-dependent) |
