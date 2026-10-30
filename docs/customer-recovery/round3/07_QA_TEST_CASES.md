# 07 · QA Test Cases (Round 3)

## ชุดทดสอบที่เพิ่ม/เปลี่ยนตาม Release Closure Directive (30 ต.ค. 69 ค่ำ)
| ชุด | Scenario ใหม่/เปลี่ยน | ครอบคลุม |
|---|---|---|
| `api-qa-price` (เขียนใหม่ — ชื่อไฟล์เดิม) | COST-01..14, F1-01..10 | 2,000 = ต้นทุน ไม่เป็นรายรับ · approve-cost/ประวัติ · ต้นทุนมาตรฐานซ่อนจาก CEO/ACC/Viewer/Sale/ช่าง · ค่าติดตั้งจาก Model Index (`verified:false`) + capture · Model Index แก้ภายหลังไม่กระทบรายการที่ capture · รายการเดิมไม่เปลี่ยน · 8 คำขอพร้อมกันระหว่างเปลี่ยนต้นทุน · ใบเสนอราคาไม่มีต้นทุน · confirm-samples (พร้อมกัน 2 process) · ชื่อคล้าย 409/ยืนยัน/race/รายงาน · profitVerified · `@` ในหน่วย |
| `e2e-price` | E2E-PRICE-01..03, E2E-F1-02 | หน้าข้อมูลหลัก (ต้นทุนมาตรฐาน) · ป้ายยังไม่ยืนยันในการ์ดการเงิน · dialog ชื่อคล้าย · ปุ่ม capture ค่าติดตั้ง |
| `api-qa-fin` | FIN-P03-*, FIN-P04-*, FIN-P05-*, F1-REKEY | maker-checker (ตัวเอง/หลังส่งตรวจใหม่/พร้อมกัน/DENIED log) · ยกเลิกเอกสารบัญชี (ขอ→อนุมัติ→ปลดเลข→เอกสารแทน) · CONFLICTING_REFERENCE · re-key กลุ่มเลขซ้ำ · FIN-01..12 เดิมผ่านทั้งหมด |
| `e2e-fin` | E2E-FIN-P03, P04, P05 | ปุ่มยืนยันของผู้บันทึก · ยกเลิกเอกสาร + อนุมัติ + แสดงขีดฆ่า + เอกสารแทน |
| `api-qa-job` | JOB-P07-01..04, JOB-P08-01..03, JOB-F2-02/03/14/15 (+ADV12-08) | แก้อะไหล่ใบงานปิดแล้วผ่าน revision · ต้นทุนซ่อน · ผู้เก็บลายเซ็น · hash ไม่ส่งให้ผู้ไม่เห็นต้นทุน · unitCost จากผู้ไม่มีสิทธิ์ · ป้าย PDF ฉบับแก้ไข · ชื่อพนักงาน (รวมที่ปิดใช้งาน) ห้ามเป็นชื่อลูกค้า |
| `e2e-job` | E2E-JOB-03/04 + R10/ADV11B-04 | ขอแก้อะไหล่บนใบงานปิด · ผู้เก็บลายเซ็นบนมือถือ · หมุนจอไปกลับ 3 รอบลายเซ็นไม่หด · เปลี่ยนความกว้างหลังเซ็นลายเซ็นคงอยู่ |
| `api-qa-decisions` | DEC-07 ปรับ | ใบงาน CLOSED เพิ่มอะไหล่ตรง → 409 (P-07) |
| unit backend | `finReleaseClosure`, `jobSliceP07P08`, `r12fix`, `installPrice` (เขียนใหม่) | ตามข้อบน |
| ops | `uat-backup-restore.mjs`, `uat-rehearsal.sh`, `uat-smoke.mjs` | ซ้อม UAT ทั้งชุดบนฐาน QA (08) |

---

## ชุดทดสอบที่เพิ่มตาม directive 30 ต.ค. 69 (ทุกชุดรันใน `qa3/run-all.sh` → ผลใน 08)

| ชุด | ประเภท | Scenario | ครอบคลุม |
|---|---|---|---|
| `api-qa-fin` | API + MongoDB จริง | FIN-01..12 · FIN-SEC-01..05 (สิทธิ์ 9 บทบาท, IDOR, ยอดผิดรูปแบบ, รับเกิน, พร้อมกัน) · Q-R3-11 · FIN-AUDIT · R4/R5 (ADV4-02/07/08/09/12, ADV5-04/06/07) | D-11 ทั้งหมด (FINANCE_WORKFLOW_D11 หัวข้อ 5) |
| `e2e-fin` | Chromium | E2E-FIN-01..07: ส่ง/อนุมัติใบ · แจ้งชำระ · คิวรอตรวจของ ACC · ชำระบางส่วน/ครบ · เอกสารบัญชี · สิทธิ์หน้าจอ · การ์ดการเงินในใบงาน | D-11 UI |
| `api-qa-price` | API + MongoDB | PRICE-01..12 + R4-PRICE-CAT: snapshot · คำขอเปลี่ยนราคา → อนุมัติ → ประวัติ · snapshot เดิมไม่เปลี่ยน · ราคายังไม่อนุมัติ ≠ 0 · รุ่นซ้ำหลายหมวดหมู่ · งานเดิมไม่คำนวณใหม่ · 8 คำขอพร้อมกันระหว่างเปลี่ยนราคา · Sale/ช่างไม่เห็นราคา · รายงานกระทบยอด | Q-R3-14 / ADV3-01 / D-22 |
| `e2e-price` | Chromium | E2E-PRICE-01..03: สถานะ/อนุมัติราคาในข้อมูลหลัก · ป้ายใน Margin · snapshot ในรายการเครื่อง | Q-R3-14 UI |
| `api-qa-job` | API + MongoDB | JOB-R13-01..04 (คำขอแก้หลังปิด → อนุมัติ → revision → ลงนามใหม่) · JOB-R03-01 · JOB-R12-01..03 · R4/R5 (ADV4-01, ADV4-05, ADV5-05) | Q-R3-13 / Q-R3-03 / Q-R3-12 |
| `e2e-job` | Chromium (มือถือจำลองสำหรับช่าง) | E2E-JOB-01 แก้หลังปิดงานจนลงนามใหม่บนมือถือช่าง · E2E-JOB-02 ใบงานยกเลิกแบบย่อ | Q-R3-13 / Q-R3-03 UI |
| `api-qa-activity` | API + MongoDB | ACT-API-01..17 (ผู้กระทำ, ล็อกอิน, ผู้ใช้, CRUD, DENIED, RBAC, ส่งออก, ซ่อนต้นทุน, viewer, context, แก้/ลบไม่ได้, ข้อมูลอ่อนไหว, สคริปต์, auto-capture, ความปลอดภัย) + R4/R5 (ADV4-03/04/10/14/15, ADV5-02/03) | Activity Log (AUDIT_COVERAGE_MATRIX) |
| `e2e-activity` | Chromium | E2E-ACT-01..06: ตัวกรอง · แบ่งหน้า · เทียบก่อน/หลัง · ส่งออก · สิทธิ์ · ล็อกอิน | Activity Log viewer |
| `api-qa-decisions` | API + MongoDB + สคริปต์ | DEC-01 ACC · DEC-02 Q-R3-01 · DEC-03 Q-R3-05 · DEC-04 Q-R3-10 · DEC-05 Q-R3-04 (dry-run/apply/idempotent/revoke) · DEC-06 ADV6-01/05 · DEC-07 ADV7-01/02 | การตัดสินใจ SA/PM ที่เหลือ + ผลแก้ R6/R7 |
| `e2e-r4fix` (+ fixture จาก `api-qa-job`) | Chromium | หน้าจอที่เปลี่ยนจากผลแก้ R4 (ใบงานยกเลิกของช่าง, ลงนามใหม่) | ADV4-01, ADV4-05 |
| `fe-lint` | ESLint `next/core-web-vitals` | ทั้ง frontend | directive §11 |
| unit backend | vitest | เพิ่ม `installPrice`, finance domain/route, job revision, activity, `r4fix*`, `r5fix*`, `r6fix` (รวม ADV7) | ทุกส่วน |

บทบาทที่ทดสอบ: Admin · ACC · CEO · Manager · Sale · ช่าง A · ช่าง B · Viewer · ไม่ล็อกอิน (+ Manager2, ACC2 สำหรับกรณีหลายผู้ใช้)
ไม่ได้ทดสอบ: Firefox / WebKit (ดาวน์โหลด browser ไม่ได้ใน environment — BLOCKED) · อุปกรณ์จริง · UAT (BLOCKED)

---

## ประวัติ: test cases ก่อน directive 30 ต.ค. 69


ทุกชุดรันกับ API จริง (Express) + MongoDB replica set จริงในเครื่อง QA · ไม่มี mock ยกเว้น unit test (fakeMongo) ซึ่งไม่นับเป็นหลักฐาน integration
ผลการรันอยู่ใน 08 · สคริปต์อยู่ใน `qa/customer-recovery-round3/`

## 1. Browser E2E 20 scenario ที่ใบงานกำหนด → test ที่ใช้

| # | Scenario | Test (browser) | ส่วนที่ยืนยันผ่าน API/DB เพิ่ม | ความครอบคลุม |
|---|---|---|---|---|
| 1 | Sale creates installation queue | E2E-R3-01 (วางข้อความ LINE · ช่องบังคับ · Enter ไม่ส่ง · ตรวจทาน · DB) · E2E-R3-02 (ร่าง) · E2E-QUE-01 · E2E-QUE-03 | R3-D05-QUEUE | เต็ม |
| 2 | Tech proposes | E2E-R2-11 (ช่างเสนอจากการ์ดแชท) · E2E-PM01-01 (มือถือ จากตาราง PM) · E2E-R3-05 (PM หลายเครื่อง) | R3-D21-PASTDATE | เต็ม |
| 3 | Sale confirms | E2E-R2-11 · E2E-WF01-01 | — | เต็ม |
| 4 | Admin opens JN | E2E-R2-11 · E2E-WF01-01 · E2E-R3-03 | — | เต็ม |
| 5 | Duplicate JN prevention | E2E-R3-03 (2 หน้าต่างพร้อมกัน → JN เดียว) | — | เต็ม |
| 6 | Tech completes installation | E2E-R3-04 (มือถือ · วันติดตั้งจริง) · E2E-R2-06 | R3-D10-INSTALLDATE | เต็ม |
| 7 | Install date drives PM | E2E-R3-04 (DB: ฐาน PM/วันติดตั้ง = วันที่ช่างกรอก ไม่ใช่วันส่ง) | R3-D10-INSTALLDATE | เต็ม |
| 8 | Multiple machines share a PM queue | E2E-R3-05 | R3-D12-MULTIPM | เต็ม |
| 9 | PM completed only after closure | E2E-R3-05 (ปิดงานแล้ว DONE เฉพาะเครื่องที่ทำ · เครื่องที่ถอด → PLANNED) · E2E-R2-07 | R3-D12-MULTIPM (ก่อนปิดยังไม่ DONE) | เต็ม |
| 10 | Chat mentions and notifications | E2E-R3-06 (แท็ก → กระดิ่งมือถือ → เปิดข้อความ · แจ้งเตือน 1 รายการ) · E2E-R2-13 | R3-D13-MENTION | เต็ม (ยกเว้น push บนอุปกรณ์จริง) |
| 11 | Chat cancellation | E2E-R3-07 | R3-D14-CANCEL | เต็ม |
| 12 | Technician data restrictions | E2E-R2-09 · E2E-R2-05 · E2E-R3-11 | security-matrix · SEC-R3-02/04 | เต็ม |
| 13 | Quotation linking | E2E-R2-01 | R3-D17-LINK · API-R3-C5 | เต็ม |
| 14 | Signature and closure | E2E-R2-06 · E2E-R3-04 | R2-SIG-01 (api-qa-r2) | เต็ม |
| 15 | Technician reassignment | E2E-R2-12 | — | เต็ม |
| 16 | Queue edit and reschedule | E2E-R2-02 (แก้คิวผ่าน dialog รวมคิวเลื่อนงานของใบงานเดิม) · E2E-R2-03 (ขอคิวใหม่) | — | **บางส่วน:** การสร้างคิวเลื่อนงาน (`/reschedule`) เรียกผ่าน API เป็น fixture ไม่ได้กดจากหน้าจอ |
| 17 | Billing regression | E2E-R2-10 | — | เต็ม (flow เดิม · D-11 ยังไม่อนุมัติ) |
| 18 | Mobile technician interface | E2E-R2-04 · E2E-R3-04 · E2E-R3-06 · E2E-PM01-01 | — | Chromium จำลองมือถือเท่านั้น |
| 19 | Equipment Master Filter and Auto Fill (D-07A) | E2E-D07A-19 (Admin เพิ่มรุ่นผ่านหน้าข้อมูลหลัก · ฟอร์มรับเครื่องกรองหมวดหมู่ตามประเภท · เลือกรุ่นแล้วเติมประเภท/หมวดหมู่ + แสดงราคามาตรฐาน · เปลี่ยนประเภทล้างรุ่น · บันทึกจริงแล้ว DB ตรง · ฟอร์มคิวกรองรุ่นตามประเภท · Viewer ดูอย่างเดียว) | D07A-03 / D07A-04 / D07A-07 (backend ตรวจซ้ำ) | เต็ม (ฟอร์มเครื่อง + คิว) |
| 20 | Equipment Seed and QA Mapping (D-07A) | E2E-D07A-20 (seed ข้อมูลตัวอย่างลูกค้าบนฐาน QA → หน้าข้อมูลหลักแสดงครบ · จับคู่เครื่องเดิมแบบตรงตัว → หน้าเครื่องแสดงประเภท/หมวดหมู่ · แถวที่ไม่ตรงไม่ถูกแตะ · rollback คืนค่า) | D07A-01 / D07A-05 / D07A-07 | เต็มใน QA · production ไม่ได้ทำ (D-07B) |

## 2. ชุดทดสอบ Round 3 ใหม่

### api-qa-r3 (15 scenarios)
R3-D01-MATRIX · R3-D04-PASSWORD · R3-D06-CODE · R3-D10-INSTALLDATE · R3-D16-EDIT · R3-D09-HIRE · R3-D08-CONTRACT · R3-D17-LINK · R3-D18-COST · R3-D13-MENTION · R3-D14-CANCEL · R3-D05-QUEUE · R3-D21-PASTDATE · R3-D12-MULTIPM · R3-D15-D19

### api-qa-d07a (8 scenarios · MongoDB จริง · สคริปต์รันจริงด้วย `npx tsx`)
| ID | สิ่งที่ตรวจ |
|---|---|
| D07A-01 | seed dry-run ไม่เขียน · apply สร้าง 6 รุ่นตัวอย่างของลูกค้า · apply ซ้ำไม่สร้างเพิ่ม · ฐานที่ไม่ใช่ `woms_qa_*` → REFUSED |
| D07A-02 | CRUD + สิทธิ์ 7 บทบาท · ช่องบังคับ/ราคา · ชุดซ้ำไม่สนตัวพิมพ์ → 409 · Admin แก้ราคา = คำขออนุมัติ · Manager อนุมัติ · ปิดใช้งาน/เปิดซ้ำ |
| D07A-03 | cascade ประเภท → หมวดหมู่ → รุ่น · ค้นหารุ่น · ราคามาตรฐานตามสิทธิ์ |
| D07A-04 | Auto Fill + ตรวจความสัมพันธ์ที่ backend: เครื่อง (สร้าง/แก้/นำเข้า Excel) · คิว · ใบงาน · ประเภทใหม่ "ตู้ฟรีส" |
| D07A-05 | mapping: ตรงตัวหลัง normalize เท่านั้น · AMBIGUOUS / CONFLICT / UNMAPPED / NO_MODEL · dry-run ไม่เขียน (sha256) · apply เฉพาะ MATCHED ไม่แก้ค่า model เดิม · rollback คืน byte-identical |
| D07A-06 | แก้ราคา/ปิดใช้งานรุ่นใน master ไม่แก้เครื่อง คิว ใบงาน หรือ Model Index เดิม (sha256) |
| D07A-07 | retest ADV3: สร้างชุดเดียวกันพร้อมกัน 8 คำขอ (unique index จริง) · zero-width · ปิดใช้งานด้วย updatedAt เก่า → 409 · ใบงาน (เปิด/เพิ่ม/แก้รายเครื่อง) ประเภทขัดกับรุ่น → 400 · ประเภทเดิมนอกรายการ/ประเภทที่ master ปิด แก้ฟิลด์อื่นได้ · rollback รายฟิลด์ไม่ทับการแก้ภายหลัง (exit 3 + รายงาน) · host guard |
| D07A-08 | retest R3C: เพิ่มเครื่องในคลัง (id/serial) และเปิดใบงานพร้อมเครื่องในคลัง ประเภทขัดกับรุ่นในคลัง → 400 · ประเภทที่มี zero-width เก็บเป็นค่ามาตรฐาน · Admin แก้คิวที่มีรายการประเภทเดิมนอกรายการ → 200 · ปิดใช้งานซ้ำไม่เพิ่ม audit · rollback: ไฟล์ถูกแก้/ id ผิด → exit 2 ไม่เขียน · rollback จาก journal · rollback ซ้ำ exit 0 |

### e2e-d07a (2 scenarios) — ดูตารางข้อ 1 แถว 19–20

### unit D-07A
`test/d07aEquipmentModel.test.ts` (10) · `test/adv3D07a.test.ts` (ของผู้ตรวจ R3B: ADV3-D1 skip → ทดสอบบนฐานจริงใน D07A-07 · ADV3-P1 skip = BLOCKED Q-R3-14) · `test/adv3cD07a.test.ts` (ของผู้ตรวจ R3C 27 test: C23 homoglyph skip = ยอมรับความเสี่ยง) · FE `scripts/equipmentModelCascade.test.ts` (5)

### security-r3 (9 scenarios · บทบาท Admin, CEO, Manager, Sale A/B, Tech A, Tech B, Viewer, ไม่ล็อกอิน)
| ID | สิ่งที่ตรวจ |
|---|---|
| SEC-R3-01 | ไม่ล็อกอิน → 401 ทุก endpoint ใหม่ (installed-on, result-note, PM propose, draft, chat cancel, chat audit, change-password, PDF/Excel) |
| SEC-R3-02 | ช่าง B ใช้ id ของช่าง A ตรง ๆ 18 รายการ (ใบงาน เครื่อง คิว PM วันติดตั้ง หมายเหตุ หลักฐาน แชท) → 403/404 และ DB ไม่เปลี่ยน |
| SEC-R3-03 | ร่างคิวของ Sale A: Sale B / Admin / ช่าง / Viewer / CEO อ่าน แก้ ส่ง ลบ ไม่ได้ |
| SEC-R3-04 | ช่าง B ค้นหาด้วย SN/เลขใบงานของช่าง A · หน้า 2 · offset · export Excel → ไม่พบ (มีตรวจเชิงบวกว่าช่าง A ค้นเจอ) |
| SEC-R3-05 | ต้นทุนอะไหล่ใน JSON / ไทม์ไลน์ / PDF ประวัติเครื่อง / Excel ทั้ง 7 บทบาท รวมบันทึกเดิมก่อน R3-N1 |
| SEC-R3-06 | CEO / Viewer เรียก endpoint เขียน 10 รายการ → 403 และ DB ไม่เปลี่ยน |
| SEC-R3-07 | 11 endpoint อ่าน × 9 สถานะผู้ใช้: ไม่มี 5xx · ไม่ล็อกอิน 401 |
| SEC-R3-08 | retest adversarial review: path ตัวพิมพ์ต่าง/`//` ไม่หลุดต้นทุน (CEO/Viewer) · Manager ยังเห็น · ต้นทุนในคำขออนุมัติ/Audit ถูกซ่อน · CEO ดูคำขอได้ อนุมัติไม่ได้ |
| SEC-R3-09 | D-07A: เขียน `/api/equipment-models` ได้เฉพาะ Admin (ผ่านคำขออนุมัติเมื่อแก้/ปิด) และ Manager · บทบาทอื่น 403 · ไม่ล็อกอิน 401 · ราคามาตรฐาน `null` สำหรับ Sale/ช่าง/ผู้ไม่มีสิทธิ์ยอดเงิน · URL ตัวพิมพ์ต่าง · ข้อมูลไม่เปลี่ยนเมื่อถูกปฏิเสธ |

### e2e-r3 (11 scenarios) — ดูตารางข้อ 1
### e2e-r3-carry (3 scenarios) — retest defect ค้างจาก Round 2
| ID | Defect | วิธี |
|---|---|---|
| E2E-R3-C4 | QA-C4 | browser: แก้ใบงาน INSTALL เดิม · ประเภทย่อยว่าง · บันทึกได้ · DB jobType คง INSTALL |
| E2E-R3-C6 | QA-C6 | browser: กรอกประกันในคิวติดตั้งขาย แล้วเปลี่ยนเป็นเช่า → DB ไม่มีค่าประกัน |
| API-R3-C5 | QA-C5 | API+DB: ยกเลิกใบงานที่ผูกใบเสนอราคา → ล้าง jobId/jobLinkedAt/By/ById · เก็บใน cancelledJobIds |

### race-d17
ยิงผูกใบงานกับยกเลิกใบเสนอราคาพร้อมกัน 40 รอบ · ผ่านเมื่อไม่มีใบยกเลิกที่ยังผูกใบงาน (R3-N6)

### unit ของผู้ตรวจอิสระ (รวมเข้า suite)
`test/round3Adversarial.core.test.ts` · `.queue.test.ts` · `.retest.core.test.ts` · `.retest.queue.test.ts` · `test/round3CostEdit.test.ts` — ADV-04 เป็น `it.skip` (BLOCKED — BUSINESS CONFIRMATION)

### d07-test (16 checks · ข้อมูลสังเคราะห์)
extract ไม่เขียน · พบค่าสะกดต่าง/รุ่นไม่อยู่ใน master/master ไม่ถูกใช้/ประเภทขัดกัน/ข้อมูลขาด · template ครบ · dry-run mapping ว่าง → invalid · dry-run ถูกต้องไม่เขียน · apply ฐานไม่ใช่ QA ถูกปฏิเสธ · apply ถูกต้องและไม่แตะฟิลด์อื่น · rollback คืนค่า byte-identical (sha256 ของ EJSON)

### preflight (อ่านอย่างเดียว)
PF-01..10 (Round 2) + PF-R3-01..07 · รันกับ legacy fixture ที่จงใจใส่ข้อมูลผิด และฐาน QA หลังทดสอบ · `preflight-proof.mjs` ยืนยันว่าไม่เขียน (จำนวนเอกสาร + index ก่อน/หลัง)

### verify-results (ตัวตรวจผลรอบ)
อ่านไฟล์ผลของทุกชุดเอง ไม่เชื่อ exit code: ชุดที่ต้องมีขาด = FAIL · ไฟล์ต้องใหม่กว่าเวลาเริ่มรอบ · scenario > 0 และทุก scenario PASS พร้อม check ≥ 1 · vitest skipped ต้องเท่ากับจำนวนที่ระบุ (`EXPECTED_SKIPS_BE_TEST`) · race ไม่มี error · SHA ใน ENV.txt ตรงกับ `git rev-parse HEAD` ตอนตรวจ และ repo ไม่ dirty · lint บันทึกเป็น NOT TESTED — ESLINT CONFIGURATION MISSING

## 3. ชุดเดิมที่รันซ้ำเป็น regression
security-matrix (Round 2) · api-qa-r2 · api-qa-r1-regression · e2e-r2 · e2e-r1-regression · backend unit (vitest) · backend real-DB integration (3 ไฟล์ `*.mongo.int.test.ts`) · frontend unit (`node --test`) + test:tz

## 4. Fixture ที่ต้องปรับเพราะกติกาที่อนุมัติ (ไม่ใช่การลดเงื่อนไข)
| ชุด | เดิม | ปรับเป็น | เหตุ |
|---|---|---|---|
| unit vfbClose / fbV1 / round8_jobs, lib `techCloseJob` | บันทึกเครื่องเสร็จโดยไม่ส่งวันที่ | ส่ง `installedOn` | D-10 |
| unit round8_customers / gap_customers | รหัสลูกค้าใหม่ 5+ ตัว | รหัส ≤ 4 | D-06 |
| unit adminApproval | CEO อนุมัติคำขอได้ | Manager อนุมัติ · CEO 403 | D-01/D-02 |
| e2e-r1 NAV-01 | มีเมนู `/notifications` | ไม่มี | D-20 |
| e2e-r1 QUE-01 / e2e-r2 R2-11 | ส่งคิวทันที | กด "ยืนยันส่งคิว" ในหน้าตรวจทาน | D-05 |
| api-qa-r1 QA-REV-QUEUE | คิวไม่มีผู้ติดต่อ/เบอร์/ที่อยู่ | ใส่ครบ · และตรวจว่า 400 มาจากฟิลด์ที่ทดสอบจริง (`error.field`) | D-05 — เดิม check "INSTALL → 400" จะผ่านเพราะช่องขาดแทน |
