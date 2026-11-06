"use client";

// ---------------------------------------------------------------------------
// §13.3 / D10-MIG — เลือกสิทธิ์ Package ที่จะใช้ในรอบ PM นี้ รายเครื่อง
//   · แสดงเฉพาะใบงาน PM ที่ยังไม่ปิด และเครื่องที่มี Package มากกว่าหนึ่งแหล่ง หรือมีชุดที่ใช้ไม่ได้
//   · เตือนเมื่อทับช่วง · ไม่เลือก = ระบบใช้นโยบายที่ตั้งค่า (รอ D10-MIG) · ไม่ตัดสิทธิ์ตอนเลือก (ตัดครั้งเดียวตอนปิด PM)
//   · ใช้สิทธิ์ข้ามเครื่องไม่ได้ (backend ตรวจ)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { api, ApiError, type PmPackageOptions } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { JobEquipmentLine } from "@/lib/types";
import Alert from "@mui/material/Alert";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WomsFormSection } from "@/components/woms";

const REASON: Record<string, string> = { NOT_STARTED: "ยังไม่ถึงวันเริ่ม", EXPIRED: "หมดอายุ", NOT_ACTIVE: "ยังไม่เปิดสิทธิ์/ยกเลิก", NO_ROUNDS: "ใช้ครบ", PAYMENT_UNCONFIRMED: "ยังไม่ผ่านเกณฑ์ชำระ", BAD_DATE: "วันที่ไม่ครบ" };

export default function JobPackageChoicePanel({ jobId, jobType, jobStatus, lines, onChanged }: { jobId: string; jobType: string; jobStatus: string; lines: JobEquipmentLine[]; onChanged: () => void }) {
  const { has } = useAuth();
  const [opts, setOpts] = useState<Record<string, PmPackageOptions>>({});
  const [err, setErr] = useState<string | null>(null);
  const active = (jobType === "PM" || jobType === "PM_CM") && (jobStatus === "OPEN" || jobStatus === "HOLD");
  const key = lines.map((l) => l.equipmentId).join(",");
  useEffect(() => {
    if (!active) return;
    let alive = true;
    Promise.all(lines.filter((l) => l.equipmentId).map((l) => api.pmPackageOptions(l.equipmentId).then((o) => [l.equipmentId, o] as const).catch(() => null))).then((rs) => {
      if (alive) setOpts(Object.fromEntries(rs.filter(Boolean) as Array<readonly [string, PmPackageOptions]>));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);
  if (!active) return null;
  const shown = lines.filter((l) => {
    const o = opts[l.equipmentId];
    return o && (o.legacy.exists ? 1 : 0) + o.packages.length > 1;
  });
  if (!shown.length) return null;
  const canEdit = has("jobs:edit");
  const choose = async (l: JobEquipmentLine, choice: string) => {
    setErr(null);
    try {
      await api.setPackageChoice(jobId, l.id, choice);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    }
  };
  return (
    <WomsFormSection title="สิทธิ์ Package ที่ใช้ในรอบ PM นี้">
      {err ? <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert> : null}
      <Stack spacing={1.5}>
        {shown.map((l) => {
          const o = opts[l.equipmentId];
          const current = l.pmPackageChoice ?? "";
          const label = (c: string) => (c === "LEGACY" ? `ชุดเดิมบนเครื่อง (เหลือ ${o.legacy.remaining}/${o.legacy.total})` : o.packages.find((p) => p.id === c)?.packageName ?? c);
          return (
            <div key={l.id} data-testid="pkg-choice-line">
              <Typography variant="body2" fontWeight={600} className="code">{l.serial}</Typography>
              {o.overlap ? (
                <Alert severity="warning" sx={{ my: 0.5 }} data-testid="pkg-choice-overlap">
                  มี Package ใช้ได้มากกว่าหนึ่งชุดในช่วงนี้ — ระบบหักชุดเดียวเท่านั้น · ถ้าไม่เลือก ระบบใช้ “{o.policyLabel}” → {label(o.defaultChoice)} (นโยบายรออนุมัติ D10-MIG)
                </Alert>
              ) : null}
              {l.pmRoundCounted ? (
                <Typography variant="body2">ตัดสิทธิ์แล้ว: {label(l.pmPackageId || "LEGACY")}</Typography>
              ) : (
                <TextField
                  select
                  size="small"
                  fullWidth
                  label="สิทธิ์ที่ใช้"
                  value={current}
                  disabled={!canEdit}
                  onChange={(e) => choose(l, e.target.value)}
                  inputProps={{ "data-testid": "pkg-choice-select" }}
                >
                  <MenuItem value="">ตามนโยบายระบบ ({label(o.defaultChoice) || "ไม่มีสิทธิ์ที่ใช้ได้"})</MenuItem>
                  {o.legacy.exists ? (
                    <MenuItem value="LEGACY" disabled={!o.legacy.available}>
                      {label("LEGACY")}
                      {o.legacy.available ? "" : " · ใช้ครบ"}
                    </MenuItem>
                  ) : null}
                  {o.packages.map((p) => (
                    <MenuItem key={p.id} value={p.id} disabled={!p.usable}>
                      {p.packageName} · เหลือ {p.roundsRemaining} · {p.serviceStartDate || "รอกำหนด"}–{p.expiresOn || "ไม่กำหนด"}
                      {p.usable ? "" : ` · ${REASON[p.reason] ?? p.reason}`}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </div>
          );
        })}
      </Stack>
    </WomsFormSection>
  );
}
