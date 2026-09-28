"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Equipment } from "@/lib/types";
import { PmBadge } from "@/components/EquipmentBadges";
import { setJobPrefill } from "@/lib/jobPrefill";
import { useToast } from "@/components/Toast";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WomsFormSection, WomsKeyValue } from "@/components/woms";

/**
 * การ์ด PM ของเครื่อง
 *
 * ค่าที่แสดงทั้งหมด (nextPmDate / pmStatus / pmDaysLeft) มาจาก backend
 * หน้าเว็บไม่คำนวณเองแม้แต่ค่าเดียว — แก้ได้เฉพาะ "รอบ PM" กับ "วัน PM ล่าสุด"
 */
export default function EquipmentPmCard({
  equipment,
  onSaved,
}: {
  equipment: Equipment;
  onSaved: (updated: Equipment) => void;
}) {
  const { has } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const canEdit = has("equipment:edit");
  const canCreateJob = has("jobs:create");

  const [open, setOpen] = useState(false);
  const [interval, setIntervalMonths] = useState(String(equipment.pmIntervalMonths || ""));
  const [lastPm, setLastPm] = useState(equipment.lastPmDate || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const months = Number(interval || 0);
    if (!Number.isInteger(months) || months < 0) {
      setError("รอบ PM ต้องเป็นจำนวนเต็มไม่ติดลบ (0 = ยังไม่ตั้งรอบ)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patchEquipment(
        equipment.id,
        { pmIntervalMonths: months, lastPmDate: lastPm } as any,
        equipment.updatedAt
      );
      onSaved(updated); // ค่าที่ derive ทั้งหมดมาจาก response ของ backend
      setOpen(false);
      toast.success("บันทึกรอบ PM แล้ว");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  // ส่งเครื่องนี้ไปหน้าเปิดงานพร้อมตั้งประเภทงานเป็น PM — ไม่บันทึกงานให้อัตโนมัติ
  const createPmJob = () => {
    setJobPrefill({ equipmentIds: [equipment.id], jobType: "PM" });
    router.push("/jobs/new");
  };

  const notConfigured = equipment.pmStatus === "NOT_CONFIGURED";

  return (
    <WomsFormSection
      title="การบำรุงรักษาตามรอบ (PM)"
      titleAdornment={<PmBadge status={equipment.pmStatus} />}
      actions={
        <>
          {canCreateJob ? (
            <Button variant="outlined" onClick={createPmJob}>
              สร้างงาน PM
            </Button>
          ) : null}
          {canEdit ? (
            <Button onClick={() => setOpen((o) => !o)} disabled={busy} aria-expanded={open}>
              {open ? "ปิด" : notConfigured ? "ตั้งรอบ PM" : "แก้รอบ PM"}
            </Button>
          ) : null}
        </>
      }
    >
      {error ? (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      ) : null}

      <WomsKeyValue
        items={[
          ["รอบ PM", <strong key="i">{equipment.pmIntervalMonths > 0 ? `ทุก ${equipment.pmIntervalMonths} เดือน` : "ยังไม่ตั้ง"}</strong>],
          ["PM ล่าสุด", <span key="l" className="mono">{equipment.lastPmDate || "— ยังไม่เคยทำ —"}</span>],
          equipment.nextPmDate
            ? [
                "ครบกำหนดถัดไป",
                <span key="n">
                  <span className="mono">{equipment.nextPmDate}</span>{" "}
                  <Box component="span" sx={{ color: equipment.pmDaysLeft < 0 ? "error.main" : "text.secondary" }}>
                    ·{" "}
                    {equipment.pmDaysLeft >= 0
                      ? `เหลืออีก ${equipment.pmDaysLeft} วัน`
                      : `เกินกำหนดมาแล้ว ${Math.abs(equipment.pmDaysLeft)} วัน`}
                  </Box>
                </span>,
              ]
            : null,
        ]}
      />

      {notConfigured ? (
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          {equipment.pmIntervalMonths > 0
            ? "ตั้งรอบไว้แล้วแต่ยังไม่เคยบันทึกวันทำ PM — ระบบจะยังไม่นับว่าเกินกำหนด วันครบกำหนดจะเริ่มนับหลังปิดใบงาน PM ใบแรก (หรือกรอกวัน PM ล่าสุดไว้เป็นจุดตั้งต้น)"
            : "ยังไม่ได้ตั้งรอบ PM ของเครื่องนี้"}
        </Typography>
      ) : null}

      <Collapse in={open && canEdit} unmountOnExit>
        <Box sx={{ borderTop: 1, borderColor: "divider", mt: 2, pt: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="รอบ PM (เดือน)"
              type="number"
              inputProps={{ min: 0, step: 1 }}
              value={interval}
              onChange={(e) => setIntervalMonths(e.target.value)}
              placeholder="เช่น 6"
              helperText="ใส่ 0 = ยังไม่ตั้งรอบ"
              error={!!error}
            />
            <TextField
              label="วันที่ทำ PM ล่าสุด"
              type="date"
              value={lastPm}
              onChange={(e) => setLastPm(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="ใส่ไว้เป็นจุดตั้งต้นได้ — หลังจากนี้ระบบจะเลื่อนให้เองเมื่อปิดใบงาน PM"
            />
          </Stack>
          <Button variant="contained" onClick={save} disabled={busy} sx={{ mt: 2 }}>
            {busy ? "กำลังบันทึก…" : "บันทึกรอบ PM"}
          </Button>
        </Box>
      </Collapse>
    </WomsFormSection>
  );
}
