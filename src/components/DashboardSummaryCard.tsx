"use client";

// ---------------------------------------------------------------------------
// สรุปผลรวมของแดชบอร์ด (DASH-FN-001..010)
// ---------------------------------------------------------------------------
// ที่มา: ชีตหลัก โมดูล "ระบบการสรุปผล" — ตามประเภทงาน สถานะ ช่วงเวลา ช่าง
//        PM ที่ดำเนินการแล้ว/ค้าง · สต๊อกและมูลค่าคงเหลือ · กรอง · Export
//
// ทุกตัวเลขมาจาก /api/dashboard/summary ซึ่งนับจากรายการจริง
// และแสดง "จำนวนรายการต้นทางที่ใช้นับ" ไว้ให้กระทบยอดกับหน้ารายการได้

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { AuthUser, DashboardSummary, Options } from "@/lib/types";
import { jobTypeLabel, statusLabel } from "@/lib/options";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid2";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import {
  WomsErrorState,
  WomsFilterPanel,
  WomsFormSection,
  WomsLoadingState,
  WomsSelectFilter,
  WomsStatCard,
  WomsStatGrid,
} from "@/components/woms";

const num = (n: number) => n.toLocaleString("th-TH");

export default function DashboardSummaryCard() {
  const { has } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [jobType, setJobType] = useState("");
  const [team, setTeam] = useState("");
  // QA BUG-032 — AC-DASH-02 กำหนดตัวกรอง 5 ตัว แต่หน้าจอมี 4 (ขาด technicianId)
  // ทั้งที่ backend รองรับพารามิเตอร์นี้อยู่แล้ว
  const [technicianId, setTechnicianId] = useState("");
  const [techs, setTechs] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.dashboardSummary({
        from: from || undefined,
        to: to || undefined,
        jobType: jobType || undefined,
        team: team || undefined,
        technicianId: technicianId || undefined,
      });
      setData(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดสรุปผลไม่สำเร็จ");
    }
  }, [from, to, jobType, team, technicianId]);

  useEffect(() => {
    load();
  }, [load]);
  // ตัวเลือกของตัวกรองโหลดครั้งเดียว (เดิมโหลดซ้ำทุกครั้งที่เปลี่ยนตัวกรอง)
  useEffect(() => {
    api.getOptions().then(setOptions).catch(() => setOptions(null));
    api
      .listTechnicians()
      .then((r) => setTechs(r.items))
      .catch(() => setTechs([]));
  }, []);

  const exportQuery = () => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (jobType) p.set("jobType", jobType);
    if (team) p.set("team", team);
    if (technicianId) p.set("technicianId", technicianId);
    return p.toString() ? `?${p}` : "";
  };

  const breakdown = (title: string, entries: [string, number][], label: (k: string) => string) => (
    <Grid size={{ xs: 12, md: 4 }}>
      <Typography variant="h3" component="h3" sx={{ fontSize: 15, mb: 1 }}>
        {title}
      </Typography>
      <Table size="small" aria-label={title}>
        <TableBody>
          {entries.map(([k, v]) => (
            <TableRow key={k}>
              <TableCell>{label(k)}</TableCell>
              <TableCell align="right" className="mono">
                {num(v)}
              </TableCell>
            </TableRow>
          ))}
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2}>ไม่มีข้อมูล</TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </Grid>
  );

  return (
    <WomsFormSection
      title="สรุปผล"
      actions={
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() =>
            downloadFile(`/api/dashboard/export.xlsx${exportQuery()}`, "woms-dashboard.xlsx").catch((e) => toast.error(e.message))
          }
        >
          Export Excel
        </Button>
      }
    >
      <WomsFilterPanel
        activeCount={[from, to, jobType, team, technicianId].filter(Boolean).length}
        onClear={() => {
          setFrom("");
          setTo("");
          setJobType("");
          setTeam("");
          setTechnicianId("");
        }}
      >
        <TextField label="ตั้งแต่วันที่" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth={false} sx={{ minWidth: 160 }} />
        <TextField label="ถึงวันที่" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth={false} sx={{ minWidth: 160 }} />
        <WomsSelectFilter label="ประเภทงาน" value={jobType} onChange={setJobType} options={options?.jobTypes ?? []} allLabel="ทุกประเภท" />
        <WomsSelectFilter label="ทีมช่าง" value={team} onChange={setTeam} options={options?.teams ?? []} allLabel="ทุกทีม" />
        <WomsSelectFilter
          label="ช่าง"
          value={technicianId}
          onChange={setTechnicianId}
          options={techs.map((t) => ({ value: t.id, label: `${t.name}${t.team ? ` · ${t.team}` : ""}` }))}
          allLabel="ทุกคน"
        />
      </WomsFilterPanel>

      {error ? (
        <WomsErrorState message={error} onRetry={load} />
      ) : !data ? (
        <WomsLoadingState rows={3} />
      ) : (
        <>
          <WomsStatGrid max={6}>
            <WomsStatCard value={num(data.jobs.total)} label="ใบงานในช่วงที่เลือก" />
            <WomsStatCard value={num(data.pm.done)} label="PM ดำเนินการแล้ว" />
            <WomsStatCard value={num(data.pm.openJobs)} label="PM ค้างดำเนินการ" />
            <WomsStatCard value={num(data.pm.overdue)} label="เครื่องเกินกำหนด PM" />
            <WomsStatCard value={num(data.jobs.revenueTotal)} label="รายรับจากใบงาน (บาท)" />
            <WomsStatCard value={num(data.jobs.net)} label="ผลต่างสุทธิ (บาท)" />
          </WomsStatGrid>

          <Grid container spacing={2}>
            {breakdown("ตามประเภทงาน", Object.entries(data.jobs.byType), (k) => (jobTypeLabel as Record<string, string>)[k] ?? k)}
            {breakdown("ตามสถานะ", Object.entries(data.jobs.byStatus), (k) => (statusLabel as Record<string, string>)[k] ?? k)}
            {breakdown("ตามทีมช่าง", Object.entries(data.jobs.byTechnicianTeam), (k) => k)}
          </Grid>

          {data.stock && has("stock:view") ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              <strong>สต๊อกอะไหล่</strong> — {num(data.stock.parts)} รายการ · คงเหลือรวม {num(data.stock.totalQty)} · ต่ำกว่าจุดสั่งซื้อ{" "}
              {num(data.stock.belowReorder)} รายการ ·{" "}
              {data.stock.totalValue === null ? (
                <span>มูลค่า: ยังคำนวณไม่ได้ ({data.stock.valuationNote})</span>
              ) : (
                <span>มูลค่าคงเหลือ {num(data.stock.totalValue)} บาท</span>
              )}
            </Alert>
          ) : null}

          {data.contracts && has("contracts:view") ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              <strong>สัญญา</strong> — ใช้งานอยู่ {num(data.contracts.active)} · ใกล้หมดอายุ {num(data.contracts.expiring)} · หมดอายุ{" "}
              {num(data.contracts.expired)} · ค้างชำระ {num(data.contracts.overdue)}
            </Alert>
          ) : null}

          <Box sx={{ mt: 1.5 }}>
            <Typography variant="body2">
              ตัวเลขข้างต้นนับจากใบงานจริง {num(data.sources.jobsMatchedFilter)} ใบ (จากทั้งหมด {num(data.sources.jobsScanned)} ใบ) และเครื่อง{" "}
              {num(data.sources.equipmentScanned)} เครื่อง · วันที่ของเซิร์ฟเวอร์ {data.serverDate}
            </Typography>
          </Box>
        </>
      )}
    </WomsFormSection>
  );
}
