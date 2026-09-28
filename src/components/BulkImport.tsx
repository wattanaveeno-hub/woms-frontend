"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { downloadTemplate, readRows } from "@/lib/xlsx";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";

export type RowResult<T> = { ok: true; value: T } | { ok: false; error: string };

interface Props<T> {
  label: string; // entity name e.g. "เครื่อง"
  templateName: string; // file name e.g. "equipment-template.xlsx"
  headers: string[];
  example: (string | number)[];
  toValues: (row: Record<string, string>) => RowResult<T>;
  create: (v: T) => Promise<unknown>;
  perm: string;
  onDone?: () => void;
}

export default function BulkImport<T>({
  label,
  templateName,
  headers,
  example,
  toValues,
  create,
  perm,
  onDone,
}: Props<T>) {
  const { has } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: { row: number; error: string }[] } | null>(null);

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  if (!has(perm)) return null;

  const template = async () => {
    try {
      await downloadTemplate(templateName, headers, example);
    } catch {
      toast.error("โหลด template ไม่สำเร็จ (ต้องต่ออินเทอร์เน็ต)");
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const rows = await readRows(file);
      if (rows.length === 0) {
        toast.error("ไม่พบข้อมูลในไฟล์");
        setBusy(false);
        return;
      }
      let ok = 0;
      const fail: { row: number; error: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const parsed = toValues(rows[i]);
        if (!parsed.ok) {
          fail.push({ row: i + 2, error: parsed.error }); // +2: header row + 1-index
          continue;
        }
        try {
          await create(parsed.value);
          ok++;
        } catch (err: any) {
          fail.push({ row: i + 2, error: err?.message ?? "บันทึกไม่สำเร็จ" });
        }
      }
      setResult({ ok, fail });
      if (ok > 0) toast.success(`นำเข้าสำเร็จ ${ok} รายการ`);
      if (fail.length > 0) toast.error(`ไม่สำเร็จ ${fail.length} แถว`);
      if (ok > 0) onDone?.();
    } catch {
      toast.error("อ่านไฟล์ Excel ไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setOpen(true)}>
        นำเข้า Excel
      </Button>
      <Dialog open={open} onClose={busy ? undefined : () => setOpen(false)} fullScreen={fullScreen} aria-labelledby="bulk-import-title">
        <DialogTitle id="bulk-import-title">นำเข้า{label}จาก Excel</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Box>
              <Typography sx={{ color: "text.primary", mb: 0.5 }}>1. ดาวน์โหลดเทมเพลตแล้วกรอกข้อมูล</Typography>
              <Button startIcon={<DownloadIcon />} onClick={template}>
                ดาวน์โหลด Template
              </Button>
            </Box>
            <Box>
              <Typography sx={{ color: "text.primary", mb: 0.5 }}>2. อัปโหลดไฟล์ที่กรอกแล้ว (.xlsx)</Typography>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={busy}>
                เลือกไฟล์
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden disabled={busy} onChange={onFile} />
              </Button>
            </Box>
            {busy ? (
              <Box role="status">
                <Typography variant="body2">กำลังนำเข้า…</Typography>
                <LinearProgress />
              </Box>
            ) : null}
            {result ? (
              <>
                <Alert severity="success">สำเร็จ {result.ok} รายการ</Alert>
                {result.fail.length > 0 ? (
                  <Alert severity="error">
                    ไม่สำเร็จ {result.fail.length} แถว:
                    <Box component="ul" sx={{ m: 0, pl: 2 }}>
                      {result.fail.slice(0, 12).map((f, i) => (
                        <li key={i}>
                          แถว {f.row}: {f.error}
                        </li>
                      ))}
                      {result.fail.length > 12 ? <li>… และอีก {result.fail.length - 12} แถว</li> : null}
                    </Box>
                  </Alert>
                ) : null}
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            ปิด
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
