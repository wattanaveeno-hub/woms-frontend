# คู่มือส่งมอบ WOMS Round 3 — Release Closure (สำหรับเจ้าของโครงการ)

สถานะ: **CODE READY FOR OWNER MERGE** · **NOT READY FOR UAT** (ADV3-01 + ยังไม่ deploy) · Git = **OWNER-MANAGED** (ไม่มี commit/push/PR/merge จากฝั่งเรา)

## 1. ของที่ส่งมอบ
| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `woms-backend-release-closure.patch` | การเปลี่ยนแปลงโค้ด backend ทั้งหมด (text) เทียบ `70ecea7` |
| `woms-frontend-release-closure.patch` | การเปลี่ยนแปลงโค้ด frontend ทั้งหมด (text) เทียบ `2c922a1` |
| `woms-backend-docs-evidence.tar.gz` | เอกสาร `docs/customer-recovery/round3/` + หลักฐาน (final-run-14..17, รีวิว R11–R13, ซ้อม UAT, backup QA) + สคริปต์ `qa/customer-recovery-round3/` — แตกที่รากของ repo · ไม่รวมไฟล์ dump ฐาน QA |
| `woms-frontend-docs.tar.gz` | เอกสาร `docs/customer-recovery/round3/` ของ frontend |
| `CHANGED_FILES.txt` | รายชื่อไฟล์ + sha256 ทุกไฟล์ที่เปลี่ยน/เพิ่ม |
| `tree-fingerprint-owner.sh` | ตรวจว่าโค้ดหลัง apply ตรงกับที่ทดสอบ (ทนต่อ CRLF บน Windows · ใช้ git อ่านอย่างเดียว) |

ลายนิ้วมือโค้ดที่ทดสอบ (`tree-fingerprint-owner.sh` · ไม่รวม docs/ และ qa/) — ตรวจแล้วว่า apply patch บน clone ใหม่ได้ค่าเดียวกัน: backend `b5c2b2114a7f4f02a08e1d0989bedc10f87893a1b10d93179db4fe6232b08a1d` · frontend `6992aef2d2e48b924dc8828c8bac5db89bfb8caa0d2e88d643f565a9e062d201`

## 2. ไฟล์ที่เปลี่ยน
ดู `CHANGED_FILES.txt` และ 06 (แยกตามเรื่อง) · สรุป: backend 52 ไฟล์ (+ไฟล์ใหม่ 7) · frontend 31 ไฟล์ (+ไฟล์ใหม่ 2)

## 3. Apply และตรวจ (ทำในเครื่องที่มี repo)
ตรวจแล้ว (อ่านอย่างเดียว) ว่าเครื่องเจ้าของมี branch `fix/customer-recovery-round3-final` ชี้ `70ecea7` (backend) และ `2c922a1` (frontend) ตรงกับฐานของ patch
working tree ปัจจุบันของทั้งสอง repo มีไฟล์ที่ต่างแค่ปลายบรรทัด (CRLF) และ `check-integrity-prod.bat` ที่แก้ไว้ — แนะนำ apply ใน **worktree แยก** เพื่อไม่ต้องแตะไฟล์เหล่านั้น:
```
# backend
cd woms-backend
git worktree add ../woms-backend-rc fix/customer-recovery-round3-final     # ได้ 70ecea7 ในโฟลเดอร์ใหม่
cd ../woms-backend-rc
git apply --check <path>/woms-backend-release-closure.patch && git apply <path>/woms-backend-release-closure.patch
tar xzf <path>/woms-backend-docs-evidence.tar.gz                          # docs/ + qa/ ของ round 3
bash qa/customer-recovery-round3/tree-fingerprint-owner.sh .
#   ต้องได้: 70ecea71a92b407b675c72737550c0855c54d820 fingerprint-owner=b5c2b2114a7f4f02a08e1d0989bedc10f87893a1b10d93179db4fe6232b08a1d
npm ci && npx tsc --noEmit -p . && npx vitest run     # ไม่มี MongoDB replica set → integration ข้าม 18 ข้อ (คาดไว้)

# frontend
cd ../woms-frontend
git worktree add ../woms-frontend-rc fix/customer-recovery-round3-final    # ได้ 2c922a1
cd ../woms-frontend-rc
git apply --check <path>/woms-frontend-release-closure.patch && git apply <path>/woms-frontend-release-closure.patch
tar xzf <path>/woms-frontend-docs.tar.gz
bash ../woms-backend-rc/qa/customer-recovery-round3/tree-fingerprint-owner.sh .
#   ต้องได้: 2c922a1e0e86d1f8bfbb2ec2b82f7dd3ddb1903f fingerprint-owner=6992aef2d2e48b924dc8828c8bac5db89bfb8caa0d2e88d643f565a9e062d201
npm ci && npm run typecheck && npm test && npm run lint
```
ถ้าลายนิ้วมือไม่ตรง = โค้ดไม่ใช่ชุดที่ทดสอบ → อย่า commit แจ้งกลับ · บน Windows ให้รันใน Git Bash
(ทางเลือก: ทำใน repo เดิม — ต้อง `git stash` ไฟล์ปลายบรรทัดก่อน `git switch` · ห้าม stash/commit `check-integrity-prod.bat` ปนกับงานนี้)

## 4. Git (เจ้าของทำ)
```
# ใน woms-backend-rc / woms-frontend-rc
git add -A && git commit -m "<ข้อความของคุณ>"
git push -u origin fix/customer-recovery-round3-final:fix/customer-recovery-round3-release-closure   # ชื่อ branch ใหม่ (ไม่ทับ branch เดิมบน remote) — ไม่ใช้ --force
# PR → review ตาม branch protection → merge เข้า main (ทั้งสอง repo) · ไม่สร้าง release tag
```
PR จะมี commit ของ Round 3 ที่ยังไม่อยู่บน `main` (backend 66 + 1, frontend 45 + 1 เทียบ `main` ตามที่ repo ในเครื่องนี้เห็น — ตรวจกับ GitHub อีกครั้ง)
บันทึก SHA ของ `main` หลัง merge ทั้งสอง repo — ใช้ตรวจหลัง deploy

## 5. ฐานข้อมูล + Deploy + Smoke
ทำตาม `UAT_DEPLOYMENT_RUNBOOK.md` ข้อ 1–8 (ซ้อมทั้งชุดบนฐาน QA แล้ว — 08) · จุดสำคัญ:
- backup ต้องได้ `backup-manifest.json` ก่อน apply สคริปต์ใด ๆ
- Render: `JWT_SECRET` ≥ 32 ตัว (production ไม่เริ่มถ้าไม่ปลอดภัย) · build `npm ci --include=dev && npm run build` · `/health` → commit ตรง
- Vercel: `NEXT_PUBLIC_API_BASE` · `/api/version` → commit ตรง
- `uat-smoke.mjs` ต้องใส่ `UAT_EXPECT_SHA` และ `UAT_EXPECT_WEB_SHA` และบัญชีครบ 7 บทบาท
- บังคับเปลี่ยนรหัสผ่าน (Q-R3-04) ทำหลัง smoke

## 6. ผลทดสอบ (QA environment — ไม่ใช่ UAT)
รอบอ้างอิง **final-run-17** (`evidence/final-run-17/`, VERDICT allPass=true) บนโค้ดลายนิ้วมือเดียวกับที่ส่งมอบ:
| ส่วน | ผล |
|---|---|
| Backend typecheck / build | ผ่าน |
| Backend unit (vitest) | 1,652 ผ่าน · 19 ข้าม (คาดไว้) · ล้ม 0 |
| Backend integration ฐานจริง (MongoDB replica set) | 18/18 |
| Frontend typecheck / unit (+ TZ) / build / ESLint | ผ่าน · unit 161/161 · ESLint 0 |
| API + Security + Browser (Playwright Chromium) | 20 ชุด · 255 scenarios · 2,537 checks · ล้ม 0 |
| race-d17 (ยกเลิกเอกสารพร้อมกัน 40 รอบ) | badLinkedCancelled 0 |
| ซ้อมขั้นตอน UAT บนฐาน QA (`evidence/uat-rehearsal-final/`) | PASS · map MATCHED 3 / CONFLICT 1 / UNMAPPED 51 / NO_MODEL 1 · smoke 69 checks ล้ม 0 · ไม่มี collection จำนวนลดลง |
| รีวิวอิสระ R11-A/R11-B + retest R12/R13 | High ใหม่ 1 + Medium 9 ปิดแล้ว · เหลือ Low/Info (ข้อ 7) |

รอบก่อนหน้า final-run-14..16 ไม่ใช้เป็นหลักฐาน (สาเหตุใน 08) · **ยังไม่มีผลบน UAT จริง** (Atlas/Render/Vercel ไม่ได้เข้าถึงจากที่นี่)

## 7. ความเสี่ยง/เรื่องค้าง
- **ADV3-01 (High):** แหล่ง/ค่า/กติกาอนุมัติค่าติดตั้งยังไม่ยืนยัน — รายรับติดตั้ง/กำไรรายเครื่องเป็นตัวเลข "ยังไม่ยืนยัน" ห้ามใช้เป็นผลตรวจรับทางการเงิน (10 R-01)
- Low/Info ที่เปิด: ADV13-01/02 (ต้นทุนอะไหล่เป็น 0 ทางอ้อมผ่านคำขอแก้หลังปิดงาน — Manager เห็นใน diff ก่อนอนุมัติ), ADV12-07, ADV13-03..05, UX-R3-02 (05)
- ทะเบียนความเสี่ยงเต็ม: 12

## 8. Rollback
- โค้ด: redeploy commit ก่อนหน้าใน Render/Vercel (ไม่ต้อง revert git ถ้ายังไม่ merge)
- ข้อมูล: rollback สคริปต์ด้วย journal (`--rollback`) · ข้อมูลเสียหาย → restore จากไฟล์ backup (ปรึกษาผู้ดูแลฐานก่อน)
