"use client";

// BD-04 — งวดสัญญาเช่า/เช่าซื้อในหน้าการเงิน (อ่านอย่างเดียว · รับชำระที่หน้าสัญญาตามเดิม)
//   ยอดรวมของงวดสัญญาแสดงแยกจากยอดใบเสนอราคา — ไม่บวกรวมกันเป็นตัวเลขเดียว (กันนับซ้ำ)
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ApiError } from "@/lib/api";
import { fmtMoney } from "@/lib/options";
import { financeApi, type FinanceInstallmentRow, type FinanceInstallmentTotals } from "@/lib/financeApi";
import { installmentPayLabel, installmentDocLabel, installmentPayTone } from "@/lib/financeInstallments";
import {
  WomsCountTabs,
  WomsDataTable,
  WomsFilterPanel,
  WomsSearchBar,
  WomsSelectFilter,
  WomsStatCard,
  WomsStatGrid,
  WomsStatusChip,
  type WomsColumn,
} from "@/components/woms";

type Status = "open" | "overdue" | "paid" | "all";

export default function InstallmentsPanel({
  filters,
  setFilters,
}: {
  filters: { q: string; ist: string; doc: string };
  setFilters: (p: Partial<{ q: string; ist: string; doc: string }>) => void;
}) {
  const router = useRouter();
  const status = (filters.ist || "open") as Status;
  const [items, setItems] = useState<FinanceInstallmentRow[]>([]);
  const [totals, setTotals] = useState<FinanceInstallmentTotals | null>(null);
  const [overall, setOverall] = useState<FinanceInstallmentTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const r = await financeApi.installments({ status, q: filters.q, doc: filters.doc });
      if (n !== seq.current) return;
      setItems(r.items);
      setTotals(r.totals);
      setOverall(r.overall);
    } catch (e) {
      if (n === seq.current) setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [status, filters.q, filters.doc]);
  useEffect(() => {
    load();
  }, [load]);

  const href = (x: FinanceInstallmentRow) => `/contracts/${x.contractId}`;
  const columns: WomsColumn<FinanceInstallmentRow>[] = [
    { key: "ct", label: "สัญญา", sortValue: (x) => x.contractNo, render: (x) => <Link href={href(x)} className="code" onClick={(e) => e.stopPropagation()}>{x.contractNo}</Link> },
    { key: "no", label: "งวด", align: "right", sortValue: (x) => x.no, render: (x) => x.no },
    { key: "cust", label: "ลูกค้า", sortValue: (x) => x.customerName, render: (x) => x.customerName || "—" },
    { key: "due", label: "ครบกำหนด", sortValue: (x) => x.dueDate, render: (x) => <Box component="span" className="mono" sx={{ color: x.overdue ? "error.main" : undefined }}>{x.dueDate || "—"}</Box> },
    { key: "amt", label: "ยอดงวด", align: "right", sortValue: (x) => x.amount, render: (x) => <span className="mono">{fmtMoney(x.amount)}</span> },
    { key: "paid", label: "รับแล้ว", align: "right", sortValue: (x) => x.paid, render: (x) => <span className="mono">{fmtMoney(x.paid)}</span> },
    { key: "out", label: "คงค้าง", align: "right", sortValue: (x) => x.outstanding, render: (x) => <span className="mono">{fmtMoney(x.outstanding)}</span> },
    { key: "pay", label: "สถานะชำระ", sortValue: (x) => x.paymentState, render: (x) => <WomsStatusChip label={installmentPayLabel(x)} tone={installmentPayTone(x)} /> },
    { key: "doc", label: "เอกสารบัญชี", sortValue: (x) => x.docStatus, render: (x) => (x.receiptNo ? <span className="code">{x.receiptNo}</span> : installmentDocLabel(x.docStatus)) },
    { key: "qt", label: "จากใบเสนอราคา", hideBelowLg: true, render: (x) => x.quotationNo || "—" },
  ];

  return (
    <Box data-testid="finance-installments">
      {overall && totals ? (
        <WomsStatGrid max={4}>
          <WomsStatCard value={fmtMoney(overall.outstanding)} label="งวดสัญญาคงค้างทั้งหมด" hint={`${overall.count} งวด`} />
          <WomsStatCard value={fmtMoney(overall.overdueAmount)} label="เลยกำหนด" hint={`${overall.overdueCount} งวด`} />
          <WomsStatCard value={fmtMoney(totals.paid)} label="รับแล้ว (ตามตัวกรอง)" hint={`${totals.count} งวด`} />
          <WomsStatCard value={totals.paidWithoutReceipt} label="รับเงินแล้ว ยังไม่ออกใบเสร็จ" hint="งวด (ตามตัวกรอง)" />
        </WomsStatGrid>
      ) : null}
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
        ยอดงวดสัญญาแยกจากยอดใบเสนอราคา ไม่รวมกัน · รับชำระและออกใบเสร็จที่หน้าสัญญา
      </Typography>
      <WomsFilterPanel
        search={<WomsSearchBar value={filters.q} onChange={(v) => setFilters({ q: v })} placeholder="เลขสัญญา / ลูกค้า / Serial / เลขใบเสร็จ" />}
        activeCount={[filters.doc].filter(Boolean).length}
        onClear={() => setFilters({ doc: "" })}
      >
        <WomsSelectFilter
          label="เอกสารบัญชี"
          value={filters.doc}
          onChange={(v) => setFilters({ doc: v })}
          options={[
            { value: "issued", label: "ออกใบเสร็จแล้ว" },
            { value: "not_issued", label: "รับเงินแล้ว ยังไม่ออกใบเสร็จ" },
          ]}
        />
      </WomsFilterPanel>
      <Box data-testid="installment-tabs">
        <WomsCountTabs
          ariaLabel="สถานะงวด"
          value={status}
          onChange={(v) => setFilters({ ist: v })}
          tabs={[
            { value: "open", label: "ค้างชำระ" },
            { value: "overdue", label: "เลยกำหนด" },
            { value: "paid", label: "ชำระครบ" },
            { value: "all", label: "ทั้งหมด" },
          ]}
        />
      </Box>
      <WomsDataTable
        caption="งวดสัญญาเช่า/เช่าซื้อ"
        rows={items}
        columns={columns}
        rowKey={(x) => `${x.contractId}-${x.no}`}
        loading={loading}
        error={error}
        onRetry={load}
        pageSize={20}
        onRowClick={(x) => router.push(href(x))}
        emptyTitle="ไม่มีงวดที่ตรงเงื่อนไข"
        renderCard={(x) => (
          <Card>
            <CardActionArea component={Link} href={href(x)}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <span className="code">
                    {x.contractNo} · งวด {x.no}
                  </span>
                  <WomsStatusChip label={installmentPayLabel(x)} tone={installmentPayTone(x)} />
                </Stack>
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{x.customerName || "—"}</Typography>
                <Typography variant="body2">
                  ครบกำหนด {x.dueDate || "—"} · ยอด {fmtMoney(x.amount)} · คงค้าง {fmtMoney(x.outstanding)} · {x.receiptNo ? `ใบเสร็จ ${x.receiptNo}` : installmentDocLabel(x.docStatus)}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        )}
      />
    </Box>
  );
}
