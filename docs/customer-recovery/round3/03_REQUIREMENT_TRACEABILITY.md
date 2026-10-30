# 03 · Requirement Traceability (Round 3)

## ส่วนที่เพิ่มตาม directive 30 ต.ค. 69 (ผลอ้างอิงรอบ **final-run-13** · SHA ใน 08)

| Requirement | Unit | API + MongoDB จริง | Security | Browser E2E | ผล (QA env) |
|---|---|---|---|---|---|
| D-01 บทบาท 7 แบบ (รวม ACC) + RBAC ราย operation | vfbRoles, user roles | DEC-01, DEC-02, R3-D01-MATRIX | security-matrix, security-r3 | E2E-FIN-06, E2E-ACT-05 | PASS |
| D-02 Admin/Manager + วิธีคิดมูลค่าสต๊อก | adminApproval | DEC-04 | — | — | PASS |
| D-04 บังคับผู้ใช้เดิมเปลี่ยนรหัส (Q-R3-04) | d04Password | DEC-05 | SEC-R3-01 | E2E-R3-08 | PASS (สคริปต์ · ยังไม่รันบน UAT) |
| D-07A / D-07B | d07aEquipmentModel, adv3*, equipmentModels script | api-qa-d07a, d07-tooling | security-r3 | e2e-d07a | PASS (ฐาน QA) · ข้อมูลจริง NOT RUN |
| D-08 / Q-R3-12 | round3Core, jobSliceQR3 | R3-D08-CONTRACT, JOB-R12-01..03 | — | — | PASS |
| D-09 เช่าซื้อ (การเงินตาม D-11) | round3Core | R3-D09-HIRE, FIN-* | — | — | PASS ภายในขอบเขต PDF |
| D-11 | finance domain/route, r4fix/r5fix/r6fix finance | FIN-01..12, FIN-SEC-01..05, Q-R3-11, R4/R5-FIN-* | FIN-07, FIN-SEC | E2E-FIN-01..07 | PASS |
| D-14 / Q-R3-05 | chat cancel | DEC-03 | — | — | PASS |
| D-16 / Q-R3-13 | job revision, r6fix | JOB-R13-01..04, R4-JOB-R13-RESIGN, DEC-06, DEC-07 | — | E2E-JOB-01, e2e-r4fix | PASS |
| D-17 / Q-R3-11 | quotation link | Q-R3-11 | — | E2E-FIN (ปลดการผูก) | PASS |
| D-18 ต้นทุนอะไหล่ | round3 cost guard | security-r3, ACT-API-09 | 7 บทบาท | E2E-R3 | PASS · ส่วนต้นทุนจากใบเสนอราคา → 10 P-06 |
| D-22 | installPrice, roles | PRICE-*, DEC-01 | security-matrix | E2E-PRICE | PASS |
| D-23 | (Round 3 เดิม) | — | SEC-CON-04 | — | PASS (ตัวกันเดิม = Option A ที่อนุมัติ) |
| Q-R3-03 | job cancelled scope | JOB-R03-01, R4-JOB-R03-QUEUE, R5-JOB-CHAT-JOBREF, DEC-07 | — | E2E-JOB-02 | PASS |
| Q-R3-14 / ADV3-01 | installPrice (18) | PRICE-01..12, R4-PRICE-CAT | — | E2E-PRICE-01..03 | PASS (โค้ด) · **ไม่มีราคาที่อนุมัติ → ADV3-01 เปิด** |
| Enterprise Activity Log | activity, r4/r5 activity | ACT-API-01..17, R4/R5-ACT-* | ACT-API-07/09/13/14 | E2E-ACT-01..06 | PASS |
| ESLint | — | — | — | — | PASS (0 warning/error) |
| Firefox / WebKit | — | — | — | — | BLOCKED — ENVIRONMENT |
| UAT API/E2E | — | — | — | — | NOT TESTED — BLOCKED |

---

## ประวัติ: traceability ณ final-5


ผลอ้างอิงรอบ **final-5** (backend `08e2aba` · frontend `7fd49dd` · ดู 08) · requirement เดิมของ Round 1–2 ที่ไม่ถูกแตะใน Round 3 ดูได้ใน `docs/customer-recovery/2026-10-30-round2/03_REQUIREMENT_TRACEABILITY.md` (ไม่แก้ไฟล์เดิม)

## 1. การตัดสินใจ D-01..D-23 → การทดสอบ (สถานะการตัดสินใจละเอียดใน 02)

| ข้อ | สถานะอนุมัติ | Unit (backend/frontend) | API + DB จริง | Security | Browser E2E | ผลรวม |
|---|---|---|---|---|---|---|
| D-01 | CUSTOMER APPROVED | vfbRoles · adminApproval · round3Adversarial (ADV-05) | R3-D01-MATRIX | SEC-R3-06 · SEC-R3-08 | E2E-R3-09 | PARTIAL — VERIFIED WITH LIMITATIONS (ADV-04 BLOCKED: CEO อนุมัติ PM) |
| D-02 | CUSTOMER APPROVED | adminApproval | R3-D01-MATRIX | SEC-R3-06 | — | PASS — EXECUTED & VERIFIED |
| D-03 | CUSTOMER APPROVED | techDataScope · round2 security | security-matrix | SEC-R3-02 · SEC-R3-04 | E2E-R2-09 · E2E-R2-05 | PASS — EXECUTED & VERIFIED |
| D-04 | CUSTOMER APPROVED | d04Password (13) | R3-D04-PASSWORD | SEC-R3-01 | E2E-R3-08 | PASS — EXECUTED & VERIFIED |
| D-05 | CUSTOMER APPROVED | round3Queue · round3Adversarial (ADV-09/10) · FE queueRules | R3-D05-QUEUE | SEC-R3-03 | E2E-R3-01 · E2E-R3-02 | PASS — EXECUTED & VERIFIED |
| D-06 | CUSTOMER APPROVED | round3Core · round8_customers · FE customerCode | R3-D06-CODE (รวม ADV-17) | — | E2E-R3-10 | PASS — EXECUTED & VERIFIED |
| D-07A | CLARIFIED (โครงสร้าง Equipment Model Master + ตัวอย่าง 6 รุ่น) | d07aEquipmentModel (10) · adv3D07a (ADV3) · adv3cD07a (R3C) · FE equipmentModelCascade (5) | D07A-01..08 | SEC-R3-09 | E2E-D07A-19 · E2E-D07A-20 | PASS — EXECUTED & VERIFIED (ใน QA env · ราคามาตรฐานยังไม่ใช้คิดรายรับ — Q-R3-14) |
| D-07B | **PENDING — BUSINESS CONFIRMATION** (mapping ข้อมูลเดิมที่ไม่ชัดเจน + ย้ายข้อมูล production) | — | D07A-05 (dry-run/apply/rollback บน QA) · d07-test | — | — | BLOCKED — BUSINESS CONFIRMATION |
| D-08 | CUSTOMER APPROVED | round3Core · round3Adversarial (ADV-01/02) | R3-D08-CONTRACT · R3-D10-INSTALLDATE | — | E2E-R3-04 | PARTIAL — VERIFIED WITH LIMITATIONS (N3: ยกเลิกใบงานติดตั้งหลังสัญญามีผล รอกติกา) |
| D-09 | CUSTOMER APPROVED | round3Core · retest ADV2-09h | R3-D09-HIRE | — | E2E-R3-01 (ตัวเลือก) | PARTIAL — VERIFIED WITH LIMITATIONS (ส่วนการเงิน/สถานะรอ D-11) |
| D-10 | CUSTOMER APPROVED | round3Core · vfbClose · FE closeRules | R3-D10-INSTALLDATE | SEC-R3-02 (ช่างอื่นแก้วันไม่ได้) | E2E-R3-04 | PASS — EXECUTED & VERIFIED |
| D-11 | **BLOCKED — BUSINESS CONFIRMATION** | — | — | — | E2E-R2-10 (regression flow เดิม) | BLOCKED — BUSINESS CONFIRMATION |
| D-12 | CUSTOMER APPROVED | round3Queue · pmPlan | R3-D12-MULTIPM | SEC-R3-02 (ช่างอื่นเสนอไม่ได้) | E2E-R3-05 | PASS — EXECUTED & VERIFIED |
| D-13 | CUSTOMER APPROVED | d13d14Chat | R3-D13-MENTION | — | E2E-R3-06 · E2E-R2-13 | PASS — EXECUTED & VERIFIED (push อุปกรณ์จริง NOT TESTED) |
| D-14 | CUSTOMER APPROVED | d13d14Chat | R3-D14-CANCEL | SEC-R3-02 · SEC-R3-06 | E2E-R3-07 | PASS — EXECUTED & VERIFIED |
| D-15 | CUSTOMER APPROVED | round3Queue | R3-D15-D19 | — | E2E-R3-11 | PASS — EXECUTED & VERIFIED |
| D-16 | CUSTOMER APPROVED | round3Core · round3Adversarial (ADV-06) | R3-D16-EDIT | SEC-R3-02 | E2E-R3-04 | PARTIAL — VERIFIED WITH LIMITATIONS (ขั้น "Admin ยืนยันปิดงาน" และแก้หลังปิด ผูกกับ D-11) |
| D-17 | CUSTOMER APPROVED | quotation tests · round3Adversarial retest (ADV-16) | R3-D17-LINK · race-d17 · API-R3-C5 | — | E2E-R2-01 | PASS — EXECUTED & VERIFIED · R3-N6 FIXED — AWAITING RETEST |
| D-18 | CUSTOMER APPROVED | round3Core · round3CostEdit · round3Adversarial | R3-D18-COST | SEC-R3-05 · SEC-R3-08 | E2E-R3-09 | PARTIAL — VERIFIED WITH LIMITATIONS (บันทึกต้นทุนตอนเปิดงานจากใบเสนอราคา รอ D-11) |
| D-19 | CUSTOMER APPROVED | round3Queue · round3Adversarial (ADV-11) | R3-D15-D19 | — | E2E-R3-11 | PASS — EXECUTED & VERIFIED |
| D-20 | CUSTOMER APPROVED | FE navMenu · customerFeedbackV2 | — | — | E2E-R3-09 · E2E-NAV-01 | PASS — EXECUTED & VERIFIED |
| D-21 | CUSTOMER APPROVED | round3Queue · round3Adversarial (ADV-07/08) | R3-D21-PASTDATE | — | E2E-R3-05 | PASS — EXECUTED & VERIFIED |
| D-22 | PENDING (นโยบายชั่วคราวคงไว้: ราคามาตรฐาน/ยอดเงินซ่อนจาก Sale/ช่าง) | adv3D07a ADV3-H2 | D07A-03 | SEC-FIN-01 · SEC-R3-09 | E2E-D07A-19 | ตัวป้องกันชั่วคราว VERIFIED · กติกาจริง BLOCKED — BUSINESS CONFIRMATION |
| D-23 | PENDING (คงตัวป้องกันเดิม: ปฏิเสธเมื่อเครื่องมีสัญญาใหม่) | — | — | SEC-CON-04 | — | ตัวป้องกันชั่วคราว VERIFIED · กติกาจริง BLOCKED — BUSINESS CONFIRMATION |

สรุป 19 ข้อที่อนุมัติ: PASS 14 · PARTIAL 5 (D-01, D-08, D-09, D-16, D-18) · D-07A (ชี้แจงแล้ว): PASS ใน QA env · BLOCKED: D-07B, D-11, D-22 (กติกาจริง), D-23
PARTIAL ทั้ง 5 ข้อ: ส่วนที่ทำได้ผ่านการทดสอบแล้ว ส่วนที่เหลือรอการตัดสินใจของลูกค้า (10) ไม่ใช่โค้ดที่ล้ม

## 2. Browser scenario 20 ข้อตามใบงาน → ดู 07 หัวข้อ 1 (ทุกข้อมี test browser · ข้อ 16 บางส่วน · ข้อ 19/20 = D-07A)

## 3. Defect → test
ดู 05 (ทุก defect มีคอลัมน์หลักฐาน)
