"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      // AuthProvider redirects to /jobs on success
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card card card-pad" onSubmit={submit}>
        <div className="login-brand">
          WOMS<span className="dot">.</span>
        </div>
        <div className="sub" style={{ marginBottom: 16 }}>ระบบบริหารงานบริการ — เข้าสู่ระบบ</div>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="field">
          <label>อีเมล</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            placeholder="you@example.com"
            autoFocus
          />
        </div>
        <div className="field">
          <label>รหัสผ่าน</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}
