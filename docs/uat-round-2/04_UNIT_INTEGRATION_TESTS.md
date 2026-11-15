# 04 — Unit / Integration Tests

| Suite | Baseline (ก่อนแก้) | หลังแก้ | ผล |
|---|---|---|---|
| Backend vitest (fakeMongo) | 171 files · 2289 passed · 242 skipped | 176 files · 2306 passed · 242 skipped · 0 failed | PASS — ไม่มี test เดิมล้ม/ถูกข้าม |
| Backend `tsc --noEmit` | ผ่าน | ผ่าน (sandbox + เครื่อง Owner) | PASS |
| Frontend `npm test` (node --test) | 320 pass | 325 pass · 0 fail | PASS |
| Frontend `tsc --noEmit` | ผ่าน | ผ่าน (sandbox + เครื่อง Owner) | PASS |
| Frontend `next build` | ผ่าน | ผ่าน | PASS |
| `next lint` ไฟล์ที่แก้ | — | 1 warning เดิม (users/page exhaustive-deps ที่มีก่อนแล้ว) | PASS |

Test ใหม่
| ไฟล์ | ครอบคลุม |
|---|---|
| `uatR2_phoneLogin.test.ts` (4) | login ด้วยเบอร์ · เบอร์ผิดรหัส 401 · เบอร์ซ้ำหลายบัญชี AMBIGUOUS · ห้ามตั้งเบอร์ซ้ำ 409 |
| `uatR2_modelImport.test.ts` (4) | dry-run ไม่บันทึก · VALID/DUPLICATE/INVALID · สิทธิ์ · ชื่อชวนสับสนถูกปฏิเสธ |
| `uatR2_chatSearchSender.fake.test.ts` (2) | ค้นด้วยชื่อผู้ส่ง · ข้อความที่ยกเลิกไม่ถูกค้นพบ |
| `uatR2_pickerAvailable.test.ts` (3) | availableOnly ไม่แสดงเครื่องเช่า · รุ่น count 0 ไม่แสดง · โหมดปกติเหมือนเดิม |
| `uatR2_queueSitePhotos.test.ts` (3) | แนบ/รายการ/เปิดรูป + audit · ไม่ใช่รูป/เกิน 10 รูป ถูกปฏิเสธ · คนที่มองไม่เห็นคิว/ช่าง แนบไม่ได้ |
| `scripts/availabilityRules.test.ts` (3) | นับนัดที่มีผล (ไม่นับพักงาน/ยุติ/ซ้ำ) |
| `scripts/uatR2Rules.test.ts` (3) | holdKind แยกเลื่อนวันเข้า/พักงาน · jnLabel |

Log: `Claude outputs/uat-round-2/logs/`
