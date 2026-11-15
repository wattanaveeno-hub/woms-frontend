"use client";

// Phase 7 (ENTECH design "Master"): รายการชนิดข้อมูลพื้นฐานด้านซ้าย + จำนวนรายการ · ลิงก์รุ่นเครื่อง/โปรไฟล์ประกัน
//   มือถือ (< md): เปลี่ยนเป็นแถบเลื่อนแนวนอนด้านบน (ตาม PROPOSED DESIGN /master/[kind])
import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { api } from "@/lib/api";
import { masterLabel } from "@/lib/options";
import type { MasterKind } from "@/lib/types";
import { tokens as t } from "@/theme/tokens";

export const MASTER_SIDE_KINDS: MasterKind[] = ["team", "zone", "warehouse", "salesperson", "pm_package"];

export function MasterSideList({ current }: { current: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    Promise.all(MASTER_SIDE_KINDS.map((k) => api.listMaster(k).then((r) => [k, r.items.length] as const).catch(() => [k, -1] as const))).then((rows) => {
      if (alive) setCounts(Object.fromEntries(rows));
    });
    return () => {
      alive = false;
    };
  }, []);
  const links = [
    ...MASTER_SIDE_KINDS.map((k) => ({ href: `/master/${k}`, label: masterLabel[k], count: counts[k] })),
    { href: "/master/equipment-models", label: "รุ่นเครื่อง →", count: undefined },
    { href: "/master/warranty-presets", label: "โปรไฟล์ประกัน →", count: undefined },
  ];
  return (
    <Paper
      variant="outlined"
      component="nav"
      aria-label="ชนิดข้อมูลพื้นฐาน"
      data-testid="master-side"
      sx={{
        overflow: "hidden",
        display: "flex",
        flexDirection: { xs: "row", md: "column" },
        overflowX: { xs: "auto", md: "hidden" },
        alignSelf: "start",
      }}
    >
      {links.map((l, i) => {
        const on = l.href === current;
        return (
          <Box
            key={l.href}
            component={Link}
            href={l.href}
            aria-current={on ? "page" : undefined}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
              minHeight: 48,
              px: 2,
              whiteSpace: "nowrap",
              borderTop: { md: i === 0 ? 0 : `1px solid ${t.line}` },
              borderLeft: { xs: i === 0 ? 0 : `1px solid ${t.line}`, md: 0 },
              fontWeight: on ? 700 : 500,
              color: on ? t.accentInk : t.ink,
              bgcolor: on ? "#e1f1e4" : "transparent",
              textDecoration: "none",
              "&:hover": { bgcolor: on ? "#e1f1e4" : "#f8fafb", textDecoration: "none" },
            }}
          >
            <span>{l.label}</span>
            {l.count !== undefined && l.count >= 0 ? <Box component="span" sx={{ fontSize: 13, color: t.slate2 }}>{l.count}</Box> : null}
          </Box>
        );
      })}
    </Paper>
  );
}

export function MasterLayout({ current, children }: { current: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "260px minmax(0,1fr)" }, gap: 2, alignItems: "start" }}>
      <MasterSideList current={current} />
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}
