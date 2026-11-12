"use client";
// CHAT-AV01 รูปโปรไฟล์แบบ LINE — ไม่มีรูป/โหลดไม่ได้ = วงกลมสีประจำผู้ใช้ + อักษรแรกของชื่อ
import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { alpha, type SxProps, type Theme } from "@mui/material/styles";
import { markAvatarBroken, useAvatarUrl } from "@/lib/avatarStore";
import { avatarColorOf, initialsOf } from "@/lib/chatSearchRules";

export default function UserAvatar(props: { userId: string; name: string; size?: number; sx?: SxProps<Theme> }) {
  const { userId, name, size = 36, sx } = props;
  const url = useAvatarUrl(userId);
  const [broken, setBroken] = useState<string | null>(null);
  const src = url && url !== broken ? url : undefined;
  return (
    <Avatar
      src={src}
      alt={name}
      slotProps={{
        img: {
          loading: "lazy",
          onError: () => {
            setBroken(url);
            markAvatarBroken(userId);
          },
        },
      }}
      sx={[{ width: size, height: size, bgcolor: avatarColorOf(userId), fontSize: Math.round(size * 0.45), fontWeight: 600 }, ...(Array.isArray(sx) ? sx : [sx])]}
      data-testid="user-avatar"
      data-user-id={userId}
    >
      {initialsOf(name)}
    </Avatar>
  );
}

/** CHAT-SYS01: รูปประจำตัวของข้อความที่ระบบส่ง (การ์ดคิว · เหตุการณ์ใบงาน) — แยกจากคนด้วยไอคอนและสีแบรนด์ */
export function SystemAvatar(props: { size?: number; sx?: SxProps<Theme> }) {
  const { size = 36, sx } = props;
  return (
    <Avatar
      alt="ระบบ WOMS"
      sx={[{ width: size, height: size, bgcolor: "primary.main", color: "primary.contrastText" }, ...(Array.isArray(sx) ? sx : [sx])]}
      data-testid="system-avatar"
    >
      <SmartToyOutlinedIcon sx={{ fontSize: Math.round(size * 0.58) }} />
    </Avatar>
  );
}

/** CHAT-SYS01: ชื่อผู้ส่งของข้อความระบบ — "ระบบ WOMS" + ป้าย "แจ้งอัตโนมัติ" */
export function SystemSenderLabel(props: { time: string }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }} data-testid="system-sender">
      <Typography component="span" variant="caption" sx={{ fontWeight: 700, color: "primary.main" }}>
        ระบบ WOMS
      </Typography>
      <Chip label="แจ้งอัตโนมัติ" size="small" sx={{ height: 18, fontSize: 11, bgcolor: (t) => alpha(t.palette.primary.main, 0.1), color: "primary.main", "& .MuiChip-label": { px: 0.75 } }} />
      <Typography component="span" variant="caption" color="text.secondary">
        · {props.time}
      </Typography>
    </Box>
  );
}
