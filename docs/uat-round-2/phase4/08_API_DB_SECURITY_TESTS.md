# P4-08 API / DB / Security tests

## Backend (vitest · fakeMongo — ไม่ใช่ MongoDB จริง)
| ไฟล์ | ข้อ | ผล |
|---|---|---|
| `p4_defR5_01_jobStageProjection.fake.test.ts` | 7 | PASS |
| `p4_customerSummaryExtras.fake.test.ts` (+ round8_customers) | 33 | PASS |
| `p4_contractClauses.fake.test.ts` | 19 | PASS |
| ทั้ง repo | 2,350 PASS / 242 SKIP (เดิม 2,317) | PASS · ไม่มีเทสต์ถูกลบ/ข้าม/ลดเงื่อนไข |

contractClauses ครอบคลุม: ไม่ส่ง/ว่าง · เรียง/จัดเลขใหม่ · CRLF/ช่องว่าง/อักขระซ่อน · ข้อว่าง · HTML/script 5 รูปแบบ · `< >` ธรรมดาผ่าน · ยาว/บรรทัด/จำนวนข้อ/รวม · ลำดับซ้ำ · สัญญาเดิมไม่มีฟิลด์ · สร้าง 0/1/หลายข้อ · ฐานข้อมูลไม่มีฟิลด์เมื่อไม่มีข้อกำหนด · ไม่ใช่สัญญาเช่า 400 · ช่าง/ผู้ดูสร้าง 403 · แก้/เรียง/ลบ (ร่าง) + history + audit hash · ส่งชุดเดิม = ไม่มีประวัติเพิ่ม · ACTIVE → 409 ข้อมูลไม่เปลี่ยน · ฟิลด์อื่นแก้ได้ · Admin 202 / 409 ตั้งแต่ตอนขอ · 400/403 · ต่อสัญญายกข้อกำหนด

## Frontend
- `node --test scripts/*.test.ts`: 342 PASS / 0 FAIL (เดิม 333 · +9 `contractClauses.test.ts`: เลขข้อตรงแม่แบบ, normalize, validate, payload, splitClauses 5 กรณี)
- tsc ผ่าน · next build ผ่าน · eslint ไฟล์ที่แก้ไม่มี error

## Security
| ตรวจ | ผล |
|---|---|
| XSS ผ่านข้อกำหนด | backend ปฏิเสธแท็ก · หน้าเว็บแสดงเป็นข้อความ (ไม่มี innerHTML) · PDF แสดง `<` `>` เป็นข้อความ |
| แก้เงียบหลังออกสัญญา | 409 ทั้งทางตรงและทางคำขออนุมัติ |
| RBAC | สร้าง: contracts:create · แก้: contracts:edit (Admin → อนุมัติ) · ช่าง/ผู้ดู 403 · ช่างอ่านสัญญา 403 (sandbox) |
| Customer summary | ข้อมูลสัญญา/งาน แสดงเฉพาะผู้มีสิทธิ์ · เซลล์เห็นเฉพาะทีม · ช่าง 403 |
| Job stage | คำนวณหลังกรองสิทธิ์ · ไม่เปิดข้อมูลรายการส่งงานนอกขอบเขต |
| Audit | ไม่ใส่ข้อความเต็มของข้อกำหนดใน audit (hash + จำนวน/ความยาว) |
| Credentials | ไม่อ่าน/ไม่แสดงรหัสผ่าน QA-R2 · หลักฐานไม่มี token |

## UAT จริง (QA-R2 admin · API)
| ID | Expected | Actual | ผล |
|---|---|---|---|
| P4-API-01 | สร้างสัญญาร่าง + 3 ข้อ → 201 อ่านกลับตรง | 201 CT-2026-0003 · 3 ข้อ ลำดับ/บรรทัดตรง | PASS |
| P4-API-02 | ข้อว่าง → 400 field additionalClauses.0.text | 400 | PASS |
| P4-API-03 | HTML → 400 | 400 | PASS |
| P4-API-04 | 1,001 ตัวอักษร → 400 | 400 | PASS |
| P4-API-05 | Admin แก้ร่าง → 202 · ข้อมูลไม่เปลี่ยน | 202 CR-20261114-9F79E1 · ข้อมูลเดิม · history ว่าง | PASS |
| P4-API-06 | Admin อนุมัติคำขอเอง → 403 · CR ยัง PENDING | 403 · PENDING | PASS |
| P4-API-07 | Admin pending-count (changes:approve) → 403 | 403 | PASS |
| P4-API-08 | customer summary extras (admin) | ครบตามที่คาด | PASS |
