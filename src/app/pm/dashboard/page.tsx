"use client";
// CR-PM01 (CF v1.1 §12 · AC21–AC23) — Dashboard PM
//   ข้อมูลและการนับทำที่ backend (GET /api/pm/dashboard · เวลาไทย · บวกเดือนปฏิทิน · ขอบเขตข้อมูลตามสิทธิ์)
//   การ์ดกดแล้วกรองรายการ · ตัวกรองลูกค้า/สาขา/ค้นหาใช้กับทั้งการ์ดและรายการ
import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import Button from "@mui/material/Button";
import CaretakerDialog from "@/components/CaretakerDialog";
import { useAuth } from "@/lib/AuthContext";
import { api, ApiError, type PmDashboardResponse, type PmDueBucket } from "@/lib/api";
import { WomsEmptyState, WomsErrorState, WomsLoadingState, WomsPageHeader, WomsStatCard, WomsStatGrid } from "@/components/woms";
import type { StatusTone } from "@/components/woms/WomsStatusChip";

const ORDER: PmDueBucket[] = ["OVERDUE", "DUE_TODAY", "UPCOMING", "NOT_YET", "PENDING"];
const TONE: Record<PmDueBucket, StatusTone> = { OVERDUE: "error", DUE_TODAY: "warning", UPCOMING: "info", NOT_YET: "success", PENDING: "neutral" };
const REASON: Record<string, string> = {
  NO_INTERVAL: "ยังไม่ตั้งรอบ PM",
  NO_BASELINE: "ยังไม่มีวัน PM ล่าสุด",
  // CR-PM01 P1.1: ข้อมูลเดิมที่เคยบันทึกวันนัดเป็นวัน PM ล่าสุด
  FUTURE_BASELINE: "PM ล่าสุดเป็นวันในอนาคต — รอตรวจสอบวันฐาน",
};

// OD-PM-02: สถานะคิว/JN แยกจากสถานะกำหนด PM — HOLD ไม่ใช่ PM สำเร็จ
const SOURCE_LABEL: Record<string, string> = { RENTAL: "เช่า", BUNDLED: "PM แถม", PURCHASED: "Package ซื้อ", INTERVAL_ONLY: "ตั้งรอบอย่างเดียว" };
const WORK_LABEL: Record<string, string> = { NONE: "ไม่มีคิว/JN", QUEUE: "มีคิวรอ", JOB_OPEN: "มี JN เปิดอยู่", JOB_HOLD: "JN พักงาน" };

export default function PmDashboardPage() {
  const [bucket, setBucket] = useState<PmDueBucket | "">("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  // OD-PM-01 ข้อ 5 (รอบ 6): สถานะสิทธิ์ PM และช่วงวัน PM ถัดไป — backend กรองทั้งการ์ดและรายการชุดเดียวกัน
  const [entitlement, setEntitlement] = useState("");
  const [nextFrom, setNextFrom] = useState("");
  const [nextTo, setNextTo] = useState("");
  // OD-PM-02 (รอบ 7): ผู้ดูแลถาวร · ช่างรายรอบ · สถานะคิว/JN — แยกจากสถานะกำหนด PM
  const [caretakerId, setCaretakerId] = useState("");
  const [roundTechId, setRoundTechId] = useState("");
  const [workState, setWorkState] = useState("");
  // BD-11 / §12.1: สถานะรับบริการ และแหล่งสิทธิ์ (เช่า / แถม / ซื้อ)
  const [serviceState, setServiceState] = useState("");
  const [source, setSource] = useState("");
  const [techs, setTechs] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    api.listTechnicians().then((r) => setTechs(r.items.map((t) => ({ id: t.id, name: t.name })))).catch(() => setTechs([]));
  }, []);
  const techName = (id: string) => techs.find((t) => t.id === id)?.name ?? id;
  const { has } = useAuth();
  const canManagePm = has("pm:manage");
  const [ctFor, setCtFor] = useState<{ id: string; serial: string; current: { id: string; name: string } | null } | null>(null);
  // ตัวเลือกลูกค้า/สาขา จากเครื่องที่ผู้ใช้เห็นได้ (ขอบเขตเดิม) — โหลดครั้งแรกแบบไม่กรอง
  const [options, setOptions] = useState<{ customers: { id: string; name: string }[]; sites: { id: string; customerId: string; label: string }[] }>({ customers: [], sites: [] });
  const [model, setModel] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  // CR-PM02 P2: ผู้ไม่มีสิทธิ์แก้ (ช่างผู้ดูแล) ดูประวัติผู้ดูแลแบบอ่านอย่างเดียว
  const [ctReadOnly, setCtReadOnly] = useState(false);
  const [data, setData] = useState<PmDashboardResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setData(null);
    try {
      const r = await api.pmDashboard({
        bucket: bucket || undefined,
        q: query || undefined,
        model: modelQuery || undefined,
        customerId: customerId || undefined,
        siteId: siteId || undefined,
        entitlement: entitlement || undefined,
        nextFrom: nextFrom || undefined,
        nextTo: nextTo || undefined,
        caretakerId: caretakerId || undefined,
        roundTechId: roundTechId || undefined,
        workState: workState || undefined,
        serviceState: serviceState || undefined,
        source: source || undefined,
      });
      setData(r);
      if (!bucket && !query && !modelQuery && !customerId && !siteId && !entitlement && !nextFrom && !nextTo && !caretakerId && !roundTechId && !workState && !serviceState && !source) {
        const cs = new Map<string, string>();
        const ss = new Map<string, { customerId: string; label: string }>();
        for (const it of r.items) {
          if (it.customerId) cs.set(it.customerId, it.customerName || it.customerId);
          if (it.siteId) ss.set(it.siteId, { customerId: it.customerId ?? "", label: it.siteLabel || "" });
        }
        // CR-PM01 P2: ชื่อสาขาจาก backend (ไม่แสดง siteId ดิบ)
        for (const o of r.siteOptions ?? []) ss.set(o.id, { customerId: o.customerId || ss.get(o.id)?.customerId || "", label: `${o.label}${o.branchNo ? ` (สาขา ${o.branchNo})` : ""}` });
        setOptions({ customers: [...cs].map(([id, name]) => ({ id, name })), sites: [...ss].map(([id, v]) => ({ id, customerId: v.customerId, label: v.label || "สาขา (ไม่มีชื่อ)" })) });
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลด Dashboard PM ไม่สำเร็จ");
    }
  }, [bucket, query, modelQuery, customerId, siteId, entitlement, nextFrom, nextTo, caretakerId, roundTechId, workState, serviceState, source]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Box>
      <WomsPageHeader title="Dashboard PM" subtitle={data ? `เครื่องที่ตั้งรอบ PM ${data.total} เครื่อง · วันนี้ ${data.today} (เวลาไทย)` : "กำลังโหลด…"} />
      {data ? (
        <WomsStatGrid max={5}>
          {ORDER.map((b) => (
            <WomsStatCard
              key={b}
              value={data.counts[b]}
              label={data.labels[b]}
              tone={TONE[b]}
              active={bucket === b}
              onClick={() => setBucket(bucket === b ? "" : b)}
            />
          ))}
        </WomsStatGrid>
      ) : null}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap" sx={{ my: 2 }}>
        <TextField
          size="small"
          label="ค้นหา SN / ลูกค้า"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setQuery(q.trim())}
          onBlur={() => setQuery(q.trim())}
          sx={{ minWidth: { sm: 320 } }}
        />
        <TextField
          size="small"
          label="รุ่น"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setModelQuery(model.trim())}
          onBlur={() => setModelQuery(model.trim())}
          inputProps={{ "data-testid": "pm-dash-model" }}
          sx={{ minWidth: 140 }}
        />
        <TextField select size="small" label="ลูกค้า" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setSiteId(""); }} sx={{ minWidth: 200 }}>
          <MenuItem value="">ทุกลูกค้า</MenuItem>
          {options.customers.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="สาขา" value={siteId} onChange={(e) => setSiteId(e.target.value)} sx={{ minWidth: 160 }} disabled={!customerId}>
          <MenuItem value="">ทุกสาขา</MenuItem>
          {options.sites.filter((s) => s.customerId === customerId).map((s) => (
            <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="สิทธิ์ PM" value={entitlement} onChange={(e) => setEntitlement(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">ทั้งหมด</MenuItem>
          <MenuItem value="ACTIVE">Package ยังมีสิทธิ์</MenuItem>
          <MenuItem value="EXHAUSTED">Package ใช้ครบ</MenuItem>
          <MenuItem value="PENDING_ACTIVATION">Package รอเปิดสิทธิ์</MenuItem>
          <MenuItem value="EXPIRED">Package หมดอายุ</MenuItem>
          <MenuItem value="NONE">ไม่ใช่ Package</MenuItem>
        </TextField>
        <TextField select size="small" label="แหล่งสิทธิ์" value={source} onChange={(e) => setSource(e.target.value)} sx={{ minWidth: 150 }} inputProps={{ "data-testid": "pm-dash-source" }}>
          <MenuItem value="">ทั้งหมด</MenuItem>
          {Object.entries(SOURCE_LABEL).map(([k, v]) => (
            <MenuItem key={k} value={k}>{v}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="การรับบริการ" value={serviceState} onChange={(e) => setServiceState(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">ทั้งหมด</MenuItem>
          <MenuItem value="ACTIVE">รับบริการ</MenuItem>
          <MenuItem value="STOPPED">หยุดบริการ</MenuItem>
        </TextField>
        <TextField type="date" size="small" label="PM ถัดไป ตั้งแต่" value={nextFrom} onChange={(e) => setNextFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField type="date" size="small" label="ถึง" value={nextTo} onChange={(e) => setNextTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField select size="small" label="ผู้ดูแลเครื่อง" value={caretakerId} onChange={(e) => setCaretakerId(e.target.value)} sx={{ minWidth: 170 }}>
          <MenuItem value="">ทั้งหมด</MenuItem>
          <MenuItem value="UNASSIGNED">ยังไม่กำหนดผู้ดูแล</MenuItem>
          {techs.map((t) => (
            <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="ช่างรอบนี้" value={roundTechId} onChange={(e) => setRoundTechId(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">ทั้งหมด</MenuItem>
          {techs.map((t) => (
            <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="สถานะคิว/JN" value={workState} onChange={(e) => setWorkState(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">ทั้งหมด</MenuItem>
          {Object.entries(WORK_LABEL).map(([k, v]) => (
            <MenuItem key={k} value={k}>{v}</MenuItem>
          ))}
        </TextField>
        {bucket ? <Chip label={`สถานะ: ${data?.labels[bucket] ?? bucket}`} onDelete={() => setBucket("")} /> : null}
      </Stack>
      {err ? <WomsErrorState message={err} onRetry={load} /> : null}
      {!data && !err ? <WomsLoadingState /> : null}
      {data && !data.items.length ? <WomsEmptyState title="ไม่พบเครื่องตามเงื่อนไข" /> : null}
      {data && data.items.length ? (
        <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: "100%", overflowX: "auto" }}>
          <Table size="small" aria-label="รายการเครื่องตามรอบ PM">
            <TableHead>
              <TableRow>
                <TableCell>SN</TableCell>
                <TableCell>รุ่น</TableCell>
                <TableCell>ลูกค้า</TableCell>
                <TableCell>สาขา</TableCell>
                <TableCell>PM ล่าสุด</TableCell>
                <TableCell>PM ถัดไป</TableCell>
                <TableCell>รอบ (เดือน)</TableCell>
                <TableCell>สถานะกำหนด</TableCell>
                <TableCell>สิทธิ์ PM</TableCell>
                <TableCell>ผู้ดูแล</TableCell>
                <TableCell>ช่างรอบนี้</TableCell>
                <TableCell>คิว / JN</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((r) => (
                <TableRow key={r.equipmentId} data-testid="pm-dash-row">
                  <TableCell className="code">
                    {/* CR-PM01 P2 (PM01-05): เปิดดูรอบ PM / สิทธิ์ / ประวัติของเครื่อง */}
                    <Link href={`/equipment/${r.equipmentId}`} data-testid="pm-dash-serial">{r.serial}</Link>
                    {r.pendingSerial ? <Chip size="small" color="warning" label="Pending Serial" sx={{ ml: 0.5 }} /> : null}
                  </TableCell>
                  <TableCell>{r.model}</TableCell>
                  <TableCell>{r.customerName || "-"}</TableCell>
                  <TableCell>{r.siteLabel ? `${r.siteLabel}${r.branchNo ? ` (${r.branchNo})` : ""}` : "-"}</TableCell>
                  <TableCell>{r.lastPmDate || "-"}</TableCell>
                  <TableCell>{r.nextPmDate || "-"}</TableCell>
                  <TableCell>{r.intervalMonths || "-"}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{data.labels[r.bucket]}</Typography>
                    {r.pendingReason ? (
                      <Typography variant="caption" color="text.secondary">
                        {REASON[r.pendingReason] ?? r.pendingReason}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {r.entitlementStatus
                      ? `${r.pmPackage || "Package"} · คงเหลือ ${r.packageRoundsRemaining ?? "-"}/${r.packageRoundsTotal}${r.entitlementStatus === "EXHAUSTED" ? " (ใช้ครบ)" : ""}${r.packagePending ? ` · รอเปิดสิทธิ์ ${r.packagePending} ชุด` : ""}${r.packageExpired ? ` · หมดอายุ ${r.packageExpired} ชุด` : ""}`
                      : r.pmMode === "RENTAL" ? "เช่า" : "-"}
                    {(r.sources ?? []).length ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} data-testid="pm-dash-sources">
                        แหล่ง: {(r.sources ?? []).map((x) => SOURCE_LABEL[x] ?? x).join(" · ")}
                      </Typography>
                    ) : null}
                    {r.rentalContract ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        สัญญา {r.rentalContract.contractNo} · {r.rentalContract.startDate} – {r.rentalContract.endDate || "-"}
                      </Typography>
                    ) : null}
                    {r.serviceState === "STOPPED" ? (
                      <Chip size="small" color="error" label="หยุดบริการ" title={r.serviceStateReason} sx={{ mt: 0.5 }} data-testid="pm-dash-stopped" />
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {r.caretaker ? r.caretaker.name || techName(r.caretaker.id) : <Typography variant="caption" color="text.secondary">ยังไม่กำหนด</Typography>}
                    {canManagePm ? (
                      <Button size="small" sx={{ display: "block", px: 0 }} onClick={() => { setCtReadOnly(false); setCtFor({ id: r.equipmentId, serial: r.serial, current: r.caretaker ?? null }); }} data-testid="caretaker-edit">
                        {r.caretaker ? "เปลี่ยน" : "ตั้งผู้ดูแล"}
                      </Button>
                    ) : r.caretaker ? (
                      <Button size="small" sx={{ display: "block", px: 0 }} onClick={() => { setCtReadOnly(true); setCtFor({ id: r.equipmentId, serial: r.serial, current: r.caretaker ?? null }); }} data-testid="caretaker-history">
                        ประวัติผู้ดูแล
                      </Button>
                    ) : null}
                  </TableCell>
                  <TableCell>{r.roundTechnicianIds?.length ? r.roundTechnicianIds.map(techName).join(", ") : "-"}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ display: "block" }}>{WORK_LABEL[r.workState ?? "NONE"]}</Typography>
                    {(r.related?.queues ?? []).map((q) => (
                      <Box key={q.queueId}>
                        <Link href={`/service-queue/${q.queueId}`} className="code">{q.queueNo}</Link>
                      </Box>
                    ))}
                    {(r.related?.jobs ?? []).map((j) => (
                      <Box key={j.jobId}>
                        <Link href={`/jobs/${j.jobId}`} className="code">{j.jobId}</Link>
                        {j.status === "HOLD" ? " (พักงาน)" : ""}
                      </Box>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
      {ctFor ? (
        <CaretakerDialog
          open
          equipmentId={ctFor.id}
          serial={ctFor.serial}
          current={ctFor.current}
          techs={techs}
          readOnly={ctReadOnly}
          onClose={() => setCtFor(null)}
          onSaved={() => {
            setCtFor(null);
            void load();
          }}
        />
      ) : null}
    </Box>
  );
}
