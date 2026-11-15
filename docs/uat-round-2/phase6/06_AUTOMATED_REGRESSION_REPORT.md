# 06 — Automated Regression Report (Phase 6 / Master Execution)

> ตำแหน่งหลักฐาน: `evidence/r8/…` ในเอกสารนี้อยู่ที่ `Claude outputs/uat-round-2/r8-sandbox/…` บนเครื่อง Owner (แยกจาก `r8/` ซึ่งสงวนไว้สำหรับหลักฐาน UAT จริง)

วันที่: 2026-11-14 · สภาพแวดล้อม: sandbox (backend fake :8100 = fakeMongo + fixture, frontend `next start` :3100) · ไม่ใช้ข้อมูลจริง ไม่ใช้รหัสผ่านจริง
ผลทุกข้อในเอกสารนี้เป็น **AUTOMATED PASS** เท่านั้น ไม่ใช่ REAL UAT VERIFIED

## 1. สรุป

| ชุด | ผล | Baseline Phase 5 | หลักฐาน |
|---|---|---|---|
| Backend `tsc --noEmit` | **PASS** (0 error) | PASS | `evidence/r8/be-tsc.log` |
| Backend build (`tsc -p tsconfig.json`) | **PASS** | PASS | `evidence/r8/be-build.log` |
| Backend vitest (unit / integration / authorization / contract / job workflow) | **2,361 PASS · 0 FAIL · 242 SKIP** (210 ไฟล์: 183 pass, 27 skip) | 2,361 / 242 | `evidence/r8/be-vitest.log` |
| Frontend `tsc --noEmit` | **PASS** (0 error) | PASS | `evidence/r8/fe-tsc.log` |
| Frontend `next build` | **PASS** | PASS | `evidence/r8/fe-build.log` |
| Frontend lint | **PASS** — 1 warning เดิม (`users/page.tsx:116` exhaustive-deps, มีก่อนรอบนี้) | — | `evidence/r8/fe-lint.log` |
| Frontend unit (`npm test`) | **348 PASS · 0 FAIL · 0 SKIP** | 342 / 0 | `evidence/r8/fe-tests.log` |
| E2E flow1–21 รันต่อเนื่องรอบเดียว (reseed ครั้งเดียวตอนเริ่ม) | **400 PASS · 0 FAIL · 0 NOT VERIFIED** | 353 / 0 (flow1–19) | `evidence/r8/e2e-final/` |
| บนเครื่อง Owner หลัง sync: FE `tsc` + `npm test` | **PASS** · 348/348 | — | 05 ส่วน 2 |

ส่วนต่างจาก baseline
- FE unit +6: `moneyInput` +4 และ `userFilter` +2
- E2E +47: flow20 Numeric 25 และ flow21 Design 22
- flow1–19 ยังเท่าเดิม 353 PASS

Backend ไม่มีไฟล์เปลี่ยนในรอบนี้ จำนวนจึงเท่า baseline
- SKIP 242 เป็นชุดเดิมที่ต้องใช้ MongoDB จริงหรือ env เฉพาะ
- ไม่มีการเพิ่ม skip และไม่มีการลด assertion

## 2. E2E รายชุด (รอบสุดท้าย รันต่อเนื่อง 20:22–21:11)

| Flow | ขอบเขต | PASS | FAIL | NOT VERIFIED |
|---|---|---|---|---|
| flow1 | ลูกค้า: สร้าง/รหัสถัดไป/ค้นหา/ตัวกรอง | 13 | 0 | 0 |
| flow2 | แก้ข้อมูล → คำขออนุมัติ | 5 | 0 | 0 |
| flow3 | คิว: สร้าง/มอบหมาย/คิวของช่าง | 11 | 0 | 0 |
| flow4 | ช่างรับทราบงานบนมือถือ | 8 | 0 | 0 |
| flow5 | ฟอร์มลูกค้า: required/ซ้ำ | 8 | 0 | 0 |
| flow6 | UAT2-08/09/10 เลือกเครื่อง/รูปหน้างาน | 21 | 0 | 0 |
| flow7 | UAT2-06 ทีมเซลล์ | 16 | 0 | 0 |
| flow8 | UAT2-01 ปฏิทินว่าง/ไม่ว่าง | 4 | 0 | 0 |
| flow9 | สัญญา: ร่าง/สรุปงวด | 7 | 0 | 0 |
| flow10 | ช่องเงินเดิม (ไม่มี 0 นำหน้า) | 5 | 0 | 0 |
| flow11_jobnew | เปิดใบงาน | 9 | 0 | 0 |
| flow12_reports | Dashboard/รายงานตามบทบาท | 12 | 0 | 0 |
| flow13_closeevidence | หลักฐานปิดงาน | 14 | 0 | 0 |
| flow14_jobs | รายการใบงานตาม design | 15 | 0 | 0 |
| flow15_contracts | สัญญา: list/งวดค้าง (UAT2-17) | 17 | 0 | 0 |
| flow16_customers | Customers design | 10 | 0 | 0 |
| flow17_clauses | ข้อกำหนดเพิ่มเติม (UAT2-18) | 110 | 0 | 0 |
| flow18_defr501_roles | DEF-R5-01 / DEF-P5-01 ตามบทบาท | 46 | 0 | 0 |
| flow19_contract_approval | DEF-P5-02 / อนุมัติข้อกำหนด | 22 | 0 | 0 |
| flow20_numeric | Numeric input (ใหม่) | 25 | 0 | 0 |
| flow21_design | หน้าที่ปรับตาม design (ใหม่) | 22 | 0 | 0 |
| **รวม** | | **400** | **0** | 0 |

รายการที่ Master Prompt สั่งให้ครอบคลุม
- DEF-R5-01, DEF-P5-01 → flow18 (46)
- DEF-P5-02 → flow19 (22)
- UAT2-17 → flow15 (17)
- UAT2-18 → flow17 (110) และ flow19
- Numeric → flow20 (25) และ flow10 (ช่องเงินเดิม)
- หน้าที่เปลี่ยนตาม design → flow21 (22)

## 3. Numeric — ครอบคลุมตามที่สั่ง

| กรณี | Unit | E2E |
|---|---|---|
| placeholder 0 (และมองเห็นได้จริง) | ✓ | flow20 |
| พิมพ์ 50000 = 50000 | ✓ | flow20, ภาพก่อน/หลัง |
| 0 ที่ตั้งใจ | ✓ | flow20 |
| ค่าที่บันทึกแล้ว | ✓ | flow20 (โหลดใหม่) |
| ทศนิยม | ✓ | flow20 (1500.50, พิกัด "13.") |
| ค่าลบ (เฉพาะช่องที่อนุญาต) | ✓ | flow20 |
| ล้างช่อง | ✓ | flow20 |
| required validation | — | flow20 (รุ่นเครื่อง required) |
| ค่าที่ส่ง API | — | flow20 (50000 / 1500.5 / 0) |
| แก้ไขรายการเดิม | ✓ | flow20 |
| แป้นมือถือ (inputmode) | — | flow20 (390px) |
| regression รายรับ/ค่าใช้จ่าย | — | flow20 + flow10 + flow6/flow9 (ช่องเงินในบิล/สัญญา) |

## 4. ข้อบกพร่องที่พบระหว่างรอบ

- **OBS-P6-01**: placeholder ถูกซ่อน พบจากภาพหลังแก้รอบแรก
  - แก้ใน `NumberInput` และเพิ่ม assertion ใน flow20
  - ยืนยันว่า assertion ใหม่ **FAIL** บน build ก่อนแก้ แล้วรัน E2E ทั้งชุดใหม่ (ผลในตารางข้างบน)
- รอบแรก (`evidence/r8/e2e/`, ก่อนแก้ OBS-P6-01) ได้ flow1–20 377/0 และ flow21 22/0 (รันแยก) — เก็บไว้เป็นประวัติ

## 5. ข้อจำกัด

- E2E ใช้ backend จำลอง (fakeMongo) ไม่ได้ทดสอบ Atlas จริง
- vitest ของ backend รันบนเครื่อง Owner ไม่ได้ (node_modules ของ Windows) — ใช้ผล sandbox ซึ่งเป็นโค้ดชุดเดียวกัน (ตรวจ sha256 ใน Phase 5 และรอบนี้ไม่มีไฟล์ backend เปลี่ยน)
- ภาพก่อน/หลังใช้สำเนาโค้ดก่อนแก้ที่ build แยก ไม่ใช่ commit ใน repo
