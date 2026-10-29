# 08 · QA Execution Report

รายงานเฉพาะสิ่งที่รันจริงในรอบนี้ (29–30 ต.ค. 2569) · ไม่มีการนำผลรอบก่อนมาใช้ · log/JSON/screenshot อยู่ใน `evidence/`

## Environment

| รายการ | ค่า |
|---|---|
| เครื่อง | Linux cloud container แยกสำหรับ QA (ไม่เข้าถึง production) |
| Node | v22.23.4 |
| MongoDB | 8.0.23 replica set `rs0` ที่ 127.0.0.1:27017 · DB แยกต่อการรัน `woms_qa_*` |
| Backend | รันจาก source (`tsx src/index.ts`) port 8100 (fix) · 8101 (baseline `main` ผ่าน git worktree) · 8102 (independent QA) |
| Frontend | `next build` standalone · `NEXT_PUBLIC_API_BASE=http://localhost:8100` · port 3100 |
| Browser | Chromium (Playwright 1.63.0) · desktop 1280×720 · Pixel 7 |

## 1. Baseline (ก่อนแก้)

| คำสั่ง | วันเวลา | Commit | Exit | ผล | Log |
|---|---|---|---|---|---|
| BE `npm run typecheck` | 2026-10-29 23:13 | 611ee4d | 0 | ผ่าน | evidence/baseline/be-typecheck.log |
| BE `npm run build` | 23:13 | 611ee4d | 0 | ผ่าน | be-build.log |
| BE `npm run test` | 23:14 (สิ้นสุด) | 611ee4d | 0 | 1195 tests: 1177 passed · 0 failed · 18 skipped (3 ไฟล์ DB จริงถูก skip) | be-test.log |
| BE DB จริง `MONGO_RS_URI=… vitest run test/replset.mongo.int.test.ts` | 23:16 | 611ee4d | 0 | 7/7 | be-mongo-int.log |
| BE DB จริง `MONGO_TEST_URI=… vitest run dashboard + vfbClose` | 23:16 | 611ee4d | **1** | 11 tests: 10 passed **1 failed** (vfbClose IT2) | be-mongo-int2.log |
| FE `npm run typecheck` | 23:14 | af8afe4 | 0 | ผ่าน | fe-typecheck.log |
| FE `npm run test` / `test:tz` | 23:15 | af8afe4 | 0 / 0 | 83/83 ทั้งสองแบบ | fe-test.log, fe-test:tz.log |
| FE `npm run build` | 23:16 | af8afe4 | 0 | ผ่าน | fe-build.log |
| FE `npm run lint` | 23:16 | af8afe4 | **1** | **BLOCKED — ENVIRONMENT/CONFIG**: ESLint ยังไม่ได้ตั้งค่าในโปรเจกต์ (`next lint` ถามแบบ interactive) | fe-lint.log |
| API+DB QA (`api-qa.mjs`, 14 scenarios, 93 checks) | 23:50 | 611ee4d (port 8101) | 0 | **FAIL — REPRODUCED 11 · ERROR 1 · PASS 2** · 48 checks ล้ม | api-qa-baseline-full.log/json |

เวลาในตาราง = เวลาแก้ไขไฟล์ log (เวลาไทย) · หมายเหตุ baseline API QA: ใช้ script ก่อนเพิ่มชุด QA-REV-* · QA-PM03-02 error เพราะ endpoint เสนอวันจาก PM ไม่มี (404) · defect QA-F01..F18 ถูก reproduce โดย independent QA บน branch ก่อนแก้รอบสอง (`evidence/independent-qa/`)

## 2. Final (หลังแก้ — commit สุดท้าย)

Backend `992072c` · Frontend `ab465af` · เริ่ม 2026-10-30 00:34:55 (+07:00) · `evidence/final-v2/ENV.txt`

| คำสั่ง | Exit | Executed | Passed | Failed | Skipped | Log |
|---|---|---|---|---|---|---|
| BE `npm run typecheck` | 0 | – | – | – | – | final-v2/be-typecheck.log |
| BE `npm run build` | 0 | – | – | – | – | final-v2/be-build.log |
| BE `npm run test` (vitest, fakeMongo) | 0 | 1204 | 1186 | 0 | 18* | final-v2/be-test.log |
| BE DB จริง 3 ไฟล์ (`MONGO_RS_URI`+`MONGO_TEST_URI`) | 0 | 18 | 18 | 0 | 0 | final-v2/be-mongo-int.log |
| FE `npm run typecheck` | 0 | – | – | – | – | final-v2/fe-typecheck.log |
| FE `npm run test` | 0 | 87 | 87 | 0 | 0 | final-v2/fe-test.log |
| FE `npm run test:tz` (UTC + Asia/Bangkok) | 0 | 87×2 | 174 | 0 | 0 | final-v2/fe-test:tz.log |
| FE `npm run build` | 0 | – | – | – | – | final-v2/fe-build.log |
| FE `npm run lint` | – | – | – | – | – | NOT TESTED — ESLint ไม่ได้ตั้งค่า (เหมือน baseline) |
| API+DB QA `node api-qa.mjs http://localhost:8100 woms_qa_v2final` | 0 | 18 scenarios / 120 checks | 18 / 120 | 0 | 0 | final-v2/api-qa.log, api-qa.json |
| Browser E2E `node e2e.mjs woms_qa_v2final_e2e` | 0 | 7 scenarios / 71 checks | 7 / 71 | 0 | 0 | final-v2/e2e.log, e2e/e2e-result.json, 18 screenshots |

\* 18 skipped = 3 ไฟล์ทดสอบ DB จริงที่ต้องตั้ง env — รันแยกแล้วในแถวถัดไป (18/18)

### การรันซ้ำเพื่อความเสถียร
- DB จริง 3 ไฟล์ หลังแก้ BUG-V2-12: รันต่อเนื่อง 5 รอบ = 18/18 ทุกรอบ (ก่อนแก้ล้ม 3/3 รอบที่สังเกต)
- E2E: รัน 3 รอบบน commit `bea098c` / `992072c` (r1, r2, final-v2) = 7/7 ทุกรอบ · ตรวจ `chat_groups` ไม่มีซ้ำและมี `uniq_group_key`
- `qa/race-groups.ts`: 12 รอบ baseline + 12 รอบ fix — ไม่มีซ้ำทั้งคู่ (ไม่สามารถ reproduce แบบกำหนดได้)

## 3. Independent QA review

ผู้ตรวจแยก (ไม่ได้เห็นการให้เหตุผลของผู้แก้) ทดสอบกับ API port 8102 / DB `woms_qa_review` บน commit `789938e` (BE) / `9aff3bd` (FE): 24 scenarios, >150 checks · ผ่าน 15 · พบ defect จากการรันจริง 18 (High 1, Medium 7, Low 10) + ข้อสงสัยจากโค้ด 7 · ไม่พบ Critical · รายงาน `evidence/INDEPENDENT_QA_REVIEW.md`
หลังแก้ (commit `992072c`/`ab465af`) ข้อที่แก้ได้ถูกทดสอบซ้ำด้วยชุด QA-REV-* (API+DB) = PASS · ข้อที่ยังเปิดอยู่ดู `06_BUG_REGISTER.md`

## 4. Request / persisted-record evidence (ตัวอย่าง)

QA-WF01-01 (final): `POST /api/service-queue/:id/confirm` (sales) → 200 · `db.jobs.countDocuments({queueId})` = 0 · `service_queues.status` = READY_TO_OPEN · `POST /release` (sales) → 403 · (admin) → 200 `jobId JN-2026-000x` · ยิง release ซ้ำ 3 ครั้งพร้อมกัน → 409 ทั้งหมด · `db.jobs.find({queueId})` = 1 เอกสาร · `service_queue_events` สุดท้าย `OPEN_JOB` actorId = admin
Baseline เดียวกัน: confirm → `jobs with queueId=1` · status RELEASED · admin release → 409 "คิวนี้ถูกส่งเข้าระบบงานแล้ว" · event `OPEN_JOB:sales`
(token/รหัสผ่านไม่ถูกบันทึกใน log · ข้อมูลทั้งหมดเป็นข้อมูลสังเคราะห์)

## 5. ข้อจำกัดของการทดสอบ

- ไม่ได้ทดสอบกับข้อมูลจริงหรือ production (ตามข้อห้าม) — พฤติกรรมกับข้อมูลเก่าที่ผิดรูปอาจต่างไป
- ไม่มี E2E สำหรับ: ปุ่มผูกใบเสนอราคา, dialog แก้ไขคิว, dialog ขอคิวใหม่, หน้าช่าง TECH-01/02, วางบิล, Safari/iOS จริง
- Concurrency ทดสอบระดับ API (Promise.all) ไม่ใช่ผู้ใช้หลายหน้าจอผ่าน browser
- Network interruption/lost session ไม่ได้ทดสอบผ่าน browser (มี failpoint test ระดับ unit ของระบบเดิม)
- Lint ไม่มีให้รัน
