"use client";

// BD-4 (SA 6 พ.ย. 69): Sales ผู้รับผิดชอบลูกค้า/สาขา — ใช้แจ้งเตือนคิว PM (สาขาก่อน แล้วลูกค้า) · ไม่มี = แจ้ง Admin แทน
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, SalesOwnerInfo } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WomsFormSection } from "@/components/woms";

type Target = { siteId: string; label: string; current: string };

export default function PartnerSalesOwner({ partnerId }: { partnerId: string }) {
  const { has } = useAuth();
  const toast = useToast();
  const [info, setInfo] = useState<SalesOwnerInfo | null>(null);
  const [sales, setSales] = useState<{ id: string; name: string }[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [pick, setPick] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const canEdit = has("partners:edit");

  const load = useCallback(async () => {
    try {
      setInfo(await api.salesOwner(partnerId));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดผู้รับผิดชอบไม่สำเร็จ");
    }
  }, [partnerId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!canEdit) return;
    api
      .listUsers()
      .then((r) => setSales(r.items.filter((u: any) => u.role === "sales" && u.active !== false).map((u) => ({ id: u.id, name: u.name }))))
      .catch(() => setSales([]));
  }, [canEdit]);

  const save = async () => {
    if (!target) return;
    if (!reason.trim()) return setErr("ต้องระบุเหตุผล");
    try {
      await api.setSalesOwner(partnerId, target.siteId, { ownerSaleId: pick, expectedOwnerSaleId: target.current, reason: reason.trim() });
      toast.success("บันทึกผู้รับผิดชอบแล้ว");
      setTarget(null);
      setReason("");
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    }
  };

  if (!info) return err ? <Alert severity="warning">{err}</Alert> : null;
  const row = (label: string, name: string, t: Target) => (
    <Stack key={t.siteId || "customer"} direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
      <Typography variant="body2" sx={{ minWidth: 180 }}>{label}</Typography>
      <Typography variant="body2" color={name ? "text.primary" : "text.secondary"} sx={{ flex: 1 }} data-testid="sales-owner-name">
        {name || "ยังไม่กำหนด"}
      </Typography>
      {canEdit ? (
        <Button size="small" onClick={() => { setTarget(t); setPick(t.current); setErr(null); }} data-testid="sales-owner-edit">
          {name ? "เปลี่ยน" : "กำหนด"}
        </Button>
      ) : null}
    </Stack>
  );

  return (
    <WomsFormSection title="Sales ผู้รับผิดชอบ">
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        ใช้แจ้งเตือนคิว PM ของลูกค้านี้ — สาขาที่กำหนดไว้ใช้ก่อน ไม่กำหนด = ใช้ระดับลูกค้า · ไม่มีทั้งสองระดับ = แจ้ง Admin แทน
      </Typography>
      {row("ระดับลูกค้า", info.customer.ownerSaleName, { siteId: "", label: "ระดับลูกค้า", current: info.customer.ownerSaleId })}
      {info.sites.map((s) =>
        row(`สาขา ${s.branchNo} ${s.storeName}`.trim(), s.ownerSaleName, { siteId: s.siteId, label: `สาขา ${s.branchNo} ${s.storeName}`, current: s.ownerSaleId })
      )}
      <Dialog open={!!target} onClose={() => setTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Sales ผู้รับผิดชอบ — {target?.label}</DialogTitle>
        <DialogContent>
          {err ? <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert> : null}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Sales" value={pick} onChange={(e) => setPick(e.target.value)} inputProps={{ "data-testid": "sales-owner-pick" }}>
              <MenuItem value="">— ยกเลิกการกำหนด —</MenuItem>
              {sales.map((u) => (
                <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="เหตุผล" required value={reason} onChange={(e) => setReason(e.target.value)} multiline minRows={2} inputProps={{ "data-testid": "sales-owner-reason" }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={save} data-testid="sales-owner-save">บันทึก</Button>
        </DialogActions>
      </Dialog>
    </WomsFormSection>
  );
}
