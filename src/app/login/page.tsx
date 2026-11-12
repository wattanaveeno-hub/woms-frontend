"use client";

// หน้าเข้าสู่ระบบ (Redesign 12 พ.ย. 69) — แผงแบรนด์ด้านซ้าย + ฟอร์มด้านขวา · มือถือแสดงเฉพาะฟอร์มพร้อมโลโก้
//   บอกชื่อระบบชัด · ช่องใหญ่กดง่าย · ปุ่มแสดงรหัสผ่าน · จำอีเมลไว้ในเครื่อง (ไม่เก็บรหัสผ่าน) · บอกวิธีขอรีเซ็ตรหัส
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/AuthContext";
import { ApiError } from "@/lib/api";

const REMEMBER_KEY = "entech.loginEmail";
const LOGO = "/contract/entech-logo.png";

function readRemembered(): string {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) ?? "";
  } catch {
    return "";
  }
}
function writeRemembered(email: string | null) {
  try {
    if (email) window.localStorage.setItem(REMEMBER_KEY, email);
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* เบราว์เซอร์ปิด storage — ไม่จำ ไม่ขวางการเข้าสู่ระบบ */
  }
}

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const saved = readRemembered();
    if (saved) setEmail(saved);
  }, []);

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
      writeRemembered(remember ? email.trim() : null);
      // AuthProvider redirects on success
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", minHeight: "100vh", bgcolor: "#ffffff" }}>
      {/* แผงแบรนด์ — ซ่อนบนจอเล็กเพื่อให้ฟอร์มอยู่บนสุด */}
      <Box
        component="aside"
        aria-label="ENTECH"
        sx={{
          flex: "1 1 420px",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 5,
          bgcolor: "#16202b",
          color: "#ffffff",
          px: 8,
          py: 7,
        }}
      >
        <Box sx={{ alignSelf: "flex-start", bgcolor: "#ffffff", borderRadius: 2, px: 2, py: 1.25 }}>
          <Box component="img" src={LOGO} alt="ENTECH" sx={{ display: "block", height: 36, width: "auto" }} />
        </Box>
        <Stack spacing={2} sx={{ maxWidth: 460 }}>
          <Typography component="p" sx={{ fontSize: 40, lineHeight: 1.2, fontWeight: 700, color: "#ffffff" }}>
            ระบบเปิด–ปิดงาน
            <br />
            ภาคสนาม
          </Typography>
          <Typography sx={{ fontSize: 18, color: "#c5d0d8" }}>
            จัดคิวช่าง ติดตามงานติดตั้ง PM และซ่อมเครื่องกรองน้ำ ในที่เดียว
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="flex-end" aria-hidden="true">
          <Box sx={{ width: 96, height: 24, borderRadius: 2, bgcolor: "#1b5e37" }} />
          <Box sx={{ width: 48, height: 24, borderRadius: 2, bgcolor: "#b5730a" }} />
          <Box sx={{ width: 152, height: 24, borderRadius: 2, bgcolor: "#e1f1e4" }} />
        </Stack>
      </Box>

      <Box
        sx={{
          flex: "1 1 420px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 3,
          py: { xs: 5, md: 6 },
        }}
      >
        <Box component="form" onSubmit={submit} noValidate sx={{ width: "100%", maxWidth: 380 }}>
          <Stack spacing={2.5}>
            <Box component="img" src={LOGO} alt="ENTECH" sx={{ display: { xs: "block", md: "none" }, height: 36, width: "auto", alignSelf: "flex-start" }} />
            <Box>
              <Typography component="h1" sx={{ fontSize: 26, fontWeight: 700, color: "text.primary" }}>
                เข้าสู่ระบบ
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, fontSize: 15 }}>
                ใช้อีเมลที่ผู้ดูแลระบบลงทะเบียนให้
              </Typography>
            </Box>

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
              inputMode="email"
              placeholder="you@entech.co.th"
              autoFocus={!email}
              error={emailMissing}
              helperText={emailMissing ? "กรุณากรอกอีเมล" : " "}
              disabled={busy}
              inputProps={{ style: { fontSize: 16, minHeight: 28 } }}
            />
            <TextField
              label="รหัสผ่าน"
              type={showPw ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus={!!email}
              error={pwMissing}
              helperText={pwMissing ? "กรุณากรอกรหัสผ่าน" : " "}
              disabled={busy}
              inputProps={{ style: { fontSize: 16, minHeight: 28 } }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      size="small"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                      aria-pressed={showPw}
                      sx={{ minWidth: 56, fontWeight: 600 }}
                    >
                      {showPw ? "ซ่อน" : "แสดง"}
                    </Button>
                  </InputAdornment>
                ),
              }}
            />
            <FormControlLabel
              control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
              label="จำอีเมลไว้ในเครื่องนี้"
              sx={{ mt: -1 }}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={busy}
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : null}
              sx={{ minHeight: 52, fontSize: 17, fontWeight: 700 }}
            >
              {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </Button>
            <Typography variant="body2">ลืมรหัสผ่าน? แจ้งผู้ดูแลระบบของบริษัทให้ตั้งรหัสใหม่ให้</Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
