"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Quotation, QuotationStatus } from "@/lib/types";
import { fmtMoney } from "@/lib/options";
import { useUrlFilters } from "@/lib/urlFilters";
import { useRef } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import Chip from "@mui/material/Chip";
import { financeApi, type FinanceRow } from "@/lib/financeApi";
import { AggStateChip } from "@/components/finance/FinParts";
import {
  QuotationStatusChip,
  WomsDataTable,
  WomsFilterPanel,
  WomsPageHeader,
  WomsSearchBar,
  type WomsColumn,
} from "@/components/woms";

/**
 * Redesign: แบ่งตามขั้นของใบเสนอราคา (ไม่ใช่สถานะเอกสารดิบ) พร้อมจำนวนและยอดรวมของแต่ละขั้น
 *   "ตอบรับ · ยังไม่เปิดงาน" แยกจาก "เปิดงานแล้ว" ด้วยการผูกใบงาน (jobId)
 */
type Stage = "draft" | "sent" | "accepted" | "opened" | "lost" | "cancelled";
const STAGES: { key: Stage; label: string }[] = [
  { key: "draft", label: "ร่าง" },
  { key: "sent", label: "ส่งแล้ว รอลูกค้าตอบ" },
  { key: "accepted", label: "ตอบรับ · ยังไม่เปิดงาน" },
  { key: "opened", label: "เปิดงานแล้ว" },
  { key: "lost", label: "ไม่ตอบรับ / หมดอายุ" },
  { key: "cancelled", label: "ยกเลิก" },
];
function stageOf(x: Quotation): Stage {
  switch (x.status) {
    case "DRAFT": return "draft";
    case "SENT": return "sent";
    case "ACCEPTED": return x.jobId ? "opened" : "accepted";
    case "REJECTED":
    case "EXPIRED": return "lost";
    default: return "cancelled";
  }
}
function daysSince(ymd: string): number | null {
  const t = Date.parse(`${ymd}T00:00:00+07:00`);
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 864e5);
}
export default function QuotationsPage() {
  const router = useRouter();
  const { has } = useAuth();
  const [items, setItems] = useState<Quotation[]>([]);
  // QA BUG-009 — ตัวกรองสะท้อนลง URL
  const [f, setF] = useUrlFilters({ stage: "sent", q: "" });
  const stage = (STAGES.some((x) => x.key === f.stage) ? f.stage : "") as Stage | "";
  const status = "" as QuotationStatus | "";
  const q = f.q;
  const setQ = (v: string) => setF({ q: v });
  const [loading, setLoading] = useState(true);
  // D-11 หัวข้อ 6: ยอดที่ต้องชำระ / ยืนยันแล้ว / คงเหลือ / สถานะรับชำระ / รอตรวจ — เฉพาะผู้มี finance:view
  const canFinance = has("finance:view");
  const [fin, setFin] = useState<Record<string, FinanceRow>>({});
  const [error, setError] = useState<string | null>(null);

  const seqRef = useRef(0);
  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    try {
      const [res, f] = await Promise.all([
        api.listQuotations({ status: status || undefined, q: q || undefined }),
        canFinance ? financeApi.list({ status: status || undefined, q: q || undefined }).catch(() => null) : Promise.resolve(null),
      ]);
      if (seq !== seqRef.current) return;
      setItems(res.items);
      setFin(Object.fromEntries((f?.items ?? []).map((r) => [r.id, r])));
    } catch (e) {
      if (seq !== seqRef.current) return;
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [status, q, canFinance]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: WomsColumn<Quotation>[] = [
    { key: "no", label: "เลขที่", sortValue: (x) => x.quotationNo, render: (x) => <Link href={`/quotations/${x.id}`} className="code" onClick={(e) => e.stopPropagation()}>{x.quotationNo}</Link> },
    { key: "cust", label: "ลูกค้า", sortValue: (x) => x.customerName, render: (x) => x.customerName },
    { key: "date", label: "วันที่ออก", sortValue: (x) => x.issueDate, render: (x) => <span className="mono">{x.issueDate}</span> },
    { key: "total", label: "ยอดสุทธิ", align: "right", sortValue: (x) => x.total, render: (x) => <span className="mono">{fmtMoney(x.total)}</span> },
    { key: "status", label: "สถานะ", sortValue: (x) => x.status, render: (x) => <QuotationStatusChip status={x.status} /> },
    {
      key: "follow",
      label: "ติดตาม",
      sortValue: (x) => (x.status === "SENT" ? -(daysSince(x.issueDate) ?? 0) : 0),
      render: (x) => {
        if (x.status === "SENT") {
          const d = daysSince(x.issueDate);
          if (d === null) return "—";
          const late = d > 7;
          return (
            <Typography component="span" sx={{ fontSize: 13, fontWeight: late ? 700 : 400, color: late ? "#b3261e" : "text.primary" }}>
              ส่งไป {d} วัน{late ? " · ควรโทรตาม" : ""}
            </Typography>
          );
        }
        if (x.status === "ACCEPTED" && !x.jobId) return <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, color: "#8a5606" }}>รอเปิดงาน/สัญญา</Typography>;
        if (x.jobId) return <Link href={`/jobs/${x.jobId}`} className="code" onClick={(e) => e.stopPropagation()}>{x.jobId}</Link>;
        return "—";
      },
    },
    ...(canFinance
      ? ([
          { key: "ver", label: "ยืนยันรับแล้ว", align: "right", sortValue: (x) => fin[x.id]?.summary.verifiedTotal ?? 0, render: (x) => <span className="mono">{fin[x.id] ? fmtMoney(fin[x.id].summary.verifiedTotal) : "—"}</span> },
          { key: "out", label: "คงเหลือ", align: "right", sortValue: (x) => fin[x.id]?.summary.outstanding ?? 0, render: (x) => <span className="mono">{fin[x.id] ? fmtMoney(fin[x.id].summary.outstanding) : "—"}</span> },
          { key: "pay", label: "สถานะรับชำระ", render: (x) => (fin[x.id] ? <AggStateChip summary={fin[x.id].summary} /> : "—") },
          { key: "pend", label: "รอตรวจ", align: "right", hideBelowLg: true, render: (x) => (fin[x.id]?.summary.pendingCount ? <Chip size="small" color="warning" label={fin[x.id].summary.pendingCount} /> : "—") },
        ] as WomsColumn<Quotation>[])
      : []),
  ];

  return (
    <>
      <WomsPageHeader
        title="ใบเสนอราคา"
        subtitle={loading ? "กำลังโหลด…" : `${items.length} ใบ · กดที่ขั้นด้านล่างเพื่อกรอง (กดซ้ำเพื่อดูทั้งหมด)`}
        actions={
          has("quotations:create") ? (
            <Button component={Link} href="/quotations/new" variant="contained" startIcon={<AddIcon />}>
              สร้างใบเสนอราคา
            </Button>
          ) : undefined
        }
      />

      <Box
        role="group"
        aria-label="ขั้นของใบเสนอราคา"
        sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", sm: "repeat(3, minmax(0,1fr))", lg: "repeat(6, minmax(0,1fr))" }, gap: 1, mb: 2 }}
      >
        {STAGES.map((st) => {
          const rows = items.filter((x) => stageOf(x) === st.key);
          const on = stage === st.key;
          return (
            <Box
              key={st.key}
              component="button"
              type="button"
              aria-pressed={on}
              onClick={() => setF({ stage: on ? "all" : st.key })}
              sx={{
                textAlign: "left",
                font: "inherit",
                cursor: "pointer",
                p: 1.5,
                borderRadius: 1.5,
                border: on ? 2 : 1,
                borderColor: on ? "primary.main" : "divider",
                bgcolor: on ? "#f3faf4" : "#fff",
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
              }}
            >
              <Typography variant="body2" sx={{ fontSize: 13 }}>{st.label}</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 700, color: "text.primary", lineHeight: 1.2 }}>{loading ? "…" : rows.length}</Typography>
              <Typography variant="body2" sx={{ fontSize: 13 }}>฿{fmtMoney(rows.reduce((a, x) => a + (x.total || 0), 0))}</Typography>
            </Box>
          );
        })}
      </Box>

      <WomsFilterPanel
        search={<WomsSearchBar value={q} onChange={setQ} placeholder="เลขที่ / ลูกค้า" />}
        activeCount={stage && stage !== ("all" as string) ? 1 : 0}
        onClear={() => setF({ stage: "all" })}
      />

      <WomsDataTable
        caption="รายการใบเสนอราคา"
        rows={stage ? items.filter((x) => stageOf(x) === stage) : items}
        columns={columns}
        rowKey={(x) => x.id}
        loading={loading}
        error={error}
        onRetry={load}
        pageSize={10}
        onRowClick={(x) => router.push(`/quotations/${x.id}`)}
        emptyTitle="ยังไม่มีใบเสนอราคาที่ตรงเงื่อนไข"
        emptyAction={
          has("quotations:create") ? (
            <Button component={Link} href="/quotations/new" variant="outlined" startIcon={<AddIcon />}>
              สร้างใบแรก
            </Button>
          ) : undefined
        }
        renderCard={(x) => (
          <Card>
            <CardActionArea component={Link} href={`/quotations/${x.id}`}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <span className="code">{x.quotationNo}</span>
                  <QuotationStatusChip status={x.status} />
                </Stack>
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{x.customerName}</Typography>
                <Typography variant="body2">
                  {x.issueDate} · {fmtMoney(x.total)} บาท
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        )}
      />
    </>
  );
}
