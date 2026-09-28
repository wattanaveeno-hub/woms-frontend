"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useAuth } from "@/lib/AuthContext";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const emailMissing = touched && !email.trim();
  const pwMissing = touched && !password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setTouched(true);
    if (!email.trim() || !password) return; // ค่าที่กรอกไว้ยังอยู่ครบ
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      // AuthProvider redirects on success
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: "80vh", display: "grid", placeItems: "center", px: 2, py: 4 }}>
      <Card component="form" onSubmit={submit} noValidate sx={{ width: "100%", maxWidth: 400 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography component="h1" sx={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.04em" }}>
            WOMS<Box component="span" sx={{ color: "primary.main" }}>.</Box>
          </Typography>
          <Typography variant="body2" sx={{ mb: 3 }}>
            ระบบบริหารงานบริการ — เข้าสู่ระบบ
          </Typography>

          <Stack spacing={2}>
            {error ? (
              <Alert severity="error" role="alert">
                {error}
              </Alert>
            ) : null}
            <TextField
              label="อีเมล"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="you@example.com"
              autoFocus
              error={emailMissing}
              helperText={emailMissing ? "กรุณากรอกอีเมล" : " "}
              disabled={busy}
            />
            <TextField
              label="รหัสผ่าน"
              type={showPw ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              error={pwMissing}
              helperText={pwMissing ? "กรุณากรอกรหัสผ่าน" : " "}
              disabled={busy}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                      onClick={() => setShowPw((v) => !v)}
                      edge="end"
                    >
                      {showPw ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={busy}
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
