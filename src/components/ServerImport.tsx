"use client";

// ---------------------------------------------------------------------------
// นำเข้า Excel โดยให้ "เซิร์ฟเวอร์" เป็นผู้ตรวจ
// ---------------------------------------------------------------------------
// ที่มา: MDM-FN-007 "นำเข้าข้อมูลเครื่องจักรจากไฟล์ Excel ได้"
//        NFR Import/Export "…แจ้งรายการข้อมูลที่นำเข้าไม่สำเร็จพร้อมเหตุผลได้"
//
// ทำไมไม่ใช้ตัวเดิม (BulkImport): ตัวเดิมแปลงไฟล์ในเบราว์เซอร์แล้วยิง POST ทีละแถว
// ไฟล์ 500 แถว = 500 คำขอ และถ้าพังกลางทางจะเหลือข้อมูลครึ่ง ๆ กลาง ๆ
// อีกทั้งการตรวจความถูกต้องอยู่ฝั่งเบราว์เซอร์ซึ่งข้ามได้
// ตัวนี้ส่งไฟล์ทั้งก้อนให้เซิร์ฟเวอร์ตรวจและบันทึกในคำขอเดียว

import { useEffect, useRef, useState } from "react";
import { bangkokDateTime } from "@/lib/date";
import { api, ApiError, downloadFile, fileToBase64 } from "@/lib/api";
import type { ImportReport } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
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

/** ~8MB base64 ≈ ไฟล์ 6MB — ตรงกับเพดาน body ของ backend (12MB) */
const MAX_FILE_BYTES = 6 * 1024 * 1024;

export default function ServerImport({
  label,
  perm,
  templatePath,
  templateName,
  onImport,
  onDone,
  historyEntity,
}: {
  label: string;
  perm: string;
  templatePath: string;
  templateName: string;
  onImport: (fileBase64: string, dryRun: boolean, fileName?: string) => Promise<ImportReport>;
  /** FB-19 ประวัติการนำเข้า (ไม่ส่ง = ไม่แสดง) */
  historyEntity?: "equipment" | "customers";
  onDone?: () => void;
}) {
  const { has } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  if (!has(perm)) return null;

  const close = () => {
    setOpen(false);
    setReport(null);
    setPending(null);
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
    setReport(null);
    setFileName(f.name);
    try {
      const b64 = await fileToBase64(f);
      setPending(b64);
      // ตรวจก่อนเสมอ (dry-run) ผู้ใช้เห็นผลแล้วค่อยยืนยันบันทึก
      const r = await onImport(b64, true, f.name);
      setReport(r);
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
      const r = await onImport(pending, false, fileName);
      setReport(r);
      setPending(null);
      toast.success(`นำเข้าสำเร็จ ${r.created} จาก ${r.total} แถว`);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "นำเข้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setOpen(true)}>
        นำเข้า{label}จาก Excel
      </Button>

      {/* แผงเดิมเป็นกล่องลอยกว้าง 420px ล้นจอมือถือ — ย้ายเป็น Dialog (เต็มจอบนมือถือ) */}
      <Dialog open={open} onClose={busy ? undefined : close} fullScreen={fullScreen} maxWidth="md" aria-labelledby="import-title">
        <DialogTitle id="import-title">นำเข้า{label}จาก Excel</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            <Button
              startIcon={<DownloadIcon />}
              onClick={() => downloadFile(templatePath, templateName).catch((e) => toast.error(e.message))}
            >
              ดาวน์โหลดแม่แบบ
            </Button>
            <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? "กำลังตรวจ…" : "เลือกไฟล์ .xlsx"}
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={pick} />
          </Stack>

          {fileName ? <Typography variant="body2">ไฟล์: {fileName}</Typography> : null}

          {report ? (
            <Box sx={{ mt: 1 }}>
              <Alert severity={report.errors.length ? "warning" : "success"}>
                {report.dryRun ? "ผลการตรวจ (ยังไม่บันทึก)" : "ผลการนำเข้า"} — ทั้งหมด {report.total} แถว ·{" "}
                {report.dryRun ? "ผ่าน" : "บันทึกแล้ว"} {report.created} · ไม่ผ่าน {report.skipped}
              </Alert>

              {report.warnings?.length ? (
                <Alert severity="warning" sx={{ mt: 1 }} data-testid="import-warnings">
                  {report.warnings.join(" · ")}
                </Alert>
              ) : null}
              {report.columns?.mapped.length ? (
                <Typography variant="caption" component="div" sx={{ mt: 1 }}>
                  คอลัมน์ที่นำเข้า: {report.columns.mapped.map((c) => (c.header === c.field ? c.header : `${c.header} → ${c.field}`)).join(", ")}
                </Typography>
              ) : null}
              {report.errors.length > 0 ? (
                <Box sx={{ maxHeight: 300, overflow: "auto", mt: 1 }}>
                  <Table size="small" stickyHeader aria-label="แถวที่ไม่ผ่าน">
                    <TableHead>
                      <TableRow>
                        <TableCell>แถว</TableCell>
                        <TableCell>คอลัมน์</TableCell>
                        <TableCell>ค่า</TableCell>
                        <TableCell>เหตุผลที่ไม่ผ่าน</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {report.errors.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="mono">{e.row}</TableCell>
                          <TableCell>{e.field ? <Chip size="small" variant="outlined" label={e.field} /> : "-"}</TableCell>
                          <TableCell className="mono">{e.key || "-"}</TableCell>
                          <TableCell>{e.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              ) : null}
            </Box>
          ) : null}
          {historyEntity ? <ImportHistory entity={historyEntity} refreshKey={report && !report.dryRun ? report.total : 0} /> : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {report?.dryRun && pending ? (
            <>
              <Button
                onClick={() => {
                  setPending(null);
                  setReport(null);
                }}
                disabled={busy}
              >
                ยกเลิกไฟล์นี้
              </Button>
              <Button variant="contained" onClick={commit} disabled={busy || report.created === 0}>
                {busy ? "กำลังบันทึก…" : `บันทึก ${report.created} แถวที่ผ่าน`}
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

/** FB-19 ประวัติการนำเข้า — ตรวจย้อนหลังว่าใครนำเข้า เมื่อใด ไฟล์ใด ผ่าน/ไม่ผ่านกี่แถว */
export function ImportHistory({ entity, refreshKey = 0 }: { entity: "equipment" | "customers"; refreshKey?: number }) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof api.importLogs>>["items"] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    api
      .importLogs(entity)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [entity, refreshKey]);
  if (!items?.length) return null;
  return (
    <Box sx={{ mt: 2 }} data-testid="import-history">
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        ประวัติการนำเข้า (ล่าสุด {items.length} ครั้ง)
      </Typography>
      {items.map((h) => (
        <Box key={h.id} sx={{ borderTop: 1, borderColor: "divider", py: 0.75 }}>
          <Typography variant="body2">
            {bangkokDateTime(h.at)} · {h.byName} · {h.fileName || "ไม่ระบุชื่อไฟล์"} — ทั้งหมด {h.total} · บันทึก {h.created} · ไม่ผ่าน {h.skipped}
            {h.unmappedColumns.length ? ` · คอลัมน์ไม่รู้จัก: ${h.unmappedColumns.join(", ")}` : ""}
            {h.errors.length ? (
              <Button size="small" onClick={() => setOpenId(openId === h.id ? null : h.id)}>
                {openId === h.id ? "ซ่อนแถวที่ไม่ผ่าน" : "ดูแถวที่ไม่ผ่าน"}
              </Button>
            ) : null}
          </Typography>
          {openId === h.id
            ? h.errors.slice(0, 200).map((e, i) => (
                <Typography key={i} variant="caption" component="div" className="mono">
                  แถว {e.row}
                  {e.field ? ` · ${e.field}` : ""} — {e.message}
                </Typography>
              ))
            : null}
        </Box>
      ))}
    </Box>
  );
}
