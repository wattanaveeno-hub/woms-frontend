"use client";

// Round 8 — การ์ดสัญญาบนหน้าเครื่อง (MCH-02 / CON-04 / AT-07)
// ข้อมูลทั้งหมดดึงจากโมดูลสัญญา (GET /api/contracts/by-equipment/:id) ไม่เก็บซ้ำที่เครื่อง
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, ApprovalPendingError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useAuth } from "@/lib/AuthContext";
import { contractQuoApi, type EquipmentContracts } from "@/lib/contractQuoApi";
import type { Contract } from "@/lib/types";
import { contractTypeLabel } from "@/lib/options";
import { ContractLifecycleBadge } from "@/components/ContractBadges";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { WomsFormSection, WomsKeyValue } from "@/components/woms";

export default function EquipmentContractCard({ equipmentId, rentalWithoutContract }: { equipmentId: string; rentalWithoutContract?: boolean }) {
  const { has } = useAuth();
  const canView = has("contracts:view");
  const [data, setData] = useState<EquipmentContracts | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A D-04 / DEF-01 — ผูกสัญญาจากหน้าเครื่อง (MCH-02 p.3 "ผูกจากหน้าเครื่องหรือหน้าสัญญาก็ได้")
  const toast = useToast();
  const [bindOpen, setBindOpen] = useState(false);
  const [candidates, setCandidates] = useState<Contract[] | null>(null);
  const [pickId, setPickId] = useState("");
  const [binding, setBinding] = useState(false);
  useEffect(() => {
    if (!bindOpen) return;
    setCandidates(null);
    // สัญญาที่ยังไม่มีเครื่อง (BR-04: สัญญาที่มี SN แล้วผูกเพิ่มไม่ได้) และยังไม่ถูกยกเลิก
    contractQuoApi
      .listContracts({})
      .then((r) => setCandidates(r.items.filter((c) => !c.serial && c.status !== "CANCELLED")))
      .catch(() => setCandidates([]));
  }, [bindOpen]);
  const bind = async () => {
    const target = candidates?.find((c) => c.id === pickId);
    if (!target || !data) return;
    setBinding(true);
    try {
      await api.linkContractEquipment(target.id, data.equipment.serial, target.updatedAt);
      toast.success(`ผูกเครื่อง ${data.equipment.serial} กับสัญญา ${target.contractNo} แล้ว`);
      setBindOpen(false);
      await load();
    } catch (e) {
      if (e instanceof ApprovalPendingError) {
        toast.info(e.message);
        setBindOpen(false);
        return;
      }
      toast.error(e instanceof ApiError ? e.message : "ผูกสัญญาไม่สำเร็จ");
    } finally {
      setBinding(false);
    }
  };

  const load = useCallback(async () => {
    if (!canView) return;
    setError(null);
    try {
      setData(await contractQuoApi.byEquipment(equipmentId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลสัญญาไม่สำเร็จ");
    }
  }, [equipmentId, canView]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canView) return null;
  const active = data?.active ?? null;
  const others = (data?.contracts ?? []).filter((c) => c.id !== active?.id);
  // A D-04 — แสดงเฉพาะเครื่องเช่า (ธง rentalWithoutContract) หรือเครื่องที่มีสัญญาอยู่แล้ว
  if (data && !rentalWithoutContract && data.contracts.length === 0) return null;
  const canBind = !!data && !active && has("contracts:edit");
  const canCreate = !!data && !active && has("contracts:create");

  const period = (c: Contract) => (
    <span className="mono">
      {c.startDate || "—"} – {c.endDate || "—"}
    </span>
  );

  return (
    <WomsFormSection title="สัญญาของเครื่อง">
      {error ? <Alert severity="error">{error}</Alert> : null}
      {!data && !error ? <Typography variant="body2">กำลังโหลด…</Typography> : null}
      {data && !active ? (
        <Alert severity={rentalWithoutContract ? "warning" : "info"} sx={{ mb: others.length ? 1 : 0 }}>
          {rentalWithoutContract ? "เครื่องเช่านี้ยังไม่ผูกสัญญาที่ใช้งานอยู่" : "ไม่มีสัญญาที่ใช้งานอยู่"}
        </Alert>
      ) : null}
      {canBind || canCreate ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: others.length ? 1 : 0 }}>
          {canBind ? (
            <Button variant="outlined" onClick={() => { setPickId(""); setBindOpen(true); }}>
              ผูกสัญญา
            </Button>
          ) : null}
          {canCreate ? (
            <Button component={Link} href={`/contracts/new?serial=${encodeURIComponent(data!.equipment.serial)}`}>
              สร้างสัญญาให้เครื่องนี้
            </Button>
          ) : null}
        </Stack>
      ) : null}
      {bindOpen && data ? (
        <Dialog open onClose={() => (binding ? null : setBindOpen(false))} fullWidth maxWidth="sm">
          <DialogTitle>ผูกเครื่อง {data.equipment.serial} กับสัญญา</DialogTitle>
          <DialogContent dividers>
            {candidates === null ? (
              <Typography variant="body2">กำลังโหลด…</Typography>
            ) : candidates.length === 0 ? (
              <Alert severity="info">ไม่มีสัญญาที่ยังไม่ผูกเครื่อง — ใช้ “สร้างสัญญาให้เครื่องนี้” แทน</Alert>
            ) : (
              <TextField select label="สัญญาที่ยังไม่ผูกเครื่อง" value={pickId} onChange={(e) => setPickId(e.target.value)} helperText="1 สัญญาผูกได้ 1 เครื่อง (BR-04)">
                {candidates.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.contractNo} · {contractTypeLabel[c.type]} · {c.customerName || "-"} · {c.lifecycleLabel ?? c.status}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBindOpen(false)} disabled={binding}>
              ยกเลิก
            </Button>
            <Button variant="contained" onClick={bind} disabled={binding || !pickId}>
              {binding ? "กำลังบันทึก…" : "ผูกสัญญา"}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
      {active ? (
        <WomsKeyValue
          items={[
            ["เลขสัญญา", <Link key="n" href={`/contracts/${active.id}`} className="code">{active.contractNo}</Link>],
            ["ประเภท", contractTypeLabel[active.type]],
            ["ลูกค้า", active.customerName || "-"],
            ["ที่อยู่ตามสัญญา", active.siteAddressFull || "—"],
            ["ระยะเวลา", period(active)],
            [
              "สถานะ",
              <Stack key="s" direction="row" spacing={1} alignItems="center">
                <ContractLifecycleBadge lifecycle={active.lifecycle} label={active.lifecycleLabel} />
                {active.lifecycle === "EXPIRING" && active.daysToExpiry !== undefined ? (
                  <Typography variant="body2">อีก {active.daysToExpiry} วัน</Typography>
                ) : null}
              </Stack>,
            ],
            ["การชำระ", active.paymentStateLabel ?? "-"],
            active.previousContractNo ? ["ต่อจากสัญญา", active.previousContractNo] : null,
          ]}
        />
      ) : null}
      {others.length ? (
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            สัญญาอื่นของเครื่องนี้
          </Typography>
          {others.map((c) => (
            <Stack key={c.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Link href={`/contracts/${c.id}`} className="code">
                {c.contractNo}
              </Link>
              <Typography variant="body2">{contractTypeLabel[c.type]}</Typography>
              {period(c)}
              <ContractLifecycleBadge lifecycle={c.lifecycle} label={c.lifecycleLabel} />
            </Stack>
          ))}
        </Stack>
      ) : null}
    </WomsFormSection>
  );
}
