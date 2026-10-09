"use client";

// ---------------------------------------------------------------------------
// ร่องรอยการใช้งานและการแก้ไขข้อมูล (Audit Log)
// ---------------------------------------------------------------------------
// ที่มา: USR-FN-007 "บันทึกประวัติการเข้าใช้งานและการแก้ไขข้อมูลได้"
//        NFR Audit Log "…ระบุผู้ดำเนินการและวันเวลาได้"
// เปิดให้เฉพาะผู้ที่จัดการผู้ใช้ได้ (admin) — บังคับซ้ำที่ backend ด้วย

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AuditAction, AuditEntity, AuditLog } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { bangkokDateTimeSeconds } from "@/lib/date";
import { AUDIT_ACTION_OPTIONS, AUDIT_ENTITY_OPTIONS, roleLabel } from "@/lib/auditOptions";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WomsDataTable, WomsEmptyState, WomsFilterPanel, WomsPageHeader, WomsSelectFilter, type WomsColumn } from "@/components/woms";

// DEF-10 / DEF-14 — ตัวเลือกครบตาม backend (PAYMENT / PAYMENT_CORRECTION / REQUEST + entity ใหม่) และป้าย role ภาษาไทย
const ENTITIES: Array<{ value: "" | AuditEntity; label: string }> = [{ value: "", label: "ทุกประเภทข้อมูล" }, ...AUDIT_ENTITY_OPTIONS];
const ACTIONS: Array<{ value: "" | AuditAction; label: string }> = [{ value: "", label: "ทุกการกระทำ" }, ...AUDIT_ACTION_OPTIONS];

export default function AuditPage() {
  // QA BUG-035 — เดิมหน้านี้เรนเดอร์ UI เต็มรูปแบบให้ทุกคน แล้วแสดงข้อความขัดแย้งกันสองอัน
  // พร้อมกัน ("ไม่มีสิทธิ์ดำเนินการนี้" + "ไม่พบรายการในช่วงที่เลือก")
  // ผู้ใช้อ่านอันหลังแล้วเข้าใจผิดว่า "ระบบไม่มีประวัติในช่วงนี้" ทั้งที่ถูกปฏิเสธสิทธิ์
  // กันที่ระดับหน้าจอเหมือน /users และห้าม empty state ปนกับ error state (B-14)
  const { status, has } = useAuth();
  const canView = has("users:manage") || has("audit:view");
  const [items, setItems] = useState<AuditLog[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState<"" | AuditEntity>("");
  const [action, setAction] = useState<"" | AuditAction>("");
  // Round 8 · CORE-04 — ค้นผู้ดำเนินการ และข้อมูลที่ถูกกระทำ (id / เลขเอกสาร / SN)
  const [actor, setActor] = useState("");
  const [entityRef, setEntityRef] = useState("");
  const [debActor, setDebActor] = useState("");
  const [debRef, setDebRef] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setDebActor(actor.trim());
      setDebRef(entityRef.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [actor, entityRef]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // เปลี่ยนตัวกรองเร็ว ๆ แล้วคำตอบเก่ามาถึงทีหลัง → ต้องไม่ทับผลของตัวกรองล่าสุด
  const reqSeq = useRef(0);
  const load = useCallback(async () => {
    if (!canView) return;
    const seq = ++reqSeq.current;
    setError(null);
    setDenied(false);
    setItems(null);
    try {
      const r = await api.listAudit({
        entity: entity || undefined,
        action: action || undefined,
        actor: debActor || undefined,
        entityRef: debRef || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 300,
      });
      if (seq !== reqSeq.current) return;
      setItems(r.items);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      // 403 จาก API = ไม่มีสิทธิ์ ไม่ใช่ "ไม่มีข้อมูล" — ต้องไม่ตกลงไปที่ empty state
      if (e instanceof ApiError && e.status === 403) {
        setDenied(true);
        setItems(null);
        return;
      }
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      setItems(null);
    }
  }, [entity, action, debActor, debRef, from, to, canView]);

  useEffect(() => {
    load();
  }, [load]);

  if (status !== "authed") return null;
  if (!canView || denied) return <WomsEmptyState title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้" />;

  const detail = items?.find((a) => a.id === expanded) ?? null;
  const changesBtn = (a: AuditLog) =>
    a.changes.length > 0 ? (
      <Button size="small" onClick={() => setExpanded(a.id)}>
        ดูที่เปลี่ยน ({a.changes.length})
      </Button>
    ) : null;
  const columns: WomsColumn<AuditLog>[] = [
    { key: "at", label: "เวลา", sortValue: (a) => a.at, render: (a) => <span className="mono">{bangkokDateTimeSeconds(a.at)}</span> },
    {
      key: "actor",
      label: "ผู้ดำเนินการ",
      sortValue: (a) => a.actorName,
      render: (a) => (
        <>
          {a.actorName}
          {a.actorRole ? <Chip size="small" variant="outlined" label={roleLabel(a.actorRole)} sx={{ ml: 0.75 }} /> : null}
        </>
      ),
    },
    { key: "action", label: "การกระทำ", sortValue: (a) => a.actionLabel, render: (a) => a.actionLabel },
    {
      key: "entity",
      label: "ข้อมูล",
      render: (a) => (
        <>
          <span className="mono">{a.entityLabel || a.entity}</span>
          <Typography variant="body2" component="div">
            {ENTITIES.find((x) => x.value === a.entity)?.label ?? a.entity}
            {a.entityId ? <span className="mono"> · {a.entityId}</span> : null}
          </Typography>
        </>
      ),
    },
    {
      key: "summary",
      label: "รายละเอียด",
      render: (a) => (
        <>
          {a.summary}
          {changesBtn(a)}
        </>
      ),
    },
    { key: "ip", label: "IP", hideBelowLg: true, render: (a) => <span className="mono">{a.ip || "-"}</span> },
  ];

  return (
    <>
      <WomsPageHeader title="ประวัติการใช้งานระบบ" subtitle="ใครทำอะไร เมื่อไหร่ กับข้อมูลชิ้นไหน — บันทึกอัตโนมัติ แก้ไขไม่ได้" />

      <WomsFilterPanel
        activeCount={[entity, action, actor, entityRef, from, to].filter(Boolean).length}
        onClear={() => {
          setEntity("");
          setAction("");
          setActor("");
          setEntityRef("");
          setFrom("");
          setTo("");
        }}
      >
        <WomsSelectFilter label="ประเภทข้อมูล" value={entity} onChange={(v) => setEntity(v as "" | AuditEntity)} options={ENTITIES.filter((o) => o.value)} allLabel="ทุกประเภทข้อมูล" minWidth={180} />
        <WomsSelectFilter label="การกระทำ" value={action} onChange={(v) => setAction(v as "" | AuditAction)} options={ACTIONS.filter((o) => o.value)} allLabel="ทุกการกระทำ" minWidth={170} />
        <TextField label="ผู้ดำเนินการ" placeholder="ชื่อหรือ id ผู้ใช้" value={actor} onChange={(e) => setActor(e.target.value)} fullWidth={false} sx={{ minWidth: 180 }} />
        <TextField
          label="ข้อมูลที่ถูกกระทำ"
          placeholder="id / เลขใบงาน / เลขสัญญา / SN"
          value={entityRef}
          onChange={(e) => setEntityRef(e.target.value)}
          fullWidth={false}
          sx={{ minWidth: 220 }}
        />
        <TextField label="ตั้งแต่วันที่" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth={false} sx={{ minWidth: 160 }} />
        <TextField label="ถึงวันที่" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth={false} sx={{ minWidth: 160 }} />
      </WomsFilterPanel>

      {/* B-14 — error กับ empty state ห้ามแสดงปนกัน (WomsDataTable แสดงอย่างใดอย่างหนึ่งเท่านั้น) */}
      <WomsDataTable
        caption="ประวัติการใช้งานระบบ"
        rows={items ?? []}
        loading={items === null && !error}
        error={error}
        onRetry={load}
        columns={columns}
        rowKey={(a) => a.id}
        pageSize={25}
        emptyTitle="ไม่พบรายการในช่วงที่เลือก"
        renderCard={(a) => (
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            <Typography sx={{ color: "text.primary", fontWeight: 600 }}>
              {a.actionLabel} · {a.entityLabel || a.entity}
            </Typography>
            <Typography variant="body2">
              {bangkokDateTimeSeconds(a.at)} · {a.actorName}
              {a.actorRole ? ` (${roleLabel(a.actorRole)})` : ""}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.primary" }}>
              {a.summary}
            </Typography>
            {changesBtn(a)}
          </Box>
        )}
      />

      <Dialog open={!!detail} onClose={() => setExpanded(null)} maxWidth="md" aria-labelledby="audit-changes-title">
        <DialogTitle id="audit-changes-title">ข้อมูลที่เปลี่ยน</DialogTitle>
        <DialogContent sx={{ overflowX: "auto" }}>
          {detail ? (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {detail.summary} · {bangkokDateTimeSeconds(detail.at)} · {detail.actorName}
              </Typography>
              <Table size="small" aria-label="ข้อมูลที่เปลี่ยน">
                <TableHead>
                  <TableRow>
                    <TableCell>ฟิลด์</TableCell>
                    <TableCell>ก่อน</TableCell>
                    <TableCell>หลัง</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detail.changes.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="mono">{c.field}</TableCell>
                      <TableCell sx={{ overflowWrap: "anywhere" }}>{c.before || "(ว่าง)"}</TableCell>
                      <TableCell sx={{ overflowWrap: "anywhere" }}>{c.after || "(ว่าง)"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpanded(null)}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
