# 06 · Implementation Changelog (Round 3)

## ส่วนที่ทำตาม directive 30 ต.ค. 69 (ต่อจาก backend `1966239` / frontend `fee7443`)

Branch เดิม `fix/customer-recovery-round3` ทั้งสอง repo (ไม่สร้าง Round 4 · ไม่สร้าง branch UAT แยก) · งานแต่ละส่วนทำใน branch ย่อยแล้ว merge `--no-ff` กลับ · ไม่มี force-push · commit ไม่มีข้อความ attribution

### Backend
| Commit | เรื่อง |
|---|---|
| `0d30628` | บทบาท ACC + สิทธิ์ `finance:view`, `payments:record/verify/void`, `accounting_docs:record` · Q-R3-01 ถอด `pm:approve` จาก CEO · Q-R3-05 Manager ยกเลิกข้อความผู้อื่น (ต้องมีเหตุผล) |
| `d527a0a` | Q-R3-10 เปลี่ยนวิธีคิดมูลค่าสต๊อกผ่าน runOrRequest (เหตุผลบังคับ · วิธีเดิม/ผู้ขอ/ผู้อนุมัติ/เวลามีผล) · Q-R3-04 สคริปต์ `users:require-password-change` · D-07B `writeGuard` โหมด UAT (confirm-db/host + backup manifest ที่ทดสอบ restore แล้ว) |
| `c0f5545` → merge `ecb1788` | Q-R3-13 คำขอแก้หลังปิดงาน → อนุมัติ → `job_revisions` → ลงนามใหม่ · Q-R3-03 ช่างเห็นใบงานยกเลิกแบบย่อ · Q-R3-12 `follow_ups` เมื่อยกเลิกงานติดตั้งขณะสัญญามีผล |
| `5f2f7dc` → merge `3a13587` | Q-R3-14/ADV3-01 ราคาติดตั้งมาตรฐาน: `priceStatus`, อนุมัติราคา, `equipment_model_price_history`, `priceSnapshot` ในรายการเครื่อง/บรรทัดใบเสนอราคา, Margin ไม่คิด 0 เงียบ, `install-price:reconcile` |
| `f22d4e2` → merge `78b5f4e` | D-11 `/api/finance`: `quotation_payments`, `accounting_documents`, `finance_files`, Revision ใบเสนอราคา, สถานะรับชำระคำนวณ, แจ้งเตือน 5 ชนิด · Q-R3-11 ปลดการผูกใบงานผ่านการอนุมัติ |
| `75b61bf` `901a6be` | test T-06 (regex ต้นทุนจับตัวเลขสุ่ม · แก้ syntax) |
| `b8cecef` → merge `96e0ac0` | Enterprise Activity Log: request context (requestId, IP, user agent, ที่มา), ผลสำเร็จ/ปฏิเสธ (DENIED), redaction, ดัชนี `audit_logs`, viewer API แบ่งหน้า + ส่งออก |
| `2dbe3d2` → merge `e23a4cf` | แก้ R4: ADV4-01..10, 12..15 (ใบงานยกเลิก, resubmit, IP จาก XFF ขวาสุดตาม `TRUST_PROXY_HOPS`, brute force, ลงนามใหม่, master ข้ามหมวดหมู่, ยอดเงิน, เลขเอกสารซ้ำ, idempotency, cost oracle, race record‖revise, writeGuard ทุกสคริปต์, auto-capture, ข้อมูลล็อกอินผิด) |
| `64d81aa` → merge `c0336f7` | แก้ R5: ADV5-01..07 (ลายเซ็นลูกค้าเฉพาะช่างที่ได้รับมอบหมาย, ตัวนับล็อกอินแบบ atomic + `login_failures` TTL, งบ audit, คีย์เลขเอกสาร, การ์ดแชทใบงานยกเลิก, idempotency พร้อมกัน, replay ไม่สร้าง audit) |
| `7b912c2` | แก้ R6: ADV6-01 ใบงาน CLOSED แก้ตรงไม่ได้ (409) · ADV6-02 · ADV6-03/04 · ADV6-05 replay นอกการเงิน |
| `5b1f1dc` | แก้ R7: ADV7-01 อนุมัติเลื่อนนัดเฉพาะใบงาน OPEN/HOLD · ADV7-02 อะไหล่/เบิกสต๊อกผูกใบงานยกเลิก → 409 · ADV7-03 คีย์เลขเอกสารแปลงตัวคั่นแทนการลบ |
| `4e22ff0` → merge `d921562` | แก้ R8: ADV8-01 รั้วสถานะใบงาน (`fenceJobNotCancelled`) ใน transaction เดียวกับการเขียนอะไหล่/สต๊อก · ADV8-02 คำนวณคีย์เลขเอกสารทั้งหมดก่อนเขียน · ADV8-03 ตัด combining mark ทุกชนิด · unit `r8fix.test.ts` (รวม ADV7-01) · คอมเมนต์ D-07B / ตัวอย่างโดเมน cluster |
| `05b4c94` | ADV9-01 คีย์เลขเอกสารตอนเริ่มระบบ: วนจนไม่คืบหน้า + คลี่คีย์ที่วนกันด้วยคีย์ชั่วคราว |

### Frontend
| Commit | เรื่อง |
|---|---|
| `9954d7c` | บทบาท ACC ในป้าย/หน้าผู้ใช้/ตัวกรอง Activity Log · ข้อความกติกา Q-R3-05 |
| `bd221a7` → merge `69f120e` | ESLint `next/core-web-vitals` (eslint 8.57.1, eslint-config-next 14.2.5) · แก้ rules-of-hooks 1 จุด, deps 2 จุด · disable เฉพาะบรรทัดพร้อมเหตุผล |
| `ba0130e` | หน้าวิธีคิดมูลค่าสต๊อก (Q-R3-10) |
| `47d8416` → merge `25caf30` | หน้าแก้ไขหลังปิดงาน · ใบงานยกเลิกแบบย่อ · หน้ารายการติดตาม |
| `b00c0a3` → merge `cb03dd4` | ราคาติดตั้งมาตรฐาน: สถานะ/อนุมัติ/ประวัติ · ป้ายข้อมูลเดิม/ราคาขาดใน Margin · snapshot ในรายการเครื่อง |
| `a6e1e63` → merge `9883c89` | หน้าการเงิน `/finance`, คิวรอตรวจ, ประวัติการเงิน, แท็บรายการรับเงิน/เอกสารบัญชี, สรุปการเงินในใบงาน, Revision/ผลอนุมัติ/ปลดการผูก |
| `60e4e0c` → merge `552bcd2` | หน้า Activity Log: ตัวกรองครบ แบ่งหน้าที่เซิร์ฟเวอร์ เทียบก่อน/หลัง ส่งออก |
| `7d447ff` → merge `c3cc38d` | รองรับผลแก้ R4 (ADV4-01, ADV4-05) |
| `3c71226` → merge `45af2ad` | ปุ่มลายเซ็นลูกค้าฉบับแก้ไขเฉพาะช่างที่ได้รับมอบหมาย (ADV5-01) |
| `330f2a9` → merge `2d9c35f` | UX-R3-01 กรอบลายเซ็นไม่ล้างภาพเมื่อขนาดเปลี่ยน (ResizeObserver หลังจัดวาง · คงภาพเดิม · วัดใหม่ก่อนลาก) — ใช้กับลายเซ็นปิดงาน ลงนามใหม่ และวางบิล |

### การเปลี่ยนแปลงฐานข้อมูล (เพิ่มเท่านั้น · ไม่ลบ/ไม่แก้ข้อมูลเดิมตอนเริ่มระบบ)
- ฟิลด์ใหม่ในใบงาน: `linkedWriteSeq` (ตัวนับรั้ว ADV8-01 · ไม่แตะ `updatedAt`)
- collection ใหม่: `quotation_payments`, `accounting_documents`, `finance_files`, `equipment_model_price_history`, `job_revisions`, `follow_ups`, `login_failures` (TTL)
- ฟิลด์ใหม่ (optional): `equipment_models.priceStatus/priceVersion/priceApprovedBy/At` · `job_equipment.priceSnapshot` · บรรทัดใบเสนอราคา `priceSnapshot` · ใบเสนอราคา `revision`/`revisionHistory`/`jobLinkHistory` · ผู้ใช้ `pwdPolicy.qr304At` (เมื่อรันสคริปต์) · `audit_logs` ฟิลด์ context/result
- ดัชนีใหม่: unique `paymentNo`, idempotency ของรายการรับเงิน/เอกสาร, `uniq_job_revision_*`, `uniq_follow_up_*`, ดัชนี `audit_logs`
- ข้อมูลเดิม: ไม่มี migration อัตโนมัติ · seed/mapping/บังคับเปลี่ยนรหัสผ่าน รันด้วยสคริปต์ dry-run → apply ตาม runbook เท่านั้น
- `check-integrity-prod.bat` ในเครื่องผู้ใช้ไม่ถูกแก้/ไม่ถูก commit

---

## ประวัติ: changelog ก่อน directive 30 ต.ค. 69


Branch ใหม่ทั้งสอง repo: `fix/customer-recovery-round3` แตกจากหัว Round 2 (`fix/customer-recovery-2026-10-29`: backend `9a450b7` · frontend `6c37ba4`) · branch Round 2 คงเดิม
ไม่ได้ push / merge / deploy · ไม่แตะ `main` · ไม่แตะ `check-integrity-prod.bat` ที่ผู้ใช้แก้ค้างไว้ในเครื่อง

## Backend (`woms-backend`)

| Commit | เรื่อง | ไฟล์หลัก |
|---|---|---|
| `608470c` | D-04 เปลี่ยนรหัสผ่านเอง · บังคับเปลี่ยนครั้งแรก · `tokenVersion` เพิกถอน token เมื่อ reset/เปลี่ยนรหัส | `routes/auth.ts`, `middleware/auth.ts`, `lib/auth.ts`, `mongo/userRepo.ts`, `routes/users.ts`, `domain/user.ts` |
| `20fe8b1` | D-13 แจ้งเตือนการแท็ก (`CHAT_MENTION`, dedupe ต่อข้อความ/ผู้ใช้) · ส่งซ้ำด้วย `clientMessageId` ไม่สร้างข้อความใหม่ · push ไม่ส่งผู้ใช้ปิดใช้งาน · D-14 ยกเลิกข้อความ (ผู้ส่ง 15 นาที / `chat:moderate` พร้อมเหตุผล) + audit จำกัดสิทธิ์ | `routes/groupChat.ts`, `mongo/groupChatRepo.ts`, `domain/notification.ts`, `lib/push.ts` |
| `0f67d9c` | D-15 ตำบล/แขวง (ไม่บังคับ) ใน customer site + import/export | `domain/customerSite.ts`, `domain/validation.ts`, import/export |
| `62dff84` | D-12 จองรายการ PM หลายรายการพร้อมกัน · DONE รายเครื่อง · ถอดเครื่อง → รายการกลับ PLANNED | `mongo/serviceQueueRepo.ts`, `mongo/pmPlanRepo.ts`, `mongo/jobEquipmentService.ts` |
| `6daa689` | D-05 คิวร่าง/ช่องบังคับ/submit · D-12 route เสนอหลายเครื่อง · D-19 ป้ายแยกเครื่อง · D-21 ห้ามวันย้อนหลัง + ป้าย "ย้ายให้ช่างอื่นแล้ว" | `routes/serviceQueue.ts`, `routes/pm.ts`, `domain/serviceQueue.ts`, `domain/dateUtil.ts` |
| `0ef65c3` | D-15 ส่งตำบลของสาขาในรายละเอียดใบงาน/คิว | `routes/jobs.ts`, `routes/serviceQueue.ts` |
| `f4d7c4d` | D-01/D-02 CEO ไม่มี `changes:approve` · D-06 รหัสลูกค้าใหม่ ≤ 4 · D-08 ไม่ตั้งสถานะเช่า/ขายก่อนติดตั้ง · D-09 `INSTALL_HIRE_PURCHASE` · D-10 `installedOn` · D-16 แก้ก่อนปิด · D-17 ใบยกเลิก/ปฏิเสธผูกไม่ได้ · D-18 `parts:cost_view/edit` + `partsCostGuard` + margin/แดชบอร์ด · R3-N1 ข้อความประวัติเครื่องไม่มีต้นทุน · seed-admin สร้าง manager | `domain/user.ts`, `lib/dataScope.ts`, `index.ts`, `domain/partner.ts`, `mongo/partnerRepo.ts`, `mongo/contractRepo.ts`, `domain/job.ts`, `mongo/inventorySync.ts`, `domain/jobEquipment.ts`, `mongo/jobEquipmentService.ts`, `mongo/jobCloseService.ts`, `routes/jobs.ts`, `mongo/quotationRepo.ts`, `mongo/serviceMarginService.ts`, `routes/equipment.ts`, `routes/dashboard.ts`, `routes/jobParts.ts`, `scripts/seed-admin.ts` |
| `aabe3e3` `a0b3f55` `ed40970` `174e35c` | merge งานย่อย core/auth/chat/queue (แก้ conflict `domain/user.ts`: คงสิทธิ์ D-18 และ D-14 ทั้งคู่ · `serviceQueueRepo.ts` createQueue) | |
| `7ea791d` | test: ข้อมูลทดสอบ D-15 ใช้รหัสลูกค้าใหม่ที่ผ่าน D-06 | `test/` |
| `02c41fe` | signoff `JOB_CLOSE` ครอบคลุมวันติดตั้ง หมายเหตุ และจำนวนรูป (D-10/D-16) | `routes/jobs.ts` |
| `80d3276` | **R3-N3** PDF ประวัติเครื่องตัดต้นทุนอะไหล่ในบันทึกเดิมสำหรับผู้ไม่มี `parts:cost_view` | `routes/equipment.ts` |
| `02e11c1` | **R3-N4** ซ่อนต้นทุนในข้อความ `detail` ของไทม์ไลน์เครื่อง | `lib/dataScope.ts`, `test/round3Core.test.ts` |
| `30df154` | Adversarial review: ADV-12 guard เทียบ path แบบ normalize · ADV-03 ซ่อนต้นทุนในรายการเปลี่ยนแปลง · ADV-01 ตรวจ D-08 ในทุกเส้นทางสัญญา · ADV-02 ปิดงาน INSTALL เดิมใช้สถานะตามสัญญา · ADV-05 `changes:view` ให้ CEO | `lib/dataScope.ts`, `mongo/contractRepo.ts`, `mongo/jobCloseService.ts`, `domain/user.ts`, `routes/changeRequests.ts`, test |
| `c1ae2d1` | ADV-07 รับ/คอนเฟิร์มวันนัดที่ผ่านแล้วไม่ได้ · ADV-08 วันที่ลูกค้าต้องการย้อนหลังไม่ได้ · ADV-09 ร่างของผู้อื่น 404 · ADV-10 ตรวจเครื่องตอนส่งร่าง · ADV-11 ป้ายไม่เกิน 4 ตัว | `mongo/serviceQueueRepo.ts`, `domain/serviceQueue.ts`, test |
| `a1082bd` | ADV-06 ล็อกแก้รูปกับการปิดงาน · ADV-15 ตรวจ `parts:cost_edit` · ADV-16 ตรวจใบงานยกเลิกหลังผูก · ADV-17 เปลี่ยนเฉพาะตัวพิมพ์ของรหัสเดิม · **R3-N5** ซ่อนต้นทุนในสำเนาคำขออนุมัติอะไหล่ | `mongo/jobEquipmentService.ts`, `routes/stock.ts`, `routes/jobParts.ts`, `mongo/quotationRepo.ts`, `mongo/partnerRepo.ts`, `routes/partners.ts`, `lib/dataScope.ts` |
| `8263a76` | Retest: N1 ซ่อนเฉพาะฟิลด์ต้นทุนอะไหล่ · N2 งานติดตั้งเช่าซื้อไม่ตั้งสถานะเครื่อง (D-09) · เพิ่ม test ของผู้ตรวจ | `lib/dataScope.ts`, `mongo/jobCloseService.ts`, test |
| `55b8da6` | **R3-N6** เปลี่ยนสถานะใบเสนอราคาใช้ updatedAt ในเงื่อนไขเขียน · แก้ regex test ที่ล้มแบบสุ่ม | `mongo/quotationRepo.ts`, test |
| `08557d9` | เอกสาร/หลักฐาน final-3 (ไม่มีโค้ด) | `docs/customer-recovery/round3/`, `qa/customer-recovery-round3/` |
| `6a8af0d` | **D-07A** Equipment Model Master: collection `equipment_models` (ประเภท/หมวดหมู่/รุ่น/ราคามาตรฐาน · `comboKey` + partial unique index `uniq_active_combo` เฉพาะ active) · `/api/equipment-models` (list, cascade, POST, PATCH/ปิดใช้งานผ่าน `runOrRequest` → Admin = คำขออนุมัติ) · ตรวจ ประเภท–หมวดหมู่–รุ่น ที่ backend + Auto Fill ในเครื่อง (สร้าง/แก้/นำเข้า) และคิว · ประเภทเครื่องรับค่าจาก master · สคริปต์ `equipmentModels.ts seed|map|rollback` (dry-run อ่านอย่างเดียว · เขียนเฉพาะ `woms_qa_*`) | `domain/equipmentModel.ts`, `mongo/equipmentModelRepo.ts`, `routes/equipmentModels.ts`, `scripts/equipmentModels.ts`, `routes/equipment.ts`, `mongo/serviceQueueRepo.ts`, `routes/jobs.ts`, `domain/validation.ts`, `domain/audit.ts`, test `d07aEquipmentModel` |
| `2443a43` | D-07A ตัวเลือกเครื่อง (picker) คืนประเภทจาก master ด้วย | `routes/equipment.ts` |
| `04384ca` | test D-18: ค่าอะไหล่ไม่ถูกนับซ้ำระหว่างอะไหล่รายเครื่องกับการเบิกสต๊อกระดับใบงาน | `test/round3Core.test.ts` |
| `cb34ce9` | D-07A ราคามาตรฐานเป็น `null` สำหรับผู้ไม่มีสิทธิ์เห็นยอดเงินใบงาน (นโยบายชั่วคราว D-22) | `routes/equipmentModels.ts` |
| `9ebccd0` | **ADV3-02..09** (ผลรีวิว R3B): ตรวจ ประเภท–รุ่น ในใบงาน (เปิดใบงาน/เพิ่มเครื่อง/แก้รายเครื่อง) · ประเภทเดิมที่ไม่เปลี่ยนไม่ถูกบังคับรายการ · rollback คืนรายฟิลด์เฉพาะค่าที่สคริปต์เขียน (ชน = exit 3 + รายงาน) · สคริปต์เขียนได้เฉพาะ localhost หรือ `--allow-host` · ตัดอักขระ Unicode Cf · ปิด/เปิดใช้งานตรวจ matchedCount → 409 · ADV3-01 แก้คอมเมนต์ (ราคามาตรฐานยังไม่ใช้คิดรายรับ) · test `adv3D07a` | `routes/jobs.ts`, `routes/equipment.ts`, `mongo/equipmentModelRepo.ts`, `domain/equipmentModel.ts`, `scripts/equipmentModels.ts`, `routes/equipmentModels.ts` |
| `08e2aba` | **ADV3C-01..05** (retest R3C): เครื่องในคลังที่เพิ่มเข้าใบงานตรวจประเภทกับรุ่นในคลัง (id/serial) · ประเภทบันทึกเป็นค่ามาตรฐาน · คิวรายการเดิมไม่บังคับรายการประเภท · ตัดอักขระว่างที่ไม่ใช่ Cf · ปิด/เปิดซ้ำไม่บันทึก audit · rollback ตรวจไฟล์ก่อนเขียน + journal `.jsonl` + rollback ซ้ำได้ · test `adv3cD07a` | `routes/jobs.ts`, `mongo/equipmentModelRepo.ts`, `mongo/serviceQueueRepo.ts`, `routes/equipmentModels.ts`, `domain/equipmentModel.ts`, `scripts/equipmentModels.ts` |

ไม่มี migration ที่เขียนข้อมูลเดิม · ฟิลด์ใหม่ทุกตัวอ่านค่าว่างเป็นค่าเริ่มต้น · สิทธิ์ใหม่: `parts:cost_view`, `parts:cost_edit`, `chat:moderate`, `changes:view` · index ใหม่: `uniq_group_message_client` (partial), `group_message_audit.messageId` (unique), `replyTo.messageId`, `equipment_models.uniq_active_combo` (partial unique), `equipment_models.modelKey` · collection ใหม่ `equipment_models` (ว่างจนกว่าจะ seed — seed production ยังไม่ได้รับอนุญาต) · ฟิลด์ใหม่ `equipment.modelMasterId` (ไม่บังคับ)

## Frontend (`woms-frontend`)

| Commit | เรื่อง |
|---|---|
| `ad2457c` | D-04 หน้าเปลี่ยนรหัสผ่าน · redirect เมื่อต้องเปลี่ยน · เมนูผู้ใช้ |
| `9b7d461` | D-13 ส่งพร้อม clientMessageId + retry · D-14 ปุ่มยกเลิกข้อความ + placeholder |
| `270d9f4` | กติกาคิว Round 3 ฝั่งหน้าเว็บ: draft, ตรวจครบ, map ข้อความ LINE, วันนี้เวลาไทย, เลือก PM, ป้ายเครื่อง |
| `ff02131` | D-05 ร่างคิว · ช่องบังคับ · dialog ตรวจทาน · วางข้อความ LINE · Enter ไม่ส่ง |
| `ec93541` | D-12/D-21 เสนอ PM หลายรายการสาขาเดียวกัน · ห้ามวันย้อนหลัง · ป้ายย้ายช่าง |
| `6d1edd9` | D-15/D-19 ช่องตำบล + แสดงผล · ป้ายแยกเครื่องบนการ์ดแชทและหน้าใบงานมือถือ |
| `4859d65` | D-06 รหัสลูกค้า · D-09 ประเภทย่อยเช่าซื้อ · D-10 ช่องวันติดตั้งจริง · D-16 แก้ก่อนปิด · D-18 ซ่อนต้นทุน · D-20 ซ่อนเมนูการแจ้งเตือน |
| `f7cac39` `045c2be` `7c5f016` `ddf8edf` | merge งานย่อย |
| `ba3e27e` | ข้อความประเภทย่อยงานติดตั้งรวม "เช่าซื้อ" (D-09) |
| `88f527d` | **R3-N2** กระดิ่งและปุ่มบนมือถือเปิดมุม "ยังไม่อ่าน" ให้เห็นการแท็ก |
| `42929b9` | ADV-14 หน้ามือถือช่างไม่มีปุ่ม "การแจ้งเตือน" แยก (ใช้กระดิ่ง · D-20) |
| `f779d72` | เอกสาร final-3 (ไม่มีโค้ด) |
| `eceae13` | **D-07A** หน้า "รุ่นเครื่อง (ข้อมูลหลัก)" (`/master/equipment-models`: เพิ่ม/แก้ราคา/ปิดใช้งาน/ตัวกรอง) · คอมโพเนนต์ `EquipmentModelFields` ตัวกรองลำดับชั้น ประเภท → หมวดหมู่ → รุ่น + Auto Fill (ล้างค่าลูกเมื่อเปลี่ยนค่าแม่) ในฟอร์มเครื่องและคิว · ประเภทจาก master ในรายการเครื่องของใบงาน · audit entity |
| `ff49dd3` | D-07A หน้าเว็บรองรับราคามาตรฐานที่ถูกซ่อน (`null`) |
| `f655adb` | ADV3-07 `normKey` ตัดอักขระมองไม่เห็นให้ตรงกับ backend |
| `7fd49dd` | ADV3C-03 `normKey` ตัดอักขระว่างชุดเดียวกับ backend |

## QA tooling (`qa/customer-recovery-round3/` ใน backend repo)

| ไฟล์ | หน้าที่ |
|---|---|
| `run-all.sh` | รันทุกชุดตามลำดับ · บันทึก ENV.txt / SUMMARY.tsv (เวลาเริ่ม–จบ exit code) |
| `api-qa-r3.mjs` | 15 scenarios ราย D (API + DB จริง) |
| `security-r3.mjs` | 9 scenarios (รวม SEC-R3-08 retest ของ adversarial review · SEC-R3-09 D-07A) · 8 บทบาท · IDOR · ค้นหา/แบ่งหน้า · export/PDF · บทบาทอ่านอย่างเดียว |
| `api-qa-d07a.mjs` | D07A-01..08: seed · CRUD/สิทธิ์ · cascade · Auto Fill/ตรวจความสัมพันธ์ · mapping + rollback · ข้อมูลประวัติคงเดิม · retest ADV3 และ R3C (MongoDB จริง) |
| `e2e-d07a.mjs` | E2E ข้อ 19 (ตัวกรอง + Auto Fill) และข้อ 20 (seed + mapping QA) |
| `verify-results.mjs` | ตรวจผลทุกชุดเอง (ไม่เชื่อ exit code): ไฟล์ผลต้องมีและใหม่กว่าเวลาเริ่ม · scenario > 0 และทุก scenario มี check · skipped ตรงจำนวนที่ระบุ · SHA ใน ENV.txt ตรงกับ HEAD จริงและ repo ไม่ dirty → `VERDICT.json` |
| `e2e-r3.mjs` | 11 scenarios browser (Playwright/Chromium) |
| `e2e-r3-carry.mjs` | retest QA-C4 / QA-C5 / QA-C6 |
| `race-d17.mjs` | race ผูกใบงาน ‖ ยกเลิกใบเสนอราคา N รอบ (R3-N6) |
| `package-r3.sh` | คัดลอกเอกสาร/หลักฐาน/สคริปต์เข้า repo (ไม่ทับโฟลเดอร์ Round 1–2) |
| `d07/*` | extract / dry-run / apply (QA เท่านั้น) / rollback / test ด้วยข้อมูลสังเคราะห์ |
| `preflight-readonly.mjs` | เพิ่ม PF-R3-01..07 (อ่านอย่างเดียว) |
| `seed-qa-users-r3.ts` | ผู้ใช้ QA เพิ่ม ceo2/admin2/sales2/tech2/viewer · ปฏิเสธฐานที่ไม่ใช่ `woms_qa_*` |
| ทุกชุด | Round 3: exit code = 1 เมื่อมี scenario ไม่ผ่าน (เดิม exit 0 เสมอ) |
