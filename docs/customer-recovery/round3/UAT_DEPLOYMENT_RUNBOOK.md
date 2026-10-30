# UAT Deployment Runbook (Round 3 — final)

เอกสารนี้ใช้กับ **ฐาน UAT (MongoDB Atlas, DB `woms`) + Render (backend) + Vercel (frontend)** ตาม directive 30 ต.ค. 69: `main` = สาย deploy UAT · ยังไม่มี production · ไม่สร้าง release tag

> ทำไมต้องมีเอกสารนี้: session ที่พัฒนาและทดสอบงานนี้ **เข้าไม่ถึง** GitHub (ยังไม่เชื่อมบัญชี), Render, Vercel และ MongoDB Atlas (network allowlist) — ขั้นตอนด้านล่างจึงต้องรันจากเครื่อง/บัญชีที่เข้าถึงได้ ทุกขั้นมีคำสั่งตรวจผลและเงื่อนไขหยุด

## 0. ก่อนเริ่ม
- เครื่องที่ใช้: มี Node 22, git, MongoDB Database Tools (`mongodump`, `mongorestore`), เข้าถึง Atlas ได้ (IP อยู่ใน Atlas Network Access)
- โค้ด: branch `fix/customer-recovery-round3` ทั้งสอง repo (SHA ใน 08) · repo ในเครื่องต้องไม่มีงานค้างที่ยังไม่ commit นอกจาก `check-integrity-prod.bat` (ห้ามแก้/ห้าม commit ไฟล์นี้)
- ตัวแปร: `export MONGO_URI='<Atlas URI ของ UAT>' MONGO_DB=woms` (อย่าวาง URI ลงเอกสาร/แชท)

## 1. ยืนยันเป้าหมาย (หยุดถ้าไม่ตรง)
```
node -e "const u=process.env.MONGO_URI;console.log(u.replace(/\/\/[^@]*@/,'//<redacted>@'))"   # ต้องเป็น cluster UAT
```
ยืนยันกับเจ้าของระบบว่า cluster/DB นี้คือ UAT ไม่ใช่ production

## 2. Preflight อ่านอย่างเดียว
ใช้ผู้ใช้ Atlas ที่มีสิทธิ์ `read` เท่านั้น
```
cd qa/customer-recovery-round3        # ในเครื่องต้องวางโฟลเดอร์นี้ข้าง woms-backend ให้ path ../woms-backend ใช้ได้ (ดู 08 หัวข้อ 5)
node preflight-readonly.mjs "$MONGO_URI_READONLY" woms preflight-uat.json
node preflight-proof.mjs woms preflight-uat-proof.json        # ต้องได้ identical: true (ต้องตั้ง URI ในสคริปต์ให้ชี้ UAT ด้วยผู้ใช้ read)
```
เก็บ JSON ทั้งสองไฟล์ไว้เป็นหลักฐาน · ทบทวน PF-R3-01 (งานติดตั้งเปิดค้างไม่มีวันติดตั้ง), PF-01 (กลุ่มแชทซ้ำ)

## 3. Backup + ทดสอบ restore (หยุดถ้า restore ไม่ผ่าน)
```
mongodump --uri "$MONGO_URI" --db woms --archive=woms-uat-$(date +%Y%m%d-%H%M).archive.gz --gzip
mongorestore --uri "<URI ของ cluster/DB แยกสำหรับทดสอบ เช่น woms_restore_test>" --archive=<ไฟล์> --gzip --nsFrom='woms.*' --nsTo='woms_restore_test.*'
```
ตรวจจำนวนเอกสารทุก collection ของ `woms` เทียบ `woms_restore_test` ให้ตรงกัน แล้วเขียน manifest:
```json
{ "db": "woms", "host": "<โดเมน cluster เช่น 4myjzc7.mongodb.net>", "backupAt": "<ISO เวลา backup>",
  "location": "<ที่เก็บไฟล์ backup>", "restoreTestedAt": "<ISO>", "restoreTestedBy": "<ชื่อ>" }
```
สคริปต์เขียนข้อมูลทุกตัวจะปฏิเสธถ้า manifest เก่ากว่า 24 ชม. หรือไม่ยืนยัน restore

## 4. Migration (dry-run ก่อนเสมอ)
ตัวเลือกเป้าหมาย UAT ที่ทุกสคริปต์ใช้: `--target uat --confirm-db woms --confirm-host <โดเมน cluster> --backup-manifest manifest.json`

| ลำดับ | สคริปต์ | dry-run | apply |
|---|---|---|---|
| 4.1 | Equipment Model Master seed (D-07A) | `npm run equipment-models -- seed --out out/` | เพิ่ม `--apply <ตัวเลือก UAT>` — ราคาตัวอย่าง 2,000 ถูกบันทึกเป็น "ยังไม่อนุมัติเป็นค่าติดตั้ง" (ดู 10/ADV3-01) |
| 4.2 | Mapping เครื่องเดิม (D-07B Option A) | `npm run equipment-models -- map --out out/` → ทบทวน CSV: MATCHED / AMBIGUOUS / CONFLICT / UNMAPPED | `map --apply <ตัวเลือก UAT>` เขียนเฉพาะ MATCHED · AMBIGUOUS/CONFLICT ไม่แตะ · เก็บ `map-backup-apply-*.json` และ `map-journal-*.jsonl` |
| 4.3 | บังคับเปลี่ยนรหัสผ่าน (Q-R3-04) | `npm run users:require-password-change -- --out out/` | `--apply --revoke-sessions <ตัวเลือก UAT>` — ทำ **หลัง** deploy backend ใหม่ (ตัวเดิมไม่รู้จัก flag นี้ทุกหน้า) |
| 4.4 | สคริปต์ของ D-11 / ราคา / Activity Log (ถ้ามี) | ดู 06 / 09 | ตามตาราง 09 |
Rollback mapping: `npm run equipment-models -- rollback --backup <map-journal-*.jsonl หรือ map-backup-apply-*.json> <ตัวเลือก UAT>` (คืนเฉพาะฟิลด์ที่สคริปต์เขียน · แถวที่ถูกแก้ภายหลัง = CONFLICT ไม่แตะ)

## 5. Git
งานล่าสุดถูกส่งเข้า repo ในเครื่องเป็น branch `fix/customer-recovery-round3-final` (ไม่แตะ branch ที่ checkout อยู่) · SHA ต้องตรงกับ 08 (backend `05b4c94` + commit เอกสาร, frontend `2d9c35f` + commit เอกสาร)
```
git fetch origin
git switch fix/customer-recovery-round3 && git merge --ff-only fix/customer-recovery-round3-final   # ต้อง fast-forward ได้ ถ้าไม่ได้ให้หยุดแล้วตรวจ
git push -u origin fix/customer-recovery-round3                                                    # ไม่ใช้ --force
git switch main && git pull --ff-only && git merge --no-ff fix/customer-recovery-round3 && git push origin main
```
ณ 30 ต.ค. 69 `origin/main` ที่ fetch ล่าสุด (27 ต.ค.: backend `611ee4d`, frontend `af8afe4`) เป็นบรรพบุรุษของ branch แก้ไข → merge ไม่มี conflict ถ้า `main` บน GitHub ไม่เปลี่ยน
ถ้า branch protection บังคับ PR + reviewer ให้เปิด PR แทนและรอ reviewer จริง (ห้าม bypass) · ไม่สร้าง release tag

## 6. Deploy
- Render: ตรวจว่า service ผูก repo `woms-backend` branch `main` · env ครบ (`MONGO_URI`, `MONGO_DB=woms`, `JWT_SECRET`, `CORS_ORIGIN=<URL Vercel>`, `TRUST_PROXY_HOPS` = จำนวน proxy หน้า API ของ Render (ค่าเริ่มต้น 1 — ยืนยันก่อน) ฯลฯ) · deploy commit `main` ล่าสุด · ดู build/runtime log · `GET /health` = 200
- Vercel: project ผูก `woms-frontend` branch `main` · `NEXT_PUBLIC_API_BASE=<URL Render>` · build log ไม่มี error · เปิด `/login`

## 7. Post-deploy QA
```
UAT_API=<render url> UAT_WEB=<vercel url> UAT_EXPECT_SHA=<sha main backend> UAT_USERS='{"manager":["…","…"],…}' node uat-smoke.mjs uat-smoke.json
```
แล้วทดสอบด้วยมือตาม 11 (UAT-19..28 + การเงิน FIN-01..12 บนหน้าจอ) · บันทึกผลและ SHA ที่ deploy ลง 08

## 8. เงื่อนไขหยุด
preflight ERROR · restore ไม่ผ่าน · dry-run มีจำนวนผิดคาด · build ล้ม · smoke ล้มในข้อสิทธิ์/ต้นทุน/การเงิน → หยุด deploy ส่วนนั้น และ rollback (redeploy commit ก่อนหน้าใน Render/Vercel · `mongorestore` จาก backup ข้อ 3 ถ้าข้อมูลเสีย)
