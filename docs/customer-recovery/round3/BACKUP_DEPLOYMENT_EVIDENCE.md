# หลักฐาน Git / Backup / Restore / Deployment (directive 30 ต.ค. 69)

Directive อนุญาต push, merge เข้า `main` และ deploy UAT แล้ว (ไม่ต้องขออนุมัติซ้ำ) — ทุกขั้นด้านล่าง **พยายามทำแล้วแต่ทำไม่ได้เพราะเข้าถึงระบบไม่ได้** ไม่ใช่เพราะรออนุมัติ

## 1. การเข้าถึงที่ตรวจ (`evidence/env-access/`)
| ระบบ | จาก cloud session | จากเครื่องผู้ใช้ (device) | ผล |
|---|---|---|---|
| GitHub (repo private `wattanaveeno-hub/woms-*`) | ยังไม่ได้เชื่อมบัญชี GitHub กับ session · remote เป็นไฟล์ bundle | `git ls-remote origin` → `fatal: could not read Username` · ไม่มี credential helper · DNS github.com ไม่ resolve | **BLOCKED — ENVIRONMENT** |
| Render API | `api.render.com` → เชื่อมต่อไม่ได้ (000) | 000 | **BLOCKED — ENVIRONMENT** |
| Vercel API | `api.vercel.com` → 000 | 000 | **BLOCKED — ENVIRONMENT** |
| MongoDB Atlas (UAT, DB `woms`) | ไม่ resolve | `.env` ชี้ cluster `…4myjzc7.mongodb.net` แต่ DNS `EAI_AGAIN` | **BLOCKED — ENVIRONMENT** |

## 2. สถานะแต่ละขั้น
| ขั้น (directive §12–14) | สถานะ | หมายเหตุ |
|---|---|---|
| ระบุฐาน / ยืนยันไม่ใช่ production | PARTIAL | จาก `.env` ในเครื่อง: cluster Atlas DB `woms` · ยืนยันกับระบบจริงไม่ได้ |
| preflight อ่านอย่างเดียว | NOT TESTED — BLOCKED | สคริปต์ `preflight-readonly.mjs` + `preflight-proof.mjs` พร้อม (พิสูจน์บนฐาน QA ว่าไม่เขียน) |
| backup / ตรวจไฟล์ / restore ในฐานแยก | NOT TESTED — BLOCKED | runbook ข้อ 3 |
| migration dry-run / apply / กระทบยอด | NOT RUN | สคริปต์บังคับ backup manifest ที่ทดสอบ restore แล้ว |
| push branch | BLOCKED | ไม่ force-push · branch อยู่ในเครื่องผู้ใช้ (ref ใหม่ `fix/customer-recovery-round3-final`) |
| merge เข้า `main` | NOT DONE | ไม่ได้ merge ในเครื่องแทน เพราะยังไม่เห็น `main` ล่าสุดบน GitHub และ branch protection — runbook ข้อ 5 |
| deploy Render / Vercel | NOT DONE | ไม่มีการเข้าถึง |
| post-deploy QA | NOT TESTED | `uat-smoke.mjs` พร้อม (อ่านอย่างเดียว ไม่สร้างข้อมูลธุรกิจ) |
| Production release tag | ไม่สร้าง (ตาม directive) | |

## 3. SHA ที่ส่งมอบ (ยังไม่ deploy)
ดู 08 หัวข้อ "commit ที่ทดสอบ" — หลักฐาน final-run-13 ตรงกับ HEAD ของทั้งสอง repo (`verify-results` อ่านจาก git เอง · dirty 0)

## 4. สิ่งที่ต้องทำเพื่อปลดล็อก
1. เชื่อมบัญชี GitHub ใน claude.ai Settings → Connectors (หรือผู้ใช้ push เองตาม runbook ข้อ 5)
2. รัน runbook ข้อ 1–4 และ 6–7 จากเครื่องที่เข้าถึง Atlas / Render / Vercel ได้ แล้วส่งผล JSON กลับเพื่อบันทึกใน 08/11
