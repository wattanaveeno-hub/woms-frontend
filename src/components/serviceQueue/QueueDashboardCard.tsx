"use client";

// QUEUE 04 — ตัวเลขคิวช่างบน Dashboard กดเข้าไปทำต่อได้
// Admin: รายการรอเปิดงานแยกจากคิวที่ยังไม่คอนเฟิร์ม · ช่าง: คิวที่ต้องตอบเด่นชัด · เซลล์: คิวของตนรอคอนเฟิร์ม
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/AuthContext";
import { FEATURES } from "@/lib/features";
import { WomsStatCard, WomsStatGrid } from "@/components/woms";
import { sqApi, type QueueSummary } from "@/lib/serviceQueueApi";
import { SUMMARY_BUCKETS } from "@/lib/serviceQueueRules";

export default function QueueDashboardCard() {
  const { has } = useAuth();
  const [s, setS] = useState<QueueSummary | null>(null);
  const can = FEATURES.serviceQueue && has("svcqueue:view");

  useEffect(() => {
    if (!can) return;
    let alive = true;
    const load = () => sqApi.summary().then((r) => alive && setS(r)).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [can]);

  if (!can || !s) return null;
  const isTech = has("svcqueue:respond") && !has("svcqueue:view_all");

  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        คิวช่าง
      </Typography>
      {isTech ? (
        <WomsStatGrid max={2}>
          <WomsStatCard value={s.myResponse} label="คิวที่ต้องตอบ" hint="เสนอวัน/แจ้งไม่รับ" tone={s.myResponse ? "error" : "neutral"} href="/service-queue?status=WAIT_TECH" />
          <WomsStatCard value={s.waitCustomer + s.readyToOpen} label="รอลูกค้า/รอเปิดงาน" tone="info" href="/service-queue" />
        </WomsStatGrid>
      ) : (
        <WomsStatGrid max={has("svcqueue:admin") ? 5 : 6}>
          {SUMMARY_BUCKETS.map((b) => (
            <WomsStatCard key={b.key} value={s[b.key]} label={b.label} tone={s[b.key] ? b.tone : "neutral"} href={`/service-queue?${b.query}`} />
          ))}
          {!has("svcqueue:admin") && has("svcqueue:request") ? (
            <WomsStatCard value={s.myToConfirm} label="คิวของฉันรอคอนเฟิร์ม" tone={s.myToConfirm ? "primary" : "neutral"} href="/service-queue?status=WAIT_CUSTOMER&mine=1" />
          ) : null}
        </WomsStatGrid>
      )}
    </Box>
  );
}
