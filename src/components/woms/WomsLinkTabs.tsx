"use client";

// แท็บที่เป็นลิงก์ระหว่างหน้า (ENTECH DS .tabs) — ใช้รวมหน้าที่อยู่คนละ route ให้ดูเป็นชุดเดียว
import Link from "next/link";
import Box from "@mui/material/Box";
import { tokens as t } from "@/theme/tokens";

export function WomsLinkTabs({ tabs, current, ariaLabel }: { tabs: Array<{ href: string; label: string; show?: boolean }>; current: string; ariaLabel?: string }) {
  const shown = tabs.filter((x) => x.show !== false);
  if (shown.length < 2) return null;
  return (
    <Box component="nav" aria-label={ariaLabel} sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, borderBottom: `1px solid ${t.lineStrong}`, mb: 2 }}>
      {shown.map((x) => {
        const on = x.href === current;
        return (
          <Box
            key={x.href}
            component={Link}
            href={x.href}
            aria-current={on ? "page" : undefined}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              px: 2,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              color: on ? t.accentInk : t.slate2,
              borderBottom: `2px solid ${on ? t.accent : "transparent"}`,
              mb: "-1px",
              "&:hover": { color: t.ink, textDecoration: "none" },
            }}
          >
            {x.label}
          </Box>
        );
      })}
    </Box>
  );
}
