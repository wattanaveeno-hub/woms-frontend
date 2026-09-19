"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Contract, ContractStatus, SalesDocument } from "@/lib/types";
import { contractStatusLabel, contractTypeLabel, documentTypeLabel, fmtMoney } from "@/lib/options";
import { ContractStatusBadge, ContractTypeBadge, InstallmentBadge } from "@/components/ContractBadges";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { bangkokDateTime } from "@/lib/date";

/** ป้ายไทยของ ContractEvent (ตรงกับ CONTRACT_EVENT_LABELS ของ backend) */
const CONTRACT_EVENT_LABEL: Record<string, string> = {
  CREATE: "สร้างสัญญา",
  STATUS: "เปลี่ยนสถานะ",
  RENEW: "ต่ออายุสัญญา",
  CANCEL: "ยกเลิกสัญญา",
  PAY: "บันทึกชำระ",
  EDIT: "แก้ไขข้อมูล",
};

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { has } = useAuth();
  const toast = useToast();

  const dialog = useDialog();
  const [c, setC] = useState<Contract | null>(null);
  const [docs, setDocs] = useState<SalesDocument[]>([]);
  const [busyNo, setBusyNo] = useState<number | null>(null);
  const [editSite, setEditSite] = useState(false);
  const [siteForm, setSiteForm] = useState({ siteAddress: "", zone: "", siteLat: 0, siteLng: 0 });
  const [acting, setActing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setC(await api.getContract(id));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  // เอกสารทั้งหมดที่ออกภายใต้สัญญานี้ (ใบเสร็จ/ใบกำกับ/ใบลดหนี้/ใบส่งของ)
  const loadDocs = useCallback(async () => {
    try {
      const res = await api.listDocuments({ contractId: id });
      setDocs(res.items);
    } catch {
      setDocs([]);
    }
  }, [id]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // ออกใบเสร็จ (หรือใบกำกับภาษี) ให้งวดที่เลือก — ระบบจะมาร์คงวดว่าชำระแล้วให้อัตโนมัติ
  const issueReceipt = async (no: number, withVat: boolean) => {
    if (!c || busyNo !== null) return;
    setBusyNo(no);
    try {
      const doc = await api.issueReceipt({
        contractId: id,
        installmentNo: no,
        type: withVat ? "TAX_INVOICE" : "RECEIPT",
      });
      toast.success(`ออก${documentTypeLabel[doc.type]} ${doc.docNo} แล้ว`);
      await Promise.all([load(), loadDocs()]);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ออกเอกสารไม่สำเร็จ");
    } finally {
      setBusyNo(null);
    }
  };

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

  // ที่อยู่ติดตั้งตามสัญญา — ใช้เป็นจุดอ้างอิงตรวจว่าเครื่องยังอยู่ที่เดิม (geofence)
  const openSiteEditor = () => {
    if (!c) return;
    setSiteForm({
      siteAddress: c.siteAddress || c.customerAddress || "",
      zone: c.zone || "",
      siteLat: c.siteLat || 0,
      siteLng: c.siteLng || 0,
    });
    setEditSite(true);
  };

  const saveSite = async () => {
    if (!c) return;
    setActing(true);
    try {
      const updated = await api.contractEdit(id, siteForm, c.updatedAt);
      setC(updated);
      setEditSite(false);
      toast.success("บันทึกที่อยู่ติดตั้งแล้ว");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(e.message);
        load();
      } else {
        toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
      }
    } finally {
      setActing(false);
    }
  };

  const changeStatus = async (status: ContractStatus, confirmMsg: string) => {
    if (!c || acting) return;
    if (
      !(await dialog.confirm({
        title: confirmMsg,
        confirmLabel: "ยืนยัน",
        danger: status === "CANCELLED",
      }))
    )
      return;
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

  /**
   * QA BUG-026 — ต่ออายุสัญญา (CON-FN-011 / AC-COND-03)
   * ความสามารถนี้มีครบทั้งใน backend และใน api.ts มาตลอด แต่ไม่มีปุ่มบนหน้าจอเลย
   */
  const renew = async () => {
    if (!c || acting) return;
    const raw = await dialog.prompt({
      title: `ต่ออายุสัญญา ${c.contractNo}`,
      message: `วันสิ้นสุดปัจจุบัน ${c.endDate || "—"} — ระบบจะเลื่อนออกไปตามจำนวนเดือนที่ระบุ และบันทึกไว้ในประวัติสัญญา`,
      label: "ต่ออายุกี่เดือน",
      help: "จำนวนเต็ม 1–120 เดือน",
      type: "number",
      min: 1,
      max: 120,
      step: 1,
      defaultValue: "12",
      required: true,
      confirmLabel: "ต่ออายุสัญญา",
      validate: (v) =>
        /^\d+$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 120
          ? null
          : "จำนวนเดือนต้องเป็นจำนวนเต็มระหว่าง 1 ถึง 120",
    });
    if (raw === null) return;
    const note = await dialog.prompt({
      title: "หมายเหตุการต่ออายุ",
      label: "หมายเหตุ",
      help: "เว้นว่างได้ — จะถูกบันทึกในประวัติสัญญา",
      type: "textarea",
      confirmLabel: "บันทึก",
    });
    if (note === null) return;
    setActing(true);
    try {
      const updated = await api.renewContract(id, Number(raw), c.updatedAt, note.trim());
      setC(updated);
      toast.success(`ต่ออายุสัญญาแล้ว — สิ้นสุด ${updated.endDate}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(e.message);
        load();
      } else {
        toast.error(e instanceof ApiError ? e.message : "ต่ออายุสัญญาไม่สำเร็จ");
      }
    } finally {
      setActing(false);
    }
  };

  const remove = async () => {
    if (!c || acting) return;
    if (
      !(await dialog.confirm({
        title: `ลบสัญญา ${c.contractNo}?`,
        message: "เครื่องที่ผูกไว้จะถูกคืนเข้าคลัง และการลบย้อนกลับไม่ได้",
        confirmLabel: "ยืนยันลบสัญญา",
        danger: true,
      }))
    )
      return;
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
  /*
   * QA BUG-025 / BUG-027 — เดิมหน้าจอเสนอปุ่มเฉพาะตอนสถานะ ACTIVE
   * สัญญาที่ "สิ้นสุด" แล้วจึงเหลือทางเดียวคือ "ลบสัญญา" ทั้งที่ CONTRACT_TRANSITIONS
   * อนุญาต COMPLETED → ACTIVE อยู่แล้ว · และสัญญาร่าง (DRAFT) ก็เปิดใช้งานไม่ได้
   * ตารางนี้คัดลอกมาจาก backend (src/domain/contract.ts) ตรง ๆ
   */
  const canChangeStatus = has("contracts:status");
  const TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
    DRAFT: ["ACTIVE", "CANCELLED"],
    ACTIVE: ["COMPLETED", "EXPIRED", "CANCELLED"],
    COMPLETED: ["ACTIVE"],
    EXPIRED: ["ACTIVE", "CANCELLED"],
    CANCELLED: [],
  };
  const allowed = canChangeStatus ? TRANSITIONS[c.status] ?? [] : [];
  const can = (to: ContractStatus) => allowed.includes(to);
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
          {/* B-09 — ปุ่มหลักของหน้านี้คือการเดินสถานะสัญญา เอกสารเป็นการกระทำรอง */}
          <Link href={`/contracts/${id}/document`} className="btn" target="_blank" rel="noopener noreferrer">
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

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="toolbar" style={{ marginTop: 0, justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>ที่อยู่ติดตั้งตามสัญญา</h2>
          {has("contracts:edit") ? (
            <button className="btn" onClick={() => (editSite ? setEditSite(false) : openSiteEditor())}>
              {editSite ? "ยกเลิก" : "แก้ไข"}
            </button>
          ) : null}
        </div>

        {editSite ? (
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="field col-span">
              <label>ที่อยู่หน้างาน</label>
              <input
                className="input"
                value={siteForm.siteAddress}
                onChange={(e) => setSiteForm({ ...siteForm, siteAddress: e.target.value })}
              />
            </div>
            <div className="field">
              <label>โซนบริการ</label>
              <input
                className="input"
                value={siteForm.zone}
                onChange={(e) => setSiteForm({ ...siteForm, zone: e.target.value })}
              />
            </div>
            <div className="field">
              <label>พิกัด (lat / lng)</label>
              <div className="toolbar" style={{ marginTop: 0 }}>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={siteForm.siteLat}
                  onChange={(e) => setSiteForm({ ...siteForm, siteLat: Number(e.target.value) })}
                />
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={siteForm.siteLng}
                  onChange={(e) => setSiteForm({ ...siteForm, siteLng: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="field col-span">
              <button className="btn btn-primary" onClick={saveSite} disabled={acting}>
                {acting ? "กำลังบันทึก…" : "บันทึกที่อยู่ติดตั้ง"}
              </button>
            </div>
          </div>
        ) : (
          <div className="detail-meta" style={{ marginTop: 10 }}>
            <span>ที่อยู่: {c.siteAddressFull || "— ยังไม่ระบุ —"}</span>
            <span>โซน: {c.zone || "—"}</span>
            <span>
              พิกัด:{" "}
              {c.siteLat && c.siteLng ? (
                <a
                  href={`https://maps.google.com/?q=${c.siteLat},${c.siteLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono"
                >
                  {c.siteLat}, {c.siteLng}
                </a>
              ) : (
                "— ยังไม่ระบุ (ตรวจ geofence ไม่ได้) —"
              )}
            </span>
          </div>
        )}
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
                  {it.receiptNo ? (
                    <span className="code">{it.receiptNo}</span>
                  ) : (
                    <Link href={`/contracts/${id}/receipt/${it.no}`} target="_blank" rel="noopener noreferrer">
                      {it.status === "PAID" ? "ใบเสร็จ (ร่าง)" : "บิล"}
                    </Link>
                  )}
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {has("documents:create") && !it.receiptNo ? (
                    <>
                      <button
                        className="btn"
                        style={{ padding: "4px 10px" }}
                        onClick={() => issueReceipt(it.no, false)}
                        disabled={busyNo === it.no}
                      >
                        ออกใบเสร็จ
                      </button>{" "}
                      <button
                        className="btn"
                        style={{ padding: "4px 10px" }}
                        onClick={() => issueReceipt(it.no, true)}
                        disabled={busyNo === it.no}
                      >
                        + ใบกำกับภาษี
                      </button>{" "}
                    </>
                  ) : null}
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

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>เอกสารของสัญญานี้</h2>
        </div>
        {docs.length === 0 ? (
          <div className="state">ยังไม่มีเอกสาร — ออกใบเสร็จได้จากตารางงวดด้านบน</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>ประเภท</th>
                <th>วันที่</th>
                <th>งวด</th>
                <th style={{ textAlign: "right" }}>ยอด</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/documents/${d.id}`} className="code">
                      {d.docNo}
                    </Link>
                  </td>
                  <td>{documentTypeLabel[d.type]}</td>
                  <td className="mono" style={{ fontSize: 13 }}>{d.issueDate}</td>
                  <td className="mono">{d.installmentNo || "—"}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{fmtMoney(d.total)}</td>
                  <td>
                    <span className={`badge ${d.status === "VOID" ? "badge-cancelled" : "badge-completed"}`}>
                      {d.status === "VOID" ? "ยกเลิก" : "ออกแล้ว"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ประวัติสัญญา — AC-COND-03 กำหนดว่าประวัติการต่ออายุต้องแสดงบนหน้าจอ
          backend ส่ง c.history มาให้อยู่แล้ว แต่ไม่เคยมีหน้าจอใดแสดง */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="page-head" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>ประวัติสัญญา</h2>
          {c.renewCount ? <span className="pill">ต่ออายุมาแล้ว {c.renewCount} ครั้ง</span> : null}
        </div>
        {!c.history || c.history.length === 0 ? (
          <div className="state">ยังไม่มีประวัติการเปลี่ยนแปลงของสัญญาฉบับนี้</div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>รายการ</th>
                  <th>ผู้ทำรายการ</th>
                  <th>รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {c.history.map((h, i) => (
                  <tr key={`${h.at}-${i}`}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>
                      {bangkokDateTime(h.at)}
                    </td>
                    <td>{CONTRACT_EVENT_LABEL[h.type] ?? h.type}</td>
                    <td>{h.byName || "—"}</td>
                    <td>
                      {h.fromStatus && h.toStatus ? (
                        <div>
                          {contractStatusLabel[h.fromStatus as ContractStatus] ?? h.fromStatus} →{" "}
                          {contractStatusLabel[h.toStatus as ContractStatus] ?? h.toStatus}
                        </div>
                      ) : null}
                      {h.fromEndDate && h.toEndDate ? (
                        <div className="sub">
                          วันสิ้นสุด {h.fromEndDate} → {h.toEndDate}
                        </div>
                      ) : null}
                      {h.note ? <div className="sub">{h.note}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {c.note ? (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="stat-label" style={{ marginBottom: 4 }}>หมายเหตุ</div>
          {c.note}
        </div>
      ) : null}

      {c.status === "DRAFT" ? (
        <div className="alert alert-warn">
          สัญญานี้ยังเป็น <strong>ร่างสัญญา</strong> — ยังไม่ถูกนับเป็นสัญญาที่ใช้งานอยู่
          ไม่เข้าการแจ้งเตือนใกล้หมดอายุ และยอดค้างชำระยังไม่เข้ารายงาน
          กด “เปิดใช้งานสัญญา” เมื่อพร้อมให้มีผลจริง
        </div>
      ) : null}
      {c.status === "CANCELLED" ? (
        <div className="alert alert-error">
          สัญญานี้ถูกยกเลิกแล้ว — เดินสถานะต่อไม่ได้ ดูได้อย่างเดียว
        </div>
      ) : null}

      <div className="toolbar">
        {/* ปุ่มหลักหนึ่งปุ่มต่อหนึ่งมุมมอง (B-09): ปุ่มเด่นคือ "ก้าวถัดไป" ของสถานะปัจจุบัน */}
        {can("ACTIVE") ? (
          <button
            className="btn btn-primary"
            onClick={() =>
              changeStatus(
                "ACTIVE",
                c.status === "DRAFT"
                  ? "เปิดใช้งานสัญญานี้? ยอดค้างชำระจะเริ่มเข้ารายงานทันที"
                  : "ให้สัญญานี้กลับมาใช้งาน?"
              )
            }
            disabled={acting}
          >
            {c.status === "DRAFT" ? "เปิดใช้งานสัญญา" : "กลับมาใช้งาน"}
          </button>
        ) : null}
        {can("COMPLETED") ? (
          <button className="btn" onClick={() => changeStatus("COMPLETED", "ปิดสัญญานี้ว่าสิ้นสุด/ครบกำหนด?")} disabled={acting}>
            ปิดสัญญา (สิ้นสุด)
          </button>
        ) : null}
        {can("EXPIRED") ? (
          <button className="btn" onClick={() => changeStatus("EXPIRED", "ทำเครื่องหมายว่าสัญญานี้หมดอายุ?")} disabled={acting}>
            หมดอายุ
          </button>
        ) : null}
        {/* QA BUG-026 — ปุ่มต่ออายุ: backend มี POST /api/contracts/:id/renew
            และ api.renewContract มีอยู่แล้ว แต่ไม่เคยมีหน้าจอใดเรียกใช้ */}
        {c.status === "ACTIVE" && has("contracts:edit") ? (
          <button className="btn" onClick={renew} disabled={acting}>
            ต่ออายุสัญญา
          </button>
        ) : null}
        {can("CANCELLED") ? (
          <button className="btn btn-danger" onClick={() => changeStatus("CANCELLED", "ยกเลิกสัญญานี้? เครื่องจะถูกคืนเข้าคลัง")} disabled={acting}>
            ยกเลิกสัญญา
          </button>
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
