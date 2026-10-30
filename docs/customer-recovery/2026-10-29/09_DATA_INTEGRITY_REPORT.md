# 09 · Data Integrity Report

## 1. สิ่งที่รอบนี้เปลี่ยนในฐานข้อมูล

**ไม่มี migration** · ไม่มีการแก้/ลบข้อมูลเดิม · ฟิลด์ใหม่ทั้งหมด optional (ดู 07) · โค้ดอ่านข้อมูลเก่าได้: คิวเก่าไม่มี `source` = คิวทั่วไป · รายการ PM เก่าไม่มี `queueId` = ยังไม่เสนอคิว (`$in:[null,""]`) · เครื่องเก่าไม่มี `pmBaselineSource` = ไม่เคยตั้งฐานจากการติดตั้ง

## 2. ความสัมพันธ์ที่ตรวจด้วยการรันจริง (DB หลังแต่ละ scenario)

| ความสัมพันธ์ | ตรวจอย่างไร | ผล |
|---|---|---|
| Queue → JN 1:1 | `jobs.find({queueId})` หลังยิง release ซ้ำ/พร้อมกัน · unique partial index `uniq_job_queue` | 1 เอกสารเสมอ · PASS |
| Queue item → Job Machine → Machine Record | `items[].jobEquipmentId` = `job_equipment._id` · `equipmentId` เดิม · นับ `equipment` ตาม serial ก่อน/หลัง | ไม่มีเครื่องซ้ำ · PASS |
| PM item → Queue → JN | `pm_schedules.items[].queueId/jobId/status` ทุกขั้น | PLANNED → (queue) → JOB_CREATED → DONE หลังปิดงานเท่านั้น · ยกเลิกคิว/ใบงานคืน PLANNED · PASS |
| PM ไม่ถูกบันทึกล่วงหน้า | `equipment.lastPmDate` ก่อน/หลังเปิดงาน, ยกเลิก | ไม่เปลี่ยนจนปิดงานสำเร็จ · PASS |
| ฐาน PM ติดตั้ง | `lastPmDate`, `pmBaselineSource`, `equipment_events` | วันเสร็จจริง · ไม่มี event PM · ครั้งเดียว · PASS |
| ใบเสนอราคา → JN | `quotations.jobId` · นับ `jobs` ก่อน/หลัง | ไม่สร้าง JN · 1 ใบต่อใบงาน · PASS |
| สัญญา → เครื่อง | `contracts.model/serial` = Machine Record | PASS |
| ไม่มี JN กำพร้า | ตาราง PM ยกเลิก → release 409 และ `jobs` ว่าง | PASS (unit test) |

## 3. ความเสี่ยงต่อข้อมูล production ที่ต้องตรวจก่อน deploy (อ่านอย่างเดียว)

ไม่ได้รันกับ production · รายการต่อไปนี้เป็น query อ่านอย่างเดียวที่ควรรันโดยผู้มีสิทธิ์ก่อน deploy (หลัง backup):

1. **กลุ่มแชทซ้ำ (BUG-V2-21)**
   ```js
   db.chat_groups.aggregate([{ $group: { _id: "$groupKey", n: { $sum: 1 }, ids: { $push: "$_id" } } }, { $match: { n: { $gt: 1 } } }])
   db.chat_groups.getIndexes()   // ต้องมี uniq_group_key (unique)
   ```
   ถ้ามีซ้ำ: unique index จะสร้างไม่ได้ ต้องรวมกลุ่ม (ย้าย `group_messages`/`group_reads` ไป groupKey เดียว) — **ไม่ทำในรอบนี้** ต้องมี dry-run + backup + rollback และได้รับอนุมัติ
2. **คิวที่ค้าง READY_TO_OPEN จากระบบเดิม** (เดิมหมายถึง "เปิดอัตโนมัติไม่สำเร็จ") — หลัง deploy จะแสดงเป็น "ลูกค้าคอนเฟิร์มแล้ว รอ Admin เปิดงาน" ซึ่งความหมายยังถูกต้อง (Admin ต้องกดเปิดเหมือนเดิม)
   `db.service_queues.find({ status: "READY_TO_OPEN" }, { queueNo: 1, jobId: 1, updatedAt: 1 })`
3. **equipment index**: `db.equipment.getIndexes()` ต้องมี `serial_1` (unique) และ `uniq_serialKey` — ถ้าไม่มี การปิดงานครั้งแรกหลัง deploy จะรอ index build (BUG-V2-12 แก้ให้รอแล้ว)
4. **ใบเสนอราคาที่อาจถูกเขียนฟิลด์ระบบผ่าน PATCH ก่อนหน้า (BUG-V2-13)**
   `db.quotations.find({ cancelledJobIds: { $exists: true, $ne: [] } }, { quotationNo: 1, jobId: 1, cancelledJobIds: 1 })` — เทียบกับ audit log ว่าเลขใบงานที่ยกเลิกมาจาก `releaseQuotationForCancelledJob` จริงหรือไม่

## 4. Rollback

โค้ด: กลับไป commit `611ee4d` / `af8afe4` ได้ทันที — ฟิลด์ใหม่ที่ถูกเขียนระหว่างใช้งานไม่ทำให้โค้ดเดิมพัง (โค้ดเดิมไม่อ่านฟิลด์เหล่านั้น) ยกเว้นผลทางธุรกิจ:
- คิวที่อยู่ READY_TO_OPEN จะถูกโค้ดเดิมตีความเป็น "เปิดอัตโนมัติไม่สำเร็จ" (Admin ยังกดเปิดได้)
- คิว PM (`source: "PM"`) ที่เปิดงานภายใต้โค้ดเดิมจะไม่ผูกรายการ PM ให้ — ต้องให้ Admin ตรวจรายการ PM ที่ `queueId` มีค่าแต่ `jobId` ว่าง
- `lastPmDate` ที่ตั้งจากการติดตั้ง (`pmBaselineSource: "INSTALL"`) คงอยู่ (ตรวจย้อนได้จาก `equipment_events` note "ฐาน PM จากการติดตั้ง")
