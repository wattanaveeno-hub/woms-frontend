"use client";

// ---------------------------------------------------------------------------
// ระบบวางบิลช่าง (BILL-FN-001..014)
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { BillStatus, BillSummaryRow, TechBill } from "@/lib/types";
import { BILL_STATUS_LABEL } from "@/lib/types";
import { useUrlFilters } from "@/lib/urlFilters";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import AddIcon from "@mui/icons-material/Add";
import {
  BillingStatusChip,
  WomsDataTable,
  WomsFilterPanel,
  WomsFormSection,
  WomsPageHeader,
  WomsSelectFilter,
  type WomsColumn,
} from "@/components/woms";

const baht = (n: number) => n.toLocaleString("th-TH");

const STATUSES: Array<BillStatus | ""> = ["", "DRAFT", "SUBMITTED", "RETURNED", "APPROVED", "PAID", "CANCELLED"];

export default function BillsPage() {
  const { has } = useAuth();
  const canReview = has("bill:review");

  const [items, setItems] = useState<TechBill[] | null>(null);
  const [summary, setSummary] = useState<BillSummaryRow[]>([]);
  // QA BUG-009 — ตัวกรองสะท้อนลง URL
  const [f, setF] = useUrlFilters({ status: "", from: "", to: "" });
  const status = f.status as BillStatus | "";
  const from = f.from;
  const to = f.to;
  const setStatus = (v: BillStatus | "") => setF({ status: v });
  const setFrom = (v: string) => setF({ from: v });
  const setTo = (v: string) => setF({ to: v });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setItems(null);
    try {
      const r = await api.listBills({
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setItems(r.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดรายการวางบิลไม่สำเร็จ");
      setItems([]);
    }
    if (canReview) {
      try {
        const s = await api.billSummary({ from: from || undefined, to: to || undefined });
        setSummary(s.items);
      } catch {
        setSummary([]);
      }
    }
  }, [status, from, to, canReview]);

  useEffect(() => {
    load();
  }, [load]);

  const billCols: WomsColumn<TechBill>[] = [
    { key: "no", label: "เลขที่", sortValue: (b) => b.billNo, render: (b) => <Link href={`/bills/${b.id}`} className="code">{b.billNo}</Link> },
    { key: "tech", label: "ช่าง", sortValue: (b) => b.technicianName, render: (b) => b.technicianName },
    { key: "period", label: "รอบ", sortValue: (b) => b.periodFrom, render: (b) => <span className="mono">{b.periodFrom} → {b.periodTo}</span> },
    { key: "status", label: "สถานะ", sortValue: (b) => b.status, render: (b) => <BillingStatusChip status={b.status} label={b.statusLabel} /> },
    { key: "jobs", label: "ใบงาน", align: "right", sortValue: (b) => b.totals.jobCount, render: (b) => b.totals.jobCount },
    { key: "labor", label: "ค่าแรง", align: "right", hideBelowLg: true, sortValue: (b) => b.totals.laborTotal, render: (b) => <span className="mono">{baht(b.totals.laborTotal)}</span> },
    {
      key: "travel",
      label: "ค่าเดินทาง",
      align: "right",
      hideBelowLg: true,
      sortValue: (b) => b.totals.travelTotal,
      render: (b) => (
        <>
          <span className="mono">{baht(b.totals.travelTotal)}</span>
          <Typography component="span" variant="body2"> ({b.totals.dayCount} วัน)</Typography>
        </>
      ),
    },
    { key: "total", label: "รวม", align: "right", sortValue: (b) => b.totals.grandTotal, render: (b) => <strong className="mono">{baht(b.totals.grandTotal)}</strong> },
  ];
  const sumCols: WomsColumn<BillSummaryRow>[] = [
    { key: "tech", label: "ช่าง", sortValue: (r) => r.technicianName, render: (r) => r.technicianName },
    { key: "bills", label: "จำนวนบิล", align: "right", sortValue: (r) => r.billCount, render: (r) => r.billCount },
    { key: "jobs", label: "ใบงาน", align: "right", sortValue: (r) => r.jobCount, render: (r) => r.jobCount },
    { key: "labor", label: "ค่าแรง", align: "right", hideBelowLg: true, render: (r) => <span className="mono">{baht(r.laborTotal)}</span> },
    { key: "travel", label: "ค่าเดินทาง", align: "right", hideBelowLg: true, render: (r) => <span className="mono">{baht(r.travelTotal)}</span> },
    { key: "exp", label: "ค่าใช้จ่ายอื่น", align: "right", hideBelowLg: true, render: (r) => <span className="mono">{baht(r.expenseTotal)}</span> },
    { key: "total", label: "รวม", align: "right", sortValue: (r) => r.grandTotal, render: (r) => <strong className="mono">{baht(r.grandTotal)}</strong> },
  ];

  return (
    <>
      <WomsPageHeader
        title="วางบิลช่าง"
        subtitle="วางบิลได้เฉพาะใบงานที่ Admin ยืนยันปิดงานแล้ว · ค่าเดินทางคิดต่อวัน ไม่ใช่ต่อใบงาน"
        actions={
          has("bill:create") ? (
            <Button component={Link} href="/bills/new" variant="contained" startIcon={<AddIcon />}>
              ทำรายการวางบิล
            </Button>
          ) : undefined
        }
      />

      <WomsFilterPanel activeCount={[status, from, to].filter(Boolean).length} onClear={() => setF({ status: "", from: "", to: "" })}>
        <WomsSelectFilter
          label="สถานะ"
          value={status}
          onChange={(v) => setStatus(v as BillStatus | "")}
          options={STATUSES.filter(Boolean).map((s) => ({ value: s, label: BILL_STATUS_LABEL[s as BillStatus] }))}
          allLabel="ทุกสถานะ"
        />
        <TextField label="ตั้งแต่" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth={false} sx={{ minWidth: 160 }} />
        <TextField label="ถึง" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth={false} sx={{ minWidth: 160 }} />
      </WomsFilterPanel>

      {canReview && summary.length > 0 && (
        <WomsFormSection title="สรุปยอดตามช่าง (ไม่นับบิลที่ยกเลิก)">
          <WomsDataTable
            caption="สรุปยอดตามช่าง"
            rows={summary}
            columns={sumCols}
            rowKey={(r) => r.technicianId}
            pageSize={10}
            renderCard={(r) => (
              <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{r.technicianName}</Typography>
                  <strong className="mono">{baht(r.grandTotal)}</strong>
                </Stack>
                <Typography variant="body2">
                  {r.billCount} บิล · {r.jobCount} ใบงาน · ค่าแรง {baht(r.laborTotal)} · เดินทาง {baht(r.travelTotal)} · อื่น ๆ {baht(r.expenseTotal)}
                </Typography>
              </Box>
            )}
          />
        </WomsFormSection>
      )}

      <WomsDataTable
        caption="รายการวางบิล"
        rows={items ?? []}
        loading={items === null}
        error={error}
        onRetry={load}
        columns={billCols}
        rowKey={(b) => b.id}
        pageSize={25}
        emptyTitle="ยังไม่มีรายการวางบิล"
        renderCard={(b) => (
          <Card>
            <CardActionArea component={Link} href={`/bills/${b.id}`}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <span className="code">{b.billNo}</span>
                  <BillingStatusChip status={b.status} label={b.statusLabel} />
                </Stack>
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{b.technicianName}</Typography>
                <Typography variant="body2" className="mono">
                  {b.periodFrom} → {b.periodTo}
                </Typography>
                <Typography variant="body2">
                  {b.totals.jobCount} ใบงาน · {b.totals.dayCount} วัน · รวม <strong>{baht(b.totals.grandTotal)}</strong> บาท
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        )}
      />
    </>
  );
}
