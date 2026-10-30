# 08 · QA Execution Evidence (Round 3)

## 0. รอบอ้างอิงตาม directive 30 ต.ค. 69: **final-run-13**

คำสั่ง `bash qa/customer-recovery-round3/run-all.sh <outDir>` · ทุกขั้นบันทึกเวลาและ exit code ใน `SUMMARY.tsv` · `verify-results.mjs` ตรวจ: ไฟล์ผลใหม่ทุกชุด, scenario > 0 และมี check, จำนวน skip ที่คาด (20 — integration ที่รันในขั้น real-db + เหตุผลรายตัว), SHA/dirty อ่านจาก git เอง, race "other" = 0, exit code ทุกขั้นรวม lint = 0 → `VERDICT.json`
หลักฐาน: `docs/customer-recovery/round3/evidence/final-run-13/` (ENV, SUMMARY, VERDICT, log ทุกขั้น, JSON, screenshot, รายงานสคริปต์ D-07/ราคา)

- date: 2026-10-30T19:41:20+07:00
- backend: 05b4c94c377b6b1e994d2fa3ca427270aa6862f3 fix/customer-recovery-round3 dirty_files=0
- frontend: 2d9c35f7c3378f65246e964daa2ee05fa992c7b2 fix/customer-recovery-round3 dirty_files=0
- node: v22.23.4 · mongod: db version v8.0.23 · replica set rs0 @127.0.0.1:27017 (isolated QA container, no production access)
- playwright: 1.63.0 chromium
- done 2026-10-30T20:06:38+07:00
- VERDICT allPass: **true** · ชุด API/E2E/race 20 ชุด · 218 scenario · 2045 checks · scenario ล้ม 0

| ขั้น | เริ่ม | จบ | exit | ผล |
|---|---|---|---|---|
| be-typecheck | 19:41:20 | 19:41:36 | 0 |  |
| be-build | 19:41:36 | 19:41:54 | 0 |  |
| be-test | 19:41:54 | 19:43:26 | 0 | 1568 ผ่าน / 20 ข้าม |
| be-real-db | 19:43:26 | 19:43:35 | 0 | 18 ผ่าน |
| fe-typecheck | 19:43:35 | 19:43:43 | 0 |  |
| fe-test | 19:43:43 | 19:43:46 | 0 | 148 ผ่าน / ล้ม 0 |
| fe-test-tz | 19:43:46 | 19:43:52 | 0 | 148 + 148 ผ่าน / ล้ม 0 + 0 |
| fe-build | 19:43:52 | 19:44:45 | 0 |  |
| fe-lint | 19:44:45 | 19:44:47 | 0 | No ESLint warnings or errors |
| api-security-matrix | 19:45:02 | 19:45:12 | 0 | 17 scenario / 137 checks · ล้ม 0 / 0 |
| api-security-r3 | 19:45:25 | 19:45:33 | 0 | 9 scenario / 195 checks · ล้ม 0 / 0 |
| api-qa-r3 | 19:45:47 | 19:47:14 | 0 | 16 scenario / 210 checks · ล้ม 0 / 0 |
| api-qa-d07a | 19:47:28 | 19:47:51 | 0 | 8 scenario / 108 checks · ล้ม 0 / 0 |
| api-qa-decisions | 19:48:06 | 19:48:17 | 0 | 7 scenario / 66 checks · ล้ม 0 / 0 |
| api-qa-fin | 19:48:31 | 19:49:48 | 0 | 27 scenario / 295 checks · ล้ม 0 / 0 |
| api-qa-price | 19:50:02 | 19:50:12 | 0 | 13 scenario / 83 checks · ล้ม 0 / 0 |
| api-qa-job | 19:50:27 | 19:51:36 | 0 | 11 scenario / 221 checks · ล้ม 0 / 0 |
| api-qa-activity | 19:51:49 | 19:54:21 | 0 | 26 scenario / 166 checks · ล้ม 0 / 0 |
| api-qa-r2 | 19:54:35 | 19:54:45 | 0 | 12 scenario / 82 checks · ล้ม 0 / 0 |
| api-qa-r1-regression | 19:54:59 | 19:55:07 | 0 | 18 scenario / 120 checks · ล้ม 0 |
| e2e-r3 | 19:55:22 | 19:57:15 | 0 | 11 scenario / 63 checks · ล้ม 0 / 0 |
| e2e-d07a | 19:57:29 | 19:57:58 | 0 | 2 scenario / 18 checks · ล้ม 0 / 0 |
| e2e-fin | 19:58:12 | 19:58:33 | 0 | 7 scenario / 38 checks · ล้ม 0 / 0 |
| e2e-price | 19:58:47 | 19:59:05 | 0 | 3 scenario / 17 checks · ล้ม 0 / 0 |
| e2e-job | 19:59:19 | 19:59:43 | 0 | 2 scenario / 30 checks · ล้ม 0 / 0 |
| e2e-activity | 19:59:56 | 20:00:13 | 0 | 6 scenario / 37 checks · ล้ม 0 / 0 |
| e2e-r4fix-fixture | 20:00:26 | 20:01:35 | 0 |  |
| e2e-r4fix | 20:01:35 | 20:01:41 | 0 |  |
| e2e-r3-carry | 20:01:54 | 20:02:06 | 0 | 3 scenario / 14 checks · ล้ม 0 / 0 |
| e2e-r2 | 20:02:20 | 20:04:59 | 0 | 13 scenario / 74 checks · ล้ม 0 / 0 |
| e2e-r1-regression | 20:05:12 | 20:06:07 | 0 | 7 scenario / 71 checks · ล้ม 0 |
| race-d17 | 20:06:20 | 20:06:35 | 0 | 40 รอบ · ใบยกเลิกที่ยังผูก 0 |
| d07-tooling | 20:06:35 | 20:06:37 | 0 |  |
| preflight-legacy | 20:06:37 | 20:06:38 | 0 |  |
| preflight-qa-db | 20:06:38 | 20:06:38 | 0 |  |
| verify-results | 20:06:38 | 20:06:38 | 0 |  |

หมายเหตุ:
- `race-d17` 40 รอบ: link ชนะ 6 · cancel ชนะ 34 · สำเร็จทั้งคู่ 0 · ใบยกเลิกที่ยังผูก 0 · อื่น ๆ 0
- `e2e-r4fix` 6 checks ผ่าน (fixture จาก api-qa-job)
- `e2e-job` รวมตรวจ UX-R3-01 (เปลี่ยนความกว้างจอหลังเซ็น → ลายเซ็นคงอยู่) ผ่าน · เซ็นซ้ำหลังข้อความผิดพลาด 0 ครั้ง
- Browser: Chromium เท่านั้น (เดสก์ท็อป + Pixel 5 จำลอง) · Firefox/WebKit: **BLOCKED — ENVIRONMENT** (proxy ปฏิเสธ cdn.playwright.dev / playwright.download.prss.microsoft.com) · อุปกรณ์จริง: NOT TESTED
- UAT: NOT TESTED — BLOCKED (BACKUP_DEPLOYMENT_EVIDENCE)

## 0.1 ประวัติรอบหลัง directive (ไม่ซ่อนรอบที่ล้ม)
| รอบ | Backend / Frontend | ผล | เหตุ |
|---|---|---|---|
| final-6 | หลัง merge feat/* | ล้ม | T-07 เหตุผล Q-R3-10 · T-08 429 · T-09 ชื่อฐาน E2E · D07A-08 (แก้ใน ADV4-14) |
| final-7 | | ล้ม | e2e-job (T-10) · e2e-r4fix ไม่มี fixture |
| final-8 | `e23a4cf` / `c3cc38d` | **allPass** (209 scenario · 1,984 checks) | ก่อนแก้ R5–R9 |
| final-9 | `c0336f7` / `45af2ad` | ล้ม 1 ขั้น | fixture อ่าน audit เร็วไป (T-11) |
| final-10 | — | **ยกเลิก** | แก้โค้ดระหว่างรอบ — ไม่ใช้ |
| final-11 | `5b1f1dc` / `45af2ad` | ล้ม 2 ชุด | api-qa-fin ไม่อัปเดตตามกติกาเลขเอกสาร (T-13) · e2e-job ลายเซ็น (UX-R3-01) |
| final-12 | `05b4c94` / `45af2ad` | ล้ม 2 ชุด · **ไม่ใช้** | e2e-r3 E2E-R3-04 + e2e-job = UX-R3-01 · สคริปต์ถูกแก้ระหว่างรอบ (T-14) — เป็น negative proof: ลายเซ็นว่างหลัง resize บน frontend เดิม |
| **final-13** | **`05b4c94` / `2d9c35f`** | **allPass** | รอบอ้างอิง |

## 0.2 การตรวจอื่นในรอบนี้
- secret scan diff ทั้งสอง repo: ไม่พบ credential จริง (`evidence/env-access/secret-scan.txt`)
- ADV9-01 author check: โซ่ 7 + วน 2 เอกสาร → คีย์ถูกต้องทั้งหมด (`evidence/author-checks/`)
- รีวิว/retest อิสระ R4–R10: `evidence/adversarial-review/` (05)

---

## ประวัติ: หลักฐาน ณ final-5


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
