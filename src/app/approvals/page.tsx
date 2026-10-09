"use client";

// ---------------------------------------------------------------------------
// คำขออนุมัติการแก้ไข/ลบของ Admin (VFB 28/9/69 แถว 21)
// ---------------------------------------------------------------------------
// Manager / CEO (changes:approve): เห็นทุกคำขอ อ่านก่อน/หลัง แล้วอนุมัติหรือไม่อนุมัติพร้อมเหตุผล
// Admin: เห็นเฉพาะคำขอของตัวเอง และยกเลิกคำขอที่ยังรออยู่ได้
// การตรวจสิทธิ์และเวอร์ชันข้อมูลทำที่ backend ทุกครั้ง — หน้านี้แสดงผลและส่งคำสั่งเท่านั้น
import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { api, ApiError } from "@/lib/api";
import type { ChangeRequest } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { bangkokDateTimeOr } from "@/lib/date";
import { WomsEmptyState, WomsErrorState, WomsLoadingState, WomsPageHeader, WomsStatusChip, type StatusTone } from "@/components/woms";

const TONE: Record<ChangeRequest["status"], StatusTone> = {
  PENDING: "warning",
  APPLYING: "info",
  APPROVED: "success",
  REJECTED: "error",
  CANCELLED: "neutral",
  STALE: "neutral",
  FAILED: "error",
};

function ChangesTable({ cr }: { cr: ChangeRequest }) {
  if (!cr.changes.length) return <Typography variant="body2">ไม่มีฟิลด์ที่เปลี่ยน</Typography>;
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }} aria-label={`การเปลี่ยนแปลงของ ${cr.requestNo}`}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 6 }}>ข้อมูล</th>
            <th style={{ textAlign: "left", padding: 6 }}>ก่อน</th>
            <th style={{ textAlign: "left", padding: 6 }}>หลัง</th>
          </tr>
        </thead>
        <tbody>
          {cr.changes.map((c) => (
            <tr key={c.field}>
              <td style={{ padding: 6, verticalAlign: "top" }}>{c.field}</td>
              <td style={{ padding: 6, verticalAlign: "top", wordBreak: "break-word" }}>{c.before || "—"}</td>
              <td style={{ padding: 6, verticalAlign: "top", wordBreak: "break-word", fontWeight: 600 }}>{c.after || "—"}</td>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

export default function ApprovalsPage() {
  const { status, has, user } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const canApprove = has("changes:approve");
  const canSee = canApprove || user?.role === "admin";
  const [tab, setTab] = useState<"PENDING" | "ALL">("PENDING");
  const [items, setItems] = useState<ChangeRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.listChangeRequests(tab === "PENDING" ? { status: "PENDING" } : {});
      setItems(r.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดคำขอไม่สำเร็จ");
    }
  }, [tab]);

  useEffect(() => {
    if (status === "authed" && canSee) load();
  }, [status, canSee, load]);

  if (status !== "authed") return null;
  if (!canSee) return <WomsEmptyState title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้" description="หน้านี้สำหรับผู้อนุมัติ (ผู้จัดการ / ผู้บริหาร) และผู้ส่งคำขอ" />;

  const act = async (cr: ChangeRequest, kind: "approve" | "reject" | "cancel") => {
    let note = "";
    if (kind === "approve") {
      const ok = await dialog.confirm({
        title: `อนุมัติ ${cr.requestNo}?`,
        message: `${cr.label} — ${cr.entityLabel}\nระบบจะตรวจว่าข้อมูลยังเป็นเวอร์ชันเดียวกับตอนส่งคำขอก่อนนำไปใช้`,
        confirmLabel: "อนุมัติ",
      });
      if (!ok) return;
    } else if (kind === "reject") {
      const v = await dialog.prompt({ title: `ไม่อนุมัติ ${cr.requestNo}`, label: "เหตุผล", type: "textarea", required: true, confirmLabel: "ไม่อนุมัติ", danger: true });
      if (!v) return;
      note = v;
    } else {
      if (!(await dialog.confirm({ title: `ยกเลิกคำขอ ${cr.requestNo}?`, confirmLabel: "ยกเลิกคำขอ", danger: true }))) return;
    }
    setBusyId(cr.id);
    try {
      const r =
        kind === "approve" ? await api.approveChangeRequest(cr.id) : kind === "reject" ? await api.rejectChangeRequest(cr.id, note) : await api.cancelChangeRequest(cr.id);
      if (r.status === "APPROVED") toast.success(`${r.requestNo}: อนุมัติและมีผลแล้ว`);
      else if (r.status === "STALE" || r.status === "FAILED") toast.warning(`${r.requestNo}: ${r.statusLabel} — ${r.resultMessage}`);
      else toast.info(`${r.requestNo}: ${r.statusLabel}`);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ดำเนินการไม่สำเร็จ");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <WomsPageHeader
        title="คำขออนุมัติ"
        subtitle={canApprove ? "คำขอแก้ไข/ลบข้อมูลเดิมจาก Admin — ข้อมูลจริงจะเปลี่ยนเมื่ออนุมัติเท่านั้น" : "คำขอแก้ไข/ลบที่คุณส่งให้ผู้จัดการหรือผู้บริหารอนุมัติ"}
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} aria-label="ตัวกรองคำขอ">
        <Tab value="PENDING" label="รออนุมัติ" />
        <Tab value="ALL" label="ทั้งหมด" />
      </Tabs>
      {error ? (
        <WomsErrorState message={error} onRetry={load} />
      ) : items === null ? (
        <WomsLoadingState />
      ) : items.length === 0 ? (
        <WomsEmptyState title={tab === "PENDING" ? "ไม่มีคำขอที่รออนุมัติ" : "ยังไม่มีคำขอ"} />
      ) : (
        <Stack spacing={1.5}>
          {items.map((cr) => {
            const mine = cr.requestedById === user?.id;
            return (
              <Card key={cr.id} variant="outlined" aria-label={`คำขอ ${cr.requestNo}`}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                    <span className="code">{cr.requestNo}</span>
                    <WomsStatusChip label={cr.statusLabel} tone={TONE[cr.status]} />
                    <Typography sx={{ fontWeight: 700, color: "text.primary" }}>
                      {cr.label} · {cr.entityLabel}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    ผู้ขอ {cr.requestedBy} · {bangkokDateTimeOr(cr.requestedAt)}
                    {cr.reason ? ` · เหตุผล: ${cr.reason}` : ""}
                  </Typography>
                  {cr.kind === "DELETE" ? (
                    <Alert severity="warning" sx={{ mb: 1 }}>
                      ขอลบรายการนี้ออกจากระบบ
                    </Alert>
                  ) : (
                    <ChangesTable cr={cr} />
                  )}
                  {cr.decidedAt ? (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {cr.status === "CANCELLED" ? "ยกเลิกเมื่อ" : `ตัดสินโดย ${cr.decidedBy || "-"} เมื่อ`} {bangkokDateTimeOr(cr.decidedAt)}
                      {cr.decisionNote && cr.status !== "CANCELLED" ? ` · ${cr.decisionNote}` : ""}
                      {cr.resultMessage ? ` · ผล: ${cr.resultMessage}` : ""}
                    </Typography>
                  ) : null}
                  {cr.status === "PENDING" ? (
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                      {canApprove && !mine ? (
                        <>
                          <Button variant="contained" disabled={busyId === cr.id} onClick={() => act(cr, "approve")}>
                            อนุมัติ
                          </Button>
                          <Button variant="outlined" color="error" disabled={busyId === cr.id} onClick={() => act(cr, "reject")}>
                            ไม่อนุมัติ
                          </Button>
                        </>
                      ) : null}
                      {mine ? (
                        <Button variant="outlined" disabled={busyId === cr.id} onClick={() => act(cr, "cancel")}>
                          ยกเลิกคำขอ
                        </Button>
                      ) : null}
                    </Stack>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </div>
  );
}
