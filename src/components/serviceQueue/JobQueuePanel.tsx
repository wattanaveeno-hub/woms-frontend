"use client";

// ในหน้าใบงาน: ประวัติคิว/รอบนัด และปุ่ม "เลื่อนงาน (ส่งกลับเข้าคิว)" ของ Admin (RESCHEDULE 01)
// เลื่อนได้แม้เลยวันหรือเวลาเข้างานแล้ว · ใช้ JN เดิม · งานปิด/ยกเลิก/วางบิล/เริ่มทำแล้ว ปุ่มปิดพร้อมเหตุผล
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { FEATURES } from "@/lib/features";
import { useToast } from "@/components/Toast";
import type { AuthUser } from "@/lib/types";
import { WomsFormSection } from "@/components/woms";
import { QueueStatusChip, apptText } from "./QueueBits";
import { sqApi, type ServiceQueue } from "@/lib/serviceQueueApi";

export default function JobQueuePanel({ jobId, onChanged }: { jobId: string; onChanged?: () => void }) {
  const { has } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<ServiceQueue[] | null>(null);
  const [canReschedule, setCanReschedule] = useState(false);
  const [blocker, setBlocker] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [techs, setTechs] = useState<AuthUser[]>([]);
  const [reason, setReason] = useState("");
  const [techId, setTechId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const enabled = FEATURES.serviceQueue && has("svcqueue:view");
  const admin = has("svcqueue:admin");

  const load = useCallback(() => {
    if (!enabled) return;
    sqApi
      .forJob(jobId)
      .then((r) => {
        setItems(r.items);
        setCanReschedule(r.canReschedule);
        setBlocker(r.rescheduleBlocker);
      })
      .catch(() => setItems([]));
  }, [enabled, jobId]);
  useEffect(load, [load]);

  if (!enabled || items === null) return null;
  if (!items.length && !admin) return null;
  const active = items.find((q) => q.status !== "RELEASED" && q.status !== "CANCELLED");
  const current = items.find((q) => q.techId) ?? null;

  return (
    <WomsFormSection
      title="คิวช่าง / รอบนัด"
      actions={
        admin ? (
          <Button
            size="small"
            variant="outlined"
            disabled={!canReschedule}
            onClick={() => {
              setReason("");
              setTechId(current?.techId ?? "");
              setErr(null);
              setOpen(true);
              api.listTechnicians().then((r) => setTechs(r.items.filter((t) => t.active !== false))).catch(() => setTechs([]));
            }}
          >
            เลื่อนงาน (ส่งกลับเข้าคิว)
          </Button>
        ) : null
      }
    >
      {admin && !canReschedule && (blocker || active) ? (
        <Alert severity="info" sx={{ mb: 1 }}>
          {blocker ?? `มีคิวนัดใหม่ ${active?.queueNo} ที่ยังดำเนินการอยู่`}
        </Alert>
      ) : null}
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          ใบงานนี้ไม่ได้เปิดผ่านคิวช่าง — กดเลื่อนงานเพื่อนำกลับเข้าคิวโดยใช้ JN เดิม
        </Typography>
      ) : (
        <Stack spacing={1}>
          {items.map((q) => (
            <Stack key={q.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Link href={`/service-queue/${q.id}`} style={{ fontWeight: 600 }}>
                {q.queueNo}
              </Link>
              <QueueStatusChip status={q.status} mode={q.mode} />
              <Typography variant="body2" color="text.secondary">
                ช่าง {q.techName || "ยังไม่จัด"} · {apptText(q.current?.date ?? "", q.current?.time ?? "", q.current?.period ?? "")} · {q.rounds.length} รอบนัด
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}

      <Dialog open={open} onClose={busy ? undefined : () => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>เลื่อนงาน {jobId} กลับเข้าคิว</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            ใช้ JN เดิม — เก็บข้อมูลลูกค้า เครื่อง SN เอกสาร และประวัติเดิมทั้งหมด · วันนัดเดิมพ้นจากคิวใช้งานแต่ยังอยู่ในประวัติ ·
            ใบงานจะแสดงเป็น “รอเช็คคิวใหม่” จนกว่า Admin จะยืนยันส่งงานกลับ
          </Typography>
          <TextField
            fullWidth
            required
            multiline
            minRows={2}
            label="เหตุผลการเลื่อน"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={!!err}
            helperText={err ?? " "}
            sx={{ mb: 1 }}
          />
          <TextField select fullWidth label="ช่างสำหรับนัดใหม่" value={techId} onChange={(e) => setTechId(e.target.value)} helperText="เลือกช่างเดิมเพื่อรอเสนอวันใหม่ หรือเลือกช่างคนใหม่ · เว้นว่าง = กลับไปรอจัดช่าง">
            <MenuItem value="">— รอจัดช่าง —</MenuItem>
            {techs.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
                {t.id === current?.techId ? " (ช่างเดิม)" : ""}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={async () => {
              if (!reason.trim()) return setErr("ต้องระบุเหตุผลการเลื่อนงาน");
              setBusy(true);
              try {
                const q = await sqApi.rescheduleJob(jobId, reason.trim(), techId);
                toast.success(`ส่ง ${jobId} กลับเข้าคิว ${q.queueNo} แล้ว`);
                setOpen(false);
                window.dispatchEvent(new Event("woms:queue-changed"));
                load();
                onChanged?.();
              } catch (e) {
                setErr(e instanceof ApiError ? e.message : "เลื่อนงานไม่สำเร็จ");
              } finally {
                setBusy(false);
              }
            }}
          >
            เลื่อนงาน
          </Button>
        </DialogActions>
      </Dialog>
    </WomsFormSection>
  );
}
