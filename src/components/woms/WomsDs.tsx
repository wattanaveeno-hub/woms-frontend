"use client";

// ---------------------------------------------------------------------------
// ชิ้นส่วนหน้าตาตาม ENTECH design system ที่หลายหน้าใช้ร่วมกัน (แสดงผลอย่างเดียว ไม่มี logic ข้อมูล)
//   WomsViewPills  — ปุ่มมุมมองแบบ pill (.view) พร้อมตัวเลข
//   WomsTwoLine    — ข้อความสองบรรทัดในเซลล์ตาราง (.two)
//   WomsCountTabs  — แท็บพร้อมตัวเลข (.tabs/.tab)
//   WomsPipeline   — แถบขั้นตอนพร้อมตัวเลข/ยอด (.pipe)
//   WomsPanel      — การ์ดหัวข้อ + เนื้อหา (.card + h2)
// ---------------------------------------------------------------------------
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens as t } from "@/theme/tokens";

export interface WomsViewOption<V extends string> {
  value: V;
  label: React.ReactNode;
  count?: number;
}

export function WomsViewPills<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: WomsViewOption<V>[];
  value: V;
  onChange: (v: V) => void;
  ariaLabel?: string;
}) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <ButtonBase
            key={o.value}
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            sx={{
              minHeight: 36,
              px: 2,
              borderRadius: 999,
              border: 1,
              borderColor: on ? t.ink : t.lineStrong,
              bgcolor: on ? t.ink : t.surface,
              color: on ? "#fff" : t.slate,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              gap: 1,
              "&:hover": { bgcolor: on ? t.ink : "#f0f3f6" },
              "&.Mui-focusVisible": { outline: `2px solid ${t.accent}`, outlineOffset: 2 },
            }}
          >
            {o.label}
            {typeof o.count === "number" ? (
              <Box component="span" sx={{ fontSize: 12, fontWeight: 700, opacity: on ? 0.85 : 0.7, fontVariantNumeric: "tabular-nums" }}>
                {o.count}
              </Box>
            ) : null}
          </ButtonBase>
        );
      })}
    </Stack>
  );
}

export function WomsTwoLine({ main, sub, href }: { main: React.ReactNode; sub?: React.ReactNode; href?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4 }}>{main}</Box>
      {sub ? <Box sx={{ color: t.slate2, fontSize: 13, lineHeight: 1.4 }}>{sub}</Box> : null}
    </Box>
  );
}

export function WomsCountTabs<V extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: WomsViewOption<V>[];
  value: V;
  onChange: (v: V) => void;
  ariaLabel?: string;
}) {
  return (
    <Box role="tablist" aria-label={ariaLabel} sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, borderBottom: `1px solid ${t.lineStrong}`, mb: 2 }}>
      {tabs.map((o) => {
        const on = o.value === value;
        return (
          <ButtonBase
            key={o.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            sx={{
              minHeight: 44,
              px: 2,
              gap: 1,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              color: on ? t.accentInk : t.slate2,
              borderBottom: `2px solid ${on ? t.accent : "transparent"}`,
              mb: "-1px",
              "&:hover": { color: t.ink },
              "&.Mui-focusVisible": { outline: `2px solid ${t.accent}`, outlineOffset: -2 },
            }}
          >
            {o.label}
            {typeof o.count === "number" ? (
              <Box component="span" sx={{ fontSize: 12, px: 1, borderRadius: 999, bgcolor: on ? t.accentBg : t.chip, color: on ? t.accentInk : t.slate }}>
                {o.count}
              </Box>
            ) : null}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export interface WomsPipeStep<V extends string> {
  value: V;
  label: React.ReactNode;
  count: React.ReactNode;
  detail?: React.ReactNode;
}

export function WomsPipeline<V extends string>({
  steps,
  value,
  onChange,
  ariaLabel,
}: {
  steps: WomsPipeStep<V>[];
  value: V;
  onChange: (v: V) => void;
  ariaLabel?: string;
}) {
  return (
    <Paper variant="outlined" sx={{ display: "flex", flexWrap: "wrap", overflow: "hidden", mb: 2 }} role="group" aria-label={ariaLabel}>
      {steps.map((s, i) => {
        const on = s.value === value;
        return (
          <ButtonBase
            key={s.value}
            aria-pressed={on}
            onClick={() => onChange(s.value)}
            sx={{
              flex: { xs: "1 1 30%", sm: "1 1 176px" },
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 0.5,
              p: { xs: 1.25, sm: 2 },
              textAlign: "left",
              fontFamily: "inherit",
              borderRight: i < steps.length - 1 ? `1px solid ${t.line}` : 0,
              bgcolor: on ? t.accentBg : t.surface,
              boxShadow: on ? `inset 0 -3px 0 ${t.accent}` : "none",
              "&:hover": { bgcolor: on ? t.accentBg : "#f8fafb" },
            }}
          >
            <Box component="span" sx={{ fontSize: 13, fontWeight: 500, color: t.slate }}>{s.label}</Box>
            <Box component="b" sx={{ fontSize: { xs: 20, sm: 26 }, lineHeight: 1.1, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: t.ink }}>{s.count}</Box>
            {s.detail ? <Box component="span" sx={{ fontSize: 13, color: t.slate2 }}>{s.detail}</Box> : null}
          </ButtonBase>
        );
      })}
    </Paper>
  );
}

export function WomsPanel({
  title,
  actions,
  children,
  pad = true,
  sx,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** false = เนื้อหาชิดขอบ (ตาราง/รายการ) */
  pad?: boolean;
  sx?: object;
}) {
  return (
    <Paper variant="outlined" sx={{ overflow: "hidden", ...sx }}>
      {title || actions ? (
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ px: 2, pt: 2, pb: pad ? 1 : 1.5 }}>
          {title ? <Typography variant="h2">{title}</Typography> : <span />}
          {actions ? <Stack direction="row" spacing={1}>{actions}</Stack> : null}
        </Stack>
      ) : null}
      <Box sx={pad ? { px: 2, pb: 2, pt: title ? 0 : 2 } : undefined}>{children}</Box>
    </Paper>
  );
}
