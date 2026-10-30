# 09 · Data Integrity Report (Round 3)

## ส่วนที่เพิ่มตาม directive 30 ต.ค. 69

**ยังไม่ได้แตะข้อมูล UAT/production** — เข้า MongoDB Atlas ไม่ได้จาก session นี้และจากเครื่องที่เชื่อม (BACKUP_DEPLOYMENT_EVIDENCE) · ไม่มี reset/ลบข้อมูล · ไม่แก้ราคาย้อนหลัง · ไม่คำนวณรายรับย้อนหลัง

| เรื่อง | ผลต่อข้อมูลเดิม | ตรวจด้วย |
|---|---|---|
| D-11 | collection ใหม่ทั้งหมด (`quotation_payments`, `accounting_documents`, `finance_files`) · ใบเสนอราคาเดิมอ่านเป็น revision 1 · สถานะเดิมไม่เปลี่ยน · EXPIRED เดิมอ่านได้ | FIN-10, unit finance |
| Q-R3-14 | ราคาเดิมใน Model Index ไม่แก้ · งานเดิม (ไม่มี snapshot) คิดแบบเดิม + ป้าย "ข้อมูลเดิม" · master เดิมอ่านเป็น `UNAPPROVED` | PRICE (งานเดิมไม่เปลี่ยน · เทียบก่อน/หลัง) |
| Q-R3-10 | วิธีคิดมูลค่าสต๊อกเดิมคงอยู่จนอนุมัติ · รายงานเดิมไม่คำนวณใหม่ | DEC-04 |
| Q-R3-13 | ใบงานที่ปิดแล้วไม่ถูกแก้ · revision เก็บฉบับเดิม | JOB-R13 |
| Q-R3-04 | เปลี่ยนเฉพาะ `mustChangePassword` (+ `tokenVersion` ถ้าเลือก) ไม่แตะ hash · idempotent | DEC-05 |
| Activity Log | แถวเดิมใน `audit_logs` คงอยู่ · ฟิลด์ใหม่ optional · ไม่มี endpoint แก้/ลบ | ACT-API-13 |
| D-07B | เขียนเฉพาะ MATCHED ตาม dry-run · backup + journal + rollback | D07_MIGRATION_EVIDENCE |

Preflight / backup / restore / migration บน UAT: **NOT TESTED — BLOCKED (ENVIRONMENT)** · สคริปต์และขั้นตอนพร้อม (UAT_DEPLOYMENT_RUNBOOK)

---

## ประวัติ: data integrity ณ final-5


**ไม่ได้ตรวจข้อมูล production** — ไม่มีสิทธิ์เข้าถึงและไม่ได้รับอนุญาต · ผลด้านล่างมาจากฐาน QA ในเครื่องทดสอบเท่านั้น
Round 3 **ไม่มี migration ที่เขียนข้อมูลเดิม** · ไม่แก้ข้อมูลลูกค้า เครื่อง การเงิน หรือ PM ย้อนหลัง

## 1. ผลต่อข้อมูลเดิมรายข้อ

| ข้อ | ข้อมูลเดิม | ระบบทำอย่างไร | ตรวจด้วย |
|---|---|---|---|
| D-04 | ผู้ใช้ไม่มี `tokenVersion` / `mustChangePassword` | อ่านเป็น 0 / false — token เดิมยังใช้ได้จนกว่าจะ reset/เปลี่ยนรหัส | PF-R3-06 (นับผู้ใช้) |
| D-05 | คิวเดิมอาจขาดผู้ติดต่อ/เบอร์/ที่อยู่ | ไม่ตรวจย้อนหลัง · ตรวจเฉพาะคิวใหม่/ร่างที่ส่ง | PF-R3-04 (DRAFT ก่อน deploy ควร 0) |
| D-06 | รหัสลูกค้าเดิมยาว > 4 (เช่น I2228, IR085) | คงไว้ · แก้ข้อมูลอื่นของลูกค้าได้ · เปลี่ยนรหัสต้องตามกติกาใหม่ | PF-R3-03 |
| D-10 | บรรทัดเครื่องในงานติดตั้งไม่มี `installedOn` | **ไม่ backfill** · งานที่ปิดแล้วไม่เปลี่ยน · งานที่ยังเปิดและเครื่องบันทึกเสร็จแล้ว ปิดงานไม่ได้จนกว่าจะกรอกวันติดตั้งจริง | PF-R3-01 (ต้องจัดการก่อนปิด) · PF-R3-02 (ประวัติ) |
| D-12 | คิว PM เดิมมี `pmItemId` ตัวเดียว | อ่าน `pmItemIds ?? [pmItemId]` | unit round3Queue |
| D-14 | ข้อความแชทเดิม | ไม่เปลี่ยน · ยกเลิกได้ตามกติกาใหม่ | — |
| D-15 | สาขาไม่มี `subdistrict` | ไม่แสดง · ไม่แก้ `addressFull` เดิม | R3-D15-D19 |
| D-18 | บันทึกประวัติเครื่อง/Audit เดิมมีข้อความ "× จำนวน @ ต้นทุน" | ไม่แก้ข้อมูล · ซ่อนตอนอ่านสำหรับผู้ไม่มีสิทธิ์ (JSON และ PDF) | PF-R3-05 · SEC-R3-05 |
| D-09 | ไม่มีงาน `INSTALL_HIRE_PURCHASE` เดิม | ประเภทใหม่ | PF-R3-07 |
| D-07A | ไม่มี collection `equipment_models` · เครื่องเดิมไม่มี `modelMasterId` · ประเภทเดิมบางค่าอาจไม่อยู่ในรายการ (เช่น "ตู้เย็น") | collection ว่างจนกว่าจะ seed · ไม่มี master = ไม่บังคับความสัมพันธ์ (รุ่นนอก master ผ่านตามเดิม) · ประเภทเดิมที่ไม่เปลี่ยนแก้ฟิลด์อื่นได้ (ADV3-04/05) · เปลี่ยนเป็นประเภทนอกรายการใหม่ไม่ได้ · seed เพิ่มรุ่น/หมวดหมู่ใน master เดิม (meta) ถ้ายังไม่มี — **ไม่แก้ราคา/ประเภทใน Model Index** (ADV3-01 / Q-R3-14) | D07A-04/06/07 · ADV3-T1/T2 |

## 2. Preflight อ่านอย่างเดียว (`preflight-readonly.mjs`) — ผลรอบ final

ใช้ได้เฉพาะ find / aggregate / countDocuments / listIndexes · `preflight-proof.mjs` เทียบจำนวนเอกสารและ index ทุก collection ก่อน/หลัง → `identical: true`

### 2.1 Legacy fixture (`woms_qa_r3f_legacy` — ใส่ข้อมูลผิดแบบตั้งใจ)
| Check | คาด | ได้ |
|---|---|---|
| PF-01 กลุ่มแชทซ้ำ | 1 | 1 |
| PF-02 unique index ที่ขาด | ≥ 3 | 4 |
| PF-03 คิว READY_TO_OPEN ค้าง | 1 | 1 |
| PF-04 อ้างเครื่องที่ไม่มีอยู่ | 4 | 4 |
| PF-05 ตาราง PM อ้างอิงผิด | 3 | 3 |
| PF-06 ใบเสนอราคา ↔ ใบงาน | 3 | 3 |
| PF-07 ฟิลด์เดิมขาด/ผิดรูปแบบ | ≥ 4 | FINDINGS |
| PF-08 Serial ซ้ำ / สัญญาซ้ำ | 2 | FINDINGS |
| PF-09 ผู้รับผิดชอบไม่ใช่ช่างที่ใช้งาน | ≥ 3 | FINDINGS |
| PF-R3-01 งานติดตั้งเปิดอยู่ เครื่องเสร็จแต่ไม่มีวันติดตั้ง | 1 | 1 |
| PF-R3-02 งานติดตั้งปิดแล้วไม่มีวันติดตั้ง (ข้อมูลประวัติ) | 1 | 1 (INFO) |
| PF-R3-03 รหัสลูกค้าเดิมไม่ตรงรูปแบบใหม่ | 1 | 1 (INFO) |
| PF-R3-04 คิว DRAFT | 0 | 0 |
| PF-R3-05 บันทึกเดิมมีต้นทุน | 1 | 1 (INFO) |
| PF-R3-06 / 07 | 0 | 0 |

### 2.2 ฐาน QA หลังทดสอบ (`woms_qa_r3f_e2e3`)
ทุก check = 0 ยกเว้น PF-07 / PF-10 (ข้อมูล seed ของ QA: ช่างที่ไม่มีงาน/คลังรถ) และ PF-R3-04 = 1 (ร่างคิวที่ E2E-R3-02 สร้างเอง — คาดไว้)

ไฟล์: `evidence/final-*/preflight-legacy.json`, `preflight-qa-db.json`, `preflight-readonly-proof.json`

## 3. D-07A — Equipment Model Master: seed และ mapping (QA เท่านั้น)

สคริปต์ `src/scripts/equipmentModels.ts` (`npm run equipment-models -- seed|map|rollback`)

| ขั้น | พฤติกรรม | ตรวจด้วย |
|---|---|---|
| seed (ค่าเริ่มต้น dry-run) | อ่าน collection ตรง ไม่สร้าง index · รายงาน create / existing / priceDiffers / duplicateInFile / invalid · `--apply` สร้างเฉพาะที่ยังไม่มี · ราคาไม่ตรงกับของเดิม **ไม่ทับ** (ต้องแก้ผ่านหน้าข้อมูลหลัก/คำขออนุมัติ) · รันซ้ำไม่สร้างเพิ่ม | D07A-01 · E2E-D07A-20 |
| map (ค่าเริ่มต้น dry-run) | จับคู่รุ่นแบบตรงตัวหลัง normalize (ตัดช่องว่าง/อักขระมองไม่เห็น ไม่สนตัวพิมพ์) **ไม่ fuzzy** · สถานะ MATCHED / ALREADY_MAPPED / AMBIGUOUS / CONFLICT / UNMAPPED / NO_MODEL · CSV + JSON พร้อมจำนวน · `--apply` เขียนเฉพาะ MATCHED: `modelMasterId` + เติมประเภท/หมวดหมู่ที่ **ว่างอยู่** เท่านั้น (เงื่อนไขในคำสั่งเขียน) · ไม่แก้ค่า `model` เดิม · backup EJSON ก่อนเขียน + รายการเปลี่ยนรายฟิลด์ | D07A-05 · D07A-07 |
| rollback | คืนเฉพาะฟิลด์ที่สคริปต์เขียน และเฉพาะแถวที่ค่ายังเป็นค่าที่สคริปต์เขียน · แถวที่ถูกแก้หลัง mapping ไม่แตะ → รายงาน CONFLICT + exit 3 · backup รูปแบบเก่า (ไม่มีรายการเปลี่ยน) ถูกปฏิเสธ | D07A-05 (byte-identical) · D07A-07 |
| ตัวป้องกัน | เขียนได้เฉพาะฐาน `woms_qa_*` **และ** host = localhost หรือ host ที่ระบุตรงตัวด้วย `--allow-host` · อื่น ๆ exit 2 | D07A-01 · D07A-05 · D07A-07 |

ผล dry-run ของ QA (ข้อมูลสังเคราะห์) อยู่ใน `evidence/final-run-5/d07a-script-reports/` · **ไม่ได้รันกับข้อมูลจริง** — การจับคู่ข้อมูลเดิมที่ไม่ชัดเจนและการย้ายข้อมูล production คือ D-07B (รอลูกค้า)

ข้อมูลประวัติ: แก้ราคา/ปิดใช้งานรุ่นใน master ไม่แก้เครื่อง คิว ใบงาน หรือ Model Index (sha256 ก่อน/หลัง เท่ากัน · D07A-06) · เครื่องที่อ้างรุ่นที่ปิดใช้งานยังเปิดดูและแก้ฟิลด์อื่นได้

## 3b. D-07 เดิม (เครื่องมือ `d07/*`) — ปัจจุบันเป็นส่วนของ D-07B

ทดสอบกับฐานสังเคราะห์ `woms_qa_r3_d07` เท่านั้น (mapping ในชุดทดสอบเป็นค่าสมมุติ ไม่ใช่กติกาธุรกิจ) — 16/16 checks:
- extract ไม่เขียน (sha256 ของทุก collection เท่าเดิม) · พบค่าสะกดต่าง รุ่นไม่อยู่ใน master master ที่ไม่ถูกใช้ ประเภทขัดกัน และเครื่องที่ข้อมูลขาด
- dry-run ด้วยแม่แบบว่าง → invalid (exit 1) ไม่เขียน · dry-run ที่ถูกต้องคำนวณแผนแต่ไม่เขียน
- `--apply` บนฐานชื่อ `woms` → REFUSED (exit 2)
- apply บนฐาน QA แก้เฉพาะ machineType/category/model ตาม mapping · ฟิลด์อื่นและชนิดข้อมูลคงเดิม · สร้าง master ที่ขาด
- rollback จาก backup EJSON → ทุก collection byte-identical กับก่อน apply

ขั้นตอนกับข้อมูลจริง (ยังไม่ทำ): backup + ทดสอบ restore → extract กับสำเนา → ลูกค้ากรอก mapping → dry-run → ลูกค้าอนุมัติผล dry-run → apply ในช่วงปิดระบบ → ตรวจ → เก็บ backup ไว้สำหรับ rollback

## 4. สิ่งที่ต้องทำกับข้อมูลจริงก่อน deploy (ต้องได้รับอนุญาต)
1. backup production + ทดสอบ restore
2. รัน `preflight-readonly.mjs` ด้วยผู้ใช้ MongoDB สิทธิ์ `read` เท่านั้น · แนบผล `preflight-proof`
3. ทบทวน PF-R3-01: แจ้งช่าง/Admin ให้กรอกวันติดตั้งจริงของงานที่เปิดค้าง (ระบบไม่เติมให้)
4. ทบทวน PF-01 (กลุ่มแชทซ้ำ) ตาม M-01 ของ Round 2 ก่อนเปิดใช้ unique index
