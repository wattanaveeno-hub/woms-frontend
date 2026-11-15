# 02 — Scope & Impact (รอบ Master Execution 14 พ.ย. 2569)

| Decision | Frontend | Backend | API | Database | สิทธิ์ | Regression risk |
|---|---|---|---|---|---|---|
| D-R2-01 | `MachinePicker.tsx` (prop `atCustomer`), `QueueForm.tsx`, `lib/api.ts` | `mongo/serviceQueueRepo.ts` (`assertEquipmentEligible` ตอนเปิดคิว/บันทึกร่าง/แก้ร่าง/ส่งร่าง), `routes/equipment.ts` (`/picker?customerId&siteId`) | เพิ่ม query param (ไม่ส่ง = ผลเดิม) · ข้อผิดพลาดใหม่ 409 `EQUIPMENT_NOT_AVAILABLE` / `EQUIPMENT_OTHER_CUSTOMER` / `EQUIPMENT_OTHER_SITE` | ไม่มี | เดิม | ต่ำ — คิว PM/เลื่อนงาน ไม่ผ่าน `composeQueueData` · หน้าเปิดงาน (jobs/new) ไม่ส่ง param ใหม่ |
| D-R2-02 | (มีแล้วรอบก่อน) | `routes/serviceQueue.ts` บันทึก `recordAudit` entity `jobs` หลังแจ้งเลื่อนสำเร็จ (ไม่บันทึกเมื่อ replay) | ไม่เปลี่ยน | ไม่มี (ใช้ HOLD / holdReason / appointmentHistory / service_queue_events เดิม) | เดิม (svcqueue:admin) | ต่ำ |
| D-R2-03 | `RentalContractDocument.tsx`, `RentalContractScreen.tsx`, `globals.css` (DEF-R3-01) | — | — | — | — | ต่ำ — `globals.css` แก้เฉพาะ `@media print` (padding ของ app shell = 0) |
| D-R2-04 | `QueueSitePhotos.tsx`, `service-queue/[id]/page.tsx`, `lib/serviceQueueApi.ts` | `mongo/queueSitePhotoRepo.ts` (soft delete), `routes/serviceQueue.ts` (`DELETE …/site-photos/:photoId`) | เพิ่ม endpoint | `queue_site_photos` เพิ่มฟิลด์ `deletedAt/deletedById/deletedBy/deleteReason` (additive) | ร่าง: เจ้าของ/Admin · ส่งแล้ว: `svcqueue:admin` | ต่ำ |

คลังเครื่อง / PM: ไม่แก้หน้าและ logic · `/api/equipment/picker` เพิ่มเฉพาะ query ที่เลือกได้ (test ยืนยันค่าเริ่มต้นเหมือนเดิม)
