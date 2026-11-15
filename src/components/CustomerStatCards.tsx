"use client";

// ENTECH design (CustomerDetail.dc.html): การ์ดสรุป 4 ช่อง — เครื่อง · ยอดค้างชำระ · PM ถัดไป · งานเปิดอยู่
// ทุกตัวเลขอ่านจาก API ที่มีอยู่ (ไม่มี endpoint ใหม่) และเรียกเฉพาะเมื่อบทบาทมีสิทธิ์ (ไม่มีสิทธิ์ = ไม่แสดงการ์ดนั้น)
//   ยอดค้างชำระ = ผลรวม overdueAmount ของสัญญาลูกค้ารายนี้ (กติกาเดียวกับ Dashboard · DEF-02)
//   PM ถัดไป    = เครื่องที่ pmDaysLeft น้อยที่สุด (backend คำนวณ)
//   งานเปิดอยู่  = GET /api/jobs?status=OPEN (ขอบเขตตามสิทธิ์ของ backend) แล้วนับเฉพาะ customerId ของลูกค้ารายนี้
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { dashboardContractMoney } from "@/lib/contractRules";
import { WomsStatCard, WomsStatGrid } from "@/components/woms";

const fmtMoney = (n: number) => `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;

export default function CustomerStatCards({ partnerId, equipmentCount }: { partnerId: string; equipmentCount: number | null }) {
  const { has } = useAuth();
  const [money, setMoney] = useState<{ overdue: number; overdueContracts: number; contracts: number } | null>(null);
  const [pm, setPm] = useState<{ days: number; serial: string } | null | "none">(null);
  const [jobs, setJobs] = useState<{ total: number; first?: string } | null>(null);
  const canContracts = has("contracts:view");
  const canEquipment = has("equipment:view");
  const canJobs = has("jobs:view");

  useEffect(() => {
    let alive = true;
    if (canContracts)
      api
        .listContracts({ partnerId })
        .then((r) => {
          if (!alive) return;
          const m = dashboardContractMoney(r.items);
          setMoney({ overdue: m.overdueAmount, overdueContracts: r.items.filter((c) => (c.overdueAmount ?? 0) > 0).length, contracts: r.items.length });
        })
        .catch(() => alive && setMoney(null));
    if (canEquipment)
      api
        .partnerEquipment(partnerId)
        .then((r) => {
          if (!alive) return;
          const withPm = r.items.filter((e) => e.nextPmDate && typeof e.pmDaysLeft === "number");
          if (!withPm.length) return setPm("none");
          const next = withPm.reduce((a, b) => (b.pmDaysLeft < a.pmDaysLeft ? b : a));
          setPm({ days: next.pmDaysLeft, serial: next.serial });
        })
        .catch(() => alive && setPm(null));
    if (canJobs)
      api
        .listJobs({ status: "OPEN", sort: "appointment" })
        .then((r) => {
          if (!alive) return;
          const mine = r.jobs.filter((j) => j.customerId === partnerId);
          setJobs({ total: mine.length, first: mine[0] ? `${mine[0].jobName}${mine[0].jobDate ? ` · ${mine[0].jobDate}` : ""}` : undefined });
        })
        .catch(() => alive && setJobs(null));
    return () => {
      alive = false;
    };
  }, [partnerId, canContracts, canEquipment, canJobs]);

  return (
    <WomsStatGrid max={4}>
      <WomsStatCard value={equipmentCount ?? "–"} label="เครื่อง" hint="ที่ผูกกับลูกค้ารายนี้" />
      {canContracts && money ? (
        <WomsStatCard
          value={fmtMoney(money.overdue)}
          label="ยอดค้างชำระ"
          hint={money.overdue > 0 ? `งวดเลยกำหนด · ${money.overdueContracts} สัญญา` : `ไม่มีงวดค้าง · ${money.contracts} สัญญา`}
          tone={money.overdue > 0 ? "error" : "neutral"}
        />
      ) : null}
      {canEquipment && pm ? (
        <WomsStatCard
          value={pm === "none" ? "—" : pm.days < 0 ? `เกิน ${-pm.days} วัน` : pm.days === 0 ? "วันนี้" : `อีก ${pm.days} วัน`}
          label="PM ถัดไป"
          hint={pm === "none" ? "ยังไม่มีรอบ PM" : pm.serial}
          tone={pm !== "none" && pm.days < 0 ? "error" : "neutral"}
        />
      ) : null}
      {canJobs && jobs ? (
        <WomsStatCard
          value={jobs.total}
          label="งานเปิดอยู่"
          hint={jobs.first || "ไม่มีงานเปิด"}
          tone={jobs.total > 0 ? "warning" : "neutral"}
        />
      ) : null}
    </WomsStatGrid>
  );
}
