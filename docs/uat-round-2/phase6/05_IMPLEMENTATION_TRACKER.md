# 05 — Implementation Tracker (Phase 6 / Master Execution)

วันที่: 2026-11-14 · repo: `woms-frontend` (backend ไม่มีการแก้ในรอบนี้) · ยังไม่ commit

## 1. ไฟล์ที่เปลี่ยน (frontend) — 31 ไฟล์

| # | ไฟล์ | ประเภท | งาน | EOL |
|---|---|---|---|---|
| 1 | `src/components/NumberInput.tsx` | ใหม่ (แก้ OBS-P6-01 label shrink แล้ว) | Numeric | LF |
| 2 | `src/lib/moneyInput.ts` | แก้ (เพิ่ม `sanitizeNumericText`, `numericInitialText`, `numericTextValue`) | Numeric | LF |
| 3 | `scripts/moneyInput.test.ts` | แก้ (+4 test) | Numeric | LF |
| 4 | `src/components/JobWorkflowPanel.tsx` | แก้ | Numeric (รายรับ/ค่าใช้จ่ายใบงาน) | LF |
| 5 | `src/components/JobEquipmentSection.tsx` | แก้ | Numeric | **CRLF** |
| 6 | `src/components/JobPartsCard.tsx` | แก้ | Numeric | LF |
| 7 | `src/components/JobRevisionPanel.tsx` | แก้ | Numeric | CRLF |
| 8 | `src/components/BillMachineForm.tsx` | แก้ | Numeric | LF |
| 9 | `src/components/BillReviewDialogs.tsx` | แก้ | Numeric | CRLF |
| 10 | `src/components/PaymentHistory.tsx` | แก้ | Numeric | LF |
| 11 | `src/components/ContractPayDialog.tsx` | แก้ | Numeric | LF |
| 12 | `src/components/finance/FinParts.tsx` | แก้ | Numeric | LF |
| 13 | `src/components/QuotationForm.tsx` | แก้ | Numeric | LF |
| 14 | `src/components/MasterManager.tsx` | แก้ | Numeric | CRLF |
| 15 | `src/components/EquipmentForm.tsx` | แก้ | Numeric (ช่องตัวเลขเท่านั้น — ไม่แตะ logic Warehouse) | LF |
| 16 | `src/components/EquipmentHistory.tsx` | แก้ | Numeric (lat/lng) | CRLF |
| 17 | `src/components/EquipmentPmCard.tsx` | แก้ | Numeric (ช่องตัวเลขเท่านั้น — ไม่แตะ logic PM) | LF |
| 18 | `src/components/EquipmentPmPackages.tsx` | แก้ | Numeric (ช่องตัวเลขเท่านั้น) | LF |
| 19 | `src/components/pm/PmPlansLegacy.tsx` | แก้ | Numeric (ตัด 0 นำหน้าในช่องจำนวนวัน) | CRLF |
| 20 | `src/app/stock/page.tsx` | แก้ | Numeric | CRLF |
| 21 | `src/app/documents/new/page.tsx` | แก้ | Numeric | LF |
| 22 | `src/app/contracts/[id]/page.tsx` | แก้ | Numeric (พิกัด) | LF |
| 23 | `src/app/master/warranty-presets/page.tsx` | แก้ | Numeric | LF |
| 24 | `src/app/master/equipment-models/page.tsx` | แก้ | Numeric | LF |
| 25 | `src/app/queue/new/page.tsx` | แก้ | Numeric | LF |
| 26 | `src/app/queue/slots/page.tsx` | แก้ | Numeric | LF |
| 27 | `src/app/users/page.tsx` | แก้ | Design (ค้นหา + pill กลุ่ม) | LF |
| 28 | `src/lib/userFilter.ts` | ใหม่ | Design | LF |
| 29 | `scripts/userFilter.test.ts` | ใหม่ | Design | LF |
| 30 | `src/app/calendar/page.tsx` | แก้ | Design (ชื่อหน้า) | LF |
| 31 | `src/app/finance/page.tsx` | แก้ | Design (ปุ่มประวัติการเงิน) | LF |

ขอบเขตที่ไม่ได้แตะ
- API/DB contract, navigation, RBAC
- ถ้อยคำสัญญา
- SN-1000
- business logic ของ Warehouse/PM — ไฟล์ 15–19 เปลี่ยนเฉพาะ component ของช่องกรอกตัวเลข

## 2. Sync ไปเครื่อง Owner

| ขั้นตอน | ผล |
|---|---|
| ตรวจ sha256 ไฟล์บนเครื่อง = ไฟล์ก่อนแก้ใน sandbox (28 ไฟล์ที่มีอยู่เดิม) | **PASS** 28/28 |
| `scripts/moneyInput.test.ts` บนเครื่อง = 1,045 byte แรกของไฟล์ใหม่ (ไฟล์ใหม่เพิ่มต่อท้ายเท่านั้น) | **PASS** |
| `JobEquipmentSection.tsx` บนเครื่องเป็น CRLF → แปลงไฟล์ใหม่เป็น CRLF ก่อนส่ง | ทำแล้ว |
| แตกไฟล์ (`tar --overwrite`) แล้วตรวจ sha256 หลังเขียน | **PASS** 31/31 |
| `tsc --noEmit` บนเครื่อง | **PASS** (0 error) |
| `npm test` (node --test) บนเครื่อง | **PASS** 348/348 |
| แก้ OBS-P6-01: ส่ง `NumberInput.tsx` รอบสอง (ตรวจ sha256 ก่อนเขียน = ฉบับแรก `435a991b…` · หลังเขียน `9e78ca5e…`) + tsc บนเครื่อง | **PASS** |
| Backend | ไม่มีไฟล์เปลี่ยน — ไม่ต้อง sync |

ไม่ได้ commit / push / merge / deploy

## 3. งานที่ยังไม่ทำ

| งาน | เหตุผล |
|---|---|
| ปรับ layout 13 หน้าที่ไม่มี design | ต้องรอลูกค้าอนุมัติ PROPOSED DESIGN (04) |
| DashboardSales, Documents, Finance (stat/tabs), Notifications, QuotationDetail, Account รูป, Chats manager, MBills | BIZ — ต้องตัดสินใจก่อน (03 ส่วน E) |
| Stock pivot ตามคลัง | P2 ใหญ่ — เลื่อน |
| ความต่าง P3 (WarrantyPresets card grid, Master side list, GroupChatManage tabs ฯลฯ) | กระทบ layout มาก ไม่ใช่ความต่างเล็ก — รอรอบปรับ design รวม |
