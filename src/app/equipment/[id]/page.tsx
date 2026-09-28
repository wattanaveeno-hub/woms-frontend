"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Equipment, EquipmentFormValues, Options } from "@/lib/types";
import EquipmentForm from "@/components/EquipmentForm";
import { EquipmentStatusBadge, WarrantyBadge, NeedsSerialBadge, NoContractBadge } from "@/components/EquipmentBadges";
import EquipmentHistory from "@/components/EquipmentHistory";
import EquipmentTimeline from "@/components/EquipmentTimeline";
import EquipmentFinanceCard from "@/components/EquipmentFinanceCard";
import EquipmentPmCard from "@/components/EquipmentPmCard";
import { warrantyProviderLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { bangkokDateTime } from "@/lib/date";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { WomsErrorState, WomsFormSection, WomsKeyValue, WomsLoadingState, WomsPageHeader } from "@/components/woms";

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
    setLoadError(null);
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
        message: "การลบเครื่องย้อนกลับไม่ได้ — เครื่องที่เคยอยู่ในใบงาน แผน PM หรือสัญญาลบไม่ได้ ถ้าเลิกใช้งานแล้ว ให้ตั้งสถานะเป็น “ปลดระวาง” แทน",
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

  const back = (
    <Button component={Link} href="/equipment" startIcon={<ArrowBackIcon />}>
      คลังเครื่อง
    </Button>
  );

  if (loadError) {
    return (
      <>
        <WomsPageHeader title="ไม่พบเครื่อง" actions={back} />
        <WomsErrorState message={loadError} onRetry={load} />
      </>
    );
  }

  if (!eq || !options) return <WomsLoadingState rows={6} />;

  return (
    <>
      <WomsPageHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap component="span">
            <Box component="span" className="code" sx={{ fontSize: 20 }}>
              {eq.serial}
            </Box>
            <EquipmentStatusBadge status={eq.status} />
            <WarrantyBadge status={eq.warrantyStatus} />
            {eq.needsSerial ? <NeedsSerialBadge /> : null}
            {eq.rentalWithoutContract ? <NoContractBadge /> : null}
          </Stack>
        }
        subtitle={`รุ่น: ${eq.model || "—"}${eq.category ? ` · ${eq.category}` : ""}`}
        actions={back}
      />

      {eq.needsSerial ? (
        <Alert
          severity="warning"
          sx={{ mb: 2, alignItems: "center" }}
          action={
            has("equipment:edit") ? (
              <Button variant="contained" color="warning" onClick={setRealSerial} disabled={settingSerial}>
                {settingSerial ? "กำลังบันทึก…" : "ลง Serial จริง"}
              </Button>
            ) : undefined
          }
        >
          เครื่องนี้ยังไม่ได้ลง Serial จริง — ใช้เลขชั่วคราว <span className="mono">{eq.serial}</span>
        </Alert>
      ) : null}

      {/* สรุปข้อมูลเครื่อง: ประกัน · ผู้ถือครอง · ที่อยู่ */}
      <WomsFormSection title="ข้อมูลเครื่อง">
        <WomsKeyValue
          items={[
            ["ลูกค้า / ผู้ถือครอง", eq.customerId ? <Link href={`/partners/${eq.customerId}`}>{eq.customerName || "(ไม่ระบุชื่อ)"}</Link> : eq.customerName || "— อยู่ในคลัง —"],
            eq.siteLabel ? ["สาขา / ร้าน", eq.siteLabel] : null,
            ["ที่อยู่ปัจจุบัน", eq.addressFull || eq.location || "—"],
            [
              "ประกัน",
              eq.warranties.length ? (
                <Stack spacing={0.5}>
                  {eq.warranties.map((w, i) => (
                    <span key={i}>
                      {warrantyProviderLabel[w.provider]}
                      {w.providerName ? ` (${w.providerName})` : ""}: <span className="mono">{w.end || "—"}</span>{" "}
                      <WarrantyBadge status={w.status} />
                    </span>
                  ))}
                </Stack>
              ) : (
                "ยังไม่มีข้อมูลประกัน"
              ),
            ],
            eq.warehouse ? ["คลัง", eq.warehouse] : null,
            eq.supplier ? ["Supplier", eq.supplier] : null,
            eq.installDate ? ["วันที่ติดตั้ง", <span key="d" className="mono">{eq.installDate}</span>] : null,
            eq.zone ? ["โซน", eq.zone] : null,
            ["แก้ล่าสุด", <span key="u" className="mono">{bangkokDateTime(eq.updatedAt)}</span>],
          ]}
        />
      </WomsFormSection>

      <WomsFormSection title="แก้ไขข้อมูลเครื่อง">
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
              <Button color="error" variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={remove} disabled={deleting}>
                {deleting ? "กำลังลบ…" : "ลบเครื่อง"}
              </Button>
            ) : undefined
          }
        />
      </WomsFormSection>

      {/* รอบ PM — ค่าที่ derive ทั้งหมดมาจาก backend */}
      <EquipmentPmCard equipment={eq} onSaved={setEq} />

      <EquipmentFinanceCard equipmentId={id} />

      {/* ไทม์ไลน์รวม (ประวัติเครื่อง + ใบงาน) — แท็บและการกรองทำที่ backend */}
      <EquipmentTimeline equipment={eq} />

      {/* ประวัติดิบ + ฟอร์มย้ายเครื่อง + แก้หมายเหตุ — ของเดิม ไม่ถูกตัดออก */}
      <EquipmentHistory equipment={eq} options={options} onMoved={setEq} />
    </>
  );
}
