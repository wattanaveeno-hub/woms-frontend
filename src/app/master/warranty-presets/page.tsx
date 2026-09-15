"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { WarrantyPreset, WarrantyPresetItem, WarrantyProvider } from "@/lib/types";
import { warrantyProviderLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";

const PROVIDERS: WarrantyProvider[] = ["BRAND", "AGENT", "OTHER"];

const EMPTY_ITEM: WarrantyPresetItem = { provider: "BRAND", providerName: "", months: 12, coverage: "" };

// ตั้งโปรไฟล์ประกันสำเร็จรูป — ตอนรับเครื่องเข้าคลังเลือกทีเดียว ระบบเติมประกันให้ครบ
// โดยใช้วันรับเข้าคลังเป็นวันเริ่มประกันอัตโนมัติ
export default function WarrantyPresetsPage() {
  const { has } = useAuth();
  const toast = useToast();
  const canManage = has("master:manage");

  const [items, setItems] = useState<WarrantyPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [rows, setRows] = useState<WarrantyPresetItem[]>([{ ...EMPTY_ITEM }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listWarrantyPresets();
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setRow = (i: number, patch: Partial<WarrantyPresetItem>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const reset = () => {
    setName("");
    setNote("");
    setIsDefault(false);
    setRows([{ ...EMPTY_ITEM }]);
  };

  const create = async () => {
    if (!name.trim()) return toast.error("ต้องระบุชื่อโปรไฟล์");
    const valid = rows.filter((r) => r.months > 0);
    if (!valid.length) return toast.error("ต้องมีประกันอย่างน้อย 1 ชุด");
    setBusy(true);
    try {
      await api.createWarrantyPreset({ name: name.trim(), items: valid, isDefault, note });
      toast.success("เพิ่มโปรไฟล์แล้ว");
      reset();
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (p: WarrantyPreset) => {
    try {
      await api.patchWarrantyPreset(p.id, { isDefault: true });
      toast.success(`ตั้ง ${p.name} เป็นค่าตั้งต้นแล้ว`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
    }
  };

  const remove = async (p: WarrantyPreset) => {
    if (!confirm(`ลบโปรไฟล์ "${p.name}"?`)) return;
    try {
      await api.deleteWarrantyPreset(p.id);
      toast.success("ลบแล้ว");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ลบไม่สำเร็จ");
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>โปรไฟล์ประกัน</h1>
          <div className="sub">ชุดประกันสำเร็จรูปที่ใช้ตอนรับเครื่องเข้าคลัง · {items.length} โปรไฟล์</div>
        </div>
        <Link href="/master" className="btn">
          ← ข้อมูลพื้นฐาน
        </Link>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {canManage ? (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>เพิ่มโปรไฟล์ใหม่</h2>
          <div className="form-grid">
            <div className="field">
              <label>ชื่อโปรไฟล์<span className="req">*</span></label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น มาตรฐาน RO" />
            </div>
            <div className="field">
              <label>ตั้งเป็นค่าตั้งต้น</label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                ใช้โปรไฟล์นี้เป็นค่าแนะนำในฟอร์มรับเครื่อง
              </label>
            </div>

            {rows.map((r, i) => (
              <div className="field col-span" key={i}>
                <div className="toolbar" style={{ marginTop: 0 }}>
                  <select
                    className="select"
                    style={{ width: 170 }}
                    value={r.provider}
                    onChange={(e) => setRow(i, { provider: e.target.value as WarrantyProvider })}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {warrantyProviderLabel[p]}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    value={r.providerName}
                    onChange={(e) => setRow(i, { providerName: e.target.value })}
                    placeholder="ชื่อแบรนด์/ตัวแทน (ไม่บังคับ)"
                  />
                  <input
                    className="input"
                    style={{ width: 120 }}
                    type="number"
                    min={1}
                    value={r.months}
                    onChange={(e) => setRow(i, { months: Number(e.target.value) })}
                    placeholder="เดือน"
                  />
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    value={r.coverage}
                    onChange={(e) => setRow(i, { coverage: e.target.value })}
                    placeholder="ขอบเขต เช่น อะไหล่และค่าแรง"
                  />
                  <button
                    className="btn btn-danger"
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={rows.length === 1}
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}

            <div className="field col-span">
              <button className="btn" type="button" onClick={() => setRows((prev) => [...prev, { ...EMPTY_ITEM, provider: "AGENT" }])}>
                + เพิ่มชุดประกัน
              </button>
            </div>

            <div className="field col-span">
              <label>หมายเหตุ</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <div className="toolbar">
            <button className="btn btn-primary" onClick={create} disabled={busy}>
              {busy ? "กำลังบันทึก…" : "เพิ่มโปรไฟล์"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : items.length === 0 ? (
          <div className="state">ยังไม่มีโปรไฟล์ประกัน</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อโปรไฟล์</th>
                <th>ชุดประกัน</th>
                <th>หมายเหตุ</th>
                {canManage ? <th style={{ textAlign: "right" }}>จัดการ</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="code">{p.name}</span>
                    {p.isDefault ? <span className="badge badge-ok" style={{ marginLeft: 8 }}>ค่าตั้งต้น</span> : null}
                  </td>
                  <td>{p.summary}</td>
                  <td style={{ fontSize: 13, color: "#6b7a86" }}>{p.note || "—"}</td>
                  {canManage ? (
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {!p.isDefault ? (
                        <button className="btn" style={{ padding: "4px 10px" }} onClick={() => makeDefault(p)}>
                          ตั้งเป็นค่าตั้งต้น
                        </button>
                      ) : null}{" "}
                      <button className="btn btn-danger" style={{ padding: "4px 10px" }} onClick={() => remove(p)}>
                        ลบ
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
