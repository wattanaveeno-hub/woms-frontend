"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import Pagination, { usePagination } from "@/components/Pagination";
import BulkImport from "@/components/BulkImport";
import { num } from "@/lib/xlsx";
import { useAuth } from "@/lib/AuthContext";
import type { Contract, ContractStatus, ContractType, ContractFormValues } from "@/lib/types";
import { contractTypeLabel, contractStatusLabel, fmtMoney } from "@/lib/options";
import { ContractStatusBadge, ContractTypeBadge } from "@/components/ContractBadges";

const TYPES: ContractType[] = ["RENTAL", "HIRE_PURCHASE", "SALE"];
const STATUSES: ContractStatus[] = ["ACTIVE", "COMPLETED", "CANCELLED"];

export default function ContractsPage() {
  const router = useRouter();
  const { has } = useAuth();
  const [items, setItems] = useState<Contract[]>([]);
  const { page, setPage, pageCount, pageItems, total } = usePagination(items, 10);
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
<div className="head-actions">
          <BulkImport<ContractFormValues>
            label="สัญญา"
            templateName="contract-template.xlsx"
            perm="contracts:create"
            headers={["ประเภท", "ชื่อลูกค้า", "โทร", "ที่อยู่", "Serial เครื่อง", "รุ่น", "วันเริ่ม", "ค่าเช่า/เดือน", "จำนวนเดือน", "มัดจำ", "ราคารวม", "เงินดาวน์", "จำนวนงวด", "หมายเหตุ"]}
            example={["RENTAL", "บริษัท ตัวอย่าง", "0812345678", "กรุงเทพ", "SN-0001", "RO-300", "2026-01-01", "7000", "12", "7000", "0", "0", "0", ""]}
            toValues={(r) => {
              const traw = (r["ประเภท"] || "").trim();
              const tmap: Record<string, ContractType> = { "เช่า": "RENTAL", "เช่าซื้อ": "HIRE_PURCHASE", "ขาย": "SALE" };
              const codes = ["RENTAL", "HIRE_PURCHASE", "SALE"];
              let type: ContractType;
              if (codes.includes(traw)) type = traw as ContractType;
              else if (tmap[traw]) type = tmap[traw];
              else return { ok: false, error: "ประเภทไม่ถูกต้อง: " + traw };
              if (!(r["ชื่อลูกค้า"] || "").trim()) return { ok: false, error: "ไม่มีชื่อลูกค้า" };
              return { ok: true, value: {
                type, customerName: r["ชื่อลูกค้า"] || "", customerPhone: r["โทร"] || "",
                customerAddress: r["ที่อยู่"] || "", serial: r["Serial เครื่อง"] || "", model: r["รุ่น"] || "",
                startDate: r["วันเริ่ม"] || "", rentPerMonth: num(r["ค่าเช่า/เดือน"]), periodMonths: num(r["จำนวนเดือน"]),
                deposit: num(r["มัดจำ"]), totalPrice: num(r["ราคารวม"]), downPayment: num(r["เงินดาวน์"]),
                installmentCount: num(r["จำนวนงวด"]), note: r["หมายเหตุ"] || "",
              } };
            }}
            create={(v) => api.createContract(v)}
            onDone={load}
          />
          {has("contracts:create") ? (
            <Link href="/contracts/new" className="btn btn-primary">
              + สร้างสัญญา
            </Link>
          ) : null}
        </div>
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
              {pageItems.map((c) => (
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
      <Pagination page={page} pageCount={pageCount} total={total} onPage={setPage} />
    </>
  );
}
