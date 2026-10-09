"use client";

// ร่างใบงาน (JOB-01) — แสดงบนหน้ารายการงานเมื่อมีร่างค้าง · เปิดต่อ / ลบได้
// ร่างไม่ใช่ใบงาน: ไม่มีเลข JN ไม่ขึ้นปฏิทิน ไม่แจ้งช่าง จนกว่าจะกดส่งเปิดงาน
import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useDialog } from "@/components/Dialog";
import type { JobDraft } from "@/lib/types";
import { bangkokTime } from "@/lib/serviceQueueRules";

export default function JobDraftsCard() {
  const { has } = useAuth();
  const dialog = useDialog();
  const [items, setItems] = useState<JobDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canCreate = has("jobs:create");

  const load = () => {
    if (!canCreate) return;
    api
      .listJobDrafts()
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof ApiError ? e.message : "โหลดร่างใบงานไม่สำเร็จ"));
  };
  useEffect(load, [canCreate]);

  if (!canCreate || (!items.length && !error)) return null;

  const remove = async (d: JobDraft) => {
    if (!(await dialog.confirm({ title: `ลบร่าง “${d.title}”?`, message: "ร่างที่ลบแล้วเปิดต่อไม่ได้", confirmLabel: "ลบร่าง" }))) return;
    try {
      await api.deleteJobDraft(d.id);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "ลบร่างไม่สำเร็จ");
    }
  };

  return (
    <Alert severity={error ? "error" : "info"} sx={{ mb: 2 }} icon={false}>
      {error ? (
        error
      ) : (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            ร่างใบงานที่ยังไม่ส่ง ({items.length})
          </Typography>
          <Stack spacing={0.75}>
            {items.map((d) => (
              <Stack key={d.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" sx={{ flex: "1 1 200px" }}>
                  {d.title}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {d.ownerName} · แก้ล่าสุด {bangkokTime(d.updatedAt)}
                  </Typography>
                </Typography>
                <Button size="small" component={Link} href={`/jobs/new?draft=${d.id}`}>
                  เปิดต่อ
                </Button>
                <Button size="small" color="error" onClick={() => remove(d)}>
                  ลบ
                </Button>
              </Stack>
            ))}
          </Stack>
        </>
      )}
    </Alert>
  );
}
