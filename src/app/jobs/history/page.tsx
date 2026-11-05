"use client";
// BR-01 C-3 — ประวัติงานที่ปิดแล้ว/ยกเลิก (อ่านอย่างเดียว) · ขอบเขตข้อมูลตรวจที่ backend (GET /api/jobs/history)
//   ยังไม่มีตัวกรองช่วงวันที่ (Q-06 รอยืนยัน) · แสดงเป็นการ์ดบนจอเล็ก ตารางบนจอใหญ่
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api, ApiError, type JobHistoryItem } from "@/lib/api";
import { bangkokDateTime } from "@/lib/date";
import { WomsEmptyState, WomsErrorState, WomsLoadingState, WomsPageHeader } from "@/components/woms";

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
  return (
    <Box>
      <WomsPageHeader
        title="ประวัติงาน"
        subtitle={data ? `${data.total} ใบงานที่ปิด/ยกเลิก` : "กำลังโหลด…"}
        actions={
          <Button component={Link} href="/calendar" size="small" variant="outlined">
            กลับไปปฏิทิน
          </Button>
        }
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
        <TextField size="small" label="ค้นหา JN / ชื่องาน / ผู้ติดต่อ" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setPage(1), setQuery(q.trim()))} onBlur={() => (setPage(1), setQuery(q.trim()))} />
        <TextField select size="small" label="สถานะ" value={status} onChange={(e) => (setPage(1), setStatus(e.target.value))} sx={{ minWidth: 160 }}>
          <MenuItem value="">ทั้งหมด</MenuItem>
          <MenuItem value="CLOSED">ปิดงานแล้ว</MenuItem>
          <MenuItem value="CANCELLED">ยกเลิก</MenuItem>
        </TextField>
        <TextField type="date" size="small" label="จบงานตั้งแต่" value={from} onChange={(e) => (setPage(1), setFrom(e.target.value))} InputLabelProps={{ shrink: true }} inputProps={{ max: to || undefined }} />
        <TextField type="date" size="small" label="ถึง" value={to} onChange={(e) => (setPage(1), setTo(e.target.value))} InputLabelProps={{ shrink: true }} inputProps={{ min: from || undefined }} />
      </Stack>
      {err ? <WomsErrorState message={err} onRetry={load} /> : null}
      {!data && !err ? <WomsLoadingState /> : null}
      {data && !data.items.length ? <WomsEmptyState title="ไม่พบประวัติงานตามเงื่อนไข" /> : null}
      <Stack spacing={1}>
        {data?.items.map((j) => (
          <Card key={j.jobId} variant="outlined" data-testid="history-row">
            <CardActionArea component={Link} href={`/jobs/${encodeURIComponent(j.jobId)}`} sx={{ p: 1.5, minHeight: 44 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.25, sm: 2 }} justifyContent="space-between">
                <Box sx={{ minWidth: 0 }}>
                  <Typography className="code" sx={{ fontWeight: 600 }}>
                    {j.jobId} · {STATUS_LABEL[j.status] ?? j.status}
                  </Typography>
                  <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                    {j.jobName || "-"} {j.customerName ? `· ${j.customerName}` : ""}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                  นัด {j.jobDate || "-"}
                  {j.endedAt || j.closedAt
                    ? ` · ${j.status === "CANCELLED" ? "ยกเลิก" : "ปิด"} ${bangkokDateTime(j.endedAt || j.closedAt || "")}`
                    : " · ไม่มีวันที่จบงาน"}
                  {j.technicianTeam ? ` · ${j.technicianTeam}` : ""}
                  {typeof j.equipmentCount === "number" ? ` · ${j.equipmentCount} เครื่อง` : ""}
                </Typography>
              </Stack>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
      {data && data.total > LIMIT ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ก่อนหน้า
          </Button>
          <Typography variant="body2">
            หน้า {page}/{pages}
          </Typography>
          <Button disabled={page >= pages} onClick={() => setPage(page + 1)}>
            ถัดไป
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
}
