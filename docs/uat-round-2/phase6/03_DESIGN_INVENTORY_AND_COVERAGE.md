# 03 — Design Inventory & Coverage Matrix (Phase 6 / Master Execution)

วันที่: 2026-11-14 · แหล่ง design: artifact `5YaUhXmt8obamZVwDCyZSD` (version 1794640117-2825) · โค้ด: woms-frontend HEAD a55a0d9 + การแก้ใน sandbox รอบนี้ (ยังไม่ commit)

## สรุป

| รายการ | จำนวน |
|---|---|
| หน้า design ใน artifact (ไม่นับ Before-*, Nav, Top) | 65 |
| Route ใน frontend (`page.tsx`) | 79 |
| Design ที่มี route รองรับแล้ว | 58 |
| Design ที่ owner สั่งไม่แตะ (Warehouse/PM) | 7 |
| Route ที่ไม่มี design ตรงตัว | 16 (PROPOSED DESIGN 13 route ใน 04; อีก 3 เป็น legacy/EXCLUDED/ใช้ design ร่วม) |
| ความต่างที่แก้ได้โดยไม่ต้องตัดสินใจธุรกิจ และแก้แล้วรอบนี้ | 3 (Users, Calendar, Finance link) |
| ความต่างที่ต้องตัดสินใจธุรกิจ (BIZ) | 8 (+ Stock pivot เลื่อนเป็น P2) |

นิยามคอลัมน์
- **Status** — สถานะการ implement เทียบ design
- **Design gap** — ความต่างด้านหน้าตา/โครง
- **Functional gap** — ความต่างที่กระทบ workflow, สิทธิ์ หรือข้อมูล
- **Priority** — `แก้แล้ว` / `P2` / `P3` (ความต่างเล็ก ไม่กระทบงาน) / `BIZ` (ต้องให้เจ้าของระบบตัดสินใจก่อน)
- **NOT VERIFIED รายละเอียด** — route มีและ h1 ตรง แต่รอบนี้ยังไม่ได้เทียบ layout ทีละส่วน

ข้อจำกัดของการตรวจ: เทียบจาก HTML ของ design (อ่านทีละไฟล์ผ่าน artifact API) กับโครงหน้าที่ดึงจาก sandbox (`extract_app.py`, role manager และ tech, viewport 1280 และ 390) ไม่ได้เทียบ pixel

## A. Page inventory — design ทั้งหมด

| # | Design | Route | Role | Status | Design gap | Functional gap | Priority |
|---|---|---|---|---|---|---|---|
| 1 | Login | `/login` | ทุกบทบาท | IMPLEMENTED (Phase 1–3) | ไม่พบความต่างที่มีนัยสำคัญ | - | - |
| 2 | Main | `/dashboard` | admin, manager, sales, ceo | IMPLEMENTED (Phase 1–3) | - | - | - |
| 3 | Nav / Top | layout | ทุกบทบาท | IMPLEMENTED | - | - | - |
| 4 | Customers | `/customers` | admin, manager, sales | IMPLEMENTED (Phase 4) | - | - | - |
| 5 | CustomerNew | `/partners/new?from=customers` | admin, manager, sales | IMPLEMENTED | - | - | - |
| 6 | CustomerDetail | `/partners/[id]` | admin, manager, sales | IMPLEMENTED | - | - | - |
| 7 | Contracts | `/contracts` | admin, manager, sales, ceo | IMPLEMENTED | - | - | - |
| 8 | ContractNew | `/contracts/new` | admin, manager, sales | IMPLEMENTED | - | - | - |
| 9 | ContractDetail | `/contracts/[id]` | admin, manager, sales, ceo | IMPLEMENTED | - | - | - |
| 10 | Queue | `/service-queue` | admin, manager, sales | IMPLEMENTED (Phase 4) | - | - | - |
| 11 | ServiceQueueNew | `/service-queue/new` | admin, manager, sales | IMPLEMENTED | - | - | - |
| 12 | ServiceQueueDetail | `/service-queue/[id]` | admin, manager, sales | IMPLEMENTED | - | - | - |
| 13 | Jobs | `/jobs` | admin, manager, tech (ของตัวเอง) | IMPLEMENTED (DEF-P5-01 แก้แล้ว) | - | - | - |
| 14 | JobNew | `/jobs/new` | admin, manager | IMPLEMENTED | - | - | - |
| 15 | JobDetail | `/jobs/[id]` | admin, manager, tech | IMPLEMENTED | - | - | - |
| 16 | JobHistory | `/jobs/history` | admin, manager | IMPLEMENTED | ไม่พบความต่างที่มีนัยสำคัญ | - | - |
| 17 | Calendar | `/calendar` | admin, manager | IMPLEMENTED + ปรับรอบนี้ | ชื่อหน้า 'ปฏิทินงาน' ไม่ตรง design/เมนู 'ปฏิทินช่าง' | - | แก้แล้ว (P3) |
| 18 | Users | `/users` | admin | IMPLEMENTED + ปรับรอบนี้ | design มีช่องค้นหา + pill กรองบทบาท | - | แก้แล้ว (P2) |
| 19 | Roles | `/users/roles` | admin, developer | IMPLEMENTED | NOT VERIFIED รายละเอียด | - | P3 |
| 20 | Account | `/account/password` | ทุกบทบาท | IMPLEMENTED | design มี checklist กฎรหัสผ่านและปุ่มเปลี่ยนรูป | อัปโหลดรูปโปรไฟล์ยังไม่มี flow — ต้องตัดสินใจ | P3 / BIZ |
| 21 | Settings | `/settings` | admin | IMPLEMENTED | NOT VERIFIED รายละเอียด | - | P3 |
| 22 | SettingsCompany | `/settings/company` | admin | IMPLEMENTED | NOT VERIFIED รายละเอียด | - | P3 |
| 23 | SettingsStock | `/settings/stock` | admin | IMPLEMENTED | NOT VERIFIED รายละเอียด | - | P3 |
| 24 | Reports | `/reports` | admin, manager, ceo | IMPLEMENTED | NOT VERIFIED รายละเอียด | - | P3 |
| 25 | Approvals | `/approvals` | admin, manager | IMPLEMENTED (DEF-P5-02 แก้แล้ว) | - | - | - |
| 26 | Audit | `/audit` | admin, manager | IMPLEMENTED | มี link tabs ตาม design | - | - |
| 27 | FollowUps | `/follow-ups` | admin, manager | IMPLEMENTED | - | - | - |
| 28 | Bills | `/bills` | admin, manager | IMPLEMENTED | - | - | - |
| 29 | BillDetail | `/bills/[id]` | admin, manager | IMPLEMENTED | NOT VERIFIED รายละเอียด | - | P3 |
| 30 | Quotations | `/quotations` | admin, manager, sales | IMPLEMENTED | - | - | - |
| 31 | QuotationNew | `/quotations/new` | admin, manager, sales | IMPLEMENTED | NOT VERIFIED รายละเอียด | - | P3 |
| 32 | QuotationDetail | `/quotations/[id]` | admin, manager, sales | IMPLEMENTED | design มีการ์ด 'ลูกค้าตอบว่าอย่างไร' 3 ปุ่ม (ไม่ตอบรับ/ขอแก้ราคา/ตอบรับ) | สถานะ 'ขอแก้ราคา' ต้องเทียบกับ state machine ใบเสนอราคาเดิม — ต้องตัดสินใจ | BIZ |
| 33 | QuotationDoc | `/quotations/[id]/document` | admin, manager, sales | IMPLEMENTED | NOT VERIFIED รายละเอียด | - | P3 |
| 34 | Documents | `/documents` | admin, manager | IMPLEMENTED | design ใช้ pill/ค้นหา และแบ่งประเภทเอกสารต่างจากระบบ | taxonomy เอกสารต่างกัน — ต้องตัดสินใจ | BIZ |
| 35 | DocumentNew | `/documents/new` | admin, manager | IMPLEMENTED + numeric fix | - | - | - |
| 36 | Receipt | `/contracts/[id]/receipt/[no]` | admin, manager | IMPLEMENTED | NOT VERIFIED รายละเอียด | - | P3 |
| 37 | Finance | `/finance` | admin, manager, ceo | IMPLEMENTED + ปรับรอบนี้ | design มี stat cards + tabs รวมงวดสัญญา; ปุ่มประวัติการเงิน | การรวมงวดสัญญาเข้าหน้าเดียวเป็น scope ธุรกิจ | ปุ่มแก้แล้ว / ส่วนที่เหลือ BIZ |
| 38 | FinanceQueue | `/finance/queue` | admin, manager | IMPLEMENTED | - | - | - |
| 39 | Stock | `/stock` | admin, manager | IMPLEMENTED + numeric fix | design มี tabs และตาราง pivot ตามคลัง | pivot ตามคลังต้องมีข้อมูลหลายคลัง — ใหญ่ | P2 (เลื่อน) |
| 40 | PartDetail | `/parts/[id]` | admin, manager | IMPLEMENTED | design มี grid4 สรุปและปุ่ม 'รับเข้าสต๊อก' | - | P3 |
| 41 | Master | `/master` | admin | IMPLEMENTED | design ใช้ side list | - | P3 |
| 42 | MasterModels | `/master/equipment-models` | admin | IMPLEMENTED + numeric fix | - | - | - |
| 43 | WarrantyPresets | `/master/warranty-presets` | admin | IMPLEMENTED + numeric fix | design เป็น card grid; ระบบเป็นแถว | - | P3 |
| 44 | Notifications | `/notifications` | ทุกบทบาท | IMPLEMENTED | tabs ต่างความหมาย + ปุ่มเปิด push | push opt-in ต้องมี infra — ต้องตัดสินใจ | BIZ |
| 45 | Map | `/map` | admin, manager | IMPLEMENTED | legend ตาม design (ครบ 30 วัน/ปกติ/ยังไม่ตั้งรอบ/ลูกค้า) | NOT VERIFIED รายละเอียด | P3 |
| 46 | Chats | `/chats` | admin, manager, sales, tech | IMPLEMENTED (สิทธิ์จำกัด) | manager เห็นหน้าว่าง (ไม่มี h1) | ต้องยืนยันว่าเป็นการจำกัดสิทธิ์ตั้งใจหรือไม่ | BIZ / P2 |
| 47 | GroupChat | `/group-chat` | admin, manager, sales | IMPLEMENTED | NOT VERIFIED รายละเอียด | - | P3 |
| 48 | GroupChatManage | `/group-chat/manage` | admin, manager | IMPLEMENTED | design ใช้ tabs (ทีมเซลล์/กลุ่มที่สร้างเอง/เก็บถาวร); ระบบเป็นหัวข้อแยก | - | P3 |
| 49 | JobChat | `/jobs/[id]/chat` | admin, manager, tech | IMPLEMENTED | NOT VERIFIED รายละเอียด | - | P3 |
| 50 | DashboardSales | `/dashboard/sales` | sales, manager | IMPLEMENTED | design เป็น action list; ระบบเป็นตาราง read-only | เปลี่ยนเป็น action list ต้องนิยามงานของเซลล์ — ใหญ่ | BIZ |
| 51 | QueueNew | `/queue/new` | admin (legacy) | IMPLEMENTED (legacy) | manager ไม่เห็น h1 — สิทธิ์/legacy | - | P3 |
| 52 | QueueSlots | `/queue/slots` | admin (legacy) | IMPLEMENTED (legacy) + numeric fix | manager ไม่เห็น h1 — สิทธิ์/legacy | - | P3 |
| 53 | MHome | `/m` | tech | IMPLEMENTED | - | - | - |
| 54 | MJob | `/m/job/[id]` | tech | IMPLEMENTED | - | - | - |
| 55 | MClose | `/m/job/[id] (ขั้นปิดงานในหน้าเดียวกัน)` | tech | IMPLEMENTED | - | - | - |
| 56 | MQueue | `/m (แท็บคิว)` | tech, sales | IMPLEMENTED บางส่วน — ไม่มี route แยก | NOT VERIFIED รายละเอียด | - | P3 |
| 57 | MBills | `/m (ส่วนวางบิล) / /bills` | tech | IMPLEMENTED บางส่วน — ไม่มี route แยก | NOT VERIFIED รายละเอียด | ต้องยืนยันว่าช่างวางบิลบนมือถือได้หรือไม่ | BIZ |
| 58 | MBooking | `/m/booking/[id]` | sales, tech | IMPLEMENTED | NOT VERIFIED รายละเอียด | - | P3 |
| 59 | MJobNew | `/m/job/new` | tech | IMPLEMENTED | NOT VERIFIED รายละเอียด | - | P3 |
| 60 | Equipment | `/equipment` | — | EXCLUDED (owner: Warehouse) | - | - | - |
| 61 | EquipmentDetail | `/equipment/[id]` | — | EXCLUDED (owner: Warehouse) | - | - | - |
| 62 | EquipmentNew | `/equipment/new` | — | EXCLUDED (owner: Warehouse); numeric fix เท่านั้น | - | - | - |
| 63 | PmDashboard | `/pm/dashboard` | — | EXCLUDED (owner: PM) | - | - | - |
| 64 | PmMonthly | `/pm` | — | EXCLUDED (owner: PM) | - | - | - |
| 65 | PmPlan | `/pm/plans` | — | EXCLUDED (owner: PM) | - | - | - |
| 66 | MPm | `/m (ส่วน PM)` | — | EXCLUDED (owner: PM) | - | - | - |

## B. Route ที่ไม่มี design ตรงตัว

| Route | Role | หน้าที่ | การดำเนินการ |
|---|---|---|---|
| `/bills/new` | admin, manager | ฟอร์มวางบิลจากใบงาน | PROPOSED DESIGN ใน 04 |
| `/bills/[id]/edit` | admin, manager | แก้รายการวางบิลก่อนยืนยัน | PROPOSED DESIGN ใน 04 |
| `/bills/[id]/print` | admin, manager | พิมพ์ใบวางบิล | PROPOSED DESIGN ใน 04 |
| `/documents/[id]` | admin, manager | ดูเอกสารการขาย | PROPOSED DESIGN ใน 04 |
| `/inventory` | admin, manager | มุมมองคงคลัง | PROPOSED DESIGN ใน 04 |
| `/jobs/[id]/edit` | admin, manager | แก้ใบงาน | PROPOSED DESIGN ใน 04 |
| `/master/[kind]` | admin | รายการข้อมูลพื้นฐานแต่ละชนิด | PROPOSED DESIGN ใน 04 |
| `/parts` | admin, manager | รายการอะไหล่ | PROPOSED DESIGN ใน 04 |
| `/partners` | admin, manager | รายการคู่ค้า | PROPOSED DESIGN ใน 04 |
| `/partners/new` | admin, manager, sales | เพิ่มคู่ค้า/ลูกค้า | PROPOSED DESIGN ใน 04 |
| `/quotations/[id]/edit` | admin, manager, sales | แก้ใบเสนอราคา | PROPOSED DESIGN ใน 04 |
| `/tracking` | admin, manager | ติดตามสถานะ | PROPOSED DESIGN ใน 04 |
| `/contracts/[id]/document` | admin, manager, sales | เอกสารสัญญาเช่า (UAT2-17 OWNER CONFIRMED) | PROPOSED DESIGN ใน 04 |
| `/finance/audit` | admin, manager | ประวัติการเงิน (ใช้ร่วมกับ Audit design) | ใช้ Audit design ร่วม |
| `/queue` | admin (legacy) | คิวแบบเดิม | legacy — ไม่เขียน design ใหม่ |
| `/pm/[id]` | — | EXCLUDED (PM) | ไม่เขียน (EXCLUDED) |

## C. Coverage

| กลุ่ม | Design | มี route | ตรง design (ไม่มี gap ที่มีนัย) | มี gap P2/P3 | BIZ | EXCLUDED |
|---|---|---|---|---|---|---|
| Desktop | 57 | 51 | 25 | 19 | 7 | 6 |
| Mobile (/m) | 8 | 7 | 3 | 3 | 1 | 1 |

หมายเหตุ: "ตรง design" รวมหน้าที่แก้แล้วรอบนี้ (Users, Calendar) และหน้าที่ Phase 1–5 ตรวจเทียบแล้ว ไม่ได้หมายถึง customer approved

## D. รายการที่ implement รอบนี้ (ไม่ต้องตัดสินใจธุรกิจ)

| หน้า | การเปลี่ยน | ไฟล์ | ทดสอบ |
|---|---|---|---|
| Users | เพิ่มช่องค้นหา (ชื่อ/อีเมล/เบอร์ ≥3 หลัก) และ pill กรอง: ทั้งหมด / ช่าง / เซลล์ / ผู้ดูแล / ปิดใช้งาน พร้อมจำนวน | `app/users/page.tsx`, `lib/userFilter.ts` | `scripts/userFilter.test.ts` (2 PASS), E2E ใน 06 |
| Calendar | ชื่อหน้า "ปฏิทินงาน" → "ปฏิทินช่าง" ให้ตรงเมนูและ design | `app/calendar/page.tsx` | E2E flow (h1) ใน 06 |
| Finance | ปุ่ม "ประวัติการเงิน" ที่หัวหน้า → `/finance/audit` | `app/finance/page.tsx` | E2E ใน 06 |

สิ่งที่ไม่เปลี่ยน: API, navigation, RBAC (pill กรองทำฝั่ง client บนข้อมูลที่ API ส่งมาแล้ว), library (ใช้ `WomsSearchBar`, `WomsViewPills` ที่มีอยู่)

## E. รายการที่ต้องตัดสินใจ (BIZ) — ไม่ได้แก้

| # | หน้า | เรื่องที่ต้องตัดสินใจ |
|---|---|---|
| 1 | DashboardSales | เปลี่ยนจากตาราง read-only เป็น action list ของเซลล์หรือไม่ และ action ใดบ้าง |
| 2 | Documents | ใช้การแบ่งประเภทเอกสารตาม design หรือตามระบบปัจจุบัน |
| 3 | Finance | รวมงวดสัญญาเช่าเข้าหน้าสถานะรับชำระพร้อม stat cards หรือไม่ |
| 4 | Notifications | ความหมายของแท็บ และจะเปิด push notification หรือไม่ (ต้องมี infra) |
| 5 | QuotationDetail | เพิ่มสถานะ "ลูกค้าขอแก้ราคา" ใน state machine หรือไม่ |
| 6 | Account | อนุญาตผู้ใช้เปลี่ยนรูปโปรไฟล์เองหรือไม่ |
| 7 | Chats | manager ควรเห็นหน้ารวมแชทหรือไม่ (ปัจจุบันหน้าว่าง) |
| 8 | MBills | ช่างวางบิลจากมือถือได้หรือไม่ |
| 9 | Stock | ตาราง pivot ตามคลัง (ต้องมีข้อมูลหลายคลัง) — เลื่อนเป็น P2 |
