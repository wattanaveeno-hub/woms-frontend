"use client";

// ---------------------------------------------------------------------------
// UAT2-16 หน้ารับเครื่องเข้าคลัง (Phase 7)
//   ใบรับ 1 ใบ = คลังเดียว วันเดียว ผู้จัดจำหน่ายเดียว · หลายรุ่น หลายเครื่อง
//   Serial ไม่บังคับ: ส่วนที่ไม่ระบุระบบออกเลขชั่วคราว (TMP) และขึ้นเตือน "ยังไม่มี SN" ในคลังเครื่อง (กติกาเดิม)
//   ประกันจากโปรไฟล์เริ่มนับวันรับเข้า · BD-01 ไม่มีขั้นอนุมัติ · BD-02 ต้นทุนต่อเครื่อง (ไม่บังคับ · เห็นเฉพาะ finance:view)
//   BD-12 แก้ไขหัวใบ/ต้นทุน และยกเลิกการรับ (ทั้งใบ/บางเครื่อง) แบบมีเหตุผลและประวัติ — ไม่ลบเครื่อง
//   สิทธิ์: บันทึก = equipment:create (Matrix EQ-03) · ดูประวัติใบรับ = inventory:view (EQ-01)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from "react";
import { fmtDate } from "@/lib/date";
import DateField from "@/components/DateField";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import NumberInput from "@/components/NumberInput";
import type { EquipmentReceipt, Options, Partner, WarrantyPreset } from "@/lib/types";
import { WomsEmptyState, WomsErrorState, WomsLinkTabs, WomsLoadingState, WomsPageHeader, WomsPermissionGate } from "@/components/woms";
import { equipmentTabs } from "@/lib/equipmentTabs";
import { activeReceiptMachines, receiptStatusLabel, splitSerials, receiptTotals, type ReceiptLineDraft } from "@/lib/equipmentReceipt";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import { fmtMoney } from "@/lib/options";

const today = () => {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};
const emptyLine = (): ReceiptLineDraft => ({ model: "", quantityText: "", serialsText: "", condition: "NEW", unitCostText: "" });
const thDate = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || "–";
  // UAT 2026-11-16: วว/ดด/ปปปป (ค.ศ.)
  return fmtDate(iso.slice(0, 10));
};

function ReceiptRow({ r, canEdit, canSeeCost, onChanged }: { r: EquipmentReceipt; canEdit: boolean; canSeeCost: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [dlg, setDlg] = useState<"" | "correct" | "cancel">("");
  const status = r.status ?? "POSTED";
  const cancelledIds = new Set((r.cancellations ?? []).flatMap((c) => c.equipmentIds));
  return (
    <>
      <TableRow hover data-testid="receipt-row" sx={{ cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>
        <TableCell padding="checkbox">
          <IconButton size="small" aria-label={open ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>
          {r.receiptNo}
          {status !== "POSTED" ? <Chip size="small" color={status === "CANCELLED" ? "default" : "warning"} label={receiptStatusLabel(status)} sx={{ ml: 1, fontFamily: "inherit" }} data-testid="receipt-status" /> : null}
        </TableCell>
        <TableCell>{thDate(r.inboundDate)}</TableCell>
        <TableCell>{r.warehouse}</TableCell>
        <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{r.supplier || "–"}</TableCell>
        <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{r.refNo || "–"}</TableCell>
        <TableCell align="right">
          {r.totalMachines}
          {r.tempSerialCount ? <Chip size="small" color="warning" label={`ยังไม่มี SN ${r.tempSerialCount}`} sx={{ ml: 1 }} /> : null}
        </TableCell>
        <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{r.createdBy}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={8} sx={{ p: 0, borderBottom: open ? undefined : "none" }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ p: 2, bgcolor: "action.hover" }} data-testid="receipt-detail">
              {r.warrantyPresetName ? (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  ประกัน: {r.warrantyPresetName} (เริ่มนับวันรับเข้า)
                </Typography>
              ) : null}
              {r.note ? (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  หมายเหตุ: {r.note}
                </Typography>
              ) : null}
              {r.lines.map((l, i) => (
                <Box key={i} sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle2">
                    {l.model}
                    {l.category ? ` · ${l.category}` : ""} · {l.quantity} เครื่อง
                    {canSeeCost && l.unitCost !== undefined && l.unitCost !== null ? (
                      <Box component="span" sx={{ fontWeight: 400, color: "text.secondary" }} data-testid="receipt-line-cost">
                        {" "}· ต้นทุน {fmtMoney(l.unitCost)}/เครื่อง (รวม {fmtMoney(l.lineCost ?? 0)})
                      </Box>
                    ) : null}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 0.5 }}>
                    {l.serials.map((s, k) => (
                      <Chip
                        key={s}
                        size="small"
                        variant="outlined"
                        color={s.startsWith("TMP-") && !cancelledIds.has(l.equipmentIds[k] ?? "") ? "warning" : "default"}
                        component={Link}
                        href={`/equipment/${encodeURIComponent(l.equipmentIds[k] ?? "")}`}
                        clickable
                        label={s}
                        sx={{ fontFamily: "monospace", ...(cancelledIds.has(l.equipmentIds[k] ?? "") ? { textDecoration: "line-through", opacity: 0.6 } : {}) }}
                      />
                    ))}
                  </Stack>
                </Box>
              ))}
              {canSeeCost && r.totalCost !== undefined && r.totalCost !== null ? (
                <Typography variant="body2" sx={{ mb: 1 }} data-testid="receipt-total-cost">
                  ต้นทุนรวมทั้งใบ: <b>{fmtMoney(r.totalCost)}</b>
                </Typography>
              ) : null}
              {(r.cancellations ?? []).map((c, i) => (
                <Typography key={`c${i}`} variant="body2" color="text.secondary">
                  ยกเลิก {c.serials.length} เครื่อง โดย {c.by} · {thDate(c.at)} — {c.reason}
                </Typography>
              ))}
              {(r.revisions ?? []).map((v, i) => (
                <Typography key={`v${i}`} variant="body2" color="text.secondary">
                  แก้ไขโดย {v.by} · {thDate(v.at)} — {v.reason} ({v.changes.map((c) => c.field).join(", ")})
                </Typography>
              ))}
              {canEdit && status !== "CANCELLED" ? (
                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                  <Button size="small" variant="outlined" onClick={() => setDlg("correct")} data-testid="receipt-correct">
                    แก้ไขใบรับ
                  </Button>
                  <Button size="small" color="error" variant="outlined" onClick={() => setDlg("cancel")} data-testid="receipt-cancel">
                    ยกเลิกการรับ
                  </Button>
                </Stack>
              ) : null}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
      {dlg === "correct" ? <CorrectDialog r={r} canSeeCost={canSeeCost} onClose={() => setDlg("")} onDone={onChanged} /> : null}
      {dlg === "cancel" ? <CancelDialog r={r} onClose={() => setDlg("")} onDone={onChanged} /> : null}
    </>
  );
}

function CorrectDialog({ r, canSeeCost, onClose, onDone }: { r: EquipmentReceipt; canSeeCost: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [refNo, setRefNo] = useState(r.refNo ?? "");
  const [supplier, setSupplier] = useState(r.supplier ?? "");
  const [note, setNote] = useState(r.note ?? "");
  const [costs, setCosts] = useState<string[]>(r.lines.map((l) => (l.unitCost === undefined || l.unitCost === null ? "" : String(l.unitCost))));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setErr("");
    const lineCosts = canSeeCost
      ? r.lines
          .map((l, i) => ({ line: i, before: l.unitCost ?? null, after: costs[i].trim() === "" ? null : Number(costs[i]) }))
          .filter((x) => x.before !== x.after)
          .map((x) => ({ line: x.line, unitCost: x.after }))
      : [];
    setBusy(true);
    try {
      await api.correctEquipmentReceipt(r.id, {
        version: r.version,
        refNo: refNo.trim(),
        ...(supplier.trim() !== (r.supplier ?? "") ? { supplier: supplier.trim(), supplierId: "" } : {}),
        note: note.trim(),
        ...(lineCosts.length ? { lineCosts } : {}),
        reason: reason.trim(),
      });
      toast.success(`แก้ไขใบรับ ${r.receiptNo} แล้ว`);
      onClose();
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>แก้ไขใบรับ {r.receiptNo}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">แก้ได้เฉพาะข้อมูลที่ไม่กระทบสต๊อก — Serial แก้ที่หน้าเครื่อง · จำนวนเกินใช้ &quot;ยกเลิกการรับ&quot; บางเครื่อง</Alert>
          <TextField label="ผู้จัดจำหน่าย" value={supplier} onChange={(e) => setSupplier(e.target.value)} fullWidth />
          <TextField label="ใบส่งของ / PO" value={refNo} onChange={(e) => setRefNo(e.target.value)} fullWidth />
          <TextField label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} fullWidth multiline minRows={2} />
          {canSeeCost
            ? r.lines.map((l, i) => (
                <NumberInput
                  key={i}
                  label={`ต้นทุนต่อเครื่อง — ${l.model} (${l.quantity} เครื่อง)`}
                  value={costs[i]}
                  onValueChange={(t) => setCosts((cs) => cs.map((c, k) => (k === i ? t : c)))}
                  inputProps={{ "data-testid": `correct-cost-${i}` }}
                  helperText="เว้นว่าง = ไม่มีข้อมูลต้นทุน"
                />
              ))
            : null}
          <TextField label="เหตุผลการแก้ไข" required value={reason} onChange={(e) => setReason(e.target.value)} fullWidth inputProps={{ "data-testid": "correct-reason" }} />
          {err ? <Alert severity="error">{err}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ปิด</Button>
        <Button variant="contained" onClick={save} disabled={busy || reason.trim().length < 3} data-testid="correct-save">
          {busy ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CancelDialog({ r, onClose, onDone }: { r: EquipmentReceipt; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const machines = activeReceiptMachines(r);
  const open = machines.filter((m) => !m.cancelled);
  const [picked, setPicked] = useState<Set<string>>(new Set(open.map((m) => m.id)));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toggle = (id: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const save = async () => {
    setErr("");
    setBusy(true);
    try {
      const all = picked.size === open.length;
      const out = await api.cancelEquipmentReceipt(r.id, { version: r.version, ...(all ? {} : { equipmentIds: [...picked] }), reason: reason.trim() });
      toast.success(`ยกเลิกการรับแล้ว · ใบรับ ${out.receiptNo} ${receiptStatusLabel(out.status)}`);
      onClose();
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>ยกเลิกการรับ — {r.receiptNo}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Alert severity="warning">
            เครื่องที่เลือกจะเปลี่ยนเป็น &quot;ปลดระวาง&quot; พร้อมประวัติ (ไม่ลบเครื่อง) · ยกเลิกได้เฉพาะเครื่องที่ยังอยู่ในคลังที่รับเข้าและยังไม่มีความเคลื่อนไหว
          </Alert>
          <Box sx={{ maxHeight: 240, overflowY: "auto" }} data-testid="cancel-machines">
            {machines.map((m) => (
              <FormControlLabel
                key={m.id}
                control={<Checkbox size="small" checked={!m.cancelled && picked.has(m.id)} disabled={m.cancelled} onChange={() => toggle(m.id)} />}
                label={<span style={{ fontFamily: "monospace", textDecoration: m.cancelled ? "line-through" : undefined }}>{m.serial}{m.cancelled ? " (ยกเลิกแล้ว)" : ""}</span>}
                sx={{ display: "flex" }}
              />
            ))}
          </Box>
          <TextField label="เหตุผลการยกเลิก" required value={reason} onChange={(e) => setReason(e.target.value)} fullWidth inputProps={{ "data-testid": "cancel-reason" }} />
          {err ? <Alert severity="error" data-testid="cancel-error">{err}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ปิด</Button>
        <Button color="error" variant="contained" onClick={save} disabled={busy || reason.trim().length < 3 || picked.size === 0} data-testid="cancel-save">
          {busy ? "กำลังยกเลิก…" : `ยกเลิก ${picked.size} เครื่อง`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ReceivePageInner() {
  const { has } = useAuth();
  const toast = useToast();
  const canCreate = has("equipment:create");
  const canSeeCost = has("finance:view");
  const [options, setOptions] = useState<Options | null>(null);
  const [presets, setPresets] = useState<WarrantyPreset[]>([]);
  const [suppliers, setSuppliers] = useState<Partner[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<EquipmentReceipt[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [warehouse, setWarehouse] = useState("");
  const [inboundDate, setInboundDate] = useState(today());
  const [supplierId, setSupplierId] = useState("");
  const [supplierText, setSupplierText] = useState("");
  const [refNo, setRefNo] = useState("");
  const [presetId, setPresetId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<ReceiptLineDraft[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const [done, setDone] = useState<EquipmentReceipt | null>(null);

  const loadRefs = useCallback(() => {
    setLoadError(null);
    Promise.all([
      api.getOptions(),
      api.listWarrantyPresets().catch(() => ({ items: [] as WarrantyPreset[] })),
      api.listPartners({ type: "SUPPLIER" }).catch(() => ({ items: [] as Partner[] })),
      api.listPartners({ type: "BOTH" }).catch(() => ({ items: [] as Partner[] })),
    ])
      .then(([o, p, s1, s2]) => {
        setOptions(o);
        setPresets(p.items);
        setSuppliers([...s1.items, ...s2.items]);
        setWarehouse((w) => w || (o.warehouses.length === 1 ? o.warehouses[0] : ""));
        const def = p.items.find((x) => x.isDefault);
        if (def) setPresetId((v) => v || def.id);
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "โหลดข้อมูลตั้งต้นไม่สำเร็จ"));
  }, []);
  const loadList = useCallback(() => {
    setListError(null);
    api
      .listEquipmentReceipts(q.trim())
      .then((r) => setReceipts(r.items))
      .catch((e) => setListError(e instanceof ApiError ? e.message : "โหลดประวัติใบรับไม่สำเร็จ"));
  }, [q]);
  useEffect(loadRefs, [loadRefs]);
  useEffect(() => {
    const t = setTimeout(loadList, 250);
    return () => clearTimeout(t);
  }, [loadList]);

  const totals = useMemo(() => receiptTotals(lines), [lines]);
  const setLine = (i: number, patch: Partial<ReceiptLineDraft>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const fieldErr = (f: string) => (err?.field === f ? err.message : undefined);

  const reset = () => {
    setLines([emptyLine()]);
    setRefNo("");
    setNote("");
    setErr(null);
  };

  const submit = async () => {
    setErr(null);
    setDone(null);
    // ตรวจฝั่งหน้าเว็บเฉพาะช่องบังคับ — กติกาจริงอยู่ที่ backend
    if (!warehouse) return setErr({ field: "warehouse", message: "ต้องเลือกคลังที่รับเข้า" });
    if (!inboundDate) return setErr({ field: "inboundDate", message: "ต้องระบุวันที่รับเข้า" });
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].model) return setErr({ field: `lines.${i}.model`, message: `รายการที่ ${i + 1}: ต้องเลือกรุ่นเครื่อง` });
      if (!(Number(lines[i].quantityText) >= 1)) return setErr({ field: `lines.${i}.quantity`, message: `รายการที่ ${i + 1}: กรุณากรอกจำนวน (อย่างน้อย 1)` });
    }
    setBusy(true);
    try {
      const r = await api.createEquipmentReceipt({
        warehouse,
        inboundDate,
        supplierId: supplierId || undefined,
        supplier: supplierId ? undefined : supplierText.trim(),
        refNo: refNo.trim(),
        warrantyPresetId: presetId || undefined,
        note: note.trim(),
        lines: lines.map((l) => ({
          model: l.model,
          quantity: Number(l.quantityText),
          serials: splitSerials(l.serialsText),
          condition: l.condition,
          ...(String(l.unitCostText ?? "").trim() ? { unitCost: Number(l.unitCostText) } : {}),
        })),
      });
      setDone(r);
      toast.success(`บันทึกใบรับ ${r.receiptNo} แล้ว · รับเข้า ${r.totalMachines} เครื่อง`);
      reset();
      loadList();
    } catch (e) {
      if (e instanceof ApiError) setErr({ field: e.field, message: e.message });
      else setErr({ message: "บันทึกไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <WomsErrorState message={loadError} onRetry={loadRefs} />;
  if (!options) return <WomsLoadingState rows={4} />;

  return (
    <Stack spacing={2.5}>
      <WomsPageHeader
        back={{ href: "/equipment", label: "คลังเครื่อง" }}
        title="รับเครื่องเข้าคลัง"
        subtitle="ใบรับ 1 ใบ รับได้หลายรุ่นหลายเครื่อง · ไม่รู้ Serial ระบบออกเลขชั่วคราวให้และเตือนให้ตามลงภายหลัง"
      />
      <WomsLinkTabs ariaLabel="คลังเครื่อง" current="/equipment/receive" tabs={equipmentTabs(has)} />

      {done ? (
        <Alert severity="success" data-testid="receipt-done" onClose={() => setDone(null)}>
          บันทึกใบรับ <b>{done.receiptNo}</b> แล้ว · รับเข้า {done.warehouse} {done.totalMachines} เครื่อง
          {done.tempSerialCount ? ` (ยังไม่มี SN จริง ${done.tempSerialCount} เครื่อง — ลง Serial ได้ที่หน้าเครื่อง)` : ""}
        </Alert>
      ) : null}

      {canCreate ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) 300px" }, gap: 2, alignItems: "start" }}>
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                ข้อมูลการรับ
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                <TextField
                  select
                  required
                  label="คลังที่รับเข้า"
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  error={!!fieldErr("warehouse")}
                  helperText={fieldErr("warehouse") ?? (options.warehouses.length ? " " : "ยังไม่มีคลังในข้อมูลพื้นฐาน — เพิ่มที่ ตั้งค่า › ข้อมูลพื้นฐาน")}
                  inputProps={{ "data-testid": "rcv-warehouse" }}
                >
                  {options.warehouses.map((w) => (
                    <MenuItem key={w} value={w}>
                      {w}
                    </MenuItem>
                  ))}
                </TextField>
                <DateField
                  required
                  
                  label="วันที่รับเข้า"
                  value={inboundDate}
                  onChange={(e) => setInboundDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ max: today(), "data-testid": "rcv-date" }}
                  error={!!fieldErr("inboundDate")}
                  helperText={fieldErr("inboundDate") ?? "ประกันจากโปรไฟล์เริ่มนับวันนี้"}
                />
                <TextField
                  select
                  label="ผู้จัดจำหน่าย (คู่ค้า)"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  error={!!fieldErr("supplierId")}
                  helperText={fieldErr("supplierId") ?? (supplierId ? " " : "ไม่มีในรายการ? พิมพ์ชื่อในช่องถัดไป")}
                >
                  <MenuItem value="">— ไม่เลือก —</MenuItem>
                  {suppliers.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="ชื่อผู้จัดจำหน่าย (พิมพ์เอง)"
                  value={supplierText}
                  disabled={!!supplierId}
                  onChange={(e) => setSupplierText(e.target.value)}
                  helperText=" "
                />
                <TextField label="เลขที่ใบส่งของ / PO" value={refNo} onChange={(e) => setRefNo(e.target.value)} inputProps={{ maxLength: 60 }} />
                <TextField
                  select
                  label="โปรไฟล์ประกัน"
                  value={presetId}
                  onChange={(e) => setPresetId(e.target.value)}
                  error={!!fieldErr("warrantyPresetId")}
                  helperText={fieldErr("warrantyPresetId") ?? " "}
                >
                  <MenuItem value="">— ไม่ตั้งประกัน —</MenuItem>
                  {presets.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="หมายเหตุ"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  multiline
                  minRows={1}
                  sx={{ gridColumn: { sm: "1 / -1" } }}
                  inputProps={{ maxLength: 1000 }}
                />
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="h6">รายการเครื่องที่รับ</Typography>
                <Button startIcon={<AddIcon />} onClick={() => setLines((ls) => [...ls, emptyLine()])} disabled={lines.length >= 50}>
                  เพิ่มรุ่น
                </Button>
              </Stack>
              <Stack spacing={2} divider={<Divider flexItem />}>
                {lines.map((l, i) => {
                  const t = totals.lines[i];
                  return (
                    <Box key={i} data-testid="rcv-line">
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "2fr 1fr 1fr 1fr auto" }, gap: 1.5, alignItems: "start" }}>
                        <TextField
                          select
                          required
                          label={`รุ่นเครื่อง (${i + 1})`}
                          value={l.model}
                          onChange={(e) => setLine(i, { model: e.target.value })}
                          error={!!fieldErr(`lines.${i}.model`)}
                          helperText={fieldErr(`lines.${i}.model`) ?? " "}
                          sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
                          inputProps={{ "data-testid": `rcv-model-${i}` }}
                        >
                          {options.models.map((m) => (
                            <MenuItem key={m} value={m}>
                              {m}
                            </MenuItem>
                          ))}
                        </TextField>
                        <NumberInput
                          required
                          integer
                          label="จำนวน (เครื่อง)"
                          value={l.quantityText}
                          onValueChange={(text) => setLine(i, { quantityText: text })}
                          error={!!fieldErr(`lines.${i}.quantity`)}
                          helperText={fieldErr(`lines.${i}.quantity`) ?? " "}
                          inputProps={{ "data-testid": `rcv-qty-${i}`, maxLength: 3 }}
                        />
                        <TextField select label="สภาพ" value={l.condition} onChange={(e) => setLine(i, { condition: e.target.value as any })} helperText=" ">
                          <MenuItem value="NEW">เครื่องใหม่</MenuItem>
                          <MenuItem value="USED">เครื่องเก่า</MenuItem>
                        </TextField>
                        <NumberInput
                          label="ต้นทุน/เครื่อง (บาท)"
                          value={l.unitCostText ?? ""}
                          onValueChange={(text) => setLine(i, { unitCostText: text })}
                          error={!!fieldErr(`lines.${i}.unitCost`)}
                          helperText={fieldErr(`lines.${i}.unitCost`) ?? "ไม่บังคับ"}
                          inputProps={{ "data-testid": `rcv-cost-${i}` }}
                        />
                        <IconButton
                          aria-label={`ลบรายการที่ ${i + 1}`}
                          onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, k) => k !== i) : [emptyLine()]))}
                          sx={{ mt: 1 }}
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Box>
                      {/* MOM-06: ใส่จำนวนแล้วได้ช่อง SN ตามจำนวน (1–50) พร้อมตัวนับ · วางหลายบรรทัดจาก Excel แล้วกระจายลงช่องถัดไป
                          จำนวนเกิน 50 หรือยังไม่ใส่จำนวน → ใช้ช่องหลายบรรทัดแบบเดิม · ค่าที่ส่งยังเป็นข้อความบรรทัดละ SN เหมือนเดิม */}
                      {t.quantity >= 1 && t.quantity <= SERIAL_SLOT_MAX ? (
                        <SerialSlots
                          index={i}
                          quantity={t.quantity}
                          text={l.serialsText}
                          onChange={(text) => setLine(i, { serialsText: text })}
                          error={fieldErr(`lines.${i}.serials`) ?? (t.overflow ? `ระบุ Serial ${t.serials} เครื่อง เกินจำนวน ${t.quantity}` : undefined)}
                        />
                      ) : (
                      <TextField
                          fullWidth
                          multiline
                          minRows={2}
                          label="Serial Number (บรรทัดละ 1 เครื่อง · สแกนหรือวางจาก Excel ได้)"
                          value={l.serialsText}
                          onChange={(e) => setLine(i, { serialsText: e.target.value })}
                          error={!!fieldErr(`lines.${i}.serials`) || t.overflow}
                          helperText={
                            fieldErr(`lines.${i}.serials`) ??
                            (t.overflow
                              ? `ระบุ Serial ${t.serials} เครื่อง เกินจำนวน ${t.quantity}`
                              : t.quantity
                                ? `ระบุแล้ว ${t.serials} / ${t.quantity}${t.temp ? ` · อีก ${t.temp} เครื่องจะได้เลขชั่วคราว` : ""}`
                                : "เว้นว่างได้ — ระบบออกเลขชั่วคราวให้")
                          }
                          inputProps={{ "data-testid": `rcv-serials-${i}`, style: { fontFamily: "monospace" } }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Paper>
          </Stack>

          <Paper variant="outlined" sx={{ p: 2.5, position: { md: "sticky" }, top: { md: 80 } }} data-testid="rcv-summary">
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              สรุปใบรับ
            </Typography>
            <Stack spacing={0.75} sx={{ mb: 2 }}>
              <Row k="คลัง" v={warehouse || "–"} />
              <Row k="วันที่รับเข้า" v={thDate(inboundDate)} />
              <Row k="จำนวนรุ่น" v={String(lines.filter((l) => l.model).length)} />
              <Row k="รวมเครื่อง" v={String(totals.total)} strong />
              <Row k="ยังไม่มี SN (เลขชั่วคราว)" v={String(totals.temp)} />
              {totals.totalCost !== null ? <Row k="ต้นทุนรวม" v={fmtMoney(totals.totalCost)} /> : null}
            </Stack>
            {err ? (
              <Alert severity="error" sx={{ mb: 1.5 }} data-testid="rcv-error">
                {err.message}
              </Alert>
            ) : null}
            <Button fullWidth size="large" variant="contained" onClick={submit} disabled={busy || totals.total === 0 || totals.anyOverflow} data-testid="rcv-submit">
              {busy ? "กำลังบันทึก…" : `บันทึกรับเข้า ${totals.total || ""} เครื่อง`}
            </Button>
          </Paper>
        </Box>
      ) : (
        <Alert severity="info">บัญชีนี้ดูประวัติใบรับได้อย่างเดียว — การรับเครื่องเข้าคลังทำได้โดยผู้มีสิทธิ์เพิ่มเครื่อง</Alert>
      )}

      <ReceiptMonthlyCard refreshKey={receipts?.length ?? 0} />

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: "center" }} sx={{ mb: 1.5 }}>
          <Typography variant="h6" sx={{ whiteSpace: "nowrap" }}>ประวัติใบรับ</Typography>
          <TextField size="small" placeholder="ค้นหา เลขใบรับ / ผู้จัดจำหน่าย / PO / รุ่น / Serial" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: { sm: 360 } }} inputProps={{ "aria-label": "ค้นหาใบรับ" }} />
        </Stack>
        {listError ? (
          <WomsErrorState message={listError} onRetry={loadList} />
        ) : !receipts ? (
          <WomsLoadingState rows={2} />
        ) : receipts.length === 0 ? (
          <WomsEmptyState title={q ? "ไม่พบใบรับที่ตรงกับคำค้น" : "ยังไม่มีใบรับเครื่อง"} description={q ? undefined : "ใบรับที่บันทึกจากหน้านี้จะแสดงที่นี่"} />
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>เลขใบรับ</TableCell>
                  <TableCell>วันที่รับ</TableCell>
                  <TableCell>คลัง</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>ผู้จัดจำหน่าย</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>ใบส่งของ/PO</TableCell>
                  <TableCell align="right">จำนวน</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>ผู้บันทึก</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {receipts.map((r) => (
                  <ReceiptRow key={r.id} r={r} canEdit={canCreate} canSeeCost={canSeeCost} onChanged={loadList} />
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">
        {k}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: strong ? 700 : 500 }}>
        {v}
      </Typography>
    </Stack>
  );
}

/** MOM-06: จำนวนช่อง SN สูงสุดที่สร้างเป็นช่องแยก (เกินนี้ใช้ช่องหลายบรรทัดเดิม) */
const SERIAL_SLOT_MAX = 50;

/** ช่อง SN ตามจำนวนเครื่อง · เก็บค่าเป็นข้อความบรรทัดละ SN (รูปแบบเดิมของหน้า) · ช่องว่าง = เลขชั่วคราว */
function SerialSlots({ index, quantity, text, onChange, error }: { index: number; quantity: number; text: string; onChange: (text: string) => void; error?: string }) {
  const lines = text.split(/\r?\n/);
  const slots = Array.from({ length: quantity }, (_, k) => lines[k] ?? "");
  // บรรทัดที่เกินจำนวน (เช่น ลดจำนวนหลังวาง) ยังเก็บไว้ในข้อความ ให้ตัวนับเตือนเกินจำนวนตามเดิม
  const extra = lines.slice(quantity).filter((x) => x.trim());
  const filled = slots.filter((x) => x.trim()).length;
  const emit = (next: string[]) => {
    const all = [...next, ...extra];
    while (all.length && !all[all.length - 1].trim()) all.pop();
    onChange(all.join("\n"));
  };
  const setSlot = (k: number, value: string) => {
    const pieces = value.split(/\r?\n|\t/).map((x) => x.trim());
    const next = [...slots];
    if (pieces.length > 1) {
      // วางหลายค่า → กระจายลงช่องถัดไป (ส่วนที่เกินจำนวนต่อท้ายไว้ ให้ระบบเตือนเกินจำนวน)
      pieces.forEach((p, n) => {
        if (k + n < next.length) next[k + n] = p;
        else next.push(p);
      });
    } else next[k] = value;
    emit(next);
  };
  return (
    <Box data-testid={`rcv-serial-slots-${index}`}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Serial Number (ไม่บังคับ · สแกนหรือวางจาก Excel ได้)
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700 }} data-testid={`rcv-serial-count-${index}`}>
          กรอกแล้ว {filled}/{quantity}
        </Typography>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(3, minmax(0,1fr))" }, gap: 1 }}>
        {slots.map((v, k) => (
          <TextField
            key={k}
            size="small"
            label={`เครื่องที่ ${k + 1}`}
            value={v}
            placeholder="ว่าง = เลขชั่วคราว"
            onChange={(e) => setSlot(k, e.target.value)}
            onPaste={(e) => {
              const txt = e.clipboardData.getData("text");
              if (/\r?\n|\t/.test(txt.trim())) {
                e.preventDefault();
                setSlot(k, txt.trim());
              }
            }}
            inputProps={{ "data-testid": `rcv-serial-${index}-${k}`, style: { fontFamily: "monospace" } }}
          />
        ))}
      </Box>
      <Typography variant="caption" sx={{ display: "block", mt: 0.5 }} color={error ? "error" : "text.secondary"}>
        {error ?? (quantity - filled > 0 ? `อีก ${quantity - filled} เครื่องจะได้เลขชั่วคราว` : "ครบทุกเครื่องแล้ว")}
      </Typography>
    </Box>
  );
}

export default function EquipmentReceivePage() {
  return (
    <WomsPermissionGate perm="inventory:view" backHref="/equipment">
      <ReceivePageInner />
    </WomsPermissionGate>
  );
}


/** MOM-04: ยอดนำเครื่องเข้าคลังรายเดือน (6 เดือนล่าสุด · ไม่นับเครื่องที่ยกเลิกการรับ) */
function ReceiptMonthlyCard({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<{ month: string; receipts: number; machines: number; newMachines: number; usedMachines: number; tempSerial: number }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .equipmentReceiptsMonthly(6)
      .then((r) => alive && setRows(r.items))
      .catch((e) => alive && setErr(e instanceof ApiError ? e.message : "โหลดยอดรายเดือนไม่สำเร็จ"));
    return () => {
      alive = false;
    };
  }, [refreshKey]);
  const monthLabel = (m: string) => {
    const [y, mm] = m.split("-").map(Number);
    return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString("th-TH", { month: "short", year: "numeric", timeZone: "UTC" });
  };
  if (err) return <Alert severity="warning" sx={{ mb: 2 }}>{err}</Alert>;
  if (!rows) return null;
  const cur = rows[0];
  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }} data-testid="rcv-monthly">
      <Typography variant="h6">รับเครื่องเข้าคลังรายเดือน</Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 700, mt: 0.5 }} data-testid="rcv-month-current">
        เดือนนี้รับเข้า {cur?.machines ?? 0} เครื่อง
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        ใหม่ {cur?.newMachines ?? 0} · เก่า {cur?.usedMachines ?? 0} · {cur?.receipts ?? 0} ใบรับ · ยังไม่มี SN {cur?.tempSerial ?? 0} — ไม่นับเครื่องที่ยกเลิกการรับแล้ว
      </Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>เดือน</TableCell>
              <TableCell align="right">ใบรับ</TableCell>
              <TableCell align="right">เครื่อง</TableCell>
              <TableCell align="right">ใหม่</TableCell>
              <TableCell align="right">เก่า</TableCell>
              <TableCell align="right">ยังไม่มี SN</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.month}>
                <TableCell>{monthLabel(r.month)}</TableCell>
                <TableCell align="right">{r.receipts}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{r.machines}</TableCell>
                <TableCell align="right">{r.newMachines}</TableCell>
                <TableCell align="right">{r.usedMachines}</TableCell>
                <TableCell align="right">{r.tempSerial}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}
