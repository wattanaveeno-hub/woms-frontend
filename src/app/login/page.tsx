"use client";

// หน้าเข้าสู่ระบบ (Redesign 12 พ.ย. 69) — แผงแบรนด์ด้านซ้าย + ฟอร์มด้านขวา · มือถือแสดงเฉพาะฟอร์มพร้อมโลโก้
//   บอกชื่อระบบชัด · ช่องใหญ่กดง่าย · ปุ่มแสดงรหัสผ่าน · จำอีเมลไว้ในเครื่อง (ไม่เก็บรหัสผ่าน) · บอกวิธีขอรีเซ็ตรหัส
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/AuthContext";
import { ApiError } from "@/lib/api";

const REMEMBER_KEY = "entech.loginEmail";
const LOGO = "/contract/entech-logo.png";
const LOGO_REVERSE = "/brand/entech-logo-reverse.png";
// ตาม Login.dc.html: ป้ายอยู่เหนือช่อง · ช่องสูง 48 มุม 10
const LAB = { fontSize: 14, fontWeight: 600, color: "#2e3f4f" } as const;
const ERR = { fontSize: 13, fontWeight: 600, color: "#b3261e" } as const;
const inputSx = (err: boolean) => ({
  minHeight: 48,
  px: "14px",
  border: `1px solid ${err ? "#b3261e" : "#cdd6dd"}`,
  borderRadius: "10px",
  bgcolor: "#fff",
  font: "inherit",
  fontSize: 16,
  color: "#16202b",
  width: "100%",
  boxSizing: "border-box" as const,
  outline: "none",
  "&:focus": { borderColor: "#1b5e37", boxShadow: "0 0 0 3px rgba(27,94,55,.18)" },
  "&:disabled": { bgcolor: "#eef2f5" },
});

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
        <Box component="img" src={LOGO_REVERSE} alt="ENTECH" sx={{ display: "block", height: 48, width: "auto", alignSelf: "flex-start" }} />
        <Stack spacing={2} sx={{ maxWidth: 460 }}>
          <Typography component="p" sx={{ fontSize: 40, lineHeight: 1.2, fontWeight: 700, color: "#ffffff" }}>
            ระบบเปิด–ปิดงาน
            <Box component="span" sx={{ whiteSpace: "nowrap" }}>
              ภาคสนาม
            </Box>
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
              <Typography sx={{ mt: 0.5, fontSize: 15, color: "#51626f" }}>
                ใช้อีเมล หรือเบอร์โทรที่ผู้ดูแลระบบลงทะเบียนให้
              </Typography>
            </Box>

            {error ? (
              <Alert severity="error" role="alert">
                {error}
              </Alert>
            ) : null}

            <Box sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <Box component="label" htmlFor="login-email" sx={LAB}>
                อีเมล หรือเบอร์โทร
              </Box>
              <Box
                component="input"
                id="login-email"
                // UAT2-04: รับเบอร์โทรได้ด้วย จึงไม่ใช้ type="email" (เบราว์เซอร์จะบล็อกเบอร์โทร)
                type="text"
                required
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@entech.co.th หรือ 0812345678"
                autoFocus={!email}
                disabled={busy}
                aria-invalid={emailMissing || undefined}
                aria-describedby={emailMissing ? "login-email-err" : undefined}
                sx={inputSx(emailMissing)}
              />
              {emailMissing ? (
                <Box id="login-email-err" sx={ERR}>
                  กรุณากรอกอีเมลหรือเบอร์โทร
                </Box>
              ) : null}
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <Box component="label" htmlFor="login-password" sx={LAB}>
                รหัสผ่าน
              </Box>
              <Box sx={{ position: "relative" }}>
                <Box
                  component="input"
                  id="login-password"
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus={!!email}
                  disabled={busy}
                  aria-invalid={pwMissing || undefined}
                  aria-describedby={pwMissing ? "login-password-err" : undefined}
                  sx={{ ...inputSx(pwMissing), pr: "64px" }}
                />
                <Box
                  component="button"
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  aria-pressed={showPw}
                  sx={{
                    position: "absolute",
                    right: 4,
                    top: 4,
                    minHeight: 40,
                    px: 1.5,
                    border: 0,
                    bgcolor: "transparent",
                    font: "inherit",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#14432a",
                    cursor: "pointer",
                    borderRadius: "8px",
                    "&:hover": { bgcolor: "#eef2f5" },
                  }}
                >
                  {showPw ? "ซ่อน" : "แสดง"}
                </Box>
              </Box>
              {pwMissing ? (
                <Box id="login-password-err" sx={ERR}>
                  กรุณากรอกรหัสผ่าน
                </Box>
              ) : null}
            </Box>
            <Box component="label" sx={{ display: "flex", gap: "10px", alignItems: "center", fontSize: 15, cursor: "pointer" }}>
              <Box
                component="input"
                type="checkbox"
                checked={remember}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemember(e.target.checked)}
                sx={{ width: 20, height: 20, accentColor: "#1b5e37", m: 0 }}
              />
              จำอีเมลไว้ในเครื่องนี้
            </Box>
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={busy}
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : null}
              disableElevation
              sx={{ minHeight: 52, fontSize: 17, fontWeight: 700, borderRadius: "10px" }}
            >
              {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </Button>
            <Typography sx={{ fontSize: 14, color: "#51626f" }}>ลืมรหัสผ่าน? แจ้งผู้ดูแลระบบของบริษัทให้ตั้งรหัสใหม่ให้</Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
