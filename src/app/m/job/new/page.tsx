"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { JobFormValues, JobType, Options } from "@/lib/types";
import { jobTypeLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { bangkokToday } from "@/lib/date";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MyLocationIcon from "@mui/icons-material/MyLocation";

const TYPES: JobType[] = ["INSTALL", "PM", "CM", "PM_CM", "REMOVE"];

// เปิดงานจากหน้างานด้วยมือถือ — ฟอร์มสั้น กรอกเท่าที่จำเป็น
export default function MobileNewJobPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [options, setOptions] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"jobName" | "technicianTeam" | "jobSubType", string>>>({});
  const [v, setV] = useState<JobFormValues>({
    jobType: "CM",
    jobSubType: "",
    jobName: "",
    technicianTeam: "",
    salesPerson: "",
    model: "",
    filterUnit: "",
    contactName: "",
    phone: "",
    jobDate: bangkokToday(), // วันนัดเริ่มต้น = วันทำงานไทย
    jobTime: new Date().toTimeString().slice(0, 5), // เวลาของเครื่องช่างที่หน้างาน
    mapLink: "",
    note: "",
  });

  useEffect(() => {
    api
      .getOptions()
      .then((o) => {
        setOptions(o);
        setV((prev) => ({
          ...prev,
          technicianTeam: prev.technicianTeam || user?.team || o.teams[0] || "",
        }));
      })
      .catch(() => setOptions(null));
  }, [user?.team]);

  const set = <K extends keyof JobFormValues>(k: K, val: JobFormValues[K]) => {
    setV((prev) => ({ ...prev, [k]: val }));
    setErrors((prev) => (k in prev ? { ...prev, [k]: undefined } : prev));
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("อุปกรณ์นี้ไม่รองรับ GPS");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        set("mapLink", `https://maps.google.com/?q=${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}`);
        toast.success("แนบพิกัดหน้างานแล้ว");
      },
      () => toast.error("อ่านตำแหน่งไม่ได้")
    );
  };

  const submit = async () => {
    // ตรวจที่ช่องกรอก (ค่าที่กรอกไว้ยังอยู่ครบ)
    const errs: typeof errors = {};
    if (!v.jobName.trim()) errs.jobName = "ต้องระบุชื่องาน";
    if (!v.technicianTeam.trim()) errs.technicianTeam = "ต้องระบุทีมช่าง";
    if (v.jobType === "REMOVE" && !v.jobSubType) errs.jobSubType = "งานซ่อมถอนต้องเลือกประเภทย่อย";
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error(Object.values(errs)[0]!);
    setBusy(true);
    try {
      const job = await api.createJob(v);
      toast.success(`เปิดงาน ${job.jobId} แล้ว`);
      router.push(`/m/job/${encodeURIComponent(job.jobId)}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "เปิดงานไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", py: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h1" sx={{ fontSize: 22 }}>
          เปิดงานใหม่
        </Typography>
        <Button component={Link} href="/m" startIcon={<ArrowBackIcon />}>
          กลับ
        </Button>
      </Stack>

      <Card component="form" noValidate onSubmit={(e: React.FormEvent) => { e.preventDefault(); submit(); }}>
        <CardContent>
          <Stack spacing={2}>
            <TextField select label="ประเภทงาน" required value={v.jobType} onChange={(e) => set("jobType", e.target.value as JobType)}>
              {TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {jobTypeLabel[t]}
                </MenuItem>
              ))}
            </TextField>

            {v.jobType === "REMOVE" ? (
              <TextField
                select
                label="ประเภทย่อย"
                required
                value={v.jobSubType}
                onChange={(e) => set("jobSubType", e.target.value as JobFormValues["jobSubType"])}
                error={!!errors.jobSubType}
                helperText={errors.jobSubType}
              >
                <MenuItem value="">— เลือก —</MenuItem>
                <MenuItem value="PICKUP_REPAIR">ยกเครื่องซ่อม</MenuItem>
                <MenuItem value="RETURN">ยกเครื่องคืน</MenuItem>
              </TextField>
            ) : null}

            <TextField
              label="ชื่องาน"
              required
              value={v.jobName}
              onChange={(e) => set("jobName", e.target.value)}
              placeholder="เช่น ซ่อมเครื่องกรองน้ำ ลูกค้า A"
              error={!!errors.jobName}
              helperText={errors.jobName}
            />

            <Autocomplete
              freeSolo
              options={options?.teams ?? []}
              inputValue={v.technicianTeam}
              onInputChange={(_, val) => set("technicianTeam", val)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="ทีมช่าง"
                  required
                  error={!!errors.technicianTeam}
                  helperText={errors.technicianTeam}
                />
              )}
            />

            <TextField
              label="Serial / เครื่อง"
              value={v.filterUnit}
              onChange={(e) => set("filterUnit", e.target.value)}
              helperText="พิมพ์เป็นข้อความได้ตามเดิม — ถ้าต้องผูกกับเครื่องในคลังหรือใส่หลายเครื่อง ทำที่หน้าใบงานบนเดสก์ท็อป"
            />

            <TextField label="ผู้ติดต่อ" value={v.contactName} onChange={(e) => set("contactName", e.target.value)} />
            <TextField
              label="เบอร์โทร"
              type="tel"
              inputProps={{ inputMode: "tel" }}
              value={v.phone}
              onChange={(e) => set("phone", e.target.value)}
            />

            <Stack direction="row" spacing={1}>
              <TextField
                label="วันที่"
                type="date"
                value={v.jobDate}
                onChange={(e) => set("jobDate", e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="เวลา"
                type="time"
                value={v.jobTime}
                onChange={(e) => set("jobTime", e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>

            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                label="พิกัดหน้างาน"
                value={v.mapLink}
                onChange={(e) => set("mapLink", e.target.value)}
                placeholder="ลิงก์แผนที่"
              />
              <Button
                variant="outlined"
                onClick={useMyLocation}
                startIcon={<MyLocationIcon />}
                sx={{ flexShrink: 0, minHeight: 40 }}
              >
                ตำแหน่งฉัน
              </Button>
            </Stack>

            <TextField label="หมายเหตุ" multiline minRows={3} value={v.note} onChange={(e) => set("note", e.target.value)} />

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={busy}
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {busy ? "กำลังเปิดงาน…" : "เปิดงาน"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
