"use client";

// ---------------------------------------------------------------------------
// Round 8 — นำเข้าลูกค้า + สาขาจาก Excel (AT-17 / NFR-16)
// ---------------------------------------------------------------------------
// ขั้นตอน: เลือกไฟล์ → เซิร์ฟเวอร์ตรวจ (ยังไม่บันทึก) → ดูผลรายแถว ผ่าน/ไม่ผ่าน/ซ้ำ
//          → ดาวน์โหลดรายงานผลตรวจได้ → กด "ยืนยันนำเข้า" เอง จึงจะบันทึก
// จับคู่สาขากับลูกค้าด้วย "รหัสลูกค้า" เท่านั้น — ไม่จับคู่ด้วยชื่อ
// รูปแบบคอลัมน์เป็น CURRENT_IMPLEMENTATION_ASSUMPTION (Q-13) รอยืนยันกับลูกค้า

import { useRef, useState } from "react";
import { api, ApiError, downloadFile, fileToBase64 } from "@/lib/api";
import type { CustomerImportResult } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { WomsStatusChip } from "@/components/woms";

const MAX_FILE_BYTES = 6 * 1024 * 1024;
const TONE = { VALID: "success", INVALID: "error", DUPLICATE: "warning" } as const;

export default function CustomerImport({ onDone }: { onDone?: () => void }) {
  const { has } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CustomerImportResult | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  // ตรวจสิทธิ์ซ้ำที่ backend (partners:create) — ปุ่มนี้แค่ไม่แสดงให้คนที่ทำไม่ได้
  if (!has("partners:create")) return null;

  const close = () => {
    setOpen(false);
    setResult(null);
    setPending(null);
    setFileName("");
  };

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      toast.error(`ไฟล์ใหญ่เกินไป (${Math.round(f.size / 1024 / 1024)}MB) — สูงสุด 6MB ต่อครั้ง`);
      return;
    }
    setBusy(true);
    setResult(null);
    setFileName(f.name);
    try {
      const b64 = await fileToBase64(f);
      setPending(b64);
      setResult(await api.importCustomers(b64, true));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "อ่านไฟล์ไม่สำเร็จ");
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const r = await api.importCustomers(pending, false);
      setResult(r);
      setPending(null);
      toast.success(`นำเข้าแล้ว: ลูกค้าใหม่ ${r.createdCustomers} ราย · สาขาใหม่ ${r.createdBranches} แห่ง`);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "นำเข้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = () => {
    if (!pending) return;
    downloadFile("/api/customers/import/report.xlsx", "woms-customers-import-report.xlsx", {
      body: { fileBase64: pending },
    }).catch((e) => toast.error(e instanceof ApiError ? e.message : "ดาวน์โหลดไม่สำเร็จ"));
  };

  return (
    <>
      <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setOpen(true)}>
        นำเข้าลูกค้า/สาขา
      </Button>
      <Dialog open={open} onClose={busy ? undefined : close} fullScreen={fullScreen} maxWidth="lg" aria-labelledby="cust-import-title">
        <DialogTitle id="cust-import-title">นำเข้าลูกค้าและสาขาจาก Excel</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 1.5 }}>
            หนึ่งแถว = หนึ่งสาขา · ต้องมี “รหัสลูกค้า” ทุกแถว (ระบบผูกสาขากับลูกค้าด้วยรหัสเท่านั้น ไม่เทียบชื่อ) · รหัสสาขาเป็นตัวเลข 2 หลัก
            เช่น 00 · แถวที่ซ้ำกับข้อมูลเดิมจะถูกข้าม ไม่แก้ทับ · รูปแบบไฟล์นี้ยังรอยืนยัน (Q-13)
          </Alert>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            <Button
              startIcon={<DownloadIcon />}
              onClick={() =>
                downloadFile("/api/customers/import/template.xlsx", "woms-customers-template.xlsx").catch((e) => toast.error(e.message))
              }
            >
              ดาวน์โหลดแม่แบบ
            </Button>
            <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? "กำลังตรวจ…" : "เลือกไฟล์ .xlsx"}
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={pick} />
            {pending && result ? (
              <Button startIcon={<DownloadIcon />} onClick={downloadReport} disabled={busy}>
                ดาวน์โหลดรายงานผลตรวจ
              </Button>
            ) : null}
          </Stack>
          {fileName ? <Typography variant="body2">ไฟล์: {fileName}</Typography> : null}

          {result ? (
            <Box sx={{ mt: 1 }}>
              <Alert severity={result.invalid || result.duplicate ? "warning" : "success"}>
                {result.dryRun ? "ผลการตรวจ (ยังไม่บันทึก)" : "ผลการนำเข้า"} — ทั้งหมด {result.total} แถว · ผ่าน {result.valid} · ไม่ผ่าน{" "}
                {result.invalid} · ซ้ำ {result.duplicate}
                {result.dryRun
                  ? ` · จะเพิ่มลูกค้าใหม่ ${result.newCustomers} ราย สาขาใหม่ ${result.newBranches} แห่ง`
                  : ` · เพิ่มลูกค้าใหม่ ${result.createdCustomers} ราย สาขาใหม่ ${result.createdBranches} แห่ง`}
              </Alert>
              <Box sx={{ maxHeight: 360, overflow: "auto", mt: 1 }}>
                <Table size="small" stickyHeader aria-label="ผลตรวจรายแถว">
                  <TableHead>
                    <TableRow>
                      <TableCell>แถว</TableCell>
                      <TableCell>ผล</TableCell>
                      <TableCell>รหัสลูกค้า</TableCell>
                      <TableCell>ลูกค้า</TableCell>
                      <TableCell>สาขา</TableCell>
                      <TableCell>สิ่งที่จะเกิด / เหตุผล</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.rows.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell className="mono">{r.row}</TableCell>
                        <TableCell>
                          <WomsStatusChip label={r.statusLabel} tone={TONE[r.status]} />
                        </TableCell>
                        <TableCell className="mono">{r.customerCode || "-"}</TableCell>
                        <TableCell>{r.customerName || "-"}</TableCell>
                        <TableCell>
                          <span className="mono">{r.branchNo || "-"}</span>
                          {r.storeName ? ` · ${r.storeName}` : ""}
                        </TableCell>
                        <TableCell sx={{ overflowWrap: "anywhere" }}>
                          {r.status === "VALID"
                            ? [r.createCustomer ? "เพิ่มลูกค้าใหม่" : r.existingPartnerId ? "ผูกกับลูกค้าเดิม" : "ผูกกับลูกค้าในไฟล์", r.createBranch ? "เพิ่มสาขา" : ""]
                                .filter(Boolean)
                                .join(" · ")
                            : r.messages.join(" · ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {result?.dryRun && pending ? (
            <>
              <Button
                onClick={() => {
                  setPending(null);
                  setResult(null);
                  setFileName("");
                }}
                disabled={busy}
              >
                ยกเลิกไฟล์นี้
              </Button>
              <Button variant="contained" onClick={commit} disabled={busy || result.valid === 0}>
                {busy ? "กำลังบันทึก…" : `ยืนยันนำเข้า ${result.valid} แถวที่ผ่าน`}
              </Button>
            </>
          ) : null}
          <Button onClick={close} disabled={busy}>
            ปิด
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
