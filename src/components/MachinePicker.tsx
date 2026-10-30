"use client";

// FB-03 / FB-05 / FB-06 — ตัวเลือกเครื่องจากคลัง ใช้ร่วมกันทั้งหน้าเปิดคิวและหน้าเปิดงาน
// ลำดับ: ประเภทเครื่อง → รุ่น (เฉพาะรุ่นในประเภทนั้น) → เครื่องใหม่/เก่า (สถานะจากคลัง) → รายการ SN / รุ่น
// ค้น SN ได้ตั้งแต่แรกโดยไม่ต้องเลือกตัวกรองครบ · เปลี่ยนประเภทแล้วล้างรุ่นและผลที่ไม่สอดคล้อง
// เครื่องที่ยังไม่มี SN แสดง "Pending Serial" + รหัสเครื่องภายใน + รุ่น — เลือกแล้วอ้าง Machine Record เดิม ไม่สร้างเครื่องใหม่
import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid2";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import { api, ApiError } from "@/lib/api";
import type { MachinePickItem } from "@/lib/types";

export const MACHINE_TYPE_CHOICES = ["ตู้แช่", "เครื่องทำน้ำแข็ง", "อื่น ๆ"];

export default function MachinePicker({
  selectedIds,
  onPick,
  busy,
  pickLabel = "เลือก",
}: {
  /** เครื่องที่อยู่ในใบงาน/คิวนี้แล้ว — เลือกซ้ำไม่ได้ */
  selectedIds: string[];
  onPick: (item: MachinePickItem) => void;
  busy?: boolean;
  pickLabel?: string;
}) {
  const [machineType, setMachineType] = useState("");
  const [model, setModel] = useState("");
  const [condition, setCondition] = useState<"" | "NEW" | "USED">("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MachinePickItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [models, setModels] = useState<{ value: string; count: number }[]>([]);
  const [types, setTypes] = useState<string[]>(MACHINE_TYPE_CHOICES);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setErr(null);
    try {
      const r = await api.equipmentPicker({ machineType, model, condition, q: query, limit: 30 });
      if (my !== seq.current) return; // ผลเก่าที่มาช้า ไม่ทับผลใหม่
      setItems(r.items);
      setTotal(r.total);
      setModels(r.models);
      if (r.machineTypes?.length) setTypes(r.machineTypes);
    } catch (e) {
      if (my !== seq.current) return;
      setErr(e instanceof ApiError ? e.message : "โหลดรายการเครื่องไม่สำเร็จ");
      setItems([]);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [machineType, model, condition, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = new Set(selectedIds);

  return (
    <Box>
      {/* QUE-05 v2: ห้ามเป็น <form> ซ้อน — ตัวเลือกเครื่องอยู่ในฟอร์มเปิดคิว/เปิดงาน การกดค้นหา/Enter
          เคย submit ฟอร์มหลัก (สร้างคิวและเปลี่ยนหน้า) ทำให้ข้อมูลที่กรอกหายไป · ค้นหา = รีเฟรชเฉพาะผลค้นหา */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }} role="search">
        <TextField
          size="small"
          label="ค้นหา SN โดยตรง"
          placeholder="พิมพ์ SN / รหัสเครื่อง (ไม่ต้องเลือกตัวกรองก่อน)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              setQuery(q.trim());
            }
          }}
          inputProps={{ "data-testid": "picker-sn" }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        <Button type="button" variant="outlined" sx={{ flexShrink: 0 }} disabled={loading} onClick={() => setQuery(q.trim())}>
          ค้นหา
        </Button>
        {query ? (
          <Button onClick={() => { setQ(""); setQuery(""); }} sx={{ flexShrink: 0 }}>
            ล้างคำค้น
          </Button>
        ) : null}
      </Stack>

      <Grid container spacing={1.5} alignItems="center">
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="1. ประเภทเครื่อง"
            value={machineType}
            onChange={(e) => {
              // FB-03 ข้อ 5: เปลี่ยนประเภท → ล้างรุ่นและผลการเลือกที่ไม่สอดคล้อง
              setMachineType(e.target.value);
              setModel("");
              setItems(null);
            }}
            inputProps={{ "data-testid": "picker-type" }}
          >
            <MenuItem value="">ทุกประเภท</MenuItem>
            {types.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="2. รุ่น"
            value={models.some((m) => m.value === model) ? model : ""}
            onChange={(e) => setModel(e.target.value)}
            helperText={machineType ? `เฉพาะรุ่นในประเภท ${machineType}` : " "}
            inputProps={{ "data-testid": "picker-model" }}
          >
            <MenuItem value="">ทุกรุ่น</MenuItem>
            {models.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.value} ({m.count} เครื่อง)
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Typography variant="caption" component="div" sx={{ mb: 0.25 }}>
            3. เครื่องใหม่ / เครื่องเก่า
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={condition}
            onChange={(_, v) => v !== null && setCondition(v)}
            aria-label="สภาพเครื่อง"
          >
            <ToggleButton value="">ทั้งหมด</ToggleButton>
            <ToggleButton value="NEW">ใหม่</ToggleButton>
            <ToggleButton value="USED">เก่า</ToggleButton>
          </ToggleButtonGroup>
        </Grid>
      </Grid>

      {err ? (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {err}
        </Alert>
      ) : null}

      <Box sx={{ mt: 1.5 }} aria-live="polite" data-testid="picker-results">
        {loading && !items ? <Typography variant="body2">กำลังโหลด…</Typography> : null}
        {items && !items.length ? (
          <Alert severity="info">
            ไม่พบเครื่องตามตัวกรอง{query ? ` และคำค้น “${query}”` : ""} — ถ้าเป็นเครื่องที่ยังไม่รับเข้าคลัง ให้ใช้ “เพิ่มเครื่องที่ยังไม่มีในคลัง”
          </Alert>
        ) : null}
        {items?.map((e) => {
          const already = selected.has(e.id);
          return (
            <Stack
              key={e.id}
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ py: 1, borderTop: 1, borderColor: "divider" }}
              data-testid="picker-row"
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography component="div" sx={{ fontWeight: 600 }} className="code">
                  {e.display}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
                  {e.pendingSerial ? <Chip size="small" color="warning" label="Pending Serial" /> : null}
                  <Chip
                    size="small"
                    variant="outlined"
                    color={e.condition === "NEW" ? "success" : "default"}
                    label={e.conditionLabel}
                    title={e.conditionSource === "DERIVED" ? "อนุมานจากสถานะในคลัง" : "บันทึกไว้ที่ข้อมูลเครื่อง"}
                  />
                  {e.machineType ? <Chip size="small" variant="outlined" label={e.machineType} /> : null}
                  <Chip size="small" variant="outlined" label={e.statusLabel} />
                  {e.holderName ? (
                    <Typography variant="caption" sx={{ alignSelf: "center" }}>
                      ถือครอง: {e.holderName}
                    </Typography>
                  ) : null}
                </Stack>
              </Box>
              <Button size="small" variant={already ? "text" : "contained"} disabled={already || busy} onClick={() => onPick(e)}>
                {already ? "เลือกแล้ว" : pickLabel}
              </Button>
            </Stack>
          );
        })}
        {items && total > items.length ? (
          <Typography variant="caption" component="div" sx={{ mt: 1 }}>
            แสดง {items.length} จาก {total} เครื่อง — เลือกรุ่น/สภาพ หรือค้น SN เพื่อให้แคบลง
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
