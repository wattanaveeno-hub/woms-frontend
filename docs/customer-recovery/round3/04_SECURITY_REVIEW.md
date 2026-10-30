# 04 · Security Review (Round 3)

หลักการ: การซ่อนเมนู/คอลัมน์บนหน้าเว็บไม่ใช่ด่านความปลอดภัย — ทุกกติกาตรวจที่ API และทดสอบด้วยการเรียก API ตรงในชื่อผู้ใช้แต่ละบทบาท (ไม่ผ่านหน้าเว็บ)

## 1. บทบาทที่ทดสอบ

| บทบาท | บัญชี QA | ใช้ในชุด |
|---|---|---|
| Admin | admin2@qa.local | ทุกชุด |
| CEO | ceo2@qa.local | security-r3, api-qa-r3, security-matrix, e2e-r3 |
| Manager | manager@qa.local | ทุกชุด |
| Sale A / Sale B | sales@ / sales2@qa.local | security-r3 (ร่างคิวข้ามผู้ใช้), ทุกชุด |
| Technician A / B | tech@ / tech2@qa.local | security-r3 (IDOR, ค้นหา, export), security-matrix |
| Viewer | viewer@qa.local | security-r3, api-qa-r3, e2e-r3 |
| ไม่ล็อกอิน / token หมดอายุ / token ปลอม | — | SEC-R3-01, SEC-R3-07, SEC-AUTH-01 |

## 2. การเปลี่ยนสิทธิ์ใน Round 3 (`src/domain/user.ts`)

| สิทธิ์ | ก่อน | หลัง | ข้อ |
|---|---|---|---|
| `changes:approve` | ceo, manager | manager | D-01/D-02 |
| `parts:cost_view`, `parts:cost_edit` (ใหม่) | — | admin, manager | D-18 |
| `chat:moderate` (ใหม่) | — | admin | D-14 |
| บังคับเปลี่ยนรหัสผ่าน | ไม่มี | `mustChangePassword` → 403 `PASSWORD_CHANGE_REQUIRED` ทุก route ยกเว้น `/auth/me`, `/auth/change-password` | D-04 |
| เพิกถอน token | ไม่มี (JWT 8 ชม. ใช้ได้จนหมดอายุ) | `tokenVersion` (`tv` ใน JWT) เพิ่มเมื่อ reset/เปลี่ยนรหัส → token เดิม 401 | D-04 |

## 3. ด่านที่เพิ่ม/ขยาย

| ด่าน | ที่ | ครอบคลุม |
|---|---|---|
| `partsCostGuard` | `src/lib/dataScope.ts` · ติดตั้งที่ `/api` | JSON: key ต้นทุนใต้ `/api/stock`, `/api/parts`, `/api/jobs/:id/equipment-parts` เป็น null · `partsUsed[].unitCost/totalCost` เป็น null ทุก path · ข้อความ "× จำนวน @ ต้นทุน" ใน note/summary/before/after/description/detail ตัดต้นทุนออก |
| PDF ประวัติเครื่อง | `routes/equipment.ts` | ตัดต้นทุนในบันทึกเดิม (R3-N3) — PDF/Excel ไม่ผ่าน JSON guard จึงตรวจแยก |
| ข้อมูลกำไรรายเครื่อง/แดชบอร์ด | `serviceMarginService.ts`, `routes/dashboard.ts` | ไม่มีสิทธิ์ต้นทุน → ไม่รวมบรรทัดต้นทุนอะไหล่ (ไม่ใช่ใส่ null เพราะคำนวณย้อนจากยอดรวมได้) · มูลค่าสต๊อก null |
| ร่างคิว | `routes/serviceQueue.ts` | เห็น/แก้/ส่ง/ลบ เฉพาะผู้สร้าง · ไม่อยู่ในรายการของผู้อื่น |
| ยกเลิกข้อความแชท | `routes/groupChat.ts` | ต้องเห็นกลุ่ม · ผู้ส่งภายใน 15 นาที (เวลา server) · `chat:moderate` ต้องมีเหตุผล · ต้นฉบับใน `group_message_audit` อ่านได้เฉพาะ `audit:view` · ไฟล์แนบของข้อความที่ยกเลิก 410 |
| แจ้งเตือนการแท็ก | `routes/groupChat.ts`, `lib/push.ts` | แท็กได้เฉพาะสมาชิกกลุ่มที่ใช้งานอยู่ (400) · push ไม่ส่งผู้ใช้ปิดใช้งาน แม้ระบุ id ตรง |
| วันติดตั้ง/หมายเหตุ/หลักฐาน | `routes/jobs.ts` | `jobs:close` + ขอบเขตใบงานของผู้เรียก · ใบงานต้อง OPEN |
| เสนอ PM หลายรายการ | `routes/pm.ts` | ตารางต้องเป็นของผู้เรียก (ช่าง) · สาขาเดียวกัน · จองแบบมีเงื่อนไขกันซ้ำ |
| Equipment Model Master (D-07A) | `routes/equipmentModels.ts` | อ่าน: master:view/manage, equipment:view, svcqueue:view, jobs:view · เพิ่ม: `master:manage` · แก้ราคา/ปิดใช้งาน: `runOrRequest` (Admin → คำขออนุมัติ 202 · Manager ทำได้ทันที · CEO อนุมัติไม่ได้) · `standardPrice` = null สำหรับผู้ไม่มีสิทธิ์ยอดเงินใบงาน (D-22 ชั่วคราว) · audit `equipment_models` |
| ความสัมพันธ์ ประเภท–หมวดหมู่–รุ่น | `mongo/equipmentModelRepo.ts` `checkModelRelation` | ตรวจที่ backend ทุกเส้นทางเขียน: เครื่อง (สร้าง/แก้/นำเข้า) · คิว · ใบงาน (เปิด/เพิ่มเครื่อง/แก้รายเครื่อง — ADV3-02/03) · ไม่พึ่งหน้าเว็บ |
| สคริปต์ seed/map/rollback | `scripts/equipmentModels.ts` | เขียนได้เฉพาะฐาน `woms_qa_*` บน localhost หรือ `--allow-host` (ADV3-08) · dry-run อ่านอย่างเดียว |

## 4. ผลการทดสอบ
ดูจำนวนและสถานะใน 08 · สรุปราย scenario:

| ชุด | สิ่งที่พิสูจน์ |
|---|---|
| SEC-R3-01 | 13 endpoint ใหม่ ไม่ล็อกอิน → 401 |
| SEC-R3-02 | ช่าง B → 18 คำขอบนข้อมูลช่าง A ถูกปฏิเสธ · DB ไม่เปลี่ยน (บรรทัดเครื่อง คิว PM ข้อความแชท) |
| SEC-R3-03 | ร่างคิว 5 บทบาท × 4 การกระทำ ถูกปฏิเสธ · ไม่โผล่ในรายการ Admin |
| SEC-R3-04 | ค้นหา/หน้า 2/offset/picker/summary/ปฏิทิน/แดชบอร์ด/แจ้งเตือน/Excel 3 ไฟล์ ไม่มีข้อมูลช่าง A · ตรวจเชิงบวกว่าช่าง A ค้นเจอ |
| SEC-R3-05 | 7 บทบาท × (PDF, ไทม์ไลน์, รายการอะไหล่, Excel 2 ไฟล์) · เฉพาะ Admin/Manager เห็นต้นทุน |
| SEC-R3-06 | CEO/Viewer 10 endpoint เขียน → 403 · DB ไม่เปลี่ยน |
| SEC-R3-07 | 11 endpoint อ่าน × 9 สถานะผู้ใช้ ไม่มี 5xx |
| SEC-R3-08 | retest ADV-12/ADV-03/ADV-05/R3-N5 บน API จริง |
| SEC-R3-09 | D-07A: สิทธิ์เขียน 8 บทบาท · Admin แก้ = คำขออนุมัติ · ราคามาตรฐานซ่อนจาก Sale/ช่าง ทั้ง list/cascade · URL ตัวพิมพ์ต่าง · ถูกปฏิเสธแล้วข้อมูลไม่เปลี่ยน |
| D07A-07 / 08 | retest ADV3 และ R3C บน MongoDB จริง (ใบงาน bypass · host guard · rollback ไม่ทับข้อมูล/ไม่เชื่อไฟล์ที่ถูกแก้) |
| R3-D01-MATRIX | 6 operation × 7 สถานะ · CEO อนุมัติคำขอไม่ได้ · Manager อนุมัติได้ |
| R3-D04-PASSWORD | บังคับเปลี่ยนรหัส · token เดิมใช้ไม่ได้หลังเปลี่ยน/reset · ไม่มี hash ใน response |
| security-matrix (Round 2) | regression ขอบเขตช่าง BUG-V2-17 / TECH-02 / ยอดเงิน / สัญญา / แจ้งเตือน |

## 5. Defect ความปลอดภัยที่พบและแก้ใน Round 3
| ID | Sev | เรื่อง | แก้ | ยืนยัน |
|---|---|---|---|---|
| R3-N1 | Medium | ข้อความประวัติเครื่อง (ทุกคนที่เห็นเครื่องอ่านได้) มีต้นทุนอะไหล่ "@ 350" | `f4d7c4d` ข้อความใหม่ไม่มีต้นทุน + guard ตัดข้อความเดิม | R3-D18-COST · SEC-R3-05 |
| R3-N3 | Medium | PDF ประวัติเครื่องแสดงต้นทุนจากบันทึกเดิมแก่ CEO/Viewer/Sale/ช่าง | `80d3276` | SEC-R3-05 (pdftotext) |
| R3-N4 | Medium | ไทม์ไลน์เครื่อง (JSON key `detail`) แสดงต้นทุนจากบันทึกเดิมแก่ CEO/Sale/ช่าง/Viewer | `02e11c1` | SEC-R3-05 · unit round3Core (ล้มบนโค้ดก่อนแก้: `evidence/r3-n4-test-without-fix.txt`) |
| R3-N5 | Medium | CEO เปิดคำขออนุมัติแก้อะไหล่ เห็นต้นทุนในสำเนาเอกสาร (เกิดจากการแก้ ADV-05) | `a1082bd` | SEC-R3-08 · unit round3CostEdit |
| ADV-12 | **High** | `/API/STOCK/...` (ตัวพิมพ์ต่าง) ได้ต้นทุนจริง — guard เทียบ path แบบสนตัวพิมพ์ แต่ Express route ไม่สน | `30df154` | SEC-R3-08 (5 แบบ × CEO/Viewer + ตรวจเชิงบวก Manager) · retest ผู้ตรวจ 12 แบบ |
| ADV-03 | **High** | ต้นทุนเดิม/ใหม่ในรายการเปลี่ยนแปลงของคำขออนุมัติ/Audit | `30df154` · `8263a76` (N1: ไม่ซ่อนฟิลด์ทั่วไป) | SEC-R3-08 · unit |
| ADV-15 | Low | `parts:cost_edit` ไม่ถูกตรวจ | `a1082bd` | unit · retest live (ช่างส่ง unitCost → 403) |
| ADV-09 | Low | ร่างของผู้อื่นตอบ 409 (เผยว่ามีร่าง) | `c1ae2d1` | retest 14 การกระทำ → 404 · SEC-R3-03 |
| ADV-11 | Low | ป้ายเครื่องเผย SN เกือบเต็ม/เต็มแก่ช่าง | `c1ae2d1` | E2E-R3-11 · unit |

## 6. Independent adversarial review
ผู้ตรวจแยก (ไม่ได้เขียนโค้ด) ตรวจ diff Round 3 ทั้งสอง repo บน worktree แยก ฐาน `woms_qa_r3_adv_*` พอร์ต 8200 · เขียน test ที่คาดพฤติกรรมถูกต้อง (ล้ม = พบ defect) และยิง API จริง
- รอบแรก: 17 findings (High 3 · Medium 6 · Low 8) — ด้านความปลอดภัย: ADV-12, ADV-03, ADV-05, ADV-09, ADV-11, ADV-15
- Retest: ยืนยันแก้ 13 รายการ (12 รายการรันพิสูจน์ · ADV-14 อ่านโค้ดอย่างเดียว) · พบ N1 (การแก้ ADV-03 ซ่อนเกิน) N2 N3 — N1/N2 แก้แล้ว
- สิ่งที่ผู้ตรวจลองแล้วไม่หลุด: encode path (`%53tock`, `stock%2Fparts`, `/./`, `;x` ไม่ route) · ร่างทุก action · ทุกเส้นทางสัญญา · ขอบเที่ยงคืนเวลาไทย · ต้นทุนใน JSON endpoint อื่น
- ข้อจำกัด: race ทดสอบบน fake DB · ไม่ได้ทดสอบหน้าเว็บด้วย browser · ผู้ตรวจไม่เห็นข้อความอนุมัติฉบับเต็ม (ADV-04/11b/13 อาศัยข้อความที่ทีมถือ)
- รายละเอียดทุกข้อ: 05 หัวข้อ 4 · ไฟล์ `evidence/adversarial-review/`
- รอบ R3B (D-07A ที่ `cb34ce9`/`ff49dd3`): 10 findings (High 1 · Medium 5 · Low 4) · ยืนยันว่าสิทธิ์เขียน/การซ่อนราคา/CEO อนุมัติไม่ได้ ถูกต้อง (ADV3-H1/H2 ผ่าน) · ADV3-02..10 แก้แล้ว (`9ebccd0` + qa tooling) · ADV3-01 รอลูกค้า (Q-R3-14) · retest R3C โดยผู้ตรวจแยก: ADV3-02/04/05 ยัง PARTIAL + พบใหม่ ADV3C-01 (Medium) และ Low 4 · แก้ใน `08e2aba` · ยังไม่มี retest รอบที่สามโดยผู้ตรวจแยก — ยืนยันด้วย test ของผู้ตรวจ R3C ที่รวมเข้า suite และ D07A-08 (05 หัวข้อ 4b, 4c)

## 7. ความเสี่ยงความปลอดภัยที่เหลือ
- guard ต้นทุนอาศัยชื่อ key/รูปแบบข้อความ/module — endpoint ใหม่ต้องเพิ่มใน SEC-R3-05/08
- CEO อนุมัติตาราง PM ได้ (ADV-04 BLOCKED — BUSINESS CONFIRMATION)
- host guard ของสคริปต์ตรวจจาก URI เท่านั้น (ADV3C-06) — มองไม่เห็น DNS ของ `mongodb+srv` หรือ tunnel
- รุ่นที่ต่างกันด้วยตัวอักษรหน้าตาคล้าย (homoglyph) ยังสร้างซ้ำได้ (ADV3C-03 · Low · ยอมรับความเสี่ยง)
- ราคามาตรฐานสองแหล่ง (ADV3-01 · Q-R3-14) — ไม่ใช่ช่องโหว่สิทธิ์ แต่เสี่ยงตัวเลขรายรับไม่ตรงความคาดหวัง
- ผู้ใช้เดิมไม่ถูกบังคับเปลี่ยนรหัสผ่าน (Q-R3-04)
