# WOMS — Phase 5 Execution Report (14 พ.ย. 2569)

คำสั่ง: ดำเนินการต่อเองโดยไม่ต้องให้ Owner login ทีละบัญชี · ห้ามอ่านไฟล์บัญชี QA-R2 ซ้ำ · ทดสอบ Tech/Sales/Manager ด้วย unit / API integration / E2E ใน sandbox ด้วย fixture ที่ไม่ใช้รหัสผ่านจริง · ห้ามอ้างว่า UAT จริงผ่านถ้ายังไม่ได้ทดสอบ
ไม่ได้ commit / push / merge / deploy / cleanup · ไม่แตะ Production · ไม่อ่านไฟล์บัญชี QA-R2 อีก

## 1. สรุป
| ด้าน | ผล |
|---|---|
| Sandbox (unit + API integration + E2E ทุกบทบาท) | **PASS** — BE 2,361/242 SKIP · FE 342/0 · E2E flow1–19 **353 PASS / 0 FAIL** |
| Real UAT — Admin | PASS ในส่วนที่รัน (Phase 4) + ตรวจหลัง sync Phase 5: /jobs โหลดได้ stage ถูก |
| Real UAT — Tech / Sales / Manager | **BLOCKED** — ไม่มี session บัญชีจริง (ตามคำสั่งไม่อ่านไฟล์บัญชีซ้ำ) |
| Customer acceptance UAT2-17 / UAT2-18 | **BLOCKED** — ต้องให้ลูกค้ายืนยัน |
| Defect ใหม่ที่พบและแก้ | DEF-P5-01 (ปุ่ม “ตรวจปิด” แสดงกับช่าง) · DEF-P5-02 (ผู้อนุมัติไม่เห็นข้อความข้อกำหนดที่ขอเปลี่ยน — ยืนยันแล้วว่าเกิดบน UAT จริง) |
| Sandbox FAIL เดิม 2 ข้อ | แก้แล้วทั้ง 2 ข้อ โดยไม่ลดเงื่อนไขของเทสต์ (เข้มขึ้น) |

## 2. แก้ Sandbox E2E ที่ FAIL
| เดิม | สาเหตุ | การแก้ | ผล |
|---|---|---|---|
| flow4 “admin job no errors” — `GET /api/jobs/:id/photos/summary` 500 (OBS-R4-01) | fakeMongo (ฐานข้อมูลจำลองของ sandbox/unit test) ไม่มี `aggregate` · บน MongoDB จริงตอบ 200 | เพิ่ม `aggregate` ขั้นต่ำใน `test/helpers/fakeMongo.ts` (รองรับ `$match`/`$group` [`$sum`,`$push`]/`$sort`/`$limit` · stage/accumulator อื่น **throw** ไม่จำลองผิด) + เทสต์ `p5_fakeMongoAggregate.test.ts` 3 ข้อ (pipeline เดียวกับ `photoCountsByLine`) · ไม่แก้โค้ดระบบ | flow4 8/8 · และ**ลบข้อยกเว้น** photos/summary ออกจาก flow13/flow14 (เดิมยกเว้น error นี้) → เข้มขึ้น |
| flow14 “search filters to 1 row” (OBS-P4-01) | เทสต์ค้นด้วย `jobs[0]` ที่อ่านตอนเริ่ม flow — เมื่อรันต่อจาก flow อื่น งานนั้นถูกปิด/พักแล้ว จึงไม่อยู่ในแท็บ “ต้องทำ” | เลือกงาน OPEN ปัจจุบันที่รหัสไม่เป็น substring ของงานอื่น (ตรวจเป็น check แยก) และตรวจว่าแถวเดียวที่เหลือ**เป็นงานที่ค้นจริง** (เดิมนับแถวอย่างเดียว) | flow14 15/15 ในชุดรันต่อเนื่อง |

## 3. DEF-R5-01 — workflow จริงของระบบใน sandbox (`flow18_defr501_roles.py` · 46/46 PASS)
ทุกขั้นผ่าน API/หน้าจอเดียวกับผู้ใช้ ไม่บังคับ stage ในฐานข้อมูล
| ขั้น | บทบาท | ผล |
|---|---|---|
| ตั้งเบอร์ช่าง → login ด้วยเบอร์ (UAT2-04) · เบอร์ถูกรหัสผิด 401 | manager / tech | PASS |
| sales เปิดคิว → admin จัดช่าง (tech จัดเอง 403) → tech เสนอวัน (sales รับคิว 403) → admin รับคิว/คอนเฟิร์ม/เปิด JN | sales/admin/tech | PASS |
| stage ใน `GET /api/jobs` = `GET /api/jobs/:id/stage` ทุกขั้น: OPEN → ACKNOWLEDGED → IN_PROGRESS → SUBMITTED → (ตีกลับ) IN_PROGRESS → SUBMITTED → CONFIRMED | ทุกบทบาท | PASS |
| tech แนบรูป SN/งาน + บันทึกเสร็จ + `#ส่งงาน` → รายการส่งงาน PENDING · ตัวกรอง `stage=SUBMITTED` คืนงานนี้ | tech | PASS |
| sales / tech ยืนยันหรือตีกลับรายการส่งงาน → 403 | sales/tech | PASS |
| หน้า /jobs: admin และ manager เห็นปุ่ม “ตรวจปิด” + แท็บ “รอตรวจปิด” มีงาน · sales/tech **ไม่เห็นปุ่ม** (DEF-P5-01) แต่เห็นงานในแท็บ | 4 บทบาท | PASS · ไม่มี page error |
| admin ตีกลับ → IN_PROGRESS · tech ส่งใหม่ · admin ยืนยันก่อนช่างลงนาม → 409 · tech ปิดงาน + ลายเซ็น → CLOSED · admin ยืนยัน → CONFIRMED · ออกจากตัวกรองรอตรวจปิด | admin/tech | PASS |
| audit (manager): REJECT + APPROVE ของใบงาน · admin/sales อ่าน audit 403 | manager/admin/sales | PASS |
Real UAT: **BLOCKED** (ต้องใช้ tech) — ยังไม่ปิด DEF-R5-01 · แผนทดสอบ `02_REAL_UAT_TEST_PLAN.md` UAT-P5-T03..T09, A01..A04

## 4. Contract approval / audit / PDF / RBAC
### Backend `p5_contractApproval.fake.test.ts` (8/8)
คำขอค้างไม่เปลี่ยนสัญญา + ขอซ้ำ 409 · ผู้อนุมัติเห็นข้อความเต็มพร้อมเลขข้อ (รวมกรณีเรียงใหม่จำนวนเท่าเดิม) · admin/sales/tech อนุมัติ 403 · manager อนุมัติ → ได้ชุดที่ขอ + history EDIT + audit สัญญา (hash ไม่มีข้อความเต็ม) + audit คำขอ + อนุมัติซ้ำ 409 · CEO 403 ตาม RBAC ปัจจุบัน (เหมือน `adminApproval.test.ts`) · ไม่อนุมัติต้องมีเหตุผล · เปิดใช้งานสัญญาระหว่างรอ → คำขอ STALE ไม่นำไปใช้ · ขอแก้สัญญาที่ออกแล้ว 409 ไม่สร้างคำขอ
### E2E `flow19_contract_approval.py` (22/22)
admin แก้ข้อกำหนดผ่านหน้าเว็บ (สลับข้อ + เพิ่มข้อ) → คำขอ · หน้า/ API ยังเป็นชุดเดิม · sales เห็นข้อกำหนด ไม่มีปุ่มแก้ PATCH 403 ไม่มีปุ่มอนุมัติ · tech อ่าน/แก้ 403 · manager เห็นตารางก่อน/หลังข้อความเต็ม → อนุมัติผ่าน UI → APPROVED · รายละเอียดสัญญา + เอกสารพิมพ์ใช้ชุดใหม่ (6/7/8) · PDF มีข้อความชุดใหม่ (`r7/contract-approval/approved-contract.pdf`) · audit UPDATE (hash) + REQUEST/APPROVE · เปิดใช้งานแล้วแก้ 409 ทั้ง manager/admin · ข้อกำหนดคงเดิม
### PDF ทุกกรณีขีดจำกัด
flow17 110/110 (5 ชุด A–E) ซ้ำในชุดรันต่อเนื่อง Phase 5

## 5. Defects ใหม่ (พบจากการทดสอบ Phase 5)
| ID | Severity | อาการ | สาเหตุ | แก้ | หลักฐาน |
|---|---|---|---|---|---|
| DEF-P5-01 | Medium | ช่างเห็นปุ่ม “ตรวจปิด” ในหน้า /jobs (ปุ่มพาไปหน้าใบงาน แต่ช่างตรวจ/ยืนยันไม่ได้) | หน้าเว็บใช้ `jobs:close` (ช่างมีเพื่อปิดงานตัวเอง) ส่วน backend ตรวจรายการส่งงานด้วย `jobs:edit` | `src/app/jobs/page.tsx` ใช้ `jobs:edit` ให้ตรงกับ backend | flow18 (tech/sales ไม่เห็น · admin/manager เห็น) · flow14 |
| DEF-P5-02 | High (กระทบการอนุมัติ) | หน้าคำขออนุมัติไม่แสดงข้อความข้อกำหนดที่ขอเปลี่ยน — `diffFields` สรุป array เป็น “[N รายการ]” และถ้าจำนวนข้อเท่าเดิม (เช่นสลับลำดับ) จะไม่มีแถวเปลี่ยนเลย | การแสดงก่อน/หลังของคำขออนุมัติเป็นแบบทั่วไป | `lib/changeRequests.ts` เพิ่ม hook `describeChanges` (additive — action อื่นทำงานเหมือนเดิม) · `contracts.update` แสดงข้อความเต็มพร้อมเลขข้อ · หน้า /approvals แสดงหลายบรรทัด | **ยืนยันบน UAT จริง: CR-20261114-9F79E1 มี `changes: []`** (คำขอเดิมเก็บไว้แล้ว ไม่ถูกแก้ย้อนหลัง → แผน UAT-P5-A05 ให้ยกเลิกแล้วขอใหม่) · unit + flow19 |

## 6. Regression
| ชุด | Phase 4 | Phase 5 | ผล |
|---|---|---|---|
| Backend vitest (sandbox) | 2,350 / 242 SKIP | **2,361 PASS / 242 SKIP** (+3 aggregate, +8 approval) | PASS |
| Backend tsc | ผ่าน | ผ่าน (sandbox + เครื่อง Owner) | PASS |
| Backend vitest บนเครื่อง Owner | NOT VERIFIED | NOT VERIFIED (node_modules ของ Windows รันจาก Linux VM ไม่ได้ · ไฟล์ sha256 ตรงกับ sandbox) | Owner รัน `npm test` |
| Frontend node --test | 342 | **342 / 0** (sandbox + เครื่อง Owner) | PASS |
| Frontend tsc / next build | ผ่าน | ผ่าน (tsc ทั้งสองที่ · build sandbox) | PASS |
| Sandbox E2E (flow1–19 รันต่อเนื่อง ฐานข้อมูลเดียว) | 282 / 2 FAIL | **353 PASS / 0 FAIL** | PASS |
หมายเหตุ: baseline “321 PASS / 2 FAIL” ในคำสั่งมาจากตัวเลขที่สรุปผิดในแชท — ค่าจริง Phase 4 = 282/2 (OBS-P4-02)

## 7. ไฟล์ที่เปลี่ยนใน Phase 5 (sync ลงเครื่อง Owner · sha256 ตรง · ตรวจไฟล์บนเครื่อง = ต้นฉบับก่อนเขียนทับ 6/6)
Backend: `src/lib/changeRequests.ts` (hook describeChanges · CRLF คงเดิม), `src/routes/contracts.ts`, `src/domain/contractClauses.ts` (`clausesText`, `MAIN_CLAUSE_LAST`), `test/helpers/fakeMongo.ts` (aggregate · CRLF คงเดิม), `test/p5_fakeMongoAggregate.test.ts` (ใหม่), `test/p5_contractApproval.fake.test.ts` (ใหม่)
Frontend: `src/app/jobs/page.tsx` (DEF-P5-01), `src/app/approvals/page.tsx` (DEF-P5-02 แสดงหลายบรรทัด)
Harness (sandbox เท่านั้น ไม่อยู่ใน repo): flow14 (fixture), flow13/flow14 (ลบข้อยกเว้น photos/summary), flow18, flow19 ใหม่ · หลักฐานแยกไป `r7/`

## 8. หลักฐาน
`Claude outputs/uat-round-2/r7/` — `e2e/` (log ทุก flow + summary) · `flow18.log`, `flow19.log` · `contract-approval/` (ภาพ admin/manager/รายละเอียด + PDF ที่อนุมัติ) · `contract-pdf/` (5 ชุด) · `screens/` · `be-vitest.log`, `fe-tests.log` · `uat/p5-jobs-admin-after-sync.jpg`
