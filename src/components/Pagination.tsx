"use client";

import { useEffect, useState } from "react";

export function usePagination<T>(items: T[], size = 10) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [page, pageCount]);
  const pageItems = items.slice((page - 1) * size, page * size);
  return { page, setPage, pageCount, pageItems, total: items.length };
}

function range(page: number, count: number): (number | "...")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | "...")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(count - 1, page + 1);
  if (start > 2) out.push("...");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < count - 1) out.push("...");
  out.push(count);
  return out;
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
    <div className="pagination">
      <span className="pagination-info">ทั้งหมด {total} รายการ</span>
      <div className="pagination-controls">
        <button className="page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="ก่อนหน้า">
          ‹
        </button>
        {range(page, pageCount).map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="page-ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={`page-btn ${p === page ? "active" : ""}`}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          )
        )}
        <button className="page-btn" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label="ถัดไป">
          ›
        </button>
      </div>
    </div>
  );
}
