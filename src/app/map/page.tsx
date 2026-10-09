"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { Equipment, Options, PmStatus, WarrantyStatus } from "@/lib/types";
import { pmStatusLabel, warrantyStatusLabel, equipmentStatusLabel } from "@/lib/options";
import { useUrlFilters } from "@/lib/urlFilters";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { WomsErrorState, WomsFilterPanel, WomsPageHeader, WomsSearchBar, WomsSelectFilter } from "@/components/woms";

const COLOR: Record<WarrantyStatus, string> = {
  ACTIVE: "#2e9e4f",
  EXPIRING: "#e0a400",
  EXPIRED: "#d32f2f",
  NONE: "#6b7a86",
};
const ORDER: WarrantyStatus[] = ["EXPIRED", "EXPIRING", "ACTIVE", "NONE"];

// มุมมอง PM ใช้แผนที่ ข้อมูล และหมุดชุดเดิมทั้งหมด — เปลี่ยนแค่เกณฑ์สี/ตัวกรอง
// สถานะ PM มาจาก backend (domain/pm.ts) หน้าเว็บไม่คำนวณเอง
type MapView = "warranty" | "pm";

const PM_COLOR: Record<PmStatus, string> = {
  OVERDUE: "#d32f2f",
  DUE_SOON: "#e0a400",
  ON_SCHEDULE: "#2e9e4f",
  NOT_CONFIGURED: "#6b7a86",
};
const PM_ORDER: PmStatus[] = ["OVERDUE", "DUE_SOON", "ON_SCHEDULE", "NOT_CONFIGURED"];
const NO_SERIAL = "NO_SERIAL"; // ตัวกรองพิเศษในมุมมอง PM: ยังไม่มี Serial จริง
const NO_SERIAL_COLOR = "#7b4fb4";

function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  return new Promise((resolve, reject) => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      if ((window as any).L) return resolve((window as any).L);
      existing.addEventListener("load", () => resolve((window as any).L));
      existing.addEventListener("error", () => reject(new Error("LOAD_FAIL")));
      return;
    }
    const s = document.createElement("script");
    s.id = "leaflet-js";
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.async = true;
    s.onload = () => resolve((window as any).L);
    s.onerror = () => reject(new Error("LOAD_FAIL"));
    document.head.appendChild(s);
  });
}

function esc(s: string): string {
  return (s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] as string));
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const layerRef = useRef<any>(null);

  const [items, setItems] = useState<Equipment[]>([]);
  const [view, setView] = useState<MapView>("warranty");
  const [filter, setFilter] = useState<WarrantyStatus | "">("");
  const [pmFilter, setPmFilter] = useState<PmStatus | typeof NO_SERIAL | "">("");
  // ---- ตัวกรองชุดข้อมูลที่แสดง (MAP-FN-003 "กรองข้อมูลบนแผนที่ตามเงื่อนไขที่กำหนดได้") ----
  // QA BUG-009 — ตัวกรองสะท้อนลง URL
  const [f, setF] = useUrlFilters({ status: "", zone: "", category: "", q: "" });
  const statusFilter = f.status;
  const zoneFilter = f.zone;
  const categoryFilter = f.category;
  const q = f.q;
  const setStatusFilter = (v: string) => setF({ status: v });
  const setZoneFilter = (v: string) => setF({ zone: v });
  const setCategoryFilter = (v: string) => setF({ category: v });
  const setQ = (v: string) => setF({ q: v });
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<"LOAD_FAIL" | null>(null);
  const [mapReady, setMapReady] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await api.listEquipment()).items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    load();
    api.getOptions().then(setOptions).catch(() => setOptions(null));
  }, [load]);

  const withCoords = items.filter((e) => e.lat && e.lng);
  const term = q.trim().toLowerCase();
  const shown = withCoords.filter((e) => {
    // ---- ตัวกรองชุดข้อมูล (ใช้ร่วมกันทุกมุมมอง) ----
    if (statusFilter && e.status !== statusFilter) return false;
    if (zoneFilter && (e.zone ?? "") !== zoneFilter) return false;
    if (categoryFilter && (e.category ?? "") !== categoryFilter) return false;
    if (term) {
      const hay = [e.serial, e.model, e.customerName, e.siteLabel, e.addressFull].join(" ").toLowerCase();
      if (!hay.includes(term)) return false;
    }
    if (view === "warranty") return !filter || e.warrantyStatus === filter;
    if (!pmFilter) return true;
    if (pmFilter === NO_SERIAL) return e.needsSerial;
    return e.pmStatus === pmFilter;
  });

  // สีหมุดตามมุมมองที่เลือก
  const colorOf = (e: Equipment) =>
    view === "pm"
      ? pmFilter === NO_SERIAL
        ? NO_SERIAL_COLOR
        : PM_COLOR[e.pmStatus] ?? PM_COLOR.NOT_CONFIGURED
      : COLOR[e.warrantyStatus];

  // create the map exactly once
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapRef.current || mapObj.current) return;
        setMapError(null);
        const map = L.map(mapRef.current).setView([13.7563, 100.5018], 6);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        mapObj.current = map;
        setMapReady((n) => n + 1);
        setTimeout(() => mapObj.current && mapObj.current.invalidateSize(), 120);
        setTimeout(() => mapObj.current && mapObj.current.invalidateSize(), 500);
      })
      .catch(() => {
        if (!cancelled) setMapError("LOAD_FAIL");
      });
    return () => {
      cancelled = true;
      if (mapObj.current) {
        mapObj.current.remove();
        mapObj.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  // (re)draw markers whenever data / filter / map-readiness changes
  useEffect(() => {
    const L = (window as any).L;
    const map = mapObj.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const pts: [number, number][] = [];
    // markers sharing the same coordinate are spread in a small spiral so none hide
    const seen = new Map<string, number>();
    shown.forEach((e) => {
      const key = `${e.lat.toFixed(5)},${e.lng.toFixed(5)}`;
      const idx = seen.get(key) ?? 0;
      seen.set(key, idx + 1);
      let lat = e.lat;
      let lng = e.lng;
      if (idx > 0) {
        const ang = (idx * 137.5 * Math.PI) / 180; // golden angle
        const r = 0.00009 * Math.ceil(idx / 6 + 1); // ~10m steps outward
        lat += r * Math.cos(ang);
        lng += (r * Math.sin(ang)) / Math.cos((e.lat * Math.PI) / 180);
      }
      const marker = L.circleMarker([lat, lng], {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: colorOf(e),
        fillOpacity: 1,
      });
      marker.bindPopup(
        `<div style="font-size:13px;line-height:1.6;min-width:190px">
          <b>${esc(e.serial)}</b> · ${esc(e.model)}<br/>
          สถานะ: ${esc(equipmentStatusLabel[e.status])}<br/>
          ประกัน Supplier: <span style="color:${COLOR[e.supplierWarrantyStatus]};font-weight:700">${esc(warrantyStatusLabel[e.supplierWarrantyStatus])}</span>${e.supplierWarrantyEnd ? ` (ถึง ${esc(e.supplierWarrantyEnd)})` : ""}<br/>
          ประกันบริษัท (ETE): <span style="color:${COLOR[e.customerWarrantyStatus]};font-weight:700">${esc(warrantyStatusLabel[e.customerWarrantyStatus])}</span>${e.customerWarrantyEnd ? ` (ถึง ${esc(e.customerWarrantyEnd)})` : ""}<br/>
          PM: <span style="color:${PM_COLOR[e.pmStatus] ?? PM_COLOR.NOT_CONFIGURED};font-weight:700">${esc(pmStatusLabel[e.pmStatus] ?? e.pmStatus)}</span>${e.nextPmDate ? ` (ครบกำหนด ${esc(e.nextPmDate)})` : ""}<br/>
          ${e.needsSerial ? "<b>ยังไม่มี Serial จริง</b><br/>" : ""}
          ${e.customerName ? "ผู้ถือครอง: " + esc(e.customerName) + "<br/>" : ""}
          ${e.location ? "สถานที่: " + esc(e.location) + "<br/>" : ""}
          <a href="/equipment/${e.id}">เปิดรายละเอียด →</a>
        </div>`
      );
      marker.bindTooltip(esc(e.serial), { direction: "top", offset: [0, -8] });
      marker.addTo(layer);
      pts.push([lat, lng]);
    });
    if (pts.length === 1) map.setView(pts[0], 16);
    else if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 17 });
    setTimeout(() => map.invalidateSize(), 60);
  }, [items, filter, pmFilter, view, mapReady, statusFilter, zoneFilter, categoryFilter, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = (s: WarrantyStatus) => withCoords.filter((e) => e.warrantyStatus === s).length;
  const pmCounts = (s: PmStatus) => withCoords.filter((e) => e.pmStatus === s).length;
  const noSerialCount = withCoords.filter((e) => e.needsSerial).length;

  const legend: Array<[string, string]> =
    view === "warranty"
      ? ORDER.map((st) => [COLOR[st], warrantyStatusLabel[st]])
      : [
          ...PM_ORDER.map((st) => [PM_COLOR[st], pmStatusLabel[st]] as [string, string]),
          // เดิมคำอธิบายสีไม่มีสีม่วงของตัวกรอง "ยังไม่มี Serial จริง" ทั้งที่หมุดเป็นสีนั้น
          ...(pmFilter === NO_SERIAL ? [[NO_SERIAL_COLOR, "ยังไม่มี Serial จริง"] as [string, string]] : []),
        ];

  return (
    <>
      <WomsPageHeader
        title="แผนที่ติดตามเครื่อง"
        subtitle={
          // QA BUG-034 — ตัวเลขขยับตามตัวกรอง/คำค้นให้ตรงกับจำนวนหมุดบนแผนที่
          `${
            shown.length === withCoords.length
              ? `${withCoords.length} เครื่องมีพิกัด`
              : `แสดง ${shown.length} จาก ${withCoords.length} เครื่องที่มีพิกัด`
          } · ${view === "pm" ? "สีหมุดตามสถานะ PM" : "สีหมุดตามสถานะรับประกัน (ใกล้หมดสุด)"}`
        }
        actions={
          <Button component={Link} href="/equipment" startIcon={<ArrowBackIcon />}>
            คลังเครื่อง
          </Button>
        }
      />

      {error ? <WomsErrorState message={error} onRetry={load} /> : null}

      <WomsFilterPanel
        search={<WomsSearchBar value={q} onChange={setQ} placeholder="Serial / รุ่น / ลูกค้า / สาขา / ที่อยู่" />}
        activeCount={[statusFilter, zoneFilter, categoryFilter, view === "warranty" ? filter : pmFilter].filter(Boolean).length}
        onClear={() => {
          setF({ status: "", zone: "", category: "" });
          setFilter("");
          setPmFilter("");
        }}
      >
        <WomsSelectFilter
          label="แสดงสีตาม"
          value={view}
          onChange={(v) => setView(v as MapView)}
          noAll
          options={[
            { value: "warranty", label: "สถานะรับประกัน" },
            { value: "pm", label: "สถานะ PM" },
          ]}
        />
        <WomsSelectFilter
          label="สถานะเครื่อง"
          value={statusFilter}
          onChange={setStatusFilter}
          options={(["IN_STOCK", "RESERVED", "RENTED", "SOLD", "REPAIR", "RETIRED"] as const).map((st) => ({ value: st, label: equipmentStatusLabel[st] }))}
          allLabel="ทุกสถานะ"
        />
        <WomsSelectFilter label="โซน" value={zoneFilter} onChange={setZoneFilter} options={options?.zones ?? []} allLabel="ทุกโซน" />
        <WomsSelectFilter label="หมวดหมู่" value={categoryFilter} onChange={setCategoryFilter} options={options?.categories ?? []} allLabel="ทุกหมวดหมู่" />
        {view === "warranty" ? (
          <WomsSelectFilter
            label="กรองตามประกัน"
            value={filter}
            onChange={(v) => setFilter(v as WarrantyStatus | "")}
            options={ORDER.map((st) => ({ value: st, label: `${warrantyStatusLabel[st]} (${counts(st)})` }))}
          />
        ) : (
          <WomsSelectFilter
            label="กรองตาม PM"
            value={pmFilter}
            onChange={(v) => setPmFilter(v as PmStatus | typeof NO_SERIAL | "")}
            options={[
              ...PM_ORDER.map((st) => ({ value: st, label: `${pmStatusLabel[st]} (${pmCounts(st)})` })),
              { value: NO_SERIAL, label: `ยังไม่มี Serial จริง (${noSerialCount})` },
            ]}
          />
        )}
      </WomsFilterPanel>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }} aria-label="คำอธิบายสี">
        {legend.map(([color, label]) => (
          <Stack key={label} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: color }} aria-hidden />
            <Typography variant="body2">{label}</Typography>
          </Stack>
        ))}
      </Stack>

      {mapError === "LOAD_FAIL" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          โหลดแผนที่ไม่สำเร็จ (ตรวจการเชื่อมต่ออินเทอร์เน็ต)
        </Alert>
      ) : withCoords.length === 0 && !error ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          ยังไม่มีเครื่องที่ระบุพิกัด — เพิ่มพิกัด (lat/lng) ในหน้าแก้ไขเครื่อง แล้วหมุดจะขึ้นบนแผนที่
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 0, overflow: "hidden", display: mapError ? "none" : "block" }}>
        <div ref={mapRef} style={{ width: "100%", height: "68vh", minHeight: 380, background: "#e8eef1" }} aria-label="แผนที่เครื่อง" />
      </Paper>
    </>
  );
}
