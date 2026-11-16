"use client";

// ---------------------------------------------------------------------------
// CR-DS01 (CF v1.1 §9 · AC17) — Dashboard Sales (อ่านอย่างเดียว)
//   นับเครื่องจริงไม่ซ้ำ · เช่า/ขาย/เช่า-ซื้อ แยกกัน · เครื่องลูกค้าภายนอกและ "เครื่องที่ต้องการ" เป็นการ์ดแยก
//   สัญญาเช่าใกล้หมด 3 เดือน · งาน HOLD / ส่งเครื่องแล้วรอติดตั้ง · ป้าย "รอยืนยัน D05" จนกว่า Owner อนุมัติขอบเขตและชื่อการ์ด
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from "react";
import { fmtDate } from "@/lib/date";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
// รายการ "ควรตามวันนี้" — สร้างจากข้อมูลเดิมของ Dashboard Sales เท่านั้น
const RED = { bgcolor: "#fbeceb", color: "#b3261e" };
const AMBER = { bgcolor: "#fdf3e2", color: "#8a5606" };
const BLUE = { bgcolor: "#e6f1f8", color: "#0b6aa2" };
function followItems(data: any, canContracts = false): { icon: string; tone: object; title: string; sub: string; href?: string; action: string }[] {
  const out: { icon: string; tone: object; title: string; sub: string; href?: string; action: string }[] = [];
  for (const r of data?.rentals ?? []) {
    if (r.expired) out.push({ icon: "!", tone: RED, title: `${r.customerName} สัญญาเช่าเลยกำหนด`, sub: `${r.contractNo} · ${r.serial} · สิ้นสุด ${r.endDate || "-"}`, href: canContracts && (r.contractId || r.id) ? `/contracts/${r.contractId || r.id}` : undefined, action: "ดูสัญญา" });
    else if (r.expiringSoon) out.push({ icon: "CT", tone: AMBER, title: `${r.customerName} สัญญาเช่าใกล้หมด`, sub: `${r.contractNo} · ${r.serial} · สิ้นสุด ${r.endDate || "-"}`, href: canContracts && (r.contractId || r.id) ? `/contracts/${r.contractId || r.id}` : undefined, action: "ดูสัญญา" });
  }
  for (const j of data?.followJobs ?? []) {
    const hold = j.status === "HOLD";
    out.push({
      icon: hold ? "JN" : "SN",
      tone: hold ? AMBER : BLUE,
      title: `${j.customerName || j.jobName}: ${hold ? "งานพัก" : "ส่งเครื่องแล้วรอติดตั้ง"}`,
      sub: hold ? `${j.jobId} · ${j.holdReason || "-"}${j.followUpDate ? ` · ติดตาม ${fmtDate(j.followUpDate)}` : ""}` : `${j.jobId} · ${(j.deliveredNotInstalled ?? []).map((x: any) => x.serial).join(", ")}`,
      href: j.queueId ? `/service-queue/${j.queueId}` : `/jobs/${encodeURIComponent(j.jobId)}`,
      action: j.queueId ? "คิว/แชท" : "ดูงาน",
    });
  }
  return out;
}

const CLS_LABEL: Record<string, string> = { RENTAL: "เช่า", SALE: "ขาย/ซื้อ", HIRE_PURCHASE: "เช่า-ซื้อ", UNSPECIFIED: "ยังไม่ระบุ", EXTERNAL: "ภายนอก" };

export default function SalesDashboardPage() {
  const { has, user } = useAuth();
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
      {/* Phase 7 (ENTECH design "DashboardSales"): ทักทาย + จำนวนเรื่องที่ควรตาม · รายการ "ควรตามวันนี้" จากข้อมูลเดิมของหน้านี้
          (สัญญาใกล้หมด/เลยกำหนด · งานพัก · ส่งเครื่องแล้วรอติดตั้ง) — ไม่เพิ่มข้อมูลเงิน/ใบเสนอราคา (เซลล์ไม่มีสิทธิ์ตาม Matrix) */}
      <WomsPageHeader
        title={data ? `สวัสดีคุณ${user?.name ?? ""} — มี ${followItems(data, has("contracts:view")).length} เรื่องที่ควรตาม` : "Dashboard Sales"}
        subtitle="มุมมองเซลล์ · อ่านอย่างเดียว · ไม่แสดงจำนวนเงิน"
      />
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: "wrap", rowGap: 1 }}>
        <TextField select size="small" label="ขอบเขต" value={scope} onChange={(e) => setScope(e.target.value as any)} sx={{ minWidth: 200 }} inputProps={{ "data-testid": "sd-scope" }}>
          <MenuItem value="OWN">ลูกค้า/สาขาที่ฉันรับผิดชอบ</MenuItem>
          <MenuItem value="TEAM">ทีมของฉัน</MenuItem>
          {admin ? <MenuItem value="ALL">ทั้งหมด</MenuItem> : null}
        </TextField>
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
          <Paper variant="outlined" sx={{ mb: 2 }} data-testid="sd-follow-list">
            <Typography component="h2" variant="h6" sx={{ px: 2.5, pt: 2, pb: 1 }}>
              ควรตามวันนี้
            </Typography>
            {followItems(data, has("contracts:view")).length === 0 ? (
              <Typography variant="body2" sx={{ px: 2.5, pb: 2 }}>
                ไม่มีเรื่องที่ต้องตามในขอบเขตนี้
              </Typography>
            ) : (
              followItems(data, has("contracts:view")).map((it, i) => (
                <Stack key={i} direction="row" spacing={1.5} alignItems="center" sx={{ px: 2.5, py: 1.25, borderTop: 1, borderColor: "divider" }} data-testid="sd-follow-item">
                  <Box sx={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flex: "none", ...it.tone }}>{it.icon}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>{it.title}</Typography>
                    <Typography variant="body2">{it.sub}</Typography>
                  </Box>
                  {it.href ? (
                    <Button size="small" variant="outlined" component={Link} href={it.href}>
                      {it.action}
                    </Button>
                  ) : null}
                </Stack>
              ))
            )}
          </Paper>
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
                <span className="code">{r.contractNo}</span> · {r.customerName} · {r.serial} · สิ้นสุด {fmtDate(r.endDate || "-")}{" "}
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
