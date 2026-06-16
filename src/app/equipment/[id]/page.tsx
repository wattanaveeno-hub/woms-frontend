"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Equipment, EquipmentFormValues, Options } from "@/lib/types";
import EquipmentForm from "@/components/EquipmentForm";
import { EquipmentStatusBadge, WarrantyBadge } from "@/components/EquipmentBadges";
import { useToast } from "@/components/Toast";

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { has } = useAuth();
  const toast = useToast();

  const [eq, setEq] = useState<Equipment | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const remove = async () => {
    if (!eq || deleting) return;
    if (!confirm(`ลบเครื่อง ${eq.serial}?`)) return;
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
          </h1>
          <div className="detail-meta">
            <span>รุ่น: {eq.model || "—"}{eq.category ? ` · ${eq.category}` : ""}</span>
            <span>
              ประกันซัพพลายเออร์: <span className="mono">{eq.supplierWarrantyEnd || "—"}</span> <WarrantyBadge status={eq.supplierWarrantyStatus} />
            </span>
            <span>
              ประกันลูกค้า: <span className="mono">{eq.customerWarrantyEnd || "—"}</span> <WarrantyBadge status={eq.customerWarrantyStatus} />
            </span>
            <span>แก้ล่าสุด: <span className="mono">{eq.updatedAt.slice(0, 16).replace("T", " ")}</span></span>
          </div>
        </div>
        <Link href="/equipment" className="btn">
          ← คลังเครื่อง
        </Link>
      </div>

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
    </>
  );
}
