"use client";

// QUE-01 / INST-02 v2: ข้อมูลรายเครื่องในคิว (เครื่องกรอง · ประกันบริษัท · เงื่อนไข PM) เท่ากับหน้าเปิดงาน
// ส่งต่อแถวเครื่องของใบงานตอน Admin เปิด JN โดยไม่ต้องคีย์ใหม่ · กติกาเดียวกับ backend (lineFieldIssues)
//   ประกันบริษัทกรอกได้เฉพาะติดตั้งขาย · PM Package = จำนวนรอบ + ทุกกี่เดือน · PM เช่า = กี่ปี + ทุกกี่เดือน
// สัญญาเช่าไม่บังคับตอนส่งคิว — ผูกภายหลังในใบงานได้ (INST-02 / WF-01 ข้อ 6)
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import type { QueueItemInput } from "@/lib/serviceQueueApi";

const WARRANTY_JOB_TYPES = ["INSTALL_SALE", "INSTALL"];

export default function QueueItemExtras({
  item,
  index,
  jobType,
  onChange,
  error,
}: {
  item: QueueItemInput;
  index: number;
  jobType: string;
  onChange: (patch: Partial<QueueItemInput>) => void;
  error?: (field: string) => string | undefined;
}) {
  const n = (v: string) => (v === "" ? undefined : Math.max(0, Math.floor(Number(v.replace(/[^0-9]/g, "")) || 0)));
  const showWarranty = WARRANTY_JOB_TYPES.includes(jobType);
  const e = (f: string) => error?.(`items.${index}.${f}`);
  return (
    <Grid container spacing={1.5} sx={{ mt: 0.5 }} data-testid={`queue-item-extras-${index}`}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <TextField fullWidth size="small" label="เครื่องกรอง" value={item.filterUnit ?? ""} onChange={(ev) => onChange({ filterUnit: ev.target.value })} />
      </Grid>
      {showWarranty ? (
        <>
          <Grid size={{ xs: 6, sm: 2 }}>
            <TextField fullWidth size="small" label="ประกันบริษัท (เดือน)" inputProps={{ inputMode: "numeric" }} value={item.warrantyMonths ?? ""} onChange={(ev) => onChange({ warrantyMonths: n(ev.target.value) })} error={!!e("warrantyMonths")} helperText={e("warrantyMonths")} />
          </Grid>
          <Grid size={{ xs: 6, sm: 2.5 }}>
            <TextField fullWidth size="small" type="date" label="เริ่มนับประกัน" InputLabelProps={{ shrink: true }} value={item.warrantyStart ?? ""} onChange={(ev) => onChange({ warrantyStart: ev.target.value })} helperText="ไม่บังคับเท่าวันติดตั้ง" />
          </Grid>
        </>
      ) : null}
      <Grid size={{ xs: 12, sm: 3.5 }}>
        <TextField
          select
          fullWidth
          size="small"
          label="เงื่อนไข PM"
          value={item.pmMode ?? ""}
          onChange={(ev) => onChange({ pmMode: ev.target.value as QueueItemInput["pmMode"] })}
          inputProps={{ "data-testid": `queue-item-pm-mode-${index}` }}
        >
          <MenuItem value="">— ไม่ระบุ —</MenuItem>
          <MenuItem value="PACKAGE">PM แถม / Package</MenuItem>
          <MenuItem value="RENTAL">PM เช่า</MenuItem>
        </TextField>
      </Grid>
      {item.pmMode === "PACKAGE" ? (
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField fullWidth size="small" label="PM แถมกี่รอบ" inputProps={{ inputMode: "numeric" }} value={item.pmRounds ?? ""} onChange={(ev) => onChange({ pmRounds: n(ev.target.value) })} error={!!e("pmRounds")} helperText={e("pmRounds")} />
        </Grid>
      ) : null}
      {item.pmMode === "RENTAL" ? (
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField fullWidth size="small" label="ระยะสัญญา (ปี)" inputProps={{ inputMode: "numeric" }} value={item.pmYears ?? ""} onChange={(ev) => onChange({ pmYears: n(ev.target.value) })} error={!!e("pmYears")} helperText={e("pmYears")} />
        </Grid>
      ) : null}
      {item.pmMode ? (
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField fullWidth size="small" label="ทุกกี่เดือน" inputProps={{ inputMode: "numeric", "data-testid": `queue-item-pm-every-${index}` }} value={item.pmEveryMonths ?? ""} onChange={(ev) => onChange({ pmEveryMonths: n(ev.target.value) })} error={!!e("pmEveryMonths")} helperText={e("pmEveryMonths")} />
        </Grid>
      ) : null}
    </Grid>
  );
}
