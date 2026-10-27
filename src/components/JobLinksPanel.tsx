"use client";

// ---------------------------------------------------------------------------
// เส้นทางของใบงาน — มาจากไหน (คิว / ใบเสนอราคา / ตาราง PM) และไปต่อที่ไหน (สัญญา / บิลช่าง)
// เดิมแต่ละหน้าต่างคนต่างอยู่ ต้องไปค้นเลขเอง · ปุ่ม "วางบิลใบงานนี้" พาไปหน้าวางบิลพร้อมเลือกเครื่องให้
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { request } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { WomsFormSection } from "@/components/woms";

interface Ref {
  id: string;
  status: string;
  statusLabel: string;
}
export interface JobLinks {
  queue: (Ref & { queueNo: string }) | null;
  quotation: (Ref & { quotationNo: string }) | null;
  pmPlans: Array<Ref & { month: string; technicianName: string; itemStatus: string; itemStatusLabel: string }>;
  contracts: Array<Ref & { contractNo: string; serial: string }>;
  bills: Array<Ref & { billNo: string; technicianName: string }>;
  billable: boolean;
}

export const getJobLinks = (jobId: string) => request<JobLinks>(`/api/jobs/${encodeURIComponent(jobId)}/links`);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 1.5 }} alignItems={{ sm: "center" }} sx={{ py: 0.75 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        {children}
      </Stack>
    </Stack>
  );
}

const linkChip = (href: string, label: string, status?: string) => (
  <Chip key={href} component={Link} href={href} clickable variant="outlined" color="primary" label={status ? `${label} · ${status}` : label} />
);

export default function JobLinksPanel({ jobId, jobStatus }: { jobId: string; jobStatus: string }) {
  const { has } = useAuth();
  const [links, setLinks] = useState<JobLinks | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    getJobLinks(jobId)
      .then((l) => alive && setLinks(l))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [jobId, jobStatus]);

  if (failed) return null; // ข้อมูลเสริม — โหลดไม่ได้ไม่ควรบังหน้าใบงาน
  if (!links) return null;

  const sources = [
    links.queue ? linkChip(`/service-queue/${links.queue.id}`, `คิว ${links.queue.queueNo}`, links.queue.statusLabel) : null,
    links.quotation ? linkChip(`/quotations/${links.quotation.id}`, `ใบเสนอราคา ${links.quotation.quotationNo}`, links.quotation.statusLabel) : null,
    ...links.pmPlans.map((p) => linkChip(`/pm/${p.id}`, `ตาราง PM ${p.month} (${p.technicianName})`, p.itemStatusLabel)),
  ].filter(Boolean);
  const canBill = links.billable && has("bill:create");

  return (
    <WomsFormSection
      title="เส้นทางของใบงาน"
      actions={
        canBill ? (
          <Button component={Link} href={`/bills/new?jobId=${encodeURIComponent(jobId)}`} variant="contained" startIcon={<ReceiptLongIcon />}>
            วางบิลใบงานนี้
          </Button>
        ) : undefined
      }
    >
      <Row label="มาจาก">{sources.length ? sources : <Typography variant="body2">เปิดใบงานโดยตรง</Typography>}</Row>
      <Row label="สัญญา">
        {links.contracts.length ? (
          links.contracts.map((c) => linkChip(`/contracts/${c.id}`, `${c.contractNo} (${c.serial})`, c.statusLabel))
        ) : (
          <Typography variant="body2">ไม่ได้ผูกสัญญา</Typography>
        )}
      </Row>
      <Row label="บิลช่าง">
        {links.bills.length ? (
          links.bills.map((b) => linkChip(`/bills/${b.id}`, `${b.billNo} · ${b.technicianName}`, b.statusLabel))
        ) : (
          <Typography variant="body2">
            {links.billable ? "ยังไม่วางบิล — ปิดงานแล้ว วางบิลได้" : jobStatus === "CLOSED" ? "ยังไม่วางบิล (ยังไม่มีเครื่องที่บันทึกว่าเสร็จ)" : "ยังไม่วางบิล — วางบิลได้หลังปิดงาน"}
          </Typography>
        )}
      </Row>
    </WomsFormSection>
  );
}

/** หน้ามือถือช่าง: งานปิดแล้ว → ปุ่มวางบิล หรือเลขบิล/สถานะที่วางไปแล้ว */
export function JobBillShortcut({ jobId }: { jobId: string }) {
  const { has } = useAuth();
  const [links, setLinks] = useState<JobLinks | null>(null);
  useEffect(() => {
    let alive = true;
    getJobLinks(jobId)
      .then((l) => alive && setLinks(l))
      .catch(() => alive && setLinks(null));
    return () => {
      alive = false;
    };
  }, [jobId]);
  if (!links) return null;
  if (links.bills.length) {
    return (
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
        {links.bills.map((b) => linkChip(`/bills/${b.id}`, `บิล ${b.billNo}`, b.statusLabel))}
      </Stack>
    );
  }
  if (!links.billable || !has("bill:create")) return null;
  return (
    <Button component={Link} href={`/bills/new?jobId=${encodeURIComponent(jobId)}`} variant="contained" fullWidth startIcon={<ReceiptLongIcon />} sx={{ mt: 1 }}>
      วางบิลใบงานนี้
    </Button>
  );
}
