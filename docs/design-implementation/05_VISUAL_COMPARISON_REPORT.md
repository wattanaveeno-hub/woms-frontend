# 05 — Visual Comparison Report

ไฟล์: `Claude outputs/uat-round-2/r3/design/` — `<Page>.design.png`, `<Page>.app.png`, `<Page>.compare.png` · viewport 1440×1100 full page · แอป = sandbox build ล่าสุด (ข้อมูลสังเคราะห์) · บัญชี admin

| หน้า | ผล |
|---|---|
| ContractNew | PASS (มีข้อยกเว้นตามกติกา) |
| CustomerNew | PASS (รอบก่อน) |
| Queue | MINOR GAP |
| Main, Jobs, Customers, CustomerDetail, Contracts, ContractDetail, JobDetail, JobNew, ServiceQueueNew | FAIL — ต่างตาม 02 |
| ServiceQueueDetail | NOT VERIFIED (ภาพแอปไม่มีข้อมูล) |
| อีก 44 หน้า | BLOCKED (ไม่มีภาพ design) |

ข้อจำกัด: ภาพ design มาจากการเรนเดอร์ไฟล์ artboard ในเครื่องทดสอบ ไม่ใช่ภาพจาก canvas โดยตรง — โครง/สี/ตัวอักษรตรงกับ `app.css` ของ design แต่ไม่ได้ตรวจ pixel-perfect

---
## อัปเดต 14 พ.ย. 2569 Phase 2
ไฟล์: `Claude outputs/uat-round-2/r4/design/after/<Page>.{design,app,compare}.png` · ภาพก่อนแก้ `r4/design/before/`

| หน้า | ก่อน | หลัง |
|---|---|---|
| ServiceQueueNew | FAIL | PASS (ข้อยกเว้นตามกติกา) |
| JobNew | FAIL | PASS (ข้อยกเว้นตามกติกา) |
| JobDetail | FAIL | FAIL (หัว/คอลัมน์ขวาตรง · แท็บภาพรวมยังต่าง) |
| ServiceQueueDetail | NOT VERIFIED | PASS (ข้อยกเว้น) — ใช้คิวที่สร้างใหม่สถานะรอลูกค้าคอนเฟิร์ม |
| Main | FAIL | PASS |

---
## อัปเดต 14 พ.ย. 2569 Phase 3
ไฟล์: `Claude outputs/uat-round-2/r5/design/<Page>.{design,app,compare}.png`

| หน้า | ก่อน | หลัง |
|---|---|---|
| JobDetail | FAIL (ไม่มีหลักฐานปิดงาน) | PASS — มีภาพบน UAT จริงด้วย (`r5/uat/uat-remain-01-*.jpg`) |
| Jobs | FAIL | PASS |
| Customers | FAIL | FAIL (ข้อมูลไม่พอ) |
| CustomerDetail | FAIL | PASS |
| Contracts | FAIL | PASS |
| ContractDetail | FAIL (ไม่มีข้อมูลให้เทียบ) | PASS (ใช้สัญญาที่สร้างใน sandbox) |
