"use client";

// ---------------------------------------------------------------------------
// รายรับ / รายจ่าย / ผลต่างสุทธิ ของเครื่องหนึ่งเครื่อง
// ---------------------------------------------------------------------------
// ที่มา: ชีตหลัก "รวบรวมรายรับ รายจ่าย … เพื่อคำนวณผลต่างรายรับและรายจ่ายสุทธิของเครื่องได้"
// ทุกยอดมีแหล่งที่มากำกับ และแหล่งที่ปันส่วนลงรายเครื่องไม่ได้จะถูกแสดงว่า "ไม่รวม" พร้อมเหตุผล

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { EquipmentFinance } from "@/lib/types";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  WomsDataTable,
  WomsErrorState,
  WomsFormSection,
  WomsLoadingState,
  WomsStatCard,
  type WomsColumn,
} from "@/components/woms";

type FinanceLine = EquipmentFinance["lines"][number] & { _i: number };

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export default function EquipmentFinanceCard({ equipmentId }: { equipmentId: string }) {
  const [data, setData] = useState<EquipmentFinance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api.equipmentFinance(equipmentId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลรายรับ/รายจ่ายไม่สำเร็จ");
    }
  }, [equipmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const title = "รายรับ / รายจ่ายของเครื่องนี้";
  if (error)
    return (
      <WomsFormSection title={title}>
        <WomsErrorState message={error} onRetry={load} />
      </WomsFormSection>
    );
  if (!data)
    return (
      <WomsFormSection title={title}>
        <WomsLoadingState rows={2} />
      </WomsFormSection>
    );

  const ref = (l: FinanceLine) =>
    l.source === "JOB" || l.source === "PARTS" ? <Link href={`/jobs/${l.ref}`}>{l.ref}</Link> : l.ref;
  const lineCols: WomsColumn<FinanceLine>[] = [
    { key: "date", label: "วันที่", sortValue: (l) => l.date || "", render: (l) => <span className="mono">{l.date || "—"}</span> },
    { key: "src", label: "แหล่ง", sortValue: (l) => l.sourceLabel, render: (l) => l.sourceLabel },
    { key: "ref", label: "อ้างอิง", render: (l) => <span className="mono">{ref(l)}</span> },
    { key: "desc", label: "รายละเอียด", render: (l) => l.description },
    { key: "rev", label: "รายรับ", align: "right", sortValue: (l) => l.revenue, render: (l) => <span className="mono">{l.revenue ? baht(l.revenue) : "—"}</span> },
    { key: "cost", label: "รายจ่าย", align: "right", sortValue: (l) => l.cost, render: (l) => <span className="mono">{l.cost ? baht(l.cost) : "—"}</span> },
  ];

  return (
    <WomsFormSection title={title}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.5, mb: 2 }}>
        <WomsStatCard value={baht(data.revenueTotal)} label="รายรับรวม" />
        <WomsStatCard value={baht(data.costTotal)} label="รายจ่ายรวม" />
        <WomsStatCard value={baht(data.net)} label="ผลต่างสุทธิ" tone={data.net < 0 ? "error" : "neutral"} />
      </Box>

      {data.bySource.length > 0 ? (
        <Table size="small" sx={{ mb: 2 }} aria-label="สรุปตามแหล่งที่มา">
          <TableHead>
            <TableRow>
              <TableCell>แหล่งที่มา</TableCell>
              <TableCell align="right">รายรับ</TableCell>
              <TableCell align="right">รายจ่าย</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.bySource.map((b) => (
              <TableRow key={b.source}>
                <TableCell>{b.label}</TableCell>
                <TableCell align="right" className="mono">{baht(b.revenue)}</TableCell>
                <TableCell align="right" className="mono">{baht(b.cost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      {data.lines.length === 0 ? (
        <Typography variant="body2">ยังไม่มีรายการรายรับ/รายจ่ายของเครื่องนี้</Typography>
      ) : (
        <Accordion variant="outlined" disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>รายการทั้งหมด ({data.lines.length})</AccordionSummary>
          <AccordionDetails>
            <WomsDataTable
              caption="รายการรายรับรายจ่าย"
              rows={data.lines.map((l, i) => ({ ...l, _i: i }))}
              columns={lineCols}
              rowKey={(l) => String(l._i)}
              pageSize={10}
              renderCard={(l) => (
                <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
                  <Typography variant="body2">
                    <span className="mono">{l.date || "—"}</span> · {l.sourceLabel} · <span className="mono">{ref(l)}</span>
                  </Typography>
                  <Typography sx={{ color: "text.primary" }}>{l.description}</Typography>
                  <Typography variant="body2">
                    รายรับ {l.revenue ? baht(l.revenue) : "—"} · รายจ่าย {l.cost ? baht(l.cost) : "—"}
                  </Typography>
                </Box>
              )}
            />
          </AccordionDetails>
        </Accordion>
      )}

      {data.excluded.length > 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          <AlertTitle>แหล่งที่ไม่ได้นำมารวม (ตั้งใจ)</AlertTitle>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {data.excluded.map((x, i) => (
              <li key={i}>
                <strong>{x.source}</strong> — {x.reason}
              </li>
            ))}
          </Box>
        </Alert>
      ) : null}
    </WomsFormSection>
  );
}
