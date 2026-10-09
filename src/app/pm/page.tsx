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
import type { AuthUser, PmCandidate, PmItemRow, PmPlan } from "@/lib/types";
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

const QUEUE_TONE: Record<string, "success" | "warning" | "info" | "neutral"> = {
  NO_QUEUE: "warning",
  OPENED: "info",
  DONE: "success",
  SKIPPED: "neutral",
};

/**
 * PM-01 / BR-02.1 / TECH-01 — ตาราง PM แบบรายการ (รวมทุกแผนในช่วงเดือน)
 * คอลัมน์ตามข้อกำหนด: ร้านสาขา รุ่น เครื่องกรอง ผู้ติดต่อ เบอร์ Map เซลล์ สถานะ (เปิดงานแล้ว/ยังไม่มีคิว/เสร็จแล้ว)
 * Filter ตามช่าง (ผู้ดูแล) · เรียงได้ทุกคอลัมน์หลัก · ดูล่วงหน้า 1–3 เดือน
 * ช่างเห็นเฉพาะของตนที่ส่งแล้ว (เซิร์ฟเวอร์บังคับ) · ช่างเริ่มต้นที่ 2 เดือน ("ดูตาราง PM รายเดือน 2 เดือน")
 */
function PmItemsTable({ month, canManage, techs }: { month: string; canManage: boolean; techs: AuthUser[] }) {
  // months = 0 → โหมด "ระบุจำนวนวัน" (D-12 / VFB แถว 14)
  const [months, setMonths] = useState<number>(canManage ? 1 : 2);
  const [days, setDays] = useState("30");
  const daysNum = /^\d{1,3}$/.test(days) && Number(days) <= 366 ? Number(days) : null;
  const [techId, setTechId] = useState("");
  const [rows, setRows] = useState<PmItemRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    setErr(null);
    try {
      if (months === 0 && daysNum === null) {
        setErr("ระบุจำนวนวัน 0–366");
        setRows([]);
        return;
      }
      const r = await api.pmItems(
        months === 0
          ? { days: daysNum ?? 30, technicianId: canManage ? techId || undefined : undefined }
          : { month, months, technicianId: canManage ? techId || undefined : undefined }
      );
      setRows(r.items);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดรายการ PM ไม่สำเร็จ");
      setRows([]);
    }
  }, [month, months, techId, canManage, daysNum]);

  useEffect(() => {
    load();
  }, [load]);

  const cols: WomsColumn<PmItemRow>[] = [
    {
      key: "date",
      label: "วันนัด / ครบกำหนด",
      sortValue: (r) => r.plannedDate || r.dueDate || "",
      render: (r) => <span className="mono">{r.plannedDate || r.dueDate || "-"}</span>,
    },
    {
      key: "site",
      label: "ร้าน / สาขา",
      sortValue: (r) => r.siteLabel || r.customerName || "",
      render: (r) => (
        <>
          {r.siteLabel || r.customerName || "-"}
          {r.siteLabel && r.customerName ? <Typography variant="body2">{r.customerName}</Typography> : null}
        </>
      ),
    },
    {
      key: "serial",
      label: "เครื่อง / รุ่น",
      sortValue: (r) => r.model || "",
      render: (r) => (
        <>
          <Link href={`/equipment/${r.equipmentId}`} className="code">
            {r.serial}
          </Link>
          <Typography variant="body2">{r.model || "-"}</Typography>
        </>
      ),
    },
    { key: "filter", label: "เครื่องกรอง", hideBelowLg: true, sortValue: (r) => r.filterUnit || "", render: (r) => r.filterUnit || "-" },
    {
      key: "contact",
      label: "ผู้ติดต่อ / เบอร์",
      render: (r) => (
        <>
          {r.contactName || "-"}
          {r.phone ? (
            <Typography variant="body2">
              <a href={`tel:${r.phone}`}>{r.phone}</a>
            </Typography>
          ) : null}
        </>
      ),
    },
    {
      key: "map",
      label: "Map",
      render: (r) =>
        r.mapLink ? (
          <a href={r.mapLink} target="_blank" rel="noopener noreferrer">
            เปิด Map
          </a>
        ) : (
          "-"
        ),
    },
    { key: "sales", label: "เซลล์", hideBelowLg: true, sortValue: (r) => r.salesPerson || "", render: (r) => r.salesPerson || "-" },
    ...(canManage
      ? [{ key: "tech", label: "ช่าง", sortValue: (r: PmItemRow) => r.technicianName, render: (r: PmItemRow) => r.technicianName } as WomsColumn<PmItemRow>]
      : []),
    {
      key: "status",
      label: "สถานะ",
      sortValue: (r) => r.queueStatus || r.status,
      render: (r) => (
        <Stack spacing={0.5} alignItems="flex-start">
          <WomsStatusChip label={r.queueStatusLabel || r.status} tone={QUEUE_TONE[r.queueStatus ?? ""] ?? "neutral"} />
          {r.jobId && !r.jobId.startsWith("RESERVED:") ? (
            <Link href={`/jobs/${r.jobId}`} className="code">
              {r.jobId}
            </Link>
          ) : null}
        </Stack>
      ),
    },
  ];

  return (
    <WomsFormSection title={`รายการ PM${rows ? ` (${rows.length})` : ""}`}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          select
          label="ดูล่วงหน้า"
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          sx={{ minWidth: 180 }}
          fullWidth={false}
          id="pm-items-months"
        >
          <MenuItem value={1}>เดือนนี้ ({month})</MenuItem>
          <MenuItem value={2}>2 เดือน</MenuItem>
          <MenuItem value={3}>3 เดือน</MenuItem>
          <MenuItem value={0}>ระบุจำนวนวัน…</MenuItem>
        </TextField>
        {months === 0 ? (
          <TextField
            label="ล่วงหน้า (วัน)"
            value={days}
            onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            inputProps={{ inputMode: "numeric" }}
            sx={{ maxWidth: 140 }}
            fullWidth={false}
            id="pm-items-days"
            helperText="นับจากวันนี้"
          />
        ) : null}
        {canManage ? (
          <TextField
            select
            label="ช่าง"
            value={techId}
            onChange={(e) => setTechId(e.target.value)}
            sx={{ minWidth: 220 }}
            fullWidth={false}
            id="pm-items-tech"
          >
            <MenuItem value="">ทุกช่าง</MenuItem>
            {techs.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
      </Stack>
      {err ? (
        <WomsErrorState message={err} onRetry={load} />
      ) : (
        <WomsDataTable
          caption="รายการ PM"
          rows={rows ?? []}
          loading={rows === null}
          columns={cols}
          rowKey={(r) => `${r.planId}:${r.id}`}
          pageSize={25}
          emptyTitle="ไม่มีรายการ PM ในช่วงนี้"
          renderCard={(r) => (
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                <span className="mono">{r.plannedDate || r.dueDate || "-"}</span>
                <WomsStatusChip label={r.queueStatusLabel || r.status} tone={QUEUE_TONE[r.queueStatus ?? ""] ?? "neutral"} />
              </Stack>
              <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{r.siteLabel || r.customerName || "-"}</Typography>
              <Typography variant="body2">
                {r.serial} · {r.model || "-"}
                {r.filterUnit ? ` · เครื่องกรอง ${r.filterUnit}` : ""}
              </Typography>
              <Typography variant="body2">
                {r.contactName || "-"}
                {r.phone ? (
                  <>
                    {" · "}
                    <a href={`tel:${r.phone}`}>{r.phone}</a>
                  </>
                ) : null}
                {r.salesPerson ? ` · เซลล์ ${r.salesPerson}` : ""}
              </Typography>
              {r.mapLink ? (
                <a href={r.mapLink} target="_blank" rel="noopener noreferrer">
                  เปิด Map
                </a>
              ) : null}
            </Box>
          )}
        />
      )}
    </WomsFormSection>
  );
}

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

      <PmItemsTable month={month} canManage={canManage} techs={techs} />

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
