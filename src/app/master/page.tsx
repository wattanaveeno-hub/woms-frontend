"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { masterLabel } from "@/lib/options";
import type { MasterKind } from "@/lib/types";
import { WomsPageHeader, WomsPermissionGate } from "@/components/woms";

// รายการข้อมูลพื้นฐาน (salesperson เพิ่มตาม Job Opening mockup SCR-JOB-001)
const KINDS: { kind: MasterKind; desc: string }[] = [
  { kind: "team", desc: "จัดการรายชื่อทีมช่างที่ใช้ในการเปิดงาน" },
  { kind: "model", desc: "รุ่นเครื่อง + Model Index (ประเภทเครื่อง / ราคาค่าติดตั้ง-บริการมาตรฐาน)" },
  { kind: "zone", desc: "จัดการโซนบริการ — ใช้จับคู่ช่างกับพื้นที่และจัดคิวจัดส่ง/ซ่อม" },
  { kind: "category", desc: "หมวดหมู่เครื่อง — dropdown ในหน้ารับเครื่องเข้าคลัง" },
  { kind: "warehouse", desc: "คลังจัดเก็บ — dropdown ระบุว่าเครื่องอยู่คลังไหน" },
  // SCR-JOB-001 "เซลล์ผู้รับผิดชอบ *" เป็นรายการให้เลือกในหน้าเปิดงาน
  { kind: "salesperson", desc: "รายชื่อเซลล์ผู้รับผิดชอบ — dropdown ในหน้าเปิดงาน" },
  // D-19: backend มี master kind นี้ (equipment.pmPackage) แต่เดิมไม่มีทางเข้าจากหน้าเว็บ (/master/pm_package → 404)
  { kind: "pm_package", desc: "ชื่อ Package PM — แสดงในแผน PM ของเครื่อง (จำนวนรอบ Package ตั้งจากใบงานติดตั้ง)" },
];

function MasterHub() {
  const entries = [
    ...KINDS.map((k) => ({ href: `/master/${k.kind}`, title: masterLabel[k.kind], desc: k.desc })),
    {
      href: "/master/warranty-presets",
      title: "โปรไฟล์ประกัน",
      desc: "ชุดประกันสำเร็จรูป (แบรนด์/ตัวแทน กี่เดือน) เลือกใช้ตอนรับเครื่องเข้าคลังได้ทันที",
    },
  ];
  return (
    <>
      <WomsPageHeader title="ข้อมูลพื้นฐาน" subtitle="รายการที่ใช้เป็นตัวเลือกในฟอร์มต่าง ๆ" />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 1.5 }}>
        {entries.map((e) => (
          <Card key={e.href}>
            <CardActionArea component={Link} href={e.href} sx={{ height: "100%" }}>
              <CardContent>
                <Typography sx={{ fontWeight: 700, color: "text.primary" }}>{e.title}</Typography>
                <Typography variant="body2">{e.desc}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </>
  );
}

export default function MasterHubPage() {
  return (
    <WomsPermissionGate anyOf={["master:manage", "master:view"]}>
      <MasterHub />
    </WomsPermissionGate>
  );
}
