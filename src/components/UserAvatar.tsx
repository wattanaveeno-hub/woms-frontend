"use client";
// CHAT-AV01 รูปโปรไฟล์แบบ LINE — ไม่มีรูป/โหลดไม่ได้ = วงกลมสีประจำผู้ใช้ + อักษรแรกของชื่อ
import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import type { SxProps, Theme } from "@mui/material/styles";
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
