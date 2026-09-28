"use client";

// ---------------------------------------------------------------------------
// ค้นหา / ตัวกรอง — รูปแบบเดียวทั้งระบบ
// ---------------------------------------------------------------------------
// เดสก์ท็อป: ตัวกรองวางเป็นแถวเดียวกับช่องค้นหา
// มือถือ: ปุ่ม "ตัวกรอง (n)" เปิด Drawer จากด้านล่าง — แถวตัวกรองไม่ล้นจอ
// คอมโพเนนต์นี้ไม่กรองข้อมูลเอง: ค่าที่ผู้ใช้เลือกส่งกลับให้หน้าไปเรียก API ตามเดิม
// (ตัวกรองจริงอยู่ฝั่งเซิร์ฟเวอร์ ไม่ใช่กรองเฉพาะหน้าที่เห็น)
import { useState } from "react";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";

export function WomsSearchBar({
  value,
  onChange,
  placeholder = "ค้นหา",
  label = "ค้นหา",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputProps={{ "aria-label": label }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: value ? (
          <InputAdornment position="end">
            <IconButton size="small" aria-label="ล้างคำค้น" onClick={() => onChange("")}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : undefined,
      }}
    />
  );
}

/**
 * search = ช่องค้นหา (แสดงเสมอ) · children = ตัวกรอง (inline บนจอใหญ่ / Drawer บนมือถือ)
 * activeCount = จำนวนตัวกรองที่ตั้งค่าอยู่ ใช้แสดงบนปุ่มมือถือ
 */
export function WomsFilterPanel({
  search,
  children,
  activeCount = 0,
  onClear,
}: {
  search?: React.ReactNode;
  children?: React.ReactNode;
  activeCount?: number;
  onClear?: () => void;
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("md"));
  const [open, setOpen] = useState(false);

  if (!mobile) {
    return (
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {search ? <Box sx={{ flex: "1 1 260px", minWidth: 220 }}>{search}</Box> : null}
        {children}
        {onClear && activeCount > 0 ? (
          <Button onClick={onClear} startIcon={<ClearIcon />}>
            ล้างตัวกรอง
          </Button>
        ) : null}
      </Stack>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        {search ? <Box sx={{ flex: 1, minWidth: 0 }}>{search}</Box> : null}
        {children ? (
          <Button
            variant="outlined"
            onClick={() => setOpen(true)}
            startIcon={
              <Badge badgeContent={activeCount} color="primary">
                <FilterListIcon />
              </Badge>
            }
            sx={{ flexShrink: 0 }}
          >
            ตัวกรอง
          </Button>
        ) : null}
      </Stack>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, p: 2, pb: 3 } }}
      >
        <Typography variant="h3" component="h2" sx={{ mb: 2 }}>
          ตัวกรอง
        </Typography>
        <Stack spacing={2}>{children}</Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
          {onClear ? (
            <Button fullWidth onClick={onClear}>
              ล้างทั้งหมด
            </Button>
          ) : null}
          <Button fullWidth variant="contained" size="large" onClick={() => setOpen(false)}>
            ดูผลลัพธ์
          </Button>
        </Stack>
      </Drawer>
    </Box>
  );
}

/**
 * ตัวกรองแบบเลือกค่า (ค่าว่าง = ทั้งหมด) ใช้ใน WomsFilterPanel
 * ถ้ายังไม่มีรายการตัวเลือก (โหลดข้อมูลหลักไม่สำเร็จ) จะเป็นช่องพิมพ์แทน เพื่อให้ยังกรองได้
 */
export function WomsSelectFilter({
  label,
  value,
  onChange,
  options,
  allLabel = "ทั้งหมด",
  freeTextFallback = false,
  minWidth = 150,
  noAll = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<string | { value: string; label: string }>;
  allLabel?: string;
  freeTextFallback?: boolean;
  minWidth?: number;
  /** true = ไม่มีตัวเลือก "ทั้งหมด" (ต้องเลือกค่าใดค่าหนึ่งเสมอ) */
  noAll?: boolean;
}) {
  if (freeTextFallback && options.length === 0) {
    return (
      <TextField label={label} value={value} onChange={(e) => onChange(e.target.value)} fullWidth={false} sx={{ minWidth }} />
    );
  }
  return (
    <TextField select label={label} value={value} onChange={(e) => onChange(e.target.value)} fullWidth={false} sx={{ minWidth }}>
      {noAll ? null : <MenuItem value="">{allLabel}</MenuItem>}
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        return (
          <MenuItem key={v} value={v}>
            {typeof o === "string" ? o : o.label}
          </MenuItem>
        );
      })}
    </TextField>
  );
}
