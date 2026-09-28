"use client";

// รายละเอียดรายการวางบิล — ส่งตรวจ / ส่งกลับแก้ไข / อนุมัติ / จ่ายแล้ว
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import type { BillStatus, TechBill } from "@/lib/types";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  BillingStatusChip,
  WomsDataTable,
  WomsErrorState,
  WomsFormSection,
  WomsLoadingState,
  WomsPageHeader,
  WomsStatCard,
  WomsStatGrid,
  type WomsColumn,
} from "@/components/woms";

const baht = (n: number) => n.toLocaleString("th-TH");
type BillItem = TechBill["items"][number];
type BillDay = TechBill["days"][number];
type BillExpense = TechBill["expenses"][number];
const cardBox = { border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 } as const;

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, has } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const canReview = has("bill:review");
  const canApprove = has("bill:approve");

  const [bill, setBill] = useState<TechBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBill(await api.getBill(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดรายการไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (status: BillStatus, needNote = false) => {
    let note = "";
    // การอนุมัติ / บันทึกจ่ายเงิน เป็นการเปลี่ยนสถานะทางการเงิน — ยืนยันก่อนเสมอ
    if (
      (status === "APPROVED" || status === "PAID") &&
      bill &&
      !(await dialog.confirm({
        title: status === "APPROVED" ? `อนุมัติบิล ${bill.billNo}?` : `บันทึกว่าจ่ายบิล ${bill.billNo} แล้ว?`,
        message: `ยอดรวม ${baht(bill.totals.grandTotal)} บาท · ${bill.technicianName}`,
        confirmLabel: status === "APPROVED" ? "อนุมัติ" : "บันทึกว่าจ่ายแล้ว",
      }))
    )
      return;
    if (needNote) {
      const r = await dialog.prompt({
        title: status === "RETURNED" ? "ส่งบิลกลับให้แก้ไข" : "ยกเลิกบิล",
        label: status === "RETURNED" ? "เหตุผลที่ส่งกลับให้แก้ไข" : "เหตุผล",
        help: "ช่างจะเห็นข้อความนี้บนบิล",
        type: "textarea",
        required: true,
        confirmLabel: status === "RETURNED" ? "ส่งกลับให้แก้ไข" : "ยืนยันยกเลิกบิล",
        danger: status === "CANCELLED",
      });
      if (r === null) return;
      note = r.trim();
    }
    setBusy(true);
    try {
      setBill(await api.setBillStatus(id, status, note));
      toast.success("อัปเดตสถานะแล้ว");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
      load();
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <Button component={Link} href="/bills" startIcon={<ArrowBackIcon />}>
      รายการวางบิล
    </Button>
  );
  if (error) {
    return (
      <>
        <WomsPageHeader title="วางบิลช่าง" actions={back} />
        <WomsErrorState message={error} onRetry={load} />
      </>
    );
  }
  if (!bill) return <WomsLoadingState rows={5} />;

  const isOwner = bill.technicianId === user?.id;

  const itemCols: WomsColumn<BillItem>[] = [
    {
      key: "job",
      label: "ใบงาน",
      sortValue: (it) => it.jobId,
      render: (it) => (
        <>
          <Link href={`/jobs/${it.jobId}`} className="code">
            {it.jobId}
          </Link>
          {it.jobName ? <Typography variant="body2">{it.jobName}</Typography> : null}
        </>
      ),
    },
    { key: "date", label: "วันที่", sortValue: (it) => it.jobDate, render: (it) => <span className="mono">{it.jobDate}</span> },
    { key: "cust", label: "ลูกค้า", render: (it) => it.customerName || "—" },
    { key: "labor", label: "ค่าแรง", align: "right", sortValue: (it) => it.laborAmount, render: (it) => <span className="mono">{baht(it.laborAmount)}</span> },
  ];
  const dayCols: WomsColumn<BillDay>[] = [
    { key: "date", label: "วันที่", sortValue: (d) => d.date, render: (d) => <span className="mono">{d.date}</span> },
    { key: "km", label: "ระยะทาง (กม.)", align: "right", render: (d) => <span className="mono">{d.distanceKm}</span> },
    { key: "amt", label: "ค่าเดินทาง", align: "right", render: (d) => <span className="mono">{baht(d.travelAmount)}</span> },
    { key: "note", label: "หมายเหตุ", render: (d) => d.note || "—" },
  ];
  const expCols: WomsColumn<BillExpense>[] = [
    { key: "label", label: "รายการ", render: (e) => e.label },
    { key: "amt", label: "จำนวนเงิน", align: "right", render: (e) => <span className="mono">{baht(e.amount)}</span> },
    { key: "att", label: "หลักฐาน", render: (e) => (e.attachment ? "แนบแล้ว" : "—") },
  ];

  return (
    <>
      <WomsPageHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center" component="span" flexWrap="wrap" useFlexGap>
            <span className="code">{bill.billNo}</span>
            <BillingStatusChip status={bill.status} label={bill.statusLabel} />
          </Stack>
        }
        subtitle={`${bill.technicianName} · รอบ ${bill.periodFrom} → ${bill.periodTo} · ${bill.totals.jobCount} ใบงาน`}
        actions={back}
      />

      {bill.status === "RETURNED" && bill.reviewNote && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ถูกส่งกลับให้แก้ไขโดย {bill.reviewedBy} — {bill.reviewNote}
        </Alert>
      )}
      {bill.status === "CANCELLED" && bill.cancelReason && (
        <Alert severity="error" sx={{ mb: 2 }}>
          ยกเลิกแล้ว — {bill.cancelReason}
        </Alert>
      )}
      {bill.datesMissingTravel && bill.datesMissingTravel.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ยังไม่ได้ลงระยะทางของวันที่: {bill.datesMissingTravel.join(", ")}
        </Alert>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {(bill.status === "DRAFT" || bill.status === "RETURNED") && (isOwner || canReview) && (
          <Button variant="contained" disabled={busy} onClick={() => act("SUBMITTED")}>
            ส่งตรวจ
          </Button>
        )}
        {bill.status === "SUBMITTED" && canReview && (
          <Button variant="outlined" disabled={busy} onClick={() => act("RETURNED", true)}>
            ส่งกลับให้แก้ไข
          </Button>
        )}
        {bill.status === "SUBMITTED" && canApprove && (
          <Button variant="contained" disabled={busy} onClick={() => act("APPROVED")}>
            อนุมัติ
          </Button>
        )}
        {bill.status === "APPROVED" && canApprove && (
          <Button variant="contained" disabled={busy} onClick={() => act("PAID")}>
            บันทึกว่าจ่ายแล้ว
          </Button>
        )}
        {bill.status !== "PAID" && bill.status !== "CANCELLED" && (isOwner || canReview) && (
          <Button color="error" variant="outlined" disabled={busy} onClick={() => act("CANCELLED", true)}>
            ยกเลิกบิล
          </Button>
        )}
      </Stack>

      <WomsStatGrid>
        <WomsStatCard value={baht(bill.totals.laborTotal)} label="ค่าแรง" />
        <WomsStatCard
          value={baht(bill.totals.travelTotal)}
          label="ค่าเดินทาง"
          hint={`${bill.totals.dayCount} วัน · ${bill.totals.distanceTotalKm} กม.`}
        />
        <WomsStatCard value={baht(bill.totals.expenseTotal)} label="ค่าใช้จ่ายอื่น" />
        <WomsStatCard value={baht(bill.totals.grandTotal)} label="รวมทั้งสิ้น" tone="primary" />
      </WomsStatGrid>

      <WomsFormSection title="ใบงานในบิลนี้">
        <WomsDataTable
          caption="ใบงานในบิล"
          rows={bill.items}
          columns={itemCols}
          rowKey={(it) => it.jobId}
          pageSize={25}
          emptyTitle="ไม่มีใบงานในบิลนี้"
          renderCard={(it) => (
            <Box sx={cardBox}>
              <Stack direction="row" justifyContent="space-between">
                <Link href={`/jobs/${it.jobId}`} className="code">
                  {it.jobId}
                </Link>
                <span className="mono">{baht(it.laborAmount)}</span>
              </Stack>
              <Typography variant="body2">
                {it.jobDate} · {it.customerName || "—"}
                {it.jobName ? ` · ${it.jobName}` : ""}
              </Typography>
            </Box>
          )}
        />
      </WomsFormSection>

      <WomsFormSection title="ค่าเดินทางรายวัน">
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          หนึ่งวันหนึ่งแถว — หลายใบงานในวันเดียวกันไม่ทำให้ค่าเดินทางถูกคิดซ้ำ
        </Typography>
        <WomsDataTable
          caption="ค่าเดินทางรายวัน"
          rows={bill.days}
          columns={dayCols}
          rowKey={(d) => d.date}
          pageSize={31}
          emptyTitle="ยังไม่ได้ลงค่าเดินทาง"
          renderCard={(d) => (
            <Box sx={cardBox}>
              <Stack direction="row" justifyContent="space-between">
                <span className="mono">{d.date}</span>
                <span className="mono">{baht(d.travelAmount)}</span>
              </Stack>
              <Typography variant="body2">
                {d.distanceKm} กม.{d.note ? ` · ${d.note}` : ""}
              </Typography>
            </Box>
          )}
        />
      </WomsFormSection>

      {bill.expenses.length > 0 && (
        <WomsFormSection title="ค่าใช้จ่ายอื่น">
          <WomsDataTable
            caption="ค่าใช้จ่ายอื่น"
            rows={bill.expenses}
            columns={expCols}
            rowKey={(e) => e.id}
            pageSize={25}
            renderCard={(e) => (
              <Box sx={cardBox}>
                <Stack direction="row" justifyContent="space-between">
                  <span>{e.label}</span>
                  <span className="mono">{baht(e.amount)}</span>
                </Stack>
                <Typography variant="body2">หลักฐาน: {e.attachment ? "แนบแล้ว" : "—"}</Typography>
              </Box>
            )}
          />
        </WomsFormSection>
      )}
    </>
  );
}
