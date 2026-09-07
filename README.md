# WOMS Frontend — ระบบเปิด/ปิดงานภาคสนาม

หน้าเว็บสำหรับเปิด/ดู/แก้/ปิดงาน (ติดตั้ง · PM · CM · PM+CM · ซ่อมถอน) + ปฏิทินแยกตามทีมช่าง
เป็น repo อิสระ ต้องใช้คู่กับ API (`woms-backend`) — เชื่อมผ่าน `NEXT_PUBLIC_API_BASE`

**Stack:** Next.js (App Router) + TypeScript + React
**Port:** `3000`

---

## ติดตั้งและรัน

> ต้องมี `woms-backend` รันอยู่ก่อน (ดีฟอลต์ `http://localhost:8000`)

```bash
cp .env.local.example .env.local      # ตั้ง NEXT_PUBLIC_API_BASE ให้ชี้ไป backend
npm install
npm run dev                            # http://localhost:3000
npm run build                          # production build
npm run typecheck
```

`.env.local`:
```
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

## หน้าเว็บ
- `/jobs` — รายการงาน + filter (สถานะ / ทีม / ค้นหา)
- `/jobs/new` — เปิดงาน (ฟอร์ม pattern เดียว, ประเภทงานเป็น dropdown, "ซ่อมถอน" โผล่ตัวเลือกย่อย)
- `/jobs/[id]` — รายละเอียด + แก้ไข inline + ปิดงาน (กันแก้ทับกันด้วย `updatedAt`, ชนกันแจ้งให้รีเฟรช)
- `/calendar` — ปฏิทิน resource board รายสัปดาห์ แยก lane ตามทีมช่าง คลิก event → ไปหน้างาน

## โครงสร้าง
```
src/
├── app/
│   ├── layout.tsx        Nav + shell
│   ├── jobs/page.tsx     list + filter
│   ├── jobs/new/page.tsx เปิดงาน
│   ├── jobs/[id]/page.tsx detail + inline edit + close
│   ├── calendar/page.tsx resource board
│   └── globals.css       design system (ops console)
├── components/           JobForm (ใช้ซ้ำ create/edit), Nav, StatusBadge
└── lib/                  api client, types, label maps
```

## หมายเหตุ
- `JobForm` เป็น "pattern เดียว" ใช้ทั้งหน้าเปิดงานและหน้าแก้ไข (ตาม Spec R1)
- ดึง dropdown (ประเภทงาน / ทีม / รุ่น) จาก `GET /api/meta/options` — ถ้าทีม/รุ่นในแท็บ Meta ว่าง จะให้พิมพ์เองได้
- ทุก state เก็บใน React (ไม่ใช้ localStorage)

## หน้าใหม่ในระบบ

| เส้นทาง | ใช้ทำอะไร |
|---|---|
| `/documents` · `/documents/new` · `/documents/[id]` | เอกสารการขาย — ออกใบเสร็จ/ใบกำกับภาษี/ใบส่งของ, ยกเลิก (void), ออกใบลดหนี้ และหน้าพิมพ์ |
| `/queue` | คิวจัดส่ง/ซ่อมทั้งหมด พร้อมสถานะและลิงก์ติดตาม |
| `/queue/new` | จองคิว — กรอกหน้างานแล้วให้ระบบแนะนำคิวที่เร็วและคุ้มเส้นทางที่สุด |
| `/queue/slots` | ตาราง slot ของช่าง (ช่างจัดการของตัวเอง, ผู้จัดการจัดการของทุกคน) |
| `/tracking` | ตำแหน่งช่างล่าสุด + ETA ของคิววันนี้ (รีเฟรชอัตโนมัติทุก 30 วินาที) |
| `/m` | **โหมดมือถือช่าง (PWA)** — คิววันนี้, เปิด/ปิดงาน, แชร์ตำแหน่ง |
| `/m/booking/[id]` | รายละเอียดคิว: อัปเดตสถานะ, นำทาง, ตรวจว่าเครื่องอยู่ตามที่อยู่ในสัญญา |
| `/m/job/[id]` · `/m/job/new` | ปิดงานพร้อมลายเซ็น/รูป และเปิดงานใหม่จากหน้างาน |
| `/equipment/[id]` | เพิ่มส่วนประวัติเครื่องและปุ่มย้ายเครื่อง (บันทึกประวัติอัตโนมัติ) |

### ติดตั้งเป็นแอปบนมือถือ (ไม่ต้องเปิดผ่านเบราว์เซอร์)
เปิด `/m` บนมือถือ → เมนูเบราว์เซอร์ → **เพิ่มไปยังหน้าจอโฮม** → เปิดใช้งานแบบเต็มจอเหมือนแอป
service worker แคชหน้าไว้ให้เปิดได้แม้สัญญาณไม่ดี และ manifest มี shortcut ไป “งานของฉัน / เปิดงาน / คิวงาน”
ช่างต้องกด **เปิด** ที่การ์ด “แชร์ตำแหน่งให้ออฟฟิศ” ครั้งแรกและอนุญาตตำแหน่ง ระบบจึงจะคำนวณ ETA ได้
