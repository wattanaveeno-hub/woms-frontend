"use client";

// ---------------------------------------------------------------------------
// รายละเอียดรายการวางบิล — ติดตามสถานะ ตรวจ ปรับราคา อนุมัติ ออกใบ จ่าย ยืนยันรับเงิน (BILL-03..07)
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { billsApi, jobCostSum, type PaymentInput, type TechBillV2 } from "@/lib/billsApi";
import type { BillStatus, TechBill } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { BillAdjustDialog, BillPaymentDialog, type AdjustResult } from "@/components/BillReviewDialogs";
import { EvidencePreview } from "@/components/BillEvidenceInput";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import PrintIcon from "@mui/icons-material/Print";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
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

const baht = (n: number) => (Number(n) || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const dt = (iso?: string) => (iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "");
type BillItem = TechBill["items"][number];
type BillDay = TechBill["days"][number];
type BillExpense = TechBill["expenses"][number];
const cardBox = { border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 } as const;

const FLOW: BillStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "PRINTED", "PAYMENT_PENDING", "PAID"];
const FLOW_LABEL: Record<string, string> = {
  DRAFT: "ร่าง",
  SUBMITTED: "ส่งตรวจ",
  UNDER_REVIEW: "กำลังตรวจ",
  APPROVED: "อนุมัติ",
  PRINTED: "ออกใบวางบิล",
  PAYMENT_PENDING: "รอจ่าย",
  PAID: "จ่ายแล้ว",
};

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, has } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const canReview = has("bill:review");
  const canApprove = has("bill:approve");

  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down("sm"));
  const [bill, setBill] = useState<TechBillV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBill(await billsApi.get(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดรายการไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<TechBillV2>, ok: string) => {
    setBusy(true);
    try {
      setBill(await fn());
      toast.success(ok);
      return true;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ทำรายการไม่สำเร็จ");
      load();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const NOTE_PROMPT: Partial<Record<BillStatus, { title: string; label: string; confirm: string; danger?: boolean }>> = {
    RETURNED: { title: "ส่งบิลกลับให้ช่างแก้ไข", label: "เหตุผลที่ส่งกลับ", confirm: "ส่งกลับให้แก้ไข" },
    ON_HOLD: { title: "พักบิลเพื่อรอข้อมูล", label: "ข้อมูลที่รอ / เหตุผล", confirm: "พักบิล" },
    CANCELLED: { title: "ยกเลิกบิล", label: "เหตุผล", confirm: "ยืนยันยกเลิกบิล", danger: true },
  };

  const act = async (status: BillStatus) => {
    if (!bill) return;
    let note = "";
    const p = NOTE_PROMPT[status];
    if (p) {
      const r = await dialog.prompt({
        title: p.title,
        label: p.label,
        help: "ช่างจะเห็นข้อความนี้บนบิล",
        type: "textarea",
        required: true,
        confirmLabel: p.confirm,
        danger: p.danger,
      });
      if (r === null) return;
      note = r.trim();
    }
    if (
      status === "APPROVED" &&
      !(await dialog.confirm({
        title: `อนุมัติบิล ${bill.billNo}?`,
        message: `ยอดรวม ${baht(bill.totals.grandTotal)} บาท · ${bill.technicianName} — หลังอนุมัติ รายการเครื่องและยอดจะถูกล็อก`,
        confirmLabel: "อนุมัติ",
      }))
    )
      return;
    if (status === "PAYMENT_PENDING" && !(await dialog.confirm({ title: `ส่งบิล ${bill.billNo} เข้ารอจ่าย?`, confirmLabel: "ส่งรอจ่าย" })))
      return;
    await run(() => billsApi.setStatus(id, status, note), "อัปเดตสถานะแล้ว");
  };

  const pay = async (p: PaymentInput) => {
    if (await run(() => billsApi.setStatus(id, "PAID", "", p), "บันทึกการจ่ายแล้ว")) setPayOpen(false);
  };
  const adjust = async (r: AdjustResult) => {
    if (!bill) return;
    if (await run(() => billsApi.adjust(id, r, bill.updatedAt), "บันทึกการปรับราคาแล้ว")) setAdjustOpen(false);
  };
  const confirmReceipt = async () => {
    if (!bill) return;
    const ok = await dialog.confirm({
      title: "ยืนยันว่าได้รับเงินแล้ว?",
      message: `บิล ${bill.billNo} ยอด ${baht(bill.totals.grandTotal)} บาท · อ้างอิง ${bill.paymentRef ?? ""}`,
      confirmLabel: "ยืนยันรับเงิน",
    });
    if (ok) await run(() => billsApi.confirmReceipt(id), "ยืนยันรับเงินแล้ว");
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
  const s = bill.status;
  const machine = bill.format === "MACHINE";
  const flowIndex = FLOW.indexOf(s);
  const jobIds = [...new Set(bill.machineItems.map((m) => m.jobId))];

  // ---- ปุ่มตามสถานะและสิทธิ์ (backend ตรวจซ้ำทุกขั้น) ----
  const actions: React.ReactNode[] = [];
  const btn = (key: string, label: string, onClick: () => void, variant: "contained" | "outlined" | "text" = "outlined", extra: object = {}) =>
    actions.push(
      <Button key={key} variant={variant} disabled={busy} onClick={onClick} {...extra}>
        {label}
      </Button>
    );
  if ((s === "DRAFT" || s === "RETURNED") && (isOwner || canReview)) {
    if (machine)
      actions.push(
        <Button key="edit" component={Link} href={`/bills/${id}/edit`} startIcon={<EditIcon />} variant="outlined" disabled={busy}>
          แก้ไข
        </Button>
      );
    btn("submit", "ส่งตรวจ", () => act("SUBMITTED"), "contained");
  }
  if (canReview) {
    if (s === "SUBMITTED" || s === "ON_HOLD") btn("review", s === "ON_HOLD" ? "กลับไปตรวจต่อ" : "เริ่มตรวจสอบ", () => act("UNDER_REVIEW"), "contained");
    if (machine && (s === "SUBMITTED" || s === "UNDER_REVIEW" || s === "ON_HOLD")) btn("adjust", "ปรับราคา (ระบุเหตุผล)", () => setAdjustOpen(true));
    if (s === "SUBMITTED" || s === "UNDER_REVIEW") btn("hold", "พักรอข้อมูล", () => act("ON_HOLD"));
    if (s === "SUBMITTED" || s === "UNDER_REVIEW" || s === "ON_HOLD") btn("return", "ส่งกลับให้แก้ไข", () => act("RETURNED"));
  }
  if (canApprove && (s === "SUBMITTED" || s === "UNDER_REVIEW")) btn("approve", "อนุมัติ", () => act("APPROVED"), "contained");
  if (canReview && s === "APPROVED")
    actions.push(
      <Button key="print" component={Link} href={`/bills/${id}/print`} variant="contained" startIcon={<PrintIcon />}>
        ออกใบวางบิล
      </Button>
    );
  if (canApprove && canReview && s === "APPROVED") btn("unapprove", "ถอนอนุมัติ / ส่งกลับแก้ไข", () => act("RETURNED"), "text");
  if (canReview && (s === "PRINTED" || s === "PAYMENT_PENDING" || s === "PAID"))
    actions.push(
      <Button key="reprint" component={Link} href={`/bills/${id}/print`} startIcon={<PrintIcon />}>
        พิมพ์ใบวางบิล
      </Button>
    );
  if (canReview && s === "PRINTED") btn("pending", "ส่งรอจ่ายเงิน", () => act("PAYMENT_PENDING"), "contained");
  if (canApprove && canReview && s === "PAYMENT_PENDING") btn("pay", "บันทึกการจ่าย + แนบหลักฐาน", () => setPayOpen(true), "contained");
  if (isOwner && s === "PAID" && !bill.receivedConfirmedAt)
    actions.push(
      <Button key="receipt" variant="contained" color="success" startIcon={<TaskAltIcon />} disabled={busy} onClick={confirmReceipt}>
        ยืนยันรับเงิน
      </Button>
    );
  // ช่างยกเลิกเองได้เฉพาะร่าง/ถูกส่งกลับ · ส่งตรวจแล้วเป็นอำนาจผู้ตรวจ (backend บังคับเหมือนกัน)
  if (
    (canReview && ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "ON_HOLD", "RETURNED"].includes(s)) ||
    (isOwner && ["DRAFT", "RETURNED"].includes(s))
  )
    btn("cancel", "ยกเลิกบิล", () => act("CANCELLED"), "outlined", { color: "error" });

  // ---- ตารางบิลรูปแบบเดิม ----
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
    { key: "att", label: "หลักฐาน", render: (e) => (e.attachment ? <EvidencePreview src={e.attachment} /> : "—") },
  ];

  return (
    <>
      <WomsPageHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center" component="span" flexWrap="wrap" useFlexGap>
            <span className="code">{bill.billNo}</span>
            <BillingStatusChip status={bill.status} label={bill.statusLabel} />
            {bill.locked ? <Typography component="span" variant="body2">· ล็อกยอดแล้ว</Typography> : null}
          </Stack>
        }
        subtitle={`${bill.technicianName} · รอบ ${bill.periodFrom} → ${bill.periodTo} · ${
          machine ? `${bill.totals.machineCount} เครื่อง / ` : ""
        }${bill.totals.jobCount} ใบงาน${machine ? "" : " · รูปแบบเดิม (ค่าแรงรายใบงาน + ค่าเดินทางรายวัน)"}`}
        actions={back}
      />

      {s !== "CANCELLED" && s !== "RETURNED" && s !== "ON_HOLD" ? (
        <Box sx={{ overflowX: "auto", mb: 2 }}>
          {/* มือถือ (< sm): แนวตั้ง ไม่ต้องเลื่อนซ้ายขวา */}
          <Stepper
            activeStep={flowIndex}
            orientation={narrow ? "vertical" : "horizontal"}
            alternativeLabel={!narrow}
            sx={narrow ? undefined : { minWidth: 560 }}
          >
            {FLOW.map((f) => (
              <Step key={f} completed={flowIndex > FLOW.indexOf(f) || (f === "PAID" && s === "PAID")}>
                <StepLabel>{FLOW_LABEL[f]}</StepLabel>
              </Step>
            ))}
            <Step completed={!!bill.receivedConfirmedAt}>
              <StepLabel>ช่างยืนยันรับเงิน</StepLabel>
            </Step>
          </Stepper>
        </Box>
      ) : null}

      {s === "RETURNED" && bill.reviewNote ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ถูกส่งกลับให้แก้ไขโดย {bill.reviewedBy} — {bill.reviewNote}
        </Alert>
      ) : null}
      {s === "ON_HOLD" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          พักรอข้อมูลโดย {bill.holdBy} {dt(bill.holdAt)} — {bill.holdReason}
        </Alert>
      ) : null}
      {s === "CANCELLED" && bill.cancelReason ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          ยกเลิกแล้ว — {bill.cancelReason}
        </Alert>
      ) : null}
      {bill.datesMissingTravel && bill.datesMissingTravel.length > 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ยังไม่ได้ลงระยะทางของวันที่: {bill.datesMissingTravel.join(", ")}
        </Alert>
      ) : null}

      {actions.length ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          {actions}
        </Stack>
      ) : null}

      <WomsStatGrid>
        {machine ? (
          <>
            <WomsStatCard value={baht(bill.totals.serviceFeeTotal)} label="ค่าบริการรายเครื่อง" hint={`${bill.totals.machineCount} เครื่อง`} />
            <WomsStatCard value={baht(bill.totals.sharedTotal)} label="ค่าใช้จ่ายร่วม" hint={`${jobIds.length} ใบงาน · ${bill.totals.distanceTotalKm} กม.`} />
          </>
        ) : (
          <>
            <WomsStatCard value={baht(bill.totals.laborTotal)} label="ค่าแรง" />
            <WomsStatCard value={baht(bill.totals.travelTotal)} label="ค่าเดินทาง" hint={`${bill.totals.dayCount} วัน · ${bill.totals.distanceTotalKm} กม.`} />
            <WomsStatCard value={baht(bill.totals.expenseTotal)} label="ค่าใช้จ่ายอื่น" />
          </>
        )}
        <WomsStatCard
          value={baht(bill.totals.grandTotal)}
          label="รวมทั้งสิ้น"
          tone="primary"
          hint={bill.approvedTotal !== undefined && bill.locked ? `ยอดอนุมัติ ${baht(bill.approvedTotal)}` : undefined}
        />
      </WomsStatGrid>

      {s === "PAID" || bill.paymentRef ? (
        <WomsFormSection title="การจ่ายเงินและการยืนยันรับเงิน">
          <Stack spacing={1}>
            <Typography>
              จ่ายวันที่ <strong>{bill.paidDate || "—"}</strong> · เลขอ้างอิง <strong className="mono">{bill.paymentRef || "—"}</strong> · บันทึกโดย{" "}
              {bill.paidBy || "—"} {bill.paidAt ? `(${dt(bill.paidAt)})` : ""}
            </Typography>
            {bill.paymentEvidence ? <EvidencePreview src={bill.paymentEvidence} label="หลักฐานการจ่าย" /> : null}
            {bill.receivedConfirmedAt ? (
              <Alert severity="success" icon={<TaskAltIcon />}>
                ช่าง {bill.receivedConfirmedBy} ยืนยันรับเงินแล้วเมื่อ {dt(bill.receivedConfirmedAt)}
              </Alert>
            ) : (
              <Alert severity="info">รอช่างยืนยันรับเงิน</Alert>
            )}
          </Stack>
        </WomsFormSection>
      ) : null}

      {machine ? (
        jobIds.map((jobId) => {
          const ms = bill.machineItems.filter((m) => m.jobId === jobId);
          const c = bill.jobCosts.find((x) => x.jobId === jobId);
          const fee = ms.reduce((t, m) => t + m.serviceFee, 0);
          const shared = c ? jobCostSum(c) : 0;
          return (
            <WomsFormSection
              key={jobId}
              title={
                <span>
                  <Link href={`/jobs/${jobId}`} className="code">
                    {jobId}
                  </Link>{" "}
                  · {ms[0]?.customerName || "—"} · {ms[0]?.jobDate}
                </span>
              }
            >
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" aria-label={`เครื่องในใบงาน ${jobId}`}>
                  <TableHead>
                    <TableRow>
                      <TableCell>SN</TableCell>
                      <TableCell>รุ่น</TableCell>
                      <TableCell>หมายเหตุ</TableCell>
                      <TableCell align="right">ค่าบริการ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ms.map((m) => (
                      <TableRow key={m.jobEquipmentId}>
                        <TableCell className="mono">
                          {m.equipmentId ? <Link href={`/equipment/${m.equipmentId}`}>{m.serial || "—"}</Link> : m.serial || "—"}
                        </TableCell>
                        <TableCell>{m.model || "—"}</TableCell>
                        <TableCell>{m.note || "—"}</TableCell>
                        <TableCell align="right" className="mono">
                          {baht(m.serviceFee)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              <Box sx={{ ...cardBox, mt: 1.5 }}>
                <Typography sx={{ fontWeight: 600, mb: 0.5 }}>ค่าใช้จ่ายร่วมของใบงาน (นับครั้งเดียว)</Typography>
                {c ? (
                  <Typography variant="body2">
                    ค่าเดินทาง {c.distanceKm} กม. × {baht(c.ratePerKm)} = {baht(c.travelAmount)} · โรงแรม {baht(c.hotel)} · จอดรถ {baht(c.parking)} · อุปกรณ์{" "}
                    {baht(c.equipment)} · คนยก {baht(c.porter)} · อื่น ๆ {baht(c.other)}
                    {c.note ? ` · หมายเหตุ: ${c.note}` : ""}
                  </Typography>
                ) : (
                  <Typography variant="body2">ไม่มี</Typography>
                )}
                {c?.attachments?.length ? (
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                    {c.attachments.map((a, i) => (
                      <EvidencePreview key={i} src={a} label={`หลักฐาน ${jobId} ${i + 1}`} />
                    ))}
                  </Stack>
                ) : null}
                <Typography variant="body2" sx={{ mt: 1 }}>
                  รวมใบงานนี้ {baht(fee)} + {baht(shared)} = <strong>{baht(fee + shared)}</strong> บาท
                </Typography>
              </Box>
            </WomsFormSection>
          );
        })
      ) : (
        <>
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
          <WomsFormSection title="ค่าเดินทางรายวัน (บิลรูปแบบเดิม)">
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
          {bill.expenses.length > 0 ? (
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
                  </Box>
                )}
              />
            </WomsFormSection>
          ) : null}
        </>
      )}

      {bill.adjustments.length ? (
        <WomsFormSection title="ประวัติการปรับราคาโดยผู้ตรวจ">
          <Stack spacing={1.5}>
            {bill.adjustments.map((a, i) => (
              <Box key={i} sx={cardBox}>
                <Typography variant="body2">
                  {dt(a.at)} · {a.by} — <strong>{a.reason}</strong>
                </Typography>
                {a.changes.map((c, j) => (
                  <Typography key={j} variant="body2" className="mono">
                    {c.ref} · {c.field}: {baht(c.before)} → {baht(c.after)}
                  </Typography>
                ))}
              </Box>
            ))}
          </Stack>
        </WomsFormSection>
      ) : null}

      <WomsFormSection title="ประวัติสถานะ">
        <Stack spacing={0.5}>
          {bill.submittedAt ? <Typography variant="body2">ส่งตรวจ {dt(bill.submittedAt)}</Typography> : null}
          {bill.reviewedAt ? <Typography variant="body2">ตรวจ/ส่งกลับโดย {bill.reviewedBy} {dt(bill.reviewedAt)}</Typography> : null}
          {bill.approvedAt ? <Typography variant="body2">อนุมัติโดย {bill.approvedBy} {dt(bill.approvedAt)}</Typography> : null}
          {bill.printedAt ? (
            <Typography variant="body2">
              ออกใบวางบิลโดย {bill.printedBy} {dt(bill.printedAt)} (พิมพ์ {bill.printCount ?? 1} ครั้ง)
            </Typography>
          ) : null}
          {bill.paymentPendingAt ? <Typography variant="body2">ส่งรอจ่าย {dt(bill.paymentPendingAt)}</Typography> : null}
          {bill.paidAt ? <Typography variant="body2">จ่ายแล้ว (บันทึกโดย {bill.paidBy}) {dt(bill.paidAt)}</Typography> : null}
          {bill.receivedConfirmedAt ? (
            <Typography variant="body2">
              ช่าง {bill.receivedConfirmedBy} ยืนยันรับเงิน {dt(bill.receivedConfirmedAt)}
            </Typography>
          ) : null}
          {bill.note ? <Typography variant="body2">หมายเหตุ: {bill.note}</Typography> : null}
        </Stack>
      </WomsFormSection>

      {machine ? <BillAdjustDialog bill={bill} open={adjustOpen} busy={busy} onClose={() => setAdjustOpen(false)} onSubmit={adjust} /> : null}
      <BillPaymentDialog bill={bill} open={payOpen} busy={busy} onClose={() => setPayOpen(false)} onSubmit={pay} />
    </>
  );
}
