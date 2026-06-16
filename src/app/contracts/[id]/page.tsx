"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Contract, ContractStatus } from "@/lib/types";
import { contractTypeLabel, fmtMoney } from "@/lib/options";
import { ContractStatusBadge, ContractTypeBadge, InstallmentBadge } from "@/components/ContractBadges";
import { useToast } from "@/components/Toast";

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { has } = useAuth();
  const toast = useToast();

  const [c, setC] = useState<Contract | null>(null);
  const [busyNo, setBusyNo] = useState<number | null>(null);
  const [acting, setActing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setC(await api.getContract(id));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const pay = async (no: number, paid: boolean) => {
    if (!c || busyNo !== null) return;
    setBusyNo(no);
    try {
      const updated = await api.payInstallment(id, no, paid, c.updatedAt);
      setC(updated);
      toast.success(paid ? `บันทึกชำระงวดที่ ${no}` : `ยกเลิกชำระงวดที่ ${no}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(e.message);
        load();
      } else {
        toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
      }
    } finally {
      setBusyNo(null);
    }
  };

  const changeStatus = async (status: ContractStatus, confirmMsg: string) => {
    if (!c || acting) return;
    if (!confirm(confirmMsg)) return;
    setActing(true);
    try {
      const updated = await api.setContractStatus(id, status, c.updatedAt);
      setC(updated);
      toast.success("อัปเดตสถานะแล้ว");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(e.message);
        load();
      } else {
        toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
      }
    } finally {
      setActing(false);
    }
  };

  const remove = async () => {
    if (!c || acting) return;
    if (!confirm(`ลบสัญญา ${c.contractNo}? (เครื่องจะถูกคืนเข้าคลัง)`)) return;
    setActing(true);
    try {
      await api.deleteContract(id);
      toast.success(`ลบสัญญา ${c.contractNo} แล้ว`);
      router.push("/contracts");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ลบไม่สำเร็จ");
      setActing(false);
    }
  };

  if (loadError) {
    return (
      <>
        <div className="page-head">
          <h1>ไม่พบสัญญา</h1>
        </div>
        <div className="alert alert-error">{loadError}</div>
        <Link href="/contracts" className="btn">
          ← กลับรายการสัญญา
        </Link>
      </>
    );
  }

  if (!c) return <div className="state">กำลังโหลด…</div>;

  // status actions (complete/cancel) only on an active contract;
  // recording/undoing payments stays possible until the contract is cancelled.
  const editable = c.status === "ACTIVE" && has("contracts:status");
  const canPay = c.status !== "CANCELLED" && has("contracts:pay");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="code" style={{ fontSize: 18 }}>{c.contractNo}</span>
            <ContractTypeBadge type={c.type} />
            <ContractStatusBadge status={c.status} />
          </h1>
          <div className="detail-meta">
            <span>ลูกค้า: {c.customerName}{c.customerPhone ? ` · ${c.customerPhone}` : ""}</span>
            <span>เครื่อง: {c.serial || "—"}{c.model ? ` · ${c.model}` : ""}</span>
            <span>เริ่ม: <span className="mono">{c.startDate || "—"}</span>{c.endDate ? <> · ถึง <span className="mono">{c.endDate}</span></> : null}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/contracts/${id}/document`} className="btn btn-primary" target="_blank" rel="noopener noreferrer">
            หนังสือสัญญา
          </Link>
          <Link href="/contracts" className="btn">
            ← รายการสัญญา
          </Link>
        </div>
      </div>

      <div className="filters" style={{ marginBottom: 4 }}>
        <div className="stat">
          <div className="stat-num">{fmtMoney(c.totalAmount)}</div>
          <div className="stat-label">ยอดรวม (บาท)</div>
        </div>
        <div className="stat green">
          <div className="stat-num">{fmtMoney(c.paidAmount)}</div>
          <div className="stat-label">ชำระแล้ว</div>
        </div>
        <div className="stat red">
          <div className="stat-num">{fmtMoney(c.balance)}</div>
          <div className="stat-label">คงเหลือ</div>
        </div>
        <div className="stat">
          <div className="stat-num">{c.paidCount}/{c.installments.length}</div>
          <div className="stat-label">งวดที่ชำระ</div>
        </div>
        {c.type === "RENTAL" && c.deposit > 0 ? (
          <div className="stat">
            <div className="stat-num">{fmtMoney(c.deposit)}</div>
            <div className="stat-label">เงินมัดจำ (แยกต่างหาก)</div>
          </div>
        ) : null}
        {c.nextDueDate ? (
          <div className="stat">
            <div className="stat-num" style={{ fontSize: 16 }}>{c.nextDueDate}</div>
            <div className="stat-label">งวดถัดไป</div>
          </div>
        ) : null}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>งวด</th>
              <th>ครบกำหนด</th>
              <th style={{ textAlign: "right" }}>จำนวน (บาท)</th>
              <th>สถานะ</th>
              <th>วันที่ชำระ</th>
              <th>เอกสาร</th>
              <th style={{ textAlign: "right" }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {c.installments.map((it) => (
              <tr key={it.no}>
                <td className="code">{it.no}</td>
                <td className="mono" style={{ fontSize: 13 }}>{it.dueDate}</td>
                <td className="mono" style={{ textAlign: "right" }}>{fmtMoney(it.amount)}</td>
                <td>
                  <InstallmentBadge status={it.status} />
                </td>
                <td className="mono" style={{ fontSize: 13 }}>{it.paidDate || "—"}</td>
                <td>
                  <Link href={`/contracts/${id}/receipt/${it.no}`} target="_blank" rel="noopener noreferrer">
                    {it.status === "PAID" ? "ใบเสร็จ" : "บิล"}
                  </Link>
                </td>
                <td style={{ textAlign: "right" }}>
                  {canPay ? (
                    it.status === "PENDING" ? (
                      <button className="btn btn-primary" style={{ padding: "4px 12px" }} onClick={() => pay(it.no, true)} disabled={busyNo === it.no}>
                        {busyNo === it.no ? "…" : "บันทึกชำระ"}
                      </button>
                    ) : (
                      <button className="btn" style={{ padding: "4px 12px" }} onClick={() => pay(it.no, false)} disabled={busyNo === it.no}>
                        {busyNo === it.no ? "…" : "ยกเลิกชำระ"}
                      </button>
                    )
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {c.note ? (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="stat-label" style={{ marginBottom: 4 }}>หมายเหตุ</div>
          {c.note}
        </div>
      ) : null}

      <div className="toolbar">
        {editable ? (
          <>
            <button className="btn" onClick={() => changeStatus("COMPLETED", "ปิดสัญญานี้ว่าสิ้นสุด/ครบกำหนด?")} disabled={acting}>
              ปิดสัญญา (สิ้นสุด)
            </button>
            <button className="btn btn-danger" onClick={() => changeStatus("CANCELLED", "ยกเลิกสัญญานี้? เครื่องจะถูกคืนเข้าคลัง")} disabled={acting}>
              ยกเลิกสัญญา
            </button>
          </>
        ) : null}
        {has("contracts:delete") ? (
          <button className="btn btn-danger" onClick={remove} disabled={acting}>
            ลบสัญญา
          </button>
        ) : null}
      </div>
    </>
  );
}
