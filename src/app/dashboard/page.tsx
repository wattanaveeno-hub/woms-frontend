"use client";

// หน้าหลัก (ENTECH design Main.dc.html): ทักทาย + KPI 4 ช่อง + "ต้องจัดการตอนนี้" + ทีมช่างวันนี้ เท่านั้น
// UAT R2 Phase 2: สรุปภาพรวม กราฟ งานบำรุงรักษา และ "สรุปผล" (ตัวกรอง + Export Excel) ย้ายไปหน้า /reports
//   ข้อมูล สิทธิ์ และลิงก์เหมือนเดิม — เข้าจากปุ่ม "รายงาน & ส่งออก" บนหัวหน้านี้
import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@mui/material/Button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import DashboardActionBoard from "@/components/DashboardActionBoard";
import type { Contract, EquipmentDashboard, JobDashboard, JobListItem } from "@/lib/types";
import { FEATURES } from "@/lib/features";
import { dashboardFetchPlan } from "@/lib/fetchGuards";
import { WomsLoadingState } from "@/components/woms";

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const { status, has } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [jobs, setJobs] = useState<JobListItem[] | null>(null);
  const [equipDash, setEquipDash] = useState<EquipmentDashboard | null>(null);
  const [jobDash, setJobDash] = useState<JobDashboard | null>(null);

  useEffect(() => {
    if (status !== "authed") return;
    let active = true;
    (async () => {
      // FE-02 (O-01): เรียกเฉพาะ endpoint ที่บทบาทมีสิทธิ์ (แผนเดียวกับหน้ารายงาน)
      const plan = dashboardFetchPlan(has, FEATURES);
      const skip = Promise.resolve(null);
      const [c, j, ed, jd] = await Promise.all([
        plan.contracts ? safe(api.listContracts({})) : skip,
        plan.jobs ? safe(api.listJobs({})) : skip,
        plan.equipmentDashboard ? safe(api.dashboardEquipment()) : skip,
        plan.jobDashboard ? safe(api.dashboardJobs()) : skip,
      ]);
      if (!active) return;
      setContracts(c ? c.items : null);
      setJobs(j ? j.jobs : null);
      setEquipDash(ed);
      setJobDash(jd);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [status, has]);

  if (status !== "authed") return null;
  if (loading) return <WomsLoadingState rows={4} />;
  return (
    <DashboardActionBoard
      jobs={jobs}
      jobDash={jobDash}
      equipDash={equipDash}
      contracts={contracts}
      actions={
        <Button component={Link} href="/reports" variant="outlined" data-testid="dashboard-reports-link">
          รายงาน &amp; ส่งออก
        </Button>
      }
    />
  );
}
