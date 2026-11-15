# FINAL IMPLEMENTATION STATUS — งานทุกข้อยกเว้น PM

อัปเดต 15 พ.ย. 2569 (รอบเตรียม UAT) · ฐานโค้ด: woms-backend `b5c2cec`, woms-frontend `a55a0d9` + การแก้ Phase 6–8 + รอบเตรียม UAT (ยังไม่ commit)

ป้ายสถานะ:
- **IMPLEMENTED + TESTED** = มีโค้ดและมีเทสต์อัตโนมัติที่ตรวจพฤติกรรมนั้นจริง (sandbox)
- **IMPLEMENTED + NOT VERIFIED** = มีโค้ด แต่ยังไม่มีการทดสอบที่ตรวจตรง
- **BLOCKED**
- **NOT IMPLEMENTED**

ทุกผลในเอกสารนี้มาจาก sandbox (fakeMongo + Next.js build จริง) ยังไม่มีผลบน UAT จริง

## 1. Requirement รอบนี้

| ID | เรื่อง | สถานะ | สิ่งที่ทำ | เทสต์ |
|---|---|---|---|---|
| KI-1 | คิว → JN สร้าง TMP ทั้งที่ SN เข้าคลังแล้ว | IMPLEMENTED + TESTED | ตอนเปิดงานหา SN ในคลังอีกครั้ง (`relinkQueueSerials`) · รุ่นไม่ตรง = 409 `SERIAL_MODEL_MISMATCH` · ตรวจกติกาเลือกเครื่องเดิม (D-R2-01) · ไม่พบ = TMP ตามเดิม | `p8_ki1_queueSerialRelink` 10 ข้อ (7 ข้อ FAIL บนโค้ดเดิม) · แก้ QA-02f ใน `eq02QaGate.mongo.int` ให้ตรงพฤติกรรมใหม่ |
| BD-08 | เลือกเครื่องตามประเภทงาน + กันข้ามลูกค้า | IMPLEMENTED + TESTED | ด่านคิวเดิม (D-R2-01) คงไว้ · เพิ่มด่านที่ `createJobWithEquipment` และ `attachEquipmentToJob`: เครื่องที่ผูกลูกค้ารายอื่น = 409 `EQUIPMENT_OTHER_CUSTOMER` | `p8_ki1_queueSerialRelink` |
| BD-13 / AC38 | กระจายส่วนลดท้ายใบ | IMPLEMENTED + TESTED | กำไรรายเครื่องใช้ `allocateForMargin`: ส่วนลดท้ายใบกระจายทุกบรรทัดตามสัดส่วน · ค่าใช้จ่ายร่วมที่ระบุขอบเขตกระจายตามยอดตรงของเครื่อง · บรรทัดไม่ผูกเครื่องไม่เดา · เศษสตางค์ largest remainder (เท่ากันให้รายการแรก) · ยอดบรรทัดเดิมคงไว้ แยกบรรทัด "ส่วนแบ่งค่าใช้จ่ายร่วม"/"ส่วนลดท้ายใบ" · VAT ไม่เป็นรายรับ | `p8_ac38_discountAllocation` 9 ข้อ (รวมสุ่ม 200 ใบ) · E2E flow25-E |
| BD-13 (เวลารับรู้รายรับ) | D07-D | BLOCKED | ยังไม่มีนโยบายบัญชีที่อนุมัติ · คงพฤติกรรมเดิม (นับตอนใบ ACCEPTED ครั้งเดียว) · preview เดิมยังอยู่ | — |
| BD-01 | รับเครื่องไม่ต้องอนุมัติ | IMPLEMENTED + TESTED | คงตาม Phase 7 · เก็บเลขใบ/คลัง/ผู้ทำ/เวลา/เครื่อง/จำนวน/audit | `p7_equipmentReceipt` |
| BD-02 | ต้นทุนเครื่องตอนรับ | IMPLEMENTED + TESTED | `unitCost` ต่อบรรทัด (≥0, ทศนิยม 2) · คำนวณเป็นสตางค์ · ไม่ระบุ = `null` (ไม่ใส่ 0) · ไม่เขียนต้นทุนลงตัวเครื่อง · เห็นเฉพาะ `finance:view` (ผู้อื่นถูกตัดฟิลด์ทิ้ง) | `p8_receiptCostCancel` · flow25-A |
| BD-12 | แก้ไข/ยกเลิกใบรับ | IMPLEMENTED + TESTED | แก้: ผู้จัดจำหน่าย/PO/หมายเหตุ/ต้นทุน + เหตุผล + before/after · ยกเลิกทั้งใบหรือบางเครื่อง = เครื่องเป็น RETIRED + ประวัติ STATUS (ไม่ลบ) · บล็อกเมื่อเครื่องออกจากคลัง/ย้ายคลัง/มีความเคลื่อนไหว/ผูกใบงาน/สัญญา/ลูกค้า · ยกเลิกซ้ำ 409 · op lock + version · PATCH สถานะเครื่องที่ยกเลิกแล้ว = 409 | `p8_receiptCostCancel` 11 ข้อ · flow25-A |
| BD-03 | เซลล์เห็นเฉพาะของตน | IMPLEMENTED + TESTED | ตาม Matrix เซลล์ไม่มี `quotations:view`/`finance:view` (403 ตามเดิม) · ถ้าได้สิทธิ์รายคน: รายการกรองเฉพาะใบที่ตนสร้าง · เปิดใบคนอื่น 404 · งวดสัญญา/คิว/ประวัติการเงิน 403 | `p8_salesFinanceScope` · flow25-F |
| BD-04 | งวดสัญญาในหน้าการเงิน | IMPLEMENTED + TESTED | `GET /api/finance/installments` + แท็บ "งวดสัญญาเช่า" · สถานะชำระ/ครบกำหนด/ยอด/สัญญา/เอกสารบัญชี · ตัวกรอง · ยอดรวมเป็นสตางค์ · ยอดแยกจากใบเสนอราคา · อ่านอย่างเดียว ไม่รับรู้รายได้ | `p8_financeInstallments` · FE unit · flow25-B |
| BD-05 | แจ้งเตือน | IMPLEMENTED + TESTED (UI) | ไม่มี VAPID → ป้าย "ระบบยังไม่ได้ตั้งค่า" แทนปุ่ม · ไม่สร้าง LINE/Email | tsc/build · การส่งออกนอกระบบ **ไม่ได้ทดสอบ** |
| BD-06 | ประเภทเอกสาร | IMPLEMENTED + TESTED | คงประเภทเดิม (Phase 7) | flow24 |
| BD-07 | `/chats`, `/queue` ซ่อน | IMPLEMENTED + TESTED | คงตาม HIDE-01 ไม่ลบข้อมูล | flow24 |
| BD-09 | เลื่อนงานใช้ HOLD | IMPLEMENTED + TESTED | `jobs.postponements[]`: เหตุผล วันเดิม วันใหม่ ผู้ทำ เวลา · วันใหม่เติมตอนปล่อยงานรอบใหม่ · ไม่เพิ่ม enum · audit เดิมคงไว้ | `serviceQueue.test` (เพิ่ม assertion) |
| BD-10 | ช่างวางบิลจากมือถือ | IMPLEMENTED + TESTED | หน้า `/m/bills` ตาม design MBills · แถบล่าง "วางบิล" ชี้หน้านี้ · สร้าง/เซ็นส่งใช้หน้าบิลเดิม · ไม่มีปุ่มอนุมัติ/ออกเอกสาร (backend 403 ตาม Matrix TB-04..11) | FE unit · flow25-C |
| BD-11 | ข้อมูลพื้นฐาน | IMPLEMENTED + TESTED | ปิดใช้งาน (Admin = คำขออนุมัติ) · จัดลำดับ · จำนวนการใช้งานจริง · ตัวเลือกใหม่ไม่มีค่าที่ปิด · ข้อมูลเดิมไม่เปลี่ยน · ลบค่าที่ถูกอ้างอิงไม่ได้ (เดิม) | `p8_masterSoftDisable` · flow25-D |
| BD-14 | commit/push/deploy | — | ไม่ได้ทำ (ไม่ได้รับอนุญาต) | — |
| AC20 | ข้อมูลเดิม | IMPLEMENTED + TESTED (ตัวตรวจ + เส้นทางอ่านอย่างเดียว) · การตรวจข้อมูลจริง **รอ Owner รัน** | เพิ่มใน `runIntegrityAudit` (สคริปต์ `checkIntegrity` ใช้ `readOnlyDb`): Serial ซ้ำแบบไม่สนตัวพิมพ์ · เครื่อง TMP จาก KI-1 ที่ SN จริงมีแล้ว · ใบรับอ้างเครื่องไม่มี/ไม่ตรง · ไม่มีการแก้ข้อมูล | `p8_ac20IntegrityChecks` · `uatReady_ac20ReadOnlyPath` (ดูหัวข้อ 7) |

### OD-P4-01..06

| ID | คำถามเดิม | ผล |
|---|---|---|
| OD-P4-01 | เลขข้อของข้อกำหนดเพิ่มเติม (ต่อจากข้อ 5) | คงเดิม · Owner ยืนยัน UAT2-18 แล้ว · เทสต์ `p4_contractClauses` |
| OD-P4-02 | ต่อสัญญายกข้อกำหนดชุดเดิม | คงเดิม · เทสต์ "ต่อสัญญา → ฉบับใหม่ยกข้อกำหนด" มีอยู่แล้ว |
| OD-P4-03 | หน้า 1 มีที่ว่างเมื่อลายเซ็นย้าย | คงเดิม · Owner ยืนยันหน้าตา UAT2-17 แล้ว |
| OD-P4-04 | PDF ใบสรุปจากเซิร์ฟเวอร์ไม่มีข้อกำหนด | IMPLEMENTED + TESTED · สัญญาเช่า: PDF จากเซิร์ฟเวอร์เปลี่ยนหัวเป็น "สรุปข้อมูลสัญญาเช่า" + ระบุว่าไม่ใช่ฉบับลงนาม · ปุ่มเป็น "ดาวน์โหลดใบสรุปข้อมูล (PDF)" · ฉบับลงนาม = หน้าพิมพ์ต้นฉบับ/คู่ฉบับ (ฉบับเดียว) · ไม่แตะข้อความสัญญา · เช่าซื้อ/ขาย คงเดิม · `uatReady_contractGate` + flow27-A |
| OD-P4-05 | แก้ข้อกำหนดหลังออกสัญญา | คง 409 (ไม่ทำ amendment workflow ตามคำสั่ง) · `p4_contractClauses` + flow17 |
| OD-P4-06 | ช่องทางแจ้งเตือนภายนอก | = BD-05 |

### Design (14 board อนุมัติแล้ว)

| หน้า | ผลเทียบ | สถานะ |
|---|---|---|
| `/bills/new`, `/bills/[id]/edit` (ฟอร์มเดียวกัน) | ต่าง: สรุปยอดอยู่ท้ายฟอร์ม → แก้เป็นกล่องสรุปด้านขวาแบบ sticky พร้อมปุ่ม | IMPLEMENTED + TESTED (flow25-G) |
| `/bills/[id]/print` | ต่าง: ไม่มีเลขเอกสาร/สถานะในแถบเครื่องมือ ไม่มีพื้นเทา → แก้แล้ว (พิมพ์ออกเหมือนเดิม) | IMPLEMENTED + TESTED (flow27-B · fixture บิลช่างที่อนุมัติแล้ว) |
| `/documents/[id]` | ต่างเหมือนกัน → แก้แล้ว · รอบนี้แก้จำนวนเงินเป็น 2 ตำแหน่ง | IMPLEMENTED + TESTED (flow27-C) |
| `/quotations/[id]/edit` | ต่าง: หัวข้อไม่มี Rev · ปุ่มไม่บอกว่าจะสร้าง Rev ใหม่ → แก้แล้ว | IMPLEMENTED + TESTED |
| `/jobs/[id]/edit` | ตรง (ฟอร์มเดียวกับเปิดงาน · หัวข้อ + สถานะ + กลับ) | ไม่แก้ |
| P3 (12 หน้า) | เทียบกับ board ทีละหน้าแล้ว — ดูหัวข้อ 7.6 | VERIFIED (sandbox) · แก้ 1 จุด: จำนวนเงินบนเอกสารพิมพ์ |
| JobChat | ซ่อนตาม BD-07 | — |

## 2. API / DB ที่เพิ่ม (additive ทั้งหมด)

| Method | Path | สิทธิ์ |
|---|---|---|
| POST | `/api/equipment/receipts/:id/correct` | `equipment:create` (EQ-03) · แก้ต้นทุนต้องมี `finance:view` |
| POST | `/api/equipment/receipts/:id/cancel` | `equipment:create` (EQ-03) |
| GET | `/api/finance/installments` | `finance:view` (QT-06) |
| PATCH | `/api/master/:kind/:id/status` | `master:manage` (Admin = คำขออนุมัติ) |
| PUT | `/api/master/:kind/order` | `master:manage` |
| GET | `/api/master/:kind?withUsage=1` | เดิม |

ฟิลด์ใหม่ (ไม่มี migration):
- `equipment_receipts`: `lines[].unitCost/lineCost`, `totalCost`, `status`, `cancellations[]`, `revisions[]`, `version`
- `equipment`: `receiptCancelled`, `receiptCancelledAt`
- `jobs`: `postponements[]`
- `meta`: `disabled`, `disabledAt`, `sortOrder`

ไม่เปลี่ยน enum, เลขเอกสาร, ข้อความสัญญา หรือ PM

## 3. ผลทดสอบ (sandbox)

| ชุด | ผล | ก่อนรอบนี้ |
|---|---|---|
| Backend tsc / build | PASS / PASS | PASS |
| Backend vitest | **2,413 PASS · 0 FAIL · 242 SKIP** (191 ไฟล์) | 2,369 / 242 |
| Frontend tsc / build / ESLint | PASS / PASS / PASS (warning เดิม 1) | เท่าเดิม |
| Frontend unit | **354 / 354** | 350 |
| E2E flow1–25 | **540 PASS · 0 FAIL · 2 NOT VERIFIED** (flow25 ใหม่ 53 + 2 NV: ช่างอนุมัติบิลเอง/หน้าเอกสาร — ไม่มีข้อมูลใน fixture) | 487 / 0 |
| เครื่อง Owner | backend tsc PASS · frontend tsc PASS · `npm test` 354/354 | — |

242 SKIP = ไฟล์ `*.mongo.int.test.ts` 27 ไฟล์ ที่ต้องใช้ MongoDB จริง (replica set) — sandbox ดาวน์โหลด MongoDB ไม่ได้ (proxy ปฏิเสธ fastdl.mongodb.org) จึงยังไม่ได้รัน · ช่องว่างสำคัญ:
- transaction จริงของใบรับ/ยกเลิกใบรับ: ทดสอบแค่เส้นทาง rollback ของ fakeMongo
- QA-02f (KI-1) แก้ expectation แล้วแต่ยังไม่ได้รันกับ Mongo จริง
- index `uniq_serialKey` และ collation แบบไม่สนตัวพิมพ์

## 4. ข้อค้นพบ regression

- E2E รอบแรก: flow21, flow24 และ flow25 ล้ม เพราะ Next.js server เก่ายังทำงานขณะ build ใหม่ทับไฟล์ หน้าค้างที่ "กำลังตรวจสอบสิทธิ์" — เป็นปัญหาของ harness ไม่ใช่ของโค้ด
  - ปิด server แล้วรันใหม่ทั้งชุดบน server ใหม่ ได้ 540/0
  - เก็บ log รอบแรกไว้ที่ `e2e-run1-stale-server/`

- BD-03: ด่าน `router.param` ทำให้เซลล์ที่ไม่มีสิทธิ์ได้ 404 แทน 403 (4 เทสต์เดิม FAIL) → แก้ให้ตรวจเจ้าของเฉพาะเมื่อมีสิทธิ์ดู · เทสต์เดิมผ่าน
- BD-13: รอบแรกกระจายบรรทัดไม่ผูกเครื่องลงเครื่องด้วย (เทสต์ R8-M07 FAIL) → เปลี่ยนเป็นไม่เดา บรรทัดที่ไม่ระบุขอบเขตไม่ผูกเครื่อง · เทสต์เดิมผ่าน
- ไม่ได้ลบหรือลดเทสต์ใด · expectation ที่เปลี่ยนมี 2 จุด และเปลี่ยนตาม decision ที่อนุมัติ:
  - QA-02f (KI-1)
  - F-8 (BD-13 แยกบรรทัดส่วนลด)

## 5. ค้าง / Blocker จริง

1. **`docs/rbac-matrix/mapping.py` บนเครื่อง Owner เขียนไม่ได้** (Windows ปฏิเสธการเขียน — น่าจะเป็น Controlled Folder Access)
   - ไฟล์ใหม่อยู่ที่ `woms-backend/node_modules/.claude-tmp/p8x/docs/rbac-matrix/mapping.py`
   - `permissionMatrixData.ts` ที่ใช้งานจริงอัปเดตแล้ว แต่ถ้ารัน `gen.py` ก่อนคัดลอก mapping.py ทับ route ใหม่ 3 ตัวจะหายจาก Matrix
2. Real UAT: ยังไม่ deploy · ไม่มีหลักฐาน r8 · บัญชี QA-R2 ถูกปฏิเสธ (BLK-P4-01)
3. D07-D เวลารับรู้รายรับ / OD-P4-04 / OD-P4-05: เป็นนโยบายบัญชี/สัญญาที่ยังไม่อนุมัติ
4. AC20 กับฐานจริง: ต้องให้ Owner รัน `check-integrity-prod.bat` (อ่านอย่างเดียว) แล้วส่งผล
5. MongoDB จริงสำหรับ 27 ไฟล์ integration test

## 6. ความพร้อม (Phase 8 — ดูผลล่าสุดหัวข้อ 7)

โค้ดพร้อมให้ Owner review (sandbox ผ่านครบ) · **ยังไม่ใช่ READY FOR RELEASE**:
- ยังไม่ commit/deploy
- ยังไม่ทดสอบ UAT จริง
- ยังไม่ได้รัน integration test กับ MongoDB จริง

หลักฐาน sandbox: `Claude outputs/uat-round-2/r10-sandbox/`

---

## 7. รอบเตรียม UAT (15 พ.ย. 2569)

ไม่ได้ commit / push / merge / deploy · ไม่ได้แตะ Production / UAT data · ไม่ได้แก้ `check-integrity-prod.bat` · ไม่ได้แก้ข้อความสัญญา · ไม่ได้แก้ PM · ไม่ได้เปลี่ยนนโยบายบัญชี

### 7.1 โค้ดที่แก้

| Repo | ไฟล์ | เหตุผล |
|---|---|---|
| BE | `src/lib/contractQuotationPdf.ts` | OD-P4-04: PDF จากเซิร์ฟเวอร์ของสัญญาเช่า = "สรุปข้อมูลสัญญาเช่า" + หมายเหตุ "ไม่ใช่สัญญาฉบับลงนาม" (เดิมหัวเป็น "สัญญาเช่า" แต่ไม่มีข้อกำหนด = สัญญาฉบับที่สองที่ขัดกัน) |
| BE | `test/uatReady_contractGate.fake.test.ts` (ใหม่) | OD-P4-04 + สิทธิ์ดู/ออก PDF สัญญา |
| BE | `test/uatReady_ac20ReadOnlyPath.fake.test.ts` (ใหม่) | AC20 ทั้งเส้นทางของ `check:integrity` เป็นอ่านอย่างเดียว |
| BE | `.env.example` | เพิ่ม `GEO_REVERSE_PROVIDER`, `GEO_USER_AGENT`, `GOOGLE_MAPS_GEOCODING_KEY` (ฟอร์มเพิ่มลูกค้าใหม่) |
| FE | `src/components/ContractFilesCard.tsx`, `src/app/contracts/[id]/page.tsx` | ปุ่มสัญญาเช่าเป็น "ดาวน์โหลดใบสรุปข้อมูล (PDF)" + ข้อความบอกว่าฉบับลงนามพิมพ์จาก "หนังสือสัญญา / พิมพ์" |
| FE | `src/app/contracts/[id]/receipt/[no]/page.tsx`, `src/app/documents/[id]/page.tsx`, `src/app/quotations/[id]/document/page.tsx` | Defect: เอกสารการเงินที่พิมพ์แสดง `12,345.5` → แก้เป็น 2 ตำแหน่งเสมอ `12,345.50` (ตาม board QuotationDoc/Receipt) · หน้าจออื่นไม่เปลี่ยน |
| Harness | `flow27_uat_ready.py` (ใหม่, sandbox) | ปิด E2E gap 2 ข้อ + สัญญาข้อมูลยาว + หน้า P3 |

(งานฟอร์มเพิ่มลูกค้าใหม่ที่ทำก่อนหน้าในวันเดียวกัน: `thaiAddressDb.ts`, `thaiAddress.ts`, `mapGeo.ts`, `partners.ts` (`GET /api/partners/geo/thai-address`, `GET /api/partners/geo/map`), `QuickCustomerDialog.tsx` ฯลฯ — flow26)

### 7.2 RBAC mapping

| ขั้น | ผล |
|---|---|
| ต้นทาง/ปลายทาง | ต่างกัน 2 แถว: EQ-03 เพิ่ม `POST /api/equipment/receipts/:id/correct`, `/cancel` · QT-06 เพิ่ม `GET /api/finance/installments` (ครบ 3 route) |
| สำรอง | `node_modules/.claude-tmp/backup/mapping.py.pre-sync` |
| คัดลอกทับ | **BLOCKED** — Windows ปฏิเสธการเขียน (`Permission denied` · ตัวจัดการไฟล์ของแอปรายงาน read-only) · ไฟล์อื่นในโฟลเดอร์เดียวกันเขียนได้ → น่าจะเป็น attribute Read-only ของไฟล์นี้หรือ Controlled Folder Access · ไม่ได้ปิดระบบความปลอดภัย |
| สร้าง Matrix จาก mapping ใหม่ (สำเนาแยก) | `gen.py` ในโฟลเดอร์ชั่วคราว → ผล **ตรงกับ `permissionMatrixData.ts` ที่ใช้งานอยู่ทุกบรรทัด** (ไม่นับ CRLF) · 83 แถว · ไม่มีแถว "ตามเงื่อนไข" ที่ขาดข้อความ |
| เทสต์สิทธิ์ | `rbacMatrix.test` + `cfV11_ceoCustomRole` 106/106 · ชุดเต็ม BE ผ่าน |

Route geo 2 ตัวของฟอร์มเพิ่มลูกค้าไม่ได้อยู่ใน Matrix (เป็นตัวช่วยค้นที่อยู่ ใช้สิทธิ์ `partners:create` หรือ `customers:quick_create` · ผ่านเทสต์ "ทุก route มี guard")

### 7.3 MongoDB integration จริง

**BLOCKED** — ไม่ได้รัน 27 ไฟล์ (242 เทสต์)
- sandbox: ไม่มี docker/mongod · proxy ปฏิเสธ fastdl.mongodb.org / repo.mongodb.org / Docker Hub · การติดตั้ง mongod จาก conda-forge ถูกระบบตรวจสิทธิ์ปฏิเสธ
- VM บนเครื่อง Owner: ไม่มี docker/mongod
- ไม่ใช้ MongoDB ใน `.env` ของเครื่อง Owner เพราะชี้ฐาน UAT จริง (`test/setup.ts` + `testDbGuard` ปฏิเสธ host ที่ไม่ใช่ localhost อยู่แล้ว)

หัวข้อที่ยังไม่ได้ยืนยันกับ Mongo จริง: Queue → JN relink · serial ซ้ำ/ index ไม่สนตัวพิมพ์ · ใบรับ/ยกเลิก/ยกเลิกบางเครื่อง · rollback แบบ transaction · concurrency/idempotency · stock reservation · AC38 · RBAC · QA-02f / F-8 (ทุกข้อผ่านบน fakeMongo แล้ว)

### 7.4 AC20 ตรวจข้อมูลเดิม

| ตรวจ | ผล |
|---|---|
| `check-integrity-prod.bat` → `npm run check:integrity` + `npm run backfill:customer-refs` (ไม่มี `--mapping`/`--apply`) | ทั้งสองใช้ `readOnlyDb()` · ไม่มีคำสั่งเขียน/สร้าง index/ลบ · `$out`/`$merge`/`db.command` ถูกปฏิเสธ |
| ปลายทาง | `MONGO_URI` ถามตอนรัน ไม่บันทึกไฟล์ · `MONGO_DB` ค่าเริ่ม `woms` · ผลพิมพ์ชื่อฐานที่ตรวจ · ล้างค่า URI เมื่อจบ |
| ผลลัพธ์ | เขียนเฉพาะ `prod-reports\` ในเครื่อง (มีชื่อลูกค้าจริง — อย่า commit) · ไม่มี URI ในรายงาน |
| ข้อสังเกต | `set /p` แสดง URI บนหน้าจอขณะพิมพ์ (ไม่บันทึกลงไฟล์) |
| fixture | `uatReady_ac20ReadOnlyPath`: Serial ซ้ำ/ไม่สนตัวพิมพ์ · TMP ที่ควรใช้เครื่องจริง · ใบรับ ↔ เครื่อง · สาขา/ลูกค้าไม่ตรง · อ้างอิงย้อนหลัง (เอกสาร/ใบงาน/สัญญา) · ไม่มีคำสั่งเขียนถึงฐาน · ข้อมูลไม่เปลี่ยน · PASS |

### 7.5 สัญญา (layout 6 หน้า Owner ยอมรับแล้ว — ไม่ได้แก้ layout)

| ข้อ | ผล |
|---|---|
| 1 ต้นฉบับ/คู่ฉบับ เนื้อหาเดียวกันยกเว้นหัว | PASS (เทียบข้อความทุกแผ่น · flow27-A + `rentalContract.test`) |
| 2 ข้อตกลง 1–15 | PASS |
| 3 ข้อกำหนดเพิ่มเติมเลขต่อ 6.. | PASS (flow17 · `contractClauses.test`) |
| 4 Data mapping | PASS (`rentalContract.test`) · ค่าเช่า 12,345.50 + ตัวอักษร |
| 5 ชื่อ/ที่อยู่ยาว | PASS — ไม่ถูกตัด ไม่ล้นขอบแผ่น ไม่มีคำเตือนล้นหน้า |
| 6 PDF คงที่ | PASS — จำนวนหน้า = จำนวนแผ่น · พิมพ์ซ้ำได้ข้อความเท่ากัน |
| 7 ผู้มีสิทธิ์ออก PDF | PASS (manager/sales/ceo) · ACC ดูได้แต่พิมพ์ไม่ได้ (ไม่มี `contracts:print` — OD-7 เดิม) |
| 8 ผู้ไม่มีสิทธิ์ | PASS — ช่าง/คลัง 403 ทั้งดูและ PDF · Matrix CTR-01 ไม่มีขอบเขตรายลูกค้า (เซลล์ VIEW_ONLY ทุกสัญญา) |
| 9 เลขที่สัญญา | ใช้ `CT-YYYY-NNNN` ของระบบตามเดิม · รูปแบบ `IR…` ยังเป็น OD-1 ที่ไม่มีหลักฐานอนุมัติ → ไม่เปลี่ยน |
| OD-P4-04 / 05 | ดูหัวข้อ OD-P4 ด้านบน |

### 7.6 Design P3 (เทียบ board ใน artifact ENTECH Redesign)

| หน้า | ผล |
|---|---|
| Roles | ตรง: รายการบทบาท + ตารางสิทธิ์ ดู/สร้าง/แก้ไข/อนุมัติ/ส่งออก · admin เปิดตรงได้ข้อความไม่มีสิทธิ์ (SET-02) |
| Settings | ตรง (การ์ดตามสิทธิ์ผู้ใช้) |
| Reports | ข้อมูลครบกว่า board (การ์ด + ตัวกรอง + Export Excel) |
| BillDetail | ครบ: สถานะ, ปุ่มตรวจ/พัก/ตีกลับ/อนุมัติ, ยอด, ใบงาน, ประวัติ, ลายเซ็นช่าง · layout เป็นแถวแทนคอลัมน์ข้าง |
| QuotationNew | ข้อมูลครบ · สรุปยอดอยู่ท้ายฟอร์มแทนกล่องด้านขวา — ไม่แก้ (ไม่กระทบการใช้งาน) · ช่องต้นทุน/แพ็กเกจ PM ใน board เป็นงานธุรกิจใหม่ |
| QuotationDoc / Receipt | ตรง · แก้จำนวนเงินเป็น 2 ตำแหน่ง |
| Map | ตรง: ชั้นข้อมูล + สัญลักษณ์ + ตัวกรอง (แผนที่จริงโหลดไม่ได้ใน sandbox) |
| GroupChat | ตรง: รายการกลุ่ม + ข้อความ + แนบไฟล์ + เปิดคิว |
| MQueue | อยู่ในแท็บคิวของ `/m` (390px ไม่ล้น) |
| MBooking | ซ่อนตาม HIDE-01 (`NEXT_PUBLIC_FEATURE_TECH_QUEUE`) — ทดสอบว่าไม่รั่วข้อมูล |
| MJobNew | ช่างไม่มี `jobs:create` (DN-07) → ข้อความไม่มีสิทธิ์ · ผู้จัดการเห็นฟอร์มที่ 390px |
| 6 หน้าบิล/เอกสาร/ใบงาน | `/bills/new`, `/bills/[id]/edit`, `/quotations/[id]/edit`, `/jobs/[id]/edit` ผ่าน · `/bills/[id]/print`, `/documents/[id]` ปิด NOT VERIFIED แล้ว |

ทุกหน้า 1440px และ 390px: ไม่ล้นแนวนอน · ไม่มี page error / 5xx

### 7.7 ผลทดสอบ (sandbox)

| ชุด | ผล |
|---|---|
| Backend tsc / build | PASS / PASS |
| Backend vitest | **2,430 PASS · 0 FAIL · 242 SKIP** (194 ไฟล์ผ่าน · 27 ไฟล์ Mongo จริงข้าม) |
| Frontend tsc / build / ESLint | PASS / PASS / PASS (warning เดิม 1) |
| Frontend unit | **357 / 357** |
| E2E flow1–27 (reseed ครั้งเดียว, server ใหม่) | **608 PASS · 0 FAIL · 0 Traceback** · NOT VERIFIED 2 บรรทัดใน flow25 (fixture ตอนนั้นไม่มีบิล/เอกสาร) ปิดด้วย flow27-B/C ในรอบเดียวกัน |
| เครื่อง Owner | backend tsc PASS · frontend tsc PASS · `npm test` 357/357 · ไฟล์ตรง sha256 ทุกไฟล์ |

หลักฐาน: `Claude outputs/uat-round-2/r10-sandbox/uat-ready/` (`e2e-uat/` log ทุก flow · `uat/` ภาพ/PDF สัญญาข้อมูลยาว · `p9/` ฟอร์มลูกค้า)

### 7.8 UAT release package (ยังไม่ deploy)

| รายการ | สถานะ |
|---|---|
| Build | BE `npm run build` · FE `next build` ผ่าน |
| Env ใหม่ | BE: `GEO_REVERSE_PROVIDER`, `GEO_USER_AGENT`, `GOOGLE_MAPS_GEOCODING_KEY` (ไม่ตั้งก็รันได้ — ดึงที่อยู่จาก map ไม่ได้จะขึ้นข้อความให้ค้นจากรหัสไปรษณีย์) · FE: ไม่มีใหม่ |
| Index | ไม่มี index ใหม่ในรอบนี้ · index เดิมสร้างโดย repo ตอนใช้งาน · `uniq_serialKey` ต้องผ่าน `migrate:serialkey` (เดิม) |
| Backward compatibility | ฟิลด์ใหม่ Phase 8 เป็น optional ทั้งหมด ไม่มี migration · ไม่เปลี่ยน enum/เลขเอกสาร |
| RBAC | runtime ถูกต้อง · ไฟล์ `mapping.py` รอ Owner คัดลอก |
| ลำดับ deploy | 1) backup Atlas (snapshot UAT) 2) ตั้ง env BE บน Render 3) merge BE → main (Render deploy) 4) health check 5) merge FE → main (Vercel) 6) smoke test |
| Rollback | Render/Vercel: Redeploy commit ก่อนหน้า · ไม่มีการเปลี่ยน schema จึงไม่ต้อง restore ฐาน · restore snapshot เฉพาะเมื่อข้อมูลเสีย |
| Health check | `GET /health` (BE) · เปิดหน้า login (FE) |
| Smoke test | login 6 บทบาท · คิว → เปิด JN (SN ในคลัง) · ปิดงาน · รับเครื่อง + ยกเลิกบางเครื่อง · สัญญาเช่า พิมพ์ต้นฉบับ/คู่ฉบับ · ใบเสนอราคาส่วนลดท้ายใบ · การเงินแท็บงวด · ช่างวางบิลจากมือถือ · เพิ่มลูกค้าใหม่จากลิงก์ Google Maps |
| บัญชีทดสอบ UAT | ยังใช้บัญชี QA-R2 ไม่ได้ (BLK-P4-01) |

### 7.9 Readiness gates

| Gate | ผล |
|---|---|
| RBAC | runtime ถูกต้อง + เทสต์ผ่าน · ไฟล์ต้นทาง `mapping.py` **BLOCKED** (Owner คัดลอก) |
| DB | **BLOCKED** — ยังไม่ได้รัน Mongo จริง |
| AC20 | PASS (อ่านอย่างเดียวพิสูจน์ด้วย fixture) · ผลข้อมูลจริงรอ Owner |
| CONTRACT | PASS |
| E2E | PASS — 0 FAIL · NOT VERIFIED เดิมปิดแล้ว |
| DESIGN | PASS (sandbox) |
| REGRESSION | PASS |
| BUILD | PASS |
| SECURITY | PASS (fakeMongo + E2E) |
| UAT PACKAGE | เตรียมแล้ว (ยังไม่ deploy) |
| D07-D เวลารับรู้รายรับ | **รอ Owner ตัดสินใจ** — คงพฤติกรรม ACCEPTED เดิม |

~~สรุปเดิม: READY WITH EXPLICIT NON-BLOCKING EXCEPTIONS~~ → แทนด้วยหัวข้อ 8.5: **NOT READY FOR UAT DEPLOYMENT** (RBAC mapping + MongoDB integration เป็น blocker)

### 7.10 สิ่งที่ Owner ต้องทำ

1. คัดลอก RBAC mapping (PowerShell ที่ `C:\Users\user\Desktop\Project\woms-backend`)
   ```
   attrib docs\rbac-matrix\mapping.py
   attrib -R docs\rbac-matrix\mapping.py
   Copy-Item node_modules\.claude-tmp\p8x\docs\rbac-matrix\mapping.py docs\rbac-matrix\mapping.py -Force
   python docs\rbac-matrix\gen.py
   git diff --stat -- src/domain/permissionMatrixData.ts
   ```
   ผลที่คาด: `gen.py` พิมพ์ `83 conditional-without-text: []` และ `git diff` ของ `permissionMatrixData.ts` ไม่เปลี่ยน · ถ้ายังเขียนไม่ได้: Windows Security → Ransomware protection → Allow an app through Controlled folder access (อนุญาตเฉพาะ app ที่ใช้คัดลอก) หรือคัดลอกด้วย File Explorer
2. MongoDB integration (Docker Desktop · replica set ทดสอบบนเครื่อง ไม่ใช่ UAT)
   ```
   docker run -d --name woms-test-rs -p 127.0.0.1:27018:27018 mongo:7 --replSet rs0 --port 27018 --bind_ip_all
   docker exec woms-test-rs mongosh --port 27018 --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27018'}]})"
   $env:MONGO_RS_URI="mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true"
   $env:MONGO_TEST_URI=$env:MONGO_RS_URI
   npx vitest run mongo.int
   docker rm -f woms-test-rs
   ```
   ส่งผล (จำนวน PASS/FAIL และข้อที่ FAIL) กลับมา
3. AC20 กับข้อมูลจริง: ดับเบิลคลิก `check-integrity-prod.bat` ใช้ MongoDB user สิทธิ์ `read` อย่างเดียว · ตั้ง `MONGO_DB` ให้ตรงฐานก่อนรันถ้าไม่ใช่ `woms` · ส่ง `prod-reports\integrity.md` (ไม่ commit)
4. ตัดสินใจ D07-D เวลารับรู้รายรับ
5. ตัดสินใจ OD-1 รูปแบบเลขที่สัญญา (`CT-YYYY-NNNN` เดิม หรือ `IR…`)
6. ตั้ง env geo บน Render (ถ้าต้องการดึงที่อยู่จาก map) แล้วทดสอบด้วยลิงก์ร้านจริง
7. review diff → commit/push/merge/deploy ตามลำดับ 7.8 (OWNER-MANAGED)

---

## 8. แก้ blocker ก่อน UAT (15 พ.ย. 2569 ค่ำ) — แทนข้อสรุปหัวข้อ 7.9 (ผลล่าสุดดูหัวข้อ 9)

ไม่ได้แก้ source code ของระบบในรอบนี้ (แก้เฉพาะ `test/setup.ts` และ `docs/rbac-matrix/gen.py` — หัวข้อ 9) · ไม่ได้ commit / push / deploy · ไม่ได้แตะ UAT/Production · ไม่ได้ปิดระบบความปลอดภัยของ Windows

### 8.1 RBAC `mapping.py` — **PASS** (Owner คัดลอกแล้ว 15 พ.ย. 22:49)

| ขั้น | ผล |
|---|---|
| SHA256 | ต้นทาง `node_modules/.claude-tmp/p8x/.../mapping.py` = `7ae78b26…c6a4b9` · ปลายทาง `docs/rbac-matrix/mapping.py` = `add4b72d…0ef2` |
| ส่วนที่ต่าง | EQ-03 + `POST /api/equipment/receipts/:id/correct`, `/cancel` · QT-06 + `GET /api/finance/installments` |
| สำรอง | มีแล้ว `node_modules/.claude-tmp/backup/mapping.py.pre-sync` (ไม่เขียนทับ) |
| คัดลอกทับ (`cp`) | `Permission denied` · เปิดไฟล์แบบเขียนอย่างเดียวก็ถูกปฏิเสธ (`open r+b` errno 13) · `gen.py` / `.json` ในโฟลเดอร์เดียวกันเขียนได้ · ตัวจัดการไฟล์ของแอปรายงานไฟล์นี้เป็น read-only → เป็นการกันที่ฝั่ง Windows เฉพาะไฟล์นี้ (attribute Read-only หรือ ACL) · ตรวจ ACL/Controlled Folder Access จาก VM ไม่ได้ |
| gen.py กับ mapping ใหม่ (สำเนาแยก) | ผลตรงกับ `permissionMatrixData.ts` ทุกบรรทัด (ตรวจไว้รอบก่อน) · ไม่ได้รัน `gen.py` กับไฟล์ปลายทางเดิม |
| เทสต์สิทธิ์ | 7 ไฟล์ 159/159 PASS |
| สาเหตุที่เขียนไม่ได้ | `attrib` แสดง `A R` = ไฟล์มี attribute **Read-only** · Owner ใช้ `attrib -R` แล้วคัดลอก |
| หลังคัดลอก | `mapping.py` = `7ae78b26…c6a4b9` ตรงต้นทาง |
| `gen.py` บน Windows | ล้มที่ `UnicodeDecodeError` (Python บน Windows อ่านไฟล์เป็น cp1252) → ไม่ได้เขียนอะไร · แก้ `gen.py` ให้เปิดไฟล์ทุกตัวด้วย `encoding="utf-8"` (สำรองเดิมที่ `node_modules/.claude-tmp/backup/gen.py.pre-utf8`) |
| สร้าง Matrix ใหม่จาก `mapping.py` ที่ sync แล้ว | `83 conditional-without-text: []` · ผล**ตรงกับ `permissionMatrixData.ts` ปัจจุบันทุกบรรทัด** · เทียบกับ HEAD: 83 แถวเท่ากัน · ไม่มี perm/route หาย · ไม่มี level เปลี่ยน · มีแต่ route ที่เพิ่ม (receipts + installments) |
| เทสต์สิทธิ์หลัง sync | 6 ไฟล์ 169/169 PASS |

### 8.2 MongoDB integration จริง — **BLOCKED**

| ตรวจ | ผล |
|---|---|
| sandbox + VM บนเครื่อง Owner | ไม่มี docker / mongod / mongosh |
| เครือข่าย (ทั้งสองที่) | `fastdl.mongodb.org`, `repo.mongodb.org`, Docker Hub = 403 จาก proxy |
| conda-forge `mongodb-7.0.34` | ดาวน์โหลดได้ + sha256 ตรง repodata (`e2523cbf…535d`) แต่การติดตั้ง/รันไบนารีที่ดาวน์โหลด (และ micromamba) ถูกระบบตรวจสิทธิ์ปฏิเสธ 2 ครั้ง → หยุด ไม่หาทางเลี่ยง |
| `.env` ของเครื่อง Owner | ไม่ใช้ (ชี้ UAT) |
| ตัวรันค้นพบไฟล์ครบหรือไม่ | ตั้ง `MONGO_RS_URI` ชี้ port ที่ไม่มี server → vitest เปิดและพยายามต่อ **31 ไฟล์ `*.mongo.int`** (27 ไฟล์ที่ปกติ SKIP + 4 ไฟล์ที่มีเทสต์ไม่ต้องใช้ฐาน) · ทุกไฟล์หยุดที่ ECONNREFUSED ตามคาด · **ไม่นับเป็น PASS** |
| ไฟล์ที่ execute กับ replica set จริง | **0 / 27** · PASS 0 · FAIL 0 · ยัง SKIP 242 |

เตรียมสคริปต์ให้ Owner: `woms-backend/node_modules/.claude-tmp/run-mongo-int.ps1` — ใช้ Docker Desktop (`mongo:7.0`) ถ้ามี ไม่มีก็ใช้ `mongod.exe` + `mongosh` ใน PATH · ตั้ง replica set ทดสอบ port 27018 บน 127.0.0.1 · ลบ `MONGO_URI` ออกจาก environment ก่อนรัน · รัน `npx vitest run mongo.int` · ลบ container/โฟลเดอร์ทดสอบเมื่อจบ · ผลอยู่ที่ `node_modules\.claude-tmp\mongo-int-result.txt`

### 8.3 AC20 — PASS (ตรวจโค้ด + fixture)

- `check-integrity-prod.bat` → `check:integrity` + `backfill:customer-refs` (ไม่มี `--mapping`/`--apply`) ใช้ `readOnlyDb` · ไม่มีเขียน/สร้าง index/migration/ล้างข้อมูล
- ทดสอบ URI ที่มีรหัสผ่านปลอม 3 แบบ (ต่อไม่ได้ / SRV ไม่มีจริง / รูปแบบผิด) กับทั้งสองสคริปต์: ข้อความ error **ไม่มีรหัสผ่าน** · รายงานพิมพ์แค่ชื่อฐาน
- ข้อสังเกตเดิม: `set /p` แสดง URI ขณะพิมพ์บนหน้าจอ (ไม่ลง log/ไฟล์) · ไม่ได้แก้ไฟล์ .bat ตามข้อกำหนดเดิมของ Owner
- fixture: `uatReady_ac20ReadOnlyPath` + `p8_ac20IntegrityChecks` + `readOnlyDb` PASS · ครบ 6 หมวด (serial ซ้ำ/ไม่สนตัวพิมพ์ · TMP ผิด · ใบรับ↔เครื่อง · ลูกค้า/สาขาไม่ตรง · อ้างอิงย้อนหลัง)

### 8.4 Regression (sandbox · รันจริงรอบนี้)

| ชุด | ผล |
|---|---|
| Backend tsc / build | PASS / PASS |
| Backend vitest | 2,430 PASS · 0 FAIL · 242 SKIP (SKIP = integration ที่ยังไม่มี Mongo) |
| Frontend tsc / build / ESLint | PASS / PASS / PASS (warning เดิม 1) |
| Frontend unit | 357 / 357 |
| E2E flow1–28 (reseed + server ใหม่) | **630 PASS · 0 FAIL · 0 Traceback** · NOT VERIFIED 2 บรรทัดใน flow25 ปิดด้วย flow27-B/C ในรอบเดียวกัน |

### 8.5 ความพร้อม

| Gate | ผล |
|---|---|
| RBAC | **PASS** (mapping.py sync + generator ยืนยันแล้ว) |
| MongoDB | **BLOCKED** (0/27 ไฟล์ execute) |
| AC20 | PASS |
| Backend / Frontend | PASS |
| E2E | PASS |
| Security | PASS (ไม่มี regression สิทธิ์) |
| Contract | คงตามที่อนุมัติ |
| UAT Package | พร้อม (หัวข้อ 7.8) |

~~NOT READY FOR UAT DEPLOYMENT — เหลือ blocker เดียว: MongoDB integration~~ → ปิดแล้ว ดูหัวข้อ 9.5: **READY FOR UAT DEPLOYMENT**

### 8.6 Owner ต้องทำ

1. ~~RBAC mapping~~ — ทำแล้ว · ถ้าจะรัน `gen.py` เองบน Windows ใช้ `python docs\rbac-matrix\gen.py` ได้แล้ว (แก้ encoding แล้ว) · คำสั่งเดิม:
   ```
   attrib docs\rbac-matrix\mapping.py
   attrib -R docs\rbac-matrix\mapping.py
   Copy-Item node_modules\.claude-tmp\p8x\docs\rbac-matrix\mapping.py docs\rbac-matrix\mapping.py -Force
   python docs\rbac-matrix\gen.py
   git diff --stat -- src/domain/permissionMatrixData.ts
   ```
   ผลที่คาด: `83 conditional-without-text: []` และ `permissionMatrixData.ts` ไม่เปลี่ยน · ถ้า `Copy-Item` ยังถูกปฏิเสธ: ดู Security tab ของไฟล์ (คลิกขวา → Properties) หรือ Windows Security → Protection history ว่า Controlled folder access บล็อกโปรแกรมใด แล้วอนุญาตเฉพาะโปรแกรมนั้น
2. ติดตั้ง Docker Desktop หรือ MongoDB Community Server 7.0 + mongosh แล้วรัน
   ```
   powershell -ExecutionPolicy Bypass -File node_modules\.claude-tmp\run-mongo-int.ps1
   ```
   แล้วแจ้งให้ Claude อ่าน `node_modules\.claude-tmp\mongo-int-result.txt` เพื่อแก้ defect ที่พบ

---

## 9. MongoDB integration จริง — ผ่านครบ (15 พ.ย. 2569 23:14)

### 9.1 สภาพแวดล้อม

Owner รัน `node_modules\.claude-tmp\run-mongo-int.ps1` บนเครื่อง Owner · Docker Desktop `mongo:7.0` · replica set ชั่วคราว `rs0` ที่ `127.0.0.1:27018` · ไม่ใช้ `MONGO_URI` ใน `.env` (ชี้ UAT) · ลบ container เมื่อจบ · ไม่แตะ UAT/Production

### 9.2 รอบที่ 1 (22:54) — 13/31 ไฟล์ผ่าน · 187 PASS · 58 FAIL

| ต้นเหตุ | จำนวน | การแก้ |
|---|---|---|
| Timeout: 31 ไฟล์รันพร้อมกันกับ mongod ตัวเดียวใน Docker บน Windows เกินค่าเริ่ม 5 วินาที | 36 + ผลต่อเนื่อง (ข้อมูลขั้นต้นไม่ถูกสร้าง → BSONError, `/equipment/undefined`, `jobEquipmentId` ว่าง, null) | ตัวรันเท่านั้น: `--no-file-parallelism --testTimeout=60000 --hookTimeout=120000` · ไม่แก้ assertion |
| `.env` ของเครื่อง Owner ตั้ง R2 (ถัง `woms-uat`) → เทสต์พยายามอัปโหลดไฟล์ไปถังจริง → network guard ปฏิเสธ → 503 `STORAGE_UNAVAILABLE` | ~10 (chatTimeline, rbacMatrix, vfbClose, pmMonthly, finalDelivery, phaseD) | **defect ของ test isolation**: `test/setup.ts` เพิ่ม T-3 ตั้ง `R2_*` และ `VAPID_*` เป็นค่าว่างก่อน dotenv โหลด (หลักเดียวกับ T-1 ของ MongoDB) · พิสูจน์ใน sandbox: ใส่ค่า R2 แบบ `.env` → setup เดิม unit test FAIL 157 ข้อ · หลังแก้ 2,430 PASS / 0 FAIL |

log รอบแรกเก็บที่ `Claude outputs/uat-round-2/r10-sandbox/mongo-int/mongo-int-result.run1.txt`

### 9.3 รอบที่ 2 (23:14) — **31/31 ไฟล์ · 245 PASS · 0 FAIL · 0 SKIP** · exit code 0 · 105.7 วินาที

ไฟล์ที่ execute กับ replica set จริง: ทั้ง 27 ไฟล์ที่เดิม SKIP + 4 ไฟล์ที่เดิมรันอยู่แล้ว · รวม Queue → JN relink, QA-02f (`eq02QaGate`), serial ซ้ำ/index ไม่สนตัวพิมพ์, transaction rollback/concurrency/unique index (`replset`), ใบรับ/backfill, stock, AC38/F-8 (`cfV11_phaseF`), RBAC route จริงทุก Role (`rbacMatrix`, `cfV11_r9_rbacScope`), ความเข้ากันได้ย้อนหลัง (`odMig01`, `equipmentBackfill`) · ข้อที่รอบแรกสงสัยว่าเป็น defect (RS-06, caretakerNotify, F-5) ผ่าน = เกิดจากเครื่องรับโหลดไม่ไหว

log: `Claude outputs/uat-round-2/r10-sandbox/mongo-int/mongo-int-result.txt`

### 9.4 Regression หลังแก้ `test/setup.ts`

| ชุด | ผล |
|---|---|
| Backend vitest (sandbox) | 2,430 PASS · 0 FAIL · 242 SKIP (SKIP = ไฟล์ integration ที่ต้องมี replica set — รันบนเครื่อง Owner แล้วตาม 9.3) |
| Backend vitest + ค่า R2/VAPID แบบ `.env` | 2,430 PASS · 0 FAIL |
| Backend tsc (เครื่อง Owner) | PASS |
| E2E flow1–28 / Frontend | ไม่กระทบ (`test/setup.ts` ใช้เฉพาะ vitest backend) · ผลล่าสุด 630/0 · 357/357 |

### 9.5 ความพร้อม

| Gate | ผล |
|---|---|
| RBAC | PASS — mapping.py sync · generator ยืนยัน · ไม่มีสิทธิ์หาย |
| MongoDB | PASS — 31/31 ไฟล์ · 245/245 บน replica set จริง |
| AC20 | PASS — อ่านอย่างเดียว · ไม่รั่ว URI |
| Backend / Frontend | PASS |
| E2E | PASS |
| Security | PASS |
| Contract | คงตามที่อนุมัติ |
| UAT Package | พร้อม (หัวข้อ 7.8) |

**READY FOR UAT DEPLOYMENT**

เรื่องที่ยังเปิดอยู่ (ไม่ขวาง deploy · พฤติกรรมเดิมคงไว้):
- D07-D เวลารับรู้รายรับ — รอฝ่ายบัญชี
- OD-1 รูปแบบเลขที่สัญญา (`CT-YYYY-NNNN` เดิม)
- AC20 กับข้อมูลจริง — Owner รัน `check-integrity-prod.bat` ด้วย user สิทธิ์ read
- บัญชีทดสอบ QA-R2 (BLK-P4-01) · ทดสอบดึงที่อยู่จาก Google Maps จริงหลัง deploy
- commit / push / merge / deploy = OWNER-MANAGED ตามลำดับหัวข้อ 7.8
