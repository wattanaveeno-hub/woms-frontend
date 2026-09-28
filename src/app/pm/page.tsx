"use client";

// ---------------------------------------------------------------------------
// ระบบจัดการ PM — ตาราง PM รายเดือน
// ---------------------------------------------------------------------------
// PM-FN-001 "จัดทำตาราง PM รายเดือนแยกตามช่างหรือผู้รับผิดชอบได้"
// PM-FN-005 "แสดงตาราง PM ล่วงหน้าได้"  (เลือกเดือนล่วงหน้าได้จากช่องเดือน)
// ชีตหลัก   "ส่งตาราง PM ประจำเดือนให้ช่างได้ โดยให้ Admin เป็นคน Aprove"

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { AuthUser, PmCandidate, PmPlan } from "@/lib/types";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import {
  PmPlanStatusChip,
  WomsDataTable,
  WomsErrorState,
  WomsFormSection,
  WomsPageHeader,
  WomsStatusChip,
  type WomsColumn,
} from "@/components/woms";

function thisMonth(): string {
  const d = new Date();
  // ใช้เวลาไทยเพื่อให้ตรงกับฝั่งเซิร์ฟเวอร์เสมอ
  const bkk = new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60_000);
  return `${bkk.getFullYear()}-${String(bkk.getMonth() + 1).padStart(2, "0")}`;
}

export default function PmPage() {
  const { has } = useAuth();
  const toast = useToast();
  const canManage = has("pm:manage");

  const [month, setMonth] = useState(thisMonth());
  const [plans, setPlans] = useState<PmPlan[] | null>(null);
  const [candidates, setCandidates] = useState<PmCandidate[] | null>(null);
  const [techs, setTechs] = useState<AuthUser[]>([]);
  const [techId, setTechId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setPlans(null);
    try {
      const r = await api.listPmPlans({ month });
      setPlans(r.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดตาราง PM ไม่สำเร็จ");
      setPlans([]);
    }
    if (canManage) {
      try {
        const [c, t] = await Promise.all([api.pmCandidates({ month }), api.listTechnicians()]);
        setCandidates(c.items);
        setTechs(t.items);
      } catch {
        setCandidates([]);
      }
    }
  }, [month, canManage]);

  useEffect(() => {
    load();
  }, [load]);

  // เครื่องที่อยู่ในตารางของเดือนนี้แล้ว ไม่ควรถูกเลือกซ้ำ
  const alreadyPlanned = useMemo(() => {
    const s = new Set<string>();
    for (const p of plans ?? []) for (const it of p.items) if (it.equipmentId) s.add(it.equipmentId);
    return s;
  }, [plans]);

  const togglePage = (rows: PmCandidate[], all: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      rows.forEach((r) => (all ? next.add(r.equipmentId) : next.delete(r.equipmentId)));
      return next;
    });

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const createPlan = async () => {
    if (!techId) {
      toast.error("เลือกช่าง/ผู้รับผิดชอบก่อน");
      return;
    }
    setBusy(true);
    try {
      const plan = await api.createPmPlan({
        month,
        technicianId: techId,
        equipmentIds: [...picked],
      });
      toast.success(`สร้างตาราง PM เดือน ${plan.month} ของ ${plan.technicianName} แล้ว`);
      setPicked(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "สร้างตารางไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const planCols: WomsColumn<PmPlan>[] = [
    { key: "tech", label: "ผู้รับผิดชอบ", sortValue: (p) => p.technicianName, render: (p) => <Link href={`/pm/${p.id}`}>{p.technicianName}</Link> },
    { key: "team", label: "ทีม", sortValue: (p) => p.team || "", render: (p) => p.team || "-" },
    { key: "status", label: "สถานะ", sortValue: (p) => p.status, render: (p) => <PmPlanStatusChip status={p.status} /> },
    { key: "planned", label: "ในแผน", align: "right", sortValue: (p) => p.counts.PLANNED, render: (p) => p.counts.PLANNED },
    { key: "job", label: "เปิดใบงาน", align: "right", sortValue: (p) => p.counts.JOB_CREATED, render: (p) => p.counts.JOB_CREATED },
    { key: "done", label: "ทำแล้ว", align: "right", sortValue: (p) => p.counts.DONE, render: (p) => p.counts.DONE },
    { key: "skip", label: "ตัดออก", align: "right", hideBelowLg: true, sortValue: (p) => p.counts.SKIPPED, render: (p) => p.counts.SKIPPED },
  ];

  const overdue = (c: PmCandidate) =>
    c.pmDaysLeft < 0 ? <WomsStatusChip label={`เกิน ${Math.abs(c.pmDaysLeft)} วัน`} tone="error" /> : null;
  const candCols: WomsColumn<PmCandidate>[] = [
    { key: "serial", label: "Serial", sortValue: (c) => c.serial, render: (c) => <Link href={`/equipment/${c.equipmentId}`} className="code">{c.serial}</Link> },
    { key: "model", label: "รุ่น", sortValue: (c) => c.model, render: (c) => c.model },
    { key: "cust", label: "ลูกค้า", sortValue: (c) => c.customerName || "", render: (c) => c.customerName || "-" },
    { key: "site", label: "สาขา", hideBelowLg: true, render: (c) => c.siteLabel || "-" },
    { key: "zone", label: "โซน", sortValue: (c) => c.zone || "", render: (c) => c.zone || "-" },
    {
      key: "due",
      label: "ครบกำหนด",
      sortValue: (c) => c.dueDate,
      render: (c) => (
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <span className="mono">{c.dueDate}</span>
          {overdue(c)}
        </Stack>
      ),
    },
    { key: "pkg", label: "Package PM", hideBelowLg: true, render: (c) => c.pmPackage || "-" },
    {
      key: "contract",
      label: "สัญญา",
      render: (c) => (
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <span className="mono">{c.contractNo || "-"}</span>
          {alreadyPlanned.has(c.equipmentId) ? <Chip size="small" variant="outlined" label="อยู่ในตารางแล้ว" /> : null}
        </Stack>
      ),
    },
  ];

  return (
    <>
      <WomsPageHeader
        title="ตาราง PM รายเดือน"
        subtitle="แยกตามช่าง/ผู้รับผิดชอบ · ช่างจะเห็นตารางหลังผู้ดูแลอนุมัติและกดส่งแล้วเท่านั้น"
        actions={
          <TextField
            label="เดือน"
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
            fullWidth={false}
          />
        }
      />

      <WomsFormSection title={`ตารางของเดือน ${month}`}>
        {error ? (
          <WomsErrorState message={error} onRetry={load} />
        ) : (
          <WomsDataTable
            caption="ตาราง PM ของเดือน"
            rows={plans ?? []}
            loading={plans === null}
            columns={planCols}
            rowKey={(p) => p.id}
            pageSize={10}
            emptyTitle="ยังไม่มีตาราง PM ของเดือนนี้"
            renderCard={(p) => (
              <Card>
                <CardActionArea component={Link} href={`/pm/${p.id}`}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{p.technicianName}</Typography>
                      <PmPlanStatusChip status={p.status} />
                    </Stack>
                    <Typography variant="body2">{p.team || "ไม่ระบุทีม"}</Typography>
                    <Typography variant="body2">
                      ในแผน {p.counts.PLANNED} · เปิดใบงาน {p.counts.JOB_CREATED} · ทำแล้ว {p.counts.DONE} · ตัดออก {p.counts.SKIPPED}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            )}
          />
        )}
      </WomsFormSection>

      {canManage && (
        <WomsFormSection title={`เครื่องที่ถึง/ใกล้ถึงกำหนด PM ในเดือน ${month}${candidates ? ` (${candidates.length})` : ""}`}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            รายการนี้คำนวณจากรอบ PM ของเครื่องในคลัง (รวมงานที่ค้างจากเดือนก่อน) — เลือกแล้วสร้างเป็นตารางของช่างหนึ่งคน
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "flex-start" }} sx={{ mb: 2 }}>
            <TextField
              select
              label="ช่าง/ผู้รับผิดชอบ"
              value={techId}
              onChange={(e) => setTechId(e.target.value)}
              sx={{ minWidth: 260 }}
              fullWidth={false}
              helperText={
                !busy && (!techId || picked.size === 0)
                  ? !techId
                    ? "เลือกช่างผู้รับผิดชอบก่อน"
                    : "ยังไม่ได้เลือกเครื่อง — ติ๊กเครื่องที่ต้องการอย่างน้อย 1 เครื่อง"
                  : " "
              }
            >
              <MenuItem value="">— เลือกช่าง —</MenuItem>
              {techs.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                  {t.team ? ` · ${t.team}` : ""}
                </MenuItem>
              ))}
            </TextField>
            {/* QA BUG-020 — ปุ่มนี้เคยกดได้ทั้งที่ป้ายเขียนว่า "0 เครื่อง" (B-07) */}
            <Box>
              <Button variant="contained" disabled={busy || !techId || picked.size === 0} onClick={createPlan} sx={{ minHeight: 40 }}>
                {busy ? "กำลังสร้าง…" : `สร้างตาราง (${picked.size} เครื่อง)`}
              </Button>
            </Box>
          </Stack>

          <WomsDataTable
            caption="เครื่องที่ถึงกำหนด PM"
            rows={candidates ?? []}
            loading={candidates === null}
            columns={candCols}
            rowKey={(c) => c.equipmentId}
            pageSize={25}
            emptyTitle="ไม่มีเครื่องที่ถึงกำหนด PM ในเดือนนี้"
            selection={{
              isSelected: (c) => picked.has(c.equipmentId),
              onToggle: (c) => toggle(c.equipmentId),
              onTogglePage: togglePage,
              label: (c) => `เลือก ${c.serial}`,
              isDisabled: (c) => alreadyPlanned.has(c.equipmentId),
            }}
            renderCard={(c) => (
              <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5, opacity: alreadyPlanned.has(c.equipmentId) ? 0.6 : 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <span className="code">{c.serial}</span>
                  {overdue(c)}
                  {alreadyPlanned.has(c.equipmentId) ? <Chip size="small" variant="outlined" label="อยู่ในตารางแล้ว" /> : null}
                </Stack>
                <Typography variant="body2">
                  {c.model} · {c.customerName || "-"}
                  {c.siteLabel ? ` · ${c.siteLabel}` : ""}
                </Typography>
                <Typography variant="body2">
                  ครบกำหนด <span className="mono">{c.dueDate}</span> · โซน {c.zone || "-"}
                  {c.contractNo ? ` · สัญญา ${c.contractNo}` : ""}
                </Typography>
              </Box>
            )}
          />
        </WomsFormSection>
      )}
    </>
  );
}
