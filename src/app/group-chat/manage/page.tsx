"use client";

// ---------------------------------------------------------------------------
// CR-CH01 (CF v1.1 §8 · AC15) — จัดการทีมเซลล์และกลุ่มแชท (ผู้มีสิทธิ์ chat:moderate)
//   · ทีมเซลล์ = กลุ่มเช็คคิวของทีม (ระบบสร้างให้) · เซลล์อยู่ได้ทีมเดียว · ปิดทีมที่ยังมีคิวเปิดไม่ได้
//   · กลุ่มสร้างเอง: เพิ่ม/นำออก/เก็บถาวร — นำออกหรือเก็บถาวรต้องระบุเหตุผล · ทุกการเปลี่ยนแปลงมีประวัติ
//   D01 (ผู้จัดการกลุ่ม) / D03 (สมาชิกใหม่เห็นประวัติ) ใช้ข้อเสนอในเอกสาร — รอ Owner ยืนยัน
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, GroupEventView, SalesTeamView, UserGroupView } from "@/lib/api";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WomsErrorState, WomsFormSection, WomsLoadingState, WomsPageHeader } from "@/components/woms";

type Person = { id: string; name: string; role: string };
type Editing =
  | { kind: "team"; item: SalesTeamView | null }
  | { kind: "group"; item: UserGroupView | null };

const ACTION_LABEL: Record<string, string> = {
  CREATE: "สร้าง",
  UPDATE: "แก้ไข",
  MEMBERS: "เปลี่ยนสมาชิก",
  RENAME: "เปลี่ยนชื่อ",
  ACTIVE: "เปิด/ปิดทีม",
  ARCHIVE: "เก็บถาวร",
};

function memberDiff(ev: GroupEventView): string {
  const b = ((ev.before as any)?.memberIds ?? []) as string[];
  const a = ((ev.after as any)?.memberIds ?? []) as string[];
  const add = a.filter((x) => !b.includes(x)).length;
  const rem = b.filter((x) => !a.includes(x)).length;
  return add || rem ? ` (+${add} / -${rem})` : "";
}

function errText(e: unknown, fallback: string): string {
  if (!(e instanceof ApiError)) return fallback;
  if (e.code === "SALES_TEAM_CONFLICT") return `${e.message} — เซลล์หนึ่งคนอยู่ได้ทีมเดียว`;
  if (e.code === "TEAM_HAS_OPEN_QUEUES") return `${e.message} — ปิดหรือย้ายคิวที่ยังเปิดก่อน`;
  if (e.status === 409) return `${e.message} (ข้อมูลถูกแก้โดยผู้อื่น โปรดโหลดใหม่)`;
  return e.message;
}

export default function GroupManagePage() {
  const [teams, setTeams] = useState<SalesTeamView[] | null>(null);
  const [groups, setGroups] = useState<UserGroupView[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [history, setHistory] = useState<{ key: string; name: string; items: GroupEventView[] } | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [t, g, p] = await Promise.all([api.salesTeams(), api.customGroups(), api.groupMemberCandidates()]);
      setTeams(t.items);
      setGroups(g.items);
      setPeople(p.items);
    } catch (e) {
      setErr(errText(e, "โหลดข้อมูลไม่สำเร็จ"));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = useMemo(() => {
    const m = new Map(people.map((p) => [p.id, p.name]));
    return (id: string) => m.get(id) ?? id;
  }, [people]);

  const openHistory = async (key: string, name: string) => {
    try {
      const r = await api.groupEvents(key);
      setHistory({ key, name, items: r.items });
    } catch (e) {
      setErr(errText(e, "โหลดประวัติไม่สำเร็จ"));
    }
  };

  return (
    <>
      <WomsPageHeader title="ทีมเซลล์ & กลุ่มแชท" subtitle="จัดสมาชิกทีมเซลล์ (กลุ่มเช็คคิวของทีม) และกลุ่มแชทที่สร้างเอง" />
      {err ? <WomsErrorState message={err} onRetry={load} /> : null}
      {!teams && !err ? <WomsLoadingState /> : null}
      {teams ? (
        <>
          <WomsFormSection
            title={`ทีมเซลล์ (${teams.length})`}
            actions={<Button variant="contained" size="small" onClick={() => setEditing({ kind: "team", item: null })} data-testid="gm-new-team">สร้างทีม</Button>}
          >
            <Stack spacing={1}>
              {teams.map((t) => (
                <Paper key={t.id} variant="outlined" sx={{ p: 1.5 }} data-testid="gm-team">
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} justifyContent="space-between">
                    <div>
                      <Typography fontWeight={600}>
                        {t.name} {t.active ? null : <Chip size="small" label="ปิดแล้ว" />}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t.memberIds.length ? t.memberIds.map(nameOf).join(", ") : "ยังไม่มีสมาชิก"}
                      </Typography>
                    </div>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => setEditing({ kind: "team", item: t })}>แก้ไข</Button>
                      <Button size="small" onClick={() => openHistory(t.groupKey, t.name)}>ประวัติ</Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
              {!teams.length ? <Typography color="text.secondary">ยังไม่มีทีม — คิวทั้งหมดใช้กลุ่มเช็คคิวเดิม</Typography> : null}
            </Stack>
          </WomsFormSection>
          <WomsFormSection
            title={`กลุ่มแชทสร้างเอง (${groups.length})`}
            actions={<Button variant="outlined" size="small" onClick={() => setEditing({ kind: "group", item: null })} data-testid="gm-new-group">สร้างกลุ่ม</Button>}
          >
            <Stack spacing={1}>
              {groups.map((g) => (
                <Paper key={g.groupKey} variant="outlined" sx={{ p: 1.5 }} data-testid="gm-group">
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} justifyContent="space-between">
                    <div>
                      <Typography fontWeight={600}>
                        {g.name} {g.archived ? <Chip size="small" label="เก็บถาวร" /> : null}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">{g.memberIds.map(nameOf).join(", ")}</Typography>
                    </div>
                    <Stack direction="row" spacing={1}>
                      {!g.archived ? <Button size="small" onClick={() => setEditing({ kind: "group", item: g })}>แก้ไข</Button> : null}
                      <Button size="small" onClick={() => openHistory(g.groupKey, g.name)}>ประวัติ</Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </WomsFormSection>
        </>
      ) : null}
      {editing ? (
        <EditDialog
          editing={editing}
          people={people}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}
      <Dialog open={!!history} onClose={() => setHistory(null)} fullWidth maxWidth="sm">
        <DialogTitle>ประวัติ · {history?.name}</DialogTitle>
        <DialogContent>
          {(history?.items ?? []).map((ev, i) => (
            <Typography key={i} variant="body2" sx={{ mb: 1 }} data-testid="gm-event">
              {new Date(ev.at).toLocaleString("th-TH")} · {ev.actorName} · {ACTION_LABEL[ev.action] ?? ev.action}
              {memberDiff(ev)}
              {ev.reason ? ` · เหตุผล: ${ev.reason}` : ""}
            </Typography>
          ))}
          {history && !history.items.length ? <Typography color="text.secondary">ยังไม่มีประวัติ</Typography> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistory(null)}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function EditDialog({ editing, people, onClose, onSaved }: { editing: Editing; people: Person[]; onClose: () => void; onSaved: () => void }) {
  const isTeam = editing.kind === "team";
  const item = editing.item;
  const candidates = isTeam ? people.filter((p) => p.role === "sales") : people;
  const [name, setName] = useState(item?.name ?? "");
  const [members, setMembers] = useState<string[]>(item?.memberIds ?? []);
  const [active, setActive] = useState(editing.kind === "team" ? editing.item?.active ?? true : true);
  const [archive, setArchive] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const removed = item ? item.memberIds.filter((id) => !members.includes(id)) : [];
  const added = item ? members.filter((id) => !item.memberIds.includes(id)) : members;
  const deactivating = isTeam && item && editing.kind === "team" && editing.item!.active && !active;
  const needReason = isTeam || removed.length > 0 || archive;

  const save = async () => {
    if (!name.trim()) return setErr("ระบุชื่อ");
    if (needReason && !reason.trim()) return setErr("ระบุเหตุผล");
    setBusy(true);
    setErr(null);
    try {
      if (isTeam) {
        if (!item) await api.createSalesTeam({ name: name.trim(), memberIds: members, reason: reason.trim() });
        else await api.updateSalesTeam((item as SalesTeamView).id, { name: name.trim(), memberIds: members, active, expectedUpdatedAt: item.updatedAt, reason: reason.trim() });
      } else if (!item) {
        await api.createCustomGroup({ name: name.trim(), memberIds: members });
      } else {
        await api.updateCustomGroup((item as UserGroupView).groupKey, {
          name: name.trim(),
          add: added,
          remove: removed,
          ...(archive ? { archived: true } : {}),
          expectedUpdatedAt: item.updatedAt,
          reason: reason.trim(),
        });
      }
      onSaved();
    } catch (e) {
      setErr(errText(e, "บันทึกไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{item ? "แก้ไข" : "สร้าง"}{isTeam ? "ทีมเซลล์" : "กลุ่มแชท"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          <TextField label="ชื่อ" value={name} onChange={(e) => setName(e.target.value)} inputProps={{ maxLength: 80, "data-testid": "gm-name" }} required />
          <Autocomplete
            multiple
            options={candidates.map((p) => p.id)}
            value={members}
            onChange={(_e, v) => setMembers(v)}
            getOptionLabel={(id) => people.find((p) => p.id === id)?.name ?? id}
            renderInput={(p) => <TextField {...p} label={isTeam ? "สมาชิก (เซลล์)" : "สมาชิก"} />}
          />
          {isTeam && item ? <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label="ทีมเปิดใช้งาน" /> : null}
          {!isTeam && item ? <FormControlLabel control={<Switch checked={archive} onChange={(e) => setArchive(e.target.checked)} />} label="เก็บถาวรกลุ่มนี้ (ส่งข้อความไม่ได้ ประวัติยังอยู่)" /> : null}
          {removed.length ? <Alert severity="info">นำออก {removed.length} คน — จะเข้ากลุ่ม ไฟล์แนบ และผลค้นหาไม่ได้ทันที</Alert> : null}
          {deactivating ? <Alert severity="warning">ปิดทีมได้เมื่อไม่มีคิวที่ยังเปิดของทีมนี้</Alert> : null}
          {needReason ? <TextField label="เหตุผล" value={reason} onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 300, "data-testid": "gm-reason" }} required multiline minRows={2} /> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>ยกเลิก</Button>
        <Button variant="contained" onClick={save} disabled={busy} data-testid="gm-save">บันทึก</Button>
      </DialogActions>
    </Dialog>
  );
}
