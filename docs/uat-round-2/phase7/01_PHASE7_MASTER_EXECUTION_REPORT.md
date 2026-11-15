# Phase 7 — Master Execution Report (ทุก requirement ยกเว้น PM)

วันที่: 15 พ.ย. 2569 · ฐานโค้ด: woms-backend HEAD b5c2cec, woms-frontend HEAD a55a0d9 + การแก้ใน Phase 6 และ Phase 7 (ยังไม่ commit)

เอกสารนี้รวมผล Phase 7 ไว้ฉบับเดียว และ **แทนที่ (supersede)** ส่วน "สถานะปัจจุบัน" ของ `phase6/08_FINAL_QA_SUMMARY_AND_RELEASE_READINESS.md` ส่วนเอกสาร Phase 6 คงไว้ตามเดิมเป็นประวัติ

## ป้ายสถานะ

ทุก requirement ในเอกสารนี้ใช้ป้ายใดป้ายหนึ่งในสี่ป้ายนี้

| ป้าย | ความหมาย |
|---|---|
| **IMPLEMENTED + VERIFIED** | มีโค้ด และมีการทดสอบอัตโนมัติที่ตรวจพฤติกรรมนั้นจริง (unit/API/E2E ใน sandbox) หรือมีหลักฐาน UAT ที่ตรวจได้ |
| **IMPLEMENTED + NOT VERIFIED** | มีโค้ด แต่ยังไม่มีการทดสอบที่ตรวจพฤติกรรมนั้นโดยตรง |
| **BLOCKED — BUSINESS DECISION** | ทำต่อไม่ได้จนกว่าเจ้าของระบบจะตัดสินใจ (ส่วน 11) |
| **NOT IMPLEMENTED** | ยังไม่มีโค้ด |

"VERIFIED" ในเอกสารนี้หมายถึง sandbox (fakeMongo + Next.js build จริง) เท่านั้น ยังไม่ใช่ UAT จริง สถานะ UAT จริงแยกไว้ในส่วน 10

---

## 1. Requirement matrix

### 1.1 UAT Round 2 (เอกสาร feedback ลูกค้า)

| ID | Requirement | สถานะ | หลักฐาน |
|---|---|---|---|
| UAT2-01 | ปฏิทินช่าง ว่าง/ไม่ว่าง | IMPLEMENTED + VERIFIED | flow8, flow21 |
| UAT2-02 | นำเข้ารุ่นเครื่อง (Excel) | IMPLEMENTED + VERIFIED | BE unit; UAT dry-run (r3–r7) |
| UAT2-03 | Package PM | นอกขอบเขต Phase 7 (PM) | — |
| UAT2-04 | Login ด้วยเบอร์โทร | IMPLEMENTED + VERIFIED | BE unit; UAT r3–r7 |
| UAT2-05 | เซลล์ผูกผู้ใช้ | IMPLEMENTED + VERIFIED | BE unit |
| UAT2-06 | ทีมของ Sales ในหน้าผู้ใช้ | IMPLEMENTED + VERIFIED | flow7 |
| UAT2-07 | ดาวน์โหลดรูปแชท | IMPLEMENTED + VERIFIED | BE unit; UAT r3–r7 |
| UAT2-08 | รูปหน้างานตอนเปิดคิว | IMPLEMENTED + VERIFIED | flow6 |
| UAT2-09 | เลือกเฉพาะเครื่องว่างในคลัง (งานติดตั้ง) | IMPLEMENTED + VERIFIED · งานซ่อม/บริการ = BLOCKED — BUSINESS DECISION (BD-08) | flow6 |
| UAT2-10 | แยกเครื่องที่เลือกแล้ว | IMPLEMENTED + VERIFIED | flow6 |
| UAT2-11 | ค้นแชทครบ | IMPLEMENTED + VERIFIED | BE unit |
| UAT2-12 | Icon ประจำผู้ใช้ | IMPLEMENTED + VERIFIED | flow24 (เปิดหน้าต่างรูปโปรไฟล์จากหน้าบัญชี) |
| UAT2-13 | JN ในใบคิว | IMPLEMENTED + VERIFIED | flow3 |
| UAT2-14 | แจ้งเลื่อนงาน | IMPLEMENTED + VERIFIED · status แยกในฐานข้อมูล = BLOCKED — BUSINESS DECISION (BD-09) | BE unit |
| UAT2-15 | เก็บรูปหน้างาน | IMPLEMENTED + VERIFIED | flow13 |
| **UAT2-16** | **หน้ารับเครื่องเข้าคลัง** (เดิม OUT OF SCOPE — Phase 7 นำเข้าขอบเขต) | **IMPLEMENTED + VERIFIED** (ส่วน 5) · การอนุมัติ/ต้นทุน = BLOCKED — BUSINESS DECISION (BD-01, BD-02) | BE `p7_equipmentReceipt` 8 tests, flow22 |
| UAT2-17 | แบบฟอร์มสัญญาเช่า | IMPLEMENTED + VERIFIED (OWNER CONFIRMED ใน Phase 6) | flow15, flow17 |
| UAT2-18 | ข้อกำหนดเพิ่มเติมในสัญญา | IMPLEMENTED + VERIFIED (OWNER CONFIRMED ใน Phase 6) | flow17, flow19 |

### 1.2 Customer Recovery / Customer Feedback v1.1 (UAT Round 1)

สถานะรายข้อของ AC ใน CF v1.1 อยู่ใน `customer-feedback-v1.1-2026-11-03/final-uat-verification-1247/` และไม่ได้เปลี่ยนใน Phase 7 รอบนี้ตรวจเฉพาะว่าไม่เกิด regression (E2E flow1–flow19 ผ่านครบ, BE ผ่านครบ) รายการที่ยังค้างจากรอบนั้น

| ID | เรื่อง | สถานะ |
|---|---|---|
| AC20 | ข้อมูลเก่ากับข้อมูลจริง | BLOCKED — ต้องตรวจบนข้อมูลจริง (ไม่ใช่การตัดสินใจโค้ด) |
| AC38 | D07 กระจายส่วนลด/รับรู้รายได้ | BLOCKED — BUSINESS DECISION (BD-13) |
| KI-1 | คิว → JN สร้าง TMP ทั้งที่ SN เข้าคลังแล้ว | IMPLEMENTED + NOT VERIFIED บน UAT (รายงานเดิม) — Phase 7 ไม่ได้แก้ |

### 1.3 Defect และ requirement จาก Phase 4–6

| ID | เรื่อง | สถานะ | หลักฐาน |
|---|---|---|---|
| DEF-R5-01 | stage SUBMITTED ใน list | IMPLEMENTED + VERIFIED (OWNER CONFIRMED) | flow18 |
| DEF-P5-01 | ปุ่มตรวจปิดตาม `jobs:edit` | IMPLEMENTED + VERIFIED | flow18 |
| DEF-P5-02 | ผู้อนุมัติเห็นข้อความเต็ม | IMPLEMENTED + VERIFIED (OWNER CONFIRMED) | flow19 |
| NUM-01 | ช่องตัวเลข placeholder 0 / ไม่มีศูนย์นำหน้า | IMPLEMENTED + VERIFIED | unit, flow20, flow22, flow23 |
| DES-01..03 | Users / Calendar / Finance link | IMPLEMENTED + VERIFIED | flow21 |

### 1.4 Requirement ใหม่ใน Phase 7

| ID | เรื่อง | สถานะ | หลักฐาน |
|---|---|---|---|
| P7-WH-01 | รับเครื่องเข้าคลังแบบใบรับ (หลายรุ่น หลายเครื่อง, Serial/เลขชั่วคราว) | IMPLEMENTED + VERIFIED | BE 8 tests, flow22 |
| P7-WH-02 | สต็อกรวม: คอลัมน์ "จอง" + ตารางแยกตามคลัง | IMPLEMENTED + VERIFIED | BE test `stockByWarehouse`, flow24 |
| P7-WH-03 | หน้าอะไหล่ & สต๊อกตาม design (แท็บ, pivot ตามคลัง, หน้าต่างบันทึก) | IMPLEMENTED + VERIFIED | flow23 |
| P7-WH-04 | DEF-P7-01 คลังช่างต้องผูกบัญชีช่าง | IMPLEMENTED + VERIFIED | flow23 |
| P7-DES-* | ความต่าง design ของหน้าที่มีอยู่ (ส่วน 4) | ดูส่วน 4 | flow21, flow24 |
| P7-DESIGN-B | 13 route ที่ไม่มี design → design จริงใน Claude Design (14 board) | IMPLEMENTED (design) · ส่วน implement ดูส่วน 3 | artifact `24cd3e27…` page `p7` |
| P7-RBAC-01 | หน้า `/documents` และ `/group-chat/manage` ไม่มี gate ฝั่ง frontend | IMPLEMENTED + VERIFIED | flow24 (tech) |

---

## 2. ขอบเขต: รวม / ไม่รวม

**รวม** — ทุกหน้าและ workflow ที่ไม่ใช่ PM ได้แก่ Warehouse (ใหม่ในรอบนี้), Jobs/Queue, Contracts, Finance/Billing, Quotations/Documents, Customers/Partners, Master, Users/Account, Notifications (in-app), Chat, Dashboard, Reports, Mobile (ยกเว้นส่วน PM)

**ไม่รวม**
- PM ทั้งหมด: `/pm`, `/pm/plans`, `/pm/dashboard`, `/pm/[id]`, ส่วน PM ใน `/m`, UAT2-03 — ไม่แก้ business logic และไม่แก้หน้า E2E ทุกชุดยังรันผ่านหน้าที่เกี่ยวข้องโดยไม่มี error
- ช่องทางแจ้งเตือนภายนอก (LINE, Email) — ไม่สร้างตามคำสั่ง
- Production — ไม่ได้แตะ

---

## 3. Design-to-route coverage

### 3.1 สรุป

| รายการ | Phase 6 | Phase 7 |
|---|---|---|
| Design ใน artifact เดิม (ไม่นับ Nav/Top/Before-*) | 65 | 65 |
| Design PROPOSED ใหม่ (page `p7`) | 0 | 14 |
| Route ใน frontend | 79 | 80 (+ `/equipment/receive`) |
| Route ที่มี design | 58 | 74 (58 + 13 route เดิม + 2 จาก Warehouse ที่เคย EXCLUDED + `/equipment/receive`) |
| Route ที่ไม่มี design | 16 | 6 (PM 4 route ที่ไม่รวม, `/queue` legacy, `/finance/audit` ใช้ Audit design ร่วม) |

### 3.2 Task B — 13 route ที่ไม่มี design

Design จริงอยู่ใน artifact "ENTECH Redesign — ทั้งระบบ" (slug `24cd3e27-aae0-4e1f-99eb-2c538c3499a6`, version 1794680777-8a4c) หน้า **Phase 7 · PROPOSED** ทุก board มีป้าย "PROPOSED DESIGN — ยังไม่ได้รับอนุมัติจากลูกค้า"

| Board | Route | Implement ตาม board | สถานะ |
|---|---|---|---|
| EquipmentReceive | `/equipment/receive` | หน้าใหม่ทั้งหน้า | IMPLEMENTED + VERIFIED (flow22) |
| Inventory | `/inventory` | แท็บ, คอลัมน์จอง, ตารางแยกตามคลัง | IMPLEMENTED + VERIFIED (flow24) |
| Parts | `/parts` | แท็บ สต๊อกคงเหลือ/ข้อมูลอะไหล่ | IMPLEMENTED + VERIFIED (flow24) |
| Partners | `/partners` | pill ประเภทคู่ค้า | IMPLEMENTED + VERIFIED (flow24) |
| PartnerNew | `/partners/new` | board วาดจากหน้าปัจจุบัน ไม่มีความต่างที่ต้องแก้ | IMPLEMENTED + VERIFIED (flow1, flow5) |
| MasterKind | `/master/[kind]` | side list ชนิดข้อมูล + ไฮไลต์ | IMPLEMENTED + VERIFIED (flow24) |
| BillNew | `/bills/new` | board วาดจากหน้าปัจจุบัน | IMPLEMENTED + NOT VERIFIED (ไม่ได้เทียบ layout ทีละส่วน) |
| BillEdit | `/bills/[id]/edit` | board วาดจากหน้าปัจจุบัน | IMPLEMENTED + NOT VERIFIED |
| BillPrint | `/bills/[id]/print` | board วาดจากหน้าปัจจุบัน | IMPLEMENTED + NOT VERIFIED |
| DocumentDetail | `/documents/[id]` | board วาดจากหน้าปัจจุบัน | IMPLEMENTED + NOT VERIFIED |
| QuotationEdit | `/quotations/[id]/edit` | board วาดจากหน้าปัจจุบัน | IMPLEMENTED + NOT VERIFIED |
| ContractDocument | `/contracts/[id]/document` | ข้อความสัญญาไม่แก้ (UAT2-17) | IMPLEMENTED + VERIFIED (flow15, flow17) |
| JobEdit | `/jobs/[id]/edit` | board วาดจากหน้าปัจจุบัน | IMPLEMENTED + NOT VERIFIED |
| Tracking | `/tracking` | ลิงก์ "ดูบนแผนที่" | IMPLEMENTED + VERIFIED (flow24) |

Board ที่ "วาดจากหน้าปัจจุบัน" คือ design ที่บันทึกโครงหน้าที่มีอยู่ให้ลูกค้าอนุมัติ ไม่มีการเปลี่ยนโค้ด ลูกค้าอาจขอแก้หลังเห็น board

### 3.3 Design ที่ Phase 6 จัดเป็น EXCLUDED (Warehouse)

| Design | Route | สถานะ |
|---|---|---|
| Equipment | `/equipment` | ปรับรอบนี้: ปุ่มรับเครื่อง, แท็บ, แถบ "ต้องจัดการ" แทนการ์ดแดง — IMPLEMENTED + VERIFIED (flow22, flow24) |
| EquipmentDetail | `/equipment/[id]` | ไม่เปลี่ยน · แสดงเลขใบรับในประวัติ (CREATE event) — IMPLEMENTED + VERIFIED (BE test) |
| EquipmentNew | `/equipment/new` | ไม่เปลี่ยน (numeric fix จาก Phase 6) — IMPLEMENTED + VERIFIED |

---

## 4. Design mismatch และการแก้ (Task A)

| # | หน้า | ความต่าง (Phase 6) | การแก้ใน Phase 7 | สถานะ |
|---|---|---|---|---|
| 1 | Stock `/stock` | ไม่มีแท็บและ pivot ตามคลัง (P2) | ทำใหม่ทั้งหน้า: ชื่อ "อะไหล่ & สต๊อก", ปุ่ม โอน/เพิ่มอะไหล่/รับเข้า, แท็บ คงเหลือ/ใกล้หมด/ความเคลื่อนไหว/คลัง, คอลัมน์ตามคลัง, หน้าต่างบันทึก | IMPLEMENTED + VERIFIED (flow23) |
| 2 | PartDetail | ไม่มี grid สรุปและปุ่มรับเข้า | ชิปใกล้หมด, สถิติสต๊อก, ปุ่ม "รับเข้าสต๊อก" (เปิดหน้าต่างในหน้า Stock), ตารางความเคลื่อนไหว | IMPLEMENTED + VERIFIED (flow24) |
| 3 | Master | ไม่มี side list | `MasterLayout` ใช้ร่วมทั้ง `/master` และ `/master/[kind]` | IMPLEMENTED + VERIFIED (flow24) |
| 4 | WarrantyPresets | แถว → card grid | ปุ่มเพิ่มที่หัวหน้า + การ์ด | IMPLEMENTED + VERIFIED (flow24) |
| 5 | Documents | taxonomy ต่างจาก design (BIZ) | ใช้มุมมองตามประเภทเอกสารที่ระบบมีอยู่แล้ว (ใบเสร็จ-ใบกำกับ/ใบส่งของ/ใบลดหนี้/ยกเลิก) ผ่าน URL `view` ไม่เพิ่มประเภทใหม่ | IMPLEMENTED + VERIFIED (flow24) · ประเภทเพิ่มเติมตาม design = BD-06 |
| 6 | Notifications | แท็บต่างความหมาย + ปุ่ม push (BIZ) | แท็บ ต้องดำเนินการ/เพื่อทราบ/ทำแล้ว/ยังไม่อ่าน/ทั้งหมด จาก field ที่มีอยู่; ปุ่ม push ย้ายจากกระดิ่งมาใช้ hook เดียวกัน (`useWebPush`) — ไม่เพิ่ม infra | IMPLEMENTED + VERIFIED (flow24) · การเปิด Web Push บน UAT ต้องมี VAPID = BD-05 |
| 7 | Finance | stat cards + tabs | การ์ดสรุป 4 ใบ, แท็บ ยังไม่ได้รับครบ/ได้รับแล้ว/ทั้งหมด, ปุ่ม "ตรวจเงินเข้า (n)" | IMPLEMENTED + VERIFIED (flow24) · รวมงวดสัญญาเข้าหน้านี้ = BD-04 |
| 8 | GroupChatManage | หัวข้อแยก → tabs | ปุ่มสร้างกลุ่ม/ทีมที่หัวหน้า + แท็บ ทีม/กลุ่ม/ปิด | IMPLEMENTED + VERIFIED (flow24) |
| 9 | Account | ไม่มีปุ่มเปลี่ยนรูป (BIZ ใน Phase 6) | ใช้ `AvatarEditorDialog` ที่มีอยู่แล้ว (UAT2-12 อนุญาตผู้ใช้ตั้ง icon เอง) + ปุ่มออกจากระบบ | IMPLEMENTED + VERIFIED (flow24) |
| 10 | QuotationDetail | การ์ด "ลูกค้าตอบว่าอย่างไร" (BIZ ใน Phase 6) | การ์ดแสดงเมื่อ SENT เท่านั้น ปุ่มเรียก transition เดิม: ไม่ตอบรับ → REJECTED, ขอแก้ราคา → revise เดิม, ตอบรับ → ACCEPTED ไม่เพิ่มสถานะใหม่ | IMPLEMENTED + VERIFIED (flow24) |
| 11 | DashboardSales | ตาราง → action list (BIZ) | หัวข้อทักทาย + รายการ "ควรตามวันนี้" จากข้อมูลที่ API ส่งอยู่แล้ว (สัญญาใกล้ครบ + งานติดตาม) | IMPLEMENTED + VERIFIED (flow24) · ส่วนใบเสนอราคา/การเงิน = BD-03 |
| 12 | Equipment | การ์ดแดงแถวที่ 2 | แถบ "ต้องจัดการ" แสดงเฉพาะรายการที่มีจำนวน | IMPLEMENTED + VERIFIED (flow24 เมื่อมีรายการ) |
| 13 | Chats `/chats` | manager เห็นหน้าว่าง | ไม่แก้ — เป็น feature ที่ซ่อนตาม HIDE-01 (OBS-P6-03) | BLOCKED — BUSINESS DECISION (BD-07) |
| 14 | MBills | ช่างวางบิลบนมือถือ | ไม่แก้ | BLOCKED — BUSINESS DECISION (BD-10) |
| 15 | หน้า P3 ที่ "NOT VERIFIED รายละเอียด" ใน Phase 6 (Roles, Settings*, Reports, BillDetail, QuotationNew, QuotationDoc, Receipt, Map, GroupChat, JobChat, MQueue, MBooking, MJobNew) | ไม่ได้เทียบ layout ทีละส่วน | ไม่ได้แก้ในรอบนี้ | IMPLEMENTED + NOT VERIFIED (รายละเอียด design) |

ไม่ได้เปลี่ยนข้อความสัญญาที่อนุมัติแล้ว และไม่ได้เปลี่ยน state machine ของใบเสนอราคา

---

## 5. Warehouse — สถานะราย workflow

| Workflow | สถานะ | รายละเอียด / หลักฐาน |
|---|---|---|
| รับเครื่องเข้าคลัง (UAT2-16) | IMPLEMENTED + VERIFIED | ใบรับ `RCV-YYYY-NNNN`; หลายรุ่นต่อใบ; รวมไม่เกิน 200 เครื่อง; สร้างเครื่องสถานะ IN_STOCK ทีละเครื่องใน transaction เดียว; Serial ที่ไม่ระบุได้เลขชั่วคราวแบบเดิม — BE 8 tests, flow22 |
| Serial ซ้ำ / ข้อมูลผิด | IMPLEMENTED + VERIFIED | Serial ซ้ำในระบบ → 409 และไม่สร้างเครื่องใดในใบ; ซ้ำในใบเดียวกัน, Serial เกินจำนวน, prefix `TMP-`, วันที่อนาคต → 400 |
| ความถูกต้องของข้อมูลเมื่อผิดพลาดกลางทาง | IMPLEMENTED + VERIFIED | `runAtomic` + rollback (ลบเครื่องและ event ที่สร้างแล้ว) — BE test rollback |
| ประกันจากโปรไฟล์ | IMPLEMENTED + VERIFIED | ใช้ `applyWarrantyPreset` เดิม นับจากวันรับเข้า |
| ความพร้อมใช้ (availability) | IMPLEMENTED + VERIFIED | สต็อกรวมไม่นับเครื่องลูกค้า (external) และแยกคอลัมน์ "จอง" — BE test |
| แยกตามคลัง (cross-warehouse) | IMPLEMENTED + VERIFIED | `stockByWarehouse` + ตาราง pivot — BE test, flow24 |
| จองเครื่อง (CR-EQ01) | IMPLEMENTED + VERIFIED | ของเดิม ไม่แก้ — BE tests เดิมผ่าน |
| ส่ง/ส่งมอบ/รับคืน (CR-EQ02 `machine_movements`) | IMPLEMENTED + VERIFIED | ของเดิม ไม่แก้ — BE tests เดิมผ่าน |
| อะไหล่: รับเข้า/เบิก/โอน/คืน/ปรับยอด | IMPLEMENTED + VERIFIED | หน้าใหม่ใช้ API เดิม — flow23 (รับเข้า 50 แยก 42/8, โอน, ความเคลื่อนไหว) |
| คลังช่าง (DEF-P7-01) | IMPLEMENTED + VERIFIED | เลือกช่างจากรายชื่อ ส่ง `ownerUserId` — flow23 |
| ประวัติ | IMPLEMENTED + VERIFIED | ประวัติใบรับ + รายละเอียด + ลิงก์ไปหน้าเครื่อง; event CREATE ของเครื่องอ้างเลขใบรับ |
| สิทธิ์ | IMPLEMENTED + VERIFIED | ส่วน 8 |
| อนุมัติใบรับ / ต้นทุน / แก้-ยกเลิกใบรับ | BLOCKED — BUSINESS DECISION | BD-01, BD-02, BD-12 |

---

## 6. สถานะราย module

| Module | สถานะ | หมายเหตุ |
|---|---|---|
| Jobs / Queue lifecycle | IMPLEMENTED + VERIFIED | flow3, 4, 11, 13, 14, 18 ผ่าน; legacy `/queue` ซ่อนตาม HIDE-01 (BD-07) |
| Contracts | IMPLEMENTED + VERIFIED | flow9, 15, 17, 19; ไม่แก้ข้อความสัญญา |
| Finance / Billing | IMPLEMENTED + VERIFIED | flow9, 10, 24; การรวมงวดสัญญา = BD-04 |
| Quotations / Documents | IMPLEMENTED + VERIFIED | flow24 |
| Customers / Partners | IMPLEMENTED + VERIFIED | flow1, 2, 5, 16, 24 |
| Master | IMPLEMENTED + VERIFIED | flow24; ปิดใช้งาน/เรียงลำดับ/จำนวนการใช้งาน = BD-11 |
| Users / Account | IMPLEMENTED + VERIFIED | flow7, 21, 24 |
| Notifications (in-app) | IMPLEMENTED + VERIFIED | flow24; ภายนอก = BD-05 |
| Chat | IMPLEMENTED + VERIFIED (group chat) · job chat ซ่อน (BD-07) | |
| Dashboard / Reports | IMPLEMENTED + VERIFIED | flow12, 24 |
| Warehouse | ส่วน 5 | |
| Numeric input | IMPLEMENTED + VERIFIED | flow20 + ช่องใหม่ใน flow22/23 (placeholder 0, พิมพ์ 3 ได้ 3, พิมพ์ 50 ได้ 50) |
| PM | ไม่รวม | ไม่แก้; flow ที่ผ่านหน้า PM ไม่มี error |

---

## 7. Backend / API / DB changes

### API ใหม่

| Method | Path | สิทธิ์ (Matrix) | หมายเหตุ |
|---|---|---|---|
| GET | `/api/equipment/receipts?q=&limit=` | `inventory:view` (EQ-01) | รายการใบรับ |
| GET | `/api/equipment/receipts/:id` | `inventory:view` (EQ-01) | รับ id หรือเลข RCV |
| POST | `/api/equipment/receipts` | `equipment:create` (EQ-03) | สร้างใบรับ + เครื่อง; บันทึก audit |

### API ที่เปลี่ยน (additive)

- `GET /api/equipment/inventory` เพิ่ม field `warehouses` (คงเหลือ/จอง ตามคลังและรุ่น) และ `rows[].reserved`; ไม่นับเครื่องลูกค้า field เดิมคงรูปแบบเดิม

### DB

- collection ใหม่ `equipment_receipts` (สร้างอัตโนมัติเมื่อ insert ครั้งแรก)
- counter ใหม่ `equipment_receipt_YYYY` ใน `nextSequence` เดิม
- field ใหม่ `equipment.receiptNo` (optional) และป้องกันการแก้ผ่าน PATCH
- ไม่มี migration ข้อมูลเดิม ไม่มี index ใหม่ที่บังคับ (ค้นใบรับใช้ scan ตามจำนวนใบที่ยังน้อย — ถ้าใบรับเกินหลักพันควรเพิ่ม index `receiptNo`)

### ไฟล์ที่เปลี่ยน

| Repo | ใหม่ | แก้ |
|---|---|---|
| backend | `src/domain/equipmentReceipt.ts`, `src/mongo/equipmentReceiptRepo.ts`, `test/p7_equipmentReceipt.fake.test.ts` | `src/domain/equipment.ts` (CRLF), `src/mongo/equipmentRepo.ts`, `src/data/equipmentRepo.ts`, `src/routes/equipment.ts`, `docs/rbac-matrix/mapping.py` (CRLF), `src/domain/permissionMatrixData.ts` (สร้างใหม่ด้วย `gen.py`, CRLF) |
| frontend | `app/equipment/receive/page.tsx`, `lib/equipmentReceipt.ts`, `scripts/equipmentReceipt.test.ts`, `lib/equipmentTabs.ts`, `lib/stockTabs.ts`, `components/MasterSideList.tsx`, `lib/useWebPush.ts` | 21 ไฟล์: `lib/api.ts`, `lib/types.ts`, `lib/navMenu.ts`, หน้า equipment, inventory, stock (CRLF), parts, parts/[id], master, master/[kind] (`master/page.tsx` CRLF), warranty-presets, documents, notifications, `components/Notifications.tsx`, finance, group-chat/manage, account/password, quotations/[id], dashboard/sales, partners, tracking |

### Sync ไปเครื่อง Owner (ยังไม่ commit)

- ก่อนเขียน: ตรวจ sha256 ไฟล์เดิมบนเครื่องเทียบกับสำเนาก่อนแก้ — backend 6/6 ตรง (เทียบหลังตัด CR), frontend 20/21 ตรงกับ backup และ `app/equipment/page.tsx` ไม่มี backup แต่ mtime 12 พ.ย. (ก่อน Phase 7); ไฟล์ใหม่ 10 ไฟล์ยังไม่มีบนเครื่อง
- หลังเขียน: sha256 ตรง backend 9/9, frontend 28/28 · คง CRLF ของ `domain/equipment.ts`, `mapping.py`, `permissionMatrixData.ts`, `stock/page.tsx`, `master/page.tsx`
- บนเครื่อง: backend `tsc` PASS · frontend `tsc` PASS · frontend `npm test` 350/350
- หมายเหตุ: ระหว่างตรวจได้รัน `docs/rbac-matrix/gen.py` บนเครื่องหนึ่งครั้ง ผลที่ได้มีเนื้อหาตรงกับไฟล์ที่ sync (ยืนยันว่า matrix สร้างซ้ำได้) แต่เขียนเป็น LF จึงคืนไฟล์จากชุด sync แล้วตรวจ sha256 ซ้ำ 9/9 ตรง

Rollback: ลบไฟล์ใหม่และคืนไฟล์แก้จาก git; collection `equipment_receipts` และ field `receiptNo` ไม่กระทบโค้ดเดิมถ้าค้างอยู่

---

## 8. RBAC / Security

สิทธิ์อ้างอิง WOMS User Role Matrix (final) ผ่าน `mapping.py` → `permissionMatrixData.ts` (สร้างใหม่ด้วย `gen.py` ไม่ได้แก้มือ) และ `test/rbacMatrix.test.ts` ผ่าน

### ใบรับเครื่อง (ทดสอบ API ทุกบทบาท)

| บทบาท | สร้างใบรับ | ดูประวัติใบรับ | หน้า `/equipment/receive` |
|---|---|---|---|
| admin | 201 | 200 | ฟอร์ม + ประวัติ |
| manager | 201 | 200 | ฟอร์ม + ประวัติ |
| store | 201 | 200 | ฟอร์ม + ประวัติ |
| ceo | 403 | 200 | ประวัติเท่านั้น (flow22) |
| acc | 403 | 200 | ประวัติเท่านั้น |
| sales | 403 | 403 | ไม่มีสิทธิ์ |
| tech | 403 | 403 | ไม่มีสิทธิ์ (flow22) |

### ผลตรวจที่พบในรอบนี้

| ID | เรื่อง | ผล |
|---|---|---|
| P7-RBAC-01 | tech เปิด `/documents` และ `/group-chat/manage` แล้วเห็นโครงหน้า (backend ตอบ 403 อยู่แล้ว ข้อมูลไม่รั่ว) | เพิ่ม `WomsPermissionGate` (`documents:view`, `chat:moderate`) — flow24 tech ผ่าน |
| P7-RBAC-02 | `/inventory`, `/equipment/receive` | มี gate `inventory:view` |
| OBS-P6-02 | admin เปิด `/users` ไม่ได้ | **ตามแบบ** — Matrix SET-02 admin = "ไม่ได้" ปิดเป็น NOT A DEFECT (flow24 ตรวจ) |
| OBS-P6-03 | `/chats`, `/queue` ว่างสำหรับ manager | **ตามแบบ** — feature ซ่อนตาม HIDE-01 (`WomsHiddenFeature`) การเปิดใช้ = BD-07 |
| DEF-P7-01 | คลังช่างบันทึกไม่ได้ (UI ส่งแค่ชื่อ) | แก้แล้ว — flow23 |

ความปลอดภัยของ input: zod ทุก field, จำกัดจำนวนบรรทัด/เครื่อง, ห้าม prefix `TMP-` ที่ระบบสงวนไว้, ตรวจคลัง/ผู้จำหน่าย/โปรไฟล์ประกันกับข้อมูลจริงฝั่ง server ไม่เชื่อค่าจาก client

---

## 9. Automated tests

| Gate | ผล | Baseline (Phase 6) |
|---|---|---|
| BE `tsc` | PASS | PASS |
| BE build | PASS | PASS |
| BE vitest (unit/integration/API/authz/DB ด้วย fakeMongo) | **2,369 PASS · 0 FAIL · 242 SKIP** (184 ไฟล์) | 2,361 / 242 |
| FE `tsc` | PASS | PASS |
| FE `next build` | PASS | PASS |
| FE ESLint | PASS (1 warning เดิมใน `users/page.tsx`) | เท่าเดิม |
| FE unit | **350 PASS · 0 FAIL** | 348 |
| E2E flow1–24 (responsive 390px รวมอยู่ในแต่ละชุด) | **487 PASS · 0 FAIL · 0 NOT VERIFIED** (24 ชุด) | 400 / 0 |

E2E รายชุด (รันต่อเนื่องรอบเดียวบน build ล่าสุด)

| Flow | ขอบเขต | PASS | FAIL | NOT VERIFIED |
|---|---|---|---|---|
| flow1 | ลูกค้า: สร้าง/รหัส/ค้นหา/ตัวกรอง | 13 | 0 | 0 |
| flow2 | แก้ข้อมูล → คำขออนุมัติ | 5 | 0 | 0 |
| flow3 | คิว: สร้าง/มอบหมาย | 11 | 0 | 0 |
| flow4 | ช่างรับงานบนมือถือ | 8 | 0 | 0 |
| flow5 | ฟอร์มลูกค้า required/ซ้ำ | 8 | 0 | 0 |
| flow6 | UAT2-08/09/10 | 21 | 0 | 0 |
| flow7 | UAT2-06 ทีมเซลล์ | 16 | 0 | 0 |
| flow8 | UAT2-01 ปฏิทิน | 4 | 0 | 0 |
| flow9 | สัญญา: ร่าง/งวด | 7 | 0 | 0 |
| flow10 | ช่องเงินเดิม | 5 | 0 | 0 |
| flow11_jobnew | เปิดใบงาน | 9 | 0 | 0 |
| flow12_reports | Dashboard/รายงานตามบทบาท | 12 | 0 | 0 |
| flow13_closeevidence | หลักฐานปิดงาน | 14 | 0 | 0 |
| flow14_jobs | รายการใบงาน | 15 | 0 | 0 |
| flow15_contracts | สัญญา (UAT2-17) | 17 | 0 | 0 |
| flow16_customers | Customers design | 10 | 0 | 0 |
| flow17_clauses | ข้อกำหนดเพิ่มเติม (UAT2-18) | 110 | 0 | 0 |
| flow18_defr501_roles | DEF-R5-01 / DEF-P5-01 ตามบทบาท | 46 | 0 | 0 |
| flow19_contract_approval | DEF-P5-02 | 22 | 0 | 0 |
| flow20_numeric | Numeric | 25 | 0 | 0 |
| flow21_design | Design Phase 6 | 22 | 0 | 0 |
| flow22_receive | **ใหม่** รับเครื่องเข้าคลัง (UAT2-16) + สิทธิ์ | 26 | 0 | 0 |
| flow23_stock | **ใหม่** อะไหล่ & สต๊อก + DEF-P7-01 | 20 | 0 | 0 |
| flow24_design_p7 | **ใหม่** หน้าที่ปรับ design Phase 7 + gate ของ tech | 41 | 0 | 0 |
| **รวม** | | **487** | **0** | **0** |

รอบเต็ม (01:38–02:37) ได้ flow1–21 และ flow24 ผ่านครบ ส่วน flow22 และ flow23 ติดปัญหาที่ test script ไม่ใช่ที่ระบบ จึงแก้ script แล้วรันสองชุดนี้ซ้ำบน build เดิม (โค้ดระบบไม่เปลี่ยน)
- flow22: ตัวเลือก "เมนู" ใน script จับ `nav, aside` ทั้งหมด จึงไปเจอแท็บ "รับเครื่องเข้าคลัง" ในหน้า (ceo ดูประวัติได้จึงเห็นแท็บ) ได้ 25/1 · แก้ให้ตรวจเฉพาะเมนูหลัก `nav[aria-label="เมนูหลัก"]` ทั้งกรณี admin (ต้องมี) และ ceo (ต้องไม่มี) → 26/0
- flow23: ช่อง select ที่ required มีชื่อ accessible รวมค่าที่เลือกไว้ `get_by_label(exact)` จึงหาไม่เจอ script หยุดที่ 9 PASS · เปลี่ยนเป็น `get_by_role("combobox")` → 20/0
- flow24: เปลี่ยน check ที่เคยผ่านเสมอ (`True`) 3 จุด เป็นการตรวจจริงหรือรายงาน NOT VERIFIED ก่อนรัน — รอบนี้ทุกจุดได้ตรวจจริง
- log ทั้งรอบแรกและรอบรันซ้ำเก็บไว้ทั้งคู่ (`flow22_receive.log`, `flow22_receive.rerun.log`, `flow23_stock.log`, `flow23_stock.rerun.log`)

ข้อจำกัด
- E2E ใช้ backend จำลอง (fakeMongo) ไม่ได้ทดสอบ MongoDB Atlas จริง; transaction จริงทดสอบด้วยเส้นทาง rollback
- visual: ตรวจโครงหน้า, testid, ข้อความ และไม่ล้นแนวนอนที่ 390px ไม่ได้เทียบ pixel กับ design
- vitest backend รันบนเครื่อง Owner ไม่ได้ (node_modules ของ Windows) ใช้ผล sandbox ซึ่งเป็นไฟล์ชุดเดียวกัน (ตรวจ sha256 แล้ว)

---

## 10. Real UAT status

**ไม่มีการทดสอบบน UAT จริงในรอบนี้** และไม่มีหลักฐานใหม่
- โค้ด Phase 6 และ Phase 7 ยังไม่ deploy ขึ้น UAT (ไม่ได้รับอนุญาตให้ commit/push/deploy)
- `Claude outputs/uat-round-2/r8/` ยังไม่มี — สถานะ Phase 5 ยังเป็น OWNER-REPORTED UAT EXECUTED
- Chrome ที่เชื่อมอยู่ login ด้วยบัญชีช่างที่ไม่ใช่ QA-R2 จึงไม่ใช้; ไฟล์บัญชี QA-R2 ถูกปฏิเสธ (BLK-P4-01) และไม่ได้พยายามอ่านซ้ำ
- หลักฐาน sandbox รอบนี้อยู่ที่ `Claude outputs/uat-round-2/r9-sandbox/` (แยกจาก r8 ที่สงวนไว้ให้หลักฐาน UAT จริงของ Owner)

สิ่งที่ต้องทดสอบบน UAT หลัง deploy (ขั้นต่ำ)
1. รับเครื่อง 1 ใบ (2 รุ่น, ระบุ Serial บางเครื่อง) ด้วยบัญชี admin → เครื่องขึ้นในคลังกลาง
2. Serial ซ้ำ → ข้อความผิดพลาด และไม่มีเครื่องใหม่
3. ceo เห็นประวัติแต่ไม่มีฟอร์ม; tech เปิดหน้าไม่ได้
4. สต็อกรวม: คอลัมน์จอง และตารางแยกตามคลังตรงกับรายการเครื่อง
5. อะไหล่ & สต๊อก: รับเข้า, โอนเข้าคลังช่าง (เลือกช่างจากรายชื่อ)
6. หน้าที่ปรับ design ในส่วน 4 เปิดได้ทุกบทบาทโดยไม่มี error
7. Numeric: ช่องจำนวนในใบรับและหน้าต่างอะไหล่ แสดง placeholder 0

---

## 11. Open business decisions

| ID | เรื่อง | ผลกระทบ | ค่าที่ใช้ตอนนี้ |
|---|---|---|---|
| BD-01 | ใบรับเครื่องต้องมีขั้นอนุมัติหรือไม่ | data integrity / สิทธิ์ | บันทึกแล้วเครื่องเข้าคลังทันที |
| BD-02 | บันทึกต้นทุน/มูลค่าเครื่องตอนรับหรือไม่ | เงิน | ไม่บันทึกต้นทุน |
| BD-03 | DashboardSales แสดงใบเสนอราคา/การเงินให้เซลล์หรือไม่ | สิทธิ์ | แสดงเฉพาะข้อมูลที่เซลล์มีสิทธิ์ |
| BD-04 | รวมงวดสัญญาเช่าเข้าหน้าการเงิน + แท็บ "ออกเอกสารบัญชีแล้ว" | เงิน | แยกหน้าเหมือนเดิม |
| BD-05 | เปิด Web Push บน UAT/Production (ต้องตั้ง VAPID) และ LINE/Email | infra | ปุ่ม push มีแต่ทำงานเมื่อ server ตั้ง VAPID; LINE/Email ไม่สร้าง |
| BD-06 | ประเภทเอกสารเพิ่มเติมตาม design | เอกสารบัญชี | ใช้ประเภทที่ระบบมี |
| BD-07 | เปิด job chat (`/chats`) และคิวแบบเดิม (`/queue`) — HIDE-01 | สิทธิ์/ขอบเขต | ซ่อน |
| BD-08 | UAT2-09 งานซ่อม/บริการเลือกเฉพาะเครื่องว่างหรือไม่ | workflow | แสดงเครื่องที่ลูกค้าใช้อยู่ |
| BD-09 | UAT2-14 status "เลื่อนวัน" ในฐานข้อมูล | รายงาน/PM | ใช้ป้าย ไม่เพิ่ม enum |
| BD-10 | ช่างวางบิลจากมือถือ | เงิน/สิทธิ์ | ไม่ทำ |
| BD-11 | Master: ปิดใช้งาน/เรียงลำดับ/จำนวนการใช้งาน | data integrity | ไม่ทำ |
| BD-12 | แก้ไข/ยกเลิกใบรับหลังบันทึก และรูปแบบเลข GRN | data integrity | แก้ทีละเครื่องตามเดิม; เลข `RCV-YYYY-NNNN` |
| BD-13 | AC38 กระจายส่วนลด/รับรู้รายได้ | เงิน | ค้างจาก CF v1.1 |
| OD-P4-01..06 | คำถามค้างจาก Phase 4 | ตามเอกสาร Phase 4 | ไม่เปลี่ยน |
| BD-14 | อนุมัติ commit/push/deploy และการล้างข้อมูล QA-R2 | release | ยังไม่ทำ |

---

## 12. Remaining defects

| ID | ความรุนแรง | สถานะ |
|---|---|---|
| DEF-P7-01 | Medium | FIXED — VERIFIED (flow23) |
| P7-RBAC-01 | Low (ไม่มีข้อมูลรั่ว) | FIXED — VERIFIED (flow24) |
| OBS-P6-02 | — | CLOSED — NOT A DEFECT (ตาม Matrix) |
| OBS-P6-03 | — | CLOSED เป็น defect → ย้ายเป็น BD-07 |
| DEF-P5-01 | — | FIXED — AUTOMATED PASS (รอหลักฐาน UAT) |
| BLK-P4-01 | — | OPEN (ไม่ใช่ defect ของระบบ) |
| ESLint warning `users/page.tsx` | Info | OPEN (เดิม) |

Critical 0 · High 0 · Medium เปิด 0

---

## 13. Release readiness

| Gate | ผล | เหตุผล |
|---|---|---|
| Automated (BE/FE/E2E) | **PASS** (sandbox) | ส่วน 9 |
| Functional UAT จริง | **NOT PASSED** | ยังไม่ deploy; ไม่มีหลักฐาน r8 (ส่วน 10) |
| Design | **NOT PASSED** | 14 board PROPOSED ยังไม่ได้รับอนุมัติจากลูกค้า; หน้า P3 ยังไม่เทียบรายละเอียด |
| Business decisions | **OPEN** | 14 รายการ (ส่วน 11) |
| Release process | **NOT STARTED** | ยังไม่ commit/push/deploy — รออนุมัติ Owner |

**Overall: NOT READY FOR RELEASE**

ขั้นต่อไปที่ทำให้เป็น READY FOR UAT REVIEW
1. Owner ตรวจ diff แล้ว commit/push ทั้งสอง repo และ deploy ขึ้น UAT
2. ทดสอบรายการในส่วน 10 บน UAT และวางหลักฐานใน `r8/`
3. ลูกค้าดู board Phase 7 และตัดสินใจ BD-01, BD-02, BD-12 (กระทบใบรับเครื่องโดยตรง)
