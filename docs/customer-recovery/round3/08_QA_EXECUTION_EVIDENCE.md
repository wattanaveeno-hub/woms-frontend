# 08 · QA Execution Evidence (Round 3)

## 1. รอบทดสอบสุดท้าย: final-3

| รายการ | ค่า |
|---|---|
| คำสั่ง | `bash qa/customer-recovery-round3/run-all.sh <outDir>` (ทุกขั้นบันทึกเวลาเริ่ม–จบ และ exit code ใน `SUMMARY.tsv`) |
| วันเวลา | 2026-10-30 11:29:56 – 11:41:14 (+07:00) |
| Backend | `55b8da6568a1f0a15c56b1c88d450b9ae30dcc17` · branch `fix/customer-recovery-round3` · dirty_files=0 |
| Frontend | `42929b971c59636e7c5fe2f878aa2b5c0b9bec04` · branch `fix/customer-recovery-round3` · dirty_files=0 |
| Environment | QA container แยก · Node v22.23.4 · MongoDB 8.0.23 replica set `rs0` @127.0.0.1 · API :8100 (`tsx src/index.ts`) · Frontend standalone build :3100 · Playwright 1.63.0 Chromium · **ไม่มีการเข้าถึง production** |
| ฐานข้อมูล | สร้างใหม่ทุกชุด ชื่อ `woms_qa_r3f_*` (seed ด้วย `seed-qa-users-r3.ts` ซึ่งปฏิเสธชื่อที่ไม่ใช่ `woms_qa_*`) |
| หลักฐาน | `docs/customer-recovery/round3/evidence/final-run/` (ENV.txt · SUMMARY.tsv · log ทุกขั้น · JSON ผล · screenshot) |

| ขั้น | เริ่ม | จบ | exit | ทำแล้ว | ผ่าน | ล้ม | ข้าม | หมายเหตุ |
|---|---|---|---|---|---|---|---|---|
| be-typecheck | 11:29:56 | 11:30:11 | 0 | — | — | — | — | `tsc --noEmit` |
| be-build | 11:30:11 | 11:30:26 | 0 | — | — | — | — | |
| be-test (vitest) | 11:30:26 | 11:31:31 | 0 | 1341 test / 101 ไฟล์ | 1341 | 0 | 19 | ข้าม 18 = integration ที่ต้องมี DB จริง (รันขั้นถัดไป) · 1 = ADV-04 (BLOCKED — BUSINESS CONFIRMATION) |
| be-real-db | 11:31:31 | 11:31:39 | 0 | 18 / 3 ไฟล์ | 18 | 0 | 0 | MongoDB replica set จริง |
| fe-typecheck | 11:31:39 | 11:31:42 | 0 | — | — | — | — | |
| fe-test | 11:31:42 | 11:31:45 | 0 | 117 | 117 | 0 | 0 | `node --test` |
| fe-test-tz | 11:31:45 | 11:31:49 | 0 | 117 | 117 | 0 | 0 | TZ ต่างเขต |
| fe-build | 11:31:49 | 11:32:33 | 0 | — | — | — | — | build ไม่ใช่หลักฐานพฤติกรรม |
| fe-lint | 11:32:33 | 11:32:34 | 1 | — | — | — | — | **NOT TESTED**: ไม่มีการตั้งค่า ESLint (`next lint` ถามแบบ interactive) — เหมือน Round 2 |
| api-security-matrix (R2) | 11:32:48 | 11:32:56 | 0 | 17 scenarios / 137 checks | 17 | 0 | 0 | |
| api-security-r3 | 11:33:08 | 11:33:15 | 0 | 8 / 160 | 8 | 0 | 0 | 8 บทบาท + ไม่ล็อกอิน |
| api-qa-r3 | 11:33:27 | 11:33:38 | 0 | 15 / 195 | 15 | 0 | 0 | |
| api-qa-r2 | 11:33:50 | 11:33:59 | 0 | 12 / 82 | 12 | 0 | 0 | regression |
| api-qa-r1-regression | 11:34:11 | 11:34:19 | 0 | 18 / 120 | 18 | 0 | 0 | regression |
| e2e-r3 (browser) | 11:34:31 | 11:36:24 | 0 | 11 / 63 | 11 | 0 | 0 | |
| e2e-r3-carry (browser+API) | 11:36:37 | 11:36:48 | 0 | 3 / 14 | 3 | 0 | 0 | QA-C4/C5/C6 |
| e2e-r2 (browser) | 11:37:01 | 11:39:40 | 0 | 13 / 74 | 13 | 0 | 0 | regression |
| e2e-r1-regression (browser) | 11:39:52 | 11:40:46 | 0 | 7 / 71 | 7 | 0 | 0 | regression |
| race-d17 | 11:40:58 | 11:41:11 | 0 | 40 รอบ | 40 | 0 | 0 | ผูกใบงาน ‖ ยกเลิกใบ: ใบยกเลิกที่ยังผูก = 0 (ดูข้อจำกัด R3-N6) |
| d07-tooling | 11:41:11 | 11:41:12 | 0 | 16 checks | 16 | 0 | 0 | ข้อมูลสังเคราะห์ |
| preflight-legacy | 11:41:12 | 11:41:13 | 0 | 17 checks | ผลตรงที่คาด | — | — | ดู 09 · proof `identical: true` |
| preflight-qa-db | 11:41:13 | 11:41:14 | 0 | 17 checks | — | — | — | ดู 09 |

**รวม API/E2E/security:** 104 scenarios · 916 checks · ล้ม 0

ทุกชุด API/E2E ใน Round 3 ให้ exit 1 เมื่อมี scenario ไม่ผ่าน (T-01) — exit 0 ข้างบนจึงตรงกับจำนวนใน JSON

## 2. Independent adversarial review (ผู้ตรวจแยก)

| รอบ | ฐานโค้ด | คำสั่ง | ผล | ไฟล์ |
|---|---|---|---|---|
| Review | BE `02e11c1` · FE `88f527d` | `npx vitest run test/adv-r3-core.test.ts test/adv-r3-queue.test.ts` + live API :8200 ฐาน `woms_qa_r3_adv_1` | 15 ล้ม (= defect) / 4 ผ่าน · 17 findings | `evidence/adversarial-review/ADVERSARIAL_REVIEW.md`, `vitest-adv-*.txt`, `api-8200.log.txt` |
| Retest | BE `a1082bd` · FE `42929b9` | รวม `adv2-r3-*.test.ts` + live API | 13 แก้แล้ว (12 รันพิสูจน์ · ADV-14 อ่านโค้ด) · ADV-02 บางส่วน · พบ N1–N3 | `ADVERSARIAL_RETEST.md`, `vitest-retest-*.txt` |
| หลังแก้ N1/N2 | BE `8263a76`+ | test ของผู้ตรวจรวมเข้า suite (`round3Adversarial*.test.ts`) | ผ่านใน be-test ของ final-3 | final-run/be-test.log.txt |

## 3. รอบ dev ก่อน final (เก็บไว้ ไม่ทับ)
| รอบ | ฐาน | ผล | เหตุที่ไม่ใช่รอบสุดท้าย |
|---|---|---|---|
| baseline | BE `9a450b7` · FE `6c37ba4` (หัว Round 2) | ทุกขั้น exit 0 ยกเว้น lint | ฐานเปรียบเทียบ · unit Round 3 บนโค้ดนี้ล้ม 15/17 (`round3Core-on-9a450b7.log.txt`) |
| final-1 | BE `02e11c1` | api-qa-r1 17/18 · e2e-r1 6/7 · ที่เหลือผ่าน | fixture ไม่ครบช่องบังคับ D-05 (T-02) — พบเพราะแก้ exit code (T-01) |
| final-2 | BE `a1082bd` · FE `42929b9` | api-qa-r3 14/15 (R3-N6 race) · e2e-r3 10/11 (T-04) | พบ R3-N6 และ test ที่ผูกกับพฤติกรรมเดิมของ D-19 |
| final-3 | BE `55b8da6` · FE `42929b9` | ผ่านทั้งหมด | **รอบสุดท้าย** |

## 4. สิ่งที่ไม่ได้ทดสอบ (NOT TESTED)
| รายการ | เหตุ |
|---|---|
| ESLint frontend | ไม่มีการตั้งค่า |
| UAT environment / production / backup-restore | ไม่มี environment และไม่ได้รับอนุญาต |
| push notification บนอุปกรณ์จริง (D-13) | ไม่มีอุปกรณ์/บริการ push ใน QA container |
| Safari / iOS / Android จริง | มีเฉพาะ Chromium (จำลองมือถือ) |
| race บน replica set สำหรับ ADV-06 | ผู้ตรวจทดสอบบน fake DB · ชุด API ไม่มี scenario นี้ |
| reproduce R3-N6 ตามต้องการ | 0/90 รอบบนโค้ดก่อนแก้ในการรันแยก (`r3-n6-race-on-pre-fix-code*.json`) |
| ข้อมูลจริง D-07 | ต้องได้ mapping และอนุญาต |

## 5. การรันซ้ำ
สคริปต์อ้าง path พี่น้อง (`../woms-backend`) — ให้คัดลอก `qa/customer-recovery-round3/` ไปไว้ข้าง repo ทั้งสอง (เช่น `<work>/qa3/`) แล้วรัน `run-all.sh` · ต้องมี MongoDB replica set ที่ 127.0.0.1:27017 และ Playwright Chromium · สคริปต์ปฏิเสธฐานที่ไม่ใช่ `woms_qa_*`
