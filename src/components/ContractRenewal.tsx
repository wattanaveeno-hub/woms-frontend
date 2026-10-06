"use client";

// Round 8 — CON-03 ต่อสัญญา = สร้างฉบับใหม่แล้วเชื่อมฉบับเดิม (ฉบับเดิมเก็บงวด/เอกสาร/ประวัติไว้ครบ)
import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { contractQuoApi, type ContractChainItem } from "@/lib/contractQuoApi";
import type { Contract } from "@/lib/types";
import { useMoneyInputs } from "@/components/FieldErrors";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ContractLifecycleBadge } from "@/components/ContractBadges";
import { WomsFormSection } from "@/components/woms";

export function ContractRenewDialog({
  contract,
  onClose,
  onRenewed,
}: {
  contract: Contract;
  onClose: () => void;
  onRenewed: (fresh: Contract) => void;
}) {
  const [months, setMonths] = useState("12");
  const [contractNo, setContractNo] = useState("");
  const [startDate, setStartDate] = useState(contract.endDate || "");
  const [rent, setRent] = useState<number>(contract.rentPerMonth);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const money = useMoneyInputs();
  const fe = (k: string) => (err?.field === k ? { error: true, helperText: err.message } : {});

  const submit = async () => {
    setErr(null);
    const m = Number(months);
    if (!/^\d+$/.test(months.trim()) || m < 1 || m > 120) return setErr({ field: "months", message: "จำนวนเดือนต้องเป็นจำนวนเต็ม 1–120" });
    if (!money.check()) return;
    setBusy(true);
    try {
      const fresh = await contractQuoApi.renew(contract.id, {
        months: m,
        contractNo: contractNo.trim(),
        startDate,
        rentPerMonth: rent,
        note: note.trim(),
        updatedAt: contract.updatedAt,
      });
      onRenewed(fresh);
    } catch (e) {
      setErr(e instanceof ApiError ? { field: e.field, message: e.message } : { message: "ต่อสัญญาไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>ต่อสัญญา {contract.contractNo}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">
            ระบบจะสร้างสัญญาฉบับใหม่และเชื่อมกับฉบับนี้ ฉบับเดิมยังเก็บงวดชำระ เอกสาร และประวัติไว้ครบ และถูกปิดเป็น “หมดอายุ”
          </Typography>
          {err && !["months", "contractNo", "startDate", "rentPerMonth"].includes(err.field ?? "") ? (
            <Alert severity="error">{err.message}</Alert>
          ) : null}
          <TextField
            label="เลขสัญญาฉบับใหม่"
            placeholder="เว้นว่าง = ออกเลขอัตโนมัติ"
            value={contractNo}
            onChange={(e) => setContractNo(e.target.value)}
            inputProps={{ maxLength: 40 }}
            {...fe("contractNo")}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              required
              label="วันเริ่มฉบับใหม่"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              {...fe("startDate")}
            />
            <TextField
              required
              label="จำนวนเดือน"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              inputProps={{ inputMode: "numeric" }}
              {...fe("months")}
            />
            <TextField label="ค่าเช่า/เดือน (บาท)" {...money.props("rent", rent, setRent)} {...fe("rentPerMonth")} />
          </Stack>
          <TextField label="หมายเหตุ" multiline minRows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          {busy ? "กำลังสร้างฉบับใหม่…" : "สร้างสัญญาฉบับใหม่"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** สายการต่อสัญญา ก่อนหน้า → ถัดไป */
export function ContractRenewalChain({ contract }: { contract: Contract }) {
  const [items, setItems] = useState<ContractChainItem[] | null>(null);
  const linked = !!(contract.renewedFromId || contract.renewedToId);
  useEffect(() => {
    if (!linked) return;
    contractQuoApi
      .chain(contract.id)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [contract.id, linked, contract.updatedAt]);
  if (!linked) return null;
  return (
    <WomsFormSection title="สายการต่อสัญญา">
      {items === null ? (
        <Typography variant="body2">กำลังโหลด…</Typography>
      ) : (
        <Stack spacing={1}>
          {items.map((it, i) => (
            <Stack key={it.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="body2" sx={{ minWidth: 24 }}>
                {i + 1}.
              </Typography>
              {it.id === contract.id ? (
                <strong className="code">{it.contractNo} (ฉบับนี้)</strong>
              ) : (
                <Link href={`/contracts/${it.id}`} className="code">
                  {it.contractNo}
                </Link>
              )}
              <Typography variant="body2" className="mono">
                {it.startDate || "—"} – {it.endDate || "—"}
              </Typography>
              <ContractLifecycleBadge lifecycle={it.lifecycle} label={it.lifecycleLabel} />
            </Stack>
          ))}
        </Stack>
      )}
    </WomsFormSection>
  );
}
