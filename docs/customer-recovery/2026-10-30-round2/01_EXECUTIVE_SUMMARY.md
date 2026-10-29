# 01 · Executive Summary (Round 2)

วันที่ 30 ต.ค. 2026 · branch `fix/customer-recovery-2026-10-29` (ทั้งสอง repo) · ยังไม่ merge / push / deploy · ไม่ได้แตะ production

## ผล: **NOT READY FOR UAT**

โค้ดผ่านการทดสอบทั้งหมดที่รันได้ใน QA environment และไม่มี defect High/Critical ที่ยังเปิดในโค้ด แต่ประตูตรวจรับ UAT ผ่าน 2 จาก 12 ข้อ (11) ส่วนใหญ่ที่เหลือติดเรื่องที่ทีมพัฒนาทำเองไม่ได้ ได้แก่:

- ลูกค้ายังไม่รับรองนโยบายข้อมูลช่าง (D-03, P0)
- ยังไม่ได้ทำ code review และยังไม่ได้รับอนุญาตให้ merge
- ยังไม่มี UAT environment
- ยังไม่ได้รัน preflight กับข้อมูลจริง และยังไม่ได้ทดสอบ backup/restore

## Baseline ที่ประเมิน

| | Round 1 | Round 2 (รอบทดสอบสุดท้าย) |
|---|---|---|
| Backend | `992072c` | `242f643` — 7 commits โค้ด (32 ไฟล์ · +1136 / −97 นับจาก `c519e15` รวม test) |
| Frontend | `ab465af` | `439465f` — 2 commits โค้ด (14 ไฟล์ · +319 / −37) |

## ตรวจ Round 1 (02)

ตัวเลข Round 1 สูงกว่าความจริง ได้แก่:

- PASS ที่รายงาน 16 แถว ตรวจแล้วเหลือ 11
- severity บางรายการต่ำกว่าจริง (BUG-V2-19 ควรเป็น High)
- log ไม่ได้ถูก commit

ผล Round 1 ไม่ได้ถูกแก้ทับ เก็บไว้ตามเดิม

## สิ่งที่แก้ใน Round 2

- **BUG-V2-17 (High) ข้อมูลรั่วถึงช่าง:**
  - ช่างเห็นเฉพาะเครื่องในงานของตน คลังรถของตน และอะไหล่แบบไม่มีราคา
  - ตรวจสิทธิ์ที่ API ทุกเส้นทาง ไม่ใช่แค่ซ่อนเมนู
  - เป็นนโยบายชั่วคราว รอ D-03
- **Defect ค้างจาก Round 1:**
  - แก้แล้ว: BUG-V2-19, BUG-V2-18/QA-F14, QA-F06 (browser พบว่ายังใช้ไม่ได้จริง จึงแก้เพิ่ม), QA-F07/TECH-02, QA-F08, QA-C7
  - BUG-V2-21 แก้ได้บางส่วน
- **พบใหม่จากการตรวจ:**
  - N-1 สัญญาซ้ำจาก Serial ตัวพิมพ์เล็ก (High)
  - N-2 Sale เห็นยอดเงินแดชบอร์ด
  - N-3 Sale อ่านตำแหน่งช่างได้
- **ผู้ตรวจอิสระ 6 รอบ** พบ 15 รายการ (R2-F01..F15) และแก้ครบทุกรายการ:
  - ยอดเงินใบงานรั่วให้ Sale/ช่าง
  - เครื่องเดียวมีสัญญาใช้งาน 2 ฉบับผ่าน 6 เส้นทาง
  - ขอบเขตเครื่องของช่าง
- **CHAT-02 / CHAT-03 / TECH-02:** ทำเฉพาะส่วนที่ยืนยันแล้ว ส่วนที่ต้องถามลูกค้าอยู่ใน D-13, D-14, D-19

## ผลทดสอบรอบสุดท้าย (08 · run-final5)

| ชุด | ผล |
|---|---|
| Backend typecheck / build | exit 0 / exit 0 |
| Backend unit (fakeMongo) | 1214 ผ่าน / 0 ล้ม / 18 ข้าม (คือ real-DB ที่รันแยก) |
| Backend real MongoDB | 18 / 18 |
| Frontend typecheck / build | exit 0 / exit 0 |
| Frontend test / test:tz | 90 / 90 · 180 / 180 |
| Frontend lint | **NOT TESTED** — repo ไม่มี ESLint config |
| Security matrix (6 บทบาท + token ผิด) | 17 scenarios / 137 checks ผ่านทั้งหมด |
| API + DB Round 2 | 12 / 82 |
| Round 1 API regression | 18 / 120 |
| Browser E2E Round 2 (Chromium) | 13 / 74 |
| Round 1 E2E regression | 7 / 71 |
| Preflight อ่านอย่างเดียว | พบครบทุกปัญหาที่ฝังใน legacy fixture · ยืนยันว่าไม่เขียนข้อมูล |

ชุดทดสอบของทีมผ่านทุกรอบ แต่ผู้ตรวจอิสระยังพบ defect ใหม่ 5 รอบติดกัน ผลผ่านของชุดทดสอบจึงไม่ใช่หลักฐานว่าไม่มี defect เหลือ

## Defect (05)

- รวม 69 ID
- PASS — EXECUTED & VERIFIED 63
- PARTIAL 2 (BUG-V2-21, QA-C6)
- FIXED — AWAITING RETEST 2 (QA-C4, QA-C5)
- BLOCKED — BUSINESS CONFIRMATION 2 (QA-F16, QA-F18)
- FAIL 0

## Requirement (03)

- รวม 56 แถว
- PASS 19
- PARTIAL 26
- BLOCKED 6
- NOT TESTED 3
- SUPERSEDED 2
- FAIL 0

## ลูกค้าต้องตัดสิน (10)

- P0: D-03
- P1 10 ข้อ
- P2 7 ข้อ
- ทำแล้วรอยืนยัน: D-08, D-10, D-17, D-22, D-23, D-03 (นโยบายชั่วคราว)

## ความเสี่ยงหลัก (12)

1. นโยบายข้อมูลช่างและยอดเงินเป็นแบบชั่วคราว อาจปิดข้อมูลที่ช่างต้องใช้หน้างาน
2. ยังไม่ได้ตรวจข้อมูล production
3. กติกาเครื่องละ 1 สัญญาบังคับในโค้ดเท่านั้น จึงเสนอ unique index เป็น M-04

## ต้องเกิดอะไรก่อนประเมินใหม่

1. ลูกค้าตอบ D-03 และตกลงขอบเขต UAT
2. Repository owner ทำ code review และอนุญาต merge
3. Deployment owner เตรียม UAT, ทดสอบ backup/restore และรัน preflight
4. รันชุด API/E2E บน UAT
