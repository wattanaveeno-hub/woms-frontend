"use client";

// JOB-01 / MCH-03 — วางข้อความเปิดงานจาก LINE แล้วให้ระบบแยกเป็นช่อง
// แสดงผลที่แยกได้ให้ตรวจก่อนเสมอ · ใส่เฉพาะช่องที่ยังว่างในฟอร์ม (ไม่ทับสิ่งที่พิมพ์ไว้) · ไม่บันทึกอะไรเอง
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import { parseJobText, type ParsedJobText } from "@/lib/jobTextParser";

const ROWS: [keyof ParsedJobText, string][] = [
  ["jobTypeRaw", "ประเภทงาน (ข้อความ)"],
  ["jobType", "ประเภทงาน (ระบบ)"],
  ["customerCode", "รหัสลูกค้า"],
  ["shopName", "ร้าน / ลูกค้า"],
  ["technicianTeam", "ทีมช่าง / ช่าง"],
  ["salesPerson", "เซลล์"],
  ["model", "รุ่น"],
  ["filterUnit", "เครื่องกรอง"],
  ["serials", "SN"],
  ["contactName", "ติดต่อ"],
  ["phone", "เบอร์"],
  ["jobDate", "วันที่นัด (ค.ศ.)"],
  ["jobTime", "เวลา"],
  ["mapLink", "แผนที่"],
  ["note", "หมายเหตุ"],
];

export default function PasteJobTextDialog({
  open,
  onClose,
  onApply,
  jobTypeLabel,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (p: ParsedJobText) => void | Promise<void>;
  jobTypeLabel: (v: string) => string;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedJobText | null>(null);
  const [busy, setBusy] = useState(false);

  const show = (k: keyof ParsedJobText, p: ParsedJobText): string => {
    const v = p[k];
    if (Array.isArray(v)) return v.join(", ");
    if (k === "jobType") return v ? jobTypeLabel(String(v)) : "—";
    return String(v || "—");
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>วางข้อความเปิดงานจาก LINE</DialogTitle>
      <DialogContent>
        <TextField
          multiline
          minRows={6}
          maxRows={14}
          fullWidth
          autoFocus
          label="ข้อความ"
          placeholder={"ประเภทงาน: CM\nร้าน: ...\nทีมช่าง: ...\nเซลล์: ...\nรุ่น: ...\nวันที่: 25/9/69\nเวลา: 11.00 น."}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setParsed(null);
          }}
          sx={{ mt: 1 }}
        />
        {parsed ? (
          <>
            {parsed.warnings.length ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {parsed.warnings.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </Alert>
            ) : null}
            <Table size="small" sx={{ mt: 1 }}>
              <TableBody>
                {ROWS.map(([k, label]) => (
                  <TableRow key={k}>
                    <TableCell sx={{ width: 160, color: "text.secondary" }}>{label}</TableCell>
                    <TableCell sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{show(k, parsed)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Alert severity="info" sx={{ mt: 1 }}>
              ระบบใส่เฉพาะช่องที่ยังว่างในฟอร์ม · ลูกค้า/สาขาให้เลือกจากฐานข้อมูลเอง (ค้นด้วยรหัสลูกค้า) · SN ที่พบในคลังจะถูกเพิ่มเป็นเครื่องในใบงาน
            </Alert>
          </>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ยกเลิก</Button>
        {parsed ? (
          <Button
            variant="contained"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onApply(parsed);
                setText("");
                setParsed(null);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "กำลังใส่…" : "ใส่ลงฟอร์ม"}
          </Button>
        ) : (
          <Button variant="contained" disabled={!text.trim()} onClick={() => setParsed(parseJobText(text))}>
            แยกข้อมูล
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
