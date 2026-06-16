"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import MasterManager from "@/components/MasterManager";
import { masterLabel } from "@/lib/options";
import type { MasterKind } from "@/lib/types";

const VALID: MasterKind[] = ["team", "model"];

export default function MasterKindPage() {
  const params = useParams<{ kind: string }>();
  if (!VALID.includes(params.kind as MasterKind)) notFound();
  const kind = params.kind as MasterKind;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{masterLabel[kind]}</h1>
          <div className="sub">เพิ่ม แก้ไข หรือลบรายการ — มีผลกับตัวเลือกในฟอร์มเปิดงานทันที</div>
        </div>
        <Link href="/master" className="btn">
          ← ข้อมูลพื้นฐาน
        </Link>
      </div>

      <MasterManager kind={kind} />
    </>
  );
}
