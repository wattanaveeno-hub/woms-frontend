"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { DocumentStatus, DocumentType, SalesDocument } from "@/lib/types";
import { documentStatusLabel, documentTypeLabel, fmtMoney } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { parseMoney } from "@/components/FieldErrors";
import { useUrlFilters } from "@/lib/urlFilters";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import {
  WomsDataTable,
  WomsFilterPanel,
  WomsPageHeader,
  WomsSearchBar,
  WomsSelectFilter,
  WomsStatusChip,
  type WomsColumn,
} from "@/components/woms";

const TYPES: DocumentType[] = [
  "RECEIPT",
  "TAX_INVOICE",
  "INVOICE",
  "CREDIT_NOTE",
  "DELIVERY_NOTE",
  "CONTRACT",
  "WARRANTY_CARD",
];
const STATUSES: DocumentStatus[] = ["ISSUED", "VOID"];

export default function DocumentsPage() {
  const { has } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const [items, setItems] = useState<SalesDocument[]>([]);
  // QA BUG-009 — ตัวกรองสะท้อนลง URL
  const [f, setF] = useUrlFilters({ type: "", status: "", q: "" });
  const type = f.type as DocumentType | "";
  const status = f.status as DocumentStatus | "";
  const q = f.q;
  const setType = (v: DocumentType | "") => setF({ type: v });
  const setStatus = (v: DocumentStatus | "") => setF({ status: v });
  const setQ = (v: string) => setF({ q: v });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // ผลค้นหาที่ตอบกลับช้ากว่าต้องไม่ทับผลล่าสุด (stale response guard)
  const seqRef = useRef(0);
  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.listDocuments({
        type: type || undefined,
        status: status || undefined,
        q: q || undefined,
      });
      if (seq !== seqRef.current) return;
      setItems(res.items);
    } catch (e) {
      if (seq !== seqRef.current) return;
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [type, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  const voidDoc = async (d: SalesDocument) => {
    const reason = await dialog.prompt({
      title: `ยกเลิกเอกสาร ${d.docNo}?`,
      message: "เอกสารจะยังอยู่ในระบบแต่ถูกทำเครื่องหมายว่ายกเลิก และย้อนกลับไม่ได้",
      label: "เหตุผลการยกเลิก",
      type: "textarea",
      required: true,
      confirmLabel: "ยืนยันยกเลิกเอกสาร",
      cancelLabel: "ไม่ยกเลิก",
      danger: true,
      validate: (v) => (v.trim().length < 3 ? "ต้องระบุเหตุผลอย่างน้อย 3 ตัวอักษร" : null),
    });
    if (reason === null) return;
    setBusyId(d.id);
    try {
      await api.voidDocument(d.id, reason.trim());
      toast.success(`ยกเลิก ${d.docNo} แล้ว`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const creditNote = async (d: SalesDocument) => {
    const remaining = d.netTotal;
    const raw = await dialog.prompt({
      title: `ออกใบลดหนี้จาก ${d.docNo}`,
      label: "ยอดที่ต้องการลดหนี้ (บาท)",
      help: `คงเหลือของเอกสารนี้ ${fmtMoney(remaining)} บาท`,
      type: "number",
      min: 0,
      step: 0.01,
      defaultValue: String(remaining),
      required: true,
      confirmLabel: "ถัดไป",
      // QA BUG-011 pattern — ยอดเงินต้องเป็นตัวเลขจริง ไม่รับ 1e5 / abc
      validate: (v) => {
        const r = parseMoney(v);
        if (!r.ok) return r.message;
        if (r.value <= 0) return "ยอดลดหนี้ต้องมากกว่า 0";
        if (r.value > remaining) return `ยอดลดหนี้ต้องไม่เกินยอดคงเหลือ ${fmtMoney(remaining)} บาท`;
        return null;
      },
    });
    if (raw === null) return;
    const parsedAmount = parseMoney(raw);
    if (!parsedAmount.ok) {
      toast.error(parsedAmount.message);
      return;
    }
    const amount = parsedAmount.value;
    const reason = await dialog.prompt({
      title: "เหตุผลการลดหนี้",
      message: `ลดหนี้ ${fmtMoney(amount)} บาท จากเอกสาร ${d.docNo}`,
      label: "เหตุผลการลดหนี้",
      type: "textarea",
      required: true,
      confirmLabel: "ออกใบลดหนี้",
      validate: (v) => (v.trim().length < 3 ? "ต้องระบุเหตุผลอย่างน้อย 3 ตัวอักษร" : null),
    });
    if (reason === null) return;
    setBusyId(d.id);
    try {
      const cn = await api.createCreditNote(d.id, { amount, reason: reason.trim() });
      toast.success(`ออกใบลดหนี้ ${cn.docNo} แล้ว`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ออกใบลดหนี้ไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const statusChip = (d: SalesDocument) => (
    <WomsStatusChip label={documentStatusLabel[d.status]} tone={d.status === "VOID" ? "neutral" : "success"} />
  );
  const actions = (d: SalesDocument) => (
    <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
      {d.status === "ISSUED" && d.type !== "CREDIT_NOTE" && has("documents:create") ? (
        <Button size="small" variant="outlined" onClick={() => creditNote(d)} disabled={busyId === d.id || d.netTotal <= 0}>
          ใบลดหนี้
        </Button>
      ) : null}
      {d.status === "ISSUED" && has("documents:void") ? (
        <Button size="small" variant="outlined" color="error" onClick={() => voidDoc(d)} disabled={busyId === d.id}>
          ยกเลิก
        </Button>
      ) : null}
    </Stack>
  );
  const ref = (d: SalesDocument) => (
    <Box className="mono" sx={{ fontSize: 12 }}>
      {d.contractNo || "—"}
      {d.refDocNo ? <div>อ้างถึง {d.refDocNo}</div> : null}
    </Box>
  );
  const columns: WomsColumn<SalesDocument>[] = [
    { key: "no", label: "เลขที่", sortValue: (d) => d.docNo, render: (d) => <Link href={`/documents/${d.id}`} className="code">{d.docNo}</Link> },
    { key: "type", label: "ประเภท", sortValue: (d) => documentTypeLabel[d.type], render: (d) => documentTypeLabel[d.type] },
    { key: "date", label: "วันที่", sortValue: (d) => d.issueDate, render: (d) => <span className="mono">{d.issueDate}</span> },
    { key: "cust", label: "ลูกค้า", sortValue: (d) => d.customerName, render: (d) => d.customerName || "—" },
    { key: "ref", label: "อ้างอิง", hideBelowLg: true, render: ref },
    { key: "total", label: "ยอดรวม", align: "right", sortValue: (d) => d.total, render: (d) => <span className="mono">{fmtMoney(d.total)}</span> },
    { key: "net", label: "คงเหลือสุทธิ", align: "right", hideBelowLg: true, sortValue: (d) => d.netTotal, render: (d) => <span className="mono">{fmtMoney(d.netTotal)}</span> },
    { key: "status", label: "สถานะ", sortValue: (d) => d.status, render: statusChip },
    { key: "act", label: "จัดการ", align: "right", render: actions },
  ];

  return (
    <>
      <WomsPageHeader
        title="เอกสารการขาย"
        subtitle={`${items.length} ฉบับ · ใบเสร็จ ใบกำกับภาษี ใบลดหนี้ ใบส่งของ`}
        actions={
          has("documents:create") ? (
            <Button component={Link} href="/documents/new" variant="contained" startIcon={<AddIcon />}>
              ออกเอกสาร
            </Button>
          ) : undefined
        }
      />

      <WomsFilterPanel
        search={<WomsSearchBar value={q} onChange={setQ} placeholder="ค้นหาเลขที่เอกสาร / ลูกค้า / สัญญา / serial" />}
        activeCount={[type, status].filter(Boolean).length}
        onClear={() => setF({ type: "", status: "" })}
      >
        <WomsSelectFilter
          label="ประเภท"
          value={type}
          onChange={(v) => setType(v as DocumentType | "")}
          options={TYPES.map((t) => ({ value: t, label: documentTypeLabel[t] }))}
          allLabel="ทุกประเภท"
        />
        <WomsSelectFilter
          label="สถานะ"
          value={status}
          onChange={(v) => setStatus(v as DocumentStatus | "")}
          options={STATUSES.map((s) => ({ value: s, label: documentStatusLabel[s] }))}
          allLabel="ทุกสถานะ"
        />
      </WomsFilterPanel>

      <WomsDataTable
        caption="เอกสารการขาย"
        rows={items}
        loading={loading}
        error={error}
        onRetry={load}
        columns={columns}
        rowKey={(d) => d.id}
        pageSize={25}
        emptyTitle="ยังไม่มีเอกสาร"
        renderCard={(d) => (
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                <Link href={`/documents/${d.id}`} className="code">{d.docNo}</Link>
                {statusChip(d)}
              </Stack>
              <Typography sx={{ color: "text.primary" }}>
                {documentTypeLabel[d.type]} · {d.customerName || "—"}
              </Typography>
              <Typography variant="body2" className="mono">
                {d.issueDate} · รวม {fmtMoney(d.total)} · คงเหลือ {fmtMoney(d.netTotal)}
              </Typography>
              {ref(d)}
              <Box sx={{ mt: 1 }}>{actions(d)}</Box>
            </CardContent>
          </Card>
        )}
      />
    </>
  );
}
