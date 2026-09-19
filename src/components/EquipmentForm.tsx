"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  CustomerSite,
  EquipmentFormValues,
  Partner,
  EquipmentStatus,
  Options,
  Warranty,
  WarrantyPreset,
  WarrantyProvider,
} from "@/lib/types";
import { equipmentStatusLabel, warrantyProviderLabel } from "@/lib/options";

const STATUSES: EquipmentStatus[] = ["IN_STOCK", "RESERVED", "RENTED", "SOLD", "REPAIR", "RETIRED"];
const PROVIDERS: WarrantyProvider[] = ["BRAND", "AGENT", "OTHER"];

const EMPTY: EquipmentFormValues = {
  serial: "",
  model: "",
  category: "",
  status: "IN_STOCK",
  customerName: "",
  customerId: "",
  siteId: "",
  supplier: "",
  warehouse: "",
  location: "",
  address: "",
  district: "",
  province: "",
  postcode: "",
  zone: "",
  inboundDate: "",
  lat: 0,
  lng: 0,
  warranties: [],
  note: "",
};

const EMPTY_WARRANTY: Warranty = {
  provider: "BRAND",
  providerName: "",
  start: "",
  months: 12,
  coverage: "",
  note: "",
};

function parseLatLng(s: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  return null;
}

// วันหมดประกัน = วันเริ่ม + จำนวนเดือน (คำนวณฝั่ง client เพื่อแสดงตัวอย่างทันที)
function warrantyEnd(start: string, months: number): string {
  if (!start || !months) return "—";
  const [y, m, d] = start.split("-").map(Number);
  if (!y || !m || !d) return "—";
  const t = new Date(Date.UTC(y, m - 1 + months, d));
  if (t.getUTCDate() !== d) t.setUTCDate(0);
  return t.toISOString().slice(0, 10);
}

export interface EquipmentFormProps {
  options: Options;
  initial?: Partial<EquipmentFormValues>;
  submitLabel: string;
  fieldError?: { field?: string; message: string } | null;
  busy?: boolean;
  onSubmit: (values: EquipmentFormValues) => void;
  extraActions?: React.ReactNode;
}

// ฟอร์มรับเครื่องเข้าคลัง — ตั้งใจให้กรอกสั้นที่สุด (8 ช่องบน)
// ข้อมูลที่อยู่/พิกัด/ประกันรายชุด ซ่อนไว้ใต้ "ข้อมูลเพิ่มเติม" กดเปิดเมื่อต้องใช้
export default function EquipmentForm({
  options,
  initial,
  submitLabel,
  fieldError,
  busy,
  onSubmit,
  extraActions,
}: EquipmentFormProps) {
  const [v, setV] = useState<EquipmentFormValues>({
    ...EMPTY,
    ...initial,
    warranties: (initial?.warranties ?? []).map((w) => ({ ...w })),
  });
  const [mapLink, setMapLink] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [presets, setPresets] = useState<WarrantyPreset[]>([]);
  // ---- ฐานข้อมูลลูกค้า: รายชื่อลูกค้า + สาขาของลูกค้าที่เลือก ----
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const isEdit = !!initial?.serial;

  useEffect(() => {
    api
      .listWarrantyPresets()
      .then((r) => setPresets(r.items))
      .catch(() => setPresets([]));
    // ผู้ใช้ที่ไม่มีสิทธิ์ดูคู่ค้าจะได้ 403 — ปล่อยให้รายการว่าง แล้วพิมพ์ชื่ออิสระแทน
    api
      .listPartners({ type: "CUSTOMER" })
      .then((r) => setCustomers(r.items))
      .catch(() => setCustomers([]));
  }, []);

  // โหลดสาขาใหม่ทุกครั้งที่เปลี่ยนลูกค้า
  useEffect(() => {
    if (!v.customerId) {
      setSites([]);
      return;
    }
    let cancelled = false;
    setSitesLoading(true);
    api
      .listCustomerSites(v.customerId, { activeOnly: true })
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
  }, [v.customerId]);

  const set = <K extends keyof EquipmentFormValues>(k: K, val: EquipmentFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  // ---- accessibility: ผูก label ↔ ช่องกรอก และผูกข้อความ validation เข้ากับช่องนั้น ----
  // id ตั้งจากชื่อฟิลด์ เพื่อให้ label/aria-describedby ชี้ถูกช่องเสมอ
  const fid = (field: string) => `eq-${field}`;
  const errId = (field: string) => `${fid(field)}-error`;

  const errFor = (field: string) =>
    fieldError && fieldError.field === field ? (
      <span className="field-error" id={errId(field)} role="alert">
        {fieldError.message}
      </span>
    ) : null;

  /** props ที่บอก screen reader ว่าช่องนี้ผิดพลาด และข้อความผิดพลาดอยู่ที่ไหน */
  const aria = (field: string) =>
    fieldError && fieldError.field === field
      ? { "aria-invalid": true as const, "aria-describedby": errId(field) }
      : {};

  const applyLink = () => {
    const r = parseLatLng(mapLink);
    if (r) setV((prev) => ({ ...prev, lat: r.lat, lng: r.lng }));
  };

  // ---- ประกัน ----
  const addWarranty = (provider: WarrantyProvider) =>
    setV((prev) => ({
      ...prev,
      warranties: [...prev.warranties, { ...EMPTY_WARRANTY, provider, start: prev.inboundDate }],
    }));

  const setWarranty = <K extends keyof Warranty>(i: number, k: K, val: Warranty[K]) =>
    setV((prev) => ({
      ...prev,
      warranties: prev.warranties.map((w, idx) => (idx === i ? { ...w, [k]: val } : w)),
    }));

  const removeWarranty = (i: number) =>
    setV((prev) => ({ ...prev, warranties: prev.warranties.filter((_, idx) => idx !== i) }));

  // ช่อง "อายุประกัน (เดือน)" แบบเร็ว — ผูกกับประกันชุดแรก และใช้วันรับเข้าคลังเป็นวันเริ่ม
  const quickMonths = v.warranties[0]?.months ?? 0;
  const setQuickMonths = (months: number) =>
    setV((prev) => {
      if (!months && prev.warranties.length <= 1) return { ...prev, warranties: [] };
      if (!prev.warranties.length) {
        return {
          ...prev,
          warranties: [{ ...EMPTY_WARRANTY, start: prev.inboundDate, months }],
        };
      }
      return {
        ...prev,
        warranties: prev.warranties.map((w, i) =>
          i === 0 ? { ...w, months, start: w.start || prev.inboundDate } : w
        ),
      };
    });

  // เปลี่ยนวันรับเข้าคลัง → เลื่อนวันเริ่มประกันที่ยังผูกกับวันเดิมตามไปด้วย
  const setInboundDate = (date: string) =>
    setV((prev) => ({
      ...prev,
      inboundDate: date,
      warranties: prev.warranties.map((w) =>
        !w.start || w.start === prev.inboundDate ? { ...w, start: date } : w
      ),
    }));

  const applyPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    setV((prev) => ({
      ...prev,
      warranties: preset.items.map((i) => ({
        provider: i.provider,
        providerName: i.providerName,
        start: prev.inboundDate,
        months: i.months,
        coverage: i.coverage,
        note: `จากโปรไฟล์ ${preset.name}`,
      })),
    }));
  };

  const defaultPreset = useMemo(() => presets.find((p) => p.isDefault), [presets]);

  return (
    <div>
      {fieldError && !fieldError.field ? (
        <div className="alert alert-error">{fieldError.message}</div>
      ) : null}

      <div className="form-grid">
        <div className="field">
          <label htmlFor={fid("serial")}>Serial</label>
          <input
            id={fid("serial")}
            {...aria("serial")}
            className="input"
            value={v.serial}
            onChange={(e) => set("serial", e.target.value)}
            placeholder="เว้นว่างได้ — ระบบจะออกเลขชั่วคราวให้"
          />
          {errFor("serial")}
          {!isEdit && !v.serial.trim() ? (
            <span className="m-sub">ยังไม่มี Serial ก็รับเข้าคลังได้ ระบบจะออกเลข TMP- ให้ แล้วขึ้นเตือนไว้ให้ตามลงทีหลัง</span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor={fid("model")}>
            รุ่นเครื่อง<span className="req">*</span>
          </label>
          <input
            id={fid("model")}
            {...aria("model")}
            className="input"
            list="equip-model-options"
            value={v.model}
            onChange={(e) => set("model", e.target.value)}
          />
          <datalist id="equip-model-options">
            {options.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          {errFor("model")}
        </div>

        <div className="field">
          <label htmlFor={fid("category")}>หมวดหมู่</label>
          {options.categories?.length ? (
            <select id={fid("category")} className="select" value={v.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">— เลือกหมวดหมู่ —</option>
              {options.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {v.category && !options.categories.includes(v.category) ? (
                <option value={v.category}>{v.category}</option>
              ) : null}
            </select>
          ) : (
            <input id={fid("category")} className="input" value={v.category} onChange={(e) => set("category", e.target.value)} placeholder="ตั้งรายการได้ที่ ข้อมูลพื้นฐาน → หมวดหมู่เครื่อง" />
          )}
        </div>

        <div className="field">
          <label htmlFor={fid("status")}>สถานะ</label>
          <select id={fid("status")} className="select" value={v.status} onChange={(e) => set("status", e.target.value as EquipmentStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {equipmentStatusLabel[s]}
              </option>
            ))}
          </select>
        </div>

        {/* ---- ผูกกับฐานข้อมูลลูกค้า (ระบบฐานข้อมูลลูกค้า) ----
            เลือกจากรายการ = ผูกด้วยรหัส ชื่อจะไม่หลุดเมื่อลูกค้าเปลี่ยนชื่อ
            ยังพิมพ์ชื่ออิสระได้สำหรับเครื่องเก่า/ลูกค้าที่ยังไม่ได้บันทึกในระบบ */}
        <div className="field">
          <label htmlFor={fid("customerId")}>ลูกค้า / ผู้ถือครอง</label>
          <select
            id={fid("customerId")}
            className="select"
            value={v.customerId}
            onChange={(e) => {
              const id = e.target.value;
              const p = customers.find((c) => c.id === id);
              set("customerId", id);
              set("siteId", "");
              if (p) set("customerName", p.name);
              if (!id) set("customerName", "");
            }}
          >
            <option value="">— เลือกจากฐานข้อมูลลูกค้า (เว้นว่างถ้าอยู่ในคลัง) —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {!v.customerId && (
            <input
              className="input"
              style={{ marginTop: 6 }}
              value={v.customerName}
              onChange={(e) => set("customerName", e.target.value)}
              placeholder="หรือพิมพ์ชื่อผู้ถือครองที่ยังไม่มีในระบบ"
            />
          )}
        </div>

        <div className="field">
          <label htmlFor={fid("siteId")}>สาขา / ร้าน / สถานที่ติดตั้ง</label>
          <select
            id={fid("siteId")}
            className="select"
            value={v.siteId}
            disabled={!v.customerId || sitesLoading}
            onChange={(e) => set("siteId", e.target.value)}
          >
            <option value="">
              {!v.customerId
                ? "— เลือกลูกค้าก่อน —"
                : sitesLoading
                  ? "กำลังโหลดสาขา…"
                  : sites.length
                    ? "— ไม่ระบุสาขา —"
                    : "— ลูกค้ารายนี้ยังไม่มีสาขา —"}
            </option>
            {sites.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={fid("inboundDate")}>วันที่รับเข้าคลัง</label>
          <input id={fid("inboundDate")} {...aria("inboundDate")} className="input" type="date" value={v.inboundDate} onChange={(e) => setInboundDate(e.target.value)} />
          {errFor("inboundDate")}
        </div>

        <div className="field">
          <label htmlFor={fid("supplier")}>Supplier</label>
          <input id={fid("supplier")} {...aria("supplier")} className="input" value={v.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="ผู้จัดจำหน่ายที่รับเครื่องเข้ามา" />
          {errFor("supplier")}
        </div>

        <div className="field">
          <label htmlFor={fid("quickMonths")}>อายุประกัน (เดือน)</label>
          <input
            id={fid("quickMonths")}
            className="input"
            type="number"
            min={0}
            inputMode="numeric"
            value={quickMonths}
            onChange={(e) => setQuickMonths(e.target.value === "" ? 0 : Number(e.target.value))}
          />
          <span className="m-sub">
            นับจากวันรับเข้าคลัง{v.inboundDate ? ` (${v.inboundDate})` : ""} · หมดประกัน{" "}
            {warrantyEnd(v.warranties[0]?.start || v.inboundDate, quickMonths)}
          </span>
        </div>

        {presets.length ? (
          <div className="field col-span">
            <label htmlFor={fid("preset")}>ใช้โปรไฟล์ประกันสำเร็จรูป</label>
            <div className="toolbar" style={{ marginTop: 0 }}>
              <select
                id={fid("preset")}
                className="select"
                style={{ flex: 1 }}
                defaultValue=""
                onChange={(e) => {
                  applyPreset(e.target.value);
                  e.currentTarget.value = "";
                }}
              >
                <option value="">— เลือกโปรไฟล์เพื่อเติมประกันให้อัตโนมัติ —</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.summary}
                    {p.isDefault ? " (ค่าตั้งต้น)" : ""}
                  </option>
                ))}
              </select>
              {defaultPreset ? (
                <button className="btn" type="button" onClick={() => applyPreset(defaultPreset.id)}>
                  ใช้ค่าตั้งต้น
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="field col-span">
          <button className="btn" type="button" onClick={() => setAdvanced((a) => !a)}>
            {advanced ? "▲ ซ่อนข้อมูลเพิ่มเติม" : "▼ ข้อมูลเพิ่มเติม (คลัง · ที่อยู่ · พิกัด · ประกันรายชุด)"}
          </button>
        </div>
      </div>

      {advanced ? (
        <div className="form-grid" style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor={fid("warehouse")}>คลังจัดเก็บ</label>
            {options.warehouses?.length ? (
              <select id={fid("warehouse")} className="select" value={v.warehouse} onChange={(e) => set("warehouse", e.target.value)}>
                <option value="">— เลือกคลัง —</option>
                {options.warehouses.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
                {v.warehouse && !options.warehouses.includes(v.warehouse) ? (
                  <option value={v.warehouse}>{v.warehouse}</option>
                ) : null}
              </select>
            ) : (
              <input className="input" value={v.warehouse} onChange={(e) => set("warehouse", e.target.value)} placeholder="ตั้งรายการได้ที่ ข้อมูลพื้นฐาน → คลังจัดเก็บ" />
            )}
          </div>

          <div className="field">
            <label htmlFor={fid("location")}>สถานที่ / ไซต์</label>
            <input id={fid("location")} className="input" value={v.location} onChange={(e) => set("location", e.target.value)} placeholder="เช่น หน้างานลูกค้า, โชว์รูม" />
          </div>

          <div className="field">
            <label htmlFor={fid("zone")}>โซนบริการ</label>
            <input id={fid("zone")} className="input" list="equip-zone-options" value={v.zone} onChange={(e) => set("zone", e.target.value)} placeholder="ใช้จัดคิวช่าง" />
            <datalist id="equip-zone-options">
              {(options.zones ?? []).map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>

          <div className="field" aria-hidden />

          <div className="field col-span">
            <label htmlFor={fid("address")}>ที่อยู่ (บ้านเลขที่ ถนน แขวง)</label>
            <input id={fid("address")} {...aria("address")} className="input" value={v.address} onChange={(e) => set("address", e.target.value)} />
            {errFor("address")}
          </div>

          <div className="field">
            <label htmlFor={fid("district")}>อำเภอ / เขต</label>
            <input id={fid("district")} className="input" value={v.district} onChange={(e) => set("district", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor={fid("province")}>จังหวัด</label>
            <input id={fid("province")} className="input" value={v.province} onChange={(e) => set("province", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor={fid("postcode")}>รหัสไปรษณีย์</label>
            <input id={fid("postcode")} {...aria("postcode")} className="input" inputMode="numeric" maxLength={5} value={v.postcode} onChange={(e) => set("postcode", e.target.value)} />
            {errFor("postcode")}
          </div>

          <div className="field" aria-hidden />

          <div className="field col-span">
            <label htmlFor={fid("mapLink")}>พิกัดแผนที่ (วางลิงก์ Google Maps แล้วกดดึง)</label>
            <div className="toolbar" style={{ marginTop: 0 }}>
              <input
                id={fid("mapLink")}
                className="input"
                style={{ flex: 1 }}
                value={mapLink}
                onChange={(e) => setMapLink(e.target.value)}
                placeholder="วางลิงก์ Google Maps หรือ 13.7563,100.5018"
              />
              <button className="btn" type="button" onClick={applyLink}>ดึงพิกัด</button>
            </div>
          </div>

          <div className="field">
            <label htmlFor={fid("lat")}>ละติจูด (lat)</label>
            <input id={fid("lat")} {...aria("lat")} className="input" type="number" step="any" value={v.lat} onChange={(e) => set("lat", e.target.value === "" ? 0 : Number(e.target.value))} />
            {errFor("lat")}
          </div>

          <div className="field">
            <label htmlFor={fid("lng")}>ลองจิจูด (lng)</label>
            <input id={fid("lng")} {...aria("lng")} className="input" type="number" step="any" value={v.lng} onChange={(e) => set("lng", e.target.value === "" ? 0 : Number(e.target.value))} />
            {errFor("lng")}
          </div>

          {/* ---- ประกันรายชุด ---- */}
          <div className="field col-span">
            <label style={{ fontWeight: 700 }}>ประกันรายชุด (แบรนด์ / ตัวแทน / อื่น ๆ)</label>
            <div className="toolbar" style={{ marginTop: 0 }}>
              {PROVIDERS.map((p) => (
                <button key={p} className="btn" type="button" onClick={() => addWarranty(p)}>
                  + {warrantyProviderLabel[p]}
                </button>
              ))}
            </div>
            {errFor("warranties")}
          </div>

          {v.warranties.map((w, i) => (
            <div className="field col-span" key={i}>
              <div className="card card-pad" style={{ display: "grid", gap: 8 }}>
                <div className="toolbar" style={{ marginTop: 0, justifyContent: "space-between" }}>
                  <strong>
                    {warrantyProviderLabel[w.provider]} #{i + 1}
                  </strong>
                  <button className="btn btn-danger" type="button" onClick={() => removeWarranty(i)}>
                    ลบ
                  </button>
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor={fid(`w${i}-provider`)}>ผู้รับประกัน</label>
                    <select
                      id={fid(`w${i}-provider`)}
                      className="select"
                      value={w.provider}
                      onChange={(e) => setWarranty(i, "provider", e.target.value as WarrantyProvider)}
                    >
                      {PROVIDERS.map((p) => (
                        <option key={p} value={p}>
                          {warrantyProviderLabel[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={fid(`w${i}-providerName`)}>ชื่อแบรนด์ / ตัวแทน</label>
                    <input id={fid(`w${i}-providerName`)} className="input" value={w.providerName} onChange={(e) => setWarranty(i, "providerName", e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor={fid(`w${i}-start`)}>วันเริ่มประกัน</label>
                    <input id={fid(`w${i}-start`)} className="input" type="date" value={w.start} onChange={(e) => setWarranty(i, "start", e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor={fid(`w${i}-months`)}>ระยะประกัน (เดือน)</label>
                    <input
                      id={fid(`w${i}-months`)}
                      className="input"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={w.months}
                      onChange={(e) => setWarranty(i, "months", e.target.value === "" ? 0 : Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={fid(`w${i}-coverage`)}>ขอบเขตความคุ้มครอง</label>
                    <input id={fid(`w${i}-coverage`)} className="input" value={w.coverage} onChange={(e) => setWarranty(i, "coverage", e.target.value)} placeholder="เช่น อะไหล่และค่าแรง" />
                  </div>
                  <div className="field">
                    <label htmlFor={fid(`w${i}-end`)}>หมดประกัน (คำนวณให้)</label>
                    <input id={fid(`w${i}-end`)} className="input" value={warrantyEnd(w.start, w.months)} readOnly />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="field col-span">
            <label htmlFor={fid("note")}>หมายเหตุ</label>
            <textarea id={fid("note")} className="textarea" value={v.note} onChange={(e) => set("note", e.target.value)} />
          </div>
        </div>
      ) : null}

      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => onSubmit(v)} disabled={busy}>
          {busy ? "กำลังบันทึก…" : submitLabel}
        </button>
        {extraActions}
      </div>
    </div>
  );
}
