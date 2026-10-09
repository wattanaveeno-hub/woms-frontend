"use client";

// Round 8 — CON-01 / BR-06.2 เอกสารของสัญญา: อัปโหลด (contracts:edit) · ดาวน์โหลด · ดาวน์โหลด PDF สัญญา
// ไฟล์เป็น append-only (ไม่มีลบ/แก้) — หลักฐานการชำระของงวดแสดงรวมในรายการนี้ด้วย
import { useCallback, useEffect, useState } from "react";
import { ApiError, downloadFile, openFileInline } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import {
  ACCEPT_FILE_TYPES,
  MAX_DOCUMENT_BYTES,
  contractQuoApi,
  fileToDataUrl,
  type ContractFileMeta,
} from "@/lib/contractQuoApi";
import { bangkokDateTime } from "@/lib/date";
import { useToast } from "@/components/Toast";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import { WomsDataTable, WomsFormSection, type WomsColumn } from "@/components/woms";

const fmtSize = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export default function ContractFilesCard({
  contractId,
  contractNo,
  reloadKey,
}: {
  contractId: string;
  contractNo: string;
  /** เปลี่ยนค่าเมื่อมีการแนบหลักฐานใหม่จากตารางงวด */
  reloadKey?: string;
}) {
  const { has } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<ContractFileMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await contractQuoApi.listFiles(contractId)).items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดรายการเอกสารไม่สำเร็จ");
      setItems([]);
    }
  }, [contractId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const upload = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error(`ไฟล์ใหญ่เกินไป (ไม่เกิน ${MAX_DOCUMENT_BYTES / 1_000_000} MB)`);
      return;
    }
    setBusy(true);
    try {
      await contractQuoApi.uploadFile(contractId, { name: file.name, dataUrl: await fileToDataUrl(file) });
      toast.success(`อัปโหลด ${file.name} แล้ว`);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const view = (f: ContractFileMeta) =>
    openFileInline(`${contractQuoApi.fileUrl(contractId, f.id)}?inline=1`).catch((e) => toast.error(e?.message ?? "เปิดไฟล์ไม่สำเร็จ"));
  const download = (f: ContractFileMeta) =>
    downloadFile(contractQuoApi.fileUrl(contractId, f.id), f.name).catch((e) => toast.error(e?.message ?? "ดาวน์โหลดไม่สำเร็จ"));

  const cols: WomsColumn<ContractFileMeta>[] = [
    { key: "name", label: "ไฟล์", sortValue: (f) => f.name, render: (f) => f.name },
    { key: "kind", label: "ประเภท", render: (f) => (f.installmentNo ? `${f.kindLabel} งวด ${f.installmentNo}` : f.kindLabel) },
    { key: "size", label: "ขนาด", align: "right", hideBelowLg: true, render: (f) => <span className="mono">{fmtSize(f.size)}</span> },
    { key: "by", label: "ผู้อัปโหลด", render: (f) => f.uploadedBy || "—" },
    { key: "at", label: "เวลา", sortValue: (f) => f.uploadedAt, render: (f) => <span className="mono">{bangkokDateTime(f.uploadedAt)}</span> },
    {
      key: "dl",
      label: "",
      align: "right",
      render: (f) => (
        <>
          <Button size="small" onClick={() => view(f)}>
            เปิดดู
          </Button>
          <Button size="small" startIcon={<DownloadIcon />} onClick={() => download(f)}>
            ดาวน์โหลด
          </Button>
        </>
      ),
    },
  ];

  return (
    <WomsFormSection
      title="เอกสารและไฟล์แนบของสัญญา"
      actions={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {has("contracts:print") ? (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() =>
                downloadFile(`/api/contracts/${encodeURIComponent(contractId)}/document.pdf`, `contract-${contractNo}.pdf`).catch((e) =>
                  toast.error(e?.message ?? "ดาวน์โหลด PDF ไม่สำเร็จ")
                )
              }
            >
              ดาวน์โหลด PDF
            </Button>
          ) : null}
          {has("contracts:edit") ? (
            <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={busy}>
              {busy ? "กำลังอัปโหลด…" : "อัปโหลดเอกสาร"}
              <input hidden type="file" accept={ACCEPT_FILE_TYPES} onChange={(e) => upload(e.target.files?.[0] ?? null)} />
            </Button>
          ) : null}
        </Stack>
      }
    >
      <Typography variant="body2" sx={{ mb: 1 }}>
        PDF สัญญาออกเป็นรูปแบบมาตรฐานของระบบ — แบบฟอร์มบริษัทยังไม่ได้รับ
      </Typography>
      <WomsDataTable
        caption="ไฟล์แนบของสัญญา"
        rows={items ?? []}
        loading={items === null}
        error={error}
        onRetry={load}
        columns={cols}
        rowKey={(f) => f.id}
        pageSize={10}
        emptyTitle="ยังไม่มีไฟล์แนบ"
        emptyDescription="รับเฉพาะรูปภาพ (PNG/JPEG/WEBP) หรือ PDF"
        renderCard={(f) => (
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{f.name}</Typography>
            <Typography variant="body2">
              {f.installmentNo ? `${f.kindLabel} งวด ${f.installmentNo}` : f.kindLabel} · {f.uploadedBy || "—"} · {bangkokDateTime(f.uploadedAt)}
            </Typography>
            <Button size="small" onClick={() => view(f)}>
              เปิดดู
            </Button>
            <Button size="small" startIcon={<DownloadIcon />} onClick={() => download(f)}>
              ดาวน์โหลด
            </Button>
          </Box>
        )}
      />
    </WomsFormSection>
  );
}
