# D-07 — Equipment Model Master และการจับคู่ข้อมูลเครื่องเดิม (D-07B Option A): หลักฐาน

## 1. การตัดสินใจ
- **D-07A** (ชี้แจงแล้ว Round 3): ประเภท → หมวดหมู่ → รุ่น → ราคามาตรฐาน · 6 รุ่นตัวอย่างของลูกค้า · ตรวจความสัมพันธ์ที่ backend · Auto Fill
- **D-07B — Option A (SA/PM อนุมัติ 30 ต.ค. 69): controlled mapping** — จับคู่เฉพาะที่ตรงตัวชุดเดียว · รายงานรายการที่กำกวม/ขัดแย้ง/ไม่พบ · ไม่จับคู่แบบเดา (fuzzy) · ไม่แก้ชื่อรุ่นเดิม · มี backup + journal + rollback

## 2. กติกาการจับคู่ (`npm run equipment-models -- map`)
| สถานะ | ความหมาย | การเขียน |
|---|---|---|
| MATCHED | ชื่อรุ่นตรงกับ master ชุดเดียว (ตัดช่องว่างหัวท้าย ไม่สนตัวพิมพ์ เท่านั้น) และไม่ขัดกับประเภท/หมวดหมู่ที่มีอยู่ | เติม `modelMasterId` + ประเภท/หมวดหมู่ที่ **ว่าง** |
| ALREADY_MAPPED | อ้าง master แล้ว | ไม่เขียน |
| AMBIGUOUS | ชื่อรุ่นตรงหลาย master (หลายหมวดหมู่) | ไม่เขียน — ส่งให้ลูกค้าระบุ |
| CONFLICT | ประเภท/หมวดหมู่เดิมขัดกับ master | ไม่เขียน — ส่งให้ลูกค้าระบุ |
| UNMAPPED | ไม่พบรุ่นใน master | ไม่เขียน |
| NO_MODEL | เครื่องไม่มีชื่อรุ่น | ไม่เขียน |

การเขียนเกิดเฉพาะ `--apply` และต้องผ่าน `writeGuard`:
- **โหมด QA:** ฐาน `woms_qa_*` บน localhost เท่านั้น
- **โหมด UAT (ใหม่ · ไม่ได้ถอดตัวป้องกัน QA):** `--target uat --confirm-db <ชื่อฐาน> --confirm-host <โดเมน cluster>` ต้องตรงกับ URI จริง + `--backup-manifest` (backup ไม่เกิน 24 ชม. และระบุว่า **ทดสอบ restore แล้ว** โดยใคร เมื่อไร) · ปฏิเสธชื่อฐานที่มีคำว่า `prod` · seed ที่ลบข้อมูลต้องใส่ `--allow-destructive` และถูกปฏิเสธในโหมด UAT
- ทุก apply เขียน `map-backup-apply-*.json` (ค่าก่อนแก้) และ `map-journal-*.jsonl` (ทีละรายการ ก่อนเขียน) · rollback คืนเฉพาะฟิลด์ที่สคริปต์เขียน · รายการที่ถูกแก้ภายหลัง = CONFLICT ไม่ทับ

## 3. ผลบนฐาน QA (fixture ที่มีทุกกรณี — `evidence/final-run-13/d07a-script-reports/`)
| ขั้น | ผล |
|---|---|
| seed dry-run | 6 แถว · สร้าง 6 · ซ้ำ 0 · ไม่ถูกต้อง 0 |
| seed apply ครั้งที่ 1 / 2 | สร้าง 6 / สร้าง 0 มีอยู่ 6 (idempotent) |
| map dry-run | ทั้งหมด 59 · MATCHED 2 · ALREADY_MAPPED 2 · AMBIGUOUS 1 · CONFLICT 1 · UNMAPPED 52 · NO_MODEL 1 |
| map apply | เขียนเฉพาะ MATCHED 2 · ตัวเลขเท่ากับ dry-run |
| rollback | คืน 2 · conflict 0 |
| ตรวจซ้ำโดยผู้ตรวจอิสระ | R3B / R3C (ADV3-03, ADV3-08, ADV3C) · R5/R6 (ADV4-13 writeGuard ครบทุกสคริปต์ที่เขียน) |

## 4. บนข้อมูล UAT
| ขั้น | สถานะ |
|---|---|
| preflight อ่านอย่างเดียว | **NOT TESTED — BLOCKED (ENVIRONMENT)**: เข้า Atlas ไม่ได้จาก session นี้และจากเครื่องที่เชื่อม (`evidence/env-access/`) |
| backup + restore test | **NOT TESTED — BLOCKED (ENVIRONMENT)** |
| seed / map dry-run / apply | **NOT RUN** — ต้องมี backup ที่ทดสอบ restore แล้วก่อน (สคริปต์บังคับ) |
| รายการ AMBIGUOUS/CONFLICT/UNMAPPED ของจริง | ยังไม่ทราบจำนวน — รอ dry-run บน UAT แล้วส่งให้ลูกค้าระบุ (10 ข้อ P-02) |

ขั้นตอนทั้งหมดอยู่ใน UAT_DEPLOYMENT_RUNBOOK ข้อ 2–4
