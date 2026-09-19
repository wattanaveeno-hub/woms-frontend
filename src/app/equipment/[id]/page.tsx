"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Equipment, EquipmentFormValues, Options } from "@/lib/types";
import EquipmentForm from "@/components/EquipmentForm";
import { EquipmentStatusBadge, WarrantyBadge, NeedsSerialBadge } from "@/components/EquipmentBadges";
import EquipmentHistory from "@/components/EquipmentHistory";
import EquipmentTimeline from "@/components/EquipmentTimeline";
import EquipmentFinanceCard from "@/components/EquipmentFinanceCard";
import EquipmentPmCard from "@/components/EquipmentPmCard";
import { warrantyProviderLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { bangkokDateTime } from "@/lib/date";

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { has } = useAuth();
  const toast = useToast();
  const dialog = useDialog();

  const [eq, setEq] = useState<Equipment | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingSerial, setSettingSerial] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, o] = await Promise.all([api.getEquipment(id), api.getOptions()]);
      setEq(e);
      setOptions(o);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (values: EquipmentFormValues) => {
    if (!eq) return;
    setBusy(true);
    setFieldError(null);
    try {
      const updated = await api.patchEquipment(id, values, eq.updatedAt);
      setEq(updated);
      toast.success("บันทึกแล้ว");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(e.message);
        load();
      } else if (e instanceof ApiError) {
        setFieldError({ field: e.field, message: e.message });
        toast.error(e.message);
      } else {
        setFieldError({ message: "บันทึกไม่สำเร็จ" });
        toast.error("บันทึกไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
    }
  };

  // ลง Serial จริงแทนเลขชั่วคราว (TMP-) — ระบบบันทึกไว้ในประวัติเครื่องให้ด้วย
  const setRealSerial = async () => {
    if (!eq || settingSerial) return;
    const serial = await dialog.prompt({
      title: "ลง Serial จริงของเครื่องนี้",
      message: `เลขชั่วคราวปัจจุบัน ${eq.serial} — เมื่อลง Serial จริงแล้วระบบจะบันทึกไว้ในประวัติเครื่อง`,
      label: "Serial จริง",
      help: "ตรงตามเลขที่ติดอยู่บนตัวเครื่อง · ห้ามซ้ำกับเครื่องอื่น (ไม่สนตัวพิมพ์เล็ก/ใหญ่)",
      required: true,
      confirmLabel: "ลง Serial",
    });
    if (serial === null) return;
    setSettingSerial(true);
    try {
      const updated = await api.setEquipmentSerial(id, serial.trim());
      setEq(updated);
      toast.success(`ลง Serial ${updated.serial} แล้ว`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ลง Serial ไม่สำเร็จ");
    } finally {
      setSettingSerial(false);
    }
  };

  const remove = async () => {
    if (!eq || deleting) return;
    if (
      !(await dialog.confirm({
        title: `ลบเครื่อง ${eq.serial}?`,
        message: "การลบเครื่องย้อนกลับไม่ได้ และประวัติของเครื่องจะหายไปด้วย — ถ้าเลิกใช้งานแล้ว ให้ตั้งสถานะเป็น “ปลดระวาง” แทน",
        confirmLabel: "ยืนยันลบเครื่อง",
        danger: true,
      }))
    )
      return;
    setDeleting(true);
    try {
      await api.deleteEquipment(id);
      toast.success(`ลบเครื่อง ${eq.serial} แล้ว`);
      router.push("/equipment");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ลบไม่สำเร็จ");
      setDeleting(false);
    }
  };

  if (loadError) {
    return (
      <>
        <div className="page-head">
          <h1>ไม่พบเครื่อง</h1>
        </div>
        <div className="alert alert-error">{loadError}</div>
        <Link href="/equipment" className="btn">
          ← กลับคลังเครื่อง
        </Link>
      </>
    );
  }

  if (!eq || !options) return <div className="state">กำลังโหลด…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="code" style={{ fontSize: 18 }}>{eq.serial}</span>
            <EquipmentStatusBadge status={eq.status} />
            <WarrantyBadge status={eq.warrantyStatus} />
            {eq.needsSerial ? <NeedsSerialBadge /> : null}
          </h1>
          <div className="detail-meta">
            <span>รุ่น: {eq.model || "—"}{eq.category ? ` · ${eq.category}` : ""}</span>
            {eq.warranties.length ? (
              eq.warranties.map((w, i) => (
                <span key={i}>
                  {warrantyProviderLabel[w.provider]}
                  {w.providerName ? ` (${w.providerName})` : ""}: <span className="mono">{w.end || "—"}</span>{" "}
                  <WarrantyBadge status={w.status} />
                </span>
              ))
            ) : (
              <span>ยังไม่มีข้อมูลประกัน</span>
            )}
            <span>ที่อยู่ปัจจุบัน: {eq.addressFull || eq.location || "—"}</span>
            {eq.warehouse ? <span>คลัง: {eq.warehouse}</span> : null}
            {eq.supplier ? <span>Supplier: {eq.supplier}</span> : null}
            {eq.zone ? <span>โซน: {eq.zone}</span> : null}
            <span>แก้ล่าสุด: <span className="mono">{bangkokDateTime(eq.updatedAt)}</span></span>
          </div>
        </div>
        <Link href="/equipment" className="btn">
          ← คลังเครื่อง
        </Link>
      </div>

      {eq.needsSerial ? (
        <div className="alert alert-warn" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span>
            เครื่องนี้ยังไม่ได้ลง Serial จริง — ใช้เลขชั่วคราว <span className="mono">{eq.serial}</span>
          </span>
          {has("equipment:edit") ? (
            <button className="btn btn-primary" onClick={setRealSerial} disabled={settingSerial}>
              {settingSerial ? "กำลังบันทึก…" : "ลง Serial จริง"}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="card card-pad">
        <EquipmentForm
          key={eq.updatedAt}
          options={options}
          initial={eq}
          submitLabel="บันทึกการแก้ไข"
          busy={busy}
          fieldError={fieldError}
          onSubmit={save}
          extraActions={
            has("equipment:delete") ? (
              <button className="btn btn-danger" onClick={remove} disabled={deleting}>
                {deleting ? "กำลังลบ…" : "ลบเครื่อง"}
              </button>
            ) : undefined
          }
        />
      </div>

      {/* รอบ PM — ค่าที่ derive ทั้งหมดมาจาก backend */}
      <EquipmentPmCard equipment={eq} onSaved={setEq} />

      {/* ไทม์ไลน์รวม (ประวัติเครื่อง + ใบงาน) — แท็บและการกรองทำที่ backend */}
      <EquipmentFinanceCard equipmentId={id} />

      <EquipmentTimeline equipment={eq} />

      {/* ประวัติดิบ + ฟอร์มย้ายเครื่อง + แก้หมายเหตุ — ของเดิม ไม่ถูกตัดออก */}
      <EquipmentHistory equipment={eq} options={options} onMoved={setEq} />
    </>
  );
}
