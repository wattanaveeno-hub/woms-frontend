"use client";

// ---------------------------------------------------------------------------
// ตาราง PM รายเดือน (WOMS_PM_Monthly_Requirements_2026-11-09 · WOMS_Nav_PM_Handoff ส่วนที่ 2)
//   PM-01 สองมุมมอง (ภาพรวม PM / ตารางรายช่าง) จากรอบ PM ชุดเดียวกัน · เปิดที่ภาพรวม + ทุกเดือน
//   PM-02 สถานะรายเดือนคำนวณที่ backend (GET /api/pm/rounds) — หน้านี้แสดงผลเท่านั้น
//   PM-04 เปลี่ยนช่าง 2 แบบ (ปุ่มตามสิทธิ์ PM-11 · backend ตรวจซ้ำ) · 3.3 ช่างของรอบเสนอวันเวลาได้
//   แผน PM รายเดือนเดิม (อนุมัติ/ส่งช่าง) ยังใช้ได้ที่ /pm/plans ในช่วงเปลี่ยนผ่าน (Q-02)
//   v1.2: ค้นหา (PM-06) · คอลัมน์หมายเหตุลูกค้า (PM-20) · นัด PM ก่อนรอบ / PM นอกแผน (PM-07) · ช่างเสนอคิวจากแถว (PM-22)
//   แสดงเมื่อเปิด PM_MONTHLY_ENABLED เท่านั้น (app/pm/page.tsx)
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError, PmReassignResult, PmRoundRow, PmRoundsResponse } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { SQ_STATUS_LABEL, type SqStatus } from "@/lib/serviceQueueRules";
import { useUrlFilters } from "@/lib/urlFilters";
import {
  PM_PLAN_MODE_LABEL,
  PM_ROUND_TYPE_LABEL,
  PROPOSE_BLOCK_TEXT,
  addMonth,
  canPullEarly,
  cleanSearch,
  statusText,
  dateLabel,
  monthBadge,
  monthLabel,
  parseRoundFilters,
  periodOptionGroups,
  remainingText,
  shortYearMonth,
  techCell,
  togglePeriod,
  type PmView,
} from "@/lib/pmRoundRules";
import {
  PmRoundStatusChip,
  WomsDataTable,
  WomsErrorState,
  WomsFormSection,
  WomsPageHeader,
  WomsSearchBar,
  WomsSelectFilter,
  WomsStatCard,
  WomsStatGrid,
  type WomsColumn,
} from "@/components/woms";
import PmRoundDetailDialog from "@/components/pm/PmRoundDetailDialog";
import PmReassignDialog from "@/components/pm/PmReassignDialog";
import PmProposeDialog from "@/components/pm/PmProposeDialog";
import PmNoteDialog from "@/components/pm/PmNoteDialog";
import PmEarlyDialog from "@/components/pm/PmEarlyDialog";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/Edit";

const mono = { fontFamily: 'ui-monospace, "SFMono-Regular", "JetBrains Mono", "Consolas", monospace' } as const;

export default function PmMonthlyView() {
  const { has } = useAuth();
  const [raw, setRaw] = useUrlFilters({ view: "overview", period: "", tech: "", q: "" });
  const f = parseRoundFilters({ get: (k) => (raw as Record<string, string>)[k] ?? null });
  // PM-06: พิมพ์แล้วค้นหาหลังหยุดพิมพ์ 300 ms · ล้างคำค้นคงตัวกรองเดิม
  const [typed, setTyped] = useState(f.q);
  useEffect(() => {
    const t = setTimeout(() => {
      const next = cleanSearch(typed);
      if (next !== f.q) setRaw({ q: next });
    }, 300);
    return () => clearTimeout(t);
  }, [typed, f.q, setRaw]);
  const [data, setData] = useState<PmRoundsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<PmRoundRow | null>(null);
  const [editing, setEditing] = useState<PmRoundRow | null>(null);
  const [proposing, setProposing] = useState<PmRoundRow | null>(null);
  const [noting, setNoting] = useState<PmRoundRow | null>(null);
  const [pulling, setPulling] = useState<PmRoundRow | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const fbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      // mockup v1.2: ช่องค้นหาอยู่ในภาพรวมเท่านั้น
      setData(await api.pmRounds({ view: f.view, period: f.period, technicianId: f.technicianId, q: f.view === "overview" ? f.q : "" }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดตาราง PM ไม่สำเร็จ");
      setData(null);
    }
  }, [f.view, f.period, f.technicianId, f.q]);
  useEffect(() => {
    setData(null);
    void load();
  }, [load]);
  useEffect(() => () => void (fbTimer.current && clearTimeout(fbTimer.current)), []);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    if (fbTimer.current) clearTimeout(fbTimer.current);
    fbTimer.current = setTimeout(() => setFeedback(null), 5000);
  };
  const onReassigned = (r: PmReassignResult) => {
    setEditing(null);
    setDetail(null);
    const who = (x: { name: string } | null) => x?.name || "ยังไม่ระบุช่าง";
    showFeedback(
      r.scope === "ROUND_ONLY"
        ? `บันทึกแล้ว · ${r.serial} · ช่างเฉพาะรอบ ${monthLabel(r.roundMonth)}: ${who(r.to)}${r.queueId ? " (เปลี่ยนช่างของคิวแล้ว รอช่างใหม่ตอบรับ)" : ""} · แจ้งช่างที่เกี่ยวข้องแล้ว`
        : `บันทึกแล้ว · ${r.serial} · ผู้ดูแลประจำตั้งแต่รอบถัดไป: ${who(r.ownerAfter)} · รอบนี้ยังเป็น ${who(r.from)} · แจ้งช่างที่เกี่ยวข้องแล้ว`
    );
    void load();
  };

  const cur = data?.currentMonth ?? "";
  const overview = f.view === "overview";
  // PM-22: backend ตัดสินว่าเสนอคิวได้หรือไม่ (ช่างของรอบที่ยืนยันแล้ว · ไม่มีคิว/JN · ถึงรอบ) — ตรวจซ้ำตอนส่ง
  const canPropose = (r: PmRoundRow) => has("svcqueue:respond") && !!r.canPropose;
  const canRequestEarly = !!data?.canRequestEarly;
  // ป้ายใต้สถานะ (mockup v1.2): ดึงมาก่อนรอบ · ขั้นของคิว · นัดแล้ว · เปิดงานแล้ว · รอช่างเสนอคิว/รอระบุช่าง
  const tagOf = (r: PmRoundRow) => (r.status !== "DONE" && r.earlyMode ? "ดึงมาก่อนรอบ" : "");
  const queueLabelOf = (r: PmRoundRow) => {
    if (r.status === "DONE") return "";
    if (r.queue) return SQ_STATUS_LABEL[r.queue.status as SqStatus] ?? r.queue.status;
    if (r.openJobId) return "เปิดงานแล้ว";
    if (r.appointment?.state === "CONFIRMED") return `นัดแล้ว ${dateLabel(r.appointment.date)}`;
    if (r.earlyMode || r.kind === "UNSCHEDULED") return r.roundTech ? "รอช่างเสนอคิว" : "รอระบุช่าง";
    return "";
  };

  const groupLabels = useMemo(() => new Map((data?.groups ?? []).map((g) => [g.key, g.label])), [data]);
  const groupBy = useMemo(
    () => ({
      key: (r: PmRoundRow) => r.groupKey,
      order: (data?.groups ?? []).map((g) => g.key),
      label: (k: string) => (overview ? (k === "REVIEW" ? "รอตรวจข้อมูล" : monthLabel(k, true)) : groupLabels.get(k) ?? k),
      badge: (k: string) => (overview ? (k === "REVIEW" ? "?" : monthBadge(k)) : k === "UNASSIGNED" ? "–" : (groupLabels.get(k) ?? "").replace(/^ช่าง\s*/, "").slice(0, 1) || "?"),
      countLabel: (n: number) => `${n} เครื่อง`,
    }),
    [data, overview, groupLabels]
  );

  const techButton = (r: PmRoundRow) => {
    const t = techCell(r);
    const sub = t.roundOnly ? (
      <Typography variant="body2" sx={{ fontSize: 12 }}>
        ปรับเฉพาะรอบ
      </Typography>
    ) : null;
    if (r.status === "DONE" || !r.canReassign)
      return (
        <>
          <Typography component="span" sx={{ fontSize: 14, color: t.unassigned ? "error.main" : "text.primary", whiteSpace: "nowrap" }}>
            {t.unassigned ? "ยังไม่ระบุช่าง" : t.text}
          </Typography>
          {sub}
        </>
      );
    return (
      <>
        <Button
          variant="text"
          size="small"
          onClick={() => setEditing(r)}
          endIcon={<EditIcon sx={{ fontSize: "16px !important" }} />}
          aria-label={`${t.unassigned ? "ระบุช่าง" : `${t.text} เปลี่ยนช่าง`} ${r.serial}`}
          sx={{ px: 0.5, minWidth: 0, minHeight: { xs: 44, md: 32 }, fontWeight: 600, color: t.unassigned ? "error.main" : "primary.dark", justifyContent: "flex-start", whiteSpace: "nowrap" }}
        >
          {t.text}
        </Button>
        {sub}
      </>
    );
  };
  const typeCell = (r: PmRoundRow) => {
    const rem = remainingText(r.package);
    return (
      <>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.primary", whiteSpace: { md: "nowrap" } }}>{PM_ROUND_TYPE_LABEL[r.type]}</Typography>
        {rem ? (
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: rem.zero ? "error.main" : "primary.dark" }}>
            {r.type === "RENTAL" ? `แพ็กเกจ ${rem.text}` : rem.text}
          </Typography>
        ) : null}
        {r.entitlementEnded ? <Typography variant="body2" sx={{ fontSize: 12 }}>สิทธิ์สิ้นสุด</Typography> : null}
        {r.serviceStopped ? <Typography variant="body2" sx={{ fontSize: 12 }}>หยุดบริการ</Typography> : null}
      </>
    );
  };
  const statusCell = (r: PmRoundRow) => (
    <Stack spacing={0.5} alignItems="flex-start">
      <PmRoundStatusChip status={r.status} label={statusText(r)} />
      {r.kind === "UNSCHEDULED" ? (
        <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 700, color: "primary.dark" }}>
          PM นอกแผน{r.quotationNo ? ` · ${r.quotationNo}` : ""}
        </Typography>
      ) : null}
      {tagOf(r) ? (
        <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600 }}>
          {tagOf(r)}
        </Typography>
      ) : null}
      {queueLabelOf(r) ? (
        <Typography variant="body2" sx={{ fontSize: 12 }}>
          {queueLabelOf(r)}
        </Typography>
      ) : null}
      {canPropose(r) ? (
        <Button size="small" variant="contained" onClick={() => setProposing(r)} aria-label={`เสนอคิว ${r.serial}`} sx={{ minHeight: { xs: 44, md: 30 } }}>
          เสนอคิว
        </Button>
      ) : has("svcqueue:respond") && r.roundTech && r.proposeBlock && PROPOSE_BLOCK_TEXT[r.proposeBlock] && r.proposeBlock !== "NOT_MINE" ? (
        <Typography variant="body2" sx={{ fontSize: 12 }}>
          {PROPOSE_BLOCK_TEXT[r.proposeBlock]}
        </Typography>
      ) : null}
      {r.queue && r.status !== "DONE" ? (
        // PM-22: มีคิวอยู่แล้ว = ดำเนินการต่อด้วยเลขเดิมในระบบจัดการคิว
        <MuiLink component={Link} href={`/service-queue/${r.queue.queueId}`} aria-label={`ดูคิว ${r.serial}`} sx={{ fontSize: 13, fontWeight: 600, minHeight: { xs: 44, md: "auto" }, display: "inline-flex", alignItems: "center" }}>
          ดูคิว <span style={{ ...mono, marginLeft: 4 }}>{r.queue.queueNo || ""}</span>
        </MuiLink>
      ) : null}
    </Stack>
  );
  const noteCell = (r: PmRoundRow) => (
    <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
      <Typography
        variant="body2"
        title={r.customerNote || undefined}
        sx={{ flex: "1 1 auto", minWidth: 0, fontSize: 13, color: r.customerNote ? "text.primary" : "text.secondary", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}
      >
        {r.customerNote || "–"}
      </Typography>
    </Stack>
  );
  const noteCellWithAction = (r: PmRoundRow) => (
    <>
      {noteCell(r)}
      {r.canEditNote ? (
        <Button
          size="small"
          variant="text"
          onClick={() => setNoting(r)}
          aria-label={`${r.customerNote ? "แก้หมายเหตุ" : "เพิ่มหมายเหตุ"} ${r.serial}`}
          sx={{ px: 0.5, minWidth: 0, minHeight: { xs: 44, md: 28 }, fontWeight: 600, whiteSpace: "nowrap" }}
        >
          {r.customerNote ? "แก้หมายเหตุ" : "เพิ่มหมายเหตุ"}
        </Button>
      ) : null}
    </>
  );
  const roundCell = (r: PmRoundRow) => (
    <>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.primary", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{monthLabel(r.roundMonth)}</Typography>
      {r.plannedMonth && r.plannedMonth !== r.roundMonth ? (
        <Typography variant="body2" sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {r.kind === "UNSCHEDULED" ? "รอบตามแผน" : "แผนเดิม"} {monthLabel(r.plannedMonth)}
        </Typography>
      ) : null}
      {r.earlyMode ? (
        <Typography variant="body2" sx={{ fontSize: 12 }}>
          {PM_PLAN_MODE_LABEL[r.earlyMode]}
        </Typography>
      ) : null}
    </>
  );
  const shopLink = (r: PmRoundRow) => (
    <MuiLink
      component="button"
      type="button"
      underline="hover"
      onClick={() => setDetail(r)}
      aria-label={`${r.customerName} ดูรายละเอียด ${r.serial}`}
      sx={{ fontWeight: 600, color: "text.primary", textAlign: "left", fontSize: 14, minHeight: { xs: 44, md: "auto" } }}
    >
      {r.customerName || "-"}
    </MuiLink>
  );
  const salesChip = (r: PmRoundRow) =>
    r.sales ? (
      <Box component="span" sx={{ display: "inline-block", px: 1, py: 0.25, borderRadius: "4px", bgcolor: "neutral.light", color: "neutral.dark", fontSize: 12, fontWeight: 700 }}>
        {r.sales.name}
      </Box>
    ) : (
      <Typography component="span" variant="body2">
        ยังไม่ระบุ
      </Typography>
    );

  const cols: WomsColumn<PmRoundRow>[] = [
    {
      key: "shop",
      label: "ลูกค้า / สาขา",
      render: (r) => (
        <>
          {shopLink(r)}
          <Typography variant="body2">{r.siteLabel || "-"}</Typography>
        </>
      ),
    },
    {
      key: "model",
      label: "รุ่น / SN",
      width: 120,
      render: (r) => (
        <>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.primary" }}>{r.model || "-"}</Typography>
          <Typography sx={{ ...mono, fontSize: 12, color: "text.secondary" }}>
            {r.serial}
            {r.pendingSerial ? " · รอ SN" : ""}
          </Typography>
        </>
      ),
    },
    {
      key: "round",
      label: "เดือนจัดงาน",
      width: 104,
      render: roundCell,
    },
    { key: "sales", label: "เซลล์", render: salesChip, width: 64 },
    { key: "tech", label: "ช่าง", render: techButton, width: 112 },
    { key: "type", label: "ประเภท PM", render: typeCell, width: 136 },
    { key: "status", label: "สถานะ", render: statusCell, width: 150 },
    { key: "note", label: "หมายเหตุ", render: noteCellWithAction, width: 160, hideBelowLg: true },
  ];

  const label = (txt: string) => (
    <Typography component="span" variant="body2" sx={{ fontSize: 12, mr: 0.5 }}>
      {txt}
    </Typography>
  );
  const card = (r: PmRoundRow) => (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", columnGap: 1.5, rowGap: 1 }}>
      <Box sx={{ minWidth: 0 }}>
        {shopLink(r)}
        <Typography variant="body2">{r.siteLabel || "-"}</Typography>
      </Box>
      <Box sx={{ textAlign: "right" }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.primary" }}>{r.model || "-"}</Typography>
        <Typography sx={{ ...mono, fontSize: 12, color: "text.secondary" }}>{r.serial}</Typography>
      </Box>
      <Box>
        {label("เดือนจัดงาน")}
        {roundCell(r)}
      </Box>
      <Box sx={{ textAlign: "right" }}>
        {label("เซลล์")}
        {salesChip(r)}
      </Box>
      <Box>{techButton(r)}</Box>
      <Box sx={{ textAlign: "right" }}>{typeCell(r)}</Box>
      <Box sx={{ gridColumn: "1 / -1" }}>{statusCell(r)}</Box>
      <Box sx={{ gridColumn: "1 / -1", minWidth: 0 }}>
        {label("หมายเหตุ")}
        {noteCellWithAction(r)}
      </Box>
    </Box>
  );

  const techOptions = [...(data?.technicians ?? []).map((t) => ({ value: t.id, label: t.name })), { value: "UNASSIGNED", label: "ยังไม่ระบุช่าง" }];
  const groupCount = data?.groups.length ?? 0;
  const counts = data?.counts ?? { OVERDUE: 0, DUE: 0, UPCOMING: 0 };

  return (
    <>
      <WomsPageHeader
        title="ตาราง PM รายเดือน"
        subtitle={cur ? `เดือนปัจจุบัน ${monthLabel(cur, true)} · นับรอบตามเดือนและปีของรอบ เวลาไทย` : "นับรอบตามเดือนและปีของรอบ เวลาไทย"}
        actions={
          <>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={f.view}
              onChange={(_, v: PmView | null) => v && setRaw({ view: v })}
              aria-label="มุมมองตาราง PM"
              sx={{ "& .MuiToggleButton-root": { minHeight: { xs: 44, md: 36 }, px: 2, fontWeight: 600 } }}
            >
              <ToggleButton value="overview">ภาพรวม PM</ToggleButton>
              <ToggleButton value="technicians">ตารางรายช่าง</ToggleButton>
            </ToggleButtonGroup>
            {has("pm:view") ? (
              <Button component={Link} href="/pm/plans" variant="text" size="small" sx={{ minHeight: { xs: 44, md: 36 } }}>
                แผน PM เดิม
              </Button>
            ) : null}
          </>
        }
      />

      <WomsStatGrid max={3} xs={3}>
        <WomsStatCard
          compact
          value={counts.OVERDUE}
          unit="เครื่อง"
          label="งานค้าง"
          hint={cur ? `รอบก่อน ${shortYearMonth(cur)}` : undefined}
          tone="error"
          active={f.period === "OVERDUE"}
          onClick={() => setRaw({ period: togglePeriod(f.period, "OVERDUE") })}
        />
        <WomsStatCard
          compact
          value={counts.DUE}
          unit="เครื่อง"
          label="ถึงรอบเดือนนี้"
          hint={cur ? shortYearMonth(cur) : undefined}
          tone="warning"
          active={f.period === "DUE"}
          onClick={() => setRaw({ period: togglePeriod(f.period, "DUE") })}
        />
        <WomsStatCard
          compact
          value={counts.UPCOMING}
          unit="เครื่อง"
          label="ใกล้ถึงรอบ"
          hint={cur ? `${shortYearMonth(addMonth(cur, 1))} – ${shortYearMonth(addMonth(cur, 2))}` : undefined}
          tone="info"
          active={f.period === "UPCOMING"}
          onClick={() => setRaw({ period: togglePeriod(f.period, "UPCOMING") })}
        />
      </WomsStatGrid>

      <WomsFormSection
        title={overview ? "เครื่องที่มีรอบ PM" : "รายการเครื่องตามช่าง"}
        titleAdornment={
          data ? (
            <Typography variant="body2" aria-live="polite" sx={{ fontSize: 13 }}>
              {data.total} เครื่อง{groupCount ? ` · ${groupCount} ${overview ? "เดือน" : "ช่าง"}` : ""}
            </Typography>
          ) : null
        }
      >
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(2, 220px) minmax(220px, 360px)" }, gap: 1.5, mb: 2 }}>
          <WomsSelectFilter
            id="pm-period"
            label="เดือนจัดงาน"
            value={f.period}
            onChange={(v) => setRaw({ period: v })}
            options={[]}
            allLabel="ทุกเดือน"
            groups={periodOptionGroups(data?.months ?? [])}
            minWidth={0}
            fullWidth
            displayEmpty
          />
          <WomsSelectFilter id="pm-tech" label="ช่าง" value={f.technicianId} onChange={(v) => setRaw({ tech: v })} options={techOptions} allLabel="ช่างทั้งหมด" minWidth={0} fullWidth displayEmpty />
          {overview ? (
            <Box sx={{ gridColumn: { xs: "1 / -1", sm: "auto" }, "& .MuiTextField-root": { width: "100%" } }}>
              <WomsSearchBar value={typed} onChange={setTyped} placeholder="ค้นหาลูกค้า สาขา รุ่น SN หรือเซลล์" label="ค้นหาในภาพรวม" />
            </Box>
          ) : null}
        </Box>
        {feedback ? (
          <Box role="status" sx={{ mb: 1.5, px: 2, py: 1, borderRadius: 1, bgcolor: "primary.light", color: "primary.dark", fontSize: 14, fontWeight: 600 }} data-testid="pm-feedback">
            {feedback}
          </Box>
        ) : null}
        {err ? (
          <WomsErrorState message={err} onRetry={load} />
        ) : (
          <WomsDataTable
            caption={overview ? "เครื่องที่มีรอบ PM" : "รายการเครื่องตามช่าง"}
            rows={data?.items ?? []}
            loading={data === null}
            columns={cols}
            rowKey={(r) => r.key}
            pageSize={50}
            groupBy={groupBy}
            emptyTitle={overview && f.q ? "ไม่พบเครื่องที่ตรงกับคำค้นและตัวกรอง" : "ไม่มีงานในตัวกรองนี้"}
            renderCard={card}
          />
        )}
      </WomsFormSection>

      <PmRoundDetailDialog
        row={detail}
        onClose={() => setDetail(null)}
        onReassign={(r) => setEditing(r)}
        canEarly={(r: PmRoundRow) => canRequestEarly && !!cur && canPullEarly(r, cur) && !r.earlyMode}
        onEarly={(r: PmRoundRow) => {
          setDetail(null);
          setPulling(r);
        }}
        onChanged={(msg) => {
          setDetail(null);
          showFeedback(msg);
          void load();
        }}
      />
      <PmNoteDialog
        row={noting}
        onClose={() => setNoting(null)}
        onDone={(msg) => {
          setNoting(null);
          showFeedback(msg);
          void load();
        }}
      />
      <PmEarlyDialog
        row={pulling}
        currentMonth={cur}
        onClose={() => setPulling(null)}
        onDone={(msg) => {
          setPulling(null);
          showFeedback(msg);
          void load();
        }}
      />
      <PmReassignDialog row={editing} technicians={data?.technicians ?? []} onClose={() => setEditing(null)} onDone={onReassigned} />
      <PmProposeDialog
        row={proposing}
        onClose={() => setProposing(null)}
        onDone={(msg) => {
          setProposing(null);
          showFeedback(msg);
          void load();
          window.dispatchEvent(new Event("woms:queue-changed"));
        }}
      />
    </>
  );
}
