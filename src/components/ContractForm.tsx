"use client";

import { useState } from "react";
import type { ContractFormValues, ContractType, Options } from "@/lib/types";
import { contractTypeLabel } from "@/lib/options";

const TYPES: ContractType[] = ["RENTAL", "HIRE_PURCHASE", "SALE"];

const EMPTY: ContractFormValues = {
  type: "RENTAL",
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  serial: "",
  model: "",
  startDate: "",
  rentPerMonth: 0,
  periodMonths: 0,
  deposit: 0,
  totalPrice: 0,
  downPayment: 0,
  installmentCount: 0,
  note: "",
};

export interface ContractFormProps {
  options: Options;
  serials: { serial: string; model: string }[];
  initial?: Partial<ContractFormValues>;
  submitLabel: string;
  fieldError?: { field?: string; message: string } | null;
  busy?: boolean;
  onSubmit: (values: ContractFormValues) => void;
}

export default function ContractForm({
  options,
  serials,
  initial,
  submitLabel,
  fieldError,
  busy,
  onSubmit,
}: ContractFormProps) {
  const [v, setV] = useState<ContractFormValues>({ ...EMPTY, ...initial });

  const set = <K extends keyof ContractFormValues>(k: K, val: ContractFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const num = (s: string) => (s === "" ? 0 : Number(s));

  const onSerial = (serial: string) => {
    const match = serials.find((s) => s.serial === serial);
    setV((prev) => ({ ...prev, serial, model: match ? match.model : prev.model }));
  };

  const errFor = (field: string) =>
    fieldError && fieldError.field === field ? (
      <span className="field-error">{fieldError.message}</span>
    ) : null;

  const isRental = v.type === "RENTAL";
  const isHP = v.type === "HIRE_PURCHASE";
  const isSale = v.type === "SALE";

  return (
    <div>
      {fieldError && !fieldError.field ? (
        <div className="alert alert-error">{fieldError.message}</div>
      ) : null}

      <div className="form-grid">
        <div className="field">
          <label>
            ประเภทสัญญา<span className="req">*</span>
          </label>
          <select className="select" value={v.type} onChange={(e) => set("type", e.target.value as ContractType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {contractTypeLabel[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>
            วันเริ่มสัญญา<span className="req">*</span>
          </label>
          <input className="input" type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} />
          {errFor("startDate")}
        </div>

        <div className="field col-span">
          <label>
            ชื่อลูกค้า<span className="req">*</span>
          </label>
          <input className="input" value={v.customerName} onChange={(e) => set("customerName", e.target.value)} />
          {errFor("customerName")}
        </div>

        <div className="field">
          <label>เบอร์โทร</label>
          <input className="input" value={v.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} inputMode="tel" />
        </div>

        <div className="field">
          <label>ที่อยู่</label>
          <input className="input" value={v.customerAddress} onChange={(e) => set("customerAddress", e.target.value)} />
        </div>

        <div className="field">
          <label>เครื่อง (serial)</label>
          <input className="input" list="contract-serials" value={v.serial} onChange={(e) => onSerial(e.target.value)} placeholder="เลือก/พิมพ์ serial" />
          <datalist id="contract-serials">
            {serials.map((s) => (
              <option key={s.serial} value={s.serial}>
                {s.model}
              </option>
            ))}
          </datalist>
        </div>

        <div className="field">
          <label>รุ่น</label>
          <input className="input" list="contract-models" value={v.model} onChange={(e) => set("model", e.target.value)} />
          <datalist id="contract-models">
            {options.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        {isRental ? (
          <>
            <div className="field">
              <label>
                ค่าเช่า/เดือน (บาท)<span className="req">*</span>
              </label>
              <input className="input" type="number" min={0} value={v.rentPerMonth} onChange={(e) => set("rentPerMonth", num(e.target.value))} />
              {errFor("rentPerMonth")}
            </div>
            <div className="field">
              <label>
                จำนวนเดือน<span className="req">*</span>
              </label>
              <input className="input" type="number" min={0} value={v.periodMonths} onChange={(e) => set("periodMonths", num(e.target.value))} />
              {errFor("periodMonths")}
            </div>
            <div className="field">
              <label>เงินมัดจำ/ประกัน (บาท)</label>
              <input className="input" type="number" min={0} value={v.deposit} onChange={(e) => set("deposit", num(e.target.value))} />
            </div>
          </>
        ) : null}

        {isHP ? (
          <>
            <div className="field">
              <label>
                ราคารวม (บาท)<span className="req">*</span>
              </label>
              <input className="input" type="number" min={0} value={v.totalPrice} onChange={(e) => set("totalPrice", num(e.target.value))} />
              {errFor("totalPrice")}
            </div>
            <div className="field">
              <label>เงินดาวน์ (บาท)</label>
              <input className="input" type="number" min={0} value={v.downPayment} onChange={(e) => set("downPayment", num(e.target.value))} />
              {errFor("downPayment")}
            </div>
            <div className="field">
              <label>
                จำนวนงวด<span className="req">*</span>
              </label>
              <input className="input" type="number" min={0} value={v.installmentCount} onChange={(e) => set("installmentCount", num(e.target.value))} />
              {errFor("installmentCount")}
            </div>
          </>
        ) : null}

        {isSale ? (
          <div className="field">
            <label>
              ราคาขาย (บาท)<span className="req">*</span>
            </label>
            <input className="input" type="number" min={0} value={v.totalPrice} onChange={(e) => set("totalPrice", num(e.target.value))} />
            {errFor("totalPrice")}
          </div>
        ) : null}

        <div className="field col-span">
          <label>หมายเหตุ</label>
          <textarea className="textarea" value={v.note} onChange={(e) => set("note", e.target.value)} />
        </div>
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => onSubmit(v)} disabled={busy}>
          {busy ? "กำลังบันทึก…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
