"use client";

// MCH-03 (Audit A D-02) — วางข้อความจาก LINE แล้วแยกเป็นช่องของฟอร์มเพิ่มเครื่อง
// แสดงผลที่แยกได้ให้ตรวจทีละช่องก่อนเสมอ · กด "ใช้ข้อมูลนี้" แค่เติมฟอร์ม — ยังไม่บันทึกจนกว่าผู้ใช้กด "บันทึก"
// ลูกค้าค้นจากรหัสลูกค้าด้วย /api/customers/search (อ่านอย่างเดียว) — เจอรายเดียวจึงเลือกให้ ไม่งั้นให้เลือกเอง
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
import { api } from "@/lib/api";
import { parseJobText } from "@/lib/jobTextParser";
import { equipmentFromParsed, splitInlineHeadings, type PastedEquipment } from "@/lib/equipmentRules";
import type { EquipmentFormValues } from "@/lib/types";

interface Resolved extends PastedEquipment {
  customerId: string;
  customerName: string;
  customerNote: string;
}

export default function EquipmentPasteDialog({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (values: Partial<EquipmentFormValues>) => void;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<Resolved | null>(null);
  const [busy, setBusy] = useState(false);

  const analyse = async () => {
    const p = equipmentFromParsed(parseJobText(splitInlineHeadings(text)));
    let customerId = "";
    let customerName = "";
    let customerNote = "";
    const key = p.customerCode || p.shopName;
    if (key) {
      setBusy(true);
      try {
        const r = await api.searchCustomers(key);
        const hits = r.customers.filter((c) => c.type !== "SUPPLIER");
        if (hits.length === 1) {
          customerId = hits[0].id;
          customerName = hits[0].name;
        } else {
          customerNote = hits.length
            ? `พบลูกค้า ${hits.length} ราย จาก “${key}” — เลือกลูกค้าเองในฟอร์ม`
            : `ไม่พบลูกค้า “${key}” ในฐานข้อมูล — เลือกหรือพิมพ์ชื่อเองในฟอร์ม`;
        }
      } catch {
        customerNote = "ค้นหาลูกค้าไม่สำเร็จ — เลือกลูกค้าเองในฟอร์ม";
      } finally {
        setBusy(false);
      }
    }
    setParsed({ ...p, customerId, customerName, customerNote });
  };

  const rows: [string, string][] = parsed
    ? [
        ["Serial", parsed.serial || "— (ระบบจะออกเลขชั่วคราวให้)"],
        ["รุ่นเครื่อง", parsed.model || "—"],
        ["เครื่องกรอง", parsed.filterUnit || "—"],
        ["ลูกค้า", parsed.customerName || (parsed.customerCode || parsed.shopName ? `${parsed.customerCode} ${parsed.shopName}`.trim() + " (ยังไม่ผูก)" : "—")],
        ["พิกัด", parsed.lat || parsed.lng ? `${parsed.lat}, ${parsed.lng}` : "—"],
        ["หมายเหตุ", parsed.note || "—"],
      ]
    : [];

  const apply = () => {
    if (!parsed) return;
    const values: Partial<EquipmentFormValues> = {};
    if (parsed.serial) values.serial = parsed.serial;
    if (parsed.model) values.model = parsed.model;
    if (parsed.filterUnit) values.filterUnit = parsed.filterUnit;
    if (parsed.customerId) {
      values.customerId = parsed.customerId;
      values.customerName = parsed.customerName;
    }
    if (parsed.lat || parsed.lng) {
      values.lat = parsed.lat;
      values.lng = parsed.lng;
    }
    if (parsed.note) values.note = parsed.note;
    onApply(values);
    setText("");
    setParsed(null);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>วางข้อความเพิ่มเครื่อง</DialogTitle>
      <DialogContent>
        <TextField
          multiline
          minRows={5}
          maxRows={14}
          fullWidth
          autoFocus
          label="ข้อความ"
          placeholder={"ร้าน: I2228-บริษัท ...\nรุ่น: KM-40C\nเครื่องกรองน้ำ: 3 ขั้นตอน\nSN: 5198210500597\nโลเคชั่น: https://maps..."}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setParsed(null);
          }}
          sx={{ mt: 1 }}
          inputProps={{ "aria-label": "ข้อความที่จะแยก" }}
        />
        {parsed ? (
          <>
            {parsed.warnings.length || parsed.customerNote ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {[...parsed.warnings, parsed.customerNote].filter(Boolean).map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </Alert>
            ) : null}
            <Table size="small" sx={{ mt: 1 }} aria-label="ผลการแยกข้อความ">
              <TableBody>
                {rows.map(([k, val]) => (
                  <TableRow key={k}>
                    <TableCell sx={{ width: 140, color: "text.secondary" }}>{k}</TableCell>
                    <TableCell sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{val}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Alert severity="info" sx={{ mt: 1 }}>
              ระบบเติมข้อมูลลงฟอร์มเท่านั้น — ตรวจ/แก้ แล้วกด “บันทึก” เอง · บรรทัดที่ระบบไม่รู้จักอยู่ในหมายเหตุ
            </Alert>
          </>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ยกเลิก</Button>
        {parsed ? (
          <Button variant="contained" onClick={apply}>
            ใช้ข้อมูลนี้
          </Button>
        ) : (
          <Button variant="contained" disabled={!text.trim() || busy} onClick={analyse}>
            {busy ? "กำลังแยก…" : "แยกข้อมูล"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
