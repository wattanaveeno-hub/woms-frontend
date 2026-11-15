"use client";

// ---------------------------------------------------------------------------
// BD-10 — วางบิลของฉัน (มือถือช่าง · ENTECH design "MBills")
//   ใช้ API บิลเดิมทั้งหมด: รายการ GET /api/bills (backend คืนเฉพาะบิลของช่างเอง) · สร้าง/แก้ร่าง/เซ็นส่ง/ยืนยันรับเงิน
//   ทำที่หน้าบิลเดิม (/bills/new, /bills/[id]) ซึ่งตรวจสิทธิ์ TB-02/TB-03/TB-13 อยู่แล้ว
//   ช่างไม่มีปุ่มอนุมัติ/ออกเอกสารบัญชี/แก้ยอดหลังส่ง (ไม่มีสิทธิ์ตาม Matrix TB-04..TB-11 และ backend ตอบ 403)
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { fmtMoney } from "@/lib/options";
import type { TechBill } from "@/lib/types";
import { MOBILE_BILL_TABS, filterMobileBills, mobileBillAction, mobileBillGroup, mobileBillSummary, type MobileBillTab } from "@/lib/mobileBills";
import { WomsCountTabs, WomsEmptyState, WomsErrorState, WomsLoadingState, WomsPermissionGate, WomsStatusChip, type StatusTone } from "@/components/woms";

const toneOf = (status: string): StatusTone => {
  const g = mobileBillGroup(status);
  return g === "returned" ? "error" : g === "review" ? "info" : g === "approved" ? "success" : "neutral";
};

function MobileBillsInner() {
  const { has } = useAuth();
  const [bills, setBills] = useState<TechBill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<MobileBillTab>("all");

  const load = useCallback(() => {
    setError(null);
    api
      .listBills()
      .then((r) => setBills(r.items))
      .catch((e) => setError(e instanceof ApiError ? e.message : "โหลดบิลไม่สำเร็จ"));
  }, []);
  useEffect(load, [load]);

  const summary = useMemo(() => mobileBillSummary(bills ?? []), [bills]);
  const rows = useMemo(() => filterMobileBills(bills ?? [], tab), [bills, tab]);

  return (
    <Stack spacing={2} sx={{ maxWidth: 560, mx: "auto", pb: 10 }} data-testid="m-bills">
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          วางบิลของฉัน
        </Typography>
        {has("bill:create") ? (
          <Button component={Link} href="/bills/new" variant="contained" startIcon={<AddIcon />} data-testid="m-bills-new">
            สร้างบิล
          </Button>
        ) : null}
      </Stack>

      {error ? (
        <WomsErrorState message={error} onRetry={load} />
      ) : !bills ? (
        <WomsLoadingState rows={3} />
      ) : (
        <>
          <Box sx={{ bgcolor: "#16202b", color: "#fff", borderRadius: 2, p: 2 }} data-testid="m-bills-summary">
            <Typography variant="body2" sx={{ color: "#c5d0d8" }}>
              ยอดที่ส่งวางบิลแล้ว (รอตรวจ + อนุมัติ)
            </Typography>
            <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(summary.total)}</Typography>
            <Typography variant="body2" sx={{ color: "#c5d0d8" }}>
              อนุมัติแล้ว {fmtMoney(summary.approved)} · รอตรวจ {fmtMoney(summary.review)}
            </Typography>
          </Box>

          <WomsCountTabs
            ariaLabel="สถานะบิล"
            value={tab}
            onChange={setTab}
            tabs={MOBILE_BILL_TABS.map((t) => ({ value: t.value, label: t.label, count: summary.counts[t.value] }))}
          />

          {rows.length === 0 ? (
            <WomsEmptyState title="ไม่มีบิลในสถานะนี้" description={tab === "all" ? "กด สร้างบิล เพื่อรวมงานที่ปิดแล้วเป็นบิลรอบนี้" : undefined} />
          ) : (
            <Stack spacing={1.25}>
              {rows.map((b) => {
                const action = mobileBillAction(b.status);
                const urgent = mobileBillGroup(b.status) === "returned";
                return (
                  <Card key={b.id} variant="outlined" sx={urgent ? { borderColor: "#e6c4c1", bgcolor: "#fbeceb" } : undefined} data-testid="m-bill-row">
                    <CardActionArea component={Link} href={`/bills/${encodeURIComponent(b.id)}`}>
                      <CardContent sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, color: urgent ? "error.main" : "text.primary" }}>{action || b.billNo}</Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            <span className="mono">{b.billNo}</span> · {b.periodFrom}
                            {b.periodTo && b.periodTo !== b.periodFrom ? `–${b.periodTo}` : ""} · {b.totals.jobCount} งาน
                          </Typography>
                          {b.reviewNote && urgent ? (
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              ผู้ตรวจ: {b.reviewNote}
                            </Typography>
                          ) : null}
                          <Box sx={{ mt: 0.5 }}>
                            <WomsStatusChip label={b.statusLabel} tone={toneOf(b.status)} />
                          </Box>
                        </Box>
                        <Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMoney(b.totals.grandTotal)}</Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                );
              })}
            </Stack>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            เปิดบิลเพื่อตรวจรายการ เซ็นชื่อและส่งวางบิล · การอนุมัติทำโดยผู้ตรวจบิล
          </Typography>
        </>
      )}
    </Stack>
  );
}

export default function MobileBillsPage() {
  return (
    <WomsPermissionGate perm="bill:view">
      <MobileBillsInner />
    </WomsPermissionGate>
  );
}
