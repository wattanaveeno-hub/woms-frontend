# 06 · Implementation Changelog (Round 2)

Branch `fix/customer-recovery-2026-10-29` (ต่อจาก Round 1) ทั้งสอง repo · **ยังไม่ merge · ยังไม่ push · ยังไม่ deploy · ไม่มี migration · ไม่ได้แตะ production**
ไฟล์ `check-integrity-prod.bat` ที่แก้ค้างอยู่ใน repo ของผู้ใช้ไม่ถูกแตะ

## Backend — 7 commits โค้ด (32 ไฟล์ · +1136 / −97) + 1 commit เอกสาร

| Commit | เวลา (+07:00) | สรุป |
|---|---|---|
| `1ff51f7` | 2026-10-30 01:30 | BUG-V2-17 ขอบเขตข้อมูลช่าง · N-2/N-3 · BUG-V2-19 · BUG-V2-18 · BUG-V2-21 · QA-F08 · QA-C7 · N-1 · fallback วันติดตั้ง · TECH-02 · CHAT-02 · CHAT-03 · tests |
| `9553b0e` | 01:33 | QA-F12 ส่วนที่สอง ("ช่าง ช่าง") |
| `f457998` | 02:09 | แก้ตาม independent QA: R2-F01..F08 (ยอดเงินรายใบงาน, race สัญญา, ตัวพิมพ์ใน link-equipment, ขอบเขตเครื่องในขั้นคิว/ยกเลิก, อ่านแจ้งเตือน) · ปรับ real-DB test ตามพฤติกรรมใหม่ |
| `ea0cf62` | 02:23 | แก้ตาม independent QA รอบ 2: R2-F09 (lock ต่อ Serial ตอนเปิดใช้งาน/ย้อนสถานะเป็น ACTIVE) · R2-F10 (ตรวจซ้ำไม่สนตัวพิมพ์ + นับร่าง) · R2-F11 (นำเข้า Excel หาเครื่องไม่สนตัวพิมพ์ เก็บ Serial ตามคลังเครื่อง) |
| `f93098b` | 02:33 | แก้ตาม independent QA รอบ 3: R2-F12 (lock ต่อ Serial ตอนต่อสัญญา + ตรวจไม่สนตัวพิมพ์) · R2-F13 (dry-run นำเข้ายังตรวจเครื่องไม่ว่าง — regression จาก `ea0cf62`) |
| `0a10e18` | 02:43 | แก้ตาม independent QA รอบ 4: R2-F14 (เปลี่ยน Serial เครื่องย้ายสัญญาไปเลขที่มีสัญญามีผลอยู่แล้ว → 409 · lock ทั้งเลขเดิมและเลขใหม่) |
| `242f643` | 02:55 | แก้ตาม independent QA รอบ 5: R2-F15 (แก้รายการชำระของสัญญาที่ชำระครบจนกลับเป็นใช้งาน ขณะเครื่องมีสัญญาใหม่ → 409 · lock ต่อ Serial) |

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/lib/dataScope.ts` (ใหม่) | ขอบเขตข้อมูลผู้ใช้ที่ถูกจำกัด · `stripMoney` · `jobFinanceGuard` |
| `src/mongo/techDataScope.ts` (ใหม่) | เครื่องของช่าง (ใบงานที่ไม่ยกเลิก + ตาราง PM ที่ส่งแล้ว) · คลังรถของช่าง |
| `src/index.ts` | `jobFinanceGuard` หลัง `authenticate` |
| `src/routes/equipment.ts`, `customers.ts` | `router.param("id")`, กรองรายการ/export/picker, summary/inventory 403, holding |
| `src/routes/stock.ts`, `src/mongo/stockRepo.ts` | คลัง/ยอด/ความเคลื่อนไหว/อะไหล่ตามขอบเขต · `visibleTo` ใน query |
| `src/routes/parts.ts`, `jobParts.ts` | ราคา/ต้นทุน null สำหรับช่าง |
| `src/routes/dashboard.ts` | ขอบเขตเครื่อง/สต๊อก · ยอดเงิน null (`financeVisible`) · คอลัมน์ยอดเงินใน export |
| `src/routes/queue.ts` | slot/suggest |
| `src/domain/user.ts` | Sale ไม่มี `tracking:view` |
| `src/routes/chat.ts` | ยืนยันจากแชทต้องมี signoff ช่าง |
| `src/lib/serviceQueueNotify.ts` | แจ้งช่างเดิมแยก · การ์ดใหม่เมื่อสถานะเปลี่ยน · `techLabel` |
| `src/domain/serviceQueue.ts`, `src/routes/serviceQueue.ts` | `toTechQueueView` และใช้ใน list/detail/jobs |
| `src/domain/groupChat.ts`, `src/mongo/groupChatRepo.ts`, `src/routes/groupChat.ts` | mentions · สร้างกลุ่มภายใต้ lock เมื่อไม่มี index · รวมกลุ่มซ้ำในรายการ |
| `src/mongo/quotationRepo.ts` | link-job: ลูกค้าต้องตรงและครบ · lock ต่อ JN · ล้าง jobLinkedBy/ById |
| `src/mongo/pmPlanRepo.ts` | guard ในคำสั่ง update ทั้งยกเลิก/ปิดตาราง และจองคิว |
| `src/mongo/contractRepo.ts` | ตรวจหลังแปลง Serial + collation · lock `contract-serial:<SN>` ทุกเส้นทางที่ทำให้เครื่องมีสัญญามีผล: สร้าง, ผูกเครื่อง, เปลี่ยนสถานะเป็น ACTIVE, ต่อสัญญา, เปลี่ยน Serial เครื่อง (`withSerialRelinkGuard`), ชำระ/แก้รายการชำระที่ทำให้ COMPLETED กลับเป็น ACTIVE · เก็บ Serial ตาม Record เมื่อผูก |
| `src/mongo/equipmentRepo.ts` | เปลี่ยน Serial (POST /serial และ PATCH) ผ่าน `withSerialRelinkGuard` |
| `src/mongo/contractImport.ts` | หาเครื่อง/สัญญาที่ชนแบบไม่สนตัวพิมพ์ · ใช้ Serial ตามคลังเครื่อง · ยังตรวจเครื่องไม่ว่าง |
| `src/mongo/jobCloseService.ts` | fallback วันติดตั้ง = วันที่ปิดงาน |
| `src/mongo/notificationRepo.ts` | read / read-all เฉพาะของผู้ใช้ |
| tests | `test/customerRecoveryRound2.test.ts` (26) · `contractImport.test.ts` +2 (R2-F11/F13) · ปรับ `serviceQueue.test.ts` AT10 · `round8_machine.test.ts` check-location · `dashboard.mongo.int.test.ts` I5 · `helpers/fakeMongo.ts` `$nin` กับฟิลด์ที่ไม่มี |

## Frontend — 2 commits โค้ด (14 ไฟล์ · +319 / −37) + 1 commit เอกสาร

| Commit | เวลา | สรุป |
|---|---|---|
| `6602268` | 01:30 | /m การ์ดมีปุ่มรับทราบ + "เปิดดูใบงาน" · หน้าคิวมุมมองช่าง · หน้าคิว 403 แสดง "ไม่ได้รับผิดชอบแล้ว" · แท็ก @ · เสนอวันจากการ์ดแชท · หน้าสต๊อกโหมดคลังของคุณ · แดชบอร์ดซ่อนยอดเงิน null · Sale ไม่มีเมนูแดชบอร์ด · `lib/mentions.ts`, `lib/bahtFormat.ts` + tests |
| `439465f` | 01:50 | QA-F06: แก้คิวที่ผูก JN ส่งเฉพาะหมายเหตุ/เซลล์ · ไม่บังคับเลือกเครื่อง · `data-testid="queue-card"` |

## Schema / ข้อมูล

ฟิลด์ใหม่ optional: `group_messages.mentions[]` · คีย์ใหม่ใน `op_locks`: `chat_group:*`, `quotation-job-link:*`, `contract-serial:*` (ลบเองเมื่อจบคำขอ, หมดอายุ 10–30 วินาที) · ไม่มี index ใหม่ · ไม่มี migration

## พฤติกรรมที่เปลี่ยน (ต้องแจ้งผู้ใช้ก่อน UAT)

1. **ช่าง:** เห็นเครื่องเฉพาะในใบงานที่ได้รับมอบหมาย (ไม่รวมใบงานที่ยกเลิก) และตาราง PM ที่ส่งแล้ว · เครื่องในขั้นคิวเห็นเฉพาะรุ่น · สต๊อกเห็นเฉพาะคลังรถตน ไม่มีต้นทุน · ไม่เห็นภาพรวมคลังทั้งบริษัท · ไม่เห็นยอดเงินใบงาน
2. **ช่าง:** หน้าคิวไม่มีประวัติรอบนัด บทสนทนา Log และ SN · การ์ดงานมีปุ่ม "รับทราบงาน" และ "เปิดดูใบงาน"
3. **Sale:** ไม่มีเมนูแดชบอร์ด · ไม่เห็นยอดเงินใบงาน/แดชบอร์ด · เปิดหน้าติดตามช่างผ่าน URL ไม่ได้
4. **Admin:** ยืนยันการส่งงานจากแชทปิดงานแทนช่างไม่ได้ ถ้าช่างยังไม่ลงนาม · ผูกใบเสนอราคาได้เฉพาะเมื่อทั้งใบเสนอราคาและใบงานระบุลูกค้าและเป็นลูกค้าเดียวกัน · แก้คิวที่ผูก JN ได้เฉพาะหมายเหตุ/เซลล์เจ้าของงาน
5. **ทุกคน:** การ์ดคิวในแชทขึ้นใหม่ทุกครั้งที่สถานะเปลี่ยน · แท็ก @ ได้เฉพาะสมาชิกกลุ่ม (ไม่มีแจ้งเตือน) · สร้าง/ผูก/เปิดใช้งาน/ต่อสัญญาเครื่องเดียวกันพร้อมกัน คำขอที่ชนได้ข้อความให้ลองใหม่ · Serial ตัวพิมพ์เล็กในไฟล์นำเข้าถูกแปลงเป็น Serial ตามคลังเครื่อง · เปลี่ยน Serial เครื่องไปเลขที่มีสัญญามีผลอยู่แล้วไม่ได้ · Manager แก้/ยกเลิกรายการชำระของสัญญาที่ชำระครบไม่ได้ ถ้าเครื่องมีสัญญาฉบับใหม่ที่มีผลแล้ว (D-23)
