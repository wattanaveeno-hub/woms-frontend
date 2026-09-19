"use client";

// ---------------------------------------------------------------------------
// วิธีคิดมูลค่าสต๊อกอะไหล่
// ---------------------------------------------------------------------------
// ⚠ Requirement ไม่ได้ระบุวิธีคิดมูลค่า และระบบเดิมไม่มีหลักเกณฑ์นี้
//   ระบบจึง "ไม่เดาให้" — ต้องให้ผู้ดูแลเลือกอย่างตั้งใจก่อน จึงจะแสดงมูลค่า

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { ValuationMethod } from "@/lib/types";
import { bangkokDateTime } from "@/lib/date";

export default function StockSettingsPage() {
  const { has } = useAuth();
  const toast = useToast();
  const canEdit = has("stock:manage");

  const [method, setMethod] = useState<ValuationMethod>("");
  const [options, setOptions] = useState<Array<{ value: ValuationMethod; label: string }>>([]);
  const [decidedBy, setDecidedBy] = useState("");
  const [decidedAt, setDecidedAt] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.getStockSettings();
      setMethod(r.settings.valuationMethod);
      setOptions(r.options);
      setDecidedBy(r.settings.decidedBy);
      setDecidedAt(r.settings.decidedAt);
      setNote(r.settings.note);
      setReason(r.reason);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      await api.saveStockSettings({ valuationMethod: method, note });
      toast.success("บันทึกแล้ว");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>วิธีคิดมูลค่าสต๊อก</h1>
          <div className="detail-meta">ใช้กับรายงานมูลค่าคงเหลือ (STK-FN-010) และต้นทุนอะไหล่ในสรุปรายเครื่อง</div>
        </div>
      </div>

      {reason && <div className="alert alert-warn">{reason}</div>}

      <div className="card card-pad">
        <label className="field">
          <span>วิธีคิดมูลค่า</span>
          <select
            className="select"
            value={method}
            disabled={!canEdit}
            onChange={(e) => setMethod(e.target.value as ValuationMethod)}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>หมายเหตุ / ที่มาของการตัดสินใจ</span>
          <input className="input" value={note} disabled={!canEdit} onChange={(e) => setNote(e.target.value)} />
        </label>
        {decidedBy && (
          <div className="detail-meta">
            เลือกโดย {decidedBy} เมื่อ {bangkokDateTime(decidedAt)}
          </div>
        )}
        {canEdit && (
          <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={busy} onClick={save}>
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        )}
      </div>
    </>
  );
}
