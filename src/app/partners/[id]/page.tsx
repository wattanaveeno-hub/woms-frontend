"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Partner, PartnerFormValues } from "@/lib/types";
import { partnerTypeLabel } from "@/lib/options";
import PartnerForm from "@/components/PartnerForm";
import { useToast } from "@/components/Toast";

export default function PartnerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();

  const [p, setP] = useState<Partner | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setP(await api.getPartner(id));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (values: PartnerFormValues) => {
    if (!p) return;
    setBusy(true);
    setFieldError(null);
    try {
      const updated = await api.patchPartner(id, values, p.updatedAt);
      setP(updated);
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
    if (!p || deleting) return;
    if (!confirm(`ลบคู่ค้า ${p.name}?`)) return;
    setDeleting(true);
    try {
      await api.deletePartner(id);
      toast.success(`ลบคู่ค้า ${p.name} แล้ว`);
      router.push("/partners");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ลบไม่สำเร็จ");
      setDeleting(false);
    }
  };

  if (loadError) {
    return (
      <>
        <div className="page-head">
          <h1>ไม่พบคู่ค้า</h1>
        </div>
        <div className="alert alert-error">{loadError}</div>
        <Link href="/partners" className="btn">
          ← กลับรายการคู่ค้า
        </Link>
      </>
    );
  }

  if (!p) return <div className="state">กำลังโหลด…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {p.name}
            <span className="pill">{partnerTypeLabel[p.type]}</span>
          </h1>
          <div className="detail-meta">
            <span>แก้ล่าสุด: <span className="mono">{p.updatedAt.slice(0, 16).replace("T", " ")}</span></span>
          </div>
        </div>
        <Link href="/partners" className="btn">
          ← รายการคู่ค้า
        </Link>
      </div>

      <div className="card card-pad">
        <PartnerForm
          key={p.updatedAt}
          initial={p}
          submitLabel="บันทึกการแก้ไข"
          busy={busy}
          fieldError={fieldError}
          onSubmit={save}
          extraActions={
            <button className="btn btn-danger" onClick={remove} disabled={deleting}>
              {deleting ? "กำลังลบ…" : "ลบคู่ค้า"}
            </button>
          }
        />
      </div>
    </>
  );
}
