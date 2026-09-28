"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Quotation, QuotationStatus } from "@/lib/types";
import { quotationStatusLabel, fmtMoney } from "@/lib/options";
import { useUrlFilters } from "@/lib/urlFilters";
import { useRef } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import {
  QuotationStatusChip,
  WomsDataTable,
  WomsFilterPanel,
  WomsPageHeader,
  WomsSearchBar,
  WomsSelectFilter,
  type WomsColumn,
} from "@/components/woms";

const STATUSES: QuotationStatus[] = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"];
export default function QuotationsPage() {
  const router = useRouter();
  const { has } = useAuth();
  const [items, setItems] = useState<Quotation[]>([]);
  // QA BUG-009 — ตัวกรองสะท้อนลง URL
  const [f, setF] = useUrlFilters({ status: "", q: "" });
  const status = f.status as QuotationStatus | "";
  const q = f.q;
  const setStatus = (v: QuotationStatus | "") => setF({ status: v });
  const setQ = (v: string) => setF({ q: v });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const seqRef = useRef(0);
  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.listQuotations({ status: status || undefined, q: q || undefined });
      if (seq !== seqRef.current) return;
      setItems(res.items);
    } catch (e) {
      if (seq !== seqRef.current) return;
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: WomsColumn<Quotation>[] = [
    { key: "no", label: "เลขที่", sortValue: (x) => x.quotationNo, render: (x) => <Link href={`/quotations/${x.id}`} className="code" onClick={(e) => e.stopPropagation()}>{x.quotationNo}</Link> },
    { key: "cust", label: "ลูกค้า", sortValue: (x) => x.customerName, render: (x) => x.customerName },
    { key: "date", label: "วันที่ออก", sortValue: (x) => x.issueDate, render: (x) => <span className="mono">{x.issueDate}</span> },
    { key: "total", label: "ยอดสุทธิ", align: "right", sortValue: (x) => x.total, render: (x) => <span className="mono">{fmtMoney(x.total)}</span> },
    { key: "status", label: "สถานะ", sortValue: (x) => x.status, render: (x) => <QuotationStatusChip status={x.status} /> },
  ];

  return (
    <>
      <WomsPageHeader
        title="ใบเสนอราคา"
        subtitle={loading ? "กำลังโหลด…" : `${items.length} ใบ`}
        actions={
          has("quotations:create") ? (
            <Button component={Link} href="/quotations/new" variant="contained" startIcon={<AddIcon />}>
              สร้างใบเสนอราคา
            </Button>
          ) : undefined
        }
      />

      <WomsFilterPanel
        search={<WomsSearchBar value={q} onChange={setQ} placeholder="เลขที่ / ลูกค้า" />}
        activeCount={status ? 1 : 0}
        onClear={() => setStatus("")}
      >
        <WomsSelectFilter
          label="สถานะ"
          value={status}
          onChange={(v) => setStatus(v as QuotationStatus | "")}
          options={STATUSES.map((s) => ({ value: s, label: quotationStatusLabel[s] }))}
        />
      </WomsFilterPanel>

      <WomsDataTable
        caption="รายการใบเสนอราคา"
        rows={items}
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
