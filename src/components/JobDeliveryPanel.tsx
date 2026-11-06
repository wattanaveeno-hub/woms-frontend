"use client";

// ---------------------------------------------------------------------------
// CR-EQ02 (CF v1.1 §4 · §6) — ส่งออก / ส่งมอบ / รับคืน รายเครื่อง และสถานะติดตั้ง
//   บันทึกเมื่อเกิดจริง (วันเวลาจริง) · ไม่ใช่การติดตั้ง: ไม่ตั้งวันติดตั้ง/PM/วันเริ่มค่าเช่า และไม่ปิดใบงาน
//   ส่งบางส่วนได้ (รายเครื่อง) · รับคืนต้องมีเหตุผล · เครื่องที่ส่งแล้วต้องรับคืนก่อนเปลี่ยน/ถอด
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { JobEquipmentLine } from "@/lib/types";
import Alert from "@mui/material/Alert";
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
import TableContainer from "@mui/material/TableContainer";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WomsFormSection } from "@/components/woms";

type Kind = "DISPATCH" | "DELIVER" | "RETURN";
const KIND_LABEL: Record<Kind, string> = { DISPATCH: "ส่งออก", DELIVER: "ส่งมอบ", RETURN: "รับคืน" };
const STATE_LABEL: Record<string, string> = { NOT_DISPATCHED: "ยังไม่ส่งออก", DISPATCHED: "ส่งออกแล้ว", DELIVERED: "ส่งมอบแล้ว" };

function nowLocal(): string {
  const d = new Date(Date.now() + 7 * 3600e3);
  return d.toISOString().slice(0, 16);
}

export default function JobDeliveryPanel({ jobId, jobStatus, lines, onChanged }: { jobId: string; jobStatus: string; lines: JobEquipmentLine[]; onChanged: () => void }) {
  const { has } = useAuth();
  const toast = useToast();
  const [moves, setMoves] = useState<any[]>([]);
  const [dlg, setDlg] = useState<{ line: JobEquipmentLine; kind: Kind } | null>(null);
  const [at, setAt] = useState(nowLocal());
  const [docRef, setDocRef] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reqId, setReqId] = useState("");

  const load = useCallback(async () => {
    try {
      setMoves((await api.jobMovements(jobId)).items);
    } catch {
      setMoves([]);
    }
  }, [jobId]);
  useEffect(() => {
    void load();
  }, [load]);

  const real = lines.filter((l) => !!l.equipmentId);
  if (!real.length) return null;
  const canEdit = has("jobs:edit") && (jobStatus === "OPEN" || jobStatus === "HOLD");

  const open = (line: JobEquipmentLine, kind: Kind) => {
    setDlg({ line, kind });
    setAt(nowLocal());
    setDocRef("");
    setNote("");
    setErr(null);
    setReqId(`mv-${line.id}-${kind}-${Date.now()}`);
  };
  const save = async () => {
    if (!dlg) return;
    if (dlg.kind === "RETURN" && !note.trim()) return setErr("รับคืนต้องระบุเหตุผล");
    setBusy(true);
    try {
      await api.recordMovement(jobId, dlg.line.id, { kind: dlg.kind, at: `${at}:00+07:00`, docRef, note, requestId: reqId });
      toast.success(`บันทึก${KIND_LABEL[dlg.kind]}แล้ว`);
      setDlg(null);
      await load();
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <WomsFormSection title="ส่งเครื่องและติดตั้ง (รายเครื่อง)">
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        ส่งออก/ส่งมอบไม่ใช่การติดตั้ง — วันติดตั้งจริงบันทึกตอนช่างบันทึกเครื่องเสร็จ และใช้เป็นฐาน PM · วันเริ่มค่าเช่าเป็นไปตามสัญญาที่ลูกค้ายืนยัน
      </Typography>
      <TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
        <Table size="small" aria-label="สถานะการส่งเครื่อง">
          <TableHead>
            <TableRow>
              <TableCell>เครื่อง</TableCell>
              <TableCell>การส่ง</TableCell>
              <TableCell>การติดตั้ง</TableCell>
              {canEdit ? <TableCell /> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {real.map((l: any) => {
              const st = String(l.deliveryState || "NOT_DISPATCHED");
              return (
                <TableRow key={l.id} data-testid="delivery-row">
                  <TableCell className="code">{l.serial}</TableCell>
                  <TableCell>
                    <Chip size="small" label={STATE_LABEL[st] ?? st} color={st === "DELIVERED" ? "success" : st === "DISPATCHED" ? "info" : "default"} data-testid="delivery-state" />
                    {l.deliveredAt || l.dispatchedAt ? (
                      <Typography variant="caption" sx={{ display: "block" }}>{String(l.deliveredAt || l.dispatchedAt).slice(0, 16).replace("T", " ")}</Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{l.installedOn ? `ติดตั้งแล้ว ${l.installedOn}` : l.result === "DONE" ? "เสร็จแล้ว" : "ยังไม่ติดตั้ง"}</TableCell>
                  {canEdit ? (
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {st === "NOT_DISPATCHED" && jobStatus === "OPEN" ? <Button size="small" onClick={() => open(l, "DISPATCH")} data-testid="mv-dispatch">ส่งออก</Button> : null}
                        {st !== "DELIVERED" && jobStatus === "OPEN" ? <Button size="small" onClick={() => open(l, "DELIVER")} data-testid="mv-deliver">ส่งมอบ</Button> : null}
                        {st !== "NOT_DISPATCHED" && l.result !== "DONE" ? <Button size="small" color="warning" onClick={() => open(l, "RETURN")} data-testid="mv-return">รับคืน</Button> : null}
                      </Stack>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {moves.length ? (
        <Stack sx={{ mt: 1 }} spacing={0.25} data-testid="movement-history">
          {moves.map((m) => (
            <Typography key={m.id} variant="caption">
              {String(m.at).slice(0, 16).replace("T", " ")} · {KIND_LABEL[m.kind as Kind] ?? m.kind} {m.serial} · {m.actorName}{m.docRef ? ` · ${m.docRef}` : ""}{m.note ? ` · ${m.note}` : ""}
            </Typography>
          ))}
        </Stack>
      ) : null}
      <Dialog open={!!dlg} onClose={() => setDlg(null)} fullWidth maxWidth="xs">
        <DialogTitle>{dlg ? `${KIND_LABEL[dlg.kind]} ${dlg.line.serial}` : ""}</DialogTitle>
        <DialogContent>
          {err ? <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert> : null}
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField type="datetime-local" label="วันเวลาที่เกิดจริง" value={at} onChange={(e) => setAt(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "mv-at" }} />
            <TextField label="เอกสารอ้างอิง (เช่น ใบส่งของ)" value={docRef} onChange={(e) => setDocRef(e.target.value)} />
            <TextField label={dlg?.kind === "RETURN" ? "เหตุผล *" : "หมายเหตุ"} value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} inputProps={{ "data-testid": "mv-note" }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={save} disabled={busy} data-testid="mv-save">บันทึก</Button>
        </DialogActions>
      </Dialog>
    </WomsFormSection>
  );
}
