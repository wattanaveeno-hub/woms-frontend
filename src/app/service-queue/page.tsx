"use client";

// ตารางคิวแยกช่าง (QUEUE 02) + ตัวเลข Dashboard (QUEUE 04)
// Admin เห็นทั้งหมดรวมคิวยังไม่จัดช่าง · ช่างเห็นเฉพาะคิวที่ได้รับมอบหมาย (บังคับที่ backend)
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { AuthUser } from "@/lib/types";
import {
  WomsDataTable,
  WomsFilterPanel,
  WomsLoadingState,
  WomsPageHeader,
  WomsPermissionGate,
  WomsSearchBar,
  WomsSelectFilter,
  WomsStatCard,
  WomsStatGrid,
  type WomsColumn,
} from "@/components/woms";
import { QueueStatusChip, apptText, typeLabel } from "@/components/serviceQueue/QueueBits";
import { sqApi, type QueueSummary, type ServiceQueue } from "@/lib/serviceQueueApi";
import { SQ_STATUS_LABEL, SUMMARY_BUCKETS, type SqStatus } from "@/lib/serviceQueueRules";

const STATUS_OPTIONS = (Object.keys(SQ_STATUS_LABEL) as SqStatus[]).map((s) => ({ value: s, label: SQ_STATUS_LABEL[s] }));

function ServiceQueueListInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { has } = useAuth();
  const admin = has("svcqueue:admin");
  const isTech = has("svcqueue:respond") && !has("svcqueue:view_all");

  const [status, setStatus] = useState(params.get("status") ?? "");
  const [mode, setMode] = useState(params.get("mode") ?? "");
  const [techId, setTechId] = useState(params.get("techId") ?? "");
  const [date, setDate] = useState(params.get("date") ?? "");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [mine, setMine] = useState(params.get("mine") ?? "");

  const [rows, setRows] = useState<ServiceQueue[]>([]);
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [techs, setTechs] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ตัวกรองอยู่ใน URL — กดกลับ/แชร์ลิงก์แล้วได้มุมมองเดิม
  useEffect(() => {
    const s = new URLSearchParams();
    if (status) s.set("status", status);
    if (mode) s.set("mode", mode);
    if (techId) s.set("techId", techId);
    if (date) s.set("date", date);
    if (q) s.set("q", q);
    if (mine) s.set("mine", mine);
    router.replace(`/service-queue${s.toString() ? `?${s}` : ""}`, { scroll: false });
  }, [status, mode, techId, date, q, mine, router]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([sqApi.list({ status, mode, techId, date, q: q.trim(), mine }), sqApi.summary()])
      .then(([l, s]) => {
        setRows(l.items);
        setSummary(s);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "โหลดคิวไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [status, mode, techId, date, q, mine]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!isTech) api.listTechnicians().then((r) => setTechs(r.items)).catch(() => setTechs([]));
  }, [isTech]);

  const columns: WomsColumn<ServiceQueue>[] = useMemo(
    () => [
      {
        key: "queueNo",
        label: "เลขคิว / JN",
        sortValue: (r) => r.queueNo,
        render: (r) => (
          <Link href={`/service-queue/${r.id}`} style={{ fontWeight: 600 }}>
            {r.queueNo}
            {r.jobId ? <Typography component="span" variant="body2" color="text.secondary">{` · ${r.jobId}`}</Typography> : null}
          </Link>
        ),
      },
      { key: "jobName", label: "ร้าน", sortValue: (r) => r.jobName, render: (r) => r.jobName },
      { key: "jobType", label: "ประเภทงาน", sortValue: (r) => r.jobType, render: (r) => typeLabel(r.jobType), hideBelowLg: true },
      { key: "sale", label: "เซลล์", sortValue: (r) => r.ownerSaleName, render: (r) => r.ownerSaleName || "—", hideBelowLg: true },
      { key: "tech", label: "ช่าง", sortValue: (r) => r.techName, render: (r) => r.techName || "ยังไม่จัด" },
      {
        key: "appt",
        label: "วันเวลาเริ่ม · ช่วง",
        sortValue: (r) => `${r.current?.date ?? ""} ${r.current?.time ?? ""}`,
        render: (r) => apptText(r.current?.date ?? "", r.current?.time ?? "", r.current?.period ?? ""),
      },
      { key: "round", label: "รอบนัด", align: "center", sortValue: (r) => r.roundNo, render: (r) => r.roundNo || "—", hideBelowLg: true },
      { key: "status", label: "สถานะ", sortValue: (r) => r.status, render: (r) => <QueueStatusChip status={r.status} mode={r.mode} /> },
    ],
    []
  );

  const bucketActive = (query: string) => {
    const p = new URLSearchParams(query);
    return (p.get("status") ?? "") === status && (p.get("mode") ?? "") === mode;
  };
  const applyBucket = (query: string) => {
    const p = new URLSearchParams(query);
    const same = bucketActive(query);
    setStatus(same ? "" : p.get("status") ?? "");
    setMode(same ? "" : p.get("mode") ?? "");
    setMine("");
  };

  const activeCount = [status, mode, techId, date, mine].filter(Boolean).length;

  return (
    <>
      <WomsPageHeader
        title="คิวช่าง"
        subtitle={isTech ? "คิวที่ได้รับมอบหมาย — เสนอวันเวลาเริ่ม หรือแจ้งไม่สะดวกรับคิว" : "เปิดคิว → จัดช่าง → ช่างเสนอวัน → คอนเฟิร์มลูกค้า → Admin เปิดงาน"}
        actions={
          has("svcqueue:request") || admin ? (
            <Button component={Link} href="/service-queue/new" variant="contained" startIcon={<AddIcon />}>
              เปิดคิว
            </Button>
          ) : null
        }
      />

      {summary ? (
        isTech ? (
          <WomsStatGrid max={2}>
            <WomsStatCard
              value={summary.myResponse}
              label="คิวที่ต้องตอบ"
              hint="รอคุณเสนอวัน/แจ้งไม่รับ"
              tone={summary.myResponse ? "error" : "neutral"}
              active={status === "WAIT_TECH"}
              onClick={() => setStatus(status === "WAIT_TECH" ? "" : "WAIT_TECH")}
            />
            <WomsStatCard value={summary.waitCustomer + summary.readyToOpen} label="รอลูกค้า/รอเปิดงาน" tone="info" />
          </WomsStatGrid>
        ) : (
          <WomsStatGrid max={5}>
            {SUMMARY_BUCKETS.map((b) => (
              <WomsStatCard key={b.key} value={summary[b.key]} label={b.label} tone={summary[b.key] ? b.tone : "neutral"} active={bucketActive(b.query)} onClick={() => applyBucket(b.query)} />
            ))}
          </WomsStatGrid>
        )
      ) : null}

      {!admin && has("svcqueue:request") && summary?.myToConfirm ? (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => { setStatus("WAIT_CUSTOMER"); setMine("1"); setMode(""); }}>
              ดูรายการ
            </Button>
          }
        >
          คิวของคุณ {summary.myToConfirm} รายการรอคอนเฟิร์มลูกค้า
        </Alert>
      ) : null}

      <WomsFilterPanel
        search={<WomsSearchBar value={q} onChange={setQ} placeholder="ค้นเลขคิว / JN / ชื่อร้าน / ผู้ติดต่อ" label="ค้นหา" />}
        activeCount={activeCount}
        onClear={() => {
          setStatus("");
          setMode("");
          setTechId("");
          setDate("");
          setMine("");
        }}
      >
        <WomsSelectFilter label="สถานะ" value={status.includes(",") ? "" : status} onChange={setStatus} options={STATUS_OPTIONS} />
        {!isTech ? (
          <WomsSelectFilter label="ช่าง" value={techId} onChange={setTechId} options={techs.map((t) => ({ value: t.id, label: t.name }))} minWidth={160} />
        ) : null}
        <TextField size="small" type="date" label="วันนัด" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        {has("svcqueue:request") && !admin ? (
          <WomsSelectFilter label="เจ้าของงาน" value={mine} onChange={setMine} options={[{ value: "1", label: "เฉพาะคิวของฉัน" }]} allLabel="ทุกคิว" />
        ) : null}
      </WomsFilterPanel>

      <WomsDataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="ไม่มีคิวตามเงื่อนไข"
        initialSort={{ key: "queueNo", dir: "desc" }}
        caption="รายการคิวช่าง"
        renderCard={(r) => (
          <Link href={`/service-queue/${r.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <Stack spacing={0.5} sx={{ p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography fontWeight={700}>
                  {r.queueNo}
                  {r.jobId ? ` · ${r.jobId}` : ""}
                </Typography>
                <QueueStatusChip status={r.status} mode={r.mode} />
              </Stack>
              <Typography variant="body2">{r.jobName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {typeLabel(r.jobType)} · เซลล์ {r.ownerSaleName || "—"} · ช่าง {r.techName || "ยังไม่จัด"}
              </Typography>
              <Typography variant="caption">{apptText(r.current?.date ?? "", r.current?.time ?? "", r.current?.period ?? "")}</Typography>
            </Stack>
          </Link>
        )}
      />
    </>
  );
}

export default function ServiceQueuePage() {
  return (
    <WomsPermissionGate perm="svcqueue:view">
      <Suspense fallback={<WomsLoadingState />}>
        <ServiceQueueListInner />
      </Suspense>
    </WomsPermissionGate>
  );
}
