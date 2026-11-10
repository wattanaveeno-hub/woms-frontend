"use client";

// ---------------------------------------------------------------------------
// Service Margin รายเครื่อง (MAR-01..03 / BR-10.6 / BR-10.7)
// ---------------------------------------------------------------------------
// รายรับ = ติดตั้ง (ราคาค่าติดตั้งจาก Model Index − ส่วนลดรายเครื่อง) + QUO ที่ตอบรับแล้ว
// owner decision 30 ต.ค. 69: ราคาค่าติดตั้งยังไม่ยืนยันกับลูกค้า (ADV3-01) → แถบเตือน + ป้ายทุกบรรทัด · ไม่มีราคา = แจ้งชัดเจน ไม่ใช่ 0
//   รายการเดิมคิดจาก Model Index ปัจจุบัน (ป้าย "ข้อมูลเดิม") · ต้นทุนมาตรฐาน (Equipment Model Master) แสดงแยกเป็นค่าอ้างอิง
//   เฉพาะผู้มีสิทธิ์ดูต้นทุน — ไม่รวมในรายจ่าย/Margin
// รายจ่าย = ค่าบริการช่างของเครื่อง + ส่วนแบ่งค่าใช้จ่ายร่วมของใบงาน + อะไหล่รายเครื่อง
// ไม่รวมราคาขาย/ต้นทุนซื้อเครื่องและงวดสัญญา (MAR-03)
// ทุกยอดมีแหล่งที่มา · แหล่งที่ยังคิดไม่ได้แสดงเป็น "ไม่รวม" / "รอยืนยัน" พร้อมเหตุผล
// ช่างไม่มีสิทธิ์ contracts:view → ไม่แสดงการ์ดนี้ (backend ตอบ 403 อยู่แล้ว)

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { marginApi, type ServiceMargin as EquipmentFinance } from "@/lib/billsApi";
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
import Chip from "@mui/material/Chip";
import { INSTALL_CHARGE_UNVERIFIED_LABEL, MISSING_INSTALL_CHARGE, STANDARD_COST_NOT_IN_PROFIT } from "@/lib/installPrice";
import { assumptionText, costBasisText, toUserText } from "@/lib/financeText";
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
  const { has } = useAuth();
  if (!has("contracts:view")) return null;
  return <FinanceCardInner equipmentId={equipmentId} />;
}

function FinanceCardInner({ equipmentId }: { equipmentId: string }) {
  const [data, setData] = useState<EquipmentFinance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await marginApi.get(equipmentId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลรายรับ/รายจ่ายไม่สำเร็จ");
    }
  }, [equipmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const title = "Service Margin ของเครื่องนี้";
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
    l.billId ? (
      <Link href={`/bills/${l.billId}`}>{l.ref}</Link>
    ) : l.jobId ? (
      <Link href={`/jobs/${l.jobId}`}>{l.ref}</Link>
    ) : (
      l.ref
    );
  const incomplete = data.revenueComplete === false;
  const hasInstall = data.lines.some((l) => l.source === "INSTALL") || (data.installChargeIssues?.length ?? 0) > 0;
  // profitVerified = false เมื่อยอดรวมรายรับติดตั้งที่ยังไม่ยืนยัน
  const unverified = data.profitVerified === false;
  const costRefs = data.standardCostReferences ?? [];
  const lineCols: WomsColumn<FinanceLine>[] = [
    { key: "date", label: "วันที่", sortValue: (l) => l.date || "", render: (l) => <span className="mono">{l.date || "—"}</span> },
    {
      key: "src",
      label: "แหล่ง",
      sortValue: (l) => l.sourceLabel,
      render: (l) => (
        <>
          {toUserText(l.sourceLabel)}
          {l.pricing === "LEGACY_MODEL_INDEX" ? <Chip size="small" label="ข้อมูลเดิม" variant="outlined" sx={{ ml: 0.5 }} data-testid="margin-legacy-chip" /> : null}
          {l.pricing === "MODEL_INDEX_UNCAPTURED" ? (
            <Chip size="small" color="warning" label="ยังไม่ได้บันทึกราคาลงรายการ" variant="outlined" sx={{ ml: 0.5 }} data-testid="margin-uncaptured-chip" />
          ) : null}
          {l.source === "INSTALL" && l.verified === false ? (
            <Chip size="small" color="warning" variant="outlined" label={INSTALL_CHARGE_UNVERIFIED_LABEL} sx={{ ml: 0.5 }} data-testid="margin-unverified-chip" />
          ) : null}
        </>
      ),
    },
    { key: "ref", label: "อ้างอิง", render: (l) => <span className="mono">{ref(l)}</span> },
    { key: "desc", label: "รายละเอียด", render: (l) => toUserText(l.description) },
    { key: "rev", label: "รายรับ", align: "right", sortValue: (l) => l.revenue, render: (l) => <span className="mono">{l.revenue ? baht(l.revenue) : "—"}</span> },
    { key: "cost", label: "รายจ่าย", align: "right", sortValue: (l) => l.cost, render: (l) => <span className="mono">{l.cost ? baht(l.cost) : "—"}</span> },
  ];

  return (
    <WomsFormSection title={title}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.5, mb: 2 }}>
        <WomsStatCard
          // รายรับติดตั้งยังขาดราคา → ไม่แสดงยอดรวมเสมือนเป็นตัวเลขจริง (ไม่ให้อ่าน 0 เป็นรายรับ)
          value={incomplete ? (data.revenueTotal ? `${baht(data.revenueTotal)} (ไม่ครบ)` : "—") : baht(data.revenueTotal)}
          label="รายรับบริการสุทธิ"
          hint={
            incomplete
              ? `ไม่ครบ — ${MISSING_INSTALL_CHARGE} ${data.installChargeIssues?.length ?? 0} เครื่อง`
              : unverified
                ? `รวมรายรับติดตั้งที่${INSTALL_CHARGE_UNVERIFIED_LABEL}`
                : undefined
          }
          tone={incomplete ? "error" : unverified ? "warning" : "neutral"}
        />
        <WomsStatCard
          value={baht(data.costTotal)}
          label="รายจ่ายบริการ"
          hint={data.pending && data.pending.costTotal ? `ยังไม่นับยอดรอ ${baht(data.pending.costTotal)} บาท (บิลยังไม่อนุมัติ)` : undefined}
        />
        <WomsStatCard
          value={incomplete ? "—" : `${baht(data.net)}${unverified ? " (ประมาณการ)" : ""}`}
          label="Service Margin"
          hint={incomplete ? "คิดไม่ได้จนกว่าจะมีราคาค่าติดตั้งครบ" : unverified ? "ตัวเลขประมาณการ — ราคาค่าติดตั้งของรุ่นนี้ยังไม่อนุมัติ" : undefined}
          tone={incomplete || unverified ? "warning" : data.net < 0 ? "error" : "neutral"}
        />
      </Box>
      {data.installChargeVerified === false && hasInstall ? (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="margin-install-unverified">
          <AlertTitle>{INSTALL_CHARGE_UNVERIFIED_LABEL}</AlertTitle>
          ราคาค่าติดตั้งที่ใช้คำนวณยังไม่ได้รับการยืนยันจากลูกค้า รายรับและ Service Margin ที่รวมรายการนี้จึงเป็นตัวเลขเบื้องต้น
        </Alert>
      ) : null}
      {data.installChargeIssues && data.installChargeIssues.length > 0 ? (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="margin-install-charge-missing">
          <AlertTitle>{MISSING_INSTALL_CHARGE}</AlertTitle>
          รายรับติดตั้งของเครื่องต่อไปนี้ยังไม่ถูกนับ (ไม่ได้คิดเป็น 0) — ผู้ดูแลข้อมูลตั้งราคาค่าติดตั้งของรุ่นได้ที่{" "}
          <Link href="/master">ข้อมูลพื้นฐาน › รุ่นเครื่อง</Link>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {data.installChargeIssues.map((x) => (
              <li key={x.lineId}>
                <Link href={`/jobs/${x.jobId}`}>{x.jobId}</Link> · {x.serial} · {x.model || "-"} — {x.message}
              </li>
            ))}
          </Box>
        </Alert>
      ) : null}
      {costRefs.length > 0 ? (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="margin-standard-cost-ref">
          <AlertTitle>ต้นทุนมาตรฐาน (ค่าอ้างอิง)</AlertTitle>
          {STANDARD_COST_NOT_IN_PROFIT}
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {costRefs.map((c) => (
              <li key={c.lineId}>
                <Link href={`/jobs/${c.jobId}`}>{c.jobId}</Link> · {c.model || "-"} — ต้นทุนมาตรฐาน{" "}
                <span className="mono">{typeof c.standardCost === "number" ? `${baht(c.standardCost)} บาท` : "ยังไม่มีค่าที่อนุมัติ"}</span>
                {c.actualPartsCost ? (
                  <>
                    {" "}· ต้นทุนอะไหล่จริงที่บันทึก <span className="mono">{baht(c.actualPartsCost)} บาท</span>
                  </>
                ) : null}
                {c.legacyAlias ? " (ข้อมูลเดิม)" : ""}
              </li>
            ))}
          </Box>
        </Alert>
      ) : null}

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
                <TableCell>{toUserText(b.label)}</TableCell>
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
                    <span className="mono">{l.date || "—"}</span> · {toUserText(l.sourceLabel)} · <span className="mono">{ref(l)}</span>
                  </Typography>
                  <Typography sx={{ color: "text.primary" }}>{toUserText(l.description)}</Typography>
                  <Typography variant="body2">
                    รายรับ {l.revenue ? baht(l.revenue) : "—"} · รายจ่าย {l.cost ? baht(l.cost) : "—"}
                  </Typography>
                </Box>
              )}
            />
          </AccordionDetails>
        </Accordion>
      )}

      {data.pending && data.pending.lines.length > 0 ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <AlertTitle>ยอดรอ — บิลช่างที่ยังไม่อนุมัติ (ยังไม่นับในรายจ่าย)</AlertTitle>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {data.pending.lines.map((l, i) => (
              <li key={i}>
                {l.billId ? <Link href={`/bills/${l.billId}`}>{l.ref}</Link> : l.ref} · {toUserText(l.sourceLabel)} · {toUserText(l.description)} —{" "}
                <span className="mono">{baht(l.cost)}</span>
              </li>
            ))}
          </Box>
        </Alert>
      ) : null}

      {/* วิธีคำนวณและข้อจำกัด — ย่อไว้ · ไม่มีรหัสอ้างอิงภายใน · คำเตือนที่กระทบตัวเลขของเครื่องนี้แสดงด้านบนเสมอ */}
      <Accordion variant="outlined" disableGutters sx={{ mt: 2 }} data-testid="margin-details">
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          วิธีคำนวณและข้อจำกัด
          {data.blocked && data.blocked.length > 0 ? ` · ${data.blocked.length} รายการยังไม่นำมาคิด` : ""}
        </AccordionSummary>
        <AccordionDetails>
          {data.basis ? (
            <Typography variant="body2" sx={{ mb: 1.5 }} data-testid="margin-basis">
              <strong>การนับรายจ่าย:</strong> {costBasisText(data.basis.recognizedStatuses)}
            </Typography>
          ) : null}
          {data.blocked && data.blocked.length > 0 ? (
            <Box sx={{ mb: 1.5 }} data-testid="margin-blocked">
              <Typography variant="body2" sx={{ fontWeight: 700 }}>ยังไม่นำมาคิด</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {data.blocked.map((b, i) => (
                  <li key={i}>
                    <Typography variant="body2">
                      <strong>{toUserText(b.item)}</strong> — {toUserText(b.note)}
                    </Typography>
                  </li>
                ))}
              </Box>
            </Box>
          ) : null}
          {data.excluded.length > 0 ? (
            <Box sx={{ mb: 1.5 }} data-testid="margin-excluded">
              <Typography variant="body2" sx={{ fontWeight: 700 }}>ไม่ได้นำมารวม</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {data.excluded.map((x, i) => (
                  <li key={i}>
                    <Typography variant="body2">
                      <strong>{toUserText(x.source)}</strong> — {toUserText(x.reason)}
                    </Typography>
                  </li>
                ))}
              </Box>
            </Box>
          ) : null}
          {data.assumptions && data.assumptions.length > 0 ? (
            <Box data-testid="margin-assumptions">
              <Typography variant="body2" sx={{ fontWeight: 700 }}>หลักการคำนวณ</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {data.assumptions.map((a, i) => (
                  <li key={i}>
                    <Typography variant="body2">{assumptionText(a)}</Typography>
                  </li>
                ))}
              </Box>
            </Box>
          ) : null}
        </AccordionDetails>
      </Accordion>
    </WomsFormSection>
  );
}
