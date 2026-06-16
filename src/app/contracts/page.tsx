"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Contract, ContractStatus, ContractType } from "@/lib/types";
import { contractTypeLabel, contractStatusLabel, fmtMoney } from "@/lib/options";
import { ContractStatusBadge, ContractTypeBadge } from "@/components/ContractBadges";

const TYPES: ContractType[] = ["RENTAL", "HIRE_PURCHASE", "SALE"];
const STATUSES: ContractStatus[] = ["ACTIVE", "COMPLETED", "CANCELLED"];

export default function ContractsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Contract[]>([]);
  const [type, setType] = useState<ContractType | "">("");
  const [status, setStatus] = useState<ContractStatus | "">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listContracts({
        type: type || undefined,
        status: status || undefined,
        q: q || undefined,
      });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [type, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>สัญญา</h1>
          <div className="sub">{items.length} สัญญา</div>
        </div>
        <Link href="/contracts/new" className="btn btn-primary">
          + สร้างสัญญา
        </Link>
      </div>

      <div className="filters">
        <div className="field">
          <label>ประเภท</label>
          <select className="select" value={type} onChange={(e) => setType(e.target.value as ContractType | "")}>
            <option value="">ทั้งหมด</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {contractTypeLabel[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>สถานะ</label>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value as ContractStatus | "")}>
            <option value="">ทั้งหมด</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {contractStatusLabel[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>ค้นหา</label>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="เลขสัญญา / ลูกค้า / serial / รุ่น"
          />
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : items.length === 0 ? (
          <div className="state">
            ยังไม่มีสัญญา — <Link href="/contracts/new">สร้างสัญญาแรก</Link>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>เลขสัญญา</th>
                <th>ประเภท</th>
                <th>ลูกค้า</th>
                <th>เครื่อง</th>
                <th style={{ textAlign: "right" }}>ยอดรวม</th>
                <th style={{ textAlign: "right" }}>คงเหลือ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="row-link" onClick={() => router.push(`/contracts/${c.id}`)}>
                  <td className="code">{c.contractNo}</td>
                  <td>
                    <ContractTypeBadge type={c.type} />
                  </td>
                  <td>{c.customerName}</td>
                  <td>{c.serial || "—"}{c.model ? ` · ${c.model}` : ""}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{fmtMoney(c.totalAmount)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{fmtMoney(c.balance)}</td>
                  <td>
                    <ContractStatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
