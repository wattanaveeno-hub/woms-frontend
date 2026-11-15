# Numeric Input Audit & Fix (Master Execution · 14 พ.ย. 2569)

> ตำแหน่งหลักฐาน: `evidence/r8/…` ในเอกสารนี้อยู่ที่ `Claude outputs/uat-round-2/r8-sandbox/…` บนเครื่อง Owner (แยกจาก `r8/` ซึ่งสงวนไว้สำหรับหลักฐาน UAT จริง)

## ปัญหา (ตามภาพของ Owner: ช่องรายรับ/ค่าใช้จ่ายของใบงาน)
ช่องตัวเลขบางช่องตั้งค่าเริ่มต้นเป็นข้อความ `"0"` และใช้ `<input type="number">` → ผู้ใช้คลิกแล้วพิมพ์ `50000` ได้ `050000`
(React ไม่ปรับค่า DOM ของ input type=number เมื่อค่าเชิงตัวเลขเท่าเดิม เช่น "050000" กับ 50000)

## กติกาที่ใช้ (shared)
- `src/lib/moneyInput.ts`: `sanitizeNumericText` (ตัดอักขระที่ไม่ใช่ตัวเลข/จุด/ลบตามกติกาช่อง · จุดได้ตัวเดียว · ตัด 0 นำหน้า · ตัดจุลภาค) · `numericInitialText` (ว่าง/0 ที่เป็นค่าเริ่มต้น → ช่องว่าง) · `numericTextValue` ("" / "-" / "." → null)
- `src/components/NumberInput.tsx`: MUI TextField แบบ `type="text"` + `inputMode` (decimal / numeric) + `placeholder="0"` (หรือ placeholder ของช่อง) · `zeroAsEmpty` (ค่าเริ่มต้น true; ช่องที่ 0 มีความหมายต่างจากว่าง หรือแก้ข้อมูลเดิม ใช้ false) · `integer` · `allowNegative` · ส่ง `(ข้อความ, ตัวเลข|null)` ให้ฟอร์ม — **ไม่แปลงช่องว่างเป็น 0 เอง** ฟอร์มใช้กติกาเดิมตอนบันทึก
- ซิงก์ค่าจากภายนอก (โหลดใหม่/รีเซ็ต) เมื่อค่าเชิงตัวเลขต่างจากที่พิมพ์ — ไม่รบกวนระหว่างพิมพ์ เช่น "13." หรือ "0" ที่ตั้งใจพิมพ์
- API / DB contract ไม่เปลี่ยน · validation เดิม (parseMoney, required, min) ไม่เปลี่ยน

## รายการที่ตรวจ (ทุกช่องตัวเลขในหน้าเว็บ)
| # | หน้า / คอมโพเนนต์ | ช่อง | สภาพเดิม | แก้ | zeroAsEmpty | หมายเหตุ |
|---|---|---|---|---|---|---|
| 1 | ใบงาน › รายรับ/ค่าใช้จ่าย (`JobWorkflowPanel`) | รายรับจากลูกค้า | `"0"` + type=number → **050000** | NumberInput | true | ภาพของ Owner · ว่าง = 0 ตามกติกาเดิม (parseMoney) |
| 2 | 〃 | ค่าใช้จ่าย | เหมือนข้อ 1 | NumberInput | true | 〃 |
| 3 | รับเครื่องเข้าคลัง (`EquipmentForm`) | อายุประกัน (เดือน) | type=number ค่า 0 | NumberInput integer | true | ว่าง → 0 ตามเดิม |
| 4 | 〃 | ละติจูด / ลองจิจูด | type=number ค่า 0 แสดง "0" | NumberInput allowNegative | true | ทศนิยมระหว่างพิมพ์ ("13.") คงอยู่ |
| 5 | 〃 | ระยะประกันรายชุด (เดือน) | type=number | NumberInput integer | true | |
| 6 | เงื่อนไข PM ของเครื่อง (`EquipmentPmCard`) | จำนวนรอบ PM แถม / ระยะสัญญา PM เช่า (ปี) | type=number | NumberInput integer | true | |
| 7 | 〃 | ความถี่ PM (ทุกกี่เดือน) | type=number | NumberInput integer | **false** | “ใส่ 0 = ยังไม่ตั้งรอบ” — 0 มีความหมาย |
| 8 | แพ็กเกจ PM (`EquipmentPmPackages`) | จำนวนรอบ / จำนวนเงินที่ขอคืน | type=number | NumberInput | true | |
| 9 | ใบเสนอราคา (`QuotationForm`) | จำนวนเดือน/งวด (จำนวนเต็ม) | type=number | NumberInput integer | true | required + min 1 เดิม |
| 10 | ใบเสนอราคา/สัญญา/ต่อสัญญา (`useMoneyInputs`) | ช่องเงินทั้งหมด | ใช้ hook เดิม (placeholder 0, ตัด 0 นำหน้า) แล้ว | ไม่แก้ | — | ผ่านอยู่แล้ว (Round 5) |
| 11 | รายละเอียดสัญญา › ที่อยู่ติดตั้ง | ละติจูด / ลองจิจูด | type=number ค่า 0 | NumberInput allowNegative | true | |
| 12 | ประวัติเครื่อง (`EquipmentHistory`) | ละติจูด / ลองจิจูด | type=number `?? 0` | NumberInput allowNegative | true | |
| 13 | โปรไฟล์ประกัน | เดือน | type=number | NumberInput integer | true | |
| 14 | สต๊อกอะไหล่ | จำนวน / ราคาทุนต่อหน่วย | type=number | NumberInput | true | จำนวนเริ่มต้น "1" คงเดิม |
| 15 | 〃 เพิ่มอะไหล่ | จุดสั่งซื้อ / ราคาทุนมาตรฐาน / ราคาขาย | ค่าเริ่มต้น `"0"` + type=number | NumberInput | true | |
| 16 | บันทึกรับเงินงวดสัญญา (`ContractPayDialog`) | จำนวนเงิน | `String(outstanding)` อาจเป็น "0" | NumberInput | true | ยอดคงค้างเติมให้เหมือนเดิม |
| 17 | ใบวางบิลช่าง › ตรวจ (`BillReviewDialogs`) | ค่าบริการ/ค่าใช้จ่ายรายการ | text ไม่ตัด 0 นำหน้า | NumberInput | **false** | แก้ข้อมูลเดิม — 0 ที่บันทึกไว้ยังแสดง |
| 18 | 〃 จ่ายบิล | จำนวนเงิน | text | NumberInput | true | |
| 19 | ประวัติการชำระ › แก้ไข (`PaymentHistory`) | จำนวนเงิน | text | NumberInput | **false** | แก้ข้อมูลเดิม |
| 20 | บันทึกรับเงิน (`FinParts`) | จำนวนเงิน | text (ค่าว่างเมื่อไม่มียอดค้าง) | NumberInput | true | |
| 21 | ทำรายการวางบิล (`BillMachineForm`) | ค่าบริการ / ระยะทาง / ค่าต่อ กม. / ค่าใช้จ่ายร่วม | text (ค่าว่างเมื่อ 0 อยู่แล้ว) | NumberInput | true | ตัด 0 นำหน้าระหว่างพิมพ์ |
| 22 | ออกเอกสาร (`documents/new`) | จำนวน / ราคา/หน่วย | ราคา/หน่วยเริ่มต้น `"0"` → **0500** | NumberInput | true | จำนวนเริ่มต้น "1" คงเดิม |
| 23 | อะไหล่ในใบงาน (`JobPartsCard`) | จำนวน / ราคาซื้อ (เพิ่ม) | text | NumberInput | true | |
| 24 | 〃 แก้ไขรายการเดิม | จำนวน / ราคาซื้อ | text | NumberInput | **false** | แก้ข้อมูลเดิม |
| 25 | ข้อมูลพื้นฐาน (`MasterManager`) | ราคาติดตั้ง/บริการมาตรฐาน | text | NumberInput | true | |
| 26 | รุ่นเครื่อง | ต้นทุนมาตรฐาน (บังคับ) | text | NumberInput | true | required คงเดิม |
| 27 | แก้ไขหลังปิดงาน (`JobRevisionPanel`) | จำนวน / ต้นทุน (เดิม) | text | NumberInput | **false** | แก้ข้อมูลเดิม |
| 28 | 〃 | จำนวน / ต้นทุน (เพิ่มใหม่) | text | NumberInput | true | |
| 29 | เครื่องในใบงาน (`JobEquipmentSection`) | ราคา/ส่วนลด ฯลฯ | text `|| ""` แต่ไม่ตัด 0 นำหน้า | NumberInput | true | |
| 30 | แผน PM (legacy) | ล่วงหน้า (วัน) | ตัวเลขล้วน ไม่ตัด 0 นำหน้า | ตัด 0 นำหน้า | — | |
| 31 | จองคิวจัดส่ง/ซ่อม (`/queue/new`) | lat / lng / จำนวนวัน | type=number ค่า 0 แสดง "0" | `value={x || ""}` + inputMode + placeholder | true | หน้า legacy |
| 32 | ช่องเวลาคิว (`/queue/slots`) | จำนวนวัน / ความจุ | type=number | `value={x || ""}` + placeholder | true | หน้า legacy |
| 33 | คิวงาน › รายเครื่อง (`QueueItemExtras`) | ประกัน/PM | ใช้ `|| ""` อยู่แล้ว | ไม่แก้ | — | ผ่านอยู่แล้ว |
| 34 | สาขาลูกค้า / ลูกค้าใหม่ / ใบงาน | lat / lng | ค่าเริ่มต้น "" อยู่แล้ว | ไม่แก้ | — | ผ่านอยู่แล้ว |
| 35 | ต่อสัญญา | จำนวนเดือน | ค่าเริ่มต้น "12" | ไม่แก้ | — | ไม่มี 0 ตั้งต้น |
| 36 | ตัวเลือกจำนวนแถวต่อหน้า / select | — | ไม่ใช่ช่องพิมพ์ | ไม่แก้ | — | |

รวม: ตรวจ 36 กลุ่ม · แก้ 32 กลุ่ม ใน 25 ไฟล์ · ไม่ต้องแก้ 4 กลุ่ม (ทำถูกอยู่แล้ว)
ไม่เหลือ `type="number"` ในฟอร์ม MUI · ที่เหลือ 2 หน้า legacy (`/queue/new`, `/queue/slots`) ใช้ input ธรรมดา + ช่องว่างแทน 0

## ทดสอบ
| ชุด | ผล |
|---|---|
| unit `scripts/moneyInput.test.ts` (+4: 050000→50000, ทศนิยม/จุลภาค/1e5, จำนวนเต็ม/ค่าลบตามกติกา, ค่าเริ่มต้น 0/ว่าง/ค่าที่บันทึก/ทศนิยม, ข้อความ→ตัวเลข) | PASS |
| E2E `flow20_numeric.py` 25/25 (ผลรอบสุดท้ายใน 06): ใบงานใหม่รายรับ/ค่าใช้จ่ายว่าง + placeholder 0 · placeholder มองเห็นจริง (label ยกขึ้น) · inputmode=decimal type=text · พิมพ์ 50000 = 50000 · 1500.50 · API 50000/1500.5 · โหลดใหม่แสดงค่าที่บันทึก · ลบ/1e5 พิมพ์ไม่ได้ · 0 ที่ตั้งใจ · พิมพ์ต่อจาก 0 · ล้างช่อง · บันทึก 0/ว่าง → API 0/0 · โหลดใหม่ 0 → ช่องว่าง · พิกัด "13." ระหว่างพิมพ์ · เอกสาร ราคา/หน่วย ว่าง → 2500 · รุ่นเครื่อง required + 12000 · มือถือ 390px inputmode | PASS |
| E2E เดิมที่ใช้ช่องเงิน (สัญญา, ใบเสนอราคา, คิว, วางบิล ฯลฯ) ในชุดรันต่อเนื่อง | ดู `06_AUTOMATED_REGRESSION_REPORT.md` |

## ข้อบกพร่องที่พบระหว่างตรวจภาพก่อน/หลัง (แก้แล้ว)

| ID | อาการ | สาเหตุ | การแก้ | ทดสอบ |
|---|---|---|---|---|
| OBS-P6-01 | ช่องตัวเลขที่ว่างและยังไม่โฟกัสแสดงชื่อ label ทับในช่อง ผู้ใช้ไม่เห็น placeholder "0" (attribute `placeholder="0"` มีอยู่ แต่ MUI ซ่อนด้วย opacity 0) | MUI outlined TextField ซ่อน placeholder จนกว่า label จะยกขึ้น | `NumberInput` ตั้ง `InputLabelProps.shrink = true` เสมอ (ยังรับค่าที่ส่งเข้ามาเพิ่มได้) | เพิ่ม assertion ใน flow20: label `data-shrink="true"` และ `::placeholder` opacity > 0 — บน build ก่อนแก้ assertion นี้ **FAIL** (`['0','false']`) หลังแก้ PASS |

พบจากภาพ `evidence/r8/before-after/job-revenue-typed-50000-after.png` (รอบแรก) — test เดิมตรวจแค่ attribute จึงไม่จับอาการนี้

## ภาพก่อน/หลัง

`evidence/r8/before-after/` — ก่อน = สำเนาโค้ดก่อนแก้ build แยก, หลัง = โค้ดปัจจุบัน, backend/ข้อมูลชุดเดียวกัน
- `job-revenue-typed-50000-before.png`: คลิกช่องรายรับที่มีค่า 0 แล้วพิมพ์ 50000 → ได้ **`050000`** (ตรงกับอาการที่ Owner รายงาน)
- `job-revenue-typed-50000-after.png`: ทำแบบเดียวกัน → ได้ **`50000`**
