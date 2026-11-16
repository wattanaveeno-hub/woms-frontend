"use client";

// ตารางคิวแยกช่าง (QUEUE 02) + ตัวเลข Dashboard (QUEUE 04)
// Admin เห็นทั้งหมดรวมคิวยังไม่จัดช่าง · ช่างเห็นเฉพาะคิวที่ได้รับมอบหมาย (บังคับที่ backend)
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import DateField from "@/components/DateField";
import Link from "next/link";
import Box from "@mui/material/Box";
import UserAvatar from "@/components/UserAvatar";
import { usePrefetchAvatars } from "@/lib/avatarStore";

function personCell(id: string | undefined, name: string | undefined, empty: string) {
  if (!id || !name) return empty;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      <UserAvatar userId={id} name={name} size={22} />
      <span>{name}</span>
    </Box>
  );
}
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
import { WomsStatusChip } from "@/components/woms";
import { sqApi, type QueueSummary, type ServiceQueue } from "@/lib/serviceQueueApi";
import QueueBoard from "@/components/serviceQueue/QueueBoard";
import TechQueueList from "@/components/serviceQueue/TechQueueList";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { SQ_STATUS_LABEL, SUMMARY_BUCKETS, jnLabel, queueNoLabel, type SqStatus } from "@/lib/serviceQueueRules";

// D-05: ร่างไม่อยู่ในรายการปกติ — ผู้เปิดคิวเลือก "ร่างของฉัน" (backend คืนเฉพาะร่างของผู้เรียก)
const STATUS_OPTIONS = (Object.keys(SQ_STATUS_LABEL) as SqStatus[]).filter((s) => s !== "DRAFT").map((s) => ({ value: s, label: SQ_STATUS_LABEL[s] }));
const DRAFT_OPTION = { value: "DRAFT", label: "ร่างของฉัน (ยังไม่ส่ง)" };

function ServiceQueueListInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { has } = useAuth();
  const admin = has("svcqueue:admin");
  const isTech = has("svcqueue:respond") && !has("svcqueue:view_all");
  const canCreate = has("svcqueue:request") || admin;

  const [status, setStatus] = useState(params.get("status") ?? "");
  const [mode, setMode] = useState(params.get("mode") ?? "");
  const [techId, setTechId] = useState(params.get("techId") ?? "");
  const [date, setDate] = useState(params.get("date") ?? "");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [mine, setMine] = useState(params.get("mine") ?? "");
  // Redesign: Admin/เซลล์ เริ่มที่บอร์ดตามขั้น · ช่างเริ่มที่รายการ (เห็นเฉพาะคิวของตัวเอง)
  const [view, setView] = useState<"board" | "table">((params.get("view") as "board" | "table") || (isTech ? "table" : "board"));

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
    if (view !== (isTech ? "table" : "board")) s.set("view", view);
    router.replace(`/service-queue${s.toString() ? `?${s}` : ""}`, { scroll: false });
  }, [status, mode, techId, date, q, mine, view, isTech, router]);

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

  usePrefetchAvatars(rows.flatMap((r) => [r.ownerSaleId, r.techId]));
  const columns: WomsColumn<ServiceQueue>[] = useMemo(
    () => [
      {
        key: "queueNo",
        label: "เลขคิว / JN",
        sortValue: (r) => r.queueNo,
        render: (r) => (
          <Box>
            <Link href={`/service-queue/${r.id}`} style={{ fontWeight: 600 }}>
              {queueNoLabel(r)}
            </Link>
            {/* UAT2-13: JN แยกบรรทัด มีป้ายชัด */}
            <Typography variant="caption" component="div" sx={{ color: r.jobId ? "primary.main" : "text.secondary", fontWeight: r.jobId ? 700 : 400 }} data-testid="queue-row-jn">
              {jnLabel(r.jobId)}
            </Typography>
          </Box>
        ),
      },
      { key: "jobName", label: "ร้าน", sortValue: (r) => r.jobName, render: (r) => r.jobName },
      { key: "jobType", label: "ประเภทงาน", sortValue: (r) => r.jobType, render: (r) => typeLabel(r.jobType), hideBelowLg: true },
      // UAT2-12: รูปประจำผู้ใช้ข้างชื่อเซลล์/ช่าง (ไม่มีรูป = วงกลมสีประจำตัว + อักษรแรก)
      { key: "sale", label: "เซลล์", sortValue: (r) => r.ownerSaleName, render: (r) => personCell(r.ownerSaleId, r.ownerSaleName, "—"), hideBelowLg: true },
      { key: "tech", label: "ช่าง", sortValue: (r) => r.techName, render: (r) => personCell(r.techId, r.techName, "ยังไม่จัด") },
      {
        key: "appt",
        label: "วันเวลาเริ่ม · ช่วง",
        sortValue: (r) => `${r.current?.date ?? ""} ${r.current?.time ?? ""}`,
        render: (r) => apptText(r.current?.date ?? "", r.current?.time ?? "", r.current?.period ?? ""),
      },
      { key: "round", label: "รอบนัด", align: "center", sortValue: (r) => r.roundNo, render: (r) => r.roundNo || "—", hideBelowLg: true },
      { key: "status", label: "สถานะ", sortValue: (r) => r.status, render: (r) => (
          <>
            <QueueStatusChip status={r.status} mode={r.mode} />
            {r.sourceLabel ? <div><WomsStatusChip label={r.sourceLabel} tone="info" /></div> : null}
          </>
        ) },
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

  // ช่าง: หน้า "คิวของฉัน" ตามดีไซน์มือถือช่าง (แบ่งตามสิ่งที่ต้องทำ) — Admin/เซลล์ใช้หน้าเดิมด้านล่าง
  if (isTech) {
    return (
      <>
        <WomsPageHeader title="คิวของฉัน" subtitle="คิวที่แอดมินส่งให้ · กดเพื่อรับคิว เสนอวัน หรือแจ้งไม่สะดวก" />
        {error ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>ลองใหม่</Button>}>
            {error}
          </Alert>
        ) : loading && rows.length === 0 ? (
          <WomsLoadingState rows={3} />
        ) : (
          <TechQueueList rows={rows} />
        )}
      </>
    );
  }

  return (
    <>
      <WomsPageHeader
        title="คิวช่าง"
        subtitle={isTech ? "คิวที่ได้รับมอบหมาย — เสนอวันเวลาเริ่ม หรือแจ้งไม่สะดวกรับคิว" : view === "board" ? "คำขอที่ยังไม่เป็นใบงาน · เรียงจากรอนานที่สุด" : "คำขอที่ยังไม่เป็นใบงาน · เรียงจากอัปเดตล่าสุด"}
        actions={
          canCreate ? (
            <Stack direction="row" spacing={1}>
              <Button
                variant={status === "DRAFT" ? "contained" : "outlined"}
                onClick={() => {
                  setStatus(status === "DRAFT" ? "" : "DRAFT");
                  setMode("");
                  setMine("");
                }}
                data-testid="queue-my-drafts"
              >
                ร่างของฉัน
              </Button>
              <Button component={Link} href="/service-queue/new" variant="contained" startIcon={<AddIcon />}>
                เปิดคิว
              </Button>
            </Stack>
          ) : null
        }
      />

      {summary && !(view === "board" && !isTech) ? (
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
        {view === "table" ? (
          <WomsSelectFilter label="สถานะ" value={status.includes(",") ? "" : status} onChange={setStatus} options={canCreate ? [...STATUS_OPTIONS, DRAFT_OPTION] : STATUS_OPTIONS} />
        ) : null}
        {!isTech ? (
          <WomsSelectFilter label="ช่าง" value={techId} onChange={setTechId} options={techs.map((t) => ({ value: t.id, label: t.name }))} minWidth={160} />
        ) : null}
        <DateField size="small" label="วันนัด" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { "aria-label": "วันนัด" } }} sx={{ width: { xs: "100%", md: 170 } }} data-testid="queue-date-filter" />
        {has("svcqueue:request") && !admin ? (
          <WomsSelectFilter label="เจ้าของงาน" value={mine} onChange={setMine} options={[{ value: "1", label: "เฉพาะคิวของฉัน" }]} allLabel="ทุกคิว" />
        ) : null}
      </WomsFilterPanel>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={view}
        onChange={(_, v) => {
          if (!v) return;
          setView(v);
          // บอร์ดแสดงทุกขั้นพร้อมกัน — ล้างตัวกรองสถานะ/ร่าง
          if (v === "board") {
            setStatus("");
            setMode("");
          }
        }}
        aria-label="มุมมอง"
        sx={{ mb: 1.5 }}
      >
        <ToggleButton value="board">บอร์ดตามขั้น</ToggleButton>
        <ToggleButton value="table">ตาราง</ToggleButton>
      </ToggleButtonGroup>

      {view === "board" ? (
        error ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>ลองใหม่</Button>}>
            {error}
          </Alert>
        ) : loading && rows.length === 0 ? (
          <WomsLoadingState rows={3} />
        ) : (
          <QueueBoard rows={rows} onChanged={load} />
        )
      ) : (
      <WomsDataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle={status === "DRAFT" ? "ไม่มีร่างคิว" : "ไม่มีคิวตามเงื่อนไข"}
        initialSort={{ key: "queueNo", dir: "desc" }}
        caption="รายการคิวช่าง"
        renderCard={(r) => (
          <Link href={`/service-queue/${r.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <Stack spacing={0.5} sx={{ p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography fontWeight={700}>{queueNoLabel(r)}</Typography>
                  <Typography variant="caption" sx={{ color: r.jobId ? "primary.main" : "text.secondary", fontWeight: r.jobId ? 700 : 400 }}>
                    {jnLabel(r.jobId)}
                  </Typography>
                </Box>
                <QueueStatusChip status={r.status} mode={r.mode} />
                {r.sourceLabel ? <WomsStatusChip label={r.sourceLabel} tone="info" /> : null}
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
      )}
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
