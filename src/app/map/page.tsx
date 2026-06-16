"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { Equipment, WarrantyStatus } from "@/lib/types";
import { warrantyStatusLabel, equipmentStatusLabel } from "@/lib/options";

const COLOR: Record<WarrantyStatus, string> = {
  ACTIVE: "#2e9e4f",
  EXPIRING: "#e0a400",
  EXPIRED: "#d32f2f",
  NONE: "#6b7a86",
};
const ORDER: WarrantyStatus[] = ["EXPIRED", "EXPIRING", "ACTIVE", "NONE"];

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
  const [filter, setFilter] = useState<WarrantyStatus | "">("");
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<"LOAD_FAIL" | null>(null);
  const [mapReady, setMapReady] = useState(0);

  const load = useCallback(async () => {
    try {
      setItems((await api.listEquipment()).items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const withCoords = items.filter((e) => e.lat && e.lng);
  const shown = withCoords.filter((e) => !filter || e.warrantyStatus === filter);

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
        fillColor: COLOR[e.warrantyStatus],
        fillOpacity: 1,
      });
      marker.bindPopup(
        `<div style="font-size:13px;line-height:1.6;min-width:190px">
          <b>${esc(e.serial)}</b> · ${esc(e.model)}<br/>
          สถานะ: ${esc(equipmentStatusLabel[e.status])}<br/>
          ประกัน supplier: <span style="color:${COLOR[e.supplierWarrantyStatus]};font-weight:700">${esc(warrantyStatusLabel[e.supplierWarrantyStatus])}</span>${e.supplierWarrantyEnd ? ` (ถึง ${esc(e.supplierWarrantyEnd)})` : ""}<br/>
          ประกัน customer: <span style="color:${COLOR[e.customerWarrantyStatus]};font-weight:700">${esc(warrantyStatusLabel[e.customerWarrantyStatus])}</span>${e.customerWarrantyEnd ? ` (ถึง ${esc(e.customerWarrantyEnd)})` : ""}<br/>
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
  }, [items, filter, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = (s: WarrantyStatus) => withCoords.filter((e) => e.warrantyStatus === s).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>แผนที่ติดตามเครื่อง</h1>
          <div className="sub">{withCoords.length} เครื่องมีพิกัด · สีหมุดตามสถานะรับประกัน (ใกล้หมดสุด)</div>
        </div>
        <Link href="/equipment" className="btn">← คลังเครื่อง</Link>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="filters" style={{ alignItems: "center" }}>
        <div className="field">
          <label>กรองตามประกัน</label>
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as WarrantyStatus | "")}>
            <option value="">ทั้งหมด</option>
            {ORDER.map((s) => (
              <option key={s} value={s}>
                {warrantyStatusLabel[s]} ({counts(s)})
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>คำอธิบายสี</label>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingTop: 6 }}>
            {ORDER.map((s) => (
              <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: COLOR[s], display: "inline-block" }} />
                {warrantyStatusLabel[s]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {mapError === "LOAD_FAIL" ? (
        <div className="alert alert-warn">โหลดแผนที่ไม่สำเร็จ (ตรวจการเชื่อมต่ออินเทอร์เน็ต)</div>
      ) : withCoords.length === 0 ? (
        <div className="alert alert-warn">ยังไม่มีเครื่องที่ระบุพิกัด — เพิ่มพิกัด (lat/lng) ในหน้าแก้ไขเครื่อง แล้วหมุดจะขึ้นบนแผนที่</div>
      ) : null}

      <div className="card" style={{ padding: 0, overflow: "hidden", display: mapError ? "none" : "block" }}>
        <div ref={mapRef} style={{ width: "100%", height: "68vh", minHeight: 380, background: "#e8eef1" }} />
      </div>
    </>
  );
}
