"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, ApprovalPendingError } from "@/lib/api";
import { pmPlanRows } from "@/lib/equipmentRules";
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
  // FB-04 ประเภท PM แถม/เช่า + จำนวนรอบ PM แถม + ระยะสัญญา PM เช่า
  const [pmMode, setPmMode] = useState<"" | "PACKAGE" | "RENTAL">((equipment.pmMode ?? "") as "" | "PACKAGE" | "RENTAL");
  const [rounds, setRounds] = useState(String(equipment.pmPackageRoundsTotal || ""));
  const [years, setYears] = useState(String(equipment.pmRentalYears || ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // D-10 (CORE-03): มีใบงาน PM ปิดแล้ว → วัน PM ล่าสุดมาจากใบงาน แก้ได้เฉพาะรอบ PM
  const baselineLocked = equipment.pmBaselineLocked === true;

  const save = async () => {
    const months = Number(interval || 0);
    if (!Number.isInteger(months) || months < 0) {
      setError("รอบ PM ต้องเป็นจำนวนเต็มไม่ติดลบ (0 = ยังไม่ตั้งรอบ)");
      return;
    }
    const r = Number(rounds || 0);
    const y = Number(years || 0);
    if (pmMode === "PACKAGE" && (!Number.isInteger(r) || r < 1)) return setError("PM แถมต้องระบุจำนวนรอบอย่างน้อย 1 รอบ");
    if (pmMode === "PACKAGE" && r < (equipment.pmPackageRoundsUsed ?? 0)) return setError(`จำนวนรอบต้องไม่น้อยกว่ารอบที่ใช้ไปแล้ว (${equipment.pmPackageRoundsUsed} รอบ)`);
    if (pmMode === "RENTAL" && (!Number.isInteger(y) || y < 1)) return setError("PM เช่าต้องระบุระยะสัญญาอย่างน้อย 1 ปี");
    if (pmMode && months < 1) return setError("ระบุความถี่ PM (ทุกกี่เดือน) อย่างน้อย 1 เดือน");
    setBusy(true);
    setError(null);
    try {
      const plan: Record<string, unknown> = { pmMode };
      if (pmMode === "PACKAGE") plan.pmPackageRoundsTotal = r;
      if (pmMode === "RENTAL") plan.pmRentalYears = y;
      const updated = await api.patchEquipment(
        equipment.id,
        (baselineLocked ? { pmIntervalMonths: months, ...plan } : { pmIntervalMonths: months, lastPmDate: lastPm, ...plan }) as any,
        equipment.updatedAt
      );
      onSaved(updated); // ค่าที่ derive ทั้งหมดมาจาก response ของ backend
      setOpen(false);
      toast.success("บันทึกข้อมูล PM แล้ว");
    } catch (e) {
      // Admin: ส่งคำขออนุมัติแล้ว — ไม่ใช่ error (D-16)
      if (e instanceof ApprovalPendingError) {
        setOpen(false);
        toast.info(e.message);
        return;
      }
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
              {open ? "ปิด" : notConfigured ? "ตั้ง PM" : "แก้ข้อมูล PM"}
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
          // MCH-02 (D-03): ประเภท PM · ระยะสัญญา (เช่า) · จำนวนรอบ/รอบคงเหลือ (Package) · ทุก N เดือน
          ...pmPlanRows(equipment).map(([k, val]) =>
            k === "รอบ PM" ? ([k, <strong key={k}>{val}</strong>] as [string, React.ReactNode]) : ([k, val] as [string, React.ReactNode])
          ),
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
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
            <TextField select label="ประเภท PM" value={pmMode} onChange={(e) => setPmMode(e.target.value as "" | "PACKAGE" | "RENTAL")} sx={{ minWidth: 180 }} SelectProps={{ native: true }} InputLabelProps={{ shrink: true }}>
              <option value="">ไม่ระบุ</option>
              <option value="PACKAGE">PM แถม (Package)</option>
              <option value="RENTAL">PM เช่า</option>
            </TextField>
            {pmMode === "PACKAGE" ? (
              <TextField
                label="จำนวนรอบ PM แถม"
                type="number"
                inputProps={{ min: Math.max(1, equipment.pmPackageRoundsUsed ?? 0), step: 1 }}
                value={rounds}
                onChange={(e) => setRounds(e.target.value)}
                helperText={`ใช้ไปแล้ว ${equipment.pmPackageRoundsUsed ?? 0} รอบ (นับจากใบงาน PM ที่ปิด)`}
              />
            ) : null}
            {pmMode === "RENTAL" ? (
              <TextField label="ระยะสัญญา PM เช่า (ปี)" type="number" inputProps={{ min: 1, step: 1 }} value={years} onChange={(e) => setYears(e.target.value)} />
            ) : null}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="ความถี่ PM — ทุกกี่เดือน"
              type="number"
              inputProps={{ min: 0, step: 1 }}
              value={interval}
              onChange={(e) => setIntervalMonths(e.target.value)}
              placeholder="เช่น 6"
              helperText="ใส่ 0 = ยังไม่ตั้งรอบ"
              error={!!error}
            />
            {baselineLocked ? (
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                วัน PM ล่าสุดมาจากใบงาน PM ที่ปิดแล้ว — ระบบเลื่อนให้เองเมื่อปิดใบงาน PM
              </Typography>
            ) : (
              <TextField
                label="วันที่ทำ PM ล่าสุด"
                type="date"
                value={lastPm}
                onChange={(e) => setLastPm(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="ใส่ไว้เป็นจุดตั้งต้นได้ — หลังจากนี้ระบบจะเลื่อนให้เองเมื่อปิดใบงาน PM"
              />
            )}
          </Stack>
          <Button variant="contained" onClick={save} disabled={busy} sx={{ mt: 2 }}>
            {busy ? "กำลังบันทึก…" : "บันทึกข้อมูล PM"}
          </Button>
        </Box>
      </Collapse>
    </WomsFormSection>
  );
}
