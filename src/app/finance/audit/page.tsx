"use client";

// D-11 Financial Workflow v1.0 หัวข้อ 5/6 — ประวัติการเงิน (ผู้ดำเนินการ วันเวลา การกระทำ ข้อมูลก่อน–หลัง และเหตุผล)
import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ApiError } from "@/lib/api";
import { bangkokDateTime } from "@/lib/date";
import { roleLabel } from "@/lib/auditOptions";
import { financeApi, type FinAuditRow } from "@/lib/financeApi";
import { WomsEmptyState, WomsErrorState, WomsFilterPanel, WomsLoadingState, WomsPageHeader, WomsSearchBar } from "@/components/woms";
import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";

const ENTITY_LABEL: Record<string, string> = { quotation_payments: "รายการรับเงิน", accounting_documents: "เอกสารบัญชี" };

function AuditInner() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<FinAuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await financeApi.audit(q.trim())).items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [q]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <>
      <WomsPageHeader title="ประวัติการเงิน" subtitle="บันทึกทุกการเปลี่ยนสถานะรายการรับเงินและเอกสารบัญชี — แก้/ลบไม่ได้" />
      <WomsFilterPanel search={<WomsSearchBar value={q} onChange={setQ} placeholder="เลขรายการ / เลขใบเสนอราคา / เลขเอกสาร" />} activeCount={0} onClear={() => setQ("")} />
      {error ? <WomsErrorState message={error} onRetry={load} /> : null}
      {!items && !error ? <WomsLoadingState rows={6} /> : null}
      {items && !items.length ? <WomsEmptyState title="ยังไม่มีประวัติการเงิน" /> : null}
      <Stack spacing={1}>
        {(items ?? []).map((h) => (
          <Box key={h.id} sx={{ borderBottom: 1, borderColor: "divider", pb: 0.75 }} data-testid="fin-audit-row">
            <Typography variant="body2">
              <span className="mono">{bangkokDateTime(h.at)}</span> · {h.actorName} ({roleLabel(h.actorRole)}) · {ENTITY_LABEL[h.entity] ?? h.entity} <span className="code">{h.entityLabel}</span>
            </Typography>
            <Typography variant="body2" sx={{ color: "text.primary" }}>
              {h.summary}
            </Typography>
            {h.changes.slice(0, 10).map((c, i) => (
              <Typography key={i} variant="caption" component="div" className="mono">
                {c.field}: {c.before || "—"} → {c.after || "—"}
              </Typography>
            ))}
          </Box>
        ))}
      </Stack>
    </>
  );
}

export default function FinanceAuditPage() {
  return (
    <WomsPermissionGate perm="finance:view">
      <AuditInner />
    </WomsPermissionGate>
  );
}
