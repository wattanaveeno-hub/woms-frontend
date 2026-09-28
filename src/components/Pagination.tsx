"use client";

// ตัวแบ่งหน้ามาตรฐาน (MUI Pagination) — API เดิม ใช้ร่วมกันหลายหน้า
import { useEffect, useState } from "react";
import MuiPagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export function usePagination<T>(items: T[], size = 10) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [page, pageCount]);
  const pageItems = items.slice((page - 1) * size, page * size);
  return { page, setPage, pageCount, pageItems, total: items.length };
}

export default function Pagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      alignItems="center"
      justifyContent="space-between"
      sx={{ mt: 2 }}
    >
      <Typography variant="body2">ทั้งหมด {total} รายการ</Typography>
      <MuiPagination
        page={page}
        count={pageCount}
        onChange={(_, p) => onPage(p)}
        color="primary"
        shape="rounded"
        siblingCount={1}
        boundaryCount={1}
        getItemAriaLabel={(type, p) =>
          type === "page" ? `หน้า ${p}` : type === "previous" ? "ก่อนหน้า" : type === "next" ? "ถัดไป" : type === "first" ? "หน้าแรก" : "หน้าสุดท้าย"
        }
      />
    </Stack>
  );
}
