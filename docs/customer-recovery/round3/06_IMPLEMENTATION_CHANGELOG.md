# 06 · Implementation Changelog (Round 3)

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

ไม่มี migration ที่เขียนข้อมูลเดิม · ฟิลด์ใหม่ทุกตัวอ่านค่าว่างเป็นค่าเริ่มต้น · สิทธิ์ใหม่: `parts:cost_view`, `parts:cost_edit`, `chat:moderate`, `changes:view` · index ใหม่: `uniq_group_message_client` (partial), `group_message_audit.messageId` (unique), `replyTo.messageId`

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

## QA tooling (`qa/customer-recovery-round3/` ใน backend repo)

| ไฟล์ | หน้าที่ |
|---|---|
| `run-all.sh` | รันทุกชุดตามลำดับ · บันทึก ENV.txt / SUMMARY.tsv (เวลาเริ่ม–จบ exit code) |
| `api-qa-r3.mjs` | 15 scenarios ราย D (API + DB จริง) |
| `security-r3.mjs` | 8 scenarios (รวม SEC-R3-08 retest ของ adversarial review) · 8 บทบาท · IDOR · ค้นหา/แบ่งหน้า · export/PDF · บทบาทอ่านอย่างเดียว |
| `e2e-r3.mjs` | 11 scenarios browser (Playwright/Chromium) |
| `e2e-r3-carry.mjs` | retest QA-C4 / QA-C5 / QA-C6 |
| `race-d17.mjs` | race ผูกใบงาน ‖ ยกเลิกใบเสนอราคา N รอบ (R3-N6) |
| `package-r3.sh` | คัดลอกเอกสาร/หลักฐาน/สคริปต์เข้า repo (ไม่ทับโฟลเดอร์ Round 1–2) |
| `d07/*` | extract / dry-run / apply (QA เท่านั้น) / rollback / test ด้วยข้อมูลสังเคราะห์ |
| `preflight-readonly.mjs` | เพิ่ม PF-R3-01..07 (อ่านอย่างเดียว) |
| `seed-qa-users-r3.ts` | ผู้ใช้ QA เพิ่ม ceo2/admin2/sales2/tech2/viewer · ปฏิเสธฐานที่ไม่ใช่ `woms_qa_*` |
| ทุกชุด | Round 3: exit code = 1 เมื่อมี scenario ไม่ผ่าน (เดิม exit 0 เสมอ) |
