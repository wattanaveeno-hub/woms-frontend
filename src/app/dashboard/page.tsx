"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import DashboardSummaryCard from "@/components/DashboardSummaryCard";
import type {
  EquipmentSummary,
  EquipmentDashboard,
  JobDashboard,
  Contract,
  JobListItem,
  Quotation,
  Booking,
  SalesDocument,
} from "@/lib/types";
import {
  equipmentStatusLabel,
  contractTypeLabel,
  quotationStatusLabel,
  fmtMoney,
} from "@/lib/options";
import { PmBadge, NeedsSerialBadge } from "@/components/EquipmentBadges";
import { bangkokToday } from "@/lib/date";
import { FEATURES } from "@/lib/features";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  WomsDataTable,
  WomsEmptyState,
  WomsFormSection,
  WomsLoadingState,
  WomsPageHeader,
  WomsStatCard,
  WomsStatGrid,
  type WomsColumn,
} from "@/components/woms";
import type { PmAttentionItem } from "@/lib/types";

const PALETTE = {
  accent: "#0e7c86",
  accentLight: "#5bb4ba",
  amber: "#b5730a",
  green: "#4f7a52",
  red: "#b3261e",
  slate: "#51626f",
  slate2: "#9aa7b1",
};

function loadHighcharts(): Promise<any> {
  const w = window as any;
  if (w.Highcharts) return Promise.resolve(w.Highcharts);
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("highcharts-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).Highcharts));
      existing.addEventListener("error", () => reject(new Error("LOAD_FAIL")));
      if ((window as any).Highcharts) resolve((window as any).Highcharts);
      return;
    }
    const s = document.createElement("script");
    s.id = "highcharts-js";
    s.src = "https://code.highcharts.com/highcharts.js";
    s.async = true;
    s.onload = () => resolve((window as any).Highcharts);
    s.onerror = () => reject(new Error("LOAD_FAIL"));
    document.head.appendChild(s);
  });
}

const BASE_FONT = '"Sarabun","Noto Sans Thai",sans-serif';

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const { status, has } = useAuth();
  const [hc, setHc] = useState<any>(null);
  const [hcFail, setHcFail] = useState(false);
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<EquipmentSummary | null>(null);
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [jobs, setJobs] = useState<JobListItem[] | null>(null);
  const [quotations, setQuotations] = useState<Quotation[] | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [documents, setDocuments] = useState<SalesDocument[] | null>(null);
  // สรุปฝั่งเซิร์ฟเวอร์ (Phase 8) — สถานะ PM / ประกัน / Serial คำนวณที่ backend ทั้งหมด
  const [equipDash, setEquipDash] = useState<EquipmentDashboard | null>(null);
  const [jobDash, setJobDash] = useState<JobDashboard | null>(null);

  // refs for chart containers
  const refStatus = useRef<HTMLDivElement>(null);
  const refWarranty = useRef<HTMLDivElement>(null);
  const refFinance = useRef<HTMLDivElement>(null);
  const refContractType = useRef<HTMLDivElement>(null);
  const refJobs = useRef<HTMLDivElement>(null);
  const refQuote = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHighcharts().then(setHc).catch(() => setHcFail(true));
  }, []);

  useEffect(() => {
    if (status !== "authed") return;
    let active = true;
    (async () => {
      const day = bangkokToday(); // คิววันนี้ตามวันทำงานไทย
      const [s, c, j, q, bk, doc, ed, jd] = await Promise.all([
        safe(api.equipmentSummary()),
        safe(api.listContracts({})),
        safe(api.listJobs({})),
        safe(api.listQuotations({})),
        // HIDE-01 — คิวช่างซ่อนอยู่ ไม่เรียก API คิวและไม่แสดงการ์ดคิว
        FEATURES.techQueue ? safe(api.listBookings({ from: day, to: day })) : Promise.resolve(null),
        safe(api.listDocuments({})),
        // ผู้ใช้ที่ไม่มีสิทธิ์ดูคลัง/ใบงาน จะได้ 403 → safe() คืน null → ไม่แสดงการ์ดกลุ่มนั้น
        has("equipment:view") ? safe(api.dashboardEquipment()) : Promise.resolve(null),
        has("jobs:view") ? safe(api.dashboardJobs()) : Promise.resolve(null),
      ]);
      if (!active) return;
      setEquipDash(ed);
      setJobDash(jd);
      setSummary(s);
      setContracts(c ? c.items : null);
      setJobs(j ? j.jobs : null);
      setQuotations(q ? q.items : null);
      setBookings(bk ? bk.items : null);
      setDocuments(doc ? doc.items : null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [status, has]);

  // render charts when highcharts + data ready
  useEffect(() => {
    if (!hc) return;
    hc.setOptions({
      chart: { style: { fontFamily: BASE_FONT }, backgroundColor: "transparent" },
      credits: { enabled: false },
      title: { text: undefined },
      lang: { thousandsSep: "," },
    });

    const donut = (el: HTMLDivElement, data: any[], unit = "") => {
      hc.chart(el, {
        chart: { type: "pie", height: 300 },
        tooltip: { pointFormat: "<b>{point.y:,.0f}" + unit + "</b> ({point.percentage:.0f}%)" },
        plotOptions: {
          pie: {
            innerSize: "62%",
            dataLabels: {
              enabled: true,
              distance: 14,
              style: { fontSize: "12px", fontWeight: "500", textOutline: "none", color: PALETTE.slate },
              format: "{point.name}: {point.y:,.0f}",
            },
          },
        },
        series: [{ name: "จำนวน", data }],
      });
    };

    const column = (el: HTMLDivElement, cats: string[], data: any[], unit = "") => {
      hc.chart(el, {
        chart: { type: "column", height: 300 },
        xAxis: { categories: cats, lineColor: "#cdd6dd", labels: { style: { color: PALETTE.slate } } },
        yAxis: {
          min: 0, title: { text: null }, gridLineColor: "#eef2f5",
          labels: { style: { color: PALETTE.slate2 } },
        },
        legend: { enabled: false },
        tooltip: { pointFormat: "<b>{point.y:,.0f}" + unit + "</b>" },
        plotOptions: {
          column: {
            borderRadius: 4, borderWidth: 0,
            dataLabels: { enabled: true, format: "{point.y:,.0f}", style: { textOutline: "none", color: PALETTE.slate } },
          },
        },
        series: [{ name: "จำนวน", data, colorByPoint: true }],
      });
    };

    // 1) equipment by status (donut)
    if (summary && refStatus.current) {
      const order = ["IN_STOCK", "RENTED", "SOLD", "REPAIR", "RETIRED"];
      const colors: Record<string, string> = {
        IN_STOCK: PALETTE.accentLight, RENTED: PALETTE.accent, SOLD: PALETTE.green,
        REPAIR: PALETTE.amber, RETIRED: PALETTE.slate2,
      };
      const data = order
        .map((k) => ({ name: (equipmentStatusLabel as any)[k], y: summary.byStatus[k] ?? 0, color: colors[k] }))
        .filter((d) => d.y > 0);
      donut(refStatus.current, data, " เครื่อง");
    }

    // 2) warranty health (column)
    if (summary && refWarranty.current) {
      const ok = Math.max(0, summary.total - summary.warrantyExpiring - summary.warrantyExpired);
      column(
        refWarranty.current,
        ["อยู่ในประกัน", "ใกล้หมดประกัน", "หมดประกัน"],
        [
          { y: ok, color: PALETTE.green },
          { y: summary.warrantyExpiring, color: PALETTE.amber },
          { y: summary.warrantyExpired, color: PALETTE.red },
        ],
        " เครื่อง"
      );
    }

    // 3) contract finance (donut: collected vs outstanding)
    if (contracts && refFinance.current) {
      const collected = contracts.reduce((a, c) => a + (c.paidAmount || 0), 0);
      const outstanding = contracts.reduce((a, c) => a + (c.balance || 0), 0);
      donut(
        refFinance.current,
        [
          { name: "เก็บแล้ว", y: collected, color: PALETTE.green },
          { name: "คงค้าง", y: outstanding, color: PALETTE.red },
        ],
        " บาท"
      );
    }

    // 4) contracts by type (column)
    if (contracts && refContractType.current) {
      const types = ["RENTAL", "HIRE_PURCHASE", "SALE"];
      const colors = [PALETTE.accent, PALETTE.amber, PALETTE.green];
      column(
        refContractType.current,
        types.map((t) => (contractTypeLabel as any)[t]),
        types.map((t, i) => ({ y: contracts.filter((c) => c.type === t).length, color: colors[i] }))
      );
    }

    // 5) jobs open vs closed (donut)
    if (jobs && refJobs.current) {
      const open = jobs.filter((j) => j.status === "OPEN").length;
      const closed = jobs.filter((j) => j.status === "CLOSED").length;
      donut(
        refJobs.current,
        [
          { name: "ค้าง (เปิดอยู่)", y: open, color: PALETTE.amber },
          { name: "ปิดแล้ว", y: closed, color: PALETTE.green },
        ],
        " งาน"
      );
    }

    // 6) quotations by status (column)
    if (quotations && refQuote.current) {
      const st = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"];
      const colors: Record<string, string> = {
        DRAFT: PALETTE.slate2, SENT: PALETTE.accent, ACCEPTED: PALETTE.green,
        REJECTED: PALETTE.red, EXPIRED: PALETTE.amber,
      };
      const present = st.filter((s) => quotations.some((qq) => qq.status === s));
      column(
        refQuote.current,
        present.map((s) => (quotationStatusLabel as any)[s]),
        present.map((s) => ({ y: quotations.filter((qq) => qq.status === s).length, color: colors[s] }))
      );
    }
  }, [hc, summary, contracts, jobs, quotations]);

  // KPI values
  const totalEquip = summary?.total ?? 0;
  const rented = summary?.byStatus.RENTED ?? 0;
  const warnExpire = (summary?.warrantyExpiring ?? 0) + (summary?.warrantyExpired ?? 0);
  const outstanding = contracts ? contracts.reduce((a, c) => a + (c.balance || 0), 0) : 0;
  const activeContracts = contracts ? contracts.filter((c) => c.status === "ACTIVE").length : 0;
  const openJobs = jobs ? jobs.filter((j) => j.status === "OPEN").length : 0;
  // คิววันนี้ (ไม่รวมที่ยกเลิก) และคิวที่ยังทำไม่เสร็จ
  const todayBookings = bookings ? bookings.filter((b) => b.status !== "CANCELLED") : [];
  const pendingBookings = todayBookings.filter((b) => b.status !== "DONE").length;
  // เอกสารรับเงินของเดือนนี้ (ไม่นับใบที่ถูกยกเลิก) และจำนวนใบที่ถูกยกเลิก
  // เดือนตามเวลาไทย — เดิมใช้ toISOString() (UTC) ทำให้ช่วง 00:00–06:59 น. ของวันที่ 1 ยังนับเป็นเดือนก่อน
  const month = bangkokToday().slice(0, 7);
  const monthDocs = documents
    ? documents.filter((d) => d.issueDate.startsWith(month) && d.status === "ISSUED")
    : [];
  const monthReceipts = monthDocs.filter((d) => d.type === "RECEIPT" || d.type === "TAX_INVOICE");
  const monthReceiptAmount = monthReceipts.reduce((a, d) => a + (d.netTotal || 0), 0);
  const voidedDocs = documents ? documents.filter((d) => d.status === "VOID").length : 0;

  if (status !== "authed") return null;

  const pmCols: WomsColumn<PmAttentionItem>[] = [
    {
      key: "serial",
      label: "Serial",
      render: (it) => (
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Link href={`/equipment/${it.id}`} className="code">
            {it.serial}
          </Link>
          {it.needsSerial ? <NeedsSerialBadge /> : null}
        </Stack>
      ),
    },
    { key: "model", label: "รุ่น", render: (it) => it.model || "—" },
    {
      key: "cust",
      label: "ลูกค้า / สถานที่",
      render: (it) =>
        it.customerName || it.location ? (
          <>
            {it.customerName ? <div>{it.customerName}</div> : null}
            {it.location ? <Typography variant="body2">{it.location}</Typography> : null}
          </>
        ) : (
          "—"
        ),
    },
    { key: "due", label: "ครบกำหนด", render: (it) => <span className="mono">{it.nextPmDate || "—"}</span> },
    {
      key: "status",
      label: "สถานะ",
      render: (it) => (
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <PmBadge status={it.pmStatus} />
          <Typography component="span" variant="body2">
            {it.pmDaysLeft < 0 ? `เกินมา ${Math.abs(it.pmDaysLeft)} วัน` : `เหลือ ${it.pmDaysLeft} วัน`}
          </Typography>
        </Stack>
      ),
    },
  ];

  const chart = (title: string, ref: React.RefObject<HTMLDivElement>, sub?: string) => (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Typography variant="h3" component="h3" sx={{ fontSize: 15 }}>
        {title}
      </Typography>
      {sub ? <Typography variant="body2">{sub}</Typography> : null}
      <Box ref={ref} sx={{ minHeight: 300 }} />
    </Paper>
  );

  return (
    <div>
      <WomsPageHeader title="แดชบอร์ด" subtitle="ภาพรวมระบบ" />

      {loading ? (
        <WomsLoadingState rows={4} />
      ) : (
        <>
          <WomsStatGrid max={5}>
            {summary ? (
              <>
                <WomsStatCard value={totalEquip} label="เครื่องทั้งหมด" href="/equipment" />
                <WomsStatCard value={rented} label="กำลังปล่อยเช่า" href="/equipment?status=RENTED" />
                {equipDash ? null : <WomsStatCard value={warnExpire} label="ประกันใกล้หมด/หมดแล้ว" tone="warning" />}
              </>
            ) : null}
            {equipDash ? (
              <>
                <WomsStatCard href="/equipment?warranty=EXPIRING" value={equipDash.byWarranty.EXPIRING} label="ประกันใกล้หมด" hint="ดูรายการในคลังเครื่อง" tone="warning" />
                <WomsStatCard href="/equipment?warranty=EXPIRED" value={equipDash.byWarranty.EXPIRED} label="หมดประกันแล้ว" hint="ดูรายการในคลังเครื่อง" tone="error" />
              </>
            ) : null}
            {contracts ? (
              <>
                <WomsStatCard value={fmtMoney(outstanding)} label="ยอดค้างชำระรวม (บาท)" tone="error" />
                <WomsStatCard value={activeContracts} label="สัญญาที่ใช้งานอยู่" tone="success" href="/contracts?status=ACTIVE" />
              </>
            ) : null}
            {jobDash ? (
              <WomsStatCard href="/jobs?status=OPEN" value={jobDash.open} label="งานค้าง (เปิดอยู่)" hint="เปิดรายการใบงาน" tone="warning" />
            ) : jobs ? (
              <WomsStatCard value={openJobs} label="งานค้าง (เปิดอยู่)" tone="warning" href="/jobs?status=OPEN" />
            ) : null}
            {FEATURES.techQueue && bookings ? (
              <WomsStatCard value={`${pendingBookings}/${todayBookings.length}`} label="คิววันนี้ (ยังไม่เสร็จ/ทั้งหมด)" />
            ) : null}
            {documents ? (
              <>
                <WomsStatCard value={fmtMoney(monthReceiptAmount)} label="รับเงินตามใบเสร็จเดือนนี้ (บาท)" tone="success" />
                <WomsStatCard value={voidedDocs} label="เอกสารที่ถูกยกเลิก" tone="error" />
              </>
            ) : null}
          </WomsStatGrid>

          {equipDash || jobDash ? (
            <WomsFormSection title="งานบำรุงรักษาและสิ่งที่ต้องตามต่อ">
              <Typography variant="body2" sx={{ mb: 2 }}>
                ตัวเลขทั้งหมดคำนวณจากระบบหลังบ้าน · กดที่การ์ดเพื่อเปิดรายการที่กรองไว้ให้แล้ว
              </Typography>
              <WomsStatGrid max={4}>
                {equipDash ? (
                  <>
                    <WomsStatCard href="/equipment?pmStatus=OVERDUE" value={equipDash.byPmStatus.OVERDUE} label="PM เกินกำหนด" hint="ต้องนัดเข้าทำโดยเร็ว" tone="error" />
                    <WomsStatCard href="/equipment?pmStatus=DUE_SOON" value={equipDash.byPmStatus.DUE_SOON} label="PM ใกล้ครบกำหนด" hint="ภายใน 30 วัน" tone="warning" />
                    <WomsStatCard href="/equipment?pmStatus=ON_SCHEDULE" value={equipDash.byPmStatus.ON_SCHEDULE} label="PM ตามกำหนด" tone="success" />
                    <WomsStatCard href="/equipment?pmStatus=NOT_CONFIGURED" value={equipDash.byPmStatus.NOT_CONFIGURED} label="ยังไม่ตั้งรอบ PM" hint={`จากทั้งหมด ${equipDash.total} เครื่อง`} />
                    <WomsStatCard
                      href="/equipment?serialState=TEMP"
                      value={equipDash.needsSerial}
                      label="ยังไม่มี Serial จริง"
                      hint="ต้องตามลง SN ให้ครบ"
                      tone={equipDash.needsSerial > 0 ? "warning" : "neutral"}
                    />
                    <WomsStatCard
                      href="/equipment?contractState=MISSING"
                      value={equipDash.rentalWithoutContract ?? 0}
                      label="เครื่องเช่ายังไม่ผูกสัญญา"
                      hint="ต้องผูกสัญญาจากหน้าเครื่องหรือหน้าสัญญา"
                      tone={(equipDash.rentalWithoutContract ?? 0) > 0 ? "warning" : "neutral"}
                    />
                  </>
                ) : null}
                {jobDash ? (
                  <>
                    <WomsStatCard
                      href="/jobs?status=OPEN&dateScope=OVERDUE"
                      value={jobDash.overdue}
                      label="งานเลยกำหนดนัด"
                      hint="เปิดอยู่และเลยวันนัดแล้ว"
                      tone={jobDash.overdue > 0 ? "error" : "neutral"}
                    />
                    <WomsStatCard href="/jobs?status=OPEN&dateScope=TODAY" value={jobDash.today} label="งานนัดวันนี้" hint={`ตามวันที่ระบบ ${jobDash.serverDate}`} />
                  </>
                ) : null}
              </WomsStatGrid>

              {equipDash ? (
                <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1} sx={{ mb: 1 }}>
                    <Typography variant="h3" component="h3" sx={{ fontSize: 15 }}>
                      เครื่องที่ต้องทำ PM{" "}
                      <Typography component="span" variant="body2">
                        (เกินกำหนดก่อน · แสดง {equipDash.pmAttention.length} จาก {equipDash.pmAttentionTotal})
                      </Typography>
                    </Typography>
                    {equipDash.pmAttentionTotal > 0 ? (
                      <Button
                        component={Link}
                        variant="outlined"
                        size="small"
                        href={`/equipment?pmStatus=${equipDash.byPmStatus.OVERDUE > 0 ? "OVERDUE" : "DUE_SOON"}`}
                      >
                        ดูทั้งหมด
                      </Button>
                    ) : null}
                  </Stack>
                  {equipDash.pmAttention.length === 0 ? (
                    <WomsEmptyState
                      title={
                        equipDash.byPmStatus.NOT_CONFIGURED === equipDash.total
                          ? "ยังไม่ได้ตั้งรอบ PM ให้เครื่องใดเลย — ตั้งรอบ PM ในหน้ารายละเอียดเครื่องเพื่อเริ่มติดตาม"
                          : "ไม่มีเครื่องที่เกินกำหนดหรือใกล้ครบกำหนด PM"
                      }
                    />
                  ) : (
                    <WomsDataTable
                      caption="เครื่องที่ต้องทำ PM"
                      rows={equipDash.pmAttention}
                      columns={pmCols}
                      rowKey={(it) => it.id}
                      pageSize={10}
                      renderCard={(it) => (
                        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
                          {pmCols[0].render(it)}
                          <Typography variant="body2">
                            {it.model || "—"} · {it.customerName || it.location || "—"}
                          </Typography>
                          <Box sx={{ mt: 0.5 }}>{pmCols[4].render(it)}</Box>
                        </Box>
                      )}
                    />
                  )}
                </Box>
              ) : null}
            </WomsFormSection>
          ) : null}

          {hcFail ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              โหลดกราฟไม่สำเร็จ (ต้องต่ออินเทอร์เน็ตเพื่อโหลด Highcharts) — ตัวเลขสรุปด้านบนยังแสดงได้ปกติ
            </Alert>
          ) : null}

          {/* โหลด Highcharts ไม่ได้ → ไม่แสดงกรอบกราฟเปล่า ๆ (ข้อความเตือนด้านบนบอกเหตุผลแล้ว) */}
          <Box sx={{ display: hcFail ? "none" : "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2, mb: 2 }}>
            {summary ? chart("สถานะเครื่อง", refStatus) : null}
            {summary ? chart("สุขภาพประกัน", refWarranty) : null}
            {contracts ? chart("การเงินสัญญา", refFinance, "เก็บแล้ว vs คงค้าง (รวมทุกสัญญา)") : null}
            {contracts ? chart("สัญญาตามประเภท", refContractType) : null}
            {jobs ? chart("งานบริการ", refJobs) : null}
            {quotations && quotations.length > 0 ? chart("ใบเสนอราคาตามสถานะ", refQuote) : null}
          </Box>
          <DashboardSummaryCard />
        </>
      )}
    </div>
  );
}
