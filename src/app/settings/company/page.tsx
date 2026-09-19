"use client";

// ---------------------------------------------------------------------------
// หัวเอกสารของบริษัท (ใช้กับใบงาน PDF / ใบเสนอราคา / สัญญา / ใบประวัติเครื่อง)
// ---------------------------------------------------------------------------
// ที่มา: RPT-FN-003 / CON-FN-005 / QUO-FN-007 "จัดรูปแบบเอกสารตามแบบฟอร์มที่บริษัทกำหนดได้"
//
// ⚠ สำคัญ: หน้านี้ทำให้ "แก้ไขหัวเอกสารได้" เท่านั้น
//   ยังไม่มีใครส่งแบบฟอร์มจริงที่บริษัทอนุมัติมาให้ ระบบจึงไม่อ้างว่าเอกสารที่ออก
//   เป็นแบบที่บริษัทอนุมัติ จนกว่าผู้ดูแลจะติ๊กยืนยันเองหลังเทียบกับไฟล์ต้นฉบับ

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CompanyProfile } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/AuthContext";

export default function CompanySettingsPage() {
  const toast = useToast();
  const { has } = useAuth();
  const canEdit = has("master:manage");

  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.getCompany();
      setCompany(r.company);
      setMissing(r.missing);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof CompanyProfile>(k: K, v: CompanyProfile[K]) =>
    setCompany((c) => (c ? { ...c, [k]: v } : c));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || busy) return;
    setBusy(true);
    try {
      const r = await api.saveCompany({
        name: company.name,
        address: company.address,
        phone: company.phone,
        email: company.email,
        taxId: company.taxId,
        approved: company.approved,
        note: company.note,
      });
      setCompany(r.company);
      setMissing(r.missing);
      toast.success("บันทึกแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!company) return <div className="state">กำลังโหลด…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>หัวเอกสารบริษัท</h1>
          <div className="detail-meta">ใช้กับใบประวัติเครื่อง ใบเสนอราคา สัญญา และเอกสารที่พิมพ์ทุกชนิด</div>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="alert alert-warn">
          ยังไม่พร้อมออกเอกสารตามแบบบริษัท — ขาด: {missing.join(" · ")}
        </div>
      )}

      <form className="card card-pad" onSubmit={save}>
        <div className="form-grid">
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>ชื่อบริษัท</span>
            <input
              className="input"
              value={company.name}
              disabled={!canEdit}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>ที่อยู่</span>
            <input
              className="input"
              value={company.address}
              disabled={!canEdit}
              onChange={(e) => set("address", e.target.value)}
            />
          </label>
          <label className="field">
            <span>เบอร์โทร</span>
            <input
              className="input"
              value={company.phone}
              disabled={!canEdit}
              onChange={(e) => set("phone", e.target.value)}
            />
          </label>
          <label className="field">
            <span>อีเมล</span>
            <input
              className="input"
              value={company.email}
              disabled={!canEdit}
              onChange={(e) => set("email", e.target.value)}
            />
          </label>
          <label className="field">
            <span>เลขประจำตัวผู้เสียภาษี (13 หลัก)</span>
            <input
              className="input"
              value={company.taxId}
              disabled={!canEdit}
              onChange={(e) => set("taxId", e.target.value)}
            />
          </label>
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>หมายเหตุภายใน</span>
            <input
              className="input"
              value={company.note}
              disabled={!canEdit}
              onChange={(e) => set("note", e.target.value)}
            />
          </label>
        </div>

        <div className="alert" style={{ marginTop: 12 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={company.approved}
              disabled={!canEdit}
              onChange={(e) => set("approved", e.target.checked)}
            />
            <span>
              ยืนยันว่าหัวเอกสารด้านบนตรงกับ <strong>แบบฟอร์มที่บริษัทอนุมัติ</strong> แล้ว
              <br />
              <small>
                ระบบยังไม่ได้รับไฟล์แบบฟอร์มต้นฉบับจากบริษัท จนกว่าจะติ๊กช่องนี้
                เอกสารที่ออกจะมีข้อความกำกับว่ายังไม่ได้รับการยืนยัน
                {company.approvedBy ? ` · ยืนยันโดย ${company.approvedBy} เมื่อ ${company.approvedAt.slice(0, 10)}` : ""}
              </small>
            </span>
          </label>
        </div>

        {canEdit && (
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        )}
      </form>
    </>
  );
}
