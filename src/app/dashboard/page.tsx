"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { EquipmentSummary, Contract, Job, Quotation } from "@/lib/types";
import {
  equipmentStatusLabel,
  contractTypeLabel,
  quotationStatusLabel,
  fmtMoney,
} from "@/lib/options";

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
  const { status } = useAuth();
  const [hc, setHc] = useState<any>(null);
  const [hcFail, setHcFail] = useState(false);
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<EquipmentSummary | null>(null);
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [quotations, setQuotations] = useState<Quotation[] | null>(null);

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
      const [s, c, j, q] = await Promise.all([
        safe(api.equipmentSummary()),
        safe(api.listContracts({})),
        safe(api.listJobs({})),
        safe(api.listQuotations({})),
      ]);
      if (!active) return;
      setSummary(s);
      setContracts(c ? c.items : null);
      setJobs(j ? j.jobs : null);
      setQuotations(q ? q.items : null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [status]);

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
                <div className="kpi amber">
                  <div className="kpi-num">{warnExpire}</div>
                  <div className="kpi-label">ประกันใกล้หมด/หมดแล้ว</div>
                </div>
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
            {jobs ? (
              <div className="kpi amber">
                <div className="kpi-num">{openJobs}</div>
                <div className="kpi-label">งานค้าง (เปิดอยู่)</div>
              </div>
            ) : null}
          </div>

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
