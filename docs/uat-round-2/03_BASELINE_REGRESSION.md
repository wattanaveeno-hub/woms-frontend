# 03 — Baseline & Regression (รอบ Master Execution)

สภาพ repo (อ่านอย่างเดียว · 14 พ.ย. 2569 04:14 UTC): woms-frontend `main` @ `a55a0d9` (+ไฟล์ยังไม่ commit 81 รายการ) · woms-backend `main` @ `b5c2cec` (+28) · Git = OWNER-MANAGED

สภาพแวดล้อมรัน test: sandbox ของ Claude (สำเนา working tree เดียวกับเครื่อง Owner · ตรวจ sha256 ทุกไฟล์ที่ซิงก์) · Node 22 · vitest (fakeMongo) · `node --test`

| Suite | คำสั่ง | Baseline ก่อนแก้ (04:14 UTC) | หลังแก้ (final) | เทียบ |
|---|---|---|---|---|
| Backend | `npx vitest run` | 176 files · 2306 passed · 242 skipped · 0 failed | 178 files · **2317 passed** · 242 skipped · 0 failed | +11 test ใหม่ · test เดิมผ่านครบ · skip เท่าเดิม |
| Frontend | `npm test` | 326 pass · 0 fail | **326 pass** · 0 fail | เท่าเดิม |
| Backend tsc | `tsc --noEmit` | ผ่าน | ผ่าน (sandbox + เครื่อง Owner) | — |
| Frontend tsc | `tsc --noEmit` | ผ่าน | ผ่าน (sandbox + เครื่อง Owner) | — |
| Frontend build | `next build` | ผ่าน | ผ่าน | — |

ตัวเลขรอบก่อน (2306/325) ยืนยันซ้ำได้: Backend 2306 ตรง · Frontend 326 (รวม test jnLabel 1 ข้อที่เพิ่มหลังรายงานรอบก่อน)

Log: `Claude outputs/uat-round-2/r3/baseline-*.log`, `final-*.log`
