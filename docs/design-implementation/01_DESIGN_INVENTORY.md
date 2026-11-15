# 01 — Design Inventory

แหล่งอ้างอิง: Artifact "ENTECH Redesign — ทั้งระบบ" (https://claude.ai/artifact/5YaUhXmt8obamZVwDCyZSD) · 93 ไฟล์ artboard (`project/*.dc.html`)

## วิธีดึงภาพ design
Artifact เป็นชนิด Design (canvas) อ่านได้ทีละไฟล์ · ไฟล์ที่ดึงมาได้ถูกเรนเดอร์ในเครื่องทดสอบด้วยตัวแปลงอย่างง่าย (แทนที่ `<dc-import>` Nav/Top · เมนู active ตาม prop · ใช้ `app.css` ของ design + ฟอนต์ Sarabun) ขนาด 1440×1100 · ข้อจำกัด: ไม่รัน script ของ artboard (หน้าเหล่านี้ไม่มีค่าที่คำนวณนอกจากเมนู)

การดึงไฟล์ชุดที่ 2 ถูกระบบปฏิเสธระหว่างทำ (ตัวคัดกรองอัตโนมัติไม่อนุญาตการคัดลอกไฟล์ต่อ) → ได้ไฟล์ 13 หน้า + Nav/Top/app.css

## In-scope pages (ไม่รวมคลังเครื่อง / PM)
| Artboard | Route | ดึง design ได้ |
|---|---|---|
| Main | /dashboard | ✅ |
| Jobs | /jobs | ✅ |
| JobDetail | /jobs/[id] | ✅ |
| JobNew | /jobs/new | ✅ |
| Queue | /service-queue | ✅ |
| ServiceQueueDetail | /service-queue/[id] | ✅ (ภาพ app ไม่มีข้อมูลคิวใน sandbox ตอนจับภาพ) |
| ServiceQueueNew | /service-queue/new | ✅ |
| Customers | /customers | ✅ |
| CustomerDetail | /partners/[id] | ✅ |
| CustomerNew | /partners/new | ✅ |
| Contracts | /contracts | ✅ |
| ContractDetail | /contracts/[id] | ✅ |
| ContractNew | /contracts/new | ✅ |
| Account, Approvals, Audit, BillDetail, Bills, Calendar, Chats, DashboardSales, DocumentNew, Documents, Finance, FinanceQueue, FollowUps, GroupChat, GroupChatManage, JobChat, JobHistory, Login, MBills, MBooking, MClose, MHome, MJob, MJobNew, MQueue, Map, Master, MasterModels, Notifications, PartDetail, QueueSlots, QuotationDetail, QuotationDoc, QuotationNew, Quotations, Receipt, Reports, Roles, Settings, SettingsCompany, SettingsStock, Stock, Users, WarrantyPresets | ตาม route เดิม | ❌ BLOCKED (ดึงไฟล์ไม่ได้) |

Out of scope: Equipment, EquipmentDetail, EquipmentNew, PmDashboard, PmMonthly, PmPlan, MPm, Before-* (ภาพก่อนแก้)
