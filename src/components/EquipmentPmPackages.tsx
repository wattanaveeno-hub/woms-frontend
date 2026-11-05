"use client";
// CR-PK01 P4 — ชุด Package PM ของเครื่อง (แยกชุด · ไม่แชร์ข้ามเครื่อง) + ประวัติการใช้สิทธิ์ (อ่านอย่างเดียว)
//   เปิดสิทธิ์ชุดที่รอเปิดยังทำไม่ได้ (รอเกณฑ์การชำระ FIN-R10-03) — backend ปฏิเสธเสมอ
import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { api, type PmPackageItem, type PmPackageLedgerItem } from "@/lib/api";
import { WomsFormSection, WomsStatusChip } from "@/components/woms";
import type { StatusTone } from "@/components/woms/WomsStatusChip";

const TONE: Record<PmPackageItem["displayStatus"], StatusTone> = {
  PENDING_ACTIVATION: "warning",
  ACTIVE: "success",
  EXHAUSTED: "neutral",
  EXPIRED: "neutral",
  CANCELLED: "error",
};

export default function EquipmentPmPackages({ equipmentId }: { equipmentId: string }) {
  const [items, setItems] = useState<PmPackageItem[] | null>(null);
  const [ledger, setLedger] = useState<PmPackageLedgerItem[]>([]);
  useEffect(() => {
    let alive = true;
    api
      .pmPackages(equipmentId)
      .then((r) => {
        if (!alive) return;
        setItems(r.items);
        setLedger(r.ledger);
      })
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [equipmentId]);
  if (!items || !items.length) return null;
  const nameOf = (id: string) => items.find((p) => p.id === id)?.packageName ?? "-";
  return (
    <WomsFormSection title="ชุด Package PM ของเครื่อง">
      {items.some((p) => p.displayStatus === "PENDING_ACTIVATION") ? (
        <Alert severity="info" sx={{ mb: 1.5 }} data-testid="pm-package-pending-note">
          ชุดที่รอเปิดสิทธิ์ยังใช้ทำ PM ฟรีไม่ได้ — รอเกณฑ์การชำระที่ใช้เปิดสิทธิ์ (FIN-R10-03) · การแนบสลิปไม่เปิดสิทธิ์เอง
        </Alert>
      ) : null}
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" aria-label="ชุด Package PM">
          <TableHead>
            <TableRow>
              <TableCell>Package</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell>ใช้ / ทั้งหมด</TableCell>
              <TableCell>คงเหลือ</TableCell>
              <TableCell>ทุก (เดือน)</TableCell>
              <TableCell>เริ่ม / หมดอายุ</TableCell>
              <TableCell>ที่มา</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id} data-testid="pm-package-row">
                <TableCell>{p.packageName}</TableCell>
                <TableCell>
                  <WomsStatusChip label={p.displayStatusLabel} tone={TONE[p.displayStatus]} />
                </TableCell>
                <TableCell className="mono">
                  {p.roundsUsed}/{p.roundsTotal}
                </TableCell>
                <TableCell className="mono">{p.roundsRemaining}</TableCell>
                <TableCell>{p.intervalMonths || "-"}</TableCell>
                <TableCell className="mono">
                  {p.serviceStartDate || "รอกำหนด"} / {p.expiresOn || (p.termMonths ? `${p.termMonths} เดือนหลังเริ่ม` : "-")}
                </TableCell>
                <TableCell>
                  {p.source.kind === "QUOTATION_LINE" && p.source.quotationId ? (
                    <Link href={`/quotations/${p.source.quotationId}`}>
                      {p.source.quotationNo} Rev.{p.source.revision} บรรทัด {p.source.lineNo}
                    </Link>
                  ) : p.source.jobId ? (
                    <Link href={`/jobs/${p.source.jobId}`}>งานติดตั้ง {p.source.jobId}</Link>
                  ) : (
                    "-"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Typography variant="subtitle2" sx={{ mt: 2 }}>
        ประวัติการใช้สิทธิ์
      </Typography>
      {ledger.length ? (
        ledger.map((e) => (
          <Typography key={e.id} variant="body2" data-testid="pm-package-ledger-row">
            {e.serviceDate || e.at.slice(0, 10)} · {e.kind === "USE" ? "ใช้ 1 ครั้ง" : `${e.kind} ${e.rounds}`} · {nameOf(e.packageId)}
            {e.jobId ? (
              <>
                {" · "}
                <Link href={`/jobs/${e.jobId}`}>{e.jobId}</Link>
              </>
            ) : null}
          </Typography>
        ))
      ) : (
        <Typography variant="caption" color="text.secondary">
          ยังไม่มีการใช้สิทธิ์จากชุดเหล่านี้
        </Typography>
      )}
    </WomsFormSection>
  );
}
