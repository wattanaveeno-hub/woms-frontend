"use client";

// ---------------------------------------------------------------------------
// ร่องรอยการใช้งานและการแก้ไขข้อมูล (Audit Log)
// ---------------------------------------------------------------------------
// ที่มา: USR-FN-007 "บันทึกประวัติการเข้าใช้งานและการแก้ไขข้อมูลได้"
//        NFR Audit Log "…ระบุผู้ดำเนินการและวันเวลาได้"
// เปิดให้เฉพาะผู้ที่จัดการผู้ใช้ได้ (admin) — บังคับซ้ำที่ backend ด้วย

import { Fragment, useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AuditAction, AuditEntity, AuditLog } from "@/lib/types";

const ENTITIES: Array<{ value: "" | AuditEntity; label: string }> = [
  { value: "", label: "ทุกประเภทข้อมูล" },
  { value: "auth", label: "การเข้าสู่ระบบ" },
  { value: "users", label: "ผู้ใช้งาน" },
  { value: "jobs", label: "ใบงาน" },
  { value: "equipment", label: "เครื่อง" },
  { value: "customer_sites", label: "สาขาลูกค้า" },
  { value: "partners", label: "คู่ค้า/ลูกค้า" },
  { value: "contracts", label: "สัญญาเช่า" },
  { value: "quotations", label: "ใบเสนอราคา" },
  { value: "documents", label: "เอกสารขาย" },
  { value: "pm_schedules", label: "ตาราง PM" },
  { value: "parts", label: "อะไหล่" },
  { value: "stock", label: "สต๊อก" },
  { value: "tech_bills", label: "วางบิลช่าง" },
  { value: "master", label: "ข้อมูลตั้งค่า" },
];

const ACTIONS: Array<{ value: "" | AuditAction; label: string }> = [
  { value: "", label: "ทุกการกระทำ" },
  { value: "LOGIN", label: "เข้าสู่ระบบ" },
  { value: "LOGIN_FAILED", label: "เข้าสู่ระบบไม่สำเร็จ" },
  { value: "CREATE", label: "เพิ่มข้อมูล" },
  { value: "UPDATE", label: "แก้ไขข้อมูล" },
  { value: "DELETE", label: "ลบข้อมูล" },
  { value: "STATUS", label: "เปลี่ยนสถานะ" },
  { value: "CLOSE", label: "ปิดงาน" },
  { value: "APPROVE", label: "อนุมัติ" },
  { value: "REJECT", label: "ส่งกลับแก้ไข" },
  { value: "IMPORT", label: "นำเข้าข้อมูล" },
  { value: "EXPORT", label: "ส่งออกข้อมูล" },
];

export default function AuditPage() {
  const [items, setItems] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState<"" | AuditEntity>("");
  const [action, setAction] = useState<"" | AuditAction>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setItems(null);
    try {
      const r = await api.listAudit({
        entity: entity || undefined,
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 300,
      });
      setItems(r.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      setItems([]);
    }
  }, [entity, action, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ประวัติการใช้งานระบบ</h1>
          <div className="detail-meta">ใครทำอะไร เมื่อไหร่ กับข้อมูลชิ้นไหน — บันทึกอัตโนมัติ แก้ไขไม่ได้</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <label className="field">
            <span>ประเภทข้อมูล</span>
            <select className="select" value={entity} onChange={(e) => setEntity(e.target.value as any)}>
              {ENTITIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>การกระทำ</span>
            <select className="select" value={action} onChange={(e) => setAction(e.target.value as any)}>
              {ACTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>ตั้งแต่วันที่</span>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>ถึงวันที่</span>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {items === null ? (
        <div className="state">กำลังโหลด…</div>
      ) : items.length === 0 ? (
        <div className="state">ไม่พบรายการในช่วงที่เลือก</div>
      ) : (
        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>ผู้ดำเนินการ</th>
                  <th>การกระทำ</th>
                  <th>ข้อมูล</th>
                  <th>รายละเอียด</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <Fragment key={a.id}>
                    <tr>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>
                        {a.at.slice(0, 19).replace("T", " ")}
                      </td>
                      <td>
                        {a.actorName}
                        {a.actorRole ? <span className="pill" style={{ marginLeft: 6 }}>{a.actorRole}</span> : null}
                      </td>
                      <td>{a.actionLabel}</td>
                      <td className="mono">{a.entityLabel || a.entity}</td>
                      <td>
                        {a.summary}
                        {a.changes.length > 0 && (
                          <button
                            className="btn btn-sm"
                            style={{ marginLeft: 8 }}
                            onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                          >
                            {expanded === a.id ? "ซ่อน" : `ดูที่เปลี่ยน (${a.changes.length})`}
                          </button>
                        )}
                      </td>
                      <td className="mono">{a.ip || "-"}</td>
                    </tr>
                    {expanded === a.id && (
                      <tr>
                        <td colSpan={6} style={{ background: "var(--surface)" }}>
                          <table className="table">
                            <thead>
                              <tr>
                                <th>ฟิลด์</th>
                                <th>ก่อน</th>
                                <th>หลัง</th>
                              </tr>
                            </thead>
                            <tbody>
                              {a.changes.map((c, i) => (
                                <tr key={i}>
                                  <td className="mono">{c.field}</td>
                                  <td>{c.before || "(ว่าง)"}</td>
                                  <td>{c.after || "(ว่าง)"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
