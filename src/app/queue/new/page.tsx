"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { BookingType, Contract, Options, SuggestedSlot } from "@/lib/types";
import { bookingTypeLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";

const TYPES: BookingType[] = ["DELIVERY", "REPAIR", "INSTALL", "PM", "PICKUP"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// จองคิว: กรอกหน้างาน → ระบบแนะนำคิวที่เร็วสุด/คุ้มเส้นทางสุด → เลือกแล้วยืนยัน
export default function NewBookingPage() {
  const router = useRouter();
  const toast = useToast();

  const [options, setOptions] = useState<Options | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedSlot[] | null>(null);
  const [selected, setSelected] = useState<SuggestedSlot | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState<BookingType>("DELIVERY");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [zone, setZone] = useState("");
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [serial, setSerial] = useState("");
  const [contractId, setContractId] = useState("");
  const [note, setNote] = useState("");
  const [from, setFrom] = useState(today());
  const [days, setDays] = useState(14);
  const [createJob, setCreateJob] = useState(true);

  useEffect(() => {
    api.getOptions().then(setOptions).catch(() => setOptions(null));
    api
      .listContracts({ status: "ACTIVE" })
      .then((r) => setContracts(r.items))
      .catch(() => setContracts([]));
  }, []);

  // เลือกสัญญา → เติมข้อมูลลูกค้า/ที่อยู่/พิกัด/โซน ให้อัตโนมัติ
  const onContract = (id: string) => {
    setContractId(id);
    const c = contracts.find((x) => x.id === id);
    if (!c) return;
    setCustomerName(c.customerName);
    setPhone(c.customerPhone);
    setAddress(c.siteAddressFull || c.customerAddress);
    setSerial(c.serial);
    if (c.zone) setZone(c.zone);
    if (c.siteLat) setLat(c.siteLat);
    if (c.siteLng) setLng(c.siteLng);
  };

  const search = async () => {
    setSearching(true);
    setSelected(null);
    try {
      const res = await api.suggestSlots({ zone, lat, lng, from, days, limit: 12 });
      setSuggestions(res.items);
      if (!res.items.length) toast.error("ไม่มีคิวว่างในช่วงที่เลือก — ให้ช่างเปิด slot เพิ่ม");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ค้นหาคิวไม่สำเร็จ");
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(Number(p.coords.latitude.toFixed(6)));
        setLng(Number(p.coords.longitude.toFixed(6)));
        toast.success("ดึงพิกัดแล้ว");
      },
      () => toast.error("ดึงพิกัดไม่สำเร็จ")
    );
  };

  const book = async () => {
    if (!selected) return toast.error("เลือกคิวก่อน");
    if (!customerName.trim()) return toast.error("ต้องระบุชื่อลูกค้า");
    setBusy(true);
    try {
      const b = await api.createBooking({
        slotId: selected.id,
        type,
        customerName,
        phone,
        address,
        lat,
        lng,
        serial,
        contractId,
        contractNo: contracts.find((c) => c.id === contractId)?.contractNo ?? "",
        note,
        createJob,
      });
      toast.success(`จองคิว ${b.bookingNo} วันที่ ${b.date} ${b.start} กับ ${b.techName} แล้ว`);
      router.push("/queue");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "จองคิวไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>จองคิว</h1>
          <div className="sub">ระบบจะแนะนำคิวที่เร็วที่สุดและอยู่ในเส้นทางเดียวกับงานอื่นของช่าง</div>
        </div>
        <Link href="/queue" className="btn">
          ← รายการคิว
        </Link>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <div className="field">
            <label>ประเภทงาน</label>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as BookingType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {bookingTypeLabel[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>อ้างอิงสัญญา (เติมข้อมูลให้อัตโนมัติ)</label>
            <select className="select" value={contractId} onChange={(e) => onContract(e.target.value)}>
              <option value="">— ไม่อ้างอิงสัญญา —</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractNo} · {c.customerName} {c.serial ? `· ${c.serial}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>ชื่อลูกค้า<span className="req">*</span></label>
            <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="field">
            <label>เบอร์โทร</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </div>

          <div className="field col-span">
            <label>ที่อยู่หน้างาน</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="field">
            <label>โซนบริการ</label>
            <input className="input" list="queue-zone-options" value={zone} onChange={(e) => setZone(e.target.value)} />
            <datalist id="queue-zone-options">
              {(options?.zones ?? []).map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>

          <div className="field">
            <label>Serial เครื่อง</label>
            <input className="input" value={serial} onChange={(e) => setSerial(e.target.value)} />
          </div>

          <div className="field">
            <label>พิกัดหน้างาน (ใช้จัดเส้นทาง)</label>
            <div className="toolbar" style={{ marginTop: 0 }}>
              <input className="input" type="number" step="any" value={lat} onChange={(e) => setLat(Number(e.target.value))} placeholder="lat" />
              <input className="input" type="number" step="any" value={lng} onChange={(e) => setLng(Number(e.target.value))} placeholder="lng" />
              <button className="btn" type="button" onClick={useMyLocation}>ตำแหน่งฉัน</button>
            </div>
          </div>

          <div className="field">
            <label>ค้นหาคิวตั้งแต่วันที่ / กี่วัน</label>
            <div className="toolbar" style={{ marginTop: 0 }}>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <input className="input" type="number" min={1} max={60} value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 90 }} />
            </div>
          </div>

          <div className="field col-span">
            <label>หมายเหตุ</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="toolbar">
          <button className="btn btn-primary" onClick={search} disabled={searching}>
            {searching ? "กำลังหาคิว…" : "หาคิวที่เร็วที่สุด"}
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
            <input type="checkbox" checked={createJob} onChange={(e) => setCreateJob(e.target.checked)} />
            เปิดใบงานให้อัตโนมัติเมื่อจองคิว
          </label>
        </div>
      </div>

      {suggestions ? (
        <div className="card">
          <div className="card-pad" style={{ paddingBottom: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>คิวที่แนะนำ ({suggestions.length})</h2>
          </div>
          {suggestions.length === 0 ? (
            <div className="state">ไม่มีคิวว่าง — ให้ช่างเปิด slot เพิ่มที่หน้า “ตาราง slot ช่าง”</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>เลือก</th>
                  <th>วันที่</th>
                  <th>เวลา</th>
                  <th>ช่าง</th>
                  <th>โซน</th>
                  <th>ว่าง</th>
                  <th>เหตุผลที่แนะนำ</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => (
                  <tr
                    key={s.id}
                    className="row-link"
                    onClick={() => setSelected(s)}
                    style={selected?.id === s.id ? { background: "#eaf4f4" } : undefined}
                  >
                    <td>
                      <input type="radio" readOnly checked={selected?.id === s.id} />
                    </td>
                    <td className="mono">{s.date}</td>
                    <td className="mono">{s.start}–{s.end}</td>
                    <td>{s.techName}</td>
                    <td>{s.zone || "ทุกโซน"}</td>
                    <td className="mono">{s.available}</td>
                    <td style={{ fontSize: 13 }}>{s.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {selected ? (
            <div className="card-pad">
              <div className="toolbar" style={{ marginTop: 0 }}>
                <button className="btn btn-primary" onClick={book} disabled={busy}>
                  {busy ? "กำลังจอง…" : `ยืนยันจองคิว ${selected.date} ${selected.start} (${selected.techName})`}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
