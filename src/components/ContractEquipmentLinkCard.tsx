"use client";

// ---------------------------------------------------------------------------
// DEF-01 — การ์ด "การเชื่อมเครื่อง" บนหน้าสัญญา
// CON-01 p.8 "การ์ดเชื่อมเครื่อง: แสดงสถานะการเชื่อมกับ Machine Master และใช้ผูกสัญญากับเครื่อง"
// MCH-02 p.3 "ผูกจากหน้าเครื่องหรือหน้าสัญญาก็ได้" · BR-04 1 สัญญา = 1 เครื่อง (ผูกได้เฉพาะสัญญาที่ยังไม่มี SN)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, ApprovalPendingError } from "@/lib/api";
import type { Contract, EquipmentStatus } from "@/lib/types";
import { equipmentStatusLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { WomsFormSection, WomsKeyValue, WomsStatusChip } from "@/components/woms";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

type EqOption = { serial: string; model: string; status: string; note: string };

export default function ContractEquipmentLinkCard({
  contract: c,
  canLink,
  onLinked,
}: {
  contract: Contract;
  canLink: boolean;
  onLinked: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [serial, setSerial] = useState("");
  const [options, setOptions] = useState<EqOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const eq = c.equipment ?? null;
  const linkable = !c.serial && c.status !== "CANCELLED" && canLink;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // ตัวเลือก: เครื่องว่างในคลัง + เครื่องเช่าที่ยังไม่ผูกสัญญา (พิมพ์ SN อื่นเองได้ — backend ตรวจซ้ำเสมอ)
    Promise.all([
      api.listEquipment({ status: "IN_STOCK" }).catch(() => ({ items: [] as any[] })),
      api.listEquipment({ contractState: "MISSING" }).catch(() => ({ items: [] as any[] })),
    ]).then(([a, b]) => {
      if (cancelled) return;
      const seen = new Set<string>();
      const list: EqOption[] = [];
      for (const [items, note] of [
        [b.items, "เครื่องเช่ายังไม่ผูกสัญญา"],
        [a.items, "ว่างในคลัง"],
      ] as const) {
        for (const e of items as any[]) {
          if (!e.serial || seen.has(e.serial)) continue;
          seen.add(e.serial);
          list.push({ serial: e.serial, model: e.model ?? "", status: e.status ?? "", note });
        }
      }
      setOptions(list);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const submit = async () => {
    const sn = serial.trim();
    if (!sn) {
      setErr("ต้องระบุ Serial ของเครื่อง");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.linkContractEquipment(c.id, sn, c.updatedAt);
      toast.success(`ผูกเครื่อง ${sn} กับสัญญา ${c.contractNo} แล้ว`);
      setOpen(false);
      onLinked();
    } catch (e) {
      if (e instanceof ApprovalPendingError) {
        toast.info(e.message);
        setOpen(false);
        return;
      }
      setErr(e instanceof ApiError ? e.message : "ผูกเครื่องไม่สำเร็จ");
      if (e instanceof ApiError && e.status === 409) onLinked();
    } finally {
      setBusy(false);
    }
  };

  const chip = !c.serial ? (
    <WomsStatusChip label="ยังไม่ผูกเครื่อง" tone="warning" />
  ) : eq ? (
    <WomsStatusChip label="เชื่อม Master Data แล้ว" tone="success" />
  ) : (
    <WomsStatusChip label="SN ไม่มีในทะเบียนเครื่อง" tone="warning" />
  );

  return (
    <WomsFormSection
      title="การเชื่อมเครื่อง"
      titleAdornment={chip}
      actions={
        <Stack direction="row" spacing={1}>
          {eq?.id ? (
            <Button component={Link} href={`/equipment/${eq.id}`}>
              ดูเครื่อง
            </Button>
          ) : null}
          {linkable ? (
            <Button
              variant="outlined"
              onClick={() => {
                setSerial("");
                setErr(null);
                setOpen(true);
              }}
            >
              ผูกเครื่อง
            </Button>
          ) : null}
        </Stack>
      }
    >
      <WomsKeyValue
        items={[
          ["เครื่อง (SN)", c.serial ? <span className="code">{c.serial}</span> : "— ยังไม่ผูก —"],
          ["รุ่น", eq?.model || c.model || "—"],
          ["สถานะเครื่อง", eq ? equipmentStatusLabel[eq.status as EquipmentStatus] ?? eq.status : "—"],
        ]}
      />
      {!c.serial ? (
        <Typography variant="body2" sx={{ mt: 1 }}>
          1 สัญญาผูกได้ 1 เครื่อง (BR-04) — สัญญาที่เปิดใช้งานแล้ว เครื่องจะถูกตั้งสถานะและที่อยู่ตามสัญญาทันทีที่ผูก
        </Typography>
      ) : null}

      <Dialog open={open} onClose={() => (busy ? null : setOpen(false))} fullWidth maxWidth="sm">
        <DialogTitle>ผูกเครื่องกับสัญญา {c.contractNo}</DialogTitle>
        <DialogContent dividers>
          <Autocomplete
            freeSolo
            options={options}
            getOptionLabel={(o) => (typeof o === "string" ? o : o.serial)}
            renderOption={(props, o) => (
              <li {...props} key={o.serial}>
                <span className="code">{o.serial}</span>
                {o.model ? ` · ${o.model}` : ""} · {o.note}
              </li>
            )}
            inputValue={serial}
            onInputChange={(_, v) => setSerial(v)}
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                label="Serial เครื่อง (SN)"
                error={!!err}
                helperText={err || "เลือกจากเครื่องว่างในคลัง หรือเครื่องเช่าที่ยังไม่ผูกสัญญา"}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={submit} disabled={busy || !serial.trim()}>
            {busy ? "กำลังบันทึก…" : "ผูกเครื่อง"}
          </Button>
        </DialogActions>
      </Dialog>
    </WomsFormSection>
  );
}
