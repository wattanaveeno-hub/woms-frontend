# 04 · Security Review (Round 2)

## 1. ขอบเขตและวิธี

- ไล่ทุก route ใน `src/routes/*.ts` (250 route) หาสิทธิ์ที่ประกาศ แล้วเทียบกับสิทธิ์จริงของบทบาทช่างจาก `ROLE_PERMISSIONS.tech` → **116 route ที่ช่างเรียกได้** (GET 76) · รายการเต็ม: `evidence/security/routes-after.tsv`
- อ่าน middleware: `authenticate` (ทุก `/api` ยกเว้น login), `requirePermission`, `requireAnyPermission`, ขอบเขตใบงาน `jobScope` (`technicianIds` มีรหัสช่าง)
- ทดสอบด้วยคำขอจริงที่ล็อกอินแล้ว 6 บทบาท + token หมดอายุ/ปลอม กับ API และ MongoDB QA (`security-matrix.mjs`) + E2E ผ่าน browser (E2E-R2-09) + unit test
- ผู้ตรวจอิสระพยายามเจาะซ้ำ — ดูหัวข้อ 6

## 2. BUG-V2-17 — สิ่งที่เปิดเผยก่อนแก้ (ยืนยันด้วยการรันบนโค้ด `992072c`)

unit test ชุด Round 2 รันบนโค้ดก่อนแก้: 16 จาก 17 test ล้ม (`evidence/r2-unit-on-992072c.log.txt`) — ช่างได้เครื่องทุกเครื่อง, เปิดเครื่องคนอื่นด้วย id ได้, เห็นคลังรถช่างอื่นและต้นทุน

| กลุ่มข้อมูล | Endpoint ที่รั่ว (ช่าง) | สาเหตุ |
|---|---|---|
| เครื่อง/แผนที่ | `GET /api/equipment`, `/:id`, `/:id/history`, `/:id/timeline`, `/:id/jobs`, `/:id/history.pdf`, `/export.xlsx`, `/picker`, `POST /:id/check-location`, `GET /api/customers/equipment/:id/holding` | ตรวจแค่ `equipment:view` ไม่มีขอบเขตเจ้าของ |
| ภาพรวมคลัง | `/api/equipment/summary`, `/inventory`, `/api/dashboard/equipment`, ส่วน PM/สต๊อกของ `/api/dashboard/summary` และ `/export.xlsx` | นับทั้งบริษัท |
| สต๊อก | `/api/stock/locations`, `/balances` (รวมมูลค่า), `/transactions` (+ `?locationId=` ของคนอื่น), `/api/stock/parts` (ราคาทุน/ขาย) | ตรวจแค่ `stock:view` |
| อะไหล่ | `/api/parts`, `/api/parts/:id`, `/:id/usage` (ราคาซื้อ), `/api/jobs/:id/equipment-parts` (ต้นทุน) | หน้าเว็บซ่อนต้นทุน แต่ API ส่ง |
| ระบบจองคิวเดิม | `/api/queue/slots?techId=<คนอื่น>`, `/api/queue/suggest` | ไม่บังคับ techId |

## 3. นโยบายชั่วคราว (least privilege) — รอ D-03 รับรอง

"ถูกจำกัด" = ผู้ใช้ที่ไม่มี `jobs:view_all` (ปัจจุบันคือบทบาทช่าง) — เกณฑ์เดียวกับขอบเขตใบงานเดิม

| ข้อมูล | ช่างเห็น | ไม่เห็น |
|---|---|---|
| เครื่อง/แผนที่ | เครื่องในใบงานที่มีรหัสตนใน `technicianIds` และไม่ถูกยกเลิก · เครื่องในตาราง PM ของตนที่ส่งแล้ว (SENT/CLOSED) | เครื่องอื่นทั้งหมด (id ตรง → 403) · เครื่องที่อยู่แค่ในขั้นคิว (TECH-02 เห็นเฉพาะรุ่น — แก้ตาม R2-F06) · เครื่องของคิว/ใบงานที่ยกเลิก (R2-F07) · ภาพรวมคลังทั้งบริษัท (403) |
| สต๊อก | ยอดในคลังรถของตน · ความเคลื่อนไหวที่เข้า/ออกคลังตนหรือตนเป็นผู้ทำ · ชื่อคลังกลาง (เพื่อเลือกต้นทางเบิก) | คลังรถช่างอื่น · ยอดคลังกลาง · ต้นทุน/มูลค่า/จุดสั่งซื้อ |
| อะไหล่ | รหัส ชื่อ หน่วย รุ่นที่ใช้ได้ รูป · ประวัติการใช้ในงานของตน | ราคาขาย ราคาทุน ราคาซื้อ (ส่งเป็น `null`) |
| แดชบอร์ด | ตัวเลขใบงาน/เครื่องของตน | ส่วนสต๊อก · ยอดเงิน (ดู N-2) |
| ยอดเงินใบงาน (`revenueAmount`, `costAmount`, `financeNote`) | — | ทุก response ของ `/api` ส่งเป็น `null` สำหรับผู้ไม่มี `quotations:view` (ช่าง และ Sale) · export แดชบอร์ดไม่มีคอลัมน์ยอดเงิน (R2-F01/F02 · นโยบายชั่วคราวรอ D-22 · หน้าเว็บเดิมแสดงยอดเงินใบงานเฉพาะผู้มี `jobs:edit` อยู่แล้ว) |

**ผลกระทบที่ต้องแจ้งผู้ใช้:** ช่างไม่เห็นยอดคลังกลางก่อนเบิก (ระบบยังตรวจยอดตอนเบิก) · ใบงานเก่าที่ไม่มี `technicianIds` ช่างไม่เห็นเครื่องในงานนั้น · ตาราง PM ที่ยังไม่ส่ง ช่างไม่เห็นเครื่องในตาราง

## 4. การแก้ (backend `1ff51f7`)

| ไฟล์ | สิ่งที่ทำ |
|---|---|
| `src/mongo/techDataScope.ts` (ใหม่) | หา id เครื่องของช่างจาก jobs (ไม่ยกเลิก) + job_equipment, pm_schedules (SENT/CLOSED) · หา id คลังรถของช่าง (`f457998` ตัด service_queues ออกตาม R2-F06) |
| `src/lib/dataScope.ts` (ใหม่) | `isDataRestricted`, `equipmentScopeOf`, `stockLocationScopeOf` (cache ต่อ request), `assertEquipmentInScope`, `stripMoney` (คงคีย์เป็น null) |
| `src/routes/equipment.ts` | `router.param("id")` ตรวจทุก route ที่มี `:id` · กรอง list/export/picker · summary/inventory 403 |
| `src/routes/customers.ts` | holding ตรวจขอบเขตเครื่อง |
| `src/routes/stock.ts`, `src/mongo/stockRepo.ts` | locations/balances/transactions (กรองใน query ก่อน limit)/parts |
| `src/routes/parts.ts`, `src/routes/jobParts.ts` | money → null |
| `src/routes/dashboard.ts` | เครื่องตามขอบเขต · สต๊อก null · ยอดเงิน null สำหรับผู้ไม่มี `quotations:view` (N-2) |
| `src/routes/queue.ts` | slots บังคับ techId ตนเอง · suggest 403 |
| `src/index.ts` + `jobFinanceGuard` (`f457998`) | ยอดเงินรายใบงาน null สำหรับผู้ไม่มี `quotations:view` ทุก response |
| `src/mongo/contractRepo.ts`, `contractImport.ts`, `equipmentRepo.ts` (`f457998`, `ea0cf62`, `f93098b`, `0a10e18`, `242f643`) | กติกา "เครื่องละ 1 สัญญามีผล" (N-1/BR-04): lock `contract-serial:<SN>` + ตรวจไม่สนตัวพิมพ์ ใน 6 เส้นทาง — สร้าง, ผูกเครื่อง, เปลี่ยนสถานะเป็น ACTIVE, ต่อสัญญา, เปลี่ยน Serial เครื่อง, ชำระ/แก้รายการชำระที่ทำให้ COMPLETED กลับเป็น ACTIVE · นำเข้า Excel ใช้เส้นทางสร้าง/เปิดใช้งาน |
| `src/mongo/notificationRepo.ts` (`f457998`) | อ่านแจ้งเตือนได้เฉพาะที่ส่งถึงตน |
| `src/domain/user.ts` | Sale ไม่มี `tracking:view` (N-3) |
| Frontend `6602268` | หน้าสต๊อกแสดงโหมด "คลังของคุณ" ไม่มีคอลัมน์ต้นทุน/มูลค่า · `baht(null)` = "—" · แดชบอร์ดซ่อนการ์ดยอดเงินเมื่อ null · Sale ไม่มีเมนูแดชบอร์ด |

## 5. การทดสอบเชิงลบ (ดูผลจริงใน 08)

| ประเภท | ตัวอย่างที่ทดสอบ |
|---|---|
| Horizontal / IDOR | ช่าง A เปิดเครื่อง/ประวัติ/PDF/ผู้ถือครอง/ตรวจตำแหน่ง ของเครื่องช่าง B · ใบงาน/อะไหล่ในใบงาน/คิวของช่าง A โดยช่าง B · ลิงก์ใบงาน |
| ค้นหา/ตัวกรอง/Export | `?q=<SN ของคนอื่น>` · `?locationId=<คลังคนอื่น>` · `?techId=<คนอื่น>` · export.xlsx เปิดไฟล์ตรวจแถวจริง |
| ข้อมูลอ้างอิงในข้อมูลอื่น | คิวช่าง (items.equipmentId/serial ถูกตัด) · การ์ดในกลุ่มแชทหลังย้ายช่าง (เหลือ transferred เท่านั้น) |
| เขียนข้ามสิทธิ์ | เบิกสต๊อกจากรถคนอื่น · check-location เครื่องคนอื่น · วางบิลงานคนอื่น · แท็กคนนอกกลุ่ม |
| Authentication | ไม่ล็อกอิน (7 endpoint) · token หมดอายุ · token ลงนามด้วย secret ผิด |
| Regression | Admin/Manager/CEO/Sale/ช่าง 10 กรณีที่ต้องยังใช้ได้ |

## 6. ผล independent QA

ผู้ตรวจอิสระ (แยกจากผู้พัฒนา ไม่เห็นการแก้ระหว่างทาง ได้รับเฉพาะ branch + QA environment) ตรวจ 6 รอบ บน `9553b0e` → `f457998` → `ea0cf62` → `f93098b` → `0a10e18` → `242f643` · พบ 15 รายการ (R2-F01..F15) ทั้งหมดอยู่ในกลุ่มความปลอดภัย/ความถูกต้องของข้อมูล:

- ยอดเงินรายใบงานรั่วให้ Sale/ช่าง (F01, F02 — High)
- สัญญามีผลซ้ำบนเครื่องเดียวกันจาก race และตัวพิมพ์ (F03, F04, F09, F12, F14 — High · F05, F10, F15 — Medium · F11, F13 — Low) — แต่ละรอบแก้เส้นทางที่พบแล้วผู้ตรวจพบเส้นทางถัดไป · ข้อสรุป: กติกานี้ควรมี unique index บนฐานข้อมูล (ต้องทำความสะอาดข้อมูลก่อน · M-04 ใน 09) แทนการตรวจในโค้ดทีละเส้นทาง
- ขอบเขตเครื่องของช่าง (F06, F07 — Medium/Low) · อ่านแจ้งเตือนของคนอื่น (F08 — Low)

สถานะรายข้อและหลักฐาน: `05_DEFECT_CLOSURE_REGISTER.md` หัวข้อ 4 · รายงานผู้ตรวจ: `evidence/independent-qa-r2/INDEPENDENT_QA_REVIEW_R2.md`

## 7. ความเสี่ยงที่ยังเหลือ

| ID | เรื่อง | สถานะ |
|---|---|---|
| D-03 | นโยบายชั่วคราวยังไม่ได้รับการรับรองจากลูกค้า | BLOCKED — BUSINESS CONFIRMATION |
| D-22 | ยอดเงินรายใบงานปิดสำหรับ Sale และช่างแล้ว (R2-F01/F02) เป็นนโยบายชั่วคราว — ลูกค้าต้องยืนยันว่า Sale ไม่ต้องเห็น | BLOCKED — BUSINESS CONFIRMATION (การรับรอง) |
| N-1 / R2-F03..F14 | กติกาเครื่องละ 1 สัญญามีผลบังคับในโค้ด (op lock + ตรวจ) ไม่ใช่ unique index — เส้นทางใหม่ในอนาคตที่เขียน `contracts.serial/status` โดยไม่ผ่าน lock จะทำให้ซ้ำได้อีก · import พร้อมกับสร้างสัญญา: ผู้ตรวจรัน 5 รอบไม่เกิดการชนจริง (ยืนยันจากการอ่านโค้ดว่าใช้ lock เดียวกัน) | Medium — แนะนำ M-04 (unique partial index หลังทำความสะอาดข้อมูล) |
| — | `/api/users/technicians` ส่งรายชื่อ id/ชื่อ/ทีมของช่างทุกคนให้ช่าง (ไม่มีเบอร์/อีเมล) | ยอมรับได้ชั่วคราว (ข้อมูลอ้างอิง) |
| — | `/api/settings/stock` ช่างอ่านชื่อวิธีคิดมูลค่าได้ (ไม่มีตัวเลข) | ยอมรับได้ |
| — | การตรวจสิทธิ์ทั้งหมดผูกกับ role ไม่ใช่สิทธิ์รายผู้ใช้ (AUTH-01) | รอ D-01/D-03 |
