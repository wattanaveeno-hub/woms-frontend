"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
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

/** การ์ด KPI ที่คลิกแล้วไปยังหน้ารายการพร้อมตัวกรองที่ตรงกัน */
function KpiLink({
  href,
  value,
  label,
  sub,
  tone,
}: {
  href: string;
  value: React.ReactNode;
  label: string;
  sub?: string;
  tone?: "amber" | "green" | "red";
}) {
  return (
    <Link href={href} className={`kpi kpi-link${tone ? " " + tone : ""}`}>
      <div className="kpi-num">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
    </Link>
  );
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
      const day = new Date().toISOString().slice(0, 10);
      const [s, c, j, q, bk, doc, ed, jd] = await Promise.all([
        safe(api.equipmentSummary()),
        safe(api.listContracts({})),
        safe(api.listJobs({})),
        safe(api.listQuotations({})),
        safe(api.listBookings({ from: day, to: day })),
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
  const month = new Date().toISOString().slice(0, 7);
  const monthDocs = documents
    ? documents.filter((d) => d.issueDate.startsWith(month) && d.status === "ISSUED")
    : [];
  const monthReceipts = monthDocs.filter((d) => d.type === "RECEIPT" || d.type === "TAX_INVOICE");
  const monthReceiptAmount = monthReceipts.reduce((a, d) => a + (d.netTotal || 0), 0);
  const voidedDocs = documents ? documents.filter((d) => d.status === "VOID").length : 0;

  if (status !== "authed") return null;

  return (
    <div>
      <div className="page-head">
        <h1>แดชบอร์ด</h1>
        <span className="sub">ภาพรวมระบบ</span>
      </div>

      {loading ? (
        <div className="state">กำลังโหลดข้อมูล…</div>
      ) : (
        <>
          <div className="kpi-grid">
            {summary ? (
              <>
                <div className="kpi">
                  <div className="kpi-num">{totalEquip}</div>
                  <div className="kpi-label">เครื่องทั้งหมด</div>
                </div>
                <div className="kpi">
                  <div className="kpi-num">{rented}</div>
                  <div className="kpi-label">กำลังปล่อยเช่า</div>
                </div>
                {equipDash ? null : (
                  <div className="kpi amber">
                    <div className="kpi-num">{warnExpire}</div>
                    <div className="kpi-label">ประกันใกล้หมด/หมดแล้ว</div>
                  </div>
                )}
              </>
            ) : null}
            {equipDash ? (
              <>
                <KpiLink
                  href="/equipment?warranty=EXPIRING"
                  value={equipDash.byWarranty.EXPIRING}
                  label="ประกันใกล้หมด"
                  sub="ดูรายการในคลังเครื่อง"
                  tone="amber"
                />
                <KpiLink
                  href="/equipment?warranty=EXPIRED"
                  value={equipDash.byWarranty.EXPIRED}
                  label="หมดประกันแล้ว"
                  sub="ดูรายการในคลังเครื่อง"
                  tone="red"
                />
              </>
            ) : null}
            {contracts ? (
              <>
                <div className="kpi red">
                  <div className="kpi-num">{fmtMoney(outstanding)}</div>
                  <div className="kpi-label">ยอดค้างชำระรวม (บาท)</div>
                </div>
                <div className="kpi green">
                  <div className="kpi-num">{activeContracts}</div>
                  <div className="kpi-label">สัญญาที่ใช้งานอยู่</div>
                </div>
              </>
            ) : null}
            {jobDash ? (
              <KpiLink
                href="/jobs?status=OPEN"
                value={jobDash.open}
                label="งานค้าง (เปิดอยู่)"
                sub="เปิดรายการใบงาน"
                tone="amber"
              />
            ) : jobs ? (
              <div className="kpi amber">
                <div className="kpi-num">{openJobs}</div>
                <div className="kpi-label">งานค้าง (เปิดอยู่)</div>
              </div>
            ) : null}
            {bookings ? (
              <div className="kpi">
                <div className="kpi-num">
                  {pendingBookings}/{todayBookings.length}
                </div>
                <div className="kpi-label">คิววันนี้ (ยังไม่เสร็จ/ทั้งหมด)</div>
              </div>
            ) : null}
            {documents ? (
              <>
                <div className="kpi green">
                  <div className="kpi-num">{fmtMoney(monthReceiptAmount)}</div>
                  <div className="kpi-label">รับเงินตามใบเสร็จเดือนนี้ (บาท)</div>
                </div>
                <div className="kpi red">
                  <div className="kpi-num">{voidedDocs}</div>
                  <div className="kpi-label">เอกสารที่ถูกยกเลิก</div>
                </div>
              </>
            ) : null}
          </div>

          {equipDash || jobDash ? (
            <div className="card card-pad" style={{ marginBottom: 22 }}>
              <div className="toolbar" style={{ marginTop: 0, justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>งานบำรุงรักษาและสิ่งที่ต้องตามต่อ</h2>
                <span className="sub">
                  ตัวเลขทั้งหมดคำนวณจากระบบหลังบ้าน · กดที่การ์ดเพื่อเปิดรายการที่กรองไว้ให้แล้ว
                </span>
              </div>

              <div className="kpi-grid" style={{ marginTop: 14, marginBottom: 0 }}>
                {equipDash ? (
                  <>
                    <KpiLink
                      href="/equipment?pmStatus=OVERDUE"
                      value={equipDash.byPmStatus.OVERDUE}
                      label="PM เกินกำหนด"
                      sub="ต้องนัดเข้าทำโดยเร็ว"
                      tone="red"
                    />
                    <KpiLink
                      href="/equipment?pmStatus=DUE_SOON"
                      value={equipDash.byPmStatus.DUE_SOON}
                      label="PM ใกล้ครบกำหนด"
                      sub="ภายใน 30 วัน"
                      tone="amber"
                    />
                    <KpiLink
                      href="/equipment?pmStatus=ON_SCHEDULE"
                      value={equipDash.byPmStatus.ON_SCHEDULE}
                      label="PM ตามกำหนด"
                      tone="green"
                    />
                    <KpiLink
                      href="/equipment?pmStatus=NOT_CONFIGURED"
                      value={equipDash.byPmStatus.NOT_CONFIGURED}
                      label="ยังไม่ตั้งรอบ PM"
                      sub={`จากทั้งหมด ${equipDash.total} เครื่อง`}
                    />
                    <KpiLink
                      href="/equipment?serialState=TEMP"
                      value={equipDash.needsSerial}
                      label="ยังไม่มี Serial จริง"
                      sub="ต้องตามลง SN ให้ครบ"
                      tone={equipDash.needsSerial > 0 ? "amber" : undefined}
                    />
                  </>
                ) : null}
                {jobDash ? (
                  <>
                    <KpiLink
                      href="/jobs?status=OPEN&dateScope=OVERDUE"
                      value={jobDash.overdue}
                      label="งานเลยกำหนดนัด"
                      sub="เปิดอยู่และเลยวันนัดแล้ว"
                      tone={jobDash.overdue > 0 ? "red" : undefined}
                    />
                    <KpiLink
                      href="/jobs?status=OPEN&dateScope=TODAY"
                      value={jobDash.today}
                      label="งานนัดวันนี้"
                      sub={`ตามวันที่ระบบ ${jobDash.serverDate}`}
                    />
                  </>
                ) : null}
              </div>

              {equipDash ? (
                <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 12 }}>
                  <div
                    className="toolbar"
                    style={{ marginTop: 0, justifyContent: "space-between", alignItems: "center" }}
                  >
                    <h3 style={{ margin: 0, fontSize: 15 }}>
                      เครื่องที่ต้องทำ PM{" "}
                      <span className="sub">
                        (เกินกำหนดก่อน · แสดง {equipDash.pmAttention.length} จาก {equipDash.pmAttentionTotal})
                      </span>
                    </h3>
                    {equipDash.pmAttentionTotal > 0 ? (
                      <Link
                        className="btn"
                        href={`/equipment?pmStatus=${equipDash.byPmStatus.OVERDUE > 0 ? "OVERDUE" : "DUE_SOON"}`}
                      >
                        ดูทั้งหมด
                      </Link>
                    ) : null}
                  </div>

                  {equipDash.pmAttention.length === 0 ? (
                    <div className="state" style={{ marginTop: 8 }}>
                      {equipDash.byPmStatus.NOT_CONFIGURED === equipDash.total
                        ? "ยังไม่ได้ตั้งรอบ PM ให้เครื่องใดเลย — ตั้งรอบ PM ในหน้ารายละเอียดเครื่องเพื่อเริ่มติดตาม"
                        : "ไม่มีเครื่องที่เกินกำหนดหรือใกล้ครบกำหนด PM"}
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto", marginTop: 8 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Serial</th>
                            <th>รุ่น</th>
                            <th>ลูกค้า / สถานที่</th>
                            <th>ครบกำหนด</th>
                            <th>สถานะ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {equipDash.pmAttention.map((it) => (
                            <tr key={it.id}>
                              <td>
                                <Link href={`/equipment/${it.id}`} className="mono">
                                  {it.serial}
                                </Link>{" "}
                                {it.needsSerial ? <NeedsSerialBadge /> : null}
                              </td>
                              <td>{it.model || "—"}</td>
                              <td>
                                {it.customerName || it.location ? (
                                  <>
                                    {it.customerName ? <div>{it.customerName}</div> : null}
                                    {it.location ? <div className="sub">{it.location}</div> : null}
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="mono">{it.nextPmDate || "—"}</td>
                              <td>
                                <PmBadge status={it.pmStatus} />{" "}
                                <span className="sub">
                                  {it.pmDaysLeft < 0
                                    ? `เกินมา ${Math.abs(it.pmDaysLeft)} วัน`
                                    : `เหลือ ${it.pmDaysLeft} วัน`}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {hcFail ? (
            <div className="alert alert-warn">โหลดกราฟไม่สำเร็จ (ต้องต่ออินเทอร์เน็ตเพื่อโหลด Highcharts) — ตัวเลขสรุปด้านบนยังแสดงได้ปกติ</div>
          ) : null}

          <div className="chart-grid">
            {summary ? (
              <div className="chart-card">
                <h3>สถานะเครื่อง</h3>
                <div className="chart-box" ref={refStatus} />
              </div>
            ) : null}
            {summary ? (
              <div className="chart-card">
                <h3>สุขภาพประกัน</h3>
                <div className="chart-box" ref={refWarranty} />
              </div>
            ) : null}
            {contracts ? (
              <div className="chart-card">
                <h3>การเงินสัญญา</h3>
                <div className="chart-sub">เก็บแล้ว vs คงค้าง (รวมทุกสัญญา)</div>
                <div className="chart-box" ref={refFinance} />
              </div>
            ) : null}
            {contracts ? (
              <div className="chart-card">
                <h3>สัญญาตามประเภท</h3>
                <div className="chart-box" ref={refContractType} />
              </div>
            ) : null}
            {jobs ? (
              <div className="chart-card">
                <h3>งานบริการ</h3>
                <div className="chart-box" ref={refJobs} />
              </div>
            ) : null}
            {quotations && quotations.length > 0 ? (
              <div className="chart-card">
                <h3>ใบเสนอราคาตามสถานะ</h3>
                <div className="chart-box" ref={refQuote} />
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
