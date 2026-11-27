"use client";
// MOM-30 (MoM 23 พ.ย.) — ใบเสนอราคาแนบรูป/หลักฐานภายหลังได้
//   แนบได้ทุกสถานะยกเว้นยกเลิก · ไม่เปลี่ยนสถานะ/ยอด/Revision · ลบไม่ได้ (เก็บเป็นประวัติ)
import { useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { api, ApiError } from "@/lib/api";
import { bangkokDateTime } from "@/lib/date";
import { compressImage } from "@/lib/imageCompress";
import { ACCEPT_FILE_TYPES, MAX_EVIDENCE_BYTES, fileToDataUrl } from "@/lib/contractQuoApi";
import { FinFileButton } from "@/components/finance/FinParts";
import type { Quotation } from "@/lib/types";

const MAX_FILES = 5;

export default function QuotationAttachments({
  quotation,
  canAttach,
  onChanged,
}: {
  quotation: Quotation;
  canAttach: boolean;
  onChanged: (q: Quotation) => void;
}) {
  const list = quotation.attachments ?? [];
  const inputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const allowed = canAttach && quotation.status !== "CANCELLED";

  const pick = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (!files.length) return;
    setErr(null);
    if (files.length > MAX_FILES) return setErr(`แนบได้ครั้งละไม่เกิน ${MAX_FILES} ไฟล์`);
    setBusy(true);
    try {
      const payload = [];
      for (const f of files) {
        // รูปย่อก่อนส่ง · PDF ส่งตามจริงแต่จำกัดขนาด
        if (f.type.startsWith("image/")) payload.push({ name: f.name, dataUrl: await compressImage(f, 1600, 0.75) });
        else if (f.size > MAX_EVIDENCE_BYTES) throw new Error(`${f.name} ใหญ่เกิน 1.5 MB`);
        else payload.push({ name: f.name, dataUrl: await fileToDataUrl(f) });
      }
      const q = await api.addQuotationAttachments(quotation.id, payload, note.trim());
      setNote("");
      onChanged(q);
    } catch (e) {
      setErr(e instanceof ApiError || e instanceof Error ? e.message : "แนบไฟล์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ mt: 2 }} data-testid="quotation-attachments">
      <Typography sx={{ fontWeight: 600, color: "text.primary" }}>รูป/หลักฐานที่แนบภายหลัง</Typography>
      {list.length ? (
        <Stack spacing={0.75} sx={{ mt: 0.5 }}>
          {list.map((a) => (
            <Stack key={a.fileId} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <FinFileButton
                qid={quotation.id}
                file={{ id: a.fileId, quotationId: quotation.id, kind: "APPROVAL_EVIDENCE", name: a.name, mimeType: "", size: 0, uploadedBy: a.addedBy, uploadedAt: a.addedAt }}
              />
              <Typography variant="body2" color="text.secondary">
                {a.addedBy} · {bangkokDateTime(a.addedAt)}
                {a.note ? ` · ${a.note}` : ""}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">ยังไม่มีไฟล์แนบภายหลัง</Typography>
      )}
      {allowed ? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }} alignItems={{ sm: "center" }}>
          <TextField
            size="small"
            label="หมายเหตุ (ไม่บังคับ)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            inputProps={{ maxLength: 500 }}
            sx={{ flex: 1 }}
          />
          <Button variant="outlined" startIcon={<AttachFileIcon />} disabled={busy} onClick={() => inputRef.current?.click()} data-testid="quotation-attach">
            {busy ? "กำลังแนบ…" : "แนบรูป/หลักฐาน"}
          </Button>
          <input ref={inputRef} type="file" hidden multiple accept={ACCEPT_FILE_TYPES} onChange={(e) => pick(e.target.files)} />
        </Stack>
      ) : null}
      {err ? (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setErr(null)}>
          {err}
        </Alert>
      ) : null}
    </Box>
  );
}
