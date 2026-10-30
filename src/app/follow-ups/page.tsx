"use client";

// ---------------------------------------------------------------------------
// รายการติดตาม (Q-R3-12) + คิวคำขอแก้ไขหลังปิดงาน (Q-R3-13)
// ---------------------------------------------------------------------------
// รายการติดตาม: Admin / Manager (jobs:edit) — เช่น งานติดตั้งถูกยกเลิก/ถอดเครื่องขณะสัญญายังมีผล
//   (ระบบไม่ยกเลิกสัญญาและไม่เปลี่ยนสถานะเครื่องเอง) · ปิดเรื่องต้องระบุว่าดำเนินการอย่างไร
// คำขอแก้ไขหลังปิดงาน: Manager (changes:approve) / CEO ดูอย่างเดียว (changes:view) — พิจารณาที่หน้าใบงาน
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ApiError, request } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { bangkokDateTime } from "@/lib/date";
import { jobRevisionApi, FollowUp, JobRevision } from "@/lib/jobRevisionApi";
import { WomsEmptyState, WomsErrorState, WomsLoadingState, WomsPageHeader, WomsStatusChip } from "@/components/woms";

type TabKey = "OPEN" | "RESOLVED" | "REVISIONS";

export default function FollowUpsPage() {
  const { has } = useAuth();
  const toast = useToast();
  const canFollow = has("jobs:edit");
  const canRevisions = has("changes:approve") || has("changes:view");
  const [tab, setTab] = useState<TabKey>(canFollow ? "OPEN" : "REVISIONS");
  const [items, setItems] = useState<FollowUp[] | null>(null);
  const [revs, setRevs] = useState<JobRevision[] | null>(null);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState<FollowUp | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      if (tab === "REVISIONS") {
        setRevs((await request<{ items: JobRevision[] }>("/api/job-revisions?status=REQUESTED")).items);
      } else {
        setItems((await jobRevisionApi.followUps(tab)).items);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [tab]);
  useEffect(() => {
    if (canFollow || canRevisions) void load();
  }, [load, canFollow, canRevisions]);

  if (!canFollow && !canRevisions) return <WomsEmptyState title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้" description="หน้านี้สำหรับ Admin / Manager" />;

  const resolve = async () => {
    if (!resolving) return;
    if (!note.trim()) return toast.error("ต้องระบุหมายเหตุการปิดเรื่อง");
    setBusy(true);
    try {
      await jobRevisionApi.resolveFollowUp(resolving.followUpId, note.trim());
      toast.success("ปิดเรื่องแล้ว");
      setResolving(null);
      setNote("");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ปิดเรื่องไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <WomsPageHeader title="รายการติดตาม" subtitle="เรื่องที่ระบบตรวจพบและต้องมีผู้ตัดสินใจต่อ · คำขอแก้ไขหลังปิดงานที่รอพิจารณา" />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        {canFollow ? <Tab value="OPEN" label="รอดำเนินการ" data-testid="fu-tab-open" /> : null}
        {canFollow ? <Tab value="RESOLVED" label="ปิดเรื่องแล้ว" /> : null}
        {canRevisions ? <Tab value="REVISIONS" label="คำขอแก้ไขหลังปิดงาน" data-testid="fu-tab-revisions" /> : null}
      </Tabs>
      {error ? <WomsErrorState message={error} onRetry={load} /> : null}
      {tab === "REVISIONS" ? (
        revs === null ? (
          <WomsLoadingState rows={3} />
        ) : revs.length === 0 ? (
          <WomsEmptyState title="ไม่มีคำขอแก้ไขที่รอพิจารณา" />
        ) : (
          <Stack spacing={1.5}>
            {revs.map((r) => (
              <Card key={r.revisionId}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography className="code">{r.jobId}</Typography>
                    <WomsStatusChip tone="warning" label={r.statusLabel} />
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    คำขอที่ {r.requestNo} โดย {r.requestedBy} · {bangkokDateTime(r.requestedAt)} — {r.reason}
                  </Typography>
                  <Typography variant="body2">แก้: {r.changedFields.join(", ")}</Typography>
                  <Button component={Link} href={`/jobs/${encodeURIComponent(r.jobId)}`} size="small" sx={{ mt: 1 }}>
                    เปิดใบงานเพื่อพิจารณา
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )
      ) : items === null ? (
        <WomsLoadingState rows={3} />
      ) : items.length === 0 ? (
        <WomsEmptyState title={tab === "OPEN" ? "ไม่มีรายการที่รอดำเนินการ" : "ยังไม่มีรายการที่ปิดเรื่อง"} />
      ) : (
        <Stack spacing={1.5} data-testid="follow-up-list">
          {items.map((f) => (
            <Card key={f.followUpId}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <WomsStatusChip tone={f.status === "OPEN" ? "warning" : "success"} label={f.statusLabel} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {f.typeLabel}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ mt: 0.75 }}>
                  {f.detail}
                </Typography>
                <Box sx={{ mt: 0.75 }}>
                  <Typography variant="body2">
                    ใบงาน{" "}
                    <Link href={`/jobs/${encodeURIComponent(f.jobId)}`} className="code">
                      {f.jobId}
                    </Link>
                    {f.contractNo ? <> · สัญญา <span className="code">{f.contractNo}</span> ({f.contractStatus})</> : null}
                    {f.serial ? <> · เครื่อง <span className="code">{f.serial}</span>{f.equipmentStatus ? ` (${f.equipmentStatus})` : ""}</> : null}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    สร้างเมื่อ {bangkokDateTime(f.createdAt)} โดย {f.createdBy}
                    {f.salesUnresolved ? ` · ไม่พบบัญชีเซลล์ "${f.salesPerson}" (แจ้งเฉพาะ Admin)` : ""}
                  </Typography>
                  {f.status === "RESOLVED" ? (
                    <Typography variant="body2">
                      ปิดเรื่องโดย {f.resolvedBy} · {bangkokDateTime(f.resolvedAt)} — {f.resolutionNote}
                    </Typography>
                  ) : null}
                </Box>
                {f.status === "OPEN" && canFollow ? (
                  <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={() => setResolving(f)} data-testid="fu-resolve">
                    ปิดเรื่อง
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      <Dialog open={!!resolving} onClose={() => !busy && setResolving(null)} fullWidth maxWidth="sm">
        <DialogTitle>ปิดเรื่อง: {resolving?.typeLabel}</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 1.5 }}>
            ระบุว่าดำเนินการอย่างไร เช่น เปิดงานติดตั้งใหม่เลขที่… หรือดำเนินการกับสัญญาตามขั้นตอนสัญญาแล้ว — การปิดเรื่องไม่เปลี่ยนสัญญา/เครื่องให้อัตโนมัติ
          </Alert>
          <TextField label="หมายเหตุการปิดเรื่อง *" value={note} onChange={(e) => setNote(e.target.value)} fullWidth multiline minRows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolving(null)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={() => void resolve()} disabled={busy}>
            ปิดเรื่อง
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
