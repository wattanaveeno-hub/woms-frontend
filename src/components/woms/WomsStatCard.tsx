"use client";

// การ์ดตัวเลขสรุป — ถ้าส่ง onClick จะกดเพื่อกรองรายการได้ (active = ตัวกรองนี้เปิดอยู่)
// ใช้เฉพาะตัวเลขที่ API ส่งมา ไม่คำนวณ KPI ใหม่ในหน้าเว็บ
import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import type { StatusTone } from "./WomsStatusChip";

export function WomsStatCard({
  value,
  label,
  hint,
  tone = "neutral",
  active,
  onClick,
  href,
  unit,
  compact,
}: {
  value: React.ReactNode;
  label: string;
  hint?: string;
  tone?: StatusTone;
  active?: boolean;
  onClick?: () => void;
  /** กดแล้วไปหน้ารายการที่กรองไว้ (drill-down) */
  href?: string;
  /** หน่วยต่อท้ายตัวเลข (เสริม · เช่น "เครื่อง") */
  unit?: string;
  /** ตัวเลข 22px บนมือถือ (เสริม · ใช้เมื่อวางการ์ดแถวเดียวหลายใบบนจอแคบ) */
  compact?: boolean;
}) {
  const color = tone === "neutral" ? "text.primary" : `${tone}.main`;
  const body = (
    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 }, ...(compact ? { px: { xs: 1.25, sm: 2 }, py: { xs: 1, sm: 1.5 }, "&:last-child": { pb: { xs: 1, sm: 1.5 } } } : {}) }}>
      <Typography sx={{ fontSize: compact ? { xs: 22, sm: 26 } : 26, fontWeight: 700, lineHeight: 1.2, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
        {unit ? (
          <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, ml: 0.5, color: "inherit" }}>
            {unit}
          </Typography>
        ) : null}
      </Typography>
      <Typography variant="body2">{label}</Typography>
      {hint ? (
        <Typography variant="body2" sx={{ fontSize: 12 }}>
          {hint}
        </Typography>
      ) : null}
    </CardContent>
  );
  return (
    <Card sx={{ borderColor: active ? "primary.main" : undefined, borderWidth: active ? 2 : 1, height: "100%" }}>
      {href ? (
        <CardActionArea component={Link} href={href} sx={{ height: "100%" }}>
          {body}
        </CardActionArea>
      ) : onClick ? (
        <CardActionArea onClick={onClick} aria-pressed={!!active} sx={{ height: "100%" }}>
          {body}
        </CardActionArea>
      ) : (
        body
      )}
    </Card>
  );
}

/** กริดการ์ดสรุป: 2 คอลัมน์บนมือถือ → 4 บนแท็บเล็ต → ตามจำนวนบนจอใหญ่ */
export function WomsStatGrid({ children, max = 4, xs }: { children: React.ReactNode; max?: number; /** จำนวนคอลัมน์บนมือถือ (เสริม · ค่าเริ่มต้น 2 แล้ว 4 บนแท็บเล็ต) */ xs?: number }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: xs
          ? { xs: `repeat(${xs}, minmax(0, 1fr))`, lg: `repeat(${max}, minmax(0, 1fr))` }
          : { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)", lg: `repeat(${max}, 1fr)` },
        gap: xs ? { xs: 1, sm: 1.5 } : 1.5,
        mb: 2,
      }}
    >
      {children}
    </Box>
  );
}
