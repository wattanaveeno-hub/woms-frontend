"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ContractFormValues, ContractType, CustomerSite, Options, Partner } from "@/lib/types";
import { contractTypeLabel } from "@/lib/options";

const TYPES: ContractType[] = ["RENTAL", "HIRE_PURCHASE", "SALE"];

const EMPTY: ContractFormValues = {
  type: "RENTAL",
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  siteAddress: "",
  siteLat: 0,
  siteLng: 0,
  zone: "",
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
  /**
   * `activate` = ผู้ใช้เลือก "สร้างและเปิดใช้งานทันที"
   * หน้าที่แก้ไขสัญญาเดิมจะไม่ส่งค่านี้ไปใช้
   */
  onSubmit: (values: ContractFormValues, activate: boolean) => void;
  /** true = ฟอร์มนี้กำลังสร้างสัญญาใหม่ (แสดงตัวเลือกสถานะตอนสร้าง) */
  isNew?: boolean;
}

export default function ContractForm({
  options,
  serials,
  initial,
  submitLabel,
  fieldError,
  busy,
  onSubmit,
  isNew,
}: ContractFormProps) {
  const [v, setV] = useState<ContractFormValues>({ ...EMPTY, ...initial });
  /*
   * QA BUG-028 — ฟอร์มนี้เคยรับ "ชื่อลูกค้า" เป็นข้อความอิสระล้วน และไม่มีช่องสาขาเลย
   * สัญญาจึงไม่ผูกกับฐานข้อมูลลูกค้ากลาง แม้ลูกค้ารายนั้นจะมีอยู่จริง
   * ที่นี่เพิ่มการ "เลือกจากฐานข้อมูล" ให้เป็นทางหลัก แต่ยังพิมพ์เองได้
   * (backend ยังรับเฉพาะ customerName/siteAddress จึงเติมค่าจากที่เลือกให้)
   */
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [sitesLoading, setSitesLoading] = useState(false);
  // QA BUG-025 — สัญญาสร้างใหม่เป็นร่างเสมอ เว้นแต่ผู้ใช้ติ๊กเปิดใช้งานทันที
  const [activate, setActivate] = useState(false);

  useEffect(() => {
    api
      .listPartners({ type: "CUSTOMER" })
      .then((r) => setCustomers(r.items))
      .catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    if (!customerId) {
      setSites([]);
      setSiteId("");
      return;
    }
    let cancelled = false;
    setSitesLoading(true);
    api
      .listCustomerSites(customerId, { activeOnly: true })
      .then((r) => {
        if (!cancelled) setSites(r.items);
      })
      .catch(() => {
        if (!cancelled) setSites([]);
      })
      .finally(() => {
        if (!cancelled) setSitesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

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
          <label htmlFor="ct-customerPicker">ลูกค้าจากฐานข้อมูล</label>
          <select
            id="ct-customerPicker"
            className="select"
            value={customerId}
            onChange={(e) => {
              const id = e.target.value;
              setCustomerId(id);
              const picked = customers.find((c) => c.id === id);
              if (picked) {
                setV((prev) => ({
                  ...prev,
                  customerName: picked.name,
                  customerPhone: picked.phone || prev.customerPhone,
                  customerAddress: picked.address || prev.customerAddress,
                }));
              }
            }}
          >
            <option value="">— ไม่เลือก (พิมพ์ชื่อเอง) —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="field-hint">
            เลือกจากที่นี่เพื่อให้สัญญาผูกกับลูกค้ารายเดียวกับที่ใช้ในใบงานและคลังเครื่อง
          </span>
        </div>

        <div className="field col-span">
          <label htmlFor="ct-customerName">
            ชื่อลูกค้า<span className="req">*</span>
          </label>
          <input
            id="ct-customerName"
            className="input"
            value={v.customerName}
            onChange={(e) => set("customerName", e.target.value)}
          />
          {errFor("customerName") ?? (
            <span className="field-hint">ชื่อที่จะพิมพ์ลงเอกสารสัญญา</span>
          )}
        </div>

        <div className="field col-span">
          <label htmlFor="ct-sitePicker">ร้าน / สาขาของลูกค้า</label>
          <select
            id="ct-sitePicker"
            className="select"
            value={siteId}
            disabled={!customerId || sitesLoading}
            onChange={(e) => {
              const id = e.target.value;
              setSiteId(id);
              const picked = sites.find((x) => x.id === id);
              if (picked) {
                set("siteAddress", picked.addressFull || picked.address || picked.label);
                if (picked.zone) set("zone", picked.zone);
              }
            }}
          >
            <option value="">
              {!customerId
                ? "— เลือกลูกค้าก่อน —"
                : sitesLoading
                  ? "กำลังโหลดสาขา…"
                  : sites.length === 0
                    ? "— ลูกค้ารายนี้ยังไม่มีสาขาในระบบ —"
                    : "— ไม่ระบุสาขา —"}
            </option>
            {sites.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label} (สาขา {x.branchNo})
              </option>
            ))}
          </select>
          <span className="field-hint">
            เลือกสาขาแล้วระบบจะเติม “ที่อยู่หน้างาน” และโซนบริการให้อัตโนมัติ
          </span>
        </div>

        <div className="field">
          <label>เบอร์โทร</label>
          <input className="input" value={v.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} inputMode="tel" />
        </div>

        <div className="field">
          <label>ที่อยู่ลูกค้า</label>
          <input className="input" value={v.customerAddress} onChange={(e) => set("customerAddress", e.target.value)} />
        </div>

        {/* ---- ที่อยู่ติดตั้งตามสัญญา — ใช้ตรวจว่าเครื่องยังอยู่ที่เดิมไหม ---- */}
        <div className="field col-span">
          <label style={{ fontWeight: 700 }}>ที่อยู่ติดตั้งตามสัญญา (ถ้าเว้นว่าง = ที่อยู่ลูกค้า)</label>
        </div>

        <div className="field col-span">
          <label>ที่อยู่หน้างาน</label>
          <input className="input" value={v.siteAddress} onChange={(e) => set("siteAddress", e.target.value)} placeholder="ที่อยู่ที่ติดตั้งเครื่องจริง" />
        </div>

        <div className="field">
          <label>โซนบริการ</label>
          <input className="input" list="contract-zone-options" value={v.zone} onChange={(e) => set("zone", e.target.value)} />
          <datalist id="contract-zone-options">
            {(options.zones ?? []).map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label>พิกัดหน้างาน (lat, lng)</label>
          <div className="toolbar" style={{ marginTop: 0 }}>
            <input
              className="input"
              type="number"
              step="any"
              value={v.siteLat}
              onChange={(e) => set("siteLat", e.target.value === "" ? 0 : Number(e.target.value))}
              placeholder="lat"
            />
            <input
              className="input"
              type="number"
              step="any"
              value={v.siteLng}
              onChange={(e) => set("siteLng", e.target.value === "" ? 0 : Number(e.target.value))}
              placeholder="lng"
            />
          </div>
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

      {isNew ? (
        <div className="alert alert-warn" style={{ marginTop: 16 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={activate}
              onChange={(e) => setActivate(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong>เปิดใช้งานสัญญาทันทีหลังสร้าง</strong>
              <div className="sub">
                ไม่ติ๊ก = บันทึกเป็น <strong>ร่างสัญญา</strong> ซึ่งยังไม่นับเป็นสัญญาที่ใช้งานอยู่
                และยอดค้างชำระยังไม่เข้ารายงาน — เปิดใช้งานภายหลังได้จากหน้ารายละเอียดสัญญา
              </div>
            </span>
          </label>
        </div>
      ) : null}

      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => onSubmit(v, activate)} disabled={busy}>
          {busy ? "กำลังบันทึก…" : isNew && activate ? "สร้างและเปิดใช้งาน" : submitLabel}
        </button>
      </div>
    </div>
  );
}
