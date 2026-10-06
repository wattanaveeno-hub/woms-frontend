"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Partner, PartnerFormValues } from "@/lib/types";
import { partnerTypeLabel } from "@/lib/options";
import PartnerForm from "@/components/PartnerForm";
import CustomerSites from "@/components/CustomerSites";
import PartnerEquipment from "@/components/PartnerEquipment";
import PartnerDocuments from "@/components/PartnerDocuments";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { bangkokDateTime } from "@/lib/date";
import { useAuth } from "@/lib/AuthContext";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { WomsErrorState, WomsFormSection, WomsLoadingState, WomsPageHeader } from "@/components/woms";

export default function PartnerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  // เดิมฟอร์มแก้ไขและปุ่มลบแสดงให้ทุกคน (Sale/viewer กดแล้วโดน 403) — แสดงตามสิทธิ์เดียวกับ backend
  const { has } = useAuth();
  const canEdit = has("partners:edit");
  const canDelete = has("partners:delete");

  const [p, setP] = useState<Partner | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
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
    if (
      !(await dialog.confirm({
        title: `ลบคู่ค้า ${p.name}?`,
        message: "การลบย้อนกลับไม่ได้ — ลบได้เฉพาะคู่ค้าที่ยังไม่มีสาขา เครื่อง ใบงาน สัญญา หรือใบเสนอราคาอ้างอิงอยู่",
        confirmLabel: "ยืนยันลบคู่ค้า",
        danger: true,
      }))
    )
      return;
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

  const back = (
    <Button component={Link} href="/partners" startIcon={<ArrowBackIcon />}>
      รายการคู่ค้า
    </Button>
  );
  if (loadError) {
    return (
      <>
        <WomsPageHeader title="ไม่พบคู่ค้า" actions={back} />
        <WomsErrorState message={loadError} onRetry={load} />
      </>
    );
  }

  if (!p) return <WomsLoadingState rows={5} />;

  return (
    <>
      <WomsPageHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center" component="span" flexWrap="wrap" useFlexGap>
            {p.customerCode ? <span className="mono">{p.customerCode}</span> : null}
            <span>{p.name}</span>
            <Chip size="small" variant="outlined" label={partnerTypeLabel[p.type]} />
            {p.customerKind ? (
              <Chip size="small" variant="outlined" label={p.customerKind === "COMPANY" ? "บริษัท/นิติบุคคล" : "บุคคล"} />
            ) : null}
          </Stack>
        }
        subtitle={
          <>
            แก้ล่าสุด <span className="mono">{bangkokDateTime(p.updatedAt)}</span>
          </>
        }
        actions={back}
      />

      {/* การแก้ข้อมูลลูกค้า/สาขาไม่ย้อนไปแก้ใบงานเก่า (ใบงานเก็บชื่อ/ที่อยู่ ณ วันที่เปิดงาน) */}
      <WomsFormSection title={canEdit ? "ข้อมูลคู่ค้า" : "ข้อมูลคู่ค้า (ดูอย่างเดียว)"}>
        <PartnerForm
          key={p.updatedAt}
          initial={p}
          submitLabel="บันทึกการแก้ไข"
          busy={busy}
          fieldError={fieldError}
          onSubmit={save}
          readOnly={!canEdit}
          extraActions={
            canDelete ? (
              <Button color="error" variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={remove} disabled={deleting}>
                {deleting ? "กำลังลบ…" : "ลบคู่ค้า"}
              </Button>
            ) : undefined
          }
        />
      </WomsFormSection>

      {/* CUS-02 — แยกการ์ด: ข้อมูลลูกค้าหลัก (ด้านบน) · สาขา (พร้อมเครื่องตาม SN ต่อสาขา) · เครื่องทั้งหมด · เอกสาร QUO/สัญญา
          สาขาที่เพิ่มจากหน้าเปิดใบงาน (JobForm) ใช้ API เดียวกัน จึงแสดงในการ์ดสาขานี้ด้วย */}
      <CustomerSites partnerId={id} />
      <PartnerEquipment partnerId={id} />
      <PartnerDocuments partnerId={id} />
      <Box />
    </>
  );
}
