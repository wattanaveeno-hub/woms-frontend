"use client";

// ---------------------------------------------------------------------------
// DEF-08 — การ์ด "ลูกค้า" บนหน้าสัญญา
// CON-01 อนุญาตสร้างสัญญาโดยยังไม่ผูกลูกค้า (แสดง "-") → ต้องผูกภายหลังจากหน้าจอได้
// mockup: ชื่อลูกค้า · สาขา + "รอผูก Customer Master" เมื่อยังไม่ผูก
// บันทึกผ่าน PATCH /api/contracts/:id (partnerId / siteId / customerName) — Admin = ส่งคำขออนุมัติ (VFB แถว 21)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, ApprovalPendingError } from "@/lib/api";
import type { Contract, CustomerSite, Partner } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { WomsFormSection, WomsKeyValue, WomsStatusChip } from "@/components/woms";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

export default function ContractCustomerCard({
  contract: c,
  canEdit,
  onSaved,
}: {
  contract: Contract;
  canEdit: boolean;
  onSaved: (updated: Contract | null) => void;
}) {
  const toast = useToast();
  const [siteLabel, setSiteLabel] = useState("");
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [picked, setPicked] = useState<Partner | null>(null);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [siteId, setSiteId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ชื่อสาขาของสัญญา (สาขาเก็บเป็น id)
  useEffect(() => {
    if (!c.partnerId || !c.siteId) {
      setSiteLabel("");
      return;
    }
    let cancelled = false;
    api
      .listCustomerSites(c.partnerId)
      .then((r) => {
        if (!cancelled) setSiteLabel(r.items.find((s) => s.id === c.siteId)?.label ?? "");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [c.partnerId, c.siteId]);

  useEffect(() => {
    if (!open) return;
    api
      .listPartners({ type: "CUSTOMER" })
      .then((r) => {
        setCustomers(r.items);
        setPicked(r.items.find((p) => p.id === c.partnerId) ?? null);
      })
      .catch(() => setCustomers([]));
  }, [open, c.partnerId]);

  useEffect(() => {
    if (!picked) {
      setSites([]);
      return;
    }
    let cancelled = false;
    api
      .listCustomerSites(picked.id, { activeOnly: true })
      .then((r) => {
        if (!cancelled) setSites(r.items);
      })
      .catch(() => {
        if (!cancelled) setSites([]);
      });
    return () => {
      cancelled = true;
    };
  }, [picked]);

  const save = async () => {
    if (!picked) {
      setErr("ต้องเลือกลูกค้า");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const site = sites.find((s) => s.id === siteId);
      const values: Parameters<typeof api.contractEdit>[1] = {
        partnerId: picked.id,
        siteId,
        customerName: picked.name,
      };
      if (!c.customerPhone && picked.phone) values.customerPhone = picked.phone;
      if (!c.customerAddress && picked.address) values.customerAddress = picked.address;
      // เลือกสาขาแล้ว และสัญญายังไม่มีที่อยู่หน้างาน → เติมจากสาขา (ไม่ทับที่อยู่ที่กรอกไว้แล้ว)
      if (site && !c.siteAddress) values.siteAddress = site.addressFull || site.address || site.label;
      if (site?.zone && !c.zone) values.zone = site.zone;
      const updated = await api.contractEdit(c.id, values, c.updatedAt);
      toast.success(`ผูกลูกค้า ${picked.name} กับสัญญา ${c.contractNo} แล้ว`);
      setOpen(false);
      onSaved(updated);
    } catch (e) {
      if (e instanceof ApprovalPendingError) {
        toast.info(e.message);
        setOpen(false);
        return;
      }
      setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
      if (e instanceof ApiError && e.status === 409) onSaved(null);
    } finally {
      setBusy(false);
    }
  };

  const linked = !!c.partnerId;
  return (
    <WomsFormSection
      title="ลูกค้า"
      titleAdornment={
        linked ? <WomsStatusChip label="ผูกลูกค้าแล้ว" tone="success" /> : <WomsStatusChip label="ยังไม่ผูกลูกค้า" tone="warning" />
      }
      actions={
        <Stack direction="row" spacing={1}>
          {linked ? (
            <Button component={Link} href={`/partners/${c.partnerId}`}>
              ดูลูกค้า
            </Button>
          ) : null}
          {canEdit && c.status !== "CANCELLED" ? (
            <Button
              variant={linked ? "text" : "outlined"}
              onClick={() => {
                setErr(null);
                setSiteId(c.siteId || "");
                setOpen(true);
              }}
            >
              {linked ? "เปลี่ยนลูกค้า" : "ผูกลูกค้า"}
            </Button>
          ) : null}
        </Stack>
      }
    >
      <WomsKeyValue
        items={[
          [
            "ชื่อลูกค้า",
            linked ? <Link href={`/partners/${c.partnerId}`}>{c.customerName || "(ไม่ระบุชื่อ)"}</Link> : c.customerName || "-",
          ],
          ["สาขา", siteLabel || (c.siteId ? "—" : "— ยังไม่ระบุสาขา —")],
          ["โทร", c.customerPhone || "—"],
        ]}
      />

      <Dialog open={open} onClose={() => (busy ? null : setOpen(false))} fullWidth maxWidth="sm">
        <DialogTitle>{linked ? "เปลี่ยนลูกค้าของสัญญา" : "ผูกลูกค้ากับสัญญา"} {c.contractNo}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Autocomplete
              options={customers}
              value={picked}
              getOptionLabel={(p) => (p.customerCode ? `${p.customerCode} · ${p.name}` : p.name)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, p) => {
                setPicked(p);
                setSiteId("");
              }}
              renderInput={(params) => <TextField {...params} label="ลูกค้าจากฐานข้อมูล" error={!!err} helperText={err || " "} />}
            />
            <TextField
              select
              label="ร้าน / สาขาของลูกค้า"
              value={siteId}
              disabled={!picked}
              SelectProps={{ displayEmpty: true }}
              InputLabelProps={{ shrink: true }}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <MenuItem value="">{!picked ? "— เลือกลูกค้าก่อน —" : sites.length === 0 ? "— ลูกค้านี้ยังไม่มีสาขา —" : "— ไม่ระบุสาขา —"}</MenuItem>
              {sites.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={save} disabled={busy || !picked}>
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </DialogActions>
      </Dialog>
    </WomsFormSection>
  );
}
