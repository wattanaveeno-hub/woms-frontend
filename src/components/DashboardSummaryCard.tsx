"use client";

// ---------------------------------------------------------------------------
// สรุปผลรวมของแดชบอร์ด (DASH-FN-001..010)
// ---------------------------------------------------------------------------
// ที่มา: ชีตหลัก โมดูล "ระบบการสรุปผล" — ตามประเภทงาน สถานะ ช่วงเวลา ช่าง
//        PM ที่ดำเนินการแล้ว/ค้าง · สต๊อกและมูลค่าคงเหลือ · กรอง · Export
//
// ทุกตัวเลขมาจาก /api/dashboard/summary ซึ่งนับจากรายการจริง
// และแสดง "จำนวนรายการต้นทางที่ใช้นับ" ไว้ให้กระทบยอดกับหน้ารายการได้

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { AuthUser, DashboardSummary, Options } from "@/lib/types";
import { jobTypeLabel, statusLabel } from "@/lib/options";
import {
  createLatestGuard,
  dateRangeError,
  stockValuationStatus,
  summaryQuery,
  valuationMessage,
} from "@/lib/dashboardRules";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid2";
import LinearProgress from "@mui/material/LinearProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import {
  WomsEmptyState,
  WomsErrorState,
  WomsFilterPanel,
  WomsFormSection,
  WomsLoadingState,
  WomsSelectFilter,
  WomsStatCard,
  WomsStatGrid,
} from "@/components/woms";

const num = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("th-TH"));
const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DashboardSummaryCard() {
  const { has } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [jobType, setJobType] = useState("");
  const [team, setTeam] = useState("");
  // QA BUG-032 — AC-DASH-02 กำหนดตัวกรอง 5 ตัว
  const [technicianId, setTechnicianId] = useState("");
  const [techs, setTechs] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  // เปลี่ยนตัวกรองเร็ว ๆ แล้วคำตอบเก่ากลับมาทีหลัง ต้องไม่ทับผลของตัวกรองล่าสุด
  const guard = useRef(createLatestGuard());

  const rangeError = dateRangeError(from, to);
  const filters = useMemo(() => ({ from, to, jobType, team, technicianId }), [from, to, jobType, team, technicianId]);

  const load = useCallback(async () => {
    const id = guard.current.next();
    if (rangeError) {
      // ไม่ยิงคำขอเมื่อช่วงวันที่ผิด และไม่แสดงยอดเก่าเหมือนเป็นผลของเงื่อนไขนี้
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const r = await api.dashboardSummary({
        from: filters.from || undefined,
        to: filters.to || undefined,
        jobType: filters.jobType || undefined,
        team: filters.team || undefined,
        technicianId: filters.technicianId || undefined,
      });
      if (!guard.current.isLatest(id)) return;
      setData(r);
    } catch (e) {
      if (!guard.current.isLatest(id)) return;
      setData(null);
      setError(e instanceof ApiError ? e.message : "โหลดสรุปผลไม่สำเร็จ");
    } finally {
      if (guard.current.isLatest(id)) setLoading(false);
    }
  }, [filters, rangeError]);

  useEffect(() => {
    load();
  }, [load]);
  // ตัวเลือกของตัวกรองโหลดครั้งเดียว
  useEffect(() => {
    api.getOptions().then(setOptions).catch(() => setOptions(null));
    api
      .listTechnicians()
      .then((r) => setTechs(r.items))
      .catch(() => setTechs([]));
  }, []);

  const onExport = async () => {
    if (rangeError) return;
    setExporting(true);
    try {
      await downloadFile(`/api/dashboard/export.xlsx${summaryQuery(filters)}`, "woms-dashboard.xlsx");
      toast.success("ดาวน์โหลดไฟล์ Excel แล้ว");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? `สร้างไฟล์ Excel ไม่สำเร็จ: ${e.message}` : "สร้างไฟล์ Excel ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
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

  const stockBlock = () => {
    if (!data || !has("stock:view")) return null;
    if (!data.stock) {
      // backend ส่ง stock = null + sectionErrors ["stock"] เมื่ออ่าน/คำนวณไม่สำเร็จ
      return (data.sectionErrors ?? []).includes("stock") ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          <strong>สต๊อกอะไหล่</strong> — {valuationMessage("ERROR", false)!.text}
        </Alert>
      ) : null;
    }
    const st = data.stock;
    const status = stockValuationStatus(st);
    const msg = valuationMessage(status, has("stock:manage"), st.partsMissingCost ?? 0);
    return (
      <Alert severity={msg ? msg.severity : "info"} sx={{ mt: 2 }}>
        <strong>สต๊อกอะไหล่</strong> (ภาพรวม ณ วันนี้) — {num(st.parts)} รายการ · คงเหลือรวม {num(st.totalQty)} หน่วย · ต่ำกว่าจุดสั่งซื้อ{" "}
        {num(st.belowReorder)} รายการ ·{" "}
        {msg ? (
          <span>
            มูลค่าคงเหลือ: {msg.text}
            {msg.settingsLink ? (
              <>
                {" "}
                <Link href="/settings/stock">ตั้งค่าวิธีคิดมูลค่า</Link>
              </>
            ) : null}
          </span>
        ) : (
          <span>
            มูลค่าคงเหลือ {money(st.totalValue ?? 0)} บาท
            {st.valuationMethodLabel ? ` (${st.valuationMethodLabel})` : ""}
          </span>
        )}
      </Alert>
    );
  };

  const pmHold = data?.pm.hold ?? 0;
  const assignedOnly = data?.scope?.jobVisibility === "ASSIGNED";

  return (
    <WomsFormSection
      title="สรุปผล"
      actions={
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          disabled={exporting || !!rangeError}
          onClick={onExport}
        >
          {exporting ? "กำลังสร้างไฟล์…" : "Export Excel"}
        </Button>
      }
    >
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        ตัวกรองใช้กับสรุปใบงานในส่วนนี้เท่านั้น ช่วงวันที่นับตามวันนัด (รวมวันสุดท้าย)
        {assignedOnly ? " · แสดงเฉพาะใบงานที่คุณได้รับมอบหมาย" : ""}
      </Typography>
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
        <TextField
          label="วันนัดตั้งแต่"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          error={!!rangeError}
          fullWidth={false}
          sx={{ minWidth: 160 }}
        />
        <TextField
          label="วันนัดถึง"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          error={!!rangeError}
          helperText={rangeError || undefined}
          fullWidth={false}
          sx={{ minWidth: 160 }}
        />
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

      {/* แถบโหลดระหว่างเปลี่ยนตัวกรอง — ตัวเลขเดิมถูกทำให้จางลง ไม่ให้เข้าใจผิดว่าเป็นผลของตัวกรองใหม่ */}
      <Box sx={{ height: 4, mb: 1 }}>{loading && data ? <LinearProgress aria-label="กำลังโหลดสรุปตามตัวกรอง" /> : null}</Box>

      {rangeError ? (
        <Alert severity="warning">{rangeError} — แก้ช่วงวันที่เพื่อดูสรุปผล</Alert>
      ) : error ? (
        <WomsErrorState message={error} onRetry={load} />
      ) : !data ? (
        <WomsLoadingState rows={3} />
      ) : (
        <Box aria-busy={loading} sx={{ opacity: loading ? 0.45 : 1, transition: "opacity .15s" }}>
          {data.jobs.total === 0 ? (
            <Box sx={{ mb: 2 }}>
              <WomsEmptyState title="ไม่พบใบงานตามเงื่อนไขที่เลือก" description="ลองเปลี่ยนช่วงวันที่หรือล้างตัวกรอง" />
            </Box>
          ) : null}
          <WomsStatGrid max={6}>
            <WomsStatCard value={num(data.jobs.total)} label="ใบงานตามตัวกรอง" hint="หน่วย: ใบงาน" />
            <WomsStatCard value={num(data.pm.done)} label="PM ดำเนินการแล้ว" hint="ใบงาน PM และ PM+CM ที่ปิดแล้ว" tone="success" />
            <WomsStatCard
              value={num(data.pm.openJobs)}
              label="PM ค้างดำเนินการ"
              hint={pmHold > 0 ? `ใบงานที่เปิดอยู่ · ไม่รวมพักงาน ${num(pmHold)} ใบ` : "ใบงาน PM และ PM+CM ที่เปิดอยู่"}
              tone="warning"
            />
            <WomsStatCard value={money(data.jobs.revenueTotal)} label="รายรับจากใบงาน (บาท)" />
            <WomsStatCard value={money(data.jobs.net)} label="ผลต่างสุทธิ (บาท)" hint={`ค่าใช้จ่าย ${money(data.jobs.costTotal)} บาท`} />
            {has("equipment:view") ? (
              <WomsStatCard
                href="/equipment?pmStatus=OVERDUE"
                value={num(data.pm.overdue)}
                label="เครื่องเกินกำหนด PM"
                hint="ทั้งหมด ณ วันนี้ ไม่ขึ้นกับตัวกรอง"
                tone={data.pm.overdue > 0 ? "error" : "neutral"}
              />
            ) : null}
          </WomsStatGrid>

          <Grid container spacing={2}>
            {breakdown("ตามประเภทงาน", Object.entries(data.jobs.byType), (k) => (jobTypeLabel as Record<string, string>)[k] ?? k)}
            {breakdown("ตามสถานะ", Object.entries(data.jobs.byStatus), (k) => (statusLabel as Record<string, string>)[k] ?? k)}
            {breakdown("ตามทีมช่าง", Object.entries(data.jobs.byTechnicianTeam), (k) => k)}
          </Grid>

          {stockBlock()}

          {data.contracts && has("contracts:view") ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              <strong>สัญญา</strong> (ภาพรวม ณ วันนี้) — ใช้งานอยู่ {num(data.contracts.active)} · ใกล้หมดอายุ {num(data.contracts.expiring)} · หมดอายุ{" "}
              {num(data.contracts.expired)} · ค้างชำระ {num(data.contracts.overdue)}
            </Alert>
          ) : (data.sectionErrors ?? []).includes("contracts") && has("contracts:view") ? (
            <Alert severity="error" sx={{ mt: 1 }}>
              <strong>สัญญา</strong> — โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่
            </Alert>
          ) : null}

          <Box sx={{ mt: 1.5 }}>
            <Typography variant="body2">
              นับจากใบงาน {num(data.sources.jobsMatchedFilter)} ใบ จากที่คุณเห็นได้ทั้งหมด {num(data.sources.jobsScanned)} ใบ · ข้อมูล ณ วันที่{" "}
              {data.serverDate}
            </Typography>
          </Box>
        </Box>
      )}
    </WomsFormSection>
  );
}
