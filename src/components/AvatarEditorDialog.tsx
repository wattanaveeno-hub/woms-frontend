"use client";
// CHAT-AV01: ตั้ง/เปลี่ยน/ลบรูปโปรไฟล์ — ใช้ทั้งเมนูผู้ใช้ (ตัวเอง) และหน้าจัดการผู้ใช้ (ผู้มี users:manage)
import { useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UserAvatar from "@/components/UserAvatar";
import { ApiError } from "@/lib/api";
import { saveAvatar, useAvatarUrl } from "@/lib/avatarStore";
import { AVATAR_ACCEPT, resizeAvatar } from "@/lib/avatarImage";

export default function AvatarEditorDialog(props: {
  open: boolean;
  onClose: () => void;
  userId: string;
  name: string;
  /** "me" = ตั้งรูปตัวเอง · "admin" = ผู้จัดการผู้ใช้ตั้งให้ */
  mode: "me" | "admin";
}) {
  const { open, onClose, userId, name, mode } = props;
  const url = useAvatarUrl(open ? userId : null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await fn();
      setDone(ok);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  const target = mode === "me" ? "me" : userId;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{mode === "me" ? "รูปโปรไฟล์ของฉัน" : `รูปโปรไฟล์ — ${name}`}</DialogTitle>
      <DialogContent>
        <Stack alignItems="center" spacing={1.5} sx={{ pt: 1 }}>
          <UserAvatar userId={userId} name={name} size={120} />
          <Typography variant="body2" color="text.secondary" textAlign="center">
            รูปนี้แสดงข้างข้อความในแชทกลุ่ม · ระบบตัดกลางเป็นสี่เหลี่ยมจัตุรัสและย่อให้อัตโนมัติ
          </Typography>
          {error ? <Alert severity="error" sx={{ width: "100%" }}>{error}</Alert> : null}
          {done ? <Alert severity="success" sx={{ width: "100%" }}>{done}</Alert> : null}
          <input
            ref={fileRef}
            type="file"
            accept={AVATAR_ACCEPT}
            hidden
            data-testid="avatar-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void run(async () => saveAvatar(target, userId, await resizeAvatar(f)), "บันทึกรูปโปรไฟล์แล้ว");
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between", px: 3, pb: 2 }}>
        <Button
          color="error"
          startIcon={<DeleteOutlineIcon />}
          disabled={busy || !url}
          onClick={() => void run(() => saveAvatar(target, userId, null), "ลบรูปโปรไฟล์แล้ว")}
        >
          ลบรูป
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} disabled={busy}>
            ปิด
          </Button>
          <Button variant="contained" startIcon={<PhotoCameraIcon />} disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "กำลังบันทึก…" : url ? "เปลี่ยนรูป" : "เลือกรูป"}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
