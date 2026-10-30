# 08 · QA Execution Evidence (Round 3)

## 1. รอบทดสอบสุดท้าย: final-5

รันใหม่ทั้งหมดบนหัว branch หลังแก้ ADV3C (retest R3C) · โค้ดเปลี่ยนหลัง final-4 → ไม่ใช้ผล final-4 แทน (final-4 เก็บใน `evidence/final-run-4/`)

| รายการ | ค่า |
|---|---|
| คำสั่ง | `bash qa/customer-recovery-round3/run-all.sh <outDir>` (ทุกขั้นบันทึกเวลาเริ่ม–จบ และ exit code ใน `SUMMARY.tsv`) · ขั้นสุดท้าย `verify-results.mjs` ตรวจไฟล์ผลทุกชุดเอง → `VERDICT.json` |
| วันเวลา | 2026-10-30 13:04:43 – 13:17:22 (+07:00) |
| Backend | `08e2aba26be28f2cfe72bd869c061b8abf9c144d` · branch `fix/customer-recovery-round3` · dirty_files=0 · `git-head` ตรงกับ HEAD จริงตอนตรวจ |
| Frontend | `7fd49dddcf103ce4ee1ef0f9314ead5afdda7149` · branch `fix/customer-recovery-round3` · dirty_files=0 · `git-head` ตรงกับ HEAD จริงตอนตรวจ |
| Environment | QA container แยก · Node v22.23.4 · MongoDB 8.0.23 replica set `rs0` @127.0.0.1 · API :8100 (`tsx src/index.ts`) · Frontend standalone build :3100 · Playwright 1.63.0 Chromium · **ไม่มีการเข้าถึง production** |
| ฐานข้อมูล | สร้างใหม่ทุกชุด ชื่อ `woms_qa_r3f_*` (seed ด้วย `seed-qa-users-r3.ts` ซึ่งปฏิเสธชื่อที่ไม่ใช่ `woms_qa_*`) |
| หลักฐาน | `docs/customer-recovery/round3/evidence/final-run-5/` (ENV.txt · SUMMARY.tsv · VERDICT.json · log ทุกขั้น · JSON ผล · screenshot · รายงานสคริปต์ D-07A) |
| VERDICT | `allPass: true` (23 รายการตรวจ) · lint = NOT TESTED — ESLINT CONFIGURATION MISSING |

| ขั้น | เริ่ม | จบ | exit | ทำแล้ว | ผ่าน | ล้ม | ข้าม | หมายเหตุ |
|---|---|---|---|---|---|---|---|---|
| be-typecheck | 13:04:43 | 13:04:56 | 0 | — | — | — | — | `tsc --noEmit` |
| be-build | 13:04:56 | 13:05:12 | 0 | — | — | — | — | |
| be-test (vitest) | 13:05:12 | 13:06:21 | 0 | 1409 | 1387 | 0 | 22 | ข้าม 18 = integration ที่ต้องมี DB จริง (รันขั้นถัดไป) · ADV-04 (BLOCKED Q-R3-01) · ADV3-D1 (ทดสอบบนฐานจริงใน D07A-07) · ADV3-P1 (BLOCKED Q-R3-14) · R3C-C23 homoglyph (ยอมรับความเสี่ยง ADV3C-03) · ตัวตรวจยืนยันจำนวนข้าม = 22 ตามที่ระบุ |
| be-real-db | 13:06:21 | 13:06:29 | 0 | 18 / 3 ไฟล์ | 18 | 0 | 0 | MongoDB replica set จริง |
| fe-typecheck | 13:06:29 | 13:06:32 | 0 | — | — | — | — | |
| fe-test | 13:06:32 | 13:06:34 | 0 | 122 | 122 | 0 | 0 | `node --test` |
| fe-test-tz | 13:06:34 | 13:06:39 | 0 | 122 ×2 รอบ | 122 | 0 | 0 | TZ ต่างเขต |
| fe-build | 13:06:39 | 13:07:25 | 0 | — | — | — | — | build ไม่ใช่หลักฐานพฤติกรรม |
| fe-lint | 13:07:25 | 13:07:25 | 1 | — | — | — | — | **NOT TESTED — ESLINT CONFIGURATION MISSING** |
| api-security-matrix (R2) | 13:07:40 | 13:07:48 | 0 | 17 / 137 checks | 17 | 0 | 0 | |
| api-security-r3 | 13:08:00 | 13:08:07 | 0 | 9 / 195 | 9 | 0 | 0 | 8 บทบาท + ไม่ล็อกอิน · รวม SEC-R3-09 (D-07A) |
| api-qa-r3 | 13:08:20 | 13:08:31 | 0 | 15 / 195 | 15 | 0 | 0 | |
| api-qa-d07a | 13:08:43 | 13:09:03 | 0 | 8 / 108 | 8 | 0 | 0 | D07A-01..08 (รวม retest ADV3 และ R3C บนฐานจริง) |
| api-qa-r2 | 13:09:15 | 13:09:24 | 0 | 12 / 82 | 12 | 0 | 0 | regression |
| api-qa-r1-regression | 13:09:36 | 13:09:45 | 0 | 18 / 120 | 18 | 0 | 0 | regression |
| e2e-r3 (browser) | 13:09:57 | 13:11:49 | 0 | 11 / 63 | 11 | 0 | 0 | |
| e2e-d07a (browser) | 13:12:02 | 13:12:31 | 0 | 2 / 18 | 2 | 0 | 0 | E2E ข้อ 19 / 20 |
| e2e-r3-carry (browser+API) | 13:12:43 | 13:12:55 | 0 | 3 / 14 | 3 | 0 | 0 | QA-C4/C5/C6 |
| e2e-r2 (browser) | 13:13:07 | 13:15:47 | 0 | 13 / 74 | 13 | 0 | 0 | regression |
| e2e-r1-regression (browser) | 13:15:59 | 13:16:54 | 0 | 7 / 71 | 7 | 0 | 0 | regression |
| race-d17 | 13:17:06 | 13:17:19 | 0 | 40 รอบ | 40 | 0 | 0 | ใบยกเลิกที่ยังผูก = 0 · error = 0 · ทุกรอบฝั่งยกเลิกชนะ (ดูข้อจำกัด R3-N6) |
| d07-tooling | 13:17:19 | 13:17:20 | 0 | 16 checks | 16 | 0 | 0 | ข้อมูลสังเคราะห์ |
| preflight-legacy | 13:17:20 | 13:17:22 | 0 | 17 checks | ผลตรงที่คาด | — | — | ดู 09 · proof `identical: true` |
| preflight-qa-db | 13:17:22 | 13:17:22 | 0 | 17 checks | — | — | — | ดู 09 |
| verify-results | 13:17:22 | 13:17:22 | 0 | 23 รายการ | 23 | 0 | — | `VERDICT.json` |

**รวม API/E2E/security:** 115 scenarios · 1,077 checks · ล้ม 0 (final-4: 114 · 1,064 · final-3: 104 · 916)

ทุกชุด API/E2E ใน Round 3 ให้ exit 1 เมื่อมี scenario ไม่ผ่าน (T-01) และ `verify-results` ตรวจจำนวนจาก JSON ซ้ำอีกชั้น

## 2. Independent adversarial review (ผู้ตรวจแยก)

| รอบ | ฐานโค้ด | คำสั่ง | ผล | ไฟล์ |
|---|---|---|---|---|
| Review | BE `02e11c1` · FE `88f527d` | `npx vitest run test/adv-r3-core.test.ts test/adv-r3-queue.test.ts` + live API :8200 ฐาน `woms_qa_r3_adv_1` | 15 ล้ม (= defect) / 4 ผ่าน · 17 findings | `evidence/adversarial-review/ADVERSARIAL_REVIEW.md`, `vitest-adv-*.txt`, `api-8200.log.txt` |
| Retest | BE `a1082bd` · FE `42929b9` | รวม `adv2-r3-*.test.ts` + live API | 13 แก้แล้ว (12 รันพิสูจน์ · ADV-14 อ่านโค้ด) · ADV-02 บางส่วน · พบ N1–N3 | `ADVERSARIAL_RETEST.md`, `vitest-retest-*.txt` |
| หลังแก้ N1/N2 | BE `8263a76`+ | test ของผู้ตรวจรวมเข้า suite (`round3Adversarial*.test.ts`) | ผ่านใน be-test ของ final-3 และ final-4 | final-run/be-test.log.txt · final-run-4/be-test.log.txt |
| Review R3B (D-07A) | BE `cb34ce9` · FE `ff49dd3` | `npx vitest run test/adv3-d07a.test.ts` + live API :8200 | 7 ล้ม (= defect) / 4 ผ่าน · 10 findings | `ADVERSARIAL_REVIEW_R3B.md`, `vitest-adv3-full.txt`, `api-8200-r3b.log.txt` |
| หลังแก้ ADV3 | BE `9ebccd0` · FE `f655adb` | test ของผู้ตรวจรวมเข้า suite (`adv3D07a.test.ts`) + D07A-07 บนฐานจริง | ผ่านใน final-4 (D1/P1 ข้ามพร้อมเหตุผล) | final-run-4/be-test.log.txt · api-qa-d07a.json |
| Retest R3C | BE `9ebccd0` | worktree แยก · `vitest run test/adv3c.test.ts` (27) + live API :8200 ฐาน `woms_qa_r3_adv_c2` + สคริปต์บน `woms_qa_r3_adv_c1` | 13 ล้ม (= defect) · ADV3-02/04/05 PARTIAL · พบ ADV3C-01..06 | `ADVERSARIAL_RETEST_R3C.md`, `r3c/` |
| หลังแก้ ADV3C | BE `08e2aba` · FE `7fd49dd` | `adv3cD07a.test.ts` ในชุด + D07A-08 | ผ่านใน final-5 (C23 ข้าม: ยอมรับความเสี่ยง) | final-run-5/be-test.log.txt · api-qa-d07a.json |

## 3. รอบ dev ก่อน final (เก็บไว้ ไม่ทับ)
| รอบ | ฐาน | ผล | เหตุที่ไม่ใช่รอบสุดท้าย |
|---|---|---|---|
| baseline | BE `9a450b7` · FE `6c37ba4` (หัว Round 2) | ทุกขั้น exit 0 ยกเว้น lint | ฐานเปรียบเทียบ · unit Round 3 บนโค้ดนี้ล้ม 15/17 (`round3Core-on-9a450b7.log.txt`) |
| final-1 | BE `02e11c1` | api-qa-r1 17/18 · e2e-r1 6/7 · ที่เหลือผ่าน | fixture ไม่ครบช่องบังคับ D-05 (T-02) — พบเพราะแก้ exit code (T-01) |
| final-2 | BE `a1082bd` · FE `42929b9` | api-qa-r3 14/15 (R3-N6 race) · e2e-r3 10/11 (T-04) | พบ R3-N6 และ test ที่ผูกกับพฤติกรรมเดิมของ D-19 |
| final-3 | BE `55b8da6` · FE `42929b9` | ผ่านทั้งหมด (104 scenarios · 916 checks) | โค้ดเปลี่ยนหลังรอบนี้ (D-07A, ADV3) — เก็บใน `evidence/final-run/` เป็นประวัติ |
| final-4 | BE `9ebccd0` · FE `f655adb` | ผ่านทั้งหมด (114 scenarios · 1,064 checks · unit 1361) | retest R3C พบ ADV3C-01..05 → โค้ดเปลี่ยน — เก็บใน `evidence/final-run-4/` |
| final-5 | BE `08e2aba` · FE `7fd49dd` | ผ่านทั้งหมด | **รอบสุดท้าย** |

## 4. สิ่งที่ไม่ได้ทดสอบ (NOT TESTED)
| รายการ | เหตุ |
|---|---|
| ESLint frontend | ไม่มีการตั้งค่า |
| UAT environment / production / backup-restore | ไม่มี environment และไม่ได้รับอนุญาต |
| push notification บนอุปกรณ์จริง (D-13) | ไม่มีอุปกรณ์/บริการ push ใน QA container |
| Safari / iOS / Android จริง | มีเฉพาะ Chromium (จำลองมือถือ) |
| race บน replica set สำหรับ ADV-06 | ผู้ตรวจทดสอบบน fake DB · ชุด API ไม่มี scenario นี้ |
| reproduce R3-N6 ตามต้องการ | 0/90 รอบบนโค้ดก่อนแก้ในการรันแยก (`r3-n6-race-on-pre-fix-code*.json`) |
| ข้อมูลจริง D-07B | ต้องได้คำตอบลูกค้าและอนุญาต · seed/mapping ทดสอบบนฐาน QA เท่านั้น |
| retest รอบที่สามโดยผู้ตรวจแยก หลังแก้ ADV3C | ยังไม่ได้ทำ — ยืนยันด้วย test ของผู้ตรวจ R3C ที่รวมเข้า suite |

## 5. การรันซ้ำ
สคริปต์อ้าง path พี่น้อง (`../woms-backend`) — ให้คัดลอก `qa/customer-recovery-round3/` ไปไว้ข้าง repo ทั้งสอง (เช่น `<work>/qa3/`) แล้วรัน `run-all.sh` · ต้องมี MongoDB replica set ที่ 127.0.0.1:27017 และ Playwright Chromium · สคริปต์ปฏิเสธฐานที่ไม่ใช่ `woms_qa_*`
