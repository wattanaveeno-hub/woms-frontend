"use client";

// FB-14 — Admin เรียกดูลายเซ็นผู้ทำรายการ: ใครลงนาม (User ID/ชื่อ) เมื่อใด ครอบคลุมข้อมูลชุดใด
// ข้อมูลที่ลงนามเป็น snapshot + hash (ตรวจว่าข้อมูลไม่ถูกแก้) · ยอดที่ปรับภายหลังไม่ถือว่าลายเซ็นเดิมรับรอง
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { request } from "@/lib/api";
import { bangkokDateTime } from "@/lib/date";
import { WomsFormSection } from "@/components/woms";

export interface SignoffView {
  signoffId: string;
  kind: "JOB_CLOSE" | "BILL_SUBMIT";
  kindLabel: string;
  refNo: string;
  userId: string;
  userName: string;
  userRole: string;
  signedAt: string;
  signature: string;
  coverage: Record<string, any>;
  coverageHash: string;
  intact: boolean;
}

const baht = (n: unknown) => (Number(n) || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });

function coverageText(s: SignoffView): string {
  const c = s.coverage ?? {};
  if (s.kind === "JOB_CLOSE") {
    const ms = Array.isArray(c.machines) ? c.machines : [];
    return `ใบงาน ${c.jobId} · ${ms.length} เครื่อง${ms.length ? ` (${ms.map((m: any) => m.serial).join(", ")})` : ""}${c.closeNote ? ` · สรุป: ${c.closeNote}` : ""}`;
  }
  const items = Array.isArray(c.machineItems) && c.machineItems.length ? c.machineItems : Array.isArray(c.items) ? c.items : [];
  const jobs = new Set(items.map((i: any) => i.jobId));
  return `ชุดวางบิล ${c.billNo} · ${jobs.size} ใบงาน · ${items.length} รายการ · ยอดที่เสนอ ${baht(c.grandTotal)} บาท`;
}

export default function SignoffList({
  refType,
  refId,
  currentTotal,
}: {
  refType: "jobs" | "tech_bills";
  refId: string;
  /** ยอดปัจจุบันของบิล — ถ้าต่างจากยอดที่ลงนาม แสดงว่าลายเซ็นไม่ได้รับรองยอดที่ถูกแก้ */
  currentTotal?: number;
}) {
  const [items, setItems] = useState<SignoffView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    request<{ items: SignoffView[] }>(`/api/signoffs?refType=${refType}&refId=${encodeURIComponent(refId)}`)
      .then((r) => alive && setItems(r.items))
      .catch(() => alive && (setErr("โหลดลายเซ็นไม่สำเร็จ"), setItems([])));
    return () => {
      alive = false;
    };
  }, [refType, refId]);
  if (!items || (!items.length && !err)) return null;
  return (
    <WomsFormSection title="ลายเซ็นผู้ทำรายการ">
      {err ? <Alert severity="error">{err}</Alert> : null}
      <Stack spacing={1.5}>
        {items.map((s) => {
          const signedTotal = Number(s.coverage?.grandTotal);
          const changed = s.kind === "BILL_SUBMIT" && currentTotal !== undefined && Number.isFinite(signedTotal) && signedTotal !== currentTotal;
          return (
            <Box key={s.signoffId} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }} data-testid="signoff-row">
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.signature} alt={`ลายเซ็น ${s.userName}`} style={{ width: 180, height: 60, objectFit: "contain", background: "#fff", border: "1px solid #ddd" }} />
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
                    <Chip size="small" label={s.kindLabel} />
                    <Typography sx={{ fontWeight: 600 }}>{s.userName}</Typography>
                    <Typography variant="caption" className="mono">
                      User ID {s.userId} · {s.userRole}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" className="mono">
                    ลงนามเมื่อ {bangkokDateTime(s.signedAt)}
                  </Typography>
                  <Typography variant="body2">{coverageText(s)}</Typography>
                  <Typography variant="caption" color={s.intact ? "text.secondary" : "error"}>
                    {s.intact ? "ข้อมูลที่ลงนามตรงกับที่บันทึกไว้ (hash ถูกต้อง)" : "ข้อมูลที่ลงนามไม่ตรงกับ hash — ตรวจสอบ Audit Log"}
                  </Typography>
                  {changed ? (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      ยอดที่ช่างเสนอและลงนาม {baht(signedTotal)} บาท ต่างจากยอดปัจจุบัน {baht(currentTotal)} บาท (ผู้ตรวจปรับราคา) —
                      ลายเซ็นนี้รับรองเฉพาะยอดที่เสนอ ณ เวลาลงนาม ไม่ได้รับรองยอดที่ถูกแก้ไข
                    </Alert>
                  ) : null}
                </Box>
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </WomsFormSection>
  );
}
