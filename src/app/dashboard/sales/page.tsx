"use client";

// ---------------------------------------------------------------------------
// CR-DS01 (CF v1.1 §9 · AC17) — Dashboard Sales (อ่านอย่างเดียว)
//   นับเครื่องจริงไม่ซ้ำ · เช่า/ขาย/เช่า-ซื้อ แยกกัน · เครื่องลูกค้าภายนอกและ "เครื่องที่ต้องการ" เป็นการ์ดแยก
//   สัญญาเช่าใกล้หมด 3 เดือน · งาน HOLD / ส่งเครื่องแล้วรอติดตั้ง · ป้าย "รอยืนยัน D05" จนกว่า Owner อนุมัติขอบเขตและชื่อการ์ด
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WomsErrorState, WomsFormSection, WomsLoadingState, WomsPageHeader, WomsStatCard } from "@/components/woms";

const CARDS: Array<{ key: string; label: string }> = [
  { key: "total", label: "เครื่องทั้งหมด" },
  { key: "RENTAL", label: "เช่า" },
  { key: "SALE", label: "ขาย/ซื้อ" },
  { key: "HIRE_PURCHASE", label: "เช่า-ซื้อ" },
  { key: "UNSPECIFIED", label: "ยังไม่ระบุประเภท" },
  { key: "external", label: "เครื่องลูกค้าภายนอก" },
  { key: "requested", label: "เครื่องที่ต้องการ (ยังไม่จัด)" },
  { key: "expiringContracts", label: "สัญญาเช่าใกล้หมด (3 เดือน)" },
];
const CLS_LABEL: Record<string, string> = { RENTAL: "เช่า", SALE: "ขาย/ซื้อ", HIRE_PURCHASE: "เช่า-ซื้อ", UNSPECIFIED: "ยังไม่ระบุ", EXTERNAL: "ภายนอก" };

export default function SalesDashboardPage() {
  const { has } = useAuth();
  const admin = has("svcqueue:admin");
  const [scope, setScope] = useState<"OWN" | "TEAM" | "ALL">(admin ? "ALL" : "OWN");
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    setData(null);
    try {
      setData(await api.salesDashboard(scope));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลด Dashboard ไม่สำเร็จ");
    }
  }, [scope]);
  useEffect(() => {
    void load();
  }, [load]);

  const machines = (data?.machines ?? []).filter((m: any) => {
    if (!filter) return true;
    if (filter === "total") return m.cls !== "EXTERNAL";
    if (filter === "external") return m.cls === "EXTERNAL";
    return m.cls === filter;
  });

  return (
    <>
      <WomsPageHeader title="Dashboard Sales" subtitle="เครื่องและสัญญาเช่าตามลูกค้า/สาขาที่รับผิดชอบ — อ่านอย่างเดียว" />
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: "wrap", rowGap: 1 }}>
        <TextField select size="small" label="ขอบเขต" value={scope} onChange={(e) => setScope(e.target.value as any)} sx={{ minWidth: 200 }} inputProps={{ "data-testid": "sd-scope" }}>
          <MenuItem value="OWN">ลูกค้า/สาขาที่ฉันรับผิดชอบ</MenuItem>
          <MenuItem value="TEAM">ทีมของฉัน</MenuItem>
          {admin ? <MenuItem value="ALL">ทั้งหมด</MenuItem> : null}
        </TextField>
        <Chip color="warning" label="ชื่อการ์ดและขอบเขตรอยืนยัน (D05)" data-testid="sd-d05" />
      </Stack>
      {err ? <WomsErrorState message={err} onRetry={load} /> : null}
      {!data && !err ? <WomsLoadingState /> : null}
      {data ? (
        <>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5} sx={{ mb: 2 }}>
            {CARDS.map((c) => (
              <WomsStatCard
                key={c.key}
                label={c.label}
                value={data.counts?.[c.key] ?? 0}
                onClick={() => setFilter(filter === c.key ? "" : c.key)}
                active={filter === c.key}
              />
            ))}
          </Stack>
          {filter === "requested" ? (
            <Alert severity="info" sx={{ mb: 2 }}>เครื่องที่ต้องการในคิวที่ยังไม่จัดเครื่องจริง — ไม่นับเป็นเครื่องจริง ({data.counts.requested} เครื่องที่ต้องการ)</Alert>
          ) : filter === "expiringContracts" ? null : (
            <WomsFormSection title={`เครื่อง (${machines.length})`}>
              <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: "100%", overflowX: "auto" }}>
                <Table size="small" aria-label="เครื่องในขอบเขต">
                  <TableHead>
                    <TableRow>
                      <TableCell>SN</TableCell>
                      <TableCell>รุ่น</TableCell>
                      <TableCell>ลูกค้า</TableCell>
                      <TableCell>ประเภท</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {machines.map((m: any) => (
                      <TableRow key={m.equipmentId} data-testid="sd-machine-row">
                        <TableCell className="code">
                          <Link href={`/equipment/${m.equipmentId}`}>{m.serial}</Link>
                          {m.pendingSerial ? <Chip size="small" color="warning" label="Pending Serial" sx={{ ml: 0.5 }} /> : null}
                        </TableCell>
                        <TableCell>{m.model}</TableCell>
                        <TableCell>{m.customerName || "-"}</TableCell>
                        <TableCell>{CLS_LABEL[m.cls] ?? m.cls}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </WomsFormSection>
          )}
          <WomsFormSection title={`สัญญาเช่า (${data.rentals?.length ?? 0})`}>
            {(data.rentals ?? []).map((r: any) => (
              <Typography key={r.contractNo} variant="body2" data-testid="sd-rental">
                <span className="code">{r.contractNo}</span> · {r.customerName} · {r.serial} · สิ้นสุด {r.endDate || "-"}{" "}
                {r.expiringSoon ? <Chip size="small" color="warning" label="ใกล้หมดสัญญา" /> : r.expired ? <Chip size="small" color="error" label="เลยกำหนด" /> : null}
              </Typography>
            ))}
          </WomsFormSection>
          <WomsFormSection title={`งานพัก / ส่งเครื่องแล้วรอติดตั้ง (${data.followJobs?.length ?? 0})`}>
            {(data.followJobs ?? []).map((j: any) => (
              <Typography key={j.jobId} variant="body2" data-testid="sd-follow">
                <Link href={`/jobs/${encodeURIComponent(j.jobId)}`}>{j.jobId}</Link> · {j.customerName || j.jobName} ·{" "}
                {j.status === "HOLD" ? `พักงาน: ${j.holdReason}${j.followUpDate ? ` · ติดตาม ${j.followUpDate}` : ""}` : `ส่งแล้วรอติดตั้ง ${j.deliveredNotInstalled.map((x: any) => x.serial).join(", ")}`}
                {j.queueId ? <> · <Link href={`/service-queue/${j.queueId}`}>คิว/แชท</Link></> : null}
              </Typography>
            ))}
          </WomsFormSection>
        </>
      ) : null}
    </>
  );
}
