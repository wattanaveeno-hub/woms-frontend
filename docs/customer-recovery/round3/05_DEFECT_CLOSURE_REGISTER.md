# 05 · Defect Closure Register (Round 3)

สถานะอ้างอิงรอบทดสอบ **final-5** (backend `08e2aba` · frontend `7fd49dd`) — หลักฐานใน 08 · ผล final-3 และ final-4 เก็บไว้เป็นประวัติ
คำสถานะ: PASS — EXECUTED & VERIFIED · PARTIAL — VERIFIED WITH LIMITATIONS · FIXED — AWAITING RETEST · BLOCKED — BUSINESS CONFIRMATION · NOT A DEFECT · NOT TESTED

## 1. สรุปจำนวน

| กลุ่ม | ทั้งหมด | PASS | PARTIAL | FIXED — AWAITING RETEST | BLOCKED | NOT A DEFECT | เปิดอยู่ไม่มีแผน |
|---|---|---|---|---|---|---|---|
| ค้างจาก Round 2 (ตามใบงาน) | 19 | 18 | 1 (BUG-V2-21) | 0 | 0 | 0 | 0 |
| พบใหม่โดยทีม Round 3 (R3-N1..N6) | 6 | 5 | 0 | 1 (R3-N6) | 0 | 0 | 0 |
| Independent adversarial review (ADV-01..17 + ADV-11b) | 18 | 14 | 1 (ADV-02 → N3) | 0 | 1 (ADV-04) | 2 (ADV-11b, ADV-13) | 0 |
| Adversarial retest (N1..N3) | 3 | 2 | 0 | 0 | 1 (N3) | 0 | 0 |
| Adversarial review R3B — D-07A (ADV3-01..10) | 10 | 9 | 0 | 0 | 1 (ADV3-01) | 0 | 0 |
| Independent retest R3C (ADV3C-01..06) | 6 | 4 | 1 (ADV3C-03) | 0 | 0 | 1 (ADV3C-06) | 0 |
| QA tooling / test defects (T-01..T-05) | 5 | 5 | 0 | 0 | 0 | 0 | 0 |

High/Critical ที่ยังเปิด: **1 High ที่รอการตัดสินใจทางธุรกิจ — ADV3-01** (ราคามาตรฐานสองแหล่ง · Q-R3-14) · ไม่มี High/Critical ที่เป็นโค้ดผิดค้าง · High ที่พบและแก้ใน Round 3: ADV-01, ADV-03, ADV-12

## 2. Defect ค้างจาก Round 2

| ID | Sev | เรื่อง | หลักฐาน Round 3 | สถานะ |
|---|---|---|---|---|
| BUG-V2-17 | High | ช่างเรียกข้อมูลทั้งบริษัทผ่าน API | security-matrix · SEC-R3-02 (18 คำขอ IDOR) · SEC-R3-04 (ค้นหา/แบ่งหน้า/export) · E2E-R2-09 · D-03 อนุมัติแล้ว | PASS — EXECUTED & VERIFIED |
| QA-F07 / TECH-02 | Medium | ช่างเห็นประวัติรอบนัด/บทสนทนา/SN ในหน้าคิว | E2E-R2-05 · R3-D15-D19 · E2E-R3-11 (เห็นเฉพาะ #n + 4 ตัวท้าย) | PASS — EXECUTED & VERIFIED |
| BUG-V2-19 | High | ปิดงานผ่านเส้นทางแชทโดยไม่มีลายเซ็นช่าง | api-qa-r2 R2-SIG-01 · E2E-R2-06 | PASS — EXECUTED & VERIFIED |
| BUG-V2-21 | Medium | กลุ่มแชทช่างซ้ำ | E2E-R2-08 (6 แท็บพร้อมกันบน DB ใหม่) · preflight PF-01 | PARTIAL — VERIFIED WITH LIMITATIONS: สาเหตุเดิม reproduce แบบกำหนดซ้ำไม่ได้ (บันทึกใน Round 2) · กลุ่มซ้ำเดิมใน production ต้องใช้ M-01 |
| QA-F06 | Medium | แก้คิวเลื่อนงานของใบงาน INSTALL เดิมไม่ได้ | E2E-R2-02 | PASS — EXECUTED & VERIFIED |
| BUG-V2-18 | Low | ช่างที่ถูกย้ายได้ลิงก์ที่เปิดไม่ได้ | E2E-R2-12 | PASS — EXECUTED & VERIFIED |
| QA-F14 | Low | (รากเดียวกับ BUG-V2-18) | E2E-R2-12 | PASS — EXECUTED & VERIFIED |
| QA-C1 | Low | ป้าย PM ในหน้าคิว | E2E-PM01-01 | PASS — EXECUTED & VERIFIED |
| QA-C2 | Low | เมนูมือถือเฉพาะช่าง | E2E-NAV-01 | PASS — EXECUTED & VERIFIED |
| QA-C3 | Low | id หมวดเมนูไม่ซ้ำ | E2E-NAV-01 | PASS — EXECUTED & VERIFIED |
| QA-C4 | Low | ประเภทย่อยว่างในหน้าแก้ใบงานติดตั้งเดิม | **E2E-R3-C4 (browser ครั้งแรก)**: ช่องว่าง + คำอธิบาย · บันทึกได้ · DB jobType คง INSTALL | PASS — EXECUTED & VERIFIED (Round 2: FIXED — AWAITING RETEST) |
| QA-C5 | Low | jobLinkedAt ไม่ล้างเมื่อยกเลิกใบงาน | **API-R3-C5 (API + DB จริง)**: ล้าง jobId/jobLinkedAt/By/ById · cancelledJobIds | PASS — EXECUTED & VERIFIED (Round 2: FIXED — AWAITING RETEST) |
| QA-C6 | Low | ค่าประกันค้างเมื่อเปลี่ยนประเภทงาน | **E2E-R3-C6 (browser)** + api-qa-r2 R2-QUE-01 | PASS — EXECUTED & VERIFIED (Round 2: PARTIAL) |
| QA-C7 | Low | race ยกเลิกตาราง PM | api-qa-r2 R2-PM-01 · E2E-R2-07 | PASS — EXECUTED & VERIFIED |
| QA-F16 | Medium | ผูกใบเสนอราคากับใบงาน (D-17) | R3-D17-LINK · E2E-R2-01 · race-d17 | PASS — EXECUTED & VERIFIED (ดู R3-N6) |
| QA-F18 | Low | เสนอวันย้อนหลังได้ (D-21) | R3-D21-PASTDATE · E2E-R3-05 · ADV-07/08 | PASS — EXECUTED & VERIFIED |
| CHAT-02 | — | แท็ก @ และแจ้งเตือน (D-13) | R3-D13-MENTION · E2E-R3-06 · E2E-R2-13 | PASS — EXECUTED & VERIFIED (push บนอุปกรณ์จริง NOT TESTED) |
| CHAT-03 | — | การ์ดคิวในแชท (เสนอ/รับ/คอนเฟิร์มจากการ์ด) | E2E-R2-11 | PASS — EXECUTED & VERIFIED |
| TECH-02 | — | ดู QA-F07 | | PASS — EXECUTED & VERIFIED |

(19 แถว: QA-C1..C7 นับแยก · QA-F07 กับ TECH-02 เป็นเรื่องเดียวกันแต่ใบงานระบุทั้งสองชื่อ จึงคงไว้ทั้งสองแถว)

## 3. Defect ใหม่ที่ทีม Round 3 พบ

| ID | Sev | พบจาก | เรื่อง | Root cause | แก้ | Regression test | สถานะ |
|---|---|---|---|---|---|---|---|
| R3-N1 | Medium | api-qa-r3 R3-D18-COST | ข้อความประวัติเครื่องมี "× 2 ชิ้น @ 350" | timeline note ใช้ label ที่มีต้นทุน | BE `f4d7c4d` | R3-D18-COST · SEC-R3-05 | PASS — EXECUTED & VERIFIED |
| R3-N2 | Medium | E2E-R3-06 | แจ้งเตือนการแท็กไม่แสดงในมุมเริ่มต้น "ต้องดำเนินการ" | CHAT_MENTION เป็นประเภท "เพื่อทราบ" แต่กระดิ่งเปิดมุมที่กรองออก | FE `88f527d` กระดิ่งเปิดมุม "ยังไม่อ่าน" | E2E-R3-06 | PASS — EXECUTED & VERIFIED |
| R3-N3 | Medium | ตรวจ export/PDF ระหว่างเขียน security-r3 | PDF ประวัติเครื่องแสดงต้นทุนจากบันทึกเดิมแก่ CEO/Viewer | PDF ไม่ผ่าน guard JSON | BE `80d3276` | SEC-R3-05 (pdftotext) | PASS — EXECUTED & VERIFIED |
| R3-N4 | Medium | security-r3 SEC-R3-05 | ไทม์ไลน์ JSON key `detail` แสดงต้นทุนเดิม | `detail` ไม่อยู่ในรายการ key ข้อความ | BE `02e11c1` | unit (ล้มก่อนแก้: `evidence/r3-n4-test-without-fix.txt`) · SEC-R3-05 | PASS — EXECUTED & VERIFIED |
| R3-N5 | Medium | security-r3 SEC-R3-08 หลังแก้ ADV-05 | CEO เปิดคำขออนุมัติแก้อะไหล่ เห็นต้นทุนใน before/after | คำขอเก็บสำเนาเอกสารทั้งก้อน · guard ซ่อนเฉพาะ path อะไหล่ | BE `a1082bd` | SEC-R3-08 · unit round3CostEdit | PASS — EXECUTED & VERIFIED |
| R3-N6 | Medium | final-2 api-qa-r3 R3-D17-LINK (1 ใน 5 รอบ) | ผูกใบงาน ‖ ยกเลิกใบเสนอราคา สำเร็จทั้งคู่ → ใบยกเลิกยังผูกใบงาน | `setQuotationStatus` ตรวจ updatedAt จากการอ่าน แต่คำสั่งเขียนกรองเฉพาะ status | BE `55b8da6` ใส่ updatedAt ในเงื่อนไขเขียน | race-d17 (40 รอบ/run) · R3-D17-LINK | **FIXED — AWAITING RETEST**: reproduce ตามต้องการไม่ได้ — โค้ดก่อนแก้ 0/90 รอบในการรันแยก (`evidence/r3-n6-race-on-pre-fix-code*.json`) เกิดเฉพาะตอนเครื่องรับภาระทั้งชุด · หลังแก้ 0 ใน 15 + 40 รอบ ยืนยันด้วยเหตุผลเชิงโค้ด ไม่ใช่การ reproduce |

## 4. Independent adversarial review (ผู้ตรวจแยก ไม่ได้เขียนโค้ด) — `evidence/adversarial-review/`

| ID | Sev | ข้อ | เรื่อง | แก้ | ยืนยันโดย | สถานะ |
|---|---|---|---|---|---|---|
| ADV-12 | High | D-18 | `/API/STOCK/...` (ตัวพิมพ์ต่าง) ได้ต้นทุนจริง | `30df154` path normalize | ผู้ตรวจ retest live 12 แบบ · SEC-R3-08 · unit | PASS — EXECUTED & VERIFIED |
| ADV-03 | High | D-18 | ต้นทุนในรายการเปลี่ยนแปลงของคำขออนุมัติ/Audit | `30df154`, `a1082bd`, `8263a76` | retest · SEC-R3-08 · unit | PASS — EXECUTED & VERIFIED |
| ADV-01 | High | D-08 | บันทึกชำระ/แก้สัญญา ตั้งเครื่องเป็นเช่า/ขายก่อนติดตั้ง | `30df154` ตรวจใน `setEquipmentForContract` | retest unit | PASS — EXECUTED & VERIFIED |
| ADV-02 | Medium | D-08 | สถานะที่เลื่อนไว้ไม่ถูกตั้งเมื่อปิดงานติดตั้ง INSTALL เดิม | `30df154` | retest: ปิดงานผ่าน · ยกเลิกใบงาน/ถอดเครื่องยังค้าง → N3 | PARTIAL — VERIFIED WITH LIMITATIONS |
| ADV-04 | Medium | D-01 | CEO อนุมัติ/ส่งตาราง PM ได้ | ไม่แก้ | คำตอบลูกค้า VFB แถว 21 ให้ CEO อนุมัติ PM ขัดกับการตีความ D-01 · ผู้ตรวจเห็นด้วยกับการจัดสถานะ | BLOCKED — BUSINESS CONFIRMATION (Q-R3-01) |
| ADV-05 | Medium | D-01 | CEO ดูคำขออนุมัติไม่ได้ | `30df154` สิทธิ์ `changes:view` | retest live | PASS — EXECUTED & VERIFIED |
| ADV-06 | Medium | D-16 | แก้รูปไม่ล็อกกับการปิดงาน | `a1082bd` | retest unit (หนึ่ง 200 หนึ่ง 409 · ไม่มีรูปเปลี่ยนหลังปิด) | PASS — EXECUTED & VERIFIED (race ทดสอบบน fake DB เท่านั้น) |
| ADV-07 | Medium | D-21 | รับ/คอนเฟิร์มวันนัดที่ผ่านไปแล้ว | `c1ae2d1` | retest รวมขอบเที่ยงคืนเวลาไทย | PASS — EXECUTED & VERIFIED |
| ADV-13 | Medium | D-02 | Admin แก้วิธีคิดมูลค่าสต๊อกโดยไม่ผ่านคำขออนุมัติ | ไม่แก้ | เขียนตรงตั้งแต่ก่อน Round 3 · D-02 อนุมัติให้ Admin ใช้เมนูนี้ | NOT A DEFECT (คำถาม Q-R3-10) |
| ADV-08 | Low | D-21 | วันที่ลูกค้าต้องการย้อนหลังได้ | `c1ae2d1` | retest | PASS — EXECUTED & VERIFIED |
| ADV-09 | Low | D-05 | ร่างของผู้อื่นตอบ 409 (เผยว่ามีอยู่) | `c1ae2d1` | retest 14 การกระทำ → 404 | PASS — EXECUTED & VERIFIED |
| ADV-10 | Low | D-05 | ส่งร่างที่เครื่องถูกลบแล้วได้ | `c1ae2d1` | retest | PASS — EXECUTED & VERIFIED |
| ADV-11 | Low | D-19 | ป้ายเครื่องยืดจนเห็น SN เต็ม | `c1ae2d1` ไม่เกิน 4 ตัว | retest · E2E-R3-11 | PASS — EXECUTED & VERIFIED |
| ADV-11b | Low | D-19 | ป้ายใช้ท้ายรหัสภายในเมื่อไม่มี SN | — | D-19 อนุมัติ "4 ตัวท้ายของ SN หรือรหัสภายใน" | NOT A DEFECT |
| ADV-14 | Low | D-20 | ปุ่ม "การแจ้งเตือน" แยกในหน้ามือถือช่าง | FE `42929b9` | E2E-R3-09 (ไม่มีลิงก์ /notifications อื่นนอกจากกระดิ่ง) | PASS — EXECUTED & VERIFIED |
| ADV-15 | Low | D-18 | `parts:cost_edit` ไม่ถูกตรวจ | `a1082bd` | retest live (ช่างส่ง unitCost → 403) · unit | PASS — EXECUTED & VERIFIED |
| ADV-16 | Low | D-17 | ตรวจใบงานยกเลิกก่อนล็อก | `a1082bd` | retest unit | PASS — EXECUTED & VERIFIED |
| ADV-17 | Low | D-06 | เปลี่ยนเฉพาะตัวพิมพ์ของรหัสเดิมไม่ได้ | `a1082bd` | retest unit · R3-D06-CODE | PASS — EXECUTED & VERIFIED |

### Retest findings
| ID | Sev | เรื่อง | แก้ | สถานะ |
|---|---|---|---|---|
| N1 | Medium | การแก้ ADV-03 ซ่อนประวัติแก้ข้อมูลพื้นฐาน (field "value") จาก CEO | `8263a76` จำกัดเฉพาะชื่อฟิลด์ต้นทุนอะไหล่ | PASS — EXECUTED & VERIFIED (unit ADV2-N1) |
| N2 | Low | ปิดงานติดตั้งเช่าซื้อตั้งสถานะเครื่องจากสัญญา (ขัด D-09) | `8263a76` ไม่ใช้กับ INSTALL_HIRE_PURCHASE | PASS — EXECUTED & VERIFIED (unit ADV2-09h) |
| N3 | Low | ยกเลิกใบงานติดตั้ง/ถอดเครื่องหลังสัญญามีผล → เครื่องคง IN_STOCK ภายใต้สัญญาที่มีผล ไม่มีการแจ้ง | ไม่แก้ — ต้องมีกติกาธุรกิจว่าสัญญาที่มีผลแต่ไม่ได้ติดตั้งให้ทำอย่างไร | BLOCKED — BUSINESS CONFIRMATION (Q-R3-12) |

## 4b. Independent adversarial review R3B — D-07A (ผู้ตรวจแยก · ตรวจที่ `cb34ce9`/`ff49dd3`) — `evidence/adversarial-review/ADVERSARIAL_REVIEW_R3B.md`

| ID | Sev | เรื่อง | Root cause | แก้ | Regression test | สถานะ |
|---|---|---|---|---|---|---|
| ADV3-01 | High | ราคามาตรฐานมีสองแหล่ง: Equipment Model Master (2000) กับ Model Index เดิม (master "model".standardPrice) ที่ใช้คิดรายรับติดตั้ง (MAR-01) · สร้างรุ่นใน master เพิ่มรุ่นใน Model Index ราคา 0 · คอมเมนต์ในโค้ดอ้างว่าราคานี้ใช้คิดรายรับ | D-07A กำหนดราคามาตรฐานใหม่ แต่ไม่ได้ระบุว่าแทนราคา Model Index หรือไม่ | `9ebccd0` แก้คอมเมนต์ให้ตรง (ยังไม่ใช้คิดรายรับ) · **ไม่ซิงก์ราคาเอง** — การเปลี่ยนแหล่งรายรับเป็นการตัดสินใจทางการเงิน (ผูก D-11) | unit ADV3-P1 (skip พร้อมเหตุผล) · D07A-06 (Model Index ไม่ถูกแก้) | **BLOCKED — BUSINESS CONFIRMATION (Q-R3-14)** · ระหว่างรอ: รายรับติดตั้งยังคิดจาก Model Index เหมือนก่อน Round 3 |
| ADV3-02 | Medium | เปิดใบงานพร้อมเครื่องใหม่ / เพิ่มเครื่องใหม่เข้าใบงาน ใส่ประเภทขัดกับรุ่นใน master ได้ (เข้าคลังด้วยค่าผิด) | route ใบงานตรวจเฉพาะรายการประเภท ไม่ตรวจความสัมพันธ์ | `9ebccd0` `checkJobItemRelation` · R3C พบว่ายังไม่ครอบคลุมเครื่องในคลัง → `08e2aba` (ADV3C-01) | unit ADV3-R1 · C01–C11 · D07A-07/08 | PASS — EXECUTED & VERIFIED (หลัง `08e2aba`) |
| ADV3-03 | Medium | แก้ประเภทรายเครื่องในใบงานให้ขัดกับรุ่นได้ | เหมือน ADV3-02 | `9ebccd0` PATCH line ตรวจกับค่าหลังแก้ | unit ADV3-R2 · D07A-07 | PASS — EXECUTED & VERIFIED |
| ADV3-04 | Medium | ปิดใช้งานรุ่นใน master แล้ว เครื่องเดิมประเภทนั้นแก้ฟิลด์อื่นไม่ได้ (ต้องเปลี่ยนประเภท) | ตรวจรายการประเภททุกครั้ง แม้ค่าไม่เปลี่ยน | `9ebccd0` `checkModelRelation(storedType)` ข้ามเมื่อประเภทไม่เปลี่ยน · คิวแก้เพิ่มใน `08e2aba` | unit ADV3-T2 · C18/C19 · D07A-07/08 | PASS — EXECUTED & VERIFIED (หลัง `08e2aba`) |
| ADV3-05 | Medium | เครื่องข้อมูลเดิมประเภทนอกรายการ (เช่น "ตู้เย็น") แก้รุ่นไม่ได้ | เหมือน ADV3-04 | `9ebccd0` · คิวและเส้นทาง serial แก้เพิ่มใน `08e2aba` | unit ADV3-T1 · C07/C16/C17/C20 · D07A-07/08 (เปลี่ยนเป็นประเภทนอกรายการใหม่ยัง 400) | PASS — EXECUTED & VERIFIED (หลัง `08e2aba`) |
| ADV3-06 | Medium | rollback mapping แทนทั้งเอกสารจาก backup → ทับการแก้ที่เกิดหลัง mapping | rollback ใช้ `replaceOne` ทั้งเอกสาร | `9ebccd0` backup เก็บรายการเปลี่ยนรายฟิลด์ · rollback คืนเฉพาะฟิลด์ที่ยังเป็นค่าที่สคริปต์เขียน · ชน = ไม่แตะ + รายงาน + exit 3 · backup รูปแบบเก่าถูกปฏิเสธ | D07A-05 (คืนค่า byte-identical) · D07A-07 (แถวที่แก้ภายหลังไม่ถูกทับ) | PASS — EXECUTED & VERIFIED |
| ADV3-07 | Low | รุ่นที่มี zero-width space สร้างชุดซ้ำที่มองไม่เห็นความต่างได้ | normalize ไม่ตัดอักขระ Cf | `9ebccd0` / FE `f655adb` ตัด `\p{Cf}` | unit ADV3-D2 · FE test · D07A-07 | PASS — EXECUTED & VERIFIED |
| ADV3-08 | Low | ตัวป้องกันสคริปต์ดูเฉพาะชื่อฐาน (`woms_qa_*` บนเครื่อง production ผ่านได้) | ไม่ตรวจ host | `9ebccd0` เขียนได้เฉพาะ localhost หรือ host ที่ระบุตรงตัว `--allow-host` | D07A-07 (host อื่น → exit 2) | PASS — EXECUTED & VERIFIED |
| ADV3-09 | Low | ปิด/เปิดใช้งานรุ่นตอบ 200 แม้คำสั่งเขียนไม่ match (ชนกับผู้อื่น) | ไม่ตรวจผลการเขียน | `9ebccd0` matchedCount = 0 → 409 | D07A-07 | PASS — EXECUTED & VERIFIED |
| ADV3-10 | Low | `verify-results.mjs` เชื่อ ENV.txt · regex ไม่มีขอบเขต · ไม่ตรวจ scenario ว่าง/skipped/error ของ race | — | qa3 `verify-results.mjs`: อ่าน HEAD/dirty จาก git เอง · ทุก scenario ต้อง PASS และมี check · skipped ต้องตรง `EXPECTED_SKIPS_BE_TEST` · race `other` = 0 | final-4 / final-5 `VERDICT.json` | PASS — EXECUTED & VERIFIED |
| (ADV3-D1) | — | สร้างชุดเดียวกันพร้อมกันบน fake DB ได้หลายแถว | fake DB ไม่มี unique index | ไม่ต้องแก้ — MongoDB จริงมี partial unique index | D07A-07: 8 คำขอพร้อมกัน → 201×1 · 409×7 | NOT A DEFECT (artifact ของ fake DB) — ไม่นับในตาราง |

## 4c. Independent retest R3C (ผู้ตรวจแยก · ตรวจที่ `9ebccd0`) — `evidence/adversarial-review/ADVERSARIAL_RETEST_R3C.md`, `r3c/`

ผลของผู้ตรวจต่อการแก้รอบ R3B: ADV3-03/06/07/08/09 FIXED · **ADV3-02/04/05 PARTIAL** (ตรวจไม่ครบทุกเส้นทาง) · พบใหม่ 6 รายการ · แก้ใน `08e2aba` / FE `7fd49dd` และนำ test ของผู้ตรวจเข้า suite (`test/adv3cD07a.test.ts`) + D07A-08 บนฐานจริง

| ID | Sev | เรื่อง | Root cause | แก้ | Regression test | สถานะ |
|---|---|---|---|---|---|---|
| ADV3C-01 | Medium | เพิ่มเครื่องที่มีในคลังเข้าใบงาน (ด้วย equipmentId หรือ serial) และเปิดใบงานพร้อมเครื่องในคลัง ใส่ประเภทขัดกับรุ่นในคลังได้ (ทำให้ ADV3-02 เป็น PARTIAL) | schema ใส่ model = "" เป็นค่าเริ่มต้น → ไม่ fallback ไปรุ่นในคลัง · เส้นทาง serial ไม่โหลดเครื่อง | `08e2aba` เครื่องในคลังตรวจ "ประเภทที่จะบันทึก" กับ "รุ่นในคลัง" เสมอ (resolveItems ใช้รุ่นในคลังอยู่แล้ว) · ค่าว่างไม่ถือว่าส่งมา | unit C01–C04, C07, C10, C11 · D07A-08 | PASS — EXECUTED & VERIFIED |
| ADV3-04/05 (คิว) | Medium | Admin แก้คิวที่มีรายการเดิมประเภทนอกรายการ/ประเภทที่ master ปิด → 400 | `buildItems` ไม่ส่ง storedType | `08e2aba` ใช้ประเภทของรายการเดิม (itemId) | unit C19, C20 · D07A-08 | PASS — EXECUTED & VERIFIED |
| ADV3C-02 | Low | ประเภทที่มีอักขระแฝง ผ่านการตรวจแล้วถูกเก็บพร้อมอักขระแฝง (ผลข้างเคียงของ ADV3-07) | ตรวจด้วยค่า normalize แต่บันทึกค่าดิบ | `08e2aba` บันทึกค่ามาตรฐานจากรายการประเภท | unit C15 · D07A-08 | PASS — EXECUTED & VERIFIED |
| ADV3C-03 | Low | รุ่นซ้ำด้วยอักขระว่างที่ไม่ใช่ Cf (U+034F, U+FE0F, U+3164, U+2800) และตัวอักษรหน้าตาคล้าย (ขีดต่างชนิด, Н ซีริลลิก, ตัวเต็มความกว้าง) | normalize ตัดเฉพาะ Cf | `08e2aba` / FE `7fd49dd` ตัดอักขระว่างกลุ่มนี้ · **ไม่รวมตัวอักษรหน้าตาคล้าย** — เป็นการจับคู่แบบ fuzzy ซึ่งกติกาไม่ให้ทำ | unit C21, C22 · C23 skip | **PARTIAL — VERIFIED WITH LIMITATIONS**: อักขระว่างแก้แล้ว · homoglyph ยอมรับความเสี่ยง (เพิ่ม/แก้ master ได้เฉพาะ Admin ผ่านคำขออนุมัติ / Manager และมี audit) |
| ADV3C-04 | Low | ปิดใช้งานรุ่นที่ปิดอยู่แล้ว ตอบ 200 และบันทึก audit "true→false" ที่ไม่ได้เกิดจริง | route บันทึก audit ทุกครั้ง | `08e2aba` ไม่มีการเปลี่ยน → ไม่บันทึก audit | unit C27 · D07A-08 | PASS — EXECUTED & VERIFIED |
| ADV3C-05 | Low | rollback เชื่อไฟล์ backup: ไฟล์ที่ถูกแก้เขียนฟิลด์อื่นได้ (status, customerName) · id ผิดกลางไฟล์หยุดโดยไม่มีรายงาน · apply ล้มกลางทางแล้ว rollback ไม่ได้ · rollback ซ้ำรายงานเป็น conflict ทั้งหมด | ไม่ตรวจไฟล์ก่อนเขียน | `08e2aba` ตรวจทั้งไฟล์ก่อนเขียน (id, ฟิลด์ได้เฉพาะ modelMasterId/machineType/category) · journal `.jsonl` เขียนทีละรายการระหว่าง apply · rollback ซ้ำ = alreadyRestored · เขียนรายงานเสมอ | D07A-08 (ไฟล์ถูกแก้ → exit 2 ไม่เขียน · id ผิด → exit 2 · rollback จาก journal · rollback ซ้ำ exit 0) | PASS — EXECUTED & VERIFIED |
| ADV3C-06 | Info | host guard มองไม่เห็นปลายทางจริงของ `mongodb+srv` (DNS), การค้นหาสมาชิก replica set หรือ SSH tunnel มาที่ localhost | ตรวจจาก URI เท่านั้น | ไม่แก้ — ข้อจำกัดของการตรวจฝั่ง client | — | NOT A DEFECT (ข้อจำกัดที่บันทึกไว้) · การรันกับ environment อื่นต้องมีผู้อนุมัติ (12) |

ยังไม่มี retest รอบที่สามโดยผู้ตรวจแยกหลัง `08e2aba` — ยืนยันด้วย test ของผู้ตรวจ R3C ที่รวมเข้า suite และ D07A-08

## 5. Defect ของชุดทดสอบ / tooling

| ID | เรื่อง | ผล | แก้ |
|---|---|---|---|
| T-01 | ชุด API/E2E เดิม exit 0 เสมอแม้ scenario ล้ม | exit code ใน SUMMARY.tsv ของ Round 2 ไม่ใช่หลักฐาน | ทุกชุด exit 1 เมื่อมี scenario ไม่ผ่าน |
| T-02 | fixture R1 (API/E2E) สร้างคิวไม่ครบช่องบังคับ D-05 | QA-REV-QUEUE / E2E-QUE-01 ล้มใน final-1 · และ check "INSTALL → 400" จะผ่านเพราะช่องขาดแทนกติกาที่ทดสอบ | ใส่ช่องครบ + ตรวจ `error.field` |
| T-03 | api-qa-r3 อ่าน `rounds[].no` (ไม่มีฟิลด์) แล้ว fallback เป็น 1 | ผ่านโดยบังเอิญ | ใช้ `roundNo` |
| T-04 | E2E-R3-11 ใช้ SN ท้ายชนกันเพื่อทดสอบพฤติกรรม "ยืด" ที่ถูกเอาออก (ADV-11) | final-2 ล้ม | ทดสอบทั้งท้ายต่างกันและท้ายชน |
| T-05 | unit ADV-03 regex `/777/` จับ millisecond ของ timestamp | ล้มแบบสุ่ม | regex ไม่จับ `.777Z` |
