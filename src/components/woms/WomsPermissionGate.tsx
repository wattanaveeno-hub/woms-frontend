"use client";

// ด่านสิทธิ์ระดับหน้า — ใช้กับการเปิด URL ตรง ๆ ของหน้าที่ผู้ใช้ไม่มีสิทธิ์
// เป็นเพียงการแสดงผล: การบังคับสิทธิ์จริงอยู่ที่ backend ทุก endpoint (หน้านี้ไม่ใช่ security boundary)
import Link from "next/link";
import Button from "@mui/material/Button";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useAuth } from "@/lib/AuthContext";
import { WomsEmptyState, WomsLoadingState } from "./WomsStates";

export function WomsPermissionGate({
  perm,
  anyOf,
  children,
  backHref = "/dashboard",
}: {
  perm?: string;
  anyOf?: string[];
  children: React.ReactNode;
  backHref?: string;
}) {
  const { status, has } = useAuth();
  if (status !== "authed") return <WomsLoadingState rows={2} />;
  const allowed = (perm ? has(perm) : true) && (anyOf ? anyOf.some((p) => has(p)) : true);
  if (!allowed) {
    return (
      <WomsEmptyState
        title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้"
        description="ถ้าคิดว่าควรเข้าถึงได้ กรุณาติดต่อผู้ดูแลระบบ"
        action={
          <Button component={Link} href={backHref} variant="outlined" startIcon={<LockOutlinedIcon />}>
            กลับหน้าหลัก
          </Button>
        }
      />
    );
  }
  return <>{children}</>;
}
