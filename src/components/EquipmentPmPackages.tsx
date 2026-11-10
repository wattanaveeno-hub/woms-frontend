"use client";
// CR-PK01 P4 — ชุด Package PM ของเครื่อง (แยกชุด · ไม่แชร์ข้ามเครื่อง) + ประวัติการใช้สิทธิ์
//   PK01-09: แสดงรายการรอทำ (คิว/JN PM ที่ยังเปิดของเครื่อง) — ยังไม่ตัดสิทธิ์จนกว่าจะปิด PM จริง
//   FIN-R10-03: ปุ่มตรวจเกณฑ์/เปิดสิทธิ์ — นโยบายปิดเป็นค่าเริ่มต้น ระบบแจ้งเหตุผลจาก backend (ไม่ตัดสินที่หน้าเว็บ)
//   D10-E: คำขอปรับ (ยกเลิก/ขยาย/คืนเงิน) แสดงปุ่มเฉพาะเมื่อเปิดใช้และผู้ใช้มีสิทธิ์ตามการตั้งค่า
import { useCallback, useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useAuth } from "@/lib/AuthContext";
import { ApiError } from "@/lib/api";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { api, type PmPackageItem, type PmPackageLedgerItem, type PmPackageRequestItem, type PmWorkInfo } from "@/lib/api";
import { WomsFormSection, WomsStatusChip } from "@/components/woms";
import type { StatusTone } from "@/components/woms/WomsStatusChip";

const TONE: Record<PmPackageItem["displayStatus"], StatusTone> = {
  PENDING_ACTIVATION: "warning",
  ACTIVE: "success",
  EXHAUSTED: "neutral",
  EXPIRED: "neutral",
  CANCELLED: "error",
};

const REQ_LABEL: Record<string, string> = { CANCEL: "ยกเลิกรอบที่ยังไม่ใช้", TRANSFER: "โอน", EXTEND: "ขยายอายุ", REFUND: "คืนเงิน" };
const REQ_STATUS: Record<string, string> = { PENDING: "รออนุมัติ", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ", PAID: "จ่ายคืนแล้ว" };
type Policy = Awaited<ReturnType<typeof api.pmPackagePolicy>>;

export default function EquipmentPmPackages({ equipmentId }: { equipmentId: string }) {
  const { has } = useAuth();
  const [items, setItems] = useState<PmPackageItem[] | null>(null);
  const [ledger, setLedger] = useState<PmPackageLedgerItem[]>([]);
  const [work, setWork] = useState<PmWorkInfo | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [requests, setRequests] = useState<PmPackageRequestItem[]>([]);
  const [activating, setActivating] = useState<PmPackageItem | null>(null);
  const [requesting, setRequesting] = useState<PmPackageItem | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const load = useCallback(() => {
    api
      .pmPackages(equipmentId)
      .then((r) => {
        setItems(r.items);
        setLedger(r.ledger);
      })
      .catch(() => setItems([]));
    api.pmWork(equipmentId).then(setWork).catch(() => setWork(null));
    api.pmPackagePolicy().then(setPolicy).catch(() => setPolicy(null));
    api.pmPackageRequests(equipmentId).then((r) => setRequests(r.items)).catch(() => setRequests([]));
  }, [equipmentId]);
  useEffect(() => {
    load();
  }, [load]);
  const perms = new Set(policy?.myPermissions ?? []);
  // RB-11: นโยบายเปิดแล้ว → เฉพาะผู้ได้ pmpkg:activate (Backend บังคับ) · นโยบายปิด → แสดงปุ่มเพื่อให้ระบบแจ้งว่าเกณฑ์รออนุมัติ
  const canActivate =
    policy && policy.activationPolicy !== "DISABLED" ? perms.has("pmpkg:activate") : has("payments:verify") || has("quotations:status");
  const canRequest = !!policy?.adjustmentsEnabled && perms.has("pmpkg:request");
  const [deciding, setDeciding] = useState<{ r: PmPackageRequestItem; approve: boolean } | null>(null);
  const [decideReason, setDecideReason] = useState("");
  const decide = (r: PmPackageRequestItem, approve: boolean) => {
    setDecideReason("");
    setDeciding({ r, approve });
  };
  const submitDecision = async () => {
    if (!deciding) return;
    try {
      await api.decidePmPackageRequest(deciding.r.id, deciding.approve, decideReason);
      setMsg({ tone: "success", text: deciding.approve ? "อนุมัติแล้ว" : "บันทึกไม่อนุมัติแล้ว" });
      setDeciding(null);
      load();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ" });
      setDeciding(null);
    }
  };
  const openWork = [...(work?.related?.queues ?? []).map((q) => ({ key: q.queueId, href: `/service-queue/${q.queueId}`, label: `คิว ${q.queueNo}` })), ...(work?.related?.jobs ?? []).map((j) => ({ key: j.jobId, href: `/jobs/${encodeURIComponent(j.jobId)}`, label: `${j.jobId}${j.status === "HOLD" ? " (พักงาน)" : ""}` }))];
  if (!items || !items.length) return null;
  const nameOf = (id: string) => items.find((p) => p.id === id)?.packageName ?? "-";
  return (
    <WomsFormSection title="ชุด Package PM ของเครื่อง">
      {items.some((p) => p.displayStatus === "PENDING_ACTIVATION") ? (
        <Alert severity="info" sx={{ mb: 1.5 }} data-testid="pm-package-pending-note">
          ชุดที่รอเปิดสิทธิ์ยังใช้ทำ PM ฟรีไม่ได้ — เปิดได้เมื่อผ่านเกณฑ์การชำระ{policy?.activationPolicy === "DISABLED" ? " (ยังไม่ได้ตั้งเกณฑ์การชำระ)" : ""} · การแนบสลิปไม่เปิดสิทธิ์เอง
        </Alert>
      ) : null}
      {msg ? (
        <Alert severity={msg.tone} sx={{ mb: 1.5 }} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      ) : null}
      <Typography variant="body2" sx={{ mb: 1 }} data-testid="pm-package-pending-work">
        รายการรอทำ:{" "}
        {openWork.length
          ? openWork.map((w, i) => (
              <span key={w.key}>
                {i ? ", " : ""}
                <Link href={w.href}>{w.label}</Link>
              </span>
            ))
          : "ไม่มีคิว/ใบงาน PM ที่ยังเปิด"}{" "}
        <Typography component="span" variant="caption" color="text.secondary">
          (ตัดสิทธิ์เมื่อปิด PM จริงเท่านั้น)
        </Typography>
      </Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" aria-label="ชุด Package PM">
          <TableHead>
            <TableRow>
              <TableCell>Package</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell>ใช้ / ทั้งหมด</TableCell>
              <TableCell>คงเหลือ</TableCell>
              <TableCell>ทุก (เดือน)</TableCell>
              <TableCell>เริ่ม / หมดอายุ</TableCell>
              <TableCell>ที่มา</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id} data-testid="pm-package-row">
                <TableCell>{p.packageName}</TableCell>
                <TableCell>
                  <WomsStatusChip label={p.displayStatusLabel} tone={TONE[p.displayStatus]} />
                </TableCell>
                <TableCell className="mono">
                  {p.roundsUsed}/{p.roundsTotal}
                </TableCell>
                <TableCell className="mono">{p.roundsRemaining}</TableCell>
                <TableCell>{p.intervalMonths || "-"}</TableCell>
                <TableCell className="mono">
                  {p.serviceStartDate || "รอกำหนด"} / {p.expiresOn || (p.termMonths ? `${p.termMonths} เดือนหลังเริ่ม` : "-")}
                </TableCell>
                <TableCell>
                  {p.source.kind === "QUOTATION_LINE" && p.source.quotationId ? (
                    <Link href={`/quotations/${p.source.quotationId}`}>
                      {p.source.quotationNo} Rev.{p.source.revision} บรรทัด {p.source.lineNo}
                    </Link>
                  ) : p.source.jobId ? (
                    <Link href={`/jobs/${p.source.jobId}`}>งานติดตั้ง {p.source.jobId}</Link>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {p.displayStatus === "PENDING_ACTIVATION" && canActivate ? (
                    <Button size="small" onClick={() => setActivating(p)} data-testid="pm-package-activate">
                      เปิดสิทธิ์
                    </Button>
                  ) : null}
                  {canRequest && p.displayStatus === "ACTIVE" ? (
                    <Button size="small" onClick={() => setRequesting(p)}>
                      ขอปรับ
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Typography variant="subtitle2" sx={{ mt: 2 }}>
        ประวัติการใช้สิทธิ์
      </Typography>
      {ledger.length ? (
        ledger.map((e) => (
          <Typography key={e.id} variant="body2" data-testid="pm-package-ledger-row">
            {e.serviceDate || e.at.slice(0, 10)} · {e.kind === "USE" ? "ใช้ 1 ครั้ง" : `${e.kind} ${e.rounds}`} · {nameOf(e.packageId)}
            {e.jobId ? (
              <>
                {" · "}
                <Link href={`/jobs/${e.jobId}`}>{e.jobId}</Link>
              </>
            ) : null}
          </Typography>
        ))
      ) : (
        <Typography variant="caption" color="text.secondary">
          ยังไม่มีการใช้สิทธิ์จากชุดเหล่านี้
        </Typography>
      )}
      {requests.length ? (
        <>
          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            คำขอปรับสิทธิ์
          </Typography>
          {requests.map((r) => (
            <Stack key={r.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" data-testid="pm-package-request-row">
              <Typography variant="body2">
                {r.requestedAt.slice(0, 10)} · {REQ_LABEL[r.type]} {r.type === "EXTEND" ? `ถึง ${r.newExpiresOn}` : `${r.rounds} รอบ`}
                {r.amount ? ` · ${r.amount.toLocaleString("th-TH")} บาท` : ""} · {REQ_STATUS[r.status]} · ผู้ขอ {r.requestedBy} · เหตุผล: {r.reason}
                {r.decidedBy ? ` · ผู้พิจารณา ${r.decidedBy}` : ""}
              </Typography>
              {r.status === "PENDING" && policy?.adjustmentsEnabled && (perms.has(r.type === "REFUND" ? "pmpkg:refund_approve" : "pmpkg:approve")) ? (
                <>
                  <Button size="small" onClick={() => decide(r, true)}>อนุมัติ</Button>
                  <Button size="small" color="error" onClick={() => decide(r, false)}>ไม่อนุมัติ</Button>
                </>
              ) : null}
            </Stack>
          ))}
        </>
      ) : null}
      <Dialog open={!!deciding} onClose={() => setDeciding(null)} fullWidth maxWidth="xs">
        <DialogTitle>{deciding?.approve ? "อนุมัติคำขอ" : "ไม่อนุมัติคำขอ"}</DialogTitle>
        <DialogContent>
          <TextField sx={{ mt: 1 }} fullWidth label={deciding?.approve ? "เหตุผล (ถ้ามี)" : "เหตุผลที่ไม่อนุมัติ"} value={decideReason} onChange={(e) => setDecideReason(e.target.value)} required={!deciding?.approve} multiline minRows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeciding(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={submitDecision} disabled={!deciding?.approve && !decideReason.trim()}>
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>
      {activating ? (
        <ActivateDialog
          pkg={activating}
          onClose={() => setActivating(null)}
          onDone={(text) => {
            setActivating(null);
            setMsg({ tone: "success", text });
            load();
          }}
        />
      ) : null}
      {requesting ? (
        <RequestDialog
          pkg={requesting}
          onClose={() => setRequesting(null)}
          onDone={() => {
            setRequesting(null);
            setMsg({ tone: "success", text: "ยื่นคำขอแล้ว — รอผู้มีสิทธิ์อนุมัติ (ยังไม่ตัดสิทธิ์)" });
            load();
          }}
        />
      ) : null}
    </WomsFormSection>
  );
}

function ActivateDialog({ pkg, onClose, onDone }: { pkg: PmPackageItem; onClose: () => void; onDone: (text: string) => void }) {
  const [check, setCheck] = useState<Awaited<ReturnType<typeof api.pmPackageActivationCheck>> | null>(null);
  const [start, setStart] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.pmPackageActivationCheck(pkg.id).then(setCheck).catch((e) => setErr(e instanceof ApiError ? e.message : "ตรวจเกณฑ์ไม่สำเร็จ"));
  }, [pkg.id]);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.activatePmPackage(pkg.id, { serviceStartDate: start });
      onDone(r.replayed ? "ชุดนี้เปิดสิทธิ์ไว้แล้ว" : `เปิดสิทธิ์แล้ว · เริ่ม ${r.package.serviceStartDate} หมดอายุ ${r.package.expiresOn || "-"}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "เปิดสิทธิ์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>เปิดสิทธิ์ {pkg.packageName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          {check ? (
            check.ready ? (
              <Alert severity="success">
                ผ่านเกณฑ์: ACC ยืนยันรับเงิน {Number(check.snapshot?.verifiedTotal ?? 0).toLocaleString("th-TH")} / {Number(check.snapshot?.amountDue ?? 0).toLocaleString("th-TH")} บาท
              </Alert>
            ) : (
              <Alert severity="warning" data-testid="pm-package-activation-blocked">{check.message}</Alert>
            )
          ) : null}
          {check?.ready ? (
            <TextField type="date" label="วันเริ่มบริการที่ตกลง" value={start} onChange={(e) => setStart(e.target.value)} InputLabelProps={{ shrink: true }} helperText="ไม่ใช่วันซื้อ/วันชำระ · วันหมดอายุคำนวณจากอายุสิทธิ์" required />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>ปิด</Button>
        {check?.ready ? (
          <Button variant="contained" onClick={submit} disabled={busy || !start}>
            เปิดสิทธิ์
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

function RequestDialog({ pkg, onClose, onDone }: { pkg: PmPackageItem; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState("CANCEL");
  const [rounds, setRounds] = useState("1");
  const [newExpiresOn, setNewExpiresOn] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [clientRequestId] = useState(() => `pkgreq-${pkg.id}-${Date.now()}`);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.createPmPackageRequest(pkg.id, {
        type,
        rounds: type === "EXTEND" ? 0 : Number(rounds),
        ...(type === "EXTEND" ? { newExpiresOn } : {}),
        ...(type === "REFUND" ? { amount: Number(amount) } : {}),
        reason,
        clientRequestId,
      });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "ยื่นคำขอไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>ขอปรับสิทธิ์ {pkg.packageName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          <TextField select label="ประเภท" value={type} onChange={(e) => setType(e.target.value)}>
            <MenuItem value="CANCEL">ยกเลิกรอบที่ยังไม่ใช้</MenuItem>
            {pkg.expiresOn ? <MenuItem value="EXTEND">ขยายอายุ</MenuItem> : null}
            <MenuItem value="REFUND">คืนเงิน (Finance อนุมัติ)</MenuItem>
          </TextField>
          {type !== "EXTEND" ? <TextField type="number" label={`จำนวนรอบ (ยังไม่ใช้ ${pkg.roundsRemaining})`} value={rounds} onChange={(e) => setRounds(e.target.value)} inputProps={{ min: 1, max: pkg.roundsRemaining }} /> : null}
          {type === "EXTEND" ? <TextField type="date" label="วันหมดอายุใหม่" value={newExpiresOn} onChange={(e) => setNewExpiresOn(e.target.value)} InputLabelProps={{ shrink: true }} /> : null}
          {type === "REFUND" ? <TextField type="number" label="จำนวนเงินที่ขอคืน (Finance ตรวจ)" value={amount} onChange={(e) => setAmount(e.target.value)} /> : null}
          <TextField label="เหตุผล" value={reason} onChange={(e) => setReason(e.target.value)} required multiline minRows={2} inputProps={{ maxLength: 500 }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>ยกเลิก</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !reason.trim()}>ยื่นคำขอ</Button>
      </DialogActions>
    </Dialog>
  );
}
