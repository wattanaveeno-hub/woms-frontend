# 03 — Changed Files (รอบ UAT Round 2)

สถานะ Git: **OWNER-MANAGED** — Claude ไม่สร้าง branch / commit / push / merge · ไฟล์ถูกเขียนลง working tree แล้ว (ตรวจ sha256 ตรงกับ sandbox · ก่อนเขียนตรวจว่าไฟล์ในเครื่องต่างจาก sandbox เฉพาะส่วนที่ Claude แก้)

## woms-backend
ใหม่: `src/mongo/queueSitePhotoRepo.ts`, `test/uatR2_chatSearchSender.fake.test.ts`, `test/uatR2_modelImport.test.ts`, `test/uatR2_phoneLogin.test.ts`, `test/uatR2_pickerAvailable.test.ts`, `test/uatR2_queueSitePhotos.test.ts`
แก้: `src/routes/auth.ts`, `src/routes/users.ts`, `src/mongo/userRepo.ts`, `src/mongo/metaRepo.ts`, `src/mongo/groupChatRepo.ts`, `src/routes/equipment.ts` (เพิ่ม availableOnly เท่านั้น), `src/routes/equipmentModels.ts`, `src/routes/serviceQueue.ts`

## woms-frontend
ใหม่: `src/components/serviceQueue/TechAvailability.tsx`, `QueueSitePhotos.tsx`, `RescheduleJobDialog.tsx`, `src/lib/availabilityRules.ts`, `src/lib/holdKind.ts`, `scripts/availabilityRules.test.ts`, `scripts/uatR2Rules.test.ts`
แก้: `src/app/login/page.tsx`, `src/app/users/page.tsx`, `src/app/group-chat/page.tsx`, `src/app/master/equipment-models/page.tsx`, `src/app/service-queue/page.tsx`, `src/app/service-queue/new/page.tsx`, `src/app/service-queue/[id]/page.tsx`, `src/app/jobs/[id]/page.tsx`, `src/app/jobs/page.tsx`, `src/app/m/job/[id]/page.tsx`, `src/components/JobWorkflowPanel.tsx`, `src/components/JobDetailCards.tsx`, `src/components/StatusBadge.tsx`, `src/components/MachinePicker.tsx`, `src/components/RentalContractDocument.tsx`, `src/components/serviceQueue/QueueForm.tsx`, `QueueBits.tsx`, `QueueBoard.tsx`, `JobQueuePanel.tsx`, `src/components/woms/WomsStatusChip.tsx`, `src/lib/api.ts`, `src/lib/serviceQueueApi.ts`, `src/lib/serviceQueueRules.ts`

ไฟล์อื่นใน `git status` ของ frontend (theme, customers, partners ฯลฯ) มาจากงาน redesign รอบก่อน ยังไม่ commit

## Shared component impact (คลังเครื่อง / PM)
| Component | การเปลี่ยน | ผลต่อคลังเครื่อง/PM |
|---|---|---|
| `JobStatusChip` | prop `holdReason` (optional) | ไม่ส่ง = ป้ายเดิม · หน้า PM/คลังไม่ส่ง → ไม่เปลี่ยน |
| `MachinePicker` | prop `availableOnly` (default false) + สไตล์แถวที่เลือก | หน้าเปิดงานใช้ค่าเดิม (แสดงทุกสถานะ) |
| `/api/equipment/picker` | query `availableOnly=1` | ไม่ส่ง = ผลเดิม (มี test ยืนยัน) |
