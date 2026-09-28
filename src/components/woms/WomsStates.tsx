"use client";

// สถานะมาตรฐานของหน้า: กำลังโหลด / ไม่มีข้อมูล / ผิดพลาด — ใช้ร่วมกันทุกโมดูล
// ข้อความผิดพลาดแสดงเฉพาะ message ที่อ่านได้ (ApiError) ไม่แสดง stack ของ backend
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";

export function WomsLoadingState({ rows = 4, label = "กำลังโหลด…" }: { rows?: number; label?: string }) {
  return (
    <Box role="status" aria-live="polite" aria-label={label} sx={{ py: 1 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 1 }} />
      ))}
    </Box>
  );
}

export function WomsEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ py: 5, px: 2, textAlign: "center" }}>
      <InboxOutlinedIcon sx={{ fontSize: 40, color: "text.disabled" }} aria-hidden />
      <Typography variant="h4" component="p" sx={{ mt: 1 }}>
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: 2 }}>{action}</Box> : null}
    </Paper>
  );
}

export function WomsErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      action={
        onRetry ? (
          <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={onRetry}>
            ลองใหม่
          </Button>
        ) : undefined
      }
    >
      {message}
    </Alert>
  );
}

/** หัวหน้าเพจ: ชื่อ + คำอธิบาย + ปุ่มหลัก (ปุ่มขึ้นบรรทัดใหม่บนมือถืออัตโนมัติ) */
export function WomsPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      alignItems={{ xs: "stretch", sm: "center" }}
      justifyContent="space-between"
      sx={{ my: 3 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h1">{title}</Typography>
        {subtitle ? (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {actions ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {actions}
        </Stack>
      ) : null}
    </Stack>
  );
}

/**
 * กลุ่มเนื้อหา / กลุ่มฟิลด์ — หัวข้อ (+ป้าย/ปุ่มด้านขวา) + เนื้อหา ใน Paper เดียวกัน
 * ใช้ทั้งในฟอร์มและการ์ดส่วนย่อยของหน้ารายละเอียด
 */
export function WomsFormSection({
  title,
  children,
  actions,
  titleAdornment,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  titleAdornment?: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" component="section" sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h3" component="h2">
            {title}
          </Typography>
          {titleAdornment}
        </Stack>
        {actions ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {actions}
          </Stack>
        ) : null}
      </Stack>
      {children}
    </Paper>
  );
}

/** รายการ "หัวข้อ: ค่า" — 2 คอลัมน์บนจอใหญ่ ซ้อนกันบนมือถือ */
export function WomsKeyValue({ items }: { items: Array<[React.ReactNode, React.ReactNode] | null | false | undefined> }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "minmax(120px, max-content) 1fr" },
        columnGap: 2,
        rowGap: { xs: 0.25, sm: 1 },
      }}
    >
      {items.filter(Boolean).map((it, i) => {
        const [k, v] = it as [React.ReactNode, React.ReactNode];
        return (
          <Box key={i} sx={{ display: "contents" }}>
            <Typography component="dt" variant="body2" sx={{ fontWeight: 600, mt: { xs: i ? 1 : 0, sm: 0 } }}>
              {k}
            </Typography>
            <Box component="dd" sx={{ m: 0, minWidth: 0, color: "text.primary", overflowWrap: "anywhere" }}>
              {v}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
