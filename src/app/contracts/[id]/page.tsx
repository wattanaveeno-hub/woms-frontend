"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Contract, ContractStatus, SalesDocument } from "@/lib/types";
import { contractStatusLabel, contractTypeLabel, documentTypeLabel, fmtMoney } from "@/lib/options";
import { ContractStatusBadge, ContractTypeBadge, InstallmentBadge } from "@/components/ContractBadges";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { bangkokDateTime } from "@/lib/date";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid2";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ContractPayDialog from "@/components/ContractPayDialog";
import ContractFilesCard from "@/components/ContractFilesCard";
import { ContractRenewDialog, ContractRenewalChain } from "@/components/ContractRenewal";
import { downloadFile } from "@/lib/api";
import { contractQuoApi } from "@/lib/contractQuoApi";
import {
  WomsDataTable,
  WomsErrorState,
  WomsFormSection,
  WomsKeyValue,
  WomsLoadingState,
  WomsPageHeader,
  WomsStatCard,
  WomsStatGrid,
  WomsStatusChip,
  type WomsColumn,
} from "@/components/woms";

type Installment = Contract["installments"][number];
type HistoryRow = NonNullable<Contract["history"]>[number] & { _i: number };
const cardBox = { border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 } as const;

/** ป้ายไทยของ ContractEvent (ตรงกับ CONTRACT_EVENT_LABELS ของ backend) */
const CONTRACT_EVENT_LABEL: Record<string, string> = {
  CREATE: "สร้างสัญญา",
  STATUS: "เปลี่ยนสถานะ",
  RENEW: "ต่อสัญญา",
  CANCEL: "ยกเลิกสัญญา",
  PAY: "บันทึกชำระ",
  EDIT: "แก้ไขข้อมูล",
  DOCUMENT: "อัปโหลดเอกสาร",
};

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { has } = useAuth();
  const toast = useToast();

  const dialog = useDialog();
  const [c, setC] = useState<Contract | null>(null);
  const [docs, setDocs] = useState<SalesDocument[]>([]);
  const [busyNo, setBusyNo] = useState<number | null>(null);
  const [editSite, setEditSite] = useState(false);
  const [siteForm, setSiteForm] = useState({ siteAddress: "", zone: "", siteLat: 0, siteLng: 0 });
  const [acting, setActing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Round 8 — บันทึกชำระพร้อมหลักฐาน / ต่อสัญญาเป็นฉบับใหม่
  const [payNo, setPayNo] = useState<number | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setC(await api.getContract(id));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  // เอกสารทั้งหมดที่ออกภายใต้สัญญานี้ (ใบเสร็จ/ใบกำกับ/ใบลดหนี้/ใบส่งของ)
  const loadDocs = useCallback(async () => {
    try {
      const res = await api.listDocuments({ contractId: id });
      setDocs(res.items);
    } catch {
      setDocs([]);
    }
  }, [id]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // ออกใบเสร็จ (หรือใบกำกับภาษี) ให้งวดที่เลือก — ระบบจะมาร์คงวดว่าชำระแล้วให้อัตโนมัติ
  const issueReceipt = async (no: number, withVat: boolean) => {
    if (!c || busyNo !== null) return;
    // การออกเอกสารทางบัญชีได้เลขที่ถาวร — ยืนยันก่อน
    if (
      !(await dialog.confirm({
        title: `ออก${withVat ? "ใบกำกับภาษี" : "ใบเสร็จ"}ให้งวดที่ ${no}?`,
        message: "ระบบจะออกเลขที่เอกสารถาวรและบันทึกงวดนี้ว่าชำระแล้ว",
        confirmLabel: withVat ? "ออกใบกำกับภาษี" : "ออกใบเสร็จ",
      }))
    )
      return;
    setBusyNo(no);
    try {
      const doc = await api.issueReceipt({
        contractId: id,
        installmentNo: no,
        type: withVat ? "TAX_INVOICE" : "RECEIPT",
      });
      toast.success(`ออก${documentTypeLabel[doc.type]} ${doc.docNo} แล้ว`);
      await Promise.all([load(), loadDocs()]);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ออกเอกสารไม่สำเร็จ");
    } finally {
      setBusyNo(null);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const pay = async (no: number, paid: boolean) => {
    if (!c || busyNo !== null) return;
    // บันทึกจ่าย → เปิดกล่องกรอกวันที่ชำระ/เลขอ้างอิง/หลักฐาน (CON-01)
    if (paid) {
      setPayNo(no);
      return;
    }
    if (
      !paid &&
      !(await dialog.confirm({
        title: `ยกเลิกการชำระงวดที่ ${no}?`,
        message: "งวดนี้จะกลับเป็นค้างชำระ และยอดคงเหลือของสัญญาจะเพิ่มขึ้น",
        confirmLabel: "ยกเลิกการชำระ",
        danger: true,
      }))
    )
      return;
    setBusyNo(no);
    try {
      const updated = await api.payInstallment(id, no, paid, c.updatedAt);
      setC(updated);
      toast.success(paid ? `บันทึกชำระงวดที่ ${no}` : `ยกเลิกชำระงวดที่ ${no}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(e.message);
        load();
      } else {
        toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
      }
    } finally {
      setBusyNo(null);
    }
  };

  // ที่อยู่ติดตั้งตามสัญญา — ใช้เป็นจุดอ้างอิงตรวจว่าเครื่องยังอยู่ที่เดิม (geofence)
  const openSiteEditor = () => {
    if (!c) return;
    setSiteForm({
      siteAddress: c.siteAddress || c.customerAddress || "",
      zone: c.zone || "",
      siteLat: c.siteLat || 0,
      siteLng: c.siteLng || 0,
    });
    setEditSite(true);
  };

  const saveSite = async () => {
    if (!c) return;
    setActing(true);
    try {
      const updated = await api.contractEdit(id, siteForm, c.updatedAt);
      setC(updated);
      setEditSite(false);
      toast.success("บันทึกที่อยู่ติดตั้งแล้ว");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(e.message);
        load();
      } else {
        toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
      }
    } finally {
      setActing(false);
    }
  };

  const changeStatus = async (status: ContractStatus, confirmMsg: string) => {
    if (!c || acting) return;
    if (
      !(await dialog.confirm({
        title: confirmMsg,
        confirmLabel: "ยืนยัน",
        danger: status === "CANCELLED",
      }))
    )
      return;
    setActing(true);
    try {
      const updated = await api.setContractStatus(id, status, c.updatedAt);
      setC(updated);
      toast.success("อัปเดตสถานะแล้ว");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(e.message);
        load();
      } else {
        toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
      }
    } finally {
      setActing(false);
    }
  };

  // CON-03 — ต่อสัญญา = สร้างฉบับใหม่เชื่อมฉบับเดิม (กล่องกรอกเลขใหม่/วันเริ่ม/จำนวนเดือน)
  const renew = () => {
    if (!c || acting) return;
    setRenewOpen(true);
  };

  const remove = async () => {
    if (!c || acting) return;
    if (
      !(await dialog.confirm({
        title: `ลบสัญญา ${c.contractNo}?`,
        message: "เครื่องที่ผูกไว้จะถูกคืนเข้าคลัง และการลบย้อนกลับไม่ได้ — สัญญาที่รับชำระหรือออกเอกสารแล้วลบไม่ได้ ให้ใช้ยกเลิกสัญญาแทน",
        confirmLabel: "ยืนยันลบสัญญา",
        danger: true,
      }))
    )
      return;
    setActing(true);
    try {
      await api.deleteContract(id);
      toast.success(`ลบสัญญา ${c.contractNo} แล้ว`);
      router.push("/contracts");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ลบไม่สำเร็จ");
      setActing(false);
    }
  };

  const back = (
    <Button component={Link} href="/contracts" startIcon={<ArrowBackIcon />}>
      รายการสัญญา
    </Button>
  );
  if (loadError) {
    return (
      <>
        <WomsPageHeader title="ไม่พบสัญญา" actions={back} />
        <WomsErrorState message={loadError} onRetry={load} />
      </>
    );
  }

  if (!c) return <WomsLoadingState rows={6} />;

  // status actions (complete/cancel) only on an active contract;
  // recording/undoing payments stays possible until the contract is cancelled.
  /*
   * QA BUG-025 / BUG-027 — เดิมหน้าจอเสนอปุ่มเฉพาะตอนสถานะ ACTIVE
   * สัญญาที่ "สิ้นสุด" แล้วจึงเหลือทางเดียวคือ "ลบสัญญา" ทั้งที่ CONTRACT_TRANSITIONS
   * อนุญาต COMPLETED → ACTIVE อยู่แล้ว · และสัญญาร่าง (DRAFT) ก็เปิดใช้งานไม่ได้
   * ตารางนี้คัดลอกมาจาก backend (src/domain/contract.ts) ตรง ๆ
   */
  const canChangeStatus = has("contracts:status");
  const TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
    DRAFT: ["ACTIVE", "CANCELLED"],
    ACTIVE: ["COMPLETED", "EXPIRED", "CANCELLED"],
    COMPLETED: ["ACTIVE"],
    EXPIRED: ["ACTIVE", "CANCELLED"],
    CANCELLED: [],
  };
  const allowed = canChangeStatus ? TRANSITIONS[c.status] ?? [] : [];
  const can = (to: ContractStatus) => allowed.includes(to);
  const canPay = c.status !== "CANCELLED" && has("contracts:pay");

  const instActions = (it: Installment) => (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap justifyContent="flex-end">
      {has("documents:create") && !it.receiptNo ? (
        <>
          <Button size="small" onClick={() => issueReceipt(it.no, false)} disabled={busyNo === it.no}>
            ออกใบเสร็จ
          </Button>
          <Button size="small" onClick={() => issueReceipt(it.no, true)} disabled={busyNo === it.no}>
            ใบกำกับภาษี
          </Button>
        </>
      ) : null}
      {canPay ? (
        it.status === "PENDING" ? (
          <Button size="small" variant="contained" onClick={() => pay(it.no, true)} disabled={busyNo === it.no}>
            {busyNo === it.no ? "…" : "บันทึกชำระ"}
          </Button>
        ) : (
          <Button size="small" color="error" onClick={() => pay(it.no, false)} disabled={busyNo === it.no}>
            {busyNo === it.no ? "…" : "ยกเลิกชำระ"}
          </Button>
        )
      ) : null}
    </Stack>
  );
  const docCell = (it: Installment) =>
    it.receiptNo ? (
      <span className="code">{it.receiptNo}</span>
    ) : (
      <Link href={`/contracts/${id}/receipt/${it.no}`} target="_blank" rel="noopener noreferrer">
        {it.status === "PAID" ? "ใบเสร็จ (ร่าง)" : "บิล"}
      </Link>
    );
  const instCols: WomsColumn<Installment>[] = [
    { key: "no", label: "งวด", sortValue: (it) => it.no, render: (it) => <span className="code">{it.no}</span> },
    { key: "due", label: "ครบกำหนด", sortValue: (it) => it.dueDate, render: (it) => <span className="mono">{it.dueDate}</span> },
    { key: "amt", label: "จำนวน (บาท)", align: "right", render: (it) => <span className="mono">{fmtMoney(it.amount)}</span> },
    { key: "status", label: "สถานะ", sortValue: (it) => it.status, render: (it) => <InstallmentBadge status={it.status} /> },
    { key: "paid", label: "วันที่ชำระ", hideBelowLg: true, render: (it) => <span className="mono">{it.paidDate || "—"}</span> },
    {
      key: "evidence",
      label: "อ้างอิง / หลักฐาน",
      hideBelowLg: true,
      render: (it) =>
        it.status === "PAID" ? (
          <Stack spacing={0.25}>
            <span className="mono">{it.paymentRef || "—"}</span>
            {it.evidenceFileId ? (
              <Button
                size="small"
                sx={{ alignSelf: "flex-start", p: 0, minWidth: 0 }}
                onClick={() =>
                  downloadFile(contractQuoApi.fileUrl(id, it.evidenceFileId!), it.evidenceName || "evidence").catch((e) =>
                    toast.error(e?.message ?? "ดาวน์โหลดไม่สำเร็จ")
                  )
                }
              >
                {it.evidenceName || "หลักฐาน"}
              </Button>
            ) : null}
            {it.paidBy ? <Typography variant="body2">โดย {it.paidBy}</Typography> : null}
          </Stack>
        ) : (
          "—"
        ),
    },
    { key: "doc", label: "เอกสาร", render: docCell },
    { key: "act", label: "จัดการ", align: "right", render: instActions },
  ];
  const docCols: WomsColumn<SalesDocument>[] = [
    { key: "no", label: "เลขที่", sortValue: (d) => d.docNo, render: (d) => <Link href={`/documents/${d.id}`} className="code">{d.docNo}</Link> },
    { key: "type", label: "ประเภท", render: (d) => documentTypeLabel[d.type] },
    { key: "date", label: "วันที่", sortValue: (d) => d.issueDate, render: (d) => <span className="mono">{d.issueDate}</span> },
    { key: "inst", label: "งวด", render: (d) => d.installmentNo || "—" },
    { key: "total", label: "ยอด", align: "right", render: (d) => <span className="mono">{fmtMoney(d.total)}</span> },
    { key: "status", label: "สถานะ", render: (d) => <WomsStatusChip label={d.status === "VOID" ? "ยกเลิก" : "ออกแล้ว"} tone={d.status === "VOID" ? "neutral" : "success"} /> },
  ];
  const histDetail = (h: HistoryRow) => (
    <>
      {h.fromStatus && h.toStatus ? (
        <div>
          {contractStatusLabel[h.fromStatus as ContractStatus] ?? h.fromStatus} → {contractStatusLabel[h.toStatus as ContractStatus] ?? h.toStatus}
        </div>
      ) : null}
      {h.fromEndDate && h.toEndDate ? (
        <Typography variant="body2">
          วันสิ้นสุด {h.fromEndDate} → {h.toEndDate}
        </Typography>
      ) : null}
      {h.note ? <Typography variant="body2">{h.note}</Typography> : null}
    </>
  );
  const histCols: WomsColumn<HistoryRow>[] = [
    { key: "at", label: "เวลา", sortValue: (h) => h.at, render: (h) => <span className="mono">{bangkokDateTime(h.at)}</span> },
    { key: "type", label: "รายการ", render: (h) => CONTRACT_EVENT_LABEL[h.type] ?? h.type },
    { key: "by", label: "ผู้ทำรายการ", render: (h) => h.byName || "—" },
    { key: "detail", label: "รายละเอียด", render: histDetail },
  ];

  const statusActions = (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
      {/* ปุ่มหลักหนึ่งปุ่มต่อหนึ่งมุมมอง (B-09): ปุ่มเด่นคือ "ก้าวถัดไป" ของสถานะปัจจุบัน */}
      {can("ACTIVE") ? (
        <Button
          variant="contained"
          onClick={() =>
            changeStatus(
              "ACTIVE",
              c.status === "DRAFT" ? "เปิดใช้งานสัญญานี้? ยอดค้างชำระจะเริ่มเข้ารายงานทันที" : "ให้สัญญานี้กลับมาใช้งาน?"
            )
          }
          disabled={acting}
        >
          {c.status === "DRAFT" ? "เปิดใช้งานสัญญา" : "กลับมาใช้งาน"}
        </Button>
      ) : null}
      {can("COMPLETED") ? (
        <Button variant="outlined" onClick={() => changeStatus("COMPLETED", "ปิดสัญญานี้ว่าสิ้นสุด/ครบกำหนด?")} disabled={acting}>
          ปิดสัญญา (สิ้นสุด)
        </Button>
      ) : null}
      {can("EXPIRED") ? (
        <Button variant="outlined" onClick={() => changeStatus("EXPIRED", "ทำเครื่องหมายว่าสัญญานี้หมดอายุ?")} disabled={acting}>
          หมดอายุ
        </Button>
      ) : null}
      {/* CON-03 — ต่อสัญญาเป็นฉบับใหม่ (เฉพาะสัญญาเช่าที่มีผลแล้วและยังไม่เคยถูกต่อ) */}
      {c.type === "RENTAL" && (c.status === "ACTIVE" || c.status === "EXPIRED" || c.status === "COMPLETED") && !c.renewedToId && has("contracts:edit") ? (
        <Button variant="outlined" onClick={renew} disabled={acting}>
          ต่อสัญญา
        </Button>
      ) : null}
      {can("CANCELLED") ? (
        <Button color="error" variant="outlined" onClick={() => changeStatus("CANCELLED", "ยกเลิกสัญญานี้? เครื่องจะถูกคืนเข้าคลัง")} disabled={acting}>
          ยกเลิกสัญญา
        </Button>
      ) : null}
      {has("contracts:delete") ? (
        <Button color="error" onClick={remove} disabled={acting}>
          ลบสัญญา
        </Button>
      ) : null}
    </Stack>
  );

  return (
    <>
      <WomsPageHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center" component="span" flexWrap="wrap" useFlexGap>
            <Box component="span" className="code" sx={{ fontSize: 20 }}>
              {c.contractNo}
            </Box>
            <ContractTypeBadge type={c.type} />
            <ContractStatusBadge status={c.status} />
          </Stack>
        }
        subtitle={
          <>
            {c.customerName || "-"}
            {c.customerPhone ? ` · ${c.customerPhone}` : ""} · เครื่อง {c.serial || "—"}
            {c.model ? ` · ${c.model}` : ""} · เริ่ม <span className="mono">{c.startDate || "—"}</span>
            {c.endDate ? (
              <>
                {" "}
                ถึง <span className="mono">{c.endDate}</span>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            {/* B-09 — เอกสารเป็นการกระทำรอง */}
            <Button
              component={Link}
              href={`/contracts/${id}/document`}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              startIcon={<DescriptionOutlinedIcon />}
            >
              หนังสือสัญญา
            </Button>
            {back}
          </>
        }
      />

      {c.status === "DRAFT" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          สัญญานี้ยังเป็น <strong>ร่างสัญญา</strong> — ยังไม่ถูกนับเป็นสัญญาที่ใช้งานอยู่ ไม่เข้าการแจ้งเตือนใกล้หมดอายุ
          และยอดค้างชำระยังไม่เข้ารายงาน กด “เปิดใช้งานสัญญา” เมื่อพร้อมให้มีผลจริง
        </Alert>
      ) : null}
      {c.status === "CANCELLED" ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          สัญญานี้ถูกยกเลิกแล้ว — เดินสถานะต่อไม่ได้ ดูได้อย่างเดียว
        </Alert>
      ) : null}

      {c.renewedToId ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          สัญญานี้ถูกต่อเป็นฉบับใหม่แล้ว:{" "}
          <Link href={`/contracts/${c.renewedToId}`} className="code">
            {c.renewedToNo || "ฉบับใหม่"}
          </Link>{" "}
          — งวดและเอกสารของฉบับนี้ยังดูย้อนหลังได้ตามเดิม
        </Alert>
      ) : null}
      {c.renewedFromId ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          ต่อจากสัญญา{" "}
          <Link href={`/contracts/${c.renewedFromId}`} className="code">
            {c.previousContractNo || "ฉบับก่อนหน้า"}
          </Link>
        </Alert>
      ) : null}

      {statusActions}

      <WomsStatGrid max={6}>
        <WomsStatCard value={fmtMoney(c.totalAmount)} label="ยอดรวม (บาท)" />
        <WomsStatCard value={fmtMoney(c.paidAmount)} label="ชำระแล้ว" tone="success" />
        <WomsStatCard value={fmtMoney(c.balance)} label="คงเหลือ" tone="error" />
        <WomsStatCard value={`${c.paidCount}/${c.installments.length}`} label="งวดที่ชำระ" />
        {c.type === "RENTAL" && c.deposit > 0 ? <WomsStatCard value={fmtMoney(c.deposit)} label="เงินมัดจำ (แยกต่างหาก)" /> : null}
        {c.nextDueDate ? <WomsStatCard value={<span style={{ fontSize: 18 }}>{c.nextDueDate}</span>} label="งวดถัดไป" /> : null}
        {c.paymentState && c.paymentState !== "NONE" ? (
          <WomsStatCard
            value={<span style={{ fontSize: 18 }}>{c.paymentStateLabel}</span>}
            label="สถานะการชำระของลูกค้า"
            tone={c.paymentState === "OVERDUE" ? "error" : "success"}
          />
        ) : null}
      </WomsStatGrid>

      <WomsFormSection
        title="ที่อยู่ติดตั้งตามสัญญา"
        actions={
          has("contracts:edit") ? (
            <Button onClick={() => (editSite ? setEditSite(false) : openSiteEditor())} aria-expanded={editSite}>
              {editSite ? "ยกเลิก" : "แก้ไข"}
            </Button>
          ) : undefined
        }
      >
        <Collapse in={editSite} unmountOnExit>
          <Grid container spacing={2} sx={{ mb: 1 }}>
            <Grid size={12}>
              <TextField label="ที่อยู่หน้างาน" value={siteForm.siteAddress} onChange={(e) => setSiteForm({ ...siteForm, siteAddress: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField label="โซนบริการ" value={siteForm.zone} onChange={(e) => setSiteForm({ ...siteForm, zone: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <TextField label="ละติจูด (lat)" type="number" inputProps={{ step: "any" }} value={siteForm.siteLat} onChange={(e) => setSiteForm({ ...siteForm, siteLat: Number(e.target.value) })} />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <TextField label="ลองจิจูด (lng)" type="number" inputProps={{ step: "any" }} value={siteForm.siteLng} onChange={(e) => setSiteForm({ ...siteForm, siteLng: Number(e.target.value) })} />
            </Grid>
            <Grid size={12}>
              <Button variant="contained" onClick={saveSite} disabled={acting}>
                {acting ? "กำลังบันทึก…" : "บันทึกที่อยู่ติดตั้ง"}
              </Button>
            </Grid>
          </Grid>
        </Collapse>
        {!editSite ? (
          <WomsKeyValue
            items={[
              ["ที่อยู่", c.siteAddressFull || "— ยังไม่ระบุ —"],
              ["โซน", c.zone || "—"],
              [
                "พิกัด",
                c.siteLat && c.siteLng ? (
                  <a href={`https://maps.google.com/?q=${c.siteLat},${c.siteLng}`} target="_blank" rel="noopener noreferrer" className="mono">
                    {c.siteLat}, {c.siteLng}
                  </a>
                ) : (
                  "— ยังไม่ระบุ (ตรวจ geofence ไม่ได้) —"
                ),
              ],
            ]}
          />
        ) : null}
      </WomsFormSection>

      <WomsFormSection title="ตารางงวด">
        <WomsDataTable
          caption="ตารางงวด"
          rows={c.installments}
          columns={instCols}
          rowKey={(it) => String(it.no)}
          pageSize={12}
          emptyTitle="สัญญานี้ไม่มีตารางงวด"
          renderCard={(it) => (
            <Box sx={cardBox}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>งวดที่ {it.no}</Typography>
                <InstallmentBadge status={it.status} />
              </Stack>
              <Typography variant="body2">
                ครบกำหนด <span className="mono">{it.dueDate}</span> · <strong>{fmtMoney(it.amount)}</strong> บาท
                {it.paidDate ? ` · ชำระ ${it.paidDate}` : ""}
                {it.paymentRef ? ` · อ้างอิง ${it.paymentRef}` : ""}
                {it.evidenceFileId ? " · มีหลักฐาน" : ""}
              </Typography>
              <Box sx={{ my: 0.5 }}>{docCell(it)}</Box>
              {instActions(it)}
            </Box>
          )}
        />
      </WomsFormSection>

      <ContractFilesCard contractId={id} contractNo={c.contractNo} reloadKey={c.updatedAt} />

      <ContractRenewalChain contract={c} />

      <WomsFormSection title="เอกสารของสัญญานี้">
        <WomsDataTable
          caption="เอกสารของสัญญา"
          rows={docs}
          columns={docCols}
          rowKey={(d) => d.id}
          pageSize={10}
          emptyTitle="ยังไม่มีเอกสาร"
          emptyDescription="ออกใบเสร็จได้จากตารางงวดด้านบน"
          renderCard={(d) => (
            <Box sx={cardBox}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Link href={`/documents/${d.id}`} className="code">
                  {d.docNo}
                </Link>
                <WomsStatusChip label={d.status === "VOID" ? "ยกเลิก" : "ออกแล้ว"} tone={d.status === "VOID" ? "neutral" : "success"} />
              </Stack>
              <Typography variant="body2">
                {documentTypeLabel[d.type]} · {d.issueDate}
                {d.installmentNo ? ` · งวด ${d.installmentNo}` : ""} · {fmtMoney(d.total)}
              </Typography>
            </Box>
          )}
        />
      </WomsFormSection>

      {/* ประวัติสัญญา — AC-COND-03 ประวัติการต่ออายุต้องแสดงบนหน้าจอ */}
      <WomsFormSection
        title="ประวัติสัญญา"
        titleAdornment={c.renewCount ? <Chip size="small" variant="outlined" label={`ต่ออายุมาแล้ว ${c.renewCount} ครั้ง`} /> : null}
      >
        <WomsDataTable
          caption="ประวัติสัญญา"
          rows={(c.history ?? []).map((h, i) => ({ ...h, _i: i }))}
          columns={histCols}
          rowKey={(h) => String(h._i)}
          pageSize={10}
          emptyTitle="ยังไม่มีประวัติการเปลี่ยนแปลงของสัญญาฉบับนี้"
          renderCard={(h) => (
            <Box sx={cardBox}>
              <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{CONTRACT_EVENT_LABEL[h.type] ?? h.type}</Typography>
              <Typography variant="body2">
                {bangkokDateTime(h.at)} · {h.byName || "—"}
              </Typography>
              {histDetail(h)}
            </Box>
          )}
        />
      </WomsFormSection>

      {c.note ? (
        <WomsFormSection title="หมายเหตุ">
          <Typography sx={{ color: "text.primary", whiteSpace: "pre-wrap" }}>{c.note}</Typography>
        </WomsFormSection>
      ) : null}

      {payNo !== null ? (
        <ContractPayDialog
          contract={c}
          no={payNo}
          onClose={() => setPayNo(null)}
          onPaid={(updated) => {
            setC(updated);
            setPayNo(null);
            toast.success(`บันทึกชำระงวดที่ ${payNo}`);
          }}
        />
      ) : null}
      {renewOpen ? (
        <ContractRenewDialog
          contract={c}
          onClose={() => setRenewOpen(false)}
          onRenewed={(fresh) => {
            setRenewOpen(false);
            toast.success(`สร้างสัญญาฉบับใหม่ ${fresh.contractNo} แล้ว`);
            router.push(`/contracts/${fresh.id}`);
          }}
        />
      ) : null}
    </>
  );
}
