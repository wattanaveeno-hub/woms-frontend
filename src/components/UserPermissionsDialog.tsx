"use client";
/**
 * AUTH-01 สิทธิ์รายบุคคล — เพิ่ม/ตัดสิทธิ์ให้ผู้ใช้คนเดียว ไม่กระทบคนอื่นในบทบาทเดียวกัน
 * แสดงสิทธิ์ตามบทบาทเป็นฐาน · ติ๊ก "ตัด" สิทธิ์ที่บทบาทมี หรือ "เพิ่ม" สิทธิ์ที่บทบาทไม่มี (ในรายการที่ผู้แก้มอบต่อได้)
 * backend ตรวจกติกาซ้ำทุกข้อ (PUT /api/users/:id/permissions)
 */
import { useMemo, useState } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { api, ApiError, type PermUiGroup } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import { DEFAULT_UI_GROUPS, canDeny, canGrant, permLabel, type CatalogItem } from "@/lib/permissionUi";
import PermissionMatrix from "@/components/PermissionMatrix";

export default function UserPermissionsDialog({
  user,
  catalog,
  groups,
  basePermissions,
  delegable,
  actorIsDeveloper,
  onClose,
  onSaved,
}: {
  user: AuthUser;
  catalog: CatalogItem[];
  groups?: { key: PermUiGroup; label: string }[];
  /** สิทธิ์ตามบทบาทของผู้ใช้ (จาก GET /api/roles) */
  basePermissions: string[];
  /** สิทธิ์ที่ผู้แก้มอบต่อได้ (จาก GET /api/roles/catalog) */
  delegable?: string[];
  actorIsDeveloper: boolean;
  onClose: () => void;
  onSaved: (u: AuthUser) => void;
}) {
  const base = useMemo(() => new Set(basePermissions), [basePermissions]);
  const [grant, setGrant] = useState<Set<string>>(new Set(user.permissionOverrides?.grant ?? []));
  const [deny, setDeny] = useState<Set<string>>(new Set(user.permissionOverrides?.deny ?? []));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const effective = useMemo(() => {
    const s = new Set<string>([...base].filter((p) => !deny.has(p)));
    for (const p of grant) if (!deny.has(p)) s.add(p);
    return s;
  }, [base, grant, deny]);

  const rows = groups?.length ? groups : DEFAULT_UI_GROUPS;
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string, on: boolean) => {
    const n = new Set(set);
    if (on) n.add(key);
    else n.delete(key);
    setter(n);
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const u = await api.setUserPermissions(user.id, { grant: [...grant], deny: [...deny], expectedUpdatedAt: user.updatedAt || undefined });
      onSaved(u);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "บันทึกสิทธิ์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md" aria-labelledby="user-perm-title">
      <DialogTitle id="user-perm-title">สิทธิ์เฉพาะของ {user.name}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          ตั้งต้นจากสิทธิ์ของบทบาท แล้วเพิ่มหรือตัดเฉพาะคนนี้ · มีผลตั้งแต่คำขอถัดไปของผู้ใช้ · ไม่กระทบคนอื่นในบทบาทเดียวกัน
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
          <Chip size="small" color="success" variant="outlined" label={`เพิ่ม ${grant.size}`} />
          <Chip size="small" color="error" variant="outlined" label={`ตัด ${deny.size}`} />
          {grant.size || deny.size ? (
            <Button size="small" onClick={() => (setGrant(new Set()), setDeny(new Set()))}>
              กลับไปใช้สิทธิ์ตามบทบาท
            </Button>
          ) : null}
        </Stack>
        <PermissionMatrix items={catalog} groups={rows} held={effective} granted={grant} denied={deny} caption={`สิทธิ์ที่มีผลของ ${user.name}`} />
        <Box sx={{ mt: 2 }}>
          {rows.map((g) => {
            const items = catalog.filter((i) => (i.uiGroup ?? "settings") === g.key);
            if (!items.length) return null;
            const changed = items.filter((i) => grant.has(i.key) || deny.has(i.key)).length;
            return (
              <Accordion key={g.key} disableGutters variant="outlined">
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={{ fontWeight: 600 }}>{g.label}</Typography>
                  {changed ? <Chip size="small" sx={{ ml: 1 }} color="warning" label={`แก้ ${changed}`} /> : null}
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={0.5}>
                    {items.map((i) => {
                      const inRole = base.has(i.key);
                      return (
                        <Stack key={i.key} direction="row" alignItems="center" spacing={1} sx={{ minHeight: 36 }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ color: "text.primary" }}>
                              {permLabel(i.key)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" className="code">
                              {i.key} · {inRole ? "มีตามบทบาท" : "บทบาทไม่มี"}
                            </Typography>
                          </Box>
                          {inRole ? (
                            <FormControlLabel
                              control={
                                <Checkbox
                                  size="small"
                                  color="error"
                                  checked={deny.has(i.key)}
                                  disabled={!canDeny(i.key)}
                                  onChange={(e) => toggle(deny, setDeny, i.key, e.target.checked)}
                                />
                              }
                              label={canDeny(i.key) ? "ตัด" : "ตัดไม่ได้"}
                            />
                          ) : (
                            <FormControlLabel
                              control={
                                <Checkbox
                                  size="small"
                                  checked={grant.has(i.key)}
                                  disabled={!grant.has(i.key) && !canGrant(i.key, delegable, actorIsDeveloper)}
                                  onChange={(e) => toggle(grant, setGrant, i.key, e.target.checked)}
                                />
                              }
                              label={grant.has(i.key) || canGrant(i.key, delegable, actorIsDeveloper) ? "เพิ่ม" : "มอบไม่ได้"}
                            />
                          )}
                        </Stack>
                      );
                    })}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          {"\u0022มอบไม่ได้\u0022"} = อยู่นอกรายการที่บทบาทของคุณมอบต่อได้ หรือเป็นสิทธิ์ขอบเขตข้อมูล (ดูทั้งหมด) · ตัดสิทธิ์จัดการผู้ใช้ให้เปลี่ยนบทบาทแทน
        </Typography>
        {err ? (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {err}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={save} disabled={busy}>
          {busy ? "กำลังบันทึก…" : "บันทึกสิทธิ์"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
