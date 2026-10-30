"use client";

// D-11 FIN-11 — ดูสถานะการเงินจากใบงานที่เกี่ยวข้อง (อ่านอย่างเดียว ไม่เปลี่ยนสถานะงาน)
// การยืนยันเงินไม่ถือว่าปิดงาน และไม่บังคับชำระก่อนเปิด JN — การ์ดนี้แสดงข้อมูลเท่านั้น
import { useEffect, useState } from "react";
import Link from "next/link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/AuthContext";
import { fmtMoney } from "@/lib/options";
import { financeApi, type FinanceRow } from "@/lib/financeApi";
import { WomsFormSection } from "@/components/woms";
import { AggStateChip } from "./FinParts";

export default function JobFinanceCard({ jobId }: { jobId: string }) {
  const { has } = useAuth();
  const allowed = has("finance:view");
  const [items, setItems] = useState<FinanceRow[] | null>(null);
  useEffect(() => {
    if (!allowed) return;
    financeApi
      .jobSummary(jobId)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [jobId, allowed]);
  if (!allowed || !items) return null;
  return (
    <WomsFormSection title="สถานะการเงิน (ใบเสนอราคาที่ผูกกับงานนี้)">
      <div data-testid="job-finance">
        {items.length === 0 ? <Typography variant="body2">ไม่มีใบเสนอราคาที่ผูกกับใบงานนี้</Typography> : null}
        {items.map((r) => (
          <Stack key={r.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            <Link href={`/quotations/${r.id}?tab=payments`} className="code">
              {r.quotationNo}
            </Link>
            <Typography variant="body2">
              ต้องชำระ {fmtMoney(r.summary.amountDue)} · ยืนยันแล้ว {fmtMoney(r.summary.verifiedTotal)} · คงเหลือ {fmtMoney(r.summary.outstanding)}
            </Typography>
            <AggStateChip summary={r.summary} />
          </Stack>
        ))}
        <Typography variant="caption">สถานะการเงินแยกจากสถานะงาน — การยืนยันรับเงินไม่ปิดงาน</Typography>
      </div>
    </WomsFormSection>
  );
}
