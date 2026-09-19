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
  StockLocationType,
  StockMove,
  StockTransaction,
} from "@/lib/types";
import { STOCK_MOVE_LABEL } from "@/lib/types";
import { bangkokDateTime } from "@/lib/date";
import { parseMoney, useFieldErrors } from "@/components/FieldErrors";

// ประเภทคลังตรงกับ STOCK_LOCATION_TYPES ของ backend (src/domain/part.ts)
const LOCATION_TYPES: Array<{ value: StockLocationType; label: string }> = [
  { value: "MAIN", label: "คลังหลัก" },
  { value: "TECH", label: "คลังช่าง" },
];

const EMPTY_LOCATION = { code: "", name: "", type: "MAIN" as StockLocationType, ownerName: "", note: "" };

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
  const moveErr = useFieldErrors("mv");
  const partErr = useFieldErrors("pt");

  // ฟอร์มเพิ่มคลัง (QA BUG-021 — เดิมไม่มีหน้าจอใดสร้างคลังได้เลย)
  const [showLocForm, setShowLocForm] = useState(false);
  const [newLoc, setNewLoc] = useState(EMPTY_LOCATION);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const locErr = useFieldErrors("loc");

  // ฟอร์มเพิ่มอะไหล่
  const [showPartForm, setShowPartForm] = useState(false);
  const [newPart, setNewPart] = useState({ code: "", name: "", unit: "ชิ้น", reorderPoint: "0", standardCost: "0", sellPrice: "0" });

  const load = useCallback(async () => {
    setError(null);
    setLocationsLoading(true);
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
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const needsFrom = move === "ISSUE" || move === "TRANSFER" || move === "RETURN";
  const needsTo = move === "RECEIVE" || move === "TRANSFER" || move === "RETURN";

  const submitMove = async () => {
    moveErr.clear();
    if (!partId) {
      moveErr.setIssue("partId", "เลือกอะไหล่ก่อน");
      return;
    }
    // จำนวนต้องเป็นจำนวนเต็มบวกจริง ๆ — เดิมรับข้อความอะไรก็ได้แล้วกลายเป็น 0 เงียบ ๆ
    if (!/^\d+$/.test(qty.trim()) || Number(qty) <= 0) {
      moveErr.setIssue("qty", "จำนวนต้องเป็นตัวเลขจำนวนเต็มมากกว่า 0");
      return;
    }
    if (needsFrom && !fromId) {
      moveErr.setIssue("fromLocationId", "ต้องระบุคลังต้นทาง");
      return;
    }
    if ((needsTo || move === "ADJUST") && !toId) {
      moveErr.setIssue("toLocationId", "ต้องระบุคลังปลายทาง");
      return;
    }
    let unitCostValue = 0;
    if (move === "RECEIVE") {
      const parsed = parseMoney(unitCost);
      if (!parsed.ok) {
        moveErr.setIssue("unitCost", parsed.message);
        return;
      }
      unitCostValue = parsed.value;
    }
    setBusy(true);
    try {
      await api.stockMove({
        partId,
        move,
        qty: Number(qty) || 0,
        fromLocationId: needsFrom ? fromId : "",
        toLocationId: needsTo || move === "ADJUST" ? toId : "",
        unitCost: unitCostValue,
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
      if (!moveErr.fromApi(e, ["partId", "qty", "fromLocationId", "toLocationId", "unitCost", "jobId", "note"])) {
        toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
    }
  };

  // QA BUG-021 — สร้างคลัง (POST /api/stock/locations, กันด้วยสิทธิ์ stock:manage)
  const addLocation = async () => {
    locErr.clear();
    const code = newLoc.code.trim();
    if (!code) {
      locErr.setIssue("code", "ต้องระบุรหัสคลัง");
      return;
    }
    if (locations.some((l) => l.code.toLowerCase() === code.toLowerCase())) {
      locErr.setIssue("code", `มีคลังรหัส "${code}" อยู่แล้ว`);
      return;
    }
    if (newLoc.type === "TECH" && !newLoc.ownerName.trim()) {
      locErr.setIssue("ownerName", "คลังช่างต้องระบุชื่อช่างเจ้าของคลัง");
      return;
    }
    setBusy(true);
    try {
      const created = await api.createStockLocation({
        code,
        name: newLoc.name.trim() || code,
        type: newLoc.type,
        ownerName: newLoc.type === "TECH" ? newLoc.ownerName.trim() : "",
        note: newLoc.note.trim(),
        active: true,
      });
      toast.success(`เพิ่มคลัง ${created.name || created.code} แล้ว`);
      setShowLocForm(false);
      setNewLoc(EMPTY_LOCATION);
      await load();
    } catch (e) {
      // ข้อความจาก backend ชี้ช่องได้ ก็แปะที่ช่องนั้นแทนการขึ้น toast ลอย ๆ
      if (!locErr.fromApi(e, ["code", "name", "type", "ownerName", "note"])) {
        toast.error(e instanceof ApiError ? e.message : "เพิ่มคลังไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
    }
  };

  const addPart = async () => {
    partErr.clear();
    if (!newPart.code.trim()) {
      partErr.setIssue("code", "ต้องระบุรหัสอะไหล่");
      return;
    }
    if (!newPart.name.trim()) {
      partErr.setIssue("name", "ต้องระบุชื่ออะไหล่");
      return;
    }
    if (!/^\d+$/.test(newPart.reorderPoint.trim() || "0")) {
      partErr.setIssue("reorderPoint", "จุดสั่งซื้อต้องเป็นจำนวนเต็มไม่ติดลบ");
      return;
    }
    const cost = parseMoney(newPart.standardCost);
    if (!cost.ok) {
      partErr.setIssue("standardCost", cost.message);
      return;
    }
    const sell = parseMoney(newPart.sellPrice);
    if (!sell.ok) {
      partErr.setIssue("sellPrice", sell.message);
      return;
    }
    setBusy(true);
    try {
      await api.createPart({
        code: newPart.code.trim(),
        name: newPart.name.trim(),
        unit: newPart.unit.trim(),
        reorderPoint: Number(newPart.reorderPoint) || 0,
        standardCost: cost.value,
        sellPrice: sell.value,
      });
      toast.success("เพิ่มอะไหล่แล้ว");
      setShowPartForm(false);
      setNewPart({ code: "", name: "", unit: "ชิ้น", reorderPoint: "0", standardCost: "0", sellPrice: "0" });
      await load();
    } catch (e) {
      if (!partErr.fromApi(e, ["code", "name", "unit", "reorderPoint", "standardCost", "sellPrice"])) {
        toast.error(e instanceof ApiError ? e.message : "เพิ่มอะไหล่ไม่สำเร็จ");
      }
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

      {/* ---- คลังอะไหล่ (QA BUG-021) ----
           เดิมไม่มีหน้าจอใดในระบบสร้างคลังได้เลย ทั้งที่ทุกการเคลื่อนไหวสต๊อกต้องระบุคลัง
           หน้าจอนี้วางไว้ "ก่อน" ฟอร์มการเคลื่อนไหว เพราะเป็นข้อมูลที่ต้องมีก่อน */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="page-head" style={{ marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>คลังอะไหล่</h2>
            <div className="sub">
              ทุกการรับเข้า/เบิกจ่าย/โอนย้ายต้องระบุคลัง — ถ้ายังไม่มีคลัง ให้สร้างที่นี่ก่อน
            </div>
          </div>
          {canManage && (
            <button className="btn btn-sm" onClick={() => { setShowLocForm((v) => !v); locErr.clear(); }}>
              {showLocForm ? "ปิดฟอร์ม" : "+ เพิ่มคลัง"}
            </button>
          )}
        </div>

        {showLocForm && (
          <div className="card card-pad" style={{ marginBottom: 12 }}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor={locErr.fid("code")}>
                  รหัสคลัง<span className="req">*</span>
                </label>
                <input
                  id={locErr.fid("code")}
                  {...locErr.aria("code")}
                  className="input"
                  value={newLoc.code}
                  onChange={(e) => setNewLoc({ ...newLoc, code: e.target.value })}
                  placeholder="เช่น MAIN-01 หรือ TECH-somchai"
                />
                {locErr.errFor("code") ?? <span className="field-hint">ใช้อ้างอิงภายใน ห้ามซ้ำกับคลังอื่น</span>}
              </div>
              <div className="field">
                <label htmlFor={locErr.fid("name")}>ชื่อคลัง</label>
                <input
                  id={locErr.fid("name")}
                  {...locErr.aria("name")}
                  className="input"
                  value={newLoc.name}
                  onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                  placeholder="เว้นว่างได้ — จะใช้รหัสคลังเป็นชื่อ"
                />
                {locErr.errFor("name") ?? <span className="field-hint">ชื่อที่ผู้ใช้เห็นในรายการเลือกคลัง</span>}
              </div>
              <div className="field">
                <label htmlFor={locErr.fid("type")}>ประเภทคลัง</label>
                <select
                  id={locErr.fid("type")}
                  {...locErr.aria("type")}
                  className="select"
                  value={newLoc.type}
                  onChange={(e) => setNewLoc({ ...newLoc, type: e.target.value as StockLocationType })}
                >
                  {LOCATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {locErr.errFor("type") ?? <span className="field-hint">คลังช่าง = สต๊อกติดรถของช่างแต่ละคน</span>}
              </div>
              {newLoc.type === "TECH" && (
                <div className="field">
                  <label htmlFor={locErr.fid("ownerName")}>
                    ช่างเจ้าของคลัง<span className="req">*</span>
                  </label>
                  <input
                    id={locErr.fid("ownerName")}
                    {...locErr.aria("ownerName")}
                    className="input"
                    value={newLoc.ownerName}
                    onChange={(e) => setNewLoc({ ...newLoc, ownerName: e.target.value })}
                  />
                  {locErr.errFor("ownerName") ?? <span className="field-hint">ชื่อช่างที่ถือสต๊อกคลังนี้</span>}
                </div>
              )}
              <div className="field col-span">
                <label htmlFor={locErr.fid("note")}>หมายเหตุ</label>
                <input
                  id={locErr.fid("note")}
                  {...locErr.aria("note")}
                  className="input"
                  value={newLoc.note}
                  onChange={(e) => setNewLoc({ ...newLoc, note: e.target.value })}
                />
                {locErr.errFor("note") ?? <span className="field-hint">&nbsp;</span>}
              </div>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={busy} onClick={addLocation}>
              {busy ? "กำลังบันทึก…" : "บันทึกคลัง"}
            </button>
          </div>
        )}

        {locationsLoading ? (
          <div className="state">กำลังโหลด…</div>
        ) : locations.length === 0 ? (
          <div className="state">
            ยังไม่มีคลังในระบบ — ระบบยังบันทึกการเคลื่อนไหวสต๊อกไม่ได้จนกว่าจะมีคลังอย่างน้อย 1 แห่ง
            {canManage ? ' กด "+ เพิ่มคลัง" เพื่อเริ่ม' : " กรุณาแจ้งผู้ดูแลระบบให้สร้างคลังให้"}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อคลัง</th>
                  <th>ประเภท</th>
                  <th>เจ้าของ</th>
                  <th>สถานะ</th>
                  <th>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{l.code}</td>
                    <td>{l.name || "—"}</td>
                    <td>{l.typeLabel}</td>
                    <td>{l.ownerName || "—"}</td>
                    <td>
                      <span className={`badge ${l.active ? "badge-ok" : "badge-off"}`}>
                        {l.active ? "ใช้งาน" : "ปิดใช้งาน"}
                      </span>
                    </td>
                    <td>{l.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- บันทึกการเคลื่อนไหว ---- */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>บันทึกการเคลื่อนไหว</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor={moveErr.fid("move")}>ประเภท</label>
            <select id={moveErr.fid("move")} {...moveErr.aria("move")} className="select" value={move} onChange={(e) => setMove(e.target.value as StockMove)}>
              {MOVES.map((m) => (
                <option key={m} value={m}>
                  {STOCK_MOVE_LABEL[m]}
                </option>
              ))}
            </select>
            {moveErr.errFor("move") ?? <span className="field-hint">เลือกชนิดของรายการก่อน ระบบจะถามเฉพาะช่องที่จำเป็น</span>}
          </div>
          <div className="field">
            <label htmlFor={moveErr.fid("partId")}>อะไหล่</label>
            <select id={moveErr.fid("partId")} {...moveErr.aria("partId")} className="select" value={partId} onChange={(e) => setPartId(e.target.value)}>
              <option value="">— เลือกอะไหล่ —</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
            {moveErr.errFor("partId") ?? <span className="field-hint">อะไหล่ที่เคลื่อนไหวในรายการนี้</span>}
          </div>
          <div className="field">
            <label htmlFor={moveErr.fid("qty")}>จำนวน</label>
            <input id={moveErr.fid("qty")} {...moveErr.aria("qty")} className="input" type="number" min={1} step={1} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
            {moveErr.errFor("qty") ?? <span className="field-hint">ต้องมากกว่า 0</span>}
          </div>
          {needsFrom && (
            <div className="field">
              <label htmlFor={moveErr.fid("fromLocationId")}>จากคลัง</label>
              <select id={moveErr.fid("fromLocationId")} {...moveErr.aria("fromLocationId")} className="select" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                <option value="">— เลือกคลัง —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.typeLabel})
                  </option>
                ))}
              </select>
              {moveErr.errFor("fromLocationId") ?? <span className="field-hint">คลังต้นทางที่ตัดยอดออก</span>}
            </div>
          )}
          {(needsTo || move === "ADJUST") && (
            <div className="field">
              <label htmlFor={moveErr.fid("toLocationId")}>เข้าคลัง</label>
              <select id={moveErr.fid("toLocationId")} {...moveErr.aria("toLocationId")} className="select" value={toId} onChange={(e) => setToId(e.target.value)}>
                <option value="">— เลือกคลัง —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.typeLabel})
                  </option>
                ))}
              </select>
              {moveErr.errFor("toLocationId") ?? <span className="field-hint">คลังปลายทางที่รับยอดเข้า</span>}
            </div>
          )}
          {move === "RECEIVE" && (
            <div className="field">
              <label htmlFor={moveErr.fid("unitCost")}>ราคาทุนต่อหน่วย</label>
              <input id={moveErr.fid("unitCost")} {...moveErr.aria("unitCost")} className="input" type="number" min={0} step="0.01" inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
              {moveErr.errFor("unitCost") ?? <span className="field-hint">ราคาทุนต่อหน่วยของรอบรับเข้านี้ (บาท)</span>}
            </div>
          )}
          {(move === "ISSUE" || move === "RETURN") && (
            <div className="field">
              <label htmlFor={moveErr.fid("jobId")}>ใบงานที่เกี่ยวข้อง</label>
              <input
                id={moveErr.fid("jobId")}
                {...moveErr.aria("jobId")}
                className="input"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="เช่น JOB-2026-0001"
              />
              {moveErr.errFor("jobId") ?? <span className="field-hint">ใส่เลขใบงานถ้ารายการนี้ผูกกับงาน</span>}
            </div>
          )}
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor={moveErr.fid("note")}>หมายเหตุ</label>
            <input id={moveErr.fid("note")} {...moveErr.aria("note")} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            {moveErr.errFor("note") ?? <span className="field-hint"> </span>}
          </div>
        </div>
        {/* B-09 — ขณะที่ฟอร์มย่อย (เพิ่มคลัง/เพิ่มอะไหล่) เปิดอยู่ ปุ่มหลักคือปุ่มของฟอร์มนั้น */}
        <button
          className={showLocForm || showPartForm ? "btn" : "btn btn-primary"}
          style={{ marginTop: 10 }}
          disabled={busy}
          onClick={submitMove}
        >
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
              <div className="field">
                <label htmlFor={partErr.fid("code")}>รหัสอะไหล่</label>
                <input id={partErr.fid("code")} {...partErr.aria("code")} className="input" value={newPart.code} onChange={(e) => setNewPart({ ...newPart, code: e.target.value })} />
                {partErr.errFor("code") ?? <span className="field-hint">ห้ามซ้ำกับอะไหล่อื่น</span>}
              </div>
              <div className="field">
                <label htmlFor={partErr.fid("name")}>ชื่ออะไหล่</label>
                <input id={partErr.fid("name")} {...partErr.aria("name")} className="input" value={newPart.name} onChange={(e) => setNewPart({ ...newPart, name: e.target.value })} />
                {partErr.errFor("name") ?? <span className="field-hint"> </span>}
              </div>
              <div className="field">
                <label htmlFor={partErr.fid("unit")}>หน่วย</label>
                <input id={partErr.fid("unit")} {...partErr.aria("unit")} className="input" value={newPart.unit} onChange={(e) => setNewPart({ ...newPart, unit: e.target.value })} />
                {partErr.errFor("unit") ?? <span className="field-hint">หน่วยนับ เช่น ชิ้น ชุด</span>}
              </div>
              <div className="field">
                <label htmlFor={partErr.fid("reorderPoint")}>จุดสั่งซื้อ</label>
                <input id={partErr.fid("reorderPoint")} {...partErr.aria("reorderPoint")} className="input" type="number" min={0} step={1} inputMode="numeric" value={newPart.reorderPoint} onChange={(e) => setNewPart({ ...newPart, reorderPoint: e.target.value })} />
                {partErr.errFor("reorderPoint") ?? <span className="field-hint">ยอดต่ำกว่านี้จะขึ้นแจ้งเตือน</span>}
              </div>
              <div className="field">
                <label htmlFor={partErr.fid("standardCost")}>ราคาทุนมาตรฐาน</label>
                <input id={partErr.fid("standardCost")} {...partErr.aria("standardCost")} className="input" type="number" min={0} step="0.01" inputMode="decimal" value={newPart.standardCost} onChange={(e) => setNewPart({ ...newPart, standardCost: e.target.value })} />
                {partErr.errFor("standardCost") ?? <span className="field-hint">บาทต่อหน่วย</span>}
              </div>
              <div className="field">
                <label htmlFor={partErr.fid("sellPrice")}>ราคาขาย</label>
                <input id={partErr.fid("sellPrice")} {...partErr.aria("sellPrice")} className="input" type="number" min={0} step="0.01" inputMode="decimal" value={newPart.sellPrice} onChange={(e) => setNewPart({ ...newPart, sellPrice: e.target.value })} />
                {partErr.errFor("sellPrice") ?? <span className="field-hint">บาทต่อหน่วย</span>}
              </div>
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
          <div className="table-scroll">
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
          <div className="table-scroll" style={{ maxHeight: 420 }}>
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
                      {bangkokDateTime(t.at)}
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
