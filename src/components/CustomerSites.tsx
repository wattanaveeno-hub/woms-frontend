"use client";

// ---------------------------------------------------------------------------
// จัดการสาขา / ร้าน / สถานที่ติดตั้งของลูกค้าหนึ่งราย
// ---------------------------------------------------------------------------
// ที่มา: ชีต "FUN-NOFUN REQ" โมดูล "ระบบฐานข้อมูลลูกค้า" (MUST-HAVE)
//   "ระบบจะต้องรองรับลูกค้าหนึ่งรายที่มีหลายร้านหรือหลายสถานที่ติดตั้งได้"
// โครงสร้างชื่อฟิลด์อ้างอิงชีต Sheet2: S_NAME (ชื่อร้าน) + B_NUM (เลขสาขา)

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CustomerSite, CustomerSiteFormValues } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/AuthContext";

const EMPTY: CustomerSiteFormValues = {
  branchNo: "",
  storeName: "",
  contactPerson: "",
  phone: "",
  address: "",
  district: "",
  province: "",
  postcode: "",
  zone: "",
  lat: 0,
  lng: 0,
  active: true,
  note: "",
};

export default function CustomerSites({ partnerId }: { partnerId: string }) {
  const toast = useToast();
  const { has } = useAuth();
  const canCreate = has("partners:create");
  const canEdit = has("partners:edit");
  const canDelete = has("partners:delete");

  const [sites, setSites] = useState<CustomerSite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerSiteFormValues>(EMPTY);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.listCustomerSites(partnerId);
      setSites(r.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดสาขาไม่สำเร็จ");
      setSites([]);
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const startAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const startEdit = (s: CustomerSite) => {
    setEditingId(s.id);
    setForm({
      branchNo: s.branchNo,
      storeName: s.storeName,
      contactPerson: s.contactPerson,
      phone: s.phone,
      address: s.address,
      district: s.district,
      province: s.province,
      postcode: s.postcode,
      zone: s.zone,
      lat: s.lat,
      lng: s.lng,
      active: s.active,
      note: s.note,
    });
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (editingId) {
        const current = sites?.find((s) => s.id === editingId);
        await api.patchCustomerSite(partnerId, editingId, form, current?.updatedAt ?? "");
        toast.success("บันทึกสาขาแล้ว");
      } else {
        await api.createCustomerSite(partnerId, form);
        toast.success("เพิ่มสาขาแล้ว");
      }
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: CustomerSite) => {
    if (!confirm(`ลบสาขา ${s.label || s.branchNo}?\nถ้ามีเครื่องผูกอยู่ ระบบจะปิดการใช้งานแทนการลบ เพื่อไม่ให้ประวัติขาด`)) {
      return;
    }
    try {
      const r = (await api.deleteCustomerSite(partnerId, s.id)) as any;
      if (r && r.deleted === false) {
        toast.warning(`ปิดการใช้งานสาขาแล้ว (มีเครื่องผูกอยู่ ${r.equipmentCount} เครื่อง)`);
      } else {
        toast.success("ลบสาขาแล้ว");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  };

  const set = <K extends keyof CustomerSiteFormValues>(k: K, v: CustomerSiteFormValues[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="page-head" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>
          สาขา / ร้าน / สถานที่ติดตั้ง{sites ? ` (${sites.length})` : ""}
        </h2>
        {canCreate && !showForm && (
          <button className="btn btn-primary btn-sm" onClick={startAdd}>
            + เพิ่มสาขา
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <form onSubmit={submit} className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="form-grid">
            <label className="field">
              <span>เลขสาขา</span>
              <input
                className="input"
                value={form.branchNo}
                onChange={(e) => set("branchNo", e.target.value)}
                placeholder="เช่น 00, 01"
              />
            </label>
            <label className="field">
              <span>ชื่อร้าน / ชื่อสาขา</span>
              <input
                className="input"
                value={form.storeName}
                onChange={(e) => set("storeName", e.target.value)}
                placeholder="เช่น Happy cafe Siam"
              />
            </label>
            <label className="field">
              <span>ผู้ติดต่อ</span>
              <input
                className="input"
                value={form.contactPerson}
                onChange={(e) => set("contactPerson", e.target.value)}
              />
            </label>
            <label className="field">
              <span>เบอร์โทร</span>
              <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>ที่อยู่</span>
              <input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </label>
            <label className="field">
              <span>อำเภอ/เขต</span>
              <input className="input" value={form.district} onChange={(e) => set("district", e.target.value)} />
            </label>
            <label className="field">
              <span>จังหวัด</span>
              <input className="input" value={form.province} onChange={(e) => set("province", e.target.value)} />
            </label>
            <label className="field">
              <span>รหัสไปรษณีย์</span>
              <input className="input" value={form.postcode} onChange={(e) => set("postcode", e.target.value)} />
            </label>
            <label className="field">
              <span>โซนบริการ</span>
              <input className="input" value={form.zone} onChange={(e) => set("zone", e.target.value)} />
            </label>
            <label className="field">
              <span>ละติจูด</span>
              <input
                className="input"
                inputMode="decimal"
                value={form.lat || ""}
                onChange={(e) => set("lat", Number(e.target.value) || 0)}
              />
            </label>
            <label className="field">
              <span>ลองจิจูด</span>
              <input
                className="input"
                inputMode="decimal"
                value={form.lng || ""}
                onChange={(e) => set("lng", Number(e.target.value) || 0)}
              />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>หมายเหตุ</span>
              <input className="input" value={form.note} onChange={(e) => set("note", e.target.value)} />
            </label>
            {editingId && (
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => set("active", e.target.checked)}
                />
                <span>ใช้งานอยู่</span>
              </label>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "กำลังบันทึก…" : editingId ? "บันทึกการแก้ไข" : "เพิ่มสาขา"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      {sites === null ? (
        <div className="state">กำลังโหลด…</div>
      ) : sites.length === 0 ? (
        <div className="state">
          ยังไม่มีสาขา — ลูกค้ารายนี้ยังไม่ได้แยกร้าน/สถานที่ติดตั้ง
          {canCreate ? " กด “+ เพิ่มสาขา” เพื่อเริ่ม" : ""}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>สาขา</th>
                <th>ชื่อร้าน</th>
                <th>ผู้ติดต่อ</th>
                <th>เบอร์โทร</th>
                <th>ที่อยู่</th>
                <th>โซน</th>
                <th>สถานะ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.branchNo || "-"}</td>
                  <td>{s.storeName || "-"}</td>
                  <td>{s.contactPerson || "-"}</td>
                  <td className="mono">{s.phone || "-"}</td>
                  <td>{s.addressFull || "-"}</td>
                  <td>{s.zone || "-"}</td>
                  <td>
                    <span className={`badge ${s.active ? "badge-ok" : "badge-off"}`}>
                      {s.active ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {canEdit && (
                      <button className="btn btn-sm" onClick={() => startEdit(s)}>
                        แก้ไข
                      </button>
                    )}
                    {canDelete && (
                      <button className="btn btn-sm btn-danger" onClick={() => remove(s)} style={{ marginLeft: 6 }}>
                        ลบ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
