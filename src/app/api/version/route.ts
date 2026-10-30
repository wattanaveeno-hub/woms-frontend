// commit ที่ deploy จริงของหน้าเว็บ — Vercel ตั้ง VERCEL_GIT_COMMIT_SHA ให้เอง (ใช้ยืนยัน SHA หลัง deploy)
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || "").trim() || "unknown";
  return NextResponse.json({ ok: true, service: "woms-frontend", commit });
}
