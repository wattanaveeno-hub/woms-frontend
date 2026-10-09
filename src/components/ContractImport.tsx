"use client";

// ---------------------------------------------------------------------------
// BR-05 — นำเข้าสัญญาจาก Excel: แม่แบบ → ตรวจที่เซิร์ฟเวอร์ (dry-run) → ดูข้อผิดพลาดรายแถว/ตัวอย่าง → ยืนยัน
// ---------------------------------------------------------------------------
// - ไม่ส่งข้อมูลทีละแถวจากเบราว์เซอร์ (แบบ BulkImport เดิม) — เซิร์ฟเวอร์ตรวจและบันทึกทั้งไฟล์
// - มีแถวผิดแม้แถวเดียว = ยืนยันไม่ได้ (ทั้งไฟล์หรือไม่เลย)
// - ยืนยันด้วย fileHash ของไฟล์ที่ตรวจ · ส่งซ้ำ/เน็ตหลุดแล้วกดใหม่ = ได้ผลเดิม ไม่สร้างซ้ำ
import { useRef, useState } from "react";
import { ApiError, downloadFile, fileToBase64, request } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { contractImportStatusLabel } from "@/lib/contractRules";
import { useToast } from "@/components/Toast";
import Alert from "@mui/material/Alert";
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

const MAX_FILE_BYTES = 6 * 1024 * 1024;

interface RowError {
  row: number;
  field?: string;
  message: string;
  key?: string;
}
interface PreviewRow {
  row: number;
  contractNo: string;
  type: string;
  status: "DRAFT" | "ACTIVE";
  customerName: string;
  serial: string;
  startDate: string;
  monthly: number;
  totalPrice: number;
}
interface Report {
  fileHash: string;
  total: number;
  valid: number;
  errors: RowError[];
  preview: PreviewRow[];
}
interface ImportResult {
  batchId: string;
  status: string;
  total: number;
  created: Array<{ row: number; id: string; contractNo: string }>;
  activated: number;
  activationErrors: RowError[];
  replayed: boolean;
}
interface ImportHistory extends ImportResult {
  fileName: string;
  actorName: string;
  startedAt: string;
  finishedAt: string;
  failure: string;
}

const TYPE_LABEL: Record<string, string> = { RENTAL: "เช่า", HIRE_PURCHASE: "เช่าซื้อ", SALE: "ขาย" };

export default function ContractImport({ onDone }: { onDone?: () => void }) {
  const { has } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<ImportHistory[] | null>(null);

  if (!has("contracts:create")) return null;

  const reset = () => {
    setFile(null);
    setReport(null);
    setResult(null);
    setFileName("");
  };
  const close = () => {
    setOpen(false);
    reset();
    setHistory(null);
  };

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      toast.error(`ไฟล์ใหญ่เกินไป (${Math.round(f.size / 1024 / 1024)}MB) — สูงสุด 6MB ต่อครั้ง`);
      return;
    }
    reset();
    setBusy(true);
    setFileName(f.name);
    try {
      const b64 = await fileToBase64(f);
      const r = await request<Report>("/api/contracts/import", {
        method: "POST",
        body: JSON.stringify({ fileBase64: b64, fileName: f.name, dryRun: true }),
      });
      setFile(b64);
      setReport(r);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!file || !report || busy) return;
    setBusy(true);
    try {
      const r = await request<ImportResult>("/api/contracts/import", {
        method: "POST",
        body: JSON.stringify({ fileBase64: file, fileName, confirmHash: report.fileHash }),
      });
      setResult(r);
      setFile(null);
      toast.success(r.replayed ? "ไฟล์นี้นำเข้าไปแล้ว — แสดงผลเดิม" : `นำเข้าสัญญา ${r.created.length} ฉบับ`);
      onDone?.();
    } catch (err) {
      if (err instanceof ApiError) {
        const rep = (err.body as { report?: Report } | undefined)?.report;
        if (rep) setReport(rep);
        toast.error(err.message);
      } else toast.error("นำเข้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const loadHistory = async () => {
    try {
      setHistory((await request<{ items: ImportHistory[] }>("/api/contracts/imports")).items);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "โหลดประวัติไม่สำเร็จ");
    }
  };

  const canConfirm = !!file && !!report && report.errors.length === 0 && report.valid > 0 && !result;

  return (
    <>
      <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setOpen(true)}>
        นำเข้าสัญญาจาก Excel
      </Button>
      <Dialog open={open} onClose={busy ? undefined : close} fullScreen={fullScreen} maxWidth="md" fullWidth aria-labelledby="contract-import-title">
        <DialogTitle id="contract-import-title">นำเข้าสัญญาจาก Excel</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            <Button
              startIcon={<DownloadIcon />}
              onClick={() => downloadFile("/api/contracts/import/template.xlsx", "woms-contract-import-template.xlsx").catch((e) => toast.error(e.message))}
            >
              ดาวน์โหลดแม่แบบ
            </Button>
            <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy && !report ? "กำลังตรวจ…" : "เลือกไฟล์ .xlsx"}
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={pick} data-testid="contract-import-file" />
            <Button onClick={loadHistory}>ประวัติการนำเข้า</Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            1 สัญญา = 1 เครื่อง · ระบบตรวจทั้งไฟล์ก่อน ถ้ามีแถวผิดจะไม่บันทึกแถวใดเลย · สัญญาที่ระบุสถานะ &quot;ใช้งาน&quot; จะถูกเปิดใช้งานหลังสร้าง
          </Typography>
          {fileName ? <Typography variant="body2">ไฟล์: {fileName}</Typography> : null}

          {report && !result ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Alert severity={report.errors.length ? "error" : "success"}>
                ตรวจแล้ว {report.total} แถว · ผ่าน {report.valid} · ผิด {report.total - report.valid} แถว ({report.errors.length} รายการ)
                {report.errors.length ? " — แก้ไฟล์แล้วเลือกใหม่" : " — กดยืนยันเพื่อบันทึก"}
              </Alert>
              {report.errors.length ? (
                <Table size="small" aria-label="ข้อผิดพลาดรายแถว">
                  <TableHead>
                    <TableRow>
                      <TableCell>แถว</TableCell>
                      <TableCell>คอลัมน์</TableCell>
                      <TableCell>ปัญหา</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.errors.slice(0, 200).map((e, i) => (
                      <TableRow key={`${e.row}-${i}`}>
                        <TableCell className="mono">{e.row}</TableCell>
                        <TableCell>{e.field || "-"}</TableCell>
                        <TableCell>{e.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Table size="small" aria-label="ตัวอย่างสัญญาที่จะสร้าง">
                  <TableHead>
                    <TableRow>
                      <TableCell>แถว</TableCell>
                      <TableCell>เลขที่</TableCell>
                      <TableCell>ประเภท</TableCell>
                      <TableCell>ลูกค้า</TableCell>
                      <TableCell>เครื่อง</TableCell>
                      <TableCell>วันเริ่ม</TableCell>
                      <TableCell>สถานะ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.preview.slice(0, 100).map((p) => (
                      <TableRow key={p.row}>
                        <TableCell className="mono">{p.row}</TableCell>
                        <TableCell className="mono">{p.contractNo}</TableCell>
                        <TableCell>{TYPE_LABEL[p.type] ?? p.type}</TableCell>
                        <TableCell>{p.customerName}</TableCell>
                        <TableCell className="mono">{p.serial || "-"}</TableCell>
                        <TableCell className="mono">{p.startDate}</TableCell>
                        <TableCell>{p.status === "ACTIVE" ? "ใช้งาน" : "ร่าง"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Stack>
          ) : null}

          {result ? (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Alert severity={result.activationErrors.length ? "warning" : "success"}>
                {result.replayed ? "ไฟล์นี้นำเข้าไปแล้ว (ไม่สร้างซ้ำ) — " : ""}สร้างสัญญา {result.created.length} ฉบับ · เปิดใช้งาน {result.activated}
                {result.activationErrors.length ? ` · เปิดใช้งานไม่สำเร็จ ${result.activationErrors.length} ฉบับ (ยังเป็นร่าง)` : ""}
              </Alert>
              {result.activationErrors.map((e, i) => (
                <Typography key={i} variant="body2" color="warning.main">
                  แถว {e.row} ({e.key}): {e.message}
                </Typography>
              ))}
              <Typography variant="body2" className="mono">
                {result.created.map((c) => c.contractNo).join(", ")}
              </Typography>
            </Stack>
          ) : null}

          {history ? (
            <Stack spacing={0.5} sx={{ mt: 2 }}>
              <Typography variant="subtitle2">ประวัติการนำเข้า</Typography>
              {history.length === 0 ? <Typography variant="body2">ยังไม่มีประวัติ</Typography> : null}
              {history.map((h) => (
                <Typography key={h.batchId} variant="body2">
                  {new Date(h.startedAt).toLocaleString("th-TH")} · {h.actorName} · {h.fileName || "-"} · {contractImportStatusLabel(h.status)} · สร้าง {h.created.length}/{h.total}
                  {h.failure ? ` · ${h.failure}` : ""}
                </Typography>
              ))}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={busy}>
            ปิด
          </Button>
          <Button variant="contained" onClick={commit} disabled={!canConfirm || busy}>
            {busy && report ? "กำลังบันทึก…" : `ยืนยันนำเข้า ${report?.valid ?? 0} สัญญา`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
