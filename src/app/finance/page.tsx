"use client";

// D-11 Financial Workflow v1.0 หัวข้อ 6 — หน้ารายการสถานะรับชำระของใบเสนอราคา
// เลขที่ ลูกค้า ยอดที่ต้องชำระ ยอดยืนยันรับแล้ว ยอดคงเหลือ สถานะใบเสนอราคา สถานะรับชำระ จำนวนรายการรอตรวจ + ค้นหา/กรอง
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import { ApiError, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { fmtMoney, quotationStatusLabel } from "@/lib/options";
import { useUrlFilters } from "@/lib/urlFilters";
import { FIN_AGG_STATE_LABEL, type FinAggState } from "@/lib/financeRules";
import { financeApi, type FinanceRow } from "@/lib/financeApi";
import { AggStateChip } from "@/components/finance/FinParts";
import type { QuotationStatus } from "@/lib/types";
import {
  QuotationStatusChip,
  WomsDataTable,
  WomsFilterPanel,
  WomsPageHeader,
  WomsSearchBar,
  WomsSelectFilter,
  type WomsColumn,
} from "@/components/woms";
import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";

const Q_STATUSES: QuotationStatus[] = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"];
const AGG: FinAggState[] = ["UNPAID", "PARTIALLY_PAID", "PAID"];

function FinanceListInner() {
  const router = useRouter();
  const toast = useToast();
  const { has } = useAuth();
  const [f, setF] = useUrlFilters({ q: "", status: "", pay: "", flag: "" });
  const [items, setItems] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const r = await financeApi.list({ q: f.q || undefined, status: f.status || undefined, paymentStatus: f.pay || undefined, pending: f.flag === "pending", exceptions: f.flag === "exceptions" });
      if (n === seq.current) setItems(r.items);
    } catch (e) {
      if (n === seq.current) setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [f.q, f.status, f.pay, f.flag]);
  useEffect(() => {
    load();
  }, [load]);

  const exportXlsx = () => {
    const p = new URLSearchParams();
    if (f.q) p.set("q", f.q);
    if (f.status) p.set("status", f.status);
    if (f.pay) p.set("paymentStatus", f.pay);
    if (f.flag === "pending") p.set("pending", "1");
    if (f.flag === "exceptions") p.set("exceptions", "1");
    downloadFile(`/api/finance/quotations/export.xlsx${p.toString() ? `?${p}` : ""}`, "woms-finance.xlsx").catch((e) => toast.error(e?.message ?? "ดาวน์โหลดไม่สำเร็จ"));
  };

  const columns: WomsColumn<FinanceRow>[] = [
    { key: "no", label: "เลขที่", sortValue: (x) => x.quotationNo, render: (x) => <Link href={`/quotations/${x.id}?tab=payments`} className="code" onClick={(e) => e.stopPropagation()}>{x.quotationNo}</Link> },
    { key: "cust", label: "ลูกค้า", sortValue: (x) => x.customerName, render: (x) => x.customerName },
    { key: "due", label: "ยอดที่ต้องชำระ", align: "right", sortValue: (x) => x.summary.amountDue, render: (x) => <span className="mono">{fmtMoney(x.summary.amountDue)}</span> },
    { key: "ver", label: "ยืนยันรับแล้ว", align: "right", sortValue: (x) => x.summary.verifiedTotal, render: (x) => <span className="mono">{fmtMoney(x.summary.verifiedTotal)}</span> },
    { key: "out", label: "คงเหลือ", align: "right", sortValue: (x) => x.summary.outstanding, render: (x) => <span className="mono">{fmtMoney(x.summary.outstanding)}</span> },
    { key: "qs", label: "สถานะใบเสนอราคา", sortValue: (x) => x.status, render: (x) => <QuotationStatusChip status={x.status} /> },
    { key: "ps", label: "สถานะรับชำระ", sortValue: (x) => x.summary.paymentStatus, render: (x) => <AggStateChip summary={x.summary} /> },
    { key: "pc", label: "รอตรวจ", align: "right", sortValue: (x) => x.summary.pendingCount, render: (x) => (x.summary.pendingCount ? <Chip size="small" color="warning" label={x.summary.pendingCount} /> : "—") },
    { key: "ex", label: "ข้อยกเว้น", hideBelowLg: true, render: (x) => (x.summary.exceptions.length ? <Chip size="small" color="warning" variant="outlined" label={`${x.summary.exceptions.length} รายการ`} /> : "—") },
  ];

  return (
    <>
      <WomsPageHeader
        title="สถานะรับชำระ (ใบเสนอราคา)"
        subtitle={loading ? "กำลังโหลด…" : `${items.length} ใบ · ยอดยืนยันนับเฉพาะรายการที่บัญชียืนยันแล้ว`}
        actions={
          <>
            {has("payments:verify") ? (
              <Button component={Link} href="/finance/queue" variant="contained">
                รอตรวจสอบเงินเข้า
              </Button>
            ) : null}
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportXlsx}>
              Excel
            </Button>
          </>
        }
      />
      <WomsFilterPanel
        search={<WomsSearchBar value={f.q} onChange={(v) => setF({ q: v })} placeholder="เลขที่ / ลูกค้า" />}
        activeCount={[f.status, f.pay, f.flag].filter(Boolean).length}
        onClear={() => setF({ status: "", pay: "", flag: "" })}
      >
        <WomsSelectFilter label="สถานะใบเสนอราคา" value={f.status} onChange={(v) => setF({ status: v })} options={Q_STATUSES.map((s) => ({ value: s, label: quotationStatusLabel[s] }))} />
        <WomsSelectFilter label="สถานะรับชำระ" value={f.pay} onChange={(v) => setF({ pay: v })} options={AGG.map((s) => ({ value: s, label: FIN_AGG_STATE_LABEL[s] }))} />
        <WomsSelectFilter
          label="เฉพาะ"
          value={f.flag}
          onChange={(v) => setF({ flag: v })}
          options={[
            { value: "pending", label: "มีรายการรอตรวจ" },
            { value: "exceptions", label: "มีข้อยกเว้นรอตรวจสอบ" },
          ]}
        />
      </WomsFilterPanel>
      <WomsDataTable
        caption="สถานะรับชำระของใบเสนอราคา"
        rows={items}
        columns={columns}
        rowKey={(x) => x.id}
        loading={loading}
        error={error}
        onRetry={load}
        pageSize={20}
        onRowClick={(x) => router.push(`/quotations/${x.id}?tab=payments`)}
        emptyTitle="ไม่มีใบเสนอราคาที่ตรงเงื่อนไข"
        renderCard={(x) => (
          <Card>
            <CardActionArea component={Link} href={`/quotations/${x.id}?tab=payments`}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <span className="code">{x.quotationNo}</span>
                  <AggStateChip summary={x.summary} />
                </Stack>
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{x.customerName}</Typography>
                <Typography variant="body2">
                  ต้องชำระ {fmtMoney(x.summary.amountDue)} · ยืนยัน {fmtMoney(x.summary.verifiedTotal)} · คงเหลือ {fmtMoney(x.summary.outstanding)}
                  {x.summary.pendingCount ? ` · รอตรวจ ${x.summary.pendingCount}` : ""}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        )}
      />
    </>
  );
}

export default function FinancePage() {
  return (
    <WomsPermissionGate perm="finance:view">
      <FinanceListInner />
    </WomsPermissionGate>
  );
}
