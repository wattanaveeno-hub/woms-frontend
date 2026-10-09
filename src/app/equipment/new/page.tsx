"use client";

import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { EquipmentFormValues, Options } from "@/lib/types";
import EquipmentForm from "@/components/EquipmentForm";
import EquipmentPasteDialog from "@/components/EquipmentPasteDialog";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import Stack from "@mui/material/Stack";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { WomsErrorState, WomsLoadingState, WomsPageHeader } from "@/components/woms";

function NewEquipmentPageInner() {
  const router = useRouter();
  const toast = useToast();
  const [options, setOptions] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);
  // MCH-03 (D-02): วางข้อความ → เติมฟอร์ม (ยังไม่บันทึก) · key ใหม่ทุกครั้งเพื่อให้ฟอร์มรับค่าตั้งต้นชุดใหม่
  const [pasteOpen, setPasteOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ key: number; values: Partial<EquipmentFormValues> } | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const loadOptions = () => {
    setLoadError(null);
    api
      .getOptions()
      .then(setOptions)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "โหลดตัวเลือกไม่สำเร็จ"));
  };
  useEffect(loadOptions, []);

  const submit = async (values: EquipmentFormValues) => {
    setBusy(true);
    setFieldError(null);
    try {
      const eq = await api.createEquipment(values);
      toast.success(`เพิ่มเครื่อง ${eq.serial} แล้ว`);
      router.push(`/equipment/${eq.id}`);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldError({ field: e.field, message: e.message });
        toast.error(e.message);
      } else {
        setFieldError({ message: "บันทึกไม่สำเร็จ" });
        toast.error("บันทึกไม่สำเร็จ");
      }
      setBusy(false);
    }
  };

  return (
    <>
      <WomsPageHeader
        title="เพิ่มเครื่องเข้าคลัง"
        subtitle="บันทึก serial, รุ่น และข้อมูลรับประกัน"
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<ContentPasteIcon />} onClick={() => setPasteOpen(true)} disabled={!options}>
              วางข้อความ
            </Button>
            <Button component={Link} href="/equipment" startIcon={<ArrowBackIcon />}>
              คลังเครื่อง
            </Button>
          </Stack>
        }
      />
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        {options ? (
          <EquipmentForm
            key={prefill?.key ?? 0}
            mode="create"
            initial={prefill?.values}
            options={options}
            submitLabel="บันทึก"
            busy={busy}
            fieldError={fieldError}
            onSubmit={submit}
          />
        ) : loadError ? (
          <WomsErrorState message={loadError} onRetry={loadOptions} />
        ) : (
          <WomsLoadingState rows={4} />
        )}
      </Paper>
      <EquipmentPasteDialog
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onApply={(values) => {
          setPrefill((p) => ({ key: (p?.key ?? 0) + 1, values }));
          setPasteOpen(false);
          toast.info("เติมข้อมูลลงฟอร์มแล้ว — ตรวจแล้วกด “บันทึก”");
        }}
      />
    </>
  );
}

// เปิด URL ตรงโดยไม่มีสิทธิ์ → แสดงข้อความแทนฟอร์มที่บันทึกไม่ได้ (backend บังคับสิทธิ์อีกชั้นเสมอ)
export default function NewEquipmentPage() {
  return (
    <WomsPermissionGate perm="equipment:create" backHref="/equipment">
      <NewEquipmentPageInner />
    </WomsPermissionGate>
  );
}
