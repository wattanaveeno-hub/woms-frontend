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
}: {
  value: React.ReactNode;
  label: string;
  hint?: string;
  tone?: StatusTone;
  active?: boolean;
  onClick?: () => void;
  /** กดแล้วไปหน้ารายการที่กรองไว้ (drill-down) */
  href?: string;
}) {
  const color = tone === "neutral" ? "text.primary" : `${tone}.main`;
  const body = (
    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
      <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color }}>{value}</Typography>
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
export function WomsStatGrid({ children, max = 4 }: { children: React.ReactNode; max?: number }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)", lg: `repeat(${max}, 1fr)` },
        gap: 1.5,
        mb: 2,
      }}
    >
      {children}
    </Box>
  );
}
