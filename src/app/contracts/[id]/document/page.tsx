"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Contract } from "@/lib/types";
import { fmtMoney } from "@/lib/options";
import { bahtText } from "@/lib/baht";
import { COMPANY } from "@/lib/company";

const TITLE: Record<Contract["type"], string> = {
  RENTAL: "หนังสือสัญญาเช่า",
  HIRE_PURCHASE: "หนังสือสัญญาเช่าซื้อ",
  SALE: "หนังสือสัญญาซื้อขาย",
};

const PARTY_A: Record<Contract["type"], string> = {
  RENTAL: "ผู้ให้เช่า",
  HIRE_PURCHASE: "ผู้ให้เช่าซื้อ",
  SALE: "ผู้ขาย",
};

const PARTY_B: Record<Contract["type"], string> = {
  RENTAL: "ผู้เช่า",
  HIRE_PURCHASE: "ผู้เช่าซื้อ",
  SALE: "ผู้ซื้อ",
};

export default function ContractDocumentPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [c, setC] = useState<Contract | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setC(await api.getContract(id));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (err) return <div className="alert alert-error">{err}</div>;
  if (!c) return <div className="state">กำลังโหลด…</div>;

  const equip = `${c.serial || "-"}${c.model ? ` รุ่น ${c.model}` : ""}`;

  return (
    <>
      <div className="doc-toolbar no-print">
        <Link href={`/contracts/${id}`} className="btn">
          ← กลับ
        </Link>
        <button className="btn btn-primary" onClick={() => window.print()}>
          พิมพ์ / บันทึก PDF
        </button>
      </div>

      <div className="doc">
        <div className="doc-head">
          <div className="doc-company">{COMPANY.name}</div>
          <div className="doc-company-sub">{COMPANY.address}</div>
          <div className="doc-company-sub">
            โทร. {COMPANY.phone} · เลขประจำตัวผู้เสียภาษี {COMPANY.taxId}
          </div>
        </div>

        <h1 className="doc-title">{TITLE[c.type]}</h1>

        <div className="doc-row-between">
          <div>เลขที่สัญญา {c.contractNo}</div>
          <div>วันที่ทำสัญญา {c.startDate || "................"}</div>
        </div>

        <p className="doc-p">
          สัญญาฉบับนี้ทำขึ้นระหว่าง <b>{COMPANY.name}</b> ซึ่งต่อไปในสัญญานี้เรียกว่า “{PARTY_A[c.type]}”
          ฝ่ายหนึ่ง กับ <b>{c.customerName}</b>
          {c.customerAddress ? ` อยู่บ้านเลขที่ ${c.customerAddress}` : ""}
          {c.customerPhone ? ` โทร. ${c.customerPhone}` : ""} ซึ่งต่อไปในสัญญานี้เรียกว่า “{PARTY_B[c.type]}”
          อีกฝ่ายหนึ่ง ทั้งสองฝ่ายตกลงทำสัญญากันโดยมีข้อความดังต่อไปนี้
        </p>

        <p className="doc-p">
          <b>ข้อ 1. ทรัพย์สิน</b> — {PARTY_A[c.type]}ตกลง
          {c.type === "SALE" ? "ขาย" : c.type === "HIRE_PURCHASE" ? "ให้เช่าซื้อ" : "ให้เช่า"}
          และ{PARTY_B[c.type]}ตกลง
          {c.type === "SALE" ? "ซื้อ" : c.type === "HIRE_PURCHASE" ? "เช่าซื้อ" : "เช่า"}
          เครื่อง/อุปกรณ์ หมายเลขเครื่อง (serial) {equip} จำนวน 1 เครื่อง
        </p>

        {c.type === "RENTAL" ? (
          <p className="doc-p">
            <b>ข้อ 2. ค่าเช่าและระยะเวลา</b> — ผู้เช่าตกลงชำระค่าเช่าในอัตราเดือนละ{" "}
            <b>{fmtMoney(c.rentPerMonth)}</b> บาท ({bahtText(c.rentPerMonth)}) เป็นระยะเวลา{" "}
            <b>{c.periodMonths}</b> เดือน นับตั้งแต่วันที่ {c.startDate || "........"}
            {c.endDate ? ` ถึงวันที่ ${c.endDate}` : ""}
            {c.deposit > 0 ? ` โดยวางเงินประกันจำนวน ${fmtMoney(c.deposit)} บาท` : ""}
            รวมค่าเช่าตลอดสัญญาเป็นเงิน <b>{fmtMoney(c.totalAmount)}</b> บาท ({bahtText(c.totalAmount)})
          </p>
        ) : c.type === "HIRE_PURCHASE" ? (
          <p className="doc-p">
            <b>ข้อ 2. ราคาและการผ่อนชำระ</b> — ราคาเช่าซื้อรวมทั้งสิ้น <b>{fmtMoney(c.totalPrice)}</b> บาท
            ({bahtText(c.totalPrice)}) ชำระเงินดาวน์ <b>{fmtMoney(c.downPayment)}</b> บาท ส่วนที่เหลือ
            ผ่อนชำระเป็น <b>{c.installmentCount}</b> งวด รวมเป็นเงินที่ต้องผ่อน{" "}
            <b>{fmtMoney(c.totalAmount)}</b> บาท ({bahtText(c.totalAmount)}) ตามตารางท้ายสัญญา
            กรรมสิทธิ์ในทรัพย์สินจะโอนเป็นของผู้เช่าซื้อเมื่อชำระครบถ้วนแล้ว
          </p>
        ) : (
          <p className="doc-p">
            <b>ข้อ 2. ราคาซื้อขาย</b> — ผู้ซื้อตกลงชำระราคาทรัพย์สินเป็นเงิน{" "}
            <b>{fmtMoney(c.totalPrice)}</b> บาท ({bahtText(c.totalPrice)})
          </p>
        )}

        <p className="doc-p">
          <b>ข้อ 3.</b> {PARTY_B[c.type]}ได้ตรวจสอบสภาพทรัพย์สินแล้วเห็นว่าอยู่ในสภาพเรียบร้อยใช้การได้ดี
          และตกลงปฏิบัติตามเงื่อนไขที่ระบุในสัญญานี้ทุกประการ
        </p>

        {c.installments.length > 0 ? (
          <table className="doc-table">
            <thead>
              <tr>
                <th>งวดที่</th>
                <th>ครบกำหนดชำระ</th>
                <th style={{ textAlign: "right" }}>จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {c.installments.map((it) => (
                <tr key={it.no}>
                  <td style={{ textAlign: "center" }}>{it.no}</td>
                  <td style={{ textAlign: "center" }}>{it.dueDate}</td>
                  <td style={{ textAlign: "right" }}>{fmtMoney(it.amount)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={{ textAlign: "right", fontWeight: 700 }}>รวม</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtMoney(c.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        ) : null}

        {c.note ? <p className="doc-p"><b>หมายเหตุ:</b> {c.note}</p> : null}

        <p className="doc-p">
          สัญญานี้ทำขึ้นเป็นสองฉบับ มีข้อความตรงกัน คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว
          จึงลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน
        </p>

        <div className="doc-signs">
          <div className="doc-sign">
            <div className="doc-sign-line">ลงชื่อ ............................................</div>
            <div>( ............................................ )</div>
            <div>{PARTY_A[c.type]}</div>
          </div>
          <div className="doc-sign">
            <div className="doc-sign-line">ลงชื่อ ............................................</div>
            <div>( {c.customerName} )</div>
            <div>{PARTY_B[c.type]}</div>
          </div>
        </div>
        <div className="doc-signs">
          <div className="doc-sign">
            <div className="doc-sign-line">ลงชื่อ ............................................</div>
            <div>( ............................................ )</div>
            <div>พยาน</div>
          </div>
          <div className="doc-sign">
            <div className="doc-sign-line">ลงชื่อ ............................................</div>
            <div>( ............................................ )</div>
            <div>พยาน</div>
          </div>
        </div>
      </div>
    </>
  );
}
