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
import { api, ApiError } from "@/lib/api";
import {
  PASSWORD_MIN_LENGTH,
  validateChangePassword,
  type ChangePasswordErrors,
  type ChangePasswordForm,
} from "@/lib/passwordRules";

const EMPTY: ChangePasswordForm = { currentPassword: "", newPassword: "", confirmPassword: "" };

export default function ChangePasswordPage() {
  const { user, applySession, logout } = useAuth();
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
    <Box sx={{ minHeight: "70vh", display: "grid", placeItems: "center", px: 2, py: 4 }}>
      <Card component="form" onSubmit={submit} noValidate sx={{ width: "100%", maxWidth: 420 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography component="h1" variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            เปลี่ยนรหัสผ่าน
          </Typography>
          {user ? (
            <Typography variant="body2" sx={{ mb: 2 }}>
              {user.name} ({user.email})
            </Typography>
          ) : null}

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
            <Typography variant="body2" color="text.secondary">
              เมื่อเปลี่ยนแล้ว อุปกรณ์อื่นที่เข้าสู่ระบบด้วยบัญชีนี้จะถูกออกจากระบบ
            </Typography>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={busy}
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
            </Button>
            {required ? (
              <Button variant="text" color="secondary" onClick={logout} disabled={busy}>
                ออกจากระบบ
              </Button>
            ) : (
              <Button variant="text" color="secondary" onClick={() => router.back()} disabled={busy}>
                ยกเลิก
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
