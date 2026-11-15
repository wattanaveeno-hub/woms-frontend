# P4-10 ช่องทางแจ้งเตือน — supported vs unsupported

ตรวจจากโค้ด backend/frontend และค่าคอนฟิกบนเครื่อง Owner (ตรวจเฉพาะว่ามีคีย์หรือไม่ — ไม่ได้อ่าน/แสดงค่า)

| ช่องทาง | ในโค้ด | คอนฟิก UAT (เครื่อง Owner) | ผลการตรวจ | สถานะ |
|---|---|---|---|---|
| In-app (กระดิ่ง/รายการแจ้งเตือน) | มี — collection `notifications`, `GET /api/notifications`, unread-count, read, read-all · ตัวตั้งเวลา `NOTIFY_ENABLED` (ค่าเริ่มต้นเปิด) | ใช้งานได้ | Phase 3: ผู้รับแต่ละบทบาทได้รับตาม event ของ JN-2026-0133 · Phase 4: admin list 200 (6) unread 200 (2) | **SUPPORTED · VERIFIED (UAT)** |
| Web Push | มี — `src/lib/push.ts` (web-push + VAPID), service worker `public/sw.js`, การลงทะเบียนใน `Notifications.tsx` · ไม่มี VAPID key → ข้ามการส่งเงียบ ๆ | `.env` และ `.env.uat.local` **ไม่มี** `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | ส่งไม่ได้บน UAT ตอนนี้ | **SUPPORTED IN CODE · NOT CONFIGURED · NOT VERIFIED** |
| LINE (Messaging API / LINE Notify) | ไม่มีโค้ดส่ง (ไม่มี token/endpoint LINE ใน backend) | — | — | **UNSUPPORTED** |
| Email | ไม่มีโค้ดส่ง (ไม่มี SMTP/mailer) | — | — | **UNSUPPORTED** |

หลักการ: ไม่ถือว่าการส่งภายนอก PASS จากแถวในฐานข้อมูลอย่างเดียว · Web Push ต้องมีหลักฐานฝั่งผู้รับ (อุปกรณ์ได้รับ notification) จึงจะ PASS

งานที่ต้องตัดสินใจ (ไม่ได้ทำ — นอกขอบเขตที่อนุมัติ): ตั้ง VAPID key บน UAT แล้วทดสอบกับอุปกรณ์จริง · LINE/Email ถ้าลูกค้าต้องการเป็น requirement ใหม่
