"use client";

// D-04 เปลี่ยนรหัสผ่านของตัวเอง
// - ใช้ได้ทุกบทบาท · บังคับใช้เมื่อบัญชีใหม่/ถูกผู้จัดการรีเซ็ต (user.mustChangePassword)
// - สำเร็จแล้วเก็บ token ใหม่แบบเดียวกับ login · อุปกรณ์อื่นที่ใช้บัญชีนี้จะถูกออกจากระบบ
import { useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/AuthContext";
import UserAvatar from "@/components/UserAvatar";
import AvatarEditorDialog from "@/components/AvatarEditorDialog";
import { ROLE_LABEL } from "@/lib/auditOptions";
import { api, ApiError } from "@/lib/api";
import { useDialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import {
  passwordChecklist,
  PASSWORD_MIN_LENGTH,
  validateChangePassword,
  type ChangePasswordErrors,
  type ChangePasswordForm,
} from "@/lib/passwordRules";

const EMPTY: ChangePasswordForm = { currentPassword: "", newPassword: "", confirmPassword: "" };

export default function ChangePasswordPage() {
  const { user, applySession, logout, setMe } = useAuth();
  const dialog = useDialog();
  const toast = useToast();
  // แก้ชื่อที่แสดงของตัวเองได้ทุกบทบาท (Owner 23 พ.ย. 2569)
  const editName = async () => {
    if (!user) return;
    const v = await dialog.prompt({
      title: "แก้ชื่อที่แสดง",
      label: "ชื่อ",
      help: "ชื่อที่แสดงในระบบ แชท และเอกสารที่ออกหลังจากนี้ · เอกสารเดิมไม่เปลี่ยนตาม",
      defaultValue: user.name,
      required: true,
      validate: (s) => (!s.trim() ? "ต้องระบุชื่อ" : s.trim().length > 100 ? "ไม่เกิน 100 ตัวอักษร" : null),
      confirmLabel: "บันทึก",
    });
    if (v === null || v.trim() === user.name) return;
    try {
      const r = await api.updateMe({ name: v.trim() });
      setMe(r.user);
      toast.success("บันทึกชื่อแล้ว");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกชื่อไม่สำเร็จ");
    }
  };
  // Phase 7 (ENTECH design "Account"): การ์ดโปรไฟล์มีรูป + ปุ่มเปลี่ยนรูป (CHAT-AV01 เดิม) · ปุ่มออกจากระบบที่หัวหน้า
  const [avatarOpen, setAvatarOpen] = useState(false);
  const router = useRouter();
  const [form, setForm] = useState<ChangePasswordForm>(EMPTY);
  const [errors, setErrors] = useState<ChangePasswordErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const required = user?.mustChangePassword === true;

  const set = (k: keyof ChangePasswordForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const fe = validateChangePassword(form);
    setErrors(fe);
    setError(null);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      const r = await api.changePassword(form.currentPassword, form.newPassword);
      applySession(r);
      setForm(EMPTY);
      router.replace("/"); // หน้าแรก
    } catch (err) {
      if (err instanceof ApiError && (err.field === "currentPassword" || err.field === "newPassword")) {
        setErrors({ [err.field]: err.message });
      } else {
        setError(err instanceof ApiError ? err.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      }
      setBusy(false);
    }
  };

  return (
    // ENTECH redesign — บัญชีของฉัน (ซ้าย) + เปลี่ยนรหัสผ่าน (ขวา) เต็มความกว้างหน้า
    <Box sx={{ py: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1} sx={{ mb: 0.5 }}>
        <Typography component="h1" variant="h1">
          บัญชีของฉัน & เปลี่ยนรหัสผ่าน
        </Typography>
        {!required ? (
          <Button color="error" variant="outlined" onClick={logout} data-testid="account-logout">
            ออกจากระบบ
          </Button>
        ) : null}
      </Stack>
      <Typography variant="body2" sx={{ mb: 3 }}>
        ข้อมูลบัญชีที่ใช้เข้าระบบ · เปลี่ยนรหัสผ่านแล้วอุปกรณ์อื่นจะถูกออกจากระบบ
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "flex-start" }}>
      <Card sx={{ flex: "1 1 300px", minWidth: 0 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography component="h2" variant="h2" sx={{ mb: 2 }}>
            ข้อมูลบัญชี
          </Typography>
          {user ? (
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
              <UserAvatar userId={user.id} name={user.name} size={56} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{user.name}</Typography>
                <Typography variant="body2">{ROLE_LABEL[user.role as keyof typeof ROLE_LABEL] ?? user.role}</Typography>
              </Box>
              <Button size="small" variant="outlined" onClick={() => setAvatarOpen(true)} data-testid="account-avatar">
                เปลี่ยนรูปโปรไฟล์
              </Button>
            </Stack>
          ) : null}
          {user ? <AvatarEditorDialog open={avatarOpen} onClose={() => setAvatarOpen(false)} userId={user.id} name={user.name} mode="me" /> : null}
          {user ? (
            <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px 12px", m: 0, fontSize: 14, "& dt": { color: "text.secondary" }, "& dd": { m: 0 } }}>
              <dt>ชื่อ</dt>
              <dd>
                {user.name}
                {!required ? (
                  <Button size="small" onClick={() => void editName()} sx={{ ml: 1, minWidth: 0, py: 0 }} data-testid="account-edit-name">
                    แก้ชื่อ
                  </Button>
                ) : null}
              </dd>
              <dt>อีเมล</dt>
              <dd>{user.email}</dd>
            </Box>
          ) : null}
        </CardContent>
      </Card>
      <Card component="form" onSubmit={submit} noValidate sx={{ flex: "2 1 520px", minWidth: 0 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography component="h2" variant="h2" sx={{ mb: 2 }}>
            เปลี่ยนรหัสผ่าน
          </Typography>

          <Stack spacing={2}>
            {required ? (
              <Alert severity="warning" role="status">
                ต้องเปลี่ยนรหัสผ่านก่อนเริ่มใช้งานครั้งแรก — รหัสผ่านที่ได้รับจากผู้จัดการใช้ได้ชั่วคราวเท่านั้น
              </Alert>
            ) : null}
            {error ? (
              <Alert severity="error" role="alert">
                {error}
              </Alert>
            ) : null}
            <TextField
              id="pw-current"
              label="รหัสผ่านปัจจุบัน"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              value={form.currentPassword}
              onChange={set("currentPassword")}
              error={!!errors.currentPassword}
              helperText={errors.currentPassword ?? " "}
              disabled={busy}
            />
            <TextField
              id="pw-new"
              label="รหัสผ่านใหม่"
              type="password"
              autoComplete="new-password"
              required
              value={form.newPassword}
              onChange={set("newPassword")}
              error={!!errors.newPassword}
              helperText={errors.newPassword ?? `อย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร และต้องไม่ซ้ำรหัสผ่านเดิม`}
              disabled={busy}
            />
            <TextField
              id="pw-confirm"
              label="ยืนยันรหัสผ่านใหม่"
              type="password"
              autoComplete="new-password"
              required
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword ?? " "}
              disabled={busy}
            />
            <Stack spacing={0.5} component="ul" sx={{ listStyle: "none", p: 0, m: 0 }} aria-label="เงื่อนไขรหัสผ่าน" data-testid="pw-checklist">
              {passwordChecklist(form).map((c) => (
                <Typography
                  key={c.label}
                  component="li"
                  variant="body2"
                  sx={{ color: c.ok ? "success.dark" : c.required ? "text.primary" : "text.secondary", display: "flex", gap: 1 }}
                >
                  <span aria-hidden="true">{c.ok ? "✓" : c.required ? "○" : "–"}</span>
                  {c.label}
                </Typography>
              ))}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              เมื่อเปลี่ยนแล้ว อุปกรณ์อื่นที่เข้าสู่ระบบด้วยบัญชีนี้จะถูกออกจากระบบ
            </Typography>
            <Stack direction="row-reverse" spacing={1} justifyContent="flex-start" sx={{ pt: 2, borderTop: 1, borderColor: "divider" }}>
            <Button
              type="submit"
              variant="contained"
              disabled={busy}
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
            </Button>
            {required ? (
              <Button variant="outlined" onClick={logout} disabled={busy}>
                ออกจากระบบ
              </Button>
            ) : (
              <Button variant="outlined" onClick={() => router.back()} disabled={busy}>
                ยกเลิก
              </Button>
            )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      </Box>
    </Box>
  );
}
