# qa/e2e-local — Regression FE-01 / FE-02 บน localhost (mock API)

ทดสอบหน้าเว็บที่ build แล้วบนเครื่อง โดย **ดักทุกคำขอ API ด้วย mock** — ไม่มีคำขอไป backend จริง, Atlas หรือ UAT
(โดเมนอื่นนอกจากหน้าเว็บ localhost ถูก abort · สคริปต์ปฏิเสธ `FE_URL` ที่ไม่ใช่ localhost)

| ไฟล์ | หน้าที่ |
|---|---|
| `mockApi.mjs` | mock API · ตอบ 403 ตาม guard จริงของ backend (`fixtures/api-routes.json` + `../../scripts/fixtures/role-permissions.json`) |
| `fe-fix.e2e.mjs` | FE-01 (ความสูงพื้นที่แชท 8 ขนาดจอ × manager/tech) · FE-02 (คำขอที่ได้ 403 ใน 65 วินาที × 7 บทบาท) |
| `nav-pm-monthly.e2e.mjs` | เมนู (หัวกลุ่ม 16px + ไอคอน) × 7 บทบาท · ตาราง PM รายเดือน (สิทธิ์ดู/เปลี่ยนช่าง, 390px, เปลี่ยนช่าง 2 ขอบเขต, 409, การ์ดกรอง, มุมมองตามช่าง, หน้าแผน PM เดิม, ช่างเสนอวัน) · `ONLY=nav\|pm\|flow` |
| `fixtures/pm-rounds.json` | ข้อมูลจำลอง `GET /api/pm/rounds` (11 เครื่อง · ภาพรวม/ตามช่าง) |
| `fixtures/api-routes.json` | สำเนา `woms-backend/qa/uat-browser/data/api-routes.json` (backend 0149dd3) |

## รัน

```bash
npm run build                       # NEXT_PUBLIC_API_BASE ค่าเริ่มต้น http://localhost:8000 (ถูก mock)
npx next start -p 3001 &
FE_URL=http://localhost:3001 LABEL=fix node qa/e2e-local/fe-fix.e2e.mjs out.json   # ONLY=fe01 | fe02
```

ต้องมี `playwright` (หรือ `@playwright/test`) + Chromium — repo นี้ไม่ได้ติดตั้งไว้ (ไม่เพิ่ม dependency)
เช่น ใช้ของ `woms-backend/qa/uat-browser`: `NODE_PATH=<woms-backend>/qa/uat-browser/node_modules node qa/e2e-local/fe-fix.e2e.mjs`

## ข้อจำกัด

- คีย์บอร์ดมือถือ **จำลอง** ด้วยการ override `visualViewport.height` (layout viewport คงเดิม) — ไม่แทน iOS Safari / Android Chrome จริง
- หมุนจอ = สลับขนาด viewport · ไม่มี `orientationchange` ของอุปกรณ์จริง
- ข้อมูลเป็น mock (40 ข้อความต่อห้อง) — ไม่ได้ตรวจรูป/การ์ดคิวจริง
