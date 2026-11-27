"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError, ApprovalPendingError } from "@/lib/api";
import type { Partner, PartnerFormValues } from "@/lib/types";
import { partnerTypeLabel } from "@/lib/options";
import PartnerForm from "@/components/PartnerForm";
import CustomerSites from "@/components/CustomerSites";
import PartnerSalesOwner from "@/components/PartnerSalesOwner";
import CustomerStatCards from "@/components/CustomerStatCards";
import PartnerEquipment from "@/components/PartnerEquipment";
import PartnerDocuments from "@/components/PartnerDocuments";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { bangkokDateTime } from "@/lib/date";
import { useAuth } from "@/lib/AuthContext";
import { partnerBack, partnerBackFrom, type PartnerBackFrom } from "@/lib/partnerNav";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import {
  WomsCountTabs,
  WomsErrorState,
  WomsFormSection,
  WomsKeyValue,
  WomsLoadingState,
  WomsPageHeader,
  WomsPanel,
  WomsStatCard,
  WomsStatGrid,
} from "@/components/woms";

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
  // D-21: กลับไปหน้าที่มา (ฐานข้อมูลลูกค้า / รายการคู่ค้า)
  const [from, setFrom] = useState<PartnerBackFrom>("");
  // FB-22: โหมดดู/แก้ไขชัดเจน — เปิดจากปุ่ม "แก้ไข" ในรายการลูกค้า (?edit=1) หรือปุ่มบนหัวหน้า
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"equipment" | "sites" | "docs" | "info">("equipment");
  const [summary, setSummary] = useState<{ siteCount: number; equipmentCount: number } | null>(null);
  useEffect(() => {
    api.partnerSummary(id).then(setSummary).catch(() => setSummary(null));
  }, [id]);
  useEffect(() => {
    setFrom(partnerBackFrom(window.location.search));
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("edit") === "1") {
      setEditing(true);
      setTab("info");
      // เอา ?edit=1 ออกจากลิงก์ทันที — กดรีเฟรชหลังบันทึกแล้วจะไม่กลับเข้าโหมดแก้ไขเอง
      qs.delete("edit");
      const rest = qs.toString();
      router.replace(`${window.location.pathname}${rest ? `?${rest}` : ""}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const backTo = partnerBack(p?.type, from);

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
      setEditing(false);
      toast.success("บันทึกข้อมูลลูกค้าแล้ว — แสดงข้อมูลล่าสุด");
    } catch (e) {
      // D-16: Admin ส่งคำขออนุมัติแล้ว (202) — ไม่ใช่ error
      if (e instanceof ApprovalPendingError) {
        toast.info(e.message);
      } else if (e instanceof ApiError && e.status === 409) {
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
      router.push(backTo.href);
    } catch (e) {
      if (e instanceof ApprovalPendingError) toast.info(e.message);
      else toast.error(e instanceof ApiError ? e.message : "ลบไม่สำเร็จ");
      setDeleting(false);
    }
  };

  if (loadError) {
    return (
      <>
        <WomsPageHeader title="ไม่พบคู่ค้า" back={{ href: backTo.href, label: backTo.label }} />
        <WomsErrorState message={loadError} onRetry={load} />
      </>
    );
  }

  if (!p) return <WomsLoadingState rows={5} />;

  const kindLabel = p.customerKind ? ({ COMPANY: "บริษัท/นิติบุคคล", PERSON: "บุคคล", AGENCY: "หน่วยงาน" } as Record<string, string>)[p.customerKind] ?? p.customerKind : partnerTypeLabel[p.type];
  const startEdit = () => {
    setTab("info");
    setEditing(true);
    requestAnimationFrame(() => document.getElementById("partner-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <WomsPageHeader
        back={{ href: backTo.href, label: backTo.label.replace(/^กลับ(ไป)?/, "").trim() || "ลูกค้า" }}
        title={p.name}
        subtitle={
          <>
            {p.customerCode ? <span className="mono">{p.customerCode}</span> : "ไม่มีรหัสลูกค้า"}
            {` · ${kindLabel}`}
            {p.billingName ? ` · เปิดบิลในชื่อ ${p.billingName}` : ""}
            {p.taxId ? ` · เลขผู้เสียภาษี ${p.taxId}${p.taxBranch ? ` (${p.taxBranch})` : ""}` : ""}
            {p.customerType ? ` · ลูกค้า${p.customerType === "IN" ? "ใน" : "นอก"}` : ""}
            {" · แก้ล่าสุด "}
            <span className="mono">{bangkokDateTime(p.updatedAt)}</span>
          </>
        }
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {canEdit && !editing ? (
              <Button variant="outlined" startIcon={<EditIcon />} onClick={startEdit} data-testid="partner-edit">
                แก้ไข
              </Button>
            ) : null}
            {has("quotations:create") ? (
              <Button variant="outlined" component={Link} href="/quotations/new">
                ออกใบเสนอราคา
              </Button>
            ) : null}
            {has("jobs:create") ? (
              <Button variant="contained" component={Link} href="/jobs/new">
                เปิดงาน
              </Button>
            ) : null}
          </Stack>
        }
      />

      {/* ENTECH design: การ์ดสรุป 4 ช่อง (จำนวนสาขาแสดงที่แท็บ "สาขา") */}
      <CustomerStatCards partnerId={id} equipmentCount={summary ? summary.equipmentCount : null} />

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "flex-start" }}>
        <Box sx={{ flex: "3 1 560px", minWidth: 0 }}>
          <WomsCountTabs
            ariaLabel="ข้อมูลของลูกค้า"
            value={tab}
            onChange={(v) => setTab(v)}
            tabs={[
              { value: "equipment", label: "เครื่อง", count: summary?.equipmentCount },
              { value: "sites", label: "สาขา", count: summary?.siteCount },
              { value: "docs", label: "สัญญา & ใบเสนอราคา" },
              { value: "info", label: editing ? "แก้ไขข้อมูลลูกค้า" : "ข้อมูลลูกค้า" },
            ]}
          />
          {/* CUS-02 — สาขาที่เพิ่มจากหน้าเปิดใบงาน (JobForm) ใช้ API เดียวกัน จึงแสดงในแท็บสาขานี้ด้วย */}
          {tab === "equipment" ? <PartnerEquipment partnerId={id} /> : null}
          {tab === "sites" ? <CustomerSites partnerId={id} /> : null}
          {tab === "docs" ? <PartnerDocuments partnerId={id} /> : null}
          {tab === "info" ? (
            // การแก้ข้อมูลลูกค้า/สาขาไม่ย้อนไปแก้ใบงานเก่า (ใบงานเก็บชื่อ/ที่อยู่ ณ วันที่เปิดงาน)
            <WomsFormSection
              title={canEdit ? (editing ? "แก้ไขข้อมูลลูกค้า" : "ข้อมูลลูกค้า") : "ข้อมูลคู่ค้า (ดูอย่างเดียว)"}
              actions={
                canEdit && editing ? (
                  <Button onClick={() => setEditing(false)} disabled={busy}>
                    ยกเลิกการแก้ไข
                  </Button>
                ) : canEdit ? (
                  <Button variant="outlined" startIcon={<EditIcon />} onClick={startEdit}>
                    แก้ไข
                  </Button>
                ) : undefined
              }
            >
              <Box id="partner-form" />
              <PartnerForm
                key={`${p.updatedAt}-${editing}`}
                initial={p}
                partnerId={p.id}
                submitLabel="บันทึกการแก้ไข"
                busy={busy}
                fieldError={fieldError}
                onSubmit={save}
                readOnly={!canEdit || !editing}
                extraActions={
                  canDelete ? (
                    <Button color="error" variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={remove} disabled={deleting}>
                      {deleting ? "กำลังลบ…" : "ลบคู่ค้า"}
                    </Button>
                  ) : undefined
                }
              />
            </WomsFormSection>
          ) : null}
        </Box>
        <Box component="aside" sx={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <WomsPanel title="ผู้ติดต่อ">
            <WomsKeyValue
              items={[
                ["ผู้ติดต่อ", p.contactPerson || "—"],
                ["โทร", p.phone ? <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>{p.phone}</a> : "—"],
                ["อีเมล", p.email || "—"],
                ["ที่อยู่", p.address || "—"],
              ]}
            />
            {p.phone || p.address ? (
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                {p.phone ? (
                  <Button size="small" variant="outlined" href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} data-testid="partner-call">
                    โทร
                  </Button>
                ) : null}
                {p.address ? (
                  <Button
                    size="small"
                    variant="outlined"
                    data-testid="partner-copy-address"
                    onClick={() =>
                      navigator.clipboard
                        ?.writeText(p.address ?? "")
                        .then(() => toast.success("คัดลอกที่อยู่แล้ว"))
                        .catch(() => toast.error("คัดลอกไม่สำเร็จ"))
                    }
                  >
                    คัดลอกที่อยู่
                  </Button>
                ) : null}
              </Stack>
            ) : null}
          </WomsPanel>
          {p.note ? (
            <WomsPanel title="บันทึก">
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {p.note}
              </Typography>
            </WomsPanel>
          ) : null}
          <PartnerSalesOwner partnerId={id} />
        </Box>
      </Box>
    </>
  );
}
