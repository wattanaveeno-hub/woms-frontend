"use client";

// ---------------------------------------------------------------------------
// Round 6 — สัญญาและใบเสนอราคาของลูกค้ารายนี้
// ---------------------------------------------------------------------------
// ดึงด้วย partnerId ตรงตัวเท่านั้น (ไม่เทียบชื่อ) · สัญญาเก่าที่ยังไม่ผูกลูกค้าจะไม่แสดงที่นี่
// จนกว่าจะผูกด้วยสคริปต์ backfill ตาม mapping ที่คนยืนยัน
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Contract, Quotation } from "@/lib/types";
import { contractTypeLabel, fmtMoney } from "@/lib/options";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ContractStatusChip, QuotationStatusChip, WomsDataTable, WomsFormSection, type WomsColumn } from "@/components/woms";

function useList<T>(enabled: boolean, fetcher: () => Promise<{ items: T[] }>, msg: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return;
    setError(null);
    setItems(null);
    try {
      setItems((await fetcher()).items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : msg);
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  useEffect(() => {
    load();
  }, [load]);
  return { items, error, load };
}

export default function PartnerDocuments({ partnerId }: { partnerId: string }) {
  const { has } = useAuth();
  const canContracts = has("contracts:view");
  const canQuotations = has("quotations:view");
  const ct = useList<Contract>(canContracts, () => api.listContracts({ partnerId }), "โหลดสัญญาไม่สำเร็จ");
  const qt = useList<Quotation>(canQuotations, () => api.listQuotations({ partnerId }), "โหลดใบเสนอราคาไม่สำเร็จ");

  const ctCols: WomsColumn<Contract>[] = [
    { key: "no", label: "เลขที่", sortValue: (c) => c.contractNo, render: (c) => <Link href={`/contracts/${c.id}`} className="code">{c.contractNo}</Link> },
    { key: "type", label: "ประเภท", render: (c) => contractTypeLabel[c.type] },
    { key: "serial", label: "เครื่อง", render: (c) => <span className="mono">{c.serial || "-"}</span> },
    { key: "start", label: "เริ่ม", sortValue: (c) => c.startDate, render: (c) => <span className="mono">{c.startDate}</span> },
    { key: "status", label: "สถานะ", render: (c) => <ContractStatusChip status={c.status} /> },
  ];
  const qtCols: WomsColumn<Quotation>[] = [
    { key: "no", label: "เลขที่", sortValue: (q) => q.quotationNo, render: (q) => <Link href={`/quotations/${q.id}`} className="code">{q.quotationNo}</Link> },
    { key: "date", label: "วันที่", sortValue: (q) => q.issueDate, render: (q) => <span className="mono">{q.issueDate}</span> },
    { key: "total", label: "ยอดรวม", align: "right", sortValue: (q) => q.total, render: (q) => <span className="mono">{fmtMoney(q.total)}</span> },
    { key: "status", label: "สถานะ", render: (q) => <QuotationStatusChip status={q.status} /> },
  ];
  const card = (href: string, no: string, chip: React.ReactNode, line: string) => (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
        <Link href={href} className="code">{no}</Link>
        {chip}
      </Stack>
      <Typography variant="body2">{line}</Typography>
    </Box>
  );

  return (
    <>
      {canContracts ? (
        <WomsFormSection title={`สัญญาของลูกค้ารายนี้${ct.items ? ` (${ct.items.length})` : ""}`}>
          <WomsDataTable
            caption="สัญญาของลูกค้ารายนี้"
            rows={ct.items ?? []}
            loading={ct.items === null}
            error={ct.error}
            onRetry={ct.load}
            columns={ctCols}
            rowKey={(c) => c.id}
            pageSize={10}
            emptyTitle="ยังไม่มีสัญญาที่ผูกกับลูกค้ารายนี้"
            emptyDescription="สัญญาที่สร้างก่อนมีการผูกลูกค้า จะแสดงเมื่อผูกเรียบร้อยแล้ว"
            renderCard={(c) => card(`/contracts/${c.id}`, c.contractNo, <ContractStatusChip status={c.status} />, `${contractTypeLabel[c.type]} · ${c.serial || "-"} · เริ่ม ${c.startDate}`)}
          />
        </WomsFormSection>
      ) : null}
      {canQuotations ? (
        <WomsFormSection title={`ใบเสนอราคาของลูกค้ารายนี้${qt.items ? ` (${qt.items.length})` : ""}`}>
          <WomsDataTable
            caption="ใบเสนอราคาของลูกค้ารายนี้"
            rows={qt.items ?? []}
            loading={qt.items === null}
            error={qt.error}
            onRetry={qt.load}
            columns={qtCols}
            rowKey={(q) => q.id}
            pageSize={10}
            emptyTitle="ยังไม่มีใบเสนอราคาที่ผูกกับลูกค้ารายนี้"
            renderCard={(q) => card(`/quotations/${q.id}`, q.quotationNo, <QuotationStatusChip status={q.status} />, `${q.issueDate} · ${fmtMoney(q.total)} บาท`)}
          />
        </WomsFormSection>
      ) : null}
    </>
  );
}
