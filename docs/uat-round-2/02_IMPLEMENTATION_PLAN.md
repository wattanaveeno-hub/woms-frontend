# 02 — Implementation Plan / Design

หลักการ: ใช้ API/สถานะเดิมก่อน · ไม่เพิ่ม status ใหม่ · ไม่แตะคลังเครื่อง/PM (ยกเว้นพารามิเตอร์เลือกได้ที่ไม่เปลี่ยนค่าเริ่มต้น) · ไม่ทำ migration

| ID | Frontend | Backend | Data |
|---|---|---|---|
| 01 | `TechAvailability.tsx` ใน ProposeDialog (หน้าคิว + การ์ดแชท) · `lib/availabilityRules.ts` | ใช้ `GET /api/calendar` เดิม | — |
| 02 | หน้า `/master/equipment-models`: ServerImport | `GET /api/equipment-models/import/template.xlsx`, `POST /api/equipment-models/import` (dryRun ค่าเริ่มต้น) | สร้างรุ่นผ่าน `createEquipmentModel` เดิม + audit IMPORT |
| 04 | login: ช่อง "อีเมล หรือเบอร์โทร" · หน้าผู้ใช้: ช่อง/ปุ่มเบอร์โทร | `findByLoginIdentifier` (อีเมล → เบอร์ ≥9 หลัก) · เบอร์ซ้ำหลายบัญชี = ต้องใช้อีเมล · `assertPhoneFree` (409) ตอนสร้าง/แก้ | ใช้ฟิลด์ `users.phone` เดิม |
| 05 | — | `metaRepo` salespeople = master ∪ ผู้ใช้เซลล์ active | — |
| 06 | หน้าผู้ใช้: ทีมเซลล์ + Dialog กำหนดทีม | ใช้ `PUT /api/group-chat/teams/:id` เดิม (ตรวจ 1 คน 1 ทีม + เหตุผล + expectedUpdatedAt) | — |
| 07 | group-chat: ปุ่มดาวน์โหลดบนรูป + ใน preview | — | — |
| 08/15 | `QueueSitePhotos.tsx` (เปิดคิว/ร่าง/หน้าคิว/ใบงาน) | `POST/GET /api/service-queue/:id/site-photos[/:photoId]` | collection ใหม่ `queue_site_photos` (additive, ไม่แก้ schema คิว) · เก็บไฟล์ผ่าน storage เดิม (R2 / data URL) |
| 09 | MachinePicker `availableOnly` (งานติดตั้ง/ยังไม่เลือกประเภท) | `/api/equipment/picker?availableOnly=1` (ไม่ส่ง = เหมือนเดิมทุกอย่าง) | — |
| 10 | แถวที่เลือก: พื้นเขียว+แถบซ้าย+ชิป ✓ · จำนวนที่เลือก | — | — |
| 11 | — | ค้น `senderName` เพิ่มใน search filter/searchHit | — |
| 12 | รายการคิว: avatar เซลล์/ช่าง | ใช้ `/api/users/avatars` เดิม | — |
| 13 | `jnLabel()` + JN ในหัวคิว/ข้อมูลงาน/รายการ/บอร์ด/การ์ด | — | — |
| 14 | `RescheduleJobDialog.tsx` + ปุ่ม "แจ้งเลื่อนงาน" ใน JobWorkflowPanel · `lib/holdKind.ts` แยกป้าย | ใช้ `POST /api/service-queue/jobs/:jobId/reschedule` เดิม (ตั้ง HOLD + "รอเช็คคิวใหม่:" อยู่แล้ว) | ไม่มี status ใหม่ |
| 17 | `.rc-just { text-justify: inter-character }` | — | — |
