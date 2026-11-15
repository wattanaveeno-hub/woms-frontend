# 09 — Regression Results

| ด้าน | ผล |
|---|---|
| Backend test เดิมทั้งหมด (2289) | PASS ครบ · ไม่มี skip เพิ่ม (242 เท่าเดิม) |
| Frontend test เดิม (320) | PASS ครบ |
| Flow หลัก sandbox: ลูกค้า, คำขออนุมัติ, คิว→JN, ช่างรับทราบ/เริ่มงาน | PASS (ดู 05) |
| คลังเครื่อง | ไม่แก้ logic/หน้า · `/api/equipment/picker` ค่าเริ่มต้นเหมือนเดิม (test ยืนยัน) · test เดิม fbV1 picker PASS |
| PM | ไม่แก้ไฟล์ PM · `JobStatusChip` เดิมเมื่อไม่ส่ง holdReason |
| สิทธิ์ | site-photos: ต้องเห็นคิว (getQueue เดิม) · แนบได้เฉพาะ svcqueue:request/admin · แจ้งเลื่อนงานเฉพาะ svcqueue:admin (backend ตรวจเดิม) · ทีมเซลล์ใช้สิทธิ์ manageGroups เดิม |
| UAT จริง | NOT TESTED (ดู 06) |
