"use client";
/**
 * ประวัติการแก้สิทธิ์ของบทบาทหลัก (17 พ.ย. 69) — ใครแก้ เมื่อไร เพราะอะไร · ต่างจากตั้งต้นตรงไหน
 *   "ย้อนการแก้นี้" / "คืนค่าตั้งต้น" เปิดหน้าแก้พร้อมร่างที่เตรียมไว้ แล้วผ่านการยืนยัน + เหตุผลแบบเดียวกับการแก้ปกติ
 */
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { api, ApiError, type RoleItem, type SystemRoleHistory, type SystemRoleHistoryEntry } from "@/lib/api";
import { permLabel } from "@/lib/permissionUi";
import { ChangeTag } from "@/components/PermissionPicker";

const fmt = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function RoleHistoryDialog({
  role,
  onClose,
  onRevert,
  onResetToBase,
}: {
  role: RoleItem;
  onClose: () => void;
  /** เปิดหน้าแก้ด้วยร่างที่ย้อนการแก้ครั้งนี้ */
  onRevert: (entry: SystemRoleHistoryEntry) => void;
  /** เปิดหน้าแก้ด้วยร่าง = ค่าตั้งต้น */
  onResetToBase: (base: string[]) => void;
}) {
  const [h, setH] = useState<SystemRoleHistory | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .systemRoleHistory(role.key)
      .then((r) => alive && setH(r))
      .catch((e) => alive && setErr(e instanceof ApiError ? e.message : "โหลดประวัติไม่สำเร็จ"));
    return () => {
      alive = false;
    };
  }, [role.key]);
  const canEdit = !!role.permissionsEditable;
  const diffCount = (h?.grant.length ?? 0) + (h?.deny.length ?? 0);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="role-history-title">
      <DialogTitle id="role-history-title">ประวัติการแก้สิทธิ์: {role.name}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {err ? <Alert severity="error">{err}</Alert> : null}
        {!h && !err ? <Typography sx={{ color: "#51626f" }}>กำลังโหลด…</Typography> : null}
        {h ? (
          <>
            <Typography sx={{ fontSize: 14, color: "#51626f", mt: -1 }}>
              ตั้งต้นจาก WOMS User Role Matrix · ปัจจุบัน{diffCount ? `ต่างจากตั้งต้น ${diffCount} จุด` : "ตรงตามตั้งต้นทุกช่อง"}
            </Typography>
            {diffCount ? (
              <Box sx={{ border: "1px solid #e2e7ec", borderRadius: "12px", px: 2, py: 1.5 }} data-testid="role-history-diff">
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#2e3f4f", mb: 0.5 }}>ต่างจากตั้งต้น</Typography>
                <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                  {h.grant.map((p) => (
                    <ChangeTag key={p} kind="add">
                      + {permLabel(p)}
                    </ChangeTag>
                  ))}
                  {h.deny.map((p) => (
                    <ChangeTag key={p} kind="del">
                      − {permLabel(p)}
                    </ChangeTag>
                  ))}
                </Box>
              </Box>
            ) : null}
            <Box sx={{ border: "1px solid #e2e7ec", borderRadius: "12px", overflow: "hidden" }}>
              {h.items.length === 0 ? (
                <Box sx={{ px: 2, py: 1.5, fontSize: 14, color: "#51626f" }}>ยังไม่เคยแก้ — สิทธิ์ตามตารางสิทธิ์ที่อนุมัติ</Box>
              ) : null}
              {h.items.map((e, i) => (
                <Box key={`${e.at}-${i}`} sx={{ px: 2, py: 1.5, borderTop: i ? "1px solid #e2e7ec" : 0, display: "flex", flexDirection: "column", gap: 0.75 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                    <Box sx={{ fontSize: 14 }}>
                      <b>{e.by || "-"}</b>{" "}
                      <Box component="span" sx={{ color: "#51626f", fontSize: 13 }}>
                        {e.reset ? "คืนค่าตั้งต้น · " : ""}เพิ่ม {e.added.length} · ตัด {e.removed.length}
                      </Box>
                    </Box>
                    <Box component="span" sx={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12, color: "#51626f" }}>
                      {fmt(e.at)}
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                    {e.added.map((p) => (
                      <ChangeTag key={`a-${p}`} kind="add">
                        + {permLabel(p)}
                      </ChangeTag>
                    ))}
                    {e.removed.map((p) => (
                      <ChangeTag key={`r-${p}`} kind="del">
                        − {permLabel(p)}
                      </ChangeTag>
                    ))}
                  </Box>
                  <Box sx={{ fontSize: 14 }}>เหตุผล: {e.reason}</Box>
                  {canEdit && i === 0 ? (
                    <Box>
                      <Button size="small" variant="outlined" color="inherit" onClick={() => onRevert(e)} data-testid="role-history-revert">
                        ย้อนการแก้นี้
                      </Button>
                    </Box>
                  ) : null}
                </Box>
              ))}
            </Box>
          </>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: "space-between" }}>
        <Box>
          {canEdit && h && diffCount ? (
            <Button color="error" variant="outlined" onClick={() => onResetToBase(h.basePermissions)} data-testid="role-history-reset">
              คืนค่าตั้งต้นทั้งบทบาท
            </Button>
          ) : null}
        </Box>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  );
}
