"use client";

// ---------------------------------------------------------------------------
// ระบบสต๊อกอะไหล่ (STK-FN-001..010)
// ---------------------------------------------------------------------------
// หน้าเดียวรวม: ยอดคงเหลือรายคลัง · Master อะไหล่ · บันทึกการเคลื่อนไหว · ประวัติ

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type {
  Part,
  StockBalancesResponse,
  StockLocation,
  StockMove,
  StockTransaction,
} from "@/lib/types";
import { STOCK_MOVE_LABEL } from "@/lib/types";

const MOVES: StockMove[] = ["RECEIVE", "ISSUE", "TRANSFER", "RETURN", "ADJUST"];

/** คีย์กันตัดซ้ำ — สร้างใหม่ทุกครั้งที่เปิดฟอร์ม และใช้ค่าเดิมถ้ากดปุ่มซ้ำ */
function newIdemKey(): string {
  return `mv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function StockPage() {
  const { has } = useAuth();
  const toast = useToast();
  const canManage = has("stock:manage");

  const [balances, setBalances] = useState<StockBalancesResponse | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [txns, setTxns] = useState<StockTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ฟอร์มบันทึกการเคลื่อนไหว
  const [move, setMove] = useState<StockMove>("RECEIVE");
  const [partId, setPartId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [jobId, setJobId] = useState("");
  const [note, setNote] = useState("");
  const [idemKey, setIdemKey] = useState(newIdemKey);

  // ฟอร์มเพิ่มอะไหล่
  const [showPartForm, setShowPartForm] = useState(false);
  const [newPart, setNewPart] = useState({ code: "", name: "", unit: "ชิ้น", reorderPoint: "0", standardCost: "0", sellPrice: "0" });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [b, p, l, t] = await Promise.all([
        api.stockBalances(),
        api.listParts({}),
        api.listStockLocations({}),
        api.stockTransactions({ limit: 100 }),
      ]);
      setBalances(b);
      setParts(p.items);
      setLocations(l.items);
      setTxns(t.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลสต๊อกไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const needsFrom = move === "ISSUE" || move === "TRANSFER" || move === "RETURN";
  const needsTo = move === "RECEIVE" || move === "TRANSFER" || move === "RETURN";

  const submitMove = async () => {
    if (!partId) {
      toast.error("เลือกอะไหล่ก่อน");
      return;
    }
    setBusy(true);
    try {
      await api.stockMove({
        partId,
        move,
        qty: Number(qty) || 0,
        fromLocationId: needsFrom ? fromId : "",
        toLocationId: needsTo || move === "ADJUST" ? toId : "",
        unitCost: Number(unitCost) || 0,
        jobId: jobId.trim(),
        note,
        idempotencyKey: idemKey,
      });
      toast.success("บันทึกการเคลื่อนไหวแล้ว");
      setIdemKey(newIdemKey()); // รายการถัดไปใช้คีย์ใหม่
      setQty("1");
      setNote("");
      setJobId("");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const addPart = async () => {
    setBusy(true);
    try {
      await api.createPart({
        code: newPart.code,
        name: newPart.name,
        unit: newPart.unit,
        reorderPoint: Number(newPart.reorderPoint) || 0,
        standardCost: Number(newPart.standardCost) || 0,
        sellPrice: Number(newPart.sellPrice) || 0,
      });
      toast.success("เพิ่มอะไหล่แล้ว");
      setShowPartForm(false);
      setNewPart({ code: "", name: "", unit: "ชิ้น", reorderPoint: "0", standardCost: "0", sellPrice: "0" });
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "เพิ่มอะไหล่ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const lowStock = useMemo(() => (balances?.items ?? []).filter((r) => r.belowReorder), [balances]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>สต๊อกอะไหล่</h1>
          <div className="detail-meta">
            {balances ? `${balances.count} รายการ · ต่ำกว่าจุดสั่งซื้อ ${balances.belowReorder} รายการ` : ""}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {balances && !balances.valuation.method && (
        <div className="alert alert-warn">
          <strong>ยังไม่ได้กำหนดวิธีคิดมูลค่าสต๊อก</strong>
          <div style={{ marginTop: 4 }}>{balances.valuation.reason}</div>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="alert alert-warn">
          อะไหล่ต่ำกว่าจุดสั่งซื้อ: {lowStock.map((r) => `${r.code} (${r.totalQty}/${r.reorderPoint})`).join(" · ")}
        </div>
      )}

      {/* ---- มูลค่ารายคลัง ---- */}
      {balances && balances.byLocation.length > 0 && (
        <div className="filters" style={{ marginBottom: 12 }}>
          {balances.byLocation.map((l) => (
            <div className="stat" key={l.locationId}>
              <div className="stat-num">{l.qty}</div>
              <div className="stat-label">
                {l.locationName}
                {l.value !== null ? ` · ${l.value.toLocaleString("th-TH")} บาท` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- บันทึกการเคลื่อนไหว ---- */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>บันทึกการเคลื่อนไหว</h2>
        <div className="form-grid">
          <label className="field">
            <span>ประเภท</span>
            <select className="select" value={move} onChange={(e) => setMove(e.target.value as StockMove)}>
              {MOVES.map((m) => (
                <option key={m} value={m}>
                  {STOCK_MOVE_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>อะไหล่</span>
            <select className="select" value={partId} onChange={(e) => setPartId(e.target.value)}>
              <option value="">— เลือกอะไหล่ —</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>จำนวน</span>
            <input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          {needsFrom && (
            <label className="field">
              <span>จากคลัง</span>
              <select className="select" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                <option value="">— เลือกคลัง —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.typeLabel})
                  </option>
                ))}
              </select>
            </label>
          )}
          {(needsTo || move === "ADJUST") && (
            <label className="field">
              <span>เข้าคลัง</span>
              <select className="select" value={toId} onChange={(e) => setToId(e.target.value)}>
                <option value="">— เลือกคลัง —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.typeLabel})
                  </option>
                ))}
              </select>
            </label>
          )}
          {move === "RECEIVE" && (
            <label className="field">
              <span>ราคาทุนต่อหน่วย</span>
              <input className="input" inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </label>
          )}
          {(move === "ISSUE" || move === "RETURN") && (
            <label className="field">
              <span>ใบงานที่เกี่ยวข้อง</span>
              <input
                className="input"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="เช่น JOB-2026-0001"
              />
            </label>
          )}
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>หมายเหตุ</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={busy} onClick={submitMove}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>

      {/* ---- ยอดคงเหลือ ---- */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="page-head" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>ยอดคงเหลือ</h2>
          {canManage && (
            <button className="btn btn-sm" onClick={() => setShowPartForm((v) => !v)}>
              + เพิ่มอะไหล่
            </button>
          )}
        </div>

        {showPartForm && (
          <div className="card card-pad" style={{ marginBottom: 12 }}>
            <div className="form-grid">
              <label className="field">
                <span>รหัสอะไหล่</span>
                <input className="input" value={newPart.code} onChange={(e) => setNewPart({ ...newPart, code: e.target.value })} />
              </label>
              <label className="field">
                <span>ชื่ออะไหล่</span>
                <input className="input" value={newPart.name} onChange={(e) => setNewPart({ ...newPart, name: e.target.value })} />
              </label>
              <label className="field">
                <span>หน่วย</span>
                <input className="input" value={newPart.unit} onChange={(e) => setNewPart({ ...newPart, unit: e.target.value })} />
              </label>
              <label className="field">
                <span>จุดสั่งซื้อ</span>
                <input className="input" inputMode="numeric" value={newPart.reorderPoint} onChange={(e) => setNewPart({ ...newPart, reorderPoint: e.target.value })} />
              </label>
              <label className="field">
                <span>ราคาทุนมาตรฐาน</span>
                <input className="input" inputMode="decimal" value={newPart.standardCost} onChange={(e) => setNewPart({ ...newPart, standardCost: e.target.value })} />
              </label>
              <label className="field">
                <span>ราคาขาย</span>
                <input className="input" inputMode="decimal" value={newPart.sellPrice} onChange={(e) => setNewPart({ ...newPart, sellPrice: e.target.value })} />
              </label>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={busy} onClick={addPart}>
              บันทึกอะไหล่
            </button>
          </div>
        )}

        {!balances ? (
          <div className="state">กำลังโหลด…</div>
        ) : balances.items.length === 0 ? (
          <div className="state">ยังไม่มีอะไหล่ในระบบ</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อ</th>
                  <th>คงเหลือ</th>
                  <th>แยกตามคลัง</th>
                  <th>จุดสั่งซื้อ</th>
                  <th>ต้นทุน/หน่วย</th>
                  <th>มูลค่า</th>
                </tr>
              </thead>
              <tbody>
                {balances.items.map((r) => (
                  <tr key={r.partId} className={r.belowReorder ? "row-warn" : undefined}>
                    <td className="mono">{r.code}</td>
                    <td>{r.name}</td>
                    <td className="mono">
                      {r.totalQty} {r.unit}
                      {r.belowReorder && (
                        <span className="badge badge-wexp" style={{ marginLeft: 6 }}>
                          ต่ำกว่าจุดสั่งซื้อ
                        </span>
                      )}
                    </td>
                    <td>
                      {r.byLocation.length === 0
                        ? "—"
                        : r.byLocation.map((l) => `${l.locationName}: ${l.qty}`).join(" · ")}
                    </td>
                    <td className="mono">{r.reorderPoint || "—"}</td>
                    <td className="mono">{r.unitCost === null ? "—" : r.unitCost.toLocaleString("th-TH")}</td>
                    <td className="mono">{r.totalValue === null ? "—" : r.totalValue.toLocaleString("th-TH")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- ประวัติการเคลื่อนไหว ---- */}
      <div className="card card-pad">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>ประวัติการเคลื่อนไหวล่าสุด</h2>
        {txns.length === 0 ? (
          <div className="state">ยังไม่มีการเคลื่อนไหว</div>
        ) : (
          <div style={{ overflowX: "auto", maxHeight: 420 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>ประเภท</th>
                  <th>อะไหล่</th>
                  <th>จำนวน</th>
                  <th>จาก → เข้า</th>
                  <th>ใบงาน</th>
                  <th>ผู้ทำรายการ</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>
                      {t.at.slice(0, 16).replace("T", " ")}
                    </td>
                    <td>{t.moveLabel}</td>
                    <td className="mono">{t.partCode}</td>
                    <td className="mono">{t.qty}</td>
                    <td>
                      {t.fromLocationName || "—"} → {t.toLocationName || "—"}
                    </td>
                    <td className="mono">{t.jobId || "—"}</td>
                    <td>{t.byName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
