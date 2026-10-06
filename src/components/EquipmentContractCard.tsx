"use client";

// Round 8 — การ์ดสัญญาบนหน้าเครื่อง (MCH-02 / CON-04 / AT-07)
// ข้อมูลทั้งหมดดึงจากโมดูลสัญญา (GET /api/contracts/by-equipment/:id) ไม่เก็บซ้ำที่เครื่อง
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { contractQuoApi, type EquipmentContracts } from "@/lib/contractQuoApi";
import type { Contract } from "@/lib/types";
import { contractTypeLabel } from "@/lib/options";
import { ContractLifecycleBadge } from "@/components/ContractBadges";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { WomsFormSection, WomsKeyValue } from "@/components/woms";

export default function EquipmentContractCard({ equipmentId, rentalWithoutContract }: { equipmentId: string; rentalWithoutContract?: boolean }) {
  const { has } = useAuth();
  const canView = has("contracts:view");
  const [data, setData] = useState<EquipmentContracts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView) return;
    setError(null);
    try {
      setData(await contractQuoApi.byEquipment(equipmentId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลสัญญาไม่สำเร็จ");
    }
  }, [equipmentId, canView]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canView) return null;
  const active = data?.active ?? null;
  const others = (data?.contracts ?? []).filter((c) => c.id !== active?.id);

  const period = (c: Contract) => (
    <span className="mono">
      {c.startDate || "—"} – {c.endDate || "—"}
    </span>
  );

  return (
    <WomsFormSection title="สัญญาของเครื่อง">
      {error ? <Alert severity="error">{error}</Alert> : null}
      {!data && !error ? <Typography variant="body2">กำลังโหลด…</Typography> : null}
      {data && !active ? (
        <Alert severity={rentalWithoutContract ? "warning" : "info"} sx={{ mb: others.length ? 1 : 0 }}>
          {rentalWithoutContract ? "เครื่องเช่านี้ยังไม่ผูกสัญญาที่ใช้งานอยู่" : "ไม่มีสัญญาที่ใช้งานอยู่"}
        </Alert>
      ) : null}
      {active ? (
        <WomsKeyValue
          items={[
            ["เลขสัญญา", <Link key="n" href={`/contracts/${active.id}`} className="code">{active.contractNo}</Link>],
            ["ประเภท", contractTypeLabel[active.type]],
            ["ลูกค้า", active.customerName || "-"],
            ["ที่อยู่ตามสัญญา", active.siteAddressFull || "—"],
            ["ระยะเวลา", period(active)],
            [
              "สถานะ",
              <Stack key="s" direction="row" spacing={1} alignItems="center">
                <ContractLifecycleBadge lifecycle={active.lifecycle} label={active.lifecycleLabel} />
                {active.lifecycle === "EXPIRING" && active.daysToExpiry !== undefined ? (
                  <Typography variant="body2">อีก {active.daysToExpiry} วัน</Typography>
                ) : null}
              </Stack>,
            ],
            ["การชำระ", active.paymentStateLabel ?? "-"],
            active.previousContractNo ? ["ต่อจากสัญญา", active.previousContractNo] : null,
          ]}
        />
      ) : null}
      {others.length ? (
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            สัญญาอื่นของเครื่องนี้
          </Typography>
          {others.map((c) => (
            <Stack key={c.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Link href={`/contracts/${c.id}`} className="code">
                {c.contractNo}
              </Link>
              <Typography variant="body2">{contractTypeLabel[c.type]}</Typography>
              {period(c)}
              <ContractLifecycleBadge lifecycle={c.lifecycle} label={c.lifecycleLabel} />
            </Stack>
          ))}
        </Stack>
      ) : null}
    </WomsFormSection>
  );
}
