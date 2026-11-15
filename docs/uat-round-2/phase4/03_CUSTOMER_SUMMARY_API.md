# P4-03 Customer Summary API — ฟิลด์เพิ่ม

`GET /api/customers/summary` เพิ่มฟิลด์ต่อแถว (เพิ่มอย่างเดียว ไม่ลบ/ไม่เปลี่ยนฟิลด์เดิม)

| ฟิลด์ | ที่มา | สิทธิ์ |
|---|---|---|
| `contactName`, `contactPhone` | partners (fallback สาขาแรกที่มีผู้ติดต่อ) | partners:view |
| `models: [{model,count}]` | equipment ของลูกค้า เรียงจำนวนมาก→น้อย | partners:view |
| `ownerSale {id,name}` / `siteOwnerSales` | partners / customer_sites | partners:view |
| `contractSummary {liveContracts, overdueContracts, overdueInstallments, overdueAmount, oldestOverdueDays}` | contracts (ไม่นับร่าง/ยกเลิก) | **contracts:view** เท่านั้น |
| `latestJob {jobId,status,jobDate}` | jobs ตามขอบเขตผู้ใช้ (`jobScopeQuery`) | **jobs:view** เท่านั้น |
| `fields: {contractSummary, latestJob}` ระดับ response | บอกหน้าเว็บว่าแสดงคอลัมน์ได้หรือไม่ | — |

ไฟล์: `src/domain/customerSummary.ts` (`buildCustomerSummaryExtras` — pure function), `src/routes/customers.ts`

## ทดสอบ
| ชุด | ผล |
|---|---|
| `test/p4_customerSummaryExtras.fake.test.ts` + `round8_customers` (pure + route: admin ได้ครบ · store ไม่มีสัญญา/งาน · tech 403 · เซลล์เห็นเฉพาะทีม ไม่รั่วข้ามลูกค้า · ตัวกรอง relation · ไม่มีการเขียน) | 33/33 PASS |
| UAT จริง (QA-R2 admin): ลูกค้า 99260101 → contactName “QA-R2 ผู้ติดต่อ” · models [QA-R2-MODEL-A ×1] · contractSummary ศูนย์ทุกค่า (ไม่มีสัญญามีผล) · latestJob JN-2026-0132 HOLD 2026-11-25 · fields {true,true} | PASS |
| UAT จริง: เซลล์/ช่าง | BLOCKED (BLK-P4-01) |
