"use client";

// อะไหล่ที่เบิกใช้กับใบงานนี้ (STK-FN-005) + ปุ่มเบิกจากคลังของช่างเอง
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { Part, StockLocation, StockTransaction } from "@/lib/types";
import { bangkokDateTime } from "@/lib/date";

function newIdemKey(): string {
  return `job-issue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function JobPartsCard({ jobId, closed }: { jobId: string; closed: boolean }) {
  const { user, has } = useAuth();
  const toast = useToast();
  const canIssue = has("stock:issue") && !closed;

  const [items, setItems] = useState<StockTransaction[] | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [partId, setPartId] = useState("");
  const [fromId, setFromId] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [idemKey, setIdemKey] = useState(newIdemKey);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.jobParts(jobId);
      setItems(r.items);
    } catch (e) {
      // ผู้ใช้ที่ไม่มีสิทธิ์ดูสต๊อกจะได้ 403 — ซ่อนการ์ดไปเลย
      setItems([]);
      if (e instanceof ApiError && e.status !== 403) setError(e.message);
    }
    if (canIssue) {
      try {
        const [p, l] = await Promise.all([
          api.listParts({ activeOnly: true }),
          api.listStockLocations({}),
        ]);
        setParts(p.items);
        // ช่างเบิกจากคลังของตัวเองเป็นหลัก — เรียงคลังตัวเองขึ้นก่อน
        const mine = l.items.filter((x) => x.ownerUserId === user?.id);
        setLocations([...mine, ...l.items.filter((x) => x.ownerUserId !== user?.id)]);
        if (mine[0]) setFromId(mine[0].id);
      } catch {
        /* ไม่มีสิทธิ์ดู master — ปล่อยว่าง */
      }
    }
  }, [jobId, canIssue, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const issue = async () => {
    if (!partId || !fromId) {
      toast.error("เลือกอะไหล่และคลังก่อน");
      return;
    }
    setBusy(true);
    try {
      await api.stockMove({
        partId,
        move: "ISSUE",
        qty: Number(qty) || 0,
        fromLocationId: fromId,
        jobId,
        idempotencyKey: idemKey,
      });
      toast.success("บันทึกการใช้อะไหล่แล้ว");
      setIdemKey(newIdemKey());
      setQty("1");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (items === null) return null;
  if (items.length === 0 && !canIssue) return null;

  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>อะไหล่ที่ใช้กับใบงานนี้</h2>
      {error && <div className="alert alert-error">{error}</div>}

      {canIssue && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <select className="select" value={partId} onChange={(e) => setPartId(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">— เลือกอะไหล่ —</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
          <select className="select" value={fromId} onChange={(e) => setFromId(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">— เบิกจากคลัง —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.typeLabel})
              </option>
            ))}
          </select>
          <input
            className="input"
            inputMode="numeric"
            style={{ maxWidth: 100 }}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button className="btn btn-primary" disabled={busy} onClick={issue}>
            {busy ? "กำลังบันทึก…" : "บันทึกการใช้"}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="state">ยังไม่มีการเบิกอะไหล่กับใบงานนี้</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>เวลา</th>
              <th>อะไหล่</th>
              <th>จำนวน</th>
              <th>จากคลัง</th>
              <th>ผู้เบิก</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td className="mono">{bangkokDateTime(t.at)}</td>
                <td className="mono">
                  {t.partCode} <span className="detail-meta">{t.partName}</span>
                </td>
                <td className="mono">
                  {t.move === "RETURN" ? "+" : "-"}
                  {t.qty}
                </td>
                <td>{t.fromLocationName || t.toLocationName || "—"}</td>
                <td>{t.byName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
