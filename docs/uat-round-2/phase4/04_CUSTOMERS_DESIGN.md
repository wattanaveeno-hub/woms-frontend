# P4-04 Customers — Design completion

คอลัมน์ตาม `Customers.dc.html`: ลูกค้า · ติดต่อ · สาขา · เครื่อง (รุ่น ×จำนวน + ชิปความสัมพันธ์) · สัญญา (“ค้าง N งวด” + ยอด · N วัน) · งานล่าสุด (ลิงก์ใบงาน + วันนัดแบบสัมพัทธ์) · เซลล์ · แก้ไข
- คอลัมน์สัญญา/งานล่าสุดแสดงตาม `fields` ที่ backend คืน (ผู้ไม่มีสิทธิ์ไม่เห็นคอลัมน์)
- ตัวกรองประเภทเป็น pill (ทุกประเภท/บริษัท/บุคคล/หน่วยงาน/ยังไม่ระบุ) แยกแถวจากตัวกรองความสัมพันธ์
ไฟล์: `src/app/customers/page.tsx`, `src/lib/types.ts`

| ตรวจ | ผล | หลักฐาน |
|---|---|---|
| Sandbox flow16 | 10/10 PASS | `r6/p3-customers-flow16.log` |
| Sandbox flow1 (สร้างลูกค้า) | 13/13 PASS | `r6/p3-customers-flow1.log` |
| Visual compare desktop | **DESIGN PASS (มีข้อยกเว้น)** | `r6/design/Customers.compare.png` |
| มือถือ 390px | ไม่ล้นจอ | `r6/p3-customers-mobile.png` |
| UAT จริง (admin) | แสดงข้อมูลจริง 3 ลูกค้า ตาม design | `r6/uat/p4-customers-admin.jpg` |

ข้อยกเว้น (ตั้งใจคงไว้): ปุ่มนำเข้า/ส่งออกแยกกัน (design เป็น dropdown) · คงคอลัมน์สาขา · มี pill ความสัมพันธ์เพิ่ม (ฟังก์ชันเดิม)
