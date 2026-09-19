"use client";

// ---------------------------------------------------------------------------
// ค้นหาลูกค้าแบบรวม — ชื่อลูกค้า / ชื่อร้าน / เบอร์โทร / Serial Number
// ---------------------------------------------------------------------------
// ที่มา: ชีต "FUN-NOFUN REQ" โมดูล "ระบบฐานข้อมูลลูกค้า" (MUST-HAVE)
//   "ระบบจะต้องสามารถค้นหาข้อมูลลูกค้าจากชื่อลูกค้า ชื่อร้าน เบอร์โทรศัพท์
//    หรือ Serial Number (SN) ได้"

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { CustomerSearchResult } from "@/lib/types";
import { equipmentStatusLabel } from "@/lib/options";

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<CustomerSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.searchCustomers(term));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ค้นหาไม่สำเร็จ");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const empty =
    result && result.counts.customers === 0 && result.counts.sites === 0 && result.counts.equipment === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ฐานข้อมูลลูกค้า</h1>
          <div className="detail-meta">ค้นด้วยชื่อลูกค้า ชื่อร้าน เบอร์โทร หรือ Serial ของเครื่อง</div>
        </div>
      </div>

      <form onSubmit={search} className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ flex: "1 1 260px" }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="เช่น บจก.สุขสัน · Happy cafe · 0812345678 · SN-0001"
            autoFocus
          />
          <button className="btn btn-primary" disabled={busy || !q.trim()}>
            {busy ? "กำลังค้นหา…" : "ค้นหา"}
          </button>
        </div>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {!result && !error && <div className="state">พิมพ์คำค้นแล้วกดค้นหา</div>}
      {empty && <div className="state">ไม่พบข้อมูลที่ตรงกับ “{result?.query}”</div>}

      {result && !empty && (
        <>
          {result.customers.length > 0 && (
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>ลูกค้า ({result.counts.customers})</h2>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>ชื่อ</th>
                      <th>ประเภท</th>
                      <th>เบอร์โทร</th>
                      <th>พบจาก</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {result.customers.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.type}</td>
                        <td className="mono">{c.phone || "-"}</td>
                        <td>{c.matchedBy === "customer" ? "ชื่อลูกค้า" : "สาขา/เครื่องที่เกี่ยวข้อง"}</td>
                        <td>
                          <Link className="btn btn-sm" href={`/partners/${c.id}`}>
                            เปิด
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.sites.length > 0 && (
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>สาขา / ร้าน ({result.counts.sites})</h2>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>สาขา</th>
                      <th>เบอร์โทร</th>
                      <th>ที่อยู่</th>
                      <th>สถานะ</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {result.sites.map((s) => (
                      <tr key={s.id}>
                        <td>{s.label || "-"}</td>
                        <td className="mono">{s.phone || "-"}</td>
                        <td>{s.addressFull || "-"}</td>
                        <td>
                          <span className={`badge ${s.active ? "badge-ok" : "badge-off"}`}>
                            {s.active ? "ใช้งาน" : "ปิดใช้งาน"}
                          </span>
                        </td>
                        <td>
                          <Link className="btn btn-sm" href={`/partners/${s.partnerId}`}>
                            เปิดลูกค้า
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.equipment.length > 0 && (
            <div className="card card-pad">
              <h2 style={{ marginTop: 0, fontSize: 18 }}>เครื่องที่ตรง Serial ({result.counts.equipment})</h2>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Serial</th>
                      <th>รุ่น</th>
                      <th>สถานะ</th>
                      <th>ลูกค้า</th>
                      <th>สาขา</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {result.equipment.map((e) => (
                      <tr key={e.id}>
                        <td className="mono">
                          {e.serial}
                          {e.needsSerial && (
                            <span className="badge badge-off" style={{ marginLeft: 6 }}>
                              ยังไม่มี SN
                            </span>
                          )}
                        </td>
                        <td>{e.model}</td>
                        <td>{equipmentStatusLabel[e.status] ?? e.status}</td>
                        <td>
                          {e.customerId ? (
                            <Link href={`/partners/${e.customerId}`}>{e.customerName || "(ไม่ระบุชื่อ)"}</Link>
                          ) : (
                            e.customerName || "-"
                          )}
                        </td>
                        <td>{e.siteLabel || "-"}</td>
                        <td>
                          <Link className="btn btn-sm" href={`/equipment/${e.id}`}>
                            เปิดเครื่อง
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
