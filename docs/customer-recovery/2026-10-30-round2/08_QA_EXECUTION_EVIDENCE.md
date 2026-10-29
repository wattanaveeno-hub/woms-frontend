# 08 · QA Execution Evidence (Round 2)

ผลในเอกสารนี้มาจากการรันจริงรอบสุดท้ายเท่านั้น · log/JSON/screenshot อยู่ใน `evidence/final-run/` (log เก็บเป็น `.log.txt` เพื่อให้อยู่ใน git) · ไม่มีการนำผล Round 1 หรือรอบระหว่างพัฒนามานับ

## Environment

```
date: 2026-10-30T02:55:04+07:00
backend: 242f6431e2cf7ce96d6799c0c3a85d470e0d4eb7 fix/customer-recovery-2026-10-29 dirty_files=0
frontend: 439465fa616271cdc5a63742e03a237709236bf7 fix/customer-recovery-2026-10-29 dirty_files=0
node: v22.23.4 · mongod: db version v8.0.23 · replica set rs0 @127.0.0.1:27017 (isolated QA container, no production access)
playwright: 1.63.0 chromium
done 2026-10-30T03:03:06+07:00
```

สภาพแวดล้อม: container Linux แยกสำหรับ QA · MongoDB replica set ภายในเครื่อง · API รันจาก source ที่ port 8100 · FE `next build` standalone port 3100 · DB แยกต่อชุดทดสอบ (`woms_qa_r2f_*`) สร้างใหม่ทุกครั้ง · ไม่มีการเข้าถึง production

## ผลแต่ละชุด

| ชุด | คำสั่ง | เริ่ม–จบ (+07:00) | Exit | Executed | Passed | Failed | Skipped | Log / ผล |
|---|---|---|---|---|---|---|---|---|
| be-typecheck | `npm run typecheck` | 02:55:04–02:55:19 | 0 | – | – | – | – | `be-typecheck.log.txt` |
| be-build | `npm run build` | 02:55:19–02:55:37 | 0 | – | – | – | – | `be-build.log.txt` |
| be-test | `npm run test (vitest, fakeMongo)` | 02:55:37–02:56:48 | 0 | 1232 | 1214 | 0 | 18 | `be-test.log.txt` |
| be-real-db | `MONGO_RS_URI=… MONGO_TEST_URI=… npx vitest run replset/dashboard/vfbClose .mongo.int.test.ts` | 02:56:48–02:56:57 | 0 | 18 | 18 | 0 | 0 | `be-real-db.log.txt` |
| fe-typecheck | `npm run typecheck` | 02:56:57–02:57:00 | 0 | – | – | – | – | `fe-typecheck.log.txt` |
| fe-test | `npm run test` | 02:57:00–02:57:02 | 0 | 90 | 90 | 0 | 0 | `fe-test.log.txt` |
| fe-test-tz | `npm run test:tz (TZ=UTC และ Asia/Bangkok)` | 02:57:02–02:57:06 | 0 | 180 | 180 | 0 | 0 | `fe-test-tz.log.txt` |
| fe-build | `NEXT_PUBLIC_API_BASE=http://localhost:8100 npm run build` | 02:57:06–02:57:55 | 0 | – | – | – | – | `fe-build.log.txt` |
| fe-lint | `npm run lint` | 02:57:55–02:57:56 | 1 | – | – | – | – | `fe-lint.log.txt` |
| api-security-matrix | `node security-matrix.mjs` | 02:58:11–02:58:19 | 0 | 17 scenarios / 137 checks | 17 / 137 | 0 / 0 | 0 | `api-security-matrix.log.txt` |
| api-qa-r2 | `node api-qa-r2.mjs` | 02:58:31–02:58:40 | 0 | 12 scenarios / 82 checks | 12 / 82 | 0 / 0 | 0 | `api-qa-r2.log.txt` |
| api-qa-r1-regression | `node api-qa-r1-regression.mjs` | 02:58:53–02:59:01 | 0 | 18 scenarios / 120 checks | 18 / 120 | 0 / 0 | 0 | `api-qa-r1-regression.log.txt` |
| e2e-r2 | `node e2e-r2.mjs (Chromium)` | 02:59:14–03:01:55 | 0 | 13 scenarios / 74 checks | 13 / 74 | 0 / 0 | 0 | `e2e-r2.log.txt` |
| e2e-r1-regression | `node e2e-r1-regression.mjs (Chromium)` | 03:02:08–03:03:04 | 0 | 7 scenarios / 71 checks | 7 / 71 | 0 / 0 | 0 | `e2e-r1-regression.log.txt` |
| preflight-legacy | `legacy-fixtures.mjs + preflight-readonly.mjs + preflight-proof.mjs` | 03:03:04–03:03:05 | 0 | – | – | – | – | `preflight-legacy.log.txt` |
| preflight-qa-db | `preflight-readonly.mjs (ฐาน QA หลัง E2E)` | 03:03:05–03:03:06 | 0 | – | – | – | – | `preflight-qa-db.log.txt` |

หมายเหตุตาราง:
- **be-test** 18 skipped คือไฟล์ `*.mongo.int.test.ts` 3 ไฟล์ (dashboard 7, replset 7, vfbClose 4) ซึ่งข้ามเมื่อไม่มี `MONGO_TEST_URI` และรันจริงในแถว **be-real-db** (18/18) กับ MongoDB replica set
- **fe-lint** exit 1 = **NOT TESTED — ไม่ได้ตั้งค่า**: `next lint` ถามให้เลือก config แบบ interactive เพราะ repo ไม่มี ESLint config/dependency · ไม่ได้ติดตั้งเพิ่มใน repo · ทดลองติดตั้งใน scratch copy พบ 1 error (`useCols` ถูกตีความเป็น React hook) + 6 warnings (`evidence/fe-lint-trial-scratch.log.txt`) · **ไม่นับว่าผ่าน**
- จำนวน scenario/check มาจากไฟล์ JSON ของรอบนี้ ไม่ได้พิมพ์เอง · ทุก scenario ต้องผ่านทุก check จึงนับ PASS

## Preflight อ่านอย่างเดียว (รอบนี้)

| ชุด | ฐานข้อมูล | ผล |
|---|---|---|
| preflight-legacy | `woms_qa_r2f_legacy` — สร้าง legacy fixture ที่ฝังปัญหาไว้รู้จำนวน (`legacy-fixtures.mjs`) | พบครบทุกข้อที่ฝังไว้ PF-01..PF-10 (`preflight-legacy.json`) · `preflight-proof.mjs`: hash ของทุก collection ก่อน/หลังรันเท่ากัน (`identical true`) = สคริปต์ไม่เขียนข้อมูล |
| preflight-qa-db | ฐาน E2E หลังรัน `woms_qa_r2f_e2e` | PF-01..06, 08, 09 = 0 · PF-07 = 5 ใบงาน OPEN ที่ยังไม่มอบหมายช่าง (สร้างโดย E2E ระหว่างทดสอบคิว) · PF-10 = 2 ช่างทดสอบไม่มีคลังรถ — ทั้งสองข้อเป็นข้อมูลทดสอบ ไม่ใช่ข้อบกพร่อง |

ยังไม่ได้รันกับ production/UAT — ดู 09

## หลักฐานก่อนแก้ (ยืนยันว่า test จับ defect ได้จริง)

| Defect | วิธี | ผลบนโค้ดก่อนแก้ | ไฟล์ |
|---|---|---|---|
| BUG-V2-17 และกลุ่ม Round 2 | unit ชุด Round 2 รันบน `992072c` | 16/17 ล้ม | `evidence/r2-unit-on-992072c.log.txt` |
| R2-F09, F10, F11 | unit รันบน `f457998` | 3 + 1 ล้ม | `evidence/r2-f09-f10-unit-on-f457998.log.txt` |
| R2-F12, F13 | unit บน `ea0cf62` · API SEC-CON-02 บน `ea0cf62` | 2 ล้ม · 4 checks ล้ม (2 ACTIVE ใน 3/5 รอบ) | `evidence/r2-f12-f13-unit-on-ea0cf62.log.txt`, `dev-runs/sec-r2f12-on-ea0cf62.json` |
| R2-F14 | unit + API SEC-CON-03 บน `f93098b` | 1 ล้ม · 3 checks ล้ม | `evidence/r2-f14-unit-on-f93098b.log.txt`, `dev-runs/sec-r2f14-on-f93098b.json` |
| R2-F15 | unit + API SEC-CON-04 บน `0a10e18` | 1 ล้ม · 1 check ล้ม (2 ACTIVE) | `evidence/r2-f15-unit-on-0a10e18.log.txt`, `dev-runs/sec-r2f15-on-0a10e18.json` |
| BUG-V2-21 race กลุ่มแชท | หลายโปรเซส 10 รอบ ไม่มี unique index | ก่อนแก้: 2 ใน 3 รอบมีกลุ่มซ้ำ · หลังแก้: 0/10 | `race/race-mp-fix-predup.json`, `race/race-mp-fix2-predup.json` |
| QA-F06 | E2E-R2-02 ก่อนแก้ FE | ล้ม (R2-D1, R2-D2) | `dev-runs/e2e-dev2-before-QA-F06-fix/` |

หมายเหตุ: unit test race ของ R2-F12 ผ่านบนโค้ดก่อนแก้ด้วย เพราะ fakeMongo ไม่สลับลำดับคำขอ — หลักฐาน race ใช้ API จริง (SEC-CON-02) เท่านั้น

## ประวัติการรันเต็มชุด (ไม่นับเป็นผล)

| รอบ | Backend | ผล | เหตุที่รันใหม่ |
|---|---|---|---|
| run-pre | `f457998` ก่อนปรับ test | be-real-db ล้ม 1 (I5 คาดยอดเงินช่าง 2800 — พฤติกรรมเดิมที่ตั้งใจเปลี่ยนเป็น null) | ปรับ assertion พร้อมเหตุผลใน test |
| run-final | `f457998` | ผ่านทุกชุด (ยกเว้น lint) | ผู้ตรวจอิสระพบ R2-F09..F11 |
| run-final2 | `ea0cf62` | ผ่านทุกชุด | ผู้ตรวจพบ R2-F12, F13 |
| run-final3 | `f93098b` | ผ่านทุกชุด | ผู้ตรวจพบ R2-F14 |
| run-final4 | `0a10e18` | ผ่านทุกชุด | ผู้ตรวจพบ R2-F15 |
| **run-final5** | **`242f643`** | **ผลในเอกสารนี้** | ผู้ตรวจไม่พบรายการใหม่ |

SUMMARY.tsv ของแต่ละรอบ: `evidence/dev-runs/run-final*-SUMMARY.tsv` · บทเรียน: ชุดทดสอบของทีมพัฒนาผ่านทุกรอบ แต่ผู้ตรวจอิสระยังพบ defect ใหม่ 4 รอบติด — ผลผ่านของชุดทดสอบเองไม่ใช่หลักฐานว่าไม่มี defect

## Independent QA (ผู้ตรวจแยก)

| รอบ | Backend | Scenario / Check | ผล |
|---|---|---|---|
| 1 | `9553b0e` | 18 / 91 | พบ R2-F01..F08 |
| 2 | `f457998` | 24 / 119 | F01..F08 แก้แล้วยืนยัน · พบ F09..F11 |
| 3 | `ea0cf62` | 8 / 14 | F09..F11 ยืนยัน · พบ F12, F13 |
| 4 | `f93098b` | 6 / 13 | F12, F13 ยืนยัน · พบ F14 |
| 5 | `0a10e18` | 4 / 7 | F14 ยืนยัน · พบ F15 |
| 6 | `242f643` | 5 / 11 · ล้ม 0 | F15 ยืนยัน · กวาดทุกเส้นทางที่เขียน `contracts.serial/status` ไม่พบที่เหลือ |

รายงานเต็มและผลดิบ: `evidence/independent-qa-r2/` · ผู้ตรวจใช้ API แยก (port 8104) และ DB แยกทุกรอบ

## ข้อจำกัด (ไม่ได้ทดสอบ)

- Browser: Chromium (Playwright) เท่านั้น · ไม่ได้ทดสอบ Safari/iOS, Firefox, อุปกรณ์มือถือจริง (ใช้ viewport มือถือใน E2E ช่าง)
- ข้อมูลสังเคราะห์และ legacy fixture ที่สร้างเอง · ไม่มีสำเนาข้อมูลจริง
- เครือข่ายขาดระหว่างใช้งาน, การอัปโหลดไฟล์ใหญ่, PDF ตรวจข้อความ (ผู้ตรวจตรวจด้วยการอ่านโค้ด), import Excel พร้อมกับสร้างสัญญา (5 รอบไม่เกิดการชนจริง)
- QA-C4 หน้าแก้ใบงาน, CHAT-01, FB-07, FB-22 — NOT TESTED (ดู 03/05)
- ไม่มี UAT environment — ทุกผลเป็นของ QA container
