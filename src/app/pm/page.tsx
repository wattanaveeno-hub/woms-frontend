"use client";

// ---------------------------------------------------------------------------
// ตาราง PM รายเดือน (WOMS_PM_Monthly_Requirements_2026-11-09 · WOMS_Nav_PM_Handoff ส่วนที่ 2)
//   PM-01 สองมุมมอง (ภาพรวม PM / ตารางรายช่าง) จากรอบ PM ชุดเดียวกัน · เปิดที่ภาพรวม + ทุกเดือน
//   PM-02 สถานะรายเดือนคำนวณที่ backend (GET /api/pm/rounds) — หน้านี้แสดงผลเท่านั้น
//   PM-04 เปลี่ยนช่าง 2 แบบ (ปุ่มตามสิทธิ์ PM-11 · backend ตรวจซ้ำ) · 3.3 ช่างของรอบเสนอวันเวลาได้
//   แผน PM รายเดือนเดิม (อนุมัติ/ส่งช่าง) ยังใช้ได้ที่ /pm/plans ในช่วงเปลี่ยนผ่าน (Q-02)
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError, PmReassignResult, PmRoundRow, PmRoundsResponse } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useUrlFilters } from "@/lib/urlFilters";
import {
  PM_ROUND_TYPE_LABEL,
  addMonth,
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
  WomsSelectFilter,
  WomsStatCard,
  WomsStatGrid,
  type WomsColumn,
} from "@/components/woms";
import PmRoundDetailDialog from "@/components/pm/PmRoundDetailDialog";
import PmReassignDialog from "@/components/pm/PmReassignDialog";
import PmProposeDialog from "@/components/pm/PmProposeDialog";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/Edit";

const mono = { fontFamily: 'ui-monospace, "SFMono-Regular", "JetBrains Mono", "Consolas", monospace' } as const;
const PROPOSABLE = new Set(["OVERDUE", "DUE", "UPCOMING"]);

export default function PmMonthlyPage() {
  const { has, user } = useAuth();
  const [raw, setRaw] = useUrlFilters({ view: "overview", period: "", tech: "" });
  const f = parseRoundFilters({ get: (k) => (raw as Record<string, string>)[k] ?? null });
  const [data, setData] = useState<PmRoundsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<PmRoundRow | null>(null);
  const [editing, setEditing] = useState<PmRoundRow | null>(null);
  const [proposing, setProposing] = useState<PmRoundRow | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const fbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setData(await api.pmRounds({ view: f.view, period: f.period, technicianId: f.technicianId }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดตาราง PM ไม่สำเร็จ");
      setData(null);
    }
  }, [f.view, f.period, f.technicianId]);
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
  const canPropose = (r: PmRoundRow) =>
    has("svcqueue:respond") && !!user && r.roundTech?.id === user.id && !r.queue && !r.openJobId && PROPOSABLE.has(r.status) && !r.serviceStopped;

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
          <Typography component="span" sx={{ fontSize: 14, color: t.unassigned ? "error.main" : "text.primary" }}>
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
          sx={{ px: 0.5, minWidth: 0, minHeight: { xs: 44, md: 32 }, fontWeight: 600, color: t.unassigned ? "error.main" : "primary.dark", justifyContent: "flex-start" }}
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
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.primary" }}>{PM_ROUND_TYPE_LABEL[r.type]}</Typography>
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
      <PmRoundStatusChip status={r.status} />
      {r.appointment?.state === "CONFIRMED" && r.status !== "DONE" ? (
        <Typography variant="body2" sx={{ fontSize: 12 }}>
          นัดแล้ว {dateLabel(r.appointment.date)}
        </Typography>
      ) : null}
      {canPropose(r) ? (
        <Button size="small" variant="contained" onClick={() => setProposing(r)} sx={{ minHeight: { xs: 44, md: 30 } }}>
          เสนอวันเวลา
        </Button>
      ) : null}
    </Stack>
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
      label: "รอบ PM",
      render: (r) => <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.primary", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{monthLabel(r.roundMonth)}</Typography>,
    },
    { key: "sales", label: "เซลล์", render: salesChip },
    { key: "tech", label: "ช่าง", render: techButton },
    { key: "type", label: "ประเภท PM", render: typeCell },
    { key: "status", label: "สถานะ", render: statusCell },
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
        {label("รอบ PM")}
        <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: "text.primary", fontVariantNumeric: "tabular-nums" }}>
          {monthLabel(r.roundMonth)}
        </Typography>
      </Box>
      <Box sx={{ textAlign: "right" }}>
        {label("เซลล์")}
        {salesChip(r)}
      </Box>
      <Box>{techButton(r)}</Box>
      <Box sx={{ textAlign: "right" }}>{typeCell(r)}</Box>
      <Box sx={{ gridColumn: "1 / -1" }}>{statusCell(r)}</Box>
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
              {data.total} เครื่อง{groupCount > 1 ? ` · ${groupCount} ${overview ? "กลุ่มเดือน" : "กลุ่มช่าง"}` : ""}
            </Typography>
          ) : null
        }
      >
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(2, 220px)" }, gap: 1.5, mb: 2 }}>
          <WomsSelectFilter
            id="pm-period"
            label="รอบ PM"
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
            emptyTitle="ไม่มีเครื่องในตัวกรองนี้"
            renderCard={card}
          />
        )}
      </WomsFormSection>

      <PmRoundDetailDialog row={detail} onClose={() => setDetail(null)} onReassign={(r) => setEditing(r)} />
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
