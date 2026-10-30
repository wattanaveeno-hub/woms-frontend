# UAT Deployment Runbook (Round 3 — final · ปรับตาม Git Responsibility Override 30 ต.ค. 69)

ใช้กับ **ฐาน UAT (MongoDB Atlas) + Render (backend) + Vercel (frontend)** · `main` = สาย deploy UAT · ไม่สร้าง release tag
**Git ทั้งหมด (commit, push, PR, merge) เจ้าของโครงการทำเอง — OWNER-MANAGED** · ขั้นตอนฐานข้อมูลและ deploy ทำได้หลังเจ้าของ merge แล้วเท่านั้น และต้องยืนยัน commit ที่ deploy
ทุกขั้นมีคำสั่งตรวจผลและเงื่อนไขหยุด · ซ้อมทั้งชุดบนฐาน QA แล้ว (`evidence/uat-rehearsal-final/` — ดู 08)

## 0. ก่อนเริ่ม
- เครื่องผู้ดูแล: Node 22, git, เข้าถึง Atlas ได้ (IP อยู่ใน Atlas Network Access) · ไม่ต้องมี mongodump (สคริปต์ backup ใช้ Node driver)
- โค้ด: ทั้งสอง repo บน `main` หลัง merge (ข้อ 5) · `cd woms-backend && npm ci`
- ตัวแปร (อย่าวาง URI ลงเอกสาร/แชท):
  ```
  export MONGO_URI='<Atlas URI ของ UAT>' MONGO_DB=woms DATA_SOURCE=mongo
  export CLUSTER=<cluster-id>.mongodb.net         # โดเมน cluster อย่างน้อย 3 ส่วน
  Q=qa/customer-recovery-round3                   # สคริปต์ QA/ops ใน backend repo
  ```

## 1. ยืนยันเป้าหมาย (หยุดถ้าไม่ตรง)
```
node -e "const u=process.env.MONGO_URI;console.log(u.replace(/\/\/[^@]*@/,'//<redacted>@'))"
```
ยืนยันกับเจ้าของระบบว่า cluster/DB คือ UAT ไม่ใช่ production · ชื่อฐานที่มีคำว่า `prod` ทุกสคริปต์ปฏิเสธ

## 2. Preflight อ่านอย่างเดียว (ผู้ใช้ Atlas สิทธิ์ read)
```
node $Q/preflight-readonly.mjs "$MONGO_URI_READONLY" woms preflight-uat.json
node $Q/preflight-proof.mjs woms preflight-uat-proof.json          # identical: true (แก้ URI ในสคริปต์ให้ชี้ UAT ด้วยผู้ใช้ read)
npm run standard-cost:reconcile -- --out out/reconcile-before      # อ่านอย่างเดียว: ต้นทุนมาตรฐาน vs ค่าติดตั้ง Model Index · รายการที่ไม่มีค่าติดตั้ง · snapshot เก่า
```
ทบทวน: PF-R3-01 (งานติดตั้งเปิดค้างไม่มีวันติดตั้ง), PF-01 (กลุ่มแชทซ้ำ), `withLegacyPriceSnapshotOnly` (ควรเป็น 0 บน UAT — ADV11A-06), รุ่นที่ไม่มีค่าติดตั้ง

## 3. Backup + ทดสอบ restore (หยุดถ้าไม่ผ่าน)
```
node $Q/uat-backup-restore.mjs woms $CLUSTER ./uat-backup "<ชื่อผู้ทดสอบ>"
```
ทำ: dump ทุก collection/ตัวเลือก/index/view เป็นไฟล์ + sha256 → restore จากไฟล์ไปฐานแยก `woms_restore_test_<เวลา>` → เทียบจำนวน + เนื้อข้อมูล + index + ตัวเลือก → ตรงทั้งหมดจึงเขียน `uat-backup/backup-manifest.json` (ใช้ได้ 24 ชม.)
- ไม่ตรง/ฐานว่าง/ฐานไม่มีอยู่ = exit ≠ 0 ไม่มี manifest → **ห้าม migrate**
- ฐาน restore อยู่ cluster เดียวกัน (ใช้พื้นที่เพิ่ม) — ลบด้วยมือหลังตรวจ · แนะนำทำ Atlas snapshot ด้วย (ถ้า tier รองรับ)
- ทำนอกเวลาใช้งาน (มีการเขียนระหว่าง dump → hash ไม่ตรง → ไม่มี manifest)

## 4. Migration (dry-run ก่อนเสมอ · apply ต้องมี manifest จากข้อ 3)
```
G="--target uat --confirm-db woms --confirm-host $CLUSTER --backup-manifest ./uat-backup/backup-manifest.json"
```
| ลำดับ | สคริปต์ | dry-run | apply | ตรวจหลังทำ |
|---|---|---|---|---|
| 4.1 | Equipment Model Master — 6 รุ่นตัวอย่าง (ต้นทุนมาตรฐาน 2,000 อนุมัติตามการตัดสินใจเจ้าของ) | `npm run equipment-models -- seed --out out/` | `... seed --apply --out out/ $G` | รันซ้ำ = create 0 |
| 4.2 | ถ้ามีรุ่นตัวอย่างที่ seed ไว้ก่อนเป็น "ยังไม่อนุมัติ" | `npm run standard-cost:confirm-samples -- --out out/` | `... --apply --out out/ $G` | journal ใน out/ · rollback: `... --rollback <journal> $G` |
| 4.3 | จับคู่รุ่นเครื่องเดิม (D-07B A) | `npm run equipment-models -- map --out out/` → ทบทวน CSV | `... map --apply --out out/ $G` (เขียนเฉพาะ MATCHED) | ส่ง CSV AMBIGUOUS/CONFLICT/UNMAPPED ให้ลูกค้า (P-02) · rollback: `... rollback --backup out/map-journal-apply-*.jsonl --out out/ $G` |
| 4.4 | รายงานกระทบยอดหลัง migrate | `npm run standard-cost:reconcile -- --out out/reconcile-after` | — | เทียบกับ reconcile-before |
| 4.5 | บังคับเปลี่ยนรหัสผ่าน (Q-R3-04) | `npm run users:require-password-change -- --out out/` | `... --apply --revoke-sessions --out out/ $G` | **ทำหลังข้อ 7 (smoke)** — หลังรัน ทุกบัญชีต้องเปลี่ยนรหัสก่อนใช้ API |

ไม่มีการเปลี่ยนชื่อฟิลด์ในฐาน · ฟิลด์ใหม่เป็น optional · collection ใหม่สร้างเองเมื่อเริ่มระบบ (06)

## 5. Git — OWNER-MANAGED
เจ้าของโครงการ apply patch / commit / push / PR / merge ตามคู่มือส่งมอบ (HANDOVER) · หลัง merge บันทึก SHA ของ `main` ทั้งสอง repo

## 6. Deploy (หลัง merge และข้อ 1–4.4 ผ่าน)
- **Render** (`woms-backend/deploy/render.uat.yaml` เป็นค่าอ้างอิง — ใช้ service เดิม):
  - Build `npm ci --include=dev && npm run build` (ถ้าตั้ง `NODE_ENV=production` ต้องมี `--include=dev`) · Start `node dist/index.js` · Node 22
  - env: `MONGO_URI`, `MONGO_DB=woms`, `JWT_SECRET` (≥16 ตัว — production ค่า default/สั้นจะ **ไม่เริ่มทำงาน**), `CORS_ORIGIN=<URL Vercel>`, `TRUST_PROXY_HOPS` (Render = 1 — ยืนยัน), `DATA_SOURCE=mongo`
  - deploy commit `main` ที่บันทึกไว้ · `GET /health` → `{ ok: true, commit: "<SHA>" }` ต้องตรง
- **Vercel** (`woms-frontend/deploy/VERCEL_UAT.md`): `NEXT_PUBLIC_API_BASE=<URL Render>` · production branch `main` · `GET /api/version` → commit ต้องตรง

## 7. Post-deploy QA (ก่อนข้อ 4.5)
```
UAT_API=<render url> UAT_WEB=<vercel url> UAT_EXPECT_SHA=<backend main sha> UAT_EXPECT_WEB_SHA=<frontend main sha> \
UAT_USERS='{"manager":["…","…"],"admin":[…],"acc":[…],"sales":[…],"tech":[…],"ceo":[…],"viewer":[…]}' \
node $Q/uat-smoke.mjs uat-smoke.json
```
อ่านอย่างเดียว (ไม่สร้างข้อมูลธุรกิจ) · ต้องมีบัญชีครบ 7 บทบาท · ตรวจ commit, CORS, สิทธิ์อ่านรายบทบาท, ต้นทุนอะไหล่/ต้นทุนมาตรฐาน/Activity Log ไม่หลุด
จากนั้นทดสอบด้วยมือตาม 11 (UAT-19..36) · บันทึกผล + SHA ลง 08

## 8. เงื่อนไขหยุด / rollback
preflight ERROR · backup/restore ไม่ผ่าน · dry-run จำนวนผิดคาด · build ล้ม · `/health` หรือ `/api/version` commit ไม่ตรง · smoke ล้มในข้อสิทธิ์/ต้นทุน/การเงิน → หยุด
rollback: redeploy commit ก่อนหน้าใน Render/Vercel · rollback สคริปต์ด้วย journal · ข้อมูลเสีย → restore จากไฟล์ backup ข้อ 3 (ใช้สคริปต์เดียวกันกลับทาง — ปรึกษาผู้ดูแลฐานก่อน ห้าม restore ทับฐาน UAT โดยไม่มีการอนุมัติ)

## 9. รายงานการเงินที่ยังไม่ยืนยัน
รายรับติดตั้ง/กำไรรายเครื่องแสดงสถานะ "ยังไม่ยืนยันราคาค่าติดตั้ง (ADV3-01)" — ใน UAT ห้ามใช้ตัวเลขเหล่านี้เป็นผลตรวจรับทางการเงินจนกว่าเจ้าของ/ลูกค้ายืนยันแหล่งและกติกาอนุมัติค่าติดตั้ง (10 P-01) · ถ้าต้องการ UAT แบบจำกัดขอบเขต (ไม่ตรวจรายงานการเงินส่วนนี้) ต้องได้รับอนุมัติจากเจ้าของก่อน
