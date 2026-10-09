"use client";

// ---------------------------------------------------------------------------
// ใบวางบิลส่งบัญชี (BILL-06) — เลย์เอาต์พิมพ์แบบเรียบ
// ---------------------------------------------------------------------------
// BLOCKED_BY_TEMPLATE: แม่แบบใบวางบิลของฝ่ายบัญชียังไม่ได้รับไฟล์ต้นฉบับ
// หน้านี้จึงเป็นเลย์เอาต์ชั่วคราวที่มีข้อมูลครบ (ช่าง รอบ ใบงาน เครื่อง ค่าบริการ ค่าใช้จ่ายร่วม ยอดอนุมัติ)
// การพิมพ์ครั้งแรกจากบิล APPROVED จะเปลี่ยนสถานะเป็น PRINTED · ครั้งถัดไปนับจำนวนครั้งเท่านั้น
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import PrintIcon from "@mui/icons-material/Print";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { ApiError } from "@/lib/api";
import { billsApi, jobCostSum, type TechBillV2 } from "@/lib/billsApi";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { useLetterhead } from "@/lib/company";
import { DocLetterhead } from "@/components/DocLetterhead";
import { bahtText } from "@/lib/baht";

const baht = (n: number) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BillPrintPage() {
  const { id } = useParams<{ id: string }>();
  const { has } = useAuth();
  const toast = useToast();
  const head = useLetterhead();
  const [bill, setBill] = useState<TechBillV2 | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canReview = has("bill:review");

  const load = useCallback(async () => {
    try {
      setBill(await billsApi.get(id));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const printNow = async () => {
    if (!bill) return;
    setBusy(true);
    try {
      // PRINTED เปลี่ยนได้จาก APPROVED เท่านั้น (backend บังคับ) · หลังจากนั้นเป็นการพิมพ์ซ้ำ
      const next = bill.status === "APPROVED" ? await billsApi.setStatus(id, "PRINTED") : await billsApi.reprint(id);
      setBill(next);
      setTimeout(() => window.print(), 50);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกการพิมพ์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (err) return <div className="alert alert-error">{err}</div>;
  if (!bill) return <div className="state">กำลังโหลด…</div>;

  const printable = ["APPROVED", "PRINTED", "PAYMENT_PENDING", "PAID"].includes(bill.status);
  const machine = bill.format === "MACHINE";
  const jobIds = machine ? [...new Set(bill.machineItems.map((m) => m.jobId))] : bill.items.map((i) => i.jobId);

  return (
    <>
      <div className="doc-toolbar no-print">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button component={Link} href={`/bills/${id}`} startIcon={<ArrowBackIcon />}>
            กลับ
          </Button>
          {canReview && printable ? (
            <Button variant="contained" startIcon={<PrintIcon />} disabled={busy} onClick={printNow}>
              {bill.status === "APPROVED" ? "ออกใบวางบิล (บันทึกสถานะ) และพิมพ์" : "พิมพ์ซ้ำ"}
            </Button>
          ) : null}
        </Stack>
        {/* ข้อความภายใน — อยู่ในแถบเครื่องมือ (no-print) จึงไม่ติดไปกับใบวางบิลที่ส่งบัญชี */}
        <div className="doc-note" data-testid="template-pending-note">
          เลย์เอาต์ชั่วคราว — แม่แบบใบวางบิลของฝ่ายบัญชียังรอไฟล์ต้นฉบับ (BLOCKED_BY_TEMPLATE)
        </div>
        {!printable ? <div className="alert alert-error">ออกใบวางบิลได้หลังอนุมัติแล้วเท่านั้น (สถานะปัจจุบัน: {bill.statusLabel})</div> : null}
      </div>

      <div className="doc">
        <DocLetterhead head={head} />
        <h1 className="doc-title">ใบวางบิลค่าบริการช่าง</h1>
        <div className="doc-row-between">
          <div>เลขที่ {bill.billNo}</div>
          <div>รอบ {bill.periodFrom} ถึง {bill.periodTo}</div>
        </div>
        <table className="doc-kv">
          <tbody>
            <tr><td className="doc-kv-key">ช่าง</td><td>{bill.technicianName}</td></tr>
            <tr><td className="doc-kv-key">อนุมัติโดย</td><td>{bill.approvedBy || "—"} {bill.approvedAt ? `(${bill.approvedAt.slice(0, 10)})` : ""}</td></tr>
            <tr><td className="doc-kv-key">จำนวน</td><td>{machine ? `${bill.totals.machineCount} เครื่อง / ` : ""}{jobIds.length} ใบงาน</td></tr>
          </tbody>
        </table>

        {machine ? (
          <table className="doc-table">
            <thead>
              <tr>
                <th style={{ width: "16%" }}>ใบงาน</th>
                <th>ร้าน / วันที่เข้างาน</th>
                <th>SN / รุ่น</th>
                <th style={{ width: "16%", textAlign: "right" }}>ค่าบริการ</th>
              </tr>
            </thead>
            <tbody>
              {jobIds.map((jobId) => {
                const ms = bill.machineItems.filter((m) => m.jobId === jobId);
                const c = bill.jobCosts.find((x) => x.jobId === jobId);
                return [
                  ...ms.map((m, i) => (
                    <tr key={m.jobEquipmentId}>
                      <td>{i === 0 ? jobId : ""}</td>
                      <td>{i === 0 ? `${m.customerName} · ${m.jobDate}` : ""}</td>
                      <td>{m.serial || "—"}{m.model ? ` / ${m.model}` : ""}</td>
                      <td style={{ textAlign: "right" }}>{baht(m.serviceFee)}</td>
                    </tr>
                  )),
                  c && jobCostSum(c) > 0 ? (
                    <tr key={`${jobId}-shared`}>
                      <td></td>
                      <td colSpan={2}>
                        ค่าใช้จ่ายร่วมของใบงาน: เดินทาง {c.distanceKm} กม. × {baht(c.ratePerKm)} = {baht(c.travelAmount)}
                        {c.hotel ? ` · โรงแรม ${baht(c.hotel)}` : ""}
                        {c.parking ? ` · จอดรถ ${baht(c.parking)}` : ""}
                        {c.equipment ? ` · อุปกรณ์ ${baht(c.equipment)}` : ""}
                        {c.porter ? ` · คนยก ${baht(c.porter)}` : ""}
                        {c.other ? ` · อื่น ๆ ${baht(c.other)}` : ""}
                      </td>
                      <td style={{ textAlign: "right" }}>{baht(jobCostSum(c))}</td>
                    </tr>
                  ) : null,
                ];
              })}
              <tr>
                <td colSpan={3} style={{ textAlign: "right" }}>รวมค่าบริการรายเครื่อง</td>
                <td style={{ textAlign: "right" }}>{baht(bill.totals.serviceFeeTotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} style={{ textAlign: "right" }}>รวมค่าใช้จ่ายร่วม</td>
                <td style={{ textAlign: "right" }}>{baht(bill.totals.sharedTotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} style={{ textAlign: "right", fontWeight: 700 }}>ยอดรวมสุทธิ</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{baht(bill.totals.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="doc-table">
            <thead>
              <tr>
                <th>ใบงาน</th>
                <th>ร้าน / วันที่</th>
                <th style={{ width: "18%", textAlign: "right" }}>ค่าแรง</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((it) => (
                <tr key={it.jobId}>
                  <td>{it.jobId}</td>
                  <td>{it.customerName} · {it.jobDate}</td>
                  <td style={{ textAlign: "right" }}>{baht(it.laborAmount)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={{ textAlign: "right" }}>ค่าเดินทาง ({bill.totals.dayCount} วัน)</td>
                <td style={{ textAlign: "right" }}>{baht(bill.totals.travelTotal)}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ textAlign: "right" }}>ค่าใช้จ่ายอื่น</td>
                <td style={{ textAlign: "right" }}>{baht(bill.totals.expenseTotal)}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ textAlign: "right", fontWeight: 700 }}>ยอดรวมสุทธิ</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{baht(bill.totals.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        )}

        <div className="doc-amount-words">({bahtText(bill.totals.grandTotal)})</div>
        {bill.note ? <p className="doc-p"><b>หมายเหตุ:</b> {bill.note}</p> : null}

        <div className="doc-signs">
          <div className="doc-sign">
            <div className="doc-sign-line">ลงชื่อ ........................................</div>
            <div>ช่างผู้วางบิล</div>
          </div>
          <div className="doc-sign">
            <div className="doc-sign-line">ลงชื่อ ........................................</div>
            <div>ผู้อนุมัติ</div>
          </div>
          <div className="doc-sign">
            <div className="doc-sign-line">ลงชื่อ ........................................</div>
            <div>ฝ่ายบัญชี</div>
          </div>
        </div>

        {bill.printCount ? <p className="doc-note">พิมพ์ครั้งที่ {bill.printCount}</p> : null}
      </div>
    </>
  );
}
