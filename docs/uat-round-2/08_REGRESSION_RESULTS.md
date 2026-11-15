# 08 — Regression Results (final)

| ด้าน | วิธี | ผล |
|---|---|---|
| Backend ทั้งหมด | vitest 178 files | 2317 passed · 0 failed · 242 skipped (เท่า baseline) |
| Frontend ทั้งหมด | node --test | 326 pass · 0 fail |
| tsc FE/BE | sandbox + เครื่อง Owner | ผ่าน |
| next build | sandbox | ผ่าน |
| ลูกค้า (สร้าง/รหัสซ้ำ/ค้นหา) | sandbox flow1 | PASS 13/13 |
| แก้ลูกค้า → อนุมัติ | sandbox flow2 | PASS 5/5 |
| คิว → จัดช่าง → ช่างเสนอ → รับ → ยืนยัน → JN | sandbox flow3 + UAT (#12) | PASS |
| UAT Round 2 UI | sandbox flow6/8/9 | PASS 20/20 · 4/4 · 7/7 |
| สัญญาเช่า PDF | qa/e2e-local/rental-contract (9 PDF + RBAC) | PASS — ต้นฉบับ/คู่ฉบับ 2 หน้า · ทั้งสอง 4 หน้า · A4 · ฟอนต์ Sarabun ฟอนต์เดียว · ไม่ล้น/ไม่ทับ · ACC ไม่มีปุ่มพิมพ์ · ช่าง 403 |
| คลังเครื่อง (non-invasive) | test เดิม fbV1 picker + test ใหม่ "โหมดปกติเหมือนเดิม" | PASS · ไม่แก้หน้า/logic |
| PM (non-invasive) | test PM เดิมทั้งหมดใน vitest | PASS · ไม่แก้ไฟล์ PM · คิว PM ไม่ผ่านตัวตรวจ D-R2-01 |
| ช่างรับทราบ/เริ่มงาน/step strip | sandbox flow4 (รอบก่อน) | PASS 6/7 — ข้อที่ล้มคือ photos/summary 500 = ข้อจำกัด fakeMongo (ดู 09 DEF-R3-02) |
| ปิดงาน (job closing) end-to-end บน UAT | — | NOT TESTED |
| การแจ้งเตือน push / LINE | — | NOT TESTED (ตรวจเฉพาะการ์ดในกลุ่มแชท) |

Regression gate: **ยังไม่ผ่านทั้งหมด** — flow ปิดงานบน UAT และการแจ้งเตือนนอกแชทยังไม่ได้ทดสอบ
