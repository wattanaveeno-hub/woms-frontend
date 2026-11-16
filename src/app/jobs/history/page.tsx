"use client";
// BR-01 C-3 — ประวัติงานที่ปิดแล้ว/ยกเลิก (อ่านอย่างเดียว) · ขอบเขตข้อมูลตรวจที่ backend (GET /api/jobs/history)
//   ยังไม่มีตัวกรองช่วงวันที่ (Q-06 รอยืนยัน) · แสดงเป็นการ์ดบนจอเล็ก ตารางบนจอใหญ่
import { useCallback, useEffect, useState } from "react";
import DateField from "@/components/DateField";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import SearchIcon from "@mui/icons-material/Search";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api, ApiError, type JobHistoryItem } from "@/lib/api";
import { bangkokDateTime, thaiDayLabel, fmtDate } from "@/lib/date";
import { WomsDataTable, WomsEmptyState, WomsErrorState, WomsLoadingState, WomsPageHeader, WomsStatusChip, WomsTwoLine, type WomsColumn } from "@/components/woms";

const STATUS_LABEL: Record<string, string> = { CLOSED: "ปิดงานแล้ว", CANCELLED: "ยกเลิก" };
const LIMIT = 20;

export default function JobHistoryPage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  // Q-06: ช่วงวันที่จบงาน (วันไทย) — backend ตรวจรูปแบบและช่วง
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<{ items: JobHistoryItem[]; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    setErr(null);
    setData(null);
    try {
      setData(await api.jobHistory({ status, q: query, page, limit: LIMIT, from, to }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดประวัติงานไม่สำเร็จ");
    }
  }, [status, query, page, from, to]);
  useEffect(() => {
    void load();
  }, [load]);
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
  const cols: WomsColumn<JobHistoryItem>[] = [
    {
      key: "ended",
      label: "จบงานเมื่อ",
      render: (j) => (
        <WomsTwoLine
          main={j.endedAt || j.closedAt ? <span className="mono">{bangkokDateTime(j.endedAt || j.closedAt || "")}</span> : "—"}
          sub={j.jobDate ? `นัด ${thaiDayLabel(j.jobDate)}` : undefined}
        />
      ),
    },
    { key: "cust", label: "ลูกค้า", render: (j) => <WomsTwoLine main={j.customerName || "—"} /> },
    {
      key: "job",
      label: "งาน",
      render: (j) => (
        <WomsTwoLine
          main={<Link href={`/jobs/${encodeURIComponent(j.jobId)}`}>{j.jobName || j.jobId}</Link>}
          sub={<span className="mono">{j.jobId}</span>}
        />
      ),
    },
    { key: "team", label: "ทีมช่าง", render: (j) => j.technicianTeam || "—" },
    { key: "eq", label: "เครื่อง", align: "right", render: (j) => (typeof j.equipmentCount === "number" ? j.equipmentCount : "—") },
    {
      key: "st",
      label: "ผล",
      render: (j) => <WomsStatusChip label={STATUS_LABEL[j.status] ?? j.status} tone={j.status === "CLOSED" ? "success" : "neutral"} />,
    },
  ];

  return (
    <Box>
      <WomsPageHeader
        back={{ href: "/jobs", label: "งานทั้งหมด" }}
        title="ประวัติงาน"
        subtitle={data ? `งานที่ปิดหรือยกเลิกแล้ว ${data.total.toLocaleString("th-TH")} ใบ · ค้นจากเลขงาน ชื่องาน หรือผู้ติดต่อ` : "งานที่ปิดหรือยกเลิกแล้ว"}
        actions={
          <Button component={Link} href="/calendar" variant="outlined">
            ปฏิทินช่าง
          </Button>
        }
      />
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap" alignItems={{ md: "center" }} sx={{ mb: 2 }}>
        <TextField
          label="ค้นหา JN / ชื่องาน / ผู้ติดต่อ"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (setPage(1), setQuery(q.trim()))}
          onBlur={() => (setPage(1), setQuery(q.trim()))}
          sx={{ maxWidth: { md: 320 } }}
          InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ color: "text.secondary", mr: 1 }} /> }}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          aria-label="สถานะ"
          value={status || "ALL"}
          onChange={(_e, v) => v && (setPage(1), setStatus(v === "ALL" ? "" : v))}
        >
          <ToggleButton value="CLOSED">ปิดแล้ว</ToggleButton>
          <ToggleButton value="CANCELLED">ยกเลิก</ToggleButton>
          <ToggleButton value="ALL">ทั้งหมด</ToggleButton>
        </ToggleButtonGroup>
        <DateField label="จบงานตั้งแต่" value={from} onChange={(e) => (setPage(1), setFrom(e.target.value))} InputLabelProps={{ shrink: true }} inputProps={{ max: to || undefined }} sx={{ width: { md: 170 } }} />
        <DateField label="ถึง" value={to} onChange={(e) => (setPage(1), setTo(e.target.value))} InputLabelProps={{ shrink: true }} inputProps={{ min: from || undefined }} sx={{ width: { md: 170 } }} />
      </Stack>
      {err ? <WomsErrorState message={err} onRetry={load} /> : null}
      {!data && !err ? <WomsLoadingState /> : null}
      {data && !data.items.length ? <WomsEmptyState title="ไม่พบประวัติงานตามเงื่อนไข" /> : null}
      {data && data.items.length ? (
        <WomsDataTable
          caption="ประวัติงาน"
          rows={data.items}
          columns={cols}
          rowKey={(j) => j.jobId}
          hidePager
          pageSize={LIMIT}
          renderCard={(j) => (
            <Card variant="outlined" data-testid="history-row">
              <CardActionArea component={Link} href={`/jobs/${encodeURIComponent(j.jobId)}`} sx={{ p: 1.5, minHeight: 44 }}>
                <Typography className="code" sx={{ fontWeight: 600 }}>
                  {j.jobId} · {STATUS_LABEL[j.status] ?? j.status}
                </Typography>
                <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                  {j.jobName || "-"} {j.customerName ? `· ${j.customerName}` : ""}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  นัด {fmtDate(j.jobDate || "-")}
                  {j.endedAt || j.closedAt ? ` · ${j.status === "CANCELLED" ? "ยกเลิก" : "ปิด"} ${bangkokDateTime(j.endedAt || j.closedAt || "")}` : ""}
                  {j.technicianTeam ? ` · ${j.technicianTeam}` : ""}
                </Typography>
              </CardActionArea>
            </Card>
          )}
        />
      ) : null}
      {data && data.total > LIMIT ? (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mr: 1 }}>
            หน้า {page}/{pages} · ทั้งหมด {data.total}
          </Typography>
          <Button size="small" variant="outlined" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ก่อนหน้า
          </Button>
          <Button size="small" variant="outlined" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            ถัดไป
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
}
