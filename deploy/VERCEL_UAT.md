# WOMS frontend — Vercel (UAT)

ใช้ project เดิมใน Vercel (อย่าสร้างซ้ำ) · Framework: Next.js · Build: `npm run build` · Node 22 · Root: repo root
`next.config.js` ใช้ `output: "standalone"` — Vercel รองรับ ไม่ต้องตั้งค่าเพิ่ม

## Environment variables (Production/Preview ของ project UAT)
| ตัวแปร | ค่า | หมายเหตุ |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | URL ของ Render backend (UAT) ไม่มี `/` ท้าย | ฝังตอน build — เปลี่ยนแล้วต้อง redeploy |
| `NEXT_PUBLIC_FEATURE_CHAT` | ตามค่าที่ใช้อยู่เดิม | |
| `NEXT_PUBLIC_FEATURE_SERVICE_QUEUE` | ตามค่าที่ใช้อยู่เดิม | |
| `NEXT_PUBLIC_FEATURE_TECH_QUEUE` | ตามค่าที่ใช้อยู่เดิม | |

## Production branch
`main` — deploy หลังเจ้าของ repo merge และ backend บน Render ผ่าน `/health` แล้วเท่านั้น

## ตรวจหลัง deploy
- `GET <vercel-url>/api/version` → `{ ok: true, commit: "<SHA>" }` ต้องตรงกับ commit ที่ merge (Vercel ตั้ง `VERCEL_GIT_COMMIT_SHA` ให้เอง)
- เปิด `/login` · ล็อกอินแต่ละบทบาท · ตรวจเมนูตามบทบาท
- Backend `CORS_ORIGIN` ต้องมี URL นี้
- รัน `qa/customer-recovery-round3/uat-smoke.mjs` (backend repo) ตาม UAT_DEPLOYMENT_RUNBOOK ข้อ 7
